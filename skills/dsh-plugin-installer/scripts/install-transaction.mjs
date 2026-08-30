#!/usr/bin/env node

import { spawn, spawnSync } from 'node:child_process';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { once } from 'node:events';
import { lstat, mkdir, open, readFile, realpath, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { basename, dirname, isAbsolute, join, parse, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { parseDocument } from 'yaml';

import {
  loadAuthority,
  normalizeCatalogId,
  resolveItems,
  validateAuthority,
} from './authority.mjs';
import {
  authorizePrepare,
  revokePrepare,
  verifyEffectivePnpmBuildPolicy,
} from './prepare-authorization.mjs';
import {
  createProfileSnapshot,
  restoreProfileSnapshot,
  verifyProfileSnapshot,
} from './profile-snapshot.mjs';
import { captureProfileClosure, verifyProfileClosure } from './profile-closure.mjs';
import { validatePrepared } from './prepare-plugin.mjs';
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

function inventorySha256(inventory) {
  return sha256(Buffer.from(`${JSON.stringify(stable(inventory))}\n`, 'utf8'));
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

export function buildDshInvocation(builtCli, dshArgs) {
  if (!isAbsolute(builtCli) && !/^[A-Za-z]:\\/.test(builtCli)) {
    fail('built DSH CLI must be absolute');
  }
  if (!Array.isArray(dshArgs) || dshArgs.length === 0 ||
      dshArgs.some((value) => typeof value !== 'string' || value.includes('\0') || value.includes('\n') || value.includes('\r'))) {
    fail('DSH arguments must be bounded literal argument-array values');
  }
  const add = dshArgs.length === 6 &&
    JSON.stringify(dshArgs.slice(0, 4)) === JSON.stringify(['plugin', '--profile', 'web', 'add']) &&
    dshArgs[5] === '--save-exact';
  const remove = dshArgs.length === 5 &&
    JSON.stringify(dshArgs.slice(0, 4)) === JSON.stringify(['plugin', '--profile', 'web', 'remove']) &&
    /^(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+$/u.test(dshArgs[4]);
  const restore = JSON.stringify(dshArgs) ===
    JSON.stringify(['plugin', '--profile', 'web', 'install', '--frozen-lockfile']);
  const list = JSON.stringify(dshArgs) ===
    JSON.stringify(['plugin', '--profile', 'web', 'list', '--json']);
  const dump = JSON.stringify(dshArgs) ===
    JSON.stringify(['--profile', 'web', '--dump-config']);
  if (add) {
    const spec = dshArgs[4];
    const safeLocalArtifact =
      (/^\/[A-Za-z0-9_./:+ -]+\.tgz$/u.test(spec) || /^[A-Za-z]:\\[A-Za-z0-9_.\\:+ -]+\.tgz$/u.test(spec)) &&
      !spec.split(/[\\/]/u).some((part) => part === '..');
    const safeUpstream = /^git\+https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\.git#[a-f0-9]{40}$/u.test(spec);
    if (!safeLocalArtifact && !safeUpstream) {
      fail('plugin install spec is outside the fixed command-injection-safe grammar');
    }
  } else if (!remove && !restore && !list && !dump) {
    fail('DSH plugin invocation is outside the fixed add, remove, list, dump-config, or frozen-restore grammar');
  }
  return {
    command: process.execPath,
    args: [builtCli, ...dshArgs],
    shell: false,
  };
}

const CHILD_ENV_ALLOWLIST = [
  'COMSPEC', 'LANG', 'LC_ALL', 'LC_CTYPE', 'PATH', 'PATHEXT', 'SystemDrive',
  'SystemRoot', 'USER', 'USERDOMAIN', 'USERNAME', 'WINDIR',
];

export function buildChildEnvironment(dshHome, runtimeRoot, source = process.env) {
  if (typeof dshHome !== 'string' || dshHome.length === 0 || dshHome.includes('\0') ||
      typeof runtimeRoot !== 'string' || !isAbsolute(runtimeRoot) || runtimeRoot.includes('\0') ||
      source === null || typeof source !== 'object' || Array.isArray(source)) {
    fail('child environment requires explicit DSH_HOME/runtime roots and an environment mapping');
  }
  const childEnv = {};
  for (const key of CHILD_ENV_ALLOWLIST) {
    const value = source[key];
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

async function createChildRuntimeEnvironment(transactionRoot, dshHome) {
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
  return buildChildEnvironment(dshHome, runtimeRoot);
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
  await mkdir(root, { recursive: false, mode: 0o700 });
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
  const result = spawnSync('pnpm', ['--version'], {
    encoding: 'utf8',
    env: childEnv,
    shell: false,
    timeout: 30_000,
  });
  if (result.status !== 0 || result.stdout.trim() !== '11.7.0') {
    fail('the source-built DSH plugin command requires pnpm 11.7.0 already on PATH; this Skill will not modify PATH');
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
      installed.dsh?.bundle?.patch !== item.package.bundlePatch) {
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
        !/^(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+$/u.test(name))) {
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
    if (!/^(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+$/u.test(name) ||
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

async function privateWrite(path, value) {
  const bytes = jsonBytes(value);
  const handle = await open(path, 'wx', 0o600);
  try {
    await handle.writeFile(bytes);
  } finally {
    await handle.close();
  }
  return sha256(bytes);
}

export function assertPrivateRecoveryPlatform(platform = process.platform) {
  if (platform === 'win32') {
    fail('Windows Plugin transactions are promotion-blocked until SID-only no-inheritance ACL recovery-key storage is certified');
  }
  if (!['darwin', 'linux'].includes(platform)) {
    fail(`private recovery authentication is unsupported on ${platform}`);
  }
}

async function loadRecoveryKey(dshHome, { create = false } = {}) {
  assertPrivateRecoveryPlatform();
  const trustRoot = join(dshHome, '.dsh-plugin-installer');
  if (create) {
    try {
      await mkdir(trustRoot, { mode: 0o700 });
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
  const keyPath = join(canonicalRoot, 'hmac-sha256.key');
  if (create) {
    try {
      const handle = await open(keyPath, 'wx', 0o600);
      try {
        await handle.writeFile(randomBytes(32));
      } finally {
        await handle.close();
      }
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
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
  return readFile(keyPath);
}

export function buildRecoveryAuthentication(state, recoveryKey) {
  if (!Buffer.isBuffer(recoveryKey) || recoveryKey.length !== 32) {
    fail('recovery authentication requires the private 32-byte local trust key');
  }
  const payload = {
    schemaVersion: 1,
    status: state.status,
    planSha256: state.planSha256,
    stateSha256: sha256(jsonBytes(state)),
    rollbackBaselineSha256: state.rollbackBaselineSha256,
    snapshotManifestSha256: state.snapshotManifestSha256,
  };
  const payloadBytes = Buffer.from(`${JSON.stringify(stable(payload))}\n`, 'utf8');
  return {
    schemaVersion: 1,
    algorithm: 'hmac-sha256',
    payload,
    mac: createHmac('sha256', recoveryKey).update(payloadBytes).digest('hex'),
  };
}

async function writeAuthenticatedTerminalState(transactionRoot, state, recoveryKey) {
  const authentication = buildRecoveryAuthentication(state, recoveryKey);
  await privateWrite(join(transactionRoot, 'recovery-auth.json'), authentication);
  await privateWrite(join(transactionRoot, 'state.json'), state);
}

function rollbackIsComplete(rollback) {
  return rollback?.attempted === true && rollback.filesRestored === true &&
    rollback.closureRestored === true && rollback.inventoryRestored === true &&
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
      filesRestored: false,
      closureRestored: false,
      inventoryRestored: false,
      coldStartProbePassed: false,
    };
    try {
      rollback = { ...rollback, ...await rollbackOperation() };
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

async function restoreAndVerifyBaseline({
  baselineClosure,
  baselineInventory,
  childEnv,
  harness,
  profile,
  snapshot,
}) {
  const rollback = {
    attempted: true,
    filesRestored: false,
    closureRestored: false,
    inventoryRestored: false,
    coldStartProbePassed: false,
  };
  await restoreProfileSnapshot(profile, snapshot);
  rollback.filesRestored = (await verifyProfileSnapshot(profile, snapshot)).matches;
  verifyEffectivePnpmBuildPolicy(profile, [], false, { environment: childEnv });
  const invocation = buildDshInvocation(harness.builtCli, [
    'plugin', '--profile', 'web', 'install', '--frozen-lockfile',
  ]);
  const result = runInvocation(invocation, { cwd: harness.source, childEnv });
  if (result.error || result.code !== 0) fail('frozen dependency closure restoration failed');
  rollback.closureRestored = (await verifyProfileClosure(profile, baselineClosure)).matches;
  const restoredInventory = probePluginInventory(harness, childEnv);
  rollback.inventoryRestored =
    JSON.stringify(restoredInventory) === JSON.stringify(baselineInventory);
  rollback.coldStartProbePassed = await probeColdWebStart(harness, childEnv);
  return rollback;
}

function validateTransactionAuthorityContext(authorityContext) {
  if (!Buffer.isBuffer(authorityContext?.authorityBytes) ||
      !Buffer.isBuffer(authorityContext?.harnessAuthorityBytes) ||
      !Buffer.isBuffer(authorityContext?.top10ReleaseSetBytes) ||
      sha256(authorityContext.authorityBytes) !== authorityContext.authoritySha256 ||
      sha256(authorityContext.top10ReleaseSetBytes) !== authorityContext.top10ReleaseSetSha256 ||
      JSON.stringify(JSON.parse(authorityContext.authorityBytes)) !== JSON.stringify(authorityContext.authority)) {
    fail('transaction authority context is not bound to its exact authority bytes');
  }
  const validationOptions = {
    harnessAuthorityBytes: authorityContext.harnessAuthorityBytes,
    top10ReleaseSetBytes: authorityContext.top10ReleaseSetBytes,
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
  const preparedRoot = await canonicalDirectory(preparedRootInput, 'prepared root');
  const harness = await verifyHarnessGate(harnessSource, harnessReceipt, authority);
  if (!isAbsolute(harness.builtCli)) fail('built CLI must be absolute');
  const prepared = [];
  for (const item of items) {
    prepared.push(await validatePrepared(join(preparedRoot, String(item.catalogId)), item));
  }
  await requireColdWebPort();
  const transactionRoot = await newTransactionRoot(transactionRootInput, [dshHome, profile, preparedRoot, harness.source]);
  const childEnv = await createChildRuntimeEnvironment(transactionRoot, dshHome);
  verifyPnpm(childEnv);
  const snapshot = join(transactionRoot, 'snapshot');
  const baselineClosure = await captureProfileClosure(profile);
  const baselineInventory = probePluginInventory(harness, childEnv);
  await privateWrite(join(transactionRoot, 'plan.json'), {
    schemaVersion: 1,
    planSha256,
    catalogIds: items.map((item) => item.catalogId),
    plan,
  });
  const rollbackBaselineSha256 = await privateWrite(join(transactionRoot, 'rollback-baseline.json'), {
    schemaVersion: 1,
    closure: baselineClosure,
    inventory: baselineInventory,
  });
  await createProfileSnapshot(profile, snapshot);
  const snapshotManifestSha256 = sha256(await readFile(join(snapshot, 'snapshot.json')));
  return runAtomicAcceptanceBoundary(async () => {
    await authorizePrepare(profile, items, { environment: childEnv });
    for (let index = 0; index < items.length; index += 1) {
      const invocation = buildDshInvocation(harness.builtCli, [
        'plugin', '--profile', 'web', 'add', prepared[index].installSpec, '--save-exact',
      ]);
      const result = runInvocation(invocation, { cwd: harness.source, childEnv });
      if (result.error || result.code !== 0) fail(`plugin #${items[index].catalogId} installation failed`);
      await verifyInstalled(profile, items[index]);
    }
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
    const state = {
      schemaVersion: 1,
      status: 'committed',
      planSha256,
      catalogIds: items.map((item) => item.catalogId),
      atomic: items.length > 1,
      coldRestartVerified: true,
      rollbackBaselineSha256,
      snapshotManifestSha256,
      terminalClosureSha256: terminalClosure.closureSha256,
      terminalInventorySha256: inventorySha256(restartedInventory),
      runtimeAcceptance,
    };
    const recoveryKey = await loadRecoveryKey(dshHome, { create: true });
    await writeAuthenticatedTerminalState(transactionRoot, state, recoveryKey);
    return { state, transactionRoot, snapshot };
  }, () => restoreAndVerifyBaseline({
    baselineClosure,
    baselineInventory,
    childEnv,
    harness,
    profile,
    snapshot,
  }));
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
  const harness = await verifyHarnessGate(harnessSource, harnessReceipt, authority);
  for (const item of items) await verifyInstalled(profile, item);
  await requireColdWebPort();
  const transactionRoot = await newTransactionRoot(transactionRootInput, [dshHome, profile, harness.source]);
  const childEnv = await createChildRuntimeEnvironment(transactionRoot, dshHome);
  verifyPnpm(childEnv);
  const baselineClosure = await captureProfileClosure(profile);
  const baselineInventory = probePluginInventory(harness, childEnv);
  for (const item of items) {
    if (baselineInventory[item.package.name] !== item.package.version) {
      fail(`plugin #${item.catalogId} is not installed at its authority-bound version`);
    }
  }
  const expectedInventory = { ...baselineInventory };
  for (const item of items) delete expectedInventory[item.package.name];
  const normalizedExpectedInventory = stable(expectedInventory);
  const snapshot = join(transactionRoot, 'snapshot');
  await privateWrite(join(transactionRoot, 'plan.json'), {
    schemaVersion: 1,
    planSha256,
    catalogIds: items.map((item) => item.catalogId),
    plan,
  });
  const rollbackBaselineSha256 = await privateWrite(join(transactionRoot, 'rollback-baseline.json'), {
    schemaVersion: 1,
    closure: baselineClosure,
    inventory: baselineInventory,
  });
  await createProfileSnapshot(profile, snapshot);
  const snapshotManifestSha256 = sha256(await readFile(join(snapshot, 'snapshot.json')));
  return runAtomicAcceptanceBoundary(async () => {
    await revokePrepare(profile, items, { environment: childEnv });
    for (const item of [...items].reverse()) {
      const invocation = buildDshInvocation(harness.builtCli, [
        'plugin', '--profile', 'web', 'remove', item.rollback.removePackageName,
      ]);
      const result = runInvocation(invocation, { cwd: harness.source, childEnv });
      if (result.error || result.code !== 0) fail(`plugin #${item.catalogId} removal failed`);
      await verifyRemoved(profile, item);
    }
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
    const state = {
      schemaVersion: 1,
      status: 'removed',
      planSha256,
      catalogIds: items.map((item) => item.catalogId),
      atomic: items.length > 1,
      coldRestartVerified: true,
      rollbackBaselineSha256,
      snapshotManifestSha256,
      terminalClosureSha256: terminalClosure.closureSha256,
      terminalInventorySha256: inventorySha256(restartedInventory),
      removalVerified: true,
    };
    const recoveryKey = await loadRecoveryKey(dshHome, { create: true });
    await writeAuthenticatedTerminalState(transactionRoot, state, recoveryKey);
    return { state, transactionRoot, snapshot };
  }, () => restoreAndVerifyBaseline({
    baselineClosure,
    baselineInventory,
    childEnv,
    harness,
    profile,
    snapshot,
  }));
}

async function readPrivateJson(root, name, label) {
  const path = join(root, name);
  const stat = await lstat(path);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size < 2 || stat.size > 2 * 1024 * 1024) {
    fail(`${label} must be a bounded regular JSON file`);
  }
  if (process.platform !== 'win32' && (stat.mode & 0o077) !== 0) {
    fail(`${label} must not be readable or writable by group or others`);
  }
  const bytes = await readFile(path);
  try {
    return { bytes, value: JSON.parse(bytes) };
  } catch {
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
        !/^(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+$/u.test(name) ||
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
  const planRecord = await readPrivateJson(root, 'plan.json', 'source transaction plan');
  const baselineRecord = await readPrivateJson(root, 'rollback-baseline.json', 'source rollback baseline');
  const stateRecord = await readPrivateJson(root, 'state.json', 'source transaction state');
  const authenticationRecord = await readPrivateJson(root, 'recovery-auth.json', 'source recovery authentication');
  exactObjectKeys(planRecord.value, ['schemaVersion', 'planSha256', 'catalogIds', 'plan'], 'source transaction plan');
  exactObjectKeys(baselineRecord.value, ['schemaVersion', 'closure', 'inventory'], 'source rollback baseline');
  const status = stateRecord.value?.status;
  const stateKeys = status === 'committed'
    ? ['schemaVersion', 'status', 'planSha256', 'catalogIds', 'atomic', 'coldRestartVerified',
        'rollbackBaselineSha256', 'snapshotManifestSha256', 'terminalClosureSha256',
        'terminalInventorySha256', 'runtimeAcceptance']
    : status === 'removed'
      ? ['schemaVersion', 'status', 'planSha256', 'catalogIds', 'atomic', 'coldRestartVerified',
          'rollbackBaselineSha256', 'snapshotManifestSha256', 'terminalClosureSha256',
          'terminalInventorySha256', 'removalVerified']
      : [];
  exactObjectKeys(stateRecord.value, stateKeys, 'source transaction state');
  const { planSha256, catalogIds, plan } = planRecord.value;
  if (planRecord.value.schemaVersion !== 1 || baselineRecord.value.schemaVersion !== 1 ||
      stateRecord.value.schemaVersion !== 1 || !/^[a-f0-9]{64}$/u.test(planSha256 ?? '') ||
      !Array.isArray(catalogIds) || catalogIds.length === 0 ||
      catalogIds.some((id) => !Number.isInteger(id) || id < 3000 || id > 3999) ||
      JSON.stringify(stateRecord.value.catalogIds) !== JSON.stringify(catalogIds) ||
      stateRecord.value.planSha256 !== planSha256 || stateRecord.value.coldRestartVerified !== true ||
      stateRecord.value.atomic !== (catalogIds.length > 1) ||
      !/^[a-f0-9]{64}$/u.test(stateRecord.value.terminalClosureSha256 ?? '') ||
      !/^[a-f0-9]{64}$/u.test(stateRecord.value.terminalInventorySha256 ?? '') ||
      (status === 'removed' && stateRecord.value.removalVerified !== true)) {
    fail('source transaction state does not match its plan');
  }
  const canonicalPlanSha256 = sha256(Buffer.from(`${JSON.stringify(stable(plan))}\n`, 'utf8'));
  if (canonicalPlanSha256 !== planSha256 ||
      !['install', 'remove'].includes(plan?.action) ||
      (status === 'committed' && plan.action !== 'install') ||
      (status === 'removed' && plan.action !== 'remove') ||
      JSON.stringify(plan.plugins?.map((plugin) => plugin.catalogId)) !== JSON.stringify(catalogIds)) {
    fail('source transaction plan digest or action mismatch');
  }
  if (sha256(baselineRecord.bytes) !== stateRecord.value.rollbackBaselineSha256) {
    fail('source rollback baseline digest mismatch');
  }
  const snapshot = await canonicalDirectory(join(root, 'snapshot'), 'source transaction snapshot');
  const snapshotManifest = await readPrivateJson(snapshot, 'snapshot.json', 'source snapshot manifest');
  if (sha256(snapshotManifest.bytes) !== stateRecord.value.snapshotManifestSha256) {
    fail('source snapshot manifest digest mismatch');
  }
  exactObjectKeys(
    authenticationRecord.value,
    ['schemaVersion', 'algorithm', 'payload', 'mac'],
    'source recovery authentication'
  );
  const expectedAuthentication = buildRecoveryAuthentication(stateRecord.value, recoveryKey);
  const actualMac = authenticationRecord.value.mac;
  if (authenticationRecord.value.schemaVersion !== 1 ||
      authenticationRecord.value.algorithm !== 'hmac-sha256' ||
      JSON.stringify(authenticationRecord.value.payload) !== JSON.stringify(expectedAuthentication.payload) ||
      !/^[a-f0-9]{64}$/u.test(actualMac ?? '') ||
      !timingSafeEqual(Buffer.from(actualMac, 'hex'), Buffer.from(expectedAuthentication.mac, 'hex'))) {
    fail('source transaction is not authenticated by this DSH_HOME recovery trust root');
  }
  const baselineInventory = normalizeInventory(baselineRecord.value.inventory, 'source baseline plugin inventory');
  const baselineClosure = validateClosureRecord(baselineRecord.value.closure);
  return {
    root,
    snapshot,
    state: stateRecord.value,
    plan,
    planSha256,
    catalogIds,
    baselineInventory,
    baselineClosure,
  };
}

export function buildRecoveryPlan(source) {
  const plan = {
    schemaVersion: 1,
    action: 'recover',
    profile: 'web',
    sourceTransaction: {
      status: source.state.status,
      planSha256: source.planSha256,
      catalogIds: source.catalogIds,
      rollbackBaselineSha256: source.state.rollbackBaselineSha256,
      snapshotManifestSha256: source.state.snapshotManifestSha256,
      terminalClosureSha256: source.state.terminalClosureSha256,
      terminalInventorySha256: source.state.terminalInventorySha256,
    },
    restoreTarget: {
      closureSha256: source.baselineClosure.closureSha256,
      inventorySha256: sha256(Buffer.from(`${JSON.stringify(stable(source.baselineInventory))}\n`, 'utf8')),
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
  const childEnv = await createChildRuntimeEnvironment(transactionRoot, dshHome);
  verifyPnpm(childEnv);
  const currentClosure = await captureProfileClosure(profile);
  const currentInventory = probePluginInventory(harness, childEnv);
  if (currentClosure.closureSha256 !== source.state.terminalClosureSha256 ||
      inventorySha256(currentInventory) !== source.state.terminalInventorySha256) {
    fail('current Profile has drifted from the authenticated source transaction terminal state');
  }
  const snapshot = join(transactionRoot, 'snapshot');
  await privateWrite(join(transactionRoot, 'plan.json'), {
    schemaVersion: 1,
    planSha256,
    catalogIds: source.catalogIds,
    plan,
  });
  const rollbackBaselineSha256 = await privateWrite(join(transactionRoot, 'rollback-baseline.json'), {
    schemaVersion: 1,
    closure: currentClosure,
    inventory: currentInventory,
  });
  await createProfileSnapshot(profile, snapshot);
  const snapshotManifestSha256 = sha256(await readFile(join(snapshot, 'snapshot.json')));
  return runAtomicAcceptanceBoundary(async () => {
    const recovery = await restoreAndVerifyBaseline({
      baselineClosure: source.baselineClosure,
      baselineInventory: source.baselineInventory,
      childEnv,
      harness,
      profile,
      snapshot: source.snapshot,
    });
    if (!rollbackIsComplete(recovery)) fail('source transaction recovery verification failed');
    const state = {
      schemaVersion: 1,
      status: 'recovered',
      planSha256,
      sourcePlanSha256: source.planSha256,
      catalogIds: source.catalogIds,
      coldRestartVerified: true,
      rollbackBaselineSha256,
      snapshotManifestSha256,
      recoveryVerified: true,
    };
    await privateWrite(join(transactionRoot, 'state.json'), state);
    return { state, transactionRoot, snapshot };
  }, () => restoreAndVerifyBaseline({
    baselineClosure: currentClosure,
    baselineInventory: currentInventory,
    childEnv,
    harness,
    profile,
    snapshot,
  }));
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
          ...result.state,
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
          ...result.state,
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
          ...result.state,
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
