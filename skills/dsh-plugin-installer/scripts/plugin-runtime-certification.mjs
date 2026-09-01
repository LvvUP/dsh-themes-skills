#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { constants } from 'node:fs';
import { lstat, mkdir, open, readFile, readdir, realpath } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, parse, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  PLUGIN_RUNTIME_CANDIDATE_COUNT,
  PLUGIN_RUNTIME_TUPLES,
  loadPluginRuntimeBatchContext,
  validatePluginRuntimeBatchPlan,
} from './plugin-runtime-batches.mjs';
import { requireReadyPluginRuntimeCandidatePlan } from './plugin-runtime-plan.mjs';

const MAX_RECEIPT_BYTES = 1024 * 1024;
const MAX_PREDICATE_BYTES = 16 * 1024 * 1024;
const MAX_SIGSTORE_BUNDLE_BYTES = 32 * 1024 * 1024;
const MAX_EVIDENCE_FILES = 500;
const SHA256 = /^[a-f0-9]{64}$/u;
const SHA40 = /^[a-f0-9]{40}$/u;
const SAFE_ID = /^[a-z0-9]+(?:[._:-][a-z0-9]+)*$/u;
const SAFE_SUBDIR = /^(?:\.|[A-Za-z0-9_-]+(?:[A-Za-z0-9._-]*[A-Za-z0-9_-])?(?:\/[A-Za-z0-9_-]+(?:[A-Za-z0-9._-]*[A-Za-z0-9_-])?)*)$/u;
const WORKFLOW_PATH = '.github/workflows/alpha2-plugin-runtime-certification.yml';
const REPOSITORY = 'LvvUP/dsh-themes-skills';
const REPOSITORY_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const BASELINE = Object.freeze({
  tag: 'dsh-v0.1.2-alpha.2',
  commit: '0a53fb55bea101816fa226bb964ae2bed71c343b',
  tree: '64ccbfa8e0caa4711cd4a75717ef9e022657961b',
  lockfileSha256: '6cc109a574218f51762474455c8d72e5f7c2625aedf25e85569dba1af7adcef0',
});

function fail(message) {
  throw new Error(message);
}

function exactKeys(value, keys, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value) ||
      JSON.stringify(Object.keys(value).sort()) !== JSON.stringify([...keys].sort())) {
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

export function canonicalPluginRuntimeJson(value) {
  return `${JSON.stringify(stable(value))}\n`;
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function tupleKey(task) {
  return `${task.platform}-${task.arch}-node-${task.nodeVersion}`;
}

function expectedTasks(plan, intake, runtimeCandidatePlan) {
  validatePluginRuntimeBatchPlan(plan, intake);
  const byId = new Map(intake.items.map((item) => [item.catalogId, item]));
  const runtimeById = new Map(
    runtimeCandidatePlan.items.map((item) => [item.catalogId, item])
  );
  const tasks = [];
  for (const batch of plan.batches) {
    for (const catalogId of batch.catalogIds) {
      const candidate = byId.get(catalogId);
      const runtimeCandidate = runtimeById.get(catalogId);
      if (candidate === undefined || runtimeCandidate === undefined) {
        fail(`batch candidate #${catalogId} is missing`);
      }
      for (const tuple of PLUGIN_RUNTIME_TUPLES) {
        tasks.push({ batchId: batch.batchId, candidate, runtimeCandidate, tuple });
      }
    }
  }
  return tasks;
}

function candidateRepository(item) {
  return item.repository;
}

function validatePassedStage(stage, keys, label) {
  exactKeys(stage, ['status', ...keys], label);
  if (stage.status !== 'passed') fail(`${label} did not pass`);
}

function validateStages(stages, runtimeCandidate) {
  exactKeys(stages, ['install', 'start', 'functionalProbe', 'remove', 'fullRollback'], 'runtime stages');
  validatePassedStage(stages.install, [
    'candidateArtifactSha256', 'candidateArtifactBytes', 'packageName', 'version', 'profileBeforeSha256',
    'profileAfterInstallSha256', 'dumpConfigSha256',
  ], 'install stage');
  if (![stages.install.candidateArtifactSha256, stages.install.profileBeforeSha256,
    stages.install.profileAfterInstallSha256, stages.install.dumpConfigSha256].every((value) => SHA256.test(value)) ||
      typeof stages.install.packageName !== 'string' || stages.install.packageName.length > 214 ||
      typeof stages.install.version !== 'string' || stages.install.version.length > 100 ||
      !Number.isSafeInteger(stages.install.candidateArtifactBytes) ||
      stages.install.candidateArtifactBytes < 1 ||
      stages.install.profileBeforeSha256 === stages.install.profileAfterInstallSha256) {
    fail('install stage is not bound to one exact profile mutation');
  }
  if (runtimeCandidate !== undefined &&
      (stages.install.candidateArtifactSha256 !== runtimeCandidate.artifact.sha256 ||
       stages.install.candidateArtifactBytes !== runtimeCandidate.artifact.bytes)) {
    fail('install stage artifact does not match runtime candidate plan bytes and digest');
  }

  validatePassedStage(stages.start, [
    'coldStart', 'webBooted', 'unauthenticatedRootStatus', 'processStayedAlive',
  ], 'start stage');
  if (stages.start.coldStart !== true || stages.start.webBooted !== true ||
      stages.start.unauthenticatedRootStatus !== 401 || stages.start.processStayedAlive !== true) {
    fail('start stage is not one successful cold authenticated Web boundary');
  }

  validatePassedStage(stages.functionalProbe, [
    'kind', 'contractSha256', 'webBootOnly', 'assertions',
  ], 'functional probe stage');
  if (stages.functionalProbe.kind !== 'candidate-capability-contract' ||
      !SHA256.test(stages.functionalProbe.contractSha256) ||
      stages.functionalProbe.webBootOnly !== false ||
      !Array.isArray(stages.functionalProbe.assertions) ||
      stages.functionalProbe.assertions.length < 1 ||
      stages.functionalProbe.assertions.length > 32) {
    fail('a true authority-bound functional probe is required; Web boot alone is insufficient');
  }
  const assertionIds = new Set();
  for (const assertion of stages.functionalProbe.assertions) {
    exactKeys(assertion, ['id', 'status', 'evidenceSha256'], 'functional assertion');
    if (!SAFE_ID.test(assertion.id ?? '') || assertion.status !== 'passed' ||
        !SHA256.test(assertion.evidenceSha256 ?? '') || assertionIds.has(assertion.id)) {
      fail('functional probe assertions must be unique passed capability evidence');
    }
    assertionIds.add(assertion.id);
  }
  if (runtimeCandidate !== undefined) {
    const expected = runtimeCandidate.functionalProbe;
    if (stages.functionalProbe.contractSha256 !== expected.contractSha256 ||
        JSON.stringify([...assertionIds].sort()) !==
          JSON.stringify([...expected.requiredAssertions].sort())) {
      fail('functional probe does not match the machine-authority contract and assertions');
    }
  }

  validatePassedStage(stages.remove, [
    'exactPackageAbsent', 'cordisEntryAbsent', 'profileAfterRemoveSha256',
  ], 'remove stage');
  if (stages.remove.exactPackageAbsent !== true || stages.remove.cordisEntryAbsent !== true ||
      !SHA256.test(stages.remove.profileAfterRemoveSha256)) {
    fail('remove stage did not prove package and Cordis entry absence');
  }

  validatePassedStage(stages.fullRollback, [
    'isolatedDshHomeBeforeSha256', 'isolatedDshHomeAfterSha256',
    'dependencyClosureBeforeSha256', 'dependencyClosureAfterSha256',
    'declaredWritableRoots', 'observedWritableRoots', 'allDshHomeBytesRestored',
    'dependencyClosureRestored', 'noWritesOutsideDeclaredRoots',
    'sandboxedExternalWritesDenied', 'sidecarsTerminated',
  ], 'full rollback stage');
  const declaredRoots = stages.fullRollback.declaredWritableRoots;
  const observedRoots = stages.fullRollback.observedWritableRoots;
  if (![stages.fullRollback.isolatedDshHomeBeforeSha256,
    stages.fullRollback.isolatedDshHomeAfterSha256,
    stages.fullRollback.dependencyClosureBeforeSha256,
    stages.fullRollback.dependencyClosureAfterSha256]
    .every((value) => SHA256.test(value)) ||
      !Array.isArray(declaredRoots) || declaredRoots.length < 1 || declaredRoots.length > 32 ||
      !Array.isArray(observedRoots) || observedRoots.length > 32 ||
      declaredRoots.some((value) => !SAFE_ID.test(value)) ||
      observedRoots.some((value) => !SAFE_ID.test(value)) ||
      new Set(declaredRoots).size !== declaredRoots.length ||
      new Set(observedRoots).size !== observedRoots.length ||
      observedRoots.some((value) => !declaredRoots.includes(value)) ||
      stages.fullRollback.isolatedDshHomeBeforeSha256 !==
        stages.fullRollback.isolatedDshHomeAfterSha256 ||
      stages.fullRollback.dependencyClosureBeforeSha256 !==
        stages.fullRollback.dependencyClosureAfterSha256 ||
      stages.fullRollback.allDshHomeBytesRestored !== true ||
      stages.fullRollback.dependencyClosureRestored !== true ||
      stages.fullRollback.noWritesOutsideDeclaredRoots !== true ||
      stages.fullRollback.sandboxedExternalWritesDenied !== true ||
      stages.fullRollback.sidecarsTerminated !== true) {
    fail('full rollback did not restore the complete isolated DSH HOME/write closure');
  }
  return stages;
}

export function validatePluginRuntimeReceipt(
  receipt,
  { candidate, runtimeCandidate, runtimeCandidatePlanSha256, batchId, tuple } = {}
) {
  exactKeys(receipt, [
    'schemaVersion', 'status', 'scope', 'runtimeCandidatePlanSha256', 'candidate',
    'baseline', 'task', 'stages', 'ci', 'privacy',
  ], 'plugin runtime receipt');
  if (receipt.schemaVersion !== 1 || receipt.status !== 'plugin-runtime-task-passed' ||
      receipt.scope !== 'one-untrusted-candidate-one-platform-node-job' ||
      !SHA256.test(receipt.runtimeCandidatePlanSha256 ?? '')) {
    fail('plugin runtime receipt header mismatch');
  }
  exactKeys(receipt.candidate, [
    'catalogId', 'slug', 'repository', 'commit', 'tree', 'sourceSubdir', 'artifact',
  ], 'receipt candidate');
  exactKeys(receipt.candidate.artifact, [
    'kind', 'locator', 'bytes', 'sha256', 'distribution',
  ], 'receipt artifact');
  exactKeys(receipt.candidate.artifact.distribution, [
    'sourceType', 'immutableCoordinate', 'metadataPath', 'metadataSha256',
    'buildRecipePath', 'buildRecipeSha256',
  ], 'receipt artifact distribution');
  if (!Number.isSafeInteger(receipt.candidate.catalogId) ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(receipt.candidate.slug ?? '') ||
      !/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\.git$/u.test(receipt.candidate.repository ?? '') ||
      !SHA40.test(receipt.candidate.commit ?? '') || !SHA40.test(receipt.candidate.tree ?? '') ||
      !SAFE_SUBDIR.test(receipt.candidate.sourceSubdir ?? '') ||
      !['npm-tarball', 'github-release-asset', 'hosted-staging-tarball']
        .includes(receipt.candidate.artifact.kind) ||
      typeof receipt.candidate.artifact.locator !== 'string' ||
      !Number.isSafeInteger(receipt.candidate.artifact.bytes) ||
      receipt.candidate.artifact.bytes < 1 || !SHA256.test(receipt.candidate.artifact.sha256 ?? '') ||
      !SHA256.test(receipt.candidate.artifact.distribution.metadataSha256 ?? '')) {
    fail('receipt candidate identity is malformed');
  }
  exactKeys(receipt.baseline, ['tag', 'commit', 'tree', 'lockfileSha256'], 'receipt baseline');
  if (canonicalPluginRuntimeJson(receipt.baseline) !== canonicalPluginRuntimeJson(BASELINE)) {
    fail('receipt does not bind the exact official alpha.2 source');
  }
  exactKeys(receipt.task, ['batchId', 'platform', 'arch', 'nodeVersion'], 'receipt task');
  const admittedTuple = PLUGIN_RUNTIME_TUPLES.find((entry) =>
    entry.platform === receipt.task.platform && entry.arch === receipt.task.arch &&
    entry.nodeVersion === receipt.task.nodeVersion);
  if (!Number.isSafeInteger(receipt.task.batchId) || receipt.task.batchId < 1 ||
      receipt.task.batchId > 4 || admittedTuple === undefined) {
    fail('receipt task is outside the exact six-tuple matrix');
  }
  validateStages(receipt.stages, runtimeCandidate);
  exactKeys(receipt.ci, [
    'repository', 'workflowPath', 'workflowSha256', 'event', 'ref', 'runId',
    'runAttempt', 'headSha', 'jobKey', 'matrixIdentity',
  ], 'receipt CI identity');
  const expectedMatrixIdentity = `${receipt.candidate.catalogId}-${tupleKey(receipt.task)}`;
  if (receipt.ci.repository !== REPOSITORY || receipt.ci.workflowPath !== WORKFLOW_PATH ||
      !SHA256.test(receipt.ci.workflowSha256 ?? '') || receipt.ci.event !== 'workflow_dispatch' ||
      receipt.ci.ref !== 'refs/heads/main' || !/^[1-9]\d{0,19}$/u.test(receipt.ci.runId ?? '') ||
      !Number.isSafeInteger(receipt.ci.runAttempt) || receipt.ci.runAttempt < 1 ||
      receipt.ci.runAttempt > 100 || !SHA40.test(receipt.ci.headSha ?? '') ||
      receipt.ci.jobKey !== `runtime-batch-${receipt.task.batchId}` ||
      receipt.ci.matrixIdentity !== expectedMatrixIdentity) {
    fail('receipt CI identity is not one exact main workflow matrix job');
  }
  exactKeys(receipt.privacy, [
    'capturesEnvironment', 'capturesSecrets', 'capturesBrowserCredentials',
    'capturesMachinePaths', 'candidateReceiptsSharedAcrossJobs',
  ], 'receipt privacy');
  if (Object.values(receipt.privacy).some((value) => value !== false)) {
    fail('runtime receipt privacy boundary is not closed');
  }
  if (candidate !== undefined && (receipt.candidate.catalogId !== candidate.catalogId ||
      receipt.candidate.slug !== candidate.slug ||
      receipt.candidate.repository !== candidateRepository(candidate) ||
      receipt.candidate.commit !== candidate.commit ||
      receipt.candidate.sourceSubdir !== (candidate.sourceSubdir ?? '.'))) {
    fail('receipt candidate does not match machine authority');
  }
  if (runtimeCandidate !== undefined &&
      (receipt.candidate.tree !== runtimeCandidate.artifact.source.tree ||
       receipt.candidate.artifact.kind !== runtimeCandidate.artifact.kind ||
       receipt.candidate.artifact.locator !== runtimeCandidate.artifact.locator ||
       receipt.candidate.artifact.bytes !== runtimeCandidate.artifact.bytes ||
       receipt.candidate.artifact.sha256 !== runtimeCandidate.artifact.sha256 ||
       canonicalPluginRuntimeJson(receipt.candidate.artifact.distribution) !==
         canonicalPluginRuntimeJson(runtimeCandidate.artifact.distribution))) {
    fail('receipt artifact identity does not match runtime candidate plan');
  }
  if (runtimeCandidatePlanSha256 !== undefined &&
      receipt.runtimeCandidatePlanSha256 !== runtimeCandidatePlanSha256) {
    fail('receipt reuses a different runtime candidate plan');
  }
  if (batchId !== undefined && receipt.task.batchId !== batchId) fail('receipt batch mismatch');
  if (tuple !== undefined && tupleKey(receipt.task) !== tuple.tuple) fail('receipt tuple mismatch');
  return receipt;
}

export function buildPluginRuntimeReceipt({
  runtimeCandidatePlanSha256, candidate, runtimeCandidate, candidateTree, task, stages, ci,
}) {
  const receipt = {
    schemaVersion: 1,
    status: 'plugin-runtime-task-passed',
    scope: 'one-untrusted-candidate-one-platform-node-job',
    runtimeCandidatePlanSha256,
    candidate: {
      catalogId: candidate.catalogId,
      slug: candidate.slug,
      repository: candidateRepository(candidate),
      commit: candidate.commit,
      tree: candidateTree,
      sourceSubdir: candidate.sourceSubdir ?? '.',
      artifact: {
        kind: runtimeCandidate.artifact.kind,
        locator: runtimeCandidate.artifact.locator,
        bytes: runtimeCandidate.artifact.bytes,
        sha256: runtimeCandidate.artifact.sha256,
        distribution: structuredClone(runtimeCandidate.artifact.distribution),
      },
    },
    baseline: { ...BASELINE },
    task: {
      batchId: task.batchId,
      platform: task.platform,
      arch: task.arch,
      nodeVersion: task.nodeVersion,
    },
    stages: validateStages(stages, runtimeCandidate),
    ci,
    privacy: {
      capturesEnvironment: false,
      capturesSecrets: false,
      capturesBrowserCredentials: false,
      capturesMachinePaths: false,
      candidateReceiptsSharedAcrossJobs: false,
    },
  };
  return validatePluginRuntimeReceipt(receipt, {
    candidate,
    runtimeCandidate,
    runtimeCandidatePlanSha256,
    batchId: task.batchId,
    tuple: task,
  });
}

async function readBoundedRegularFile(input, label, maxBytes = MAX_RECEIPT_BYTES) {
  if (!isAbsolute(input)) fail(`${label} must be an absolute path`);
  const path = resolve(input);
  if (path === parse(path).root) fail(`${label} cannot be a filesystem root`);
  const stat = await lstat(path, { bigint: true });
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size < 1n ||
      stat.size > BigInt(maxBytes)) {
    fail(`${label} must be one bounded regular file`);
  }
  const noFollow = constants.O_NOFOLLOW ?? 0;
  const handle = await open(path, constants.O_RDONLY | noFollow);
  try {
    const opened = await handle.stat({ bigint: true });
    if (!opened.isFile() || opened.size !== stat.size || opened.dev !== stat.dev ||
        opened.ino !== stat.ino) fail(`${label} changed before read`);
    const bytes = Buffer.alloc(Number(opened.size));
    let offset = 0;
    while (offset < bytes.length) {
      const result = await handle.read(bytes, offset, bytes.length - offset, offset);
      if (result.bytesRead === 0) fail(`${label} changed during read`);
      offset += result.bytesRead;
    }
    const after = await handle.stat({ bigint: true });
    if (after.dev !== opened.dev || after.ino !== opened.ino || after.size !== opened.size ||
        after.mtimeNs !== opened.mtimeNs || after.ctimeNs !== opened.ctimeNs) {
      fail(`${label} changed during read`);
    }
    return bytes;
  } finally {
    await handle.close();
  }
}

async function verifyExactArtifact(input, expected) {
  if (!isAbsolute(input)) fail('candidate artifact must be an absolute path');
  const path = resolve(input);
  const stat = await lstat(path, { bigint: true });
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size !== BigInt(expected.bytes)) {
    fail('candidate artifact bytes do not match runtime candidate plan');
  }
  const noFollow = constants.O_NOFOLLOW ?? 0;
  const handle = await open(path, constants.O_RDONLY | noFollow);
  const hash = createHash('sha256');
  try {
    const opened = await handle.stat({ bigint: true });
    if (!opened.isFile() || opened.size !== BigInt(expected.bytes) ||
        opened.dev !== stat.dev || opened.ino !== stat.ino) {
      fail('candidate artifact changed before read');
    }
    const stream = handle.createReadStream({ autoClose: false });
    for await (const chunk of stream) hash.update(chunk);
    const after = await handle.stat({ bigint: true });
    if (after.dev !== opened.dev || after.ino !== opened.ino || after.size !== opened.size ||
        after.mtimeNs !== opened.mtimeNs || after.ctimeNs !== opened.ctimeNs) {
      fail('candidate artifact changed during read');
    }
  } finally {
    await handle.close();
  }
  if (hash.digest('hex') !== expected.sha256) {
    fail('candidate artifact digest does not match runtime candidate plan');
  }
}

async function verifyFunctionalProbeContract(expected) {
  const path = resolve(REPOSITORY_ROOT, expected.contractPath);
  const inside = relative(REPOSITORY_ROOT, path);
  if (inside.split(sep).join('/') !== expected.contractPath ||
      inside.startsWith('..') || isAbsolute(inside)) {
    fail('functional probe contract path escapes the verifier repository');
  }
  const bytes = await readBoundedRegularFile(path, 'functional probe contract');
  if (sha256(bytes) !== expected.contractSha256) {
    fail('functional probe contract bytes do not match runtime candidate plan');
  }
}

async function verifyRuntimeAuthorityFile(pathInput, digest, label) {
  const path = resolve(REPOSITORY_ROOT, pathInput);
  const inside = relative(REPOSITORY_ROOT, path);
  if (inside.split(sep).join('/') !== pathInput || inside.startsWith('..') || isAbsolute(inside)) {
    fail(`${label} path escapes the verifier repository`);
  }
  const bytes = await readBoundedRegularFile(path, label);
  if (sha256(bytes) !== digest) fail(`${label} bytes do not match runtime candidate plan`);
}

async function readCanonicalJson(input, label, maxBytes) {
  const bytes = await readBoundedRegularFile(input, label, maxBytes);
  let value;
  try {
    value = JSON.parse(bytes);
  } catch {
    fail(`${label} is not JSON`);
  }
  if (!Buffer.from(canonicalPluginRuntimeJson(value)).equals(bytes)) {
    fail(`${label} is not canonical JSON`);
  }
  return { bytes, value };
}

async function evidenceFiles(input) {
  if (!isAbsolute(input)) fail('runtime evidence directory must be absolute');
  const root = await realpath(resolve(input));
  const rootStat = await lstat(root);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) {
    fail('runtime evidence root must be a real directory');
  }
  const pending = [root];
  const files = [];
  while (pending.length > 0) {
    const directory = pending.pop();
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isSymbolicLink()) fail('runtime evidence must not contain symlinks');
      const path = join(directory, entry.name);
      if (entry.isDirectory()) pending.push(path);
      else if (entry.isFile() && entry.name.endsWith('.json')) files.push(path);
      else fail('runtime evidence contains an unsupported entry');
      if (files.length + pending.length > MAX_EVIDENCE_FILES) {
        fail('runtime evidence exceeds the bounded file count');
      }
    }
  }
  return files.sort();
}

function receiptSetPayloadSha256(receiptSet) {
  const payload = structuredClone(receiptSet);
  delete payload.receiptSetPayloadSha256;
  return sha256(Buffer.from(canonicalPluginRuntimeJson(payload)));
}

function batchPayloadSha256(entries) {
  return sha256(Buffer.from(canonicalPluginRuntimeJson(entries)));
}

async function loadTaskReceipts(input, context) {
  requireReadyPluginRuntimeCandidatePlan(
    context.runtimePlanContext.plan,
    context.intake,
    context.runtimePlanContext.intakeSha256
  );
  const files = await evidenceFiles(input);
  const expected = expectedTasks(
    context.plan,
    context.intake,
    context.runtimePlanContext.plan
  );
  if (files.length !== expected.length) fail('runtime input must contain exactly 480 task receipts');
  const expectedByKey = new Map(expected.map((entry) => [
    `${entry.candidate.catalogId}:${entry.tuple.tuple}`,
    entry,
  ]));
  const loaded = new Map();
  for (const file of files) {
    const { bytes, value } = await readCanonicalJson(file, `task receipt ${basename(file)}`);
    const key = `${value?.candidate?.catalogId}:${tupleKey(value?.task ?? {})}`;
    const expectedTask = expectedByKey.get(key);
    if (expectedTask === undefined || loaded.has(key)) {
      fail('runtime input contains a duplicate or unauthorized candidate/tuple receipt');
    }
    const receipt = validatePluginRuntimeReceipt(value, expectedTask);
    if (receipt.runtimeCandidatePlanSha256 !== context.runtimeCandidatePlanSha256) {
      fail('task receipt runtime candidate plan digest mismatch');
    }
    loaded.set(key, { receipt, bytes, receiptSha256: sha256(bytes) });
  }
  if (loaded.size !== expected.length) fail('runtime input omits an authority task');
  return { expected, loaded };
}

function assertOneWorkflowRun(loaded, workflowSha256) {
  const identities = new Set([...loaded.values()].map(({ receipt }) => JSON.stringify({
    repository: receipt.ci.repository,
    workflowPath: receipt.ci.workflowPath,
    workflowSha256: receipt.ci.workflowSha256,
    event: receipt.ci.event,
    ref: receipt.ci.ref,
    runId: receipt.ci.runId,
    runAttempt: receipt.ci.runAttempt,
    headSha: receipt.ci.headSha,
  })));
  if (identities.size !== 1) fail('all 480 receipts must come from one exact workflow run');
  const identity = JSON.parse([...identities][0]);
  if (identity.workflowSha256 !== workflowSha256) fail('task receipt workflow bytes mismatch');
  return identity;
}

export function validatePluginRuntimeAggregateGithubIdentity(
  environment,
  workflowIdentity,
  expectedJob
) {
  const expectedJobs = Array.isArray(expectedJob) ? expectedJob : [expectedJob];
  if (environment.GITHUB_ACTIONS !== 'true' ||
      environment.GITHUB_REPOSITORY !== REPOSITORY ||
      environment.GITHUB_WORKFLOW !== 'alpha2 Plugin runtime certification' ||
      environment.GITHUB_WORKFLOW_REF !== `${REPOSITORY}/${WORKFLOW_PATH}@refs/heads/main` ||
      environment.GITHUB_EVENT_NAME !== 'workflow_dispatch' ||
      environment.GITHUB_REF !== 'refs/heads/main' || !expectedJobs.includes(environment.GITHUB_JOB) ||
      environment.GITHUB_RUN_ID !== workflowIdentity.runId ||
      Number(environment.GITHUB_RUN_ATTEMPT) !== workflowIdentity.runAttempt ||
      environment.GITHUB_SHA !== workflowIdentity.headSha) {
    fail('aggregate evidence does not belong to this exact protected workflow run');
  }
  return workflowIdentity;
}

function buildReceiptSet(context, loaded, workflowIdentity) {
  const batches = context.plan.batches.map((batch) => {
    const receipts = [];
    for (const catalogId of batch.catalogIds) {
      for (const tuple of PLUGIN_RUNTIME_TUPLES) {
        const entry = loaded.loaded.get(`${catalogId}:${tuple.tuple}`);
        receipts.push({ catalogId, tuple: tuple.tuple, receiptSha256: entry.receiptSha256 });
      }
    }
    return {
      batchId: batch.batchId,
      candidateCount: 20,
      taskCount: 120,
      receiptsSha256: batchPayloadSha256(receipts),
      receipts,
    };
  });
  const candidates = context.intake.items.map((candidate) => ({
    catalogId: candidate.catalogId,
    slug: candidate.slug,
    sourceSubdir: candidate.sourceSubdir ?? '.',
    artifactSha256: context.runtimePlanContext.plan.items.find(
      (item) => item.catalogId === candidate.catalogId
    ).artifact.sha256,
    taskReceiptSha256: PLUGIN_RUNTIME_TUPLES.map((tuple) =>
      loaded.loaded.get(`${candidate.catalogId}:${tuple.tuple}`).receiptSha256),
  }));
  const receiptSet = {
    schemaVersion: 1,
    status: 'plugin-runtime-80-of-80-passed',
    authorityEffect: 'none-awaiting-reviewed-promotion',
    runtimeCandidatePlanSha256: context.runtimeCandidatePlanSha256,
    baseline: { ...BASELINE },
    workflow: workflowIdentity,
    gate: {
      requiredBatches: 4,
      verifiedBatches: 4,
      requiredCandidates: PLUGIN_RUNTIME_CANDIDATE_COUNT,
      verifiedCandidates: PLUGIN_RUNTIME_CANDIDATE_COUNT,
      requiredTasksPerCandidate: PLUGIN_RUNTIME_TUPLES.length,
      verifiedTasks: PLUGIN_RUNTIME_CANDIDATE_COUNT * PLUGIN_RUNTIME_TUPLES.length,
      installStartFunctionalRemoveRollbackSeparated: true,
      authorityBoundArtifactsAndFunctionalContracts: true,
      completeIsolatedDshHomeRollback: true,
      passed: true,
    },
    batches,
    candidates,
    receiptSetPayloadSha256: null,
  };
  receiptSet.receiptSetPayloadSha256 = receiptSetPayloadSha256(receiptSet);
  return receiptSet;
}

function validateReceiptSet(receiptSet, context, loaded, workflowIdentity) {
  const expected = buildReceiptSet(context, loaded, workflowIdentity);
  if (canonicalPluginRuntimeJson(receiptSet) !== canonicalPluginRuntimeJson(expected) ||
      receiptSet.receiptSetPayloadSha256 !== receiptSetPayloadSha256(receiptSet)) {
    fail('plugin runtime receipt set or 80/80 gate binding mismatch');
  }
  return receiptSet;
}

async function newOutputDirectory(input) {
  if (!isAbsolute(input)) fail('runtime output must be absolute');
  const requested = resolve(input);
  if (requested === parse(requested).root) fail('runtime output cannot be a filesystem root');
  const parent = await realpath(dirname(requested));
  const output = join(parent, basename(requested));
  try {
    await lstat(output);
    fail('runtime output must not already exist');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  await mkdir(output, { mode: 0o700 });
  return output;
}

async function writeNew(path, bytes) {
  const handle = await open(path, 'wx', 0o600);
  try {
    await handle.writeFile(bytes);
  } finally {
    await handle.close();
  }
}

function evidencePredicate(receiptSet, loaded) {
  return {
    schemaVersion: 1,
    predicateType: 'https://dsh-themes.com/attestations/plugin-alpha2-runtime-evidence/v1',
    authorityEffect: 'none-awaiting-reviewed-promotion',
    receiptSet,
    taskReceipts: loaded.expected.map(({ candidate, tuple }) => {
      const entry = loaded.loaded.get(`${candidate.catalogId}:${tuple.tuple}`);
      return entry.receipt;
    }),
  };
}

export async function aggregatePluginRuntime({
  input, output, workflowPath, context: contextOverride, environment = process.env,
}) {
  if (![input, output, workflowPath].every(isAbsolute)) fail('aggregate paths must be absolute');
  const context = contextOverride ?? await loadPluginRuntimeBatchContext();
  const loaded = await loadTaskReceipts(resolve(input), context);
  const workflowBytes = await readBoundedRegularFile(resolve(workflowPath), 'runtime workflow');
  const workflowIdentity = assertOneWorkflowRun(loaded.loaded, sha256(workflowBytes));
  validatePluginRuntimeAggregateGithubIdentity(environment, workflowIdentity, 'aggregate');
  const receiptSet = buildReceiptSet(context, loaded, workflowIdentity);
  validateReceiptSet(receiptSet, context, loaded, workflowIdentity);
  const target = await newOutputDirectory(output);
  const receipts = join(target, 'receipts');
  await mkdir(receipts, { mode: 0o700 });
  for (const { candidate, tuple } of loaded.expected) {
    const entry = loaded.loaded.get(`${candidate.catalogId}:${tuple.tuple}`);
    await writeNew(join(receipts, `${candidate.catalogId}-${tuple.tuple}.json`), entry.bytes);
  }
  const receiptSetBytes = Buffer.from(canonicalPluginRuntimeJson(receiptSet));
  const predicateBytes = Buffer.from(canonicalPluginRuntimeJson(evidencePredicate(receiptSet, loaded)));
  await writeNew(join(target, 'plugin-runtime-receipt-set.json'), receiptSetBytes);
  await writeNew(join(target, 'plugin-runtime-evidence-predicate.json'), predicateBytes);
  return {
    receiptSet,
    receiptSetSha256: sha256(receiptSetBytes),
    evidencePredicateSha256: sha256(predicateBytes),
  };
}

export async function verifyPluginRuntimeAggregate({
  candidate, workflowPath, context: contextOverride, environment = process.env,
}) {
  if (![candidate, workflowPath].every(isAbsolute)) fail('verify paths must be absolute');
  const root = await realpath(resolve(candidate));
  const context = contextOverride ?? await loadPluginRuntimeBatchContext();
  const loaded = await loadTaskReceipts(join(root, 'receipts'), context);
  const workflowBytes = await readBoundedRegularFile(resolve(workflowPath), 'runtime workflow');
  const workflowIdentity = assertOneWorkflowRun(loaded.loaded, sha256(workflowBytes));
  validatePluginRuntimeAggregateGithubIdentity(
    environment,
    workflowIdentity,
    ['aggregate', 'verify-signed']
  );
  const { bytes, value } = await readCanonicalJson(
    join(root, 'plugin-runtime-receipt-set.json'),
    'plugin runtime receipt set'
  );
  validateReceiptSet(value, context, loaded, workflowIdentity);
  const predicate = await readCanonicalJson(
    join(root, 'plugin-runtime-evidence-predicate.json'),
    'plugin runtime evidence predicate',
    MAX_PREDICATE_BYTES
  );
  const expectedPredicate = canonicalPluginRuntimeJson(evidencePredicate(value, loaded));
  if (predicate.bytes.toString('utf8') !== expectedPredicate) {
    fail('plugin runtime durable evidence predicate mismatch');
  }
  return {
    receiptSet: value,
    receiptSetBytes: bytes,
    receiptSetSha256: sha256(bytes),
    evidencePredicateSha256: sha256(predicate.bytes),
  };
}

export async function bindPluginRuntimeCustomAttestationPredicate({ bundle, predicate }) {
  if (![bundle, predicate].every(isAbsolute)) {
    fail('custom attestation binding paths must be absolute');
  }
  const [bundleBytes, predicateRecord] = await Promise.all([
    readBoundedRegularFile(bundle, 'custom Sigstore bundle', MAX_SIGSTORE_BUNDLE_BYTES),
    readCanonicalJson(predicate, 'custom attestation predicate', MAX_PREDICATE_BYTES),
  ]);
  let document;
  try {
    document = JSON.parse(bundleBytes);
  } catch {
    fail('custom Sigstore bundle is not JSON');
  }
  const payload = document?.dsseEnvelope?.payload;
  if (document?.dsseEnvelope?.payloadType !== 'application/vnd.in-toto+json' ||
      typeof payload !== 'string' || payload.length < 4 || payload.length % 4 !== 0 ||
      !/^[A-Za-z0-9+/]+={0,2}$/u.test(payload)) {
    fail('custom Sigstore bundle lacks one strict in-toto DSSE payload');
  }
  const statementBytes = Buffer.from(payload, 'base64');
  if (statementBytes.toString('base64') !== payload) {
    fail('custom Sigstore bundle DSSE payload is not canonical base64');
  }
  let statement;
  try {
    statement = JSON.parse(statementBytes);
  } catch {
    fail('custom Sigstore bundle DSSE payload is not JSON');
  }
  if (statement?._type !== 'https://in-toto.io/Statement/v1' ||
      statement.predicateType !==
        'https://dsh-themes.com/attestations/plugin-alpha2-runtime-evidence/v1' ||
      statement.predicate === null || typeof statement.predicate !== 'object' ||
      Array.isArray(statement.predicate) ||
      canonicalPluginRuntimeJson(statement.predicate) !== predicateRecord.bytes.toString('utf8')) {
    fail('signed custom predicate does not match the verified local 480-receipt evidence');
  }
  return {
    status: 'signed-custom-predicate-byte-bound',
    predicateSha256: sha256(predicateRecord.bytes),
  };
}

export function validatePluginRuntimeGithubIdentity(environment, task, workflowSha256) {
  const expectedRef = `${REPOSITORY}/${WORKFLOW_PATH}@refs/heads/main`;
  if (environment.GITHUB_ACTIONS !== 'true' || environment.GITHUB_REPOSITORY !== REPOSITORY ||
      environment.GITHUB_WORKFLOW !== 'alpha2 Plugin runtime certification' ||
      environment.GITHUB_WORKFLOW_REF !== expectedRef ||
      environment.GITHUB_EVENT_NAME !== 'workflow_dispatch' ||
      environment.GITHUB_REF !== 'refs/heads/main' || environment.GITHUB_JOB !== `runtime-batch-${task.batchId}` ||
      !/^[1-9]\d{0,19}$/u.test(environment.GITHUB_RUN_ID ?? '') ||
      !/^[1-9]\d{0,2}$/u.test(environment.GITHUB_RUN_ATTEMPT ?? '') ||
      !SHA40.test(environment.GITHUB_SHA ?? '') || !SHA256.test(workflowSha256 ?? '')) {
    fail('plugin runtime receipt requires the exact main workflow job identity');
  }
  return {
    repository: REPOSITORY,
    workflowPath: WORKFLOW_PATH,
    workflowSha256,
    event: 'workflow_dispatch',
    ref: 'refs/heads/main',
    runId: environment.GITHUB_RUN_ID,
    runAttempt: Number(environment.GITHUB_RUN_ATTEMPT),
    headSha: environment.GITHUB_SHA,
    jobKey: environment.GITHUB_JOB,
    matrixIdentity: `${task.catalogId}-${task.tuple}`,
  };
}

async function checkoutIdentity(sourceInput, expectedCommit, label) {
  if (!isAbsolute(sourceInput)) fail(`${label} checkout must be absolute`);
  const source = await realpath(resolve(sourceInput));
  const result = spawnSync('git', ['-C', source, 'rev-parse', 'HEAD', 'HEAD^{tree}'], {
    encoding: 'utf8',
    env: {
      PATH: process.env.PATH,
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_CONFIG_GLOBAL: process.platform === 'win32' ? 'NUL' : '/dev/null',
      GIT_TERMINAL_PROMPT: '0',
    },
    shell: false,
    timeout: 30_000,
    windowsHide: true,
  });
  const lines = result.stdout?.trim().split(/\r?\n/u) ?? [];
  if (result.error || result.status !== 0 || result.stderr?.trim() !== '' ||
      lines.length !== 2 || lines[0] !== expectedCommit || !SHA40.test(lines[1])) {
    fail(`${label} checkout identity mismatch`);
  }
  return { source, commit: lines[0], tree: lines[1] };
}

export async function sealPluginRuntimeTask({
  artifactPath, candidateSource, evidencePath, output, workflowPath, catalogId, tuple,
}) {
  if (![artifactPath, candidateSource, evidencePath, output, workflowPath].every(isAbsolute)) {
    fail('task paths must be absolute');
  }
  const context = await loadPluginRuntimeBatchContext();
  requireReadyPluginRuntimeCandidatePlan(
    context.runtimePlanContext.plan,
    context.intake,
    context.runtimePlanContext.intakeSha256
  );
  const candidate = context.intake.items.find((item) => item.catalogId === catalogId);
  const runtimeCandidate = context.runtimePlanContext.plan.items.find(
    (item) => item.catalogId === catalogId
  );
  if (candidate === undefined || runtimeCandidate === undefined) {
    fail('task catalog ID is not in runtime candidate plan');
  }
  const taskTuple = PLUGIN_RUNTIME_TUPLES.find((entry) => entry.tuple === tuple);
  if (taskTuple === undefined) fail('task tuple is not one of the exact six');
  if (process.platform !== taskTuple.platform || process.arch !== taskTuple.arch ||
      process.versions.node !== taskTuple.nodeVersion) {
    fail('actual runner platform, architecture, or Node version does not match the task tuple');
  }
  const batch = context.plan.batches.find((entry) => entry.catalogIds.includes(catalogId));
  const task = { ...taskTuple, batchId: batch.batchId, catalogId };
  const checkout = await checkoutIdentity(candidateSource, candidate.commit, 'candidate');
  const candidateTree = checkout.tree;
  if (candidateTree !== runtimeCandidate.artifact.source.tree) {
    fail('candidate checkout tree does not match runtime artifact source identity');
  }
  await verifyExactArtifact(artifactPath, runtimeCandidate.artifact);
  await verifyRuntimeAuthorityFile(
    runtimeCandidate.artifact.distribution.metadataPath,
    runtimeCandidate.artifact.distribution.metadataSha256,
    'artifact distribution metadata'
  );
  if (runtimeCandidate.artifact.distribution.buildRecipePath !== null) {
    await verifyRuntimeAuthorityFile(
      runtimeCandidate.artifact.distribution.buildRecipePath,
      runtimeCandidate.artifact.distribution.buildRecipeSha256,
      'hosted artifact build recipe'
    );
  }
  await verifyFunctionalProbeContract(runtimeCandidate.functionalProbe);
  const workflowBytes = await readBoundedRegularFile(workflowPath, 'runtime workflow');
  const ci = validatePluginRuntimeGithubIdentity(process.env, task, sha256(workflowBytes));
  const evidence = await readCanonicalJson(evidencePath, 'fixed executor stage evidence');
  validateStages(evidence.value, runtimeCandidate);
  const receipt = buildPluginRuntimeReceipt({
    runtimeCandidatePlanSha256: context.runtimeCandidatePlanSha256,
    candidate,
    runtimeCandidate,
    candidateTree,
    task,
    stages: evidence.value,
    ci,
  });
  await writeNew(output, Buffer.from(canonicalPluginRuntimeJson(receipt)));
  return receipt;
}

function parseArgs(argv) {
  const command = argv[0];
  const allowed = {
    aggregate: new Set(['--input', '--output', '--workflow']),
    verify: new Set(['--candidate', '--workflow']),
    'verify-custom-bundle': new Set(['--bundle', '--predicate']),
    seal: new Set([
      '--artifact', '--candidate-source', '--evidence', '--output', '--workflow',
      '--catalog-id', '--tuple',
    ]),
  };
  if (!allowed[command]) fail('command must be seal, aggregate, or verify');
  const options = {};
  for (let index = 1; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!allowed[command].has(key) || value === undefined || options[key] !== undefined) {
      fail(`invalid or duplicate ${command} argument`);
    }
    options[key] = value;
  }
  if ([...allowed[command]].some((key) => options[key] === undefined)) {
    fail(`${command} is missing a required argument`);
  }
  return {
    command,
    input: options['--input'],
    output: options['--output'],
    workflowPath: options['--workflow'],
    candidate: options['--candidate'],
    candidateSource: options['--candidate-source'],
    artifactPath: options['--artifact'],
    evidencePath: options['--evidence'],
    catalogId: options['--catalog-id'] === undefined ? undefined : Number(options['--catalog-id']),
    tuple: options['--tuple'],
    bundle: options['--bundle'],
    predicate: options['--predicate'],
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const options = parseArgs(process.argv.slice(2));
    const result = options.command === 'aggregate'
      ? await aggregatePluginRuntime(options)
      : options.command === 'verify'
        ? await verifyPluginRuntimeAggregate(options)
        : options.command === 'verify-custom-bundle'
          ? await bindPluginRuntimeCustomAttestationPredicate(options)
          : await sealPluginRuntimeTask(options);
    process.stdout.write(`${JSON.stringify({
      valid: true,
      status: result.receiptSet?.status ?? result.status,
      receiptSetSha256: result.receiptSetSha256,
    })}\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
