import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

import { parse } from 'yaml';

import { validateCandidateIntake } from '../skills/dsh-plugin-installer/scripts/candidate-intake.mjs';
import {
  PLUGIN_RUNTIME_TUPLES,
  buildPluginRuntimeBatchPlan,
  pluginRuntimeMatrixForBatch,
  validatePluginRuntimeBatchPlan,
} from '../skills/dsh-plugin-installer/scripts/plugin-runtime-batches.mjs';
import {
  aggregatePluginRuntime,
  bindPluginRuntimeCustomAttestationPredicate,
  buildPluginRuntimeReceipt,
  canonicalPluginRuntimeJson,
  validatePluginRuntimeGithubIdentity,
  validatePluginRuntimeAggregateGithubIdentity,
  validatePluginRuntimeReceipt,
  verifyPluginRuntimeAggregate,
} from '../skills/dsh-plugin-installer/scripts/plugin-runtime-certification.mjs';
import {
  buildPendingPluginRuntimeCandidatePlan,
  canonicalPluginRuntimePlanJson,
  loadPluginRuntimeCandidatePlan,
  requireReadyPluginRuntimeCandidatePlan,
  validatePluginRuntimeCandidatePlan,
} from '../skills/dsh-plugin-installer/scripts/plugin-runtime-plan.mjs';

const workflowPath = resolve('.github/workflows/alpha2-plugin-runtime-certification.yml');
const executorPath = resolve(
  'skills/dsh-plugin-installer/scripts/plugin-runtime-fixed-executor.mjs'
);

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function deterministicSha(value) {
  return sha256(Buffer.from(String(value)));
}

function readyContext(base) {
  const plan = structuredClone(base.plan);
  plan.status = 'runtime-candidates-ready';
  for (const item of plan.items) {
    const locator = `https://registry.npmjs.org/@runtime/plugin-${item.catalogId}/-/plugin-${item.catalogId}-1.0.0.tgz`;
    item.status = 'runtime-candidate-ready';
    item.artifact = {
      kind: 'npm-tarball',
      locator,
      bytes: 10_000 + item.catalogId,
      sha256: deterministicSha(`artifact-${item.catalogId}`),
      source: {
        repository: item.repository,
        commit: item.commit,
        tree: deterministicSha(`tree-${item.catalogId}`).slice(0, 40),
        sourceSubdir: item.sourceSubdir,
      },
      distribution: {
        sourceType: 'npm-registry-tarball',
        immutableCoordinate: locator,
        metadataPath: `skills/dsh-plugin-installer/references/plugin-runtime-artifact-metadata/${item.catalogId}.json`,
        metadataSha256: deterministicSha(`metadata-${item.catalogId}`),
        buildRecipePath: null,
        buildRecipeSha256: null,
      },
    };
    item.functionalProbe = {
      contractPath: `skills/dsh-plugin-installer/references/plugin-runtime-probes/${item.catalogId}.json`,
      contractSha256: deterministicSha(`contract-${item.catalogId}`),
      requiredAssertions: ['candidate-capability', 'profile-switch'],
    };
  }
  validatePluginRuntimeCandidatePlan(plan, base.intake, base.intakeSha256);
  const planBytes = Buffer.from(canonicalPluginRuntimePlanJson(plan));
  const planSha256 = sha256(planBytes);
  const batchPlan = buildPluginRuntimeBatchPlan(base.intake, planSha256);
  return {
    intake: base.intake,
    runtimeCandidatePlanSha256: planSha256,
    runtimePlanContext: {
      intake: base.intake,
      intakeSha256: base.intakeSha256,
      plan,
      planBytes,
      planSha256,
    },
    plan: batchPlan,
  };
}

function passedStages(runtimeCandidate) {
  return {
    install: {
      status: 'passed',
      candidateArtifactSha256: runtimeCandidate.artifact.sha256,
      candidateArtifactBytes: runtimeCandidate.artifact.bytes,
      packageName: `@runtime/plugin-${runtimeCandidate.catalogId}`,
      version: '1.0.0',
      profileBeforeSha256: deterministicSha('profile-before'),
      profileAfterInstallSha256: deterministicSha('profile-after-install'),
      dumpConfigSha256: deterministicSha('dump-config'),
    },
    start: {
      status: 'passed',
      coldStart: true,
      webBooted: true,
      unauthenticatedRootStatus: 401,
      processStayedAlive: true,
    },
    functionalProbe: {
      status: 'passed',
      kind: 'candidate-capability-contract',
      contractSha256: runtimeCandidate.functionalProbe.contractSha256,
      webBootOnly: false,
      assertions: runtimeCandidate.functionalProbe.requiredAssertions.map((id) => ({
        id,
        status: 'passed',
        evidenceSha256: deterministicSha(`assertion-${id}`),
      })),
    },
    remove: {
      status: 'passed',
      exactPackageAbsent: true,
      cordisEntryAbsent: true,
      profileAfterRemoveSha256: deterministicSha('profile-after-remove'),
    },
    fullRollback: {
      status: 'passed',
      isolatedDshHomeBeforeSha256: deterministicSha('dsh-home'),
      isolatedDshHomeAfterSha256: deterministicSha('dsh-home'),
      dependencyClosureBeforeSha256: deterministicSha('dependency-closure'),
      dependencyClosureAfterSha256: deterministicSha('dependency-closure'),
      declaredWritableRoots: ['cache', 'data', 'profile', 'sidecar'],
      observedWritableRoots: ['cache', 'profile'],
      allDshHomeBytesRestored: true,
      dependencyClosureRestored: true,
      noWritesOutsideDeclaredRoots: true,
      sandboxedExternalWritesDenied: true,
      sidecarsTerminated: true,
    },
  };
}

function syntheticReceipt(context, candidate, runtimeCandidate, tuple, batchId, workflowSha256) {
  const task = { ...tuple, batchId, catalogId: candidate.catalogId };
  const ci = {
    repository: 'LvvUP/dsh-themes-skills',
    workflowPath: '.github/workflows/alpha2-plugin-runtime-certification.yml',
    workflowSha256,
    event: 'workflow_dispatch',
    ref: 'refs/heads/main',
    runId: '123456789',
    runAttempt: 1,
    headSha: '6'.repeat(40),
    jobKey: `runtime-batch-${batchId}`,
    matrixIdentity: `${candidate.catalogId}-${tuple.tuple}`,
  };
  return buildPluginRuntimeReceipt({
    runtimeCandidatePlanSha256: context.runtimeCandidatePlanSha256,
    candidate,
    runtimeCandidate,
    candidateTree: runtimeCandidate.artifact.source.tree,
    task,
    stages: passedStages(runtimeCandidate),
    ci,
  });
}

test('checked-in runtime plan is reproducible, non-installing, and hard-pending', async () => {
  const base = await loadPluginRuntimeCandidatePlan();
  assert.equal(base.plan.status, 'runtime-artifact-and-probe-authority-pending');
  assert.equal(base.plan.authorityEffect, 'none-not-installation-authority');
  assert.equal(base.plan.items.length, 80);
  assert.ok(base.plan.items.every((item) =>
    item.status === 'runtime-authority-pending' &&
    item.artifact === null && item.functionalProbe === null));
  const generated = canonicalPluginRuntimePlanJson(
    buildPendingPluginRuntimeCandidatePlan(base.intake, base.intakeSha256)
  );
  assert.equal(generated, base.planBytes.toString('utf8'));
  assert.throws(
    () => requireReadyPluginRuntimeCandidatePlan(base.plan, base.intake, base.intakeSha256),
    /pending; refusing candidate execution and 80\/80 receipts/
  );
});

test('pending plan prevents matrix expansion and the executor refuses to run candidates', async () => {
  const base = await loadPluginRuntimeCandidatePlan();
  const batchPlan = buildPluginRuntimeBatchPlan(base.intake, base.planSha256);
  assert.throws(
    () => pluginRuntimeMatrixForBatch(batchPlan, base.intake, base, 1),
    /pending; refusing candidate execution/
  );
  const result = spawnSync(process.execPath, [
    executorPath,
    '--catalog-id', String(base.intake.items[0].catalogId),
    '--candidate-source', resolve('.'),
    '--harness-source', resolve('.'),
    '--build-receipt', workflowPath,
    '--artifact-output', resolve('never-created.tgz'),
    '--output', resolve('never-created.json'),
    '--tuple', `${process.platform}-${process.arch}-node-${process.versions.node}`,
  ], { encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /pending; refusing candidate execution/);
});

test('four authority batches are exact, disjoint, complete, and expand to 480 isolated jobs', async () => {
  const context = readyContext(await loadPluginRuntimeCandidatePlan());
  const keys = [];
  for (let batchId = 1; batchId <= 4; batchId += 1) {
    const matrix = pluginRuntimeMatrixForBatch(
      context.plan,
      context.intake,
      context.runtimePlanContext,
      batchId
    );
    assert.equal(matrix.include.length, 120);
    assert.equal(new Set(matrix.include.map((entry) => entry.catalogId)).size, 20);
    for (const entry of matrix.include) {
      assert.equal(entry.sourceSubdir, context.intake.items.find(
        (item) => item.catalogId === entry.catalogId
      ).sourceSubdir ?? '.');
      assert.match(entry.artifactSha256, /^[a-f0-9]{64}$/u);
      assert.match(entry.functionalProbeContractSha256, /^[a-f0-9]{64}$/u);
      keys.push(`${entry.catalogId}:${entry.tuple}`);
    }
  }
  assert.equal(keys.length, 480);
  assert.equal(new Set(keys).size, 480);

  const overlap = structuredClone(context.plan);
  overlap.batches[1].catalogIds[0] = overlap.batches[0].catalogIds[0];
  assert.throws(() => validatePluginRuntimeBatchPlan(overlap, context.intake), /authority-ordered/);

  const rebound = structuredClone(context.plan);
  rebound.runtimeCandidatePlanSha256 = 'f'.repeat(64);
  assert.throws(
    () => pluginRuntimeMatrixForBatch(rebound, context.intake, context.runtimePlanContext, 1),
    /not bound to the exact runtime candidate plan bytes/
  );
});

test('runtime plan closes artifact provenance, hosted recipe, and sourceSubdir paths', async () => {
  const base = await loadPluginRuntimeCandidatePlan();
  const context = readyContext(base);
  const hosted = structuredClone(context.runtimePlanContext.plan);
  const item = hosted.items[0];
  item.artifact.kind = 'hosted-staging-tarball';
  item.artifact.distribution.sourceType = 'reviewed-hosted-staging-build';
  item.artifact.distribution.buildRecipePath =
    `skills/dsh-plugin-installer/references/plugin-runtime-build-recipes/${item.catalogId}.json`;
  item.artifact.distribution.buildRecipeSha256 = deterministicSha('recipe');
  assert.doesNotThrow(() =>
    validatePluginRuntimeCandidatePlan(hosted, base.intake, base.intakeSha256));

  const missingRecipe = structuredClone(hosted);
  missingRecipe.items[0].artifact.distribution.buildRecipeSha256 = null;
  assert.throws(
    () => validatePluginRuntimeCandidatePlan(missingRecipe, base.intake, base.intakeSha256),
    /lacks one reviewed digest-bound build recipe/
  );

  for (const sourceSubdir of ['..', 'a\\b', 'a//b', 'a/./b', 'a/../b', 'a\0b']) {
    const unsafeIntake = structuredClone(base.intake);
    unsafeIntake.items[0].sourceSubdir = sourceSubdir;
    assert.throws(() => validateCandidateIntake(unsafeIntake), /malformed/);
  }
});

test('one task receipt rejects artifact drift, arbitrary probes, Web-only success, and partial rollback', async () => {
  const context = readyContext(await loadPluginRuntimeCandidatePlan());
  const candidate = context.intake.items[0];
  const runtimeCandidate = context.runtimePlanContext.plan.items[0];
  const tuple = PLUGIN_RUNTIME_TUPLES[0];
  const receipt = syntheticReceipt(
    context,
    candidate,
    runtimeCandidate,
    tuple,
    1,
    deterministicSha('workflow')
  );
  assert.doesNotThrow(() => validatePluginRuntimeReceipt(receipt, {
    candidate, runtimeCandidate,
    runtimeCandidatePlanSha256: context.runtimeCandidatePlanSha256,
    batchId: 1, tuple,
  }));

  const artifactDrift = structuredClone(receipt);
  artifactDrift.stages.install.candidateArtifactSha256 = 'f'.repeat(64);
  assert.throws(
    () => validatePluginRuntimeReceipt(artifactDrift, { candidate, runtimeCandidate, batchId: 1, tuple }),
    /artifact does not match/
  );

  const arbitraryProbe = structuredClone(receipt);
  arbitraryProbe.stages.functionalProbe.contractSha256 = 'f'.repeat(64);
  assert.throws(
    () => validatePluginRuntimeReceipt(arbitraryProbe, { candidate, runtimeCandidate, batchId: 1, tuple }),
    /machine-authority contract/
  );

  const webOnly = structuredClone(receipt);
  webOnly.stages.functionalProbe.webBootOnly = true;
  assert.throws(
    () => validatePluginRuntimeReceipt(webOnly, { candidate, runtimeCandidate, batchId: 1, tuple }),
    /Web boot alone is insufficient/
  );

  const outsideWrite = structuredClone(receipt);
  outsideWrite.stages.fullRollback.noWritesOutsideDeclaredRoots = false;
  assert.throws(
    () => validatePluginRuntimeReceipt(outsideWrite, { candidate, runtimeCandidate, batchId: 1, tuple }),
    /complete isolated DSH HOME/
  );

  const receiptReuse = structuredClone(receipt);
  receiptReuse.runtimeCandidatePlanSha256 = 'f'.repeat(64);
  assert.throws(
    () => validatePluginRuntimeReceipt(receiptReuse, {
      candidate,
      runtimeCandidate,
      runtimeCandidatePlanSha256: context.runtimeCandidatePlanSha256,
      batchId: 1,
      tuple,
    }),
    /reuses a different runtime candidate plan/
  );
});

test('GitHub identity fixes workflow path, main ref, dispatch event, job, and exact SHA', () => {
  const task = { batchId: 3, catalogId: 3004, tuple: PLUGIN_RUNTIME_TUPLES[0].tuple };
  const environment = {
    GITHUB_ACTIONS: 'true',
    GITHUB_REPOSITORY: 'LvvUP/dsh-themes-skills',
    GITHUB_WORKFLOW: 'alpha2 Plugin runtime certification',
    GITHUB_WORKFLOW_REF:
      'LvvUP/dsh-themes-skills/.github/workflows/alpha2-plugin-runtime-certification.yml@refs/heads/main',
    GITHUB_EVENT_NAME: 'workflow_dispatch',
    GITHUB_REF: 'refs/heads/main',
    GITHUB_JOB: 'runtime-batch-3',
    GITHUB_RUN_ID: '123456789',
    GITHUB_RUN_ATTEMPT: '1',
    GITHUB_SHA: '6'.repeat(40),
  };
  assert.doesNotThrow(() =>
    validatePluginRuntimeGithubIdentity(environment, task, deterministicSha('workflow')));
  for (const [key, value] of [
    ['GITHUB_EVENT_NAME', 'pull_request'],
    ['GITHUB_REF', 'refs/heads/feature'],
    ['GITHUB_JOB', 'runtime-batch-4'],
    ['GITHUB_SHA', 'main'],
  ]) {
    assert.throws(
      () => validatePluginRuntimeGithubIdentity(
        { ...environment, [key]: value }, task, deterministicSha('workflow')
      ),
      /exact main workflow job identity/
    );
  }
  const aggregateIdentity = {
    repository: environment.GITHUB_REPOSITORY,
    workflowPath: '.github/workflows/alpha2-plugin-runtime-certification.yml',
    workflowSha256: deterministicSha('workflow'),
    event: environment.GITHUB_EVENT_NAME,
    ref: environment.GITHUB_REF,
    runId: environment.GITHUB_RUN_ID,
    runAttempt: 1,
    headSha: environment.GITHUB_SHA,
  };
  assert.throws(
    () => validatePluginRuntimeAggregateGithubIdentity(
      { ...environment, GITHUB_JOB: 'aggregate', GITHUB_RUN_ID: '987654321' },
      aggregateIdentity,
      'aggregate'
    ),
    /does not belong to this exact protected workflow run/
  );
});

test('aggregation requires all 480 canonical receipts from one run and re-verifies the digest gate', async () => {
  const context = readyContext(await loadPluginRuntimeCandidatePlan());
  const root = await mkdtemp(join(tmpdir(), 'dsh-plugin-runtime-'));
  try {
    const input = join(root, 'input');
    const output = join(root, 'output');
    await mkdir(input);
    const workflowSha256 = sha256(await readFile(workflowPath));
    const githubEnvironment = {
      GITHUB_ACTIONS: 'true',
      GITHUB_REPOSITORY: 'LvvUP/dsh-themes-skills',
      GITHUB_WORKFLOW: 'alpha2 Plugin runtime certification',
      GITHUB_WORKFLOW_REF:
        'LvvUP/dsh-themes-skills/.github/workflows/alpha2-plugin-runtime-certification.yml@refs/heads/main',
      GITHUB_EVENT_NAME: 'workflow_dispatch',
      GITHUB_REF: 'refs/heads/main',
      GITHUB_JOB: 'aggregate',
      GITHUB_RUN_ID: '123456789',
      GITHUB_RUN_ATTEMPT: '1',
      GITHUB_SHA: '6'.repeat(40),
    };
    for (const batch of context.plan.batches) {
      for (const catalogId of batch.catalogIds) {
        const candidate = context.intake.items.find((item) => item.catalogId === catalogId);
        const runtimeCandidate = context.runtimePlanContext.plan.items.find(
          (item) => item.catalogId === catalogId
        );
        for (const tuple of PLUGIN_RUNTIME_TUPLES) {
          const receipt = syntheticReceipt(
            context, candidate, runtimeCandidate, tuple, batch.batchId, workflowSha256
          );
          await writeFile(
            join(input, `${catalogId}-${tuple.tuple}.json`),
            canonicalPluginRuntimeJson(receipt)
          );
        }
      }
    }
    const aggregated = await aggregatePluginRuntime({
      input, output, workflowPath, context, environment: githubEnvironment,
    });
    assert.equal(aggregated.receiptSet.status, 'plugin-runtime-80-of-80-passed');
    assert.equal(aggregated.receiptSet.gate.verifiedTasks, 480);
    assert.equal(aggregated.receiptSet.gate.completeIsolatedDshHomeRollback, true);
    const verified = await verifyPluginRuntimeAggregate({
      candidate: output,
      workflowPath,
      context,
      environment: { ...githubEnvironment, GITHUB_JOB: 'verify-signed' },
    });
    assert.equal(verified.receiptSetSha256, aggregated.receiptSetSha256);

    await rm(join(input, `${context.plan.batches[0].catalogIds[0]}-${PLUGIN_RUNTIME_TUPLES[0].tuple}.json`));
    await assert.rejects(
      aggregatePluginRuntime({
        input,
        output: join(root, 'missing-output'),
        workflowPath,
        context,
        environment: githubEnvironment,
      }),
      /exactly 480 task receipts/
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('custom Sigstore handoff binds its signed predicate to the exact local evidence bytes', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-plugin-runtime-bundle-'));
  try {
    const predicate = {
      schemaVersion: 1,
      predicateType: 'https://dsh-themes.com/attestations/plugin-alpha2-runtime-evidence/v1',
      receiptSet: { status: 'plugin-runtime-80-of-80-passed' },
      taskReceipts: [],
    };
    const predicatePath = join(root, 'predicate.json');
    const bundlePath = join(root, 'bundle.json');
    await writeFile(predicatePath, canonicalPluginRuntimeJson(predicate));
    await writeFile(bundlePath, `${JSON.stringify({
      dsseEnvelope: {
        payloadType: 'application/vnd.in-toto+json',
        payload: Buffer.from(JSON.stringify({
          _type: 'https://in-toto.io/Statement/v1',
          subject: [{ name: 'plugin-runtime-receipt-set.json', digest: { sha256: 'a'.repeat(64) } }],
          predicateType: 'https://dsh-themes.com/attestations/plugin-alpha2-runtime-evidence/v1',
          predicate,
        })).toString('base64'),
        signatures: [{ sig: 'test-only' }],
      },
    })}\n`);
    const bound = await bindPluginRuntimeCustomAttestationPredicate({
      bundle: bundlePath,
      predicate: predicatePath,
    });
    assert.equal(bound.status, 'signed-custom-predicate-byte-bound');

    await writeFile(predicatePath, canonicalPluginRuntimeJson({ ...predicate, taskReceipts: [{}] }));
    await assert.rejects(
      bindPluginRuntimeCustomAttestationPredicate({
        bundle: bundlePath,
        predicate: predicatePath,
      }),
      /does not match the verified local 480-receipt evidence/
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('workflow isolates candidates, pins actions, minimizes permissions, and cannot currently issue 80/80', async () => {
  const [source, actionSource, executorSource] = await Promise.all([
    readFile(workflowPath, 'utf8'),
    readFile(resolve('.github/actions/plugin-runtime-task/action.yml'), 'utf8'),
    readFile(executorPath, 'utf8'),
  ]);
  const workflow = parse(source);
  assert.deepEqual(Object.keys(workflow.on), ['workflow_dispatch']);
  assert.deepEqual(workflow.permissions, { contents: 'read' });
  assert.deepEqual(workflow.jobs.sign.permissions, {
    contents: 'read',
    'id-token': 'write',
    attestations: 'write',
    'artifact-metadata': 'write',
  });
  assert.deepEqual(workflow.jobs['verify-signed'].permissions, { contents: 'read' });
  assert.match(source, /matrix_batch_1="\$\(node [^\n]+ --batch 1\)"/u);
  assert.doesNotMatch(source, /echo "batch-[1-4]=\$\(node/u);
  for (let batchId = 1; batchId <= 4; batchId += 1) {
    const job = workflow.jobs[`runtime-batch-${batchId}`];
    assert.equal(job.strategy['max-parallel'], 20);
    assert.equal(job.steps.filter((step) => step.uses ===
      './authority/.github/actions/plugin-runtime-task').length, 1);
    assert.doesNotMatch(JSON.stringify(job), /for .*candidate|catalogIds/u);
  }
  const remoteActions = [...`${source}\n${actionSource}`.matchAll(
    /^\s*uses:\s*([^\s.][^\s]*)$/gmu
  )].map((match) => match[1]);
  assert.ok(remoteActions.length >= 10);
  for (const action of remoteActions) {
    assert.match(action, /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+@[a-f0-9]{40}$/u);
  }
  assert.doesNotMatch(`${source}\n${actionSource}`, /secrets\.|GH_TOKEN|persist-credentials:\s*true/u);
  assert.match(actionSource, /dsh-v0\.1\.2-alpha\.2/u);
  assert.match(actionSource, /0a53fb55bea101816fa226bb964ae2bed71c343b/u);
  assert.match(actionSource, /64ccbfa8e0caa4711cd4a75717ef9e022657961b/u);
  assert.match(actionSource, /plugin-runtime-fixed-executor\.mjs/u);
  assert.match(actionSource, /--candidate-source "\$\{\{ github\.workspace \}\}\/\.ci\/candidate"/u);
  assert.doesNotMatch(actionSource, /\.ci\/candidate\/\$\{\{ inputs\.source-subdir \}\}/u);
  assert.doesNotMatch(actionSource, /^  source-subdir:/mu);
  assert.match(executorSource, /exact runtime plan commit and tree/u);
  assert.match(executorSource, /complete isolated DSH HOME rollback/u);
  assert.match(executorSource, /refusing candidate execution/u);
  assert.match(source, /plugin-runtime-signed-unverified/u);
  assert.match(source, /attestation verify/u);
  assert.match(source, /verify-custom-bundle/u);
  assert.match(source, /retention-days: 90/u);
});
