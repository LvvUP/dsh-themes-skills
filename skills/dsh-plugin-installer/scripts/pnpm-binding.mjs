import { spawnSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import {
  chmod,
  lstat,
  mkdir,
  readFile,
  realpath,
  writeFile,
} from 'node:fs/promises';
import { extname, isAbsolute, join, win32 } from 'node:path';

import { materializeVerifiedPnpmRuntime } from './pnpm-runtime.mjs';
import {
  captureWindowsPrivatePathIdentity,
  secureWindowsPrivatePath,
  trustedWindowsSystemRoot,
} from './windows-private-acl.mjs';

const EXPECTED_PNPM_VERSION = '11.7.0';
const CERTIFIED_NODES = new Set(['v22.19.0', 'v24.15.0']);
const WINDOWS_PATHEXT = '.CMD;.EXE;.COM;.BAT';
const PROOF_FLAG = '--dsh-plugin-installer-runtime-proof';

function fail(message) {
  throw new Error(message);
}

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

function requireWindowsCommandSafePath(path, label) {
  if (!/^[A-Za-z]:[\\/]/u.test(path) || /["%!^&|<>\r\n]/u.test(path)) {
    fail(`${label} is unsafe for the fixed Windows command-wrapper boundary`);
  }
}

export function requiresPnpmCommandShimShell(platform = process.platform) {
  if (!['darwin', 'linux', 'win32'].includes(platform)) {
    fail(`pnpm binding is unsupported on ${platform}`);
  }
  return platform === 'win32';
}

export function pnpmCommandShimShell(environment, platform = process.platform) {
  if (!requiresPnpmCommandShimShell(platform)) return false;
  const commandProcessor = environment?.COMSPEC;
  if (typeof commandProcessor !== 'string' || !win32.isAbsolute(commandProcessor) ||
      !/^[A-Za-z]:[\\/]/u.test(commandProcessor) ||
      win32.basename(commandProcessor).toLowerCase() !== 'cmd.exe') {
    fail('Windows pnpm command shim requires one absolute command processor');
  }
  return commandProcessor;
}

export function validatePrivatePnpmPathext(value) {
  if (typeof value !== 'string' || value.includes('\0')) {
    fail('private pnpm PATHEXT is malformed');
  }
  const extensions = value.split(';').map((entry) => entry.toUpperCase());
  if (JSON.stringify(extensions) !== JSON.stringify(WINDOWS_PATHEXT.split(';')) ||
      extensions.indexOf('.CMD') === -1 ||
      ['.EXE', '.COM', '.BAT'].some((entry) =>
        extensions.indexOf('.CMD') > extensions.indexOf(entry))) {
    fail('private pnpm PATHEXT must put .CMD before every executable fallback');
  }
  return value;
}

async function resolveWindowsHost(platform, systemRootForTesting) {
  if (platform !== 'win32') return null;
  const systemRoot = await realpath(trustedWindowsSystemRoot({
    platform,
    systemRootForTesting,
  }));
  const commandProcessor = await realpath(win32.join(systemRoot, 'System32', 'cmd.exe'));
  const stat = await lstat(commandProcessor);
  if (!stat.isFile() || stat.isSymbolicLink()) {
    fail('Windows command processor is not one trusted regular file');
  }
  return Object.freeze({ commandProcessor, systemRoot });
}

function discardCallerPath(pathValue, platform) {
  if (typeof pathValue !== 'string' || pathValue.length === 0 ||
      pathValue.length > 32_768 || pathValue.includes('\0')) {
    fail('pnpm binding requires one explicit PATH');
  }
  const entries = pathValue.split(platform === 'win32' ? ';' : ':');
  return Object.freeze({
    discardedEntries: entries.length,
    policy: 'discarded-without-filesystem-resolution',
  });
}

async function protectCreatedPath(
  path,
  kind,
  platform,
  systemRootForTesting,
  powerShellTempForTesting
) {
  if (platform === 'win32') {
    const expectedIdentity = await captureWindowsPrivatePathIdentity(path, kind);
    await secureWindowsPrivatePath(path, kind, 'configure', {
      expectedIdentity,
      powerShellTempForTesting,
      systemRootForTesting,
    });
  } else {
    await chmod(path, kind === 'directory' ? 0o700 : 0o600);
  }
}

function wrapperRunnerSource(runtime, nodePath, cliSha256) {
  return `import { spawnSync } from 'node:child_process';\n`
    + `import { createHash } from 'node:crypto';\n`
    + `import { lstatSync, readFileSync, realpathSync } from 'node:fs';\n`
    + `const expected = Object.freeze(${JSON.stringify({
      cli: runtime.cli,
      cliSha256,
      closureSha512: runtime.closureSha512,
      nodePath,
      version: runtime.version,
    })});\n`
    + `function stop(message) { process.stderr.write(message + '\\n'); process.exit(126); }\n`
    + `try {\n`
    + `  if (realpathSync(process.execPath) !== expected.nodePath || realpathSync(expected.cli) !== expected.cli) stop('dsh-plugin-installer: private runtime identity changed');\n`
    + `  const stat = lstatSync(expected.cli);\n`
    + `  if (!stat.isFile() || stat.isSymbolicLink() || createHash('sha256').update(readFileSync(expected.cli)).digest('hex') !== expected.cliSha256) stop('dsh-plugin-installer: private pnpm CLI changed');\n`
    + `} catch { stop('dsh-plugin-installer: private pnpm verification failed'); }\n`
    + `const args = process.argv.slice(2);\n`
    + `const proof = args.length === 2 && args[0] === ${JSON.stringify(PROOF_FLAG)} && /^[a-f0-9]{64}$/u.test(args[1]);\n`
    + `const child = spawnSync(expected.nodePath, [expected.cli, ...(proof ? ['--version'] : args)], { env: process.env, shell: false, encoding: proof ? 'utf8' : undefined, stdio: proof ? 'pipe' : 'inherit', windowsHide: true });\n`
    + `if (child.error || child.status !== 0) stop('dsh-plugin-installer: private pnpm launch failed');\n`
    + `if (proof) {\n`
    + `  if ((child.stderr ?? '').trim() !== '' || (child.stdout ?? '').trim() !== expected.version) stop('dsh-plugin-installer: private pnpm version proof failed');\n`
    + `  process.stdout.write(JSON.stringify({ schemaVersion: 1, challenge: args[1], version: expected.version, closureSha512: expected.closureSha512 }) + '\\n');\n`
    + `  process.exit(0);\n`
    + `}\n`
    + `process.exit(child.status ?? 1);\n`;
}

function parseProof(result, challenge, runtime) {
  if (result.error || result.status !== 0 || (result.stderr ?? '').trim() !== '') {
    fail('private pnpm wrapper proof did not execute cleanly');
  }
  let proof;
  try {
    proof = JSON.parse((result.stdout ?? '').trim());
  } catch (error) {
    throw new Error('private pnpm wrapper proof is not valid JSON', { cause: error });
  }
  if (proof === null || typeof proof !== 'object' || Array.isArray(proof) ||
      JSON.stringify(Object.keys(proof).sort()) !==
        JSON.stringify(['challenge', 'closureSha512', 'schemaVersion', 'version']) ||
      proof.schemaVersion !== 1 || proof.challenge !== challenge ||
      proof.version !== EXPECTED_PNPM_VERSION ||
      proof.closureSha512 !== runtime.closureSha512) {
    fail('private pnpm wrapper returned the wrong launch proof');
  }
  return Object.freeze(proof);
}

export async function createPrivatePnpmBinding(environment, runtimeRoot, {
  commandCwd = process.cwd(),
  platform = process.platform,
  powerShellTempForTesting,
  systemRootForTesting,
} = {}) {
  requiresPnpmCommandShimShell(platform);
  if (process.platform === 'win32' && platform !== 'win32') {
    fail('pnpm binding platform cannot be overridden on a Windows host');
  }
  if (!CERTIFIED_NODES.has(process.version) || !isAbsolute(runtimeRoot) ||
      !isAbsolute(commandCwd) || environment === null ||
      typeof environment !== 'object' || Array.isArray(environment)) {
    fail('pnpm binding requires the certified Node and explicit absolute roots');
  }
  const nodePath = await realpath(process.execPath);
  const nodeStat = await lstat(nodePath);
  if (!nodeStat.isFile() || nodeStat.isSymbolicLink() ||
      !['', '.exe'].includes(extname(nodePath).toLowerCase())) {
    fail('certified Node executable is not one real regular file');
  }
  const windowsHost = await resolveWindowsHost(platform, systemRootForTesting);
  if (platform === 'win32') {
    requireWindowsCommandSafePath(nodePath, 'certified Node path');
    requireWindowsCommandSafePath(runtimeRoot, 'private pnpm runtime root');
    requireWindowsCommandSafePath(commandCwd, 'private pnpm command cwd');
  }
  const discardedPath = discardCallerPath(environment.PATH, platform);
  const reviewedEnvironment = Object.fromEntries(Object.entries(environment).filter(([key]) =>
    platform !== 'win32' || ![
      'comspec', 'nodefaultcurrentdirectoryinexepath', 'path', 'pathext',
      'systemroot', 'windir',
    ].includes(key.toLowerCase())));
  if (platform === 'win32') {
    reviewedEnvironment.COMSPEC = windowsHost.commandProcessor;
    reviewedEnvironment.SystemRoot = windowsHost.systemRoot;
    reviewedEnvironment.WINDIR = windowsHost.systemRoot;
    reviewedEnvironment.PATHEXT = validatePrivatePnpmPathext(WINDOWS_PATHEXT);
    reviewedEnvironment.NoDefaultCurrentDirectoryInExePath = '1';
  }

  const bindingRoot = join(runtimeRoot, 'pnpm-binding');
  await mkdir(bindingRoot, { mode: 0o700 });
  await protectCreatedPath(
    bindingRoot,
    'directory',
    platform,
    systemRootForTesting,
    powerShellTempForTesting
  );
  const runtime = await materializeVerifiedPnpmRuntime(join(bindingRoot, 'runtime'), {
    platform,
    powerShellTempForTesting,
    systemRootForTesting,
  });
  const cliSha256 = sha256(await readFile(runtime.cli));
  const runner = join(bindingRoot, 'pnpm-wrapper.mjs');
  const runnerBytes = Buffer.from(wrapperRunnerSource(runtime, nodePath, cliSha256), 'utf8');
  await writeFile(runner, runnerBytes, { flag: 'wx', mode: 0o600 });
  await protectCreatedPath(
    runner,
    'file',
    platform,
    systemRootForTesting,
    powerShellTempForTesting
  );
  const wrapper = join(bindingRoot, platform === 'win32' ? 'pnpm.cmd' : 'pnpm');
  const wrapperBytes = Buffer.from(platform === 'win32'
    ? '@echo off\r\n"%DSH_PLUGIN_PNPM_NODE%" "%DSH_PLUGIN_PNPM_WRAPPER%" %*\r\n'
    : '#!/bin/sh\nexec "$DSH_PLUGIN_PNPM_NODE" "$DSH_PLUGIN_PNPM_WRAPPER" "$@"\n');
  await writeFile(wrapper, wrapperBytes, { flag: 'wx', mode: 0o700 });
  await protectCreatedPath(
    wrapper,
    'file',
    platform,
    systemRootForTesting,
    powerShellTempForTesting
  );
  if (platform !== 'win32') await chmod(wrapper, 0o700);

  const boundEnvironment = Object.freeze({
    ...reviewedEnvironment,
    PATH: bindingRoot,
    DSH_PLUGIN_PNPM_CLI: runtime.cli,
    DSH_PLUGIN_PNPM_NODE: nodePath,
    DSH_PLUGIN_PNPM_WRAPPER: runner,
    DSH_PLUGIN_PNPM_ARTIFACT_SHA256: runtime.artifactSha256,
    DSH_PLUGIN_PNPM_CLOSURE_SHA512: runtime.closureSha512,
  });
  const challenge = randomBytes(32).toString('hex');
  const proofResult = spawnSync('pnpm', [PROOF_FLAG, challenge], {
    cwd: commandCwd,
    encoding: 'utf8',
    env: boundEnvironment,
    shell: pnpmCommandShimShell(boundEnvironment, platform),
    timeout: 30_000,
    windowsHide: true,
  });
  parseProof(proofResult, challenge, runtime);
  const direct = spawnSync(nodePath, [runtime.cli, '--version'], {
    cwd: commandCwd,
    encoding: 'utf8',
    env: boundEnvironment,
    shell: false,
    timeout: 30_000,
    windowsHide: true,
  });
  if (direct.error || direct.status !== 0 || (direct.stderr ?? '').trim() !== '' ||
      (direct.stdout ?? '').trim() !== EXPECTED_PNPM_VERSION) {
    fail('fixed Node could not execute the private pnpm.cjs runtime');
  }
  return Object.freeze({
    environment: boundEnvironment,
    receipt: Object.freeze({
      schemaVersion: 3,
      packageManager: 'pnpm',
      version: EXPECTED_PNPM_VERSION,
      artifactSha256: runtime.artifactSha256,
      artifactSha512: runtime.artifactSha512,
      authoritySha256: runtime.authoritySha256,
      closureSha512: runtime.closureSha512,
      closureEntries: runtime.entryCount,
      nodeVersion: process.version.slice(1),
      privatePathPrecedence: true,
      callerPathPolicy: discardedPath.policy,
      discardedCallerPathEntries: discardedPath.discardedEntries,
      wrapperSha256: sha256(wrapperBytes),
      wrapperRunnerSha256: sha256(runnerBytes),
      runtimePathOutput: 'forbidden',
      upstreamSpawnContract:
        'alpha1-alpha2-apps-cli-plugin-spawnSync-pnpm-private-wrapper',
    }),
  });
}
