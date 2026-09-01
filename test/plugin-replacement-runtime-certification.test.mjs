import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

import { parse } from 'yaml';

import {
  REPLACEMENT_RUNTIME_TUPLES,
  buildReplacementRuntimeBatchPlan,
  replacementRuntimeMatrixForBatch,
  validateReplacementRuntimeBatchPlan,
} from '../skills/dsh-plugin-installer/scripts/plugin-replacement-runtime-batches.mjs';
import {
  aggregateReplacementRuntimeReceipts,
  bindReplacementRuntimeCustomAttestationPredicate,
  buildReplacementRuntimeReceipt,
  canonicalReplacementRuntimeJson,
  validateReplacementAllocationProposal,
  validateReplacementRuntimeGithubIdentity,
  validateReplacementRuntimeReceipt,
  verifyReplacementRuntimeAggregate,
} from '../skills/dsh-plugin-installer/scripts/plugin-replacement-runtime-certification.mjs';
import {
  REPLACEMENT_HARNESS_AUTHORITY_SHA256,
  REPLACEMENT_MAP_SHA256,
  buildPendingReplacementRuntimePlan,
  canonicalReplacementRuntimePlanJson,
  loadReplacementRuntimePlan,
  requireReadyReplacementRuntimePlan,
  validateReplacementRuntimePlan,
} from '../skills/dsh-plugin-installer/scripts/plugin-replacement-runtime-plan.mjs';

const workflowPath = resolve(
  '.github/workflows/alpha2-plugin-replacement-runtime-certification.yml'
);
const actionPath = resolve(
  '.github/actions/plugin-replacement-runtime-task/action.yml'
);
const batchScriptPath = resolve(
  'skills/dsh-plugin-installer/scripts/plugin-replacement-runtime-batches.mjs'
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
  for (const candidate of plan.candidates) {
    const artifactSha256 = deterministicSha(`replacement-artifact-${candidate.candidateToken}`);
    const mode = base.map.replacementCandidates[candidate.rank - 1].upstreamInstall.mode;
    candidate.status = 'runtime-candidate-ready';
    candidate.runtimeInput = {
      artifact: {
        kind:
          mode === 'npm-exact'
            ? 'upstream-npm-tarball'
            : mode === 'github-release-exact'
              ? 'upstream-github-release-asset'
              : 'hosted-adaptation-staging-tarball',
        locator:
          mode === 'hosted-adaptation-required'
            ? `staging-sha256:${artifactSha256}`
            : candidate.source.exactCoordinate,
        bytes: 50_000 + candidate.rank,
        sha256: artifactSha256,
        metadataPath:
          'skills/dsh-plugin-installer/references/' +
          `plugin-replacement-runtime-artifact-metadata/${candidate.candidateToken}.json`,
        metadataSha256: deterministicSha(`metadata-${candidate.candidateToken}`),
        buildRecipePath:
          mode === 'hosted-adaptation-required'
            ? 'skills/dsh-plugin-installer/references/' +
              `plugin-replacement-runtime-build-recipes/${candidate.candidateToken}.json`
            : null,
        buildRecipeSha256:
          mode === 'hosted-adaptation-required'
            ? deterministicSha(`recipe-${candidate.candidateToken}`)
            : null,
      },
      functionalProbe: {
        contractPath:
          'skills/dsh-plugin-installer/references/' +
          `plugin-replacement-runtime-probes/${candidate.candidateToken}.json`,
        contractSha256: deterministicSha(`probe-${candidate.candidateToken}`),
        requiredAssertions: ['candidate-capability', 'profile-switch'],
      },
    };
  }
  validateReplacementRuntimePlan(plan, base.map, base);
  const planBytes = Buffer.from(canonicalReplacementRuntimePlanJson(plan));
  const context = {
    ...base,
    plan,
    planBytes,
    planSha256: sha256(planBytes),
  };
  context.batchPlan = buildReplacementRuntimeBatchPlan(context);
  return context;
}

function passedStages(candidate) {
  return {
    install: {
      status: 'passed',
      candidateArtifactSha256: candidate.runtimeInput.artifact.sha256,
      candidateArtifactBytes: candidate.runtimeInput.artifact.bytes,
      packageName: candidate.packageName,
      version: candidate.packageVersion,
      profileSnapshotCaptured: true,
      sanitizedDumpConfigEntrySetSha256: deterministicSha('sanitized-entry-set-installed'),
      exactCordisEntryPresent: true,
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
      contractSha256: candidate.runtimeInput.functionalProbe.contractSha256,
      webBootOnly: false,
      assertions: candidate.runtimeInput.functionalProbe.requiredAssertions.map((id) => ({
        id,
        status: 'passed',
      })),
    },
    remove: {
      status: 'passed',
      exactPackageAbsent: true,
      cordisEntryAbsent: true,
      sanitizedDumpConfigEntrySetSha256: deterministicSha('sanitized-entry-set-removed'),
    },
    fullRollback: {
      status: 'passed',
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

function aggregateCi(workflowSha256) {
  return {
    repository: 'LvvUP/dsh-themes-skills',
    workflowPath: '.github/workflows/alpha2-plugin-replacement-runtime-certification.yml',
    workflowSha256,
    event: 'workflow_dispatch',
    ref: 'refs/heads/main',
    runId: '123456789',
    runAttempt: 2,
    headSha: '6'.repeat(40),
    jobKey: 'aggregate',
  };
}

function syntheticReceipt(context, candidate, tuple, workflowSha256) {
  const batchId = Math.floor((candidate.rank - 1) / 11) + 1;
  const task = { ...tuple, batchId };
  const ci = {
    repository: 'LvvUP/dsh-themes-skills',
    workflowPath: '.github/workflows/alpha2-plugin-replacement-runtime-certification.yml',
    workflowSha256,
    event: 'workflow_dispatch',
    ref: 'refs/heads/main',
    runId: '123456789',
    runAttempt: 2,
    headSha: '6'.repeat(40),
    jobKey: `runtime-batch-${batchId}`,
    matrixIdentity: `${candidate.candidateToken}-${tuple.tuple}`,
  };
  return buildReplacementRuntimeReceipt({
    context,
    candidate,
    task,
    stages: passedStages(candidate),
    ci,
  });
}

function receiptsForCandidates(context, count, workflowSha256) {
  return context.plan.candidates.slice(0, count).flatMap((candidate) =>
    REPLACEMENT_RUNTIME_TUPLES.map((tuple) =>
      syntheticReceipt(context, candidate, tuple, workflowSha256)
    )
  );
}

test('checked-in replacement plan is reproducible, ID-less, bound, and pending', async () => {
  const context = await loadReplacementRuntimePlan();
  assert.equal(context.plan.status, 'runtime-input-authority-pending');
  assert.equal(context.plan.authorityEffect, 'candidate-evidence-only-never-install-authority');
  assert.equal(context.migrationMapSha256, REPLACEMENT_MAP_SHA256);
  assert.equal(
    context.plan.harnessReleaseAuthoritySha256,
    REPLACEMENT_HARNESS_AUTHORITY_SHA256
  );
  assert.equal(context.plan.candidates.length, 44);
  assert.ok(
    context.plan.candidates.every(
      (candidate) =>
        !Object.hasOwn(candidate, 'catalogId') &&
        !Object.hasOwn(candidate, 'publicId') &&
        candidate.status === 'runtime-input-pending' &&
        candidate.runtimeInput === null
    )
  );
  assert.equal(
    canonicalReplacementRuntimePlanJson(buildPendingReplacementRuntimePlan(context.map, context)),
    context.planBytes.toString('utf8')
  );
  assert.throws(
    () => requireReadyReplacementRuntimePlan(context.plan, context.map, context),
    /pending; refusing candidate execution and Public ID allocation/
  );
});

test('four replacement batches are exact and cannot expand while pending', async () => {
  const base = await loadReplacementRuntimePlan();
  const pendingBatchPlan = buildReplacementRuntimeBatchPlan(base);
  const planner = spawnSync(process.execPath, [batchScriptPath, 'plan'], {
    encoding: 'utf8',
  });
  assert.notEqual(planner.status, 0);
  assert.match(
    planner.stderr,
    /pending; refusing candidate execution and Public ID allocation/
  );
  assert.throws(
    () => replacementRuntimeMatrixForBatch(pendingBatchPlan, base, 1),
    /pending; refusing candidate execution/
  );

  const context = readyContext(base);
  const all = [];
  for (let batchId = 1; batchId <= 4; batchId += 1) {
    const matrix = replacementRuntimeMatrixForBatch(
      context.batchPlan,
      context,
      batchId
    );
    assert.equal(matrix.include.length, 66);
    assert.equal(new Set(matrix.include.map((entry) => entry.candidateToken)).size, 11);
    assert.ok(
      matrix.include.every(
        (entry) =>
          !Object.hasOwn(entry, 'catalogId') &&
          !Object.hasOwn(entry, 'publicId') &&
          /^[a-f0-9]{40}$/u.test(entry.commit) &&
          /^[a-f0-9]{40}$/u.test(entry.tree)
      )
    );
    all.push(...matrix.include.map((entry) => `${entry.candidateToken}:${entry.tuple}`));
  }
  assert.equal(all.length, 264);
  assert.equal(new Set(all).size, 264);

  const reordered = structuredClone(context.batchPlan);
  [reordered.batches[0].candidateTokens[0], reordered.batches[0].candidateTokens[1]] = [
    reordered.batches[0].candidateTokens[1],
    reordered.batches[0].candidateTokens[0],
  ];
  assert.throws(
    () => validateReplacementRuntimeBatchPlan(reordered, context),
    /canonical eleven-candidate slices/
  );
});

test('ready plan keeps direct and hosted candidate inputs in separate non-installing lanes', async () => {
  const context = readyContext(await loadReplacementRuntimePlan());
  const direct = context.plan.candidates.find(
    (candidate) => candidate.distributionClass === 'direct-upstream-exact'
  );
  const hosted = context.plan.candidates.find(
    (candidate) => candidate.distributionClass === 'hosted-adaptation-required'
  );
  assert.match(direct.runtimeInput.artifact.kind, /^upstream-/u);
  assert.equal(direct.runtimeInput.artifact.locator, direct.source.exactCoordinate);
  assert.equal(direct.runtimeInput.artifact.buildRecipePath, null);
  assert.equal(hosted.runtimeInput.artifact.kind, 'hosted-adaptation-staging-tarball');
  assert.equal(
    hosted.runtimeInput.artifact.locator,
    `staging-sha256:${hosted.runtimeInput.artifact.sha256}`
  );
  assert.match(hosted.runtimeInput.artifact.buildRecipePath, /plugin-replacement-runtime-build-recipes/u);

  const disguisedHosted = structuredClone(context.plan);
  const item = disguisedHosted.candidates.find(
    (candidate) => candidate.distributionClass === 'hosted-adaptation-required'
  );
  item.runtimeInput.artifact.kind = 'upstream-npm-tarball';
  assert.throws(
    () => validateReplacementRuntimePlan(disguisedHosted, context.map, context),
    /closed candidate-only runtime input/
  );
});

test('one passed receipt is one-of-six only and rejects drift or secret capture', async () => {
  const context = readyContext(await loadReplacementRuntimePlan());
  const workflowSha256 = sha256(await readFile(workflowPath));
  const candidate = context.plan.candidates[0];
  const receipt = syntheticReceipt(
    context,
    candidate,
    REPLACEMENT_RUNTIME_TUPLES[0],
    workflowSha256
  );
  assert.doesNotThrow(() =>
    validateReplacementRuntimeReceipt(receipt, { context, candidate })
  );
  assert.equal(receipt.authorityEffect, 'one-of-six-candidate-evidence-only');
  assert.ok(!Object.hasOwn(receipt.candidate, 'publicId'));
  assert.equal(receipt.privacy.capturesSecretDerivedDigests, false);
  assert.doesNotMatch(
    canonicalReplacementRuntimeJson(receipt),
    /profileBeforeSha256|profileAfterInstallSha256|dependencyClosureBeforeSha256/u
  );

  const artifactDrift = structuredClone(receipt);
  artifactDrift.candidate.artifact.sha256 = 'f'.repeat(64);
  assert.throws(
    () => validateReplacementRuntimeReceipt(artifactDrift, { context, candidate }),
    /does not match the exact runtime plan/
  );

  const partialRollback = structuredClone(receipt);
  partialRollback.stages.fullRollback.noWritesOutsideDeclaredRoots = false;
  assert.throws(
    () => validateReplacementRuntimeReceipt(partialRollback, { context, candidate }),
    /complete isolated closure/
  );

  const secretCapture = structuredClone(receipt);
  secretCapture.privacy.capturesCandidateOutput = true;
  assert.throws(
    () => validateReplacementRuntimeReceipt(secretCapture, { context, candidate }),
    /privacy boundary/
  );
});

test('aggregate proposes sequential #3089 IDs only for 6-of-6 candidates', async () => {
  const context = readyContext(await loadReplacementRuntimePlan());
  const workflowSha256 = sha256(await readFile(workflowPath));
  const receipts = receiptsForCandidates(context, 28, workflowSha256);
  receipts.push(
    ...REPLACEMENT_RUNTIME_TUPLES.slice(0, 5).map((tuple) =>
      syntheticReceipt(context, context.plan.candidates[28], tuple, workflowSha256)
    )
  );
  const aggregate = aggregateReplacementRuntimeReceipts(receipts, {
    context,
    workflowSha256,
    aggregateCi: aggregateCi(workflowSha256),
  });
  assert.equal(aggregate.receiptSet.qualifiedCandidateCount, 28);
  assert.equal(aggregate.receiptSet.observedPassedTaskReceipts, 173);
  assert.equal(aggregate.proposal.entries.length, 28);
  assert.deepEqual(
    aggregate.proposal.entries.map((entry) => entry.proposedPublicId),
    Array.from({ length: 28 }, (_, index) => 3089 + index)
  );
  assert.deepEqual(
    aggregate.proposal.entries.map((entry) => entry.candidateKey),
    context.plan.candidates.slice(0, 28).map((candidate) => candidate.candidateKey)
  );
  assert.ok(
    aggregate.proposal.entries
      .filter((entry) => entry.distributionClass === 'hosted-adaptation-required')
      .every((entry) => entry.distributionDisposition === 'hosted-adaptation-candidate-only')
  );
  assert.equal(aggregate.proposal.installable, false);
  assert.equal(aggregate.proposal.writesPluginAuthorityItems, false);
  assert.doesNotThrow(() =>
    validateReplacementAllocationProposal(
      aggregate.proposal,
      aggregate.receiptSet,
      context
    )
  );
  assert.doesNotThrow(() =>
    verifyReplacementRuntimeAggregate(aggregate, { context, workflowSha256 })
  );
});

test('27 complete candidates, five-of-six, duplicate tasks, and run-attempt reuse fail closed', async () => {
  const context = readyContext(await loadReplacementRuntimePlan());
  const workflowSha256 = sha256(await readFile(workflowPath));
  const options = {
    context,
    workflowSha256,
    aggregateCi: aggregateCi(workflowSha256),
  };
  assert.throws(
    () =>
      aggregateReplacementRuntimeReceipts(
        receiptsForCandidates(context, 27, workflowSha256),
        options
      ),
    /only 27 replacement candidates passed 6\/6/
  );

  const complete = receiptsForCandidates(context, 28, workflowSha256);
  assert.throws(
    () => aggregateReplacementRuntimeReceipts([...complete, complete[0]], options),
    /duplicate replacement candidate\/tuple receipt/
  );

  const reused = structuredClone(complete);
  reused[0].ci.runAttempt = 1;
  assert.throws(
    () => aggregateReplacementRuntimeReceipts(reused, options),
    /different workflow run or attempt/
  );
});

test('GitHub context, schemas, workflow, and action preserve the non-installing boundary', async () => {
  const [workflowSource, actionSource, planSchema, receiptSchema, setSchema, proposalSchema] =
    await Promise.all([
      readFile(workflowPath, 'utf8'),
      readFile(actionPath, 'utf8'),
      readFile(
        'skills/dsh-plugin-installer/references/plugin-replacement-runtime-plan.schema.json',
        'utf8'
      ).then(JSON.parse),
      readFile(
        'skills/dsh-plugin-installer/references/plugin-replacement-runtime-receipt.schema.json',
        'utf8'
      ).then(JSON.parse),
      readFile(
        'skills/dsh-plugin-installer/references/plugin-replacement-runtime-receipt-set.schema.json',
        'utf8'
      ).then(JSON.parse),
      readFile(
        'skills/dsh-plugin-installer/references/plugin-replacement-id-proposal.schema.json',
        'utf8'
      ).then(JSON.parse),
    ]);
  const workflow = parse(workflowSource);
  const action = parse(actionSource);
  assert.equal(workflow.permissions.contents, 'read');
  assert.equal(workflow.jobs.plan.outputs['batch-4'], '${{ steps.matrix.outputs.batch-4 }}');
  assert.equal(workflow.jobs['runtime-batch-1'].strategy['fail-fast'], false);
  assert.match(workflow.jobs.aggregate.if, /always\(\)/u);
  assert.equal(workflow.jobs.sign.permissions['id-token'], 'write');
  assert.equal(workflow.jobs['verify-signed'].permissions.contents, 'read');
  assert.match(workflowSource, /matrix_batch_1="\$\(node [^\n]+ --batch 1\)"/u);
  assert.doesNotMatch(workflowSource, /echo "batch-[1-4]=\$\(node/u);
  assert.equal(action.inputs['candidate-key'].required, true);
  assert.equal(action.inputs.tree.required, true);
  assert.match(actionSource, /persist-credentials: false/u);
  assert.match(actionSource, /plugin-replacement-runtime-fixed-executor\.mjs/u);
  assert.doesNotMatch(actionSource, /plugin-authority\.json/u);
  assert.equal(planSchema.additionalProperties, false);
  assert.equal(planSchema.properties.candidates.minItems, 44);
  assert.equal(planSchema.properties.harnessReleaseAuthoritySha256.const, REPLACEMENT_HARNESS_AUTHORITY_SHA256);
  assert.equal(receiptSchema.additionalProperties, false);
  assert.equal(setSchema.properties.qualifiedCandidateCount.minimum, 28);
  assert.equal(proposalSchema.properties.installable.const, false);
  assert.equal(proposalSchema.properties.writesPluginAuthorityItems.const, false);

  const workflowSha256 = sha256(Buffer.from(workflowSource));
  const environment = {
    GITHUB_ACTIONS: 'true',
    GITHUB_REPOSITORY: 'LvvUP/dsh-themes-skills',
    GITHUB_WORKFLOW: 'alpha2 Plugin replacement runtime certification',
    GITHUB_WORKFLOW_REF:
      'LvvUP/dsh-themes-skills/.github/workflows/alpha2-plugin-replacement-runtime-certification.yml@refs/heads/main',
    GITHUB_EVENT_NAME: 'workflow_dispatch',
    GITHUB_REF: 'refs/heads/main',
    GITHUB_JOB: 'runtime-batch-2',
    GITHUB_RUN_ID: '123456789',
    GITHUB_RUN_ATTEMPT: '2',
    GITHUB_SHA: '6'.repeat(40),
  };
  const task = {
    batchId: 2,
    candidateToken: 'replacement-12-0123456789abcdef0123',
    tuple: REPLACEMENT_RUNTIME_TUPLES[0].tuple,
  };
  assert.doesNotThrow(() =>
    validateReplacementRuntimeGithubIdentity(environment, task, workflowSha256)
  );
  assert.throws(
    () =>
      validateReplacementRuntimeGithubIdentity(
        { ...environment, GITHUB_RUN_ATTEMPT: '0' },
        task,
        workflowSha256
      ),
    /exact protected GitHub context/
  );
});

test('candidate keys are internal selectors and never user installation IDs', async () => {
  const context = await loadReplacementRuntimePlan();
  const serializedCandidates = canonicalReplacementRuntimeJson(context.plan.candidates);
  assert.doesNotMatch(serializedCandidates, /"(?:catalogId|publicId)"/u);
  assert.match(serializedCandidates, /"candidateKey"/u);
  assert.match(serializedCandidates, /"candidateToken"/u);
  assert.equal(context.plan.allocationPolicy.candidateKeysArePublicIds, false);
  assert.equal(context.plan.allocationPolicy.writesPluginAuthorityItems, false);
});

test('custom Sigstore handoff must contain the exact local evidence predicate bytes', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-replacement-bundle-'));
  try {
    const predicate = {
      migrationMapSha256: REPLACEMENT_MAP_SHA256,
      receiptSetSha256: deterministicSha('receipt-set'),
    };
    const predicatePath = join(root, 'predicate.json');
    const bundlePath = join(root, 'bundle.json');
    await writeFile(predicatePath, canonicalReplacementRuntimeJson(predicate), { mode: 0o600 });
    const statement = {
      _type: 'https://in-toto.io/Statement/v1',
      subject: [{ name: 'proposal', digest: { sha256: deterministicSha('proposal') } }],
      predicateType:
        'https://dsh-themes.com/attestations/plugin-alpha2-replacement-runtime-evidence/v1',
      predicate,
    };
    await writeFile(
      bundlePath,
      `${JSON.stringify({
        dsseEnvelope: {
          payloadType: 'application/vnd.in-toto+json',
          payload: Buffer.from(JSON.stringify(statement)).toString('base64'),
          signatures: [],
        },
      })}\n`,
      { mode: 0o600 }
    );
    await assert.doesNotReject(() =>
      bindReplacementRuntimeCustomAttestationPredicate({
        bundle: bundlePath,
        predicate: predicatePath,
      })
    );
    predicate.receiptSetSha256 = deterministicSha('other-receipt-set');
    await writeFile(predicatePath, canonicalReplacementRuntimeJson(predicate), { mode: 0o600 });
    await assert.rejects(
      () =>
        bindReplacementRuntimeCustomAttestationPredicate({
          bundle: bundlePath,
          predicate: predicatePath,
        }),
      /does not match the verified local evidence bytes/
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
