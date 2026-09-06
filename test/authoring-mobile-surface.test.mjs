import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

import { run, writeAuthoring } from './helpers.mjs';

const creator = resolve('skills/dsh-theme-creator/scripts/create-manifest.mjs');
const submitter = resolve('skills/dsh-theme-submitter/scripts/validate-submission.mjs');

test('mobile welcome surface is optional, preserves both booleans, and rejects coercion in both authoring CLIs', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-mobile-surface-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const input = await writeAuthoring(directory, {
    schemaVersion: '3.0', compatibility: { dshPackageVersion: '0.1.3-alpha.1' },
  });
  const original = JSON.parse(await readFile(input, 'utf8'));
  let baseline;
  for (const value of [undefined, true, false]) {
    const source = structuredClone(original);
    if (value !== undefined) source.visual.mobileWelcomeSurface = value;
    await writeFile(input, JSON.stringify(source));
    const output = join(directory, `${String(value)}.json`);
    const created = await run(creator, ['--input', input, '--output', output]);
    assert.equal(created.code, 0, created.stderr);
    const manifest = JSON.parse(await readFile(output, 'utf8'));
    assert.equal(Object.hasOwn(manifest.visual, 'mobileWelcomeSurface'), value !== undefined);
    assert.equal(manifest.visual.mobileWelcomeSurface, value);
    const submitted = await run(submitter, ['--manifest', output, '--site', 'https://themes.example']);
    assert.equal(submitted.code, 0, submitted.stderr);
    assert.equal(JSON.parse(submitted.stdout).draft, true);
    if (value === undefined) baseline = manifest;
    else {
      delete manifest.visual.mobileWelcomeSurface;
      assert.deepEqual(manifest, baseline, 'Only the optional field may change');
    }
  }
  for (const [index, value] of [null, 'true', 1, {}, []].entries()) {
    const source = structuredClone(original);
    source.visual.mobileWelcomeSurface = value;
    await writeFile(input, JSON.stringify(source));
    const created = await run(creator, ['--input', input, '--output', join(directory, `invalid-created-${index}.json`)]);
    assert.notEqual(created.code, 0);
    assert.match(created.stderr, /visual\.mobileWelcomeSurface must be boolean/);
    const manifest = structuredClone(baseline);
    manifest.visual.mobileWelcomeSurface = value;
    const output = join(directory, `invalid-submission-${index}.json`);
    await writeFile(output, JSON.stringify(manifest));
    const submitted = await run(submitter, ['--manifest', output, '--site', 'https://themes.example']);
    assert.notEqual(submitted.code, 0);
    assert.match(submitted.stderr, /visual\.mobileWelcomeSurface must be boolean/);
  }
});

test('mobile welcome offset preserves signed integers from -120 to 120 without accepting coercion', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-mobile-offset-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const input = await writeAuthoring(directory, {
    schemaVersion: '3.0', compatibility: { dshPackageVersion: '0.1.3-alpha.1' },
  });
  const original = JSON.parse(await readFile(input, 'utf8'));
  let baseline;
  for (const value of [undefined, -120, -100, -1, 0, 1, 100, 120]) {
    const source = structuredClone(original);
    if (value !== undefined) source.visual.mobileWelcomeOffset = value;
    await writeFile(input, JSON.stringify(source));
    const output = join(directory, `${String(value)}.json`);
    const created = await run(creator, ['--input', input, '--output', output]);
    assert.equal(created.code, 0, created.stderr);
    const manifest = JSON.parse(await readFile(output, 'utf8'));
    assert.equal(Object.hasOwn(manifest.visual, 'mobileWelcomeOffset'), value !== undefined);
    assert.equal(manifest.visual.mobileWelcomeOffset, value);
    const submitted = await run(submitter, ['--manifest', output, '--site', 'https://themes.example']);
    assert.equal(submitted.code, 0, submitted.stderr);
    if (value === undefined) baseline = manifest;
    else {
      delete manifest.visual.mobileWelcomeOffset;
      assert.deepEqual(manifest, baseline, 'Only the optional field may change');
    }
  }
  for (const [index, value] of [-121, 121, -0.5, 0.5, '-100', '100', '-100px', true, null, {}, []].entries()) {
    const source = structuredClone(original);
    source.visual.mobileWelcomeOffset = value;
    await writeFile(input, JSON.stringify(source));
    const created = await run(creator, ['--input', input, '--output', join(directory, `invalid-created-${index}.json`)]);
    assert.notEqual(created.code, 0);
    assert.match(created.stderr, /mobileWelcomeOffset must be an integer from -120 to 120/);
    const manifest = structuredClone(baseline);
    manifest.visual.mobileWelcomeOffset = value;
    const output = join(directory, `invalid-submission-${index}.json`);
    await writeFile(output, JSON.stringify(manifest));
    const submitted = await run(submitter, ['--manifest', output, '--site', 'https://themes.example']);
    assert.notEqual(submitted.code, 0);
    assert.match(submitted.stderr, /mobileWelcomeOffset must be an integer from -120 to 120/);
  }
});
