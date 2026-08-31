import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { lstat, readdir, realpath, rm } from 'node:fs/promises';
import { win32 } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const BOOTSTRAP_ENV = 'DSH_PLUGIN_POWERSHELL_TEMP';
const BOOTSTRAP_TIMEOUT_MS = 30_000;
const MAX_LOCAL_PATH = 32_760;

export const WINDOWS_POWERSHELL_TEMP_BOOTSTRAP_SCRIPT = String.raw`
$ErrorActionPreference = 'Stop'
$path = [Environment]::GetEnvironmentVariable('DSH_PLUGIN_POWERSHELL_TEMP', 'Process')
if ([String]::IsNullOrWhiteSpace($path)) { throw 'missing PowerShell bootstrap temp' }
$directory = [IO.DirectoryInfo]::new($path)
$sid = [Security.Principal.WindowsIdentity]::GetCurrent().User
$trustedSids = @(
  $sid.Value,
  'S-1-5-18',
  'S-1-5-32-544',
  'S-1-5-80-956008885-3418522649-1831038044-1853292631-2271478464'
)
$mutationRights = [int64][Security.AccessControl.FileSystemRights]::DeleteSubdirectoriesAndFiles
$mutationRights = $mutationRights -bor [int64][Security.AccessControl.FileSystemRights]::Delete
$mutationRights = $mutationRights -bor [int64][Security.AccessControl.FileSystemRights]::ChangePermissions
$mutationRights = $mutationRights -bor [int64][Security.AccessControl.FileSystemRights]::TakeOwnership
$creationRights = [int64][Security.AccessControl.FileSystemRights]::CreateDirectories
$creationRights = $creationRights -bor [int64][Security.AccessControl.FileSystemRights]::CreateFiles

function Assert-TrustedAncestor([IO.DirectoryInfo]$candidate, [bool]$immediateParent) {
  $candidate.Refresh()
  if (-not $candidate.Exists -or
      (($candidate.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0)) {
    throw 'PowerShell bootstrap ancestor must be one real directory'
  }
  $candidateDrive = [IO.DriveInfo]::new($candidate.Root.FullName)
  if (-not [String]::Equals(
      $candidateDrive.DriveFormat,
      'NTFS',
      [StringComparison]::OrdinalIgnoreCase)) {
    throw 'PowerShell bootstrap ancestor must be on NTFS'
  }
  $candidateSecurity = $candidate.GetAccessControl(
    [Security.AccessControl.AccessControlSections]::Owner -bor
      [Security.AccessControl.AccessControlSections]::Access)
  $candidateOwner = $candidateSecurity.GetOwner(
    [Security.Principal.SecurityIdentifier]).Value
  if ($trustedSids -notcontains $candidateOwner) {
    throw 'PowerShell bootstrap ancestor owner is outside the trusted SID set'
  }
  $candidateRules = @($candidateSecurity.GetAccessRules(
    $true,
    $true,
    [Security.Principal.SecurityIdentifier]))
  foreach ($candidateRule in $candidateRules) {
    $inheritOnly =
      ($candidateRule.PropagationFlags -band
        [Security.AccessControl.PropagationFlags]::InheritOnly) -ne 0
    $untrustedAllow = -not $inheritOnly
    $untrustedAllow = $untrustedAllow -and ($candidateRule.AccessControlType -eq
      [Security.AccessControl.AccessControlType]::Allow)
    $untrustedAllow = $untrustedAllow -and ($trustedSids -notcontains $candidateRule.IdentityReference.Value)
    $rights = [int64]$candidateRule.FileSystemRights
    if ($untrustedAllow -and
        (($rights -band $mutationRights) -ne 0 -or
          ($immediateParent -and ($rights -band $creationRights) -ne 0))) {
      throw 'PowerShell bootstrap ancestor grants mutation rights to an untrusted SID'
    }
  }
  return $candidateOwner
}

$parent = $directory.Parent
if ($null -eq $parent) { throw 'PowerShell bootstrap temp has no parent' }
$checkedAncestors = 0
$parentOwnerSid = $null
$cursor = $parent
while ($null -ne $cursor) {
  $ownerSid = Assert-TrustedAncestor $cursor ($checkedAncestors -eq 0)
  if ($checkedAncestors -eq 0) { $parentOwnerSid = $ownerSid }
  $checkedAncestors += 1
  if ($checkedAncestors -gt 256) { throw 'PowerShell bootstrap ancestor chain is unbounded' }
  $cursor = $cursor.Parent
}

$security = [Security.AccessControl.DirectorySecurity]::new()
$security.SetAccessRuleProtection($true, $false)
$security.SetOwner($sid)
$rule = [Security.AccessControl.FileSystemAccessRule]::new(
  $sid,
  [Security.AccessControl.FileSystemRights]::FullControl,
  [Security.AccessControl.InheritanceFlags]::ContainerInherit -bor
    [Security.AccessControl.InheritanceFlags]::ObjectInherit,
  [Security.AccessControl.PropagationFlags]::None,
  [Security.AccessControl.AccessControlType]::Allow)
$security.AddAccessRule($rule)
$directory = [IO.Directory]::CreateDirectory($path, $security)
$directory.Refresh()
$drive = [IO.DriveInfo]::new($directory.Root.FullName)
if (-not $directory.Exists -or
    (($directory.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) -or
    -not [String]::Equals($drive.DriveFormat, 'NTFS', [StringComparison]::OrdinalIgnoreCase)) {
  throw 'PowerShell bootstrap temp must be one real NTFS directory'
}
$verified = $directory.GetAccessControl(
  [Security.AccessControl.AccessControlSections]::Owner -bor
    [Security.AccessControl.AccessControlSections]::Access)
$rules = @($verified.GetAccessRules($true, $true, [Security.Principal.SecurityIdentifier]))
$only = if ($rules.Count -eq 1) { $rules[0] } else { $null }
[PSCustomObject]@{
  schemaVersion = 2
  creationMode = 'atomic-directory-security-overload'
  fileSystem = $drive.DriveFormat.ToUpperInvariant()
  parentPath = $parent.FullName
  parentOwnerSid = $parentOwnerSid
  checkedAncestorCount = $checkedAncestors
  untrustedMutationRuleCount = 0
  currentSid = $sid.Value
  ownerSid = $verified.GetOwner([Security.Principal.SecurityIdentifier]).Value
  protected = $verified.AreAccessRulesProtected
  ruleCount = $rules.Count
  ruleSid = if ($null -eq $only) { $null } else { $only.IdentityReference.Value }
  inherited = if ($null -eq $only) { $true } else { $only.IsInherited }
  allow = if ($null -eq $only) { $false } else {
    $only.AccessControlType -eq [Security.AccessControl.AccessControlType]::Allow
  }
  fullControl = if ($null -eq $only) { $false } else {
    $only.FileSystemRights -eq [Security.AccessControl.FileSystemRights]::FullControl
  }
  inheritanceFlags = if ($null -eq $only) { -1 } else { [int]$only.InheritanceFlags }
  propagationFlags = if ($null -eq $only) { -1 } else { [int]$only.PropagationFlags }
} | ConvertTo-Json -Compress
`;

function fail(message) {
  throw new Error(message);
}

function normalizeLocal(path, label) {
  if (typeof path !== 'string' || path.length < 3 || path.includes('\0') ||
      !/^[A-Za-z]:[\\/]/u.test(path) || path.slice(2).includes(':')) {
    fail(`${label} must be a local drive-absolute path`);
  }
  const normalized = win32.normalize(path);
  if (normalized.length > MAX_LOCAL_PATH || !/^[A-Za-z]:\\/u.test(normalized)) {
    fail(`${label} is outside bounded local Windows path handling`);
  }
  return normalized;
}

function environmentValue(environment, key) {
  const matches = Object.keys(environment).filter((candidate) =>
    candidate.toLowerCase() === key.toLowerCase());
  if (matches.length === 0) return undefined;
  const values = matches.map((candidate) =>
    normalizeLocal(environment[candidate], `PowerShell bootstrap ${candidate}`));
  if (values.some((value) => windowsPathIdentity(value) !== windowsPathIdentity(values[0]))) {
    fail(`PowerShell bootstrap temp has ambiguous Windows ${key} entries`);
  }
  return values[0];
}

function windowsPathIdentity(value) {
  const withoutTrailingSeparators = value.replace(/\\+$/u, '');
  return (withoutTrailingSeparators.length === 2
    ? `${withoutTrailingSeparators}\\`
    : withoutTrailingSeparators).toLowerCase();
}

export function windowsPowerShellTempParentFromEnvironment(environment) {
  if (environment === null || typeof environment !== 'object' || Array.isArray(environment)) {
    fail('PowerShell bootstrap environment is malformed');
  }
  const tempValue = environmentValue(environment, 'TEMP');
  const tmpValue = environmentValue(environment, 'TMP');
  if (tempValue !== undefined && tmpValue !== undefined &&
      windowsPathIdentity(tempValue) !== windowsPathIdentity(tmpValue)) {
    fail('PowerShell bootstrap TEMP and TMP disagree');
  }
  const parent = tempValue ?? tmpValue;
  if (parent === undefined) {
    fail('PowerShell bootstrap requires one local TEMP or TMP parent');
  }
  return parent;
}

function validateProof(proof, expectedParent) {
  if (proof === null || typeof proof !== 'object' || Array.isArray(proof) ||
      proof.schemaVersion !== 2 ||
      proof.creationMode !== 'atomic-directory-security-overload' ||
      proof.fileSystem !== 'NTFS' ||
      typeof proof.parentPath !== 'string' ||
      windowsPathIdentity(normalizeLocal(proof.parentPath, 'PowerShell bootstrap proof parent')) !==
        windowsPathIdentity(expectedParent) ||
      !/^S-1-[0-9-]+$/u.test(proof.parentOwnerSid ?? '') ||
      !Number.isSafeInteger(proof.checkedAncestorCount) ||
      proof.checkedAncestorCount < 1 || proof.checkedAncestorCount > 256 ||
      proof.untrustedMutationRuleCount !== 0 ||
      !/^S-1-[0-9-]+$/u.test(proof.currentSid ?? '') ||
      proof.ownerSid !== proof.currentSid || proof.protected !== true ||
      proof.ruleCount !== 1 || proof.ruleSid !== proof.currentSid ||
      proof.inherited !== false || proof.allow !== true ||
      proof.fullControl !== true || proof.inheritanceFlags !== 3 ||
      proof.propagationFlags !== 0) {
    fail('PowerShell bootstrap temp ACL proof is weaker than SID-only NTFS');
  }
  return Object.freeze({ ...proof });
}

export async function acquireWindowsPowerShellTemp({
  environment,
  execute = execFileAsync,
  platform = process.platform,
  powershell,
  powerShellTempForTesting,
  systemRoot,
} = {}) {
  if (platform !== 'win32' || environment === null || typeof environment !== 'object' ||
      Array.isArray(environment) || typeof execute !== 'function' ||
      typeof powershell !== 'string' || !win32.isAbsolute(powershell)) {
    fail('PowerShell bootstrap temp request is malformed');
  }
  const trustedSystemRoot = normalizeLocal(systemRoot, 'trusted Windows system root');
  const expectedPowerShell = win32.join(
    trustedSystemRoot,
    'System32',
    'WindowsPowerShell',
    'v1.0',
    'powershell.exe'
  );
  if (win32.normalize(powershell).toLowerCase() !== expectedPowerShell.toLowerCase()) {
    fail('PowerShell bootstrap executable is outside the trusted Windows system root');
  }
  if (process.platform !== 'win32') {
    if (powerShellTempForTesting === undefined) {
      fail('simulated win32 requires an explicit test-only PowerShell temp');
    }
    const path = normalizeLocal(powerShellTempForTesting, 'test-only PowerShell temp');
    return Object.freeze({ path, proof: null, release: async () => {} });
  }
  if (powerShellTempForTesting !== undefined) {
    fail('PowerShell bootstrap temp cannot be overridden on a Windows host');
  }
  const parent = windowsPowerShellTempParentFromEnvironment(environment);
  const canonicalParent = normalizeLocal(
    await realpath(parent),
    'canonical PowerShell bootstrap temp parent'
  );
  const parentBefore = await lstat(canonicalParent, { bigint: true });
  if (!parentBefore.isDirectory() || parentBefore.isSymbolicLink()) {
    fail('PowerShell bootstrap temp parent must be one real directory');
  }
  const path = win32.join(
    canonicalParent,
    `.dsh-plugin-powershell-${randomBytes(16).toString('hex')}`
  );
  let before = null;
  let retained = true;
  try {
    const result = await execute(
      powershell,
      [
        '-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
        '-Command', WINDOWS_POWERSHELL_TEMP_BOOTSTRAP_SCRIPT,
      ],
      {
        encoding: 'utf8',
        env: {
          SystemRoot: trustedSystemRoot,
          WINDIR: trustedSystemRoot,
          TEMP: path,
          TMP: path,
          [BOOTSTRAP_ENV]: path,
        },
        maxBuffer: 32 * 1024,
        timeout: BOOTSTRAP_TIMEOUT_MS,
        windowsHide: true,
        shell: false,
      }
    );
    if (String(result.stderr ?? '').trim() !== '') {
      fail('PowerShell bootstrap temp emitted unexpected diagnostic output');
    }
    const proof = validateProof(JSON.parse(result.stdout.trim()), canonicalParent);
    const parentAfter = await lstat(canonicalParent, { bigint: true });
    if (!parentAfter.isDirectory() || parentAfter.isSymbolicLink() ||
        parentBefore.dev !== parentAfter.dev || parentBefore.ino !== parentAfter.ino) {
      fail('PowerShell bootstrap temp parent identity changed during ACL configuration');
    }
    before = await lstat(path, { bigint: true });
    const after = await lstat(path, { bigint: true });
    if (!after.isDirectory() || after.isSymbolicLink() || before.dev !== after.dev ||
        before.ino !== after.ino) {
      fail('PowerShell bootstrap temp identity changed during ACL configuration');
    }
    if ((await readdir(path)).length !== 0) {
      fail('PowerShell bootstrap temp was not empty after ACL configuration');
    }
    return Object.freeze({
      path,
      proof,
      release: async () => {
        if (!retained) return;
        const current = await lstat(path, { bigint: true });
        if (!current.isDirectory() || current.isSymbolicLink() ||
            before.dev !== current.dev || before.ino !== current.ino) {
          fail('PowerShell bootstrap temp identity changed before cleanup');
        }
        await rm(path, { recursive: true, force: true });
        retained = false;
      },
    });
  } catch (error) {
    retained = false;
    if (before !== null) {
      const current = await lstat(path, { bigint: true }).catch(() => null);
      if (current?.isDirectory() && !current.isSymbolicLink() &&
          before.dev === current.dev && before.ino === current.ino) {
        await rm(path, { recursive: true, force: true }).catch(() => {});
      }
    }
    throw new Error('failed to create SID-only NTFS PowerShell bootstrap temp', {
      cause: error,
    });
  }
}
