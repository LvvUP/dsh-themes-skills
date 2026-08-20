#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

import { isExactSemver } from './semver.mjs';

const PACKAGE = /^@dsh-themes\/[a-z0-9]+(?:[._-][a-z0-9]+)*$/;
const SHA256 = /^[0-9a-f]{64}$/;
const CURRENT_DSH_PACKAGE_VERSION = '0.1.0-rc.8';
const CURRENT_RUNTIME_ATTESTATION_SHA256 =
  '1cd9a0b4a6b9d215f0a1f70a97b4d43eae7bf4f846ae7009b7ddb812823ca0ae';
const CURRENT_SOURCE_COMMIT = '141eb6fef83422698aef7a981029e843e8161534';
const CURRENT_SELECTOR_CATALOG_SHA256 =
  '663aa5927591ac99076f924ee9cd6f9bd09e6a8a9ee1e6b8b1b0d9e3093df807';
const CURRENT_HOSTED_ARTIFACTS = new Map([
  ['@dsh-themes/abyssal-maid@1.1.0', '7d25f7b1052f0d7988c9e145aea65c3a542e33dc78d64254ae38f6dd87b174d4'],
  ['@dsh-themes/arctic-panel@1.1.0', 'f5e90f8b335b3cc0e484040515621b12622d103252e148492b6effab73dc4b28'],
  ['@dsh-themes/copper-wire@1.1.0', 'bdc6dee20634f9bef9769f9cbd029b1c9eb6d416008eaac8d7bf35eca6d12da4'],
  ['@dsh-themes/deep-ocean@1.2.0', '8fca6598f084b47ec07bd00876a686c640ad68f280b5737b789a68fa5df5044f'],
  ['@dsh-themes/graphite-relay@1.2.0', '6f23cd12796a6373bbe8612ecc2a86b7a7d8e563beb24ecb57ddfd10e86c358c'],
  ['@dsh-themes/high-signal@1.2.0', '01acb404b6273289fa31848c08388d0b99d199b1d8acdad1f958d734d2df14c3'],
  ['@dsh-themes/jade-circuit@1.2.0', '639b3aefc09e204904a5541c82f81310f9c54ca9818473bde8afcaaa958a9fbb'],
  ['@dsh-themes/neon-afterline@1.1.0', '9417f66297422f3a0d3311d3b07587da75d5d16aab2d149b32342a36510ce7b9'],
  ['@dsh-themes/paper-console@1.2.0', 'f140a38123331ebbebbd63ee0e5af17ce88268ebcba340e55be4e3db12ff0891'],
  ['@dsh-themes/quiet-matrix@1.1.0', 'c3067862b989fbb4d79a23a5569e4ff735f5df358a56b67a71af11a9501b6627'],
  ['@dsh-themes/reasoning-tide@1.1.0', '1f05fc67471b8b004397b3582b2ed1e56a45b3ac79f27688e337699e3d46d3a6'],
  ['@dsh-themes/redline-02@1.1.0', 'b3716d237822f58613b884dad9d82a1f4cb2ca9f873f28d0705b5c73f1aaecd9'],
  ['@dsh-themes/solar-trace@1.2.0', 'af447d963e9f5a6cae8454dff553665b16500dfd52a724ab9e75f47f007f56e7'],
]);
const skillDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const currentAttestationPath = resolve(
  skillDir,
  'runtime-rc8/attestation.json'
);
const MAX_ARTIFACT_BYTES = 32 * 1024 * 1024;
const MAX_EXPANDED_BYTES = 96 * 1024 * 1024;
const MAX_MANIFEST_BYTES = 1024 * 1024;

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

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
    throw new Error('Expected exactly one unambiguous RC.8 profile record');
  }
  const [profile] = profiles;
  if (profile.name !== 'dsh-profile-web') {
    throw new Error(`Expected the web profile record, received ${String(profile.name)}`);
  }
  return profile.dependencies === undefined ? [] : dependencyEntries(profile.dependencies);
}

function normalizedThemes(input) {
  if (!Array.isArray(input)) {
    throw new Error('Expected the RC.8 plugin list root array');
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

function tarManifest(bytes) {
  const tar = gunzipSync(bytes, { maxOutputLength: MAX_EXPANDED_BYTES });
  const manifests = [];
  for (let offset = 0; offset + 512 <= tar.length; ) {
    const header = tar.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break;
    const name = header
      .subarray(0, 100)
      .toString('utf8')
      .replace(/\0.*$/s, '');
    const prefix = header
      .subarray(345, 500)
      .toString('utf8')
      .replace(/\0.*$/s, '');
    const fullName = prefix ? `${prefix}/${name}` : name;
    const sizeText = header
      .subarray(124, 136)
      .toString('ascii')
      .replace(/\0.*$/s, '')
      .trim();
    if (!/^[0-7]+$/.test(sizeText)) {
      throw new Error('Rollback artifact contains an invalid tar size');
    }
    const size = Number.parseInt(sizeText, 8);
    const bodyStart = offset + 512;
    const bodyEnd = bodyStart + size;
    if (!Number.isSafeInteger(size) || bodyEnd > tar.length) {
      throw new Error('Rollback artifact contains a truncated tar entry');
    }
    const type = String.fromCharCode(header[156] || 48);
    if (
      (fullName === 'package/theme.json' ||
        fullName === 'package/skin.json') &&
      (type === '0' || type === '\0')
    ) {
      if (size > MAX_MANIFEST_BYTES) {
        throw new Error('Rollback artifact manifest is too large');
      }
      manifests.push(JSON.parse(tar.subarray(bodyStart, bodyEnd).toString('utf8')));
    }
    offset = bodyStart + Math.ceil(size / 512) * 512;
  }
  if (manifests.length !== 1) {
    throw new Error('Rollback artifact must contain exactly one V3 manifest');
  }
  return manifests[0];
}

async function assertCurrentRuntimeAuthority() {
  const bytes = await readFile(currentAttestationPath);
  if (sha256(bytes) !== CURRENT_RUNTIME_ATTESTATION_SHA256) {
    throw new Error('Current RC.8 runtime attestation digest differs');
  }
  const attestation = JSON.parse(bytes.toString('utf8'));
  if (
    attestation.schemaVersion !== 2 ||
    attestation.certificationStatus !== 'verified' ||
    attestation.baseline !== `@deepseek-ai/dsh@${CURRENT_DSH_PACKAGE_VERSION}` ||
    attestation.compatibility?.dshPackageVersion !==
      CURRENT_DSH_PACKAGE_VERSION ||
    attestation.acceptance?.lifecycle?.strategy !== 'managed-cold-restart'
  ) {
    throw new Error('Current RC.8 runtime attestation is not executable authority');
  }
}

async function assertCurrentV3Artifact(entry) {
  const authorizedSha256 = CURRENT_HOSTED_ARTIFACTS.get(
    `${entry.packageName}@${entry.version}`
  );
  if (authorizedSha256 !== entry.artifactSha256) {
    throw new Error(
      'Rollback artifact is not in the current hosted artifact allowlist'
    );
  }
  const bytes = await readFile(entry.artifactPath);
  if (bytes.length > MAX_ARTIFACT_BYTES) {
    throw new Error('Rollback artifact exceeds the Manager size limit');
  }
  if (sha256(bytes) !== entry.artifactSha256) {
    throw new Error('Rollback artifact SHA-256 does not match its record');
  }
  const manifest = tarManifest(bytes);
  const compatibility = manifest?.compatibility;
  if (
    manifest?.schemaVersion !== '3.0' ||
    manifest?.slug !== entry.packageName.slice('@dsh-themes/'.length) ||
    manifest?.version !== entry.version ||
    compatibility?.dshPackageVersion !== CURRENT_DSH_PACKAGE_VERSION ||
    compatibility?.officialRelease?.tag !==
      `dsh-v${CURRENT_DSH_PACKAGE_VERSION}` ||
    compatibility?.officialRelease?.sourceCommit !== CURRENT_SOURCE_COMMIT ||
    compatibility?.selectorCatalogSha256 !==
      CURRENT_SELECTOR_CATALOG_SHA256 ||
    compatibility?.runtimeAttestationSha256 !==
      CURRENT_RUNTIME_ATTESTATION_SHA256
  ) {
    throw new Error('Rollback artifact is not an exact current RC.8 V3 release');
  }
}

async function artifact(values, prefix) {
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
  const entry = {
    packageName: name,
    version,
    artifactPath: normalizedPath,
    artifactSha256: sha256,
    manifestSchemaVersion: '3.0',
    dshPackageVersion: CURRENT_DSH_PACKAGE_VERSION,
    runtimeAttestationSha256: CURRENT_RUNTIME_ATTESTATION_SHA256,
  };
  await assertCurrentV3Artifact(entry);
  return entry;
}

function normalizeEntryShape(entry, allowNull = false) {
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

async function validateEntry(entry, allowNull = false) {
  const normalized = normalizeEntryShape(entry, allowNull);
  if (normalized === null) return null;
  if (
    entry.manifestSchemaVersion !== '3.0' ||
    entry.dshPackageVersion !== CURRENT_DSH_PACKAGE_VERSION ||
    entry.runtimeAttestationSha256 !== CURRENT_RUNTIME_ATTESTATION_SHA256
  ) {
    throw new Error('Rollback artifact entry lacks current RC.8 V3 authority');
  }
  const current = {
    ...normalized,
    manifestSchemaVersion: '3.0',
    dshPackageVersion: CURRENT_DSH_PACKAGE_VERSION,
    runtimeAttestationSha256: CURRENT_RUNTIME_ATTESTATION_SHA256,
  };
  await assertCurrentV3Artifact(current);
  return current;
}

async function validateRecord(input) {
  if (input?.schemaVersion === 1) {
    throw new Error(
      'Legacy schemaVersion 1 rollback record is read-only and cannot be executed'
    );
  }
  if (
    input?.schemaVersion !== 2 ||
    input?.profile !== 'web' ||
    input?.dshPackageVersion !== CURRENT_DSH_PACKAGE_VERSION ||
    input?.runtimeAttestationSha256 !== CURRENT_RUNTIME_ATTESTATION_SHA256
  ) {
    throw new Error('Unsupported rollback record authority');
  }
  await assertCurrentRuntimeAuthority();
  if (!Number.isFinite(Date.parse(input.createdAt))) throw new Error('Rollback record createdAt must be ISO-8601');
  const previous = await validateEntry(input.previous, true);
  const target = await validateEntry(input.target, true);
  if (previous === null && target === null) throw new Error('Rollback record cannot contain two built-in states');
  return {
    schemaVersion: 2,
    profile: 'web',
    dshPackageVersion: CURRENT_DSH_PACKAGE_VERSION,
    runtimeAttestationSha256: CURRENT_RUNTIME_ATTESTATION_SHA256,
    createdAt: new Date(input.createdAt).toISOString(),
    previous,
    target,
  };
}

async function inspectRecord(input) {
  if (input?.schemaVersion === 1) {
    if (input?.profile !== 'web') throw new Error('Unsupported rollback record');
    return {
      schemaVersion: 1,
      profile: 'web',
      createdAt: new Date(input.createdAt).toISOString(),
      previous: normalizeEntryShape(input.previous, true),
      target: normalizeEntryShape(input.target, true),
      executable: false,
      reason: 'schemaVersion 1 predates RC.8 runtime authority',
    };
  }
  return { ...(await validateRecord(input)), executable: true };
}

const { command, values } = parseArgs(process.argv.slice(2));
let result;
if (command === 'inspect') result = inspect(await loadJson(values.input));
else if (command === 'record') {
  await assertCurrentRuntimeAuthority();
  const createdAt = values.at ? new Date(values.at) : new Date();
  if (!Number.isFinite(createdAt.valueOf())) throw new Error('--at must be a valid date');
  result = {
    schemaVersion: 2,
    profile: 'web',
    dshPackageVersion: CURRENT_DSH_PACKAGE_VERSION,
    runtimeAttestationSha256: CURRENT_RUNTIME_ATTESTATION_SHA256,
    createdAt: createdAt.toISOString(),
    previous: await artifact(values, 'previous'),
    target: await artifact(values, 'target'),
  };
} else if (command === 'inspect-record') result = await inspectRecord(await loadJson(values.input));
else if (command === 'validate-record') result = await validateRecord(await loadJson(values.input));
else if (command === 'reverse') {
  const record = await validateRecord(await loadJson(values.input));
  result = {
    schemaVersion: 2,
    profile: 'web',
    dshPackageVersion: CURRENT_DSH_PACKAGE_VERSION,
    runtimeAttestationSha256: CURRENT_RUNTIME_ATTESTATION_SHA256,
    createdAt: new Date().toISOString(),
    previous: record.target,
    target: record.previous,
  };
} else {
  throw new Error('Usage: theme-state.mjs <inspect|record|inspect-record|validate-record|reverse> [--key value]');
}

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
