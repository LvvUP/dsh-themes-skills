#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { validateCandidateIntake } from './candidate-intake.mjs';

const planUrl = new URL('../references/plugin-runtime-candidate-plan.json', import.meta.url);
const intakeUrl = new URL('../references/plugin-candidate-intake.json', import.meta.url);

const SHA40 = /^[a-f0-9]{40}$/u;
const SHA256 = /^[a-f0-9]{64}$/u;
const SAFE_ID = /^[a-z0-9]+(?:[._:-][a-z0-9]+)*$/u;
const SAFE_PATH = /^(?:[A-Za-z0-9._-]+\/)*[A-Za-z0-9._-]+$/u;
const SAFE_SUBDIR = /^(?:\.|[A-Za-z0-9_-]+(?:[A-Za-z0-9._-]*[A-Za-z0-9_-])?(?:\/[A-Za-z0-9_-]+(?:[A-Za-z0-9._-]*[A-Za-z0-9_-])?)*)$/u;
const ARTIFACT_KINDS = new Set(['npm-tarball', 'github-release-asset', 'hosted-staging-tarball']);

function fail(message) {
  throw new Error(message);
}

function exactKeys(value, keys, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value) ||
      JSON.stringify(Object.keys(value).sort()) !== JSON.stringify([...keys].sort())) {
    fail(`${label} keys mismatch`);
  }
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
}

export function canonicalPluginRuntimePlanJson(value) {
  return `${JSON.stringify(stable(value), null, 2)}\n`;
}

export function buildPendingPluginRuntimeCandidatePlan(intake, intakeSha256) {
  validateCandidateIntake(intake);
  const plan = {
    schemaVersion: 1,
    purpose: 'dsh-plugin-alpha1-runtime-candidate-plan',
    status: 'runtime-artifact-and-probe-authority-pending',
    authorityEffect: 'none-not-installation-authority',
    candidateIntakeSha256: intakeSha256,
    baseline: {
      tag: 'dsh-v0.1.2-alpha.1',
      commit: 'cd5ef8148158c3a752a658978873241fdf8e2bbc',
      tree: 'a712eec535b48badc4fefb4df5176a7002e4280b',
      lockfileSha256: '506ad1fc7c40f71ce8c6afe08724fdd55020c1a527d7a7a185c559d39ecfcaf1',
    },
    matrix: {
      batchCount: 4,
      candidatesPerBatch: 20,
      tasksPerCandidate: 6,
      requiredCandidates: 80,
    },
    items: intake.items.map((item) => ({
      catalogId: item.catalogId,
      slug: item.slug,
      repository: item.repository,
      commit: item.commit,
      sourceSubdir: item.sourceSubdir ?? '.',
      status: 'runtime-authority-pending',
      artifact: null,
      functionalProbe: null,
    })),
  };
  return validatePluginRuntimeCandidatePlan(plan, intake, intakeSha256);
}

function validateReadyItem(item, candidate, label) {
  exactKeys(
    item.artifact,
    ['kind', 'locator', 'bytes', 'sha256', 'source', 'distribution'],
    `${label}.artifact`
  );
  exactKeys(item.artifact.source, ['repository', 'commit', 'tree', 'sourceSubdir'], `${label}.artifact.source`);
  exactKeys(item.artifact.distribution, [
    'sourceType', 'immutableCoordinate', 'metadataPath', 'metadataSha256',
    'buildRecipePath', 'buildRecipeSha256',
  ], `${label}.artifact.distribution`);
  if (!ARTIFACT_KINDS.has(item.artifact.kind) ||
      typeof item.artifact.locator !== 'string' || item.artifact.locator.length < 1 ||
      item.artifact.locator.length > 500 || /[\u0000-\u001f\u007f]/u.test(item.artifact.locator) ||
      !Number.isSafeInteger(item.artifact.bytes) || item.artifact.bytes < 1 ||
      item.artifact.bytes > 1024 * 1024 * 1024 || !SHA256.test(item.artifact.sha256 ?? '') ||
      item.artifact.source.repository !== candidate.repository ||
      item.artifact.source.commit !== candidate.commit ||
      !SHA40.test(item.artifact.source.tree ?? '') ||
      item.artifact.source.sourceSubdir !== (candidate.sourceSubdir ?? '.')) {
    fail(`${label} artifact is not one exact source-bound immutable candidate`);
  }
  const distribution = item.artifact.distribution;
  const expectedSourceType = {
    'npm-tarball': 'npm-registry-tarball',
    'github-release-asset': 'github-release-asset',
    'hosted-staging-tarball': 'reviewed-hosted-staging-build',
  }[item.artifact.kind];
  if (distribution.sourceType !== expectedSourceType ||
      distribution.immutableCoordinate !== item.artifact.locator ||
      distribution.metadataPath !==
        `skills/dsh-plugin-installer/references/plugin-runtime-artifact-metadata/${item.catalogId}.json` ||
      !SHA256.test(distribution.metadataSha256 ?? '')) {
    fail(`${label} artifact distribution source is not explicitly digest-bound`);
  }
  if (item.artifact.kind === 'hosted-staging-tarball') {
    if (!SAFE_PATH.test(distribution.buildRecipePath ?? '') ||
        !distribution.buildRecipePath.startsWith(
          'skills/dsh-plugin-installer/references/plugin-runtime-build-recipes/'
        ) || distribution.buildRecipePath !==
          `skills/dsh-plugin-installer/references/plugin-runtime-build-recipes/${item.catalogId}.json` ||
        !SHA256.test(distribution.buildRecipeSha256 ?? '')) {
      fail(`${label} hosted artifact lacks one reviewed digest-bound build recipe`);
    }
  } else if (distribution.buildRecipePath !== null || distribution.buildRecipeSha256 !== null) {
    fail(`${label} upstream npm/release artifact must not claim a hosted build recipe`);
  }
  exactKeys(
    item.functionalProbe,
    ['contractPath', 'contractSha256', 'requiredAssertions'],
    `${label}.functionalProbe`
  );
  if (!SAFE_PATH.test(item.functionalProbe.contractPath ?? '') ||
      item.functionalProbe.contractPath !==
        `skills/dsh-plugin-installer/references/plugin-runtime-probes/${item.catalogId}.json` ||
      !SHA256.test(item.functionalProbe.contractSha256 ?? '') ||
      !Array.isArray(item.functionalProbe.requiredAssertions) ||
      item.functionalProbe.requiredAssertions.length < 1 ||
      item.functionalProbe.requiredAssertions.length > 32 ||
      item.functionalProbe.requiredAssertions.some((value) => !SAFE_ID.test(value)) ||
      new Set(item.functionalProbe.requiredAssertions).size !== item.functionalProbe.requiredAssertions.length) {
    fail(`${label} functional probe contract is not one closed declarative authority`);
  }
}

export function validatePluginRuntimeCandidatePlan(plan, intake, intakeSha256) {
  validateCandidateIntake(intake);
  exactKeys(plan, [
    'schemaVersion', 'purpose', 'status', 'authorityEffect', 'candidateIntakeSha256',
    'baseline', 'matrix', 'items',
  ], 'plugin runtime candidate plan');
  if (plan.schemaVersion !== 1 || plan.purpose !== 'dsh-plugin-alpha1-runtime-candidate-plan' ||
      !['runtime-artifact-and-probe-authority-pending', 'runtime-candidates-ready'].includes(plan.status) ||
      plan.authorityEffect !== 'none-not-installation-authority' ||
      plan.candidateIntakeSha256 !== intakeSha256 || !SHA256.test(plan.candidateIntakeSha256 ?? '')) {
    fail('plugin runtime candidate plan header or intake binding mismatch');
  }
  exactKeys(plan.baseline, ['tag', 'commit', 'tree', 'lockfileSha256'], 'runtime plan baseline');
  if (plan.baseline.tag !== 'dsh-v0.1.2-alpha.1' ||
      plan.baseline.commit !== 'cd5ef8148158c3a752a658978873241fdf8e2bbc' ||
      plan.baseline.tree !== 'a712eec535b48badc4fefb4df5176a7002e4280b' ||
      plan.baseline.lockfileSha256 !== '506ad1fc7c40f71ce8c6afe08724fdd55020c1a527d7a7a185c559d39ecfcaf1') {
    fail('plugin runtime candidate plan baseline mismatch');
  }
  exactKeys(plan.matrix, [
    'batchCount', 'candidatesPerBatch', 'tasksPerCandidate', 'requiredCandidates',
  ], 'runtime plan matrix');
  if (plan.matrix.batchCount !== 4 || plan.matrix.candidatesPerBatch !== 20 ||
      plan.matrix.tasksPerCandidate !== 6 || plan.matrix.requiredCandidates !== 80 ||
      !Array.isArray(plan.items) || plan.items.length !== 80) {
    fail('runtime plan matrix must be exactly four by twenty by six');
  }
  const ready = [];
  for (let index = 0; index < plan.items.length; index += 1) {
    const item = plan.items[index];
    const candidate = intake.items[index];
    const label = `runtime candidate plan items[${index}]`;
    exactKeys(item, [
      'catalogId', 'slug', 'repository', 'commit', 'sourceSubdir', 'status',
      'artifact', 'functionalProbe',
    ], label);
    if (item.catalogId !== candidate.catalogId || item.slug !== candidate.slug ||
        item.repository !== candidate.repository || item.commit !== candidate.commit ||
        item.sourceSubdir !== (candidate.sourceSubdir ?? '.') || !SAFE_SUBDIR.test(item.sourceSubdir)) {
      fail(`${label} does not match editorial source identity`);
    }
    if (item.status === 'runtime-authority-pending') {
      if (item.artifact !== null || item.functionalProbe !== null) {
        fail(`${label} pending entry must not carry partial runtime authority`);
      }
      ready.push(false);
    } else if (item.status === 'runtime-candidate-ready') {
      validateReadyItem(item, candidate, label);
      ready.push(true);
    } else {
      fail(`${label} status mismatch`);
    }
  }
  if (plan.status === 'runtime-candidates-ready' && ready.some((value) => !value)) {
    fail('ready runtime plan requires all 80 exact artifacts and probe contracts');
  }
  if (plan.status === 'runtime-artifact-and-probe-authority-pending' && ready.some(Boolean)) {
    fail('pending runtime plan cannot partially authorize candidate execution');
  }
  return plan;
}

export function requireReadyPluginRuntimeCandidatePlan(plan, intake, intakeSha256) {
  validatePluginRuntimeCandidatePlan(plan, intake, intakeSha256);
  if (plan.status !== 'runtime-candidates-ready' ||
      plan.items.some((item) => item.status !== 'runtime-candidate-ready')) {
    fail('plugin runtime candidate plan is pending; refusing candidate execution and 80/80 receipts');
  }
  return plan;
}

export async function loadPluginRuntimeCandidatePlan() {
  const [intakeBytes, planBytes] = await Promise.all([readFile(intakeUrl), readFile(planUrl)]);
  const intake = validateCandidateIntake(JSON.parse(intakeBytes));
  const intakeSha256 = sha256(intakeBytes);
  const plan = validatePluginRuntimeCandidatePlan(JSON.parse(planBytes), intake, intakeSha256);
  return {
    intake,
    intakeSha256,
    plan,
    planBytes,
    planSha256: sha256(planBytes),
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length === 3 && process.argv[2] === 'generate-pending') {
      const intakeBytes = await readFile(intakeUrl);
      const intake = validateCandidateIntake(JSON.parse(intakeBytes));
      process.stdout.write(canonicalPluginRuntimePlanJson(
        buildPendingPluginRuntimeCandidatePlan(intake, sha256(intakeBytes))
      ));
      process.exit(0);
    }
    if (process.argv.length === 3 && process.argv[2] === 'check-pending') {
      const context = await loadPluginRuntimeCandidatePlan();
      const expected = Buffer.from(canonicalPluginRuntimePlanJson(
        buildPendingPluginRuntimeCandidatePlan(context.intake, context.intakeSha256)
      ));
      if (!expected.equals(context.planBytes)) {
        fail('checked-in pending runtime plan is stale; regenerate from the current intake bytes');
      }
      process.stdout.write(`${JSON.stringify({
        valid: true,
        reproducible: true,
        planSha256: context.planSha256,
      })}\n`);
      process.exit(0);
    }
    if (process.argv.length !== 2) {
      fail('usage: plugin-runtime-plan.mjs [generate-pending|check-pending]');
    }
    const context = await loadPluginRuntimeCandidatePlan();
    process.stdout.write(`${JSON.stringify({
      valid: true,
      status: context.plan.status,
      authorityEffect: context.plan.authorityEffect,
      candidateCount: context.plan.items.length,
      readyCount: context.plan.items.filter((item) => item.status === 'runtime-candidate-ready').length,
      planSha256: context.planSha256,
    })}\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
