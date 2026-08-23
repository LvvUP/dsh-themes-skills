import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

import { run } from './helpers.mjs';

const managerValidator = resolve(
  'skills/dsh-theme-manager/scripts/validate-baseline-candidate.mjs'
);
const managerCandidate = resolve(
  'skills/dsh-theme-manager/references/dsh-0.1.1-rc.2.candidate.json'
);

test('RC.2 exact closure is prepared but remains non-installable', async () => {
  const result = await run(managerValidator, ['--input', managerCandidate]);
  assert.equal(result.code, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.deepEqual(
    {
      status: output.status,
      installable: output.installable,
      dshVersion: output.dshVersion,
      completedMatrixJobs: output.completedMatrixJobs,
      requiredMatrixJobs: output.requiredMatrixJobs,
    },
    {
      status: 'certification-pending',
      installable: false,
      dshVersion: '0.1.1-rc.2',
      completedMatrixJobs: 0,
      requiredMatrixJobs: 6,
    }
  );
  assert.equal(output.packages, 505);
  assert.equal(output.dshPackages, 188);
  assert.ok(output.blockers.length > 0);
});
test('RC.2 validator fails closed for malformed or mixed evidence', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-rc2-evidence-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const source = JSON.parse(await readFile(managerCandidate, 'utf8'));

  const malformedPath = join(directory, 'malformed.json');
  await writeFile(
    malformedPath,
    `${JSON.stringify({ ...source, installableCurrent: true })}\n`
  );
  const malformed = await run(managerValidator, ['--input', malformedPath]);
  assert.notEqual(malformed.code, 0);
  assert.match(malformed.stderr, /not the pinned candidate evidence/);

  const mixedPath = join(directory, 'mixed.json');
  source.compatibility.npmArtifacts.webFrontend.version = '0.1.0-rc.8';
  await writeFile(mixedPath, `${JSON.stringify(source)}\n`);
  const mixed = await run(managerValidator, ['--input', mixedPath]);
  assert.notEqual(mixed.code, 0);
  assert.match(mixed.stderr, /not the pinned candidate evidence/);
});

test('all five skills expose the same pending RC.2 boundary', async () => {
  const checks = [
    ['skills/dsh-theme-creator/scripts/inspect-baseline.mjs', ['candidate']],
    ['skills/dsh-theme-submitter/scripts/inspect-baseline.mjs', ['candidate']],
    [
      'skills/dsh-theme-finder/scripts/find-themes.mjs',
      ['--catalog', resolve('README.md'), '--dsh-version', '0.1.1-rc.2'],
    ],
    [
      'skills/dsh-community-skin-installer/scripts/inspect-baseline.mjs',
      ['candidate'],
    ],
  ];
  for (const [script, args] of checks) {
    const result = await run(resolve(script), args);
    assert.equal(result.code, 0, `${script}: ${result.stderr}`);
    const output = JSON.parse(result.stdout);
    assert.equal(output.dshVersion, '0.1.1-rc.2');
    assert.equal(output.status ?? output.baselineStatus, 'certification-pending');
    assert.equal(output.enabled ?? output.installableResultsAllowed, false);
  }
});
