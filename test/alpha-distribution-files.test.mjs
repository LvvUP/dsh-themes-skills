import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { currentAlphaFiles, syncAlphaArtifactAllowlist } from '../scripts/sync-alpha-artifact-allowlist.mjs';

test('all verified local archives and companions are present, exact, and not ignored', async () => {
  const result = await syncAlphaArtifactAllowlist({ check: true });
  assert.ok(result.artifacts > 0);
  assert.equal(result.companionFiles, 12);
});
test('a source-reviewed archive cannot enter the release file allowlist', async t => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-alpha-distribution-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const name of ['dsh-plugin-installer', 'dsh-community-skin-installer']) {
    const folder = join(root, 'skills', name, 'references');
    await mkdir(folder, { recursive: true });
    await writeFile(join(folder, name === 'dsh-plugin-installer' ? 'plugins.json' : 'community-recipes.json'), JSON.stringify({ items: name === 'dsh-plugin-installer' ? [{ catalogId: 3000, validation: { status: 'source-reviewed' }, artifact: { path: 'assets/alpha/artifacts/' + 'a'.repeat(64) + '.tgz', sha256: 'a'.repeat(64) } }] : [] }));
  }
  assert.equal((await currentAlphaFiles(root)).size, 0);
  const catalogFile = join(root, 'skills/dsh-plugin-installer/references/plugins.json');
  const catalog = JSON.parse(await readFile(catalogFile));
  catalog.items[0].validation.status = 'runtime-verified';
  await writeFile(catalogFile, JSON.stringify(catalog));
  await assert.rejects(() => currentAlphaFiles(root), /ENOENT/);
});
