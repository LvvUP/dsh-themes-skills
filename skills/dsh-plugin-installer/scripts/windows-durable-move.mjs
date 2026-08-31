import { execFile } from 'node:child_process';
import { lstat as fsLstat } from 'node:fs/promises';
import { win32 } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export const WINDOWS_DURABLE_MOVE_TIMEOUT_MS = 60_000;

const SOURCE_ENV = 'DSH_PLUGIN_DURABLE_MOVE_SOURCE';
const TARGET_ENV = 'DSH_PLUGIN_DURABLE_MOVE_TARGET';
const MOVEFILE_WRITE_THROUGH = 0x8;
const TARGET_EXISTS_ERRORS = new Set([80, 183]);

export const WINDOWS_DURABLE_MOVE_SCRIPT = String.raw`
$ErrorActionPreference = 'Stop'
$source = [Environment]::GetEnvironmentVariable('DSH_PLUGIN_DURABLE_MOVE_SOURCE', 'Process')
$target = [Environment]::GetEnvironmentVariable('DSH_PLUGIN_DURABLE_MOVE_TARGET', 'Process')
if ([String]::IsNullOrEmpty($source)) { throw 'missing durable move source' }
if ([String]::IsNullOrEmpty($target)) { throw 'missing durable move target' }

Add-Type -TypeDefinition @'
using System.Runtime.InteropServices;

public static class DshPluginDurableMove
{
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool MoveFileExW(
        string lpExistingFileName,
        string lpNewFileName,
        uint dwFlags
    );
}
'@

$MOVEFILE_WRITE_THROUGH = [uint32]0x8
$moved = [DshPluginDurableMove]::MoveFileExW($source, $target, $MOVEFILE_WRITE_THROUGH)
$win32Error = if ($moved) { 0 } else { [Runtime.InteropServices.Marshal]::GetLastWin32Error() }
$sourceExists = [IO.File]::Exists($source) -or [IO.Directory]::Exists($source)
$targetExists = [IO.File]::Exists($target) -or [IO.Directory]::Exists($target)

[PSCustomObject]@{
  schemaVersion = 1
  operation = 'MoveFileExW'
  flags = [int]$MOVEFILE_WRITE_THROUGH
  moved = [bool]$moved
  sourceExists = [bool]$sourceExists
  targetExists = [bool]$targetExists
  win32Error = [int64]$win32Error
} | ConvertTo-Json -Compress
`;

function windowsVolume(path) {
  const normalized = win32.normalize(path);
  let match = /^([a-z]):\\/iu.exec(normalized);
  if (match) return `drive:${match[1].toLowerCase()}`;

  match = /^\\\\\?\\([a-z]):\\/iu.exec(normalized);
  if (match) return `drive:${match[1].toLowerCase()}`;

  match = /^\\\\\?\\UNC\\([^\\]+)\\([^\\]+)(?:\\|$)/iu.exec(normalized);
  if (match) return `unc:${match[1].toLowerCase()}\\${match[2].toLowerCase()}`;

  match = /^\\\\([^\\?.][^\\]*)\\([^\\]+)(?:\\|$)/u.exec(normalized);
  if (match) return `unc:${match[1].toLowerCase()}\\${match[2].toLowerCase()}`;

  return null;
}

function validatePath(path, label) {
  if (typeof path !== 'string' || path.length === 0 || path.includes('\0')) {
    throw new Error(`Windows durable move ${label} is malformed`);
  }
  if (!win32.isAbsolute(path) || windowsVolume(path) === null) {
    throw new Error(`Windows durable move ${label} must be an absolute volume path`);
  }
}

function parseProof(stdout) {
  if (typeof stdout !== 'string') {
    throw new Error('Windows durable move proof is missing');
  }
  let proof;
  try {
    proof = JSON.parse(stdout.trim());
  } catch (error) {
    throw new Error('Windows durable move proof is not valid JSON', { cause: error });
  }
  if (
    proof === null ||
    typeof proof !== 'object' ||
    Array.isArray(proof) ||
    proof.schemaVersion !== 1 ||
    proof.operation !== 'MoveFileExW' ||
    proof.flags !== MOVEFILE_WRITE_THROUGH ||
    typeof proof.moved !== 'boolean' ||
    typeof proof.sourceExists !== 'boolean' ||
    typeof proof.targetExists !== 'boolean' ||
    !Number.isInteger(proof.win32Error) ||
    proof.win32Error < 0 ||
    proof.win32Error > 0xffff_ffff ||
    (proof.moved && proof.win32Error !== 0) ||
    (!proof.moved && proof.win32Error === 0)
  ) {
    throw new Error('Windows durable move proof is malformed');
  }
  return Object.freeze({ ...proof });
}

function win32MoveError(proof, cause) {
  const error = new Error(`MoveFileExW failed with Win32 error ${proof.win32Error}`, {
    cause,
  });
  error.win32Error = proof.win32Error;
  if (TARGET_EXISTS_ERRORS.has(proof.win32Error)) error.code = 'EEXIST';
  return error;
}

async function requireSource(source, lstat) {
  let stat;
  try {
    stat = await lstat(source);
  } catch (error) {
    if (error?.code === 'ENOENT') {
      throw new Error('Windows durable move source does not exist', { cause: error });
    }
    throw new Error('failed to inspect Windows durable move source', { cause: error });
  }
  if (typeof stat?.isFile !== 'function' || typeof stat?.isDirectory !== 'function') {
    throw new Error('Windows durable move source stat is malformed');
  }
  if (!stat.isFile() && !stat.isDirectory()) {
    throw new Error('Windows durable move source must be a file or directory');
  }
}

async function requireAbsentTarget(target, lstat) {
  try {
    await lstat(target);
  } catch (error) {
    if (error?.code === 'ENOENT') return;
    throw new Error('failed to inspect Windows durable move target', { cause: error });
  }
  const error = new Error('Windows durable move target already exists');
  error.code = 'EEXIST';
  throw error;
}

export async function moveWindowsPathDurably(
  source,
  target,
  {
    environment = process.env,
    execute = execFileAsync,
    lstat = fsLstat,
    platform = process.platform,
  } = {}
) {
  if (platform !== 'win32') {
    throw new Error('Windows durable move requires win32');
  }
  validatePath(source, 'source');
  validatePath(target, 'target');
  if (windowsVolume(source) !== windowsVolume(target)) {
    throw new Error('Windows durable move requires source and target on the same volume');
  }
  if (environment === null || typeof environment !== 'object' || Array.isArray(environment)) {
    throw new Error('Windows durable move environment is malformed');
  }
  if (typeof lstat !== 'function' || typeof execute !== 'function') {
    throw new Error('Windows durable move dependencies are malformed');
  }

  const systemRoot = environment.SystemRoot ?? environment.windir ?? environment.WINDIR;
  if (
    typeof systemRoot !== 'string' ||
    systemRoot.length === 0 ||
    systemRoot.includes('\0') ||
    !win32.isAbsolute(systemRoot)
  ) {
    throw new Error('cannot perform durable move without an absolute Windows system root');
  }
  const powershell = win32.join(
    systemRoot,
    'System32',
    'WindowsPowerShell',
    'v1.0',
    'powershell.exe'
  );

  await requireSource(source, lstat);
  await requireAbsentTarget(target, lstat);

  const childEnvironment = {
    SystemRoot: systemRoot,
    [SOURCE_ENV]: source,
    [TARGET_ENV]: target,
  };
  for (const key of ['TEMP', 'TMP']) {
    const value = environment[key];
    if (typeof value === 'string' && value.length > 0 && !value.includes('\0')) {
      childEnvironment[key] = value;
    }
  }
  let result;
  try {
    result = await execute(
      powershell,
      [
        '-NoLogo',
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-Command',
        WINDOWS_DURABLE_MOVE_SCRIPT,
      ],
      {
        encoding: 'utf8',
        env: childEnvironment,
        maxBuffer: 64 * 1024,
        timeout: WINDOWS_DURABLE_MOVE_TIMEOUT_MS,
        windowsHide: true,
      }
    );
  } catch (error) {
    try {
      const proof = parseProof(error?.stdout);
      if (!proof.moved) throw win32MoveError(proof, error);
    } catch (proofError) {
      if (proofError?.win32Error !== undefined) throw proofError;
    }
    const detail = error?.stderr?.trim() || error?.message || 'unknown error';
    throw new Error(`failed to execute Windows durable move: ${detail}`, { cause: error });
  }

  const proof = parseProof(result?.stdout);
  if (!proof.moved) throw win32MoveError(proof);
  if (proof.sourceExists || !proof.targetExists) {
    throw new Error('Windows durable move proof is weaker than source-gone and target-present');
  }
  return proof;
}
