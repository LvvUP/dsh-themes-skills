#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { constants } from 'node:fs';
import {
  lstat,
  mkdir,
  open,
  readdir,
  readFile,
  realpath,
} from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  REPLACEMENT_RUNTIME_TUPLES,
  buildReplacementRuntimeBatchPlan,
} from './plugin-replacement-runtime-batches.mjs';
import {
  REPLACEMENT_ALLOCATION_COUNT,
  REPLACEMENT_BASELINE,
  REPLACEMENT_FIRST_PUBLIC_ID,
  requireReadyReplacementRuntimePlan,
  loadReplacementRuntimePlan,
} from './plugin-replacement-runtime-plan.mjs';

const REPOSITORY = 'LvvUP/dsh-themes-skills';
const WORKFLOW_PATH =
  '.github/workflows/alpha2-plugin-replacement-runtime-certification.yml';
const WORKFLOW_NAME = 'alpha2 Plugin replacement runtime certification';
const MAX_RECEIPT_BYTES = 1024 * 1024;
const MAX_RECEIPTS = 44 * 6;
const MAX_EVIDENCE_BYTES = 32 * 1024 * 1024;
const MAX_SIGSTORE_BUNDLE_BYTES = 32 * 1024 * 1024;
const SHA256 = /^[a-f0-9]{64}$/u;
const SHA40 = /^[a-f0-9]{40}$/u;
const SAFE_TOKEN = /^replacement-(?:0[1-9]|[1-3][0-9]|4[0-4])-[a-f0-9]{20}$/u;
const SAFE_ASSERTION = /^[a-z0-9]+(?:[._:-][a-z0-9]+)*$/u;

function fail(message) {
  throw new Error(message);
}

function exactKeys(value, keys, label) {
  if (
    value === null ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    JSON.stringify(Object.keys(value).sort()) !== JSON.stringify([...keys].sort())
  ) {
    fail(`${label} keys mismatch`);
  }
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, stable(value[key])])
    );
  }
  return value;
}

export function canonicalReplacementRuntimeJson(value) {
  return `${JSON.stringify(stable(value))}\n`;
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function tupleKey(task) {
  return `${task.platform}-${task.arch}-node-${task.nodeVersion}`;
}

function expectedBatchId(rank) {
  return Math.floor((rank - 1) / 11) + 1;
}

function validatePassedStage(stage, keys, label) {
  exactKeys(stage, ['status', ...keys], label);
  if (stage.status !== 'passed') fail(`${label} did not pass`);
}

export function validateReplacementRuntimeStages(stages, candidate) {
  exactKeys(
    stages,
    ['install', 'start', 'functionalProbe', 'remove', 'fullRollback'],
    'replacement runtime stages'
  );
  validatePassedStage(
    stages.install,
    [
      'candidateArtifactSha256',
      'candidateArtifactBytes',
      'packageName',
      'version',
      'profileSnapshotCaptured',
      'sanitizedDumpConfigEntrySetSha256',
      'exactCordisEntryPresent',
    ],
    'replacement install stage'
  );
  if (
    stages.install.candidateArtifactSha256 !== candidate.runtimeInput.artifact.sha256 ||
    stages.install.candidateArtifactBytes !== candidate.runtimeInput.artifact.bytes ||
    stages.install.packageName !== candidate.packageName ||
    stages.install.version !== candidate.packageVersion ||
    stages.install.profileSnapshotCaptured !== true ||
    !SHA256.test(stages.install.sanitizedDumpConfigEntrySetSha256 ?? '') ||
    stages.install.exactCordisEntryPresent !== true
  ) {
    fail('replacement install stage does not bind the exact candidate artifact and mutation');
  }

  validatePassedStage(
    stages.start,
    ['coldStart', 'webBooted', 'unauthenticatedRootStatus', 'processStayedAlive'],
    'replacement start stage'
  );
  if (
    stages.start.coldStart !== true ||
    stages.start.webBooted !== true ||
    stages.start.unauthenticatedRootStatus !== 401 ||
    stages.start.processStayedAlive !== true
  ) {
    fail('replacement cold Web BrowserAuth boundary did not pass');
  }

  validatePassedStage(
    stages.functionalProbe,
    ['kind', 'contractSha256', 'webBootOnly', 'assertions'],
    'replacement functional stage'
  );
  const probe = candidate.runtimeInput.functionalProbe;
  if (
    stages.functionalProbe.kind !== 'candidate-capability-contract' ||
    stages.functionalProbe.contractSha256 !== probe.contractSha256 ||
    stages.functionalProbe.webBootOnly !== false ||
    !Array.isArray(stages.functionalProbe.assertions) ||
    stages.functionalProbe.assertions.length !== probe.requiredAssertions.length
  ) {
    fail('replacement functional evidence is not the exact reviewed capability contract');
  }
  const assertionIds = [];
  for (const assertion of stages.functionalProbe.assertions) {
    exactKeys(assertion, ['id', 'status'], 'replacement assertion');
    if (
      !SAFE_ASSERTION.test(assertion.id ?? '') ||
      assertion.status !== 'passed'
    ) {
      fail('replacement assertion is malformed or did not pass');
    }
    assertionIds.push(assertion.id);
  }
  if (
    new Set(assertionIds).size !== assertionIds.length ||
    JSON.stringify([...assertionIds].sort()) !==
      JSON.stringify([...probe.requiredAssertions].sort())
  ) {
    fail('replacement assertion set does not match its probe authority');
  }

  validatePassedStage(
    stages.remove,
    ['exactPackageAbsent', 'cordisEntryAbsent', 'sanitizedDumpConfigEntrySetSha256'],
    'replacement remove stage'
  );
  if (
    stages.remove.exactPackageAbsent !== true ||
    stages.remove.cordisEntryAbsent !== true ||
    !SHA256.test(stages.remove.sanitizedDumpConfigEntrySetSha256 ?? '')
  ) {
    fail('replacement removal did not prove package and Cordis entry absence');
  }

  validatePassedStage(
    stages.fullRollback,
    [
      'declaredWritableRoots',
      'observedWritableRoots',
      'allDshHomeBytesRestored',
      'dependencyClosureRestored',
      'noWritesOutsideDeclaredRoots',
      'sandboxedExternalWritesDenied',
      'sidecarsTerminated',
    ],
    'replacement rollback stage'
  );
  const rollback = stages.fullRollback;
  if (
    !Array.isArray(rollback.declaredWritableRoots) ||
    rollback.declaredWritableRoots.length < 1 ||
    rollback.declaredWritableRoots.length > 32 ||
    !Array.isArray(rollback.observedWritableRoots) ||
    rollback.observedWritableRoots.length > 32 ||
    rollback.declaredWritableRoots.some((value) => !SAFE_ASSERTION.test(value)) ||
    rollback.observedWritableRoots.some((value) => !SAFE_ASSERTION.test(value)) ||
    new Set(rollback.declaredWritableRoots).size !== rollback.declaredWritableRoots.length ||
    new Set(rollback.observedWritableRoots).size !== rollback.observedWritableRoots.length ||
    rollback.observedWritableRoots.some(
      (value) => !rollback.declaredWritableRoots.includes(value)
    ) ||
    rollback.allDshHomeBytesRestored !== true ||
    rollback.dependencyClosureRestored !== true ||
    rollback.noWritesOutsideDeclaredRoots !== true ||
    rollback.sandboxedExternalWritesDenied !== true ||
    rollback.sidecarsTerminated !== true
  ) {
    fail('replacement full rollback did not restore the complete isolated closure');
  }
  return stages;
}

function receiptCandidate(candidate) {
  return {
    migrationRank: candidate.rank,
    candidateKey: candidate.candidateKey,
    candidateToken: candidate.candidateToken,
    packageName: candidate.packageName,
    packageVersion: candidate.packageVersion,
    distributionClass: candidate.distributionClass,
    source: structuredClone(candidate.source),
    artifact: structuredClone(candidate.runtimeInput.artifact),
  };
}

export function buildReplacementRuntimeReceipt({
  context,
  candidate,
  task,
  stages,
  ci,
}) {
  const receipt = {
    schemaVersion: 1,
    status: 'replacement-runtime-task-passed',
    scope: 'one-idless-candidate-one-platform-node-task',
    authorityEffect: 'one-of-six-candidate-evidence-only',
    migrationMapSha256: context.migrationMapSha256,
    runtimePlanSha256: context.planSha256,
    candidate: receiptCandidate(candidate),
    baseline: { ...REPLACEMENT_BASELINE },
    task: {
      batchId: task.batchId,
      platform: task.platform,
      arch: task.arch,
      nodeVersion: task.nodeVersion,
    },
    stages: structuredClone(stages),
    ci: structuredClone(ci),
    privacy: {
      capturesEnvironment: false,
      capturesSecrets: false,
      capturesBrowserCredentials: false,
      capturesMachinePaths: false,
      capturesCandidateOutput: false,
      capturesSecretDerivedDigests: false,
    },
  };
  return validateReplacementRuntimeReceipt(receipt, { context, candidate, task });
}

export function validateReplacementRuntimeReceipt(
  receipt,
  { context, candidate, task } = {}
) {
  exactKeys(
    receipt,
    [
      'schemaVersion',
      'status',
      'scope',
      'authorityEffect',
      'migrationMapSha256',
      'runtimePlanSha256',
      'candidate',
      'baseline',
      'task',
      'stages',
      'ci',
      'privacy',
    ],
    'replacement runtime receipt'
  );
  if (
    receipt.schemaVersion !== 1 ||
    receipt.status !== 'replacement-runtime-task-passed' ||
    receipt.scope !== 'one-idless-candidate-one-platform-node-task' ||
    receipt.authorityEffect !== 'one-of-six-candidate-evidence-only' ||
    !SHA256.test(receipt.migrationMapSha256 ?? '') ||
    !SHA256.test(receipt.runtimePlanSha256 ?? '')
  ) {
    fail('replacement runtime receipt header mismatch');
  }
  exactKeys(
    receipt.candidate,
    [
      'migrationRank',
      'candidateKey',
      'candidateToken',
      'packageName',
      'packageVersion',
      'distributionClass',
      'source',
      'artifact',
    ],
    'replacement receipt candidate'
  );
  exactKeys(
    receipt.candidate.source,
    ['repository', 'commit', 'tree', 'sourceSubdir', 'exactCoordinate'],
    'replacement receipt source'
  );
  exactKeys(
    receipt.candidate.artifact,
    [
      'kind',
      'locator',
      'bytes',
      'sha256',
      'metadataPath',
      'metadataSha256',
      'buildRecipePath',
      'buildRecipeSha256',
    ],
    'replacement receipt artifact'
  );
  if (
    Object.hasOwn(receipt.candidate, 'catalogId') ||
    Object.hasOwn(receipt.candidate, 'publicId') ||
    !Number.isSafeInteger(receipt.candidate.migrationRank) ||
    receipt.candidate.migrationRank < 1 ||
    receipt.candidate.migrationRank > 44 ||
    !SAFE_TOKEN.test(receipt.candidate.candidateToken ?? '') ||
    !SHA40.test(receipt.candidate.source.commit ?? '') ||
    !SHA40.test(receipt.candidate.source.tree ?? '') ||
    !Number.isSafeInteger(receipt.candidate.artifact.bytes) ||
    receipt.candidate.artifact.bytes < 1 ||
    !SHA256.test(receipt.candidate.artifact.sha256 ?? '') ||
    !SHA256.test(receipt.candidate.artifact.metadataSha256 ?? '')
  ) {
    fail('replacement receipt candidate identity is malformed or uses a Public ID');
  }
  exactKeys(receipt.baseline, Object.keys(REPLACEMENT_BASELINE), 'replacement receipt baseline');
  if (
    canonicalReplacementRuntimeJson(receipt.baseline) !==
    canonicalReplacementRuntimeJson(REPLACEMENT_BASELINE)
  ) {
    fail('replacement receipt does not bind the exact alpha.2 baseline');
  }
  exactKeys(
    receipt.task,
    ['batchId', 'platform', 'arch', 'nodeVersion'],
    'replacement receipt task'
  );
  const admittedTuple = REPLACEMENT_RUNTIME_TUPLES.find(
    (tuple) => tupleKey(tuple) === tupleKey(receipt.task)
  );
  if (
    admittedTuple === undefined ||
    receipt.task.batchId !== expectedBatchId(receipt.candidate.migrationRank)
  ) {
    fail('replacement receipt task is outside its exact six-task matrix');
  }
  exactKeys(
    receipt.ci,
    [
      'repository',
      'workflowPath',
      'workflowSha256',
      'event',
      'ref',
      'runId',
      'runAttempt',
      'headSha',
      'jobKey',
      'matrixIdentity',
    ],
    'replacement receipt CI identity'
  );
  const expectedMatrix = `${receipt.candidate.candidateToken}-${tupleKey(receipt.task)}`;
  if (
    receipt.ci.repository !== REPOSITORY ||
    receipt.ci.workflowPath !== WORKFLOW_PATH ||
    !SHA256.test(receipt.ci.workflowSha256 ?? '') ||
    receipt.ci.event !== 'workflow_dispatch' ||
    receipt.ci.ref !== 'refs/heads/main' ||
    !/^[1-9]\d{0,19}$/u.test(receipt.ci.runId ?? '') ||
    !Number.isSafeInteger(receipt.ci.runAttempt) ||
    receipt.ci.runAttempt < 1 ||
    receipt.ci.runAttempt > 100 ||
    !SHA40.test(receipt.ci.headSha ?? '') ||
    receipt.ci.jobKey !== `runtime-batch-${receipt.task.batchId}` ||
    receipt.ci.matrixIdentity !== expectedMatrix
  ) {
    fail('replacement receipt CI identity is not one exact main matrix task');
  }
  exactKeys(
    receipt.privacy,
    [
      'capturesEnvironment',
      'capturesSecrets',
      'capturesBrowserCredentials',
      'capturesMachinePaths',
      'capturesCandidateOutput',
      'capturesSecretDerivedDigests',
    ],
    'replacement receipt privacy'
  );
  if (Object.values(receipt.privacy).some((value) => value !== false)) {
    fail('replacement receipt privacy boundary is not closed');
  }

  if (context !== undefined) {
    requireReadyReplacementRuntimePlan(context.plan, context.map, context);
    if (
      receipt.migrationMapSha256 !== context.migrationMapSha256 ||
      receipt.runtimePlanSha256 !== context.planSha256
    ) {
      fail('replacement receipt reuses a different migration map or runtime plan');
    }
    candidate ??= context.plan.candidates.find(
      (entry) => entry.candidateToken === receipt.candidate.candidateToken
    );
  }
  if (
    candidate !== undefined &&
    canonicalReplacementRuntimeJson(receipt.candidate) !==
      canonicalReplacementRuntimeJson(receiptCandidate(candidate))
  ) {
    fail('replacement receipt candidate does not match the exact runtime plan');
  }
  if (candidate !== undefined) validateReplacementRuntimeStages(receipt.stages, candidate);
  if (task !== undefined && tupleKey(receipt.task) !== task.tuple) {
    fail('replacement receipt tuple mismatch');
  }
  return receipt;
}

export function validateReplacementRuntimeGithubIdentity(environment, task, workflowSha256) {
  const expectedWorkflowRef = `${REPOSITORY}/${WORKFLOW_PATH}@refs/heads/main`;
  if (
    environment.GITHUB_ACTIONS !== 'true' ||
    environment.GITHUB_REPOSITORY !== REPOSITORY ||
    environment.GITHUB_WORKFLOW !== WORKFLOW_NAME ||
    environment.GITHUB_WORKFLOW_REF !== expectedWorkflowRef ||
    environment.GITHUB_EVENT_NAME !== 'workflow_dispatch' ||
    environment.GITHUB_REF !== 'refs/heads/main' ||
    environment.GITHUB_JOB !== `runtime-batch-${task.batchId}` ||
    !/^[1-9]\d{0,19}$/u.test(environment.GITHUB_RUN_ID ?? '') ||
    !/^[1-9]\d?$/u.test(environment.GITHUB_RUN_ATTEMPT ?? '') ||
    Number(environment.GITHUB_RUN_ATTEMPT) > 100 ||
    !SHA40.test(environment.GITHUB_SHA ?? '') ||
    !SHA256.test(workflowSha256 ?? '')
  ) {
    fail('replacement runtime task lacks the exact protected GitHub context');
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
    jobKey: `runtime-batch-${task.batchId}`,
    matrixIdentity: `${task.candidateToken}-${task.tuple}`,
  };
}

export function replacementAggregateGithubIdentity(environment, workflowSha256) {
  const expectedWorkflowRef = `${REPOSITORY}/${WORKFLOW_PATH}@refs/heads/main`;
  if (
    environment.GITHUB_ACTIONS !== 'true' ||
    environment.GITHUB_REPOSITORY !== REPOSITORY ||
    environment.GITHUB_WORKFLOW !== WORKFLOW_NAME ||
    environment.GITHUB_WORKFLOW_REF !== expectedWorkflowRef ||
    environment.GITHUB_EVENT_NAME !== 'workflow_dispatch' ||
    environment.GITHUB_REF !== 'refs/heads/main' ||
    environment.GITHUB_JOB !== 'aggregate' ||
    !/^[1-9]\d{0,19}$/u.test(environment.GITHUB_RUN_ID ?? '') ||
    !/^[1-9]\d?$/u.test(environment.GITHUB_RUN_ATTEMPT ?? '') ||
    Number(environment.GITHUB_RUN_ATTEMPT) > 100 ||
    !SHA40.test(environment.GITHUB_SHA ?? '') ||
    !SHA256.test(workflowSha256 ?? '')
  ) {
    fail('replacement aggregate lacks the exact protected GitHub context');
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
    jobKey: 'aggregate',
  };
}

function validateAggregateCi(ci, workflowSha256) {
  exactKeys(
    ci,
    [
      'repository',
      'workflowPath',
      'workflowSha256',
      'event',
      'ref',
      'runId',
      'runAttempt',
      'headSha',
      'jobKey',
    ],
    'replacement aggregate CI identity'
  );
  if (
    ci.repository !== REPOSITORY ||
    ci.workflowPath !== WORKFLOW_PATH ||
    ci.workflowSha256 !== workflowSha256 ||
    ci.event !== 'workflow_dispatch' ||
    ci.ref !== 'refs/heads/main' ||
    !/^[1-9]\d{0,19}$/u.test(ci.runId ?? '') ||
    !Number.isSafeInteger(ci.runAttempt) ||
    ci.runAttempt < 1 ||
    ci.runAttempt > 100 ||
    !SHA40.test(ci.headSha ?? '') ||
    ci.jobKey !== 'aggregate'
  ) {
    fail('replacement aggregate CI identity mismatch');
  }
}

function validateCurrentAggregateRun(environment, aggregateCi) {
  const expectedWorkflowRef = `${REPOSITORY}/${WORKFLOW_PATH}@refs/heads/main`;
  if (
    environment.GITHUB_ACTIONS !== 'true' ||
    environment.GITHUB_REPOSITORY !== aggregateCi.repository ||
    environment.GITHUB_WORKFLOW !== WORKFLOW_NAME ||
    environment.GITHUB_WORKFLOW_REF !== expectedWorkflowRef ||
    environment.GITHUB_EVENT_NAME !== aggregateCi.event ||
    environment.GITHUB_REF !== aggregateCi.ref ||
    environment.GITHUB_RUN_ID !== aggregateCi.runId ||
    Number(environment.GITHUB_RUN_ATTEMPT) !== aggregateCi.runAttempt ||
    environment.GITHUB_SHA !== aggregateCi.headSha ||
    !['aggregate', 'verify-signed'].includes(environment.GITHUB_JOB)
  ) {
    fail('replacement aggregate verification is not in its original run and attempt');
  }
}

function ensureReceiptRun(receipt, aggregateCi) {
  for (const key of [
    'repository',
    'workflowPath',
    'workflowSha256',
    'event',
    'ref',
    'runId',
    'runAttempt',
    'headSha',
  ]) {
    if (receipt.ci[key] !== aggregateCi[key]) {
      fail('replacement receipt belongs to a different workflow run or attempt');
    }
  }
}

function candidateReceiptSummary(candidate, receiptEntries) {
  const sorted = [...receiptEntries].sort((left, right) =>
    left.tuple.localeCompare(right.tuple)
  );
  const expected = REPLACEMENT_RUNTIME_TUPLES.map((tuple) => tuple.tuple).sort();
  const observed = sorted.map((entry) => entry.tuple);
  const verifiedSixTask =
    sorted.length === 6 && JSON.stringify(observed) === JSON.stringify(expected);
  return {
    migrationRank: candidate.rank,
    candidateKey: candidate.candidateKey,
    candidateToken: candidate.candidateToken,
    distributionClass: candidate.distributionClass,
    passedTaskCount: sorted.length,
    passedTuples: observed,
    taskReceiptSetSha256: sha256(
      Buffer.from(
        canonicalReplacementRuntimeJson(
          sorted.map((entry) => ({ tuple: entry.tuple, receiptSha256: entry.receiptSha256 }))
        )
      )
    ),
    verifiedSixTask,
  };
}

function buildAllocationEntries(context, summaries) {
  const summaryByToken = new Map(
    summaries.map((summary) => [summary.candidateToken, summary])
  );
  const qualified = context.plan.candidates.filter(
    (candidate) => summaryByToken.get(candidate.candidateToken)?.verifiedSixTask === true
  );
  if (qualified.length < REPLACEMENT_ALLOCATION_COUNT) {
    fail(
      `only ${qualified.length} replacement candidates passed 6/6; ` +
        `${REPLACEMENT_ALLOCATION_COUNT} are required before an ID proposal`
    );
  }
  return qualified.slice(0, REPLACEMENT_ALLOCATION_COUNT).map((candidate, index) => ({
    proposedPublicId: REPLACEMENT_FIRST_PUBLIC_ID + index,
    migrationRank: candidate.rank,
    candidateKey: candidate.candidateKey,
    candidateToken: candidate.candidateToken,
    packageName: candidate.packageName,
    packageVersion: candidate.packageVersion,
    distributionClass: candidate.distributionClass,
    distributionDisposition:
      candidate.distributionClass === 'hosted-adaptation-required'
        ? 'hosted-adaptation-candidate-only'
        : 'exact-upstream-candidate-only',
    exactSourceCoordinate: candidate.source.exactCoordinate,
    sixTaskReceiptSetSha256:
      summaryByToken.get(candidate.candidateToken).taskReceiptSetSha256,
  }));
}

export function aggregateReplacementRuntimeReceipts(
  receipts,
  { context, workflowSha256, aggregateCi }
) {
  requireReadyReplacementRuntimePlan(context.plan, context.map, context);
  validateAggregateCi(aggregateCi, workflowSha256);
  if (!Array.isArray(receipts) || receipts.length > MAX_RECEIPTS) {
    fail('replacement receipt input exceeds the exact 264-task ceiling');
  }
  const byToken = new Map(
    context.plan.candidates.map((candidate) => [candidate.candidateToken, candidate])
  );
  const receiptGroups = new Map(
    context.plan.candidates.map((candidate) => [candidate.candidateToken, []])
  );
  const uniqueTasks = new Set();
  const canonicalReceipts = [];
  for (const rawReceipt of receipts) {
    const candidate = byToken.get(rawReceipt?.candidate?.candidateToken);
    if (candidate === undefined) fail('replacement receipt references an unknown candidate token');
    const receipt = validateReplacementRuntimeReceipt(rawReceipt, { context, candidate });
    ensureReceiptRun(receipt, aggregateCi);
    const tuple = tupleKey(receipt.task);
    const key = `${candidate.candidateToken}:${tuple}`;
    if (uniqueTasks.has(key)) fail('duplicate replacement candidate/tuple receipt');
    uniqueTasks.add(key);
    const receiptSha256 = sha256(Buffer.from(canonicalReplacementRuntimeJson(receipt)));
    receiptGroups.get(candidate.candidateToken).push({ tuple, receiptSha256, receipt });
    canonicalReceipts.push(receipt);
  }
  canonicalReceipts.sort((left, right) => {
    const rankDiff = left.candidate.migrationRank - right.candidate.migrationRank;
    return rankDiff || tupleKey(left.task).localeCompare(tupleKey(right.task));
  });
  const summaries = context.plan.candidates.map((candidate) =>
    candidateReceiptSummary(candidate, receiptGroups.get(candidate.candidateToken))
  );
  const qualifiedCandidateCount = summaries.filter(
    (summary) => summary.verifiedSixTask
  ).length;
  const entries = buildAllocationEntries(context, summaries);
  const receiptSet = {
    schemaVersion: 1,
    status: 'replacement-runtime-allocation-threshold-met',
    authorityEffect: 'candidate-qualification-only-never-install-authority',
    migrationMapSha256: context.migrationMapSha256,
    runtimePlanSha256: context.planSha256,
    baseline: { ...REPLACEMENT_BASELINE },
    matrix: {
      requiredTuples: REPLACEMENT_RUNTIME_TUPLES.map((tuple) => tuple.tuple),
      candidateCount: 44,
      tasksPerCandidate: 6,
      maximumTaskCount: 264,
    },
    ci: structuredClone(aggregateCi),
    observedPassedTaskReceipts: canonicalReceipts.length,
    qualifiedCandidateCount,
    allocationCandidateCount: entries.length,
    candidates: summaries,
  };
  const receiptSetBytes = Buffer.from(canonicalReplacementRuntimeJson(receiptSet));
  const receiptSetSha256 = sha256(receiptSetBytes);
  const proposal = {
    schemaVersion: 1,
    status: 'deterministic-id-allocation-proposal',
    authorityEffect: 'proposal-only-never-install-authority',
    installable: false,
    writesPluginAuthorityItems: false,
    migrationMapSha256: context.migrationMapSha256,
    runtimePlanSha256: context.planSha256,
    receiptSetSha256,
    firstPublicId: REPLACEMENT_FIRST_PUBLIC_ID,
    allocationCount: REPLACEMENT_ALLOCATION_COUNT,
    retiredIdsMayBeRebound: false,
    entriesSha256: sha256(Buffer.from(canonicalReplacementRuntimeJson(entries))),
    entries,
  };
  const proposalBytes = Buffer.from(canonicalReplacementRuntimeJson(proposal));
  const proposalSha256 = sha256(proposalBytes);
  const evidence = {
    predicateType:
      'https://dsh-themes.com/attestations/plugin-alpha2-replacement-runtime-evidence/v1',
    migrationMapSha256: context.migrationMapSha256,
    runtimePlanSha256: context.planSha256,
    receiptSetSha256,
    proposalSha256,
    receipts: canonicalReceipts,
  };
  return {
    receiptSet,
    receiptSetBytes,
    receiptSetSha256,
    proposal,
    proposalBytes,
    proposalSha256,
    evidence,
    evidenceBytes: Buffer.from(canonicalReplacementRuntimeJson(evidence)),
  };
}

export function validateReplacementAllocationProposal(proposal, receiptSet, context) {
  exactKeys(
    proposal,
    [
      'schemaVersion',
      'status',
      'authorityEffect',
      'installable',
      'writesPluginAuthorityItems',
      'migrationMapSha256',
      'runtimePlanSha256',
      'receiptSetSha256',
      'firstPublicId',
      'allocationCount',
      'retiredIdsMayBeRebound',
      'entriesSha256',
      'entries',
    ],
    'replacement allocation proposal'
  );
  if (
    proposal.schemaVersion !== 1 ||
    proposal.status !== 'deterministic-id-allocation-proposal' ||
    proposal.authorityEffect !== 'proposal-only-never-install-authority' ||
    proposal.installable !== false ||
    proposal.writesPluginAuthorityItems !== false ||
    proposal.migrationMapSha256 !== context.migrationMapSha256 ||
    proposal.runtimePlanSha256 !== context.planSha256 ||
    proposal.receiptSetSha256 !==
      sha256(Buffer.from(canonicalReplacementRuntimeJson(receiptSet))) ||
    proposal.firstPublicId !== REPLACEMENT_FIRST_PUBLIC_ID ||
    proposal.allocationCount !== REPLACEMENT_ALLOCATION_COUNT ||
    proposal.retiredIdsMayBeRebound !== false ||
    !Array.isArray(proposal.entries) ||
    proposal.entries.length !== REPLACEMENT_ALLOCATION_COUNT ||
    proposal.entriesSha256 !==
      sha256(Buffer.from(canonicalReplacementRuntimeJson(proposal.entries)))
  ) {
    fail('replacement allocation proposal header or digest mismatch');
  }
  const summaries = new Map(
    receiptSet.candidates.map((summary) => [summary.candidateToken, summary])
  );
  const retired = new Set(context.map.retired.map((item) => item.catalogId));
  const seenIds = new Set();
  const seenCandidates = new Set();
  let previousRank = 0;
  for (const [index, entry] of proposal.entries.entries()) {
    exactKeys(
      entry,
      [
        'proposedPublicId',
        'migrationRank',
        'candidateKey',
        'candidateToken',
        'packageName',
        'packageVersion',
        'distributionClass',
        'distributionDisposition',
        'exactSourceCoordinate',
        'sixTaskReceiptSetSha256',
      ],
      `replacement allocation entries[${index}]`
    );
    const candidate = context.plan.candidates.find(
      (item) => item.candidateToken === entry.candidateToken
    );
    const summary = summaries.get(entry.candidateToken);
    if (
      entry.proposedPublicId !== REPLACEMENT_FIRST_PUBLIC_ID + index ||
      retired.has(entry.proposedPublicId) ||
      seenIds.has(entry.proposedPublicId) ||
      seenCandidates.has(entry.candidateToken) ||
      candidate === undefined ||
      summary?.verifiedSixTask !== true ||
      entry.migrationRank !== candidate.rank ||
      entry.migrationRank <= previousRank ||
      entry.candidateKey !== candidate.candidateKey ||
      entry.packageName !== candidate.packageName ||
      entry.packageVersion !== candidate.packageVersion ||
      entry.distributionClass !== candidate.distributionClass ||
      entry.exactSourceCoordinate !== candidate.source.exactCoordinate ||
      entry.sixTaskReceiptSetSha256 !== summary.taskReceiptSetSha256 ||
      entry.distributionDisposition !==
        (candidate.distributionClass === 'hosted-adaptation-required'
          ? 'hosted-adaptation-candidate-only'
          : 'exact-upstream-candidate-only')
    ) {
      fail('replacement allocation entry is not one sequential 6/6-qualified proposal');
    }
    previousRank = entry.migrationRank;
    seenIds.add(entry.proposedPublicId);
    seenCandidates.add(entry.candidateToken);
  }
  return proposal;
}

export function verifyReplacementRuntimeAggregate(
  { receiptSet, proposal, evidence },
  { context, workflowSha256 }
) {
  requireReadyReplacementRuntimePlan(context.plan, context.map, context);
  validateAggregateCi(receiptSet.ci, workflowSha256);
  exactKeys(
    evidence,
    [
      'predicateType',
      'migrationMapSha256',
      'runtimePlanSha256',
      'receiptSetSha256',
      'proposalSha256',
      'receipts',
    ],
    'replacement evidence predicate'
  );
  if (
    evidence.predicateType !==
      'https://dsh-themes.com/attestations/plugin-alpha2-replacement-runtime-evidence/v1' ||
    evidence.migrationMapSha256 !== context.migrationMapSha256 ||
    evidence.runtimePlanSha256 !== context.planSha256 ||
    evidence.receiptSetSha256 !==
      sha256(Buffer.from(canonicalReplacementRuntimeJson(receiptSet))) ||
    evidence.proposalSha256 !==
      sha256(Buffer.from(canonicalReplacementRuntimeJson(proposal))) ||
    !Array.isArray(evidence.receipts) ||
    evidence.receipts.length > MAX_RECEIPTS
  ) {
    fail('replacement evidence predicate digest or authority mismatch');
  }
  const rebuilt = aggregateReplacementRuntimeReceipts(evidence.receipts, {
    context,
    workflowSha256,
    aggregateCi: receiptSet.ci,
  });
  if (
    !rebuilt.receiptSetBytes.equals(
      Buffer.from(canonicalReplacementRuntimeJson(receiptSet))
    ) ||
    !rebuilt.proposalBytes.equals(Buffer.from(canonicalReplacementRuntimeJson(proposal))) ||
    !rebuilt.evidenceBytes.equals(Buffer.from(canonicalReplacementRuntimeJson(evidence)))
  ) {
    fail('replacement aggregate is not canonical or reproducible');
  }
  validateReplacementAllocationProposal(proposal, receiptSet, context);
  return { receiptSet, proposal, evidence };
}

export async function bindReplacementRuntimeCustomAttestationPredicate({
  bundle,
  predicate,
}) {
  if (![bundle, predicate].every(isAbsolute)) {
    fail('replacement custom attestation paths must be absolute');
  }
  const [bundleRecord, predicateRecord] = await Promise.all([
    readBoundedRegularFile(bundle, MAX_SIGSTORE_BUNDLE_BYTES),
    readBoundedRegularFile(predicate, MAX_EVIDENCE_BYTES),
  ]);
  let document;
  let localPredicate;
  try {
    document = JSON.parse(bundleRecord.bytes);
    localPredicate = JSON.parse(predicateRecord.bytes);
  } catch {
    fail('replacement custom attestation bundle or predicate is not JSON');
  }
  if (
    !Buffer.from(canonicalReplacementRuntimeJson(localPredicate)).equals(
      predicateRecord.bytes
    )
  ) {
    fail('replacement custom attestation predicate is not canonical JSON');
  }
  const payload = document?.dsseEnvelope?.payload;
  if (
    document?.dsseEnvelope?.payloadType !== 'application/vnd.in-toto+json' ||
    typeof payload !== 'string' ||
    payload.length < 4 ||
    payload.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]+={0,2}$/u.test(payload)
  ) {
    fail('replacement custom attestation lacks one strict in-toto DSSE payload');
  }
  const statementBytes = Buffer.from(payload, 'base64');
  if (statementBytes.toString('base64') !== payload) {
    fail('replacement custom attestation payload is not canonical base64');
  }
  let statement;
  try {
    statement = JSON.parse(statementBytes);
  } catch {
    fail('replacement custom attestation statement is not JSON');
  }
  if (
    statement?._type !== 'https://in-toto.io/Statement/v1' ||
    statement.predicateType !==
      'https://dsh-themes.com/attestations/plugin-alpha2-replacement-runtime-evidence/v1' ||
    statement.predicate === null ||
    typeof statement.predicate !== 'object' ||
    Array.isArray(statement.predicate) ||
    canonicalReplacementRuntimeJson(statement.predicate) !==
      predicateRecord.bytes.toString('utf8')
  ) {
    fail('signed replacement predicate does not match the verified local evidence bytes');
  }
  return {
    status: 'replacement-custom-predicate-byte-bound',
    predicateSha256: sha256(predicateRecord.bytes),
  };
}

async function readBoundedRegularFile(path, maximumBytes) {
  const flags = constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0);
  const handle = await open(path, flags);
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.nlink !== 1 || stat.size < 1 || stat.size > maximumBytes) {
      fail('replacement evidence file is not one bounded single-link regular file');
    }
    const bytes = Buffer.alloc(stat.size);
    let offset = 0;
    while (offset < bytes.length) {
      const { bytesRead } = await handle.read(bytes, offset, bytes.length - offset, offset);
      if (bytesRead === 0) fail('replacement evidence file changed while reading');
      offset += bytesRead;
    }
    const after = await handle.stat();
    if (after.size !== stat.size || after.mtimeMs !== stat.mtimeMs) {
      fail('replacement evidence file changed while reading');
    }
    return { bytes, stat };
  } finally {
    await handle.close();
  }
}

async function collectReceiptFiles(inputRoot) {
  const root = await realpath(inputRoot);
  const files = [];
  async function visit(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const path = join(directory, entry.name);
      if (entry.isSymbolicLink()) fail('replacement receipt input contains a symlink');
      if (entry.isDirectory()) {
        await visit(path);
      } else if (entry.isFile()) {
        if (!entry.name.endsWith('.json')) fail('replacement receipt input contains a non-JSON file');
        const resolved = await realpath(path);
        const rel = relative(root, resolved);
        if (rel.startsWith(`..${sep}`) || rel === '..' || isAbsolute(rel)) {
          fail('replacement receipt input escapes its aggregate root');
        }
        files.push(resolved);
        if (files.length > MAX_RECEIPTS) fail('replacement receipt input exceeds 264 files');
      } else {
        fail('replacement receipt input contains a special filesystem entry');
      }
    }
  }
  await visit(root);
  return files.sort();
}

async function loadReceiptDirectory(inputRoot) {
  const receipts = [];
  for (const path of await collectReceiptFiles(inputRoot)) {
    const { bytes } = await readBoundedRegularFile(path, MAX_RECEIPT_BYTES);
    let receipt;
    try {
      receipt = JSON.parse(bytes);
    } catch {
      fail('replacement receipt input is not strict JSON');
    }
    const expectedName = `${receipt?.candidate?.candidateToken}-${tupleKey(receipt?.task ?? {})}.json`;
    if (basename(path) !== expectedName) {
      fail('replacement receipt filename does not match its candidate token and tuple');
    }
    receipts.push(receipt);
  }
  return receipts;
}

async function writeNewPrivateFile(path, bytes) {
  const handle = await open(path, 'wx', 0o600);
  try {
    await handle.writeFile(bytes);
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function createAggregateDirectory(output, aggregate) {
  const parent = await realpath(dirname(output));
  const expected = join(parent, basename(output));
  if (expected !== output) fail('replacement aggregate output must use one real existing parent');
  await mkdir(output, { recursive: false, mode: 0o700 });
  await Promise.all([
    writeNewPrivateFile(
      join(output, 'replacement-runtime-receipt-set.json'),
      aggregate.receiptSetBytes
    ),
    writeNewPrivateFile(
      join(output, 'replacement-id-allocation-proposal.json'),
      aggregate.proposalBytes
    ),
    writeNewPrivateFile(
      join(output, 'replacement-runtime-evidence-predicate.json'),
      aggregate.evidenceBytes
    ),
  ]);
}

async function loadAggregateDirectory(candidateRoot) {
  const root = await realpath(candidateRoot);
  const entries = await readdir(root, { withFileTypes: true });
  const expected = [
    'replacement-id-allocation-proposal.json',
    'replacement-runtime-evidence-predicate.json',
    'replacement-runtime-receipt-set.json',
  ];
  if (
    entries.some((entry) => !entry.isFile() || entry.isSymbolicLink()) ||
    JSON.stringify(entries.map((entry) => entry.name).sort()) !== JSON.stringify(expected)
  ) {
    fail('replacement aggregate directory must contain exactly three regular JSON files');
  }
  const values = {};
  for (const name of expected) {
    const maximum = name.includes('evidence') ? MAX_EVIDENCE_BYTES : MAX_RECEIPT_BYTES;
    const { bytes } = await readBoundedRegularFile(join(root, name), maximum);
    const canonicalName = name.replace('.json', '');
    try {
      values[canonicalName] = JSON.parse(bytes);
    } catch {
      fail('replacement aggregate file is not strict JSON');
    }
    if (!Buffer.from(canonicalReplacementRuntimeJson(values[canonicalName])).equals(bytes)) {
      fail('replacement aggregate file is not canonical JSON');
    }
  }
  return {
    receiptSet: values['replacement-runtime-receipt-set'],
    proposal: values['replacement-id-allocation-proposal'],
    evidence: values['replacement-runtime-evidence-predicate'],
  };
}

async function hashArtifact(path, maximumBytes = 1024 * 1024 * 1024) {
  const flags = constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0);
  const handle = await open(path, flags);
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.nlink !== 1 || stat.size < 1 || stat.size > maximumBytes) {
      fail('replacement artifact is not one bounded single-link regular file');
    }
    const hash = createHash('sha256');
    const chunk = Buffer.alloc(1024 * 1024);
    let offset = 0;
    while (offset < stat.size) {
      const length = Math.min(chunk.length, stat.size - offset);
      const { bytesRead } = await handle.read(chunk, 0, length, offset);
      if (bytesRead === 0) fail('replacement artifact changed while hashing');
      hash.update(chunk.subarray(0, bytesRead));
      offset += bytesRead;
    }
    const after = await handle.stat();
    if (after.size !== stat.size || after.mtimeMs !== stat.mtimeMs) {
      fail('replacement artifact changed while hashing');
    }
    return { bytes: stat.size, sha256: hash.digest('hex') };
  } finally {
    await handle.close();
  }
}

function gitIdentity(checkout) {
  const result = spawnSync('git', ['-C', checkout, 'rev-parse', 'HEAD', 'HEAD^{tree}'], {
    encoding: 'utf8',
    env: {
      PATH: process.env.PATH,
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_CONFIG_GLOBAL: process.platform === 'win32' ? 'NUL' : '/dev/null',
      GIT_TERMINAL_PROMPT: '0',
      GIT_OPTIONAL_LOCKS: '0',
    },
    shell: false,
    timeout: 30_000,
    windowsHide: true,
  });
  const lines = result.stdout?.trim().split(/\r?\n/u) ?? [];
  if (result.error || result.status !== 0 || result.stderr?.trim() !== '' || lines.length !== 2) {
    fail('replacement candidate checkout identity could not be verified');
  }
  return { commit: lines[0], tree: lines[1] };
}

function parseOptions(argv, allowed) {
  const values = {};
  if (argv.length !== allowed.size * 2) fail('replacement certification argument count mismatch');
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!allowed.has(key) || value === undefined || values[key] !== undefined) {
      fail('invalid or duplicate replacement certification argument');
    }
    values[key] = value;
  }
  return values;
}

async function sealCommand(argv) {
  const values = parseOptions(
    argv,
    new Set([
      '--artifact',
      '--candidate-source',
      '--evidence',
      '--output',
      '--workflow',
      '--candidate-key',
      '--tuple',
    ])
  );
  for (const key of ['--artifact', '--candidate-source', '--evidence', '--output', '--workflow']) {
    if (!isAbsolute(values[key])) fail('replacement seal paths must be absolute');
  }
  const context = await loadReplacementRuntimePlan();
  requireReadyReplacementRuntimePlan(context.plan, context.map, context);
  const candidate = context.plan.candidates.find(
    (entry) => entry.candidateKey === values['--candidate-key']
  );
  if (candidate === undefined) fail('replacement seal candidate key is outside the plan');
  const tuple = REPLACEMENT_RUNTIME_TUPLES.find(
    (entry) => entry.tuple === values['--tuple']
  );
  if (tuple === undefined) fail('replacement seal tuple is outside the six-task matrix');
  const task = {
    ...tuple,
    batchId: expectedBatchId(candidate.rank),
    candidateToken: candidate.candidateToken,
  };
  const [workflowBytes, evidenceFile, artifactIdentity] = await Promise.all([
    readFile(values['--workflow']),
    readBoundedRegularFile(values['--evidence'], MAX_RECEIPT_BYTES),
    hashArtifact(values['--artifact']),
  ]);
  if (
    artifactIdentity.bytes !== candidate.runtimeInput.artifact.bytes ||
    artifactIdentity.sha256 !== candidate.runtimeInput.artifact.sha256
  ) {
    fail('replacement runtime artifact bytes drifted from the ready plan');
  }
  const checkout = await realpath(values['--candidate-source']);
  const identity = gitIdentity(checkout);
  if (identity.commit !== candidate.source.commit || identity.tree !== candidate.source.tree) {
    fail('replacement candidate checkout drifted from the exact commit and tree');
  }
  let stages;
  try {
    stages = JSON.parse(evidenceFile.bytes);
  } catch {
    fail('replacement fixed executor evidence is not strict JSON');
  }
  const workflowSha256 = sha256(workflowBytes);
  const ci = validateReplacementRuntimeGithubIdentity(process.env, task, workflowSha256);
  const receipt = buildReplacementRuntimeReceipt({ context, candidate, task, stages, ci });
  const output = resolve(values['--output']);
  const parent = await realpath(dirname(output));
  if (join(parent, basename(output)) !== output) fail('replacement seal output parent mismatch');
  await writeNewPrivateFile(output, Buffer.from(canonicalReplacementRuntimeJson(receipt)));
}

async function aggregateCommand(argv) {
  const values = parseOptions(
    argv,
    new Set(['--input', '--output', '--workflow'])
  );
  for (const key of ['--input', '--output', '--workflow']) {
    if (!isAbsolute(values[key])) fail('replacement aggregate paths must be absolute');
  }
  const [context, workflowBytes, receipts] = await Promise.all([
    loadReplacementRuntimePlan(),
    readFile(values['--workflow']),
    loadReceiptDirectory(values['--input']),
  ]);
  const workflowSha256 = sha256(workflowBytes);
  const aggregateCi = replacementAggregateGithubIdentity(process.env, workflowSha256);
  const aggregate = aggregateReplacementRuntimeReceipts(receipts, {
    context,
    workflowSha256,
    aggregateCi,
  });
  await createAggregateDirectory(resolve(values['--output']), aggregate);
}

async function verifyCommand(argv) {
  const values = parseOptions(argv, new Set(['--candidate', '--workflow']));
  for (const key of ['--candidate', '--workflow']) {
    if (!isAbsolute(values[key])) fail('replacement verify paths must be absolute');
  }
  const [context, workflowBytes, aggregate] = await Promise.all([
    loadReplacementRuntimePlan(),
    readFile(values['--workflow']),
    loadAggregateDirectory(values['--candidate']),
  ]);
  validateCurrentAggregateRun(process.env, aggregate.receiptSet.ci);
  verifyReplacementRuntimeAggregate(aggregate, {
    context,
    workflowSha256: sha256(workflowBytes),
  });
}

async function verifyCustomBundleCommand(argv) {
  const values = parseOptions(argv, new Set(['--bundle', '--predicate']));
  await bindReplacementRuntimeCustomAttestationPredicate({
    bundle: values['--bundle'],
    predicate: values['--predicate'],
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const command = process.argv[2];
    if (command === 'seal') await sealCommand(process.argv.slice(3));
    else if (command === 'aggregate') await aggregateCommand(process.argv.slice(3));
    else if (command === 'verify') await verifyCommand(process.argv.slice(3));
    else if (command === 'verify-custom-bundle') {
      await verifyCustomBundleCommand(process.argv.slice(3));
    }
    else {
      fail(
        'usage: plugin-replacement-runtime-certification.mjs ' +
          'seal|aggregate|verify|verify-custom-bundle <closed arguments>'
      );
    }
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
