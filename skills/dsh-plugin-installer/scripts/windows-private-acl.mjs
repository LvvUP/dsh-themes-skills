import { execFile } from 'node:child_process';
import { lstat as fsLstat } from 'node:fs/promises';
import { win32 } from 'node:path';
import { promisify } from 'node:util';

import { acquireWindowsPowerShellTemp } from './windows-powershell-temp.mjs';

const execFileAsync = promisify(execFile);

export const WINDOWS_PRIVATE_ACL_TIMEOUT_MS = 60_000;

const PATH_ENV = 'DSH_PLUGIN_PRIVATE_PATH';
const KIND_ENV = 'DSH_PLUGIN_PRIVATE_KIND';
const ACTION_ENV = 'DSH_PLUGIN_PRIVATE_ACTION';
const BATCH_ENV = 'DSH_PLUGIN_PRIVATE_BATCH';
const VOLUME_ENV = 'DSH_PLUGIN_PRIVATE_VOLUME_SERIAL';
const FILE_INDEX_ENV = 'DSH_PLUGIN_PRIVATE_FILE_INDEX';
const MAX_BATCH_REQUESTS = 32;
const MAX_BATCH_ENV_BYTES = 24 * 1024;
const MAX_WINDOWS_LOCAL_PATH_CHARS = 32_760;
const HOST_WINDOWS_ROOTS = process.platform === 'win32'
  ? captureHostWindowsRoots()
  : Object.freeze([]);

function captureHostWindowsRoots() {
  try {
    const sharedObjects = process.report?.getReport?.().sharedObjects;
    if (!Array.isArray(sharedObjects)) return Object.freeze([]);
    const roots = [];
    for (const loadedPath of sharedObjects) {
      if (typeof loadedPath !== 'string') continue;
      const library = win32.basename(loadedPath).toLowerCase();
      if (!['kernel32.dll', 'kernelbase.dll', 'ntdll.dll'].includes(library)) continue;
      const systemDirectory = win32.dirname(loadedPath);
      if (!['system32', 'syswow64'].includes(win32.basename(systemDirectory).toLowerCase())) {
        continue;
      }
      roots.push(Object.freeze({
        name: `loaded ${library}`,
        value: win32.dirname(systemDirectory),
      }));
    }
    return Object.freeze(roots);
  } catch {
    return Object.freeze([]);
  }
}

export const WINDOWS_CURRENT_USER_PRIVATE_ACL_SCRIPT = String.raw`
$ErrorActionPreference = 'Stop'
if (-not ('DshPrivatePathNative' -as [type])) {
  Add-Type -TypeDefinition @'
using System;
using System.ComponentModel;
using System.Globalization;
using System.Runtime.InteropServices;
using System.Security.AccessControl;
using System.Security.Principal;
using System.Text;
using Microsoft.Win32.SafeHandles;

public sealed class DshPrivatePathProof
{
    public string Kind { get; set; }
    public string VolumeSerial { get; set; }
    public string FileIndex { get; set; }
    public string FileSystem { get; set; }
    public string CurrentSid { get; set; }
    public string OwnerSid { get; set; }
    public bool Protected { get; set; }
    public int RuleCount { get; set; }
    public string RuleSid { get; set; }
    public bool Inherited { get; set; }
    public bool Allow { get; set; }
    public bool FullControl { get; set; }
    public int InheritanceFlags { get; set; }
    public int PropagationFlags { get; set; }
    public int ShareMode { get; set; }
}

public static class DshPrivatePathNative
{
    [StructLayout(LayoutKind.Sequential)]
    private struct FileTime
    {
        public uint Low;
        public uint High;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct ByHandleFileInformation
    {
        public uint FileAttributes;
        public FileTime CreationTime;
        public FileTime LastAccessTime;
        public FileTime LastWriteTime;
        public uint VolumeSerialNumber;
        public uint FileSizeHigh;
        public uint FileSizeLow;
        public uint NumberOfLinks;
        public uint FileIndexHigh;
        public uint FileIndexLow;
    }

    private const uint ReadControl = 0x00020000;
    private const uint FileReadAttributes = 0x00000080;
    private const uint WriteDac = 0x00040000;
    private const uint WriteOwner = 0x00080000;
    private const uint FileShareRead = 0x00000001;
    private const uint FileShareWrite = 0x00000002;
    private const uint OpenExisting = 3;
    private const uint FileAttributeDirectory = 0x00000010;
    private const uint FileAttributeReparsePoint = 0x00000400;
    private const uint FileFlagOpenReparsePoint = 0x00200000;
    private const uint FileFlagBackupSemantics = 0x02000000;
    private const uint OwnerSecurityInformation = 0x00000001;
    private const uint DaclSecurityInformation = 0x00000004;
    private const uint ProtectedDaclSecurityInformation = 0x80000000;
    private const uint SeFileObject = 1;

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern SafeFileHandle CreateFileW(
        string fileName,
        uint desiredAccess,
        uint shareMode,
        IntPtr securityAttributes,
        uint creationDisposition,
        uint flagsAndAttributes,
        IntPtr templateFile);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool GetFileInformationByHandle(
        SafeFileHandle handle,
        out ByHandleFileInformation information);

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern bool GetVolumeInformationByHandleW(
        SafeFileHandle handle,
        StringBuilder volumeNameBuffer,
        uint volumeNameSize,
        out uint volumeSerialNumber,
        out uint maximumComponentLength,
        out uint fileSystemFlags,
        StringBuilder fileSystemNameBuffer,
        uint fileSystemNameSize);

    [DllImport("advapi32.dll")]
    private static extern uint GetSecurityInfo(
        IntPtr handle,
        uint objectType,
        uint requestedInformation,
        out IntPtr owner,
        out IntPtr group,
        out IntPtr dacl,
        out IntPtr sacl,
        out IntPtr securityDescriptor);

    [DllImport("advapi32.dll")]
    private static extern uint SetSecurityInfo(
        IntPtr handle,
        uint objectType,
        uint securityInformation,
        IntPtr owner,
        IntPtr group,
        IntPtr dacl,
        IntPtr sacl);

    [DllImport("advapi32.dll", SetLastError = true)]
    private static extern bool GetSecurityDescriptorOwner(
        IntPtr securityDescriptor,
        out IntPtr owner,
        [MarshalAs(UnmanagedType.Bool)] out bool ownerDefaulted);

    [DllImport("advapi32.dll", SetLastError = true)]
    private static extern bool GetSecurityDescriptorDacl(
        IntPtr securityDescriptor,
        [MarshalAs(UnmanagedType.Bool)] out bool daclPresent,
        out IntPtr dacl,
        [MarshalAs(UnmanagedType.Bool)] out bool daclDefaulted);

    [DllImport("advapi32.dll")]
    private static extern uint GetSecurityDescriptorLength(IntPtr securityDescriptor);

    [DllImport("kernel32.dll")]
    private static extern IntPtr LocalFree(IntPtr memory);

    private static string ExtendedLocalPath(string path)
    {
        if (String.IsNullOrEmpty(path) || path.Length < 3 ||
            !((path[0] >= 'A' && path[0] <= 'Z') || (path[0] >= 'a' && path[0] <= 'z')) ||
            path[1] != ':' || (path[2] != '\\' && path[2] != '/'))
            throw new InvalidOperationException("private path must remain local drive-absolute");
        string normalized = path.Replace('/', '\\');
        if (normalized.IndexOf(':', 2) >= 0)
            throw new InvalidOperationException("private path cannot contain an alternate data stream");
        return "\\\\?\\" + normalized;
    }

    private static FileSystemSecurity ReadSecurity(SafeFileHandle handle, bool directory)
    {
        uint requested = OwnerSecurityInformation | DaclSecurityInformation;
        IntPtr owner;
        IntPtr group;
        IntPtr dacl;
        IntPtr sacl;
        IntPtr descriptorPointer;
        uint error = GetSecurityInfo(
            handle.DangerousGetHandle(),
            SeFileObject,
            requested,
            out owner,
            out group,
            out dacl,
            out sacl,
            out descriptorPointer);
        if (error != 0) throw new Win32Exception((int)error, "cannot read private path security descriptor");
        try {
            uint length = GetSecurityDescriptorLength(descriptorPointer);
            if (length == 0 || length > 65536)
                throw new InvalidOperationException("private path security descriptor is unbounded");
            byte[] descriptor = new byte[length];
            Marshal.Copy(descriptorPointer, descriptor, 0, (int)length);
            FileSystemSecurity security = directory
                ? (FileSystemSecurity)new DirectorySecurity()
                : new FileSecurity();
            security.SetSecurityDescriptorBinaryForm(descriptor);
            return security;
        }
        finally {
            if (descriptorPointer != IntPtr.Zero) LocalFree(descriptorPointer);
        }
    }

    private static void ConfigureSecurity(
        SafeFileHandle handle,
        bool directory,
        SecurityIdentifier currentSid)
    {
        FileSystemSecurity security = directory
            ? (FileSystemSecurity)new DirectorySecurity()
            : new FileSecurity();
        security.SetAccessRuleProtection(true, false);
        security.SetOwner(currentSid);
        InheritanceFlags inheritance = directory
            ? InheritanceFlags.ContainerInherit | InheritanceFlags.ObjectInherit
            : InheritanceFlags.None;
        security.AddAccessRule(new FileSystemAccessRule(
            currentSid,
            FileSystemRights.FullControl,
            inheritance,
            PropagationFlags.None,
            AccessControlType.Allow));
        byte[] descriptor = security.GetSecurityDescriptorBinaryForm();
        uint information = OwnerSecurityInformation | DaclSecurityInformation |
            ProtectedDaclSecurityInformation;
        GCHandle pinned = GCHandle.Alloc(descriptor, GCHandleType.Pinned);
        try {
            IntPtr descriptorPointer = pinned.AddrOfPinnedObject();
            IntPtr owner;
            bool ownerDefaulted;
            if (!GetSecurityDescriptorOwner(descriptorPointer, out owner, out ownerDefaulted) ||
                owner == IntPtr.Zero)
                throw new Win32Exception(Marshal.GetLastWin32Error(), "cannot bind private path owner");
            bool daclPresent;
            bool daclDefaulted;
            IntPtr dacl;
            if (!GetSecurityDescriptorDacl(
                descriptorPointer, out daclPresent, out dacl, out daclDefaulted) ||
                !daclPresent || dacl == IntPtr.Zero)
                throw new Win32Exception(Marshal.GetLastWin32Error(), "cannot bind private path DACL");
            uint error = SetSecurityInfo(
                handle.DangerousGetHandle(),
                SeFileObject,
                information,
                owner,
                IntPtr.Zero,
                dacl,
                IntPtr.Zero);
            if (error != 0)
                throw new Win32Exception((int)error, "cannot configure private path security descriptor");
        }
        finally {
            pinned.Free();
        }
    }

    public static DshPrivatePathProof SecureAndInspect(
        string path,
        string kind,
        string action,
        string expectedVolumeSerial,
        string expectedFileIndex)
    {
        bool directory = kind == "directory";
        bool configure = action == "configure" || action == "configure-open-writer";
        bool openWriter = action == "configure-open-writer";
        if (directory && openWriter)
            throw new InvalidOperationException("directory ACL configuration cannot admit a writer");
        uint access = ReadControl | FileReadAttributes;
        if (configure) access |= WriteDac | WriteOwner;
        uint shareMode = FileShareRead | (openWriter ? FileShareWrite : 0);
        using (SafeFileHandle handle = CreateFileW(
            ExtendedLocalPath(path),
            access,
            shareMode,
            IntPtr.Zero,
            OpenExisting,
            FileFlagBackupSemantics | FileFlagOpenReparsePoint,
            IntPtr.Zero))
        {
            if (handle.IsInvalid)
                throw new Win32Exception(Marshal.GetLastWin32Error(), "cannot open private path by handle");
            ByHandleFileInformation information;
            if (!GetFileInformationByHandle(handle, out information))
                throw new Win32Exception(Marshal.GetLastWin32Error(), "cannot identify private path handle");
            StringBuilder fileSystemName = new StringBuilder(32);
            uint volumeInfoSerial;
            uint maximumComponentLength;
            uint fileSystemFlags;
            if (!GetVolumeInformationByHandleW(
                handle,
                null,
                0,
                out volumeInfoSerial,
                out maximumComponentLength,
                out fileSystemFlags,
                fileSystemName,
                (uint)fileSystemName.Capacity))
                throw new Win32Exception(Marshal.GetLastWin32Error(), "cannot identify private path filesystem");
            string fileSystem = fileSystemName.ToString();
            if (!String.Equals(fileSystem, "NTFS", StringComparison.OrdinalIgnoreCase) ||
                volumeInfoSerial != information.VolumeSerialNumber)
                throw new InvalidOperationException("private path must reside on one consistently identified NTFS volume");
            fileSystem = "NTFS";
            bool actualDirectory = (information.FileAttributes & FileAttributeDirectory) != 0;
            bool reparsePoint = (information.FileAttributes & FileAttributeReparsePoint) != 0;
            if (actualDirectory != directory || reparsePoint)
                throw new InvalidOperationException("private path handle kind is invalid");
            if (!directory && information.NumberOfLinks != 1)
                throw new InvalidOperationException("private file handle must have one link");
            ulong volumeSerial = information.VolumeSerialNumber;
            ulong fileIndex = ((ulong)information.FileIndexHigh << 32) | information.FileIndexLow;
            ulong expectedVolume = UInt64.Parse(
                expectedVolumeSerial, NumberStyles.None, CultureInfo.InvariantCulture);
            ulong expectedIndex = UInt64.Parse(
                expectedFileIndex, NumberStyles.None, CultureInfo.InvariantCulture);
            if (volumeSerial != expectedVolume || fileIndex != expectedIndex)
                throw new InvalidOperationException("private path identity changed before ACL verification");

            SecurityIdentifier currentSid = WindowsIdentity.GetCurrent().User;
            if (configure) ConfigureSecurity(handle, directory, currentSid);
            FileSystemSecurity verified = ReadSecurity(handle, directory);
            string ownerSid = verified.GetOwner(typeof(SecurityIdentifier)).Value;
            AuthorizationRuleCollection rules = verified.GetAccessRules(
                true, true, typeof(SecurityIdentifier));
            FileSystemAccessRule rule = rules.Count == 1
                ? (FileSystemAccessRule)rules[0]
                : null;
            return new DshPrivatePathProof {
                Kind = kind,
                VolumeSerial = volumeSerial.ToString(CultureInfo.InvariantCulture),
                FileIndex = fileIndex.ToString(CultureInfo.InvariantCulture),
                FileSystem = fileSystem,
                CurrentSid = currentSid.Value,
                OwnerSid = ownerSid,
                Protected = verified.AreAccessRulesProtected,
                RuleCount = rules.Count,
                RuleSid = rule == null ? null : rule.IdentityReference.Value,
                Inherited = rule != null && rule.IsInherited,
                Allow = rule != null && rule.AccessControlType == AccessControlType.Allow,
                FullControl = rule != null && rule.FileSystemRights == FileSystemRights.FullControl,
                InheritanceFlags = rule == null ? -1 : (int)rule.InheritanceFlags,
                PropagationFlags = rule == null ? -1 : (int)rule.PropagationFlags,
                ShareMode = (int)shareMode
            };
        }
    }
}
'@
}
$target = [Environment]::GetEnvironmentVariable('DSH_PLUGIN_PRIVATE_PATH', 'Process')
$kind = [Environment]::GetEnvironmentVariable('DSH_PLUGIN_PRIVATE_KIND', 'Process')
$action = [Environment]::GetEnvironmentVariable('DSH_PLUGIN_PRIVATE_ACTION', 'Process')
$batch = [Environment]::GetEnvironmentVariable('DSH_PLUGIN_PRIVATE_BATCH', 'Process')
$isBatch = -not [String]::IsNullOrWhiteSpace($batch)
if ($isBatch) {
  try {
    $requestJson = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($batch))
    $requests = @($requestJson | ConvertFrom-Json)
  } catch {
    throw 'invalid private path batch'
  }
  if ($requests.Count -lt 1 -or $requests.Count -gt 32) { throw 'invalid private path batch size' }
} else {
  $volumeSerial = [Environment]::GetEnvironmentVariable('DSH_PLUGIN_PRIVATE_VOLUME_SERIAL', 'Process')
  $fileIndex = [Environment]::GetEnvironmentVariable('DSH_PLUGIN_PRIVATE_FILE_INDEX', 'Process')
  $requests = @([PSCustomObject]@{
    path = $target
    kind = $kind
    action = $action
    volumeSerial = $volumeSerial
    fileIndex = $fileIndex
  })
}

$proofs = [System.Collections.Generic.List[object]]::new()
foreach ($request in $requests) {
  $target = $request.path
  $kind = $request.kind
  $action = $request.action
  if ([String]::IsNullOrWhiteSpace($target)) { throw 'missing private path' }
  if ($kind -ne 'directory' -and $kind -ne 'file') { throw 'invalid private path kind' }
  if ($action -ne 'configure' -and $action -ne 'configure-open-writer' -and
      $action -ne 'verify') { throw 'invalid private path action' }
  if ($kind -eq 'directory' -and $action -eq 'configure-open-writer') {
    throw 'directory private path cannot admit an open writer'
  }
  if ([String]::IsNullOrWhiteSpace($request.volumeSerial) -or
      [String]::IsNullOrWhiteSpace($request.fileIndex)) {
    throw 'missing private path identity'
  }
  $verified = [DshPrivatePathNative]::SecureAndInspect(
    $target, $kind, $action, $request.volumeSerial, $request.fileIndex)
  [void]$proofs.Add([PSCustomObject]@{
    schemaVersion = 3
    kind = $kind
    volumeSerial = $verified.VolumeSerial
    fileIndex = $verified.FileIndex
    fileSystem = $verified.FileSystem
    currentSid = $verified.CurrentSid
    ownerSid = $verified.OwnerSid
    protected = $verified.Protected
    ruleCount = $verified.RuleCount
    ruleSid = $verified.RuleSid
    inherited = $verified.Inherited
    allow = $verified.Allow
    fullControl = $verified.FullControl
    inheritanceFlags = $verified.InheritanceFlags
    propagationFlags = $verified.PropagationFlags
    shareMode = $verified.ShareMode
  })
}

if ($isBatch) {
  [Console]::WriteLine((ConvertTo-Json -InputObject ($proofs.ToArray()) -Compress))
} else {
  [Console]::WriteLine((ConvertTo-Json -InputObject ($proofs[0]) -Compress))
}
`;

function validateProof(proof, kind, action, identity) {
  const inheritanceFlags = kind === 'directory' ? 3 : 0;
  const shareMode = action === 'configure-open-writer' ? 3 : 1;
  if (
    proof === null ||
    typeof proof !== 'object' ||
    proof.schemaVersion !== 3 ||
    proof.kind !== kind ||
    proof.volumeSerial !== identity.volumeSerial ||
    proof.fileIndex !== identity.fileIndex ||
    proof.fileSystem !== 'NTFS' ||
    !/^S-1-[0-9-]+$/u.test(proof.currentSid ?? '') ||
    proof.ownerSid !== proof.currentSid ||
    proof.protected !== true ||
    proof.ruleCount !== 1 ||
    proof.ruleSid !== proof.currentSid ||
    proof.inherited !== false ||
    proof.allow !== true ||
    proof.fullControl !== true ||
    proof.inheritanceFlags !== inheritanceFlags ||
    proof.propagationFlags !== 0 ||
    proof.shareMode !== shareMode
  ) {
    throw new Error('Windows private-path ACL proof is malformed or weaker than current-user SID-only');
  }
  return Object.freeze({ ...proof });
}

function normalizeLocalWindowsPath(path, label) {
  if (typeof path !== 'string' || path.length === 0 || path.includes('\0') ||
      !/^[A-Za-z]:[\\/]/u.test(path) || path.slice(2).includes(':')) {
    throw new Error(`${label} must be a local drive-absolute path`);
  }
  const normalized = win32.normalize(path);
  if (!/^[A-Za-z]:\\/u.test(normalized) || normalized.slice(2).includes(':')) {
    throw new Error(`${label} must stay local after normalization`);
  }
  if (normalized.length > MAX_WINDOWS_LOCAL_PATH_CHARS) {
    throw new Error(`${label} is too long for fail-closed Windows handling`);
  }
  return normalized;
}

export function trustedWindowsSystemRootFromCandidates(candidates, label = 'candidate') {
  if (!Array.isArray(candidates) || candidates.length === 0) {
    throw new Error(`cannot resolve the ${label} Windows system root`);
  }
  const normalized = candidates.map(({ name, value }) =>
    normalizeLocalWindowsPath(value, `${label} Windows ${name}`));
  const identities = normalized.map((value) =>
    value.replace(/\\+$/u, '').toLowerCase());
  if (new Set(identities).size !== 1) {
    throw new Error(`${label} Windows system roots disagree`);
  }
  return normalized[0];
}

export function trustedWindowsSystemRoot({
  platform = process.platform,
  systemRootForTesting,
} = {}) {
  if (platform !== 'win32') {
    throw new Error('trusted Windows system root resolution requires win32');
  }
  if (process.platform === 'win32') {
    if (systemRootForTesting !== undefined) {
      throw new Error('trusted Windows system root cannot be overridden on a Windows host');
    }
    return trustedWindowsSystemRootFromCandidates(HOST_WINDOWS_ROOTS, 'trusted host');
  }
  if (systemRootForTesting === undefined) {
    throw new Error('simulated win32 requires an explicit test-only Windows system root');
  }
  return trustedWindowsSystemRootFromCandidates([
    { name: 'systemRootForTesting', value: systemRootForTesting },
  ], 'test-only');
}

function childEnvironment(environment, systemRoot, powerShellTemp, extra) {
  if (environment === null || typeof environment !== 'object' || Array.isArray(environment)) {
    throw new Error('Windows private-path ACL environment is malformed');
  }
  const normalizedTemp = normalizeLocalWindowsPath(
    powerShellTemp,
    'Windows private-path ACL PowerShell temp'
  );
  return {
    SystemRoot: systemRoot,
    WINDIR: systemRoot,
    TEMP: normalizedTemp,
    TMP: normalizedTemp,
    ...extra,
  };
}

export function windowsPrivateIdentityFromStat(stat, kind) {
  const validKind = kind === 'directory' ? stat.isDirectory() : stat.isFile();
  if (!validKind || stat.isSymbolicLink() ||
      typeof stat.dev !== 'bigint' || typeof stat.ino !== 'bigint' ||
      stat.dev < 0n || stat.ino < 0n || (kind === 'file' && stat.nlink !== 1n)) {
    throw new Error('Windows private-path ACL target identity is invalid');
  }
  return Object.freeze({
    volumeSerial: stat.dev.toString(10),
    fileIndex: stat.ino.toString(10),
  });
}

function normalizeExpectedIdentity(identity) {
  if (identity === null || typeof identity !== 'object' || Array.isArray(identity) ||
      !/^(?:0|[1-9][0-9]*)$/u.test(identity.volumeSerial ?? '') ||
      !/^(?:0|[1-9][0-9]*)$/u.test(identity.fileIndex ?? '') ||
      Object.keys(identity).some((key) => !['fileIndex', 'volumeSerial'].includes(key))) {
    throw new Error('Windows private-path ACL expected identity is malformed');
  }
  return Object.freeze({
    volumeSerial: identity.volumeSerial,
    fileIndex: identity.fileIndex,
  });
}

export async function captureWindowsPrivatePathIdentity(
  path,
  kind,
  { lstatPath = fsLstat } = {}
) {
  let stat;
  try {
    stat = await lstatPath(path, { bigint: true });
  } catch (error) {
    throw new Error('Windows private-path ACL target cannot be inspected', { cause: error });
  }
  return windowsPrivateIdentityFromStat(stat, kind);
}

async function inspectPrivatePath(path, kind, lstatPath) {
  return captureWindowsPrivatePathIdentity(path, kind, { lstatPath });
}

async function verifyPrivatePathIdentity(path, kind, identity, lstatPath) {
  const after = await inspectPrivatePath(path, kind, lstatPath);
  if (after.volumeSerial !== identity.volumeSerial || after.fileIndex !== identity.fileIndex) {
    throw new Error('Windows private-path ACL target changed during verification');
  }
}

export async function secureWindowsPrivatePath(
  path,
  kind,
  action,
  {
    environment = process.env,
    execute = execFileAsync,
    expectedIdentity,
    lstatPath = fsLstat,
    platform = process.platform,
    powerShellTempExecute,
    powerShellTempForTesting,
    systemRootForTesting,
  } = {}
) {
  if (platform !== 'win32') {
    throw new Error('Windows private-path ACL enforcement requires win32');
  }
  const normalizedPath = normalizeLocalWindowsPath(path, 'Windows private-path ACL target');
  if (!['directory', 'file'].includes(kind) ||
      !['configure', 'configure-open-writer', 'verify'].includes(action) ||
      (kind === 'directory' && action === 'configure-open-writer')) {
    throw new Error('Windows private-path ACL request is malformed');
  }
  if (typeof execute !== 'function' || typeof lstatPath !== 'function') {
    throw new Error('Windows private-path ACL dependencies are malformed');
  }
  const systemRoot = trustedWindowsSystemRoot({ platform, systemRootForTesting });
  const identity = normalizeExpectedIdentity(expectedIdentity);
  const observed = await inspectPrivatePath(normalizedPath, kind, lstatPath);
  if (observed.volumeSerial !== identity.volumeSerial ||
      observed.fileIndex !== identity.fileIndex) {
    throw new Error('Windows private-path ACL target differs from the caller-bound identity');
  }
  const powershell = win32.join(
    systemRoot,
    'System32',
    'WindowsPowerShell',
    'v1.0',
    'powershell.exe'
  );
  const bootstrap = await acquireWindowsPowerShellTemp({
    environment,
    execute: powerShellTempExecute,
    platform,
    powershell,
    powerShellTempForTesting,
    systemRoot,
  });
  const env = childEnvironment(environment, systemRoot, bootstrap.path, {
    [PATH_ENV]: normalizedPath,
    [KIND_ENV]: kind,
    [ACTION_ENV]: action,
    [VOLUME_ENV]: identity.volumeSerial,
    [FILE_INDEX_ENV]: identity.fileIndex,
  });
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
        env,
        maxBuffer: 64 * 1024,
        timeout: WINDOWS_PRIVATE_ACL_TIMEOUT_MS,
        windowsHide: true,
      }
    );
    const proof = validateProof(JSON.parse(result.stdout.trim()), kind, action, identity);
    await verifyPrivatePathIdentity(normalizedPath, kind, identity, lstatPath);
    return proof;
  } catch (error) {
    const detail = error?.stderr?.trim() || error?.message || 'unknown error';
    throw new Error(`failed to enforce current-user SID-only Windows ACL: ${detail}`, {
      cause: error,
    });
  } finally {
    await bootstrap.release();
  }
}

export async function secureWindowsPrivatePaths(
  requests,
  {
    environment = process.env,
    execute = execFileAsync,
    lstatPath = fsLstat,
    platform = process.platform,
    powerShellTempExecute,
    powerShellTempForTesting,
    systemRootForTesting,
  } = {}
) {
  if (platform !== 'win32') {
    throw new Error('Windows private-path ACL enforcement requires win32');
  }
  if (!Array.isArray(requests) || requests.length < 1 || requests.length > MAX_BATCH_REQUESTS) {
    throw new Error('Windows private-path ACL batch is malformed');
  }
  const normalized = requests.map((request) => {
    if (request === null || typeof request !== 'object' || Array.isArray(request) ||
        !['directory', 'file'].includes(request.kind) ||
        !['configure', 'configure-open-writer', 'verify'].includes(request.action) ||
        (request.kind === 'directory' && request.action === 'configure-open-writer') ||
        request.expectedIdentity === undefined) {
      throw new Error('Windows private-path ACL batch is malformed');
    }
    return {
      path: normalizeLocalWindowsPath(request.path, 'Windows private-path ACL batch target'),
      kind: request.kind,
      action: request.action,
      expectedIdentity: normalizeExpectedIdentity(request.expectedIdentity),
    };
  });
  if (typeof execute !== 'function' || typeof lstatPath !== 'function') {
    throw new Error('Windows private-path ACL dependencies are malformed');
  }
  const systemRoot = trustedWindowsSystemRoot({ platform, systemRootForTesting });
  const identities = normalized.map(({ expectedIdentity }) => expectedIdentity);
  const observed = await Promise.all(normalized.map(({ path, kind }) =>
    inspectPrivatePath(path, kind, lstatPath)));
  for (let index = 0; index < identities.length; index += 1) {
    if (observed[index].volumeSerial !== identities[index].volumeSerial ||
        observed[index].fileIndex !== identities[index].fileIndex) {
      throw new Error('Windows private-path ACL batch differs from caller-bound identities');
    }
  }
  const bound = normalized.map((request, index) => ({
    path: request.path,
    kind: request.kind,
    action: request.action,
    volumeSerial: identities[index].volumeSerial,
    fileIndex: identities[index].fileIndex,
  }));
  const encoded = Buffer.from(JSON.stringify(bound), 'utf8').toString('base64');
  if (Buffer.byteLength(encoded, 'ascii') > MAX_BATCH_ENV_BYTES) {
    throw new Error('Windows private-path ACL batch is too large');
  }
  const powershell = win32.join(
    systemRoot,
    'System32',
    'WindowsPowerShell',
    'v1.0',
    'powershell.exe'
  );
  const bootstrap = await acquireWindowsPowerShellTemp({
    environment,
    execute: powerShellTempExecute,
    platform,
    powershell,
    powerShellTempForTesting,
    systemRoot,
  });
  const env = childEnvironment(environment, systemRoot, bootstrap.path, {
    [BATCH_ENV]: encoded,
  });
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
        env,
        maxBuffer: 64 * 1024,
        timeout: WINDOWS_PRIVATE_ACL_TIMEOUT_MS,
        windowsHide: true,
      }
    );
    const parsed = JSON.parse(result.stdout.trim());
    if (!Array.isArray(parsed) || parsed.length !== normalized.length) {
      throw new Error('Windows private-path ACL batch proof count is invalid');
    }
    const proofs = Object.freeze(parsed.map((proof, index) =>
      validateProof(
        proof,
        normalized[index].kind,
        normalized[index].action,
        identities[index]
      )));
    await Promise.all(normalized.map(({ path, kind }, index) =>
      verifyPrivatePathIdentity(path, kind, identities[index], lstatPath)));
    return proofs;
  } catch (error) {
    const detail = error?.stderr?.trim() || error?.message || 'unknown error';
    throw new Error(`failed to enforce current-user SID-only Windows ACL batch: ${detail}`, {
      cause: error,
    });
  } finally {
    await bootstrap.release();
  }
}
