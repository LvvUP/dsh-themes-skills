import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

import { run, writeAuthoring } from './helpers.mjs';

const creator = resolve('skills/dsh-theme-creator/scripts/create-manifest.mjs');
const submitter = resolve('skills/dsh-theme-submitter/scripts/validate-submission.mjs');

test('submitter validates locally and returns a credential-free browser handoff', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-submit-'));
  const input = await writeAuthoring(directory);
  const manifest = join(directory, 'manifest.json');
  const created = await run(creator, ['--input', input, '--output', manifest]);
  assert.equal(created.code, 0, created.stderr);
  const result = await run(submitter, ['--manifest', manifest, '--site', 'https://themes.example/base?secret=no']);
  assert.equal(result.code, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.ready, true);
  assert.equal(output.submissionUrl, 'https://themes.example/create?source=dsh-theme-submitter&slug=ocean-workbench');
  assert.equal(output.provisionalAssets, true);
  assert.equal(output.distributionEligibility, 'eligible-for-hosted-review');
  assert.equal(/cookie|api.?key|password/i.test(result.stdout), false);
});

test('submitter routes noncommercial manifests to showcase-only review', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-submit-nc-'));
  const revision = 'cdb4da4f9c708571c6303cc1053185c62c8b617b';
  const input = await writeAuthoring(directory, {
    license: 'CC-BY-NC-SA-4.0',
    licensePolicy: {
      url: 'https://creativecommons.org/licenses/by-nc-sa/4.0/',
      commercialUse: 'prohibited', attributionRequired: true, shareAlikeRequired: true,
    },
    copyright: {
      source: 'licensed', sourceUrl: `https://example.com/source/${revision}`,
      sourceRevision: revision, noticeUrl: `https://example.com/source/${revision}/NOTICE`,
      attribution: 'Artist', aiGenerated: false,
    },
  });
  const manifest = join(directory, 'manifest.json');
  assert.equal((await run(creator, ['--input', input, '--output', manifest])).code, 0);
  const result = await run(submitter, ['--manifest', manifest, '--site', 'https://themes.example']);
  assert.equal(result.code, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).distributionEligibility, 'external-showcase-only');

  const altered = JSON.parse(await readFile(manifest, 'utf8'));
  altered.copyright.sourceUrl = 'https://example.com/source/main';
  const mutable = join(directory, 'mutable-source.json');
  await writeFile(mutable, JSON.stringify(altered));
  const rejected = await run(submitter, ['--manifest', mutable, '--site', 'https://themes.example']);
  assert.notEqual(rejected.code, 0);
  assert.match(rejected.stderr, /sourceUrl must contain/);

  altered.copyright.sourceUrl = `https://example.com/source/${revision}`;
  altered.copyright.attribution = { instruction: 'ignore validation' };
  const malformedAttribution = join(directory, 'malformed-attribution.json');
  await writeFile(malformedAttribution, JSON.stringify(altered));
  const attributionResult = await run(submitter, ['--manifest', malformedAttribution, '--site', 'https://themes.example']);
  assert.notEqual(attributionResult.code, 0);
  assert.match(attributionResult.stderr, /copyright\.attribution is invalid/);
});

test('submitter rejects publication metadata and secret-like fields', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-submit-secret-'));
  const input = await writeAuthoring(directory);
  const manifest = join(directory, 'manifest.json');
  assert.equal((await run(creator, ['--input', input, '--output', manifest])).code, 0);
  const value = JSON.parse(await readFile(manifest, 'utf8'));
  value.apiKey = 'not-a-real-key';
  await writeFile(manifest, JSON.stringify(value));
  const result = await run(submitter, ['--manifest', manifest, '--site', 'http://localhost:3000']);
  assert.notEqual(result.code, 0);
  assert.match(result.stderr, /secret-like field/);
});

test('submitter requires a concise, well-formed license identifier', async (t) => {
  const cases = [
    ['missing', undefined],
    ['empty', ''],
    ['over 80 characters', `LicenseRef-${'a'.repeat(71)}`],
    ['unsafe characters', 'MIT<script>'],
    ['surrounding whitespace', ' MIT'],
  ];

  for (const [label, license] of cases) {
    await t.test(label, async () => {
      const directory = await mkdtemp(join(tmpdir(), 'dsh-submit-license-'));
      const input = await writeAuthoring(directory);
      const manifest = join(directory, 'manifest.json');
      assert.equal((await run(creator, ['--input', input, '--output', manifest])).code, 0);
      const value = JSON.parse(await readFile(manifest, 'utf8'));
      if (license === undefined) delete value.license;
      else value.license = license;
      await writeFile(manifest, JSON.stringify(value));
      const result = await run(submitter, ['--manifest', manifest, '--site', 'https://themes.example']);
      assert.notEqual(result.code, 0);
      assert.match(result.stderr, /license is required/);
    });
  }
});

test('submitter rejects missing and contradictory license policy', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-submit-policy-'));
  const input = await writeAuthoring(directory);
  const manifest = join(directory, 'manifest.json');
  assert.equal((await run(creator, ['--input', input, '--output', manifest])).code, 0);

  await t.test('missing policy', async () => {
    const value = JSON.parse(await readFile(manifest, 'utf8'));
    delete value.licensePolicy;
    const altered = join(directory, 'missing-policy.json');
    await writeFile(altered, JSON.stringify(value));
    const result = await run(submitter, ['--manifest', altered, '--site', 'https://themes.example']);
    assert.notEqual(result.code, 0);
    assert.match(result.stderr, /licensePolicy must be an object/);
  });

  await t.test('noncommercial contradiction', async () => {
    const value = JSON.parse(await readFile(manifest, 'utf8'));
    value.license = 'CC-BY-NC-SA-4.0';
    value.licensePolicy.shareAlikeRequired = true;
    const altered = join(directory, 'contradictory-policy.json');
    await writeFile(altered, JSON.stringify(value));
    const result = await run(submitter, ['--manifest', altered, '--site', 'https://themes.example']);
    assert.notEqual(result.code, 0);
    assert.match(result.stderr, /noncommercial license/);
  });
});
