import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

import { runFinder } from '../skills/dsh-theme-finder/scripts/find-themes.mjs';
import { validatePromotedRuntimeBaseline } from '../skills/dsh-theme-manager/scripts/validate-promoted-rc2-runtime-baseline.mjs';
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

test('all five skills preserve the immutable historical candidate lane', async () => {
  const checks = [
    {
      skill: 'dsh-theme-manager',
      pathField: 'sidecarPath',
      hashField: 'sidecarSha256',
      expectedHash:
        '9ec94c95dc8d6e4fe1aa7bab00de59d8c7fcb414c7342694a5cde20efd9d5888',
    },
    ...[
      'dsh-theme-finder',
      'dsh-theme-creator',
      'dsh-theme-submitter',
      'dsh-community-skin-installer',
    ].map((skill) => ({
      skill,
      pathField: 'evidencePath',
      hashField: 'evidenceSha256',
      expectedHash:
        '1765db29cc9b0d9b49a848d8e4edb90e93e32749edd4443e6b64eb8753372075',
    })),
  ];
  for (const check of checks) {
    const skillRoot = resolve('skills', check.skill);
    const policy = JSON.parse(
      await readFile(resolve(skillRoot, 'references/baseline-policy.json'), 'utf8')
    );
    const candidate = policy.candidate;
    const candidatePath =
      check.skill === 'dsh-theme-manager'
        ? resolve(skillRoot, candidate[check.pathField])
        : resolve(
            skillRoot,
            'references',
            candidate[check.pathField]
          );
    const bytes = await readFile(candidatePath);
    const actualHash = createHash('sha256').update(bytes).digest('hex');

    assert.equal(candidate.status, 'certification-pending', check.skill);
    assert.equal(candidate.historicalAtCapture, true, check.skill);
    assert.notEqual(candidate.installable, true, check.skill);
    assert.notEqual(candidate.enabled, true, check.skill);
    assert.equal(candidate[check.hashField], check.expectedHash, check.skill);
    assert.equal(actualHash, check.expectedHash, check.skill);
  }
});

test('all five skills expose one certified runtime baseline without item authority', async () => {
  const skillNames = [
    'dsh-theme-manager',
    'dsh-theme-finder',
    'dsh-theme-creator',
    'dsh-theme-submitter',
    'dsh-community-skin-installer',
  ];
  const projectionBytes = await Promise.all(
    skillNames.map((skill) =>
      readFile(
        resolve(
          'skills',
          skill,
          'references/runtime-baseline.dsh-0.1.1-rc.2.json'
        )
      )
    )
  );
  for (const [index, bytes] of projectionBytes.entries()) {
    assert.ok(bytes.equals(projectionBytes[0]), skillNames[index]);
    assert.equal(
      createHash('sha256').update(bytes).digest('hex'),
      '450fcefc76026a312def640c6cac5dedf8386469860f4be883050a6c5fa283dc',
      skillNames[index]
    );
  }

  const promoted = await validatePromotedRuntimeBaseline();
  assert.equal(promoted.status, 'baseline-certified');
  assert.equal(promoted.productionReady, true);
  assert.equal(promoted.installableItems, false);
  assert.equal(promoted.itemInstallability, 'separate-authority-required');

  let catalogReads = 0;
  const finder = await runFinder(
    [
      '--catalog',
      resolve('README.md'),
      '--dsh-version',
      '0.1.1-rc.2',
    ],
    {
      fetchImpl: async () => {
        catalogReads += 1;
        throw new Error('RC.2 runtime-only lane must not fetch a catalog');
      },
    }
  );
  assert.equal(catalogReads, 0);
  assert.equal(finder.baselineStatus, 'baseline-certified');
  assert.equal(finder.certificationStatus, 'verified-runtime-baseline');
  assert.equal(finder.catalogRead, false);
  assert.equal(finder.installableResultsAllowed, false);
  assert.equal(finder.count, 0);
  assert.deepEqual(finder.items, []);

  const inspectChecks = [
    {
      script: 'skills/dsh-theme-creator/scripts/inspect-baseline.mjs',
      disabledField: 'authoringEnabled',
    },
    {
      script: 'skills/dsh-theme-submitter/scripts/inspect-baseline.mjs',
      disabledField: 'submissionEnabled',
    },
    {
      script:
        'skills/dsh-community-skin-installer/scripts/inspect-baseline.mjs',
      disabledField: null,
    },
  ];
  for (const check of inspectChecks) {
    const result = await run(resolve(check.script), ['certifiedRuntimeBaseline']);
    assert.equal(result.code, 0, `${check.script}: ${result.stderr}`);
    const output = JSON.parse(result.stdout);
    assert.equal(output.dshVersion, '0.1.1-rc.2');
    assert.equal(output.status, 'baseline-certified');
    assert.equal(output.enabled, false);
    assert.equal(output.productionReady, true);
    assert.equal(output.installableItems, false);
    if (check.disabledField) {
      assert.equal(output[check.disabledField], false);
    } else {
      assert.equal(output.itemsPlanned, 11);
      assert.equal(output.itemsVerified, 0);
      assert.equal(output.installableRecords, 0);
    }
  }
});
