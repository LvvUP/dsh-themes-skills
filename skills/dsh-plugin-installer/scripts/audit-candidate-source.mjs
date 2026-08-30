#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { lstat, open, readFile, realpath } from 'node:fs/promises';
import { basename, isAbsolute, join, parse, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { inspectTarEntries } from './archive-policy.mjs';
import {
  LIFECYCLE_HOOKS,
  lifecycleHooksFromManifest,
  lifecycleHooksSha256,
  normalizeBundlePatch,
} from './authority.mjs';
import { loadCandidateIntake, validateCandidateIntake } from './candidate-intake.mjs';
import { fetchBoundedExact } from './fetch-plugin-source.mjs';

const SHA40 = /^[a-f0-9]{40}$/u;
const SHA64 = /^[a-f0-9]{64}$/u;
const PACKAGE = /^(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+$/u;
const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u;
const SAFE_PATH = /^(?:[A-Za-z0-9._-]+\/)*[A-Za-z0-9._-]+(?:\.ya?ml)$/u;
const MAX_MANIFEST_BYTES = 1024 * 1024;
const MAX_LICENSE_BYTES = 1024 * 1024;
const MAX_PATCH_BYTES = 4 * 1024 * 1024;
const MAX_LOCKFILE_BYTES = 32 * 1024 * 1024;
const MAX_NPM_METADATA_BYTES = 4 * 1024 * 1024;
const MAX_NPM_TARBALL_BYTES = 256 * 1024 * 1024;
const LOCKFILES = ['pnpm-lock.yaml', 'package-lock.json', 'yarn.lock', 'npm-shrinkwrap.json'];
const ALPHA1_REMOVED_PACKAGES = new Set([
  '@deepseek-ai/dsh-client-runtime',
  '@deepseek-ai/dsh-host-apiproxy',
]);

function fail(message) {
  throw new Error(message);
}

function exactKeys(value, expected, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    fail(`${label} must be an object`);
  }
  if (JSON.stringify(Object.keys(value).sort()) !== JSON.stringify([...expected].sort())) {
    fail(`${label} keys mismatch`);
  }
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function bounded(bytes, maximum, label) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 1 || bytes.length > maximum) {
    fail(`${label} is empty or exceeds its byte limit`);
  }
  return bytes;
}

function runGit(source, args) {
  const result = spawnSync('git', ['-c', 'core.fsmonitor=false', ...args], {
    cwd: source,
    encoding: 'utf8',
    env: {
      PATH: process.env.PATH,
      SystemRoot: process.env.SystemRoot,
      WINDIR: process.env.WINDIR,
      HOME: process.env.HOME,
      USERPROFILE: process.env.USERPROFILE,
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_CONFIG_GLOBAL: process.platform === 'win32' ? 'NUL' : '/dev/null',
      GIT_TERMINAL_PROMPT: '0',
      GIT_OPTIONAL_LOCKS: '0',
      GCM_INTERACTIVE: 'Never',
    },
    maxBuffer: 1024 * 1024,
    shell: false,
    timeout: 30_000,
  });
  if (result.status !== 0 || result.error || result.stderr.trim() !== '') {
    fail('candidate checkout Git identity probe failed');
  }
  return result.stdout.trim();
}

async function canonicalCheckout(input) {
  if (!isAbsolute(input)) fail('--source must be an absolute checkout');
  const path = resolve(input);
  if (path === parse(path).root) fail('--source cannot be a filesystem root');
  const stat = await lstat(path);
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    fail('--source must be one real directory, not a symlink');
  }
  return realpath(path);
}

async function readBounded(path, maximum, label) {
  const stat = await lstat(path);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size < 1 || stat.size > maximum) {
    fail(`${label} is missing, linked, empty, or exceeds its byte limit`);
  }
  return bounded(await readFile(path), maximum, label);
}

async function containedUnlinkedPath(root, relativePath, label, expectedType) {
  const normalized = relativePath === '.' ? [] : relativePath.split('/');
  let current = root;
  for (const segment of normalized) {
    current = join(current, segment);
    const stat = await lstat(current);
    if (stat.isSymbolicLink()) fail(`${label} must not traverse a symbolic link`);
  }
  const target = normalized.length === 0 ? root : current;
  const targetReal = await realpath(target);
  const inside = relative(root, targetReal);
  if (inside.startsWith('..') || isAbsolute(inside)) {
    fail(`${label} escapes the candidate checkout`);
  }
  const stat = await lstat(targetReal);
  if ((expectedType === 'directory' && !stat.isDirectory()) ||
      (expectedType === 'file' && (!stat.isFile() || stat.isSymbolicLink()))) {
    fail(`${label} is not one real ${expectedType}`);
  }
  return targetReal;
}

function normalizeRepository(value) {
  if (typeof value !== 'string') return null;
  let normalized = value.trim().replace(/^git\+/u, '').replace(/^git:\/\//u, 'https://');
  normalized = normalized.replace(/^git@github\.com:/u, 'https://github.com/');
  normalized = normalized.replace(/\/$/u, '').replace(/\.git$/u, '');
  try {
    const url = new URL(normalized);
    if (url.protocol !== 'https:' || url.hostname !== 'github.com' || url.username || url.password) {
      return null;
    }
    return `${url.origin}${url.pathname}`.toLowerCase();
  } catch {
    return null;
  }
}

function alpha1RemovedPackageReferences(manifest) {
  const references = new Set();
  const inject = manifest?.dsh?.client?.inject;
  if (Array.isArray(inject)) {
    for (const name of inject) {
      if (ALPHA1_REMOVED_PACKAGES.has(name)) references.add(name);
    }
  }
  for (const field of ['dependencies', 'optionalDependencies', 'peerDependencies']) {
    const dependencies = manifest?.[field];
    if (dependencies === null || typeof dependencies !== 'object' || Array.isArray(dependencies)) {
      continue;
    }
    for (const name of Object.keys(dependencies)) {
      if (ALPHA1_REMOVED_PACKAGES.has(name)) references.add(name);
    }
  }
  return [...references].sort();
}

function tarManifest(entries) {
  const entry = entries.find((candidate) =>
    candidate.name === 'package/package.json' && candidate.type === '0');
  if (!entry || entry.body.length < 1 || entry.body.length > MAX_MANIFEST_BYTES) {
    fail('exact npm tarball lacks one bounded package/package.json');
  }
  let manifest;
  try {
    manifest = JSON.parse(entry.body.toString('utf8'));
  } catch {
    fail('exact npm tarball manifest is not valid JSON');
  }
  return { entry, manifest };
}

function npmMetadataUrl(name, version) {
  return `https://registry.npmjs.org/${encodeURIComponent(name)}/${encodeURIComponent(version)}`;
}

async function inspectExactNpm(manifest, candidate, fetchImpl) {
  let metadata;
  try {
    metadata = await fetchBoundedExact({
      url: npmMetadataUrl(manifest.name, manifest.version),
      expectedOrigin: 'https://registry.npmjs.org',
      maxBytes: MAX_NPM_METADATA_BYTES,
      accept: 'application/json',
      fetchImpl,
    });
  } catch {
    return null;
  }
  let document;
  try {
    document = JSON.parse(metadata.bytes.toString('utf8'));
  } catch {
    fail('exact npm version metadata is not valid JSON');
  }
  const tarballUrl = document?.dist?.tarball;
  const distIntegrity = document?.dist?.integrity;
  if (
    document?.name !== manifest.name ||
    document?.version !== manifest.version ||
    typeof tarballUrl !== 'string' ||
    !tarballUrl.startsWith('https://registry.npmjs.org/') ||
    typeof distIntegrity !== 'string' ||
    !/^sha512-[A-Za-z0-9+/]+={0,2}$/u.test(distIntegrity)
  ) {
    fail('exact npm metadata identity or dist fields are malformed');
  }
  const artifact = await fetchBoundedExact({
    url: tarballUrl,
    expectedOrigin: 'https://registry.npmjs.org',
    maxBytes: MAX_NPM_TARBALL_BYTES,
    fetchImpl,
  });
  const actualIntegrity = `sha512-${createHash('sha512').update(artifact.bytes).digest('base64')}`;
  if (actualIntegrity !== distIntegrity) fail('exact npm tarball does not match dist.integrity');
  const entries = inspectTarEntries(artifact.bytes);
  const packed = tarManifest(entries);
  if (
    packed.manifest.name !== manifest.name ||
    packed.manifest.version !== manifest.version ||
    normalizeBundlePatch(packed.manifest.dsh?.bundle?.patch) !==
      normalizeBundlePatch(manifest.dsh.bundle.patch)
  ) {
    fail('exact npm tarball package identity or dsh.bundle.patch differs from the pinned source');
  }
  const removedPackageReferences = alpha1RemovedPackageReferences(packed.manifest);
  if (removedPackageReferences.length > 0) {
    fail(`exact npm tarball references packages absent from alpha.1: ${removedPackageReferences.join(', ')}`);
  }
  const patchName = `package/${normalizeBundlePatch(manifest.dsh.bundle.patch)}`;
  if (!entries.some((entry) => entry.name === patchName && entry.type === '0')) {
    fail('exact npm tarball omits its declared DSH bundle patch');
  }
  const sourceRepository = normalizeRepository(candidate.repository);
  const declaredRepository = normalizeRepository(
    typeof document.repository === 'string' ? document.repository : document.repository?.url
  );
  const lifecycle = lifecycleHooksFromManifest(packed.manifest);
  return {
    type: 'npm-package-version',
    registry: 'https://registry.npmjs.org',
    packageName: packed.manifest.name,
    version: packed.manifest.version,
    metadataSha256: metadata.sha256,
    tarballUrl,
    tarballBytes: artifact.bytes.length,
    tarballSha256: artifact.sha256,
    distIntegrity,
    packedManifestSha256: sha256(packed.entry.body),
    repositoryBinding:
      declaredRepository === null
        ? 'missing-review-required'
        : declaredRepository === sourceRepository
          ? 'exact'
          : 'mismatch-review-required',
    packedLicensePresent: entries.some((entry) =>
      /^package\/(?:licen[cs]e|copying)(?:\.[A-Za-z0-9._-]+)?$/iu.test(entry.name) &&
      entry.type === '0' && entry.body.length > 0),
    lifecycle: {
      hooks: lifecycle,
      hooksSha256: lifecycleHooksSha256(lifecycle),
    },
  };
}

function rejectedReceipt(candidate, source, reasons) {
  return {
    schemaVersion: 2,
    status: 'source-intake-rejected',
    candidateExecuted: false,
    catalogId: candidate.catalogId,
    source,
    package: null,
    npm: null,
    review: {
      runtimeCertified: false,
      distributionApproved: false,
      replacementRequired: true,
      reasons,
    },
    privacy: {
      capturesCredentials: false,
      capturesEnvironment: false,
      capturesCandidateOutput: false,
    },
  };
}

function validateLifecycle(value, label) {
  exactKeys(value, ['hooks', 'hooksSha256'], label);
  exactKeys(value.hooks, LIFECYCLE_HOOKS, `${label}.hooks`);
  if (lifecycleHooksSha256(value.hooks) !== value.hooksSha256) {
    fail(`${label} digest mismatch`);
  }
}

export function validateSourceIntakeReceipt(receipt, candidate) {
  exactKeys(
    receipt,
    [
      'schemaVersion',
      'status',
      'candidateExecuted',
      'catalogId',
      'source',
      'package',
      'npm',
      'review',
      'privacy',
    ],
    'source-intake receipt'
  );
  if (
    receipt.schemaVersion !== 2 ||
    !['source-intake-audited', 'source-intake-rejected'].includes(receipt.status) ||
    receipt.candidateExecuted !== false ||
    receipt.catalogId !== candidate.catalogId
  ) {
    fail('source-intake receipt header mismatch');
  }
  exactKeys(
    receipt.source,
    [
      'repository',
      'commit',
      'tree',
      'sourceSubdir',
      'manifestSha256',
      'licensePath',
      'licenseSha256',
      'bundlePatchSha256',
      'lockfiles',
    ],
    'source-intake receipt source'
  );
  if (
    receipt.source.repository !== candidate.repository ||
    receipt.source.commit !== candidate.commit ||
    receipt.source.sourceSubdir !== (candidate.sourceSubdir ?? '.') ||
    !SHA40.test(receipt.source.tree) ||
    receipt.source.licensePath !== candidate.licenseEvidencePath ||
    !Array.isArray(receipt.source.lockfiles) ||
    receipt.source.lockfiles.length > LOCKFILES.length
  ) {
    fail('source-intake receipt source identity mismatch');
  }
  const lockfileNames = [];
  for (const [index, lockfile] of receipt.source.lockfiles.entries()) {
    exactKeys(lockfile, ['path', 'bytes', 'sha256'], `source lockfiles[${index}]`);
    if (
      !LOCKFILES.includes(lockfile.path) ||
      !Number.isSafeInteger(lockfile.bytes) ||
      lockfile.bytes < 1 ||
      lockfile.bytes > MAX_LOCKFILE_BYTES ||
      !SHA64.test(lockfile.sha256)
    ) {
      fail(`source lockfiles[${index}] is malformed`);
    }
    lockfileNames.push(lockfile.path);
  }
  if (new Set(lockfileNames).size !== lockfileNames.length) {
    fail('source-intake receipt contains duplicate lockfiles');
  }
  exactKeys(
    receipt.review,
    ['runtimeCertified', 'distributionApproved', 'replacementRequired', 'reasons'],
    'source-intake receipt review'
  );
  if (
    receipt.review.runtimeCertified !== false ||
    receipt.review.distributionApproved !== false ||
    !Array.isArray(receipt.review.reasons) ||
    receipt.review.reasons.length < 1 ||
    receipt.review.reasons.some(
      (reason) =>
        typeof reason !== 'string' ||
        reason.length < 1 ||
        reason.length > 300 ||
        /[\u0000-\u001f\u007f]/u.test(reason)
    )
  ) {
    fail('source-intake receipt review must remain bounded and non-promotional');
  }
  exactKeys(
    receipt.privacy,
    ['capturesCredentials', 'capturesEnvironment', 'capturesCandidateOutput'],
    'source-intake receipt privacy'
  );
  if (Object.values(receipt.privacy).some((value) => value !== false)) {
    fail('source-intake receipt privacy flags must all be false');
  }
  if (receipt.status === 'source-intake-rejected') {
    if (
      receipt.package !== null ||
      receipt.npm !== null ||
      receipt.review.replacementRequired !== true ||
      ![receipt.source.manifestSha256, receipt.source.licenseSha256, receipt.source.bundlePatchSha256]
        .every((value) => value === null || SHA64.test(value))
    ) {
      fail('rejected source-intake receipt is inconsistent');
    }
    return receipt;
  }
  if (
    receipt.review.replacementRequired !== false ||
    !SHA64.test(receipt.source.manifestSha256) ||
    !SHA64.test(receipt.source.licenseSha256) ||
    !SHA64.test(receipt.source.bundlePatchSha256)
  ) {
    fail('audited source-intake receipt lacks source evidence');
  }
  exactKeys(
    receipt.package,
    ['name', 'version', 'bundlePatch', 'manifestSha256', 'lifecycle'],
    'source-intake receipt package'
  );
  if (
    !PACKAGE.test(receipt.package.name) ||
    !SEMVER.test(receipt.package.version) ||
    !SAFE_PATH.test(receipt.package.bundlePatch) ||
    receipt.package.manifestSha256 !== receipt.source.manifestSha256
  ) {
    fail('source-intake receipt package identity mismatch');
  }
  validateLifecycle(receipt.package.lifecycle, 'source-intake receipt package lifecycle');
  if (receipt.npm !== null) {
    exactKeys(
      receipt.npm,
      [
        'type',
        'registry',
        'packageName',
        'version',
        'metadataSha256',
        'tarballUrl',
        'tarballBytes',
        'tarballSha256',
        'distIntegrity',
        'packedManifestSha256',
        'repositoryBinding',
        'packedLicensePresent',
        'lifecycle',
      ],
      'source-intake receipt npm'
    );
    if (
      receipt.npm.type !== 'npm-package-version' ||
      receipt.npm.registry !== 'https://registry.npmjs.org' ||
      receipt.npm.packageName !== receipt.package.name ||
      receipt.npm.version !== receipt.package.version ||
      !SHA64.test(receipt.npm.metadataSha256) ||
      !SHA64.test(receipt.npm.tarballSha256) ||
      !SHA64.test(receipt.npm.packedManifestSha256) ||
      !Number.isSafeInteger(receipt.npm.tarballBytes) ||
      receipt.npm.tarballBytes < 1 ||
      receipt.npm.tarballBytes > MAX_NPM_TARBALL_BYTES ||
      !/^https:\/\/registry\.npmjs\.org\/[^?#]+\.tgz$/u.test(receipt.npm.tarballUrl) ||
      !/^sha512-[A-Za-z0-9+/]+={0,2}$/u.test(receipt.npm.distIntegrity) ||
      !['exact', 'missing-review-required', 'mismatch-review-required'].includes(
        receipt.npm.repositoryBinding
      ) ||
      typeof receipt.npm.packedLicensePresent !== 'boolean'
    ) {
      fail('source-intake receipt exact npm evidence is malformed');
    }
    validateLifecycle(receipt.npm.lifecycle, 'source-intake receipt npm lifecycle');
  }
  return receipt;
}

export async function auditCandidateCheckout({
  candidate,
  source: sourceInput,
  fetchImpl = globalThis.fetch,
}) {
  const source = await canonicalCheckout(sourceInput);
  const sourceSubdir = candidate.sourceSubdir ?? '.';
  const head = runGit(source, ['rev-parse', 'HEAD']);
  const tree = runGit(source, ['rev-parse', 'HEAD^{tree}']);
  const dirty = runGit(source, ['status', '--porcelain=v1', '--untracked-files=no']);
  if (!SHA40.test(head) || head !== candidate.commit || !SHA40.test(tree) || dirty !== '') {
    fail('candidate checkout is dirty or does not match the exact intake commit');
  }
  const sourceEvidence = {
    repository: candidate.repository,
    commit: head,
    tree,
    sourceSubdir,
    manifestSha256: null,
    licensePath: candidate.licenseEvidencePath,
    licenseSha256: null,
    bundlePatchSha256: null,
    lockfiles: [],
  };
  let packageRoot;
  try {
    packageRoot = await containedUnlinkedPath(
      source,
      sourceSubdir,
      'candidate package subdirectory',
      'directory'
    );
  } catch (error) {
    return rejectedReceipt(candidate, sourceEvidence, [error.message]);
  }
  let manifestBytes;
  let manifest;
  try {
    manifestBytes = await readBounded(
      join(packageRoot, 'package.json'),
      MAX_MANIFEST_BYTES,
      'candidate package manifest'
    );
    manifest = JSON.parse(manifestBytes.toString('utf8'));
  } catch (error) {
    return rejectedReceipt(candidate, sourceEvidence, [
      `package manifest failed validation: ${error.message}`,
    ]);
  }
  sourceEvidence.manifestSha256 = sha256(manifestBytes);
  let patch;
  try {
    patch = normalizeBundlePatch(manifest?.dsh?.bundle?.patch);
  } catch {
    patch = null;
  }
  const invalidPackage =
    !PACKAGE.test(manifest?.name ?? '') ||
    !SEMVER.test(manifest?.version ?? '') ||
    !SAFE_PATH.test(patch ?? '');
  if (invalidPackage) {
    return rejectedReceipt(candidate, sourceEvidence, [
      'package.json at the fixed source subdirectory is not one versioned DSH bundle package with a safe dsh.bundle.patch',
    ]);
  }
  const removedPackageReferences = alpha1RemovedPackageReferences(manifest);
  if (removedPackageReferences.length > 0) {
    return rejectedReceipt(candidate, sourceEvidence, [
      `package.json references packages absent from the exact alpha.1 source baseline: ${removedPackageReferences.join(', ')}`,
    ]);
  }
  let licenseBytes;
  let patchBytes;
  try {
    const [licensePath, patchPath] = await Promise.all([
      containedUnlinkedPath(
        source,
        candidate.licenseEvidencePath,
        'candidate license evidence',
        'file'
      ),
      containedUnlinkedPath(
        packageRoot,
        patch,
        'candidate DSH bundle patch',
        'file'
      ),
    ]);
    [licenseBytes, patchBytes] = await Promise.all([
      readBounded(
        licensePath,
        MAX_LICENSE_BYTES,
        'candidate license evidence'
      ),
      readBounded(patchPath, MAX_PATCH_BYTES, 'candidate DSH bundle patch'),
    ]);
  } catch (error) {
    return rejectedReceipt(candidate, sourceEvidence, [error.message]);
  }
  sourceEvidence.licenseSha256 = sha256(licenseBytes);
  sourceEvidence.bundlePatchSha256 = sha256(patchBytes);
  for (const lockfile of LOCKFILES) {
    try {
      const lockfilePath = await containedUnlinkedPath(
        source,
        lockfile,
        `candidate ${lockfile}`,
        'file'
      );
      const bytes = await readBounded(
        lockfilePath,
        MAX_LOCKFILE_BYTES,
        `candidate ${lockfile}`
      );
      sourceEvidence.lockfiles.push({ path: lockfile, bytes: bytes.length, sha256: sha256(bytes) });
    } catch {
      // Lockfiles are optional for hosted or exact npm intake, but required by git-commit authority.
    }
  }
  const lifecycle = lifecycleHooksFromManifest(manifest);
  let npm = null;
  let reviewReason =
    'No exact npm version was bound during static intake; any future distribution must use a separately reviewed fixed Git commit or Release asset.';
  try {
    npm = await inspectExactNpm(manifest, candidate, fetchImpl);
    if (npm !== null) {
      reviewReason =
        'Static source and exact npm intake passed; legal distribution, permissions, runtime, removal, and rollback still require review.';
    }
  } catch {
    reviewReason =
      'Published npm bytes could not be bound to the pinned source and are excluded; only a separately reviewed fixed Git commit or Release asset may proceed.';
  }
  return validateSourceIntakeReceipt({
    schemaVersion: 2,
    status: 'source-intake-audited',
    candidateExecuted: false,
    catalogId: candidate.catalogId,
    source: sourceEvidence,
    package: {
      name: manifest.name,
      version: manifest.version,
      bundlePatch: patch,
      manifestSha256: sourceEvidence.manifestSha256,
      lifecycle: {
        hooks: lifecycle,
        hooksSha256: lifecycleHooksSha256(lifecycle),
      },
    },
    npm,
    review: {
      runtimeCertified: false,
      distributionApproved: false,
      replacementRequired: false,
      reasons: [reviewReason],
    },
    privacy: {
      capturesCredentials: false,
      capturesEnvironment: false,
      capturesCandidateOutput: false,
    },
  }, candidate);
}

async function writeReceipt(outputInput, receipt) {
  if (!isAbsolute(outputInput)) fail('--out must be an absolute new JSON path');
  const output = resolve(outputInput);
  if (output === parse(output).root || basename(output) !== basename(outputInput)) {
    fail('--out must be an absolute bounded JSON path');
  }
  const handle = await open(output, 'wx', 0o600);
  try {
    await handle.writeFile(`${JSON.stringify(receipt, null, 2)}\n`);
  } finally {
    await handle.close();
  }
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (!['--id', '--source', '--out'].includes(key) || !argv[index + 1]) {
      fail('usage: audit-candidate-source.mjs --id <#3NNN> --source <checkout> --out <new.json>');
    }
    if (Object.hasOwn(options, key)) fail(`duplicate ${key}`);
    options[key] = argv[++index];
  }
  if (!options['--id'] || !options['--source'] || !options['--out']) {
    fail('candidate ID, source checkout, and new receipt path are required');
  }
  return options;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const options = parseArgs(process.argv.slice(2));
    const intake = validateCandidateIntake(await loadCandidateIntake());
    const numericId = Number(options['--id'].replace(/^#/u, ''));
    const matches = intake.items.filter((item) => item.catalogId === numericId);
    if (matches.length !== 1) fail('candidate ID does not resolve exactly once in intake authority');
    const receipt = await auditCandidateCheckout({
      candidate: matches[0],
      source: options['--source'],
    });
    validateSourceIntakeReceipt(receipt, matches[0]);
    await writeReceipt(options['--out'], receipt);
    process.stdout.write(
      `${JSON.stringify({
        catalogId: receipt.catalogId,
        status: receipt.status,
        candidateExecuted: false,
        npmSourceAvailable: receipt.npm !== null,
      })}\n`
    );
    if (receipt.status !== 'source-intake-audited') process.exitCode = 2;
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
