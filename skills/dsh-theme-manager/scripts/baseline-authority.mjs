import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const skillDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const policyPath = resolve(skillDir, 'references/baseline-policy.json');

export const sha256 = (value) =>
  createHash('sha256').update(value).digest('hex');

export function rejectMutableSelectors(value, path = '$') {
  if (Array.isArray(value)) {
    value.forEach((entry, index) =>
      rejectMutableSelectors(entry, `${path}[${index}]`)
    );
    return;
  }
  if (!value || typeof value !== 'object') {
    if (value === 'latest' || value === 'next') {
      throw new Error(`mutable version selector refused at ${path}`);
    }
    return;
  }
  for (const [key, entry] of Object.entries(value)) {
    rejectMutableSelectors(entry, `${path}.${key}`);
  }
}

async function readPinnedJson(path, expectedSha256, label) {
  const bytes = await readFile(path);
  if (sha256(bytes) !== expectedSha256) {
    throw new Error(`${label} digest differs from baseline-policy.json`);
  }
  const value = JSON.parse(bytes.toString('utf8'));
  rejectMutableSelectors(value);
  return { bytes, value };
}

export async function loadBaselinePolicy() {
  const policy = JSON.parse(await readFile(policyPath, 'utf8'));
  const { forbiddenVersionSelectors, ...operationalPolicy } = policy;
  rejectMutableSelectors(operationalPolicy);
  if (
    policy.schemaVersion !== 1 ||
    policy.defaultOperationalLane !== 'certified' ||
    policy.certified?.status !== 'certified-installable' ||
    policy.certified?.installable !== true ||
    policy.candidate?.status !== 'certification-pending' ||
    policy.candidate?.installable !== false ||
    JSON.stringify(forbiddenVersionSelectors) !==
      JSON.stringify(['latest', 'next'])
  ) {
    throw new Error('baseline-policy.json is malformed or promotes a candidate');
  }
  return policy;
}

export async function loadCertifiedAuthority() {
  const policy = await loadBaselinePolicy();
  const { bytes, value: attestation } = await readPinnedJson(
    resolve(skillDir, policy.certified.attestationPath),
    policy.certified.attestationSha256,
    'certified attestation'
  );
  if (
    attestation.certificationStatus !== 'verified' ||
    attestation.compatibility?.dshPackageVersion == null
  ) {
    throw new Error('certified lane lacks verified exact-version authority');
  }
  return {
    policy,
    lane: policy.certified,
    runtimeDir: resolve(skillDir, policy.certified.runtimeDirectory),
    attestation,
    attestationBytes: bytes,
    version: attestation.compatibility.dshPackageVersion,
  };
}

export async function loadCandidateAuthority() {
  const policy = await loadBaselinePolicy();
  const lane = policy.candidate;
  const [sidecarResult, attestationResult, receiptResult] = await Promise.all([
    readPinnedJson(
      resolve(skillDir, lane.sidecarPath),
      lane.sidecarSha256,
      'candidate sidecar'
    ),
    readPinnedJson(
      resolve(skillDir, lane.attestationPath),
      lane.attestationSha256,
      'candidate attestation'
    ),
    readPinnedJson(
      resolve(skillDir, lane.receiptPath),
      lane.receiptSha256,
      'candidate receipt'
    ),
  ]);
  const sidecar = sidecarResult.value;
  const attestation = attestationResult.value;
  const receipt = receiptResult.value;
  const version = sidecar.compatibility?.dshPackageVersion;
  if (
    !version ||
    sidecar.certificationStatus !== 'pending' ||
    sidecar.installableCurrent !== false ||
    sidecar.compatibility?.selectorCatalogSha256 !== null ||
    sidecar.compatibility?.runtimeAttestationSha256 !== null ||
    attestation.certificationStatus !== 'pending' ||
    attestation.installable !== false ||
    attestation.compatibility?.dshPackageVersion !== version ||
    receipt.status !== 'certification-pending' ||
    receipt.installable !== false ||
    receipt.baseline !== `@deepseek-ai/dsh@${version}`
  ) {
    throw new Error('candidate authority is malformed or attempts promotion');
  }
  return {
    policy,
    lane,
    runtimeDir: resolve(skillDir, lane.runtimeDirectory),
    sidecar,
    sidecarBytes: sidecarResult.bytes,
    attestation,
    attestationBytes: attestationResult.bytes,
    receipt,
    receiptBytes: receiptResult.bytes,
    version,
  };
}
