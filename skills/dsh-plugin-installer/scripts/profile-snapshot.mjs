#!/usr/bin/env node

import { createHash, randomUUID } from 'node:crypto';
import { lstat, mkdir, open, readFile, realpath, rename, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, parse, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PROFILE_FILES = ['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'cordis.patch.yml'];
export const BASE_BUNDLES = ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app'];

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

export async function validateWebProfile(input) {
  const profile = await canonicalDirectory(input, 'profile directory');
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

async function newSnapshotDirectory(input, profile) {
  if (!isAbsolute(input)) fail('snapshot directory must be absolute');
  const requested = resolve(input);
  if (requested === parse(requested).root) fail('snapshot directory cannot be a filesystem root');
  const snapshot = join(await realpath(dirname(requested)), basename(requested));
  const fromProfile = relative(profile, snapshot);
  const fromSnapshot = relative(snapshot, profile);
  if (fromProfile === '' || (!fromProfile.startsWith('..') && !isAbsolute(fromProfile)) ||
      (!fromSnapshot.startsWith('..') && !isAbsolute(fromSnapshot))) {
    fail('snapshot directory must be outside the profile tree');
  }
  try {
    await lstat(snapshot);
    fail('snapshot directory must not already exist');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  await mkdir(snapshot, { recursive: false, mode: 0o700 });
  return realpath(snapshot);
}

async function readOptionalRegular(path) {
  try {
    const stat = await lstat(path);
    if (!stat.isFile() || stat.isSymbolicLink()) fail(`${path} must be a regular file`);
    return { present: true, bytes: await readFile(path) };
  } catch (error) {
    if (error.code === 'ENOENT') return { present: false, bytes: null };
    throw error;
  }
}

function validateSnapshotManifest(manifest) {
  const keys = Object.keys(manifest ?? {}).sort();
  if (JSON.stringify(keys) !== JSON.stringify(['files', 'profile', 'schemaVersion'])) {
    fail('snapshot manifest keys are invalid');
  }
  if (manifest.schemaVersion !== 1 || manifest.profile !== 'web' || !Array.isArray(manifest.files) ||
      manifest.files.length !== PROFILE_FILES.length) fail('snapshot manifest header is invalid');
  for (let index = 0; index < PROFILE_FILES.length; index += 1) {
    const entry = manifest.files[index];
    if (JSON.stringify(Object.keys(entry ?? {}).sort()) !== JSON.stringify(['path', 'present', 'sha256'])) {
      fail('snapshot file entry keys are invalid');
    }
    if (entry.path !== PROFILE_FILES[index] || entry.present !== true ||
        !/^[a-f0-9]{64}$/.test(entry.sha256)) {
      fail(`snapshot entry ${PROFILE_FILES[index]} is invalid`);
    }
  }
  return manifest;
}

export async function createProfileSnapshot(profileInput, snapshotInput) {
  const profile = await validateWebProfile(profileInput);
  const snapshot = await newSnapshotDirectory(snapshotInput, profile);
  try {
    const files = [];
    for (const name of PROFILE_FILES) {
      const state = await readOptionalRegular(join(profile, name));
      if (state.present) await writeFile(join(snapshot, name), state.bytes, { mode: 0o600, flag: 'wx' });
      files.push({ path: name, present: state.present, sha256: state.present ? sha256(state.bytes) : null });
    }
    const manifest = validateSnapshotManifest({ schemaVersion: 1, profile: 'web', files });
    const handle = await open(join(snapshot, 'snapshot.json'), 'wx', 0o600);
    try {
      await handle.writeFile(`${JSON.stringify(manifest, null, 2)}\n`);
    } finally {
      await handle.close();
    }
    return { snapshot, manifest };
  } catch (error) {
    await rm(snapshot, { recursive: true, force: true });
    throw error;
  }
}

async function loadSnapshot(input) {
  const snapshot = await canonicalDirectory(input, 'snapshot directory');
  const manifest = validateSnapshotManifest(JSON.parse(await readFile(join(snapshot, 'snapshot.json'), 'utf8')));
  for (const entry of manifest.files) {
    const state = await readOptionalRegular(join(snapshot, entry.path));
    if (!state.present || sha256(state.bytes) !== entry.sha256) fail(`snapshot file ${entry.path} digest mismatch`);
  }
  return { snapshot, manifest };
}

async function atomicWrite(path, bytes) {
  const temporary = `${path}.dsh-plugin-installer-${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, bytes, { mode: 0o600, flag: 'wx' });
    if (process.platform !== 'win32') {
      await rename(temporary, path);
    } else {
      const backup = `${path}.dsh-plugin-installer-${randomUUID()}.bak`;
      await rename(path, backup);
      try {
        await rename(temporary, path);
      } catch (error) {
        try {
          await rename(backup, path);
        } catch (restoreError) {
          throw new AggregateError([error, restoreError], `Windows replacement and recovery failed for ${path}`);
        }
        throw error;
      }
      await rm(backup, { force: true });
    }
  } finally {
    await rm(temporary, { force: true });
  }
}

export async function verifyProfileSnapshot(profileInput, snapshotInput) {
  const profile = await validateWebProfile(profileInput);
  const { manifest } = await loadSnapshot(snapshotInput);
  const mismatches = [];
  for (const entry of manifest.files) {
    const state = await readOptionalRegular(join(profile, entry.path));
    if (state.present !== entry.present ||
        (state.present && sha256(state.bytes) !== entry.sha256)) mismatches.push(entry.path);
  }
  return { matches: mismatches.length === 0, mismatches };
}

export async function restoreProfileSnapshot(profileInput, snapshotInput) {
  const profile = await canonicalDirectory(profileInput, 'profile directory');
  const { snapshot, manifest } = await loadSnapshot(snapshotInput);
  for (const entry of manifest.files) {
    const target = join(profile, entry.path);
    await atomicWrite(target, await readFile(join(snapshot, entry.path)));
  }
  const verified = await verifyProfileSnapshot(profile, snapshot);
  if (!verified.matches) fail(`profile restore verification failed: ${verified.mismatches.join(', ')}`);
  return { restored: true, files: PROFILE_FILES };
}

function parseArgs(argv) {
  const command = argv[0];
  const options = {};
  for (let index = 1; index < argv.length; index += 2) {
    if (!argv[index + 1] || !['--profile', '--snapshot'].includes(argv[index])) fail('invalid snapshot argument');
    options[argv[index].slice(2)] = argv[index + 1];
  }
  if (!['create', 'verify', 'restore'].includes(command) || !options.profile || !options.snapshot) {
    fail('usage: profile-snapshot.mjs <create|verify|restore> --profile <absolute-web-profile> --snapshot <absolute-directory>');
  }
  return { command, ...options };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const options = parseArgs(process.argv.slice(2));
    const result = options.command === 'create'
      ? await createProfileSnapshot(options.profile, options.snapshot)
      : options.command === 'verify'
        ? await verifyProfileSnapshot(options.profile, options.snapshot)
        : await restoreProfileSnapshot(options.profile, options.snapshot);
    process.stdout.write(`${JSON.stringify({ ...result, snapshot: '<private-snapshot>' }, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
