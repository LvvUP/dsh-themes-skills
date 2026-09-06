import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

import { run, writeAuthoring } from './helpers.mjs';

const creator = resolve('skills/dsh-theme-creator/scripts/create-manifest.mjs');
const submitter = resolve('skills/dsh-theme-submitter/scripts/validate-submission.mjs');
const cases = [
  ['desktopWelcomeLayout', ['compact-left', 'compact-center'], ['left', 'compact-left;display:none', null, true, 1, {}, []]],
  ['desktopWelcomeSurface', [true, false], ['true', null, 1, {}, []]],
  ['mobileDarkFocusX', [0, 50, 100], [-1, 101, 0.5, '0', null, false, {}, []]],
];
for (const [key, valid, invalid] of cases) {
  test(`${key} is optional, preserved exactly and strictly validated by both real authoring CLIs`, async (t) => {
    const directory = await mkdtemp(join(tmpdir(), 'dsh-welcome-layout-'));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const input = await writeAuthoring(directory, { schemaVersion: '3.0', compatibility: { dshPackageVersion: '0.1.3-alpha.1' } });
    const original = JSON.parse(await readFile(input, 'utf8'));
    let baseline;
    for (const [index, value] of [undefined, ...valid].entries()) {
      const source = structuredClone(original);
      if (value !== undefined) source.visual[key] = value;
      await writeFile(input, JSON.stringify(source));
      const output = join(directory, `valid-${index}.json`);
      const created = await run(creator, ['--input', input, '--output', output]);
      assert.equal(created.code, 0, created.stderr);
      const manifest = JSON.parse(await readFile(output, 'utf8'));
      assert.equal(Object.hasOwn(manifest.visual, key), value !== undefined);
      assert.equal(manifest.visual[key], value);
      const submitted = await run(submitter, ['--manifest', output, '--site', 'https://themes.example']);
      assert.equal(submitted.code, 0, submitted.stderr);
      assert.equal(JSON.parse(submitted.stdout).draft, true);
      if (value === undefined) baseline = manifest;
      else { delete manifest.visual[key]; assert.deepEqual(manifest, baseline, 'No unrelated field may change'); }
    }
    for (const [index, value] of invalid.entries()) {
      const source = structuredClone(original); source.visual[key] = value;
      await writeFile(input, JSON.stringify(source));
      const created = await run(creator, ['--input', input, '--output', join(directory, `invalid-created-${index}.json`)]);
      assert.notEqual(created.code, 0); assert.match(created.stderr, new RegExp(key));
      const manifest = structuredClone(baseline); manifest.visual[key] = value;
      const output = join(directory, `invalid-submitted-${index}.json`); await writeFile(output, JSON.stringify(manifest));
      const submitted = await run(submitter, ['--manifest', output, '--site', 'https://themes.example']);
      assert.notEqual(submitted.code, 0); assert.match(submitted.stderr, new RegExp(key));
    }
  });
}
