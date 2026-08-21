import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

import { run, writeAuthoring as writeLegacyAuthoring } from './helpers.mjs';

const creator = resolve('skills/dsh-theme-creator/scripts/create-manifest.mjs');
const submitter = resolve('skills/dsh-theme-submitter/scripts/validate-submission.mjs');
const redlineAttribution = 'Clean-room original artwork generated for DSH-Themes; experimental full-skin concept inspired by the general idea of dsh-ui, without copying its code or protected media.';
const certifiedCompatibility = JSON.parse(await readFile(
  resolve('skills/dsh-theme-submitter/references/compatibility-v3.json'),
  'utf8',
));

async function writeAuthoring(directory, overrides = {}) {
  return writeLegacyAuthoring(directory, {
    schemaVersion: '3.0',
    compatibility: { dshPackageVersion: '0.1.0-rc.8' },
    ...overrides,
  });
}

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
  assert.equal(output.dshPackageVersion, '0.1.0-rc.8');
  assert.equal(output.runtimeAttestationSha256, certifiedCompatibility.runtimeAttestationSha256);
  assert.equal(output.runtimeAttestationSha256, '1cd9a0b4a6b9d215f0a1f70a97b4d43eae7bf4f846ae7009b7ddb812823ca0ae');
  assert.equal(/cookie|api.?key|password/i.test(result.stdout), false);
});

test('submitter fails closed on any RC.8 final-evidence drift', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-submit-compatibility-'));
  const input = await writeAuthoring(directory);
  const manifest = join(directory, 'manifest.json');
  assert.equal((await run(creator, ['--input', input, '--output', manifest])).code, 0);
  const original = JSON.parse(await readFile(manifest, 'utf8'));

  const cases = [
    ['runtime attestation', (value) => { value.compatibility.runtimeAttestationSha256 = '2'.repeat(64); }],
    ['nested npm digest', (value) => { value.compatibility.npmArtifacts.uiTheme.shasum = '3'.repeat(40); }],
    ['extra candidate field', (value) => { value.compatibility.certificationStatus = 'pending'; }],
    ['mixed RC.7 version', (value) => { value.compatibility.dshPackageVersion = '0.1.0-rc.7'; }],
  ];

  for (const [label, mutate] of cases) {
    await t.test(label, async () => {
      const value = structuredClone(original);
      mutate(value);
      const altered = join(directory, `${label.replaceAll(' ', '-')}.json`);
      await writeFile(altered, JSON.stringify(value));
      const result = await run(submitter, [
        '--manifest', altered,
        '--site', 'https://themes.example',
      ]);
      assert.notEqual(result.code, 0);
      assert.match(result.stderr, /exactly match the certified RC\.8 V3 final evidence/);
    });
  }
});

test('submitter treats RC.6 V2 as historical non-input', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-submit-rc6-v2-'));
  const input = await writeAuthoring(directory);
  const manifest = join(directory, 'manifest.json');
  assert.equal((await run(creator, ['--input', input, '--output', manifest])).code, 0);
  const value = JSON.parse(await readFile(manifest, 'utf8'));
  value.schemaVersion = '2.0';
  value.compatibility = {
    dshPackageVersion: '0.1.0-rc.6',
    dshPackageIntegrity: 'sha512-brpZfED7ieRa2PQ5tUxMhHrM1pb2CmKFVM/f6yMULBDMicahk+Z2OsHgTwTDnoiZm23Ftu9rQz0NN4pflaoJcg==',
    tokenCatalogSha256: 'fe38fdb18dae76f3cc93e3ca3a37bb1916f207180781b1aa8321ee2ddadcb926',
    frontendBundleSha256: 'a40165a9916acf9c5710e440842c9a56bc472ae9991f37f4675a7664ae784d68',
    selectorCatalogSha256: '5bcd9f874095af2114d86f91301868c6b0f2cebe58f51b9919150975d406baa3',
  };
  await writeFile(manifest, JSON.stringify(value));
  const result = await run(submitter, ['--manifest', manifest, '--site', 'https://themes.example']);
  assert.notEqual(result.code, 0);
  assert.match(result.stderr, /schemaVersion must equal 3\.0/);
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
      attribution: redlineAttribution, aiGenerated: false,
    },
  });
  const manifest = join(directory, 'manifest.json');
  assert.equal((await run(creator, ['--input', input, '--output', manifest])).code, 0);
  const result = await run(submitter, ['--manifest', manifest, '--site', 'https://themes.example']);
  assert.equal(result.code, 0, result.stderr);
  assert.equal(redlineAttribution.length, 169);
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

  altered.copyright.attribution = 'a'.repeat(257);
  const oversizedAttribution = join(directory, 'oversized-attribution.json');
  await writeFile(oversizedAttribution, JSON.stringify(altered));
  const oversizedResult = await run(submitter, ['--manifest', oversizedAttribution, '--site', 'https://themes.example']);
  assert.notEqual(oversizedResult.code, 0);
  assert.match(oversizedResult.stderr, /copyright\.attribution is invalid/);

  altered.copyright.attribution = redlineAttribution;
  altered.copyright.noticeUrl = `https://example.com/source/${revision}/LICENSE`;
  const licenseAsNotice = join(directory, 'license-as-notice.json');
  await writeFile(licenseAsNotice, JSON.stringify(altered));
  const noticeResult = await run(submitter, [
    '--manifest', licenseAsNotice, '--site', 'https://themes.example',
  ]);
  assert.notEqual(noticeResult.code, 0);
  assert.match(noticeResult.stderr, /actual NOTICE, not a LICENSE/);
});

test('submitter rejects code, dependencies, publication metadata, and secret-like fields', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-submit-secret-'));
  const input = await writeAuthoring(directory);
  const manifest = join(directory, 'manifest.json');
  assert.equal((await run(creator, ['--input', input, '--output', manifest])).code, 0);
  const original = JSON.parse(await readFile(manifest, 'utf8'));
  const cases = [
    ['apiKey', 'not-a-real-key'],
    ['artifact', { sha256: '1'.repeat(64) }],
    ['payload', { sha256: '2'.repeat(64) }],
    ['css', 'body { display: none }'],
    ['html', '<script>ignored</script>'],
    ['dependencies', { package: 'latest' }],
  ];
  for (const [field, injected] of cases) {
    await t.test(field, async () => {
      const value = structuredClone(original);
      value[field] = injected;
      const altered = join(directory, `${field}.json`);
      await writeFile(altered, JSON.stringify(value));
      const result = await run(submitter, ['--manifest', altered, '--site', 'http://localhost:3000']);
      assert.notEqual(result.code, 0);
      assert.match(result.stderr, /Forbidden publisher, executable, or secret-like field/);
    });
  }
});

test('submitter rejects remote full-skin runtime assets', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-submit-remote-'));
  const input = await writeAuthoring(directory);
  const manifest = join(directory, 'manifest.json');
  assert.equal((await run(creator, ['--input', input, '--output', manifest])).code, 0);
  const value = JSON.parse(await readFile(manifest, 'utf8'));
  value.assets[0].url = 'https://assets.example/background.webp';
  await writeFile(manifest, JSON.stringify(value));
  const result = await run(submitter, ['--manifest', manifest, '--site', 'https://themes.example']);
  assert.notEqual(result.code, 0);
  assert.match(result.stderr, /reviewed same-origin URL/);
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
