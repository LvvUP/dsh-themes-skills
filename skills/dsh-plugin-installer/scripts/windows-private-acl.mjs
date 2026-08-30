import { execFile } from 'node:child_process';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export const WINDOWS_PRIVATE_ACL_TIMEOUT_MS = 60_000;

const PATH_ENV = 'DSH_PLUGIN_PRIVATE_PATH';
const KIND_ENV = 'DSH_PLUGIN_PRIVATE_KIND';
const ACTION_ENV = 'DSH_PLUGIN_PRIVATE_ACTION';

export const WINDOWS_CURRENT_USER_PRIVATE_ACL_SCRIPT = String.raw`
$ErrorActionPreference = 'Stop'
$target = [Environment]::GetEnvironmentVariable('DSH_PLUGIN_PRIVATE_PATH', 'Process')
$kind = [Environment]::GetEnvironmentVariable('DSH_PLUGIN_PRIVATE_KIND', 'Process')
$action = [Environment]::GetEnvironmentVariable('DSH_PLUGIN_PRIVATE_ACTION', 'Process')
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
  $rule = [System.Security.AccessControl.FileSystemAccessRule]::new(
    $currentSid,
    [System.Security.AccessControl.FileSystemRights]::FullControl,
    $inheritance,
    [System.Security.AccessControl.PropagationFlags]::None,
    [System.Security.AccessControl.AccessControlType]::Allow
  )
  [void]$acl.AddAccessRule($rule)
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
if ($ownerSid -ne $currentSid.Value) { throw 'private path owner is not the current user SID' }
if (-not $verified.AreAccessRulesProtected) { throw 'private path DACL still inherits access rules' }
$rules = @($verified.GetAccessRules($true, $true, [System.Security.Principal.SecurityIdentifier]))
if ($rules.Count -ne 1) { throw 'private path DACL must contain exactly one current-user rule' }
$verifiedRule = $rules[0]
$ruleSid = $verifiedRule.IdentityReference.Translate([System.Security.Principal.SecurityIdentifier]).Value
if ($ruleSid -ne $currentSid.Value) { throw 'private path DACL contains a non-current-user principal' }
if ($verifiedRule.IsInherited) { throw 'private path DACL contains an inherited access rule' }
if ($verifiedRule.AccessControlType -ne [System.Security.AccessControl.AccessControlType]::Allow) {
  throw 'private path DACL contains a non-Allow access rule'
}
$fullControl = [System.Security.AccessControl.FileSystemRights]::FullControl
if ($verifiedRule.FileSystemRights -ne $fullControl) {
  throw 'private path DACL is not exactly current-user FullControl'
}
if ($verifiedRule.InheritanceFlags -ne $inheritance) {
  throw 'private path DACL has incorrect inheritance flags'
}
if ($verifiedRule.PropagationFlags -ne [System.Security.AccessControl.PropagationFlags]::None) {
  throw 'private path DACL has incorrect propagation flags'
}

[PSCustomObject]@{
  schemaVersion = 1
  kind = $kind
  currentSid = $currentSid.Value
  ownerSid = $ownerSid
  protected = $verified.AreAccessRulesProtected
  ruleCount = $rules.Count
  ruleSid = $ruleSid
  inherited = $verifiedRule.IsInherited
  allow = $verifiedRule.AccessControlType -eq [System.Security.AccessControl.AccessControlType]::Allow
  fullControl = ($verifiedRule.FileSystemRights -eq $fullControl)
  inheritanceFlags = [int]$verifiedRule.InheritanceFlags
  propagationFlags = [int]$verifiedRule.PropagationFlags
} | ConvertTo-Json -Compress
`;

function validateProof(proof, kind) {
  const inheritanceFlags = kind === 'directory' ? 3 : 0;
  if (
    proof === null ||
    typeof proof !== 'object' ||
    proof.schemaVersion !== 1 ||
    proof.kind !== kind ||
    !/^S-1-[0-9-]+$/u.test(proof.currentSid ?? '') ||
    proof.ownerSid !== proof.currentSid ||
    proof.protected !== true ||
    proof.ruleCount !== 1 ||
    proof.ruleSid !== proof.currentSid ||
    proof.inherited !== false ||
    proof.allow !== true ||
    proof.fullControl !== true ||
    proof.inheritanceFlags !== inheritanceFlags ||
    proof.propagationFlags !== 0
  ) {
    throw new Error('Windows private-path ACL proof is malformed or weaker than current-user SID-only');
  }
  return Object.freeze({ ...proof });
}

export async function secureWindowsPrivatePath(
  path,
  kind,
  action,
  {
    environment = process.env,
    execute = execFileAsync,
    platform = process.platform,
  } = {}
) {
  if (platform !== 'win32') {
    throw new Error('Windows private-path ACL enforcement requires win32');
  }
  if (typeof path !== 'string' || path.length === 0 || path.includes('\0')) {
    throw new Error('Windows private-path ACL target is malformed');
  }
  if (!['directory', 'file'].includes(kind) || !['configure', 'verify'].includes(action)) {
    throw new Error('Windows private-path ACL request is malformed');
  }
  if (environment === null || typeof environment !== 'object' || Array.isArray(environment)) {
    throw new Error('Windows private-path ACL environment is malformed');
  }
  const systemRoot = environment.SystemRoot ?? environment.windir ?? environment.WINDIR;
  if (typeof systemRoot !== 'string' || systemRoot.length === 0 || systemRoot.includes('\0')) {
    throw new Error('cannot secure private path without the Windows system root');
  }
  const powershell = join(
    systemRoot,
    'System32',
    'WindowsPowerShell',
    'v1.0',
    'powershell.exe'
  );
  const childEnvironment = {
    SystemRoot: systemRoot,
    WINDIR: environment.WINDIR ?? environment.windir ?? systemRoot,
    [PATH_ENV]: path,
    [KIND_ENV]: kind,
    [ACTION_ENV]: action,
  };
  for (const key of ['TEMP', 'TMP']) {
    const value = environment[key];
    if (typeof value === 'string' && value.length > 0 && !value.includes('\0')) {
      childEnvironment[key] = value;
    }
  }
  try {
    const result = await execute(
      powershell,
      [
        '-NoLogo',
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-Command',
        WINDOWS_CURRENT_USER_PRIVATE_ACL_SCRIPT,
      ],
      {
        encoding: 'utf8',
        env: childEnvironment,
        maxBuffer: 64 * 1024,
        timeout: WINDOWS_PRIVATE_ACL_TIMEOUT_MS,
        windowsHide: true,
      }
    );
    return validateProof(JSON.parse(result.stdout.trim()), kind);
  } catch (error) {
    const detail = error?.stderr?.trim() || error?.message || 'unknown error';
    throw new Error(`failed to enforce current-user SID-only Windows ACL: ${detail}`, {
      cause: error,
    });
  }
}
