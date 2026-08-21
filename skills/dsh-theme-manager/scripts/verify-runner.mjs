#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parse } from '../runtime-rc8/node_modules/yaml/dist/index.js';

const skillDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const runtimeDir = resolve(skillDir, 'runtime-rc8');
const EXPECTED_ATTESTATION_SHA256 =
  '1cd9a0b4a6b9d215f0a1f70a97b4d43eae7bf4f846ae7009b7ddb812823ca0ae';
const EXPECTED_LOCKFILE_SHA256 =
  'b38b68f1f443b7065f530d665ea7acbc9327275503ba0d9a6edd030b81f915ec';
const EXPECTED_CLOSURE_SHA256 =
  '58c78fcf15d2b6c58bad0fc870a4d28dabda33bfae3633cf94794465564a939b';
const EXPECTED_DSH_CLOSURE_SHA256 =
  'aa3929a9418b928d9ef200964f8ae4cce54086b1d5bc474cb9b42af90f0a78d8';
const SHA512 = /^sha512-[A-Za-z0-9+/]+={0,2}$/;
const quiet = process.argv.length === 3 && process.argv[2] === '--quiet';
if (process.argv.length > (quiet ? 3 : 2)) {
  throw new Error('Usage: verify-runner.mjs [--quiet]');
}

const sha256 = (value) =>
  createHash('sha256').update(value).digest('hex');

function fail(message) {
  throw new Error(`RC.8 certified attestation refused: ${message}`);
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

if (sha256(attestationBytes) !== EXPECTED_ATTESTATION_SHA256) {
  fail('attestation digest differs');
}
if (sha256(lockBytes) !== EXPECTED_LOCKFILE_SHA256) {
  fail('lockfile digest differs');
}

const attestation = JSON.parse(attestationBytes.toString('utf8'));
if (
  attestation.schemaVersion !== 2 ||
  attestation.certificationStatus !== 'verified' ||
  attestation.baseline !== '@deepseek-ai/dsh@0.1.0-rc.8' ||
  attestation.lockfile?.path !== 'runtime-rc8/pnpm-lock.yaml' ||
  attestation.lockfile?.sha256 !== EXPECTED_LOCKFILE_SHA256 ||
  attestation.productionClosure?.packageCount !== 504 ||
  attestation.productionClosure?.sha256 !== EXPECTED_CLOSURE_SHA256 ||
  attestation.productionClosure?.dshPackageCount !== 187 ||
  attestation.productionClosure?.dshPackagesSha256 !==
    EXPECTED_DSH_CLOSURE_SHA256 ||
  attestation.compatibility?.dshPackageVersion !== '0.1.0-rc.8' ||
  attestation.compatibility?.officialRelease?.tag !== 'dsh-v0.1.0-rc.8' ||
  attestation.compatibility?.officialRelease?.sourceCommit !==
    '141eb6fef83422698aef7a981029e843e8161534' ||
  attestation.compatibility?.npmArtifacts?.dsh?.integrity !==
    'sha512-VQU5NlomrKLRgcXuOf+sxWFvqxPA8q9vMhrKPlPPXiOJEhGlGlAdiyxZvZxkCVI+v0zbhe21cY3/luLyxpSzzA==' ||
  attestation.compatibility?.selectorCatalogSha256 !==
    '663aa5927591ac99076f924ee9cd6f9bd09e6a8a9ee1e6b8b1b0d9e3093df807' ||
  attestation.acceptance?.uiEvidenceSha256 !==
    '056ab031d6605420adeb4219eaea1a402344cef080007d79558439845b00ea3d' ||
  attestation.acceptance?.selectorScope !==
    'published-artifact-allowlist' ||
  attestation.acceptance?.lifecycle?.strategy !== 'managed-cold-restart' ||
  attestation.acceptance?.lifecycle?.productionLiveUnload !==
    'unsupported-by-upstream-rc8' ||
  attestation.acceptance?.lifecycle?.productionLiveHmr !==
    'not-certified-or-promised' ||
  attestation.certificationRun?.runId !== 32393288849 ||
  attestation.certificationRun?.runUrl !==
    'https://github.com/LvvUP/DSH-Themes/actions/runs/32393288849' ||
  attestation.certificationRun?.headSha !==
    'e3fe9ac465b8db8070efbdb83ddc6c821f923a73' ||
  attestation.certificationRun?.conclusion !== 'success' ||
  !Array.isArray(attestation.certificationRun?.matrix) ||
  attestation.certificationRun.matrix.length !== 6 ||
  attestation.certificationRun.matrix.some(
    (job) => job.conclusion !== 'success'
  )
) {
  fail('attestation fields differ from the certified RC.8 contract');
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
  packages.length !== 504 ||
  closureDigest(packages) !== EXPECTED_CLOSURE_SHA256 ||
  dshPackages.length !== 187 ||
  closureDigest(dshPackages) !== EXPECTED_DSH_CLOSURE_SHA256 ||
  dshPackages.some((entry) => entry.version !== '0.1.0-rc.8')
) {
  fail('lockfile contains an incomplete or mixed release closure');
}
if (
  JSON.parse(dshPackage).version !== '0.1.0-rc.8' ||
  JSON.parse(pnpmPackage).version !== '11.7.0'
) {
  fail('installed CLI or package manager differs from the certified closure');
}
const cli = spawnSync(
  process.execPath,
  [resolve(runtimeDir, 'node_modules/@deepseek-ai/dsh/lib/bin.js'), '--version'],
  { encoding: 'utf8', env: { ...process.env, NO_COLOR: '1' } }
);
if (cli.status !== 0 || cli.stdout.trim() !== '0.1.0-rc.8') {
  fail('certified CLI did not execute as exactly 0.1.0-rc.8');
}

if (!quiet) {
  process.stdout.write(
    `${JSON.stringify({
      status: 'verified',
      dshVersion: '0.1.0-rc.8',
      attestationSha256: EXPECTED_ATTESTATION_SHA256,
      lockfileSha256: EXPECTED_LOCKFILE_SHA256,
      packages: packages.length,
      dshPackages: dshPackages.length,
      certificationRunId: 32393288849,
      lifecycle: 'managed-cold-restart',
    })}\n`
  );
}
