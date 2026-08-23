import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';

const rc8Selectors = [
  'html',
  'body',
  'body[data-ds-dark-theme]',
  '#root',
  "[data-slot='root'] > div",
  "[data-slot='conversation'] > div",
  "body[data-ds-dark-theme] [data-slot='conversation'] > div",
  "[data-slot='sidebar'] > div",
  "body[data-ds-dark-theme] [data-slot='sidebar'] > div",
  "[data-composer-card='true']",
  "[data-slot='details']",
  "body[data-ds-dark-theme] [data-composer-card='true']",
  "body[data-ds-dark-theme] [data-slot='details']",
];
const rc8 = '663aa5927591ac99076f924ee9cd6f9bd09e6a8a9ee1e6b8b1b0d9e3093df807';
const rc6 = '5bcd9f874095af2114d86f91301868c6b0f2cebe58f51b9919150975d406baa3';

test('RC.8 selector catalog hash matches the certified declared-order list', () => {
  const canonical = `${rc8Selectors.join('\n')}\n`;
  assert.equal(createHash('sha256').update(canonical).digest('hex'), rc8);
});

test('current V3 authorities use RC.8 while RC.6 stays explicitly historical', async () => {
  const creator = JSON.parse(
    await readFile(
      resolve('skills/dsh-theme-creator/references/compatibility-v3.json'),
      'utf8'
    )
  );
  const submitter = JSON.parse(
    await readFile(
      resolve('skills/dsh-theme-submitter/references/compatibility-v3.json'),
      'utf8'
    )
  );
  const attestation = JSON.parse(
    await readFile(
      resolve('skills/dsh-theme-manager/runtime-rc8/attestation.json'),
      'utf8'
    )
  );
  assert.deepEqual(creator, submitter);
  assert.equal(creator.dshPackageVersion, '0.1.0-rc.8');
  assert.equal(creator.selectorCatalogSha256, rc8);
  assert.equal(attestation.compatibility.selectorCatalogSha256, rc8);

  const historicalAttestation = JSON.parse(
    await readFile(
      resolve('skills/dsh-theme-manager/runtime/attestation.json'),
      'utf8'
    )
  );
  assert.equal(historicalAttestation.baseline, '@deepseek-ai/dsh@0.1.0-rc.6');
  const historicalAuthoring = await readFile(
    resolve('skills/dsh-theme-creator/references/authoring-v2.md'),
    'utf8'
  );
  assert.equal(historicalAuthoring.includes(rc6), true);
});

test('operational V3 consumers reject the historical RC.6 selector fingerprint', async () => {
  const files = [
    'skills/dsh-theme-finder/references/baseline-policy.json',
    'skills/dsh-theme-finder/references/catalog-contract.md',
    'skills/dsh-theme-creator/references/compatibility-v3.json',
    'skills/dsh-theme-submitter/references/compatibility-v3.json',
  ];
  for (const file of files) {
    const source = await readFile(resolve(file), 'utf8');
    assert.equal(source.includes(rc8), true, `${file} lacks RC.8 selector authority`);
    assert.equal(source.includes(rc6), false, `${file} mixes historical RC.6 authority`);
  }

  const historical = await readFile(
    resolve('skills/dsh-theme-creator/references/authoring-v2.md'),
    'utf8'
  );
  assert.equal(historical.includes(rc6), true);

  const manager = await readFile(
    resolve('skills/dsh-theme-manager/scripts/validate-release.mjs'),
    'utf8'
  );
  assert.equal(manager.includes(rc6), true);
  assert.match(manager, /HISTORICAL_V2/);

  const currentAttestation = await readFile(
    resolve('skills/dsh-theme-manager/runtime-rc8/attestation.json'),
    'utf8'
  );
  assert.equal(currentAttestation.includes(rc8), true);
  assert.equal(currentAttestation.includes(rc6), false);
});
