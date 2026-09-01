#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { lstat, readFile, readdir } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ALPHA2_HARNESS_AUTHORITY_SHA256,
  ALPHA2_RECERTIFICATION_SHA256,
  COMMUNITY_CATALOG_SHA256,
  loadAlpha2RecertificationAuthority,
} from './alpha2-recertification-authority.mjs';

const SHA40 = /^[a-f0-9]{40}$/u;
const SHA256 = /^[a-f0-9]{64}$/u;
const REASON_CODE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const MAX_JSON_BYTES = 1024 * 1024;
const MAX_SCAN_FILES = 100;
const REPOSITORY = 'LvvUP/dsh-themes-skills';
const WORKFLOW = 'alpha2-community-skin-certification';
const SKIN_CENTER_COHORT_ID = 'skin-center-builtin-0.2.5';
const INDEPENDENT_BUNDLED_BYTES = Object.freeze({
  2206: 39_539,
  2207: 35_797,
});
const LIFECYCLE_PHASES = Object.freeze([
  'preflight',
  'snapshot',
  'install',
  'dumpConfig',
  'coldRestart',
  'functionalProbe',
  'removal',
]);

export const COMMUNITY_CERTIFICATION_TUPLES = Object.freeze([
  Object.freeze({ platform: 'darwin', arch: 'arm64', nodeVersion: '22.19.0' }),
  Object.freeze({ platform: 'darwin', arch: 'arm64', nodeVersion: '24.15.0' }),
  Object.freeze({ platform: 'linux', arch: 'x64', nodeVersion: '22.19.0' }),
  Object.freeze({ platform: 'linux', arch: 'x64', nodeVersion: '24.15.0' }),
  Object.freeze({ platform: 'win32', arch: 'x64', nodeVersion: '22.19.0' }),
  Object.freeze({ platform: 'win32', arch: 'x64', nodeVersion: '24.15.0' }),
]);

export const SKIN_CENTER_COHORT_IDS = Object.freeze([
  2101,
  2201,
  2202,
  2203,
  2204,
  2205,
  2208,
  2209,
  2210,
]);

export const INDEPENDENT_COMMUNITY_IDS = Object.freeze([2206, 2207]);

const BASELINE = Object.freeze({
  baselineId:
    'deepseek-harness/dsh-v0.1.2-alpha.2@0a53fb55bea101816fa226bb964ae2bed71c343b',
  packageVersion: '0.1.2-alpha.2',
  tag: 'dsh-v0.1.2-alpha.2',
  commit: '0a53fb55bea101816fa226bb964ae2bed71c343b',
  tree: '64ccbfa8e0caa4711cd4a75717ef9e022657961b',
  officialNpmTarballSha256:
    '5bf062a26a490853ffb9294fe3c9fb2047f029be3545612dea45718a81920a47',
});

const AUTHORITY = Object.freeze({
  currentGateSha256: ALPHA2_RECERTIFICATION_SHA256,
  catalogSha256: COMMUNITY_CATALOG_SHA256,
  harnessAuthoritySha256: ALPHA2_HARNESS_AUTHORITY_SHA256,
});

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
  const expected = [...keys].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
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

export function canonicalCommunityCertificationJson(value) {
  return `${JSON.stringify(stable(value))}\n`;
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function exactObject(actual, expected, label) {
  if (
    canonicalCommunityCertificationJson(actual) !==
    canonicalCommunityCertificationJson(expected)
  ) {
    fail(`${label} differs from the frozen certification plan`);
  }
}

function tupleName(tuple) {
  return `${tuple.platform}-${tuple.arch}-node-${tuple.nodeVersion}`;
}

function itemArtifact(skin, catalog) {
  if (skin.installationMode === 'skin-center-builtin') {
    return {
      kind: 'skin-center-shared-npm-tarball',
      locator: `${catalog.skinCenter.packageName}@${catalog.skinCenter.version}`,
      bytes: catalog.skinCenter.sizeBytes,
      sha256: catalog.skinCenter.sha256,
    };
  }
  const bytes = INDEPENDENT_BUNDLED_BYTES[skin.catalogId];
  if (!Number.isSafeInteger(bytes) || !skin.bundledAssetAuthority) {
    fail(`community item #${skin.catalogId} lacks a frozen bundled artifact`);
  }
  return {
    kind: 'bundled-user-skin',
    locator: `bundled:${skin.skinId}:${skin.adaptation}`,
    bytes,
    sha256: skin.bundledAssetAuthority.sourceSha256,
  };
}

function planItem(skin, catalog) {
  return {
    catalogId: skin.catalogId,
    slug: skin.slug,
    skinId: skin.skinId,
    installationMode: skin.installationMode,
    sourceRepository: skin.sourceRepository,
    sourceRevision: skin.sourceRevision,
    sourceSubdir: skin.sourceSubdir,
    cohortId:
      skin.installationMode === 'skin-center-builtin'
        ? SKIN_CENTER_COHORT_ID
        : `independent-${skin.catalogId}`,
    artifact: itemArtifact(skin, catalog),
  };
}

function verifyCatalogPartition(items) {
  const skinCenterIds = items
    .filter((item) => item.installationMode === 'skin-center-builtin')
    .map((item) => item.catalogId);
  const independentIds = items
    .filter((item) => item.installationMode === 'bundled-user-skin')
    .map((item) => item.catalogId);
  exactObject(skinCenterIds, SKIN_CENTER_COHORT_IDS, 'Skin Center cohort IDs');
  exactObject(independentIds, INDEPENDENT_COMMUNITY_IDS, 'independent item IDs');
}

export function buildCommunityCertificationPlan({ authority, catalog }) {
  if (authority?.gate?.status !== 'alpha2-item-runtime-evidence-pending') {
    fail('current community gate is not the frozen alpha.2 pending authority');
  }
  if (
    authority?.gate?.reviewedItems !== 0 ||
    authority?.gate?.completedTasks !== 0 ||
    authority?.gate?.installableItems !== 0 ||
    authority?.gate?.installable !== false
  ) {
    fail('current community gate is not fail-closed at 0/66');
  }
  if (!Array.isArray(catalog?.skins) || catalog.skins.length !== 11) {
    fail('historical catalog must contain the exact 11 items');
  }
  const items = catalog.skins.map((skin) => planItem(skin, catalog));
  verifyCatalogPartition(items);
  const tasks = items.flatMap((item) =>
    COMMUNITY_CERTIFICATION_TUPLES.map((tuple) => ({
      taskId: `community-${item.catalogId}-${tupleName(tuple)}`,
      catalogId: item.catalogId,
      slug: item.slug,
      platform: tuple.platform,
      arch: tuple.arch,
      nodeVersion: tuple.nodeVersion,
    }))
  );
  if (tasks.length !== 66 || new Set(tasks.map((task) => task.taskId)).size !== 66) {
    fail('certification plan is not the exact 11 x 6 Cartesian product');
  }
  return {
    schemaVersion: 1,
    purpose: 'alpha2-community-skin-certification-plan',
    status: 'candidate-plan-executor-not-reviewed',
    authorityMutation: false,
    installability: 'none',
    authority: { ...AUTHORITY },
    baseline: { ...BASELINE },
    matrix: {
      requiredItems: 11,
      requiredTasksPerItem: 6,
      requiredTasks: 66,
      tuples: COMMUNITY_CERTIFICATION_TUPLES.map((tuple) => ({ ...tuple })),
    },
    cohorts: {
      skinCenterBuiltin: {
        cohortId: SKIN_CENTER_COHORT_ID,
        policy: 'all-nine-must-pass-before-shared-artifact-can-open',
        members: [...SKIN_CENTER_COHORT_IDS],
      },
      independentItems: {
        policy: 'item-level-task-outcome',
        members: [...INDEPENDENT_COMMUNITY_IDS],
      },
    },
    items,
    tasks,
  };
}

export async function loadCommunityCertificationContext() {
  const loaded = await loadAlpha2RecertificationAuthority();
  const plan = buildCommunityCertificationPlan({
    authority: loaded.authority,
    catalog: loaded.catalog,
  });
  return {
    ...loaded,
    plan,
    certificationPlanSha256: sha256(
      canonicalCommunityCertificationJson(plan)
    ),
  };
}

const ALLOWED_PRIVACY_KEYS = new Set([
  'capturesMachinePaths',
  'capturesTokens',
  'capturesCookies',
  'capturesCredentials',
  'capturesCorrelatableSecretDigests',
]);

function scanString(value, label) {
  if (
    /(?:^|["'\s])(\/Users\/|\/home\/|\/private\/|\/tmp\/|\/var\/|\/etc\/|\/opt\/|\/mnt\/|\/Volumes\/|\/Library\/|[A-Za-z]:[\\/]|\\\\[^\\])/u.test(
      value
    ) ||
    /(?:\$\{?HOME\}?|%USERPROFILE%|(?:^|\s)~[\\/]|file:\/\/)/iu.test(value)
  ) {
    fail(`${label} leaks a machine path`);
  }
  if (
    /(?:authorization|proxy-authorization|cookie|set-cookie)\s*:/iu.test(value) ||
    /\bbearer\s+[A-Za-z0-9._~+/-]{8,}/iu.test(value) ||
    /(?:token|password|credential|secret)\s*=/iu.test(value) ||
    /\b(?:sk-[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9_]{16,}|github_pat_[A-Za-z0-9_]{16,}|AKIA[A-Z0-9]{16})\b/u.test(
      value
    ) ||
    /\beyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{8,}\b/u.test(
      value
    )
  ) {
    fail(`${label} leaks token, cookie, or credential material`);
  }
  if (/^https?:\/\//iu.test(value)) {
    const parsed = new URL(value);
    if (parsed.username || parsed.password) {
      fail(`${label} leaks URL credentials`);
    }
  }
}

export function scanCommunityEvidenceValue(value, label = 'evidence') {
  let nodes = 0;
  function visit(current, currentLabel, depth) {
    nodes += 1;
    if (nodes > 20_000 || depth > 64) fail(`${label} exceeds scan bounds`);
    if (typeof current === 'string') {
      scanString(current, currentLabel);
      return;
    }
    if (Array.isArray(current)) {
      for (let index = 0; index < current.length; index += 1) {
        visit(current[index], `${currentLabel}[${index}]`, depth + 1);
      }
      return;
    }
    if (current === null || typeof current !== 'object') return;
    for (const [key, child] of Object.entries(current)) {
      if (ALLOWED_PRIVACY_KEYS.has(key) && child !== false) {
        fail(`${currentLabel}.${key} must remain false`);
      }
      if (
        /(?:token|cookie|credential|password|secret|authorization|machinepath|profilepath|homepath|absolute.*path)/iu.test(
          key
        ) &&
        !ALLOWED_PRIVACY_KEYS.has(key)
      ) {
        fail(`${currentLabel}.${key} is a forbidden sensitive or machine-path field`);
      }
      if (
        /(?:token|cookie|credential|secret).*(?:sha|hash|digest)|(?:sha|hash|digest).*(?:token|cookie|credential|secret)/iu.test(
          key
        ) &&
        key !== 'capturesCorrelatableSecretDigests'
      ) {
        fail(`${currentLabel}.${key} leaks a correlatable secret digest`);
      }
      if (
        /(?:profile|environment|machine|browser|session).*(?:sha|hash|digest)|(?:sha|hash|digest).*(?:profile|environment|machine|browser|session)/iu.test(
          key
        )
      ) {
        fail(`${currentLabel}.${key} leaks a correlatable runtime digest`);
      }
      visit(child, `${currentLabel}.${key}`, depth + 1);
    }
  }
  visit(value, label, 0);
  return { nodes };
}

function validateAuthorityAndBaseline(receipt, plan) {
  exactObject(receipt.authority, plan.authority, 'receipt authority');
  exactObject(receipt.baseline, plan.baseline, 'receipt baseline');
}

function validateRun(run, task) {
  exactKeys(
    run,
    [
      'repository',
      'workflow',
      'workflowSha256',
      'event',
      'ref',
      'runId',
      'runAttempt',
      'headSha',
      'jobIdentity',
    ],
    'receipt run'
  );
  if (
    run.repository !== REPOSITORY ||
    run.workflow !== WORKFLOW ||
    !SHA256.test(run.workflowSha256 ?? '') ||
    run.event !== 'workflow_dispatch' ||
    run.ref !== 'refs/heads/main' ||
    !/^[1-9]\d{0,19}$/u.test(run.runId ?? '') ||
    !Number.isSafeInteger(run.runAttempt) ||
    run.runAttempt < 1 ||
    run.runAttempt > 100 ||
    !SHA40.test(run.headSha ?? '') ||
    run.jobIdentity !== task.taskId
  ) {
    fail('receipt run identity is not one exact main certification job');
  }
}

function validateStage(stage, label) {
  exactKeys(stage, ['status', 'sanitizedEvidenceSha256'], label);
  if (!['passed', 'failed', 'not-run-after-terminal-failure'].includes(stage.status)) {
    fail(`${label} has an invalid status`);
  }
  if (stage.status === 'not-run-after-terminal-failure') {
    if (stage.sanitizedEvidenceSha256 !== null) {
      fail(`${label} skipped stage cannot carry evidence`);
    }
  } else if (!SHA256.test(stage.sanitizedEvidenceSha256 ?? '')) {
    fail(`${label} lacks sanitized terminal evidence`);
  }
}

function validateLifecycle(lifecycle, receiptStatus) {
  exactKeys(
    lifecycle,
    [...LIFECYCLE_PHASES, 'rollback', 'terminalFailure'],
    'receipt lifecycle'
  );
  for (const phase of LIFECYCLE_PHASES) {
    validateStage(lifecycle[phase], `lifecycle.${phase}`);
  }
  exactKeys(
    lifecycle.rollback,
    [
      'status',
      'fullProfileRestored',
      'dependencyClosureRestored',
      'noWritesOutsideIsolatedRoots',
      'sidecarsTerminated',
      'sanitizedEvidenceSha256',
    ],
    'lifecycle.rollback'
  );
  if (
    lifecycle.rollback.status !== 'passed' ||
    lifecycle.rollback.fullProfileRestored !== true ||
    lifecycle.rollback.dependencyClosureRestored !== true ||
    lifecycle.rollback.noWritesOutsideIsolatedRoots !== true ||
    lifecycle.rollback.sidecarsTerminated !== true ||
    !SHA256.test(lifecycle.rollback.sanitizedEvidenceSha256 ?? '')
  ) {
    fail('rollback did not restore the complete isolated state');
  }

  if (receiptStatus === 'community-alpha2-task-passed') {
    if (
      LIFECYCLE_PHASES.some((phase) => lifecycle[phase].status !== 'passed') ||
      lifecycle.terminalFailure !== null
    ) {
      fail('passed task must have every lifecycle stage passed');
    }
    return;
  }

  const terminal = object(lifecycle.terminalFailure, 'lifecycle.terminalFailure');
  exactKeys(
    terminal,
    ['phase', 'reasonCode', 'sanitizedEvidenceSha256'],
    'lifecycle.terminalFailure'
  );
  const failureIndex = LIFECYCLE_PHASES.indexOf(terminal.phase);
  if (
    failureIndex < 0 ||
    !REASON_CODE.test(terminal.reasonCode ?? '') ||
    !SHA256.test(terminal.sanitizedEvidenceSha256 ?? '')
  ) {
    fail('failed task lacks valid terminal failure evidence');
  }
  for (let index = 0; index < LIFECYCLE_PHASES.length; index += 1) {
    const phase = LIFECYCLE_PHASES[index];
    const expected =
      index < failureIndex
        ? 'passed'
        : index === failureIndex
          ? 'failed'
          : 'not-run-after-terminal-failure';
    if (lifecycle[phase].status !== expected) {
      fail('failed task lifecycle is not one terminal state transition');
    }
  }
  if (
    lifecycle[terminal.phase].sanitizedEvidenceSha256 !==
    terminal.sanitizedEvidenceSha256
  ) {
    fail('terminal failure digest does not match the failed stage evidence');
  }
}

function validatePrivacy(privacy) {
  exactKeys(privacy, [...ALLOWED_PRIVACY_KEYS], 'receipt privacy');
  if (Object.values(privacy).some((value) => value !== false)) {
    fail('receipt privacy boundary is not closed');
  }
}

export function validateCommunityTaskReceipt(
  receipt,
  { plan, certificationPlanSha256, expectedTaskId } = {}
) {
  exactKeys(
    receipt,
    [
      'schemaVersion',
      'status',
      'scope',
      'certificationPlanSha256',
      'authority',
      'baseline',
      'item',
      'task',
      'observedRuntime',
      'lifecycle',
      'run',
      'privacy',
    ],
    'community task receipt'
  );
  if (
    receipt.schemaVersion !== 1 ||
    ![
      'community-alpha2-task-passed',
      'community-alpha2-task-failed',
    ].includes(receipt.status) ||
    receipt.scope !== 'one-community-skin-one-platform-node-task'
  ) {
    fail('community task receipt header mismatch');
  }
  const resolvedPlan = object(plan, 'certification plan');
  const resolvedPlanSha256 =
    certificationPlanSha256 ??
    sha256(canonicalCommunityCertificationJson(resolvedPlan));
  if (
    !SHA256.test(receipt.certificationPlanSha256 ?? '') ||
    receipt.certificationPlanSha256 !== resolvedPlanSha256
  ) {
    fail('receipt mixes a different certification plan or gate identity');
  }
  validateAuthorityAndBaseline(receipt, resolvedPlan);
  const expectedTask = resolvedPlan.tasks.find(
    (task) => task.taskId === receipt.task?.taskId
  );
  if (!expectedTask || (expectedTaskId && expectedTask.taskId !== expectedTaskId)) {
    fail('receipt task is outside the fixed 66-task plan');
  }
  exactKeys(
    receipt.task,
    ['taskId', 'platform', 'arch', 'nodeVersion'],
    'receipt task'
  );
  exactObject(receipt.task, {
    taskId: expectedTask.taskId,
    platform: expectedTask.platform,
    arch: expectedTask.arch,
    nodeVersion: expectedTask.nodeVersion,
  }, 'receipt task tuple');
  const expectedItem = resolvedPlan.items.find(
    (item) => item.catalogId === expectedTask.catalogId
  );
  exactObject(receipt.item, expectedItem, 'receipt item source and artifact identity');
  exactKeys(
    receipt.observedRuntime,
    ['platform', 'arch', 'nodeVersion'],
    'observed runtime'
  );
  exactObject(
    receipt.observedRuntime,
    {
      platform: expectedTask.platform,
      arch: expectedTask.arch,
      nodeVersion: expectedTask.nodeVersion,
    },
    'observed runtime tuple'
  );
  validateLifecycle(receipt.lifecycle, receipt.status);
  validateRun(receipt.run, expectedTask);
  validatePrivacy(receipt.privacy);
  scanCommunityEvidenceValue(receipt, 'community task receipt');
  return receipt;
}

function commonRun(run) {
  const { jobIdentity: _jobIdentity, ...shared } = run;
  return shared;
}

function validateSharedRun(run) {
  exactKeys(
    run,
    [
      'repository',
      'workflow',
      'workflowSha256',
      'event',
      'ref',
      'runId',
      'runAttempt',
      'headSha',
    ],
    'candidate run'
  );
  if (
    run.repository !== REPOSITORY ||
    run.workflow !== WORKFLOW ||
    !SHA256.test(run.workflowSha256 ?? '') ||
    run.event !== 'workflow_dispatch' ||
    run.ref !== 'refs/heads/main' ||
    !/^[1-9]\d{0,19}$/u.test(run.runId ?? '') ||
    !Number.isSafeInteger(run.runAttempt) ||
    run.runAttempt < 1 ||
    run.runAttempt > 100 ||
    !SHA40.test(run.headSha ?? '')
  ) {
    fail('candidate run identity is malformed or mixed');
  }
}

function itemCandidate({ plan, taskEntries, sharedRun, cohortPassed, item }) {
  const passedTasks = taskEntries.filter(
    ({ receipt }) => receipt.status === 'community-alpha2-task-passed'
  ).length;
  const taskOutcomePassed = passedTasks === 6;
  let candidateDisposition;
  if (!taskOutcomePassed) candidateDisposition = 'ineligible-task-failure';
  else if (
    item.installationMode === 'skin-center-builtin' &&
    !cohortPassed
  ) {
    candidateDisposition = 'ineligible-cohort-blocked';
  } else candidateDisposition = 'eligible-awaiting-review';
  const candidate = {
    schemaVersion: 1,
    status: taskOutcomePassed
      ? 'community-alpha2-item-candidate-passed'
      : 'community-alpha2-item-candidate-failed',
    scope: 'one-community-skin-six-task-candidate',
    reviewStatus: 'pending-review',
    authorityMutation: false,
    installability: 'none',
    certificationPlanSha256: sha256(
      canonicalCommunityCertificationJson(plan)
    ),
    authority: { ...plan.authority },
    baseline: { ...plan.baseline },
    run: { ...sharedRun },
    item: structuredClone(item),
    gate: {
      requiredTasks: 6,
      completedTasks: 6,
      passedTasks,
      failedTasks: 6 - passedTasks,
      rollbackVerifiedTasks: 6,
      taskOutcomePassed,
    },
    tasks: taskEntries.map(({ receipt, receiptSha256 }) => ({
      taskId: receipt.task.taskId,
      tuple: tupleName(receipt.task),
      status: receipt.status,
      terminalReason: receipt.lifecycle.terminalFailure?.reasonCode ?? null,
      receiptSha256,
    })),
    candidateDisposition,
  };
  validateCommunityItemCandidate(candidate, { plan, cohortPassed });
  return candidate;
}

export function validateCommunityItemCandidate(
  candidate,
  { plan, cohortPassed }
) {
  exactKeys(
    candidate,
    [
      'schemaVersion',
      'status',
      'scope',
      'reviewStatus',
      'authorityMutation',
      'installability',
      'certificationPlanSha256',
      'authority',
      'baseline',
      'run',
      'item',
      'gate',
      'tasks',
      'candidateDisposition',
    ],
    'community item candidate'
  );
  if (
    candidate.schemaVersion !== 1 ||
    candidate.scope !== 'one-community-skin-six-task-candidate' ||
    candidate.reviewStatus !== 'pending-review' ||
    candidate.authorityMutation !== false ||
    candidate.installability !== 'none'
  ) {
    fail('item candidate exceeds its non-authoritative boundary');
  }
  const expectedItem = plan.items.find(
    (item) => item.catalogId === candidate.item?.catalogId
  );
  if (!expectedItem) fail('item candidate is outside the fixed plan');
  exactObject(candidate.item, expectedItem, 'item candidate identity');
  exactObject(candidate.authority, plan.authority, 'item candidate authority');
  exactObject(candidate.baseline, plan.baseline, 'item candidate baseline');
  validateSharedRun(candidate.run);
  if (
    candidate.certificationPlanSha256 !==
    sha256(canonicalCommunityCertificationJson(plan))
  ) {
    fail('item candidate plan digest mismatch');
  }
  exactKeys(
    candidate.gate,
    [
      'requiredTasks',
      'completedTasks',
      'passedTasks',
      'failedTasks',
      'rollbackVerifiedTasks',
      'taskOutcomePassed',
    ],
    'item candidate gate'
  );
  const expectedTasks = plan.tasks.filter(
    (task) => task.catalogId === expectedItem.catalogId
  );
  if (
    candidate.gate.requiredTasks !== 6 ||
    candidate.gate.completedTasks !== 6 ||
    candidate.gate.rollbackVerifiedTasks !== 6 ||
    candidate.gate.passedTasks + candidate.gate.failedTasks !== 6 ||
    candidate.gate.taskOutcomePassed !== (candidate.gate.passedTasks === 6) ||
    !Array.isArray(candidate.tasks) ||
    candidate.tasks.length !== 6 ||
    new Set(candidate.tasks.map((task) => task.taskId)).size !== 6
  ) {
    fail('item candidate is not one complete six-task receipt set');
  }
  let countedPassed = 0;
  for (let index = 0; index < expectedTasks.length; index += 1) {
    const task = candidate.tasks[index];
    const expectedTask = expectedTasks[index];
    exactKeys(
      task,
      ['taskId', 'tuple', 'status', 'terminalReason', 'receiptSha256'],
      'item task summary'
    );
    if (
      task.taskId !== expectedTask.taskId ||
      task.tuple !== tupleName(expectedTask) ||
      ![
        'community-alpha2-task-passed',
        'community-alpha2-task-failed',
      ].includes(task.status) ||
      !SHA256.test(task.receiptSha256 ?? '') ||
      (task.status === 'community-alpha2-task-passed'
        ? task.terminalReason !== null
        : !REASON_CODE.test(task.terminalReason ?? ''))
    ) {
      fail('item task summary differs from the fixed tuple or terminal outcome');
    }
    if (task.status === 'community-alpha2-task-passed') countedPassed += 1;
  }
  if (
    countedPassed !== candidate.gate.passedTasks ||
    6 - countedPassed !== candidate.gate.failedTasks
  ) {
    fail('item gate counts do not match its task summaries');
  }
  const ownPassed = candidate.gate.taskOutcomePassed;
  const expectedStatus = ownPassed
    ? 'community-alpha2-item-candidate-passed'
    : 'community-alpha2-item-candidate-failed';
  const expectedDisposition = !ownPassed
    ? 'ineligible-task-failure'
    : expectedItem.installationMode === 'skin-center-builtin' && !cohortPassed
      ? 'ineligible-cohort-blocked'
      : 'eligible-awaiting-review';
  if (
    candidate.status !== expectedStatus ||
    candidate.candidateDisposition !== expectedDisposition
  ) {
    fail('item candidate disposition violates task or cohort outcome');
  }
  return candidate;
}

export function aggregateCommunityCertification(
  receipts,
  { plan, certificationPlanSha256 } = {}
) {
  if (!Array.isArray(receipts)) fail('aggregate receipts must be an array');
  if (receipts.length !== 66) {
    fail('aggregate requires exactly 66 task receipts');
  }
  const planSha256 =
    certificationPlanSha256 ?? sha256(canonicalCommunityCertificationJson(plan));
  const expectedIds = new Set(plan.tasks.map((task) => task.taskId));
  const receiptByTask = new Map();
  let sharedRun;
  for (const receipt of receipts) {
    validateCommunityTaskReceipt(receipt, {
      plan,
      certificationPlanSha256: planSha256,
    });
    const taskId = receipt.task.taskId;
    if (receiptByTask.has(taskId)) fail(`duplicate task tuple ${taskId}`);
    const run = commonRun(receipt.run);
    if (sharedRun === undefined) sharedRun = run;
    else exactObject(run, sharedRun, 'aggregate run identity');
    receiptByTask.set(taskId, {
      receipt,
      receiptSha256: sha256(canonicalCommunityCertificationJson(receipt)),
    });
  }
  const missing = [...expectedIds].filter((taskId) => !receiptByTask.has(taskId));
  if (missing.length > 0 || receiptByTask.size !== expectedIds.size) {
    fail(`aggregate is missing fixed task tuple ${missing[0] ?? '<unknown>'}`);
  }
  const entriesByItem = new Map(
    plan.items.map((item) => [
      item.catalogId,
      plan.tasks
        .filter((task) => task.catalogId === item.catalogId)
        .map((task) => receiptByTask.get(task.taskId)),
    ])
  );
  const skinCenterPassed = SKIN_CENTER_COHORT_IDS.every((catalogId) =>
    entriesByItem
      .get(catalogId)
      .every(
        ({ receipt }) => receipt.status === 'community-alpha2-task-passed'
      )
  );
  const items = plan.items.map((item) =>
    itemCandidate({
      plan,
      taskEntries: entriesByItem.get(item.catalogId),
      sharedRun,
      cohortPassed: skinCenterPassed,
      item,
    })
  );
  const passedTasks = receipts.filter(
    (receipt) => receipt.status === 'community-alpha2-task-passed'
  ).length;
  const passedItems = items.filter(
    (item) => item.gate.taskOutcomePassed
  ).length;
  const receiptPayload = plan.tasks.map((task) => ({
    taskId: task.taskId,
    receiptSha256: receiptByTask.get(task.taskId).receiptSha256,
  }));
  const candidate = {
    schemaVersion: 1,
    status: 'community-alpha2-certification-candidate',
    scope: 'eleven-items-sixty-six-tasks',
    reviewStatus: 'pending-review',
    authorityMutation: false,
    installability: 'none',
    certificationPlanSha256: planSha256,
    authority: { ...plan.authority },
    baseline: { ...plan.baseline },
    run: { ...sharedRun },
    gate: {
      requiredItems: 11,
      completedItems: 11,
      passedItems,
      failedItems: 11 - passedItems,
      requiredTasks: 66,
      completedTasks: 66,
      passedTasks,
      failedTasks: 66 - passedTasks,
      rollbackVerifiedTasks: 66,
      cartesianProductComplete: true,
    },
    cohorts: {
      skinCenterBuiltin: {
        cohortId: SKIN_CENTER_COHORT_ID,
        requiredMembers: 9,
        members: [...SKIN_CENTER_COHORT_IDS],
        allMembersTaskPassed: skinCenterPassed,
        allMembersRollbackVerified: true,
        candidateEligible: skinCenterPassed,
      },
      independentItems: {
        requiredMembers: 2,
        members: INDEPENDENT_COMMUNITY_IDS.map((catalogId) => ({
          catalogId,
          candidateEligible:
            items.find((item) => item.item.catalogId === catalogId).gate
              .taskOutcomePassed,
        })),
      },
    },
    items,
    receiptSetPayloadSha256: sha256(
      canonicalCommunityCertificationJson(receiptPayload)
    ),
  };
  validateCommunityAggregateCandidate(candidate, { plan });
  return candidate;
}

export function validateCommunityAggregateCandidate(candidate, { plan }) {
  exactKeys(
    candidate,
    [
      'schemaVersion',
      'status',
      'scope',
      'reviewStatus',
      'authorityMutation',
      'installability',
      'certificationPlanSha256',
      'authority',
      'baseline',
      'run',
      'gate',
      'cohorts',
      'items',
      'receiptSetPayloadSha256',
    ],
    'community aggregate candidate'
  );
  if (
    candidate.schemaVersion !== 1 ||
    candidate.status !== 'community-alpha2-certification-candidate' ||
    candidate.scope !== 'eleven-items-sixty-six-tasks' ||
    candidate.reviewStatus !== 'pending-review' ||
    candidate.authorityMutation !== false ||
    candidate.installability !== 'none' ||
    candidate.certificationPlanSha256 !==
      sha256(canonicalCommunityCertificationJson(plan)) ||
    !SHA256.test(candidate.receiptSetPayloadSha256 ?? '')
  ) {
    fail('aggregate candidate exceeds its candidate-only boundary');
  }
  exactObject(candidate.authority, plan.authority, 'aggregate authority');
  exactObject(candidate.baseline, plan.baseline, 'aggregate baseline');
  validateSharedRun(candidate.run);
  exactKeys(
    candidate.gate,
    [
      'requiredItems',
      'completedItems',
      'passedItems',
      'failedItems',
      'requiredTasks',
      'completedTasks',
      'passedTasks',
      'failedTasks',
      'rollbackVerifiedTasks',
      'cartesianProductComplete',
    ],
    'aggregate gate'
  );
  if (
    candidate.gate.requiredItems !== 11 ||
    candidate.gate.completedItems !== 11 ||
    candidate.gate.requiredTasks !== 66 ||
    candidate.gate.completedTasks !== 66 ||
    candidate.gate.rollbackVerifiedTasks !== 66 ||
    candidate.gate.cartesianProductComplete !== true ||
    candidate.gate.passedItems + candidate.gate.failedItems !== 11 ||
    candidate.gate.passedTasks + candidate.gate.failedTasks !== 66 ||
    !Array.isArray(candidate.items) ||
    candidate.items.length !== 11
  ) {
    fail('aggregate candidate is not the complete 11 x 6 matrix');
  }
  const cohort = candidate.cohorts?.skinCenterBuiltin;
  exactKeys(
    candidate.cohorts,
    ['skinCenterBuiltin', 'independentItems'],
    'aggregate cohorts'
  );
  exactKeys(
    cohort,
    [
      'cohortId',
      'requiredMembers',
      'members',
      'allMembersTaskPassed',
      'allMembersRollbackVerified',
      'candidateEligible',
    ],
    'aggregate Skin Center cohort'
  );
  exactObject(cohort?.members, SKIN_CENTER_COHORT_IDS, 'aggregate Skin Center cohort');
  if (
    JSON.stringify(candidate.items.map((item) => item.item.catalogId)) !==
    JSON.stringify(plan.items.map((item) => item.catalogId))
  ) {
    fail('aggregate item order or identity differs from the fixed plan');
  }
  const expectedCohortPassed = candidate.items
    .filter((item) => SKIN_CENTER_COHORT_IDS.includes(item.item.catalogId))
    .every((item) => item.gate.taskOutcomePassed);
  if (
    cohort.cohortId !== SKIN_CENTER_COHORT_ID ||
    cohort.requiredMembers !== 9 ||
    cohort.allMembersRollbackVerified !== true ||
    cohort.allMembersTaskPassed !== expectedCohortPassed ||
    cohort.candidateEligible !== expectedCohortPassed
  ) {
    fail('aggregate Skin Center cohort rule is not fail-closed');
  }
  for (const item of candidate.items) {
    validateCommunityItemCandidate(item, {
      plan,
      cohortPassed: expectedCohortPassed,
    });
  }
  const independent = candidate.cohorts.independentItems;
  exactKeys(
    independent,
    ['requiredMembers', 'members'],
    'aggregate independent cohort'
  );
  if (
    independent.requiredMembers !== 2 ||
    !Array.isArray(independent.members) ||
    independent.members.length !== 2
  ) {
    fail('aggregate independent item set is incomplete');
  }
  for (let index = 0; index < INDEPENDENT_COMMUNITY_IDS.length; index += 1) {
    const member = independent.members[index];
    const catalogId = INDEPENDENT_COMMUNITY_IDS[index];
    exactKeys(member, ['catalogId', 'candidateEligible'], 'independent member');
    const expectedEligibility = candidate.items.find(
      (item) => item.item.catalogId === catalogId
    ).gate.taskOutcomePassed;
    if (
      member.catalogId !== catalogId ||
      member.candidateEligible !== expectedEligibility
    ) {
      fail('independent item candidacy does not match its task outcome');
    }
  }
  scanCommunityEvidenceValue(candidate, 'community aggregate candidate');
  return candidate;
}

async function readCanonicalJsonFile(input, label) {
  if (!isAbsolute(input)) fail(`${label} must be an absolute path`);
  const path = resolve(input);
  const before = await lstat(path);
  if (!before.isFile() || before.isSymbolicLink() || before.size < 1 || before.size > MAX_JSON_BYTES) {
    fail(`${label} must be one bounded regular file`);
  }
  const bytes = await readFile(path);
  const after = await lstat(path);
  if (
    !after.isFile() ||
    after.isSymbolicLink() ||
    after.dev !== before.dev ||
    after.ino !== before.ino ||
    after.size !== before.size ||
    after.mtimeMs !== before.mtimeMs
  ) {
    fail(`${label} changed during read`);
  }
  let value;
  try {
    value = JSON.parse(bytes);
  } catch {
    fail(`${label} is not JSON`);
  }
  if (!Buffer.from(canonicalCommunityCertificationJson(value)).equals(bytes)) {
    fail(`${label} is not canonical JSON`);
  }
  scanCommunityEvidenceValue(value, label);
  return { bytes, value };
}

async function jsonFiles(input) {
  if (!isAbsolute(input)) fail('evidence input must be an absolute path');
  const root = resolve(input);
  const rootStat = await lstat(root);
  if (rootStat.isSymbolicLink()) fail('evidence input must not be a symlink');
  if (rootStat.isFile()) return [root];
  if (!rootStat.isDirectory()) fail('evidence input must be a file or directory');
  const pending = [root];
  const files = [];
  while (pending.length > 0) {
    const directory = pending.pop();
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isSymbolicLink()) fail('evidence directory must not contain symlinks');
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) pending.push(path);
      else if (entry.isFile() && entry.name.endsWith('.json')) files.push(path);
      else fail('evidence directory may contain only JSON files and directories');
      if (files.length + pending.length > MAX_SCAN_FILES) {
        fail('evidence directory exceeds the file bound');
      }
    }
  }
  return files.sort();
}

async function readTaskReceiptDirectory(input, context) {
  const files = await jsonFiles(input);
  if (files.length !== 66) fail('aggregate requires exactly 66 JSON receipt files');
  const receipts = [];
  for (const file of files) {
    const { value } = await readCanonicalJsonFile(file, 'community task receipt');
    validateCommunityTaskReceipt(value, context);
    receipts.push(value);
  }
  return receipts;
}

function cohortRefusal() {
  fail(
    'alpha2-recertification-gate-not-certified: alpha2-skin-center-cohort-not-certified'
  );
}

export function assertSkinCenterDownloadCohort({
  catalog,
  alpha2Recertification,
  certificationAggregate,
  reviewAuthority,
}) {
  const cohort = catalog?.skins?.filter(
    (skin) => skin.installationMode === 'skin-center-builtin'
  );
  if (!Array.isArray(cohort) || cohort.length !== 9) cohortRefusal();
  if (
    JSON.stringify(cohort.map((skin) => skin.catalogId)) !==
    JSON.stringify(SKIN_CENTER_COHORT_IDS)
  ) {
    cohortRefusal();
  }
  const gate = alpha2Recertification?.gate;
  if (
    canonicalCommunityCertificationJson(gate?.cohortPolicy) !==
    canonicalCommunityCertificationJson({
      skinCenterBuiltin: {
        cohortId: SKIN_CENTER_COHORT_ID,
        members: SKIN_CENTER_COHORT_IDS,
        requiredMembers: 9,
        allMembersMustPass: true,
        allMembersRollbackVerified: true,
        installability: 'all-or-none',
      },
      independentItems: {
        members: INDEPENDENT_COMMUNITY_IDS,
        requiredMembers: 2,
        installability: 'item-level',
      },
    })
  ) {
    cohortRefusal();
  }
  const currentItems = alpha2Recertification?.items;
  if (!Array.isArray(currentItems) || currentItems.length !== 11) cohortRefusal();
  const expectedIdentity = catalog.skins.map(({ catalogId, slug }) => ({
    catalogId,
    slug,
  }));
  const actualIdentity = currentItems.map(({ catalogId, slug }) => ({
    catalogId,
    slug,
  }));
  if (
    new Set(currentItems.map((item) => item.catalogId)).size !== 11 ||
    new Set(currentItems.map((item) => `${item.catalogId}:${item.slug}`)).size !== 11 ||
    canonicalCommunityCertificationJson(actualIdentity) !==
      canonicalCommunityCertificationJson(expectedIdentity)
  ) {
    cohortRefusal();
  }
  const actualInstallableItems = currentItems.filter(
    (item) => item.installable === true
  ).length;
  if (
    gate?.status !== 'alpha2-review-complete' ||
    gate?.requiredItems !== 11 ||
    gate?.reviewedItems !== 11 ||
    gate?.completedTasks !== 66 ||
    gate?.installableItems !== actualInstallableItems ||
    gate.installableItems < 9 ||
    gate?.installable !== true ||
    gate?.showcasePublicationAllowed !== true ||
    gate?.installPublicationAllowed !== true ||
    !SHA256.test(gate?.runtimeReceiptSetSha256 ?? '') ||
    !SHA256.test(gate?.rollbackReceiptSetSha256 ?? '')
  ) {
    cohortRefusal();
  }
  if (
    currentItems.some(
      (item) =>
        item.reviewed !== true ||
        item.completedTasks !== 6 ||
        item.showcaseVisible !== true
    )
  ) {
    cohortRefusal();
  }
  for (const catalogId of SKIN_CENTER_COHORT_IDS) {
    const item = currentItems.find((candidate) => candidate.catalogId === catalogId);
    if (
      item?.status !== 'runtime-verified-installable' ||
      item?.reviewed !== true ||
      item?.completedTasks !== 6 ||
      item?.installable !== true ||
      item?.showcaseVisible !== true ||
      !Array.isArray(item?.ineligibilityReasons) ||
      item.ineligibilityReasons.length !== 0 ||
      !SHA256.test(item?.runtimeReceiptSetSha256 ?? '') ||
      !SHA256.test(item?.rollbackReceiptSetSha256 ?? '')
    ) {
      cohortRefusal();
    }
  }
  if (!certificationAggregate || !reviewAuthority) {
    fail(
      'alpha2-recertification-gate-not-certified: alpha2-certification-aggregate-review-authority-required'
    );
  }
  fail(
    'alpha2-recertification-gate-not-certified: alpha2-runtime-receipt-verifier-not-implemented'
  );
}

function exactSinglePathArg(argv, flag) {
  if (argv.length !== 2 || argv[0] !== flag || !argv[1]) {
    fail(`expected ${flag} <absolute-path>`);
  }
  return argv[1];
}

async function main(argv) {
  const [command, ...args] = argv;
  if (command === 'run-task') {
    fail('executor-not-reviewed');
  }
  if (command === 'plan') {
    if (args.length !== 0) fail('plan accepts no arguments');
    const { plan } = await loadCommunityCertificationContext();
    process.stdout.write(canonicalCommunityCertificationJson(plan));
    return;
  }
  if (command === 'verify-task') {
    const receiptPath = exactSinglePathArg(args, '--receipt');
    const context = await loadCommunityCertificationContext();
    const { bytes, value } = await readCanonicalJsonFile(
      receiptPath,
      'community task receipt'
    );
    validateCommunityTaskReceipt(value, context);
    process.stdout.write(
      canonicalCommunityCertificationJson({
        status: 'verified-task-candidate',
        authorityMutation: false,
        installability: 'none',
        taskId: value.task.taskId,
        receiptSha256: sha256(bytes),
      })
    );
    return;
  }
  if (command === 'aggregate') {
    const receiptsPath = exactSinglePathArg(args, '--receipts');
    const context = await loadCommunityCertificationContext();
    const receipts = await readTaskReceiptDirectory(receiptsPath, context);
    process.stdout.write(
      canonicalCommunityCertificationJson(
        aggregateCommunityCertification(receipts, context)
      )
    );
    return;
  }
  if (command === 'scan') {
    const input = exactSinglePathArg(args, '--input');
    const files = await jsonFiles(input);
    for (const file of files) await readCanonicalJsonFile(file, 'community evidence');
    process.stdout.write(
      canonicalCommunityCertificationJson({
        status: 'scan-passed',
        files: files.length,
        authorityMutation: false,
        installability: 'none',
      })
    );
    return;
  }
  fail('usage: alpha2-community-certification.mjs <plan|verify-task|aggregate|scan|run-task>');
}

const invoked = process.argv[1] ? resolve(process.argv[1]) : undefined;
if (invoked === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(
      `alpha2 community certification refused: ${error.message}\n`
    );
    process.exitCode = 1;
  });
}
