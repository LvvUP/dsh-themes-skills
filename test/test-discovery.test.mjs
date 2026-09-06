import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { contractTestFiles } from '../scripts/run-contract-tests.mjs';

test('test entry discovers new root contracts and excludes source-owned fixtures', async t => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-test-discovery-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'test'));
  await mkdir(join(root, 'skills/source'), { recursive: true });
  for (const file of ['test/new-alpha.test.mjs', 'test/retained-rc8.test.mjs', 'test/helpers.mjs', 'skills/source/fixture.test.mjs']) await writeFile(join(root, file), '');
  assert.deepEqual(contractTestFiles(root), [join(root, 'test/new-alpha.test.mjs'), join(root, 'test/retained-rc8.test.mjs')]);
});
