#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';

import { isExactSemver } from './semver.mjs';

const PACKAGE = /^@dsh-themes\/[a-z0-9]+(?:[._-][a-z0-9]+)*$/;
const SHA256 = /^[0-9a-f]{64}$/;

function parseArgs(argv) {
  const command = argv.shift();
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith('--') || value == null) throw new Error('Arguments must be --key value pairs');
    values[key.slice(2)] = value;
  }
  return { command, values };
}

async function loadJson(path) {
  if (!path) throw new Error('--input is required');
  return JSON.parse(await readFile(resolve(path), 'utf8'));
}

function dependencyEntries(dependencies) {
  if (!dependencies || typeof dependencies !== 'object' || Array.isArray(dependencies)) {
    throw new Error('Profile dependencies must be an object when present');
  }
  return Object.entries(dependencies).map(([name, dependency]) => ({
    name,
    version: typeof dependency === 'string' ? dependency : dependency?.resolvedVersion ?? dependency?.version,
    direct: dependency?.direct,
  }));
}

function looksLikeProfile(entry) {
  return Boolean(
    entry &&
    typeof entry === 'object' &&
    !Array.isArray(entry) &&
    typeof entry.name === 'string' &&
    !PACKAGE.test(entry.name) &&
    (
      entry.name?.startsWith('dsh-profile-') ||
      typeof entry.path === 'string' ||
      typeof entry.private === 'boolean' ||
      Object.hasOwn(entry, 'dependencies')
    )
  );
}

function profileEntries(profiles) {
  if (profiles.length !== 1 || !profiles.every(looksLikeProfile)) {
    throw new Error('Expected exactly one unambiguous rc.6 profile record');
  }
  const [profile] = profiles;
  if (profile.name !== 'dsh-profile-web') {
    throw new Error(`Expected the web profile record, received ${String(profile.name)}`);
  }
  return profile.dependencies === undefined ? [] : dependencyEntries(profile.dependencies);
}

function normalizedThemes(input) {
  if (!Array.isArray(input)) {
    throw new Error('Expected the rc.6 plugin list root array');
  }
  const entries = profileEntries(input);

  return entries
    .map((entry) => ({
      name: entry?.name ?? entry?.packageName ?? entry?.package,
      version: entry?.version ?? entry?.resolvedVersion,
      direct: entry?.direct !== false && entry?.isDirect !== false,
    }))
    .filter((entry) => entry.direct && typeof entry.name === 'string' && entry.name.startsWith('@dsh-themes/'));
}

function inspect(input) {
  const themes = normalizedThemes(input);
  for (const theme of themes) {
    if (!PACKAGE.test(theme.name)) throw new Error(`Invalid DSH-Themes package name: ${theme.name}`);
    if (!isExactSemver(theme.version)) {
      throw new Error(`Theme ${theme.name} does not have an exact semantic version`);
    }
  }
  if (themes.length > 1) throw new Error(`Multiple DSH-Themes packages are active: ${themes.map((theme) => theme.name).join(', ')}`);
  return { profile: 'web', count: themes.length, active: themes[0] ?? null };
}

function artifact(values, prefix) {
  const name = values[`${prefix}-name`];
  const version = values[`${prefix}-version`];
  const artifactPath = values[`${prefix}-artifact`];
  const sha256 = values[`${prefix}-sha256`];
  const present = [name, version, artifactPath, sha256].filter(Boolean).length;
  if (present === 0 && prefix === 'previous') return null;
  if (present !== 4) throw new Error(`${prefix} requires name, version, artifact, and sha256 together`);
  const normalizedPath = resolve(artifactPath);
  if (!PACKAGE.test(name)) throw new Error(`Invalid ${prefix} package name`);
  if (!isExactSemver(version)) throw new Error(`Invalid ${prefix} exact version`);
  if (!isAbsolute(artifactPath)) throw new Error(`${prefix} artifact must use an absolute path`);
  if (!SHA256.test(sha256)) throw new Error(`Invalid ${prefix} sha256`);
  return { packageName: name, version, artifactPath: normalizedPath, artifactSha256: sha256 };
}

function validateEntry(entry, allowNull = false) {
  if (entry === null && allowNull) return null;
  if (!entry || typeof entry !== 'object') throw new Error('Invalid rollback artifact entry');
  if (!PACKAGE.test(entry.packageName) || !isExactSemver(entry.version) || !isAbsolute(entry.artifactPath) || !SHA256.test(entry.artifactSha256)) {
    throw new Error('Rollback artifact entry is malformed');
  }
  return {
    packageName: entry.packageName,
    version: entry.version,
    artifactPath: resolve(entry.artifactPath),
    artifactSha256: entry.artifactSha256,
  };
}

function validateRecord(input) {
  if (input?.schemaVersion !== 1 || input?.profile !== 'web') throw new Error('Unsupported rollback record');
  if (!Number.isFinite(Date.parse(input.createdAt))) throw new Error('Rollback record createdAt must be ISO-8601');
  const previous = validateEntry(input.previous, true);
  const target = validateEntry(input.target, true);
  if (previous === null && target === null) throw new Error('Rollback record cannot contain two built-in states');
  return {
    schemaVersion: 1,
    profile: 'web',
    createdAt: new Date(input.createdAt).toISOString(),
    previous,
    target,
  };
}

const { command, values } = parseArgs(process.argv.slice(2));
let result;
if (command === 'inspect') result = inspect(await loadJson(values.input));
else if (command === 'record') {
  const createdAt = values.at ? new Date(values.at) : new Date();
  if (!Number.isFinite(createdAt.valueOf())) throw new Error('--at must be a valid date');
  result = {
    schemaVersion: 1,
    profile: 'web',
    createdAt: createdAt.toISOString(),
    previous: artifact(values, 'previous'),
    target: artifact(values, 'target'),
  };
} else if (command === 'validate-record') result = validateRecord(await loadJson(values.input));
else if (command === 'reverse') {
  const record = validateRecord(await loadJson(values.input));
  result = {
    schemaVersion: 1,
    profile: 'web',
    createdAt: new Date().toISOString(),
    previous: record.target,
    target: record.previous,
  };
} else {
  throw new Error('Usage: theme-state.mjs <inspect|record|validate-record|reverse> [--key value]');
}

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
