import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstat, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:https';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

import {
  ALLOWED_ADD_ARTIFACT_SHA256,
  buildDshChildArgs,
  isAllowedRunnerCommand,
} from '../skills/dsh-theme-manager/scripts/runner-policy.mjs';
import { snapshotAllowedArtifact } from '../skills/dsh-theme-manager/scripts/artifact-snapshot.mjs';
import { isExactSemver } from '../skills/dsh-theme-manager/scripts/semver.mjs';
import { run } from './helpers.mjs';

const state = resolve('skills/dsh-theme-manager/scripts/theme-state.mjs');
const verifier = resolve('skills/dsh-theme-manager/scripts/fetch-and-verify.mjs');
const releaseValidator = resolve('skills/dsh-theme-manager/scripts/validate-release.mjs');
const runnerVerifier = resolve('skills/dsh-theme-manager/scripts/verify-runner.mjs');
const runner = resolve('skills/dsh-theme-manager/scripts/run-dsh.mjs');
const loopbackGate = resolve('skills/dsh-theme-manager/scripts/assert-loopback.mjs');
const fixture = (name) => resolve('test/fixtures', name);
const shaA = 'a'.repeat(64);
const shaB = 'b'.repeat(64);
const shaC = 'c'.repeat(64);
const trustedOrigin = 'https://themes.example';
const finalAttestation = JSON.parse(
  await readFile(
    resolve('skills/dsh-theme-manager/runtime-rc8/attestation.json'),
    'utf8'
  )
);
const runtimeAttestation = Object.freeze({
  schemaVersion: 2,
  attestationSha256:
    '1cd9a0b4a6b9d215f0a1f70a97b4d43eae7bf4f846ae7009b7ddb812823ca0ae',
  runnerLockfileSha256:
    'b38b68f1f443b7065f530d665ea7acbc9327275503ba0d9a6edd030b81f915ec',
  productionPackagesCount: 504,
  productionPackagesSha256:
    '58c78fcf15d2b6c58bad0fc870a4d28dabda33bfae3633cf94794465564a939b',
  dshPackagesCount: 187,
  dshPackagesSha256:
    'aa3929a9418b928d9ef200964f8ae4cce54086b1d5bc474cb9b42af90f0a78d8',
  packageManagerName: 'pnpm',
  packageManagerVersion: '11.7.0',
  dshPackageVersion: '0.1.0-rc.8',
  certificationRunId: 32393288849,
  certificationHeadSha:
    'e3fe9ac465b8db8070efbdb83ddc6c821f923a73',
  lifecycle: 'managed-cold-restart',
});
const historicalRuntimeAttestation = Object.freeze({
  schemaVersion: 1,
  attestationSha256: '2400606c5cb6534e09a65020e4ae12a0df4c1d08f15918d714bc5037c2ed99ba',
  runnerLockfileSha256: '22f995efe8338c2a3cd97bd731853d010363531145c35073adb2dca3773f6053',
  criticalPackagesCount: 197,
  criticalPackagesSha256: 'f883815b282c4e86a1ecb8cf60914459f875a1d34da02cfce8b119824a950894',
  packageManagerName: 'pnpm',
  packageManagerVersion: '11.7.0',
  packageManagerIntegrity: 'sha512-GcyFLBIMcSV2DyRD7mvgyltA+fUFmN4aCaHxd1A+AQ5Xwjx3ZG4B52HeWb+HT7IqM5jDOrlpH8E+uUa28PTWIA==',
  uiThemePackageVersion: '0.1.0-rc.6',
  uiThemePackageIntegrity: 'sha512-Wu+bvnuti/gLA+t5a2cWUMQJ5UCqxt6oEK+OJiJ68gN0ixs2skpaN0nFdFoY2exC5KByXrNlN1rRrD+FsZSBLA==',
  webFrontendPackageVersion: '0.1.0-rc.6',
  webFrontendPackageIntegrity: 'sha512-+RpdDF11FqUZSbJGoZ4oLIk/4PJR+ynTS4ELMn9QqucbYZ8tv0Itq9ZtG2o6pKIe7NO0lj/eBjCR2EoRKx7L+g==',
  frontendBundleSha256: 'a40165a9916acf9c5710e440842c9a56bc472ae9991f37f4675a7664ae784d68',
  frontendStylesheetSha256: '8ecb4b25268f5acae7e6f1b9e5cc8d14e5c5fa17da70a6a7863c896496f257ea',
});

const compatibility = Object.freeze({
  ...finalAttestation.compatibility,
  runtimeAttestationSha256: runtimeAttestation.attestationSha256,
});
const historicalCompatibility = Object.freeze({
  dshPackageVersion: '0.1.0-rc.6',
  dshPackageIntegrity: 'sha512-brpZfED7ieRa2PQ5tUxMhHrM1pb2CmKFVM/f6yMULBDMicahk+Z2OsHgTwTDnoiZm23Ftu9rQz0NN4pflaoJcg==',
  tokenCatalogSha256: 'fe38fdb18dae76f3cc93e3ca3a37bb1916f207180781b1aa8321ee2ddadcb926',
  frontendBundleSha256: 'a40165a9916acf9c5710e440842c9a56bc472ae9991f37f4675a7664ae784d68',
  selectorCatalogSha256: '5bcd9f874095af2114d86f91301868c6b0f2cebe58f51b9919150975d406baa3',
});

function integrity(sha256) {
  return `sha256-${Buffer.from(sha256, 'hex').toString('base64')}`;
}

function currentRelease() {
  return {
    verified: true,
    distribution: {
      kind: 'hosted-verified-artifact',
      installability: 'manager',
      redistribution: 'allowed',
      previewPolicy: 'hosted',
    },
    artifactUrl: `${trustedOrigin}/api/themes/ocean-workbench/download/1.1.0`,
    artifactSha256: shaA,
    runtimeAttestation: { ...runtimeAttestation },
    manifest: {
      schemaVersion: '3.0',
      kind: 'full-skin',
      slug: 'ocean-workbench',
      version: '1.1.0',
      compatibility: { ...compatibility },
      artifact: {
        name: '@dsh-themes/ocean-workbench',
        version: '1.1.0',
        fileName: 'ocean-workbench-1.1.0.tgz',
        sha256: shaA,
        integrity: integrity(shaA),
        digestScope: 'artifact-tgz',
      },
      payload: {
        fileName: 'ocean-workbench-1.1.0.payload.tar',
        sha256: shaB,
        integrity: integrity(shaB),
        digestScope: 'canonical-tar-payload-excluding-manifest',
      },
    },
  };
}

function historicalV2Release() {
  const release = currentRelease();
  release.runtimeAttestation = { ...historicalRuntimeAttestation };
  release.manifest.schemaVersion = '2.0';
  release.manifest.compatibility = { ...historicalCompatibility };
  return release;
}

function historicalRelease() {
  return {
    distribution: {
      kind: 'hosted-verified-artifact',
      installability: 'manager',
      redistribution: 'allowed',
      previewPolicy: 'hosted',
    },
    artifactUrl: `${trustedOrigin}/api/themes/paper-console/download/1.0.0`,
    artifactSha256: shaC,
    manifest: {
      schemaVersion: 1,
      slug: 'paper-console',
      version: '1.0.0',
      compatibility: {
        deepseekHarnessVersion: '0.1.0-rc.5',
        deepseekHarnessCommit: '47f943859bef60e4160492346772ded9b24f765a',
        tokenCatalogSha256: historicalCompatibility.tokenCatalogSha256,
      },
      package: {
        name: '@dsh-themes/paper-console',
        version: '1.0.0',
        fileName: 'paper-console-1.0.0.tgz',
        sha256: shaB,
        integrity: integrity(shaB),
        digestScope: 'canonical-tar-payload-excluding-theme.json',
      },
    },
  };
}

async function writeJson(directory, name, value) {
  const path = join(directory, name);
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  return path;
}

async function validateRelease(directory, name, value, origin = trustedOrigin) {
  return run(releaseValidator, [
    '--input', await writeJson(directory, name, value),
    '--origin', origin,
  ]);
}

function listen(server) {
  return new Promise((resolvePromise) => server.listen(0, '127.0.0.1', resolvePromise));
}

function close(server) {
  return new Promise((resolvePromise, rejectPromise) => {
    server.close((error) => (error ? rejectPromise(error) : resolvePromise()));
  });
}

test('release validator separates current V3, historical V2/V1, and artifact authority', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-release-'));
  try {
    await t.test('accepts the exact certified RC.8 V3 release', async () => {
      const release = currentRelease();
      const result = await validateRelease(directory, 'current-v3.json', release);
      assert.equal(result.code, 0, result.stderr);
      const output = JSON.parse(result.stdout);
      assert.equal(output.status, 'current');
      assert.equal(output.installableCurrent, true);
      assert.equal(output.dshVersion, '0.1.0-rc.8');
      assert.equal(
        output.sourceCommit,
        '141eb6fef83422698aef7a981029e843e8161534'
      );
      assert.equal(output.artifactSha256, shaA);
      assert.equal(output.payloadSha256, shaB);
      assert.equal(output.runtimeAttestationSha256, runtimeAttestation.attestationSha256);
      assert.equal(output.certificationRunId, 32393288849);
      assert.equal(output.lifecycle, 'managed-cold-restart');
    });

    await t.test('rejects mixed RC.6 evidence inside a V3 record', async () => {
      const release = currentRelease();
      release.manifest.compatibility.selectorCatalogSha256 =
        historicalCompatibility.selectorCatalogSha256;
      const result = await validateRelease(directory, 'mixed-v3.json', release);
      assert.notEqual(result.code, 0);
      assert.match(result.stderr, /exact certified RC\.8 evidence/);
    });

    await t.test('recognizes exact RC.6 V2 only as historical', async () => {
      const result = await validateRelease(
        directory,
        'historical-v2.json',
        historicalV2Release()
      );
      assert.equal(result.code, 0, result.stderr);
      const output = JSON.parse(result.stdout);
      assert.equal(output.status, 'historical-v2');
      assert.equal(output.installableCurrent, false);
      assert.equal(output.dshVersion, '0.1.0-rc.6');
      assert.equal(
        output.runtimeAttestationSha256,
        historicalRuntimeAttestation.attestationSha256
      );
    });

    await t.test('never treats a payload digest as the complete artifact digest', async () => {
      const release = currentRelease();
      release.artifactSha256 = release.manifest.payload.sha256;
      const result = await validateRelease(directory, 'payload-substitution.json', release);
      assert.notEqual(result.code, 0);
      assert.match(result.stderr, /catalog artifactSha256/);
    });

    await t.test('refuses a payload-only V3 manifest as installation authority', async () => {
      const release = currentRelease();
      delete release.manifest.artifact;
      const result = await validateRelease(directory, 'payload-only-v3.json', release);
      assert.notEqual(result.code, 0);
      assert.match(result.stderr, /manifest\.artifact must be an object/);
    });

    await t.test('refuses an external showcase even when it carries artifact-shaped fields', async () => {
      const release = currentRelease();
      release.distribution = {
        kind: 'external-showcase',
        installability: 'showcase-only',
        redistribution: 'rights-clearance-required',
        previewPolicy: 'link-only',
      };
      release.provenance = {
        sourceUrl: 'https://example.com/source/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        sourceRevision: 'a'.repeat(40),
        noticeUrl: null,
        attributions: ['External author'],
        executableRuntime: true,
      };
      release.installCommand = null;
      const result = await validateRelease(directory, 'external-showcase.json', release);
      assert.notEqual(result.code, 0);
      assert.match(result.stderr, /distribution\.kind/);
    });

    await t.test('fails closed when the distribution authorization is absent', async () => {
      const release = currentRelease();
      delete release.distribution;
      const result = await validateRelease(directory, 'missing-distribution.json', release);
      assert.notEqual(result.code, 0);
      assert.match(result.stderr, /distribution must be an object/);
    });

    await t.test('fails closed when verified or runtime attestation is absent', async () => {
      for (const field of ['verified', 'runtimeAttestation']) {
        const release = currentRelease();
        delete release[field];
        const result = await validateRelease(directory, `missing-${field}.json`, release);
        assert.notEqual(result.code, 0);
      }
    });

    await t.test('requires the exact V3 payload and artifact digest scopes', async () => {
      const wrongArtifact = currentRelease();
      wrongArtifact.manifest.artifact.digestScope = 'canonical-tar-payload-excluding-manifest';
      const artifactResult = await validateRelease(directory, 'wrong-artifact-scope.json', wrongArtifact);
      assert.notEqual(artifactResult.code, 0);
      assert.match(artifactResult.stderr, /artifact\.digestScope/);

      const wrongPayload = currentRelease();
      wrongPayload.manifest.payload.digestScope = 'artifact-tgz';
      const payloadResult = await validateRelease(directory, 'wrong-v3-payload-scope.json', wrongPayload);
      assert.notEqual(payloadResult.code, 0);
      assert.match(payloadResult.stderr, /payload\.digestScope/);

      const missingPayload = currentRelease();
      delete missingPayload.manifest.payload;
      const missingResult = await validateRelease(directory, 'missing-v3-payload.json', missingPayload);
      assert.notEqual(missingResult.code, 0);
      assert.match(missingResult.stderr, /manifest\.payload/);
    });

    await t.test('recognizes rc.5 V1 only as historical and non-current', async () => {
      const release = historicalRelease();
      const result = await validateRelease(directory, 'historical-v1.json', release);
      assert.equal(result.code, 0, result.stderr);
      const output = JSON.parse(result.stdout);
      assert.equal(output.status, 'historical-v1');
      assert.equal(output.installableCurrent, false);
      assert.equal(output.dshVersion, '0.1.0-rc.5');
      assert.equal(output.sourceCommit, '47f943859bef60e4160492346772ded9b24f765a');
      assert.equal(output.artifactSha256, shaC);
      assert.equal(output.payloadSha256, shaB);
      assert.notEqual(output.artifactSha256, output.payloadSha256);
    });

    await t.test('requires the historical V1 package payload scope', async () => {
      const release = historicalRelease();
      release.manifest.package.digestScope = 'artifact-tgz';
      const result = await validateRelease(directory, 'wrong-v1-payload-scope.json', release);
      assert.notEqual(result.code, 0);
      assert.match(result.stderr, /package\.digestScope/);
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('release validator confines downloads to the exact controlled same-origin route', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-release-url-'));
  try {
    const cases = [
      ['cross-origin', 'https://other.example/api/themes/ocean-workbench/download/1.1.0', /trusted origin/],
      ['wrong-slug', `${trustedOrigin}/api/themes/other/download/1.1.0`, /controlled route/],
      ['wrong-version', `${trustedOrigin}/api/themes/ocean-workbench/download/1.1.1`, /controlled route/],
      ['query', `${trustedOrigin}/api/themes/ocean-workbench/download/1.1.0?token=secret`, /credential-free HTTPS URL/],
      ['fragment', `${trustedOrigin}/api/themes/ocean-workbench/download/1.1.0#download`, /credential-free HTTPS URL/],
      ['encoded-segment', `${trustedOrigin}/api/themes/ocean%2Dworkbench/download/1.1.0`, /controlled route/],
    ];

    for (const [name, artifactUrl, error] of cases) {
      await t.test(name, async () => {
        const release = currentRelease();
        release.artifactUrl = artifactUrl;
        const result = await validateRelease(directory, `${name}.json`, release);
        assert.notEqual(result.code, 0);
        assert.match(result.stderr, error);
      });
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('multiple active theme packages are a hard conflict', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-conflict-'));
  try {
    const list = join(directory, 'plugins.json');
    await writeFile(list, JSON.stringify([{
      name: 'dsh-profile-web',
      path: '/tmp/dsh-home/profiles/web',
      private: true,
      dependencies: { '@dsh-themes/one': '1.0.0', '@dsh-themes/two': '2.0.0', other: '3.0.0' },
    }]));
    const result = await run(state, ['inspect', '--input', list]);
    assert.notEqual(result.code, 0);
    assert.match(result.stderr, /Multiple DSH-Themes packages/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('theme state parses the RC.8 root profile array and rejects ambiguous profiles', async (t) => {
  await t.test('recognizes the built-in state from the empty profile fixture', async () => {
    const result = await run(state, [
      'inspect', '--input', fixture('dsh-rc6-plugin-list-empty.json'),
    ]);
    assert.equal(result.code, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), {
      profile: 'web',
      count: 0,
      active: null,
    });
  });

  await t.test('recognizes one direct theme from the profile dependencies', async () => {
    const result = await run(state, [
      'inspect', '--input', fixture('dsh-rc6-plugin-list-one-theme.json'),
    ]);
    assert.equal(result.code, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), {
      profile: 'web',
      count: 1,
      active: {
        name: '@dsh-themes/abyssal-maid',
        version: '1.0.0',
        direct: true,
      },
    });
  });

  await t.test('treats two direct themes in the profile as a hard conflict', async () => {
    const result = await run(state, [
      'inspect', '--input', fixture('dsh-rc6-plugin-list-two-themes.json'),
    ]);
    assert.notEqual(result.code, 0);
    assert.match(result.stderr, /Multiple DSH-Themes packages/);
  });

  await t.test('rejects duplicate profile records instead of merging them', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'dsh-duplicate-profile-'));
    try {
      const profile = JSON.parse(await readFile(fixture('dsh-rc6-plugin-list-one-theme.json'), 'utf8'))[0];
      const input = await writeJson(directory, 'duplicate.json', [profile, profile]);
      const result = await run(state, ['inspect', '--input', input]);
      assert.notEqual(result.code, 0);
      assert.match(result.stderr, /exactly one unambiguous RC\.8 profile record/);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  await t.test('rejects a non-web profile record', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'dsh-wrong-profile-'));
    try {
      const input = await writeJson(directory, 'wrong.json', [{
        name: 'dsh-profile-other',
        path: '/tmp/dsh-home/profiles/other',
        private: true,
      }]);
      const result = await run(state, ['inspect', '--input', input]);
      assert.notEqual(result.code, 0);
      assert.match(result.stderr, /Expected the web profile record/);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  await t.test('rejects empty or plugin-shaped root arrays as ambiguous', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'dsh-ambiguous-profile-'));
    try {
      for (const [name, payload] of [
        ['empty', []],
        ['plugin-shaped', [{ name: '@dsh-themes/abyssal-maid', version: '1.0.0' }]],
      ]) {
        const input = await writeJson(directory, `${name}.json`, payload);
        const result = await run(state, ['inspect', '--input', input]);
        assert.notEqual(result.code, 0);
        assert.match(result.stderr, /exactly one unambiguous RC\.8 profile record/);
      }
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});

test('theme state accepts one exact direct package and rejects ranges', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-state-'));
  try {
    const exactPath = await writeJson(directory, 'exact.json', [{
      name: 'dsh-profile-web',
      path: '/tmp/dsh-home/profiles/web',
      private: true,
      dependencies: {
        '@dsh-themes/ocean-workbench': { resolvedVersion: '1.2.3-rc.1+verified.2', direct: true },
        '@dsh-themes/transitive': { resolvedVersion: '9.9.9', direct: false },
      },
    }]);
    const inspected = await run(state, ['inspect', '--input', exactPath]);
    assert.equal(inspected.code, 0, inspected.stderr);
    assert.deepEqual(JSON.parse(inspected.stdout), {
      profile: 'web',
      count: 1,
      active: {
        name: '@dsh-themes/ocean-workbench',
        version: '1.2.3-rc.1+verified.2',
        direct: true,
      },
    });

    for (const [name, version] of [
      ['range', '^1.2.3'],
      ['empty-prerelease', '1.2.3-alpha..1'],
      ['only-empty-prerelease-identifiers', '1.2.3-..'],
      ['numeric-prerelease-leading-zero', '1.2.3-alpha.01'],
      ['empty-build-identifier', '1.2.3+build..1'],
    ]) {
      await t.test(name, async () => {
        const input = await writeJson(directory, `${name}.json`, [{
          name: 'dsh-profile-web',
          path: '/tmp/dsh-home/profiles/web',
          private: true,
          dependencies: { '@dsh-themes/ocean-workbench': version },
        }]);
        const result = await run(state, ['inspect', '--input', input]);
        assert.notEqual(result.code, 0);
        assert.match(result.stderr, /exact semantic version/);
      });
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('manager exact-version checks implement the shared SemVer 2.0 vectors', async () => {
  const vectors = JSON.parse(await readFile(fixture('semver-vectors.json'), 'utf8'));
  for (const version of vectors.valid) {
    assert.equal(isExactSemver(version), true, `expected valid SemVer: ${version}`);
  }
  for (const version of vectors.invalid) {
    assert.equal(isExactSemver(version), false, `expected invalid SemVer: ${version}`);
  }
});

test('rollback schema 2 binds exact current hosted artifacts and schema 1 is audit-only', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-rollback-'));
  try {
    const target = fixture('deep-ocean-1.2.0.tgz');
    const targetSha256 =
      '8fca6598f084b47ec07bd00876a686c640ad68f280b5737b789a68fa5df5044f';
    const result = await run(state, [
      'record', '--at', '2026-08-14T00:00:00.000Z',
      '--target-name', '@dsh-themes/deep-ocean',
      '--target-version', '1.2.0',
      '--target-artifact', target,
      '--target-sha256', targetSha256,
    ]);
    assert.equal(result.code, 0, result.stderr);
    const record = JSON.parse(result.stdout);
    assert.equal(record.schemaVersion, 2);
    assert.equal(record.dshPackageVersion, '0.1.0-rc.8');
    assert.equal(
      record.runtimeAttestationSha256,
      runtimeAttestation.attestationSha256
    );
    assert.equal(record.target.artifactSha256, targetSha256);
    assert.equal(record.target.manifestSchemaVersion, '3.0');

    const recordPath = await writeJson(directory, 'rollback.json', record);
    const validated = await run(state, [
      'validate-record', '--input', recordPath,
    ]);
    assert.equal(validated.code, 0, validated.stderr);

    const reversed = await run(state, ['reverse', '--input', recordPath]);
    assert.equal(reversed.code, 0, reversed.stderr);
    const reverseRecord = JSON.parse(reversed.stdout);
    assert.equal(reverseRecord.previous.packageName, '@dsh-themes/deep-ocean');
    assert.equal(reverseRecord.target, null);
    const reversePath = await writeJson(directory, 'reverse.json', reverseRecord);
    assert.equal(
      (await run(state, ['validate-record', '--input', reversePath])).code,
      0
    );

    const legacyPath = await writeJson(directory, 'legacy.json', {
      schemaVersion: 1,
      profile: 'web',
      createdAt: '2026-08-14T00:00:00.000Z',
      previous: null,
      target: {
        packageName: '@dsh-themes/deep-ocean',
        version: '1.1.0',
        artifactPath: join(directory, 'historical-v2.tgz'),
        artifactSha256: shaA,
      },
    });
    const refusedLegacy = await run(state, [
      'validate-record', '--input', legacyPath,
    ]);
    assert.notEqual(refusedLegacy.code, 0);
    assert.match(refusedLegacy.stderr, /read-only|cannot be executed/);
    const inspectedLegacy = await run(state, [
      'inspect-record', '--input', legacyPath,
    ]);
    assert.equal(inspectedLegacy.code, 0, inspectedLegacy.stderr);
    assert.equal(JSON.parse(inspectedLegacy.stdout).executable, false);

    const alteredPath = join(directory, 'altered-current.tgz');
    const alteredBytes = Buffer.concat([
      await readFile(target),
      Buffer.from('not-an-authorized-hosted-artifact'),
    ]);
    await writeFile(alteredPath, alteredBytes, { mode: 0o600 });
    const alteredSha256 = createHash('sha256')
      .update(alteredBytes)
      .digest('hex');
    const rejectedAltered = await run(state, [
      'record',
      '--target-name', '@dsh-themes/deep-ocean',
      '--target-version', '1.2.0',
      '--target-artifact', alteredPath,
      '--target-sha256', alteredSha256,
    ]);
    assert.notEqual(rejectedAltered.code, 0);
    assert.match(rejectedAltered.stderr, /hosted artifact allowlist/);

    const rejectedArbitrary = await run(state, [
      'record',
      '--target-name', '@dsh-themes/arbitrary',
      '--target-version', '1.0.0',
      '--target-artifact', target,
      '--target-sha256', targetSha256,
    ]);
    assert.notEqual(rejectedArbitrary.code, 0);
    assert.match(rejectedArbitrary.stderr, /hosted artifact allowlist/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
test('artifact verifier checks complete-package SHA-256 and refuses overwrite', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-verify-'));
  try {
    const source = join(directory, 'source.tgz');
    const output = join(directory, 'verified', 'theme.tgz');
    const bytes = Buffer.from('verified bytes');
    await writeFile(source, bytes);
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    const first = await run(verifier, ['--source', source, '--sha256', sha256, '--output', output]);
    assert.equal(first.code, 0, first.stderr);
    assert.deepEqual(await readFile(output), bytes);
    const second = await run(verifier, ['--source', source, '--sha256', sha256, '--output', output]);
    assert.notEqual(second.code, 0);
    assert.match(second.stderr, /exist/i);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('remote verifier confines a 307 cookie bootstrap to the exact trusted path', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-verify-remote-'));
  let primary;
  let foreign;
  try {
    const keyPath = join(directory, 'localhost.key');
    const certificatePath = join(directory, 'localhost.crt');
    const certificate = spawnSync('openssl', [
      'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1',
      '-subj', '/CN=localhost', '-keyout', keyPath, '-out', certificatePath,
    ], { encoding: 'utf8' });
    assert.equal(certificate.status, 0, certificate.stderr);
    const tls = { key: await readFile(keyPath), cert: await readFile(certificatePath) };

    let bootstrapRequests = 0;
    let otherPathRequests = 0;
    let foreignRequests = 0;
    foreign = createServer(tls, (_request, response) => {
      foreignRequests += 1;
      response.end('cookie must not reach this server');
    });
    await listen(foreign);
    const foreignPort = foreign.address().port;

    const bytes = Buffer.from('verified remote theme artifact');
    primary = createServer(tls, (request, response) => {
      if (request.url === '/api/themes/cookie-test/download/1.2.3') {
        bootstrapRequests += 1;
        if (request.headers.cookie === 'dsh_download_identity=test-value') {
          response.writeHead(200, {
            'content-length': bytes.byteLength,
            'content-type': 'application/gzip',
          });
          response.end(bytes);
          return;
        }
        response.writeHead(307, {
          location: '/api/themes/cookie-test/download/1.2.3',
          'set-cookie': 'dsh_download_identity=test-value; Path=/; HttpOnly; SameSite=Lax',
        });
        response.end();
        return;
      }
      if (request.url === '/api/themes/changed-path/download/1.2.3') {
        response.writeHead(307, {
          location: '/api/themes/other/download/1.2.3',
          'set-cookie': 'dsh_download_identity=must-not-leak; Path=/; HttpOnly',
        });
        response.end();
        return;
      }
      if (request.url === '/api/themes/other/download/1.2.3') {
        otherPathRequests += 1;
        response.end('cookie must not reach this path');
        return;
      }
      if (request.url === '/api/themes/cross-origin/download/1.2.3') {
        response.writeHead(307, {
          location: `https://127.0.0.1:${foreignPort}/api/themes/cross-origin/download/1.2.3`,
          'set-cookie': 'dsh_download_identity=must-not-leak; Path=/; HttpOnly',
        });
        response.end();
        return;
      }
      if (request.url === '/api/themes/wrong-status/download/1.2.3') {
        response.writeHead(302, {
          location: '/api/themes/wrong-status/download/1.2.3',
          'set-cookie': 'dsh_download_identity=must-not-replay; Path=/; HttpOnly',
        });
        response.end();
        return;
      }
      if (request.url === '/api/themes/no-cookie/download/1.2.3') {
        response.writeHead(307, {
          location: '/api/themes/no-cookie/download/1.2.3',
        });
        response.end();
        return;
      }
      if (request.url === '/api/themes/second-redirect/download/1.2.3') {
        response.writeHead(307, {
          location: '/api/themes/second-redirect/download/1.2.3',
          'set-cookie': 'dsh_download_identity=second-hop; Path=/; HttpOnly',
        });
        response.end();
        return;
      }
      response.writeHead(404).end();
    });
    await listen(primary);
    const origin = `https://127.0.0.1:${primary.address().port}`;
    const env = { NODE_TLS_REJECT_UNAUTHORIZED: '0' };

    await t.test('replays the bootstrap cookie on the exact same path', async () => {
      const output = join(directory, 'remote.tgz');
      const result = await run(verifier, [
        '--source', `${origin}/api/themes/cookie-test/download/1.2.3`,
        '--origin', origin,
        '--sha256', createHash('sha256').update(bytes).digest('hex'),
        '--output', output,
      ], { env });
      assert.equal(result.code, 0, result.stderr);
      assert.deepEqual(await readFile(output), bytes);
      assert.equal(bootstrapRequests, 2);
    });

    await t.test('does not replay a cookie onto another controlled path', async () => {
      const result = await run(verifier, [
        '--source', `${origin}/api/themes/changed-path/download/1.2.3`,
        '--origin', origin,
        '--sha256', createHash('sha256').update(bytes).digest('hex'),
        '--output', join(directory, 'changed-path.tgz'),
      ], { env });
      assert.notEqual(result.code, 0);
      assert.match(result.stderr, /same controlled theme download path/);
      assert.equal(otherPathRequests, 0);
    });

    await t.test('does not replay a cookie across origins', async () => {
      const result = await run(verifier, [
        '--source', `${origin}/api/themes/cross-origin/download/1.2.3`,
        '--origin', origin,
        '--sha256', createHash('sha256').update(bytes).digest('hex'),
        '--output', join(directory, 'cross-origin.tgz'),
      ], { env });
      assert.notEqual(result.code, 0);
      assert.match(result.stderr, /trusted origin/);
      assert.equal(foreignRequests, 0);
    });

    await t.test('accepts bootstrap cookies only from HTTP 307', async () => {
      const result = await run(verifier, [
        '--source', `${origin}/api/themes/wrong-status/download/1.2.3`,
        '--origin', origin,
        '--sha256', createHash('sha256').update(bytes).digest('hex'),
        '--output', join(directory, 'wrong-status.tgz'),
      ], { env });
      assert.notEqual(result.code, 0);
      assert.match(result.stderr, /Only one HTTP 307/);
    });

    await t.test('requires a cookie-bearing 307 and refuses a second redirect', async () => {
      for (const [slug, error] of [
        ['no-cookie', /requires both Location and Set-Cookie/],
        ['second-redirect', /second download redirect/],
      ]) {
        const result = await run(verifier, [
          '--source', `${origin}/api/themes/${slug}/download/1.2.3`,
          '--origin', origin,
          '--sha256', createHash('sha256').update(bytes).digest('hex'),
          '--output', join(directory, `${slug}.tgz`),
        ], { env });
        assert.notEqual(result.code, 0);
        assert.match(result.stderr, error);
      }
    });

    await t.test('rejects query-bearing controlled paths before network access', async () => {
      const before = bootstrapRequests;
      const result = await run(verifier, [
        '--source', `${origin}/api/themes/cookie-test/download/1.2.3?token=secret`,
        '--origin', origin,
        '--sha256', createHash('sha256').update(bytes).digest('hex'),
        '--output', join(directory, 'query.tgz'),
      ], { env });
      assert.notEqual(result.code, 0);
      assert.match(result.stderr, /credential-free HTTPS/);
      assert.equal(bootstrapRequests, before);
    });
  } finally {
    if (primary?.listening) await close(primary);
    if (foreign?.listening) await close(foreign);
    await rm(directory, { recursive: true, force: true });
  }
});

test('runner policy forces no-open and narrowly allows Skin Center removal', () => {
  assert.equal(ALLOWED_ADD_ARTIFACT_SHA256.size, 14);
  assert.equal(
    isAllowedRunnerCommand([
      'plugin',
      '--profile',
      'web',
      'remove',
      '@linxin666/dsh-client-ui-skin-center',
    ]),
    true
  );
  assert.equal(
    isAllowedRunnerCommand([
      'plugin',
      '--profile',
      'web',
      'remove',
      '@linxin666/arbitrary-package',
    ]),
    false
  );
  assert.equal(
    isAllowedRunnerCommand([
      'plugin',
      '--profile',
      'web',
      'remove',
      '@dsh-themes/ocean-workbench',
    ]),
    true
  );
  assert.deepEqual(buildDshChildArgs(['web'], resolve), [
    'web',
    '--host',
    '127.0.0.1',
    '--no-open',
  ]);
  assert.deepEqual(buildDshChildArgs(['web', '--port', '4312'], resolve), [
    'web',
    '--host',
    '127.0.0.1',
    '--no-open',
    '--port',
    '4312',
  ]);
  for (const values of [
    ['web', '--open', 'true'],
    ['web', '--no-open', '--no-open'],
    ['web', '--host', '127.0.0.1'],
  ]) {
    assert.equal(isAllowedRunnerCommand(values), false);
  }
});

test('runner refuses an arbitrary absolute tgz before DSH plugin add executes', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-runner-add-deny-'));
  try {
    const arbitrary = join(directory, 'arbitrary.tgz');
    await writeFile(arbitrary, 'not an allowlisted hosted artifact', {
      mode: 0o600,
    });
    const result = await run(
      runner,
      [
        'plugin', '--profile', 'web', 'add', arbitrary, '--save-exact',
      ],
      { cwd: directory, env: { DSH_HOME: directory } }
    );
    assert.notEqual(result.code, 0);
    assert.match(result.stderr, /current install allowlist/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('allowlisted plugin snapshot keeps a durable rollback locator after the source disappears', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-runner-add-snapshot-'));
  try {
    const source = join(directory, 'downloaded-deep-ocean.tgz');
    const bytes = await readFile(fixture('deep-ocean-1.2.0.tgz'));
    await writeFile(source, bytes, { mode: 0o600 });
    const snapshot = await snapshotAllowedArtifact(source, {
      workspace: directory,
      allowedDigests: ALLOWED_ADD_ARTIFACT_SHA256,
    });
    assert.equal(
      snapshot.sha256,
      '8fca6598f084b47ec07bd00876a686c640ad68f280b5737b789a68fa5df5044f'
    );
    assert.equal(
      snapshot.path,
      join(
        await realpath(directory),
        '.dsh-themes',
        'verified-artifacts',
        `${snapshot.sha256}.tgz`
      )
    );
    assert.equal((await lstat(snapshot.path)).mode & 0o777, 0o600);

    const reused = await snapshotAllowedArtifact(source, {
      workspace: directory,
      allowedDigests: ALLOWED_ADD_ARTIFACT_SHA256,
    });
    assert.equal(reused.path, snapshot.path);
    assert.equal(reused.reused, true);

    await rm(source);
    assert.deepEqual(await readFile(snapshot.path), bytes);
    const record = await run(state, [
      'record',
      '--target-name', '@dsh-themes/deep-ocean',
      '--target-version', '1.2.0',
      '--target-artifact', snapshot.path,
      '--target-sha256', snapshot.sha256,
    ]);
    assert.equal(record.code, 0, record.stderr);
    const recordPath = await writeJson(
      directory,
      'persistent-rollback.json',
      JSON.parse(record.stdout)
    );
    assert.equal(
      (await run(state, ['validate-record', '--input', recordPath])).code,
      0
    );
    assert.equal((await run(state, ['reverse', '--input', recordPath])).code, 0);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('verified RC.8 runner and loopback gate fail closed', async () => {
  const verified = await run(runnerVerifier, []);
  assert.equal(verified.code, 0, verified.stderr);
  const status = JSON.parse(verified.stdout);
  assert.equal(status.dshVersion, '0.1.0-rc.8');
  assert.equal(status.packages, 504);
  assert.equal(status.dshPackages, 187);
  assert.equal(status.certificationRunId, 32393288849);

  const version = await run(runner, ['--version']);
  assert.equal(version.code, 0, version.stderr);
  assert.equal(version.stdout.trim(), '0.1.0-rc.8');

  for (const args of [
    ['web', '--host', '0.0.0.0'],
    ['web', '--open', 'true'],
    ['web', '--no-open', '--no-open'],
    ['web', '--trusted-host', 'example.test'],
    ['web', '--patch', '/tmp/patch.yml'],
    [
      'plugin',
      '--profile',
      'web',
      'remove',
      '@linxin666/arbitrary-package',
    ],
  ]) {
    const rejected = await run(runner, args);
    assert.notEqual(rejected.code, 0);
    assert.match(rejected.stderr, /unsupported runner command/);
  }

  for (const url of ['http://127.0.0.1:3000', 'http://[::1]:3000']) {
    const accepted = await run(loopbackGate, ['--url', url]);
    assert.equal(accepted.code, 0, accepted.stderr);
  }
  for (const url of [
    'http://0.0.0.0:3000',
    'http://192.168.1.2:3000',
    'http://localhost:3000',
    'http://127.0.0.1:3000/?trusted=1',
  ]) {
    const rejected = await run(loopbackGate, ['--url', url]);
    assert.notEqual(rejected.code, 0);
  }
});
