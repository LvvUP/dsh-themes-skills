#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstat, mkdir, open, readFile, realpath } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, parse, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadAuthority, validateBuildReceipt } from './authority.mjs';
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
    encoding: options.capture ? 'utf8' : undefined,
    stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    shell: process.platform === 'win32' && /\.cmd$/i.test(command),
  });
  if (result.status !== 0) {
    const detail = options.capture ? (result.stderr || result.stdout || '').trim() : '';
    fail(`${options.label ?? command} failed${detail ? `: ${detail}` : ''}`);
  }
  return options.capture ? result.stdout.trim() : '';
}

async function corepackPath() {
  const name = process.platform === 'win32' ? 'corepack.cmd' : 'corepack';
  const candidate = resolve(dirname(process.execPath), name);
  const candidateStat = await lstat(candidate);
  if (!candidateStat.isFile() && !candidateStat.isSymbolicLink()) {
    fail('the Node-adjacent corepack shim is unavailable');
  }
  const target = await realpath(candidate);
  const targetStat = await lstat(target);
  const nodeDirectory = dirname(await realpath(process.execPath));
  const nodeRoot = process.platform === 'win32' ? nodeDirectory : dirname(nodeDirectory);
  const inside = relative(nodeRoot, target);
  if (!targetStat.isFile() || inside.startsWith('..') || isAbsolute(inside)) {
    fail('the Node-adjacent corepack shim escapes the active Node installation');
  }
  return candidate;
}

async function receiptDestination(input) {
  if (!isAbsolute(input)) fail('--receipt must be an absolute path');
  const requested = resolve(input);
  if (requested === parse(requested).root) fail('--receipt cannot be a filesystem root');
  const parent = dirname(requested);
  await mkdir(parent, { recursive: true, mode: 0o700 });
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
  const corepack = await corepackPath();
  const pnpm = `pnpm@${authority.source.packageManagerVersion}`;
  const pnpmVersion = run(corepack, [pnpm, '--version'], { capture: true, label: 'pinned pnpm version check' });
  if (pnpmVersion !== authority.source.packageManagerVersion) fail('Corepack did not resolve pinned pnpm 11.7.0');

  run(corepack, [pnpm, ...authority.source.installArgs], {
    cwd: verified.source,
    label: 'frozen source dependency installation',
  });
  run(corepack, [pnpm, 'run', authority.source.buildScript], {
    cwd: verified.source,
    label: 'pinned source build',
  });

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
    fail('source-built CLI did not report alpha.1');
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
  const handle = await open(receiptPath, 'wx', 0o600);
  try {
    await handle.writeFile(`${JSON.stringify(receipt, null, 2)}\n`);
  } finally {
    await handle.close();
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
