import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  chmod,
  lstat,
  mkdir,
  readFile,
  realpath,
  symlink,
  writeFile,
} from 'node:fs/promises';
import {
  delimiter,
  extname,
  isAbsolute,
  join,
  resolve,
  win32,
} from 'node:path';

import { secureWindowsPrivatePath } from './windows-private-acl.mjs';

const EXPECTED_PNPM_VERSION = '11.7.0';
const MAX_EXECUTABLE_BYTES = 32 * 1024 * 1024;

function fail(message) {
  throw new Error(message);
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
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
  if (
    typeof commandProcessor !== 'string' ||
    !win32.isAbsolute(commandProcessor) ||
    !/^[A-Za-z]:[\\/]/u.test(commandProcessor) ||
    win32.basename(commandProcessor).toLowerCase() !== 'cmd.exe'
  ) {
    fail('Windows pnpm command shim requires one absolute command processor');
  }
  return commandProcessor;
}

function commandNames(platform, environment) {
  if (platform !== 'win32') return ['pnpm'];
  const raw = environment.PATHEXT;
  if (typeof raw !== 'string' || raw.length === 0 || raw.includes('\0')) {
    fail('pnpm binding requires one explicit Windows PATHEXT');
  }
  const extensions = raw
    .split(';')
    .map((value) => value.trim())
    .filter(Boolean);
  if (
    extensions.length === 0 ||
    extensions.some((value) => !/^\.[A-Za-z0-9]+$/u.test(value))
  ) {
    fail('pnpm binding requires a strict Windows PATHEXT');
  }
  return extensions.map((value) => `pnpm${value.toLowerCase()}`);
}

async function executableIdentity(path, platform) {
  const canonical = await realpath(path);
  if (!isAbsolute(canonical)) fail('resolved pnpm executable is not absolute');
  const stat = await lstat(canonical);
  if (
    !stat.isFile() ||
    stat.isSymbolicLink() ||
    stat.size < 1 ||
    stat.size > MAX_EXECUTABLE_BYTES ||
    (platform !== 'win32' && (stat.mode & 0o111) === 0)
  ) {
    fail('resolved pnpm executable is not one bounded executable regular file');
  }
  if (
    platform === 'win32' &&
    !['.cmd', '.bat', '.exe', '.com'].includes(extname(canonical).toLowerCase())
  ) {
    fail('resolved Windows pnpm executable has an unsupported command type');
  }
  return {
    path: canonical,
    sha256: sha256(await readFile(canonical)),
    size: stat.size,
  };
}

export async function resolvePnpmExecutable(
  environment,
  {
    commandCwd = process.cwd(),
    platform = process.platform,
  } = {}
) {
  requiresPnpmCommandShimShell(platform);
  if (
    environment === null ||
    typeof environment !== 'object' ||
    Array.isArray(environment) ||
    typeof environment.PATH !== 'string' ||
    environment.PATH.length === 0 ||
    environment.PATH.includes('\0')
  ) {
    fail('pnpm binding requires one explicit PATH');
  }
  const directories = environment.PATH.split(delimiter);
  if (directories.length === 0) fail('pnpm binding requires a non-empty PATH');
  const names = commandNames(platform, environment);
  if (!isAbsolute(commandCwd)) fail('pnpm binding command cwd must be absolute');
  const reviewedDirectories = [];
  let identity;
  let unsafeTrailingPathEntriesRemoved = 0;
  for (const directory of directories) {
    if (directory.length === 0 || !isAbsolute(directory)) {
      if (!identity) {
        const relativeDirectory = resolve(commandCwd, directory || '.');
        for (const name of names) {
          try {
            const stat = await lstat(join(relativeDirectory, name));
            if (stat.isFile() || stat.isSymbolicLink()) {
              fail('pnpm binding refuses a command resolved from an empty or relative PATH entry');
            }
          } catch (error) {
            if (error?.code !== 'ENOENT') throw error;
          }
        }
      }
      unsafeTrailingPathEntriesRemoved += 1;
      continue;
    }
    const canonicalDirectory = resolve(directory);
    reviewedDirectories.push(canonicalDirectory);
    if (!identity) {
      for (const name of names) {
        const candidate = join(canonicalDirectory, name);
        try {
          const stat = await lstat(candidate);
          if (!stat.isFile() && !stat.isSymbolicLink()) continue;
          identity = await executableIdentity(candidate, platform);
          break;
        } catch (error) {
          if (error?.code !== 'ENOENT') throw error;
        }
      }
    }
  }
  if (!identity) fail('pnpm executable is missing from the reviewed PATH');
  return {
    ...identity,
    reviewedPath: reviewedDirectories.join(delimiter),
    unsafeTrailingPathEntriesRemoved,
  };
}

async function resolveWindowsCommandProcessor(environment, platform) {
  if (!requiresPnpmCommandShimShell(platform)) return null;
  const systemRoot = environment.SystemRoot ?? environment.WINDIR;
  if (
    typeof systemRoot !== 'string' ||
    systemRoot.length === 0 ||
    systemRoot.includes('\0') ||
    !isAbsolute(systemRoot)
  ) {
    fail('pnpm binding requires one absolute Windows system root');
  }
  const commandProcessor = join(await realpath(systemRoot), 'System32', 'cmd.exe');
  const stat = await lstat(commandProcessor);
  if (!stat.isFile() || stat.isSymbolicLink()) {
    fail('Windows command processor must be one real system file');
  }
  return realpath(commandProcessor);
}

function runExactTarget(identity, args, environment, platform, commandCwd) {
  const result = spawnSync(identity.path, args, {
    cwd: commandCwd,
    encoding: 'utf8',
    env: environment,
    shell: pnpmCommandShimShell(environment, platform),
    timeout: 30_000,
    windowsHide: true,
  });
  if (
    result.error ||
    result.status !== 0 ||
    (result.stderr ?? '').trim() !== '' ||
    (result.stdout ?? '').trim() !== EXPECTED_PNPM_VERSION
  ) {
    fail('the absolute PATH-resolved pnpm executable is not exactly 11.7.0');
  }
}

function launcherSource(identity, commandProcessor) {
  return `import { spawnSync } from 'node:child_process';\n`
    + `import { createHash } from 'node:crypto';\n`
    + `import { lstatSync, readFileSync, realpathSync } from 'node:fs';\n`
    + `const expected = Object.freeze(${JSON.stringify(identity)});\n`
    + `function stop(message) { process.stderr.write(message + '\\n'); process.exit(126); }\n`
    + `let stat;\n`
    + `try {\n`
    + `  if (realpathSync(expected.path) !== expected.path) stop('dsh-plugin-installer: bound pnpm path changed');\n`
    + `  stat = lstatSync(expected.path);\n`
    + `  if (!stat.isFile() || stat.isSymbolicLink() || stat.size !== expected.size) stop('dsh-plugin-installer: bound pnpm identity changed');\n`
    + `  const digest = createHash('sha256').update(readFileSync(expected.path)).digest('hex');\n`
    + `  if (digest !== expected.sha256) stop('dsh-plugin-installer: bound pnpm digest changed');\n`
    + `} catch { stop('dsh-plugin-installer: bound pnpm verification failed'); }\n`
    + `const result = spawnSync(expected.path, process.argv.slice(2), { env: process.env, shell: ${JSON.stringify(commandProcessor ?? false)}, stdio: 'inherit', windowsHide: true });\n`
    + `if (result.error) stop('dsh-plugin-installer: bound pnpm launch failed');\n`
    + `process.exit(result.status ?? 1);\n`;
}

async function protectCreatedPath(path, kind, platform) {
  if (platform === 'win32') {
    await secureWindowsPrivatePath(path, kind, 'configure');
  } else if (kind === 'directory') {
    await chmod(path, 0o700);
  } else {
    await chmod(path, 0o600);
  }
}

export async function createPrivatePnpmBinding(
  environment,
  runtimeRoot,
  {
    commandCwd = process.cwd(),
    platform = process.platform,
  } = {}
) {
  if (!isAbsolute(runtimeRoot)) fail('pnpm binding runtime root must be absolute');
  const resolved = await resolvePnpmExecutable(environment, { commandCwd, platform });
  const identity = {
    path: resolved.path,
    sha256: resolved.sha256,
    size: resolved.size,
  };
  const commandProcessor = await resolveWindowsCommandProcessor(environment, platform);
  const reviewedEnvironment = Object.fromEntries(
    Object.entries(environment).filter(([key]) =>
      platform !== 'win32' ||
      !['comspec', 'nodefaultcurrentdirectoryinexepath', 'path', 'pathext']
        .includes(key.toLowerCase()))
  );
  reviewedEnvironment.PATH = resolved.reviewedPath;
  if (platform === 'win32') {
    reviewedEnvironment.PATHEXT = environment.PATHEXT;
    reviewedEnvironment.COMSPEC = commandProcessor;
    reviewedEnvironment.NoDefaultCurrentDirectoryInExePath = '1';
  }
  runExactTarget(identity, ['--version'], reviewedEnvironment, platform, commandCwd);

  const bindingRoot = join(runtimeRoot, 'pnpm-binding');
  await mkdir(bindingRoot, { mode: 0o700 });
  await protectCreatedPath(bindingRoot, 'directory', platform);

  const launcher = join(bindingRoot, 'pnpm-launcher.mjs');
  const launcherBytes = Buffer.from(launcherSource(identity, commandProcessor), 'utf8');
  await writeFile(launcher, launcherBytes, { flag: 'wx', mode: 0o600 });
  await protectCreatedPath(launcher, 'file', platform);

  const wrapper = join(bindingRoot, platform === 'win32' ? 'pnpm.cmd' : 'pnpm');
  const wrapperText = platform === 'win32'
    ? '@echo off\r\n"%DSH_PLUGIN_PNPM_NODE%" "%DSH_PLUGIN_PNPM_LAUNCHER%" %*\r\n'
    : '#!/bin/sh\nexec "$DSH_PLUGIN_PNPM_NODE" "$DSH_PLUGIN_PNPM_LAUNCHER" "$@"\n';
  await writeFile(wrapper, wrapperText, { flag: 'wx', mode: 0o700 });
  await protectCreatedPath(wrapper, 'file', platform);
  if (platform !== 'win32') await chmod(wrapper, 0o700);

  if (platform !== 'win32') {
    const nodeLink = join(bindingRoot, 'node');
    await symlink(await realpath(process.execPath), nodeLink, 'file');
  }

  const boundEnvironment = Object.freeze({
    ...reviewedEnvironment,
    PATH: `${bindingRoot}${delimiter}${resolved.reviewedPath}`,
    DSH_PLUGIN_PNPM_LAUNCHER: launcher,
    DSH_PLUGIN_PNPM_NODE: process.execPath,
    DSH_PLUGIN_PNPM_TARGET_SHA256: identity.sha256,
    DSH_PLUGIN_PNPM_LAUNCHER_SHA256: sha256(launcherBytes),
  });
  const result = spawnSync('pnpm', ['--version'], {
    cwd: commandCwd,
    encoding: 'utf8',
    env: boundEnvironment,
    shell: pnpmCommandShimShell(boundEnvironment, platform),
    timeout: 30_000,
    windowsHide: true,
  });
  if (
    result.error ||
    result.status !== 0 ||
    (result.stderr ?? '').trim() !== '' ||
    (result.stdout ?? '').trim() !== EXPECTED_PNPM_VERSION
  ) {
    fail('private pnpm PATH binding did not resolve exactly pnpm 11.7.0');
  }
  return {
    environment: boundEnvironment,
    receipt: Object.freeze({
      schemaVersion: 1,
      packageManager: 'pnpm',
      version: EXPECTED_PNPM_VERSION,
      targetSha256: identity.sha256,
      targetBytes: identity.size,
      launcherSha256: sha256(launcherBytes),
      privatePathPrecedence: true,
      unsafeTrailingPathEntriesRemoved: resolved.unsafeTrailingPathEntriesRemoved,
      targetPathOutput: 'forbidden',
      upstreamSpawnContract:
        'alpha.1-apps-cli-plugin-spawnSync-pnpm-path-resolution',
    }),
  };
}
