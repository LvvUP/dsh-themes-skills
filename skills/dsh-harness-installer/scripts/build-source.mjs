#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstat, mkdtemp, open, readFile, realpath, rm } from 'node:fs/promises';
import os from 'node:os';
import { basename, dirname, isAbsolute, join, parse, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadAuthority, validateBuildReceipt } from './authority.mjs';
import { packageManagerEnvironment } from './install-official.mjs';
import { materializePnpmToolchain } from './pnpm-toolchain.mjs';
import { verifySourceCheckout } from './verify-source.mjs';

function fail(message) {
  throw new Error(message);
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    env: options.environment,
    encoding: options.capture ? 'utf8' : undefined,
    stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    shell: false,
  });
  if (result.status !== 0) {
    const detail = options.capture ? (result.stderr || result.stdout || '').trim() : '';
    fail(`${options.label ?? command} failed${detail ? `: ${detail}` : ''}`);
  }
  return options.capture ? result.stdout.trim() : '';
}

async function receiptDestination(input) {
  if (!isAbsolute(input)) fail('--receipt must be an absolute path');
  const requested = resolve(input);
  if (requested === parse(requested).root) fail('--receipt cannot be a filesystem root');
  const parent = dirname(requested);
  const parentInfo = await lstat(parent);
  if (!parentInfo.isDirectory() || parentInfo.isSymbolicLink()) {
    fail('--receipt parent must be an existing real directory');
  }
  const receipt = join(await realpath(parent), basename(requested));
  try {
    await lstat(receipt);
    fail('--receipt must not already exist');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  return receipt;
}

export async function buildSource({ source, receipt: receiptInput }, authority) {
  const verified = await verifySourceCheckout(source, authority);
  const receiptPath = await receiptDestination(receiptInput);
  const receiptInsideSource = relative(verified.source, receiptPath);
  if (receiptInsideSource === '' ||
      (!receiptInsideSource.startsWith('..') && !isAbsolute(receiptInsideSource))) {
    fail('the private build receipt must be outside the source checkout');
  }
  const nodeVersion = process.versions.node;
  if (!authority.runtimeMatrix.nodeVersions.includes(nodeVersion)) {
    fail(`Node ${nodeVersion} is outside the exact 22.19.0/24.15.0 receipt matrix`);
  }
  if (!authority.runtimeMatrix.platforms.includes(process.platform)) {
    fail(`platform ${process.platform} is outside the exact receipt matrix`);
  }
  const privateRoot = await mkdtemp(join(os.tmpdir(), 'dsh-alpha2-source-toolchain-'));
  let pnpmVersion;
  try {
    const toolchain = await materializePnpmToolchain(join(privateRoot, 'pnpm'));
    const environment = packageManagerEnvironment(privateRoot);
    pnpmVersion = run(process.execPath, [toolchain.cli, '--version'], {
      capture: true,
      environment,
      label: 'bundled pnpm version check',
    });
    if (pnpmVersion !== authority.source.packageManagerVersion) {
      fail('bundled pnpm did not match the pinned 11.7.0 authority');
    }
    const storeDir = join(privateRoot, 'pnpm-store');
    run(process.execPath, [toolchain.cli,
      'fetch', '--frozen-lockfile', '--ignore-scripts',
      '--registry=https://registry.npmjs.org/', `--store-dir=${storeDir}`,
      '--verify-store-integrity=true',
    ], {
      cwd: verified.source,
      environment,
      label: 'frozen source dependency fetch',
    });
    run(process.execPath, [toolchain.cli, ...authority.source.installArgs,
      '--offline', `--store-dir=${storeDir}`, '--verify-store-integrity=true',
    ], {
      cwd: verified.source,
      environment,
      label: 'offline frozen source dependency installation',
    });
    run(process.execPath, [toolchain.cli, 'run', authority.source.buildScript], {
      cwd: verified.source,
      environment,
      label: 'pinned source build',
    });
  } finally {
    await rm(privateRoot, { recursive: true, force: true });
  }

  const builtCli = join(verified.source, authority.source.builtCliPath);
  const builtStat = await lstat(builtCli);
  if (!builtStat.isFile() || builtStat.isSymbolicLink()) fail('source build did not create a regular built CLI');
  const builtCliSha256 = sha256(await readFile(builtCli));
  const reported = run(process.execPath, [builtCli, '--version'], {
    cwd: verified.source,
    capture: true,
    label: 'source-built CLI version check',
  });
  if (!new RegExp(`(?:^|[^0-9])${authority.release.version.replaceAll('.', '\\.').replace('-', '\\-')}(?:$|[^0-9])`).test(reported)) {
    fail('source-built CLI did not report alpha.2');
  }

  const receipt = validateBuildReceipt({
    schemaVersion: 1,
    status: 'local-source-build-passed',
    scope: 'one-machine-local-build-only',
    source: {
      tag: authority.release.tag,
      commit: authority.release.commit,
      tree: authority.release.tree,
      lockfileSha256: authority.source.lockfileSha256,
    },
    toolchain: {
      platform: process.platform,
      arch: process.arch,
      nodeVersion,
      packageManager: authority.source.packageManager,
      packageManagerVersion: pnpmVersion,
    },
    result: {
      buildScript: authority.source.buildScript,
      builtCliPath: authority.source.builtCliPath,
      builtCliSha256,
      reportedVersion: authority.release.version,
      pathInstalled: false,
    },
    privacy: {
      capturesProcessOutput: false,
      capturesEnvironment: false,
      capturesBrowserCredentials: false,
      capturesCredentialDerivedDigest: false,
    },
  }, authority);
  let handle;
  let complete = false;
  try {
    handle = await open(receiptPath, 'wx', 0o600);
    await handle.writeFile(`${JSON.stringify(receipt, null, 2)}\n`);
    await handle.sync();
    if (process.platform !== 'win32') await handle.chmod(0o600);
    complete = true;
  } finally {
    if (handle) await handle.close();
    if (!complete) await rm(receiptPath, { force: true });
  }
  return { receipt, receiptPath: '<local-private-receipt>', officialBinary: false, pathInstalled: false };
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!value || !['--source', '--receipt'].includes(key)) fail('usage: build-source.mjs --source <absolute-checkout> --receipt <new-absolute-json>');
    options[key.slice(2)] = value;
  }
  if (!options.source || !options.receipt || Object.keys(options).length !== 2) {
    fail('usage: build-source.mjs --source <absolute-checkout> --receipt <new-absolute-json>');
  }
  return options;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const result = await buildSource(parseArgs(process.argv.slice(2)), await loadAuthority());
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
