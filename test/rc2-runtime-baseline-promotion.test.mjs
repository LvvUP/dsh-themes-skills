import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import test from 'node:test';

import {
  loadCertifiedRuntimeBaseline,
  validateCertifiedRuntimeBaselineProjection,
} from '../skills/dsh-theme-manager/scripts/baseline-authority.mjs';
import {
  validateArchiveEvidenceBytes,
  validatePromotedRuntimeBaseline,
  validateSigstoreBundle,
} from '../skills/dsh-theme-manager/scripts/validate-promoted-rc2-runtime-baseline.mjs';

const references = resolve('skills/dsh-theme-manager/references');
const archiveName =
  'rc2-final-baseline-certification-cc7546cb5ccd77002713171328972291ceaa12e6-run-32694257969-attempt-1.tar.gz';
const archivePath = resolve(references, archiveName);
const provenancePath = resolve(references, `${archiveName}.sigstore.json`);
const evidencePaths = [
  './attestation.dsh-0.1.1-rc.2.final.json',
  './certification-receipt.dsh-0.1.1-rc.2.final.json',
  './matrix/darwin-node-22.19.0.json',
  './matrix/darwin-node-24.15.0.json',
  './matrix/linux-node-22.19.0.json',
  './matrix/linux-node-24.15.0.json',
  './matrix/win32-node-22.19.0.json',
  './matrix/win32-node-24.15.0.json',
];

async function loadArchiveEvidenceMap() {
  const rows = await Promise.all(
    evidencePaths.map(async (path) => {
      const repositoryPath = path.startsWith('./matrix/')
        ? resolve(references, 'matrix', basename(path))
        : resolve(references, basename(path));
      return [path, await readFile(repositoryPath)];
    })
  );
  return new Map(rows);
}

test('promoted RC.2 runtime baseline closes the exact reviewed run without item authority', async () => {
  const result = await validatePromotedRuntimeBaseline();

  assert.deepEqual(result, {
    status: 'baseline-certified',
    certificationStatus: 'verified-runtime-baseline',
    productionReady: true,
    installableItems: false,
    itemInstallability: 'separate-authority-required',
    dshVersion: '0.1.1-rc.2',
    sourceSha: 'cc7546cb5ccd77002713171328972291ceaa12e6',
    runId: '32694257969',
    runAttempt: '1',
    completedMatrixJobs: 6,
    requiredMatrixJobs: 6,
    attestationSha256:
      '4c41e96827bb03eb7c4d6138f5723864e91f0324b1aec8bcf3b3a1bc47ba3fb7',
    certificationReceiptSha256:
      '4a649841766b4bf3421c78906f98f29a186d718ea34b03daca96ee52e9a3db98',
    archiveSha256:
      '0b4f03e9c3f76d241890f46330fce84f32183774a5d9228077835e2258c76f3e',
    provenanceSha256:
      'b520580f05101b4783079aa52f0e159b2aa1a9e239f7e6a68e469f4c5d084b2d',
  });
});

test('runtime projection tampering cannot grant item authority', async () => {
  const { lane, evidence } = await loadCertifiedRuntimeBaseline();
  const tampered = structuredClone(evidence);
  tampered.itemAuthority = 'granted';
  tampered.installableItems = true;
  tampered.capabilities.installableResultsAllowed = true;

  assert.throws(
    () => validateCertifiedRuntimeBaselineProjection(tampered, lane),
    /malformed or grants item authority/
  );
  assert.equal(evidence.itemAuthority, 'not-granted');
  assert.equal(evidence.installableItems, false);
});

test('final archive refuses any mismatch with the checked-in evidence bytes', async () => {
  const [archiveBytes, evidence] = await Promise.all([
    readFile(archivePath),
    loadArchiveEvidenceMap(),
  ]);
  assert.doesNotThrow(() =>
    validateArchiveEvidenceBytes(archiveBytes, evidence)
  );

  const tamperedEvidence = new Map(evidence);
  const attestationPath = './attestation.dsh-0.1.1-rc.2.final.json';
  const tamperedAttestation = Buffer.from(tamperedEvidence.get(attestationPath));
  tamperedAttestation[tamperedAttestation.length - 2] ^= 1;
  tamperedEvidence.set(attestationPath, tamperedAttestation);

  assert.throws(
    () => validateArchiveEvidenceBytes(archiveBytes, tamperedEvidence),
    /archive bytes differ from checked-in evidence/
  );
});

test('detached provenance refuses a mismatched archive subject', async () => {
  const [{ evidence: projection }, archiveBytes, provenanceBytes] =
    await Promise.all([
      loadCertifiedRuntimeBaseline(),
      readFile(archivePath),
      readFile(provenancePath),
    ]);
  const archiveSha256 = createHash('sha256').update(archiveBytes).digest('hex');
  assert.doesNotThrow(() =>
    validateSigstoreBundle(
      provenanceBytes,
      projection,
      archiveName,
      archiveSha256
    )
  );

  const tamperedBundle = JSON.parse(provenanceBytes.toString('utf8'));
  const statement = JSON.parse(
    Buffer.from(tamperedBundle.dsseEnvelope.payload, 'base64').toString('utf8')
  );
  statement.subject[0].name = `lookalike-${archiveName}`;
  tamperedBundle.dsseEnvelope.payload = Buffer.from(
    JSON.stringify(statement)
  ).toString('base64');

  assert.throws(
    () =>
      validateSigstoreBundle(
        Buffer.from(JSON.stringify(tamperedBundle)),
        projection,
        archiveName,
        archiveSha256
      ),
    /does not bind the exact archive, workflow, and run/
  );
});
