import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const state = JSON.parse(
  await readFile(new URL('release-state.json', root), 'utf8')
);
const startupSmokeIndexBytes = await readFile(
  new URL(
    'skills/dsh-theme-manager/references/rc2-runtime-smoke/index.json',
    root
  )
);
const hostedLifecycleIndexBytes = await readFile(
  new URL(
    'skills/dsh-theme-manager/references/rc2-hosted-lifecycle-smoke/index.json',
    root
  )
);

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

const exactSemver =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

test('release state separates the RC.2 candidate from certified and historical lanes', () => {
  assert.equal(state.schemaVersion, 3);
  assert.match(state.capturedAt, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(Number.isNaN(Date.parse(`${state.capturedAt}T00:00:00Z`)), false);
  assert.equal(state.purpose, 'informational-release-state');
  assert.equal(state.controlsSafetyValidation, false);

  for (const lane of [
    state.upstream,
    state.candidate,
    state.certified,
    state.historicalV2,
    state.historicalV1,
  ]) {
    assert.match(lane.dshPackageVersion, exactSemver);
  }

  assert.equal(state.upstream.status, 'released-certification-pending');
  assert.equal(state.upstream.dshPackageVersion, '0.1.1-rc.2');
  assert.equal(
    state.upstream.sourceTag,
    `dsh-v${state.upstream.dshPackageVersion}`
  );
  assert.match(state.upstream.sourceCommit, /^[a-f0-9]{40}$/);
  assert.match(state.upstream.npmIntegrity, /^sha512-[A-Za-z0-9+/]+={0,2}$/);
  assert.match(state.upstream.npmShasum, /^[a-f0-9]{40}$/);
  assert.equal(state.upstream.installableCurrent, false);

  assert.equal(state.candidate.status, 'certification-pending');
  assert.equal(state.candidate.dshPackageVersion, state.upstream.dshPackageVersion);
  assert.equal(state.candidate.installableCurrent, false);
  assert.equal(state.candidate.matrixJobsCompleted, 0);
  assert.equal(state.candidate.matrixJobsRequired, 6);
  assert.equal(state.candidate.communityItemsCompleted, 0);
  assert.equal(state.candidate.communityItemsRequired, 11);

  assert.deepEqual(
    {
      status: state.nonPromotionalSmoke.status,
      promotionAuthority: state.nonPromotionalSmoke.promotionAuthority,
      installable: state.nonPromotionalSmoke.installable,
      baseline: state.nonPromotionalSmoke.baseline,
    },
    {
      status: 'partial-runtime-evidence-only',
      promotionAuthority: false,
      installable: false,
      baseline: '@deepseek-ai/dsh@0.1.1-rc.2',
    }
  );
  assert.deepEqual(
    {
      status: state.nonPromotionalSmoke.startupMatrix.status,
      completedJobs: state.nonPromotionalSmoke.startupMatrix.completedJobs,
      requiredJobs: state.nonPromotionalSmoke.startupMatrix.requiredJobs,
      platforms: state.nonPromotionalSmoke.startupMatrix.platforms,
      nodeVersions: state.nonPromotionalSmoke.startupMatrix.nodeVersions,
    },
    {
      status: 'smoke-passed',
      completedJobs: 6,
      requiredJobs: 6,
      platforms: ['linux', 'darwin', 'win32'],
      nodeVersions: ['22.19.0', '24.15.0'],
    }
  );
  assert.equal(
    state.nonPromotionalSmoke.startupMatrix.evidencePath,
    'skills/dsh-theme-manager/references/rc2-runtime-smoke/index.json'
  );
  assert.equal(
    state.nonPromotionalSmoke.startupMatrix.evidenceSha256,
    sha256(startupSmokeIndexBytes)
  );
  assert.deepEqual(
    {
      status: state.nonPromotionalSmoke.hostedLifecycle.status,
      completedItems: state.nonPromotionalSmoke.hostedLifecycle.completedItems,
      requiredItems: state.nonPromotionalSmoke.hostedLifecycle.requiredItems,
      themeCount: state.nonPromotionalSmoke.hostedLifecycle.themeCount,
      fullSkinCount: state.nonPromotionalSmoke.hostedLifecycle.fullSkinCount,
      environment: state.nonPromotionalSmoke.hostedLifecycle.environment,
    },
    {
      status: 'lifecycle-smoke-passed',
      completedItems: 32,
      requiredItems: 32,
      themeCount: 6,
      fullSkinCount: 26,
      environment: {
        platform: 'darwin',
        arch: 'arm64',
        nodeVersion: '24.15.0',
      },
    }
  );
  assert.equal(
    state.nonPromotionalSmoke.hostedLifecycle.evidencePath,
    'skills/dsh-theme-manager/references/rc2-hosted-lifecycle-smoke/index.json'
  );
  assert.equal(
    state.nonPromotionalSmoke.hostedLifecycle.evidenceSha256,
    sha256(hostedLifecycleIndexBytes)
  );
  assert.deepEqual(state.nonPromotionalSmoke.hostedLifecycle.pendingChecks, [
    'lightDarkSystem',
    'featureActivation',
    'visualAccessibility',
    'rollbackReverse',
    'rc2HostedArtifactRepack',
    'rc2SelectorCatalog',
    'finalRuntimeAttestation',
  ]);

  assert.equal(state.certified.status, 'certified-installable');
  assert.equal(state.certified.dshPackageVersion, '0.1.0-rc.8');
  assert.equal(state.certified.installableCurrent, true);
  assert.equal(
    state.certified.runtimeAttestationSha256,
    '1cd9a0b4a6b9d215f0a1f70a97b4d43eae7bf4f846ae7009b7ddb812823ca0ae'
  );
  assert.equal(state.certified.certificationRunId, 32393288849);

  assert.equal(state.historicalV2.status, 'historical-v2');
  assert.equal(state.historicalV2.dshPackageVersion, '0.1.0-rc.6');
  assert.equal(state.historicalV2.installableCurrent, false);
  assert.equal(state.historicalV1.status, 'historical-v1');
  assert.equal(state.historicalV1.dshPackageVersion, '0.1.0-rc.5');
  assert.equal(state.historicalV1.installableCurrent, false);
});

test('release documentation exposes candidate, certified, and historical lanes', async () => {
  const documents = [
    'README.md',
    'README.zh-CN.md',
    'skills/dsh-theme-finder/SKILL.md',
    'skills/dsh-theme-finder/references/catalog-contract.md',
    'skills/dsh-theme-creator/SKILL.md',
    'skills/dsh-theme-creator/references/authoring-v3.md',
    'skills/dsh-theme-submitter/SKILL.md',
    'skills/dsh-theme-submitter/references/submission-checklist.md',
    'skills/dsh-theme-manager/SKILL.md',
    'skills/dsh-theme-manager/references/compatibility.md',
  ];

  const contentsByPath = new Map();
  for (const path of documents) {
    const contents = await readFile(new URL(path, root), 'utf8');
    contentsByPath.set(path, contents);
    assert.ok(contents.includes(state.certified.dshPackageVersion));
  }
  const combined = [...contentsByPath.values()].join('\n');
  assert.ok(combined.includes(state.candidate.dshPackageVersion));
  assert.ok(combined.includes(state.historicalV2.dshPackageVersion));
  assert.ok(combined.includes(state.historicalV1.dshPackageVersion));
});

test('informational release state cannot change executable baseline gates', async () => {
  const operationalFiles = [
    'skills/dsh-theme-creator/scripts/create-manifest.mjs',
    'skills/dsh-theme-submitter/scripts/validate-submission.mjs',
    'skills/dsh-theme-manager/scripts/verify-runner.mjs',
    'skills/dsh-theme-finder/scripts/find-themes.mjs',
  ];

  for (const path of operationalFiles) {
    const contents = await readFile(new URL(path, root), 'utf8');
    assert.match(contents, /baseline-(?:policy|authority)/);
    assert.doesNotMatch(contents, /release-state\.json/);
  }
});

test('Manager V3 and the separate 11-record community authority are open only on final RC.8 evidence', async () => {
  const finder = await readFile(
    new URL('skills/dsh-theme-finder/scripts/find-themes.mjs', root),
    'utf8'
  );
  const communityGate = await readFile(
    new URL(
      'skills/dsh-community-skin-installer/scripts/catalog-authority.mjs',
      root
    ),
    'utf8'
  );
  const manager = await readFile(
    new URL('skills/dsh-theme-manager/scripts/validate-release.mjs', root),
    'utf8'
  );
  const catalog = JSON.parse(
    await readFile(
      new URL(
        'skills/dsh-community-skin-installer/references/community-catalog.json',
        root
      ),
      'utf8'
    )
  );

  assert.match(finder, /runtimeAttestationSha256/);
  assert.match(manager, /validateV3/);
  assert.doesNotMatch(manager, /rejectPendingV3/);
  assert.match(communityGate, /managerBaselineCertified/);
  assert.equal(catalog.managerGate.installable, true);
  assert.equal(catalog.managerGate.certificationStatus, 'certified-installable');
  assert.equal(
    catalog.managerGate.targetRuntimeAttestationSha256,
    '1cd9a0b4a6b9d215f0a1f70a97b4d43eae7bf4f846ae7009b7ddb812823ca0ae'
  );
  assert.equal(
    catalog.managerGate.runtimeReceiptSha256,
    '89bb10b995e7734b6c13ab7d0027d73440f5d8f40b1f618b3c9adbbe52e1b1a1'
  );
  assert.equal(catalog.skins.length, 11);
  assert.ok(
    catalog.skins.every((skin) => skin.runtimeStatus === 'runtime-verified')
  );
  assert.match(communityGate, /RUNTIME_RECEIPT_SHA256/);
});
