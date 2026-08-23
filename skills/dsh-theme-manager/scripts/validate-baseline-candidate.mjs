#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  loadCandidateAuthority,
  rejectMutableSelectors,
  sha256,
} from './baseline-authority.mjs';

const SHA512 = /^sha512-[A-Za-z0-9+/]+={0,2}$/;
const EXPECTED_MATRIX = new Set([
  'linux@22.19.0',
  'linux@24.15.0',
  'darwin@22.19.0',
  'darwin@24.15.0',
  'win32@22.19.0',
  'win32@24.15.0',
]);
const EXPECTED_SCENARIOS = new Set([
  'install-list-remove',
  'light-dark-system',
  'managed-cold-restart',
  'rollback-reverse',
  'malformed-evidence-fails-closed',
  'mixed-version-evidence-fails-closed',
]);

function fail(message) {
  throw new Error(`candidate baseline refused: ${message}`);
}

function packageIdentity(key) {
  const match = /^(@[^/]+\/[^@]+|[^@/]+)@([^()]+)(?:\(.*\))?$/.exec(key);
  return match ? { name: match[1], version: match[2] } : null;
}

function compareCanonicalText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function closureDigest(packages) {
  return sha256(
    packages
      .map((entry) => `${entry.name}@${entry.version}\t${entry.integrity}\n`)
      .join('')
  );
}

function exactSet(values, expected, label) {
  if (
    values.length !== expected.size ||
    values.some((value) => !expected.has(value))
  ) {
    fail(`${label} differs from the required contract`);
  }
}

export async function validateCandidateBaseline({ input } = {}) {
  const authority = await loadCandidateAuthority();
  const { sidecar, attestation, receipt, runtimeDir, version } = authority;
  if (input) {
    const inputBytes = await readFile(resolve(input));
    const inputValue = JSON.parse(inputBytes.toString('utf8'));
    rejectMutableSelectors(inputValue);
    if (sha256(inputBytes) !== authority.lane.sidecarSha256) {
      fail('input sidecar is not the pinned candidate evidence');
    }
  }

  const lockBytes = await readFile(resolve(runtimeDir, 'pnpm-lock.yaml'));
  const yamlModuleUrl = pathToFileURL(
    resolve(runtimeDir, 'node_modules/yaml/dist/index.js')
  ).href;
  const { parse } = await import(yamlModuleUrl).catch(() =>
    fail('candidate runtime is not bootstrapped with frozen dependencies')
  );
  if (
    sha256(lockBytes) !== sidecar.lockExpectation?.sha256 ||
    sha256(lockBytes) !== attestation.lockfile?.sha256 ||
    sha256(lockBytes) !== receipt.runtime?.lockfileSha256
  ) {
    fail('lockfile digest differs across sidecar, attestation, or receipt');
  }

  const lock = parse(lockBytes.toString('utf8'));
  const byIdentity = new Map();
  for (const [key, entry] of Object.entries(lock.packages ?? {})) {
    const identity = packageIdentity(key);
    if (!identity) continue;
    const integrity = entry?.resolution?.integrity;
    if (typeof integrity !== 'string' || !SHA512.test(integrity)) {
      fail(`registry integrity is missing for ${key}`);
    }
    const identityKey = `${identity.name}@${identity.version}`;
    const existing = byIdentity.get(identityKey);
    if (existing && existing.integrity !== integrity) {
      fail(`conflicting integrity for ${identityKey}`);
    }
    byIdentity.set(identityKey, { ...identity, integrity });
  }
  const packages = [...byIdentity.values()].sort(
    (left, right) =>
      compareCanonicalText(left.name, right.name) ||
      compareCanonicalText(left.version, right.version)
  );
  const dshPackages = packages.filter((entry) =>
    entry.name.startsWith('@deepseek-ai/dsh')
  );
  const expected = sidecar.lockExpectation;
  if (
    packages.length !== expected.productionPackagesCount ||
    closureDigest(packages) !== expected.productionPackagesSha256 ||
    dshPackages.length !== expected.dshPackagesCount ||
    closureDigest(dshPackages) !== expected.dshPackagesSha256 ||
    dshPackages.some((entry) => entry.version !== version)
  ) {
    fail('lockfile contains an incomplete or mixed-version closure');
  }
  if (
    attestation.productionClosure?.packageCount !== packages.length ||
    attestation.productionClosure?.sha256 !== closureDigest(packages) ||
    attestation.productionClosure?.dshPackageCount !== dshPackages.length ||
    attestation.productionClosure?.dshPackagesSha256 !==
      closureDigest(dshPackages) ||
    receipt.runtime?.productionPackagesCount !== packages.length ||
    receipt.runtime?.productionPackagesSha256 !== closureDigest(packages) ||
    receipt.runtime?.dshPackagesCount !== dshPackages.length ||
    receipt.runtime?.dshPackagesSha256 !== closureDigest(dshPackages)
  ) {
    fail('closure differs across attestation or receipt');
  }
  for (const artifact of Object.values(sidecar.compatibility.npmArtifacts)) {
    if (
      artifact.version !== version ||
      byIdentity.get(`${artifact.name}@${version}`)?.integrity !==
        artifact.integrity
    ) {
      fail(`${artifact.name} differs from pinned registry evidence`);
    }
  }

  const matrix = attestation.certificationRun?.matrix ?? [];
  exactSet(
    matrix.map((job) => `${job.platform}@${job.nodeVersion}`),
    EXPECTED_MATRIX,
    'matrix'
  );
  if (
    matrix.some(
      (job) =>
        job.conclusion !== 'pending' ||
        job.jobId !== null ||
        job.jobUrl !== null
    ) ||
    receipt.matrix?.requiredJobs !== 6 ||
    receipt.matrix?.completedJobs !== 0 ||
    receipt.matrix?.status !== 'pending'
  ) {
    fail('pending matrix contains fabricated completion evidence');
  }
  const scenarios = attestation.acceptance?.scenarios ?? {};
  exactSet(Object.keys(scenarios), EXPECTED_SCENARIOS, 'acceptance scenarios');
  if (Object.values(scenarios).some((status) => status !== 'pending')) {
    fail('acceptance scenarios must remain pending until real receipts exist');
  }
  if (
    sidecar.blockers.length === 0 ||
    JSON.stringify(sidecar.blockers) !==
      JSON.stringify(attestation.acceptance?.blockers)
  ) {
    fail('candidate blockers are missing or inconsistent');
  }

  return {
    status: 'certification-pending',
    installable: false,
    dshVersion: version,
    sidecarSha256: authority.lane.sidecarSha256,
    attestationSha256: authority.lane.attestationSha256,
    receiptSha256: authority.lane.receiptSha256,
    lockfileSha256: expected.sha256,
    packages: packages.length,
    dshPackages: dshPackages.length,
    completedMatrixJobs: 0,
    requiredMatrixJobs: 6,
    blockers: sidecar.blockers,
  };
}

function parseArgs(argv) {
  if (argv.length === 0) return {};
  if (argv.length === 2 && argv[0] === '--input') return { input: argv[1] };
  fail('usage: validate-baseline-candidate.mjs [--input <candidate-json>]');
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  process.stdout.write(
    `${JSON.stringify(await validateCandidateBaseline(parseArgs(process.argv.slice(2))))}\n`
  );
}
