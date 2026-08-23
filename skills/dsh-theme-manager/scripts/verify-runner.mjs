#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { loadCertifiedAuthority } from './baseline-authority.mjs';

const skillDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const authority = await loadCertifiedAuthority();
const runtimeDir = authority.runtimeDir;
const expectedAttestationSha256 = authority.lane.attestationSha256;
const expectedVersion = authority.version;
const pinnedAttestation = authority.attestation;
const expectedLockfileSha256 = pinnedAttestation.lockfile.sha256;
const expectedClosureSha256 = pinnedAttestation.productionClosure.sha256;
const expectedDshClosureSha256 =
  pinnedAttestation.productionClosure.dshPackagesSha256;
const expectedPackageCount = pinnedAttestation.productionClosure.packageCount;
const expectedDshPackageCount =
  pinnedAttestation.productionClosure.dshPackageCount;
const { parse } = await import(
  pathToFileURL(resolve(runtimeDir, 'node_modules/yaml/dist/index.js')).href
);
const SHA512 = /^sha512-[A-Za-z0-9+/]+={0,2}$/;
const quiet = process.argv.length === 3 && process.argv[2] === '--quiet';
if (process.argv.length > (quiet ? 3 : 2)) {
  throw new Error('Usage: verify-runner.mjs [--quiet]');
}

const sha256 = (value) =>
  createHash('sha256').update(value).digest('hex');

function fail(message) {
  throw new Error(`certified operational baseline refused: ${message}`);
}

function packageIdentity(key) {
  const match = /^(@[^/]+\/[^@]+|[^@/]+)@([^()]+)(?:\(.*\))?$/.exec(key);
  return match ? { name: match[1], version: match[2] } : null;
}

function closureDigest(packages) {
  return sha256(
    packages
      .map((entry) => `${entry.name}@${entry.version}\t${entry.integrity}\n`)
      .join('')
  );
}

function compareCanonicalText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

const [attestationBytes, lockBytes, dshPackage, pnpmPackage] =
  await Promise.all([
    readFile(resolve(runtimeDir, 'attestation.json')),
    readFile(resolve(runtimeDir, 'pnpm-lock.yaml')),
    readFile(resolve(runtimeDir, 'node_modules/@deepseek-ai/dsh/package.json')),
    readFile(resolve(runtimeDir, 'node_modules/pnpm/package.json')),
  ]).catch(() =>
    fail(
      'certified runtime is not bootstrapped with the frozen ignore-scripts install'
    )
  );

if (sha256(attestationBytes) !== expectedAttestationSha256) {
  fail('attestation digest differs');
}
if (sha256(lockBytes) !== expectedLockfileSha256) {
  fail('lockfile digest differs');
}

const attestation = JSON.parse(attestationBytes.toString('utf8'));
if (
  !Number.isInteger(attestation.schemaVersion) ||
  attestation.certificationStatus !== 'verified' ||
  attestation.baseline !== `@deepseek-ai/dsh@${expectedVersion}` ||
  attestation.lockfile?.path !==
    `${authority.lane.runtimeDirectory}/pnpm-lock.yaml` ||
  attestation.lockfile?.sha256 !== expectedLockfileSha256 ||
  attestation.productionClosure?.packageCount !== expectedPackageCount ||
  attestation.productionClosure?.sha256 !== expectedClosureSha256 ||
  attestation.productionClosure?.dshPackageCount !== expectedDshPackageCount ||
  attestation.productionClosure?.dshPackagesSha256 !==
    expectedDshClosureSha256 ||
  attestation.compatibility?.dshPackageVersion !== expectedVersion ||
  attestation.compatibility?.officialRelease?.tag !==
    `dsh-v${expectedVersion}` ||
  !/^[0-9a-f]{40}$/.test(
    attestation.compatibility?.officialRelease?.sourceCommit ?? ''
  ) ||
  attestation.compatibility?.npmArtifacts?.dsh?.version !== expectedVersion ||
  !SHA512.test(
    attestation.compatibility?.npmArtifacts?.dsh?.integrity ?? ''
  ) ||
  !/^[0-9a-f]{64}$/.test(
    attestation.compatibility?.selectorCatalogSha256 ?? ''
  ) ||
  !/^[0-9a-f]{64}$/.test(attestation.acceptance?.uiEvidenceSha256 ?? '') ||
  attestation.acceptance?.selectorScope !==
    'published-artifact-allowlist' ||
  attestation.acceptance?.lifecycle?.strategy !== 'managed-cold-restart' ||
  typeof attestation.acceptance?.lifecycle?.productionLiveUnload !== 'string' ||
  attestation.acceptance?.lifecycle?.productionLiveHmr !==
    'not-certified-or-promised' ||
  !Number.isInteger(attestation.certificationRun?.runId) ||
  !/^https:\/\/github\.com\/LvvUP\/DSH-Themes\/actions\/runs\/\d+$/.test(
    attestation.certificationRun?.runUrl ?? ''
  ) ||
  !/^[0-9a-f]{40}$/.test(attestation.certificationRun?.headSha ?? '') ||
  attestation.certificationRun?.conclusion !== 'success' ||
  !Array.isArray(attestation.certificationRun?.matrix) ||
  attestation.certificationRun.matrix.length !== 6 ||
  attestation.certificationRun.matrix.some(
    (job) => job.conclusion !== 'success'
  )
) {
  fail('attestation fields differ from the certified baseline contract');
}
const matrixIdentities = new Set(
  attestation.certificationRun.matrix.map(
    (job) => `${job.platform}@${job.nodeVersion}`
  )
);
for (const identity of [
  'linux@22.19.0',
  'linux@24.15.0',
  'darwin@22.19.0',
  'darwin@24.15.0',
  'win32@22.19.0',
  'win32@24.15.0',
]) {
  if (!matrixIdentities.has(identity)) fail(`matrix is missing ${identity}`);
}

const lock = parse(lockBytes.toString('utf8'));
const byIdentity = new Map();
for (const [key, value] of Object.entries(lock.packages ?? {})) {
  const identity = packageIdentity(key);
  if (!identity) continue;
  const integrity = value?.resolution?.integrity;
  if (typeof integrity !== 'string' || !SHA512.test(integrity)) {
    fail(`lockfile integrity is missing for ${key}`);
  }
  byIdentity.set(`${identity.name}@${identity.version}`, {
    ...identity,
    integrity,
  });
}
const packages = [...byIdentity.values()].sort(
  (left, right) =>
    compareCanonicalText(left.name, right.name) ||
    compareCanonicalText(left.version, right.version)
);
const dshPackages = packages.filter((entry) =>
  entry.name.startsWith('@deepseek-ai/dsh')
);
if (
  packages.length !== expectedPackageCount ||
  closureDigest(packages) !== expectedClosureSha256 ||
  dshPackages.length !== expectedDshPackageCount ||
  closureDigest(dshPackages) !== expectedDshClosureSha256 ||
  dshPackages.some((entry) => entry.version !== expectedVersion)
) {
  fail('lockfile contains an incomplete or mixed release closure');
}
if (
  JSON.parse(dshPackage).version !== expectedVersion ||
  JSON.parse(pnpmPackage).version !== '11.7.0'
) {
  fail('installed CLI or package manager differs from the certified closure');
}
const cli = spawnSync(
  process.execPath,
  [resolve(runtimeDir, 'node_modules/@deepseek-ai/dsh/lib/bin.js'), '--version'],
  { encoding: 'utf8', env: { ...process.env, NO_COLOR: '1' } }
);
if (cli.status !== 0 || cli.stdout.trim() !== expectedVersion) {
  fail(`certified CLI did not execute as exactly ${expectedVersion}`);
}

if (!quiet) {
  process.stdout.write(
    `${JSON.stringify({
      status: 'verified',
      dshVersion: expectedVersion,
      attestationSha256: expectedAttestationSha256,
      lockfileSha256: expectedLockfileSha256,
      packages: packages.length,
      dshPackages: dshPackages.length,
      certificationRunId: attestation.certificationRun.runId,
      lifecycle: 'managed-cold-restart',
    })}\n`
  );
}
