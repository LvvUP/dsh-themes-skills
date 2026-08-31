#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import { validateAuthority } from './authority.mjs';

const SHA40 = /^[a-f0-9]{40}$/;
const SHA64 = /^[a-f0-9]{64}$/;
const SAFE_JOB = /^[A-Za-z0-9._-]{1,100}$/;
export const RUNTIME_PLATFORMS = [
  ['linux', 'x64'],
  ['darwin', 'arm64'],
  ['win32', 'x64'],
];
export const RUNTIME_NODE_VERSIONS = ['22.19.0', '24.15.0'];
export const RUNTIME_WORKFLOW = '.github/workflows/alpha2-runtime-certification.yml';
export const RUNTIME_REPOSITORY = 'LvvUP/dsh-themes-skills';
const FORBIDDEN_VALUE = /(?:[?&]token=|\bcookie\s*:|\bauthorization\s*:|bearer\s+[a-z0-9._~-]+)/iu;
const BASE64URL_SECRET = /(?:^|[^A-Za-z0-9_-])[A-Za-z0-9_-]{43}(?:$|[^A-Za-z0-9_-])/;

function fail(message) {
  throw new Error(message);
}

function object(value, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    fail(`${label} must be an object`);
  }
  return value;
}

function exactKeys(value, keys, label) {
  const actual = Object.keys(object(value, label)).sort();
  if (JSON.stringify(actual) !== JSON.stringify([...keys].sort())) {
    fail(`${label} keys mismatch`);
  }
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
}

export function runtimeSha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

export function runtimeReceiptSetPayloadSha256(receiptSet) {
  const payload = structuredClone(receiptSet);
  delete payload.receiptSetPayloadSha256;
  return runtimeSha256(Buffer.from(`${JSON.stringify(stable(payload))}\n`, 'utf8'));
}

export function runtimeProvenanceSet(receiptSet) {
  return stable({
    authorityEffect: 'none',
    kind: 'dsh-alpha2-runtime-provenance-set',
    receipts: receiptSet.receipts,
    schemaVersion: receiptSet.schemaVersion,
    source: receiptSet.source,
    workflow: receiptSet.workflow,
  });
}

export function runtimeProvenanceSetSha256(receiptSet) {
  return runtimeSha256(Buffer.from(
    `${JSON.stringify(runtimeProvenanceSet(receiptSet), null, 2)}\n`,
    'utf8'
  ));
}

export function runtimeTasks() {
  return RUNTIME_PLATFORMS.flatMap(([platform, arch]) =>
    RUNTIME_NODE_VERSIONS.map((nodeVersion) => ({ platform, arch, nodeVersion })));
}

function inspectPrivacy(value, path = 'runtimeReceipt') {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => inspectPrivacy(entry, `${path}[${index}]`));
    return;
  }
  if (value !== null && typeof value === 'object') {
    Object.entries(value).forEach(([key, entry]) => inspectPrivacy(entry, `${path}.${key}`));
    return;
  }
  if (typeof value === 'string' &&
      (FORBIDDEN_VALUE.test(value) || BASE64URL_SECRET.test(value))) {
    fail(`${path} contains forbidden BrowserAuth material`);
  }
}

function validateSource(source, authority, label) {
  exactKeys(source, ['tag', 'commit', 'tree', 'lockfileSha256'], label);
  if (source.tag !== authority.release.tag || source.commit !== authority.release.commit ||
      source.tree !== authority.release.tree || source.lockfileSha256 !== authority.source.lockfileSha256) {
    fail(`${label} does not match the pinned alpha.2 release`);
  }
}

function validateCi(ci, label) {
  exactKeys(ci, [
    'repository', 'workflowPath', 'workflowSha256', 'runId', 'runAttempt', 'jobId', 'headSha',
  ], label);
  if (ci.repository !== RUNTIME_REPOSITORY || ci.workflowPath !== RUNTIME_WORKFLOW ||
      !SHA64.test(ci.workflowSha256) || !/^[1-9]\d{0,19}$/.test(ci.runId) ||
      !Number.isSafeInteger(ci.runAttempt) || ci.runAttempt < 1 || ci.runAttempt > 1000 ||
      !SAFE_JOB.test(ci.jobId) || !SHA40.test(ci.headSha)) {
    fail(`${label} identity is malformed`);
  }
}

export function validateRuntimeReceipt(receipt, authorityInput) {
  const authority = validateAuthority(authorityInput);
  inspectPrivacy(receipt);
  exactKeys(receipt, [
    'schemaVersion', 'status', 'scope', 'source', 'task', 'artifacts',
    'provenanceBoundary', 'probes', 'ci', 'privacy',
  ], 'runtime receipt');
  if (receipt.schemaVersion !== 1 || receipt.status !== 'alpha2-runtime-task-passed' ||
      receipt.scope !== 'one-platform-node-task') fail('runtime receipt header mismatch');
  validateSource(receipt.source, authority, 'runtime receipt source');
  exactKeys(receipt.task, ['platform', 'arch', 'nodeVersion'], 'runtime receipt task');
  const expectedArch = new Map(RUNTIME_PLATFORMS).get(receipt.task.platform);
  if (receipt.task.arch !== expectedArch || !RUNTIME_NODE_VERSIONS.includes(receipt.task.nodeVersion)) {
    fail('runtime receipt task is outside the exact platform/Node matrix');
  }
  exactKeys(receipt.artifacts, ['officialNpm', 'sourceCrossBuild'], 'runtime receipt artifacts');
  exactKeys(receipt.artifacts.officialNpm, [
    'installReceiptSha256', 'installedCliSha256', 'tarballSha256',
    'resolutionLockfileSha256',
  ], 'runtime receipt official npm artifact');
  const official = receipt.artifacts.officialNpm;
  if (!SHA64.test(official.installReceiptSha256) ||
      official.installedCliSha256 !== authority.officialNpm.cliSha256 ||
      official.tarballSha256 !== authority.officialNpm.tarballSha256 ||
      official.resolutionLockfileSha256 !== authority.runtimeInstall.lockfileSha256) {
    fail('runtime receipt official npm artifact mismatch');
  }
  exactKeys(receipt.artifacts.sourceCrossBuild, [
    'buildReceiptSha256', 'builtCliSha256', 'reportedVersion',
  ], 'runtime receipt source cross-build artifact');
  const sourceCrossBuild = receipt.artifacts.sourceCrossBuild;
  if (!SHA64.test(sourceCrossBuild.buildReceiptSha256) ||
      !SHA64.test(sourceCrossBuild.builtCliSha256) ||
      sourceCrossBuild.reportedVersion !== authority.release.version) {
    fail('runtime receipt source cross-build artifact mismatch');
  }
  exactKeys(receipt.provenanceBoundary, [
    'officialNpmOperationalRuntime', 'exactSourceCrossBuild', 'npmGitHeadPresent',
    'npmProvenanceAttestationPresent', 'binarySourceEquivalenceClaimed',
    'artifactRelationship',
  ], 'runtime receipt provenance boundary');
  if (receipt.provenanceBoundary.officialNpmOperationalRuntime !== true ||
      receipt.provenanceBoundary.exactSourceCrossBuild !== true ||
      receipt.provenanceBoundary.npmGitHeadPresent !== authority.officialNpm.gitHeadPresent ||
      receipt.provenanceBoundary.npmProvenanceAttestationPresent !==
        authority.officialNpm.provenanceAttestationPresent ||
      receipt.provenanceBoundary.binarySourceEquivalenceClaimed !== false ||
      receipt.provenanceBoundary.artifactRelationship !==
        'independent-artifacts-no-source-package-binding') {
    fail('runtime receipt provenance boundary mismatch');
  }
  exactKeys(receipt.probes, ['cli', 'profile', 'browserAuth', 'webProtocol'], 'runtime receipt probes');
  exactKeys(receipt.probes.cli, ['reportedVersion'], 'runtime receipt CLI probe');
  if (receipt.probes.cli.reportedVersion !== authority.release.version) fail('runtime CLI version mismatch');
  exactKeys(receipt.probes.profile, ['name', 'dumpConfigPassed'], 'runtime receipt Profile probe');
  if (receipt.probes.profile.name !== 'web' || receipt.probes.profile.dumpConfigPassed !== true) {
    fail('runtime Profile probe mismatch');
  }
  exactKeys(receipt.probes.browserAuth, [
    'unauthenticatedRootStatus', 'launchExchangeStatus', 'authenticatedSessionStatus',
    'hostOnlyRejectionStatus', 'originOnlyRejectionStatus',
    'crossSiteRejectionStatus', 'restartStatus',
  ], 'runtime receipt BrowserAuth probe');
  if (receipt.probes.browserAuth.unauthenticatedRootStatus !== 401 ||
      receipt.probes.browserAuth.launchExchangeStatus !== 303 ||
      receipt.probes.browserAuth.authenticatedSessionStatus !== 200 ||
      receipt.probes.browserAuth.hostOnlyRejectionStatus !== 403 ||
      receipt.probes.browserAuth.originOnlyRejectionStatus !== 403 ||
      receipt.probes.browserAuth.crossSiteRejectionStatus !== 403 ||
      receipt.probes.browserAuth.restartStatus !==
        'prior-session-persisted-launch-credential-rotated') {
    fail('runtime BrowserAuth probe mismatch');
  }
  exactKeys(receipt.probes.webProtocol, [
    'entriesAndBatches', 'comboUrl', 'revision404', 'javascriptMime', 'sourceMapMime',
    'gzip', 'identity', 'cache', 'bootReady',
  ], 'runtime receipt Web protocol probe');
  const protocol = receipt.probes.webProtocol;
  if (protocol.entriesAndBatches !== true || protocol.comboUrl !== true ||
      protocol.revision404 !== true || !['text/javascript', 'application/javascript'].includes(protocol.javascriptMime) ||
      protocol.sourceMapMime !== 'application/json' || protocol.gzip !== true || protocol.identity !== true ||
      protocol.cache !== true || protocol.bootReady !== true) fail('runtime Web protocol probe mismatch');
  validateCi(receipt.ci, 'runtime receipt CI');
  exactKeys(receipt.privacy, [
    'capturesProcessOutput', 'capturesEnvironment', 'capturesBrowserSecrets',
    'capturesSecretDerivedDigest',
  ], 'runtime receipt privacy');
  if (Object.values(receipt.privacy).some((value) => value !== false)) {
    fail('runtime receipt privacy flags must all be false');
  }
  return receipt;
}

export function validateRuntimeReceiptSet(receiptSet, {
  authority: authorityInput,
  receiptBytesBySha256,
}) {
  const authority = validateAuthority(authorityInput);
  inspectPrivacy(receiptSet, 'runtimeReceiptSet');
  exactKeys(receiptSet, [
    'schemaVersion', 'status', 'source', 'workflow', 'requiredReceiptCount', 'receipts',
    'provenanceSetSha256', 'receiptSetPayloadSha256',
  ], 'runtime receipt set');
  if (receiptSet.schemaVersion !== 1 || receiptSet.status !== 'alpha2-runtime-matrix-verified' ||
      receiptSet.requiredReceiptCount !== 6 || !SHA64.test(receiptSet.provenanceSetSha256) ||
      !SHA64.test(receiptSet.receiptSetPayloadSha256) ||
      runtimeProvenanceSetSha256(receiptSet) !== receiptSet.provenanceSetSha256 ||
      runtimeReceiptSetPayloadSha256(receiptSet) !== receiptSet.receiptSetPayloadSha256) {
    fail('runtime receipt-set header or digest mismatch');
  }
  validateSource(receiptSet.source, authority, 'runtime receipt-set source');
  exactKeys(receiptSet.workflow, [
    'repository', 'workflowPath', 'workflowSha256', 'runId', 'runAttempt', 'headSha',
  ], 'runtime receipt-set workflow');
  validateCi({ ...receiptSet.workflow, jobId: 'receipt-set' }, 'runtime receipt-set workflow');
  const expectedTasks = runtimeTasks();
  if (!Array.isArray(receiptSet.receipts) || receiptSet.receipts.length !== expectedTasks.length ||
      !(receiptBytesBySha256 instanceof Map) || receiptBytesBySha256.size !== expectedTasks.length) {
    fail('runtime receipt set requires exactly six independently supplied receipt byte records');
  }
  const seenDigests = new Set();
  for (const [index, expected] of expectedTasks.entries()) {
    const entry = receiptSet.receipts[index];
    exactKeys(entry, ['platform', 'arch', 'nodeVersion', 'receiptSha256', 'jobId'], `runtime receipt set receipts[${index}]`);
    if (entry.platform !== expected.platform || entry.arch !== expected.arch ||
        entry.nodeVersion !== expected.nodeVersion || !SHA64.test(entry.receiptSha256) ||
        !SAFE_JOB.test(entry.jobId) || seenDigests.has(entry.receiptSha256)) {
      fail(`runtime receipt set receipts[${index}] is not the canonical unique matrix task`);
    }
    const bytes = receiptBytesBySha256.get(entry.receiptSha256);
    if (!Buffer.isBuffer(bytes) || runtimeSha256(bytes) !== entry.receiptSha256) {
      fail(`runtime receipt set receipts[${index}] bytes or digest mismatch`);
    }
    let receipt;
    try {
      receipt = JSON.parse(bytes);
    } catch {
      fail(`runtime receipt set receipts[${index}] is not valid JSON`);
    }
    validateRuntimeReceipt(receipt, authority);
    if (receipt.task.platform !== entry.platform || receipt.task.arch !== entry.arch ||
        receipt.task.nodeVersion !== entry.nodeVersion || receipt.ci.jobId !== entry.jobId ||
        receipt.ci.repository !== receiptSet.workflow.repository ||
        receipt.ci.workflowPath !== receiptSet.workflow.workflowPath ||
        receipt.ci.workflowSha256 !== receiptSet.workflow.workflowSha256 ||
        receipt.ci.runId !== receiptSet.workflow.runId ||
        receipt.ci.runAttempt !== receiptSet.workflow.runAttempt ||
        receipt.ci.headSha !== receiptSet.workflow.headSha) {
      fail(`runtime receipt set receipts[${index}] task or CI binding mismatch`);
    }
    seenDigests.add(entry.receiptSha256);
  }
  return receiptSet;
}

export async function loadRuntimeSchemas() {
  const [receipt, receiptSet] = await Promise.all([
    readFile(new URL('../references/runtime-receipt.schema.json', import.meta.url), 'utf8'),
    readFile(new URL('../references/runtime-receipt-set.schema.json', import.meta.url), 'utf8'),
  ]);
  return { receipt: JSON.parse(receipt), receiptSet: JSON.parse(receiptSet) };
}
