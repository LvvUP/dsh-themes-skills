#!/usr/bin/env node

import { fileURLToPath } from 'node:url';

import {
  REPLACEMENT_CANDIDATE_COUNT,
  loadReplacementRuntimePlan,
  requireReadyReplacementRuntimePlan,
} from './plugin-replacement-runtime-plan.mjs';

export const REPLACEMENT_RUNTIME_BATCH_COUNT = 4;
export const REPLACEMENT_RUNTIME_BATCH_SIZE = 11;

export const REPLACEMENT_RUNTIME_TUPLES = Object.freeze([
  Object.freeze({
    runner: 'ubuntu-24.04',
    platform: 'linux',
    arch: 'x64',
    nodeVersion: '22.19.0',
    tuple: 'linux-x64-node-22.19.0',
  }),
  Object.freeze({
    runner: 'ubuntu-24.04',
    platform: 'linux',
    arch: 'x64',
    nodeVersion: '24.15.0',
    tuple: 'linux-x64-node-24.15.0',
  }),
  Object.freeze({
    runner: 'macos-15',
    platform: 'darwin',
    arch: 'arm64',
    nodeVersion: '22.19.0',
    tuple: 'darwin-arm64-node-22.19.0',
  }),
  Object.freeze({
    runner: 'macos-15',
    platform: 'darwin',
    arch: 'arm64',
    nodeVersion: '24.15.0',
    tuple: 'darwin-arm64-node-24.15.0',
  }),
  Object.freeze({
    runner: 'windows-2022',
    platform: 'win32',
    arch: 'x64',
    nodeVersion: '22.19.0',
    tuple: 'win32-x64-node-22.19.0',
  }),
  Object.freeze({
    runner: 'windows-2022',
    platform: 'win32',
    arch: 'x64',
    nodeVersion: '24.15.0',
    tuple: 'win32-x64-node-24.15.0',
  }),
]);

function fail(message) {
  throw new Error(message);
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

export function canonicalReplacementBatchJson(value) {
  return `${JSON.stringify(stable(value))}\n`;
}

export function normalizeReplacementBatchId(input) {
  if (!/^[1-4]$/u.test(String(input ?? ''))) {
    fail('replacement runtime batch must be exactly 1, 2, 3, or 4');
  }
  return Number(input);
}

export function buildReplacementRuntimeBatchPlan(context) {
  const candidateTokens = context.plan.candidates.map((candidate) => candidate.candidateToken);
  const plan = {
    schemaVersion: 1,
    purpose: 'dsh-plugin-alpha2-replacement-runtime-batches',
    migrationMapSha256: context.migrationMapSha256,
    runtimePlanSha256: context.planSha256,
    batches: Array.from({ length: REPLACEMENT_RUNTIME_BATCH_COUNT }, (_, index) => ({
      batchId: index + 1,
      candidateTokens: candidateTokens.slice(
        index * REPLACEMENT_RUNTIME_BATCH_SIZE,
        (index + 1) * REPLACEMENT_RUNTIME_BATCH_SIZE
      ),
    })),
  };
  return validateReplacementRuntimeBatchPlan(plan, context);
}

export function validateReplacementRuntimeBatchPlan(plan, context) {
  if (
    plan?.schemaVersion !== 1 ||
    plan.purpose !== 'dsh-plugin-alpha2-replacement-runtime-batches' ||
    plan.migrationMapSha256 !== context.migrationMapSha256 ||
    plan.runtimePlanSha256 !== context.planSha256 ||
    !Array.isArray(plan.batches) ||
    plan.batches.length !== REPLACEMENT_RUNTIME_BATCH_COUNT
  ) {
    fail('replacement runtime batch plan header mismatch');
  }
  const expectedTokens = context.plan.candidates.map((candidate) => candidate.candidateToken);
  const observed = [];
  for (const [index, batch] of plan.batches.entries()) {
    const expected = expectedTokens.slice(
      index * REPLACEMENT_RUNTIME_BATCH_SIZE,
      (index + 1) * REPLACEMENT_RUNTIME_BATCH_SIZE
    );
    if (
      batch?.batchId !== index + 1 ||
      !Array.isArray(batch.candidateTokens) ||
      JSON.stringify(batch.candidateTokens) !== JSON.stringify(expected)
    ) {
      fail('replacement runtime batches must be four canonical eleven-candidate slices');
    }
    observed.push(...batch.candidateTokens);
  }
  if (
    observed.length !== REPLACEMENT_CANDIDATE_COUNT ||
    new Set(observed).size !== REPLACEMENT_CANDIDATE_COUNT ||
    JSON.stringify(observed) !== JSON.stringify(expectedTokens)
  ) {
    fail('replacement runtime batches overlap, reorder, or omit candidates');
  }
  return plan;
}

export function replacementRuntimeMatrixForBatch(plan, context, batchInput) {
  validateReplacementRuntimeBatchPlan(plan, context);
  requireReadyReplacementRuntimePlan(context.plan, context.map, context);
  const batchId = normalizeReplacementBatchId(batchInput);
  const batch = plan.batches[batchId - 1];
  const byToken = new Map(
    context.plan.candidates.map((candidate) => [candidate.candidateToken, candidate])
  );
  const include = [];
  for (const candidateToken of batch.candidateTokens) {
    const candidate = byToken.get(candidateToken);
    if (candidate === undefined) fail('replacement batch references an unknown candidate token');
    const repository = candidate.source.repository
      .replace(/^https:\/\/github\.com\//u, '')
      .replace(/\.git$/u, '');
    for (const tuple of REPLACEMENT_RUNTIME_TUPLES) {
      include.push({
        batchId,
        candidateKey: candidate.candidateKey,
        candidateToken,
        migrationRank: candidate.rank,
        repository,
        commit: candidate.source.commit,
        tree: candidate.source.tree,
        sourceSubdir: candidate.source.sourceSubdir,
        packageName: candidate.packageName,
        packageVersion: candidate.packageVersion,
        distributionClass: candidate.distributionClass,
        exactSourceCoordinate: candidate.source.exactCoordinate,
        artifactKind: candidate.runtimeInput.artifact.kind,
        artifactLocator: candidate.runtimeInput.artifact.locator,
        artifactBytes: candidate.runtimeInput.artifact.bytes,
        artifactSha256: candidate.runtimeInput.artifact.sha256,
        functionalProbeContractPath: candidate.runtimeInput.functionalProbe.contractPath,
        functionalProbeContractSha256:
          candidate.runtimeInput.functionalProbe.contractSha256,
        ...tuple,
      });
    }
  }
  if (
    include.length !== REPLACEMENT_RUNTIME_BATCH_SIZE * REPLACEMENT_RUNTIME_TUPLES.length ||
    new Set(include.map((entry) => `${entry.candidateToken}:${entry.tuple}`)).size !==
      include.length ||
    include.some(
      (entry) => Object.hasOwn(entry, 'catalogId') || Object.hasOwn(entry, 'publicId')
    )
  ) {
    fail(`replacement runtime batch ${batchId} did not expand to 66 unique ID-less jobs`);
  }
  return { include };
}

export async function loadReplacementRuntimeBatchContext() {
  const context = await loadReplacementRuntimePlan();
  return { ...context, batchPlan: buildReplacementRuntimeBatchPlan(context) };
}

function parseArgs(argv) {
  if (argv.length === 1 && argv[0] === 'plan') return { command: 'plan' };
  if (argv.length === 3 && argv[0] === 'matrix' && argv[1] === '--batch') {
    return { command: 'matrix', batchId: normalizeReplacementBatchId(argv[2]) };
  }
  fail('usage: plugin-replacement-runtime-batches.mjs plan | matrix --batch <1|2|3|4>');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const options = parseArgs(process.argv.slice(2));
    const context = await loadReplacementRuntimeBatchContext();
    if (options.command === 'plan') {
      requireReadyReplacementRuntimePlan(context.plan, context.map, context);
    }
    const output = options.command === 'plan'
      ? context.batchPlan
      : replacementRuntimeMatrixForBatch(context.batchPlan, context, options.batchId);
    process.stdout.write(canonicalReplacementBatchJson(output));
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
