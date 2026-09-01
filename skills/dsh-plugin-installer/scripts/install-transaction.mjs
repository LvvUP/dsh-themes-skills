#!/usr/bin/env node

import { spawn, spawnSync } from 'node:child_process';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { once } from 'node:events';
import { constants as fsConstants } from 'node:fs';
import { lstat, mkdir, open, readFile, readdir, realpath, rename, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { basename, dirname, isAbsolute, join, parse, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { parseDocument } from 'yaml';

import {
  loadAuthority,
  normalizeCatalogId,
  normalizeBundlePatch,
  resolveItems,
  validateAuthority,
} from './authority.mjs';
import {
  authorizePrepare,
  cleanupInstallerOwnedAllowBuilds,
  revokePrepare,
  validateProfileResolutionSurface,
  verifyEffectivePnpmBuildPolicy,
} from './prepare-authorization.mjs';
import {
  createPrivatePnpmBinding,
  pnpmCommandShimShell,
} from './pnpm-binding.mjs';
import {
  captureManagedFileBindingInput,
  captureSnapshotManagedFileBindingInput,
  createProfileSnapshot,
  restoreProfileSnapshot,
  verifyProfileSnapshot,
} from './profile-snapshot.mjs';
import { captureProfileClosure, verifyProfileClosure } from './profile-closure.mjs';
import { validatePrepared } from './prepare-plugin.mjs';
import {
  captureWindowsPrivatePathIdentity,
  secureWindowsPrivatePath as enforceWindowsPrivatePath,
  secureWindowsPrivatePaths as enforceWindowsPrivatePaths,
  windowsPrivateIdentityFromStat,
} from './windows-private-acl.mjs';
import { moveWindowsPathDurably } from './windows-durable-move.mjs';
import {
  loadAuthority as loadHarnessAuthority,
  validateBuildReceipt,
} from '../../dsh-harness-installer/scripts/authority.mjs';
import { verifySourceCheckout } from '../../dsh-harness-installer/scripts/verify-source.mjs';

function fail(message, details) {
  const error = new Error(message);
  if (details) error.details = details;
  throw error;
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
}

function jsonBytes(value) {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function sameWindowsIdentity(first, second) {
  return first.volumeSerial === second.volumeSerial && first.fileIndex === second.fileIndex;
}

async function secureWindowsPrivatePath(path, kind, action, expectedIdentity) {
  const identity = expectedIdentity ?? await captureWindowsPrivatePathIdentity(path, kind);
  return enforceWindowsPrivatePath(path, kind, action, { expectedIdentity: identity });
}

async function secureWindowsPrivatePaths(requests) {
  const bound = await Promise.all(requests.map(async (request) => ({
    ...request,
    expectedIdentity: request.expectedIdentity ??
      await captureWindowsPrivatePathIdentity(request.path, request.kind),
  })));
  return enforceWindowsPrivatePaths(bound);
}

async function assertWindowsPathIdentity(path, kind, expectedIdentity, label) {
  const observed = await captureWindowsPrivatePathIdentity(path, kind);
  if (!sameWindowsIdentity(expectedIdentity, observed)) {
    fail(`${label} changed from its caller-bound Windows file identity`);
  }
}

async function syncDirectory(path) {
  if (process.platform === 'win32') return false;
  const handle = await open(path, fsConstants.O_RDONLY);
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
  return true;
}

async function createPrivateDirectoryDurably(path) {
  if (process.platform !== 'win32') {
    await mkdir(path, { mode: 0o700 });
    await syncDirectory(dirname(path));
    return;
  }
  const temporary = `${path}.dsh-plugin-installer-${randomBytes(16).toString('hex')}.tmp`;
  let moved = false;
  try {
    await mkdir(temporary, { mode: 0o700 });
    const identity = await captureWindowsPrivatePathIdentity(temporary, 'directory');
    await secureWindowsPrivatePath(temporary, 'directory', 'configure', identity);
    await moveWindowsPathDurably(temporary, path);
    moved = true;
    await secureWindowsPrivatePath(path, 'directory', 'verify', identity);
  } catch (error) {
    await rm(moved ? path : temporary, { recursive: true, force: true }).catch(() => {});
    throw error;
  }
}

async function movePathDurably(source, target) {
  if (process.platform === 'win32') {
    return moveWindowsPathDurably(source, target);
  }
  await rename(source, target);
  await syncDirectory(dirname(target));
  return true;
}

export function buildPlan(authority, selections, {
  top10 = false,
  top10ReleaseSet,
  validationOptions,
} = {}) {
  validateAuthority(authority, validationOptions);
  const items = resolveItems(authority, selections, {
    top10,
    top10ReleaseSet,
    validationOptions,
  });
  const liveLifecycleItem = items.find((item) => item.package.lifecycleAuthorization.required);
  if (liveLifecycleItem) {
    fail(
      `plugin #${liveLifecycleItem.catalogId} requires a live lifecycle build; ` +
      'this transaction accepts only prebuilt or script-free artifacts'
    );
  }
  const plan = {
    schemaVersion: 1,
    action: 'install',
    profile: 'web',
    transaction: top10 ? 'atomic-top10' : items.length === 1 ? 'single' : 'atomic-batch',
    releaseSet: top10 ? top10ReleaseSet.releaseSet : null,
    releaseSetPayloadSha256: top10 ? top10ReleaseSet.releaseSetPayloadSha256 : null,
    harness: {
      tag: authority.harness.tag,
      commit: authority.harness.commit,
      tree: authority.harness.tree,
      runtimeReceiptSetSha256: authority.harness.runtimeReceiptSetSha256,
    },
    plugins: items.map((item) => ({
      catalogId: item.catalogId,
      package: { name: item.package.name, version: item.package.version },
      distribution: item.distribution.kind === 'hosted-plugin-verified'
        ? {
            kind: item.distribution.kind,
            assetName: item.distribution.assetName,
            artifactUrl: item.distribution.artifactUrl,
            artifactBytes: item.distribution.artifactBytes,
            artifactSha256: item.distribution.artifactSha256,
            artifactIntegrity: item.distribution.artifactIntegrity,
            manifestSha256: item.distribution.manifestSha256,
            licenseFile: stable(item.distribution.licenseFile),
            noticeFile: stable(item.distribution.noticeFile),
            sbom: stable(item.distribution.sbom),
          }
        : { kind: item.distribution.kind, source: stable(item.distribution.source) },
      lifecycle: stable(item.package.lifecycle),
      lifecycleAuthorization: stable(item.package.lifecycleAuthorization),
      runtimeAcceptance: stable(item.runtimeAcceptance),
      safety: stable(item.safety),
      rights: stable(item.rights),
      rollbackPackage: item.rollback.removePackageName,
      coldRestartRequired: item.rollback.coldRestartRequired,
    })),
    localRecoveryAuthentication: {
      kind: 'dsh-home-private-hmac-sha256',
      keyOutput: 'forbidden',
      transactionCopy: 'forbidden',
    },
    childEnvironment: 'transaction-private-home-and-config-with-minimal-allowlist',
  };
  const bytes = Buffer.from(`${JSON.stringify(stable(plan))}\n`, 'utf8');
  return { items, plan, planSha256: sha256(bytes) };
}

export function buildRemovalPlan(authority, selections, {
  top10 = false,
  top10ReleaseSet,
  validationOptions,
} = {}) {
  validateAuthority(authority, validationOptions);
  const items = resolveItems(authority, selections, {
    top10,
    top10ReleaseSet,
    validationOptions,
  });
  const plan = {
    schemaVersion: 1,
    action: 'remove',
    profile: 'web',
    transaction: top10 ? 'atomic-top10-remove' : items.length === 1 ? 'single-remove' : 'atomic-batch-remove',
    releaseSet: top10 ? top10ReleaseSet.releaseSet : null,
    releaseSetPayloadSha256: top10 ? top10ReleaseSet.releaseSetPayloadSha256 : null,
    harness: {
      tag: authority.harness.tag,
      commit: authority.harness.commit,
      tree: authority.harness.tree,
      runtimeReceiptSetSha256: authority.harness.runtimeReceiptSetSha256,
    },
    plugins: items.map((item) => ({
      catalogId: item.catalogId,
      package: { name: item.package.name, version: item.package.version },
      removePackage: item.rollback.removePackageName,
      coldRestartRequired: item.rollback.coldRestartRequired,
    })),
    executionOrder: 'reverse-plan-order',
    recovery: 'restore-complete-private-transaction-snapshot',
    localRecoveryAuthentication: {
      kind: 'dsh-home-private-hmac-sha256',
      keyOutput: 'forbidden',
      transactionCopy: 'forbidden',
    },
    childEnvironment: 'transaction-private-home-and-config-with-minimal-allowlist',
  };
  const bytes = Buffer.from(`${JSON.stringify(stable(plan))}\n`, 'utf8');
  return { items, plan, planSha256: sha256(bytes) };
}

export function buildDshInvocation(builtCli, dshArgs, constraints = {}) {
  if (!isAbsolute(builtCli) && !/^[A-Za-z]:\\/.test(builtCli)) {
    fail('built DSH CLI must be absolute');
  }
  if (!Array.isArray(dshArgs) || dshArgs.length === 0 ||
      dshArgs.some((value) => typeof value !== 'string' || value.includes('\0') || value.includes('\n') || value.includes('\r'))) {
    fail('DSH arguments must be bounded literal argument-array values');
  }
  if (constraints === null || typeof constraints !== 'object' || Array.isArray(constraints)) {
    fail('DSH invocation constraints are malformed');
  }
  const remove = dshArgs.length === 7 &&
    JSON.stringify(dshArgs.slice(0, 4)) === JSON.stringify(['plugin', '--profile', 'web', 'remove']) &&
    JSON.stringify(dshArgs.slice(4, 6)) === JSON.stringify(['--lockfile-only', '--']) &&
    /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/u.test(dshArgs[6]);
  const materialize = JSON.stringify(dshArgs) === JSON.stringify([
    'plugin', '--profile', 'web', 'install', '--frozen-lockfile',
    '--ignore-scripts', '--ignore-pnpmfile',
  ]);
  const list = JSON.stringify(dshArgs) ===
    JSON.stringify(['plugin', '--profile', 'web', 'list', '--json']);
  const dump = JSON.stringify(dshArgs) ===
    JSON.stringify(['--profile', 'web', '--dump-config']);
  if (Object.keys(constraints).length !== 0) {
    fail('DSH invocation constraints are forbidden');
  }
  if (!remove && !materialize && !list && !dump) {
    fail('DSH plugin invocation is outside the fixed materialize, remove, list, or dump-config grammar');
  }
  return {
    command: process.execPath,
    args: [builtCli, ...dshArgs],
    shell: false,
  };
}

export function buildBoundPnpmResolutionInvocation(childEnv, pnpmArgs, constraints) {
  if (childEnv === null || typeof childEnv !== 'object' || Array.isArray(childEnv) ||
      typeof childEnv.DSH_PLUGIN_PNPM_NODE !== 'string' ||
      (!isAbsolute(childEnv.DSH_PLUGIN_PNPM_NODE) &&
        !/^[A-Za-z]:\\/u.test(childEnv.DSH_PLUGIN_PNPM_NODE)) ||
      typeof childEnv.DSH_PLUGIN_PNPM_CLI !== 'string' ||
      (!isAbsolute(childEnv.DSH_PLUGIN_PNPM_CLI) &&
        !/^[A-Za-z]:\\/u.test(childEnv.DSH_PLUGIN_PNPM_CLI)) ||
      !Array.isArray(pnpmArgs) || pnpmArgs.length !== 7 ||
      JSON.stringify(pnpmArgs.slice(0, 6)) !== JSON.stringify([
        'add', '--save-exact', '--ignore-scripts', '--lockfile-only',
        '--ignore-pnpmfile', '--',
      ]) ||
      constraints === null || typeof constraints !== 'object' || Array.isArray(constraints) ||
      JSON.stringify(Object.keys(constraints)) !== JSON.stringify(['expectedInstallSpec']) ||
      constraints.expectedInstallSpec !== pnpmArgs[6]) {
    fail('bound pnpm resolution invocation is malformed or not tied to its exact install spec');
  }
  const spec = pnpmArgs[6];
  if (typeof spec !== 'string' || spec.length < 1 || spec.length > 4096 ||
      /[\0\r\n\t]/u.test(spec)) {
    fail('plugin install spec is outside the fixed command-injection-safe grammar');
  }
  const windowsLocal = /^[A-Za-z]:\\/u.test(spec);
  const posixLocal = spec.startsWith('/');
  const safeLocalArtifact =
    (windowsLocal || posixLocal) && spec.toLowerCase().endsWith('.tgz') &&
    !spec.split(/[\\/]/u).some((part) => part === '..') &&
    (!windowsLocal || !/["%!^&|<>]/u.test(spec));
  const safeUpstream =
    /^git\+https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\.git#[a-f0-9]{40}$/u.test(spec);
  if (!safeLocalArtifact && !safeUpstream) {
    fail('plugin install spec is outside the fixed command-injection-safe grammar');
  }
  return {
    command: childEnv.DSH_PLUGIN_PNPM_NODE,
    args: [childEnv.DSH_PLUGIN_PNPM_CLI, ...pnpmArgs],
    shell: false,
  };
}

export function verifyFrozenLockfileBytes(before, after) {
  if (!Buffer.isBuffer(before) || !Buffer.isBuffer(after) || before.length < 1 ||
      before.length > 16 * 1024 * 1024 || after.length < 1 || after.length > 16 * 1024 * 1024) {
    fail('frozen lockfile byte verification input is malformed');
  }
  if (sha256(after) !== sha256(before) || !after.equals(before)) {
    fail('frozen script-free materialization changed the resolved lockfile bytes');
  }
  return sha256(before);
}

const CHILD_ENV_ALLOWLIST = [
  'COMSPEC', 'LANG', 'LC_ALL', 'LC_CTYPE', 'PATH', 'PATHEXT', 'SystemDrive',
  'SystemRoot', 'USER', 'USERDOMAIN', 'USERNAME', 'WINDIR',
];

function allowedEnvironmentValue(source, key, platform) {
  const matches = platform === 'win32'
    ? Object.keys(source).filter((candidate) => candidate.toLowerCase() === key.toLowerCase())
    : Object.hasOwn(source, key) ? [key] : [];
  if (matches.length === 0) return undefined;
  const values = matches.map((candidate) => source[candidate]);
  if (matches.length > 1 && values.some((value) => value !== values[0])) {
    fail(`child environment contains ambiguous Windows ${key} entries`);
  }
  return values[0];
}

export function buildChildEnvironment(
  dshHome,
  runtimeRoot,
  source = process.env,
  platform = process.platform
) {
  if (typeof dshHome !== 'string' || dshHome.length === 0 || dshHome.includes('\0') ||
      typeof runtimeRoot !== 'string' || !isAbsolute(runtimeRoot) || runtimeRoot.includes('\0') ||
      source === null || typeof source !== 'object' || Array.isArray(source) ||
      !['darwin', 'linux', 'win32'].includes(platform)) {
    fail('child environment requires explicit DSH_HOME/runtime roots and an environment mapping');
  }
  const childEnv = {};
  for (const key of CHILD_ENV_ALLOWLIST) {
    const value = allowedEnvironmentValue(source, key, platform);
    if (typeof value === 'string' && value.length > 0 && !value.includes('\0')) {
      childEnv[key] = value;
    }
  }
  if (typeof childEnv.PATH !== 'string') fail('child environment requires one explicit PATH');
  childEnv.DSH_HOME = dshHome;
  childEnv.HOME = join(runtimeRoot, 'home');
  childEnv.USERPROFILE = childEnv.HOME;
  childEnv.APPDATA = join(runtimeRoot, 'appdata');
  childEnv.LOCALAPPDATA = join(runtimeRoot, 'localappdata');
  childEnv.TEMP = join(runtimeRoot, 'tmp');
  childEnv.TMP = childEnv.TEMP;
  childEnv.TMPDIR = childEnv.TEMP;
  childEnv.XDG_CACHE_HOME = join(runtimeRoot, 'xdg-cache');
  childEnv.XDG_CONFIG_HOME = join(runtimeRoot, 'xdg-config');
  childEnv.XDG_DATA_HOME = join(runtimeRoot, 'xdg-data');
  childEnv.NPM_CONFIG_USERCONFIG = join(runtimeRoot, 'empty-npmrc');
  childEnv.NPM_CONFIG_CACHE = join(runtimeRoot, 'npm-cache');
  childEnv.GIT_CONFIG_NOSYSTEM = '1';
  childEnv.GIT_CONFIG_GLOBAL = join(runtimeRoot, 'empty-gitconfig');
  childEnv.GIT_TERMINAL_PROMPT = '0';
  childEnv.GCM_INTERACTIVE = 'Never';
  return Object.freeze(childEnv);
}

async function createChildRuntimeEnvironment(transactionRoot, dshHome, profile) {
  const runtimeRoot = join(transactionRoot, 'runtime-environment');
  await mkdir(runtimeRoot, { mode: 0o700 });
  for (const name of [
    'appdata', 'home', 'localappdata', 'npm-cache', 'tmp',
    'xdg-cache', 'xdg-config', 'xdg-data',
  ]) {
    await mkdir(join(runtimeRoot, name), { mode: 0o700 });
  }
  await writeFile(join(runtimeRoot, 'empty-npmrc'), '', { mode: 0o600, flag: 'wx' });
  await writeFile(join(runtimeRoot, 'empty-gitconfig'), '', { mode: 0o600, flag: 'wx' });
  const baseEnvironment = buildChildEnvironment(dshHome, runtimeRoot);
  const binding = await createPrivatePnpmBinding(baseEnvironment, runtimeRoot, {
    commandCwd: profile,
  });
  return binding.environment;
}

async function makeTransactionPrivateDirectory(path) {
  await createPrivateDirectoryDurably(path);
}

export async function stagePreparedForTransaction(transactionRootInput, preparedRootInput, items) {
  const transactionRoot = await canonicalDirectory(transactionRootInput, 'transaction root');
  const preparedRoot = await canonicalDirectory(preparedRootInput, 'prepared root');
  if (!Array.isArray(items) || items.length === 0) fail('transaction staging requires exact authority items');
  const stagingRoot = join(transactionRoot, 'prepared-staging');
  await makeTransactionPrivateDirectory(stagingRoot);
  const staged = [];
  try {
    for (const item of items) {
      const source = await validatePrepared(join(preparedRoot, String(item.catalogId)), item);
      const stagedDirectory = join(stagingRoot, String(item.catalogId));
      await makeTransactionPrivateDirectory(stagedDirectory);
      await privateWrite(join(stagedDirectory, 'prepared.json'), source.record);
      if (source.record.install.artifactFile !== null) {
        const bytes = await readFile(source.installSpec);
        try {
          await writePrivateBytes(
            join(stagedDirectory, source.record.install.artifactFile),
            bytes
          );
        } finally {
          bytes.fill(0);
        }
      }
      staged.push(await validatePrepared(stagedDirectory, item));
    }
    return Object.freeze(staged);
  } catch (error) {
    await rm(stagingRoot, { recursive: true, force: true }).catch(() => {});
    await syncDirectory(transactionRoot).catch(() => {});
    throw error;
  }
}

function runInvocation(invocation, { cwd, childEnv, capture = false }) {
  if (childEnv === null || typeof childEnv !== 'object' ||
      typeof childEnv.DSH_HOME !== 'string') {
    fail('DSH child invocation requires the frozen minimal environment');
  }
  const result = spawnSync(invocation.command, invocation.args, {
    cwd,
    env: childEnv,
    encoding: capture ? 'utf8' : undefined,
    maxBuffer: 2 * 1024 * 1024,
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    shell: false,
    timeout: 180_000,
  });
  return {
    code: result.status ?? 1,
    error: result.error,
    stdout: capture ? result.stdout : '',
    stderr: capture ? result.stderr : '',
  };
}

async function canonicalDirectory(input, label) {
  if (!isAbsolute(input)) fail(`${label} must be absolute`);
  const path = resolve(input);
  if (path === parse(path).root) fail(`${label} cannot be a filesystem root`);
  const stat = await lstat(path);
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    fail(`${label} must be a real directory, not a symlink`);
  }
  return realpath(path);
}

async function newTransactionRoot(input, protectedRoots) {
  if (!isAbsolute(input)) fail('transaction root must be absolute');
  const requested = resolve(input);
  if (requested === parse(requested).root) fail('transaction root cannot be a filesystem root');
  const root = join(await realpath(dirname(requested)), basename(requested));
  for (const protectedRoot of protectedRoots) {
    const forward = relative(protectedRoot, root);
    const reverse = relative(root, protectedRoot);
    if (forward === '' || (!forward.startsWith('..') && !isAbsolute(forward)) ||
        (!reverse.startsWith('..') && !isAbsolute(reverse))) {
      fail('transaction root must be outside source, DSH_HOME, profile, and prepared trees');
    }
  }
  try {
    await lstat(root);
    fail('transaction root must not already exist');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  await createPrivateDirectoryDurably(root);
  return realpath(root);
}

async function verifyHarnessGate(sourceInput, receiptInput, pluginAuthority) {
  if (!isAbsolute(receiptInput)) fail('Harness build receipt must be absolute');
  const harnessAuthority = await loadHarnessAuthority();
  const verified = await verifySourceCheckout(sourceInput, harnessAuthority);
  const receipt = validateBuildReceipt(
    JSON.parse(await readFile(resolve(receiptInput), 'utf8')),
    harnessAuthority
  );
  if (harnessAuthority.release.tag !== pluginAuthority.harness.tag ||
      harnessAuthority.release.commit !== pluginAuthority.harness.commit ||
      harnessAuthority.release.tree !== pluginAuthority.harness.tree ||
      harnessAuthority.source.lockfileSha256 !== pluginAuthority.harness.lockfileSha256) {
    fail('plugin authority and Harness source-build authority disagree');
  }
  const builtCli = join(verified.source, harnessAuthority.source.builtCliPath);
  const stat = await lstat(builtCli);
  if (!stat.isFile() || stat.isSymbolicLink()) fail('source-built Harness CLI is missing');
  if (sha256(await readFile(builtCli)) !== receipt.result.builtCliSha256) {
    fail('source-built Harness CLI digest does not match its private build receipt');
  }
  return { source: verified.source, builtCli };
}

function verifyPnpm(childEnv) {
  if (
    !/^[a-f0-9]{64}$/u.test(childEnv.DSH_PLUGIN_PNPM_ARTIFACT_SHA256 ?? '') ||
    !/^[a-f0-9]{128}$/u.test(childEnv.DSH_PLUGIN_PNPM_CLOSURE_SHA512 ?? '') ||
    typeof childEnv.DSH_PLUGIN_PNPM_CLI !== 'string' ||
    !isAbsolute(childEnv.DSH_PLUGIN_PNPM_CLI) ||
    typeof childEnv.DSH_PLUGIN_PNPM_NODE !== 'string' ||
    !isAbsolute(childEnv.DSH_PLUGIN_PNPM_NODE)
  ) {
    fail('the DSH plugin command requires one private verified pnpm runtime binding');
  }
  const result = spawnSync('pnpm', ['--version'], {
    encoding: 'utf8',
    env: childEnv,
    shell: pnpmCommandShimShell(childEnv),
    timeout: 30_000,
    windowsHide: true,
  });
  if (
    result.error ||
    result.status !== 0 ||
    (result.stderr ?? '').trim() !== '' ||
    (result.stdout ?? '').trim() !== '11.7.0'
  ) {
    fail('the DSH plugin command requires its private wrapper to launch pnpm 11.7.0');
  }
}

async function verifyInstalled(profile, item) {
  const manifest = JSON.parse(await readFile(join(profile, 'package.json'), 'utf8'));
  if (!Object.hasOwn(manifest.dependencies ?? {}, item.package.name) ||
      !manifest.dsh?.profile?.bundles?.includes(item.package.name)) {
    fail(`profile did not activate ${item.package.name}`);
  }
  const packagePath = join(profile, 'node_modules', ...item.package.name.split('/'), 'package.json');
  const target = await realpath(packagePath);
  const modulesRoot = await realpath(join(profile, 'node_modules'));
  const inside = relative(modulesRoot, target);
  if (inside.startsWith('..') || isAbsolute(inside)) fail(`installed package ${item.package.name} escapes profile node_modules`);
  const installed = JSON.parse(await readFile(target, 'utf8'));
  if (installed.name !== item.package.name || installed.version !== item.package.version ||
      normalizeBundlePatch(installed.dsh?.bundle?.patch) !== item.package.bundlePatch) {
    fail(`installed package ${item.package.name} identity mismatch`);
  }
}

async function verifyRemoved(profile, item) {
  const manifest = JSON.parse(await readFile(join(profile, 'package.json'), 'utf8'));
  if (Object.hasOwn(manifest.dependencies ?? {}, item.package.name) ||
      manifest.dsh?.profile?.bundles?.includes(item.package.name)) {
    fail(`profile still activates ${item.package.name}`);
  }
  const packagePath = join(profile, 'node_modules', ...item.package.name.split('/'), 'package.json');
  try {
    await lstat(packagePath);
    fail(`removed package ${item.package.name} remains linked from profile node_modules`);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

export function parsePluginInventory(output) {
  let value;
  try {
    value = JSON.parse(output);
  } catch (error) {
    fail(`plugin inventory is not valid JSON: ${error.message}`);
  }
  if (!Array.isArray(value) || value.length !== 1 || value[0]?.name !== 'dsh-profile-web' ||
      value[0]?.private !== true) {
    fail('plugin inventory does not describe one private web profile');
  }
  const dependencies = value[0].dependencies ?? {};
  if (dependencies === null || typeof dependencies !== 'object' || Array.isArray(dependencies) ||
      Object.keys(dependencies).some((name) =>
        !/^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/u.test(name))) {
    fail('plugin inventory dependencies are malformed');
  }
  const normalized = {};
  for (const [name, dependency] of Object.entries(dependencies)) {
    const version = typeof dependency === 'string' ? dependency : dependency?.version;
    if (typeof version !== 'string' || version.length === 0 || version.length > 160 ||
        version.includes('\0') || version.includes('\n') || version.includes('\r')) {
      fail('plugin inventory dependencies are malformed');
    }
    normalized[name] = version;
  }
  return stable(normalized);
}

function exactObjectKeys(value, expected, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value) ||
      JSON.stringify(Object.keys(value).sort()) !== JSON.stringify([...expected].sort())) {
    fail(`${label} is malformed or contains unsupported executable fields`);
  }
}

function validateRuntimeAcceptance(item) {
  const acceptance = item?.runtimeAcceptance;
  exactObjectKeys(
    acceptance,
    ['schemaVersion', 'dumpConfig', 'functionalProbe'],
    `plugin #${item?.catalogId ?? 'unknown'} runtime acceptance authority`
  );
  if (acceptance.schemaVersion !== 1) {
    fail(`plugin #${item.catalogId} runtime acceptance authority has an unsupported schema`);
  }
  exactObjectKeys(
    acceptance.dumpConfig,
    ['kind', 'entryId', 'packageName', 'occurrence'],
    `plugin #${item.catalogId} dump-config probe`
  );
  exactObjectKeys(
    acceptance.functionalProbe,
    ['kind', 'packageName', 'version', 'unauthenticatedRootStatus'],
    `plugin #${item.catalogId} functional probe`
  );
  const dump = acceptance.dumpConfig;
  const functional = acceptance.functionalProbe;
  if (dump.kind !== 'exact-cordis-entry' || dump.occurrence !== 'exactly-one' ||
      !/^[A-Za-z0-9][A-Za-z0-9._/-]{0,127}$/u.test(dump.entryId ?? '') ||
      dump.packageName !== item.package.name) {
    fail(`plugin #${item.catalogId} dump-config probe is not bound to its exact authority item`);
  }
  if (functional.kind !== 'cold-web-start-with-plugin-inventory' ||
      functional.packageName !== item.package.name ||
      functional.version !== item.package.version ||
      functional.unauthenticatedRootStatus !== 401) {
    fail(`plugin #${item.catalogId} functional probe is not bound to its exact authority item`);
  }
  return acceptance;
}

export function parseDumpConfigEntries(output) {
  if (typeof output !== 'string' || output.length === 0 || output.length > 1_048_576) {
    fail('dump-config output is missing or exceeds the bounded acceptance limit');
  }
  const document = parseDocument(output, {
    merge: false,
    maxAliasCount: 0,
    prettyErrors: false,
    uniqueKeys: true,
  });
  if (document.errors.length > 0) {
    fail('dump-config output is not strict YAML');
  }
  let value;
  try {
    value = document.toJS({ maxAliasCount: 0 });
  } catch {
    fail('dump-config output contains unsupported aliases or tags');
  }
  if (!Array.isArray(value)) fail('dump-config output is not one composed Cordis entry list');
  return value
    .filter((entry) => entry !== null && typeof entry === 'object' && !Array.isArray(entry) &&
      Object.hasOwn(entry, 'id') && Object.hasOwn(entry, 'name'))
    .map((entry) => ({ id: entry.id, name: entry.name, disabled: entry.disabled === true }));
}

function normalizeInventory(value, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    fail(`${label} is malformed`);
  }
  const normalized = {};
  for (const [name, version] of Object.entries(value)) {
    if (!/^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/u.test(name) ||
        typeof version !== 'string' || version.length === 0 || version.length > 160) {
      fail(`${label} is malformed`);
    }
    normalized[name] = version;
  }
  return stable(normalized);
}

export function verifyRuntimeAcceptanceEvidence(items, {
  baselineInventory,
  dumpConfigOutput,
  installedInventory,
  restartedInventory,
}) {
  if (!Array.isArray(items) || items.length === 0) fail('runtime acceptance requires authority items');
  const entries = parseDumpConfigEntries(dumpConfigOutput);
  const baseline = normalizeInventory(baselineInventory, 'baseline plugin inventory');
  const installed = normalizeInventory(installedInventory, 'installed plugin inventory');
  const restarted = normalizeInventory(restartedInventory, 'restarted plugin inventory');
  const expected = { ...baseline };
  const accepted = [];
  const seenEntryIds = new Set();
  for (const item of items) {
    const acceptance = validateRuntimeAcceptance(item);
    const { entryId, packageName } = acceptance.dumpConfig;
    if (seenEntryIds.has(entryId)) {
      fail(`runtime acceptance reuses Cordis entry id ${entryId}`);
    }
    seenEntryIds.add(entryId);
    const matches = entries.filter((entry) =>
      entry.id === entryId && entry.name === packageName && entry.disabled === false);
    if (matches.length !== 1) {
      fail(`plugin #${item.catalogId} authority-bound functional entry probe failed`);
    }
    expected[item.package.name] = item.package.version;
    accepted.push({
      catalogId: item.catalogId,
      entryId,
      packageName: item.package.name,
      version: item.package.version,
    });
  }
  const expectedInventory = stable(expected);
  if (JSON.stringify(installed) !== JSON.stringify(expectedInventory)) {
    fail('post-install plugin inventory does not match the authority-bound batch');
  }
  if (JSON.stringify(restarted) !== JSON.stringify(expectedInventory)) {
    fail('post-restart plugin inventory does not match the authority-bound batch');
  }
  return {
    schemaVersion: 1,
    accepted,
    dumpConfigVerified: true,
    inventoryVerifiedBeforeAndAfterRestart: true,
    unauthenticatedRootStatus: 401,
  };
}

function probePluginInventory(harness, childEnv) {
  const invocation = buildDshInvocation(harness.builtCli, [
    'plugin', '--profile', 'web', 'list', '--json',
  ]);
  const result = runInvocation(invocation, {
    cwd: harness.source,
    childEnv,
    capture: true,
  });
  if (result.error || result.code !== 0) fail('cold web-profile inventory probe failed');
  return parsePluginInventory(result.stdout);
}

function probeDumpConfig(harness, childEnv) {
  const invocation = buildDshInvocation(harness.builtCli, [
    '--profile', 'web', '--dump-config',
  ]);
  const result = runInvocation(invocation, {
    cwd: harness.source,
    childEnv,
    capture: true,
  });
  if (result.error || result.code !== 0 || result.stderr.trim() !== '') {
    fail('authority-bound dump-config probe failed');
  }
  return result.stdout;
}

async function requireColdWebPort() {
  const server = createServer();
  server.unref();
  try {
    await new Promise((resolveListen, rejectListen) => {
      const onError = () => rejectListen(new Error('loopback port is already in use'));
      server.once('error', onError);
      server.listen({ host: '127.0.0.1', port: 3080, exclusive: true }, () => {
        server.off('error', onError);
        resolveListen();
      });
    });
  } catch {
    fail('cold Web probe requires loopback port 3080 to be unused');
  } finally {
    if (server.listening) {
      await new Promise((resolveClose) => server.close(resolveClose));
    }
  }
}

async function probeColdWebStart(harness, childEnv) {
  await requireColdWebPort();
  const child = spawn(process.execPath, [harness.builtCli, 'web', '--no-open'], {
    cwd: harness.source,
    env: childEnv,
    stdio: 'ignore',
    shell: false,
  });
  let spawnError = null;
  child.once('error', (error) => {
    spawnError = error;
  });
  const exited = once(child, 'exit').catch(() => null);
  let ready = false;
  try {
    await delay(250);
    if (spawnError || child.exitCode !== null || child.signalCode !== null) {
      fail('cold Web probe exited before BrowserAuth became ready');
    }
    for (let attempt = 0; attempt < 30; attempt += 1) {
      try {
        const response = await fetch('http://127.0.0.1:3080/', {
          redirect: 'manual',
          signal: AbortSignal.timeout(250),
        });
        await response.body?.cancel();
        if (response.status === 401) {
          if (child.exitCode !== null || child.signalCode !== null) {
            fail('cold Web probe exited while BrowserAuth was being checked');
          }
          ready = true;
          break;
        }
      } catch {
        // The private loopback server may still be starting. Never capture its token-bearing output.
      }
      if (spawnError || child.exitCode !== null || child.signalCode !== null) break;
      await delay(200);
    }
    if (!ready) fail('cold Web probe did not expose the expected unauthenticated 401 boundary');
  } finally {
    if (child.exitCode === null && child.signalCode === null && !child.killed) child.kill();
    await Promise.race([exited, delay(2_000)]);
    if (child.exitCode === null && child.signalCode === null) {
      child.kill('SIGKILL');
      await Promise.race([exited, delay(2_000)]);
    }
    if (child.exitCode === null && child.signalCode === null) {
      fail('cold Web probe process could not be terminated');
    }
  }
  return true;
}

async function writePrivateBytes(path, bytes) {
  const writePath = process.platform === 'win32'
    ? `${path}.dsh-plugin-installer-${randomBytes(16).toString('hex')}.tmp`
    : path;
  const handle = await open(writePath, 'wx', 0o600);
  let closed = false;
  let installed = false;
  let identity = null;
  try {
    if (process.platform === 'win32') {
      identity = windowsPrivateIdentityFromStat(await handle.stat({ bigint: true }), 'file');
      await secureWindowsPrivatePath(
        writePath,
        'file',
        'configure-open-writer',
        identity
      );
    }
    await handle.writeFile(bytes);
    await handle.sync();
    if (process.platform === 'win32') {
      const handleIdentity = windowsPrivateIdentityFromStat(
        await handle.stat({ bigint: true }),
        'file'
      );
      if (!sameWindowsIdentity(identity, handleIdentity)) {
        fail('private temporary file handle identity changed while it was written');
      }
      await assertWindowsPathIdentity(
        writePath,
        'file',
        identity,
        'private temporary file'
      );
    }
    await handle.close();
    closed = true;
    if (process.platform === 'win32') {
      await secureWindowsPrivatePath(writePath, 'file', 'verify', identity);
      await moveWindowsPathDurably(writePath, path);
      installed = true;
      await secureWindowsPrivatePath(path, 'file', 'verify', identity);
    } else {
      await syncDirectory(dirname(path));
      installed = true;
    }
  } catch (error) {
    if (!closed) await handle.close().catch(() => {});
    if (process.platform === 'win32' && installed) {
      await rm(path, { force: true }).catch(() => {});
    } else if (!installed) {
      await rm(writePath, { force: true }).catch(() => {});
      if (process.platform !== 'win32') {
        await syncDirectory(dirname(writePath)).catch(() => {});
      }
    }
    throw error;
  }
}

function samePrivateFileState(state, candidate) {
  return candidate.isFile() && !candidate.isSymbolicLink() &&
    candidate.dev === state.dev && candidate.ino === state.ino &&
    candidate.nlink === state.nlink && candidate.size === state.size &&
    candidate.mtimeMs === state.mtimeMs && candidate.ctimeMs === state.ctimeMs;
}

function samePrivateDirectoryState(state, candidate) {
  return candidate.isDirectory() && !candidate.isSymbolicLink() &&
    candidate.dev === state.dev && candidate.ino === state.ino &&
    candidate.mtimeMs === state.mtimeMs && candidate.ctimeMs === state.ctimeMs;
}

async function assertStillMissing(path, label) {
  try {
    await lstat(path);
    fail(`${label} appeared while its absence was checked`);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

async function readPrivateBytesBatch(specifications, { windowsDirectories = [] } = {}) {
  if (!Array.isArray(specifications) || specifications.length < 1 ||
      specifications.some((entry) => entry === null || typeof entry !== 'object' ||
        typeof entry.path !== 'string' || typeof entry.label !== 'string' ||
        typeof entry.allowMissing !== 'boolean') ||
      !Array.isArray(windowsDirectories) ||
      windowsDirectories.some((entry) => entry === null || typeof entry !== 'object' ||
        typeof entry.path !== 'string' || typeof entry.label !== 'string')) {
    fail('private read batch is malformed');
  }
  const flags = fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW ?? 0);
  const prepared = [];
  const resultBytes = [];
  try {
    for (const specification of specifications) {
      let handle;
      try {
        handle = await open(specification.path, flags);
      } catch (error) {
        if (specification.allowMissing && error.code === 'ENOENT') {
          await assertStillMissing(specification.path, specification.label);
          prepared.push({ ...specification, handle: null, stat: null });
          continue;
        }
        throw error;
      }
      try {
        const windows = process.platform === 'win32';
        const before = await lstat(specification.path, { bigint: windows });
        const stat = await handle.stat({ bigint: windows });
        if (!before.isFile() || before.isSymbolicLink() || !stat.isFile() ||
            before.dev !== stat.dev || before.ino !== stat.ino ||
            stat.nlink !== (windows ? 1n : 1) ||
            stat.size < (windows ? 2n : 2) ||
            stat.size > (windows ? 2n * 1024n * 1024n : 2 * 1024 * 1024)) {
          fail(`${specification.label} must be one bounded regular single-link file`);
        }
        if (process.platform !== 'win32' && (stat.mode & 0o077) !== 0) {
          fail(`${specification.label} must not be readable or writable by group or others`);
        }
        prepared.push({ ...specification, handle, stat });
      } catch (error) {
        await handle.close().catch(() => {});
        throw error;
      }
    }

    if (process.platform === 'win32') {
      const directoryStates = [];
      for (const directory of windowsDirectories) {
        const stat = await lstat(directory.path, { bigint: true });
        if (!stat.isDirectory() || stat.isSymbolicLink()) {
          fail(`${directory.label} must be a private real directory`);
        }
        directoryStates.push({ ...directory, stat });
      }
      const aclRequests = [
        ...directoryStates.map(({ path, stat }) => ({
          path,
          kind: 'directory',
          action: 'verify',
          expectedIdentity: windowsPrivateIdentityFromStat(stat, 'directory'),
        })),
        ...prepared
          .filter(({ handle }) => handle !== null)
          .map(({ path, stat }) => ({
            path,
            kind: 'file',
            action: 'verify',
            expectedIdentity: windowsPrivateIdentityFromStat(stat, 'file'),
          })),
      ];
      if (aclRequests.length > 0) await secureWindowsPrivatePaths(aclRequests);
      for (const directory of directoryStates) {
        const afterAcl = await lstat(directory.path, { bigint: true });
        if (!samePrivateDirectoryState(directory.stat, afterAcl)) {
          fail(`${directory.label} changed while its private ACL was verified`);
        }
      }
      for (const entry of prepared) {
        if (entry.handle === null) {
          await assertStillMissing(entry.path, entry.label);
          continue;
        }
        const afterAcl = await lstat(entry.path, { bigint: true });
        if (!samePrivateFileState(entry.stat, afterAcl)) {
          fail(`${entry.label} changed while its private ACL was verified`);
        }
      }
    }

    for (const entry of prepared) {
      if (entry.handle === null) {
        await assertStillMissing(entry.path, entry.label);
        resultBytes.push(null);
        continue;
      }
      const bytes = await entry.handle.readFile();
      resultBytes.push(bytes);
      const after = await entry.handle.stat({ bigint: process.platform === 'win32' });
      let afterPath;
      try {
        afterPath = await lstat(entry.path, { bigint: process.platform === 'win32' });
      } catch {
        fail(`${entry.label} changed while it was read`);
      }
      const final = await entry.handle.stat({ bigint: process.platform === 'win32' });
      if (!samePrivateFileState(entry.stat, afterPath) ||
          !samePrivateFileState(entry.stat, after) ||
          !samePrivateFileState(entry.stat, final) ||
          bytes.length !== Number(entry.stat.size)) {
        fail(`${entry.label} changed while it was read`);
      }
    }
    return resultBytes;
  } catch (error) {
    for (const bytes of resultBytes) bytes?.fill(0);
    throw error;
  } finally {
    await Promise.all(prepared.map(({ handle }) => handle?.close().catch(() => {})));
  }
}

async function readPrivateBytes(path, label, { allowMissing = false } = {}) {
  const [bytes] = await readPrivateBytesBatch([{ path, label, allowMissing }]);
  return bytes;
}

async function privateWrite(path, value) {
  const bytes = jsonBytes(value);
  await writePrivateBytes(path, bytes);
  return bytes;
}

export function assertPrivateRecoveryPlatform(platform = process.platform) {
  if (!['darwin', 'linux', 'win32'].includes(platform)) {
    fail(`private recovery authentication is unsupported on ${platform}`);
  }
}

async function ensureRecoveryTrustRoot(dshHome, {
  create = false,
  verifyWindows = true,
} = {}) {
  assertPrivateRecoveryPlatform();
  const trustRoot = join(dshHome, '.dsh-plugin-installer');
  let created = false;
  if (create) {
    try {
      await createPrivateDirectoryDurably(trustRoot);
      created = true;
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }
  }
  let rootStat;
  try {
    rootStat = await lstat(trustRoot);
  } catch (error) {
    if (error.code === 'ENOENT') fail('local recovery trust root is missing; only authenticated retained transactions can be recovered');
    throw error;
  }
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink() ||
      (process.platform !== 'win32' && (rootStat.mode & 0o077) !== 0)) {
    fail('local recovery trust root must be a private real directory');
  }
  const canonicalRoot = await realpath(trustRoot);
  if (canonicalRoot !== trustRoot) fail('local recovery trust root must not traverse symlinks');
  if (process.platform === 'win32' && (verifyWindows || (create && !created))) {
    await secureWindowsPrivatePath(canonicalRoot, 'directory', 'verify');
  }
  return canonicalRoot;
}

export async function loadRecoveryKey(dshHome, { create = false } = {}) {
  const canonicalRoot = await ensureRecoveryTrustRoot(dshHome, {
    create,
    verifyWindows: false,
  });
  const keyPath = join(canonicalRoot, 'hmac-sha256.key');
  if (create) {
    const keyBytes = randomBytes(32);
    try {
      await writePrivateBytes(keyPath, keyBytes);
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    } finally {
      keyBytes.fill(0);
    }
  }
  let stat;
  try {
    stat = await lstat(keyPath);
  } catch (error) {
    if (error.code === 'ENOENT') fail('local recovery trust key is missing; only authenticated retained transactions can be recovered');
    throw error;
  }
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size !== 32 ||
      (process.platform !== 'win32' && (stat.mode & 0o077) !== 0)) {
    fail('local recovery trust key must be one private 32-byte regular file');
  }
  const [key] = await readPrivateBytesBatch([
    { path: keyPath, label: 'local recovery trust key', allowMissing: false },
  ], {
    windowsDirectories: [
      { path: canonicalRoot, label: 'local recovery trust root' },
    ],
  });
  if (key.length !== 32) fail('local recovery trust key must be one private 32-byte regular file');
  return key;
}

function defaultProcessAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code !== 'ESRCH';
  }
}

async function defaultProcessIdentity(pid) {
  if (process.platform === 'linux') {
    try {
      const stat = await readFile(`/proc/${pid}/stat`, 'utf8');
      const close = stat.lastIndexOf(')');
      const fields = close >= 0 ? stat.slice(close + 1).trim().split(/\s+/u) : [];
      const startTicks = fields[19];
      return /^\d+$/u.test(startTicks ?? '') ? `linux-proc-start:${startTicks}` : null;
    } catch {
      return null;
    }
  }
  if (process.platform === 'darwin') {
    const result = spawnSync('/bin/ps', ['-o', 'lstart=', '-p', String(pid)], {
      encoding: 'utf8',
      shell: false,
      timeout: 5_000,
    });
    const started = result.status === 0 ? result.stdout.trim() : '';
    return started.length > 0 ? `darwin-ps-start:${started}` : null;
  }
  // Node exposes no handle-bound, cross-version Windows process creation time.
  // A live/reused PID therefore remains fail-closed on Windows.
  return null;
}

async function readTransactionLock(lockRoot) {
  const stat = await lstat(lockRoot);
  if (!stat.isDirectory() || stat.isSymbolicLink() ||
      (process.platform !== 'win32' && (stat.mode & 0o077) !== 0)) {
    fail('DSH_HOME transaction lock is not a private real directory');
  }
  if (process.platform === 'win32') {
    await secureWindowsPrivatePath(lockRoot, 'directory', 'verify');
  }
  const entries = await readdir(lockRoot);
  if (JSON.stringify(entries.sort()) !== JSON.stringify(['owner.json'])) {
    fail('DSH_HOME transaction lock is malformed; explicit manual recovery is required');
  }
  const ownerRecord = await readPrivateJson(lockRoot, 'owner.json', 'DSH_HOME transaction lock owner');
  const owner = ownerRecord.value;
  exactObjectKeys(
    owner,
    [
      'schemaVersion', 'lockId', 'pid', 'processIdentity', 'operation', 'transactionRoot',
      'recoverySourceTransactionRoot',
    ],
    'DSH_HOME transaction lock owner'
  );
  if (owner.schemaVersion !== 2 || !/^[a-f0-9]{64}$/u.test(owner.lockId ?? '') ||
      !Number.isSafeInteger(owner.pid) || owner.pid <= 0 ||
      (owner.processIdentity !== null &&
        (typeof owner.processIdentity !== 'string' || owner.processIdentity.length > 256)) ||
      !['install', 'remove', 'recover'].includes(owner.operation) ||
      typeof owner.transactionRoot !== 'string' || !isAbsolute(owner.transactionRoot) ||
      (owner.recoverySourceTransactionRoot !== null &&
        (typeof owner.recoverySourceTransactionRoot !== 'string' ||
          !isAbsolute(owner.recoverySourceTransactionRoot)))) {
    fail('DSH_HOME transaction lock owner is malformed; explicit manual recovery is required');
  }
  return owner;
}

function validateInProgressHolder(holder, sourceRoot, action) {
  exactObjectKeys(
    holder,
    ['schemaVersion', 'lockId', 'pid', 'processIdentity', 'operation', 'transactionRoot'],
    'interrupted transaction lock holder'
  );
  if (holder.schemaVersion !== 1 || !/^[a-f0-9]{64}$/u.test(holder.lockId ?? '') ||
      !Number.isSafeInteger(holder.pid) || holder.pid <= 0 ||
      (holder.processIdentity !== null &&
        (typeof holder.processIdentity !== 'string' || holder.processIdentity.length > 256)) ||
      holder.operation !== action || !['install', 'remove'].includes(holder.operation) ||
      holder.transactionRoot !== sourceRoot) {
    fail('authenticated interrupted journal holder does not match its source transaction');
  }
  return holder;
}

function sameLockOwner(first, second) {
  return JSON.stringify(stable(first)) === JSON.stringify(stable(second));
}

function staleOwnerMatchesJournal(owner, holder) {
  return owner.lockId === holder.lockId && owner.pid === holder.pid &&
    owner.processIdentity === holder.processIdentity && owner.operation === holder.operation &&
    owner.transactionRoot === holder.transactionRoot && owner.recoverySourceTransactionRoot === null;
}

async function acquireTakeoverGuard(trustRoot, pid) {
  const guardRoot = join(trustRoot, 'transaction-takeover.guard');
  try {
    await createPrivateDirectoryDurably(guardRoot);
  } catch (error) {
    if (error.code === 'EEXIST') {
      fail('DSH_HOME transaction takeover guard exists; explicit manual inspection is required');
    }
    throw error;
  }
  const guardId = randomBytes(32).toString('hex');
  try {
    if (process.platform === 'win32') {
      await secureWindowsPrivatePath(guardRoot, 'directory', 'configure');
    }
    await privateWrite(join(guardRoot, 'owner.json'), {
      schemaVersion: 1,
      guardId,
      pid,
    });
    return Object.freeze({ guardRoot, guardId, pid });
  } catch (error) {
    await rm(guardRoot, { recursive: true, force: true }).catch(() => {});
    await syncDirectory(trustRoot).catch(() => {});
    throw error;
  }
}

async function releaseTakeoverGuard(guard) {
  const record = await readPrivateJson(
    guard.guardRoot,
    'owner.json',
    'DSH_HOME transaction takeover guard owner'
  );
  exactObjectKeys(record.value, ['schemaVersion', 'guardId', 'pid'], 'DSH_HOME transaction takeover guard owner');
  if (record.value.schemaVersion !== 1 || record.value.guardId !== guard.guardId ||
      record.value.pid !== guard.pid) {
    fail('DSH_HOME transaction takeover guard ownership changed before release');
  }
  const parent = dirname(guard.guardRoot);
  await rm(guard.guardRoot, { recursive: true, force: false });
  await syncDirectory(parent);
}

export async function acquireTransactionLock(dshHomeInput, transactionRootInput, {
  operation,
  recoverySourceTransactionRoot = null,
  expectedRecoveryHolder = null,
  pid = process.pid,
  processAlive = defaultProcessAlive,
  processIdentity = defaultProcessIdentity,
} = {}) {
  if (!['install', 'remove', 'recover'].includes(operation) ||
      !Number.isSafeInteger(pid) || pid <= 0 || typeof processAlive !== 'function' ||
      typeof processIdentity !== 'function' ||
      (expectedRecoveryHolder !== null &&
        (operation !== 'recover' || typeof expectedRecoveryHolder !== 'object' ||
          Array.isArray(expectedRecoveryHolder)))) {
    fail('DSH_HOME transaction lock request is malformed');
  }
  const dshHome = await canonicalDirectory(dshHomeInput, 'DSH_HOME');
  const transactionRoot = await canonicalDirectory(transactionRootInput, 'transaction root');
  const recoverySource = recoverySourceTransactionRoot === null
    ? null
    : await canonicalDirectory(recoverySourceTransactionRoot, 'recovery source transaction root');
  if ((operation === 'recover') !== (recoverySource !== null)) {
    fail('only explicit recovery may name a recovery source transaction root');
  }
  const trustRoot = await ensureRecoveryTrustRoot(dshHome, { create: true });
  const guard = await acquireTakeoverGuard(trustRoot, pid);
  const lockRoot = join(trustRoot, 'transaction.lock');
  let created = false;
  let quarantine = null;
  let takeoverOwner = null;
  let retainTakeoverGuard = false;
  try {
    try {
      await createPrivateDirectoryDurably(lockRoot);
      created = true;
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }
    if (!created) {
      if (operation !== 'recover') {
        fail('another DSH_HOME transaction is locked; a crashed lock requires explicit recovery');
      }
      const owner = await readTransactionLock(lockRoot);
      const sourceMatches = owner.transactionRoot === recoverySource ||
        owner.recoverySourceTransactionRoot === recoverySource;
      if (!sourceMatches) {
        fail('crashed DSH_HOME transaction lock does not match the explicit recovery source');
      }
      if (expectedRecoveryHolder !== null && !staleOwnerMatchesJournal(owner, expectedRecoveryHolder)) {
        fail('stale DSH_HOME transaction lock does not exactly match the authenticated interrupted journal holder');
      }
      const alive = await processAlive(owner.pid);
      if (typeof alive !== 'boolean') fail('DSH_HOME transaction holder liveness check is malformed');
      if (alive) {
        const observedIdentity = await processIdentity(owner.pid);
        if (owner.processIdentity === null || observedIdentity === null ||
            owner.processIdentity === observedIdentity) {
          fail('DSH_HOME transaction lock holder is still active; recovery cannot take it over');
        }
      }
      // Every acquire holds the fixed guard, so this rename is the only stale
      // takeover transition. No caller ever recursively deletes transaction.lock.
      quarantine = join(trustRoot, `transaction.lock.quarantine-${owner.lockId}`);
      try {
        await lstat(quarantine);
        fail('stale transaction lock quarantine already exists; manual inspection is required');
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
      const confirmedOwner = await readTransactionLock(lockRoot);
      if (!sameLockOwner(confirmedOwner, owner)) {
        fail('stale DSH_HOME transaction lock changed during guarded takeover validation');
      }
      await movePathDurably(lockRoot, quarantine);
      const quarantinedOwner = await readTransactionLock(quarantine);
      if (!sameLockOwner(quarantinedOwner, owner)) {
        fail('atomic stale-lock quarantine did not capture the validated lock owner');
      }
      takeoverOwner = owner;
      await createPrivateDirectoryDurably(lockRoot);
      created = true;
    } else if (expectedRecoveryHolder !== null) {
      fail('interrupted recovery requires the matching stale DSH_HOME transaction lock');
    }

    const lockId = randomBytes(32).toString('hex');
    const holderIdentity = await processIdentity(pid);
    if (process.platform === 'win32') {
      await secureWindowsPrivatePath(lockRoot, 'directory', 'configure');
    }
    await privateWrite(join(lockRoot, 'owner.json'), {
      schemaVersion: 2,
      lockId,
      pid,
      processIdentity: holderIdentity,
      operation,
      transactionRoot,
      recoverySourceTransactionRoot: recoverySource,
    });
    return Object.freeze({
      lockRoot,
      lockId,
      pid,
      processIdentity: holderIdentity,
      takeoverOwner: takeoverOwner === null ? null : Object.freeze({ ...takeoverOwner }),
    });
  } catch (error) {
    if (created) {
      const current = await readTransactionLock(lockRoot).catch(() => null);
      if (current === null || current.pid === pid) {
        await rm(lockRoot, { recursive: true, force: true }).catch(() => {});
      }
    }
    if (quarantine !== null) {
      let lockMissing = false;
      try {
        await lstat(lockRoot);
      } catch (missing) {
        if (missing.code === 'ENOENT') {
          lockMissing = true;
        } else {
          retainTakeoverGuard = true;
          throw new AggregateError(
            [error, missing],
            `${error.message}; stale-lock quarantine state could not be inspected and the takeover guard was retained`
          );
        }
      }
      if (lockMissing) {
        try {
          await movePathDurably(quarantine, lockRoot);
        } catch (restoreError) {
          retainTakeoverGuard = true;
          throw new AggregateError(
            [error, restoreError],
            `${error.message}; stale lock could not be restored from quarantine and the takeover guard was retained`
          );
        }
      }
    }
    await syncDirectory(trustRoot).catch(() => {});
    throw error;
  } finally {
    if (!retainTakeoverGuard) await releaseTakeoverGuard(guard);
  }
}

export async function releaseTransactionLock(lock) {
  if (lock === null || typeof lock !== 'object' ||
      typeof lock.lockRoot !== 'string' || !isAbsolute(lock.lockRoot) ||
      !/^[a-f0-9]{64}$/u.test(lock.lockId ?? '') ||
      !Number.isSafeInteger(lock.pid) || lock.pid <= 0) {
    fail('DSH_HOME transaction lock release is malformed');
  }
  const owner = await readTransactionLock(lock.lockRoot);
  if (owner.lockId !== lock.lockId || owner.pid !== lock.pid) {
    fail('DSH_HOME transaction lock ownership changed before release');
  }
  await rm(lock.lockRoot, { recursive: true, force: false });
  await syncDirectory(dirname(lock.lockRoot));
}

export async function validateInterruptedRecoveryLock(dshHomeInput, source, {
  processAlive = defaultProcessAlive,
  processIdentity = defaultProcessIdentity,
} = {}) {
  if (source?.kind !== 'interrupted' || typeof processAlive !== 'function' ||
      typeof processIdentity !== 'function') {
    fail('interrupted recovery lock validation requires one authenticated interrupted source');
  }
  const dshHome = await canonicalDirectory(dshHomeInput, 'DSH_HOME');
  const trustRoot = await ensureRecoveryTrustRoot(dshHome);
  const owner = await readTransactionLock(join(trustRoot, 'transaction.lock'));
  if (!staleOwnerMatchesJournal(owner, source.holder)) {
    fail('stale DSH_HOME transaction lock does not exactly match the authenticated interrupted journal holder');
  }
  const alive = await processAlive(owner.pid);
  if (typeof alive !== 'boolean') fail('DSH_HOME transaction holder liveness check is malformed');
  if (alive) {
    const observedIdentity = await processIdentity(owner.pid);
    if (owner.processIdentity === null || observedIdentity === null ||
        owner.processIdentity === observedIdentity) {
      fail('DSH_HOME transaction lock holder is still active; interrupted recovery requires a stale owner');
    }
  }
  return { stale: true, ownerMatchesAuthenticatedJournal: true };
}

const PRIVATE_BINDING_PATTERN = /^hmac256:v1:[A-Za-z0-9_-]{43}$/u;

function validateRecoveryMaterial(recoveryKey, transactionNonce) {
  if (!Buffer.isBuffer(recoveryKey) || recoveryKey.length !== 32) {
    fail('recovery authentication requires the private 32-byte local trust key');
  }
  if (!Buffer.isBuffer(transactionNonce) || transactionNonce.length !== 32) {
    fail('recovery authentication requires one private 32-byte transaction nonce');
  }
}

export function buildPrivateRecoveryBinding(bytes, recoveryKey, transactionNonce, purpose) {
  validateRecoveryMaterial(recoveryKey, transactionNonce);
  if (!Buffer.isBuffer(bytes) || ![
    'rollback-baseline',
    'snapshot-manifest',
    'terminal-closure',
    'terminal-inventory',
    'terminal-managed-files',
  ].includes(purpose)) {
    fail('private recovery binding input is malformed');
  }
  const digest = createHmac('sha256', recoveryKey)
    .update('dsh-plugin-installer/private-artifact-binding/v1\0', 'utf8')
    .update(transactionNonce)
    .update('\0', 'utf8')
    .update(purpose, 'utf8')
    .update('\0', 'utf8')
    .update(String(bytes.length), 'utf8')
    .update('\0', 'utf8')
    .update(bytes)
    .digest('base64url');
  return `hmac256:v1:${digest}`;
}

function privateBindingMatches(actual, bytes, recoveryKey, transactionNonce, purpose) {
  if (!PRIVATE_BINDING_PATTERN.test(actual ?? '')) return false;
  const expected = buildPrivateRecoveryBinding(bytes, recoveryKey, transactionNonce, purpose);
  return timingSafeEqual(Buffer.from(actual, 'utf8'), Buffer.from(expected, 'utf8'));
}

export function buildRecoveryAuthentication(state, recoveryKey, transactionNonce) {
  validateRecoveryMaterial(recoveryKey, transactionNonce);
  const terminal = state?.status === 'committed' || state?.status === 'removed';
  const inProgress = state?.status === 'in-progress';
  if (!/^[a-f0-9]{32}$/u.test(state?.transactionId ?? '') ||
      !PRIVATE_BINDING_PATTERN.test(state?.rollbackBaselineBinding ?? '') ||
      !PRIVATE_BINDING_PATTERN.test(state?.snapshotManifestBinding ?? '') ||
      (!terminal && !inProgress) ||
      (terminal && (!PRIVATE_BINDING_PATTERN.test(state?.terminalClosureBinding ?? '') ||
        !PRIVATE_BINDING_PATTERN.test(state?.terminalInventoryBinding ?? '') ||
        !PRIVATE_BINDING_PATTERN.test(state?.terminalManagedFilesBinding ?? ''))) ||
      (inProgress && (state.holder === null || typeof state.holder !== 'object'))) {
    fail('recovery state lacks opaque private-artifact bindings');
  }
  const payload = {
    schemaVersion: 2,
    transactionId: state.transactionId,
    status: state.status,
    planSha256: state.planSha256,
    stateSha256: sha256(jsonBytes(state)),
    rollbackBaselineBinding: state.rollbackBaselineBinding,
    snapshotManifestBinding: state.snapshotManifestBinding,
    terminalClosureBinding: terminal ? state.terminalClosureBinding : null,
    terminalInventoryBinding: terminal ? state.terminalInventoryBinding : null,
    terminalManagedFilesBinding: terminal ? state.terminalManagedFilesBinding : null,
  };
  const payloadBytes = Buffer.from(`${JSON.stringify(stable(payload))}\n`, 'utf8');
  return {
    schemaVersion: 2,
    algorithm: 'hmac-sha256-private-nonce-v1',
    transactionNonce: transactionNonce.toString('base64url'),
    payload,
    mac: createHmac('sha256', recoveryKey)
      .update('dsh-plugin-installer/recovery-authentication/v2\0', 'utf8')
      .update(transactionNonce)
      .update('\0', 'utf8')
      .update(payloadBytes)
      .digest('hex'),
  };
}

async function buildManagedFilesBinding(dshHome, profile, recoveryKey, transactionNonce, {
  requireValidProfile = true,
} = {}) {
  const bytes = await captureManagedFileBindingInput(dshHome, profile, { requireValidProfile });
  try {
    return buildPrivateRecoveryBinding(
      bytes,
      recoveryKey,
      transactionNonce,
      'terminal-managed-files'
    );
  } finally {
    bytes.fill(0);
  }
}

export async function verifyTerminalManagedFilesBinding(
  source,
  dshHome,
  profile,
  recoveryKey
) {
  if (source?.kind !== 'terminal' ||
      !PRIVATE_BINDING_PATTERN.test(source?.state?.terminalManagedFilesBinding ?? '')) {
    fail('terminal managed-file verification requires an authenticated terminal source');
  }
  const actual = await buildManagedFilesBinding(
    dshHome,
    profile,
    recoveryKey,
    source.transactionNonce
  );
  if (!timingSafeEqual(
    Buffer.from(actual, 'utf8'),
    Buffer.from(source.state.terminalManagedFilesBinding, 'utf8')
  )) {
    fail('current Profile or governed DSH_HOME files have drifted from the authenticated terminal state');
  }
  return true;
}

export async function verifyTerminalSnapshotManagedFilesBinding(
  source,
  snapshot,
  recoveryKey
) {
  if (source?.kind !== 'terminal' ||
      !PRIVATE_BINDING_PATTERN.test(source?.state?.terminalManagedFilesBinding ?? '')) {
    fail('terminal snapshot verification requires an authenticated terminal source');
  }
  const bytes = await captureSnapshotManagedFileBindingInput(snapshot);
  try {
    const actual = buildPrivateRecoveryBinding(
      bytes,
      recoveryKey,
      source.transactionNonce,
      'terminal-managed-files'
    );
    if (!timingSafeEqual(
      Buffer.from(actual, 'utf8'),
      Buffer.from(source.state.terminalManagedFilesBinding, 'utf8')
    )) {
      fail('new recovery snapshot does not match the authenticated terminal managed-file state');
    }
  } finally {
    bytes.fill(0);
  }
  return true;
}

function lockHolderRecord(lock, operation, transactionRoot) {
  return {
    schemaVersion: 1,
    lockId: lock.lockId,
    pid: lock.pid,
    processIdentity: lock.processIdentity,
    operation,
    transactionRoot,
  };
}

async function writeAuthenticatedInProgressState(
  transactionRoot,
  state,
  recoveryKey,
  transactionNonce
) {
  const authentication = buildRecoveryAuthentication(state, recoveryKey, transactionNonce);
  await privateWrite(join(transactionRoot, 'in-progress.json'), {
    schemaVersion: 1,
    state,
    authentication,
  });
}

async function writeAuthenticatedTerminalState(transactionRoot, state, recoveryKey, transactionNonce) {
  const authentication = buildRecoveryAuthentication(state, recoveryKey, transactionNonce);
  await privateWrite(join(transactionRoot, 'recovery-auth.json'), authentication);
  await privateWrite(join(transactionRoot, 'state.json'), state);
  await rm(join(transactionRoot, 'in-progress.json'), { force: true });
  await syncDirectory(transactionRoot);
}

function rollbackIsComplete(rollback) {
  if (rollback?.attempted !== true || rollback.filesRestored !== true) return false;
  if (rollback.baselineAvailable === false) {
    return rollback.dependencyClosureMutationStarted !== true && rollback.managedFilesVerified === 8;
  }
  return rollback.closureRestored === true && rollback.inventoryRestored === true &&
    rollback.coldStartProbePassed === true;
}

// The production CLI never accepts these operations as options. This small boundary keeps
// the install/accept/commit phase and the mandatory whole-snapshot rollback phase inseparable.
export async function runAtomicAcceptanceBoundary(operation, rollbackOperation) {
  if (typeof operation !== 'function' || typeof rollbackOperation !== 'function') {
    fail('atomic transaction boundary requires fixed internal operations');
  }
  try {
    return await operation();
  } catch (transactionError) {
    let rollback = {
      attempted: true,
      baselineAvailable: true,
      filesRestored: false,
      closureRestored: false,
      inventoryRestored: false,
      coldStartProbePassed: false,
    };
    try {
      rollback = { ...rollback, ...await rollbackOperation(transactionError) };
    } catch (rollbackError) {
      rollback.error = rollbackError.message;
    }
    fail(
      rollbackIsComplete(rollback)
        ? `${transactionError.message}; atomic rollback completed`
        : `${transactionError.message}; rollback is incomplete`,
      rollback
    );
  }
}

async function restoreAndVerifyManagedFiles({ dshHome, profile, snapshot }) {
  const rollback = {
    attempted: true,
    baselineAvailable: false,
    filesRestored: false,
    managedFilesVerified: 0,
  };
  try {
    await restoreProfileSnapshot(dshHome, profile, snapshot);
    const verified = await verifyProfileSnapshot(dshHome, profile, snapshot);
    rollback.filesRestored = verified.matches;
    rollback.managedFilesVerified = verified.matches ? verified.filesProtected : 0;
  } catch (error) {
    rollback.error = error.message;
  }
  return rollback;
}

async function runWithHeldTransactionLock(lock, operation, canReleaseAfterError) {
  try {
    const result = await operation();
    await releaseTransactionLock(lock);
    return result;
  } catch (error) {
    if (canReleaseAfterError(error)) {
      try {
        await releaseTransactionLock(lock);
      } catch (releaseError) {
        throw new AggregateError(
          [error, releaseError],
          `${error.message}; transaction rollback completed but the DSH_HOME lock could not be released`
        );
      }
    }
    throw error;
  }
}

export function canReleaseTransactionLockAfterError(lock, snapshotCreated, error) {
  const rollbackComplete = rollbackIsComplete(error?.details);
  if (lock?.takeoverOwner !== null) return rollbackComplete;
  return snapshotCreated !== true || rollbackComplete;
}

async function restoreAndVerifyBaseline({
  baselineClosure,
  baselineInventory,
  childEnv,
  dshHome,
  harness,
  profile,
  snapshot,
}) {
  const rollback = {
    attempted: true,
    baselineAvailable: true,
    filesRestored: false,
    closureRestored: false,
    inventoryRestored: false,
    coldStartProbePassed: false,
  };
  await restoreProfileSnapshot(dshHome, profile, snapshot);
  rollback.filesRestored = (await verifyProfileSnapshot(dshHome, profile, snapshot)).matches;
  verifyEffectivePnpmBuildPolicy(profile, [], false, { environment: childEnv });
  const invocation = buildDshInvocation(harness.builtCli, [
    'plugin', '--profile', 'web', 'install', '--frozen-lockfile',
    '--ignore-scripts', '--ignore-pnpmfile',
  ]);
  const result = runInvocation(invocation, { cwd: harness.source, childEnv });
  if (result.error || result.code !== 0) fail('frozen dependency closure restoration failed');
  rollback.closureRestored = (await verifyProfileClosure(profile, baselineClosure)).matches;
  const restoredInventory = probePluginInventory(harness, childEnv);
  rollback.inventoryRestored =
    JSON.stringify(restoredInventory) === JSON.stringify(baselineInventory);
  rollback.coldStartProbePassed = await probeColdWebStart(harness, childEnv);
  // DSH startup may create optional DSH_HOME state (for example an anonymous user id).
  // Restore once more after every probe so rollback ends at the exact pre-transaction bytes.
  await restoreProfileSnapshot(dshHome, profile, snapshot);
  rollback.filesRestored = (await verifyProfileSnapshot(dshHome, profile, snapshot)).matches;
  return rollback;
}

function validateTransactionAuthorityContext(authorityContext) {
  if (!Buffer.isBuffer(authorityContext?.authorityBytes) ||
      !Buffer.isBuffer(authorityContext?.harnessAuthorityBytes) ||
      !Buffer.isBuffer(authorityContext?.top10ReleaseSetBytes) ||
      !Buffer.isBuffer(authorityContext?.migrationMapBytes) ||
      !Buffer.isBuffer(authorityContext?.migrationMapSchemaBytes) ||
      !Buffer.isBuffer(authorityContext?.candidateIntakeBytes) ||
      sha256(authorityContext.authorityBytes) !== authorityContext.authoritySha256 ||
      sha256(authorityContext.top10ReleaseSetBytes) !== authorityContext.top10ReleaseSetSha256 ||
      JSON.stringify(JSON.parse(authorityContext.authorityBytes)) !== JSON.stringify(authorityContext.authority)) {
    fail('transaction authority context is not bound to its exact authority bytes');
  }
  const validationOptions = {
    harnessAuthorityBytes: authorityContext.harnessAuthorityBytes,
    top10ReleaseSetBytes: authorityContext.top10ReleaseSetBytes,
    migrationMapBytes: authorityContext.migrationMapBytes,
    migrationMapSchemaBytes: authorityContext.migrationMapSchemaBytes,
    candidateIntakeBytes: authorityContext.candidateIntakeBytes,
  };
  const authority = validateAuthority(authorityContext.authority, validationOptions);
  if (JSON.stringify(JSON.parse(authorityContext.top10ReleaseSetBytes)) !==
      JSON.stringify(authorityContext.top10ReleaseSet)) {
    fail('transaction Top10 context is not bound to its exact release-set bytes');
  }
  return { authority, validationOptions };
}

export async function executeTransaction(options) {
  const allowedOptions = [
    'authorityContext', 'consentSha256', 'dshHome', 'harnessReceipt', 'harnessSource',
    'ids', 'preparedRoot', 'top10', 'transactionRoot',
  ];
  if (JSON.stringify(Object.keys(options ?? {}).sort()) !== JSON.stringify([...allowedOptions].sort())) {
    fail('transaction options must not contain injected runners, items, plans, or Harness gate bypasses');
  }
  const {
    authorityContext,
    ids,
    top10,
    consentSha256,
    dshHome: dshHomeInput,
    harnessSource,
    harnessReceipt,
    preparedRoot: preparedRootInput,
    transactionRoot: transactionRootInput,
  } = options;
  const { authority, validationOptions } = validateTransactionAuthorityContext(authorityContext);
  const { items, plan, planSha256 } = buildPlan(authority, ids, {
    top10,
    top10ReleaseSet: authorityContext.top10ReleaseSet,
    validationOptions,
  });
  if (!/^[a-f0-9]{64}$/.test(consentSha256 ?? '') || consentSha256 !== planSha256) {
    fail('explicit consent is not bound to this exact transaction plan digest');
  }
  assertPrivateRecoveryPlatform();
  const dshHome = await canonicalDirectory(dshHomeInput, 'DSH_HOME');
  const profile = await canonicalDirectory(join(dshHome, 'profiles/web'), 'web profile');
  await validateProfileResolutionSurface(profile);
  const preparedRoot = await canonicalDirectory(preparedRootInput, 'prepared root');
  const harness = await verifyHarnessGate(harnessSource, harnessReceipt, authority);
  if (!isAbsolute(harness.builtCli)) fail('built CLI must be absolute');
  const prepared = [];
  for (const item of items) {
    prepared.push(await validatePrepared(join(preparedRoot, String(item.catalogId)), item));
  }
  await requireColdWebPort();
  const transactionRoot = await newTransactionRoot(transactionRootInput, [dshHome, profile, preparedRoot, harness.source]);
  const childEnv = await createChildRuntimeEnvironment(transactionRoot, dshHome, profile);
  verifyPnpm(childEnv);
  const stagedPrepared = await stagePreparedForTransaction(transactionRoot, preparedRoot, items);
  const snapshot = join(transactionRoot, 'snapshot');
  const lock = await acquireTransactionLock(dshHome, transactionRoot, { operation: 'install' });
  let snapshotCreated = false;
  return runWithHeldTransactionLock(lock, async () => {
    await createProfileSnapshot(dshHome, profile, snapshot);
    snapshotCreated = true;
    let baselineClosure;
    let baselineInventory;
    let completeBaseline = false;
    return runAtomicAcceptanceBoundary(async () => {
      const snapshotManifestBytes = await readFile(join(snapshot, 'snapshot.json'));
      await validateProfileResolutionSurface(profile);
      baselineClosure = await captureProfileClosure(profile);
      baselineInventory = probePluginInventory(harness, childEnv);
      const baselinePnpmLockSource = await readFile(join(profile, 'pnpm-lock.yaml'), 'utf8');
      completeBaseline = true;
      await privateWrite(join(transactionRoot, 'plan.json'), {
        schemaVersion: 1,
        planSha256,
        catalogIds: items.map((item) => item.catalogId),
        plan,
      });
      const rollbackBaselineBytes = await privateWrite(join(transactionRoot, 'rollback-baseline.json'), {
        schemaVersion: 1,
        closure: baselineClosure,
        inventory: baselineInventory,
      });
      const recoveryKey = await loadRecoveryKey(dshHome, { create: true });
      const transactionNonce = randomBytes(32);
      const transactionId = randomBytes(16).toString('hex');
      const rollbackBaselineBinding = buildPrivateRecoveryBinding(
        rollbackBaselineBytes,
        recoveryKey,
        transactionNonce,
        'rollback-baseline'
      );
      const snapshotManifestBinding = buildPrivateRecoveryBinding(
        snapshotManifestBytes,
        recoveryKey,
        transactionNonce,
        'snapshot-manifest'
      );
      const inProgressState = {
        schemaVersion: 2,
        transactionId,
        status: 'in-progress',
        action: 'install',
        planSha256,
        catalogIds: items.map((item) => item.catalogId),
        atomic: items.length > 1,
        rollbackBaselineBinding,
        snapshotManifestBinding,
        holder: lockHolderRecord(lock, 'install', transactionRoot),
      };
      await writeAuthenticatedInProgressState(
        transactionRoot,
        inProgressState,
        recoveryKey,
        transactionNonce
      );
      // Resolve the exact pnpm depPaths without materializing packages or
      // executing any lifecycle script. Source-like tarball and Git keys are
      // path/commit-qualified and cannot safely be guessed from name/version.
      // Invoke the certified Node plus private pnpm.cjs closure directly. The
      // Harness Windows `dsh plugin` forwarding uses cmd.exe and cannot
      // preserve an absolute artifact path containing spaces as one literal.
      const installSpecs = stagedPrepared.map((entry) => entry.installSpec);
      for (let index = 0; index < items.length; index += 1) {
        const invocation = buildBoundPnpmResolutionInvocation(childEnv, [
          'add', '--save-exact', '--ignore-scripts', '--lockfile-only',
          '--ignore-pnpmfile', '--', installSpecs[index],
        ], { expectedInstallSpec: installSpecs[index] });
        const result = runInvocation(invocation, { cwd: profile, childEnv });
        if (result.error || result.code !== 0) {
          fail(`plugin #${items[index].catalogId} dependency resolution failed`);
        }
      }
      await authorizePrepare(profile, items, {
        baselineLockSource: baselinePnpmLockSource,
        environment: childEnv,
        installSpecs,
      });
      const resolvedLockBytes = await readFile(join(profile, 'pnpm-lock.yaml'));
      const materializeInvocation = buildDshInvocation(harness.builtCli, [
        'plugin', '--profile', 'web', 'install', '--frozen-lockfile',
        '--ignore-scripts', '--ignore-pnpmfile',
      ]);
      const materializeResult = runInvocation(materializeInvocation, {
        cwd: harness.source,
        childEnv,
      });
      if (materializeResult.error || materializeResult.code !== 0) {
        fail('frozen script-free plugin materialization failed');
      }
      const materializedLockBytes = await readFile(join(profile, 'pnpm-lock.yaml'));
      verifyFrozenLockfileBytes(resolvedLockBytes, materializedLockBytes);
      for (const item of items) await verifyInstalled(profile, item);
      const installedInventory = probePluginInventory(harness, childEnv);
      const dumpConfigOutput = probeDumpConfig(harness, childEnv);
      await probeColdWebStart(harness, childEnv);
      const restartedInventory = probePluginInventory(harness, childEnv);
      for (const item of items) await verifyInstalled(profile, item);
      const runtimeAcceptance = verifyRuntimeAcceptanceEvidence(items, {
        baselineInventory,
        dumpConfigOutput,
        installedInventory,
        restartedInventory,
      });
      const terminalClosure = await captureProfileClosure(profile);
      const terminalClosureBinding = buildPrivateRecoveryBinding(
        jsonBytes(stable(terminalClosure)),
        recoveryKey,
        transactionNonce,
        'terminal-closure'
      );
      const terminalInventoryBinding = buildPrivateRecoveryBinding(
        jsonBytes(stable(restartedInventory)),
        recoveryKey,
        transactionNonce,
        'terminal-inventory'
      );
      const terminalManagedFilesBinding = await buildManagedFilesBinding(
        dshHome,
        profile,
        recoveryKey,
        transactionNonce
      );
      const state = {
        schemaVersion: 2,
        transactionId,
        status: 'committed',
        planSha256,
        catalogIds: items.map((item) => item.catalogId),
        atomic: items.length > 1,
        coldRestartVerified: true,
        rollbackBaselineBinding,
        snapshotManifestBinding,
        terminalClosureBinding,
        terminalInventoryBinding,
        terminalManagedFilesBinding,
        runtimeAcceptance,
      };
      await writeAuthenticatedTerminalState(transactionRoot, state, recoveryKey, transactionNonce);
      return { state, transactionRoot, snapshot };
    }, () => completeBaseline
      ? restoreAndVerifyBaseline({
          baselineClosure,
          baselineInventory,
          childEnv,
          dshHome,
          harness,
          profile,
          snapshot,
        })
      : restoreAndVerifyManagedFiles({ dshHome, profile, snapshot }));
  }, (error) => canReleaseTransactionLockAfterError(lock, snapshotCreated, error));
}

export async function executeRemovalTransaction(options) {
  const allowedOptions = [
    'authorityContext', 'consentSha256', 'dshHome', 'harnessReceipt', 'harnessSource',
    'ids', 'top10', 'transactionRoot',
  ];
  if (JSON.stringify(Object.keys(options ?? {}).sort()) !== JSON.stringify([...allowedOptions].sort())) {
    fail('removal options must not contain injected runners, items, plans, or Harness gate bypasses');
  }
  const {
    authorityContext,
    ids,
    top10,
    consentSha256,
    dshHome: dshHomeInput,
    harnessSource,
    harnessReceipt,
    transactionRoot: transactionRootInput,
  } = options;
  const { authority, validationOptions } = validateTransactionAuthorityContext(authorityContext);
  const { items, plan, planSha256 } = buildRemovalPlan(authority, ids, {
    top10,
    top10ReleaseSet: authorityContext.top10ReleaseSet,
    validationOptions,
  });
  if (!/^[a-f0-9]{64}$/.test(consentSha256 ?? '') || consentSha256 !== planSha256) {
    fail('explicit consent is not bound to this exact removal plan digest');
  }
  assertPrivateRecoveryPlatform();
  const dshHome = await canonicalDirectory(dshHomeInput, 'DSH_HOME');
  const profile = await canonicalDirectory(join(dshHome, 'profiles/web'), 'web profile');
  await validateProfileResolutionSurface(profile);
  const harness = await verifyHarnessGate(harnessSource, harnessReceipt, authority);
  for (const item of items) await verifyInstalled(profile, item);
  await requireColdWebPort();
  const transactionRoot = await newTransactionRoot(transactionRootInput, [dshHome, profile, harness.source]);
  const childEnv = await createChildRuntimeEnvironment(transactionRoot, dshHome, profile);
  verifyPnpm(childEnv);
  const snapshot = join(transactionRoot, 'snapshot');
  const lock = await acquireTransactionLock(dshHome, transactionRoot, { operation: 'remove' });
  let snapshotCreated = false;
  return runWithHeldTransactionLock(lock, async () => {
    await createProfileSnapshot(dshHome, profile, snapshot);
    snapshotCreated = true;
    let baselineClosure;
    let baselineInventory;
    let completeBaseline = false;
    return runAtomicAcceptanceBoundary(async () => {
      const snapshotManifestBytes = await readFile(join(snapshot, 'snapshot.json'));
      await validateProfileResolutionSurface(profile);
      baselineClosure = await captureProfileClosure(profile);
      baselineInventory = probePluginInventory(harness, childEnv);
      completeBaseline = true;
      for (const item of items) {
        if (baselineInventory[item.package.name] !== item.package.version) {
          fail(`plugin #${item.catalogId} is not installed at its authority-bound version`);
        }
      }
      const expectedInventory = { ...baselineInventory };
      for (const item of items) delete expectedInventory[item.package.name];
      const normalizedExpectedInventory = stable(expectedInventory);
      await privateWrite(join(transactionRoot, 'plan.json'), {
        schemaVersion: 1,
        planSha256,
        catalogIds: items.map((item) => item.catalogId),
        plan,
      });
      const rollbackBaselineBytes = await privateWrite(join(transactionRoot, 'rollback-baseline.json'), {
        schemaVersion: 1,
        closure: baselineClosure,
        inventory: baselineInventory,
      });
      const recoveryKey = await loadRecoveryKey(dshHome, { create: true });
      const transactionNonce = randomBytes(32);
      const transactionId = randomBytes(16).toString('hex');
      const rollbackBaselineBinding = buildPrivateRecoveryBinding(
        rollbackBaselineBytes,
        recoveryKey,
        transactionNonce,
        'rollback-baseline'
      );
      const snapshotManifestBinding = buildPrivateRecoveryBinding(
        snapshotManifestBytes,
        recoveryKey,
        transactionNonce,
        'snapshot-manifest'
      );
      const inProgressState = {
        schemaVersion: 2,
        transactionId,
        status: 'in-progress',
        action: 'remove',
        planSha256,
        catalogIds: items.map((item) => item.catalogId),
        atomic: items.length > 1,
        rollbackBaselineBinding,
        snapshotManifestBinding,
        holder: lockHolderRecord(lock, 'remove', transactionRoot),
      };
      await writeAuthenticatedInProgressState(
        transactionRoot,
        inProgressState,
        recoveryKey,
        transactionNonce
      );
      await revokePrepare(profile, items, { environment: childEnv });
      for (const item of [...items].reverse()) {
        const invocation = buildDshInvocation(harness.builtCli, [
          'plugin', '--profile', 'web', 'remove', '--lockfile-only', '--',
          item.rollback.removePackageName,
        ]);
        const result = runInvocation(invocation, { cwd: harness.source, childEnv });
        if (result.error || result.code !== 0) fail(`plugin #${item.catalogId} removal failed`);
      }
      const resolvedRemovalLockBytes = await readFile(join(profile, 'pnpm-lock.yaml'));
      const materializeInvocation = buildDshInvocation(harness.builtCli, [
        'plugin', '--profile', 'web', 'install', '--frozen-lockfile',
        '--ignore-scripts', '--ignore-pnpmfile',
      ]);
      const materializeResult = runInvocation(materializeInvocation, {
        cwd: harness.source,
        childEnv,
      });
      if (materializeResult.error || materializeResult.code !== 0) {
        fail('frozen script-free removal materialization failed');
      }
      const materializedLockBytes = await readFile(join(profile, 'pnpm-lock.yaml'));
      verifyFrozenLockfileBytes(resolvedRemovalLockBytes, materializedLockBytes);
      await cleanupInstallerOwnedAllowBuilds(profile);
      for (const item of items) await verifyRemoved(profile, item);
      const removedInventory = probePluginInventory(harness, childEnv);
      if (JSON.stringify(removedInventory) !== JSON.stringify(normalizedExpectedInventory)) {
        fail('post-remove plugin inventory does not match the authority-bound removal plan');
      }
      await probeColdWebStart(harness, childEnv);
      const restartedInventory = probePluginInventory(harness, childEnv);
      if (JSON.stringify(restartedInventory) !== JSON.stringify(normalizedExpectedInventory)) {
        fail('post-restart plugin inventory does not match the authority-bound removal plan');
      }
      for (const item of items) await verifyRemoved(profile, item);
      const terminalClosure = await captureProfileClosure(profile);
      const terminalClosureBinding = buildPrivateRecoveryBinding(
        jsonBytes(stable(terminalClosure)),
        recoveryKey,
        transactionNonce,
        'terminal-closure'
      );
      const terminalInventoryBinding = buildPrivateRecoveryBinding(
        jsonBytes(stable(restartedInventory)),
        recoveryKey,
        transactionNonce,
        'terminal-inventory'
      );
      const terminalManagedFilesBinding = await buildManagedFilesBinding(
        dshHome,
        profile,
        recoveryKey,
        transactionNonce
      );
      const state = {
        schemaVersion: 2,
        transactionId,
        status: 'removed',
        planSha256,
        catalogIds: items.map((item) => item.catalogId),
        atomic: items.length > 1,
        coldRestartVerified: true,
        rollbackBaselineBinding,
        snapshotManifestBinding,
        terminalClosureBinding,
        terminalInventoryBinding,
        terminalManagedFilesBinding,
        removalVerified: true,
      };
      await writeAuthenticatedTerminalState(transactionRoot, state, recoveryKey, transactionNonce);
      return { state, transactionRoot, snapshot };
    }, () => completeBaseline
      ? restoreAndVerifyBaseline({
          baselineClosure,
          baselineInventory,
          childEnv,
          dshHome,
          harness,
          profile,
          snapshot,
        })
      : restoreAndVerifyManagedFiles({ dshHome, profile, snapshot }));
  }, (error) => canReleaseTransactionLockAfterError(lock, snapshotCreated, error));
}

async function readPrivateJson(root, name, label, { allowMissing = false } = {}) {
  const path = join(root, name);
  const bytes = await readPrivateBytes(path, label, { allowMissing });
  if (bytes === null) return null;
  return privateJsonRecord(path, bytes, label);
}

function privateJsonRecord(path, bytes, label) {
  try {
    return { path, bytes, value: JSON.parse(bytes) };
  } catch {
    bytes.fill(0);
    fail(`${label} is not valid JSON`);
  }
}

function validateClosureRecord(closure) {
  exactObjectKeys(
    closure,
    ['dependencies', 'bundles', 'lockfileSha256', 'installedPackages', 'closureSha256'],
    'recovery dependency closure'
  );
  if (closure.dependencies === null || typeof closure.dependencies !== 'object' ||
      Array.isArray(closure.dependencies) ||
      Object.entries(closure.dependencies).some(([name, version]) =>
        !/^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/u.test(name) ||
        typeof version !== 'string' || version.length === 0 || version.length > 512) ||
      !Array.isArray(closure.bundles) || closure.bundles.some((name) => typeof name !== 'string') ||
      !Array.isArray(closure.installedPackages) ||
      closure.installedPackages.some((entry) => typeof entry !== 'string' || entry.length > 512) ||
      !/^[a-f0-9]{64}$/u.test(closure.lockfileSha256 ?? '') ||
      !/^[a-f0-9]{64}$/u.test(closure.closureSha256 ?? '')) {
    fail('recovery dependency closure is malformed');
  }
  const state = {
    dependencies: stable(closure.dependencies),
    bundles: closure.bundles,
    lockfileSha256: closure.lockfileSha256,
    installedPackages: closure.installedPackages,
  };
  const expected = sha256(Buffer.from(`${JSON.stringify(stable(state))}\n`, 'utf8'));
  if (expected !== closure.closureSha256) fail('recovery dependency closure digest mismatch');
  return closure;
}

export async function loadRecoverySource(input, recoveryKey) {
  const root = await canonicalDirectory(input, 'source transaction root');
  const rootStat = await lstat(root);
  if (process.platform !== 'win32' && (rootStat.mode & 0o077) !== 0) {
    fail('source transaction root must not be accessible by group or others');
  }
  const snapshot = await canonicalDirectory(join(root, 'snapshot'), 'source transaction snapshot');
  const snapshotStat = await lstat(snapshot);
  if (process.platform !== 'win32' && (snapshotStat.mode & 0o077) !== 0) {
    fail('source transaction snapshot must not be accessible by group or others');
  }

  const statePath = join(root, 'state.json');
  let terminalMarkerPresent;
  try {
    await lstat(statePath);
    terminalMarkerPresent = true;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    terminalMarkerPresent = false;
  }
  const specifications = [
    { path: join(root, 'plan.json'), label: 'source transaction plan', allowMissing: false },
    { path: join(root, 'rollback-baseline.json'), label: 'source rollback baseline', allowMissing: false },
    { path: join(snapshot, 'snapshot.json'), label: 'source snapshot manifest', allowMissing: false },
    terminalMarkerPresent
      ? { path: statePath, label: 'source transaction state', allowMissing: false }
      : { path: statePath, label: 'source transaction state', allowMissing: true },
    terminalMarkerPresent
      ? {
          path: join(root, 'recovery-auth.json'),
          label: 'source recovery authentication',
          allowMissing: false,
        }
      : {
          path: join(root, 'in-progress.json'),
          label: 'source authenticated interrupted journal',
          allowMissing: false,
        },
  ];
  const records = await readPrivateBytesBatch(specifications, {
    windowsDirectories: [
      { path: root, label: 'source transaction root' },
      { path: snapshot, label: 'source transaction snapshot' },
    ],
  });
  const planRecord = privateJsonRecord(specifications[0].path, records[0], specifications[0].label);
  const baselineRecord = privateJsonRecord(specifications[1].path, records[1], specifications[1].label);
  const snapshotManifest = privateJsonRecord(
    specifications[2].path,
    records[2],
    specifications[2].label
  );
  exactObjectKeys(planRecord.value, ['schemaVersion', 'planSha256', 'catalogIds', 'plan'], 'source transaction plan');
  exactObjectKeys(baselineRecord.value, ['schemaVersion', 'closure', 'inventory'], 'source rollback baseline');
  const { planSha256, catalogIds, plan } = planRecord.value;
  if (planRecord.value.schemaVersion !== 1 || baselineRecord.value.schemaVersion !== 1 ||
      !/^[a-f0-9]{64}$/u.test(planSha256 ?? '') ||
      !Array.isArray(catalogIds) || catalogIds.length === 0 ||
      catalogIds.some((id) => !Number.isInteger(id) || id < 3000 || id > 3999) ||
      !['install', 'remove'].includes(plan?.action) ||
      JSON.stringify(plan.plugins?.map((plugin) => plugin.catalogId)) !== JSON.stringify(catalogIds)) {
    fail('source transaction plan or rollback baseline is malformed');
  }
  const canonicalPlanSha256 = sha256(Buffer.from(`${JSON.stringify(stable(plan))}\n`, 'utf8'));
  if (canonicalPlanSha256 !== planSha256) fail('source transaction plan digest or action mismatch');

  // state.json is the durable terminal marker. If it exists, recovery never
  // opens in-progress.json, so a completed install/removal cannot replay its
  // earlier rollback journal even if a stale copy was left behind.
  const stateRecord = records[3] === null
    ? null
    : privateJsonRecord(specifications[3].path, records[3], specifications[3].label);
  let kind;
  let state;
  let authenticationRecord;
  let holder = null;
  if (stateRecord !== null) {
    kind = 'terminal';
    state = stateRecord.value;
    authenticationRecord = privateJsonRecord(
      specifications[4].path,
      records[4],
      specifications[4].label
    );
    const status = state?.status;
    const stateKeys = status === 'committed'
      ? ['schemaVersion', 'transactionId', 'status', 'planSha256', 'catalogIds', 'atomic', 'coldRestartVerified',
          'rollbackBaselineBinding', 'snapshotManifestBinding', 'terminalClosureBinding',
          'terminalInventoryBinding', 'terminalManagedFilesBinding', 'runtimeAcceptance']
      : status === 'removed'
        ? ['schemaVersion', 'transactionId', 'status', 'planSha256', 'catalogIds', 'atomic', 'coldRestartVerified',
            'rollbackBaselineBinding', 'snapshotManifestBinding', 'terminalClosureBinding',
            'terminalInventoryBinding', 'terminalManagedFilesBinding', 'removalVerified']
        : [];
    exactObjectKeys(state, stateKeys, 'source transaction state');
    if (state.schemaVersion !== 2 || !/^[a-f0-9]{32}$/u.test(state.transactionId ?? '') ||
        JSON.stringify(state.catalogIds) !== JSON.stringify(catalogIds) ||
        state.planSha256 !== planSha256 || state.coldRestartVerified !== true ||
        state.atomic !== (catalogIds.length > 1) ||
        !PRIVATE_BINDING_PATTERN.test(state.rollbackBaselineBinding ?? '') ||
        !PRIVATE_BINDING_PATTERN.test(state.snapshotManifestBinding ?? '') ||
        !PRIVATE_BINDING_PATTERN.test(state.terminalClosureBinding ?? '') ||
        !PRIVATE_BINDING_PATTERN.test(state.terminalInventoryBinding ?? '') ||
        !PRIVATE_BINDING_PATTERN.test(state.terminalManagedFilesBinding ?? '') ||
        (status === 'removed' && state.removalVerified !== true) ||
        (status === 'committed' && plan.action !== 'install') ||
        (status === 'removed' && plan.action !== 'remove')) {
      fail('source transaction state does not match its plan');
    }
  } else {
    kind = 'interrupted';
    const journalRecord = privateJsonRecord(
      specifications[4].path,
      records[4],
      specifications[4].label
    );
    exactObjectKeys(
      journalRecord.value,
      ['schemaVersion', 'state', 'authentication'],
      'source authenticated interrupted journal'
    );
    if (journalRecord.value.schemaVersion !== 1) {
      fail('source authenticated interrupted journal schema is invalid');
    }
    state = journalRecord.value.state;
    authenticationRecord = { value: journalRecord.value.authentication };
    exactObjectKeys(
      state,
      [
        'schemaVersion', 'transactionId', 'status', 'action', 'planSha256', 'catalogIds',
        'atomic', 'rollbackBaselineBinding', 'snapshotManifestBinding', 'holder',
      ],
      'source interrupted transaction state'
    );
    if (state.schemaVersion !== 2 || state.status !== 'in-progress' ||
        !/^[a-f0-9]{32}$/u.test(state.transactionId ?? '') ||
        state.action !== plan.action || !['install', 'remove'].includes(state.action) ||
        state.planSha256 !== planSha256 ||
        JSON.stringify(state.catalogIds) !== JSON.stringify(catalogIds) ||
        state.atomic !== (catalogIds.length > 1) ||
        !PRIVATE_BINDING_PATTERN.test(state.rollbackBaselineBinding ?? '') ||
        !PRIVATE_BINDING_PATTERN.test(state.snapshotManifestBinding ?? '')) {
      fail('source interrupted transaction state does not match its plan');
    }
    holder = validateInProgressHolder(state.holder, root, state.action);
  }
  exactObjectKeys(
    authenticationRecord.value,
    ['schemaVersion', 'algorithm', 'transactionNonce', 'payload', 'mac'],
    'source recovery authentication'
  );
  const nonceText = authenticationRecord.value.transactionNonce;
  if (!/^[A-Za-z0-9_-]{43}$/u.test(nonceText ?? '')) {
    fail('source recovery authentication nonce is malformed');
  }
  const transactionNonce = Buffer.from(nonceText, 'base64url');
  if (transactionNonce.length !== 32 || transactionNonce.toString('base64url') !== nonceText) {
    fail('source recovery authentication nonce is malformed');
  }
  const expectedAuthentication = buildRecoveryAuthentication(
    state,
    recoveryKey,
    transactionNonce
  );
  const actualMac = authenticationRecord.value.mac;
  if (authenticationRecord.value.schemaVersion !== 2 ||
      authenticationRecord.value.algorithm !== 'hmac-sha256-private-nonce-v1' ||
      JSON.stringify(authenticationRecord.value.payload) !== JSON.stringify(expectedAuthentication.payload) ||
      !/^[a-f0-9]{64}$/u.test(actualMac ?? '') ||
      !timingSafeEqual(Buffer.from(actualMac, 'hex'), Buffer.from(expectedAuthentication.mac, 'hex'))) {
    fail('source transaction is not authenticated by this DSH_HOME recovery trust root');
  }
  if (!privateBindingMatches(
    state.rollbackBaselineBinding,
    baselineRecord.bytes,
    recoveryKey,
    transactionNonce,
    'rollback-baseline'
  )) {
    fail('source rollback baseline private binding mismatch');
  }
  if (!privateBindingMatches(
    state.snapshotManifestBinding,
    snapshotManifest.bytes,
    recoveryKey,
    transactionNonce,
    'snapshot-manifest'
  )) {
    fail('source snapshot manifest private binding mismatch');
  }
  const baselineInventory = normalizeInventory(baselineRecord.value.inventory, 'source baseline plugin inventory');
  const baselineClosure = validateClosureRecord(baselineRecord.value.closure);
  return {
    kind,
    root,
    snapshot,
    state,
    plan,
    planSha256,
    catalogIds,
    baselineInventory,
    baselineClosure,
    transactionNonce,
    holder,
  };
}

export function buildRecoveryPlan(source) {
  const plan = {
    schemaVersion: 1,
    action: 'recover',
    profile: 'web',
    sourceTransaction: {
      transactionId: source.state.transactionId,
      status: source.state.status,
      recoveryMode: source.kind === 'interrupted'
        ? 'authenticated-interrupted-rollback-from-matching-stale-holder'
        : 'authenticated-terminal-rollback',
      planSha256: source.planSha256,
      catalogIds: source.catalogIds,
      authenticatedPrivateSnapshot: true,
      authenticatedTerminalState: source.kind === 'terminal',
      authenticatedInterruptedJournal: source.kind === 'interrupted',
    },
    restoreTarget: {
      authenticatedPrivateClosure: true,
      authenticatedPrivateInventory: true,
    },
    coldRestartRequired: true,
    failureRollback: 'restore-complete-pre-recovery-snapshot',
    localRecoveryAuthentication: 'verified-by-explicit-dsh-home-private-hmac-sha256',
    childEnvironment: 'transaction-private-home-and-config-with-minimal-allowlist',
  };
  const bytes = Buffer.from(`${JSON.stringify(stable(plan))}\n`, 'utf8');
  return { plan, planSha256: sha256(bytes) };
}

export function bindRecoverySourceToAuthority(source, authorityContext, authority, validationOptions) {
  const top10 = source.plan.releaseSet !== null;
  const builder = source.plan.action === 'install' ? buildPlan : buildRemovalPlan;
  const expected = builder(authority, top10 ? [] : source.catalogIds, {
    top10,
    top10ReleaseSet: authorityContext.top10ReleaseSet,
    validationOptions,
  });
  if (JSON.stringify(stable(expected.plan)) !== JSON.stringify(stable(source.plan)) ||
      expected.planSha256 !== source.planSha256 ||
      JSON.stringify(expected.items.map((item) => item.catalogId)) !== JSON.stringify(source.catalogIds)) {
    fail('source transaction plan is not the exact plan reconstructed from current authority');
  }
  if (source.state.status === 'committed') {
    const evidence = source.state.runtimeAcceptance;
    exactObjectKeys(
      evidence,
      ['schemaVersion', 'accepted', 'dumpConfigVerified',
        'inventoryVerifiedBeforeAndAfterRestart', 'unauthenticatedRootStatus'],
      'source install runtime acceptance'
    );
    if (evidence.schemaVersion !== 1 || evidence.dumpConfigVerified !== true ||
        evidence.inventoryVerifiedBeforeAndAfterRestart !== true ||
        evidence.unauthenticatedRootStatus !== 401 || !Array.isArray(evidence.accepted) ||
        evidence.accepted.length !== expected.items.length) {
      fail('source install runtime acceptance is incomplete');
    }
    for (let index = 0; index < expected.items.length; index += 1) {
      const item = expected.items[index];
      const accepted = evidence.accepted[index];
      exactObjectKeys(
        accepted,
        ['catalogId', 'entryId', 'packageName', 'version'],
        `source runtime acceptance #${item.catalogId}`
      );
      if (accepted.catalogId !== item.catalogId ||
          accepted.entryId !== item.runtimeAcceptance.dumpConfig.entryId ||
          accepted.packageName !== item.package.name ||
          accepted.version !== item.package.version) {
        fail(`source runtime acceptance #${item.catalogId} is not authority-bound`);
      }
    }
  }
  return expected.items;
}

function assertSeparateTree(path, protectedRoots, label) {
  for (const protectedRoot of protectedRoots) {
    const forward = relative(protectedRoot, path);
    const reverse = relative(path, protectedRoot);
    if (forward === '' || (!forward.startsWith('..') && !isAbsolute(forward)) ||
        (!reverse.startsWith('..') && !isAbsolute(reverse))) {
      fail(`${label} must be outside source, DSH_HOME, profile, and other transaction trees`);
    }
  }
}

export async function executeRecoveryTransaction(options) {
  const allowedOptions = [
    'authorityContext', 'consentSha256', 'dshHome', 'harnessReceipt', 'harnessSource',
    'sourceTransactionRoot', 'transactionRoot',
  ];
  if (JSON.stringify(Object.keys(options ?? {}).sort()) !== JSON.stringify([...allowedOptions].sort())) {
    fail('recovery options must not contain injected runners, plans, snapshots, or Harness gate bypasses');
  }
  const {
    authorityContext,
    consentSha256,
    dshHome: dshHomeInput,
    harnessSource,
    harnessReceipt,
    sourceTransactionRoot,
    transactionRoot: transactionRootInput,
  } = options;
  const { authority, validationOptions } = validateTransactionAuthorityContext(authorityContext);
  const dshHome = await canonicalDirectory(dshHomeInput, 'DSH_HOME');
  const profile = await canonicalDirectory(join(dshHome, 'profiles/web'), 'web profile');
  const recoveryKey = await loadRecoveryKey(dshHome);
  const source = await loadRecoverySource(sourceTransactionRoot, recoveryKey);
  bindRecoverySourceToAuthority(source, authorityContext, authority, validationOptions);
  const { plan, planSha256 } = buildRecoveryPlan(source);
  if (!/^[a-f0-9]{64}$/.test(consentSha256 ?? '') || consentSha256 !== planSha256) {
    fail('explicit consent is not bound to this exact recovery plan digest');
  }
  const harness = await verifyHarnessGate(harnessSource, harnessReceipt, authority);
  assertSeparateTree(source.root, [dshHome, profile, harness.source], 'source transaction root');
  await requireColdWebPort();
  const transactionRoot = await newTransactionRoot(
    transactionRootInput,
    [dshHome, profile, harness.source, source.root]
  );
  const childEnv = await createChildRuntimeEnvironment(transactionRoot, dshHome, profile);
  verifyPnpm(childEnv);
  const snapshot = join(transactionRoot, 'snapshot');
  const lock = await acquireTransactionLock(dshHome, transactionRoot, {
    operation: 'recover',
    recoverySourceTransactionRoot: source.root,
    expectedRecoveryHolder: source.kind === 'interrupted' ? source.holder : null,
  });
  let snapshotCreated = false;
  return runWithHeldTransactionLock(lock, async () => {
    // Re-authenticate after the exclusive lock is held so recovery never acts
    // on source evidence that changed between planning and Profile mutation.
    const lockedSource = await loadRecoverySource(source.root, recoveryKey);
    bindRecoverySourceToAuthority(
      lockedSource,
      authorityContext,
      authority,
      validationOptions
    );
    if (lockedSource.kind !== source.kind ||
        lockedSource.planSha256 !== source.planSha256 ||
        JSON.stringify(lockedSource.state) !== JSON.stringify(source.state) ||
        !timingSafeEqual(lockedSource.transactionNonce, source.transactionNonce)) {
      fail('authenticated recovery source changed before the DSH_HOME lock was acquired');
    }
    if (lockedSource.kind === 'interrupted') {
      if (lock.takeoverOwner === null ||
          !staleOwnerMatchesJournal(lock.takeoverOwner, lockedSource.holder)) {
        fail('interrupted recovery did not take over its exact authenticated stale lock holder');
      }
    } else {
      await verifyTerminalManagedFilesBinding(
        lockedSource,
        dshHome,
        profile,
        recoveryKey
      );
    }
    await createProfileSnapshot(dshHome, profile, snapshot);
    snapshotCreated = true;
    if (lockedSource.kind === 'terminal') {
      await verifyTerminalSnapshotManagedFilesBinding(
        lockedSource,
        snapshot,
        recoveryKey
      );
    }
    let currentClosure;
    let currentInventory;
    let completeBaseline = false;
    let dependencyClosureMutationStarted = false;
    return runAtomicAcceptanceBoundary(async () => {
      if (lockedSource.kind === 'terminal') {
        currentClosure = await captureProfileClosure(profile);
        currentInventory = probePluginInventory(harness, childEnv);
        completeBaseline = true;
        if (!privateBindingMatches(
          lockedSource.state.terminalClosureBinding,
          jsonBytes(stable(currentClosure)),
          recoveryKey,
          lockedSource.transactionNonce,
          'terminal-closure'
        ) || !privateBindingMatches(
          lockedSource.state.terminalInventoryBinding,
          jsonBytes(stable(currentInventory)),
          recoveryKey,
          lockedSource.transactionNonce,
          'terminal-inventory'
        )) {
          fail('current Profile has drifted from the authenticated source transaction terminal state');
        }
      } else {
        // A crashed add/remove may leave an intentionally invalid partial
        // closure. Best-effort capture improves failure rollback, but failure
        // to probe that partial state must not block restoring the authenticated
        // pre-mutation baseline.
        try {
          currentClosure = await captureProfileClosure(profile);
          currentInventory = probePluginInventory(harness, childEnv);
          completeBaseline = true;
        } catch {
          currentClosure = undefined;
          currentInventory = undefined;
          completeBaseline = false;
        }
      }
      await privateWrite(join(transactionRoot, 'plan.json'), {
        schemaVersion: 1,
        planSha256,
        catalogIds: lockedSource.catalogIds,
        plan,
      });
      if (completeBaseline) {
        await privateWrite(join(transactionRoot, 'rollback-baseline.json'), {
          schemaVersion: 1,
          closure: currentClosure,
          inventory: currentInventory,
        });
      }
      if (lockedSource.kind === 'terminal') {
        const stillFrozen = await verifyProfileSnapshot(dshHome, profile, snapshot);
        if (!stillFrozen.matches) {
          fail(
            'current Profile drifted after terminal recovery snapshot capture; lock retained for manual inspection',
            { preserveConcurrentManagedFileDrift: true }
          );
        }
      }
      dependencyClosureMutationStarted = true;
      const recovery = await restoreAndVerifyBaseline({
        baselineClosure: lockedSource.baselineClosure,
        baselineInventory: lockedSource.baselineInventory,
        childEnv,
        dshHome,
        harness,
        profile,
        snapshot: lockedSource.snapshot,
      });
      if (!rollbackIsComplete(recovery)) fail('source transaction recovery verification failed');
      const state = {
        schemaVersion: 2,
        status: 'recovered',
        recoveryMode: lockedSource.kind,
        planSha256,
        sourceTransactionId: lockedSource.state.transactionId,
        sourcePlanSha256: lockedSource.planSha256,
        catalogIds: lockedSource.catalogIds,
        coldRestartVerified: true,
        privateRollbackRetained: true,
        recoveryVerified: true,
      };
      await privateWrite(join(transactionRoot, 'state.json'), state);
      return { state, transactionRoot, snapshot };
    }, (transactionError) => transactionError?.details?.preserveConcurrentManagedFileDrift === true
      ? {
          attempted: false,
          baselineAvailable: completeBaseline,
          filesRestored: false,
          closureRestored: false,
          inventoryRestored: false,
          coldStartProbePassed: false,
          concurrentDriftPreserved: true,
        }
      : completeBaseline
        ? restoreAndVerifyBaseline({
          baselineClosure: currentClosure,
          baselineInventory: currentInventory,
          childEnv,
          dshHome,
          harness,
          profile,
          snapshot,
          })
        : restoreAndVerifyManagedFiles({ dshHome, profile, snapshot }).then((rollback) => ({
            ...rollback,
            dependencyClosureMutationStarted,
          })));
  }, (error) => canReleaseTransactionLockAfterError(lock, snapshotCreated, error));
}

export async function preflightPrepared(preparedRootInput, items) {
  const preparedRoot = await canonicalDirectory(preparedRootInput, 'prepared root');
  for (const item of items) {
    await validatePrepared(join(preparedRoot, String(item.catalogId)), item);
  }
  return {
    preparedRoot,
    preparedItemCount: items.length,
    catalogIds: items.map((item) => item.catalogId),
    allPreparedAuthorityMatched: true,
  };
}

async function resolveItemContext(options) {
  const authorityContext = await loadAuthority();
  const builder = options.command === 'remove-plan' || options.command === 'remove'
    ? buildRemovalPlan
    : buildPlan;
  const result = builder(authorityContext.authority, options.ids, {
    top10: options.top10,
    top10ReleaseSet: authorityContext.top10ReleaseSet,
    validationOptions: {
      harnessAuthorityBytes: authorityContext.harnessAuthorityBytes,
      top10ReleaseSetBytes: authorityContext.top10ReleaseSetBytes,
      migrationMapBytes: authorityContext.migrationMapBytes,
      migrationMapSchemaBytes: authorityContext.migrationMapSchemaBytes,
      candidateIntakeBytes: authorityContext.candidateIntakeBytes,
    },
  });
  if (options.command === 'remove-plan' || options.command === 'remove') {
    return { authorityContext, ...result };
  }
  if (!options.preparedroot) fail('plan and execute require --prepared-root for full preflight');
  const preflight = await preflightPrepared(options.preparedroot, result.items);
  return {
    authorityContext,
    ...result,
    preflight: {
      preparedItemCount: preflight.preparedItemCount,
      catalogIds: preflight.catalogIds,
      allPreparedAuthorityMatched: preflight.allPreparedAuthorityMatched,
    },
  };
}

async function resolveRecoveryContext(options) {
  const authorityContext = await loadAuthority();
  const { authority, validationOptions } = validateTransactionAuthorityContext(authorityContext);
  const dshHome = await canonicalDirectory(options.dshhome, 'DSH_HOME');
  const recoveryKey = await loadRecoveryKey(dshHome);
  const source = await loadRecoverySource(options.sourcetransactionroot, recoveryKey);
  bindRecoverySourceToAuthority(source, authorityContext, authority, validationOptions);
  if (source.kind === 'interrupted') {
    await validateInterruptedRecoveryLock(dshHome, source);
  }
  return { authorityContext, source, ...buildRecoveryPlan(source) };
}

function requireCliOptions(options, command, keys) {
  const names = {
    consentsha256: 'consent-sha256',
    dshhome: 'dsh-home',
    harnessreceipt: 'harness-receipt',
    harnesssource: 'harness-source',
    preparedroot: 'prepared-root',
    sourcetransactionroot: 'source-transaction-root',
    transactionroot: 'transaction-root',
  };
  for (const key of keys) {
    if (!options[key]) fail(`${command} requires --${names[key]}`);
  }
}

function parseArgs(argv) {
  const command = argv[0];
  const options = { ids: [], top10: false };
  const seen = new Set();
  for (let index = 1; index < argv.length; index += 1) {
    const key = argv[index];
    if (key === '--top10') {
      if (seen.has(key)) fail('duplicate transaction argument --top10');
      seen.add(key);
      options.top10 = true;
    }
    else if (key === '--id' && argv[index + 1]) options.ids.push(argv[++index]);
    else if (['--dsh-home', '--harness-source', '--harness-receipt', '--prepared-root', '--transaction-root', '--source-transaction-root', '--consent-sha256'].includes(key) && argv[index + 1]) {
      if (seen.has(key)) fail(`duplicate transaction argument ${key}`);
      seen.add(key);
      options[key.slice(2).replaceAll('-', '')] = argv[++index];
    } else fail('invalid transaction argument');
  }
  if (!['plan', 'execute', 'remove-plan', 'remove', 'recover-plan', 'recover'].includes(command)) {
    fail('transaction command must be plan, execute, remove-plan, remove, recover-plan, or recover');
  }
  const commandFlags = {
    plan: new Set(['--id', '--top10', '--prepared-root']),
    execute: new Set([
      '--id', '--top10', '--dsh-home', '--harness-source', '--harness-receipt',
      '--prepared-root', '--transaction-root', '--consent-sha256',
    ]),
    'remove-plan': new Set(['--id', '--top10']),
    remove: new Set([
      '--id', '--top10', '--dsh-home', '--harness-source', '--harness-receipt',
      '--transaction-root', '--consent-sha256',
    ]),
    'recover-plan': new Set(['--dsh-home', '--source-transaction-root']),
    recover: new Set([
      '--dsh-home', '--harness-source', '--harness-receipt', '--source-transaction-root',
      '--transaction-root', '--consent-sha256',
    ]),
  };
  for (const flag of seen) {
    if (!commandFlags[command].has(flag)) fail(`${command} does not accept ${flag}`);
  }
  const recoveryCommand = command === 'recover-plan' || command === 'recover';
  if (options.top10 && options.ids.length > 0) fail('--top10 cannot be combined with --id');
  options.ids.forEach(normalizeCatalogId);
  if (recoveryCommand) {
    if (options.top10 || options.ids.length > 0 || options.preparedroot) {
      fail('recovery accepts only a retained source transaction, never plugin selectors or prepared input');
    }
    if (!options.sourcetransactionroot || !options.dshhome) {
      fail('recovery requires --source-transaction-root and --dsh-home');
    }
  } else if (!options.top10 && options.ids.length === 0) {
    fail('at least one exact #3NNN is required');
  }
  if ((command === 'remove-plan' || command === 'remove') && options.preparedroot) {
    fail('removal does not accept prepared install input');
  }
  return { command, ...options };
}

export function publicTerminalState(state) {
  const {
    rollbackBaselineBinding: _rollbackBaselineBinding,
    snapshotManifestBinding: _snapshotManifestBinding,
    terminalClosureBinding: _terminalClosureBinding,
    terminalInventoryBinding: _terminalInventoryBinding,
    terminalManagedFilesBinding: _terminalManagedFilesBinding,
    ...publicState
  } = state;
  return publicState;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.command === 'recover-plan') {
      const recovery = await resolveRecoveryContext(options);
      process.stdout.write(`${JSON.stringify({
        plan: recovery.plan,
        planSha256: recovery.planSha256,
      }, null, 2)}\n`);
    } else {
      const context = options.command === 'recover' ? null : await resolveItemContext(options);
      if (options.command === 'plan') {
        process.stdout.write(`${JSON.stringify({
          plan: context.plan,
          planSha256: context.planSha256,
          preflight: context.preflight,
        }, null, 2)}\n`);
      } else if (options.command === 'remove-plan') {
        process.stdout.write(`${JSON.stringify({
          plan: context.plan,
          planSha256: context.planSha256,
        }, null, 2)}\n`);
      } else if (options.command === 'execute') {
        requireCliOptions(options, 'execute', [
          'dshhome', 'harnesssource', 'harnessreceipt', 'preparedroot',
          'transactionroot', 'consentsha256',
        ]);
        const result = await executeTransaction({
          authorityContext: context.authorityContext,
          ids: options.ids,
          top10: options.top10,
          consentSha256: options.consentsha256,
          dshHome: options.dshhome,
          harnessSource: options.harnesssource,
          harnessReceipt: options.harnessreceipt,
          preparedRoot: options.preparedroot,
          transactionRoot: options.transactionroot,
        });
        process.stdout.write(`${JSON.stringify({
          ...publicTerminalState(result.state),
          transactionRoot: '<private-transaction-root>',
        }, null, 2)}\n`);
      } else if (options.command === 'remove') {
        requireCliOptions(options, 'remove', [
          'dshhome', 'harnesssource', 'harnessreceipt', 'transactionroot', 'consentsha256',
        ]);
        const result = await executeRemovalTransaction({
          authorityContext: context.authorityContext,
          ids: options.ids,
          top10: options.top10,
          consentSha256: options.consentsha256,
          dshHome: options.dshhome,
          harnessSource: options.harnesssource,
          harnessReceipt: options.harnessreceipt,
          transactionRoot: options.transactionroot,
        });
        process.stdout.write(`${JSON.stringify({
          ...publicTerminalState(result.state),
          transactionRoot: '<private-transaction-root>',
        }, null, 2)}\n`);
      } else {
        requireCliOptions(options, 'recover', [
          'dshhome', 'harnesssource', 'harnessreceipt', 'sourcetransactionroot',
          'transactionroot', 'consentsha256',
        ]);
        const authorityContext = await loadAuthority();
        const result = await executeRecoveryTransaction({
          authorityContext,
          consentSha256: options.consentsha256,
          dshHome: options.dshhome,
          harnessSource: options.harnesssource,
          harnessReceipt: options.harnessreceipt,
          sourceTransactionRoot: options.sourcetransactionroot,
          transactionRoot: options.transactionroot,
        });
        process.stdout.write(`${JSON.stringify({
          ...publicTerminalState(result.state),
          transactionRoot: '<private-transaction-root>',
        }, null, 2)}\n`);
      }
    }
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    if (error.details) process.stderr.write(`${JSON.stringify(error.details)}\n`);
    process.exitCode = 1;
  }
}
