import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { inspectCompanion, installCompanion, restoreCompanions } from '../skills/dsh-community-skin-installer/scripts/companion-files.mjs';
import { installCommunityItems } from '../skills/dsh-community-skin-installer/scripts/install-alpha.mjs';

async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-community-companion-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const skillRoot = join(directory, 'skill');
  const sourcePath = 'assets/alpha/skin-center/user-skins/qq98';
  const bytes = Buffer.from('Alpha sidebar style');
  await mkdir(join(skillRoot, sourcePath), { recursive: true });
  await writeFile(join(skillRoot, sourcePath, 'skin.css'), bytes);
  const item = { catalogId: 2207, packageName: 'skin-center', packageVersion: '1.0.0', sourceRepository: 'example/skin-center', sourceRevision: 'a'.repeat(40), profile: 'web', specifier: 'skin-center@1.0.0', validation: { status: 'runtime-verified' }, companion: { kind: 'bundled-user-skin', skinId: 'qq98', sourcePath, files: [{ path: 'skin.css', sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length }] } };
  return { item, skillRoot, dshHome: join(directory, 'isolated-home') };
}
test('companion installation preserves and restores an existing user directory', async t => {
  const f = await fixture(t);
  await mkdir(join(f.dshHome, 'skins/qq98'), { recursive: true });
  await writeFile(join(f.dshHome, 'skins/qq98/private.txt'), 'original user content');
  assert.equal((await installCompanion(f.item, f)).backupCreated, true);
  assert.equal((await installCompanion(f.item, f)).status, 'already-installed');
  assert.deepEqual(await restoreCompanions(f.item.packageName, f), [{ skinId: 'qq98', status: 'restored' }]);
  assert.equal(await readFile(join(f.dshHome, 'skins/qq98/private.txt'), 'utf8'), 'original user content');
  assert.deepEqual(await restoreCompanions(f.item.packageName, f), []);
});
test('companion uninstall preserves local edits and its original backup', async t => {
  const f = await fixture(t);
  await installCompanion(f.item, f);
  await writeFile(join(f.dshHome, 'skins/qq98/skin.css'), 'user edit');
  await assert.rejects(() => restoreCompanions(f.item.packageName, f), /bytes differ/);
  assert.equal(await readFile(join(f.dshHome, 'skins/qq98/skin.css'), 'utf8'), 'user edit');
});
test('changed or extra bundled files and traversal are rejected before DSH execution', async t => {
  const f = await fixture(t);
  await writeFile(join(f.skillRoot, f.item.companion.sourcePath, 'extra.txt'), 'unexpected');
  let calls = 0;
  await assert.rejects(() => installCommunityItems({ dshVersion: '0.1.3-alpha.1', items: [f.item] }, { ids: ['#2207'] }, { companionSkillRoot: f.skillRoot, dshHome: f.dshHome, runDsh: () => { calls++; throw Error('must not run'); } }), /inventory differs/);
  assert.equal(calls, 0);
  await assert.rejects(() => inspectCompanion({ ...f.item, companion: { ...f.item.companion, sourcePath: '../outside' } }, f), /Invalid bundled/);
});
test('source and destination symlinks never become writable targets', async t => {
  const f = await fixture(t);
  await mkdir(f.dshHome, { recursive: true });
  await symlink(f.skillRoot, join(f.dshHome, 'skins'));
  await assert.rejects(() => installCompanion(f.item, f), /regular directory/);
  await symlink(join(f.skillRoot, f.item.companion.sourcePath, 'skin.css'), join(f.skillRoot, f.item.companion.sourcePath, 'link.css'));
  await assert.rejects(() => inspectCompanion(f.item, f), /symlinks/);
});
test('public remove confirms package absence before restoring companion files', async t => {
  const f = await fixture(t);
  await installCompanion(f.item, f);
  const calls = [];
  let installed = true;
  const runDsh = async args => { calls.push(args); if (args[3] === 'remove') installed = false; return { code: 0, stderr: '', stdout: args[0] === '--version' ? '0.1.3-alpha.1' : args[3] === 'list' ? JSON.stringify([{ dependencies: installed ? { 'skin-center': { version: '1.0.0' } } : {} }]) : '' }; };
  const result = await installCommunityItems({ dshVersion: '0.1.3-alpha.1', items: [f.item, { ...f.item, catalogId: 2206 }] }, { ids: ['#2207', '#2206'], remove: true }, { runDsh, dshHome: f.dshHome });
  assert.equal(result.status, 'removed');
  assert.deepEqual(result.items[0].companions, [{ skinId: 'qq98', status: 'removed' }]);
  assert.equal(calls.filter(args => args[3] === 'remove' && args[4] === 'skin-center').length, 1);
  assert.equal(result.items[1].status, 'already-removed');
  assert.equal(result.items[1].sharedPackage, true);
});

test('a recovery retry restores the original directory even when package removal already succeeded', async t => {
  const f = await fixture(t);
  await mkdir(join(f.dshHome, 'skins/qq98'), { recursive: true });
  await writeFile(join(f.dshHome, 'skins/qq98/private.txt'), 'original user content');
  await installCompanion(f.item, f);
  await writeFile(join(f.dshHome, 'skins/qq98/skin.css'), 'user edit');
  let installed = true;
  let removals = 0;
  const runDsh = async args => {
    if (args[0] === '--version') return { code: 0, stdout: '0.1.3-alpha.1', stderr: '' };
    if (args[3] === 'remove') {
      removals++;
      if (!installed) return { code: 1, stdout: '', stderr: 'ERR_PNPM_CANNOT_REMOVE_MISSING_DEPS' };
      installed = false;
      return { code: 0, stdout: '', stderr: '' };
    }
    return { code: 0, stdout: JSON.stringify([{ dependencies: installed ? { 'skin-center': { version: '1.0.0' } } : {} }]), stderr: '' };
  };
  const catalog = { dshVersion: '0.1.3-alpha.1', items: [f.item] };
  const options = { ids: ['#2207'], remove: true };
  const first = await installCommunityItems(catalog, options, { runDsh, dshHome: f.dshHome });
  assert.equal(first.status, 'incomplete');
  assert.match(first.items[0].error, /bytes differ/);
  assert.equal(await readFile(join(f.dshHome, 'skins/qq98/skin.css'), 'utf8'), 'user edit');
  await writeFile(join(f.dshHome, 'skins/qq98/skin.css'), await readFile(join(f.skillRoot, f.item.companion.sourcePath, 'skin.css')));
  const retry = await installCommunityItems(catalog, options, { runDsh, dshHome: f.dshHome });
  assert.equal(retry.status, 'removed');
  assert.deepEqual(retry.items[0].companions, [{ skinId: 'qq98', status: 'restored' }]);
  assert.equal(removals, 1);
  assert.equal(await readFile(join(f.dshHome, 'skins/qq98/private.txt'), 'utf8'), 'original user content');
});

test('missing dependencies with a stale or broken composed profile never report removal success', async t => {
  for (const broken of [false, true]) {
    const f = await fixture(t);
    await mkdir(join(f.dshHome, 'skins/qq98'), { recursive: true });
    await writeFile(join(f.dshHome, 'skins/qq98/private.txt'), 'original user content');
    await installCompanion(f.item, f);
    const runDsh = async args => {
      assert.notEqual(args[3], 'remove', 'The absent package must not be removed again');
      if (args.includes('--dump-config')) return { code: broken ? 1 : 0, stdout: broken ? '' : 'skin-center', stderr: broken ? 'apiKey: FAKE_SECRET_ONLY' : '' };
      return { code: 0, stdout: args[0] === '--version' ? '0.1.3-alpha.1' : '[{"dependencies":{}}]', stderr: '' };
    };
    const result = await installCommunityItems({ dshVersion: '0.1.3-alpha.1', items: [f.item] }, { ids: ['#2207'], remove: true }, { runDsh, dshHome: f.dshHome });
    assert.equal(result.status, 'incomplete');
    assert.match(result.items[0].error, /profile still references|could not be composed/);
    assert.deepEqual(result.items[0].companions, [{ skinId: 'qq98', status: 'restored' }]);
    assert.doesNotMatch(JSON.stringify(result), /FAKE_SECRET_ONLY/);
    assert.equal(await readFile(join(f.dshHome, 'skins/qq98/private.txt'), 'utf8'), 'original user content');
  }
});
