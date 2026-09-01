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
  const runtime = policy.certifiedRuntimeBaseline;
  const alpha2V4Candidate = policy.alpha2V4Candidate;
  if (
    policy.schemaVersion !== 2 ||
    policy.defaultOperationalLane !== 'certified' ||
    policy.certified?.status !== 'certified-installable' ||
    policy.certified?.installable !== true ||
    runtime?.status !== 'baseline-certified' ||
    runtime?.certificationStatus !== 'verified-runtime-baseline' ||
    runtime?.productionReady !== true ||
    runtime?.installableItems !== false ||
    runtime?.itemInstallability !== 'separate-authority-required' ||
    runtime?.enabled !== false ||
    runtime?.catalogRead !== false ||
    runtime?.installableResultsAllowed !== false ||
    runtime?.authoringEnabled !== false ||
    runtime?.submissionEnabled !== false ||
    runtime?.communityItemsPlanned !== 11 ||
    runtime?.communityItemsVerified !== 0 ||
    runtime?.communityInstallableRecords !== 0 ||
    alpha2V4Candidate?.status !== 'candidate-pending' ||
    alpha2V4Candidate?.installable !== false ||
    alpha2V4Candidate?.promotionAllowed !== false ||
    alpha2V4Candidate?.candidateCount !== 54 ||
    alpha2V4Candidate?.requiredRuntimeJobs !== 6 ||
    alpha2V4Candidate?.completedRuntimeJobs !== 0 ||
    alpha2V4Candidate?.authorityPath !==
      'references/alpha2-v4-candidate-authority.json' ||
    alpha2V4Candidate?.authoritySha256 !==
      '5bda616b8ae9963fc64194b9e1ecf666eec3f93c82437b4db3677b7ad4776c92' ||
    policy.candidate?.status !== 'certification-pending' ||
    policy.candidate?.historicalAtCapture !== true ||
    policy.candidate?.installable !== false ||
    JSON.stringify(forbiddenVersionSelectors) !==
      JSON.stringify(['latest', 'next'])
  ) {
    throw new Error('baseline-policy.json is malformed or promotes a candidate');
  }
  return policy;
}

export function validateCertifiedRuntimeBaselineProjection(evidence, lane) {
  if (
    evidence.evidenceKind !== 'rc2-certified-runtime-baseline-projection' ||
    evidence.status !== lane.status ||
    evidence.certificationStatus !== lane.certificationStatus ||
    evidence.productionReady !== lane.productionReady ||
    evidence.installableItems !== lane.installableItems ||
    evidence.itemInstallability !== lane.itemInstallability ||
    evidence.baseline !== '@deepseek-ai/dsh@0.1.1-rc.2' ||
    evidence.dshPackageVersion !== '0.1.1-rc.2' ||
    evidence.capabilities?.catalogRead !== lane.catalogRead ||
    evidence.capabilities?.installableResultsAllowed !==
      lane.installableResultsAllowed ||
    evidence.capabilities?.authoringEnabled !== lane.authoringEnabled ||
    evidence.capabilities?.submissionEnabled !== lane.submissionEnabled ||
    evidence.capabilities?.communityItemsPlanned !==
      lane.communityItemsPlanned ||
    evidence.capabilities?.communityItemsVerified !==
      lane.communityItemsVerified ||
    evidence.capabilities?.communityInstallableRecords !==
      lane.communityInstallableRecords ||
    evidence.authorityScope !== 'runtime-baseline-only' ||
    evidence.itemAuthority !== 'not-granted'
  ) {
    throw new Error(
      'certified runtime baseline projection is malformed or grants item authority'
    );
  }
  return evidence;
}

export async function loadCertifiedRuntimeBaseline() {
  const policy = await loadBaselinePolicy();
  const lane = policy.certifiedRuntimeBaseline;
  const { bytes, value: evidence } = await readPinnedJson(
    resolve(skillDir, 'references', lane.evidencePath),
    lane.evidenceSha256,
    'certified runtime baseline projection'
  );
  validateCertifiedRuntimeBaselineProjection(evidence, lane);
  return { policy, lane, evidence, evidenceBytes: bytes };
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
