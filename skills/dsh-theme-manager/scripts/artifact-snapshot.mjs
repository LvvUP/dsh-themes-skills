import { createHash, randomBytes } from 'node:crypto';
import { execFile } from 'node:child_process';
import {
  chmod,
  link,
  lstat,
  mkdir,
  open,
  realpath,
  unlink,
} from 'node:fs/promises';
import { join, parse, relative, resolve } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
export const WINDOWS_PRIVATE_ACL_TIMEOUT_MS = 60_000;
const WINDOWS_PRIVATE_PATH_ENV = 'DSH_THEMES_PRIVATE_PATH';
const WINDOWS_PRIVATE_KIND_ENV = 'DSH_THEMES_PRIVATE_KIND';
const WINDOWS_PRIVATE_ACTION_ENV = 'DSH_THEMES_PRIVATE_ACTION';
const WINDOWS_PRIVATE_ACL_SCRIPT = String.raw`
$ErrorActionPreference = 'Stop'
$target = [Environment]::GetEnvironmentVariable('DSH_THEMES_PRIVATE_PATH', 'Process')
$kind = [Environment]::GetEnvironmentVariable('DSH_THEMES_PRIVATE_KIND', 'Process')
$action = [Environment]::GetEnvironmentVariable('DSH_THEMES_PRIVATE_ACTION', 'Process')
if ([String]::IsNullOrWhiteSpace($target)) { throw 'missing private path' }
if ($kind -ne 'directory' -and $kind -ne 'file') { throw 'invalid private path kind' }
if ($action -ne 'configure' -and $action -ne 'verify') { throw 'invalid private path action' }

$isDirectory = [System.IO.Directory]::Exists($target)
$isFile = [System.IO.File]::Exists($target)
if ($kind -eq 'directory' -and -not $isDirectory) {
  throw 'private directory target is not a directory'
}
if ($kind -eq 'file' -and (-not $isFile -or $isDirectory)) {
  throw 'private file target is not a file'
}

$currentSid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User
$systemSid = [System.Security.Principal.SecurityIdentifier]::new('S-1-5-18')
$inheritance = [System.Security.AccessControl.InheritanceFlags]::None
if ($kind -eq 'directory') {
  $inheritance = [System.Security.AccessControl.InheritanceFlags]::ContainerInherit -bor [System.Security.AccessControl.InheritanceFlags]::ObjectInherit
}
if ($action -eq 'configure') {
  if ($kind -eq 'directory') {
    $acl = [System.IO.Directory]::GetAccessControl($target)
  } else {
    $acl = [System.IO.File]::GetAccessControl($target)
  }
  $acl.SetAccessRuleProtection($true, $false)
  $existingRules = @($acl.GetAccessRules($true, $true, [System.Security.Principal.SecurityIdentifier]))
  foreach ($rule in $existingRules) {
    [void]$acl.RemoveAccessRuleSpecific($rule)
  }
  $acl.SetOwner($currentSid)
  foreach ($sid in @($currentSid, $systemSid)) {
    $rule = [System.Security.AccessControl.FileSystemAccessRule]::new(
      $sid,
      [System.Security.AccessControl.FileSystemRights]::FullControl,
      $inheritance,
      [System.Security.AccessControl.PropagationFlags]::None,
      [System.Security.AccessControl.AccessControlType]::Allow
    )
    [void]$acl.AddAccessRule($rule)
  }
  if ($kind -eq 'directory') {
    [System.IO.Directory]::SetAccessControl($target, $acl)
  } else {
    [System.IO.File]::SetAccessControl($target, $acl)
  }
}

if ($kind -eq 'directory') {
  $verified = [System.IO.Directory]::GetAccessControl($target)
} else {
  $verified = [System.IO.File]::GetAccessControl($target)
}
$ownerSid = $verified.GetOwner([System.Security.Principal.SecurityIdentifier]).Value
if ($ownerSid -ne $currentSid.Value) { throw 'private path owner is not the current user' }
if (-not $verified.AreAccessRulesProtected) { throw 'private path DACL still inherits access rules' }
$rules = @($verified.GetAccessRules($true, $true, [System.Security.Principal.SecurityIdentifier]))
$allowedSids = @($currentSid.Value, $systemSid.Value)
if ($rules.Count -ne 2) { throw 'private path DACL must contain exactly two access rules' }
foreach ($rule in $rules) {
  $sid = $rule.IdentityReference.Translate([System.Security.Principal.SecurityIdentifier]).Value
  if ($rule.IsInherited) { throw 'private path DACL contains an inherited access rule' }
  if ($rule.AccessControlType -ne [System.Security.AccessControl.AccessControlType]::Allow) {
    throw 'private path DACL contains a non-Allow access rule'
  }
  if ($allowedSids -notcontains $sid) { throw 'private path DACL contains an extra Allow principal' }
  $fullControl = [System.Security.AccessControl.FileSystemRights]::FullControl
  if (($rule.FileSystemRights -band $fullControl) -ne $fullControl) {
    throw 'private path DACL does not grant required FullControl'
  }
  if ($rule.InheritanceFlags -ne $inheritance) {
    throw 'private path DACL has incorrect inheritance flags'
  }
  if ($rule.PropagationFlags -ne [System.Security.AccessControl.PropagationFlags]::None) {
    throw 'private path DACL has incorrect propagation flags'
  }
}
foreach ($sid in $allowedSids) {
  $matchCount = 0
  foreach ($rule in $rules) {
    $ruleSid = $rule.IdentityReference.Translate([System.Security.Principal.SecurityIdentifier]).Value
    if ($ruleSid -eq $sid) { $matchCount += 1 }
  }
  if ($matchCount -ne 1) { throw 'private path DACL is missing a required principal' }
}
`;

async function secureWindowsPath(path, kind, action) {
  const systemRoot = process.env.SystemRoot ?? process.env.windir;
  if (!systemRoot) {
    throw new Error('cannot secure private path without the Windows system root');
  }
  const powershell = join(
    systemRoot,
    'System32',
    'WindowsPowerShell',
    'v1.0',
    'powershell.exe'
  );
  try {
    await execFileAsync(
      powershell,
      [
        '-NoLogo',
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-Command',
        WINDOWS_PRIVATE_ACL_SCRIPT,
      ],
      {
        encoding: 'utf8',
        env: {
          ...process.env,
          [WINDOWS_PRIVATE_PATH_ENV]: path,
          [WINDOWS_PRIVATE_KIND_ENV]: kind,
          [WINDOWS_PRIVATE_ACTION_ENV]: action,
        },
        maxBuffer: 64 * 1024,
        timeout: WINDOWS_PRIVATE_ACL_TIMEOUT_MS,
        windowsHide: true,
      }
    );
  } catch (error) {
    const detail = error?.stderr?.trim() || error?.message || 'unknown error';
    throw new Error(`failed to secure private Windows path: ${detail}`, {
      cause: error,
    });
  }
}

function inside(parent, child) {
  const path = relative(parent, child);
  return path && !path.startsWith('..') && !parse(path).root;
}

async function privateDirectory(parent, name) {
  const path = join(parent, name);
  if (!inside(parent, path)) throw new Error(`unsafe artifact directory: ${name}`);
  let created = false;
  try {
    await mkdir(path, { mode: 0o700 });
    created = true;
  } catch (error) {
    if (error?.code !== 'EEXIST') throw error;
  }
  const info = await lstat(path);
  if (!info.isDirectory() || info.isSymbolicLink()) {
    throw new Error(`${name} must be a real directory`);
  }
  if (process.platform === 'win32') {
    await secureWindowsPath(path, 'directory', created ? 'configure' : 'verify');
  } else if ((info.mode & 0o077) !== 0) {
    throw new Error(`${name} must not be accessible by group or other users`);
  }
  if ((await realpath(path)) !== path) {
    throw new Error(`${name} must not resolve through a symlink`);
  }
  return path;
}

async function hashOpenedFile(handle, maxBytes) {
  const initial = await handle.stat();
  if (!initial.isFile() || initial.size < 1 || initial.size > maxBytes) {
    throw new Error('plugin artifact must be a regular allowlisted file within 64 MiB');
  }
  const digest = createHash('sha256');
  let bytes = 0;
  for await (const chunk of handle.createReadStream({ autoClose: false })) {
    bytes += chunk.length;
    if (bytes > maxBytes) {
      throw new Error('plugin artifact exceeded the Manager size limit while reading');
    }
    digest.update(chunk);
  }
  const final = await handle.stat();
  if (
    bytes !== initial.size ||
    final.size !== initial.size ||
    final.dev !== initial.dev ||
    final.ino !== initial.ino
  ) {
    throw new Error('plugin artifact changed while it was being read');
  }
  return { digest: digest.digest('hex'), size: bytes, info: initial };
}

async function verifyExistingSnapshot(path, expectedDigest, expectedSize, maxBytes) {
  const info = await lstat(path);
  if (!info.isFile() || info.isSymbolicLink() || info.size !== expectedSize) {
    throw new Error('existing verified artifact snapshot is not a stable regular file');
  }
  if (process.platform === 'win32') {
    await secureWindowsPath(path, 'file', 'verify');
  } else if ((info.mode & 0o077) !== 0) {
    throw new Error('existing verified artifact snapshot has unsafe permissions');
  }
  const handle = await open(path, 'r');
  try {
    const verified = await hashOpenedFile(handle, maxBytes);
    if (verified.digest !== expectedDigest) {
      throw new Error('existing verified artifact snapshot digest does not match its name');
    }
  } finally {
    await handle.close();
  }
}

export async function snapshotAllowedArtifact(
  artifactPath,
  {
    workspace = process.cwd(),
    allowedDigests,
    maxBytes = 64 * 1024 * 1024,
  }
) {
  if (!(allowedDigests instanceof Set)) {
    throw new TypeError('allowedDigests must be a Set');
  }
  const canonicalWorkspace = await realpath(resolve(workspace));
  if (canonicalWorkspace === parse(canonicalWorkspace).root) {
    throw new Error('plugin add workspace cannot be a filesystem root');
  }
  const sourcePath = resolve(artifactPath);
  if (sourcePath !== artifactPath) {
    throw new Error('plugin artifact must use an absolute path');
  }
  const pathInfo = await lstat(sourcePath);
  if (
    !pathInfo.isFile() ||
    pathInfo.isSymbolicLink() ||
    pathInfo.size < 1 ||
    pathInfo.size > maxBytes
  ) {
    throw new Error('plugin artifact must be a regular allowlisted file within 64 MiB');
  }

  const source = await open(sourcePath, 'r');
  let incomingPath;
  try {
    const openedInfo = await source.stat();
    if (
      !openedInfo.isFile() ||
      openedInfo.size !== pathInfo.size ||
      openedInfo.dev !== pathInfo.dev ||
      openedInfo.ino !== pathInfo.ino
    ) {
      throw new Error('plugin artifact changed while it was being opened');
    }

    const control = await privateDirectory(canonicalWorkspace, '.dsh-themes');
    const snapshots = await privateDirectory(control, 'verified-artifacts');
    incomingPath = join(
      snapshots,
      `.incoming-${process.pid}-${randomBytes(8).toString('hex')}.tgz`
    );
    const destination = await open(incomingPath, 'wx', 0o600);
    const digest = createHash('sha256');
    let bytes = 0;
    try {
      for await (const chunk of source.createReadStream({ autoClose: false })) {
        bytes += chunk.length;
        if (bytes > maxBytes) {
          throw new Error('plugin artifact exceeded the Manager size limit while reading');
        }
        digest.update(chunk);
        let offset = 0;
        while (offset < chunk.length) {
          const { bytesWritten } = await destination.write(
            chunk,
            offset,
            chunk.length - offset,
            null
          );
          if (bytesWritten < 1) {
            throw new Error('plugin artifact snapshot write made no progress');
          }
          offset += bytesWritten;
        }
      }
      await destination.sync();
    } finally {
      await destination.close();
    }
    const finalInfo = await source.stat();
    const sha256 = digest.digest('hex');
    if (
      bytes !== openedInfo.size ||
      finalInfo.size !== openedInfo.size ||
      finalInfo.dev !== openedInfo.dev ||
      finalInfo.ino !== openedInfo.ino ||
      !allowedDigests.has(sha256)
    ) {
      throw new Error('plugin artifact is not in the current install allowlist');
    }

    const snapshotPath = join(snapshots, `${sha256}.tgz`);
    let reused = false;
    try {
      await link(incomingPath, snapshotPath);
      if (process.platform === 'win32') {
        await secureWindowsPath(snapshotPath, 'file', 'configure');
      } else {
        await chmod(snapshotPath, 0o600);
      }
    } catch (error) {
      if (error?.code !== 'EEXIST') throw error;
      reused = true;
      await verifyExistingSnapshot(snapshotPath, sha256, bytes, maxBytes);
    }
    await unlink(incomingPath);
    incomingPath = undefined;
    return { path: snapshotPath, sha256, size: bytes, reused };
  } finally {
    await source.close();
    if (incomingPath) await unlink(incomingPath).catch(() => undefined);
  }
}
