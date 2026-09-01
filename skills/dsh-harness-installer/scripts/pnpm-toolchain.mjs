import { createHash } from 'node:crypto';
import { constants as fsConstants } from 'node:fs';
import {
  chmod,
  lstat,
  mkdir,
  open,
  readFile,
  readdir,
  realpath,
  rm,
  writeFile,
} from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, parse, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { inspectTarEntries } from './tar-policy.mjs';

const skillRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const artifactPath = join(skillRoot, 'assets', 'toolchain', 'pnpm-11.7.0.tgz');
const authorityPath = join(
  skillRoot,
  'assets',
  'toolchain',
  'pnpm-11.7.0.authority.json'
);
const HEX_64 = /^[a-f0-9]{64}$/u;
const HEX_128 = /^[a-f0-9]{128}$/u;
const SHA512_SRI = /^sha512-[A-Za-z0-9+/]{86}==$/u;
const CERTIFIED_NODES = new Set(['22.19.0', '24.15.0']);

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

export function pnpmClosureSha512(entries) {
  if (!Array.isArray(entries) || entries.length !== 449 ||
      entries.some((entry) => entry?.type !== '0' || !Buffer.isBuffer(entry.body) ||
        entry.body.length !== entry.size)) {
    fail('pnpm toolchain closure entries are malformed');
  }
  const digest = createHash('sha512');
  digest.update('dsh-harness-installer/pnpm-runtime-closure/v1\0');
  for (const entry of [...entries].sort((left, right) =>
    left.name < right.name ? -1 : left.name > right.name ? 1 : 0)) {
    digest.update(
      `${entry.name}\0${entry.type}\0${entry.mode.toString(8)}\0` +
      `${entry.size}\0${sha512(entry.body)}\n`
    );
  }
  return digest.digest('hex');
}

export function validatePnpmAuthority(authority) {
  if (!exactKeys(authority, [
    'schemaVersion', 'package', 'version', 'repository', 'tarballUrl',
    'tarballBytes', 'tarballSha256', 'distIntegrity', 'entrypoint',
    'regularFileCount', 'unpackedBytes', 'closureSha512', 'packageJsonSha256',
    'license', 'licensePath', 'licenseSha256',
  ]) || authority.schemaVersion !== 1 || authority.package !== 'pnpm' ||
      authority.version !== '11.7.0' ||
      authority.repository !== 'https://github.com/pnpm/pnpm' ||
      authority.tarballUrl !== 'https://registry.npmjs.org/pnpm/-/pnpm-11.7.0.tgz' ||
      authority.tarballBytes !== 4_590_455 || !HEX_64.test(authority.tarballSha256) ||
      !SHA512_SRI.test(authority.distIntegrity) ||
      authority.entrypoint !== 'package/bin/pnpm.cjs' ||
      authority.regularFileCount !== 449 || authority.unpackedBytes !== 18_644_360 ||
      !HEX_128.test(authority.closureSha512) ||
      !HEX_64.test(authority.packageJsonSha256) || authority.license !== 'MIT' ||
      authority.licensePath !== 'PNPM-LICENSE' || !HEX_64.test(authority.licenseSha256)) {
    fail('pnpm toolchain authority is malformed');
  }
  return authority;
}

async function loadAndValidate() {
  const [authorityBytes, artifact, license] = await Promise.all([
    readStableRegularFile(authorityPath, 'pnpm authority'),
    readStableRegularFile(artifactPath, 'pnpm archive'),
    readStableRegularFile(join(skillRoot, 'assets', 'toolchain', 'PNPM-LICENSE'), 'pnpm license'),
  ]);
  let authority;
  try {
    authority = validatePnpmAuthority(JSON.parse(authorityBytes));
  } catch (error) {
    throw new Error('pnpm toolchain authority validation failed', { cause: error });
  }
  if (artifact.length !== authority.tarballBytes ||
      sha256(artifact) !== authority.tarballSha256 ||
      sri512(artifact) !== authority.distIntegrity ||
      sha256(license) !== authority.licenseSha256) {
    fail('pnpm toolchain artifact or license digest mismatch');
  }
  const entries = inspectTarEntries(artifact);
  if (entries.length !== authority.regularFileCount ||
      entries.some((entry) => entry.type !== '0') ||
      entries.reduce((total, entry) => total + entry.size, 0) !==
        authority.unpackedBytes ||
      pnpmClosureSha512(entries) !== authority.closureSha512) {
    fail('pnpm toolchain archive closure mismatch');
  }
  const byName = new Map(entries.map((entry) => [entry.name, entry]));
  const manifestEntry = byName.get('package/package.json');
  const cliEntry = byName.get(authority.entrypoint);
  const archiveLicense = byName.get('package/LICENSE');
  if (!manifestEntry || !cliEntry || !archiveLicense || cliEntry.size < 1 ||
      sha256(manifestEntry.body) !== authority.packageJsonSha256 ||
      sha256(archiveLicense.body) !== authority.licenseSha256) {
    fail('pnpm manifest, entrypoint, or license binding mismatch');
  }
  const manifest = JSON.parse(manifestEntry.body.toString('utf8'));
  if (manifest.name !== 'pnpm' || manifest.version !== authority.version ||
      manifest.license !== 'MIT' || manifest.engines?.node !== '>=22.13') {
    fail('pnpm package identity differs from the fixed authority');
  }
  return { artifactSha256: authority.tarballSha256, authority, authorityBytes, entries };
}

async function readStableRegularFile(filename, label) {
  const before = await lstat(filename);
  if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1) {
    fail(`${label} must be one regular file`);
  }
  const handle = await open(
    filename,
    fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW ?? 0)
  );
  try {
    const first = await handle.stat();
    const bytes = await handle.readFile();
    const last = await handle.stat();
    const after = await lstat(filename);
    if (!last.isFile() || first.dev !== before.dev || first.ino !== before.ino ||
        last.dev !== before.dev || last.ino !== before.ino ||
        after.dev !== before.dev || after.ino !== before.ino ||
        first.size !== bytes.length || last.size !== bytes.length) {
      fail(`${label} changed while it was read`);
    }
    return bytes;
  } finally {
    await handle.close();
  }
}

function destinationPath(root, entryName) {
  const destination = resolve(root, ...entryName.split('/'));
  const inside = relative(root, destination);
  if (inside === '' || inside.startsWith('..') || isAbsolute(inside)) {
    fail('pnpm archive path escapes the private runtime');
  }
  return destination;
}

function implicitDirectories(entries) {
  const directories = new Set();
  for (const entry of entries) {
    const parts = entry.name.split('/');
    for (let length = 1; length < parts.length; length += 1) {
      directories.add(parts.slice(0, length).join('/'));
    }
  }
  return [...directories].sort((left, right) => {
    const depth = left.split('/').length - right.split('/').length;
    return depth || (left < right ? -1 : left > right ? 1 : 0);
  });
}

async function verifyExtracted(root, expectedEntries) {
  const expected = new Map(expectedEntries.map((entry) => [entry.name, entry]));
  const files = [];
  async function walk(directory, prefix = '') {
    for (const child of await readdir(directory, { withFileTypes: true })) {
      const name = prefix ? `${prefix}/${child.name}` : child.name;
      const childPath = join(directory, child.name);
      if (child.isSymbolicLink() || (!child.isDirectory() && !child.isFile())) {
        fail('pnpm private runtime contains a link or special entry');
      }
      if (child.isDirectory()) await walk(childPath, name);
      else files.push({ name, childPath });
    }
  }
  await walk(root);
  if (files.length !== expected.size || files.some(({ name }) => !expected.has(name))) {
    fail('pnpm private runtime contains missing or extra files');
  }
  const verified = [];
  for (const { name, childPath } of files) {
    const wanted = expected.get(name);
    const before = await lstat(childPath);
    if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1 ||
        before.size !== wanted.size) {
      fail('pnpm private runtime file identity differs');
    }
    const handle = await open(
      childPath,
      fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW ?? 0)
    );
    try {
      const first = await handle.stat();
      const body = await handle.readFile();
      const last = await handle.stat();
      const after = await lstat(childPath);
      if (first.dev !== before.dev || first.ino !== before.ino ||
          last.dev !== before.dev || last.ino !== before.ino ||
          after.dev !== before.dev || after.ino !== before.ino ||
          sha512(body) !== sha512(wanted.body)) {
        fail('pnpm private runtime changed during verification');
      }
      verified.push({ ...wanted, body });
    } finally {
      await handle.close();
    }
  }
  return verified;
}

export async function materializePnpmToolchain(destination) {
  if (!CERTIFIED_NODES.has(process.versions.node) || !isAbsolute(destination)) {
    fail('pnpm toolchain requires a certified Node and absolute destination');
  }
  const requested = resolve(destination);
  if (requested === parse(requested).root || basename(requested) === '') {
    fail('pnpm toolchain destination is unsafe');
  }
  const parent = await realpath(dirname(requested));
  const canonicalDestination = join(parent, basename(requested));
  try {
    await lstat(canonicalDestination);
    fail('pnpm toolchain destination must not exist');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const loaded = await loadAndValidate();
  let created = false;
  try {
    await mkdir(canonicalDestination, { mode: 0o700 });
    created = true;
    const root = await realpath(canonicalDestination);
    if (root !== canonicalDestination) fail('pnpm toolchain destination changed during creation');
    if (process.platform !== 'win32') await chmod(root, 0o700);
    for (const name of implicitDirectories(loaded.entries)) {
      await mkdir(destinationPath(root, name), { mode: 0o700 });
    }
    for (const entry of loaded.entries) {
      const mode = (entry.mode & 0o111) === 0 ? 0o600 : 0o700;
      const filename = destinationPath(root, entry.name);
      await writeFile(filename, entry.body, { flag: 'wx', mode });
      if (process.platform !== 'win32') await chmod(filename, mode);
    }
    const verified = await verifyExtracted(root, loaded.entries);
    if (pnpmClosureSha512(verified) !== loaded.authority.closureSha512) {
      fail('pnpm private runtime actual closure mismatch');
    }
    return Object.freeze({
      artifactSha256: loaded.artifactSha256,
      authoritySha256: sha256(loaded.authorityBytes),
      cli: destinationPath(root, loaded.authority.entrypoint),
      closureSha512: loaded.authority.closureSha512,
      entryCount: verified.length,
      root,
      version: loaded.authority.version,
    });
  } catch (error) {
    if (created) await rm(canonicalDestination, { recursive: true, force: true });
    throw error;
  }
}
