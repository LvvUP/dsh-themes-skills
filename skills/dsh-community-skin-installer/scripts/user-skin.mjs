#!/usr/bin/env node

import { createHash, randomBytes } from 'node:crypto';
import { constants as fsConstants } from 'node:fs';
import {
  chmod,
  copyFile,
  lstat,
  mkdir,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import {
  basename,
  dirname,
  isAbsolute,
  join,
  parse,
  relative,
  resolve,
} from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  loadCommunityAuthority,
  validateCommunityRecord,
} from './catalog-authority.mjs';
import { assertBundledCssSafe } from './bundled-skin-policy.mjs';

const ALLOWED_IDS = new Set(['qq98', 'ths']);
const INSTALL_RECORD = '.dsh-themes-install.json';
const INSTALL_OWNER = 'dsh-community-skin-installer';
const assetsRoot = fileURLToPath(new URL('../assets/skins/', import.meta.url));

function fail(message) {
  throw new Error(message);
}

function parseArgs(argv) {
  const command = argv[0];
  if (!['inspect', 'install', 'remove', 'recover'].includes(command)) {
    fail('Usage: user-skin.mjs <inspect|install|remove|recover> --id <qq98|ths> --dsh-home <absolute-path> [--record <absolute-catalog-record.json>] [--from <absolute-trash-path>]');
  }
  let id;
  let dshHome;
  let from;
  let authorityRecord;
  for (let index = 1; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--id') id = argv[++index];
    else if (arg === '--dsh-home') dshHome = argv[++index];
    else if (arg === '--from') from = argv[++index];
    else if (arg === '--record') authorityRecord = argv[++index];
    else fail(`Unknown argument: ${arg}`);
  }
  if (!ALLOWED_IDS.has(id)) fail('--id must be qq98 or ths');
  if (!dshHome || !isAbsolute(dshHome)) fail('--dsh-home must be an absolute path');
  if (command === 'recover') {
    if (!from || !isAbsolute(from)) fail('recover requires an absolute --from path');
  } else if (from) {
    fail('--from is only valid with recover');
  }
  if (command === 'install') {
    if (!authorityRecord || !isAbsolute(authorityRecord)) {
      fail('install requires --record <absolute-validated-catalog-record.json>');
    }
  } else if (authorityRecord) {
    fail('--record is only valid with install');
  }
  return {
    command,
    id,
    dshHome: resolve(dshHome),
    from: from ? resolve(from) : undefined,
    authorityRecord: authorityRecord ? resolve(authorityRecord) : undefined,
  };
}

function isInside(parent, child) {
  const pathFromParent = relative(parent, child);
  return pathFromParent !== '' && !pathFromParent.startsWith('..') && !isAbsolute(pathFromParent);
}

function assertSafeRoot(path, label) {
  if (path === parse(path).root) fail(`${label} cannot be a filesystem root`);
  if (path.length < parse(path).root.length + 3) fail(`${label} is too broad`);
}

async function existingDirectory(path, label) {
  const info = await lstat(path).catch((error) => {
    if (error?.code === 'ENOENT') fail(`${label} does not exist`);
    throw error;
  });
  if (!info.isDirectory() || info.isSymbolicLink()) {
    fail(`${label} must be a real directory, not a symlink`);
  }
  return realpath(path);
}

async function secureChildDirectory(parent, name, { create = false } = {}) {
  const candidate = join(parent, name);
  if (!isInside(parent, candidate)) fail(`Unsafe child directory: ${name}`);
  if (create) await mkdir(candidate, { recursive: true, mode: 0o700 });
  const canonical = await existingDirectory(candidate, name);
  if (!isInside(parent, canonical)) fail(`${name} resolves outside DSH_HOME`);
  return canonical;
}

async function resolveProfile(dshHome, { createSkins = false } = {}) {
  assertSafeRoot(dshHome, 'DSH_HOME');
  const canonicalHome = await existingDirectory(dshHome, 'DSH_HOME');
  assertSafeRoot(canonicalHome, 'DSH_HOME');
  const skinsRoot = await secureChildDirectory(canonicalHome, 'skins', {
    create: createSkins,
  }).catch((error) => {
    if (!createSkins && /does not exist/.test(error.message)) return null;
    throw error;
  });
  return { canonicalHome, skinsRoot };
}

async function sha256(path) {
  const contents = await readFile(path);
  return createHash('sha256').update(contents).digest('hex');
}

function exactKeys(actual, expected, label) {
  const left = [...actual].sort();
  const right = [...expected].sort();
  if (JSON.stringify(left) !== JSON.stringify(right)) {
    fail(`${label} contains unexpected or missing files`);
  }
}

async function assertRegularFile(path, label) {
  const info = await lstat(path);
  if (!info.isFile() || info.isSymbolicLink()) fail(`${label} must be a regular file`);
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, stable(value[key])])
  );
}

function exactObject(actual, expected, label) {
  if (JSON.stringify(stable(actual)) !== JSON.stringify(stable(expected))) {
    fail(`${label} does not match trusted catalog and receipt authority`);
  }
}

async function verifyBundledSkin(id, trustedAuthority) {
  const source = join(assetsRoot, id);
  const canonicalSource = await existingDirectory(source, `bundled ${id} skin`);
  if (!isInside(assetsRoot, canonicalSource)) fail('Bundled skin resolves outside the Skill');

  const provenancePath = join(canonicalSource, 'PROVENANCE.json');
  await assertRegularFile(provenancePath, 'PROVENANCE.json');
  const provenance = JSON.parse(await readFile(provenancePath, 'utf8'));
  if (provenance.schemaVersion !== 1 || provenance.id !== id) {
    fail('Bundled provenance identity is invalid');
  }
  if (provenance.conversion !== 'dsh-themes-rc8-css-only-v1') {
    fail('Bundled conversion authority is invalid');
  }
  if (provenance.executableHooksIncluded !== false) {
    fail('Bundled user skins must not include executable hooks');
  }
  const managedNames = Object.keys(provenance.files ?? {});
  exactKeys(managedNames, ['LICENSE', 'NOTICE', 'patches.css', 'skin.css', 'skin.json'], 'PROVENANCE.files');
  exactKeys(
    (await readdir(canonicalSource, { withFileTypes: true })).map((entry) => entry.name),
    [...managedNames, 'PROVENANCE.json'],
    'Bundled skin directory'
  );

  const files = {};
  for (const name of managedNames) {
    const path = join(canonicalSource, name);
    await assertRegularFile(path, name);
    const digest = await sha256(path);
    if (!/^[a-f0-9]{64}$/.test(provenance.files[name]) || digest !== provenance.files[name]) {
      fail(`Bundled ${name} hash does not match PROVENANCE.json`);
    }
    files[name] = digest;
  }
  files['PROVENANCE.json'] = await sha256(provenancePath);
  const computedAuthority = {
    schemaVersion: 1,
    sourceSha256: provenance.sourceSha256,
    provenanceSha256: files['PROVENANCE.json'],
    files,
  };
  exactObject(computedAuthority, trustedAuthority, 'Bundled asset authority');

  const manifest = JSON.parse(await readFile(join(canonicalSource, 'skin.json'), 'utf8'));
  if (
    manifest.skinManifestVersion !== 2 ||
    manifest.id !== id ||
    manifest.contributes?.stylesheet !== 'skin.css' ||
    manifest.contributes?.patches !== 'patches.css' ||
    'hooks' in (manifest.contributes ?? {})
  ) {
    fail('Bundled skin manifest is not the reviewed CSS-only v2 shape');
  }
  for (const cssName of ['skin.css', 'patches.css']) {
    const css = await readFile(join(canonicalSource, cssName), 'utf8');
    assertBundledCssSafe(css, `Bundled ${cssName}`);
  }
  return { source: canonicalSource, provenance, files };
}

async function readManagedSkin(path, expectedId) {
  const canonical = await existingDirectory(path, `installed ${expectedId} skin`);
  if (canonical !== path) fail('Installed skin path is not canonical');
  const recordPath = join(canonical, INSTALL_RECORD);
  await assertRegularFile(recordPath, INSTALL_RECORD);
  const record = JSON.parse(await readFile(recordPath, 'utf8'));
  if (
    record.schemaVersion !== 1 ||
    record.owner !== INSTALL_OWNER ||
    record.id !== expectedId ||
    record.installationMode !== 'bundled-user-skin' ||
    record.executableHooksIncluded !== false ||
    typeof record.installedAt !== 'string'
  ) {
    fail('Installed skin ownership record is invalid');
  }
  const managedNames = Object.keys(record.files ?? {});
  exactKeys(
    managedNames,
    ['LICENSE', 'NOTICE', 'PROVENANCE.json', 'patches.css', 'skin.css', 'skin.json'],
    'Install record'
  );
  exactKeys(
    (await readdir(canonical, { withFileTypes: true })).map((entry) => entry.name),
    [...managedNames, INSTALL_RECORD],
    'Installed skin directory'
  );
  for (const name of managedNames) {
    const file = join(canonical, name);
    await assertRegularFile(file, name);
    if (!/^[a-f0-9]{64}$/.test(record.files[name]) || (await sha256(file)) !== record.files[name]) {
      fail(`Managed file changed: ${name}`);
    }
  }
  return { canonical, record };
}

async function targetState(profile, id) {
  if (!profile.skinsRoot) return { installed: false, target: join(profile.canonicalHome, 'skins', id) };
  const target = join(profile.skinsRoot, id);
  if (!isInside(profile.skinsRoot, target)) fail('Unsafe skin target');
  let targetInfo;
  try {
    targetInfo = await lstat(target);
  } catch (error) {
    if (error?.code === 'ENOENT') return { installed: false, target };
    throw error;
  }
  if (!targetInfo.isDirectory() || targetInfo.isSymbolicLink()) {
    fail(`Skin target ${id} exists but is not a real directory`);
  }
  const managed = await readManagedSkin(target, id);
  return { installed: true, target, ...managed };
}

async function installSkin(profile, id, trustedAuthority) {
  const bundled = await verifyBundledSkin(id, trustedAuthority);
  const state = await targetState(profile, id);
  if (state.installed) fail(`Skin ${id} is already installed`);

  const staging = join(profile.skinsRoot, `.dsh-themes-stage-${id}-${process.pid}-${randomBytes(6).toString('hex')}`);
  if (!isInside(profile.skinsRoot, staging)) fail('Unsafe staging path');
  await mkdir(staging, { mode: 0o700 });
  try {
    for (const name of Object.keys(bundled.files)) {
      const destination = join(staging, name);
      await copyFile(join(bundled.source, name), destination, fsConstants.COPYFILE_EXCL);
      await chmod(destination, 0o600);
    }
    const record = {
      schemaVersion: 1,
      owner: INSTALL_OWNER,
      id,
      installationMode: 'bundled-user-skin',
      installedAt: new Date().toISOString(),
      sourceRevision: bundled.provenance.sourceRevision,
      conversion: bundled.provenance.conversion,
      executableHooksIncluded: false,
      files: bundled.files,
    };
    await writeFile(join(staging, INSTALL_RECORD), `${JSON.stringify(record, null, 2)}\n`, {
      encoding: 'utf8',
      flag: 'wx',
      mode: 0o600,
    });
    await rename(staging, state.target);
    const installed = await readManagedSkin(state.target, id);
    return { installed: true, id, target: installed.canonical, record: installed.record };
  } catch (error) {
    await rm(staging, { recursive: true, force: true }).catch(() => undefined);
    throw error;
  }
}

async function removeSkin(profile, id) {
  const state = await targetState(profile, id);
  if (!state.installed) fail(`Skin ${id} is not installed`);
  const trashRoot = await secureChildDirectory(profile.canonicalHome, '.dsh-themes-trash', {
    create: true,
  });
  const trashSkins = await secureChildDirectory(trashRoot, 'skins', { create: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const recoveryPath = join(trashSkins, `${id}-${timestamp}-${randomBytes(4).toString('hex')}`);
  if (!isInside(trashSkins, recoveryPath)) fail('Unsafe recovery path');
  await rename(state.target, recoveryPath);
  return { installed: false, id, recoveryPath, recoverable: true };
}

async function recoverSkin(profile, id, from) {
  const trashRoot = await secureChildDirectory(profile.canonicalHome, '.dsh-themes-trash');
  const trashSkins = await secureChildDirectory(trashRoot, 'skins');
  const canonicalFrom = await existingDirectory(from, 'Recovery source');
  if (!isInside(trashSkins, canonicalFrom) || !basename(canonicalFrom).startsWith(`${id}-`)) {
    fail('Recovery source is not an allowed DSH-Themes trash entry');
  }
  await readManagedSkin(canonicalFrom, id);
  const state = await targetState(profile, id);
  if (state.installed) fail(`Skin ${id} is already installed`);
  await rename(canonicalFrom, state.target);
  const recovered = await readManagedSkin(state.target, id);
  return { installed: true, recovered: true, id, target: recovered.canonical };
}

const { command, id, dshHome, from, authorityRecord } = parseArgs(
  process.argv.slice(2)
);
let installAuthority;
if (command === 'install') {
  const rawRecord = JSON.parse(await readFile(authorityRecord, 'utf8'));
  const gate = validateCommunityRecord(
    rawRecord,
    await loadCommunityAuthority(),
    { mode: 'install' }
  );
  if (gate.skin.skinId !== id) {
    fail('--id does not match the validated catalog record');
  }
  installAuthority = gate.skin.bundledAssetAuthority;
}
const profile = await resolveProfile(dshHome, {
  createSkins: command === 'install' || command === 'recover',
});

let result;
if (command === 'inspect') {
  const state = await targetState(profile, id);
  result = state.installed
    ? {
        installed: true,
        managed: true,
        id,
        target: state.target,
        sourceRevision: state.record.sourceRevision,
        conversion: state.record.conversion,
        executableHooksIncluded: false,
      }
    : { installed: false, managed: false, id, target: state.target };
} else if (command === 'install') {
  result = await installSkin(profile, id, installAuthority);
} else if (command === 'remove') {
  result = await removeSkin(profile, id);
} else {
  result = await recoverSkin(profile, id, from);
}

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
