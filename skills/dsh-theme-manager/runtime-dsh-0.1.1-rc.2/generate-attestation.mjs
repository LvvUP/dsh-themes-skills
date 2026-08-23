#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parse } from 'yaml';

const runtimeDir = dirname(fileURLToPath(import.meta.url));
const skillDir = resolve(runtimeDir, '..');
const lockPath = resolve(runtimeDir, 'pnpm-lock.yaml');
const sidecarPath = resolve(
  skillDir,
  'references/dsh-0.1.1-rc.2.candidate.json'
);
const outputPath = resolve(runtimeDir, 'attestation.json');
const SHA512 = /^sha512-[A-Za-z0-9+/]+={0,2}$/;

const sha256 = (value) =>
  createHash('sha256').update(value).digest('hex');

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

function rejectMutableSelectors(value, path = '$') {
  if (Array.isArray(value)) {
    value.forEach((entry, index) =>
      rejectMutableSelectors(entry, `${path}[${index}]`)
    );
    return;
  }
  if (!value || typeof value !== 'object') {
    if (value === 'latest' || value === 'next') {
      throw new Error(`mutable version selector refused at ${path}`);
    }
    return;
  }
  for (const [key, entry] of Object.entries(value)) {
    rejectMutableSelectors(entry, `${path}.${key}`);
  }
}

const [lockBytes, sidecarBytes] = await Promise.all([
  readFile(lockPath),
  readFile(sidecarPath),
]);
const sidecar = JSON.parse(sidecarBytes.toString('utf8'));
rejectMutableSelectors(sidecar);
if (
  sidecar.schemaVersion !== 1 ||
  sidecar.certificationStatus !== 'pending' ||
  sidecar.installableCurrent !== false ||
  sidecar.compatibility?.runtimeAttestationSha256 !== null ||
  sidecar.compatibility?.selectorCatalogSha256 !== null
) {
  throw new Error('candidate sidecar must remain explicitly pending');
}
const version = sidecar.compatibility.dshPackageVersion;
const lock = parse(lockBytes.toString('utf8'));
const byIdentity = new Map();
for (const [key, value] of Object.entries(lock.packages ?? {})) {
  const identity = packageIdentity(key);
  if (!identity) continue;
  const integrity = value?.resolution?.integrity;
  if (typeof integrity !== 'string' || !SHA512.test(integrity)) {
    throw new Error(`missing SHA-512 registry integrity for ${key}`);
  }
  const identityKey = `${identity.name}@${identity.version}`;
  const previous = byIdentity.get(identityKey);
  if (previous && previous.integrity !== integrity) {
    throw new Error(`conflicting registry integrity for ${identityKey}`);
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
const expectation = sidecar.lockExpectation;
if (
  sha256(lockBytes) !== expectation.sha256 ||
  packages.length !== expectation.productionPackagesCount ||
  closureDigest(packages) !== expectation.productionPackagesSha256 ||
  dshPackages.length !== expectation.dshPackagesCount ||
  closureDigest(dshPackages) !== expectation.dshPackagesSha256 ||
  dshPackages.some((entry) => entry.version !== version)
) {
  throw new Error('candidate lock is incomplete, mixed, or differs from sidecar');
}
for (const artifact of Object.values(sidecar.compatibility.npmArtifacts)) {
  const locked = byIdentity.get(`${artifact.name}@${version}`);
  if (
    artifact.version !== version ||
    locked?.integrity !== artifact.integrity
  ) {
    throw new Error(`${artifact.name} differs from candidate registry evidence`);
  }
}

const plannedMatrix = [
  ['ubuntu-latest', 'linux', '22.19.0'],
  ['ubuntu-latest', 'linux', '24.15.0'],
  ['macos-latest', 'darwin', '22.19.0'],
  ['macos-latest', 'darwin', '24.15.0'],
  ['windows-latest', 'win32', '22.19.0'],
  ['windows-latest', 'win32', '24.15.0'],
].map(([runner, platform, nodeVersion]) => ({
  runner,
  platform,
  nodeVersion,
  jobId: null,
  jobUrl: null,
  conclusion: 'pending',
}));

const attestation = {
  schemaVersion: 3,
  certificationStatus: 'pending',
  installable: false,
  baseline: `@deepseek-ai/dsh@${version}`,
  capturedAt: `${sidecar.capturedAt}T00:00:00.000Z`,
  sidecar: {
    path: 'references/dsh-0.1.1-rc.2.candidate.json',
    sha256: sha256(sidecarBytes),
  },
  packageManager: {
    name: 'pnpm',
    version: '11.7.0',
    integrity:
      'sha512-GcyFLBIMcSV2DyRD7mvgyltA+fUFmN4aCaHxd1A+AQ5Xwjx3ZG4B52HeWb+HT7IqM5jDOrlpH8E+uUa28PTWIA==',
    shasum: 'bea54364524dadf0a42dae28dbfeeab25ff177e5',
  },
  lockfile: {
    path: expectation.path,
    sha256: expectation.sha256,
  },
  productionClosure: {
    algorithm: 'sorted-name-at-version-tab-integrity-lf',
    packageCount: packages.length,
    sha256: closureDigest(packages),
    dshPackageCount: dshPackages.length,
    dshPackagesSha256: closureDigest(dshPackages),
    packages,
  },
  compatibility: sidecar.compatibility,
  certificationRun: {
    provider: 'github-actions',
    repository: 'LvvUP/dsh-themes-skills',
    workflow: 'RC2 Skill certification',
    status: 'pending',
    runId: null,
    runUrl: null,
    headSha: null,
    conclusion: 'pending',
    matrix: plannedMatrix,
  },
  acceptance: {
    status: 'pending',
    profile: 'web',
    telemetry: 'disabled',
    webNoOpen: true,
    lifecycle: 'managed-cold-restart',
    scenarios: Object.fromEntries(
      sidecar.requiredMatrix.scenarios.map((scenario) => [scenario, 'pending'])
    ),
    blockers: sidecar.blockers,
  },
};

await writeFile(outputPath, `${JSON.stringify(attestation, null, 2)}\n`, {
  mode: 0o644,
});
process.stdout.write(
  `${JSON.stringify({
    output: outputPath,
    sha256: sha256(await readFile(outputPath)),
    lockfileSha256: attestation.lockfile.sha256,
    packageCount: packages.length,
    dshPackageCount: dshPackages.length,
    certificationStatus: attestation.certificationStatus,
    installable: attestation.installable,
  })}\n`
);
