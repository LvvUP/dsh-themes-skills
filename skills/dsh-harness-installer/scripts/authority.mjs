#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const authorityUrl = new URL('../references/alpha2-release-authority.json', import.meta.url);
const receiptSchemaUrl = new URL('../references/build-receipt.schema.json', import.meta.url);
const installReceiptSchemaUrl = new URL('../references/install-receipt.schema.json', import.meta.url);

const SHA40 = /^[a-f0-9]{40}$/;
const SHA64 = /^[a-f0-9]{64}$/;
const SAFE_JOB = /^[A-Za-z0-9._-]{1,100}$/;
const FORBIDDEN_RECEIPT_KEY =
  /token|cookie|credential|authorization|secret|launchurl|authenticatedurl|headers|environment|stdout|stderr|session.*(?:id|digest|hash)|(?:token|cookie|credential).*sha/i;
const FORBIDDEN_RECEIPT_VALUE =
  /(?:[?&]token=|\bcookie\s*:|\bauthorization\s*:|bearer\s+[a-z0-9._~-]+)/i;
const BASE64URL_SECRET = /(?:^|[^A-Za-z0-9_-])[A-Za-z0-9_-]{43}(?:$|[^A-Za-z0-9_-])/;

export const PENDING_PUBLICATION_BOUNDARY =
  'The upstream npm package is an official prerelease. DSH Themes has not promoted it as an operational installation baseline; the complete signed six-task runtime matrix and independent source cross-build must be reviewed and explicitly promoted first.';
export const PROMOTED_PUBLICATION_BOUNDARY =
  'The upstream npm package is an official prerelease. DSH Themes has promoted this exact npm runtime as the alpha.2 operational installation baseline after reviewing the complete signed six-task runtime matrix and independent source cross-build; no source-to-package binary equivalence is claimed.';

function fail(message) {
  throw new Error(message);
}

function plainObject(value, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    fail(`${label} must be an object`);
  }
  return value;
}

function exactKeys(value, expected, label) {
  const actual = Object.keys(plainObject(value, label)).sort();
  const wanted = [...expected].sort();
  if (JSON.stringify(actual) !== JSON.stringify(wanted)) {
    fail(`${label} keys must be exactly ${wanted.join(', ')}`);
  }
}

function exactArray(value, expected, label) {
  if (!Array.isArray(value) || JSON.stringify(value) !== JSON.stringify(expected)) {
    fail(`${label} must be exactly ${JSON.stringify(expected)}`);
  }
}

export function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

export function validateAuthority(authority) {
  exactKeys(authority, [
    'schemaVersion',
    'capturedAt',
    'purpose',
    'officialRepository',
    'release',
    'officialNpm',
    'runtimeInstall',
    'source',
    'officialSafety',
    'runtimeMatrix',
    'packages',
    'publication',
    'historicalAuthority',
  ], 'authority');
  if (authority.schemaVersion !== 2) fail('authority.schemaVersion must be 2');
  if (authority.purpose !== 'dsh-official-npm-and-source-authority') fail('authority purpose mismatch');
  if (authority.officialRepository !== 'https://github.com/deepseek-ai/deepseek-harness.git') {
    fail('official repository mismatch');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(authority.capturedAt)) fail('capturedAt must be an ISO date');

  exactKeys(authority.release, [
    'tag', 'tagObjectType', 'commit', 'tree', 'version', 'releaseAssetCount',
    'githubReleasePublished', 'githubPrerelease', 'commitSignatureVerified',
    'npmPackagesPublished',
  ], 'release');
  if (authority.release.tag !== 'dsh-v0.1.2-alpha.2') fail('release tag mismatch');
  if (authority.release.tagObjectType !== 'commit') fail('alpha.2 must be a lightweight commit tag');
  if (authority.release.commit !== '0a53fb55bea101816fa226bb964ae2bed71c343b' ||
      !SHA40.test(authority.release.commit)) fail('release commit mismatch');
  if (authority.release.tree !== '64ccbfa8e0caa4711cd4a75717ef9e022657961b' ||
      !SHA40.test(authority.release.tree)) fail('release tree mismatch');
  if (authority.release.version !== '0.1.2-alpha.2') fail('release version mismatch');
  if (authority.release.releaseAssetCount !== 0 ||
      authority.release.githubReleasePublished !== true ||
      authority.release.githubPrerelease !== true ||
      authority.release.commitSignatureVerified !== false ||
      authority.release.npmPackagesPublished !== true) {
    fail('alpha.2 release publication facts mismatch');
  }

  exactKeys(authority.officialNpm, [
    'packageName', 'version', 'tarballUrl', 'distIntegrity', 'distShasum',
    'tarballSha256', 'cliSha256', 'registrySignatureKeyId', 'registrySignature',
    'provenanceAttestationPresent', 'gitHeadPresent',
  ], 'officialNpm');
  if (authority.officialNpm.packageName !== '@deepseek-ai/dsh' ||
      authority.officialNpm.version !== authority.release.version ||
      authority.officialNpm.tarballUrl !==
        'https://registry.npmjs.org/@deepseek-ai/dsh/-/dsh-0.1.2-alpha.2.tgz' ||
      authority.officialNpm.distIntegrity !==
        'sha512-4TvTC5kRKlgtSU2UTBv+cID9a2Z+6+m6mpvjXWJfVzuTkflCff6s4MsQpFJTCmwFh/k7zNWe7qFXcLYMV/5VvA==' ||
      authority.officialNpm.distShasum !== '2652fc9a1bafae85c69da581178b4060a065a40a' ||
      authority.officialNpm.tarballSha256 !==
        '5bf062a26a490853ffb9294fe3c9fb2047f029be3545612dea45718a81920a47' ||
      authority.officialNpm.cliSha256 !==
        'dc23f6c5dd7df8834e3e38bdb9609d77b459834681ae9b7133b417b0c35f3166' ||
      !authority.officialNpm.registrySignatureKeyId.startsWith('SHA256:') ||
      typeof authority.officialNpm.registrySignature !== 'string' ||
      authority.officialNpm.registrySignature.length < 80 ||
      authority.officialNpm.provenanceAttestationPresent !== false ||
      authority.officialNpm.gitHeadPresent !== false) {
    fail('official npm package authority mismatch');
  }

  exactKeys(authority.runtimeInstall, [
    'assetDirectory', 'packageJsonSha256', 'workspaceSha256', 'lockfileSha256',
    'packageManager', 'packageManagerVersion', 'installArgs', 'installedCliPath',
    'pathInstalled',
  ], 'runtimeInstall');
  if (authority.runtimeInstall.assetDirectory !== 'assets/official-runtime-0.1.2-alpha.2' ||
      authority.runtimeInstall.packageJsonSha256 !==
        '5caa5cce90cb4e3d61c4a38573ae892263336c2a08b5439ac4c7be2eed80a5c0' ||
      authority.runtimeInstall.workspaceSha256 !==
        '35f7101cc78d762bd0f88518fdb1af2f8d9cb812aa8c43df0d35c2a93f4bfb97' ||
      authority.runtimeInstall.lockfileSha256 !==
        '083152c5eaf99bd2ecad3db1b5a04aca2141b5347e7db97caca82e0ce5a09b1c' ||
      authority.runtimeInstall.packageManager !== 'pnpm' ||
      authority.runtimeInstall.packageManagerVersion !== '11.7.0' ||
      authority.runtimeInstall.installedCliPath !==
        'node_modules/@deepseek-ai/dsh/lib/bin.js' ||
      authority.runtimeInstall.pathInstalled !== false) {
    fail('official runtime installation authority mismatch');
  }
  exactArray(
    authority.runtimeInstall.installArgs,
    ['install', '--frozen-lockfile', '--ignore-scripts'],
    'runtimeInstall.installArgs'
  );

  exactKeys(authority.source, [
    'lockfilePath', 'lockfileBytes', 'lockfileSha256', 'packageManager',
    'packageManagerVersion', 'nodeEngine', 'installArgs', 'buildScript',
    'builtCliPath',
  ], 'source');
  if (authority.source.lockfilePath !== 'pnpm-lock.yaml') fail('lockfile path mismatch');
  if (authority.source.lockfileBytes !== 774264) fail('lockfile byte count mismatch');
  if (authority.source.lockfileSha256 !== '6cc109a574218f51762474455c8d72e5f7c2625aedf25e85569dba1af7adcef0' ||
      !SHA64.test(authority.source.lockfileSha256)) fail('lockfile digest mismatch');
  if (authority.source.packageManager !== 'pnpm' || authority.source.packageManagerVersion !== '11.7.0') {
    fail('package manager mismatch');
  }
  if (authority.source.nodeEngine !== '^22.19.0 || >=24.0.0') fail('Node engine range mismatch');
  exactArray(
    authority.source.installArgs,
    ['install', '--frozen-lockfile', '--ignore-scripts'],
    'source.installArgs'
  );
  if (authority.source.buildScript !== 'build:official') fail('build script mismatch');
  if (authority.source.builtCliPath !== 'apps/cli/lib/bin.js') fail('built CLI path mismatch');

  exactKeys(authority.officialSafety, [
    'path', 'tagUrl', 'commitUrl', 'gitBlob', 'bytes', 'sha256',
  ], 'officialSafety');
  if (authority.officialSafety.path !== 'SAFETY.md' ||
      authority.officialSafety.tagUrl !==
        'https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.2-alpha.2/SAFETY.md' ||
      authority.officialSafety.commitUrl !==
        'https://github.com/deepseek-ai/deepseek-harness/blob/0a53fb55bea101816fa226bb964ae2bed71c343b/SAFETY.md' ||
      authority.officialSafety.gitBlob !== '2b76f00e0619ee69553afdc507df361080f4d3ac' ||
      !SHA40.test(authority.officialSafety.gitBlob) ||
      authority.officialSafety.bytes !== 1673 ||
      authority.officialSafety.sha256 !==
        '62075bb51e0f7790441e7722ff12063107b4866019332e71ef01b63b6f880fee' ||
      !SHA64.test(authority.officialSafety.sha256)) {
    fail('official SAFETY.md authority mismatch');
  }

  exactKeys(authority.runtimeMatrix, ['platforms', 'nodeVersions', 'requiredReceiptCount'], 'runtimeMatrix');
  exactArray(authority.runtimeMatrix.platforms, ['linux', 'darwin', 'win32'], 'runtimeMatrix.platforms');
  exactArray(authority.runtimeMatrix.nodeVersions, ['22.19.0', '24.15.0'], 'runtimeMatrix.nodeVersions');
  if (authority.runtimeMatrix.requiredReceiptCount !== 6) fail('runtime matrix must require six receipts');

  const expectedPackages = [
    ['apps/cli/package.json', '@deepseek-ai/dsh'],
    ['packages/client/ui-theme/package.json', '@deepseek-ai/dsh-client-ui-theme'],
    ['apps/web/package.json', '@deepseek-ai/dsh-web-frontend'],
    ['packages/bundle/web-app/package.json', '@deepseek-ai/dsh-web-app'],
  ];
  if (!Array.isArray(authority.packages) || authority.packages.length !== expectedPackages.length) {
    fail('authority must bind four alpha.2 package manifests');
  }
  authority.packages.forEach((entry, index) => {
    exactKeys(entry, ['path', 'name', 'version'], `packages[${index}]`);
    if (entry.path !== expectedPackages[index][0] || entry.name !== expectedPackages[index][1] ||
        entry.version !== '0.1.2-alpha.2') fail(`packages[${index}] mismatch`);
  });

  exactKeys(authority.publication, [
    'status', 'publishedInstallable', 'completedReceipts', 'receiptSetSha256', 'boundary',
  ], 'publication');
  if (!Array.isArray(authority.publication.completedReceipts)) {
    fail('publication.completedReceipts must be an array');
  }
  const pending = authority.publication.status === 'official-npm-runtime-evidence-pending' &&
    authority.publication.publishedInstallable === false &&
    authority.publication.receiptSetSha256 === null &&
    authority.publication.completedReceipts.length === 0;
  const promoted = authority.publication.status === 'runtime-receipt-verified' &&
    authority.publication.publishedInstallable === true &&
    SHA64.test(authority.publication.receiptSetSha256 ?? '') &&
    authority.publication.completedReceipts.length === 6;
  if (!pending && !promoted) {
    fail('alpha.2 publication authority must be exactly pending or a complete promoted matrix');
  }
  if (promoted) {
    const tasks = [
      ['linux', 'x64', '22.19.0'],
      ['linux', 'x64', '24.15.0'],
      ['darwin', 'arm64', '22.19.0'],
      ['darwin', 'arm64', '24.15.0'],
      ['win32', 'x64', '22.19.0'],
      ['win32', 'x64', '24.15.0'],
    ];
    const seen = new Set();
    authority.publication.completedReceipts.forEach((entry, index) => {
      exactKeys(entry, [
        'platform', 'arch', 'nodeVersion', 'receiptSha256', 'jobId',
      ], `publication.completedReceipts[${index}]`);
      const [platform, arch, nodeVersion] = tasks[index];
      if (entry.platform !== platform || entry.arch !== arch ||
          entry.nodeVersion !== nodeVersion || !SHA64.test(entry.receiptSha256) ||
          !SAFE_JOB.test(entry.jobId) || BASE64URL_SECRET.test(entry.jobId) ||
          seen.has(entry.receiptSha256)) {
        fail(`publication.completedReceipts[${index}] is not a canonical unique task`);
      }
      seen.add(entry.receiptSha256);
    });
  }
  const expectedBoundary = pending
    ? PENDING_PUBLICATION_BOUNDARY
    : PROMOTED_PUBLICATION_BOUNDARY;
  if (authority.publication.boundary !== expectedBoundary) {
    fail(`publication boundary must exactly describe the ${pending ? 'pending' : 'promoted'} state`);
  }
  exactKeys(authority.historicalAuthority, [
    'alpha1SourceLaneUnchanged', 'rc8ItemLaneUnchanged', 'rc2RuntimeLaneUnchanged',
  ], 'historicalAuthority');
  if (authority.historicalAuthority.alpha1SourceLaneUnchanged !== true ||
      authority.historicalAuthority.rc8ItemLaneUnchanged !== true ||
      authority.historicalAuthority.rc2RuntimeLaneUnchanged !== true) {
    fail('historical RC.8 and RC.2 authority must remain unchanged');
  }
  return authority;
}

function inspectReceiptPrivacy(value, path = 'receipt') {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => inspectReceiptPrivacy(entry, `${path}[${index}]`));
    return;
  }
  if (value !== null && typeof value === 'object') {
    for (const [key, entry] of Object.entries(value)) {
      const allowedPrivacyFlag = path === 'receipt.privacy' && [
        'capturesProcessOutput',
        'capturesEnvironment',
        'capturesBrowserCredentials',
        'capturesCredentialDerivedDigest',
      ].includes(key);
      if (!allowedPrivacyFlag && FORBIDDEN_RECEIPT_KEY.test(key)) {
        fail(`${path}.${key} is forbidden in a receipt`);
      }
      inspectReceiptPrivacy(entry, `${path}.${key}`);
    }
    return;
  }
  if (typeof value === 'string' &&
      (FORBIDDEN_RECEIPT_VALUE.test(value) || BASE64URL_SECRET.test(value))) {
    fail(`${path} contains credential-like material`);
  }
}

export function validateBuildReceipt(receipt, authority) {
  validateAuthority(authority);
  inspectReceiptPrivacy(receipt);
  exactKeys(receipt, ['schemaVersion', 'status', 'scope', 'source', 'toolchain', 'result', 'privacy'], 'receipt');
  if (receipt.schemaVersion !== 1 || receipt.status !== 'local-source-build-passed' ||
      receipt.scope !== 'one-machine-local-build-only') fail('receipt status or scope mismatch');
  exactKeys(receipt.source, ['tag', 'commit', 'tree', 'lockfileSha256'], 'receipt.source');
  for (const field of ['tag', 'commit', 'tree']) {
    if (receipt.source[field] !== authority.release[field]) fail(`receipt source ${field} mismatch`);
  }
  if (receipt.source.lockfileSha256 !== authority.source.lockfileSha256) {
    fail('receipt source lockfile digest mismatch');
  }
  exactKeys(receipt.toolchain, ['platform', 'arch', 'nodeVersion', 'packageManager', 'packageManagerVersion'], 'receipt.toolchain');
  if (!authority.runtimeMatrix.platforms.includes(receipt.toolchain.platform)) fail('receipt platform is not admitted');
  if (![
    ['linux', 'x64'],
    ['darwin', 'arm64'],
    ['win32', 'x64'],
  ].some(([platform, arch]) =>
    receipt.toolchain.platform === platform && receipt.toolchain.arch === arch)) {
    fail('receipt platform and architecture pair is not admitted');
  }
  if (!authority.runtimeMatrix.nodeVersions.includes(receipt.toolchain.nodeVersion)) fail('receipt Node version is not admitted');
  if (receipt.toolchain.packageManager !== 'pnpm' ||
      receipt.toolchain.packageManagerVersion !== authority.source.packageManagerVersion) {
    fail('receipt package manager mismatch');
  }
  exactKeys(receipt.result, [
    'buildScript', 'builtCliPath', 'builtCliSha256', 'reportedVersion', 'pathInstalled',
  ], 'receipt.result');
  if (receipt.result.buildScript !== authority.source.buildScript ||
      receipt.result.builtCliPath !== authority.source.builtCliPath ||
      !SHA64.test(receipt.result.builtCliSha256) ||
      receipt.result.reportedVersion !== authority.release.version ||
      receipt.result.pathInstalled !== false) fail('receipt build result mismatch');
  exactKeys(receipt.privacy, [
    'capturesProcessOutput', 'capturesEnvironment', 'capturesBrowserCredentials',
    'capturesCredentialDerivedDigest',
  ], 'receipt.privacy');
  if (Object.values(receipt.privacy).some((value) => value !== false)) {
    fail('receipt privacy flags must all be false');
  }
  return receipt;
}

export function validateInstallReceipt(receipt, authority) {
  validateAuthority(authority);
  inspectReceiptPrivacy(receipt);
  exactKeys(receipt, [
    'schemaVersion', 'status', 'scope', 'package', 'resolution', 'toolchain',
    'result', 'provenanceBoundary', 'privacy',
  ], 'installReceipt');
  if (receipt.schemaVersion !== 1 ||
      receipt.status !== 'official-npm-install-passed' ||
      receipt.scope !== 'one-machine-versioned-user-install') {
    fail('install receipt status or scope mismatch');
  }
  exactKeys(receipt.package, [
    'name', 'version', 'distIntegrity', 'tarballSha256', 'cliSha256',
  ], 'installReceipt.package');
  if (receipt.package.name !== authority.officialNpm.packageName ||
      receipt.package.version !== authority.officialNpm.version ||
      receipt.package.distIntegrity !== authority.officialNpm.distIntegrity ||
      receipt.package.tarballSha256 !== authority.officialNpm.tarballSha256 ||
      receipt.package.cliSha256 !== authority.officialNpm.cliSha256) {
    fail('install receipt npm package identity mismatch');
  }
  exactKeys(receipt.resolution, [
    'lockfileSha256', 'frozenLockfile', 'lifecycleScriptsRun', 'peerPolicy',
  ], 'installReceipt.resolution');
  if (receipt.resolution.lockfileSha256 !== authority.runtimeInstall.lockfileSha256 ||
      receipt.resolution.frozenLockfile !== true ||
      receipt.resolution.lifecycleScriptsRun !== false ||
      receipt.resolution.peerPolicy !== 'upstream-compatible-locked-resolution') {
    fail('install receipt resolution contract mismatch');
  }
  exactKeys(receipt.toolchain, [
    'platform', 'arch', 'nodeVersion', 'packageManager', 'packageManagerVersion',
  ], 'installReceipt.toolchain');
  if (![
    ['linux', 'x64'],
    ['darwin', 'arm64'],
    ['win32', 'x64'],
  ].some(([platform, arch]) =>
    receipt.toolchain.platform === platform && receipt.toolchain.arch === arch) ||
      !authority.runtimeMatrix.nodeVersions.includes(receipt.toolchain.nodeVersion) ||
      receipt.toolchain.packageManager !== authority.runtimeInstall.packageManager ||
      receipt.toolchain.packageManagerVersion !== authority.runtimeInstall.packageManagerVersion) {
    fail('install receipt toolchain mismatch');
  }
  exactKeys(receipt.result, [
    'installedCliPath', 'installedCliSha256', 'reportedVersion', 'pathInstalled',
    'versionedDirectory',
  ], 'installReceipt.result');
  if (receipt.result.installedCliPath !== authority.runtimeInstall.installedCliPath ||
      receipt.result.installedCliSha256 !== authority.officialNpm.cliSha256 ||
      receipt.result.reportedVersion !== authority.release.version ||
      receipt.result.pathInstalled !== false ||
      receipt.result.versionedDirectory !== true) {
    fail('install receipt result mismatch');
  }
  exactKeys(receipt.provenanceBoundary, [
    'npmGitHeadPresent', 'npmProvenanceAttestationPresent',
    'sourceCommitBoundToNpmArtifact', 'binarySourceEquivalenceClaimed',
  ], 'installReceipt.provenanceBoundary');
  if (receipt.provenanceBoundary.npmGitHeadPresent !== false ||
      receipt.provenanceBoundary.npmProvenanceAttestationPresent !== false ||
      receipt.provenanceBoundary.sourceCommitBoundToNpmArtifact !== false ||
      receipt.provenanceBoundary.binarySourceEquivalenceClaimed !== false) {
    fail('install receipt provenance boundary mismatch');
  }
  exactKeys(receipt.privacy, [
    'capturesProcessOutput', 'capturesEnvironment', 'capturesBrowserCredentials',
    'capturesCredentialDerivedDigest', 'capturesInstallPath',
  ], 'installReceipt.privacy');
  if (Object.values(receipt.privacy).some((value) => value !== false)) {
    fail('install receipt privacy flags must all be false');
  }
  return receipt;
}

export async function loadAuthority() {
  return validateAuthority(JSON.parse(await readFile(authorityUrl, 'utf8')));
}

export async function loadReceiptSchema() {
  return JSON.parse(await readFile(receiptSchemaUrl, 'utf8'));
}

export async function loadInstallReceiptSchema() {
  return JSON.parse(await readFile(installReceiptSchemaUrl, 'utf8'));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const authorityBytes = await readFile(authorityUrl);
    const authority = validateAuthority(JSON.parse(authorityBytes));
    process.stdout.write(`${JSON.stringify({
      valid: true,
      authoritySha256: sha256(authorityBytes),
      tag: authority.release.tag,
      commit: authority.release.commit,
      tree: authority.release.tree,
      lockfileSha256: authority.source.lockfileSha256,
      publishedInstallable: authority.publication.publishedInstallable,
      completedReceipts: authority.publication.completedReceipts.length,
      requiredReceipts: authority.runtimeMatrix.requiredReceiptCount,
    }, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
