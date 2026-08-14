import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

import { run, tokens, writeAuthoring } from './helpers.mjs';

const creator = resolve('skills/dsh-theme-creator/scripts/create-manifest.mjs');
const hasher = resolve('skills/dsh-theme-creator/scripts/hash-file.mjs');

test('schema generator is deterministic and pins rc.6', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-creator-'));
  const input = await writeAuthoring(directory);
  const first = join(directory, 'first.json');
  const second = join(directory, 'second.json');
  const one = await run(creator, ['--input', input, '--output', first]);
  const two = await run(creator, ['--input', input, '--output', second]);
  assert.equal(one.code, 0, one.stderr);
  assert.equal(two.code, 0, two.stderr);
  assert.deepEqual(await readFile(first), await readFile(second));
  const manifest = JSON.parse(await readFile(first, 'utf8'));
  assert.equal(manifest.compatibility.dshPackageVersion, '0.1.0-rc.6');
  assert.equal(manifest.compatibility.tokenCatalogSha256, 'fe38fdb18dae76f3cc93e3ca3a37bb1916f207180781b1aa8321ee2ddadcb926');
  assert.equal(Object.keys(manifest.tokens).length, 13);
  assert.match(manifest.assets[0].sha256, /^[0-9a-f]{64}$/);
  assert.match(manifest.assets[0].path, /^assets\/[0-9a-f]{64}\.webp$/);
  assert.match(manifest.assets[0].url, /^\/api\/theme-studio\/import\/[0-9a-f]{64}\.webp$/);
  assert.deepEqual(manifest.visual.focus, { x: 70, y: 50 });
  assert.equal(manifest.preview.light.source, 'simulated');
});

test('schema rejects missing tokens, dangerous CSS, and incompatible DSH', async (t) => {
  await t.test('missing token', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'dsh-schema-missing-'));
    const incomplete = tokens();
    delete incomplete['--dsw-alias-bg-base'];
    const input = await writeAuthoring(directory, { tokens: incomplete });
    const result = await run(creator, ['--input', input, '--output', join(directory, 'out.json')]);
    assert.notEqual(result.code, 0);
    assert.match(result.stderr, /13-token catalog/);
  });
  await t.test('dangerous color', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'dsh-schema-css-'));
    const unsafe = tokens();
    unsafe['--dsw-alias-bg-base'].light = 'url(https://evil.example/a)';
    const input = await writeAuthoring(directory, { tokens: unsafe });
    const result = await run(creator, ['--input', input, '--output', join(directory, 'out.json')]);
    assert.notEqual(result.code, 0);
    assert.match(result.stderr, /hexadecimal colors/);
  });
  await t.test('rc.5', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'dsh-schema-rc5-'));
    const input = await writeAuthoring(directory, { compatibility: { dshPackageVersion: '0.1.0-rc.5' } });
    const result = await run(creator, ['--input', input, '--output', join(directory, 'out.json')]);
    assert.notEqual(result.code, 0);
    assert.match(result.stderr, /rc\.6/);
  });
});

test('package hashing returns SHA-256 and SRI for exact bytes', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-hash-'));
  const artifact = join(directory, 'theme.tgz');
  const bytes = Buffer.from('deterministic package bytes');
  await writeFile(artifact, bytes);
  const result = await run(hasher, ['--input', artifact]);
  assert.equal(result.code, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  const digest = createHash('sha256').update(bytes).digest();
  assert.equal(output.sha256, digest.toString('hex'));
  assert.equal(output.integrity, `sha256-${digest.toString('base64')}`);
});
