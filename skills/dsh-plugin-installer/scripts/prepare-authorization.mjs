#!/usr/bin/env node

import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { lstat, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { isAlias, isMap, isPair, isScalar, parseDocument } from 'yaml';

import { validateItem } from './authority.mjs';
import { pnpmCommandShimShell } from './pnpm-binding.mjs';
import { validateWebProfile } from './profile-snapshot.mjs';

const MAX_WORKSPACE_YAML_BYTES = 64 * 1024;
const MAX_WORKSPACE_YAML_LINES = 2048;
const MAX_WORKSPACE_YAML_LINE_BYTES = 4096;
const MAX_WORKSPACE_YAML_AST_DEPTH = 32;
const MAX_WORKSPACE_YAML_AST_NODES = 2048;
const MAX_PNPM_CONFIG_OUTPUT_BYTES = 64 * 1024;
const EFFECTIVE_POLICY_KEYS = new Set([
  'allowBuilds',
  'dangerouslyAllowAllBuilds',
  'strictDepBuilds',
]);

function fail(message) {
  throw new Error(message);
}

function lifecycleKeys(items) {
  const keys = [];
  for (const [index, item] of items.entries()) {
    validateItem(item, index);
    if (item.package.lifecycleAuthorization.required) {
      keys.push(item.package.lifecycleAuthorization.packageKey);
    }
  }
  return [...new Set(keys)].sort();
}

function inspectYamlNode(node, state = { seen: new Set(), nodes: 0 }, depth = 0) {
  if (node === null || node === undefined) return;
  if (isAlias(node)) fail('profile workspace YAML aliases are forbidden');
  if (typeof node !== 'object') return;
  if (depth > MAX_WORKSPACE_YAML_AST_DEPTH) fail('profile workspace YAML AST is too deep');
  state.nodes += 1;
  if (state.nodes > MAX_WORKSPACE_YAML_AST_NODES) fail('profile workspace YAML has too many AST nodes');
  if (state.seen.has(node)) fail('profile workspace YAML contains a cyclic node');
  state.seen.add(node);
  if (node.tag) fail('profile workspace YAML custom or explicit tags are forbidden');
  if (isPair(node)) {
    if (isScalar(node.key) && node.key.value === '<<') fail('profile workspace YAML merge keys are forbidden');
    inspectYamlNode(node.key, state, depth + 1);
    inspectYamlNode(node.value, state, depth + 1);
  } else if (Array.isArray(node.items)) {
    for (const item of node.items) inspectYamlNode(item, state, depth + 1);
  }
  state.seen.delete(node);
}

function parseWorkspace(source) {
  let document;
  try {
    document = parseDocument(source, {
      merge: false,
      prettyErrors: false,
      strict: true,
      uniqueKeys: true,
    });
  } catch (error) {
    fail(`profile workspace YAML parse failed: ${error.message}`);
  }
  if (document.errors.length > 0) {
    fail(`profile workspace YAML is invalid: ${document.errors[0].message}`);
  }
  if (!isMap(document.contents)) fail('profile workspace YAML root must be a mapping');
  inspectYamlNode(document.contents);
  return document;
}

function allowBuildEntries(document) {
  const allowBuilds = document.get('allowBuilds', true);
  if (allowBuilds === undefined) return null;
  if (!isMap(allowBuilds)) fail('profile allowBuilds must use a top-level block mapping');
  const entries = new Map();
  for (const pair of allowBuilds.items) {
    if (!isScalar(pair.key) || typeof pair.key.value !== 'string' ||
        !isScalar(pair.value) || typeof pair.value.value !== 'boolean') {
      fail('profile allowBuilds must map literal package names to booleans');
    }
    if (entries.has(pair.key.value)) fail(`profile allowBuilds duplicates ${pair.key.value}`);
    entries.set(pair.key.value, pair.value.value);
  }
  return { entries, node: allowBuilds };
}

function requireSafeBooleanPolicy(document, key, expected) {
  const node = document.get(key, true);
  if (node === undefined) {
    document.set(key, expected);
    return;
  }
  if (!isScalar(node) || typeof node.value !== 'boolean') {
    fail(`profile ${key} must be the literal boolean ${expected}`);
  }
  if (node.value !== expected) {
    fail(`profile ${key}=${node.value} is an unsafe lifecycle build policy`);
  }
}

function enforceSafeBuildPolicy(document) {
  requireSafeBooleanPolicy(document, 'dangerouslyAllowAllBuilds', false);
  requireSafeBooleanPolicy(document, 'strictDepBuilds', true);
}

function normalizeWorkspace(document) {
  return document.toString({ lineWidth: 0 });
}

function parsePnpmConfigValue(result, key) {
  if (result?.error || result?.signal || result?.status !== 0 ||
      typeof result?.stdout !== 'string' || typeof result?.stderr !== 'string' ||
      result.stderr.trim() !== '' ||
      Buffer.byteLength(result.stdout, 'utf8') > MAX_PNPM_CONFIG_OUTPUT_BYTES) {
    fail(`unable to verify effective pnpm ${key} policy`);
  }
  try {
    return JSON.parse(result.stdout.trim());
  } catch {
    fail(`effective pnpm ${key} policy is not strict JSON`);
  }
}

function readEffectivePnpmConfig(profile, key, environment) {
  if (!EFFECTIVE_POLICY_KEYS.has(key)) fail('unsupported pnpm policy key');
  return parsePnpmConfigValue(spawnSync('pnpm', [
    'config', 'get', '--location', 'project', '--json', key,
  ], {
    cwd: profile,
    encoding: 'utf8',
    env: environment,
    maxBuffer: MAX_PNPM_CONFIG_OUTPUT_BYTES,
    // Node 24 refuses to execute Windows .cmd shims without a shell. The
    // command and every argument here come from the fixed policy-key set.
    shell: pnpmCommandShimShell(environment),
    windowsHide: true,
  }), key);
}

export function validateEffectivePnpmBuildPolicy(policy, keys, expectedAuthorized) {
  if (policy === null || typeof policy !== 'object' || Array.isArray(policy) ||
      Object.keys(policy).sort().join(',') !==
        ['allowBuilds', 'dangerouslyAllowAllBuilds', 'strictDepBuilds'].sort().join(',') ||
      !Array.isArray(keys) || typeof expectedAuthorized !== 'boolean') {
    fail('effective pnpm build policy input is malformed');
  }
  if (policy.dangerouslyAllowAllBuilds !== false || policy.strictDepBuilds !== true) {
    fail('effective pnpm build policy is unsafe');
  }
  if (policy.allowBuilds === null || typeof policy.allowBuilds !== 'object' ||
      Array.isArray(policy.allowBuilds) ||
      Object.values(policy.allowBuilds).some((value) => typeof value !== 'boolean')) {
    fail('effective pnpm allowBuilds policy is malformed');
  }
  for (const key of keys) {
    if (typeof key !== 'string' || key.length < 1 || key.length > 214) {
      fail('effective pnpm lifecycle package key is malformed');
    }
    if (expectedAuthorized ? policy.allowBuilds[key] !== true : policy.allowBuilds[key] === true) {
      fail(`effective pnpm allowBuilds policy does not match ${key}`);
    }
  }
  return policy;
}

export function verifyEffectivePnpmBuildPolicy(
  profile,
  keys,
  expectedAuthorized,
  options
) {
  const environment = policyEnvironment(options);
  if (typeof profile !== 'string' || !isAbsolute(profile) || profile.includes('\0') ||
      environment === null || typeof environment !== 'object' || Array.isArray(environment)) {
    fail('effective pnpm policy verifier input is malformed');
  }
  const policy = {
    allowBuilds: keys.length === 0
      ? {}
      : readEffectivePnpmConfig(profile, 'allowBuilds', environment),
    dangerouslyAllowAllBuilds: readEffectivePnpmConfig(
      profile,
      'dangerouslyAllowAllBuilds',
      environment
    ),
    strictDepBuilds: readEffectivePnpmConfig(profile, 'strictDepBuilds', environment),
  };
  return validateEffectivePnpmBuildPolicy(policy, keys, expectedAuthorized);
}

export function authorizePrepareText(source, items) {
  if (typeof source !== 'string' || source.includes('\0') || source.includes('\r') || source.includes('\t')) {
    fail('profile workspace YAML must be LF-only text without tabs or NUL');
  }
  const bytes = Buffer.byteLength(source, 'utf8');
  if (bytes < 1 || bytes > MAX_WORKSPACE_YAML_BYTES) {
    fail('profile workspace YAML byte size is outside the strict 1..65536 limit');
  }
  const lines = source.split('\n');
  if (lines.length > MAX_WORKSPACE_YAML_LINES ||
      lines.some((line) => Buffer.byteLength(line, 'utf8') > MAX_WORKSPACE_YAML_LINE_BYTES)) {
    fail('profile workspace YAML has too many lines or an oversized line');
  }
  const keys = lifecycleKeys(items);
  const document = parseWorkspace(source);
  enforceSafeBuildPolicy(document);
  let current = allowBuildEntries(document);
  if (current === null && keys.length > 0) {
    document.set('allowBuilds', document.createNode({}));
    current = allowBuildEntries(document);
  }
  if (current !== null) {
    for (const key of keys) {
      if (current.entries.get(key) === false) fail(`lifecycle scripts for ${key} are explicitly denied by the profile`);
    }
    const missing = keys.filter((key) => !current.entries.has(key));
    for (const key of missing) current.node.set(key, true);
    current.node.items.sort((left, right) => String(left.key.value).localeCompare(String(right.key.value), 'en'));
  }
  const normalized = normalizeWorkspace(document);
  return { changed: normalized !== source, keys, source: normalized };
}

export function revokePrepareText(source, items) {
  if (typeof source !== 'string' || source.includes('\0') || source.includes('\r') || source.includes('\t')) {
    fail('profile workspace YAML must be LF-only text without tabs or NUL');
  }
  const bytes = Buffer.byteLength(source, 'utf8');
  if (bytes < 1 || bytes > MAX_WORKSPACE_YAML_BYTES) {
    fail('profile workspace YAML byte size is outside the strict 1..65536 limit');
  }
  const lines = source.split('\n');
  if (lines.length > MAX_WORKSPACE_YAML_LINES ||
      lines.some((line) => Buffer.byteLength(line, 'utf8') > MAX_WORKSPACE_YAML_LINE_BYTES)) {
    fail('profile workspace YAML has too many lines or an oversized line');
  }
  const keys = lifecycleKeys(items);
  const document = parseWorkspace(source);
  enforceSafeBuildPolicy(document);
  const current = allowBuildEntries(document);
  if (current !== null) {
    for (const key of keys) {
      if (current.entries.get(key) === true) current.node.delete(key);
    }
    current.node.items.sort((left, right) => String(left.key.value).localeCompare(String(right.key.value), 'en'));
  }
  const normalized = normalizeWorkspace(document);
  return { changed: normalized !== source, keys, source: normalized };
}

async function profileWorkspace(profileInput) {
  const profile = await validateWebProfile(profileInput);
  const workspace = join(profile, 'pnpm-workspace.yaml');
  const workspaceStat = await lstat(workspace);
  if (!workspaceStat.isFile() || workspaceStat.isSymbolicLink()) fail('profile pnpm-workspace.yaml must be a regular file');
  return workspace;
}

async function replaceExistingFile(temporary, target) {
  if (process.platform !== 'win32') {
    await rename(temporary, target);
    return;
  }
  const backup = `${target}.dsh-plugin-installer-${randomUUID()}.bak`;
  await rename(target, backup);
  try {
    await rename(temporary, target);
  } catch (error) {
    try {
      await rename(backup, target);
    } catch (restoreError) {
      throw new AggregateError([error, restoreError], `Windows replacement and recovery failed for ${target}`);
    }
    throw error;
  }
  await rm(backup, { force: true });
}

async function writeWorkspace(workspace, source) {
  const temporary = `${workspace}.dsh-plugin-installer-${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, source, { mode: 0o600, flag: 'wx' });
    await replaceExistingFile(temporary, workspace);
  } finally {
    await rm(temporary, { force: true });
  }
}

function policyEnvironment(options) {
  if (options === undefined || options === null || typeof options !== 'object' || Array.isArray(options) ||
      Object.keys(options).sort().join(',') !== 'environment' ||
      options.environment === null || typeof options.environment !== 'object' ||
      Array.isArray(options.environment)) {
    fail('prepare policy options may contain only one controlled environment');
  }
  return options.environment;
}

async function applyPreparePolicy(profileInput, items, operation, options) {
  const workspace = await profileWorkspace(profileInput);
  const profile = dirname(workspace);
  const environment = policyEnvironment(options);
  const original = await readFile(workspace, 'utf8');
  const result = operation === 'authorize'
    ? authorizePrepareText(original, items)
    : revokePrepareText(original, items);
  try {
    if (result.changed) await writeWorkspace(workspace, result.source);
    verifyEffectivePnpmBuildPolicy(profile, result.keys, operation === 'authorize', { environment });
  } catch (error) {
    if (result.changed) {
      try {
        await writeWorkspace(workspace, original);
      } catch (restoreError) {
        throw new AggregateError(
          [error, restoreError],
          'pnpm build policy verification and workspace recovery both failed'
        );
      }
    }
    throw error;
  }
  return { changed: result.changed, keys: result.keys };
}

export async function authorizePrepare(profileInput, items, options) {
  return applyPreparePolicy(profileInput, items, 'authorize', options);
}

export async function revokePrepare(profileInput, items, options) {
  return applyPreparePolicy(profileInput, items, 'revoke', options);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.stderr.write('direct prepare authorization is disabled; use the consent-bound install transaction\n');
  process.exitCode = 1;
}
