import { createHash, randomUUID } from 'node:crypto';
import { copyFile, lstat, mkdir, readFile, readdir, realpath, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';

const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const safePath = (value) => typeof value === 'string' && value.length > 0 && !isAbsolute(value) && value.split(/[\\/]/).every(part => part && part !== '.' && part !== '..');
const exists = async (path) => lstat(path).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
async function regularDirectory(path) {
  const info = await exists(path);
  if (info && (!info.isDirectory() || info.isSymbolicLink())) throw new Error(`Expected a regular directory: ${path}`);
  if (!info) await mkdir(path);
}
async function listFiles(root, prefix = '') {
  const files = [];
  for (const item of await readdir(join(root, prefix), { withFileTypes: true })) {
    const path = prefix ? `${prefix}/${item.name}` : item.name;
    if (item.isSymbolicLink()) throw new Error('Companion files must not contain symlinks.');
    if (item.isDirectory()) files.push(...await listFiles(root, path));
    else if (item.isFile()) files.push(path);
    else throw new Error('Companion files must be regular files.');
  }
  return files.sort();
}
async function verifyFiles(root, files) {
  const actual = await listFiles(root);
  if (JSON.stringify(actual) !== JSON.stringify(files.map(item => item.path).sort())) throw new Error('Companion directory file inventory differs.');
  for (const file of files) {
    if (!safePath(file.path) || !/^[a-f0-9]{64}$/.test(file.sha256) || !Number.isInteger(file.bytes) || file.bytes < 0) throw new Error('Invalid companion file manifest.');
    const bytes = await readFile(join(root, file.path));
    if (bytes.length !== file.bytes || digest(bytes) !== file.sha256) throw new Error(`Companion bytes differ: ${file.path}`);
  }
}
export async function inspectCompanion(item, { skillRoot }) {
  const companion = item.companion;
  if (!companion) return null;
  if (companion.kind !== 'bundled-user-skin' || !/^[a-z0-9-]+$/.test(companion.skinId) || !safePath(companion.sourcePath) || !companion.sourcePath.startsWith('assets/alpha/skin-center/user-skins/') || !Array.isArray(companion.files) || !companion.files.length || new Set(companion.files.map(file => file.path)).size !== companion.files.length) throw new Error('Invalid bundled companion recipe.');
  const root = await realpath(skillRoot);
  const source = join(root, companion.sourcePath);
  let current = root;
  for (const part of companion.sourcePath.split('/')) {
    current = join(current, part);
    const info = await lstat(current);
    if (info.isSymbolicLink() || !info.isDirectory()) throw new Error('Companion source must be a regular directory.');
  }
  if (relative(root, await realpath(source)).startsWith('..')) throw new Error('Companion source is outside this Skill.');
  await verifyFiles(source, companion.files);
  return { ...companion, source };
}
async function locations(dshHome) {
  const home = resolve(dshHome);
  await mkdir(home, { recursive: true });
  const realHome = await realpath(home);
  const state = join(realHome, 'dsh-themes-community');
  await regularDirectory(state);
  const receipts = join(state, 'companions');
  const backups = join(state, 'backups');
  const skins = join(realHome, 'skins');
  for (const path of [receipts, backups, skins]) await regularDirectory(path);
  return { receipts, backups, skins };
}
async function readReceipt(file) {
  const info = await exists(file);
  if (!info) return null;
  if (!info.isFile() || info.isSymbolicLink()) throw new Error('Companion receipt must be a regular file.');
  return JSON.parse(await readFile(file, 'utf8'));
}
export async function installCompanion(item, { skillRoot, dshHome }) {
  const companion = await inspectCompanion(item, { skillRoot });
  if (!companion) return null;
  const paths = await locations(dshHome);
  const target = join(paths.skins, companion.skinId);
  const receiptPath = join(paths.receipts, `${companion.skinId}.json`);
  const previous = await readReceipt(receiptPath);
  if (previous && (previous.packageName !== item.packageName || previous.skinId !== companion.skinId)) throw new Error('Companion receipt belongs to another package.');
  const targetInfo = await exists(target);
  if (targetInfo && (!targetInfo.isDirectory() || targetInfo.isSymbolicLink())) throw new Error('Existing skin must be a regular directory.');
  if (previous) {
    if (!targetInfo) throw new Error('Managed skin was removed outside this installer.');
    await verifyFiles(target, previous.files);
    if (JSON.stringify(previous.files) === JSON.stringify(companion.files)) return { skinId: companion.skinId, status: 'already-installed' };
  }
  const staging = join(paths.skins, `.${companion.skinId}-${randomUUID()}`);
  await mkdir(staging);
  let displaced = null;
  let installedTarget = false;
  const backupName = previous?.backupName ?? (targetInfo ? `${companion.skinId}-${randomUUID()}` : null);
  try {
    for (const file of companion.files) {
      const destination = join(staging, file.path);
      await mkdir(dirname(destination), { recursive: true });
      await copyFile(join(companion.source, file.path), destination);
    }
    await verifyFiles(staging, companion.files);
    if (targetInfo) {
      const displacedPath = previous ? join(paths.backups, `update-${randomUUID()}`) : join(paths.backups, backupName);
      await rename(target, displacedPath);
      displaced = displacedPath;
    }
    await rename(staging, target);
    installedTarget = true;
    const receipt = { schemaVersion: 1, packageName: item.packageName, skinId: companion.skinId, backupName, files: companion.files };
    const pending = `${receiptPath}.${randomUUID()}`;
    await writeFile(pending, JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    await rename(pending, receiptPath);
    // The receipt and target now agree. Cleanup failure must not roll back only one.
    let cleanupPending = false;
    if (previous && displaced) await rm(displaced, { recursive: true }).catch(() => { cleanupPending = true; });
    return { skinId: companion.skinId, status: 'installed', backupCreated: !!backupName, ...(cleanupPending ? { cleanupPending: true } : {}) };
  } catch (error) {
    await rm(staging, { recursive: true, force: true });
    if (installedTarget) await rm(target, { recursive: true, force: true });
    if (displaced) await rename(displaced, target);
    throw error;
  }
}
export async function restoreCompanions(packageName, { dshHome }) {
  const paths = await locations(dshHome);
  const results = [];
  for (const name of await readdir(paths.receipts)) {
    if (!/^[a-z0-9-]+\.json$/.test(name)) continue;
    const file = join(paths.receipts, name);
    const receipt = await readReceipt(file);
    if (receipt?.packageName !== packageName) continue;
    if (receipt.schemaVersion !== 1 || !/^[a-z0-9-]+$/.test(receipt.skinId) || name !== `${receipt.skinId}.json` || (receipt.backupName && !/^[a-z0-9-]+$/.test(receipt.backupName))) throw new Error('Invalid companion recovery receipt.');
    const target = join(paths.skins, receipt.skinId);
    const info = await lstat(target);
    if (!info.isDirectory() || info.isSymbolicLink()) throw new Error('Managed skin must be a regular directory.');
    await verifyFiles(target, receipt.files);
    const temporary = join(paths.backups, `restore-${randomUUID()}`);
    await rename(target, temporary);
    try {
      if (receipt.backupName) {
        const backup = join(paths.backups, receipt.backupName);
        const backupInfo = await lstat(backup);
        if (!backupInfo.isDirectory() || backupInfo.isSymbolicLink()) throw new Error('Original skin backup is missing or changed.');
        await rename(backup, target);
      }
      await rm(file);
      await rm(temporary, { recursive: true });
      results.push({ skinId: receipt.skinId, status: receipt.backupName ? 'restored' : 'removed' });
    } catch (error) { if (!(await exists(target))) await rename(temporary, target); throw error; }
  }
  return results;
}
