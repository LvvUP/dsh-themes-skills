import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';

import {
  loadAuthority,
  loadReceiptSchema,
  validateAuthority,
  validateBuildReceipt,
} from '../skills/dsh-harness-installer/scripts/authority.mjs';
import { parseRunArgs } from '../skills/dsh-harness-installer/scripts/run-source-built.mjs';

const authorityPath = resolve(
  'skills/dsh-harness-installer/references/alpha1-source-authority.json'
);
const prepareSource = resolve(
  'skills/dsh-harness-installer/scripts/prepare-source.mjs'
);

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
      reportedVersion: '0.1.2-alpha.1',
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

test('alpha.1 source authority binds exact official source identity and remains fail closed', async () => {
  const bytes = await readFile(authorityPath);
  const authority = validateAuthority(JSON.parse(bytes));
  assert.equal(
    createHash('sha256').update(bytes).digest('hex'),
    '2ee9343fea9a2f1e15dd8e3d4870e3040f730bb85e19bb13c4ba90c6212c2da3'
  );
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
      tag: 'dsh-v0.1.2-alpha.1',
      commit: 'cd5ef8148158c3a752a658978873241fdf8e2bbc',
      tree: 'a712eec535b48badc4fefb4df5176a7002e4280b',
      lockfileBytes: 765312,
      lockfileSha256:
        '506ad1fc7c40f71ce8c6afe08724fdd55020c1a527d7a7a185c559d39ecfcaf1',
      pnpm: '11.7.0',
      node: ['22.19.0', '24.15.0'],
    }
  );
  assert.equal(authority.release.releaseAssetCount, 0);
  assert.equal(authority.release.npmPackagesPublished, false);
  assert.equal(authority.publication.publishedInstallable, false);
  assert.deepEqual(authority.publication.completedReceipts, []);
  assert.equal(authority.publication.receiptSetSha256, null);
  assert.equal(authority.historicalAuthority.rc8ItemLaneUnchanged, true);
  assert.equal(authority.historicalAuthority.rc2RuntimeLaneUnchanged, true);
});

test('source authority rejects tag, tree, lock, package-manager, and promotion drift', async () => {
  const authority = await loadAuthority();
  for (const mutate of [
    (value) => { value.release.tag = 'dsh-v0.1.2-alpha.2'; },
    (value) => { value.release.tree = '0'.repeat(40); },
    (value) => { value.source.lockfileSha256 = '0'.repeat(64); },
    (value) => { value.source.packageManagerVersion = '11.24.0'; },
    (value) => { value.source.nodeEngine = '>=22'; },
    (value) => { value.source.installArgs.pop(); },
    (value) => { value.publication.publishedInstallable = true; },
  ]) {
    const changed = structuredClone(authority);
    mutate(changed);
    assert.throws(() => validateAuthority(changed));
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

test('Harness Skill states source-only, no-PATH, and token-safe operating boundaries', async () => {
  const skill = await readFile('skills/dsh-harness-installer/SKILL.md', 'utf8');
  assert.match(skill, /local build\s+from pinned official source/i);
  assert.match(skill, /never as an official binary or npm install/i);
  assert.match(skill, /Do not create a global package.*PATH modification/s);
  assert.match(skill, /\?token=/);
  assert.match(skill, /credential-derived/i);
  assert.match(skill, /six real receipts/i);
});
