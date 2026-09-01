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

test('release state separates the certified RC.2 runtime baseline from item and historical lanes', () => {
  assert.equal(state.schemaVersion, 5);
  assert.equal(state.capturedAt, '2026-08-27');
  assert.match(state.capturedAt, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(Number.isNaN(Date.parse(`${state.capturedAt}T00:00:00Z`)), false);
  assert.equal(state.purpose, 'informational-release-state');
  assert.equal(state.controlsSafetyValidation, false);

  for (const lane of [
    state.upstream,
    state.candidate,
    state.certifiedRuntimeBaseline,
    state.currentOperationalItemAuthority,
    state.promotedHostedCohort,
    state.certified,
    state.historicalV2,
    state.historicalV1,
  ]) {
    assert.match(lane.dshPackageVersion, exactSemver);
  }

  assert.equal(state.upstream.status, 'released-runtime-baseline-certified');
  assert.equal(state.upstream.dshPackageVersion, '0.1.1-rc.2');
  assert.equal(
    state.upstream.sourceTag,
    `dsh-v${state.upstream.dshPackageVersion}`
  );
  assert.match(state.upstream.sourceCommit, /^[a-f0-9]{40}$/);
  assert.match(state.upstream.npmIntegrity, /^sha512-[A-Za-z0-9+/]+={0,2}$/);
  assert.match(state.upstream.npmShasum, /^[a-f0-9]{40}$/);
  assert.equal(state.upstream.runtimeBaselineProductionReady, true);
  assert.equal(state.upstream.installableCurrent, false);
  assert.equal(state.upstream.itemInstallability, 'separate-authority-required');

  assert.equal(state.candidate.status, 'certification-pending');
  assert.equal(state.candidate.historicalAtCapture, true);
  assert.equal(state.candidate.capturedBeforeFinalRun, true);
  assert.equal(state.candidate.authorityScope, 'historical-certification-inputs-only');
  assert.equal(state.candidate.dshPackageVersion, state.upstream.dshPackageVersion);
  assert.equal(state.candidate.installableCurrent, false);
  assert.equal(state.candidate.matrixJobsCompleted, 0);
  assert.equal(state.candidate.matrixJobsRequired, 6);
  assert.equal(state.candidate.communityItemsCompleted, 0);
  assert.equal(state.candidate.communityItemsRequired, 11);

  assert.deepEqual(
    {
      status: state.certifiedRuntimeBaseline.status,
      certificationStatus: state.certifiedRuntimeBaseline.certificationStatus,
      productionReady: state.certifiedRuntimeBaseline.productionReady,
      installableItems: state.certifiedRuntimeBaseline.installableItems,
      itemInstallability: state.certifiedRuntimeBaseline.itemInstallability,
      runId: state.certifiedRuntimeBaseline.certificationRunId,
      runAttempt: state.certifiedRuntimeBaseline.certificationRunAttempt,
      sourceSha: state.certifiedRuntimeBaseline.certificationSourceSha,
      completed: state.certifiedRuntimeBaseline.matrixJobsCompleted,
      required: state.certifiedRuntimeBaseline.matrixJobsRequired,
      catalogRead: state.certifiedRuntimeBaseline.catalogRead,
      installableResultsAllowed:
        state.certifiedRuntimeBaseline.installableResultsAllowed,
      authoringEnabled: state.certifiedRuntimeBaseline.authoringEnabled,
      submissionEnabled: state.certifiedRuntimeBaseline.submissionEnabled,
      communityCompleted: state.certifiedRuntimeBaseline.communityItemsCompleted,
      communityRequired: state.certifiedRuntimeBaseline.communityItemsRequired,
      communityInstallable:
        state.certifiedRuntimeBaseline.communityInstallableRecords,
    },
    {
      status: 'baseline-certified',
      certificationStatus: 'verified-runtime-baseline',
      productionReady: true,
      installableItems: false,
      itemInstallability: 'separate-authority-required',
      runId: 32694257969,
      runAttempt: 1,
      sourceSha: 'cc7546cb5ccd77002713171328972291ceaa12e6',
      completed: 6,
      required: 6,
      catalogRead: false,
      installableResultsAllowed: false,
      authoringEnabled: false,
      submissionEnabled: false,
      communityCompleted: 0,
      communityRequired: 11,
      communityInstallable: 0,
    }
  );
  assert.equal(
    state.certifiedRuntimeBaseline.attestationSha256,
    '4c41e96827bb03eb7c4d6138f5723864e91f0324b1aec8bcf3b3a1bc47ba3fb7'
  );
  assert.equal(
    state.certifiedRuntimeBaseline.certificationReceiptSha256,
    '4a649841766b4bf3421c78906f98f29a186d718ea34b03daca96ee52e9a3db98'
  );
  assert.equal(
    state.certifiedRuntimeBaseline.archiveSha256,
    '0b4f03e9c3f76d241890f46330fce84f32183774a5d9228077835e2258c76f3e'
  );
  assert.equal(
    state.certifiedRuntimeBaseline.provenanceSha256,
    'b520580f05101b4783079aa52f0e159b2aa1a9e239f7e6a68e469f4c5d084b2d'
  );

  assert.deepEqual(
    {
      status: state.nonPromotionalSmoke.status,
      historicalAtCapture: state.nonPromotionalSmoke.historicalAtCapture,
      authorityScope: state.nonPromotionalSmoke.authorityScope,
      runtimeBaselineFinalizerPending:
        state.nonPromotionalSmoke.runtimeBaselineFinalizerPending,
      promotionAuthority: state.nonPromotionalSmoke.promotionAuthority,
      installable: state.nonPromotionalSmoke.installable,
      baseline: state.nonPromotionalSmoke.baseline,
    },
    {
      status: 'partial-runtime-evidence-only',
      historicalAtCapture: true,
      authorityScope: 'item-and-hosted-artifact-smoke-only',
      runtimeBaselineFinalizerPending: false,
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
  assert.deepEqual(
    state.nonPromotionalSmoke.hostedLifecycle.historicalPendingItemChecks,
    [
    'lightDarkSystem',
    'featureActivation',
    'visualAccessibility',
    'rollbackReverse',
    'rc2HostedArtifactRepack',
    'rc2SelectorCatalog',
    ]
  );

  assert.deepEqual(
    {
      status: state.currentOperationalItemAuthority.status,
      releaseVersion: state.currentOperationalItemAuthority.releaseVersion,
      dshPackageVersion:
        state.currentOperationalItemAuthority.dshPackageVersion,
      installableCurrent:
        state.currentOperationalItemAuthority.installableCurrent,
      hostedArtifactCount:
        state.currentOperationalItemAuthority.hostedArtifactCount,
      themeCount: state.currentOperationalItemAuthority.themeCount,
      fullSkinCount: state.currentOperationalItemAuthority.fullSkinCount,
      catalogIndexSha256:
        state.currentOperationalItemAuthority.catalogIndexSha256,
      tupleSetSha256:
        state.currentOperationalItemAuthority.tupleSetSha256,
      rollbackOnlyCount:
        state.currentOperationalItemAuthority.rollbackOnlyCount,
      runtimeCertifiedFullSkinCount:
        state.currentOperationalItemAuthority.runtimeCertifiedFullSkinCount,
      runtimePendingFullSkinCount:
        state.currentOperationalItemAuthority.runtimePendingFullSkinCount,
      communityAllowlistCount:
        state.currentOperationalItemAuthority.communityAllowlistCount,
    },
    {
      status: 'operational-authority',
      releaseVersion: '0.7.2',
      dshPackageVersion: '0.1.0-rc.8',
      installableCurrent: true,
      hostedArtifactCount: 45,
      themeCount: 6,
      fullSkinCount: 39,
      catalogIndexSha256:
        'a894ed95febe69910281f4c603dd7ef392d5a004f8c5fc3f2b25cc67fa08de15',
      tupleSetSha256:
        '6806fb4dfa5e59524fd3e29b9c4c7b20e5ece8108b7efec2f4a42ed8f5e4c954',
      rollbackOnlyCount: 24,
      runtimeCertifiedFullSkinCount: 39,
      runtimePendingFullSkinCount: 0,
      communityAllowlistCount: 11,
    }
  );
  assert.deepEqual(
    {
      status: state.promotedHostedCohort.status,
      releaseVersion: state.promotedHostedCohort.releaseVersion,
      dshPackageVersion: state.promotedHostedCohort.dshPackageVersion,
      installableCurrent: state.promotedHostedCohort.installableCurrent,
      executableAuthority: state.promotedHostedCohort.executableAuthority,
      managerHandoffAllowed: state.promotedHostedCohort.managerHandoffAllowed,
      artifactCount: state.promotedHostedCohort.artifactCount,
      currentHostedArtifactCount:
        state.promotedHostedCohort.currentHostedArtifactCount,
      currentThemeCount: state.promotedHostedCohort.currentThemeCount,
      currentFullSkinCount: state.promotedHostedCohort.currentFullSkinCount,
      currentCatalogIndexSha256:
        state.promotedHostedCohort.currentCatalogIndexSha256,
      currentCatalogTupleSetSha256:
        state.promotedHostedCohort.currentCatalogTupleSetSha256,
      historicalFinalCandidateCatalogIndexSha256:
        state.promotedHostedCohort.historicalFinalCandidateCatalogIndexSha256,
      runtimeMatrix: state.promotedHostedCohort.runtimeMatrix,
    },
    {
      status: 'two-stage-certified-and-promoted',
      releaseVersion: '0.7.0',
      dshPackageVersion: '0.1.0-rc.8',
      installableCurrent: true,
      executableAuthority: true,
      managerHandoffAllowed: true,
      artifactCount: 13,
      currentHostedArtifactCount: 45,
      currentThemeCount: 6,
      currentFullSkinCount: 39,
      currentCatalogIndexSha256:
        'a894ed95febe69910281f4c603dd7ef392d5a004f8c5fc3f2b25cc67fa08de15',
      currentCatalogTupleSetSha256:
        '6806fb4dfa5e59524fd3e29b9c4c7b20e5ece8108b7efec2f4a42ed8f5e4c954',
      historicalFinalCandidateCatalogIndexSha256:
        'f2701f3af25d90fb72c8c2a68592b1adb4294e8f3c9652f34db8ca487c6f4c63',
      runtimeMatrix: 'certified-rc8',
    }
  );
  assert.deepEqual(
    state.promotedHostedCohort.catalogIds,
    [2030, 2031, 2032, 2033, 2034, 2035, 2036, 2037, 2038, 2039, 2040, 2041, 2043]
  );
  assert.equal(
    state.promotedHostedCohort.catalogIds.includes(2042),
    false
  );
  assert.equal(state.promotedHostedCohort.promotedAt, '2026-08-27');
  assert.deepEqual(
    state.promotedHostedCohort.captureCandidate,
    {
      schemaVersion: 1,
      phase: 'capture-candidate',
      status: 'passed',
      targets: 13,
      screenshots: 65,
      evidenceFiles: 1010,
      planSha256:
        'f095f964d21357eabd9f9bcad310faa2ccc7292f0a75e9dd49b526140043a940',
      promotionReceiptSha256:
        '907ed35fd089b292f41f3daa47297fd9a9ca591b7b12f469d4ab651f6919111d',
      archiveSha256:
        'cef82c0db7601b869fa53c3f034e9ad5d77978d89a553b6bc0a646c05f87d029',
      sha256SumsSha256:
        'b4ece672e5561816d1cf409b9de2cc8c2cda8afce04bc09dc101672847202863',
      frozenIdentitySha256:
        'e1935797b5eff2804cea2012924815fc4aaa6fbed002ec97d0796d8a8d1e0cb9',
    }
  );
  assert.deepEqual(
    state.promotedHostedCohort.certifyFinal,
    {
      schemaVersion: 1,
      phase: 'certify-final',
      status: 'passed',
      targets: 13,
      screenshots: 65,
      evidenceFiles: 1010,
      planSha256:
        '65eef49f75d873989d27de04b206e17eec55a4a7b4b992261ef856fa1b39b3fc',
      promotionReceiptSha256:
        '43bdf28f3947f558afe3273478b92502b015ead2be10278516b2624038d0795a',
      archiveSha256:
        'd47520f808ea576b3a24500541397db0364107d54b9c0aee62d0eb0d1a4f5590',
      sha256SumsSha256:
        'f2e6a9e05a25139630926c0edca9521912a7ec52ec86ae0057c7e87d9504ce2a',
      frozenIdentitySha256:
        '48aa04ac73b5ead54ff7fb992b8c95aa3baa1302f860fca48cf76f7a631d7a2b',
    }
  );
  assert.match(
    state.promotedHostedCohort.runtimeEvidenceBoundary,
    /passed real capture-candidate and rebuilt-byte certify-final/i
  );

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

test('release documentation exposes runtime, item, and historical lanes', async () => {
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
  assert.match(
    contentsByPath.get('README.md'),
    /Verified six-job runtime baseline/
  );
  assert.match(
    contentsByPath.get('README.zh-CN.md'),
    /六任务已验证运行基线/
  );
  assert.match(combined, /no item authority|grants zero item authority|不授予任何条目权威/i);
  assert.match(combined, /alpha\.2/);
  assert.match(combined, /0\/66 tasks|66 required tasks/);
  assert.match(combined, /showcase-only/);
  assert.match(contentsByPath.get('README.md'), /fail-closed/i);
  assert.match(contentsByPath.get('README.zh-CN.md'), /失败关闭/);
  assert.ok(combined.includes(state.historicalV2.dshPackageVersion));
  assert.ok(combined.includes(state.historicalV1.dshPackageVersion));
  const security = await readFile(new URL('SECURITY.md', root), 'utf8');
  assert.match(
    security,
    /45 package-version-complete-digest tuples \(6 Themes and 39 Full Skins\)/
  );
  assert.doesNotMatch(
    security,
    /32 package-version-complete-digest tuples in `CURRENT_INSTALLABLE_HOSTED_ARTIFACTS`/
  );
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

test('Manager keeps alpha.1 and RC.8 history while the separate community lane is closed on alpha.2', async () => {
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
  const communityPolicy = JSON.parse(
    await readFile(
      new URL(
        'skills/dsh-community-skin-installer/references/baseline-policy.json',
        root
      ),
      'utf8'
    )
  );
  const alpha2Recertification = JSON.parse(
    await readFile(
      new URL(
        'skills/dsh-community-skin-installer/references/alpha2-recertification.json',
        root
      ),
      'utf8'
    )
  );
  const alpha1Bytes = await readFile(
    new URL(
      'skills/dsh-community-skin-installer/references/alpha1-recertification.json',
      root
    )
  );

  assert.match(finder, /runtimeAttestationSha256/);
  assert.match(manager, /validateV3/);
  assert.doesNotMatch(manager, /rejectPendingV3/);
  assert.match(communityGate, /alpha2GateCertified/);
  assert.match(communityGate, /ALPHA2_RECERTIFICATION_SHA256/);
  assert.equal(communityPolicy.defaultOperationalLane, 'currentAlpha2');
  assert.equal(communityPolicy.currentAlpha2.installable, false);
  assert.equal(
    communityPolicy.currentAlpha2.websiteDistribution,
    'external-showcase'
  );
  assert.equal(
    communityPolicy.currentAlpha2.websiteInstallability,
    'showcase-only'
  );
  assert.equal(
    communityPolicy.currentAlpha2.websiteCompatibility,
    'verification-pending'
  );
  assert.equal(
    alpha2Recertification.baseline.sourceCommit,
    '0a53fb55bea101816fa226bb964ae2bed71c343b'
  );
  assert.equal(
    alpha2Recertification.baseline.sourceTree,
    '64ccbfa8e0caa4711cd4a75717ef9e022657961b'
  );
  assert.equal(alpha2Recertification.gate.requiredItems, 11);
  assert.equal(alpha2Recertification.matrix.requiredTotalTasks, 66);
  assert.equal(alpha2Recertification.gate.reviewedItems, 0);
  assert.equal(alpha2Recertification.gate.completedTasks, 0);
  assert.equal(alpha2Recertification.gate.installableItems, 0);
  assert.equal(alpha2Recertification.gate.installable, false);
  assert.equal(alpha2Recertification.gate.showcasePublicationAllowed, true);
  assert.equal(alpha2Recertification.gate.installPublicationAllowed, false);
  assert.equal(
    alpha2Recertification.historicalAuthority.alpha1MayAuthorizeAlpha2,
    false
  );
  assert.equal(
    createHash('sha256').update(alpha1Bytes).digest('hex'),
    '9ecc86474cba557c445ae21b8e479aa3f1b55cb8b2768faa6ed73952cc7b1552'
  );
  assert.equal(communityPolicy.currentAlpha1.historicalAtCapture, true);
  assert.equal(communityPolicy.currentAlpha1.mayAuthorizeCurrent, false);
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
  assert.equal(communityPolicy.certified.historicalAtCapture, true);
  assert.equal(communityPolicy.certified.installableAtCapture, true);
  assert.equal(communityPolicy.certified.installable, false);
  assert.match(communityGate, /RUNTIME_RECEIPT_SHA256/);
});
