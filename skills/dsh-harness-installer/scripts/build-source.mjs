#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { constants as fsConstants } from 'node:fs';
import {
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  open,
  readFile,
  readdir,
  realpath,
  rm,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import {
  basename,
  delimiter,
  dirname,
  isAbsolute,
  join,
  parse,
  relative,
  resolve,
  win32,
} from 'node:path';
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

const sourcePnpmCommandBrand = Symbol('sourcePnpmCommand');
const lifecyclePnpmCommandBrand = Symbol('lifecyclePnpmCommand');

function sourcePnpmWrapperBytes(platform = process.platform) {
  return Buffer.from(platform === 'win32'
    ? '@ECHO OFF\r\nSETLOCAL DisableDelayedExpansion\r\n"%DSH_BUILD_PNPM_NODE%" "%DSH_BUILD_PNPM_CLI%" %*\r\nEXIT /B %ERRORLEVEL%\r\n'
    : '#!/bin/sh\nset -eu\nexec "$DSH_BUILD_PNPM_NODE" "$DSH_BUILD_PNPM_CLI" "$@"\n');
}

export function sourceBuildPath(bin, nodeDirectory) {
  if (typeof bin !== 'string' || typeof nodeDirectory !== 'string' ||
      bin.length === 0 || nodeDirectory.length === 0 ||
      bin.includes('\0') || nodeDirectory.includes('\0') ||
      bin.includes(delimiter) || nodeDirectory.includes(delimiter)) {
    fail('source-build PATH components are malformed');
  }
  const value = [bin, nodeDirectory].join(delimiter);
  if (JSON.stringify(value.split(delimiter)) !==
      JSON.stringify([bin, nodeDirectory])) {
    fail('source-build PATH is not the exact private two-entry path');
  }
  return value;
}

export function sourceBuildRootPath(source) {
  if (typeof source !== 'string' || source.length === 0 ||
      source.includes('\0') || source.includes(delimiter)) {
    fail('source-build root is unsafe for lifecycle PATH construction');
  }
  return source;
}

function requireWindowsWrapperSafePath(value, label) {
  if (process.platform === 'win32' &&
      (typeof value !== 'string' || /["%!^&|<>\r\n]/u.test(value))) {
    fail(`${label} is unsafe for the fixed Windows pnpm wrapper`);
  }
}

function loadedWindowsSystemRoot() {
  let sharedObjects;
  try {
    sharedObjects = process.report?.getReport?.().sharedObjects;
  } catch {
    sharedObjects = undefined;
  }
  if (!Array.isArray(sharedObjects)) {
    fail('trusted Windows system libraries are unavailable');
  }
  const roots = sharedObjects.flatMap((loadedPath) => {
    if (typeof loadedPath !== 'string') return [];
    const library = win32.basename(loadedPath).toLowerCase();
    if (!['kernel32.dll', 'kernelbase.dll', 'ntdll.dll'].includes(library)) {
      return [];
    }
    const systemDirectory = win32.dirname(loadedPath);
    if (!['system32', 'syswow64'].includes(
      win32.basename(systemDirectory).toLowerCase()
    )) return [];
    return [win32.dirname(systemDirectory)];
  });
  const identities = new Set(roots.map((root) =>
    win32.normalize(root).replace(/\\+$/u, '').toLowerCase()));
  if (roots.length === 0 || identities.size !== 1) {
    fail('trusted Windows system roots are missing or disagree');
  }
  return win32.normalize(roots[0]);
}

async function trustedScriptShell() {
  const requested = process.platform === 'win32'
    ? win32.join(loadedWindowsSystemRoot(), 'System32', 'cmd.exe')
    : '/bin/sh';
  const shell = await realpath(requested);
  if (process.platform === 'win32' &&
      win32.basename(shell).toLowerCase() !== 'cmd.exe') {
    fail('source-build script shell is not one trusted regular file');
  }
  requireWindowsWrapperSafePath(shell, 'trusted command processor');
  return Object.freeze({
    identity: await stableRegularFileIdentity(shell, 'source-build script shell'),
    path: shell,
    systemRoot: process.platform === 'win32'
      ? win32.dirname(win32.dirname(shell))
      : null,
  });
}

function inside(root, target) {
  const relation = relative(root, target);
  return relation !== '' && !relation.startsWith('..') && !isAbsolute(relation);
}

export async function requireFreshSourceDependencyTree(source) {
  sourceBuildRootPath(source);
  async function inspect(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.name === '.git') continue;
      if (entry.name.toLowerCase() === 'node_modules') {
        fail('source build requires a checkout without any existing node_modules');
      }
      if (entry.isDirectory()) await inspect(join(directory, entry.name));
    }
  }
  await inspect(source);
}

export async function verifyNoLifecycleToolShadow(source, allowedPnpmCommand) {
  sourceBuildRootPath(source);
  const lifecycleBins = [
    join(source, 'node_modules', '.bin'),
    join(source, 'node_modules', '.pnpm', 'node_modules', '.bin'),
  ];
  for (const bin of lifecycleBins) {
    let entries;
    try {
      entries = await readdir(bin, { withFileTypes: true });
    } catch (error) {
      if (error.code === 'ENOENT') continue;
      throw error;
    }
    for (const entry of entries) {
      if (!/^(?:git|node|npm|pnpm)(?:\..+)?$/iu.test(entry.name)) continue;
      const candidate = join(bin, entry.name);
      if (allowedPnpmCommand?.[lifecyclePnpmCommandBrand] === true &&
          candidate === allowedPnpmCommand.wrapper && entry.isFile()) {
        continue;
      }
      fail('frozen dependency bins contain a command that shadows build authority');
    }
  }
}

async function verifyLifecyclePnpmCommand(command) {
  if (command?.[lifecyclePnpmCommandBrand] !== true) {
    fail('source build requires its lifecycle pnpm command binding');
  }
  await verifyNoLifecycleToolShadow(command.source, command);
  await verifyStablePrivateFile(
    command.wrapper,
    sourcePnpmWrapperBytes(),
    0o700
  );
}

export async function createLifecyclePnpmCommand(source) {
  sourceBuildRootPath(source);
  await verifyNoLifecycleToolShadow(source);
  const bin = join(source, 'node_modules', '.bin');
  const canonicalBin = await realpath(bin);
  const binInfo = await lstat(bin);
  if (canonicalBin !== bin || !binInfo.isDirectory() || binInfo.isSymbolicLink() ||
      !inside(source, canonicalBin)) {
    fail('root lifecycle bin is not one real directory inside the source');
  }
  const wrapper = join(bin, process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm');
  let wrapperCreated = false;
  try {
    await writeFile(wrapper, sourcePnpmWrapperBytes(), {
      flag: 'wx',
      mode: 0o700,
    });
    wrapperCreated = true;
    if (process.platform !== 'win32') await chmod(wrapper, 0o700);
    const command = Object.freeze({
      source,
      wrapper,
      [lifecyclePnpmCommandBrand]: true,
    });
    await verifyLifecyclePnpmCommand(command);
    return command;
  } catch (error) {
    if (wrapperCreated) {
      try {
        await rm(wrapper, { force: true });
      } catch (cleanupError) {
        throw new AggregateError(
          [error, cleanupError],
          'lifecycle pnpm command creation and cleanup both failed'
        );
      }
    }
    throw error;
  }
}

async function removeLifecyclePnpmCommand(command) {
  await verifyLifecyclePnpmCommand(command);
  await rm(command.wrapper);
}

async function verifyStablePrivateFile(filename, expected, mode) {
  const before = await lstat(filename);
  if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1 ||
      before.size !== expected.length ||
      (process.platform !== 'win32' && (before.mode & 0o777) !== mode)) {
    fail('source-build pnpm command file identity or mode differs');
  }
  const handle = await open(
    filename,
    fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW ?? 0)
  );
  try {
    const first = await handle.stat();
    const bytes = await handle.readFile();
    const last = await handle.stat();
    const after = await lstat(filename);
    if (!bytes.equals(expected) || first.dev !== before.dev ||
        first.ino !== before.ino || last.dev !== before.dev ||
        last.ino !== before.ino || after.dev !== before.dev ||
        after.ino !== before.ino || first.size !== expected.length ||
        last.size !== expected.length) {
      fail('source-build pnpm command file changed while it was verified');
    }
  } finally {
    await handle.close();
  }
}

async function stableRegularFileIdentity(filename, label) {
  const before = await lstat(filename);
  if (!before.isFile() || before.isSymbolicLink()) {
    fail(`${label} is not one regular non-symlink file`);
  }
  const handle = await open(
    filename,
    fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW ?? 0)
  );
  try {
    const first = await handle.stat();
    const last = await handle.stat();
    const after = await lstat(filename);
    if (!first.isFile() || first.dev !== before.dev || first.ino !== before.ino ||
        last.dev !== before.dev || last.ino !== before.ino ||
        after.dev !== before.dev || after.ino !== before.ino ||
        first.size !== before.size || last.size !== before.size ||
        after.size !== before.size) {
      fail(`${label} changed while its file identity was verified`);
    }
    return Object.freeze({ dev: before.dev, ino: before.ino, size: before.size });
  } finally {
    await handle.close();
  }
}

function sameFileIdentity(left, right) {
  return left?.dev === right?.dev && left?.ino === right?.ino &&
    left?.size === right?.size;
}

async function verifySourcePnpmCommand(command) {
  if (command?.[sourcePnpmCommandBrand] !== true) {
    fail('source build requires its private pnpm command binding');
  }
  const [bin, cli, node] = await Promise.all([
    realpath(command.bin),
    realpath(command.cli),
    realpath(command.node),
  ]);
  const scriptShell = await realpath(command.scriptShell);
  const binInfo = await lstat(command.bin);
  const cliInfo = await lstat(command.cli);
  const scriptShellIdentity = await stableRegularFileIdentity(
    command.scriptShell,
    'source-build script shell'
  );
  const entries = await readdir(command.bin, { withFileTypes: true });
  const expectedWrapperName = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
  if (bin !== command.bin || !binInfo.isDirectory() || binInfo.isSymbolicLink() ||
      (process.platform !== 'win32' && (binInfo.mode & 0o777) !== 0o700) ||
      entries.length !== 1 || entries[0].name !== expectedWrapperName ||
      !entries[0].isFile() || command.wrapper !== join(command.bin, expectedWrapperName) ||
      cli !== command.cli || !cliInfo.isFile() || cliInfo.isSymbolicLink() ||
      cliInfo.nlink !== 1 || node !== command.realNode ||
      scriptShell !== command.scriptShell ||
      !sameFileIdentity(scriptShellIdentity, command.scriptShellIdentity) ||
      sha256(await readFile(command.cli)) !== command.cliSha256) {
    fail('source-build pnpm command binding changed after materialization');
  }
  await verifyStablePrivateFile(
    command.wrapper,
    sourcePnpmWrapperBytes(),
    0o700
  );
}

export async function createSourcePnpmCommand(privateRootInput, toolchain) {
  if (!['darwin', 'linux', 'win32'].includes(process.platform) ||
      !isAbsolute(privateRootInput) || !isAbsolute(toolchain?.root) ||
      !isAbsolute(toolchain?.cli)) {
    fail('source-build pnpm command requires certified absolute paths');
  }
  const privateRoot = await realpath(privateRootInput);
  const toolchainRoot = await realpath(toolchain.root);
  const cli = await realpath(toolchain.cli);
  const privateRootInfo = await lstat(privateRootInput);
  const toolchainRootInfo = await lstat(toolchain.root);
  if (!inside(privateRoot, toolchainRoot) || !inside(toolchainRoot, cli)) {
    fail('source-build pnpm toolchain escaped its private root');
  }
  if (!privateRootInfo.isDirectory() || privateRootInfo.isSymbolicLink() ||
      (process.platform !== 'win32' && (privateRootInfo.mode & 0o777) !== 0o700) ||
      toolchainRoot !== toolchain.root || !toolchainRootInfo.isDirectory() ||
      toolchainRootInfo.isSymbolicLink()) {
    fail('source-build pnpm roots are not private real directories');
  }
  const cliInfo = await lstat(cli);
  if (!cliInfo.isFile() || cliInfo.isSymbolicLink() || cliInfo.nlink !== 1) {
    fail('source-build pnpm CLI must be one private regular file');
  }
  requireWindowsWrapperSafePath(process.execPath, 'certified Node path');
  requireWindowsWrapperSafePath(cli, 'private pnpm CLI path');
  const scriptShell = await trustedScriptShell();

  const bin = join(privateRoot, 'source-build-bin');
  await mkdir(bin, { mode: 0o700 });
  if (process.platform !== 'win32') await chmod(bin, 0o700);
  const canonicalBin = await realpath(bin);
  if (canonicalBin !== bin || !inside(privateRoot, canonicalBin)) {
    fail('source-build pnpm command directory escaped its private root');
  }

  const wrapper = join(bin, process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm');
  const wrapperBytes = sourcePnpmWrapperBytes();
  await writeFile(wrapper, wrapperBytes, { flag: 'wx', mode: 0o700 });
  if (process.platform !== 'win32') await chmod(wrapper, 0o700);

  const command = Object.freeze({
    bin: canonicalBin,
    cli,
    cliSha256: sha256(await readFile(cli)),
    node: process.execPath,
    realNode: await realpath(process.execPath),
    scriptShell: scriptShell.path,
    scriptShellIdentity: scriptShell.identity,
    systemRoot: scriptShell.systemRoot,
    wrapper,
    [sourcePnpmCommandBrand]: true,
  });
  await verifySourcePnpmCommand(command);
  return command;
}

export function sourceBuildEnvironment(
  privateRoot,
  verifiedCommit,
  authorityCommit,
  pnpmCommand
) {
  if (verifiedCommit !== authorityCommit) {
    fail('verified source commit differs from the build authority');
  }
  if (pnpmCommand?.[sourcePnpmCommandBrand] !== true) {
    fail('source build requires its private pnpm command binding');
  }
  const environment = {
    ...packageManagerEnvironment(privateRoot),
    DSH_BUILD_PNPM_CLI: pnpmCommand.cli,
    DSH_BUILD_PNPM_NODE: pnpmCommand.node,
    // Upstream otherwise shells out to Git while deriving client build
    // metadata. Keep Git outside the restricted PATH and provide only the
    // exact commit that verifySourceCheckout already proved.
    DSH_CLIENT_COMMIT_HASH: authorityCommit,
    // The fixed upstream build:web script invokes the package manager by
    // command name. Resolve that name only through the private verified shim.
    PATH: sourceBuildPath(pnpmCommand.bin, dirname(process.execPath)),
    npm_execpath: pnpmCommand.cli,
    PNPM_CONFIG_OFFLINE: 'true',
    PNPM_CONFIG_UPDATE_NOTIFIER: 'false',
    PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN: 'false',
  };
  // Lifecycle commands must not trust caller-supplied shell or Windows system
  // paths. The private binding carries a shell derived from the running host.
  for (const key of Object.keys(environment)) {
    if (['comspec', 'pathext', 'systemroot', 'windir'].includes(
      key.toLowerCase()
    )) delete environment[key];
  }
  if (process.platform === 'win32') {
    environment.COMSPEC = pnpmCommand.scriptShell;
    environment.NoDefaultCurrentDirectoryInExePath = '1';
    environment.PATHEXT = '.CMD;.EXE;.COM;.BAT';
    environment.SystemRoot = pnpmCommand.systemRoot;
    environment.WINDIR = pnpmCommand.systemRoot;
  } else {
    environment.NPM_CONFIG_SCRIPT_SHELL = pnpmCommand.scriptShell;
    environment.PNPM_CONFIG_SCRIPT_SHELL = pnpmCommand.scriptShell;
  }
  return environment;
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
  sourceBuildRootPath(verified.source);
  await requireFreshSourceDependencyTree(verified.source);
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
  const requiredArch = {
    darwin: 'arm64',
    linux: 'x64',
    win32: 'x64',
  }[process.platform];
  if (process.arch !== requiredArch) {
    fail(`${process.platform}-${process.arch} is outside the exact receipt matrix`);
  }
  const privateRoot = await mkdtemp(join(os.tmpdir(), 'dsh-alpha2-source-toolchain-'));
  let pnpmVersion;
  let lifecyclePnpmCommand;
  try {
    const toolchain = await materializePnpmToolchain(join(privateRoot, 'pnpm'));
    const pnpmCommand = await createSourcePnpmCommand(privateRoot, toolchain);
    const environment = packageManagerEnvironment(privateRoot);
    const buildEnvironment = sourceBuildEnvironment(
      privateRoot,
      verified.commit,
      authority.release.commit,
      pnpmCommand
    );
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
    lifecyclePnpmCommand = await createLifecyclePnpmCommand(verified.source);
    await verifySourcePnpmCommand(pnpmCommand);
    await verifyLifecyclePnpmCommand(lifecyclePnpmCommand);
    run(process.execPath, [toolchain.cli, 'run', authority.source.buildScript], {
      cwd: verified.source,
      environment: buildEnvironment,
      label: 'pinned source build',
    });
  } finally {
    try {
      if (lifecyclePnpmCommand) {
        await removeLifecyclePnpmCommand(lifecyclePnpmCommand);
      }
    } finally {
      await rm(privateRoot, { recursive: true, force: true });
    }
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
