import { constants as fsConstants } from 'node:fs';
import { createHash } from 'node:crypto';
import {
  chmod,
  lstat,
  mkdir,
  open,
  readFile,
  readdir,
  realpath,
  writeFile,
} from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { inspectTarEntries } from './archive-policy.mjs';
import {
  captureWindowsPrivatePathIdentity,
  secureWindowsPrivatePath,
  secureWindowsPrivatePaths,
} from './windows-private-acl.mjs';

const skillRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const authorityPath = join(skillRoot, 'references', 'pnpm-runtime-authority.json');
const CERTIFIED_NODES = new Set(['v22.19.0', 'v24.15.0']);
const MAX_FILES = 500;
const EXPECTED_ARTIFACT_SHA256 =
  'deafa7ec98a1218b6a047289b92fbe2395c1e22d3495bb711653013218ee15ee';
const EXPECTED_DIST_INTEGRITY =
  'sha512-GcyFLBIMcSV2DyRD7mvgyltA+fUFmN4aCaHxd1A+AQ5Xwjx3ZG4B52HeWb+HT7IqM5jDOrlpH8E+uUa28PTWIA==';
const EXPECTED_MANIFEST_SHA256 =
  '2b20455ee8d69d072df339bf9851edea94ee08a9ea14db9289a7fca0bbb7abb0';
const EXPECTED_CLOSURE_SHA512 =
  '64fc4b8862f727c5ce40ed4d417804c536db1f517fc82d972c816266b2ace1d42db33ac8eab8d3e6a5c01855842baae656e6343df1c1ff4f7b981028ee3c42f3';
const EXPECTED_LICENSE_SHA256 =
  'e0a867ff513ea7be2a0ddc339ac6a031e459a38668e077b8f0e649544062f9f2';
const EXPECTED_NOTICE_SHA256 =
  '081507ee590c3286ca14e1a3a7c528a1fa04d2db51ec970859ac9839fe178748';

function fail(message) {
  throw new Error(message);
}

function exactKeys(value, keys) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) &&
    JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());
}

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const sha512 = (bytes) => createHash('sha512').update(bytes).digest('hex');
const sri512 = (bytes) =>
  `sha512-${createHash('sha512').update(bytes).digest('base64')}`;

export function pnpmRuntimeClosureSha512(entries) {
  if (!Array.isArray(entries) || entries.length < 1 || entries.length > MAX_FILES ||
      entries.some((entry) => entry === null || typeof entry !== 'object' ||
        entry.type !== '0' || typeof entry.name !== 'string' ||
        !Number.isInteger(entry.mode) || !Number.isInteger(entry.size) ||
        !Buffer.isBuffer(entry.body) || entry.body.length !== entry.size)) {
    fail('pnpm runtime closure entries are malformed');
  }
  const digest = createHash('sha512');
  digest.update('dsh-plugin-installer/pnpm-runtime-closure/v1\0');
  for (const entry of [...entries].sort((left, right) =>
    left.name < right.name ? -1 : left.name > right.name ? 1 : 0)) {
    digest.update(
      `${entry.name}\0${entry.type}\0${entry.mode.toString(8)}\0` +
      `${entry.size}\0${sha512(entry.body)}\n`
    );
  }
  return digest.digest('hex');
}

export function validatePnpmRuntimeAuthority(authority) {
  if (!exactKeys(authority, ['closure', 'package', 'rights', 'schemaVersion', 'source']) ||
      authority.schemaVersion !== 1 ||
      !exactKeys(authority.package, [
        'cliPath', 'manifestPath', 'manifestSha256', 'name', 'version',
      ]) || authority.package.name !== 'pnpm' || authority.package.version !== '11.7.0' ||
      authority.package.cliPath !== 'package/bin/pnpm.cjs' ||
      authority.package.manifestPath !== 'package/package.json' ||
      authority.package.manifestSha256 !== EXPECTED_MANIFEST_SHA256 ||
      !exactKeys(authority.source, [
        'artifactBytes', 'artifactPath', 'artifactSha256', 'distIntegrity',
        'maintenanceDownloadOnly', 'registryOrigin', 'tarballUrl',
        'transactionNetworkFetch',
      ]) || authority.source.registryOrigin !== 'https://registry.npmjs.org' ||
      authority.source.tarballUrl !==
        'https://registry.npmjs.org/pnpm/-/pnpm-11.7.0.tgz' ||
      authority.source.artifactPath !== 'assets/pnpm-runtime/pnpm-11.7.0.tgz' ||
      authority.source.artifactBytes !== 4_590_455 ||
      authority.source.artifactSha256 !== EXPECTED_ARTIFACT_SHA256 ||
      authority.source.distIntegrity !== EXPECTED_DIST_INTEGRITY ||
      authority.source.maintenanceDownloadOnly !== true ||
      authority.source.transactionNetworkFetch !== false ||
      !exactKeys(authority.closure, [
        'entryCount', 'regularFileCount', 'sha512', 'unpackedBytes',
      ]) || authority.closure.entryCount !== 449 ||
      authority.closure.regularFileCount !== 449 ||
      authority.closure.unpackedBytes !== 18_644_360 ||
      authority.closure.sha512 !== EXPECTED_CLOSURE_SHA512 ||
      !exactKeys(authority.rights, [
        'copyright', 'license', 'licensePath', 'licenseSha256', 'noticePath',
        'noticeSha256',
      ]) || authority.rights.license !== 'MIT' ||
      authority.rights.licensePath !== 'package/LICENSE' ||
      authority.rights.licenseSha256 !== EXPECTED_LICENSE_SHA256 ||
      authority.rights.noticePath !== 'assets/pnpm-runtime/NOTICE.txt' ||
      authority.rights.noticeSha256 !== EXPECTED_NOTICE_SHA256 ||
      authority.rights.copyright !==
        'Copyright (c) 2015-2016 Rico Sta. Cruz and other contributors; ' +
        'Copyright (c) 2016-2025 Zoltan Kochan and other contributors') {
    fail('pnpm runtime authority is malformed');
  }
  return Object.freeze(structuredClone(authority));
}

export async function loadPnpmRuntimeAuthority() {
  const bytes = await readFile(authorityPath);
  let parsed;
  try {
    parsed = JSON.parse(bytes.toString('utf8'));
  } catch (error) {
    throw new Error('pnpm runtime authority is not valid JSON', { cause: error });
  }
  const authority = validatePnpmRuntimeAuthority(parsed);
  const notice = await readFile(join(skillRoot, authority.rights.noticePath));
  if (sha256(notice) !== authority.rights.noticeSha256) {
    fail('pnpm runtime NOTICE digest mismatch');
  }
  return Object.freeze({ authority, authoritySha256: sha256(bytes) });
}

export function validatePnpmRuntimeArtifact(bytes, authority) {
  validatePnpmRuntimeAuthority(authority);
  if (!Buffer.isBuffer(bytes) || bytes.length !== authority.source.artifactBytes ||
      sha256(bytes) !== authority.source.artifactSha256 ||
      sri512(bytes) !== authority.source.distIntegrity) {
    fail('pnpm runtime artifact bytes, SHA-256, or dist.integrity mismatch');
  }
  const entries = inspectTarEntries(bytes);
  if (entries.length !== authority.closure.entryCount ||
      entries.some((entry) => entry.type !== '0') ||
      entries.reduce((total, entry) => total + entry.size, 0) !==
        authority.closure.unpackedBytes ||
      pnpmRuntimeClosureSha512(entries) !== authority.closure.sha512) {
    fail('pnpm runtime artifact closure differs from authority');
  }
  const byName = new Map(entries.map((entry) => [entry.name, entry]));
  const manifestEntry = byName.get(authority.package.manifestPath);
  const cliEntry = byName.get(authority.package.cliPath);
  const licenseEntry = byName.get(authority.rights.licensePath);
  if (!manifestEntry || !cliEntry || cliEntry.body.length < 1 || !licenseEntry ||
      sha256(manifestEntry.body) !== authority.package.manifestSha256 ||
      sha256(licenseEntry.body) !== authority.rights.licenseSha256) {
    fail('pnpm runtime manifest, CLI, or MIT license binding is missing');
  }
  const manifest = JSON.parse(manifestEntry.body.toString('utf8'));
  if (manifest.name !== 'pnpm' || manifest.version !== '11.7.0' ||
      manifest.license !== 'MIT' || manifest.engines?.node !== '>=22.13') {
    fail('pnpm runtime package identity or engine differs from authority');
  }
  return Object.freeze({ entries, manifest });
}

function archivePath(root, name) {
  const path = resolve(root, ...name.split('/'));
  const inside = relative(root, path);
  if (inside === '' || inside.startsWith('..') || isAbsolute(inside)) {
    fail('pnpm runtime archive path escapes its private root');
  }
  return path;
}

function directoryNames(entries) {
  const result = new Set();
  for (const entry of entries) {
    const parts = entry.name.split('/');
    for (let length = 1; length < parts.length; length += 1) {
      result.add(parts.slice(0, length).join('/'));
    }
  }
  return [...result].sort((left, right) => {
    const depth = left.split('/').length - right.split('/').length;
    return depth || (left < right ? -1 : left > right ? 1 : 0);
  });
}

async function aclBatches(requests, systemRootForTesting, powerShellTempForTesting) {
  for (let offset = 0; offset < requests.length; offset += 32) {
    await secureWindowsPrivatePaths(requests.slice(offset, offset + 32), {
      powerShellTempForTesting,
      systemRootForTesting,
    });
  }
}

async function verifyExtracted(root, entries, platform) {
  const expectedFiles = new Map(entries.map((entry) => [entry.name, entry]));
  const expectedDirs = new Set(directoryNames(entries));
  const actualFiles = [];
  const actualDirs = [];
  async function walk(path, prefix) {
    for (const child of await readdir(path, { withFileTypes: true })) {
      const name = prefix ? `${prefix}/${child.name}` : child.name;
      const childPath = join(path, child.name);
      if (child.isSymbolicLink() || (!child.isDirectory() && !child.isFile())) {
        fail('pnpm private runtime contains a link or special entry');
      }
      if (child.isDirectory()) {
        actualDirs.push(name);
        await walk(childPath, name);
      } else {
        actualFiles.push({ name, path: childPath });
      }
    }
  }
  await walk(root, '');
  if (actualDirs.length !== expectedDirs.size ||
      actualDirs.some((name) => !expectedDirs.has(name)) ||
      actualFiles.length !== expectedFiles.size ||
      actualFiles.some(({ name }) => !expectedFiles.has(name))) {
    fail('pnpm private runtime contains missing, extra, or renamed entries');
  }
  const verified = [];
  for (const { name, path } of actualFiles) {
    const expected = expectedFiles.get(name);
    const before = await lstat(path);
    const expectedMode = (expected.mode & 0o111) === 0 ? 0o600 : 0o700;
    if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1 ||
        before.size !== expected.size ||
        (platform !== 'win32' && (before.mode & 0o777) !== expectedMode)) {
      fail('pnpm private runtime file identity or permissions differ');
    }
    const handle = await open(path, fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW ?? 0));
    try {
      const first = await handle.stat();
      const body = await handle.readFile();
      const last = await handle.stat();
      const after = await lstat(path);
      if (first.dev !== before.dev || first.ino !== before.ino ||
          last.dev !== before.dev || last.ino !== before.ino ||
          after.dev !== before.dev || after.ino !== before.ino ||
          last.size !== before.size || after.size !== before.size ||
          sha512(body) !== sha512(expected.body)) {
        fail('pnpm private runtime changed during closure verification');
      }
      verified.push({ ...expected, body });
    } finally {
      await handle.close();
    }
  }
  return verified;
}

export async function materializeVerifiedPnpmRuntime(destinationInput, {
  platform = process.platform,
  powerShellTempForTesting,
  systemRootForTesting,
} = {}) {
  if (!CERTIFIED_NODES.has(process.version) ||
      !['darwin', 'linux', 'win32'].includes(platform) ||
      (process.platform === 'win32' && platform !== 'win32') ||
      typeof destinationInput !== 'string' || !isAbsolute(destinationInput)) {
    fail('pnpm private runtime requires a certified Node and absolute destination');
  }
  const { authority, authoritySha256 } = await loadPnpmRuntimeAuthority();
  const artifact = await readFile(join(skillRoot, authority.source.artifactPath));
  const { entries } = validatePnpmRuntimeArtifact(artifact, authority);
  await mkdir(destinationInput, { mode: 0o700 });
  const root = await realpath(destinationInput);
  if (platform === 'win32') {
    const expectedIdentity = await captureWindowsPrivatePathIdentity(root, 'directory');
    await secureWindowsPrivatePath(root, 'directory', 'configure', {
      expectedIdentity,
      powerShellTempForTesting,
      systemRootForTesting,
    });
  } else {
    await chmod(root, 0o700);
  }
  const directories = directoryNames(entries);
  for (const name of directories) await mkdir(archivePath(root, name), { mode: 0o700 });
  if (platform === 'win32') {
    await aclBatches(await Promise.all(directories.map(async (name) => {
      const path = archivePath(root, name);
      return {
        path,
        kind: 'directory',
        action: 'configure',
        expectedIdentity: await captureWindowsPrivatePathIdentity(path, 'directory'),
      };
    })), systemRootForTesting, powerShellTempForTesting);
  }
  for (const entry of entries) {
    await writeFile(archivePath(root, entry.name), entry.body, {
      flag: 'wx',
      mode: (entry.mode & 0o111) === 0 ? 0o600 : 0o700,
    });
  }
  if (platform === 'win32') {
    await aclBatches(await Promise.all(entries.map(async (entry) => {
      const path = archivePath(root, entry.name);
      return {
        path,
        kind: 'file',
        action: 'configure',
        expectedIdentity: await captureWindowsPrivatePathIdentity(path, 'file'),
      };
    })), systemRootForTesting, powerShellTempForTesting);
  }
  const verified = await verifyExtracted(root, entries, platform);
  if (pnpmRuntimeClosureSha512(verified) !== authority.closure.sha512) {
    fail('pnpm private runtime actual closure digest mismatch');
  }
  return Object.freeze({
    artifactSha256: authority.source.artifactSha256,
    artifactSha512: authority.source.distIntegrity,
    authoritySha256,
    cli: archivePath(root, authority.package.cliPath),
    closureSha512: authority.closure.sha512,
    entryCount: verified.length,
    root,
    version: authority.package.version,
  });
}
