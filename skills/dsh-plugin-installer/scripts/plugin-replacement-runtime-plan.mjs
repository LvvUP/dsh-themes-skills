#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { validateAlpha2PluginMigrationMap } from './validate-alpha2-plugin-migration-map.mjs';

const mapUrl = new URL('../references/alpha2-plugin-migration-map.json', import.meta.url);
const mapSchemaUrl = new URL(
  '../references/alpha2-plugin-migration-map.schema.json',
  import.meta.url
);
const planUrl = new URL(
  '../references/plugin-replacement-runtime-plan.json',
  import.meta.url
);
const intakeUrl = new URL('../references/plugin-candidate-intake.json', import.meta.url);
const harnessAuthorityUrl = new URL(
  '../../dsh-harness-installer/references/alpha2-release-authority.json',
  import.meta.url
);

export const REPLACEMENT_MAP_SHA256 =
  'd113a04a1d64ceeea6068624433ef60fe5e192c0ccecd1a39b76d31f5c802005';
export const REPLACEMENT_MAP_SCHEMA_SHA256 =
  '48ceef982d6a86856c925c1cec3d319c00d2ec3809383b7c7d200afcc88a87a3';
export const REPLACEMENT_HARNESS_AUTHORITY_SHA256 =
  '100e24ea87e111a7abb13aab5d8c81e38585319c27ea09ce82e62dd4fcc80094';
export const REPLACEMENT_CANDIDATE_COUNT = 44;
export const REPLACEMENT_ALLOCATION_COUNT = 28;
export const REPLACEMENT_FIRST_PUBLIC_ID = 3089;

export const REPLACEMENT_BASELINE = Object.freeze({
  tag: 'dsh-v0.1.2-alpha.2',
  commit: '0a53fb55bea101816fa226bb964ae2bed71c343b',
  tree: '64ccbfa8e0caa4711cd4a75717ef9e022657961b',
  lockfileSha256: '6cc109a574218f51762474455c8d72e5f7c2625aedf25e85569dba1af7adcef0',
});

const SHA256 = /^[a-f0-9]{64}$/u;
const SHA40 = /^[a-f0-9]{40}$/u;
const SAFE_TOKEN = /^replacement-(?:0[1-9]|[1-3][0-9]|4[0-4])-[a-f0-9]{20}$/u;
const SAFE_PATH = /^(?:[A-Za-z0-9._-]+\/)*[A-Za-z0-9._-]+$/u;
const SAFE_ASSERTION = /^[a-z0-9]+(?:[._:-][a-z0-9]+)*$/u;

function fail(message) {
  throw new Error(message);
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
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

export function canonicalReplacementRuntimePlanJson(value) {
  return `${JSON.stringify(stable(value), null, 2)}\n`;
}

export function replacementCandidateToken(candidate) {
  if (!Number.isSafeInteger(candidate?.rank) || typeof candidate?.candidateKey !== 'string') {
    fail('replacement candidate token requires one frozen rank and candidate key');
  }
  const rank = String(candidate.rank).padStart(2, '0');
  return `replacement-${rank}-${sha256(Buffer.from(candidate.candidateKey)).slice(0, 20)}`;
}

function expectedMetadataPath(candidateToken) {
  return (
    'skills/dsh-plugin-installer/references/' +
    `plugin-replacement-runtime-artifact-metadata/${candidateToken}.json`
  );
}

function expectedRecipePath(candidateToken) {
  return (
    'skills/dsh-plugin-installer/references/' +
    `plugin-replacement-runtime-build-recipes/${candidateToken}.json`
  );
}

function expectedProbePath(candidateToken) {
  return (
    'skills/dsh-plugin-installer/references/' +
    `plugin-replacement-runtime-probes/${candidateToken}.json`
  );
}

function validateReadyRuntimeInput(runtimeInput, candidate, candidateToken, label) {
  exactKeys(runtimeInput, ['artifact', 'functionalProbe'], label);
  exactKeys(
    runtimeInput.artifact,
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
    `${label}.artifact`
  );
  exactKeys(
    runtimeInput.functionalProbe,
    ['contractPath', 'contractSha256', 'requiredAssertions'],
    `${label}.functionalProbe`
  );

  const artifact = runtimeInput.artifact;
  const probe = runtimeInput.functionalProbe;
  const expectedKind = {
    'npm-exact': 'upstream-npm-tarball',
    'github-release-exact': 'upstream-github-release-asset',
    'hosted-adaptation-required': 'hosted-adaptation-staging-tarball',
  }[candidate.upstreamInstall.mode];
  if (
    artifact.kind !== expectedKind ||
    typeof artifact.locator !== 'string' ||
    artifact.locator.length < 3 ||
    artifact.locator.length > 500 ||
    /[\u0000-\u001f\u007f]/u.test(artifact.locator) ||
    !Number.isSafeInteger(artifact.bytes) ||
    artifact.bytes < 1 ||
    artifact.bytes > 1024 * 1024 * 1024 ||
    !SHA256.test(artifact.sha256 ?? '') ||
    artifact.metadataPath !== expectedMetadataPath(candidateToken) ||
    !SAFE_PATH.test(artifact.metadataPath) ||
    !SHA256.test(artifact.metadataSha256 ?? '')
  ) {
    fail(`${label} artifact is not one closed candidate-only runtime input`);
  }

  if (candidate.distributionClass === 'direct-upstream-exact') {
    if (
      artifact.locator !== candidate.upstreamInstall.exactCoordinate ||
      artifact.buildRecipePath !== null ||
      artifact.buildRecipeSha256 !== null
    ) {
      fail(`${label} direct artifact drifted from its exact upstream coordinate`);
    }
  } else if (
    artifact.locator !== `staging-sha256:${artifact.sha256}` ||
    artifact.buildRecipePath !== expectedRecipePath(candidateToken) ||
    !SAFE_PATH.test(artifact.buildRecipePath) ||
    !SHA256.test(artifact.buildRecipeSha256 ?? '')
  ) {
    fail(
      `${label} hosted candidate must remain a digest-bound non-installing adaptation input`
    );
  }

  if (
    probe.contractPath !== expectedProbePath(candidateToken) ||
    !SAFE_PATH.test(probe.contractPath) ||
    !SHA256.test(probe.contractSha256 ?? '') ||
    !Array.isArray(probe.requiredAssertions) ||
    probe.requiredAssertions.length < 1 ||
    probe.requiredAssertions.length > 32 ||
    probe.requiredAssertions.some((value) => !SAFE_ASSERTION.test(value)) ||
    new Set(probe.requiredAssertions).size !== probe.requiredAssertions.length
  ) {
    fail(`${label} lacks one closed capability probe contract`);
  }
}

function exactCandidateSource(candidate) {
  return {
    repository: candidate.repository,
    commit: candidate.commit,
    tree: candidate.tree,
    sourceSubdir: candidate.sourceSubdir,
    exactCoordinate: candidate.upstreamInstall.exactCoordinate,
  };
}

export function buildPendingReplacementRuntimePlan(map, bindings) {
  validateAlpha2PluginMigrationMap(map, bindings.validationOptions);
  const retiredPublicIds = map.retired.map((item) => item.catalogId);
  const plan = {
    schemaVersion: 1,
    purpose: 'dsh-plugin-alpha2-replacement-runtime-plan',
    status: 'runtime-input-authority-pending',
    authorityEffect: 'candidate-evidence-only-never-install-authority',
    migrationMapSha256: bindings.migrationMapSha256,
    migrationMapSchemaSha256: bindings.migrationMapSchemaSha256,
    harnessReleaseAuthoritySha256: bindings.harnessReleaseAuthoritySha256,
    baseline: { ...REPLACEMENT_BASELINE },
    matrix: {
      batchCount: 4,
      candidatesPerBatch: 11,
      tasksPerCandidate: 6,
      totalCandidates: REPLACEMENT_CANDIDATE_COUNT,
      totalTasks: REPLACEMENT_CANDIDATE_COUNT * 6,
    },
    allocationPolicy: {
      candidateKeysArePublicIds: false,
      allocateOnlyAfterSixTaskPass: true,
      firstPublicId: REPLACEMENT_FIRST_PUBLIC_ID,
      requiredAllocationCount: REPLACEMENT_ALLOCATION_COUNT,
      retiredPublicIds,
      retiredIdsMayBeRebound: false,
      writesPluginAuthorityItems: false,
    },
    candidates: map.replacementCandidates.map((candidate) => ({
      rank: candidate.rank,
      candidateKey: candidate.candidateKey,
      candidateToken: replacementCandidateToken(candidate),
      packageName: candidate.packageName,
      packageVersion: candidate.packageVersion,
      distributionClass: candidate.distributionClass,
      source: exactCandidateSource(candidate),
      status: 'runtime-input-pending',
      runtimeInput: null,
    })),
  };
  return validateReplacementRuntimePlan(plan, map, bindings);
}

export function validateReplacementRuntimePlan(plan, map, bindings) {
  validateAlpha2PluginMigrationMap(map, bindings.validationOptions);
  exactKeys(
    plan,
    [
      'schemaVersion',
      'purpose',
      'status',
      'authorityEffect',
      'migrationMapSha256',
      'migrationMapSchemaSha256',
      'harnessReleaseAuthoritySha256',
      'baseline',
      'matrix',
      'allocationPolicy',
      'candidates',
    ],
    'replacement runtime plan'
  );
  if (
    plan.schemaVersion !== 1 ||
    plan.purpose !== 'dsh-plugin-alpha2-replacement-runtime-plan' ||
    !['runtime-input-authority-pending', 'runtime-candidates-ready'].includes(plan.status) ||
    plan.authorityEffect !== 'candidate-evidence-only-never-install-authority' ||
    plan.migrationMapSha256 !== bindings.migrationMapSha256 ||
    plan.migrationMapSchemaSha256 !== bindings.migrationMapSchemaSha256 ||
    plan.harnessReleaseAuthoritySha256 !== bindings.harnessReleaseAuthoritySha256 ||
    plan.migrationMapSha256 !== REPLACEMENT_MAP_SHA256 ||
    plan.migrationMapSchemaSha256 !== REPLACEMENT_MAP_SCHEMA_SHA256 ||
    plan.harnessReleaseAuthoritySha256 !== REPLACEMENT_HARNESS_AUTHORITY_SHA256
  ) {
    fail('replacement runtime plan header or migration-map binding mismatch');
  }
  exactKeys(plan.baseline, Object.keys(REPLACEMENT_BASELINE), 'replacement baseline');
  if (canonicalReplacementRuntimePlanJson(plan.baseline) !== canonicalReplacementRuntimePlanJson(REPLACEMENT_BASELINE)) {
    fail('replacement runtime plan does not bind the exact alpha.2 baseline');
  }
  exactKeys(
    plan.matrix,
    ['batchCount', 'candidatesPerBatch', 'tasksPerCandidate', 'totalCandidates', 'totalTasks'],
    'replacement matrix'
  );
  if (
    plan.matrix.batchCount !== 4 ||
    plan.matrix.candidatesPerBatch !== 11 ||
    plan.matrix.tasksPerCandidate !== 6 ||
    plan.matrix.totalCandidates !== 44 ||
    plan.matrix.totalTasks !== 264
  ) {
    fail('replacement runtime matrix must be exactly four by eleven by six');
  }
  exactKeys(
    plan.allocationPolicy,
    [
      'candidateKeysArePublicIds',
      'allocateOnlyAfterSixTaskPass',
      'firstPublicId',
      'requiredAllocationCount',
      'retiredPublicIds',
      'retiredIdsMayBeRebound',
      'writesPluginAuthorityItems',
    ],
    'replacement allocation policy'
  );
  const retired = map.retired.map((item) => item.catalogId);
  if (
    plan.allocationPolicy.candidateKeysArePublicIds !== false ||
    plan.allocationPolicy.allocateOnlyAfterSixTaskPass !== true ||
    plan.allocationPolicy.firstPublicId !== REPLACEMENT_FIRST_PUBLIC_ID ||
    plan.allocationPolicy.requiredAllocationCount !== REPLACEMENT_ALLOCATION_COUNT ||
    JSON.stringify(plan.allocationPolicy.retiredPublicIds) !== JSON.stringify(retired) ||
    plan.allocationPolicy.retiredIdsMayBeRebound !== false ||
    plan.allocationPolicy.writesPluginAuthorityItems !== false
  ) {
    fail('replacement Public ID allocation boundary was weakened');
  }
  if (!Array.isArray(plan.candidates) || plan.candidates.length !== 44) {
    fail('replacement runtime plan must contain all 44 ID-less candidates');
  }
  const ready = [];
  const tokens = new Set();
  for (const [index, item] of plan.candidates.entries()) {
    const candidate = map.replacementCandidates[index];
    const label = `replacement runtime candidates[${index}]`;
    exactKeys(
      item,
      [
        'rank',
        'candidateKey',
        'candidateToken',
        'packageName',
        'packageVersion',
        'distributionClass',
        'source',
        'status',
        'runtimeInput',
      ],
      label
    );
    exactKeys(
      item.source,
      ['repository', 'commit', 'tree', 'sourceSubdir', 'exactCoordinate'],
      `${label}.source`
    );
    if (
      Object.hasOwn(item, 'catalogId') ||
      Object.hasOwn(item, 'publicId') ||
      item.rank !== candidate.rank ||
      item.candidateKey !== candidate.candidateKey ||
      item.candidateToken !== replacementCandidateToken(candidate) ||
      !SAFE_TOKEN.test(item.candidateToken) ||
      tokens.has(item.candidateToken) ||
      item.packageName !== candidate.packageName ||
      item.packageVersion !== candidate.packageVersion ||
      item.distributionClass !== candidate.distributionClass ||
      canonicalReplacementRuntimePlanJson(item.source) !==
        canonicalReplacementRuntimePlanJson(exactCandidateSource(candidate)) ||
      !SHA40.test(item.source.commit) ||
      !SHA40.test(item.source.tree)
    ) {
      fail(`${label} does not match the exact ID-less migration candidate`);
    }
    tokens.add(item.candidateToken);
    if (item.status === 'runtime-input-pending') {
      if (item.runtimeInput !== null) fail(`${label} pending item carries partial runtime input`);
      ready.push(false);
    } else if (item.status === 'runtime-candidate-ready') {
      validateReadyRuntimeInput(item.runtimeInput, candidate, item.candidateToken, `${label}.runtimeInput`);
      ready.push(true);
    } else {
      fail(`${label} status mismatch`);
    }
  }
  if (plan.status === 'runtime-candidates-ready' && ready.some((value) => !value)) {
    fail('replacement ready plan requires all 44 exact artifacts and probe contracts');
  }
  if (plan.status === 'runtime-input-authority-pending' && ready.some(Boolean)) {
    fail('replacement pending plan cannot partially authorize candidate execution');
  }
  return plan;
}

export function requireReadyReplacementRuntimePlan(plan, map, bindings) {
  validateReplacementRuntimePlan(plan, map, bindings);
  if (
    plan.status !== 'runtime-candidates-ready' ||
    plan.candidates.some((candidate) => candidate.status !== 'runtime-candidate-ready')
  ) {
    fail(
      'replacement runtime plan is pending; refusing candidate execution and Public ID allocation'
    );
  }
  return plan;
}

export async function loadReplacementRuntimePlan() {
  const [mapBytes, mapSchemaBytes, harnessAuthorityBytes, planBytes, intake] = await Promise.all([
    readFile(mapUrl),
    readFile(mapSchemaUrl),
    readFile(harnessAuthorityUrl),
    readFile(planUrl),
    readFile(intakeUrl, 'utf8').then(JSON.parse),
  ]);
  const migrationMapSha256 = sha256(mapBytes);
  const migrationMapSchemaSha256 = sha256(mapSchemaBytes);
  const harnessReleaseAuthoritySha256 = sha256(harnessAuthorityBytes);
  if (
    migrationMapSha256 !== REPLACEMENT_MAP_SHA256 ||
    migrationMapSchemaSha256 !== REPLACEMENT_MAP_SCHEMA_SHA256 ||
    harnessReleaseAuthoritySha256 !== REPLACEMENT_HARNESS_AUTHORITY_SHA256
  ) {
    fail('replacement runtime lane migration-map bytes drifted from its closed binding');
  }
  const validationOptions = {
    existingRepositories: intake.items.map((item) => item.repository),
  };
  const map = validateAlpha2PluginMigrationMap(JSON.parse(mapBytes), validationOptions);
  const bindings = {
    migrationMapSha256,
    migrationMapSchemaSha256,
    harnessReleaseAuthoritySha256,
    validationOptions,
  };
  const plan = validateReplacementRuntimePlan(JSON.parse(planBytes), map, bindings);
  return {
    map,
    mapBytes,
    plan,
    planBytes,
    planSha256: sha256(planBytes),
    ...bindings,
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length === 3 && process.argv[2] === 'generate-pending') {
      const [mapBytes, mapSchemaBytes, harnessAuthorityBytes, intake] = await Promise.all([
        readFile(mapUrl),
        readFile(mapSchemaUrl),
        readFile(harnessAuthorityUrl),
        readFile(intakeUrl, 'utf8').then(JSON.parse),
      ]);
      const bindings = {
        migrationMapSha256: sha256(mapBytes),
        migrationMapSchemaSha256: sha256(mapSchemaBytes),
        harnessReleaseAuthoritySha256: sha256(harnessAuthorityBytes),
        validationOptions: {
          existingRepositories: intake.items.map((item) => item.repository),
        },
      };
      const map = validateAlpha2PluginMigrationMap(JSON.parse(mapBytes), bindings.validationOptions);
      process.stdout.write(
        canonicalReplacementRuntimePlanJson(buildPendingReplacementRuntimePlan(map, bindings))
      );
      process.exit(0);
    }
    const context = await loadReplacementRuntimePlan();
    if (process.argv.length === 3 && process.argv[2] === 'check-pending') {
      const generated = Buffer.from(
        canonicalReplacementRuntimePlanJson(
          buildPendingReplacementRuntimePlan(context.map, context)
        )
      );
      if (!generated.equals(context.planBytes)) {
        fail('checked-in replacement pending plan is stale');
      }
      process.stdout.write(
        `${JSON.stringify({ valid: true, reproducible: true, planSha256: context.planSha256 })}\n`
      );
      process.exit(0);
    }
    if (process.argv.length !== 2) {
      fail('usage: plugin-replacement-runtime-plan.mjs [generate-pending|check-pending]');
    }
    process.stdout.write(
      `${JSON.stringify({
        valid: true,
        status: context.plan.status,
        candidateCount: context.plan.candidates.length,
        readyCount: context.plan.candidates.filter(
          (candidate) => candidate.status === 'runtime-candidate-ready'
        ).length,
        authorityEffect: context.plan.authorityEffect,
        planSha256: context.planSha256,
      })}\n`
    );
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
