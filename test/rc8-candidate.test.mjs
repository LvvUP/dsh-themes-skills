import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

import { run } from './helpers.mjs';

const validator = resolve(
  'skills/dsh-theme-manager/scripts/validate-rc8-candidate.mjs'
);
const releaseValidator = resolve(
  'skills/dsh-theme-manager/scripts/validate-release.mjs'
);
const candidate = resolve(
  'skills/dsh-theme-manager/references/rc8-v3-candidate.json'
);

test('RC.8 candidate validator reports evidence without granting installation', async () => {
  const result = await run(validator, ['--input', candidate]);
  assert.equal(result.code, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.status, 'candidate-evidence-validated-not-installable');
  assert.equal(output.dshPackageVersion, '0.1.0-rc.8');
  assert.equal(output.certificationStatus, 'pending');
  assert.ok(output.blockers.length > 0);
});

test('Manager still rejects the historical incomplete V3 candidate shape', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-rc8-manager-pending-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const input = join(directory, 'release.json');
  await writeFile(
    input,
    `${JSON.stringify({
      manifest: {
        schemaVersion: '3.0',
        compatibility: { dshPackageVersion: '0.1.0-rc.8' },
      },
    })}\n`
  );
  const result = await run(releaseValidator, [
    '--input',
    input,
    '--origin',
    'https://dsh-themes.com',
  ]);
  assert.notEqual(result.code, 0);
  assert.match(
    result.stderr,
    /verified (?:must be true|does not match the certified baseline)/
  );
});

test('RC.8 candidate authority keeps selector and runtime hashes explicitly null', async () => {
  const value = JSON.parse(await readFile(candidate, 'utf8'));
  assert.equal(value.certificationStatus, 'pending');
  assert.equal(value.selectorCatalogSha256, null);
  assert.equal(value.runtimeAttestationSha256, null);
  assert.equal(value.acceptance.status, 'pending');
  assert.deepEqual(value.releaseGate, {
    certifiedDshPackageVersion: '0.1.0-rc.6',
    upstreamTargetDshPackageVersion: '0.1.0-rc.8',
    targetCertificationStatus: 'pending',
    targetInstallable: false,
  });
  const validatorSource = await readFile(validator, 'utf8');
  assert.doesNotMatch(validatorSource, /release-state\.json/);
});
