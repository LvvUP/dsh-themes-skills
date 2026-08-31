#!/usr/bin/env node

import { fileURLToPath } from 'node:url';

import { validateCandidateIntake } from './candidate-intake.mjs';
import {
  loadPluginRuntimeCandidatePlan,
  requireReadyPluginRuntimeCandidatePlan,
} from './plugin-runtime-plan.mjs';

export const PLUGIN_RUNTIME_BATCH_COUNT = 4;
export const PLUGIN_RUNTIME_BATCH_SIZE = 20;
export const PLUGIN_RUNTIME_CANDIDATE_COUNT = 80;

export const PLUGIN_RUNTIME_TUPLES = Object.freeze([
  Object.freeze({ runner: 'ubuntu-24.04', platform: 'linux', arch: 'x64', nodeVersion: '22.19.0', tuple: 'linux-x64-node-22.19.0' }),
  Object.freeze({ runner: 'ubuntu-24.04', platform: 'linux', arch: 'x64', nodeVersion: '24.15.0', tuple: 'linux-x64-node-24.15.0' }),
  Object.freeze({ runner: 'macos-15', platform: 'darwin', arch: 'arm64', nodeVersion: '22.19.0', tuple: 'darwin-arm64-node-22.19.0' }),
  Object.freeze({ runner: 'macos-15', platform: 'darwin', arch: 'arm64', nodeVersion: '24.15.0', tuple: 'darwin-arm64-node-24.15.0' }),
  Object.freeze({ runner: 'windows-2022', platform: 'win32', arch: 'x64', nodeVersion: '22.19.0', tuple: 'win32-x64-node-22.19.0' }),
  Object.freeze({ runner: 'windows-2022', platform: 'win32', arch: 'x64', nodeVersion: '24.15.0', tuple: 'win32-x64-node-24.15.0' }),
]);

function fail(message) {
  throw new Error(message);
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
}

function canonicalJson(value) {
  return `${JSON.stringify(stable(value))}\n`;
}

export function normalizeRuntimeBatchId(input) {
  if (!/^[1-4]$/u.test(String(input ?? ''))) fail('runtime batch must be exactly 1, 2, 3, or 4');
  return Number(input);
}

export function validatePluginRuntimeBatchPlan(plan, intake) {
  validateCandidateIntake(intake);
  if (plan?.schemaVersion !== 1 || plan.purpose !== 'dsh-plugin-alpha2-runtime-batches' ||
      plan.runtimeCandidatePlanSha256 === undefined ||
      !/^[a-f0-9]{64}$/u.test(plan.runtimeCandidatePlanSha256) ||
      !Array.isArray(plan.batches) || plan.batches.length !== PLUGIN_RUNTIME_BATCH_COUNT) {
    fail('plugin runtime batch plan header mismatch');
  }
  const expectedIds = intake.items.map((item) => item.catalogId);
  const observedIds = [];
  for (let index = 0; index < plan.batches.length; index += 1) {
    const batch = plan.batches[index];
    if (batch?.batchId !== index + 1 || !Array.isArray(batch.catalogIds) ||
        batch.catalogIds.length !== PLUGIN_RUNTIME_BATCH_SIZE) {
      fail('plugin runtime plan must contain four canonical 20-candidate batches');
    }
    const expectedSlice = expectedIds.slice(
      index * PLUGIN_RUNTIME_BATCH_SIZE,
      (index + 1) * PLUGIN_RUNTIME_BATCH_SIZE
    );
    if (JSON.stringify(batch.catalogIds) !== JSON.stringify(expectedSlice)) {
      fail(`plugin runtime batch ${batch.batchId} is not the authority-ordered candidate slice`);
    }
    observedIds.push(...batch.catalogIds);
  }
  if (observedIds.length !== PLUGIN_RUNTIME_CANDIDATE_COUNT ||
      new Set(observedIds).size !== PLUGIN_RUNTIME_CANDIDATE_COUNT ||
      JSON.stringify(observedIds) !== JSON.stringify(expectedIds)) {
    fail('plugin runtime batches overlap or omit machine-authority candidates');
  }
  return plan;
}

export function buildPluginRuntimeBatchPlan(intake, runtimeCandidatePlanSha256) {
  validateCandidateIntake(intake);
  if (!/^[a-f0-9]{64}$/u.test(runtimeCandidatePlanSha256 ?? '')) {
    fail('runtime candidate plan digest must be one SHA-256');
  }
  const plan = {
    schemaVersion: 1,
    purpose: 'dsh-plugin-alpha2-runtime-batches',
    runtimeCandidatePlanSha256,
    batches: Array.from({ length: PLUGIN_RUNTIME_BATCH_COUNT }, (_, index) => ({
      batchId: index + 1,
      catalogIds: intake.items
        .slice(index * PLUGIN_RUNTIME_BATCH_SIZE, (index + 1) * PLUGIN_RUNTIME_BATCH_SIZE)
        .map((item) => item.catalogId),
    })),
  };
  return validatePluginRuntimeBatchPlan(plan, intake);
}

export function pluginRuntimeMatrixForBatch(plan, intake, runtimePlanContext, batchInput) {
  validatePluginRuntimeBatchPlan(plan, intake);
  if (plan.runtimeCandidatePlanSha256 !== runtimePlanContext.planSha256) {
    fail('batch plan is not bound to the exact runtime candidate plan bytes');
  }
  requireReadyPluginRuntimeCandidatePlan(
    runtimePlanContext.plan,
    intake,
    runtimePlanContext.intakeSha256
  );
  const batchId = normalizeRuntimeBatchId(batchInput);
  const batch = plan.batches[batchId - 1];
  const byId = new Map(intake.items.map((item) => [item.catalogId, item]));
  const runtimeById = new Map(
    runtimePlanContext.plan.items.map((item) => [item.catalogId, item])
  );
  const include = [];
  for (const catalogId of batch.catalogIds) {
    const candidate = byId.get(catalogId);
    const runtimeCandidate = runtimeById.get(catalogId);
    if (candidate === undefined || runtimeCandidate === undefined) {
      fail(`runtime batch references missing candidate #${catalogId}`);
    }
    const repository = candidate.repository
      .replace(/^https:\/\/github\.com\//u, '')
      .replace(/\.git$/u, '');
    for (const task of PLUGIN_RUNTIME_TUPLES) {
      include.push({
        batchId,
        catalogId,
        slug: candidate.slug,
        repository,
        commit: candidate.commit,
        sourceSubdir: candidate.sourceSubdir ?? '.',
        artifactKind: runtimeCandidate.artifact.kind,
        artifactLocator: runtimeCandidate.artifact.locator,
        artifactBytes: runtimeCandidate.artifact.bytes,
        artifactSha256: runtimeCandidate.artifact.sha256,
        functionalProbeContractPath: runtimeCandidate.functionalProbe.contractPath,
        functionalProbeContractSha256: runtimeCandidate.functionalProbe.contractSha256,
        ...task,
      });
    }
  }
  if (include.length !== PLUGIN_RUNTIME_BATCH_SIZE * PLUGIN_RUNTIME_TUPLES.length ||
      new Set(include.map((entry) => `${entry.catalogId}:${entry.tuple}`)).size !== include.length) {
    fail(`runtime batch ${batchId} does not expand to 120 unique candidate/tuple jobs`);
  }
  return { include };
}

export async function loadPluginRuntimeBatchContext() {
  const runtimePlanContext = await loadPluginRuntimeCandidatePlan();
  const { intake } = runtimePlanContext;
  const runtimeCandidatePlanSha256 = runtimePlanContext.planSha256;
  return {
    intake,
    runtimeCandidatePlanSha256,
    runtimePlanContext,
    plan: buildPluginRuntimeBatchPlan(intake, runtimeCandidatePlanSha256),
  };
}

function parseArgs(argv) {
  const command = argv[0];
  if (command === 'plan' && argv.length === 1) return { command };
  if (command === 'matrix' && argv.length === 3 && argv[1] === '--batch') {
    return { command, batchId: normalizeRuntimeBatchId(argv[2]) };
  }
  fail('usage: plugin-runtime-batches.mjs plan | matrix --batch <1|2|3|4>');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const options = parseArgs(process.argv.slice(2));
    const context = await loadPluginRuntimeBatchContext();
    const value = options.command === 'plan'
      ? context.plan
      : pluginRuntimeMatrixForBatch(
          context.plan,
          context.intake,
          context.runtimePlanContext,
          options.batchId
        );
    process.stdout.write(canonicalJson(value));
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
