import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';

const selectors = [
  'html',
  'body',
  '#root',
  'body[data-ds-dark-theme]',
  "[data-slot='root']",
  "[data-slot='root'] > div",
  "[data-slot='sidebar']",
  "[data-slot='sidebar'] > div",
  "[data-slot='conversation']",
  "[data-slot='conversation'] > div",
  "[data-slot='conversation.session']",
  "[data-slot='conversation.composer']",
  "[data-composer-card='true']",
  "[data-slot='details']",
  "[data-shell-overlay='true']",
];
const current = '5bcd9f874095af2114d86f91301868c6b0f2cebe58f51b9919150975d406baa3';
const superseded = [
  'e544ff5a3f7edacced0c5c9ed8fd26cb598b3d01d1298b10952a64876beaf7fd',
  '4c04e9fcff6caccd4c76ebc23a4442d4d1443356d9750f7135506d788a3ec7c7',
];

test('rc.6 selector catalog hash matches the canonical newline list', () => {
  const canonical = `${selectors.join('\n')}\n`;
  assert.equal(createHash('sha256').update(canonical).digest('hex'), current);
});

test('all public compatibility consumers use the current selector fingerprint', async () => {
  const files = [
    'skills/dsh-theme-creator/scripts/create-manifest.mjs',
    'skills/dsh-theme-creator/references/authoring-v2.md',
    'skills/dsh-theme-finder/scripts/find-themes.mjs',
    'skills/dsh-theme-finder/references/catalog-contract.md',
    'skills/dsh-theme-manager/references/compatibility.md',
    'skills/dsh-theme-submitter/scripts/validate-submission.mjs',
  ];
  for (const file of files) {
    const source = await readFile(resolve(file), 'utf8');
    assert.equal(source.includes(current), true, `${file} lacks the current fingerprint`);
    for (const fingerprint of superseded) {
      assert.equal(source.includes(fingerprint), false, `${file} still contains a superseded fingerprint`);
    }
  }
});
