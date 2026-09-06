#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadAlphaHostedAuthority, stableAlphaJson } from './alpha-authority.mjs';
import { snapshotAllowedArtifact } from './artifact-snapshot.mjs';
import { ALPHA_SOURCE, readAlphaRuntime } from './dsh-alpha.mjs';
import { inspect } from './theme-state.mjs';

function authority() {
  readAlphaRuntime();
  const result = loadAlphaHostedAuthority();
  if (result.status !== 'runtime-verified') throw new Error('Final Alpha package verification is incomplete.');
  return result;
}

async function prepareEntry(input, entries, exactRecord = false) {
  if (input === null) return null;
  if (!input || typeof input.artifactPath !== 'string' || !isAbsolute(input.artifactPath))
    throw new Error('Recovery requires an absolute verified artifact path or an explicit null built-in state.');
  const entry = entries.find((item) => item.packageName === input.packageName && item.version === input.version && item.artifactSha256 === input.artifactSha256);
  if (!entry) throw new Error('Recovery artifact is not an exact verified Alpha package.');
  const snapshot = await snapshotAllowedArtifact(input.artifactPath, { allowedDigests: new Set([entry.artifactSha256]) });
  const normalized = {
    packageName: entry.packageName, version: entry.version,
    artifactPath: snapshot.path, artifactSha256: entry.artifactSha256,
    payloadSha256: entry.payloadSha256,
  };
  if (exactRecord && stableAlphaJson(input) !== stableAlphaJson(normalized))
    throw new Error('Recovery artifact identity, payload or private snapshot path changed.');
  return normalized;
}

export async function createAlphaRecovery(input, installed) {
  const { entries } = authority();
  const previous = await prepareEntry(input?.previous, entries);
  const target = await prepareEntry(input?.target, entries);
  if (previous === null && target === null) throw new Error('Recovery must describe a theme change.');
  assertActiveTheme(installed, previous);
  return {
    schemaVersion: 3, profile: 'web', dshPackageVersion: ALPHA_SOURCE.version,
    sourceCommit: ALPHA_SOURCE.commit, runtimeAttestationSha256: ALPHA_SOURCE.verification.sha256,
    createdAt: new Date().toISOString(), previous, target,
  };
}

export async function validateAlphaRecovery(input) {
  const { entries } = authority();
  if (input?.schemaVersion !== 3 || input.profile !== 'web' || input.dshPackageVersion !== ALPHA_SOURCE.version ||
      input.sourceCommit !== ALPHA_SOURCE.commit || input.runtimeAttestationSha256 !== ALPHA_SOURCE.verification.sha256 ||
      !Number.isFinite(Date.parse(input.createdAt))) throw new Error('Unsupported Alpha recovery record.');
  const previous = await prepareEntry(input.previous, entries, true);
  const target = await prepareEntry(input.target, entries, true);
  if (previous === null && target === null) throw new Error('Recovery must describe a theme change.');
  return { schemaVersion: 3, profile: 'web', dshPackageVersion: ALPHA_SOURCE.version,
    sourceCommit: ALPHA_SOURCE.commit, runtimeAttestationSha256: ALPHA_SOURCE.verification.sha256,
    createdAt: new Date(input.createdAt).toISOString(), previous, target };
}

export function assertActiveTheme(installed, expected) {
  const { active } = inspect(installed);
  if ((active === null) !== (expected === null) || (active && (active.name !== expected?.packageName || active.version !== expected?.version)))
    throw new Error('The active theme differs from the prepared recovery state; inspect the current profile before changing it.');
}

export async function alphaRestorePlan(input, installed) {
  const record = await validateAlphaRecovery(input);
  const { active } = inspect(installed);
  const matches = (entry) => entry && active?.name === entry.packageName && active?.version === entry.version;
  // A failed add can leave no managed theme. An already restored profile is a safe no-op.
  if (matches(record.previous) || (active === null && record.previous === null))
    return { status: 'already-restored', commands: [], verify: ['--source', 'plugin', '--profile', 'web', 'list', '--json'] };
  if (active && !matches(record.target)) throw new Error('Recovery would replace an unrelated or subsequently changed theme.');
  const commands = [];
  if (active) commands.push(['--source', 'plugin', '--profile', 'web', 'remove', active.name]);
  if (record.previous) commands.push(['--source', 'plugin', '--profile', 'web', 'add', record.previous.artifactPath, '--save-exact']);
  return { status: 'ready', commands, expected: record.previous ? { packageName: record.previous.packageName, version: record.previous.version } : null,
    verify: ['--source', 'plugin', '--profile', 'web', 'list', '--json'], lifecycle: 'managed-cold-restart' };
}

async function main(args) {
  const [command, ...pairs] = args;
  const values = {};
  for (let i = 0; i < pairs.length; i += 2) {
    if (!['--input', '--installed'].includes(pairs[i]) || !pairs[i + 1] || values[pairs[i]])
      throw new Error('Use alpha-state.mjs <record|validate|restore-plan> --input <json> [--installed <plugin-list.json>].');
    values[pairs[i]] = pairs[i + 1];
  }
  const json = async (file) => {
    if (!file) throw new Error('The required JSON input was not provided.');
    const bytes = await readFile(file);
    if (bytes.length > 1024 * 1024) throw new Error('Recovery input exceeds 1 MiB.');
    return JSON.parse(bytes.toString('utf8'));
  };
  const input = await json(values['--input']);
  const result = command === 'record' ? await createAlphaRecovery(input, await json(values['--installed']))
    : command === 'validate' ? await validateAlphaRecovery(input)
      : command === 'restore-plan' ? await alphaRestorePlan(input, await json(values['--installed']))
        : (() => { throw new Error('Unknown Alpha recovery command.'); })();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main(process.argv.slice(2));
