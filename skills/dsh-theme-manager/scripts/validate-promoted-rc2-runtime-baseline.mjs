#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { lstat, readFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

import { loadCertifiedRuntimeBaseline } from './baseline-authority.mjs';
import { validateFinalCertificationBundle } from './rc2-final-evidence.mjs';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const skillDirectory = resolve(scriptDirectory, '..');
const referencesDirectory = resolve(skillDirectory, 'references');
const MAX_ARCHIVE_BYTES = 64 * 1024 * 1024;
const MAX_TAR_BYTES = 4 * 1024 * 1024;
const MAX_PROVENANCE_BYTES = 4 * 1024 * 1024;
const TAR_BLOCK_BYTES = 512;
const FINAL_ATTESTATION = 'attestation.dsh-0.1.1-rc.2.final.json';
const FINAL_RECEIPT = 'certification-receipt.dsh-0.1.1-rc.2.final.json';
const MATRIX_FILES = Object.freeze([
  'darwin-node-22.19.0.json',
  'darwin-node-24.15.0.json',
  'linux-node-22.19.0.json',
  'linux-node-24.15.0.json',
  'win32-node-22.19.0.json',
  'win32-node-24.15.0.json',
]);

function fail(message) {
  throw new Error(`promoted RC.2 runtime baseline refused: ${message}`);
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

async function readBoundedRegularFile(path, maxBytes, label) {
  const details = await lstat(path);
  if (!details.isFile() || details.isSymbolicLink()) {
    fail(`${label} is not a regular non-symlink file`);
  }
  if (details.size <= 0 || details.size > maxBytes) {
    fail(`${label} byte size is outside the closed limit`);
  }
  return readFile(path);
}

function nullTerminatedText(bytes) {
  const zero = bytes.indexOf(0);
  return bytes.subarray(0, zero === -1 ? bytes.length : zero).toString('utf8');
}

function octal(bytes, label) {
  const text = nullTerminatedText(bytes).trim();
  if (!/^[0-7]+$/.test(text)) fail(`${label} is not canonical octal`);
  const value = Number.parseInt(text, 8);
  if (!Number.isSafeInteger(value) || value < 0) fail(`${label} is unsafe`);
  return value;
}

function verifyTarChecksum(header) {
  const expected = octal(header.subarray(148, 156), 'tar checksum');
  let actual = 0;
  for (let index = 0; index < header.length; index += 1) {
    actual += index >= 148 && index < 156 ? 0x20 : header[index];
  }
  if (actual !== expected) fail('tar header checksum differs');
}

function parseArchive(archiveBytes) {
  let tar;
  try {
    tar = gunzipSync(archiveBytes, { maxOutputLength: MAX_TAR_BYTES });
  } catch {
    fail('final archive is not a bounded gzip stream');
  }
  if (tar.length === 0 || tar.length % TAR_BLOCK_BYTES !== 0) {
    fail('final tar stream is empty or misaligned');
  }
  const entries = new Map();
  let offset = 0;
  let zeroBlocks = 0;
  while (offset < tar.length) {
    const header = tar.subarray(offset, offset + TAR_BLOCK_BYTES);
    offset += TAR_BLOCK_BYTES;
    if (header.every((byte) => byte === 0)) {
      zeroBlocks += 1;
      continue;
    }
    if (zeroBlocks !== 0) fail('tar data follows an end-of-archive block');
    verifyTarChecksum(header);
    const name = nullTerminatedText(header.subarray(0, 100));
    const prefix = nullTerminatedText(header.subarray(345, 500));
    const path = prefix ? `${prefix}/${name}` : name;
    const size = octal(header.subarray(124, 136), `tar size for ${path}`);
    const type = header[156] === 0 ? '0' : String.fromCharCode(header[156]);
    if (!path.startsWith('./') || path.includes('..') || entries.has(path)) {
      fail(`tar path is unsafe or duplicated: ${path}`);
    }
    if (type !== '0' && type !== '5') fail(`tar entry type is refused: ${path}`);
    if (type === '5' && size !== 0) fail(`tar directory contains data: ${path}`);
    const padded = Math.ceil(size / TAR_BLOCK_BYTES) * TAR_BLOCK_BYTES;
    if (offset + padded > tar.length) fail(`tar entry is truncated: ${path}`);
    entries.set(path, {
      type,
      bytes: type === '0' ? tar.subarray(offset, offset + size) : null,
    });
    offset += padded;
  }
  if (zeroBlocks < 2) fail('tar stream lacks the final zero blocks');
  return entries;
}

function decodeBase64(value, label) {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(value)
  ) {
    fail(`${label} is not strict base64`);
  }
  const bytes = Buffer.from(value, 'base64');
  if (bytes.toString('base64') !== value) fail(`${label} is not canonical base64`);
  return bytes;
}

export function validateSigstoreBundle(
  bytes,
  projection,
  archiveName,
  archiveSha256
) {
  let bundle;
  try {
    bundle = JSON.parse(bytes.toString('utf8'));
  } catch {
    fail('detached Sigstore bundle is not JSON');
  }
  if (
    bundle.mediaType !== 'application/vnd.dev.sigstore.bundle.v0.3+json' ||
    bundle.dsseEnvelope?.payloadType !== 'application/vnd.in-toto+json' ||
    !Array.isArray(bundle.dsseEnvelope?.signatures) ||
    bundle.dsseEnvelope.signatures.length !== 1 ||
    !Array.isArray(bundle.verificationMaterial?.tlogEntries) ||
    bundle.verificationMaterial.tlogEntries.length === 0
  ) {
    fail('detached Sigstore bundle structure differs');
  }
  decodeBase64(
    bundle.verificationMaterial?.certificate?.rawBytes,
    'Sigstore certificate'
  );
  decodeBase64(bundle.dsseEnvelope.signatures[0]?.sig, 'DSSE signature');
  let statement;
  try {
    statement = JSON.parse(
      decodeBase64(bundle.dsseEnvelope.payload, 'DSSE payload').toString('utf8')
    );
  } catch {
    fail('DSSE payload is not a JSON statement');
  }
  const workflow = statement.predicate?.buildDefinition?.externalParameters?.workflow;
  const github = statement.predicate?.buildDefinition?.internalParameters?.github;
  const dependency = statement.predicate?.buildDefinition?.resolvedDependencies?.[0];
  if (
    statement._type !== 'https://in-toto.io/Statement/v1' ||
    statement.predicateType !== 'https://slsa.dev/provenance/v1' ||
    !Array.isArray(statement.subject) ||
    statement.subject.length !== 1 ||
    statement.subject[0]?.name !== archiveName ||
    statement.subject[0]?.digest?.sha256 !== archiveSha256 ||
    workflow?.ref !== 'refs/heads/main' ||
    workflow?.repository !== 'https://github.com/LvvUP/dsh-themes-skills' ||
    workflow?.path !== '.github/workflows/rc2-certification.yml' ||
    github?.event_name !== 'workflow_dispatch' ||
    github?.runner_environment !== 'github-hosted' ||
    dependency?.uri !==
      'git+https://github.com/LvvUP/dsh-themes-skills@refs/heads/main' ||
    dependency?.digest?.gitCommit !== projection.certification.sourceSha ||
    statement.predicate?.runDetails?.builder?.id !==
      `https://github.com/${projection.certification.workflow}` ||
    statement.predicate?.runDetails?.metadata?.invocationId !==
      `https://github.com/LvvUP/dsh-themes-skills/actions/runs/${projection.certification.runId}/attempts/${projection.certification.runAttempt}`
  ) {
    fail('DSSE statement does not bind the exact archive, workflow, and run');
  }
}

export function validateArchiveEvidenceBytes(archiveBytes, expectedEvidence) {
  const entries = parseArchive(archiveBytes);
  const expectedPaths = [
    './',
    `./${FINAL_ATTESTATION}`,
    `./${FINAL_RECEIPT}`,
    './matrix/',
    ...MATRIX_FILES.map((name) => `./matrix/${name}`),
  ];
  if (
    JSON.stringify([...entries.keys()].sort()) !==
    JSON.stringify([...expectedPaths].sort())
  ) {
    fail('final archive file set differs from the eight-file evidence bundle');
  }
  if (
    !(expectedEvidence instanceof Map) ||
    JSON.stringify([...expectedEvidence.keys()].sort()) !==
      JSON.stringify(expectedPaths.filter((path) => !path.endsWith('/')).sort())
  ) {
    fail('expected checked-in evidence map differs from the closed file set');
  }
  for (const path of expectedPaths) {
    const entry = entries.get(path);
    if (path.endsWith('/')) {
      if (entry?.type !== '5') fail(`archive directory differs: ${path}`);
      continue;
    }
    const repositoryBytes = expectedEvidence.get(path);
    if (!Buffer.isBuffer(repositoryBytes)) {
      fail(`checked-in evidence is not bytes: ${path}`);
    }
    if (entry?.type !== '0' || !entry.bytes.equals(repositoryBytes)) {
      fail(`archive bytes differ from checked-in evidence: ${path}`);
    }
  }
}

async function validateArchiveContents(archiveBytes) {
  const evidencePaths = [
    `./${FINAL_ATTESTATION}`,
    `./${FINAL_RECEIPT}`,
    ...MATRIX_FILES.map((name) => `./matrix/${name}`),
  ];
  const evidenceBytes = await Promise.all(
    evidencePaths.map(async (path) => {
      const repositoryPath = path.startsWith('./matrix/')
        ? resolve(referencesDirectory, 'matrix', basename(path))
        : resolve(referencesDirectory, basename(path));
      return [path, await readFile(repositoryPath)];
    })
  );
  validateArchiveEvidenceBytes(archiveBytes, new Map(evidenceBytes));
}

export async function validatePromotedRuntimeBaseline() {
  const [{ evidence: projection }, final] = await Promise.all([
    loadCertifiedRuntimeBaseline(),
    validateFinalCertificationBundle(referencesDirectory),
  ]);
  const certification = projection.certification;
  const archiveName =
    'rc2-final-baseline-certification-cc7546cb5ccd77002713171328972291ceaa12e6-run-32694257969-attempt-1.tar.gz';
  if (
    projection.officialRelease?.tag !== 'dsh-v0.1.1-rc.2' ||
    projection.officialRelease?.sourceCommit !==
      'b150a551b8d465e31e418e1b2eaf5e79bbb7d28e' ||
    certification.repository !== 'LvvUP/dsh-themes-skills' ||
    certification.workflow !==
      'LvvUP/dsh-themes-skills/.github/workflows/rc2-certification.yml@refs/heads/main' ||
    certification.sourceSha !==
      'cc7546cb5ccd77002713171328972291ceaa12e6' ||
    certification.runId !== '32694257969' ||
    certification.runAttempt !== '1' ||
    certification.attestation.path !==
      `skills/dsh-theme-manager/references/${FINAL_ATTESTATION}` ||
    certification.receipt.path !==
      `skills/dsh-theme-manager/references/${FINAL_RECEIPT}` ||
    certification.matrix.receiptSetSha256 !==
      'b3d663b43b257a43d138538454cd40eb976802bdcabf0409295f7956dc07f1ae' ||
    certification.archive.path !==
      `skills/dsh-theme-manager/references/${archiveName}` ||
    certification.provenance.path !==
      `skills/dsh-theme-manager/references/${archiveName}.sigstore.json`
  ) {
    fail('projection does not name the exact reviewed release, run, and paths');
  }
  const archivePath = resolve(referencesDirectory, basename(certification.archive.path));
  const provenancePath = resolve(
    referencesDirectory,
    basename(certification.provenance.path)
  );
  const [archiveBytes, provenanceBytes] = await Promise.all([
    readBoundedRegularFile(archivePath, MAX_ARCHIVE_BYTES, 'final archive'),
    readBoundedRegularFile(
      provenancePath,
      MAX_PROVENANCE_BYTES,
      'detached Sigstore bundle'
    ),
  ]);
  const archiveSha256 = sha256(archiveBytes);
  const provenanceSha256 = sha256(provenanceBytes);
  if (
    final.status !== projection.status ||
    final.baseline !== projection.baseline ||
    final.productionReady !== true ||
    final.installableItems !== false ||
    final.completedMatrixJobs !== 6 ||
    final.requiredMatrixJobs !== 6 ||
    final.attestationSha256 !== certification.attestation.sha256 ||
    final.certificationReceiptSha256 !== certification.receipt.sha256 ||
    certification.matrix.requiredJobs !== 6 ||
    certification.matrix.completedJobs !== 6 ||
    archiveSha256 !== certification.archive.sha256 ||
    provenanceSha256 !== certification.provenance.sha256
  ) {
    fail('projection differs from the final evidence bytes');
  }
  await validateArchiveContents(archiveBytes);
  validateSigstoreBundle(
    provenanceBytes,
    projection,
    archiveName,
    archiveSha256
  );
  return {
    status: projection.status,
    certificationStatus: projection.certificationStatus,
    productionReady: true,
    installableItems: false,
    itemInstallability: projection.itemInstallability,
    dshVersion: projection.dshPackageVersion,
    sourceSha: certification.sourceSha,
    runId: certification.runId,
    runAttempt: certification.runAttempt,
    completedMatrixJobs: 6,
    requiredMatrixJobs: 6,
    attestationSha256: final.attestationSha256,
    certificationReceiptSha256: final.certificationReceiptSha256,
    archiveSha256,
    provenanceSha256,
  };
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  if (process.argv.length !== 2) fail('this validator accepts no arguments');
  process.stdout.write(`${JSON.stringify(await validatePromotedRuntimeBaseline())}\n`);
}
