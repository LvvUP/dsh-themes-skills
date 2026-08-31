import assert from 'node:assert/strict';
import { lstat, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  moveWindowsPathDurably,
  WINDOWS_DURABLE_MOVE_SCRIPT,
  WINDOWS_DURABLE_MOVE_TIMEOUT_MS,
} from '../skills/dsh-plugin-installer/scripts/windows-durable-move.mjs';

const source = String.raw`C:\private\plugin.tmp`;
const target = String.raw`C:\private\plugin`;
const WINDOWS_SYSTEM_ROOT_FOR_TESTING = String.raw`C:\Windows`;
const WINDOWS_POWERSHELL_TEMP_FOR_TESTING = String.raw`C:\private\powershell-temp`;
const fileStat = Object.freeze({
  isDirectory: () => false,
  isFile: () => true,
});

function sourcePresentTargetAbsent(path) {
  if (path === source) return Promise.resolve(fileStat);
  const error = new Error('not found');
  error.code = 'ENOENT';
  return Promise.reject(error);
}

function proof(overrides = {}) {
  return JSON.stringify({
    schemaVersion: 1,
    operation: 'MoveFileExW',
    flags: 8,
    moved: true,
    sourceExists: false,
    targetExists: true,
    win32Error: 0,
    ...overrides,
  });
}

function windowsSystemRootTestOptions() {
  return process.platform === 'win32'
    ? {}
    : {
        powerShellTempForTesting: WINDOWS_POWERSHELL_TEMP_FOR_TESTING,
        systemRootForTesting: WINDOWS_SYSTEM_ROOT_FOR_TESTING,
      };
}

test('uses trusted PowerShell and a SID-only bootstrap temp instead of caller compiler paths', async () => {
  let invocation;
  const execute = async (...args) => {
    invocation = args;
    return { stdout: proof(), stderr: '' };
  };
  const result = await moveWindowsPathDurably(source, target, {
    environment: {
      SystemRoot: String.raw`Z:\forged-windows`,
      WINDIR: String.raw`Y:\different-forged-windows`,
      PATH: String.raw`C:\candidate-controlled`,
      SECRET: 'must not leak',
      TEMP: String.raw`C:\Temp`,
    },
    execute,
    lstat: sourcePresentTargetAbsent,
    platform: 'win32',
    ...windowsSystemRootTestOptions(),
  });

  assert.equal(invocation[0], String.raw`C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe`);
  assert.deepEqual(invocation[1], [
    '-NoLogo',
    '-NoProfile',
    '-NonInteractive',
    '-ExecutionPolicy',
    'Bypass',
    '-Command',
    WINDOWS_DURABLE_MOVE_SCRIPT,
  ]);
  assert.deepEqual(invocation[2], {
    encoding: 'utf8',
    env: {
      SystemRoot: String.raw`C:\Windows`,
      WINDIR: String.raw`C:\Windows`,
      TEMP: WINDOWS_POWERSHELL_TEMP_FOR_TESTING,
      TMP: WINDOWS_POWERSHELL_TEMP_FOR_TESTING,
      DSH_PLUGIN_DURABLE_MOVE_SOURCE: source,
      DSH_PLUGIN_DURABLE_MOVE_TARGET: target,
    },
    maxBuffer: 64 * 1024,
    timeout: WINDOWS_DURABLE_MOVE_TIMEOUT_MS,
    windowsHide: true,
  });
  assert.equal(invocation[1].includes(source), false);
  assert.equal(invocation[1].includes(target), false);
  assert.equal(result.sourceExists, false);
  assert.equal(result.targetExists, true);
  assert.equal(Object.isFrozen(result), true);

  assert.match(WINDOWS_DURABLE_MOVE_SCRIPT, /DllImport\("kernel32\.dll"/u);
  assert.match(WINDOWS_DURABLE_MOVE_SCRIPT, /MoveFileExW\(\$sourceNative, \$targetNative, \$MOVEFILE_WRITE_THROUGH\)/u);
  assert.match(WINDOWS_DURABLE_MOVE_SCRIPT, /\$MOVEFILE_WRITE_THROUGH = \[uint32\]0x8/u);
  assert.match(WINDOWS_DURABLE_MOVE_SCRIPT, /'\\\\\?\\UNC\\'/u);
  assert.match(WINDOWS_DURABLE_MOVE_SCRIPT, /'\\\\\?\\'/u);
  assert.doesNotMatch(WINDOWS_DURABLE_MOVE_SCRIPT, /C:\\private/u);
});

test('rejects a successful but weak proof', async () => {
  await assert.rejects(
    moveWindowsPathDurably(source, target, {
      environment: { SystemRoot: String.raw`Z:\forged-windows` },
      execute: async () => ({
        stdout: proof({ sourceExists: true }),
        stderr: '',
      }),
      lstat: sourcePresentTargetAbsent,
      platform: 'win32',
      ...windowsSystemRootTestOptions(),
    }),
    /weaker than source-gone and target-present/u
  );
});

for (const win32Error of [80, 183]) {
  test(`maps Win32 target-exists error ${win32Error} to EEXIST`, async () => {
    await assert.rejects(
      moveWindowsPathDurably(source, target, {
        environment: { SystemRoot: String.raw`Z:\forged-windows` },
        execute: async () => ({
          stdout: proof({
            moved: false,
            sourceExists: true,
            targetExists: true,
            win32Error,
          }),
          stderr: '',
        }),
        lstat: sourcePresentTargetAbsent,
        platform: 'win32',
        ...windowsSystemRootTestOptions(),
      }),
      (error) => {
        assert.equal(error.code, 'EEXIST');
        assert.equal(error.win32Error, win32Error);
        return true;
      }
    );
  });
}

test('recovers a JSON Win32 failure proof from a rejected executor', async () => {
  const executionError = new Error('PowerShell exited unsuccessfully');
  executionError.stdout = proof({
    moved: false,
    sourceExists: true,
    targetExists: true,
    win32Error: 183,
  });
  executionError.stderr = '';

  await assert.rejects(
    moveWindowsPathDurably(source, target, {
      environment: { SystemRoot: String.raw`Z:\forged-windows` },
      execute: async () => {
        throw executionError;
      },
      lstat: sourcePresentTargetAbsent,
      platform: 'win32',
      ...windowsSystemRootTestOptions(),
    }),
    (error) => {
      assert.equal(error.code, 'EEXIST');
      assert.equal(error.win32Error, 183);
      assert.equal(error.cause, executionError);
      return true;
    }
  );
});

test('strictly validates paths and source/target state before execution', async () => {
  let executions = 0;
  const execute = async () => {
    executions += 1;
    return { stdout: proof(), stderr: '' };
  };
  const options = {
    environment: { SystemRoot: String.raw`Z:\forged-windows` },
    execute,
    lstat: sourcePresentTargetAbsent,
    platform: 'win32',
    ...windowsSystemRootTestOptions(),
  };

  await assert.rejects(moveWindowsPathDurably('relative.tmp', target, options), /absolute volume path/u);
  await assert.rejects(moveWindowsPathDurably(source, `${target}\0`, options), /malformed/u);
  await assert.rejects(
    moveWindowsPathDurably(source, String.raw`D:\private\plugin`, options),
    /same volume/u
  );

  const missing = async () => {
    const error = new Error('not found');
    error.code = 'ENOENT';
    throw error;
  };
  await assert.rejects(
    moveWindowsPathDurably(source, target, { ...options, lstat: missing }),
    /source does not exist/u
  );

  const targetExists = async () => fileStat;
  await assert.rejects(
    moveWindowsPathDurably(source, target, { ...options, lstat: targetExists }),
    (error) => error.code === 'EEXIST'
  );
  assert.equal(executions, 0);
});

test('refuses to run outside win32 before touching the filesystem or executor', async () => {
  let touched = false;
  await assert.rejects(
    moveWindowsPathDurably(source, target, {
      execute: async () => {
        touched = true;
      },
      lstat: async () => {
        touched = true;
      },
      platform: 'linux',
    }),
    /requires win32/u
  );
  assert.equal(touched, false);
});

test('performs real write-through file and directory moves on Windows', {
  skip: process.platform !== 'win32',
}, async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-plugin-durable-move-'));
  try {
    const sourceFile = join(root, 'source.tmp');
    const targetFile = join(root, 'target.key');
    await writeFile(sourceFile, 'durable-key-bytes\n');
    const fileProof = await moveWindowsPathDurably(sourceFile, targetFile);
    assert.equal(fileProof.moved, true);
    assert.equal(await readFile(targetFile, 'utf8'), 'durable-key-bytes\n');

    const sourceDirectory = join(root, 'source-directory.tmp');
    const targetDirectory = join(root, 'target-directory');
    await mkdir(sourceDirectory);
    await writeFile(join(sourceDirectory, 'owner.json'), '{}\n');
    const directoryProof = await moveWindowsPathDurably(sourceDirectory, targetDirectory);
    assert.equal(directoryProof.moved, true);
    assert.equal((await lstat(targetDirectory)).isDirectory(), true);
    assert.equal(await readFile(join(targetDirectory, 'owner.json'), 'utf8'), '{}\n');

    const longRoot = join(
      root,
      ...Array.from({ length: 8 }, (_, index) =>
        `long-path-segment-${String(index).padStart(2, '0')}-${'x'.repeat(24)}`)
    );
    await mkdir(longRoot, { recursive: true });
    const longSource = join(longRoot, 'long-source.tmp');
    const longTarget = join(longRoot, 'long-target.key');
    assert.ok(longSource.length > 260);
    await writeFile(longSource, 'long-path-write-through\n');
    const longProof = await moveWindowsPathDurably(longSource, longTarget);
    assert.equal(longProof.moved, true);
    assert.equal(await readFile(longTarget, 'utf8'), 'long-path-write-through\n');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
