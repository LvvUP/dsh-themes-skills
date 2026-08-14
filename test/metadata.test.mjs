import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import test from 'node:test';

test('all skill metadata and scripts validate', () => {
  const result = spawnSync(process.execPath, [resolve('scripts/validate-skills.mjs')], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Validated 4 skills/);
});
