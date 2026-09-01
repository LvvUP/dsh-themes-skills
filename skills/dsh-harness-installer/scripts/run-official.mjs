#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  lstat,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rm,
} from 'node:fs/promises';
import os from 'node:os';
import {
  basename,
  isAbsolute,
  join,
  parse,
  relative,
  resolve,
} from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  createProfileSnapshot,
  verifyProfileSnapshot,
} from '../../dsh-plugin-installer/scripts/profile-snapshot.mjs';
import { loadAuthority, validateInstallReceipt } from './authority.mjs';

const INSTALL_BASENAME = 'dsh-v0.1.2-alpha.2-npm';

function fail(message) {
  throw new Error(message);
}

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

async function canonicalInstall(input, authority) {
  if (!isAbsolute(input)) fail('--install must be absolute');
  const install = resolve(input);
  const info = await lstat(install);
  if (!info.isDirectory() || info.isSymbolicLink() ||
      await realpath(install) !== install || basename(install) !== INSTALL_BASENAME) {
    fail('--install must be the exact versioned real runtime directory');
  }
  try {
    await lstat(join(install, '.dsh-install-incomplete'));
    fail('official runtime installation is incomplete');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const home = await realpath(os.homedir());
  const insideHome = relative(home, install);
  if (insideHome === '' || insideHome.startsWith('..') || isAbsolute(insideHome)) {
    fail('--install must remain below the current user home');
  }
  const lockfile = await readFile(join(install, 'pnpm-lock.yaml'));
  if (sha256(lockfile) !== authority.runtimeInstall.lockfileSha256) {
    fail('installed runtime lockfile differs from authority');
  }
  return install;
}

async function privateInstallReceipt(input, authority) {
  if (!isAbsolute(input)) fail('--receipt must be absolute');
  const receiptPath = resolve(input);
  const info = await lstat(receiptPath);
  if (!info.isFile() || info.isSymbolicLink() || info.size < 2 || info.size > 1_048_576) {
    fail('--receipt must be one bounded regular file');
  }
  const bytes = await readFile(receiptPath);
  let value;
  try {
    value = JSON.parse(bytes);
  } catch {
    fail('--receipt must be JSON');
  }
  if (!bytes.equals(Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf8'))) {
    fail('--receipt must retain its canonical private bytes');
  }
  const receipt = validateInstallReceipt(value, authority);
  if (receipt.toolchain.platform !== process.platform ||
      receipt.toolchain.arch !== process.arch ||
      receipt.toolchain.nodeVersion !== process.versions.node) {
    fail('install receipt does not match the current platform and Node tuple');
  }
  return receipt;
}

async function verifiedCli(install, receipt, authority) {
  const linked = join(install, authority.runtimeInstall.installedCliPath);
  const cli = await realpath(linked);
  const insideInstall = relative(install, cli);
  const info = await lstat(cli);
  if (insideInstall.startsWith('..') || isAbsolute(insideInstall) ||
      !info.isFile() || info.isSymbolicLink() ||
      sha256(await readFile(cli)) !== receipt.result.installedCliSha256) {
    fail('installed official CLI bytes differ from the private receipt');
  }
  return cli;
}

async function prepareProfileBackup(options) {
  if (!isAbsolute(options.dshHome)) fail('--dsh-home must be absolute');
  const requested = resolve(options.dshHome);
  if (requested === parse(requested).root || requested === await realpath(os.homedir())) {
    fail('--dsh-home cannot be a filesystem root or the user home');
  }
  const info = await lstat(requested);
  if (!info.isDirectory() || info.isSymbolicLink() || await realpath(requested) !== requested) {
    fail('--dsh-home must be a canonical real directory');
  }
  const profile = join(requested, 'profiles', 'web');
  try {
    const profileInfo = await lstat(profile);
    if (!profileInfo.isDirectory() || profileInfo.isSymbolicLink()) {
      fail('existing web Profile must be a real directory');
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    const entries = await readdir(requested);
    if (entries.length !== 0) {
      fail('a non-empty DSH_HOME without a valid web Profile cannot be switched automatically');
    }
    if (options.snapshot !== undefined) {
      fail('--snapshot is accepted only when an existing web Profile is backed up');
    }
    return { dshHome: requested, snapshotCreated: false };
  }
  if (!options.snapshot || !isAbsolute(options.snapshot)) {
    fail('an existing web Profile requires one new absolute --snapshot directory');
  }
  await createProfileSnapshot(requested, profile, options.snapshot);
  await verifyProfileSnapshot(requested, profile, options.snapshot);
  return { dshHome: requested, snapshotCreated: true };
}

export function parseRunArgs(argv) {
  const separator = argv.indexOf('--');
  if (separator < 0 || separator === argv.length - 1) {
    fail('usage: run-official.mjs --install <absolute> --receipt <absolute> [--dsh-home <absolute> --snapshot <new-absolute>] -- <dsh-args>');
  }
  const options = {};
  const optionNames = {
    '--install': 'install',
    '--receipt': 'receipt',
    '--dsh-home': 'dshHome',
    '--snapshot': 'snapshot',
  };
  for (let index = 0; index < separator; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    const name = optionNames[key];
    if (!value || !name || Object.hasOwn(options, name)) {
      fail('invalid official runtime option');
    }
    options[name] = value;
  }
  if (!options.install || !options.receipt) fail('--install and --receipt are required');
  const dshArgs = argv.slice(separator + 1);
  if (dshArgs[0] === '--version') {
    if (dshArgs.length !== 1 || options.dshHome || options.snapshot) {
      fail('--version accepts no additional DSH or Profile options');
    }
  } else if (JSON.stringify(dshArgs) !== JSON.stringify(['web', '--no-open'])) {
    fail('official runtime runner permits only --version or the exact loopback web --no-open launch');
  } else if (!options.dshHome) {
    fail('web launch requires an explicit --dsh-home');
  }
  return { ...options, dshArgs };
}

export async function runOfficial(options) {
  const authority = await loadAuthority();
  const install = await canonicalInstall(options.install, authority);
  const receipt = await privateInstallReceipt(options.receipt, authority);
  const cli = await verifiedCli(install, receipt, authority);
  let profile;
  if (options.dshArgs[0] === 'web') profile = await prepareProfileBackup(options);
  await verifiedCli(install, receipt, authority);
  const environment = { ...process.env };
  const forbiddenNodeEnvironment = new Set([
    'DSH_HOME', 'NODE_OPTIONS', 'NODE_PATH', 'NODE_REPL_EXTERNAL_MODULE',
  ]);
  for (const name of Object.keys(environment)) {
    if (forbiddenNodeEnvironment.has(name.toUpperCase())) delete environment[name];
  }
  const inspectionHome = profile
    ? undefined
    : await mkdtemp(join(os.tmpdir(), 'dsh-alpha2-version-home-'));
  try {
    environment.DSH_HOME = profile ? profile.dshHome : inspectionHome;
    const child = spawnSync(process.execPath, [cli, ...options.dshArgs], {
      cwd: install,
      env: environment,
      stdio: 'inherit',
      shell: false,
      windowsHide: true,
    });
    await verifiedCli(install, receipt, authority);
    if (child.error) throw child.error;
    return child.status ?? 1;
  } finally {
    if (inspectionHome) await rm(inspectionHome, { recursive: true, force: true });
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = await runOfficial(parseRunArgs(process.argv.slice(2)));
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
