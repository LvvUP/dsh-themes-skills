import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { run, tokens } from './helpers.mjs';

const creator = resolve('skills/dsh-theme-creator/scripts/create-manifest.mjs');
const submitter = resolve('skills/dsh-theme-submitter/scripts/validate-submission.mjs');
const alpha = '0.1.3-alpha.1';
const historical = '0.1.0-rc.8';
const authoring = version => ({ schemaVersion: '3.0', kind: 'theme', slug: 'alpha-fixture', name: 'Alpha fixture', description: 'Synthetic palette for contract verification.', version: '1.0.0', license: 'MIT', licensePolicy: { url: 'https://opensource.org/license/mit', commercialUse: 'allowed', attributionRequired: true, shareAlikeRequired: false }, author: { name: 'Fixture author' }, compatibility: { dshPackageVersion: version }, tokens: tokens(), preview: { light: '/imgs/fixture-light.webp', dark: '/imgs/fixture-dark.webp' } });

test('default Alpha palette round trip matches all 54 hosted compatibility declarations without npm evidence', async t => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-alpha-authoring-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const input = join(root, 'authoring.json'), output = join(root, 'manifest.json');
  await writeFile(input, JSON.stringify(authoring(alpha)));
  const created = await run(creator, ['--input', input, '--output', output]);
  assert.equal(created.code, 0, created.stderr);
  const manifest = JSON.parse(await readFile(output));
  const hosted = JSON.parse(await readFile('skills/dsh-theme-manager/references/alpha-hosted-artifacts.json'));
  assert.equal(hosted.entries.length, 54);
  for (const entry of hosted.entries) assert.deepEqual(manifest.compatibility, entry.releaseRecord.manifest.compatibility);
  assert.equal(manifest.compatibility.npmArtifacts, null);
  assert.equal(manifest.compatibility.officialRelease.sourceCommit, 'd347e703908d0406b7a7ef80e3a0e594d86b2215');
  const submitted = await run(submitter, ['--manifest', output, '--site', 'https://dsh-themes.com']);
  assert.equal(submitted.code, 0, submitted.stderr);
  assert.equal(JSON.parse(submitted.stdout).ready, true);
  assert.equal(JSON.parse(submitted.stdout).draft, true);
  assert.equal(JSON.parse(submitted.stdout).submissionUrl, 'https://dsh-themes.com/submit?source=dsh-theme-submitter&slug=alpha-fixture');
});

test('RC.8 needs an explicit historical choice and cannot produce a current website handoff', async t => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-historical-authoring-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const input = join(root, 'authoring.json'), output = join(root, 'manifest.json');
  await writeFile(input, JSON.stringify(authoring(historical)));
  assert.notEqual((await run(creator, ['--input', input, '--output', output])).code, 0);
  const created = await run(creator, ['--input', input, '--output', output, '--baseline', 'historical-rc8']);
  assert.equal(created.code, 0, created.stderr);
  assert.deepEqual(JSON.parse(await readFile(output)).compatibility, JSON.parse(await readFile('skills/dsh-theme-creator/references/compatibility-v3.json')));
  assert.notEqual((await run(submitter, ['--manifest', output, '--site', 'https://dsh-themes.com'])).code, 0);
  const inspected = await run(submitter, ['--manifest', output, '--site', 'https://dsh-themes.com', '--baseline', 'historical-rc8']);
  assert.equal(inspected.code, 0, inspected.stderr);
  const result = JSON.parse(inspected.stdout);
  assert.equal(result.ready, false);
  assert.equal(result.historical, true);
  assert.equal(Object.hasOwn(result, 'submissionUrl'), false);
});

test('both local Alpha sidecars fail closed when their reviewed bytes change', async t => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-sidecar-drift-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'skills'));
  await symlink(resolve('skills/dsh-theme-manager'), join(root, 'skills/dsh-theme-manager'), process.platform === 'win32' ? 'junction' : 'dir');
  for (const skill of ['dsh-theme-creator', 'dsh-theme-submitter']) {
    const dir = join(root, 'skills', skill);
    await mkdir(join(dir, 'scripts'), { recursive: true });
    await mkdir(join(dir, 'references'));
    await writeFile(join(dir, 'scripts/inspect-baseline.mjs'), await readFile(`skills/${skill}/scripts/inspect-baseline.mjs`));
    const bytes = await readFile(`skills/${skill}/references/compatibility-alpha.json`);
    await writeFile(join(dir, 'references/compatibility-alpha.json'), Buffer.concat([bytes, Buffer.from('\n')]));
    const result = await run(join(dir, 'scripts/inspect-baseline.mjs'), []);
    assert.notEqual(result.code, 0);
    assert.match(result.stderr, /Alpha compatibility evidence differs/);
  }
});

test('Creator and Submitter agree on reviewed preview prefixes and the website version limit', async t => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-authoring-parity-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const input = join(root, 'authoring.json'), output = join(root, 'manifest.json');
  for (const prefix of ['/api/theme-studio', '/__dsh-themes', '/imgs', '/theme-packages']) {
    await rm(output, { force: true });
    const source = authoring(alpha);
    source.version = `1.0.0-${'a'.repeat(58)}`;
    assert.equal(source.version.length, 64);
    source.preview.light = `${prefix}/light.webp`;
    source.preview.dark = `${prefix}/dark.webp`;
    await writeFile(input, JSON.stringify(source));
    const created = await run(creator, ['--input', input, '--output', output]);
    assert.equal(created.code, 0, created.stderr);
    const checked = await run(submitter, ['--manifest', output, '--site', 'https://dsh-themes.com']);
    assert.equal(checked.code, 0, checked.stderr);
  }
  const unsafe = authoring(alpha);
  unsafe.preview.light = '/theme-studio/light.webp';
  await writeFile(input, JSON.stringify(unsafe));
  assert.match((await run(creator, ['--input', input, '--output', output])).stderr, /not a safe local URL/);
  const long = authoring(alpha);
  long.version = `1.0.0-${'a'.repeat(59)}`;
  assert.equal(long.version.length, 65);
  await writeFile(input, JSON.stringify(long));
  const created = await run(creator, ['--input', input, '--output', output]);
  assert.notEqual(created.code, 0);
  assert.match(created.stderr, /at most 64 characters/);
  const manifest = JSON.parse(await readFile(output));
  manifest.version = long.version;
  await writeFile(output, JSON.stringify(manifest));
  const checked = await run(submitter, ['--manifest', output, '--site', 'https://dsh-themes.com']);
  assert.notEqual(checked.code, 0);
  assert.match(checked.stderr, /at most 64 characters/);
});
