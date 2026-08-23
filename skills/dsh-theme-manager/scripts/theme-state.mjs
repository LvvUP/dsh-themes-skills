#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

import { isExactSemver } from './semver.mjs';
import {
  classifyHostedArtifact,
  CURRENT_INSTALLABLE_HOSTED_ARTIFACTS,
  LEGACY_ROLLBACK_HOSTED_ARTIFACTS,
} from './hosted-artifact-authority.mjs';
import { loadCertifiedAuthority } from './baseline-authority.mjs';

const PACKAGE = /^@dsh-themes\/[a-z0-9]+(?:[._-][a-z0-9]+)*$/;
const SHA256 = /^[0-9a-f]{64}$/;
const HISTORICAL_V2 = Object.freeze({
  dshPackageVersion: '0.1.0-rc.6',
  dshPackageIntegrity:
    'sha512-brpZfED7ieRa2PQ5tUxMhHrM1pb2CmKFVM/f6yMULBDMicahk+Z2OsHgTwTDnoiZm23Ftu9rQz0NN4pflaoJcg==',
  tokenCatalogSha256:
    'fe38fdb18dae76f3cc93e3ca3a37bb1916f207180781b1aa8321ee2ddadcb926',
  frontendBundleSha256:
    'a40165a9916acf9c5710e440842c9a56bc472ae9991f37f4675a7664ae784d68',
  selectorCatalogSha256:
    '5bcd9f874095af2114d86f91301868c6b0f2cebe58f51b9919150975d406baa3',
  runtimeAttestationSha256:
    '2400606c5cb6534e09a65020e4ae12a0df4c1d08f15918d714bc5037c2ed99ba',
});
const HISTORICAL_V1 = Object.freeze({
  dshPackageVersion: '0.1.0-rc.5',
  sourceCommit: '47f943859bef60e4160492346772ded9b24f765a',
  tokenCatalogSha256:
    'fe38fdb18dae76f3cc93e3ca3a37bb1916f207180781b1aa8321ee2ddadcb926',
});
const skillDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const certifiedAuthority = await loadCertifiedAuthority();
const CURRENT_DSH_PACKAGE_VERSION = certifiedAuthority.version;
const CURRENT_RUNTIME_ATTESTATION_SHA256 =
  certifiedAuthority.lane.attestationSha256;
const CURRENT_SOURCE_COMMIT =
  certifiedAuthority.attestation.compatibility.officialRelease.sourceCommit;
const CURRENT_SELECTOR_CATALOG_SHA256 =
  certifiedAuthority.attestation.compatibility.selectorCatalogSha256;
const currentAttestationPath = resolve(
  skillDir,
  certifiedAuthority.lane.attestationPath
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
    throw new Error('Expected exactly one unambiguous certified profile record');
  }
  const [profile] = profiles;
  if (profile.name !== 'dsh-profile-web') {
    throw new Error(`Expected the web profile record, received ${String(profile.name)}`);
  }
  return profile.dependencies === undefined ? [] : dependencyEntries(profile.dependencies);
}

function normalizedThemes(input) {
  if (!Array.isArray(input)) {
    throw new Error('Expected the certified plugin list root array');
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
    throw new Error('Rollback artifact must contain exactly one supported manifest');
  }
  return manifests[0];
}

async function assertCurrentRuntimeAuthority() {
  const bytes = await readFile(currentAttestationPath);
  if (sha256(bytes) !== CURRENT_RUNTIME_ATTESTATION_SHA256) {
    throw new Error('Current certified runtime attestation digest differs');
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
    throw new Error('Current certified runtime attestation is not executable authority');
  }
}

function exactV3Manifest(manifest, entry) {
  const compatibility = manifest?.compatibility;
  return Boolean(
    manifest?.schemaVersion === '3.0' &&
    manifest?.slug === entry.packageName.slice('@dsh-themes/'.length) &&
    manifest?.version === entry.version &&
    compatibility?.dshPackageVersion === CURRENT_DSH_PACKAGE_VERSION &&
    compatibility?.officialRelease?.tag ===
      `dsh-v${CURRENT_DSH_PACKAGE_VERSION}` &&
    compatibility?.officialRelease?.sourceCommit === CURRENT_SOURCE_COMMIT &&
    compatibility?.selectorCatalogSha256 ===
      CURRENT_SELECTOR_CATALOG_SHA256 &&
    compatibility?.runtimeAttestationSha256 ===
      CURRENT_RUNTIME_ATTESTATION_SHA256 &&
    SHA256.test(manifest?.payload?.sha256)
  );
}

function exactV2Manifest(manifest, entry) {
  const compatibility = manifest?.compatibility;
  const artifact = manifest?.artifact;
  const artifactMatches =
    artifact == null ||
    (artifact?.name === entry.packageName &&
      artifact?.version === entry.version &&
      artifact?.digestScope === 'artifact-tgz' &&
      artifact?.sha256 === entry.artifactSha256);
  return Boolean(
    manifest?.schemaVersion === '2.0' &&
    manifest?.slug === entry.packageName.slice('@dsh-themes/'.length) &&
    manifest?.version === entry.version &&
    artifactMatches &&
    compatibility?.dshPackageVersion === HISTORICAL_V2.dshPackageVersion &&
    compatibility?.dshPackageIntegrity === HISTORICAL_V2.dshPackageIntegrity &&
    compatibility?.tokenCatalogSha256 ===
      HISTORICAL_V2.tokenCatalogSha256 &&
    compatibility?.frontendBundleSha256 ===
      HISTORICAL_V2.frontendBundleSha256 &&
    compatibility?.selectorCatalogSha256 ===
      HISTORICAL_V2.selectorCatalogSha256 &&
    SHA256.test(manifest?.payload?.sha256) &&
    !Object.hasOwn(compatibility, 'sourceCommit')
  );
}

function exactV1Manifest(manifest, entry) {
  const compatibility = manifest?.compatibility;
  return Boolean(
    manifest?.schemaVersion === 1 &&
    manifest?.slug === entry.packageName.slice('@dsh-themes/'.length) &&
    manifest?.version === entry.version &&
    manifest?.package?.name === entry.packageName &&
    manifest?.package?.version === entry.version &&
    manifest?.package?.digestScope ===
      'canonical-tar-payload-excluding-theme.json' &&
    SHA256.test(manifest?.package?.sha256) &&
    compatibility?.deepseekHarnessVersion ===
      HISTORICAL_V1.dshPackageVersion &&
    compatibility?.deepseekHarnessCommit === HISTORICAL_V1.sourceCommit &&
    compatibility?.tokenCatalogSha256 ===
      HISTORICAL_V1.tokenCatalogSha256
  );
}

function manifestAuthority(manifest, entry, artifactAuthority) {
  if (exactV3Manifest(manifest, entry)) {
    return {
      artifactAuthority,
      manifestSchemaVersion: '3.0',
      dshPackageVersion: CURRENT_DSH_PACKAGE_VERSION,
      runtimeAttestationSha256: CURRENT_RUNTIME_ATTESTATION_SHA256,
      payloadSha256: manifest.payload.sha256,
    };
  }
  if (artifactAuthority === 'legacy-rollback' && exactV2Manifest(manifest, entry)) {
    return {
      artifactAuthority,
      manifestSchemaVersion: '2.0',
      dshPackageVersion: HISTORICAL_V2.dshPackageVersion,
      runtimeAttestationSha256: HISTORICAL_V2.runtimeAttestationSha256,
      payloadSha256: manifest.payload.sha256,
    };
  }
  if (artifactAuthority === 'legacy-rollback' && exactV1Manifest(manifest, entry)) {
    return {
      artifactAuthority,
      manifestSchemaVersion: '1',
      dshPackageVersion: HISTORICAL_V1.dshPackageVersion,
      runtimeAttestationSha256: null,
      payloadSha256: manifest.package.sha256,
    };
  }
  throw new Error(
    artifactAuthority === 'current-installable'
      ? 'Target artifact is not an exact current certified V3 release'
      : 'Rollback artifact does not match its exact retained V1, V2, or V3 authority'
  );
}

async function assertAuthorizedArtifact(
  entry,
  {
    allowLegacyRollback = false,
    currentArtifacts = CURRENT_INSTALLABLE_HOSTED_ARTIFACTS,
    legacyArtifacts = LEGACY_ROLLBACK_HOSTED_ARTIFACTS,
  } = {}
) {
  const artifactAuthority = classifyHostedArtifact(
    entry.packageName,
    entry.version,
    entry.artifactSha256,
    { currentArtifacts, legacyArtifacts }
  );
  if (
    artifactAuthority === null ||
    (artifactAuthority === 'legacy-rollback' && !allowLegacyRollback)
  ) {
    throw new Error(
      allowLegacyRollback
        ? 'Rollback artifact is not in the current or legacy rollback authority'
        : 'Target artifact is not in the current installable hosted authority'
    );
  }
  const bytes = await readFile(entry.artifactPath);
  if (bytes.length > MAX_ARTIFACT_BYTES) {
    throw new Error('Rollback artifact exceeds the Manager size limit');
  }
  if (sha256(bytes) !== entry.artifactSha256) {
    throw new Error('Rollback artifact SHA-256 does not match its record');
  }
  return manifestAuthority(tarManifest(bytes), entry, artifactAuthority);
}

async function artifact(values, prefix, authorityOptions = {}) {
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
  };
  const authority = await assertAuthorizedArtifact(entry, {
    ...authorityOptions,
    allowLegacyRollback: prefix === 'previous',
  });
  return { ...entry, ...authority };
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

async function validateEntry(
  entry,
  {
    allowNull = false,
    allowLegacyRollback = false,
    currentArtifacts = CURRENT_INSTALLABLE_HOSTED_ARTIFACTS,
    legacyArtifacts = LEGACY_ROLLBACK_HOSTED_ARTIFACTS,
  } = {}
) {
  const normalized = normalizeEntryShape(entry, allowNull);
  if (normalized === null) return null;
  const authority = await assertAuthorizedArtifact(normalized, {
    allowLegacyRollback,
    currentArtifacts,
    legacyArtifacts,
  });
  if (
    entry.artifactAuthority !== undefined &&
    entry.artifactAuthority !== authority.artifactAuthority
  ) {
    throw new Error('Rollback artifact entry authority was changed');
  }
  if (
    authority.artifactAuthority === 'legacy-rollback' &&
    entry.artifactAuthority !== 'legacy-rollback'
  ) {
    throw new Error('Legacy rollback artifact entry lacks explicit authority');
  }
  for (const field of [
    'manifestSchemaVersion',
    'dshPackageVersion',
    'runtimeAttestationSha256',
    'payloadSha256',
  ]) {
    if (entry[field] !== authority[field]) {
      throw new Error(`Rollback artifact entry ${field} was changed`);
    }
  }
  return { ...normalized, ...authority };
}

export async function validateRollbackRecord(
  input,
  {
    currentArtifacts = CURRENT_INSTALLABLE_HOSTED_ARTIFACTS,
    legacyArtifacts = LEGACY_ROLLBACK_HOSTED_ARTIFACTS,
  } = {}
) {
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
  const options = { currentArtifacts, legacyArtifacts };
  const previous = await validateEntry(input.previous, {
    ...options,
    allowNull: true,
    allowLegacyRollback: true,
  });
  const target = await validateEntry(input.target, {
    ...options,
    allowNull: true,
    allowLegacyRollback: true,
  });
  if (previous === null && target === null) throw new Error('Rollback record cannot contain two built-in states');
  if (
    previous?.artifactAuthority === 'legacy-rollback' &&
    target?.artifactAuthority !== 'current-installable'
  ) {
    throw new Error('A legacy rollback source requires one exact current target');
  }
  if (
    target?.artifactAuthority === 'legacy-rollback' &&
    previous?.artifactAuthority !== 'current-installable'
  ) {
    throw new Error('A reverse legacy target requires one exact current source');
  }
  const derivedDirection = previous?.artifactAuthority === 'legacy-rollback'
    ? 'rollback'
    : target?.artifactAuthority === 'legacy-rollback'
      ? 'reverse'
      : input.direction === 'reverse'
        ? 'reverse'
        : 'rollback';
  if (input.direction !== undefined && input.direction !== derivedDirection) {
    throw new Error('Rollback record direction does not match its artifact authorities');
  }
  return {
    schemaVersion: 2,
    profile: 'web',
    dshPackageVersion: CURRENT_DSH_PACKAGE_VERSION,
    runtimeAttestationSha256: CURRENT_RUNTIME_ATTESTATION_SHA256,
    direction: derivedDirection,
    createdAt: new Date(input.createdAt).toISOString(),
    previous,
    target,
  };
}

export async function reverseRollbackRecord(input, authorityOptions = {}) {
  const record = await validateRollbackRecord(input, authorityOptions);
  return {
    schemaVersion: 2,
    profile: 'web',
    dshPackageVersion: CURRENT_DSH_PACKAGE_VERSION,
    runtimeAttestationSha256: CURRENT_RUNTIME_ATTESTATION_SHA256,
    direction: record.direction === 'rollback' ? 'reverse' : 'rollback',
    createdAt: new Date().toISOString(),
    previous: record.target,
    target: record.previous,
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
      reason: 'schemaVersion 1 predates the current certified runtime authority',
    };
  }
  return { ...(await validateRollbackRecord(input)), executable: true };
}

async function runCli(argv) {
  const { command, values } = parseArgs(argv);
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
      direction: 'rollback',
      createdAt: createdAt.toISOString(),
      previous: await artifact(values, 'previous'),
      target: await artifact(values, 'target'),
    };
  } else if (command === 'inspect-record') result = await inspectRecord(await loadJson(values.input));
  else if (command === 'validate-record') result = await validateRollbackRecord(await loadJson(values.input));
  else if (command === 'reverse') {
    result = await reverseRollbackRecord(await loadJson(values.input));
  } else {
    throw new Error('Usage: theme-state.mjs <inspect|record|inspect-record|validate-record|reverse> [--key value]');
  }
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await runCli(process.argv.slice(2));
}
