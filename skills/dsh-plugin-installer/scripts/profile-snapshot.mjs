#!/usr/bin/env node

import { createHash, randomUUID } from 'node:crypto';
import { constants as fsConstants } from 'node:fs';
import { chmod, lstat, mkdir, open, readFile, realpath, rename, rm } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, parse, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { secureWindowsPrivatePath } from './windows-private-acl.mjs';
import { moveWindowsPathDurably } from './windows-durable-move.mjs';

export const PROFILE_FILES = ['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'cordis.patch.yml'];
export const HOME_FILES = ['settings.yaml', 'cordis.patch.yml', '.credentials.yaml', '.anonymous-user-id'];
export const BASE_BUNDLES = ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app'];

const SNAPSHOT_LAYOUT = [
  ...PROFILE_FILES.map((path) => ({ root: 'profile', path, required: true })),
  ...HOME_FILES.map((path) => ({ root: 'home', path, required: false })),
];

function fail(message) {
  throw new Error(message);
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

async function canonicalDirectory(input, label) {
  if (!isAbsolute(input)) fail(`${label} must be an absolute path`);
  const path = resolve(input);
  if (path === parse(path).root) fail(`${label} cannot be a filesystem root`);
  const stat = await lstat(path);
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    fail(`${label} must be a real directory, not a symlink`);
  }
  return realpath(path);
}

async function canonicalDshHome(input) {
  const requested = resolve(input);
  const dshHome = await canonicalDirectory(input, 'DSH_HOME');
  if (requested !== dshHome) fail('DSH_HOME must be supplied as its canonical path');
  return dshHome;
}

export async function validateWebProfile(profileInput) {
  const profile = await canonicalDirectory(profileInput, 'profile directory');
  const manifestPath = join(profile, 'package.json');
  const stat = await lstat(manifestPath);
  if (!stat.isFile() || stat.isSymbolicLink()) fail('profile package.json must be a regular file');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  if (manifest.name !== 'dsh-profile-web' || manifest.private !== true ||
      JSON.stringify(manifest.dsh?.profile?.bundles) !== JSON.stringify(BASE_BUNDLES) ||
      manifest.dsh.profile.patchReload !== 'live') {
    fail('target is not an alpha.1 web profile');
  }
  for (const name of PROFILE_FILES) {
    const fileStat = await lstat(join(profile, name));
    if (!fileStat.isFile() || fileStat.isSymbolicLink()) {
      fail(`profile ${name} must be a regular file`);
    }
  }
  return profile;
}

async function validateSnapshotTarget(dshHomeInput, profileInput, { requireValidProfile = true } = {}) {
  const dshHome = await canonicalDshHome(dshHomeInput);
  const expectedProfile = join(dshHome, 'profiles', 'web');
  if (resolve(profileInput) !== expectedProfile) {
    fail('profile directory must be exactly DSH_HOME/profiles/web');
  }
  const profile = requireValidProfile
    ? await validateWebProfile(profileInput)
    : await canonicalDirectory(profileInput, 'profile directory');
  if (profile !== expectedProfile) {
    fail('profile directory must be exactly DSH_HOME/profiles/web without symlink traversal');
  }
  return { dshHome, profile };
}

function treesIntersect(first, second) {
  const forward = relative(first, second);
  const reverse = relative(second, first);
  return forward === '' || (!forward.startsWith('..') && !isAbsolute(forward)) ||
    (!reverse.startsWith('..') && !isAbsolute(reverse));
}

async function makePrivateDirectory(path) {
  if (process.platform !== 'win32') {
    await mkdir(path, { recursive: false, mode: 0o700 });
    await syncParentDirectory(path);
    return;
  }
  const temporary = `${path}.dsh-plugin-installer-${randomUUID()}.tmp`;
  let moved = false;
  try {
    await mkdir(temporary, { recursive: false, mode: 0o700 });
    await secureWindowsPrivatePath(temporary, 'directory', 'configure');
    await secureWindowsPrivatePath(temporary, 'directory', 'verify');
    await moveWindowsPathDurably(temporary, path);
    moved = true;
    await secureWindowsPrivatePath(path, 'directory', 'verify');
  } catch (error) {
    if (!moved) await rm(temporary, { recursive: true, force: true }).catch(() => {});
    throw error;
  }
}

async function newSnapshotDirectory(input, dshHome) {
  if (!isAbsolute(input)) fail('snapshot directory must be absolute');
  const requested = resolve(input);
  if (requested === parse(requested).root) fail('snapshot directory cannot be a filesystem root');
  const snapshot = join(await realpath(dirname(requested)), basename(requested));
  if (treesIntersect(dshHome, snapshot)) {
    fail('snapshot directory must be outside the complete DSH_HOME tree');
  }
  try {
    await lstat(snapshot);
    fail('snapshot directory must not already exist');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  await makePrivateDirectory(snapshot);
  try {
    await makePrivateDirectory(join(snapshot, 'profile'));
    await makePrivateDirectory(join(snapshot, 'home'));
    return realpath(snapshot);
  } catch (error) {
    await rm(snapshot, { recursive: true, force: true });
    await syncParentDirectory(snapshot).catch(() => {});
    throw error;
  }
}

async function readOptionalRegular(path, { requireSingleLink = false } = {}) {
  let before;
  try {
    before = await lstat(path);
    if (!before.isFile() || before.isSymbolicLink() ||
        (requireSingleLink && before.nlink !== 1)) {
      fail(`${path} must be a regular${requireSingleLink ? ' single-link' : ''} file`);
    }
    const flags = fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW ?? 0);
    const handle = await open(path, flags);
    try {
      const stat = await handle.stat();
      if (!stat.isFile() || before.dev !== stat.dev || before.ino !== stat.ino ||
          (requireSingleLink && stat.nlink !== 1)) {
        fail(`${path} must remain one regular single-link file while it is read`);
      }
      const bytes = await handle.readFile();
      const after = await handle.stat();
      let afterPath;
      try {
        afterPath = await lstat(path);
      } catch {
        bytes.fill(0);
        fail(`${path} changed while it was read`);
      }
      const final = await handle.stat();
      if (!afterPath.isFile() || afterPath.isSymbolicLink() ||
          afterPath.dev !== stat.dev || afterPath.ino !== stat.ino ||
          afterPath.nlink !== stat.nlink || afterPath.size !== stat.size ||
          afterPath.mtimeMs !== stat.mtimeMs || afterPath.ctimeMs !== stat.ctimeMs ||
          after.dev !== stat.dev || after.ino !== stat.ino ||
          after.nlink !== stat.nlink || (requireSingleLink && after.nlink !== 1) ||
          after.size !== stat.size || after.mtimeMs !== stat.mtimeMs ||
          after.ctimeMs !== stat.ctimeMs ||
          final.dev !== stat.dev || final.ino !== stat.ino ||
          final.nlink !== stat.nlink || (requireSingleLink && final.nlink !== 1) ||
          final.size !== stat.size || final.mtimeMs !== stat.mtimeMs ||
          final.ctimeMs !== stat.ctimeMs || bytes.length !== stat.size) {
        bytes.fill(0);
        fail(`${path} changed while it was read`);
      }
      return {
        present: true,
        bytes,
        posixMode: process.platform === 'win32' ? null : stat.mode & 0o7777,
      };
    } finally {
      await handle.close();
    }
  } catch (error) {
    if (error.code === 'ENOENT') {
      try {
        await lstat(path);
        fail(`${path} appeared while its absence was checked`);
      } catch (absenceError) {
        if (absenceError.code === 'ENOENT') {
          return { present: false, bytes: null, posixMode: null };
        }
        throw absenceError;
      }
    }
    throw error;
  }
}

async function syncParentDirectory(path) {
  if (process.platform === 'win32') return false;
  const handle = await open(dirname(path), fsConstants.O_RDONLY);
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
  return true;
}

async function privateWrite(path, bytes) {
  const writePath = process.platform === 'win32'
    ? `${path}.dsh-plugin-installer-${randomUUID()}.tmp`
    : path;
  const handle = await open(writePath, 'wx', 0o600);
  let closed = false;
  let installed = false;
  try {
    if (process.platform === 'win32') {
      await secureWindowsPrivatePath(writePath, 'file', 'configure');
      await secureWindowsPrivatePath(writePath, 'file', 'verify');
    }
    await handle.writeFile(bytes);
    await handle.sync();
    await handle.close();
    closed = true;
    if (process.platform === 'win32') {
      await moveWindowsPathDurably(writePath, path);
      installed = true;
      await secureWindowsPrivatePath(path, 'file', 'verify');
    } else {
      await syncParentDirectory(path);
      installed = true;
    }
  } catch (error) {
    if (!closed) await handle.close().catch(() => {});
    if (!installed) {
      await rm(writePath, { force: true }).catch(() => {});
      if (process.platform !== 'win32') {
        await syncParentDirectory(writePath).catch(() => {});
      }
    }
    throw error;
  }
}

function appendLengthDelimited(chunks, value) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(String(value), 'utf8');
  chunks.push(Buffer.from(`${bytes.length}:`, 'ascii'), bytes);
}

export async function captureManagedFileBindingInput(dshHomeInput, profileInput, {
  requireValidProfile = true,
} = {}) {
  const roots = await validateSnapshotTarget(dshHomeInput, profileInput, { requireValidProfile });
  const chunks = [Buffer.from('dsh-plugin-installer/managed-file-state/v1\0', 'utf8')];
  for (const expected of SNAPSHOT_LAYOUT) {
    const state = await readOptionalRegular(entrySource(expected, roots), {
      requireSingleLink: true,
    });
    if (expected.required && !state.present) {
      fail(`managed file ${expected.root}/${expected.path} is required`);
    }
    appendLengthDelimited(chunks, expected.root);
    appendLengthDelimited(chunks, expected.path);
    appendLengthDelimited(chunks, state.present ? 'present' : 'absent');
    appendLengthDelimited(chunks, state.posixMode === null ? 'null' : String(state.posixMode));
    appendLengthDelimited(chunks, state.present ? state.bytes : Buffer.alloc(0));
  }
  return Buffer.concat(chunks);
}

export async function captureSnapshotManagedFileBindingInput(snapshotInput) {
  const { manifest, verifiedFiles } = await loadVerifiedProfileSnapshot(snapshotInput);
  const chunks = [Buffer.from('dsh-plugin-installer/managed-file-state/v1\0', 'utf8')];
  for (const entry of manifest.files) {
    const key = `${entry.root}/${entry.path}`;
    const bytes = entry.present ? verifiedFiles.get(key) : Buffer.alloc(0);
    if (entry.present && !Buffer.isBuffer(bytes)) {
      fail(`verified snapshot bytes are missing for ${key}`);
    }
    appendLengthDelimited(chunks, entry.root);
    appendLengthDelimited(chunks, entry.path);
    appendLengthDelimited(chunks, entry.present ? 'present' : 'absent');
    appendLengthDelimited(chunks, entry.posixMode === null ? 'null' : String(entry.posixMode));
    appendLengthDelimited(chunks, bytes);
  }
  return Buffer.concat(chunks);
}

function validateSnapshotManifest(manifest) {
  const keys = Object.keys(manifest ?? {}).sort();
  if (JSON.stringify(keys) !== JSON.stringify(['files', 'profile', 'schemaVersion'])) {
    fail('snapshot manifest keys are invalid');
  }
  if (manifest.schemaVersion !== 3 || manifest.profile !== 'web' || !Array.isArray(manifest.files) ||
      manifest.files.length !== SNAPSHOT_LAYOUT.length) fail('snapshot manifest header is invalid');
  for (let index = 0; index < SNAPSHOT_LAYOUT.length; index += 1) {
    const expected = SNAPSHOT_LAYOUT[index];
    const entry = manifest.files[index];
    if (JSON.stringify(Object.keys(entry ?? {}).sort()) !==
        JSON.stringify(['path', 'posixMode', 'present', 'root', 'sha256'])) {
      fail('snapshot file entry keys are invalid');
    }
    const validMode = entry.present
      ? (process.platform === 'win32'
        ? entry.posixMode === null
        : Number.isSafeInteger(entry.posixMode) && entry.posixMode >= 0 && entry.posixMode <= 0o7777)
      : entry.posixMode === null;
    if (entry.root !== expected.root || entry.path !== expected.path ||
        typeof entry.present !== 'boolean' ||
        (expected.required && entry.present !== true) ||
        !validMode ||
        (entry.present && !/^[a-f0-9]{64}$/.test(entry.sha256)) ||
        (!entry.present && entry.sha256 !== null)) {
      fail(`snapshot entry ${expected.root}/${expected.path} is invalid`);
    }
  }
  return manifest;
}

function entrySource(entry, roots) {
  return join(entry.root === 'profile' ? roots.profile : roots.dshHome, entry.path);
}

function entrySnapshot(entry, snapshot) {
  return join(snapshot, entry.root, entry.path);
}

function publicResult(snapshot, extra = {}) {
  return {
    snapshot,
    schemaVersion: 3,
    profile: 'web',
    filesProtected: SNAPSHOT_LAYOUT.length,
    ...extra,
  };
}

export async function createProfileSnapshot(dshHomeInput, profileInput, snapshotInput) {
  const roots = await validateSnapshotTarget(dshHomeInput, profileInput);
  const snapshot = await newSnapshotDirectory(snapshotInput, roots.dshHome);
  try {
    const files = [];
    for (const expected of SNAPSHOT_LAYOUT) {
      const state = await readOptionalRegular(entrySource(expected, roots), {
        requireSingleLink: true,
      });
      if (state.present) await privateWrite(entrySnapshot(expected, snapshot), state.bytes);
      files.push({
        root: expected.root,
        path: expected.path,
        present: state.present,
        sha256: state.present ? sha256(state.bytes) : null,
        posixMode: state.posixMode,
      });
    }
    const manifest = validateSnapshotManifest({ schemaVersion: 3, profile: 'web', files });
    await privateWrite(
      join(snapshot, 'snapshot.json'),
      Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
    );
    return publicResult(snapshot);
  } catch (error) {
    await rm(snapshot, { recursive: true, force: true });
    throw error;
  }
}

async function validatePrivateSnapshotDirectory(path, label) {
  const stat = await lstat(path);
  if (!stat.isDirectory() || stat.isSymbolicLink()) fail(`${label} must be a private real directory`);
  if (process.platform === 'win32') {
    await secureWindowsPrivatePath(path, 'directory', 'verify');
  } else if ((stat.mode & 0o077) !== 0) {
    fail(`${label} must not be accessible by group or others`);
  }
}

export async function loadVerifiedProfileSnapshot(input) {
  const snapshot = await canonicalDirectory(input, 'snapshot directory');
  await validatePrivateSnapshotDirectory(snapshot, 'snapshot directory');
  await validatePrivateSnapshotDirectory(join(snapshot, 'profile'), 'snapshot profile directory');
  await validatePrivateSnapshotDirectory(join(snapshot, 'home'), 'snapshot home directory');
  const manifestPath = join(snapshot, 'snapshot.json');
  const manifestState = await readOptionalRegular(manifestPath, { requireSingleLink: true });
  if (!manifestState.present ||
      (process.platform !== 'win32' && (manifestState.posixMode & 0o077) !== 0)) {
    fail('snapshot manifest must be a private regular file');
  }
  if (process.platform === 'win32') {
    await secureWindowsPrivatePath(manifestPath, 'file', 'verify');
  }
  const manifest = validateSnapshotManifest(JSON.parse(manifestState.bytes.toString('utf8')));
  const verifiedFiles = new Map();
  for (const entry of manifest.files) {
    const path = entrySnapshot(entry, snapshot);
    const state = await readOptionalRegular(path, { requireSingleLink: true });
    if (state.present && process.platform !== 'win32') {
      const stat = await lstat(path);
      if ((stat.mode & 0o077) !== 0) fail(`snapshot file ${entry.root}/${entry.path} is not private`);
    }
    if (state.present && process.platform === 'win32') {
      await secureWindowsPrivatePath(path, 'file', 'verify');
    }
    if (state.present !== entry.present ||
        (state.present && sha256(state.bytes) !== entry.sha256)) {
      fail(`snapshot file ${entry.root}/${entry.path} digest mismatch`);
    }
    if (state.present) verifiedFiles.set(`${entry.root}/${entry.path}`, state.bytes);
  }
  return { snapshot, manifest, verifiedFiles };
}

async function optionalRegularExists(path, lstatPath) {
  try {
    const stat = await lstatPath(path);
    if (!stat.isFile() || stat.isSymbolicLink()) fail(`${path} must be a regular file`);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

export async function atomicRestoreWrite(path, bytes, posixMode, {
  platform = process.platform,
  securePath = secureWindowsPrivatePath,
  openFile = open,
  chmodPath = chmod,
  lstatPath = lstat,
  renamePath,
  durableWindowsMove = moveWindowsPathDurably,
  removePath = rm,
  randomId = randomUUID,
} = {}) {
  const movePath = renamePath ?? (platform === 'win32' ? durableWindowsMove : rename);
  const temporary = `${path}.dsh-plugin-installer-${randomId()}.tmp`;
  let backup = null;
  let handle;
  let handleClosed = false;
  let replacementInstalled = false;
  let originalMoved = false;
  try {
    // On Windows the temporary file must be empty until its inherited ACL has
    // been replaced and independently verified as current-user SID-only.
    handle = await openFile(temporary, 'wx', 0o600);
    if (platform === 'win32') {
      await securePath(temporary, 'file', 'configure');
      await securePath(temporary, 'file', 'verify');
    }
    await handle.writeFile(bytes);
    await handle.sync();
    await handle.close();
    handleClosed = true;

    if (platform !== 'win32') {
      await chmodPath(temporary, posixMode);
      await movePath(temporary, path);
      replacementInstalled = true;
      await syncParentDirectory(path);
    } else {
      if (await optionalRegularExists(path, lstatPath)) {
        backup = `${path}.dsh-plugin-installer-${randomId()}.bak`;
        await movePath(path, backup);
        originalMoved = true;
      }
      await movePath(temporary, path);
      replacementInstalled = true;
      // Renaming must preserve the already-verified ACL. Keep the original
      // backup until this second verification succeeds on the final target.
      await securePath(path, 'file', 'verify');
      if (backup !== null) {
        await removePath(backup, { force: true });
        originalMoved = false;
      }
    }
  } catch (error) {
    const recoveryErrors = [];
    if (platform === 'win32' && replacementInstalled) {
      try {
        await removePath(path, { force: true });
        replacementInstalled = false;
      } catch (removeError) {
        recoveryErrors.push(removeError);
      }
    }
    if (platform === 'win32' && originalMoved && backup !== null) {
      try {
        await movePath(backup, path);
        originalMoved = false;
      } catch (restoreError) {
        recoveryErrors.push(restoreError);
      }
    }
    if (recoveryErrors.length > 0) {
      throw new AggregateError(
        [error, ...recoveryErrors],
        `Windows replacement and recovery failed for ${path}`
      );
    }
    throw error;
  } finally {
    if (handle && !handleClosed) await handle.close().catch(() => {});
    await removePath(temporary, { force: true }).catch(() => {});
  }
}

async function removeOptionalRegular(path) {
  const state = await readOptionalRegular(path, { requireSingleLink: true });
  if (state.present) {
    await rm(path, { force: true });
    await syncParentDirectory(path);
  }
}

export async function verifyProfileSnapshot(dshHomeInput, profileInput, snapshotInput) {
  const roots = await validateSnapshotTarget(dshHomeInput, profileInput, { requireValidProfile: false });
  const { snapshot, manifest } = await loadVerifiedProfileSnapshot(snapshotInput);
  const mismatches = [];
  for (const entry of manifest.files) {
    const state = await readOptionalRegular(entrySource(entry, roots), {
      requireSingleLink: true,
    });
    if (state.present !== entry.present ||
        (state.present && (sha256(state.bytes) !== entry.sha256 ||
          state.posixMode !== entry.posixMode))) {
      mismatches.push(`${entry.root}/${entry.path}`);
    }
  }
  return publicResult(snapshot, {
    matches: mismatches.length === 0,
    mismatches,
  });
}

export async function restoreProfileSnapshot(dshHomeInput, profileInput, snapshotInput) {
  const roots = await validateSnapshotTarget(dshHomeInput, profileInput, { requireValidProfile: false });
  const { snapshot, manifest, verifiedFiles } = await loadVerifiedProfileSnapshot(snapshotInput);
  for (const entry of manifest.files) {
    const target = entrySource(entry, roots);
    if (entry.present) {
      const bytes = verifiedFiles.get(`${entry.root}/${entry.path}`);
      if (!Buffer.isBuffer(bytes)) fail(`verified snapshot bytes are missing for ${entry.root}/${entry.path}`);
      await atomicRestoreWrite(target, bytes, entry.posixMode);
    } else {
      await removeOptionalRegular(target);
    }
  }
  const verified = await verifyProfileSnapshot(roots.dshHome, roots.profile, snapshot);
  if (!verified.matches) fail(`profile restore verification failed: ${verified.mismatches.join(', ')}`);
  return publicResult(snapshot, {
    restored: true,
    files: SNAPSHOT_LAYOUT.map((entry) => `${entry.root}/${entry.path}`),
  });
}

function parseArgs(argv) {
  const command = argv[0];
  const options = {};
  for (let index = 1; index < argv.length; index += 2) {
    if (!argv[index + 1] || !['--dsh-home', '--profile', '--snapshot'].includes(argv[index])) {
      fail('invalid snapshot argument');
    }
    options[argv[index].slice(2).replaceAll('-', '')] = argv[index + 1];
  }
  if (!['create', 'verify', 'restore'].includes(command) ||
      !options.dshhome || !options.profile || !options.snapshot) {
    fail('usage: profile-snapshot.mjs <create|verify|restore> --dsh-home <canonical-absolute-dsh-home> --profile <absolute-web-profile> --snapshot <absolute-directory>');
  }
  return { command, ...options };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const options = parseArgs(process.argv.slice(2));
    const result = options.command === 'create'
      ? await createProfileSnapshot(options.dshhome, options.profile, options.snapshot)
      : options.command === 'verify'
        ? await verifyProfileSnapshot(options.dshhome, options.profile, options.snapshot)
        : await restoreProfileSnapshot(options.dshhome, options.profile, options.snapshot);
    process.stdout.write(`${JSON.stringify({ ...result, snapshot: '<private-snapshot>' }, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
