import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

import { run } from './helpers.mjs';

const finder = resolve('skills/dsh-theme-finder/scripts/find-themes.mjs');
const tokenHash = 'fe38fdb18dae76f3cc93e3ca3a37bb1916f207180781b1aa8321ee2ddadcb926';
const selectorHash = '4c04e9fcff6caccd4c76ebc23a4442d4d1443356d9750f7135506d788a3ec7c7';
const dshIntegrity = 'sha512-brpZfED7ieRa2PQ5tUxMhHrM1pb2CmKFVM/f6yMULBDMicahk+Z2OsHgTwTDnoiZm23Ftu9rQz0NN4pflaoJcg==';
const frontendSha256 = 'a40165a9916acf9c5710e440842c9a56bc472ae9991f37f4675a7664ae784d68';

function item(overrides = {}) {
  const sha256 = 'a'.repeat(64);
  return {
    slug: 'ocean-workbench', kind: 'full-skin', name: 'Ocean Workbench', description: 'Blue ocean workbench',
    status: 'published', verified: true, modes: ['light', 'dark'], author: { name: 'Author' }, license: 'CC-BY-4.0', version: '1.0.0',
    compatibility: {
      schemaVersion: 2, dshPackageVersion: '0.1.0-rc.6', dshPackageIntegrity: dshIntegrity,
      frontendBundleSha256: frontendSha256, tokenCatalogSha256: tokenHash, selectorCatalogSha256: selectorHash,
    },
    package: { fileName: 'ocean-workbench-1.0.0.tgz', url: 'https://example.com/ocean.tgz', sha256, integrity: `sha256-${Buffer.from(sha256, 'hex').toString('base64')}` },
    ...overrides,
  };
}

test('finder returns only published verified exact rc.6 releases', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-finder-'));
  const catalog = join(directory, 'catalog.json');
  await writeFile(catalog, JSON.stringify({ items: [
    item(),
    item({ slug: 'draft', name: 'Draft', status: 'draft', package: { ...item().package, fileName: 'draft-1.0.0.tgz' } }),
    item({ slug: 'old', name: 'Old', compatibility: { ...item().compatibility, dshPackageVersion: '0.1.0-rc.5' }, package: { ...item().package, fileName: 'old-1.0.0.tgz' } }),
    item({ slug: 'bad-hash', name: 'Bad', package: { ...item().package, fileName: 'bad-hash-1.0.0.tgz', sha256: 'bad' } }),
  ] }));
  const result = await run(finder, ['--catalog', catalog, '--query', 'ocean', '--mode', 'dark']);
  assert.equal(result.code, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.count, 1);
  assert.equal(output.items[0].slug, 'ocean-workbench');
  assert.equal(output.items[0].compatibility.dshPackageVersion, '0.1.0-rc.6');
});
