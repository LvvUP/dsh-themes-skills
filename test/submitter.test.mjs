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
  assert.equal(/cookie|api.?key|password/i.test(result.stdout), false);
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
