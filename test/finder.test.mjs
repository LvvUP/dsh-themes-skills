import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

import { isExactSemver as isFinderSemver } from '../skills/dsh-theme-finder/scripts/semver.mjs';
import { isExactSemver as isManagerSemver } from '../skills/dsh-theme-manager/scripts/semver.mjs';
import { run } from './helpers.mjs';

const finder = resolve('skills/dsh-theme-finder/scripts/find-themes.mjs');
const tokenHash = 'fe38fdb18dae76f3cc93e3ca3a37bb1916f207180781b1aa8321ee2ddadcb926';
const selectorHash = '5bcd9f874095af2114d86f91301868c6b0f2cebe58f51b9919150975d406baa3';
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

function itemAtVersion(version) {
  return item({
    version,
    package: {
      ...item().package,
      fileName: `ocean-workbench-${version}.tgz`,
    },
  });
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

test('finder and manager enforce the same SemVer 2.0 vectors', async () => {
  const vectors = JSON.parse(await readFile(resolve('test/fixtures/semver-vectors.json'), 'utf8'));
  for (const version of vectors.valid) {
    assert.equal(isFinderSemver(version), true, `finder rejected valid SemVer: ${version}`);
    assert.equal(isManagerSemver(version), true, `manager rejected valid SemVer: ${version}`);
  }
  for (const version of vectors.invalid) {
    assert.equal(isFinderSemver(version), false, `finder accepted invalid SemVer: ${version}`);
    assert.equal(isManagerSemver(version), false, `manager accepted invalid SemVer: ${version}`);
  }
});

test('finder accepts prerelease and build metadata but never verifies empty identifiers', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-finder-semver-'));

  await t.test('accepts a valid prerelease with build metadata', async () => {
    const version = '1.2.3-alpha.1+verified.2';
    const catalog = join(directory, 'valid.json');
    await writeFile(catalog, JSON.stringify({ items: [itemAtVersion(version)] }));
    const result = await run(finder, ['--catalog', catalog]);
    assert.equal(result.code, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout).items.map((entry) => entry.version), [version]);
  });

  for (const version of ['1.2.3-alpha..1', '1.2.3-..', '1.2.3+build..1']) {
    await t.test(`rejects ${version}`, async () => {
      const catalog = join(directory, `${Buffer.from(version).toString('hex')}.json`);
      await writeFile(catalog, JSON.stringify({ items: [itemAtVersion(version)] }));
      const result = await run(finder, ['--catalog', catalog]);
      assert.equal(result.code, 0, result.stderr);
      assert.equal(JSON.parse(result.stdout).count, 0);
    });
  }
});
