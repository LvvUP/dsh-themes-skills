#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { isExactSemver } from './semver.mjs';
import {
  classifyHostedArtifact,
  CURRENT_INSTALLABLE_HOSTED_ARTIFACTS,
  LEGACY_ROLLBACK_HOSTED_ARTIFACTS,
} from './hosted-artifact-authority.mjs';
import { validateRollbackRecord } from './theme-state.mjs';
import { loadCertifiedAuthority } from './baseline-authority.mjs';

const HISTORICAL_V2 = Object.freeze({
  dshPackageVersion: '0.1.0-rc.6',
  dshPackageIntegrity: 'sha512-brpZfED7ieRa2PQ5tUxMhHrM1pb2CmKFVM/f6yMULBDMicahk+Z2OsHgTwTDnoiZm23Ftu9rQz0NN4pflaoJcg==',
  tokenCatalogSha256: 'fe38fdb18dae76f3cc93e3ca3a37bb1916f207180781b1aa8321ee2ddadcb926',
  frontendBundleSha256: 'a40165a9916acf9c5710e440842c9a56bc472ae9991f37f4675a7664ae784d68',
  frontendStylesheetSha256: '8ecb4b25268f5acae7e6f1b9e5cc8d14e5c5fa17da70a6a7863c896496f257ea',
  selectorCatalogSha256: '5bcd9f874095af2114d86f91301868c6b0f2cebe58f51b9919150975d406baa3',
});
const RUNTIME_V1 = Object.freeze({
  schemaVersion: 1,
  attestationSha256: '2400606c5cb6534e09a65020e4ae12a0df4c1d08f15918d714bc5037c2ed99ba',
  runnerLockfileSha256: '22f995efe8338c2a3cd97bd731853d010363531145c35073adb2dca3773f6053',
  criticalPackagesCount: 197,
  criticalPackagesSha256: 'f883815b282c4e86a1ecb8cf60914459f875a1d34da02cfce8b119824a950894',
  packageManagerName: 'pnpm',
  packageManagerVersion: '11.7.0',
  packageManagerIntegrity: 'sha512-GcyFLBIMcSV2DyRD7mvgyltA+fUFmN4aCaHxd1A+AQ5Xwjx3ZG4B52HeWb+HT7IqM5jDOrlpH8E+uUa28PTWIA==',
  uiThemePackageVersion: '0.1.0-rc.6',
  uiThemePackageIntegrity: 'sha512-Wu+bvnuti/gLA+t5a2cWUMQJ5UCqxt6oEK+OJiJ68gN0ixs2skpaN0nFdFoY2exC5KByXrNlN1rRrD+FsZSBLA==',
  webFrontendPackageVersion: '0.1.0-rc.6',
  webFrontendPackageIntegrity: 'sha512-+RpdDF11FqUZSbJGoZ4oLIk/4PJR+ynTS4ELMn9QqucbYZ8tv0Itq9ZtG2o6pKIe7NO0lj/eBjCR2EoRKx7L+g==',
  frontendBundleSha256: 'a40165a9916acf9c5710e440842c9a56bc472ae9991f37f4675a7664ae784d68',
  frontendStylesheetSha256: '8ecb4b25268f5acae7e6f1b9e5cc8d14e5c5fa17da70a6a7863c896496f257ea',
});
const HISTORICAL = Object.freeze({
  dshVersion: '0.1.0-rc.5',
  commit: '47f943859bef60e4160492346772ded9b24f765a',
  tokenCatalogSha256: 'fe38fdb18dae76f3cc93e3ca3a37bb1916f207180781b1aa8321ee2ddadcb926',
});
const SHA256 = /^[0-9a-f]{64}$/;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const certifiedAuthority = await loadCertifiedAuthority();
const finalAttestation = certifiedAuthority.attestation;
const RUNTIME_V2 = Object.freeze({
  schemaVersion: finalAttestation.schemaVersion,
  attestationSha256: certifiedAuthority.lane.attestationSha256,
  runnerLockfileSha256: finalAttestation.lockfile.sha256,
  productionPackagesCount: finalAttestation.productionClosure.packageCount,
  productionPackagesSha256: finalAttestation.productionClosure.sha256,
  dshPackagesCount: finalAttestation.productionClosure.dshPackageCount,
  dshPackagesSha256:
    finalAttestation.productionClosure.dshPackagesSha256,
  packageManagerName: finalAttestation.packageManager.name,
  packageManagerVersion: finalAttestation.packageManager.version,
  dshPackageVersion: finalAttestation.compatibility.dshPackageVersion,
  certificationRunId: finalAttestation.certificationRun.runId,
  certificationHeadSha: finalAttestation.certificationRun.headSha,
  lifecycle: finalAttestation.acceptance.lifecycle.strategy,
});
const CURRENT_V3 = Object.freeze({
  ...finalAttestation.compatibility,
  runtimeAttestationSha256: RUNTIME_V2.attestationSha256,
});

function fail(message) {
  throw new Error(message);
}

function parseArgs(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith('--') || value == null) fail('Arguments must be --key value pairs');
    values[key.slice(2)] = value;
  }
  return values;
}

function object(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${name} must be an object`);
  return value;
}

function exact(value, expected, name) {
  if (value !== expected) fail(`${name} does not match the certified baseline`);
}

function checkSha(value, name) {
  if (typeof value !== 'string' || !SHA256.test(value)) fail(`${name} must be a lowercase SHA-256`);
}

function onlyKeys(value, allowed, name) {
  const unexpected = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unexpected.length) fail(`${name} contains unsupported field ${unexpected[0]}`);
}

function validateDistribution(record) {
  exact(record.verified, true, 'verified');
  const distribution = object(record.distribution, 'distribution');
  onlyKeys(
    distribution,
    ['kind', 'installability', 'redistribution', 'previewPolicy'],
    'distribution'
  );
  exact(distribution.kind, 'hosted-verified-artifact', 'distribution.kind');
  exact(distribution.installability, 'manager', 'distribution.installability');
  exact(distribution.redistribution, 'allowed', 'distribution.redistribution');
  exact(distribution.previewPolicy, 'hosted', 'distribution.previewPolicy');
}

function validateRuntimeAttestation(value, expected) {
  const attestation = object(value, 'runtimeAttestation');
  onlyKeys(attestation, Object.keys(expected), 'runtimeAttestation');
  for (const [key, expectedValue] of Object.entries(expected)) {
    exact(attestation[key], expectedValue, `runtimeAttestation.${key}`);
  }
  return attestation;
}

function stableJson(value) {
  const stable = (entry) => {
    if (Array.isArray(entry)) return entry.map(stable);
    if (!entry || typeof entry !== 'object') return entry;
    return Object.fromEntries(
      Object.keys(entry)
        .sort()
        .map((key) => [key, stable(entry[key])])
    );
  };
  return JSON.stringify(stable(value));
}

function trustedOrigin(value) {
  if (!value) fail('--origin is required');
  const url = new URL(value);
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  ) {
    fail('origin must be a credential-free HTTPS origin');
  }
  return url.origin;
}

function controlledArtifactUrl(value, origin, slug, version) {
  if (typeof value !== 'string') fail('artifactUrl is required');
  const url = new URL(value);
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.origin !== origin ||
    url.search ||
    url.hash
  ) {
    fail('artifactUrl must be a credential-free HTTPS URL on the trusted origin');
  }
  const expectedPath = `/api/themes/${slug}/download/${version}`;
  if (url.pathname !== expectedPath) fail(`artifactUrl must use the controlled route ${expectedPath}`);
  return url.toString();
}

function checkIntegrity(sha256, integrity, name) {
  const expected = `sha256-${Buffer.from(sha256, 'hex').toString('base64')}`;
  if (integrity !== expected) fail(`${name}.integrity does not encode its SHA-256`);
}

function validateV2(record, manifest, origin) {
  validateDistribution(record);
  const runtimeAttestation = validateRuntimeAttestation(
    record.runtimeAttestation,
    RUNTIME_V1
  );
  if (manifest.kind !== 'theme' && manifest.kind !== 'full-skin') fail('V2 kind must be theme or full-skin');
  if (!SLUG.test(manifest.slug) || !isExactSemver(manifest.version)) fail('V2 slug or version is invalid');

  const compatibility = object(manifest.compatibility, 'manifest.compatibility');
  for (const [key, expected] of Object.entries(HISTORICAL_V2)) {
    if (key === 'frontendStylesheetSha256') continue;
    exact(compatibility[key], expected, `compatibility.${key}`);
  }
  if (Object.hasOwn(compatibility, 'sourceCommit')) {
    fail('compatibility.sourceCommit must be omitted for rc.6');
  }

  const artifact = object(manifest.artifact, 'manifest.artifact');
  exact(artifact.name, `@dsh-themes/${manifest.slug}`, 'artifact.name');
  exact(artifact.version, manifest.version, 'artifact.version');
  exact(artifact.fileName, `${manifest.slug}-${manifest.version}.tgz`, 'artifact.fileName');
  exact(artifact.digestScope, 'artifact-tgz', 'artifact.digestScope');
  checkSha(artifact.sha256, 'artifact.sha256');
  checkIntegrity(artifact.sha256, artifact.integrity, 'artifact');
  checkSha(record.artifactSha256, 'artifactSha256');
  exact(record.artifactSha256, artifact.sha256, 'catalog artifactSha256');

  const payload = object(manifest.payload, 'manifest.payload');
  exact(payload.fileName, `${manifest.slug}-${manifest.version}.payload.tar`, 'payload.fileName');
  exact(payload.digestScope, 'canonical-tar-payload-excluding-manifest', 'payload.digestScope');
  checkSha(payload.sha256, 'payload.sha256');
  checkIntegrity(payload.sha256, payload.integrity, 'payload');
  if (payload.sha256 === artifact.sha256) fail('payload and artifact digests must use distinct scopes');
  if (manifest.package !== undefined) fail('V2 manifests cannot use the V1 package digest field');

  return {
    status: 'historical-v2',
    installableCurrent: false,
    dshVersion: HISTORICAL_V2.dshPackageVersion,
    packageName: artifact.name,
    version: manifest.version,
    artifactUrl: controlledArtifactUrl(record.artifactUrl, origin, manifest.slug, manifest.version),
    artifactSha256: artifact.sha256,
    payloadSha256: payload.sha256,
    runtimeAttestationSha256: runtimeAttestation.attestationSha256,
  };
}

function validateV1(record, manifest, origin) {
  if (!SLUG.test(manifest.slug) || !isExactSemver(manifest.version)) fail('V1 slug or version is invalid');
  const compatibility = object(manifest.compatibility, 'manifest.compatibility');
  exact(compatibility.deepseekHarnessVersion, HISTORICAL.dshVersion, 'compatibility.deepseekHarnessVersion');
  exact(compatibility.deepseekHarnessCommit, HISTORICAL.commit, 'compatibility.deepseekHarnessCommit');
  exact(compatibility.tokenCatalogSha256, HISTORICAL.tokenCatalogSha256, 'compatibility.tokenCatalogSha256');

  const payload = object(manifest.package, 'manifest.package');
  exact(payload.name, `@dsh-themes/${manifest.slug}`, 'package.name');
  exact(payload.version, manifest.version, 'package.version');
  exact(payload.fileName, `${manifest.slug}-${manifest.version}.tgz`, 'package.fileName');
  exact(payload.digestScope, 'canonical-tar-payload-excluding-theme.json', 'package.digestScope');
  checkSha(payload.sha256, 'package.sha256');
  checkIntegrity(payload.sha256, payload.integrity, 'package');
  checkSha(record.artifactSha256, 'artifactSha256');

  return {
    status: 'historical-v1',
    installableCurrent: false,
    dshVersion: HISTORICAL.dshVersion,
    sourceCommit: HISTORICAL.commit,
    packageName: payload.name,
    version: manifest.version,
    artifactUrl: controlledArtifactUrl(record.artifactUrl, origin, manifest.slug, manifest.version),
    artifactSha256: record.artifactSha256,
    payloadSha256: payload.sha256,
  };
}

function validateV3(record, manifest, origin) {
  validateDistribution(record);
  const runtimeAttestation = validateRuntimeAttestation(
    record.runtimeAttestation,
    RUNTIME_V2
  );
  if (manifest.kind !== 'theme' && manifest.kind !== 'full-skin') {
    fail('V3 kind must be theme or full-skin');
  }
  if (!SLUG.test(manifest.slug) || !isExactSemver(manifest.version)) {
    fail('V3 slug or version is invalid');
  }
  const compatibility = object(
    manifest.compatibility,
    'manifest.compatibility'
  );
  if (stableJson(compatibility) !== stableJson(CURRENT_V3)) {
    fail(
      'V3 compatibility must match the exact certified evidence; mixed baseline evidence is forbidden'
    );
  }

  const artifact = object(manifest.artifact, 'manifest.artifact');
  exact(artifact.name, `@dsh-themes/${manifest.slug}`, 'artifact.name');
  exact(artifact.version, manifest.version, 'artifact.version');
  exact(
    artifact.fileName,
    `${manifest.slug}-${manifest.version}.tgz`,
    'artifact.fileName'
  );
  exact(artifact.digestScope, 'artifact-tgz', 'artifact.digestScope');
  checkSha(artifact.sha256, 'artifact.sha256');
  checkIntegrity(artifact.sha256, artifact.integrity, 'artifact');
  checkSha(record.artifactSha256, 'artifactSha256');
  exact(record.artifactSha256, artifact.sha256, 'catalog artifactSha256');

  const payload = object(manifest.payload, 'manifest.payload');
  exact(
    payload.fileName,
    `${manifest.slug}-${manifest.version}.payload.tar`,
    'payload.fileName'
  );
  exact(
    payload.digestScope,
    'canonical-tar-payload-excluding-manifest',
    'payload.digestScope'
  );
  checkSha(payload.sha256, 'payload.sha256');
  checkIntegrity(payload.sha256, payload.integrity, 'payload');
  if (payload.sha256 === artifact.sha256) {
    fail('payload and artifact digests must use distinct scopes');
  }
  if (manifest.package !== undefined) {
    fail('V3 manifests cannot use the V1 package digest field');
  }

  return {
    status: 'current',
    installableCurrent: true,
    dshVersion: CURRENT_V3.dshPackageVersion,
    sourceCommit: CURRENT_V3.officialRelease.sourceCommit,
    packageName: artifact.name,
    version: manifest.version,
    artifactUrl: controlledArtifactUrl(
      record.artifactUrl,
      origin,
      manifest.slug,
      manifest.version
    ),
    artifactSha256: artifact.sha256,
    payloadSha256: payload.sha256,
    runtimeAttestationSha256: runtimeAttestation.attestationSha256,
    certificationRunId: runtimeAttestation.certificationRunId,
    lifecycle: runtimeAttestation.lifecycle,
  };
}

export async function validateReleaseRecord(
  rawRecord,
  {
    origin: rawOrigin,
    authority = 'current',
    rollbackRecord,
    currentArtifacts = CURRENT_INSTALLABLE_HOSTED_ARTIFACTS,
    legacyArtifacts = LEGACY_ROLLBACK_HOSTED_ARTIFACTS,
  } = {}
) {
  const record = object(rawRecord, 'release record');
  const manifest = object(record.manifest, 'manifest');
  const origin = trustedOrigin(rawOrigin);
  const result = manifest.schemaVersion === '2.0'
    ? validateV2(record, manifest, origin)
    : manifest.schemaVersion === '3.0'
      ? validateV3(record, manifest, origin)
      : manifest.schemaVersion === 1
        ? validateV1(record, manifest, origin)
        : fail('unsupported manifest schemaVersion');

  const artifactAuthority = classifyHostedArtifact(
    result.packageName,
    result.version,
    result.artifactSha256,
    { currentArtifacts, legacyArtifacts }
  );
  if (authority === 'current') {
    if (manifest.schemaVersion !== '3.0') return result;
    if (artifactAuthority !== 'current-installable') {
      fail(
        artifactAuthority === 'legacy-rollback'
          ? 'legacy rollback artifacts are not valid fresh-install or normal catalog targets'
          : 'hosted artifact is not in the current installable authority'
      );
    }
    return { ...result, artifactAuthority };
  }
  if (authority !== 'legacy-rollback') {
    fail('authority must be current or legacy-rollback');
  }
  if (artifactAuthority !== 'legacy-rollback') {
    fail('legacy rollback authority requires one exact retired artifact');
  }
  if (manifest.schemaVersion === 1) validateDistribution(record);
  if (!rollbackRecord) {
    fail('legacy rollback authority requires a verified schema-2 rollback record');
  }
  const validatedRollback = await validateRollbackRecord(rollbackRecord, {
    currentArtifacts,
    legacyArtifacts,
  });
  const previous = validatedRollback.previous;
  if (
    previous?.artifactAuthority !== 'legacy-rollback' ||
    previous.packageName !== result.packageName ||
    previous.version !== result.version ||
    previous.artifactSha256 !== result.artifactSha256 ||
    previous.payloadSha256 !== result.payloadSha256
  ) {
    fail('release record does not match the legacy artifact selected by rollback');
  }
  return {
    ...result,
    historicalStatus: result.status,
    status: 'legacy-rollback',
    installableCurrent: false,
    rollbackEligible: true,
    artifactAuthority,
  };
}

async function runCli(argv) {
  const args = parseArgs(argv);
  if (!args.input) fail('--input is required');
  const record = object(
    JSON.parse(await readFile(resolve(args.input), 'utf8')),
    'release record'
  );
  const rollbackRecord = args['rollback-record']
    ? JSON.parse(await readFile(resolve(args['rollback-record']), 'utf8'))
    : undefined;
  const result = await validateReleaseRecord(record, {
    origin: args.origin,
    authority: args.authority ?? 'current',
    rollbackRecord,
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await runCli(process.argv.slice(2));
}
