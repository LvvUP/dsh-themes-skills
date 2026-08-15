import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

import sharp from 'sharp';

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
  assert.deepEqual(manifest.licensePolicy, {
    attributionRequired: true,
    commercialUse: 'allowed',
    shareAlikeRequired: false,
    url: 'https://creativecommons.org/licenses/by/4.0/',
  });
  assert.equal(Object.keys(manifest.tokens).length, 13);
  assert.match(manifest.assets[0].sha256, /^[0-9a-f]{64}$/);
  assert.match(manifest.assets[0].path, /^assets\/[0-9a-f]{64}\.webp$/);
  assert.match(manifest.assets[0].url, /^\/api\/theme-studio\/import\/[0-9a-f]{64}\.webp$/);
  assert.deepEqual(manifest.visual.focus, { x: 70, y: 50 });
  assert.equal(manifest.preview.light.source, 'simulated');
});

test('creator records fixed third-party provenance and license restrictions', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-creator-provenance-'));
  const revision = 'cdb4da4f9c708571c6303cc1053185c62c8b617b';
  const input = await writeAuthoring(directory, {
    license: 'CC-BY-NC-SA-4.0',
    licensePolicy: {
      url: 'https://creativecommons.org/licenses/by-nc-sa/4.0/',
      commercialUse: 'prohibited',
      attributionRequired: true,
      shareAlikeRequired: true,
    },
    copyright: {
      source: 'licensed',
      sourceUrl: `https://example.com/source/${revision}`,
      sourceRevision: revision,
      noticeUrl: `https://example.com/source/${revision}/NOTICE`,
      attribution: 'Original Artist; Derivative Artist',
      aiGenerated: false,
    },
  });
  const output = join(directory, 'manifest.json');
  const result = await run(creator, ['--input', input, '--output', output]);
  assert.equal(result.code, 0, result.stderr);
  const manifest = JSON.parse(await readFile(output, 'utf8'));
  assert.equal(manifest.licensePolicy.commercialUse, 'prohibited');
  assert.equal(manifest.copyright.sourceRevision, revision);
  assert.equal(manifest.copyright.noticeUrl, `https://example.com/source/${revision}/NOTICE`);
});

test('creator rejects missing or misleading rights metadata', async (t) => {
  await t.test('missing license policy', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'dsh-creator-license-policy-'));
    const input = await writeAuthoring(directory, { licensePolicy: undefined });
    const result = await run(creator, ['--input', input, '--output', join(directory, 'out.json')]);
    assert.notEqual(result.code, 0);
    assert.match(result.stderr, /licensePolicy must be an object/);
  });

  await t.test('noncommercial license marked commercially allowed', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'dsh-creator-nc-'));
    const input = await writeAuthoring(directory, {
      license: 'CC-BY-NC-SA-4.0',
      licensePolicy: {
        url: 'https://creativecommons.org/licenses/by-nc-sa/4.0/',
        commercialUse: 'allowed', attributionRequired: true, shareAlikeRequired: true,
      },
    });
    const result = await run(creator, ['--input', input, '--output', join(directory, 'out.json')]);
    assert.notEqual(result.code, 0);
    assert.match(result.stderr, /noncommercial license/);
  });

  await t.test('attribution-required licensed art without notice', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'dsh-creator-notice-'));
    const input = await writeAuthoring(directory, {
      copyright: {
        source: 'licensed', sourceUrl: 'https://example.com/source',
        attribution: 'Artist', aiGenerated: false,
      },
    });
    const result = await run(creator, ['--input', input, '--output', join(directory, 'out.json')]);
    assert.notEqual(result.code, 0);
    assert.match(result.stderr, /noticeUrl/);
  });

  await t.test('revision paired with a mutable source URL', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'dsh-creator-revision-'));
    const input = await writeAuthoring(directory, {
      copyright: {
        source: 'licensed', sourceUrl: 'https://example.com/source/main',
        sourceRevision: 'cdb4da4f9c708571c6303cc1053185c62c8b617b',
        noticeUrl: 'https://example.com/source/main/NOTICE',
        attribution: 'Artist', aiGenerated: false,
      },
    });
    const result = await run(creator, ['--input', input, '--output', join(directory, 'out.json')]);
    assert.notEqual(result.code, 0);
    assert.match(result.stderr, /sourceUrl must contain/);
  });
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

test('creator fully decodes bounded, single-page WebP assets', async (t) => {
  await t.test('rejects a corrupt RIFF/WEBP lookalike', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'dsh-creator-corrupt-'));
    const input = await writeAuthoring(directory);
    await writeFile(
      join(directory, 'assets', 'background.webp'),
      Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBPcorrupt')]),
    );
    const result = await run(creator, ['--input', input, '--output', join(directory, 'out.json')]);
    assert.notEqual(result.code, 0);
    assert.match(result.stderr, /decodable WebP|fully decoded/);
  });

  await t.test('rejects animated and multi-page WebP', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'dsh-creator-animated-'));
    const input = await writeAuthoring(directory);
    const red = await sharp({ create: { width: 4, height: 4, channels: 4, background: '#ff0000' } }).png().toBuffer();
    const blue = await sharp({ create: { width: 4, height: 4, channels: 4, background: '#0000ff' } }).png().toBuffer();
    await sharp([red, blue], { join: { animated: true } })
      .webp({ loop: 0, delay: [100, 100] })
      .toFile(join(directory, 'assets', 'background.webp'));
    const result = await run(creator, ['--input', input, '--output', join(directory, 'out.json')]);
    assert.notEqual(result.code, 0);
    assert.match(result.stderr, /Animated or multi-page WebP/);
  });

  await t.test('rejects dimensions copied from declarations instead of decoded pixels', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'dsh-creator-dimensions-'));
    const input = await writeAuthoring(directory);
    const authoring = JSON.parse(await readFile(input, 'utf8'));
    authoring.assets[0].width = 1919;
    await writeFile(input, `${JSON.stringify(authoring, null, 2)}\n`);
    const result = await run(creator, ['--input', input, '--output', join(directory, 'out.json')]);
    assert.notEqual(result.code, 0);
    assert.match(result.stderr, /do not match decoded WebP/);
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
