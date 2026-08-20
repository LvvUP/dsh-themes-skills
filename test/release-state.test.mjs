import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const state = JSON.parse(
  await readFile(new URL('release-state.json', root), 'utf8')
);

const exactSemver =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

test('release state separates upstream, certified, and historical lanes', () => {
  assert.equal(state.schemaVersion, 1);
  assert.match(state.capturedAt, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(Number.isNaN(Date.parse(`${state.capturedAt}T00:00:00Z`)), false);
  assert.equal(state.purpose, 'informational-release-state');
  assert.equal(state.controlsSafetyValidation, false);

  for (const lane of [state.upstream, state.certified, state.historicalV1]) {
    assert.match(lane.dshPackageVersion, exactSemver);
  }

  assert.equal(state.upstream.status, 'released-not-certified');
  assert.equal(
    state.upstream.sourceTag,
    `dsh-v${state.upstream.dshPackageVersion}`
  );
  assert.match(state.upstream.sourceCommit, /^[a-f0-9]{40}$/);
  assert.equal(state.upstream.npmDistTag, 'next');
  assert.match(state.upstream.npmLatestAtCapture, exactSemver);
  assert.notEqual(
    state.upstream.npmLatestAtCapture,
    state.upstream.dshPackageVersion
  );
  assert.match(state.upstream.npmIntegrity, /^sha512-[A-Za-z0-9+/]+={0,2}$/);
  assert.match(state.upstream.npmShasum, /^[a-f0-9]{40}$/);
  assert.equal(state.upstream.installableCurrent, false);

  assert.equal(state.certified.status, 'certified-installable');
  assert.equal(state.certified.installableCurrent, true);
  assert.equal(
    state.certified.compatibilityReference,
    'skills/dsh-theme-manager/references/compatibility.md'
  );

  assert.equal(state.historicalV1.status, 'historical-v1');
  assert.match(state.historicalV1.sourceCommit, /^[a-f0-9]{40}$/);
  assert.equal(state.historicalV1.installableCurrent, false);

  assert.equal(
    new Set([
      state.upstream.dshPackageVersion,
      state.certified.dshPackageVersion,
      state.historicalV1.dshPackageVersion,
    ]).size,
    3
  );
});

test('release documentation exposes all three lanes from the canonical state', async () => {
  const documents = [
    'README.md',
    'README.zh-CN.md',
    'skills/dsh-theme-finder/SKILL.md',
    'skills/dsh-theme-finder/references/catalog-contract.md',
    'skills/dsh-theme-creator/SKILL.md',
    'skills/dsh-theme-creator/references/authoring-v2.md',
    'skills/dsh-theme-submitter/SKILL.md',
    'skills/dsh-theme-submitter/references/submission-checklist.md',
    'skills/dsh-theme-manager/SKILL.md',
    'skills/dsh-theme-manager/references/compatibility.md',
  ];

  for (const path of documents) {
    const contents = await readFile(new URL(path, root), 'utf8');
    assert.ok(
      contents.includes(state.upstream.dshPackageVersion),
      `${path} must identify the upstream release`
    );
    assert.ok(
      contents.includes(state.certified.dshPackageVersion),
      `${path} must identify the certified release`
    );
    assert.ok(
      contents.includes(state.historicalV1.dshPackageVersion) ||
        contents.includes('rc.5'),
      `${path} must identify the historical V1 lane`
    );
    assert.match(contents, /release-state\.json/);
  }
});

test('informational upstream state cannot change executable rc.6 gates', async () => {
  const operationalFiles = [
    'skills/dsh-theme-creator/scripts/create-manifest.mjs',
    'skills/dsh-theme-submitter/scripts/validate-submission.mjs',
    'skills/dsh-theme-manager/scripts/verify-runner.mjs',
    'skills/dsh-theme-manager/runtime/package.json',
    'skills/dsh-theme-manager/runtime/attestation.json',
    'skills/dsh-theme-manager/runtime/pnpm-lock.yaml',
  ];

  for (const path of operationalFiles) {
    const contents = await readFile(new URL(path, root), 'utf8');
    assert.ok(
      contents.includes(state.certified.dshPackageVersion),
      `${path} must remain pinned to the certified release`
    );
    assert.equal(
      contents.includes(state.upstream.dshPackageVersion),
      false,
      `${path} must not accept the informational upstream release`
    );
    assert.doesNotMatch(contents, /release-state\.json/);
  }
});

test('RC.8 discovery does not open either executable installation lane', async () => {
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

  assert.ok(finder.includes(state.upstream.dshPackageVersion));
  assert.ok(finder.includes(state.certified.dshPackageVersion));
  assert.doesNotMatch(finder, /release-state\.json/);
  assert.match(communityGate, /managerRc8Certified/);
  assert.doesNotMatch(communityGate, /release-state\.json/);
  assert.match(manager, /rejectPendingV3/);
  assert.match(manager, /RC\.8 V3 certification is pending/);
});
