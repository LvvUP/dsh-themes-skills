import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const state = JSON.parse(
  await readFile(new URL('release-state.json', root), 'utf8')
);

const exactSemver =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

test('release state records certified RC.8 plus historical V2 and V1', () => {
  assert.equal(state.schemaVersion, 2);
  assert.match(state.capturedAt, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(Number.isNaN(Date.parse(`${state.capturedAt}T00:00:00Z`)), false);
  assert.equal(state.purpose, 'informational-release-state');
  assert.equal(state.controlsSafetyValidation, false);

  for (const lane of [
    state.upstream,
    state.certified,
    state.historicalV2,
    state.historicalV1,
  ]) {
    assert.match(lane.dshPackageVersion, exactSemver);
  }

  assert.equal(state.upstream.status, 'released-certified');
  assert.equal(state.upstream.dshPackageVersion, '0.1.0-rc.8');
  assert.equal(
    state.upstream.sourceTag,
    `dsh-v${state.upstream.dshPackageVersion}`
  );
  assert.match(state.upstream.sourceCommit, /^[a-f0-9]{40}$/);
  assert.equal(state.upstream.npmDistTag, 'next');
  assert.match(state.upstream.npmIntegrity, /^sha512-[A-Za-z0-9+/]+={0,2}$/);
  assert.match(state.upstream.npmShasum, /^[a-f0-9]{40}$/);
  assert.equal(state.upstream.installableCurrent, true);

  assert.equal(state.certified.status, 'certified-installable');
  assert.equal(state.certified.dshPackageVersion, state.upstream.dshPackageVersion);
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

test('release documentation exposes current and historical lanes', async () => {
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
    assert.ok(
      contents.includes(state.certified.dshPackageVersion),
      `${path} must identify certified RC.8`
    );
  }
  const combined = [...contentsByPath.values()].join('\n');
  assert.ok(combined.includes(state.historicalV2.dshPackageVersion));
  assert.ok(combined.includes(state.historicalV1.dshPackageVersion));
});

test('informational release state cannot change executable RC.8 gates', async () => {
  const operationalFiles = [
    'skills/dsh-theme-creator/scripts/create-manifest.mjs',
    'skills/dsh-theme-submitter/scripts/validate-submission.mjs',
    'skills/dsh-theme-manager/scripts/verify-runner.mjs',
    'skills/dsh-theme-manager/runtime-rc8/package.json',
    'skills/dsh-theme-manager/runtime-rc8/attestation.json',
    'skills/dsh-theme-finder/scripts/find-themes.mjs',
  ];

  for (const path of operationalFiles) {
    const contents = await readFile(new URL(path, root), 'utf8');
    assert.ok(
      contents.includes(state.certified.dshPackageVersion),
      `${path} must remain pinned to certified RC.8`
    );
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
  assert.match(communityGate, /managerRc8Certified/);
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
