import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

import { run } from './helpers.mjs';

const state = resolve('skills/dsh-theme-manager/scripts/theme-state.mjs');
const verifier = resolve('skills/dsh-theme-manager/scripts/fetch-and-verify.mjs');
const shaA = 'a'.repeat(64);
const shaB = 'b'.repeat(64);

test('multiple active theme packages are a hard conflict', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-conflict-'));
  const list = join(directory, 'plugins.json');
  await writeFile(list, JSON.stringify({ dependencies: { '@dsh-themes/one': '1.0.0', '@dsh-themes/two': '2.0.0', other: '3.0.0' } }));
  const result = await run(state, ['inspect', '--input', list]);
  assert.notEqual(result.code, 0);
  assert.match(result.stderr, /Multiple DSH-Themes packages/);
});

test('rollback records preserve exact artifacts and reverse safely', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-rollback-'));
  const previous = join(directory, 'previous.tgz');
  const target = join(directory, 'target.tgz');
  const result = await run(state, [
    'record', '--at', '2026-08-14T00:00:00.000Z',
    '--previous-name', '@dsh-themes/previous', '--previous-version', '1.2.3', '--previous-artifact', previous, '--previous-sha256', shaA,
    '--target-name', '@dsh-themes/target', '--target-version', '2.0.0-rc.1', '--target-artifact', target, '--target-sha256', shaB,
  ]);
  assert.equal(result.code, 0, result.stderr);
  const record = JSON.parse(result.stdout);
  assert.equal(record.createdAt, '2026-08-14T00:00:00.000Z');
  const path = join(directory, 'rollback.json');
  await writeFile(path, JSON.stringify(record));
  const validated = await run(state, ['validate-record', '--input', path]);
  assert.equal(validated.code, 0, validated.stderr);
  const reversed = await run(state, ['reverse', '--input', path]);
  assert.equal(reversed.code, 0, reversed.stderr);
  const reverseRecord = JSON.parse(reversed.stdout);
  assert.deepEqual(reverseRecord.previous, record.target);
  assert.deepEqual(reverseRecord.target, record.previous);
});

test('rollback record can reverse a theme back from the built-in palette', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-rollback-built-in-'));
  const target = join(directory, 'target.tgz');
  const created = await run(state, [
    'record', '--at', '2026-08-14T00:00:00.000Z',
    '--target-name', '@dsh-themes/target', '--target-version', '2.0.0', '--target-artifact', target, '--target-sha256', shaB,
  ]);
  assert.equal(created.code, 0, created.stderr);
  const path = join(directory, 'rollback.json');
  await writeFile(path, created.stdout);
  const reversed = await run(state, ['reverse', '--input', path]);
  assert.equal(reversed.code, 0, reversed.stderr);
  const record = JSON.parse(reversed.stdout);
  assert.equal(record.target, null);
  assert.equal(record.previous.packageName, '@dsh-themes/target');
  const reversePath = join(directory, 'reverse.json');
  await writeFile(reversePath, reversed.stdout);
  assert.equal((await run(state, ['validate-record', '--input', reversePath])).code, 0);
});

test('artifact verifier checks complete-package SHA-256 and refuses overwrite', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-verify-'));
  const source = join(directory, 'source.tgz');
  const output = join(directory, 'verified', 'theme.tgz');
  const bytes = Buffer.from('verified bytes');
  await writeFile(source, bytes);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const first = await run(verifier, ['--source', source, '--sha256', sha256, '--output', output]);
  assert.equal(first.code, 0, first.stderr);
  assert.deepEqual(await readFile(output), bytes);
  const second = await run(verifier, ['--source', source, '--sha256', sha256, '--output', output]);
  assert.notEqual(second.code, 0);
  assert.match(second.stderr, /exist/i);
});
