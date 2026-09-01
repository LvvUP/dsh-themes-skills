#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  open,
  readFile,
  realpath,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import {
  basename,
  dirname,
  isAbsolute,
  join,
  parse,
  relative,
  resolve,
  sep,
} from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  loadAuthority,
  validateInstallReceipt,
} from './authority.mjs';
import { materializePnpmToolchain } from './pnpm-toolchain.mjs';

const skillRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const INSTALL_BASENAME = 'dsh-v0.1.2-alpha.2-npm';
const MAX_TARBALL_BYTES = 1024 * 1024;

function fail(message) {
  throw new Error(message);
}

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const sri512 = (bytes) =>
  `sha512-${createHash('sha512').update(bytes).digest('base64')}`;

async function absent(path, label) {
  try {
    await lstat(path);
    fail(`${label} must not already exist`);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

async function ensurePrivateHomeSubdirectory(home, requested) {
  const relation = relative(home, requested);
  if (relation === '' || relation.startsWith('..') || isAbsolute(relation)) {
    fail('--output must be below a real subdirectory of the current user home');
  }
  let current = home;
  for (const part of relation.split(sep)) {
    current = join(current, part);
    try {
      await mkdir(current, { mode: 0o700 });
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }
    const info = await lstat(current);
    if (!info.isDirectory() || info.isSymbolicLink()) {
      fail('--output ancestry must contain real directories only');
    }
    if (process.platform !== 'win32' && (info.mode & 0o022) !== 0) {
      fail('--output ancestry must not be group- or world-writable');
    }
  }
  return realpath(current);
}

async function safeUserDestination(input) {
  if (!isAbsolute(input)) fail('--output must be an absolute path');
  const requested = resolve(input);
  if (requested === parse(requested).root || basename(requested) !== INSTALL_BASENAME) {
    fail(`--output must end in the versioned directory ${INSTALL_BASENAME}`);
  }
  const home = await realpath(os.homedir());
  const parentInput = dirname(requested);
  const parent = await ensurePrivateHomeSubdirectory(home, parentInput);
  const parentInfo = await lstat(parentInput);
  const insideHome = relative(home, parent);
  if (!parentInfo.isDirectory() || parentInfo.isSymbolicLink() || insideHome === '' ||
      insideHome.startsWith('..') || isAbsolute(insideHome)) {
    fail('--output must be below a real subdirectory of the current user home');
  }
  const output = join(parent, INSTALL_BASENAME);
  await absent(output, '--output');
  return { output, parent };
}

async function receiptDestination(input, output) {
  if (!isAbsolute(input)) fail('--receipt must be an absolute path');
  const requested = resolve(input);
  if (requested === parse(requested).root) fail('--receipt cannot be a filesystem root');
  const parentInput = dirname(requested);
  const parentInfo = await lstat(parentInput);
  if (!parentInfo.isDirectory() || parentInfo.isSymbolicLink()) {
    fail('--receipt parent must be an existing real directory');
  }
  const parent = await realpath(parentInput);
  const receipt = join(parent, basename(requested));
  const relation = relative(output, receipt);
  if (relation === '' || (!relation.startsWith('..') && !isAbsolute(relation))) {
    fail('--receipt must be outside the versioned runtime directory');
  }
  await absent(receipt, '--receipt');
  return receipt;
}

async function verifiedRuntimeAssets(authority) {
  const assetRoot = join(skillRoot, authority.runtimeInstall.assetDirectory);
  const names = ['package.json', 'pnpm-workspace.yaml', 'pnpm-lock.yaml'];
  const expected = [
    authority.runtimeInstall.packageJsonSha256,
    authority.runtimeInstall.workspaceSha256,
    authority.runtimeInstall.lockfileSha256,
  ];
  const result = new Map();
  for (const [index, name] of names.entries()) {
    const filename = join(assetRoot, name);
    const info = await lstat(filename);
    const bytes = await readFile(filename);
    if (!info.isFile() || info.isSymbolicLink() || sha256(bytes) !== expected[index]) {
      fail(`bundled runtime ${name} differs from authority`);
    }
    result.set(name, bytes);
  }
  const manifest = JSON.parse(result.get('package.json').toString('utf8'));
  if (manifest.name !== 'dsh-official-runtime-0.1.2-alpha.2' ||
      manifest.private !== true || manifest.packageManager !== 'pnpm@11.7.0' ||
      manifest.dependencies?.['@deepseek-ai/dsh'] !== authority.release.version ||
      Object.hasOwn(manifest, 'scripts')) {
    fail('bundled official runtime manifest differs from the closed contract');
  }
  return result;
}

async function verifyOfficialTarball(authority) {
  const response = await fetch(authority.officialNpm.tarballUrl, {
    headers: { accept: 'application/octet-stream' },
    redirect: 'error',
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok || response.url !== authority.officialNpm.tarballUrl) {
    fail('official npm tarball request did not resolve to the exact authority URL');
  }
  const length = Number(response.headers.get('content-length'));
  if (!Number.isSafeInteger(length) || length < 1 || length > MAX_TARBALL_BYTES) {
    fail('official npm tarball Content-Length is missing or outside policy');
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length !== length || sha256(bytes) !== authority.officialNpm.tarballSha256 ||
      sri512(bytes) !== authority.officialNpm.distIntegrity) {
    fail('official npm tarball bytes differ from the pinned digest and integrity');
  }
  return bytes;
}

export function packageManagerEnvironment(privateRoot) {
  const environment = {
    HOME: privateRoot,
    LANG: 'C',
    LC_ALL: 'C',
    NO_COLOR: '1',
    NPM_CONFIG_CACHE: join(privateRoot, 'npm-cache'),
    NPM_CONFIG_IGNORE_SCRIPTS: 'true',
    NPM_CONFIG_REGISTRY: 'https://registry.npmjs.org/',
    NPM_CONFIG_USERCONFIG: join(privateRoot, 'empty.npmrc'),
    PATH: dirname(process.execPath),
    PNPM_HOME: join(privateRoot, 'pnpm-home'),
    TZ: 'UTC',
    XDG_CACHE_HOME: join(privateRoot, 'xdg-cache'),
    XDG_CONFIG_HOME: join(privateRoot, 'xdg-config'),
  };
  for (const name of [
    'SystemRoot', 'SYSTEMROOT', 'WINDIR', 'COMSPEC', 'PATHEXT',
    'TEMP', 'TMP', 'TMPDIR',
  ]) {
    if (typeof process.env[name] === 'string') environment[name] = process.env[name];
  }
  return environment;
}

function runNode(entrypoint, args, options) {
  const result = spawnSync(process.execPath, [entrypoint, ...args], {
    cwd: options.cwd,
    encoding: options.capture ? 'utf8' : undefined,
    env: options.environment,
    shell: false,
    stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    timeout: options.timeout ?? 10 * 60_000,
    windowsHide: true,
  });
  if (result.error || result.status !== 0) {
    const detail = options.capture
      ? (result.stderr || result.stdout || '').trim().slice(0, 500)
      : '';
    fail(`${options.label} failed${detail ? `: ${detail}` : ''}`);
  }
  return options.capture ? result.stdout.trim() : '';
}

async function verifyInstalledRuntime(staging, authority, environment) {
  const lockfile = await readFile(join(staging, 'pnpm-lock.yaml'));
  if (sha256(lockfile) !== authority.runtimeInstall.lockfileSha256) {
    fail('runtime lockfile changed during frozen installation');
  }
  const linkedCli = join(staging, authority.runtimeInstall.installedCliPath);
  const cli = await realpath(linkedCli);
  const inside = relative(staging, cli);
  const info = await lstat(cli);
  const bytes = await readFile(cli);
  if (inside.startsWith('..') || isAbsolute(inside) || !info.isFile() ||
      info.isSymbolicLink() || sha256(bytes) !== authority.officialNpm.cliSha256) {
    fail('installed CLI does not match the exact official npm bytes');
  }
  const packageRoot = dirname(dirname(cli));
  const manifest = JSON.parse(await readFile(join(packageRoot, 'package.json'), 'utf8'));
  if (manifest.name !== authority.officialNpm.packageName ||
      manifest.version !== authority.officialNpm.version ||
      Object.keys(manifest.scripts ?? {}).some((name) =>
        ['preinstall', 'install', 'postinstall', 'prepare'].includes(name))) {
    fail('installed official package identity or lifecycle surface differs');
  }
  const reported = runNode(cli, ['--version'], {
    capture: true,
    cwd: staging,
    environment,
    label: 'official CLI version check',
    timeout: 30_000,
  });
  if (!reported.includes(authority.release.version)) {
    fail('official CLI did not report the pinned alpha.2 version');
  }
  return { cli, cliSha256: sha256(bytes) };
}

async function writePrivateReceipt(receiptPath, receipt) {
  let handle;
  let created = false;
  try {
    handle = await open(receiptPath, 'wx', 0o600);
    created = true;
    await handle.writeFile(`${JSON.stringify(receipt, null, 2)}\n`);
    await handle.sync();
    if (process.platform !== 'win32') await handle.chmod(0o600);
    await handle.close();
    handle = undefined;
    created = false;
  } finally {
    if (handle) await handle.close();
    if (created) await rm(receiptPath, { force: true });
  }
}

export async function installOfficial({ output: outputInput, receipt: receiptInput }, authority) {
  const { output, parent } = await safeUserDestination(outputInput);
  const receiptPath = await receiptDestination(receiptInput, output);
  const nodeVersion = process.versions.node;
  if (!authority.runtimeMatrix.nodeVersions.includes(nodeVersion) ||
      ![['linux', 'x64'], ['darwin', 'arm64'], ['win32', 'x64']].some(
        ([platform, arch]) => process.platform === platform && process.arch === arch
      )) {
    fail('official install requires one exact certified platform/Node tuple');
  }
  const assets = await verifiedRuntimeAssets(authority);
  const verifiedTarball = await verifyOfficialTarball(authority);
  const staging = process.platform === 'win32'
    ? output
    : await mkdtemp(join(parent, '.dsh-alpha2-npm-install-'));
  const installingMarker = join(staging, '.dsh-install-incomplete');
  let promoted = false;
  try {
    if (process.platform === 'win32') await mkdir(staging, { mode: 0o700 });
    else await chmod(staging, 0o700);
    await writeFile(installingMarker, 'incomplete\n', { flag: 'wx', mode: 0o600 });
    for (const [name, bytes] of assets) {
      await writeFile(join(staging, name), bytes, { flag: 'wx', mode: 0o600 });
    }
    const privateRoot = join(staging, '.install-private');
    await mkdir(privateRoot, { mode: 0o700 });
    await writeFile(join(privateRoot, 'empty.npmrc'), '', { flag: 'wx', mode: 0o600 });
    await writeFile(join(privateRoot, 'verified-official.tgz'), verifiedTarball, {
      flag: 'wx',
      mode: 0o600,
    });
    const toolchain = await materializePnpmToolchain(join(privateRoot, 'pnpm'));
    const environment = packageManagerEnvironment(privateRoot);
    const pnpmVersion = runNode(toolchain.cli, ['--version'], {
      capture: true,
      cwd: staging,
      environment,
      label: 'private pnpm version check',
      timeout: 30_000,
    });
    if (pnpmVersion !== authority.runtimeInstall.packageManagerVersion) {
      fail('private pnpm version differs from authority');
    }
    const storeDir = join(privateRoot, 'pnpm-store');
    runNode(toolchain.cli, [
      'fetch', '--frozen-lockfile', '--ignore-scripts',
      '--registry=https://registry.npmjs.org/',
      `--store-dir=${storeDir}`,
      '--verify-store-integrity=true',
    ], {
      capture: false,
      cwd: staging,
      environment,
      label: 'frozen official npm dependency fetch',
    });
    runNode(toolchain.cli, [
      ...authority.runtimeInstall.installArgs,
      '--offline',
      `--store-dir=${storeDir}`,
      '--verify-store-integrity=true',
    ], {
      capture: false,
      cwd: staging,
      environment,
      label: 'frozen official npm dependency installation',
    });
    const installed = await verifyInstalledRuntime(staging, authority, environment);
    await rm(privateRoot, { recursive: true, force: true });
    if (process.platform !== 'win32') await rename(staging, output);
    promoted = true;
    const finalCli = await realpath(join(output, authority.runtimeInstall.installedCliPath));
    const finalRelation = relative(output, finalCli);
    const finalInfo = await lstat(finalCli);
    if (finalRelation.startsWith('..') || isAbsolute(finalRelation) ||
        !finalInfo.isFile() || finalInfo.isSymbolicLink() ||
        sha256(await readFile(finalCli)) !== installed.cliSha256) {
      fail('installed CLI did not survive final placement');
    }
    await rm(join(output, '.dsh-install-incomplete'));
    const receipt = validateInstallReceipt({
      schemaVersion: 1,
      status: 'official-npm-install-passed',
      scope: 'one-machine-versioned-user-install',
      package: {
        name: authority.officialNpm.packageName,
        version: authority.officialNpm.version,
        distIntegrity: authority.officialNpm.distIntegrity,
        tarballSha256: authority.officialNpm.tarballSha256,
        cliSha256: authority.officialNpm.cliSha256,
      },
      resolution: {
        lockfileSha256: authority.runtimeInstall.lockfileSha256,
        frozenLockfile: true,
        lifecycleScriptsRun: false,
        peerPolicy: 'upstream-compatible-locked-resolution',
      },
      toolchain: {
        platform: process.platform,
        arch: process.arch,
        nodeVersion,
        packageManager: authority.runtimeInstall.packageManager,
        packageManagerVersion: pnpmVersion,
      },
      result: {
        installedCliPath: authority.runtimeInstall.installedCliPath,
        installedCliSha256: installed.cliSha256,
        reportedVersion: authority.release.version,
        pathInstalled: false,
        versionedDirectory: true,
      },
      provenanceBoundary: {
        npmGitHeadPresent: false,
        npmProvenanceAttestationPresent: false,
        sourceCommitBoundToNpmArtifact: false,
        binarySourceEquivalenceClaimed: false,
      },
      privacy: {
        capturesProcessOutput: false,
        capturesEnvironment: false,
        capturesBrowserCredentials: false,
        capturesCredentialDerivedDigest: false,
        capturesInstallPath: false,
      },
    }, authority);
    await writePrivateReceipt(receiptPath, receipt);
    return {
      status: receipt.status,
      installRoot: '<versioned-user-directory>',
      receiptPath: '<private-local-receipt>',
      pathInstalled: false,
    };
  } catch (error) {
    if (promoted) await rm(output, { recursive: true, force: true });
    else await rm(staging, { recursive: true, force: true });
    throw error;
  }
}

export function parseInstallArgs(argv) {
  if (argv.length !== 4) {
    fail('usage: install-official.mjs --output <versioned-user-directory> --receipt <new-private-json>');
  }
  const options = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!['--output', '--receipt'].includes(key) || !value || options[key]) {
      fail('usage: install-official.mjs --output <versioned-user-directory> --receipt <new-private-json>');
    }
    options[key] = value;
  }
  return { output: options['--output'], receipt: options['--receipt'] };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const result = await installOfficial(
      parseInstallArgs(process.argv.slice(2)),
      await loadAuthority()
    );
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
