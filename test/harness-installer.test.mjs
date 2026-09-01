import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { gzipSync } from 'node:zlib';

import {
  createLifecyclePnpmCommand,
  createSourcePnpmCommand,
  requireFreshSourceDependencyTree,
  sourceBuildEnvironment,
  sourceBuildPath,
  sourceBuildRootPath,
  verifyNoLifecycleToolShadow,
} from '../skills/dsh-harness-installer/scripts/build-source.mjs';
import { packageManagerEnvironment } from '../skills/dsh-harness-installer/scripts/install-official.mjs';
import {
  loadAuthority,
  loadInstallReceiptSchema,
  loadReceiptSchema,
  validateAuthority,
  validateBuildReceipt,
  validateInstallReceipt,
} from '../skills/dsh-harness-installer/scripts/authority.mjs';
import { parseRunArgs } from '../skills/dsh-harness-installer/scripts/run-source-built.mjs';
import { parseRunArgs as parseOfficialRunArgs } from '../skills/dsh-harness-installer/scripts/run-official.mjs';
import {
  assertNoRuntimeSecrets,
  canonicalRuntimeJson,
  readPrivateBuildReceipt,
  readPrivateInstallReceipt,
} from '../skills/dsh-harness-installer/scripts/runtime-certification.mjs';
import { runtimeTasks } from '../skills/dsh-harness-installer/scripts/runtime-authority.mjs';
import { materializePnpmToolchain } from '../skills/dsh-harness-installer/scripts/pnpm-toolchain.mjs';
import { inspectTarEntries } from '../skills/dsh-harness-installer/scripts/tar-policy.mjs';

const authorityPath = resolve(
  'skills/dsh-harness-installer/references/alpha2-release-authority.json'
);
const prepareSource = resolve(
  'skills/dsh-harness-installer/scripts/prepare-source.mjs'
);

function ustarFixture({ hiddenNameByte = false, zeroGap = false, badMagic = false } = {}) {
  const header = Buffer.alloc(512);
  header.write('package/file.txt');
  header.write('0000600\0', 100, 'ascii');
  header.write('0000000\0', 108, 'ascii');
  header.write('0000000\0', 116, 'ascii');
  header.write('00000000003\0', 124, 'ascii');
  header.write('00000000000\0', 136, 'ascii');
  header.fill(0x20, 148, 156);
  header[156] = 0x30;
  header.write(badMagic ? 'broken\0' : 'ustar\0', 257, 'binary');
  header.write('00', 263, 'ascii');
  if (hiddenNameByte) header[17] = 0x78;
  let checksum = 0;
  for (const byte of header) checksum += byte;
  header.write(`${checksum.toString(8).padStart(6, '0')}\0 `, 148, 'binary');
  const body = Buffer.alloc(512);
  body.write('abc');
  const terminator = Buffer.alloc(1024);
  return gzipSync(Buffer.concat([
    header,
    body,
    ...(zeroGap ? [Buffer.alloc(512), header, body] : []),
    terminator,
  ]));
}

function receipt(authority) {
  return {
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
      platform: 'darwin',
      arch: 'arm64',
      nodeVersion: '24.15.0',
      packageManager: 'pnpm',
      packageManagerVersion: '11.7.0',
    },
    result: {
      buildScript: 'build:official',
      builtCliPath: 'apps/cli/lib/bin.js',
      builtCliSha256: 'a'.repeat(64),
      reportedVersion: '0.1.2-alpha.2',
      pathInstalled: false,
    },
    privacy: {
      capturesProcessOutput: false,
      capturesEnvironment: false,
      capturesBrowserCredentials: false,
      capturesCredentialDerivedDigest: false,
    },
  };
}

function installReceipt(authority) {
  return {
    schemaVersion: 1,
    status: 'official-npm-install-passed',
    scope: 'one-machine-versioned-user-install',
    package: {
      name: authority.officialNpm.packageName,
      version: authority.officialNpm.version,
      distIntegrity: authority.officialNpm.distIntegrity,
      tarballSha256: authority.officialNpm.tarballSha256,
      cliSha256: authority.officialNpm.cliSha256,
    },
    resolution: {
      lockfileSha256: authority.runtimeInstall.lockfileSha256,
      frozenLockfile: true,
      lifecycleScriptsRun: false,
      peerPolicy: 'upstream-compatible-locked-resolution',
    },
    toolchain: {
      platform: 'darwin',
      arch: 'arm64',
      nodeVersion: '24.15.0',
      packageManager: 'pnpm',
      packageManagerVersion: '11.7.0',
    },
    result: {
      installedCliPath: authority.runtimeInstall.installedCliPath,
      installedCliSha256: authority.officialNpm.cliSha256,
      reportedVersion: authority.release.version,
      pathInstalled: false,
      versionedDirectory: true,
    },
    provenanceBoundary: {
      npmGitHeadPresent: false,
      npmProvenanceAttestationPresent: false,
      sourceCommitBoundToNpmArtifact: false,
      binarySourceEquivalenceClaimed: false,
    },
    privacy: {
      capturesProcessOutput: false,
      capturesEnvironment: false,
      capturesBrowserCredentials: false,
      capturesCredentialDerivedDigest: false,
      capturesInstallPath: false,
    },
  };
}

test('alpha.2 authority binds the exact official npm runtime and source cross-build identities', async () => {
  const bytes = await readFile(authorityPath);
  const authority = validateAuthority(JSON.parse(bytes));
  assert.match(createHash('sha256').update(bytes).digest('hex'), /^[a-f0-9]{64}$/u);
  assert.deepEqual(
    {
      tag: authority.release.tag,
      commit: authority.release.commit,
      tree: authority.release.tree,
      lockfileBytes: authority.source.lockfileBytes,
      lockfileSha256: authority.source.lockfileSha256,
      pnpm: authority.source.packageManagerVersion,
      node: authority.runtimeMatrix.nodeVersions,
    },
    {
      tag: 'dsh-v0.1.2-alpha.2',
      commit: '0a53fb55bea101816fa226bb964ae2bed71c343b',
      tree: '64ccbfa8e0caa4711cd4a75717ef9e022657961b',
      lockfileBytes: 774264,
      lockfileSha256:
        '6cc109a574218f51762474455c8d72e5f7c2625aedf25e85569dba1af7adcef0',
      pnpm: '11.7.0',
      node: ['22.19.0', '24.15.0'],
    }
  );
  assert.equal(authority.release.releaseAssetCount, 0);
  assert.equal(authority.release.npmPackagesPublished, true);
  assert.equal(authority.officialNpm.packageName, '@deepseek-ai/dsh');
  assert.equal(authority.officialNpm.provenanceAttestationPresent, false);
  assert.equal(authority.officialNpm.gitHeadPresent, false);
  assert.deepEqual(authority.officialSafety, {
    path: 'SAFETY.md',
    tagUrl:
      'https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.2-alpha.2/SAFETY.md',
    commitUrl:
      'https://github.com/deepseek-ai/deepseek-harness/blob/0a53fb55bea101816fa226bb964ae2bed71c343b/SAFETY.md',
    gitBlob: '2b76f00e0619ee69553afdc507df361080f4d3ac',
    bytes: 1673,
    sha256: '62075bb51e0f7790441e7722ff12063107b4866019332e71ef01b63b6f880fee',
  });
  assert.equal(authority.publication.publishedInstallable, true);
  assert.equal(authority.publication.completedReceipts.length, 6);
  assert.equal(
    authority.publication.receiptSetSha256,
    '3a1017961b0fbc2ac3e773913009c842332b030b5494a5af454594afdb679d0a'
  );
  assert.equal(authority.historicalAuthority.rc8ItemLaneUnchanged, true);
  assert.equal(authority.historicalAuthority.rc2RuntimeLaneUnchanged, true);
  assert.equal(authority.historicalAuthority.alpha1SourceLaneUnchanged, true);
});

test('source authority rejects tag, tree, lock, package-manager, and promotion drift', async () => {
  const authority = await loadAuthority();
  for (const mutate of [
    (value) => { value.release.tag = 'dsh-v0.1.2-alpha.3'; },
    (value) => { value.release.tree = '0'.repeat(40); },
    (value) => { value.source.lockfileSha256 = '0'.repeat(64); },
    (value) => { value.source.packageManagerVersion = '11.24.0'; },
    (value) => { value.source.nodeEngine = '>=22'; },
    (value) => { value.source.installArgs.pop(); },
    (value) => { value.officialSafety.sha256 = '0'.repeat(64); },
    (value) => { value.officialSafety.commitUrl = value.officialSafety.tagUrl; },
    (value) => { value.publication.publishedInstallable = false; },
  ]) {
    const changed = structuredClone(authority);
    mutate(changed);
    assert.throws(() => validateAuthority(changed));
  }
});

test('official npm install receipt schema is closed and bound to the frozen resolution', async () => {
  const authority = await loadAuthority();
  const schema = await loadInstallReceiptSchema();
  assert.equal(schema.additionalProperties, false);
  assert.equal(schema.properties.package.additionalProperties, false);
  assert.equal(schema.properties.resolution.additionalProperties, false);
  assert.equal(schema.properties.result.additionalProperties, false);
  assert.doesNotThrow(() => validateInstallReceipt(installReceipt(authority), authority));
  for (const mutate of [
    (value) => { value.package.tarballSha256 = '0'.repeat(64); },
    (value) => { value.resolution.frozenLockfile = false; },
    (value) => { value.resolution.lifecycleScriptsRun = true; },
    (value) => { value.result.pathInstalled = true; },
    (value) => { value.provenanceBoundary.sourceCommitBoundToNpmArtifact = true; },
    (value) => { value.privacy.capturesInstallPath = true; },
  ]) {
    const changed = installReceipt(authority);
    mutate(changed);
    assert.throws(() => validateInstallReceipt(changed, authority));
  }
});

test('private receipt readers preserve the strict scanner after validating the false privacy assertion', async () => {
  const authority = await loadAuthority();
  const root = await mkdtemp(join(tmpdir(), 'dsh-private-receipt-proof-'));
  try {
    const buildPath = join(root, 'build.json');
    const installPath = join(root, 'install.json');
    for (const task of runtimeTasks()) {
      const build = receipt(authority);
      const install = installReceipt(authority);
      Object.assign(build.toolchain, task);
      Object.assign(install.toolchain, task);
      const buildBytes = canonicalRuntimeJson(build);
      const installBytes = canonicalRuntimeJson(install);
      await writeFile(buildPath, buildBytes);
      await writeFile(installPath, installBytes);

      assert.throws(
        () => assertNoRuntimeSecrets(installBytes, 'generic evidence'),
        /forbidden secret material/u
      );
      const loadedBuild = await readPrivateBuildReceipt(buildPath, authority);
      const loadedInstall = await readPrivateInstallReceipt(
        installPath,
        authority
      );
      assert.deepEqual(loadedBuild.value, build);
      assert.deepEqual(loadedInstall.value, install);
      assert.equal(loadedBuild.bytes.toString('utf8'), buildBytes);
      assert.equal(loadedInstall.bytes.toString('utf8'), installBytes);
    }

    const install = installReceipt(authority);
    await writeFile(installPath, JSON.stringify(install));
    await assert.rejects(
      readPrivateInstallReceipt(installPath, authority),
      /canonical JSON bytes/u
    );

    const credentialLike = installReceipt(authority);
    credentialLike.privacy.capturesCredentialDerivedDigest = 'A'.repeat(43);
    await writeFile(installPath, canonicalRuntimeJson(credentialLike));
    await assert.rejects(
      readPrivateInstallReceipt(installPath, authority),
      /credential-like material/u
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('build receipt schema is closed and the validator excludes browser credentials and related digests', async () => {
  const authority = await loadAuthority();
  const schema = await loadReceiptSchema();
  assert.equal(schema.additionalProperties, false);
  assert.equal(schema.properties.source.additionalProperties, false);
  assert.equal(schema.properties.toolchain.additionalProperties, false);
  assert.equal(schema.properties.toolchain.oneOf.length, 3);
  assert.equal(schema.properties.result.additionalProperties, false);
  assert.match(schema.properties.result.properties.builtCliSha256.pattern, /64/);
  assert.equal(schema.properties.privacy.additionalProperties, false);
  assert.doesNotThrow(() => validateBuildReceipt(receipt(authority), authority));
  const crossPaired = receipt(authority);
  crossPaired.toolchain.arch = 'x64';
  assert.throws(
    () => validateBuildReceipt(crossPaired, authority),
    /platform and architecture pair/u
  );

  const attacks = [
    (value) => { value.token = 'fixture'; },
    (value) => { value.cookie = 'dsh_session=fixture'; },
    (value) => { value.result.browserSessionDigest = 'a'.repeat(64); },
    (value) => { value.result.note = 'http://127.0.0.1:3080/?token=fixture'; },
    (value) => { value.result.note = 'A'.repeat(43); },
    (value) => { value.result.builtCliSha256 = 'not-a-digest'; },
    (value) => { value.privacy.capturesCredentialDerivedDigest = true; },
  ];
  for (const attack of attacks) {
    const changed = receipt(authority);
    attack(changed);
    assert.throws(() => validateBuildReceipt(changed, authority), /forbidden|credential|privacy|keys|result|digest/i);
  }
});

test('source preparation rejects a relative destination before any clone', () => {
  const result = spawnSync(process.execPath, [prepareSource, '--output', 'relative-source'], {
    encoding: 'utf8',
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /--output must be an absolute path/);
});

test('source-built runner admits only version inspection or the exact loopback Web launch', () => {
  const prefix = ['--source', '/private/source', '--receipt', '/private/receipt.json', '--'];
  assert.deepEqual(parseRunArgs([...prefix, '--version']).dshArgs, ['--version']);
  assert.deepEqual(parseRunArgs([...prefix, 'web', '--no-open']).dshArgs, ['web', '--no-open']);
  for (const args of [
    ['web'],
    ['web', '--no-open', '--host', '0.0.0.0'],
    ['web', '--no-open', '--port', '8080'],
    ['plugin', '--profile', 'web', 'add', 'x'],
  ]) {
    assert.throws(() => parseRunArgs([...prefix, ...args]), /permits only|allows only/);
  }
});

test('official runner requires the fixed install receipt and a pre-switch Profile backup', () => {
  const prefix = ['--install', '/private/runtime', '--receipt', '/private/install.json'];
  assert.deepEqual(
    parseOfficialRunArgs([...prefix, '--', '--version']).dshArgs,
    ['--version']
  );
  const web = parseOfficialRunArgs([
    ...prefix,
    '--dsh-home', '/private/dsh-home',
    '--snapshot', '/private/snapshot',
    '--', 'web', '--no-open',
  ]);
  assert.equal(web.dshHome, '/private/dsh-home');
  assert.equal(web.snapshot, '/private/snapshot');
  for (const args of [
    [...prefix, '--', 'web', '--no-open'],
    [...prefix, '--', 'web'],
    [...prefix, '--', 'plugin', 'add', 'x'],
    [...prefix, '--dsh-home', '/private/home', '--', '--version'],
  ]) assert.throws(() => parseOfficialRunArgs(args), /requires|permits|accepts/u);
});

test('bundled pnpm toolchain materializes exactly and tar policy rejects ambiguous archives', async () => {
  assert.equal(inspectTarEntries(ustarFixture()).length, 1);
  assert.throws(() => inspectTarEntries(Buffer.alloc(1024)), /compressed size/u);
  assert.throws(() => inspectTarEntries(ustarFixture({ hiddenNameByte: true })), /hidden bytes/u);
  assert.throws(() => inspectTarEntries(ustarFixture({ zeroGap: true })), /zero-block gap/u);
  assert.throws(() => inspectTarEntries(ustarFixture({ badMagic: true })), /POSIX ustar/u);

  const root = await realpath(
    await mkdtemp(join(tmpdir(), 'dsh-alpha2-pnpm-test-'))
  );
  const injectedNames = [
    'COMSPEC',
    'COREPACK_HOME',
    'DSH_BUILD_PNPM_CLI',
    'DSH_BUILD_PNPM_NODE',
    'DSH_CLIENT_COMMIT_HASH',
    'DSH_CLIENT_VERSION',
    'NODE_OPTIONS',
    'NODE_PATH',
    'NPM_CONFIG_SCRIPT_SHELL',
    'npm_config_script_shell',
    'npm_config_store_dir',
    'npm_execpath',
    'PATHEXT',
    'PATH',
    'PNPM_CONFIG_STORE_DIR',
    'PNPM_CONFIG_OFFLINE',
    'PNPM_CONFIG_SCRIPT_SHELL',
    'PNPM_CONFIG_UPDATE_NOTIFIER',
    'PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN',
    'PNPM_HOME',
    'PNPM_STORE_DIR',
    'SystemRoot',
    'WINDIR',
  ];
  const inherited = Object.fromEntries(
    injectedNames.map((name) => [name, process.env[name]])
  );
  for (const name of injectedNames) process.env[name] = `attacker-${name}`;
  try {
    await requireFreshSourceDependencyTree(root);
    await mkdir(join(root, 'node_modules', '.bin'), { recursive: true });
    await assert.rejects(
      () => requireFreshSourceDependencyTree(root),
      /without any existing node_modules/u
    );
    await rm(join(root, 'node_modules'), { recursive: true });

    const toolchain = await materializePnpmToolchain(join(root, 'pnpm'));
    assert.equal(toolchain.version, '11.7.0');
    assert.equal(toolchain.entryCount, 449);

    const command = await createSourcePnpmCommand(root, toolchain);
    const authority = await loadAuthority();
    const officialRuntimeEnvironment = packageManagerEnvironment(root);
    const environment = sourceBuildEnvironment(
      root,
      authority.release.commit,
      authority.release.commit,
      command
    );
    assert.equal(
      environment.DSH_CLIENT_COMMIT_HASH,
      '0a53fb55bea101816fa226bb964ae2bed71c343b'
    );
    assert.equal(environment.DSH_BUILD_PNPM_CLI, toolchain.cli);
    assert.equal(environment.DSH_BUILD_PNPM_NODE, process.execPath);
    assert.equal(environment.npm_execpath, toolchain.cli);
    const expectedScriptShell = process.platform === 'win32'
      ? undefined
      : await realpath('/bin/sh');
    if (process.platform === 'win32') {
      assert.match(
        environment.COMSPEC,
        /^[A-Za-z]:\\.*\\System32\\cmd\.exe$/iu
      );
    }
    assert.equal(environment.NPM_CONFIG_SCRIPT_SHELL, expectedScriptShell);
    assert.equal(environment.PNPM_CONFIG_SCRIPT_SHELL, expectedScriptShell);
    assert.equal(environment.npm_config_script_shell, undefined);
    assert.equal(environment.PNPM_CONFIG_OFFLINE, 'true');
    assert.equal(environment.PNPM_CONFIG_UPDATE_NOTIFIER, 'false');
    assert.equal(environment.PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN, 'false');
    const version = spawnSync(process.execPath, [toolchain.cli, '--version'], {
      encoding: 'utf8',
      env: environment,
      shell: false,
    });
    assert.equal(version.status, 0);
    assert.equal(version.stdout.trim(), '11.7.0');
    assert.equal(
      environment.PATH,
      [command.bin, dirname(process.execPath)].join(delimiter)
    );
    assert.equal(environment.PATH.includes('attacker-PATH'), false);
    assert.doesNotMatch(environment.PATH, /(?:^|[\\/])git(?:[\\/]|$)/iu);
    assert.equal(
      environment.COMSPEC,
      process.platform === 'win32' ? command.scriptShell : undefined
    );
    assert.equal(
      environment.SystemRoot,
      process.platform === 'win32'
        ? dirname(dirname(command.scriptShell))
        : undefined
    );
    assert.equal(environment.WINDIR, environment.SystemRoot);
    assert.equal(environment.COREPACK_HOME, undefined);
    assert.equal(Object.hasOwn(environment, 'DSH_CLIENT_VERSION'), false);
    assert.equal(Object.hasOwn(environment, 'NODE_OPTIONS'), false);
    assert.equal(Object.hasOwn(environment, 'NODE_PATH'), false);
    assert.equal(environment.PNPM_HOME, join(root, 'pnpm-home'));
    assert.equal(environment.PNPM_CONFIG_STORE_DIR, undefined);
    assert.equal(environment.PNPM_STORE_DIR, undefined);
    assert.equal(environment.npm_config_store_dir, undefined);
    assert.equal(
      Object.hasOwn(officialRuntimeEnvironment, 'DSH_BUILD_PNPM_CLI'),
      false
    );
    assert.equal(
      Object.hasOwn(officialRuntimeEnvironment, 'DSH_BUILD_PNPM_NODE'),
      false
    );
    assert.equal(
      Object.hasOwn(officialRuntimeEnvironment, 'DSH_CLIENT_COMMIT_HASH'),
      false
    );
    assert.equal(Object.hasOwn(officialRuntimeEnvironment, 'npm_execpath'), false);

    const wrapper = await lstat(command.wrapper);
    assert.equal(wrapper.isFile(), true);
    assert.equal(wrapper.isSymbolicLink(), false);
    assert.equal(wrapper.nlink, 1);
    if (process.platform !== 'win32') assert.equal(wrapper.mode & 0o777, 0o700);
    const wrapperText = await readFile(command.wrapper, 'utf8');
    assert.equal(
      wrapperText,
      process.platform === 'win32'
        ? '@ECHO OFF\r\nSETLOCAL DisableDelayedExpansion\r\n"%DSH_BUILD_PNPM_NODE%" "%DSH_BUILD_PNPM_CLI%" %*\r\nEXIT /B %ERRORLEVEL%\r\n'
        : '#!/bin/sh\nset -eu\nexec "$DSH_BUILD_PNPM_NODE" "$DSH_BUILD_PNPM_CLI" "$@"\n'
    );
    assert.doesNotMatch(wrapperText, /\b(?:CALL|START)\b/iu);
    assert.deepEqual(
      (await readdir(command.bin)).sort(),
      process.platform === 'win32'
        ? ['pnpm.cmd']
        : ['dirname', 'pnpm', 'sed', 'uname']
    );
    if (process.platform !== 'win32') {
      for (const name of ['dirname', 'sed', 'uname']) {
        assert.equal(
          await readFile(join(command.bin, name), 'utf8'),
          `#!/bin/sh\nset -eu\nexec "/usr/bin/${name}" "$@"\n`
        );
      }
      const dirnameProof = spawnSync('dirname', ['/alpha/beta'], {
        encoding: 'utf8',
        env: environment,
        shell: false,
      });
      assert.equal(dirnameProof.status, 0);
      assert.equal(dirnameProof.stdout.trim(), '/alpha');
      assert.equal(dirnameProof.stderr, '');
      const sedProof = spawnSync('sed', ['-e', 's/a/b/'], {
        encoding: 'utf8',
        env: environment,
        input: 'a\n',
        shell: false,
      });
      assert.equal(sedProof.status, 0);
      assert.equal(sedProof.stdout, 'b\n');
      assert.equal(sedProof.stderr, '');
      const unameProof = spawnSync('uname', ['-a'], {
        encoding: 'utf8',
        env: environment,
        shell: false,
      });
      assert.equal(unameProof.status, 0);
      assert.notEqual(unameProof.stdout.trim(), '');
      assert.equal(unameProof.stderr, '');
    }

    const lifecycleBin = join(root, 'node_modules', '.bin');
    await mkdir(lifecycleBin, { recursive: true });
    const lifecycleName = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
    const hostilePnpm = join(lifecycleBin, lifecycleName);
    await writeFile(
      hostilePnpm,
      process.platform === 'win32'
        ? '@ECHO OFF\r\nECHO SHADOW\r\n'
        : '#!/bin/sh\nprintf "SHADOW\\n"\n',
      { mode: 0o700 }
    );
    await assert.rejects(
      () => verifyNoLifecycleToolShadow(root),
      /shadows build authority/u
    );
    await assert.rejects(
      () => createLifecyclePnpmCommand(root),
      /shadows build authority/u
    );
    await rm(hostilePnpm);
    if (process.platform !== 'win32') {
      for (const name of ['dirname', 'sed', 'uname']) {
        const hostileUtility = join(lifecycleBin, name);
        await writeFile(hostileUtility, '#!/bin/sh\nexit 99\n', {
          mode: 0o700,
        });
        await assert.rejects(
          () => verifyNoLifecycleToolShadow(root),
          /shadows build authority/u
        );
        await assert.rejects(
          () => createLifecyclePnpmCommand(root),
          /shadows build authority/u
        );
        await rm(hostileUtility);
      }
    }
    const lifecycleCommand = await createLifecyclePnpmCommand(root);
    assert.equal(
      await readFile(lifecycleCommand.wrapper, 'utf8'),
      wrapperText
    );

    await writeFile(join(root, 'package.json'), `${JSON.stringify({
      name: 'dsh-source-pnpm-command-proof',
      private: true,
      scripts: { probe: 'pnpm --version' },
    }, null, 2)}\n`);
    const shimVersion = spawnSync(process.execPath, [
      toolchain.cli,
      '--silent',
      'run',
      'probe',
    ], {
      cwd: root,
      encoding: 'utf8',
      env: environment,
      shell: false,
      windowsHide: true,
    });
    assert.equal(shimVersion.error, undefined);
    assert.equal(
      shimVersion.status,
      0,
      `${shimVersion.stdout ?? ''}\n${shimVersion.stderr ?? ''}`
    );
    assert.equal(shimVersion.stderr.trim(), '');
    assert.match(shimVersion.stdout, /(?:^|\n)11\.7\.0(?:\n|$)/u);

    if (process.platform !== 'win32') {
      const pnpmStyleShim = join(lifecycleBin, 'tsx-proof');
      await writeFile(
        pnpmStyleShim,
        '#!/bin/sh\n' +
          'basedir=$(dirname "$(echo "$0" | sed -e \'s,\\\\,/,g\')")\n' +
          'case `uname -a` in\n' +
          '  *CYGWIN*|*MINGW*|*MSYS*) exit 97;;\n' +
          'esac\n' +
          'printf "%s\\n" "$basedir"\n',
        { mode: 0o700 }
      );
      const pnpmStyleProof = spawnSync(pnpmStyleShim, [], {
        cwd: root,
        encoding: 'utf8',
        env: {
          ...environment,
          PATH: [lifecycleBin, command.bin, dirname(process.execPath)].join(
            delimiter
          ),
        },
        shell: false,
      });
      assert.equal(
        pnpmStyleProof.status,
        0,
        `${pnpmStyleProof.stdout ?? ''}\n${pnpmStyleProof.stderr ?? ''}`
      );
      assert.equal(pnpmStyleProof.stdout.trim(), lifecycleBin);
      assert.equal(pnpmStyleProof.stderr, '');
      await rm(pnpmStyleShim);
    }

    if (process.platform === 'win32') {
      assert.equal(environment.NoDefaultCurrentDirectoryInExePath, '1');
      assert.equal(environment.PATHEXT, '.CMD;.EXE;.COM;.BAT');
    }
  } finally {
    for (const name of injectedNames) {
      if (inherited[name] === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = inherited[name];
      }
    }
    await rm(root, { recursive: true, force: true });
  }
});

test('alpha.2 installers fetch into a private store, install offline, and block Node injection', async () => {
  const [installer, builder, runner] = await Promise.all([
    readFile('skills/dsh-harness-installer/scripts/install-official.mjs', 'utf8'),
    readFile('skills/dsh-harness-installer/scripts/build-source.mjs', 'utf8'),
    readFile('skills/dsh-harness-installer/scripts/run-official.mjs', 'utf8'),
  ]);
  for (const source of [installer, builder]) {
    assert.match(source, /'fetch', '--frozen-lockfile', '--ignore-scripts'/u);
    assert.match(source, /'--offline'/u);
  }
  assert.doesNotMatch(builder, /corepack/u);
  assert.match(installer, /\.dsh-install-incomplete/u);
  assert.match(runner, /NODE_OPTIONS/u);
  assert.match(runner, /NODE_PATH/u);
});

test('source build metadata uses only the verified commit without reopening Git access', async () => {
  const authority = await loadAuthority();
  const privateRoot = resolve('/private/dsh-alpha2-source-toolchain');
  assert.throws(
    () =>
      sourceBuildEnvironment(
        privateRoot,
        'f'.repeat(40),
        authority.release.commit
      ),
    /verified source commit differs from the build authority/u
  );
  assert.throws(
    () =>
      sourceBuildEnvironment(
        privateRoot,
        authority.release.commit,
        authority.release.commit,
        {}
      ),
    /private pnpm command binding/u
  );
  assert.throws(
    () => sourceBuildPath(`/private/injected${delimiter}entry`, dirname(process.execPath)),
    /PATH components are malformed/u
  );
  assert.throws(
    () => sourceBuildPath('/private/bin', `${dirname(process.execPath)}${delimiter}`),
    /PATH components are malformed/u
  );
  assert.throws(
    () => sourceBuildRootPath(`/private/source${delimiter}injected`),
    /unsafe for lifecycle PATH/u
  );

  const [builder, verifier] = await Promise.all([
    readFile('skills/dsh-harness-installer/scripts/build-source.mjs', 'utf8'),
    readFile('skills/dsh-harness-installer/scripts/verify-source.mjs', 'utf8'),
  ]);
  assert.match(builder, /npm_execpath: pnpmCommand\.cli/u);
  assert.match(
    verifier,
    /pnpm --filter @deepseek-ai\/dsh-web-frontend run build/u
  );
});

test('Harness Skill states official npm plus source cross-build, no-PATH, and token-safe boundaries', async () => {
  const skill = await readFile('skills/dsh-harness-installer/SKILL.md', 'utf8');
  assert.match(skill, /official npm/i);
  assert.match(skill, /source cross-build/i);
  assert.match(skill, /binary equivalence/i);
  assert.match(skill, /Do not create a global package.*PATH modification/s);
  assert.match(skill, /\?token=/);
  assert.match(skill, /credential-derived/i);
  assert.match(skill, /six real receipts/i);
});
