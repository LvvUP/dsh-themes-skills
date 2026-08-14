#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';

const PACKAGE = /^@dsh-themes\/[a-z0-9]+(?:[._-][a-z0-9]+)*$/;
const VERSION = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
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

function normalizedThemes(input) {
  let entries = [];
  if (Array.isArray(input)) entries = input;
  else if (Array.isArray(input?.plugins)) entries = input.plugins;
  else if (Array.isArray(input?.items)) entries = input.items;
  else if (input?.dependencies && typeof input.dependencies === 'object') {
    entries = Object.entries(input.dependencies).map(([name, dependency]) => ({
      name,
      version: typeof dependency === 'string' ? dependency : dependency?.resolvedVersion ?? dependency?.version,
      direct: dependency?.direct,
    }));
  } else if (input && typeof input === 'object') {
    entries = Object.entries(input).map(([name, version]) => ({ name, version }));
  }

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
    if (typeof theme.version !== 'string' || !VERSION.test(theme.version)) {
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
  if (!VERSION.test(version)) throw new Error(`Invalid ${prefix} exact version`);
  if (!isAbsolute(artifactPath)) throw new Error(`${prefix} artifact must use an absolute path`);
  if (!SHA256.test(sha256)) throw new Error(`Invalid ${prefix} sha256`);
  return { packageName: name, version, artifactPath: normalizedPath, artifactSha256: sha256 };
}

function validateEntry(entry, allowNull = false) {
  if (entry === null && allowNull) return null;
  if (!entry || typeof entry !== 'object') throw new Error('Invalid rollback artifact entry');
  if (!PACKAGE.test(entry.packageName) || !VERSION.test(entry.version) || !isAbsolute(entry.artifactPath) || !SHA256.test(entry.artifactSha256)) {
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
