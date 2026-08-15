import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:https';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

import { isExactSemver } from '../skills/dsh-theme-manager/scripts/semver.mjs';
import { run } from './helpers.mjs';

const state = resolve('skills/dsh-theme-manager/scripts/theme-state.mjs');
const verifier = resolve('skills/dsh-theme-manager/scripts/fetch-and-verify.mjs');
const releaseValidator = resolve('skills/dsh-theme-manager/scripts/validate-release.mjs');
const fixture = (name) => resolve('test/fixtures', name);
const shaA = 'a'.repeat(64);
const shaB = 'b'.repeat(64);
const shaC = 'c'.repeat(64);
const trustedOrigin = 'https://themes.example';

const compatibility = Object.freeze({
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
    distribution: {
      kind: 'hosted-verified-artifact',
      installability: 'manager',
      redistribution: 'allowed',
      previewPolicy: 'hosted',
    },
    artifactUrl: `${trustedOrigin}/api/themes/ocean-workbench/download/1.1.0`,
    artifactSha256: shaA,
    manifest: {
      schemaVersion: '2.0',
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
        tokenCatalogSha256: compatibility.tokenCatalogSha256,
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

test('release validator separates current V2, historical V1, and artifact authority', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-release-'));
  try {
    await t.test('accepts the exact current rc.6 V2 release', async () => {
      const release = currentRelease();
      const result = await validateRelease(directory, 'current-v2.json', release);
      assert.equal(result.code, 0, result.stderr);
      const output = JSON.parse(result.stdout);
      assert.equal(output.status, 'current');
      assert.equal(output.installableCurrent, true);
      assert.equal(output.dshVersion, '0.1.0-rc.6');
      assert.equal(output.sourceCommit, null);
      assert.equal(output.artifactSha256, shaA);
      assert.equal(output.payloadSha256, shaB);
      assert.equal(output.distribution.kind, 'hosted-verified-artifact');
    });

    await t.test('accepts an explicit null rc.6 sourceCommit', async () => {
      const release = currentRelease();
      release.manifest.compatibility.sourceCommit = null;
      const result = await validateRelease(directory, 'current-null-commit.json', release);
      assert.equal(result.code, 0, result.stderr);
      assert.equal(JSON.parse(result.stdout).sourceCommit, null);
    });

    await t.test('rejects a fabricated rc.6 sourceCommit', async () => {
      const release = currentRelease();
      release.manifest.compatibility.sourceCommit =
        '47f943859bef60e4160492346772ded9b24f765a';
      const result = await validateRelease(directory, 'fake-source-commit.json', release);
      assert.notEqual(result.code, 0);
      assert.match(result.stderr, /sourceCommit must be omitted or null/);
    });

    await t.test('never treats a V2 payload digest as the complete artifact digest', async () => {
      const release = currentRelease();
      release.artifactSha256 = release.manifest.payload.sha256;
      const result = await validateRelease(directory, 'v2-payload-substitution.json', release);
      assert.notEqual(result.code, 0);
      assert.match(result.stderr, /catalog artifactSha256/);
    });

    await t.test('refuses a payload-only embedded V2 manifest as installation authority', async () => {
      const release = currentRelease();
      delete release.manifest.artifact;
      const result = await validateRelease(directory, 'payload-only-v2.json', release);
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

    await t.test('requires the exact V2 payload and artifact digest scopes', async () => {
      const wrongArtifact = currentRelease();
      wrongArtifact.manifest.artifact.digestScope = 'canonical-tar-payload-excluding-manifest';
      const artifactResult = await validateRelease(directory, 'wrong-artifact-scope.json', wrongArtifact);
      assert.notEqual(artifactResult.code, 0);
      assert.match(artifactResult.stderr, /artifact\.digestScope/);

      const wrongPayload = currentRelease();
      wrongPayload.manifest.payload.digestScope = 'artifact-tgz';
      const payloadResult = await validateRelease(directory, 'wrong-v2-payload-scope.json', wrongPayload);
      assert.notEqual(payloadResult.code, 0);
      assert.match(payloadResult.stderr, /payload\.digestScope/);
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
    await writeFile(list, JSON.stringify({ dependencies: { '@dsh-themes/one': '1.0.0', '@dsh-themes/two': '2.0.0', other: '3.0.0' } }));
    const result = await run(state, ['inspect', '--input', list]);
    assert.notEqual(result.code, 0);
    assert.match(result.stderr, /Multiple DSH-Themes packages/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('theme state parses the rc.6 root profile array and rejects ambiguous profiles', async (t) => {
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
      assert.match(result.stderr, /exactly one unambiguous rc\.6 profile record/);
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
        assert.match(result.stderr, /exactly one unambiguous rc\.6 profile record/);
      }
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});

test('theme state accepts one exact direct package and rejects ranges', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-state-'));
  try {
    const exactPath = await writeJson(directory, 'exact.json', {
      dependencies: {
        '@dsh-themes/ocean-workbench': { resolvedVersion: '1.2.3-rc.1+verified.2', direct: true },
        '@dsh-themes/transitive': { resolvedVersion: '9.9.9', direct: false },
      },
    });
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
        const input = await writeJson(directory, `${name}.json`, {
          dependencies: { '@dsh-themes/ocean-workbench': version },
        });
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

test('rollback records preserve exact artifacts and reverse safely', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-rollback-'));
  try {
    const previous = join(directory, 'previous.tgz');
    const target = join(directory, 'target.tgz');
    const result = await run(state, [
      'record', '--at', '2026-08-14T00:00:00.000Z',
      '--previous-name', '@dsh-themes/previous', '--previous-version', '1.2.3', '--previous-artifact', previous, '--previous-sha256', shaA,
      '--target-name', '@dsh-themes/target', '--target-version', '2.0.0-rc.1', '--target-artifact', target, '--target-sha256', shaB,
    ]);
    assert.equal(result.code, 0, result.stderr);
    const record = JSON.parse(result.stdout);
    assert.equal(record.createdAt, '2026-08-14T00:00:00.000Z');
    assert.deepEqual(record.previous, {
      packageName: '@dsh-themes/previous',
      version: '1.2.3',
      artifactPath: previous,
      artifactSha256: shaA,
    });
    assert.deepEqual(record.target, {
      packageName: '@dsh-themes/target',
      version: '2.0.0-rc.1',
      artifactPath: target,
      artifactSha256: shaB,
    });
    const path = join(directory, 'rollback.json');
    await writeFile(path, JSON.stringify(record));
    const validated = await run(state, ['validate-record', '--input', path]);
    assert.equal(validated.code, 0, validated.stderr);
    const reversed = await run(state, ['reverse', '--input', path]);
    assert.equal(reversed.code, 0, reversed.stderr);
    const reverseRecord = JSON.parse(reversed.stdout);
    assert.deepEqual(reverseRecord.previous, record.target);
    assert.deepEqual(reverseRecord.target, record.previous);

    const tampered = structuredClone(record);
    tampered.target.artifactPath = 'relative.tgz';
    const tamperedPath = await writeJson(directory, 'tampered.json', tampered);
    const rejected = await run(state, ['validate-record', '--input', tamperedPath]);
    assert.notEqual(rejected.code, 0);
    assert.match(rejected.stderr, /malformed/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('rollback record can reverse a theme back from the built-in palette', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-rollback-built-in-'));
  try {
    const target = join(directory, 'target.tgz');
    const created = await run(state, [
      'record', '--at', '2026-08-14T00:00:00.000Z',
      '--target-name', '@dsh-themes/target', '--target-version', '2.0.0', '--target-artifact', target, '--target-sha256', shaB,
    ]);
    assert.equal(created.code, 0, created.stderr);
    const path = join(directory, 'rollback.json');
    await writeFile(path, created.stdout);
    const reversed = await run(state, ['reverse', '--input', path]);
    assert.equal(reversed.code, 0, reversed.stderr);
    const record = JSON.parse(reversed.stdout);
    assert.equal(record.target, null);
    assert.equal(record.previous.packageName, '@dsh-themes/target');
    const reversePath = join(directory, 'reverse.json');
    await writeFile(reversePath, reversed.stdout);
    assert.equal((await run(state, ['validate-record', '--input', reversePath])).code, 0);

    const impossible = await writeJson(directory, 'two-built-ins.json', {
      schemaVersion: 1,
      profile: 'web',
      createdAt: '2026-08-14T00:00:00.000Z',
      previous: null,
      target: null,
    });
    const rejected = await run(state, ['validate-record', '--input', impossible]);
    assert.notEqual(rejected.code, 0);
    assert.match(rejected.stderr, /two built-in states/);
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
      assert.match(result.stderr, /must use HTTP 307/);
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
