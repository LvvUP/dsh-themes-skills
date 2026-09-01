import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

import {
  INDEPENDENT_COMMUNITY_IDS,
  SKIN_CENTER_COHORT_IDS,
  aggregateCommunityCertification,
  assertSkinCenterDownloadCohort,
  canonicalCommunityCertificationJson,
  loadCommunityCertificationContext,
  scanCommunityEvidenceValue,
  validateCommunityTaskReceipt,
} from '../skills/dsh-community-skin-installer/scripts/alpha2-community-certification.mjs';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const skillRoot = join(repoRoot, 'skills/dsh-community-skin-installer');
const script = join(
  skillRoot,
  'scripts/alpha2-community-certification.mjs'
);
const fetchScript = join(skillRoot, 'scripts/fetch-skin-center.mjs');
const schemaFiles = [
  'alpha2-community-certification-task-receipt.schema.json',
  'alpha2-community-certification-item-receipt.schema.json',
  'alpha2-community-certification-aggregate-receipt.schema.json',
];

function digest(value) {
  return createHash('sha256').update(value).digest('hex');
}

function run(args, { ok = true } = {}) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
    maxBuffer: 4 * 1024 * 1024,
  });
  if (ok) assert.equal(result.status, 0, result.stderr || result.stdout);
  else assert.notEqual(result.status, 0, 'command unexpectedly succeeded');
  return result;
}

async function workspace(t) {
  const root = await mkdtemp(join(tmpdir(), 'dsh-community-alpha2-contract-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

function stage(taskId, phase, status = 'passed') {
  return {
    status,
    sanitizedEvidenceSha256:
      status === 'not-run-after-terminal-failure'
        ? null
        : digest(`${taskId}:${phase}:${status}`),
  };
}

function taskReceipt(context, task, { failurePhase } = {}) {
  const item = context.plan.items.find(
    (candidate) => candidate.catalogId === task.catalogId
  );
  const phases = [
    'preflight',
    'snapshot',
    'install',
    'dumpConfig',
    'coldRestart',
    'functionalProbe',
    'removal',
  ];
  const failureIndex = failurePhase ? phases.indexOf(failurePhase) : -1;
  assert.notEqual(failurePhase ? failureIndex : 0, -1);
  const lifecycle = Object.fromEntries(
    phases.map((phase, index) => [
      phase,
      stage(
        task.taskId,
        phase,
        failureIndex < 0
          ? 'passed'
          : index < failureIndex
            ? 'passed'
            : index === failureIndex
              ? 'failed'
              : 'not-run-after-terminal-failure'
      ),
    ])
  );
  lifecycle.rollback = {
    status: 'passed',
    fullProfileRestored: true,
    dependencyClosureRestored: true,
    noWritesOutsideIsolatedRoots: true,
    sidecarsTerminated: true,
    sanitizedEvidenceSha256: digest(`${task.taskId}:rollback:passed`),
  };
  lifecycle.terminalFailure = failurePhase
    ? {
        phase: failurePhase,
        reasonCode: `${failurePhase.replace(/[A-Z]/gu, (letter) => `-${letter.toLowerCase()}`)}-failed`,
        sanitizedEvidenceSha256:
          lifecycle[failurePhase].sanitizedEvidenceSha256,
      }
    : null;
  return {
    schemaVersion: 1,
    status: failurePhase
      ? 'community-alpha2-task-failed'
      : 'community-alpha2-task-passed',
    scope: 'one-community-skin-one-platform-node-task',
    certificationPlanSha256: context.certificationPlanSha256,
    authority: structuredClone(context.plan.authority),
    baseline: structuredClone(context.plan.baseline),
    item: structuredClone(item),
    task: {
      taskId: task.taskId,
      platform: task.platform,
      arch: task.arch,
      nodeVersion: task.nodeVersion,
    },
    observedRuntime: {
      platform: task.platform,
      arch: task.arch,
      nodeVersion: task.nodeVersion,
    },
    lifecycle,
    run: {
      repository: 'LvvUP/dsh-themes-skills',
      workflow: 'alpha2-community-skin-certification',
      workflowSha256: '1'.repeat(64),
      event: 'workflow_dispatch',
      ref: 'refs/heads/main',
      runId: '987654321',
      runAttempt: 1,
      headSha: '2'.repeat(40),
      jobIdentity: task.taskId,
    },
    privacy: {
      capturesMachinePaths: false,
      capturesTokens: false,
      capturesCookies: false,
      capturesCredentials: false,
      capturesCorrelatableSecretDigests: false,
    },
  };
}

function allReceipts(context) {
  return context.plan.tasks.map((task) => taskReceipt(context, task));
}

function completeFutureAuthority(context, installableIds) {
  const authority = structuredClone(context.authority);
  authority.gate = {
    ...authority.gate,
    status: 'alpha2-review-complete',
    reviewedItems: 11,
    completedTasks: 66,
    installableItems: installableIds.length,
    installable: installableIds.length > 0,
    installPublicationAllowed: installableIds.length > 0,
    runtimeReceiptSetSha256: 'a'.repeat(64),
    rollbackReceiptSetSha256: 'b'.repeat(64),
  };
  authority.items = authority.items.map((item) =>
    installableIds.includes(item.catalogId)
      ? {
          ...item,
          status: 'runtime-verified-installable',
          reviewed: true,
          completedTasks: 6,
          installable: true,
          ineligibilityReasons: [],
          runtimeReceiptSetSha256: 'c'.repeat(64),
          rollbackReceiptSetSha256: 'd'.repeat(64),
        }
      : {
          ...item,
          status: 'runtime-verification-failed',
          reviewed: true,
          completedTasks: 6,
          installable: false,
          ineligibilityReasons: ['alpha2-functional-probe-failed'],
        }
  );
  return authority;
}

test('certification schemas and deterministic CLI are present without an executor', async () => {
  for (const name of schemaFiles) {
    const schema = JSON.parse(
      await readFile(join(skillRoot, 'references', name), 'utf8')
    );
    assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema');
    assert.equal(schema.type, 'object');
    assert.equal(schema.additionalProperties, false);
  }
  assert.equal(
    spawnSync(process.execPath, ['--check', script], { encoding: 'utf8' }).status,
    0
  );
  const first = run(['plan']).stdout;
  const second = run(['plan']).stdout;
  assert.equal(first, second);
  const plan = JSON.parse(first);
  assert.equal(plan.status, 'candidate-plan-executor-not-reviewed');
  assert.equal(plan.authorityMutation, false);
  assert.equal(plan.installability, 'none');
  assert.equal(plan.items.length, 11);
  assert.equal(plan.tasks.length, 66);
  assert.equal(new Set(plan.tasks.map((task) => task.taskId)).size, 66);
  assert.deepEqual(
    plan.cohorts.skinCenterBuiltin.members,
    SKIN_CENTER_COHORT_IDS
  );
  assert.deepEqual(
    plan.cohorts.independentItems.members,
    INDEPENDENT_COMMUNITY_IDS
  );
  assert.deepEqual(
    new Set(
      plan.tasks.map(
        (task) => `${task.platform}-${task.arch}-node-${task.nodeVersion}`
      )
    ),
    new Set([
      'darwin-arm64-node-22.19.0',
      'darwin-arm64-node-24.15.0',
      'linux-x64-node-22.19.0',
      'linux-x64-node-24.15.0',
      'win32-x64-node-22.19.0',
      'win32-x64-node-24.15.0',
    ])
  );
});

test('run-task fails with executor-not-reviewed before directory or Profile mutation', async (t) => {
  const root = await workspace(t);
  const result = run(
    [
      'run-task',
      '--dsh-home',
      join(root, 'profile'),
      '--output',
      join(root, 'receipt.json'),
    ],
    { ok: false }
  );
  assert.match(result.stderr, /executor-not-reviewed/);
  assert.deepEqual(await readdir(root), []);
});

test('verify-task, scan, and aggregate accept only canonical candidate evidence', async (t) => {
  const root = await workspace(t);
  const receiptsRoot = join(root, 'receipts');
  await mkdir(receiptsRoot);
  const context = await loadCommunityCertificationContext();
  const receipts = allReceipts(context);
  for (const receipt of receipts) {
    await writeFile(
      join(receiptsRoot, `${receipt.task.taskId}.json`),
      canonicalCommunityCertificationJson(receipt),
      { mode: 0o600 }
    );
  }
  const firstReceipt = join(
    receiptsRoot,
    `${receipts[0].task.taskId}.json`
  );
  const verified = JSON.parse(
    run(['verify-task', '--receipt', firstReceipt]).stdout
  );
  assert.equal(verified.status, 'verified-task-candidate');
  assert.equal(verified.authorityMutation, false);
  assert.equal(verified.installability, 'none');
  const scanned = JSON.parse(run(['scan', '--input', receiptsRoot]).stdout);
  assert.equal(scanned.status, 'scan-passed');
  assert.equal(scanned.files, 66);
  const aggregate = JSON.parse(
    run(['aggregate', '--receipts', receiptsRoot]).stdout
  );
  assert.equal(aggregate.status, 'community-alpha2-certification-candidate');
  assert.equal(aggregate.reviewStatus, 'pending-review');
  assert.equal(aggregate.authorityMutation, false);
  assert.equal(aggregate.installability, 'none');
  assert.equal(aggregate.gate.completedTasks, 66);
  assert.equal(aggregate.gate.rollbackVerifiedTasks, 66);
  assert.equal(aggregate.cohorts.skinCenterBuiltin.candidateEligible, true);
  assert.ok(
    aggregate.items.every(
      (item) => item.candidateDisposition === 'eligible-awaiting-review'
    )
  );
});

test('task verifier rejects tuple, source, gate, terminal, rollback, and leakage faults', async () => {
  const context = await loadCommunityCertificationContext();
  const valid = taskReceipt(context, context.plan.tasks[0]);
  assert.doesNotThrow(() =>
    validateCommunityTaskReceipt(valid, context)
  );

  const platformLie = structuredClone(valid);
  platformLie.observedRuntime.platform = 'linux';
  assert.throws(
    () => validateCommunityTaskReceipt(platformLie, context),
    /observed runtime tuple/
  );

  const sourceMix = structuredClone(valid);
  sourceMix.item.sourceRevision = '0'.repeat(40);
  assert.throws(
    () => validateCommunityTaskReceipt(sourceMix, context),
    /source and artifact identity/
  );

  const gateMix = structuredClone(valid);
  gateMix.authority.currentGateSha256 = '0'.repeat(64);
  assert.throws(
    () => validateCommunityTaskReceipt(gateMix, context),
    /receipt authority/
  );

  const failedWithoutTerminal = taskReceipt(context, context.plan.tasks[0], {
    failurePhase: 'functionalProbe',
  });
  failedWithoutTerminal.lifecycle.terminalFailure = null;
  assert.throws(
    () => validateCommunityTaskReceipt(failedWithoutTerminal, context),
    /terminalFailure must be an object/
  );

  const rollbackFailure = structuredClone(valid);
  rollbackFailure.lifecycle.rollback.fullProfileRestored = false;
  assert.throws(
    () => validateCommunityTaskReceipt(rollbackFailure, context),
    /rollback did not restore/
  );

  assert.throws(
    () => scanCommunityEvidenceValue({ profilePath: '/Users/alice/.dsh' }),
    /forbidden sensitive or machine-path field|machine path/
  );
  assert.throws(
    () => scanCommunityEvidenceValue({ note: 'Cookie: session=private' }),
    /token, cookie, or credential material/
  );
  assert.throws(
    () => scanCommunityEvidenceValue({ tokenSha256: 'a'.repeat(64) }),
    /forbidden sensitive|correlatable secret digest/
  );
  assert.throws(
    () => scanCommunityEvidenceValue({ capturesTokens: 'raw-value' }),
    /must remain false/
  );
  assert.throws(
    () => scanCommunityEvidenceValue({ profileSnapshotSha256: 'a'.repeat(64) }),
    /correlatable runtime digest/
  );
});

test('aggregate rejects missing, duplicate, and mixed-run task identity', async () => {
  const context = await loadCommunityCertificationContext();
  const receipts = allReceipts(context);
  assert.throws(
    () => aggregateCommunityCertification(receipts.slice(0, 65), context),
    /exactly 66 task receipts/
  );
  const duplicate = receipts.slice();
  duplicate[65] = structuredClone(duplicate[0]);
  assert.throws(
    () => aggregateCommunityCertification(duplicate, context),
    /duplicate task tuple/
  );
  const mixedRun = receipts.map((receipt) => structuredClone(receipt));
  mixedRun[65].run.runId = '987654322';
  assert.throws(
    () => aggregateCommunityCertification(mixedRun, context),
    /aggregate run identity/
  );
});

test('one shared cohort failure blocks all nine while independent items stay item-level', async () => {
  const context = await loadCommunityCertificationContext();
  const sharedFailure = allReceipts(context);
  const sharedIndex = sharedFailure.findIndex(
    (receipt) => receipt.item.catalogId === SKIN_CENTER_COHORT_IDS[0]
  );
  sharedFailure[sharedIndex] = taskReceipt(
    context,
    context.plan.tasks.find(
      (task) => task.taskId === sharedFailure[sharedIndex].task.taskId
    ),
    { failurePhase: 'functionalProbe' }
  );
  const sharedAggregate = aggregateCommunityCertification(
    sharedFailure,
    context
  );
  assert.equal(
    sharedAggregate.cohorts.skinCenterBuiltin.candidateEligible,
    false
  );
  for (const catalogId of SKIN_CENTER_COHORT_IDS) {
    const item = sharedAggregate.items.find(
      (candidate) => candidate.item.catalogId === catalogId
    );
    assert.notEqual(item.candidateDisposition, 'eligible-awaiting-review');
  }
  for (const catalogId of INDEPENDENT_COMMUNITY_IDS) {
    const item = sharedAggregate.items.find(
      (candidate) => candidate.item.catalogId === catalogId
    );
    assert.equal(item.candidateDisposition, 'eligible-awaiting-review');
  }

  const independentFailure = allReceipts(context);
  const independentIndex = independentFailure.findIndex(
    (receipt) => receipt.item.catalogId === INDEPENDENT_COMMUNITY_IDS[0]
  );
  independentFailure[independentIndex] = taskReceipt(
    context,
    context.plan.tasks.find(
      (task) => task.taskId === independentFailure[independentIndex].task.taskId
    ),
    { failurePhase: 'removal' }
  );
  const independentAggregate = aggregateCommunityCertification(
    independentFailure,
    context
  );
  assert.equal(
    independentAggregate.cohorts.skinCenterBuiltin.candidateEligible,
    true
  );
  assert.equal(
    independentAggregate.items.find(
      (item) => item.item.catalogId === INDEPENDENT_COMMUNITY_IDS[0]
    ).candidateDisposition,
    'ineligible-task-failure'
  );
  assert.equal(
    independentAggregate.items.find(
      (item) => item.item.catalogId === INDEPENDENT_COMMUNITY_IDS[1]
    ).candidateDisposition,
    'eligible-awaiting-review'
  );
});

test('Skin Center download gate cannot self-certify with shaped future authority', async () => {
  const context = await loadCommunityCertificationContext();
  const onlyIndependent = completeFutureAuthority(
    context,
    INDEPENDENT_COMMUNITY_IDS
  );
  assert.throws(
    () =>
      assertSkinCenterDownloadCohort({
        catalog: context.catalog,
        alpha2Recertification: onlyIndependent,
      }),
    /alpha2-skin-center-cohort-not-certified/
  );
  const onlyOneShared = completeFutureAuthority(context, [
    SKIN_CENTER_COHORT_IDS[0],
  ]);
  assert.throws(
    () =>
      assertSkinCenterDownloadCohort({
        catalog: context.catalog,
        alpha2Recertification: onlyOneShared,
      }),
    /alpha2-skin-center-cohort-not-certified/
  );
  const allShared = completeFutureAuthority(context, SKIN_CENTER_COHORT_IDS);
  assert.throws(
    () =>
      assertSkinCenterDownloadCohort({
        catalog: context.catalog,
        alpha2Recertification: allShared,
      }),
    /alpha2-certification-aggregate-review-authority-required/
  );

  const fakeAggregateAndReview = {
    certificationAggregate: { receiptSetPayloadSha256: 'e'.repeat(64) },
    reviewAuthority: { approved: true, sha256: 'f'.repeat(64) },
  };
  assert.throws(
    () =>
      assertSkinCenterDownloadCohort({
        catalog: context.catalog,
        alpha2Recertification: allShared,
        ...fakeAggregateAndReview,
      }),
    /alpha2-runtime-receipt-verifier-not-implemented/
  );

  const faults = [
    (authority) => {
      authority.gate.cohortPolicy.skinCenterBuiltin.members[0] = 2206;
    },
    (authority) => {
      authority.items[1] = structuredClone(authority.items[0]);
    },
    (authority) => {
      authority.items[0].slug = 'wrong-slug';
    },
    (authority) => {
      authority.items[0].showcaseVisible = false;
    },
    (authority) => {
      authority.items[0].ineligibilityReasons = ['still-failed'];
    },
    (authority) => {
      authority.gate.installableItems += 1;
    },
  ];
  for (const mutate of faults) {
    const faulty = structuredClone(allShared);
    mutate(faulty);
    assert.throws(
      () =>
        assertSkinCenterDownloadCohort({
          catalog: context.catalog,
          alpha2Recertification: faulty,
          ...fakeAggregateAndReview,
        }),
      /alpha2-skin-center-cohort-not-certified/
    );
  }
  const fetchSource = await readFile(fetchScript, 'utf8');
  assert.match(fetchSource, /assertSkinCenterDownloadCohort/);
  assert.doesNotMatch(fetchSource, /installableItems < 1/);
});

test('community compatibility prose preserves the nine-plus-two cohort policy', async () => {
  const compatibility = await readFile(
    join(skillRoot, 'references/compatibility.md'),
    'utf8'
  );
  assert.match(
    compatibility,
    /nine shared Skin Center records reopen only as one all-passing cohort/
  );
  assert.match(compatibility, /QQ98 plus THS remain item-level decisions/);
  assert.doesNotMatch(compatibility, /final review is item-level, not all-or-nothing/i);
});

test('current fetch still fails before creating output or opening the network', async (t) => {
  const root = await workspace(t);
  const output = join(root, 'nested', 'skin-center.tgz');
  const result = spawnSync(
    process.execPath,
    [fetchScript, '--output', output],
    { cwd: repoRoot, encoding: 'utf8' }
  );
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /alpha2-skin-center-cohort-not-certified/);
  assert.deepEqual(await readdir(root), []);
});

test('contract files never modify the current authority or Finder authority', async () => {
  const installer = await readFile(
    join(skillRoot, 'references/alpha2-recertification.json')
  );
  const finder = await readFile(
    resolve(
      'skills/dsh-theme-finder/references/community-alpha2-recertification.json'
    )
  );
  assert.equal(installer.equals(finder), true);
  assert.equal(
    createHash('sha256').update(installer).digest('hex'),
    '1c83be51b9b611470771fae89d4e4c0550618a84efc055d993b38cfe9acb1a87'
  );
});
