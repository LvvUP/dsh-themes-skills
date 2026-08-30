#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const authorityUrl = new URL('../references/alpha1-source-authority.json', import.meta.url);
const receiptSchemaUrl = new URL('../references/build-receipt.schema.json', import.meta.url);

const SHA40 = /^[a-f0-9]{40}$/;
const SHA64 = /^[a-f0-9]{64}$/;
const SAFE_ARCH = /^[a-z0-9_-]{2,24}$/;
const FORBIDDEN_RECEIPT_KEY =
  /token|cookie|credential|authorization|secret|launchurl|authenticatedurl|headers|environment|stdout|stderr|session.*(?:id|digest|hash)|(?:token|cookie|credential).*sha/i;
const FORBIDDEN_RECEIPT_VALUE =
  /(?:[?&]token=|\bcookie\s*:|\bauthorization\s*:|bearer\s+[a-z0-9._~-]+)/i;
const BASE64URL_SECRET = /(?:^|[^A-Za-z0-9_-])[A-Za-z0-9_-]{43}(?:$|[^A-Za-z0-9_-])/;

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
    'source',
    'runtimeMatrix',
    'packages',
    'publication',
    'historicalAuthority',
  ], 'authority');
  if (authority.schemaVersion !== 1) fail('authority.schemaVersion must be 1');
  if (authority.purpose !== 'dsh-source-build-authority') fail('authority purpose mismatch');
  if (authority.officialRepository !== 'https://github.com/deepseek-ai/deepseek-harness.git') {
    fail('official repository mismatch');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(authority.capturedAt)) fail('capturedAt must be an ISO date');

  exactKeys(authority.release, [
    'tag', 'tagObjectType', 'commit', 'tree', 'version', 'releaseAssetCount',
    'npmPackagesPublished',
  ], 'release');
  if (authority.release.tag !== 'dsh-v0.1.2-alpha.1') fail('release tag mismatch');
  if (authority.release.tagObjectType !== 'commit') fail('alpha.1 must be a lightweight commit tag');
  if (authority.release.commit !== 'cd5ef8148158c3a752a658978873241fdf8e2bbc' ||
      !SHA40.test(authority.release.commit)) fail('release commit mismatch');
  if (authority.release.tree !== 'a712eec535b48badc4fefb4df5176a7002e4280b' ||
      !SHA40.test(authority.release.tree)) fail('release tree mismatch');
  if (authority.release.version !== '0.1.2-alpha.1') fail('release version mismatch');
  if (authority.release.releaseAssetCount !== 0 || authority.release.npmPackagesPublished !== false) {
    fail('alpha.1 must remain source-only with no official binary or npm publication');
  }

  exactKeys(authority.source, [
    'lockfilePath', 'lockfileBytes', 'lockfileSha256', 'packageManager',
    'packageManagerVersion', 'nodeEngine', 'installArgs', 'buildScript',
    'builtCliPath',
  ], 'source');
  if (authority.source.lockfilePath !== 'pnpm-lock.yaml') fail('lockfile path mismatch');
  if (authority.source.lockfileBytes !== 765312) fail('lockfile byte count mismatch');
  if (authority.source.lockfileSha256 !== '506ad1fc7c40f71ce8c6afe08724fdd55020c1a527d7a7a185c559d39ecfcaf1' ||
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
    fail('authority must bind four alpha.1 package manifests');
  }
  authority.packages.forEach((entry, index) => {
    exactKeys(entry, ['path', 'name', 'version'], `packages[${index}]`);
    if (entry.path !== expectedPackages[index][0] || entry.name !== expectedPackages[index][1] ||
        entry.version !== '0.1.2-alpha.1') fail(`packages[${index}] mismatch`);
  });

  exactKeys(authority.publication, [
    'status', 'publishedInstallable', 'completedReceipts', 'receiptSetSha256', 'boundary',
  ], 'publication');
  if (authority.publication.status !== 'source-build-evidence-pending' ||
      authority.publication.publishedInstallable !== false ||
      authority.publication.receiptSetSha256 !== null ||
      !Array.isArray(authority.publication.completedReceipts) ||
      authority.publication.completedReceipts.length !== 0) {
    fail('alpha.1 publication authority must fail closed until real receipts are promoted');
  }
  if (!/not an official binary/i.test(authority.publication.boundary)) {
    fail('publication boundary must disclose the non-binary source build');
  }
  exactKeys(authority.historicalAuthority, ['rc8ItemLaneUnchanged', 'rc2RuntimeLaneUnchanged'], 'historicalAuthority');
  if (authority.historicalAuthority.rc8ItemLaneUnchanged !== true ||
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
  if (!SAFE_ARCH.test(receipt.toolchain.arch)) fail('receipt arch is malformed');
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

export async function loadAuthority() {
  return validateAuthority(JSON.parse(await readFile(authorityUrl, 'utf8')));
}

export async function loadReceiptSchema() {
  return JSON.parse(await readFile(receiptSchemaUrl, 'utf8'));
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
