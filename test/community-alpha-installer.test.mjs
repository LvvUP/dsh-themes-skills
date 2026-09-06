import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { installCommunityItems, prepareArtifact } from '../skills/dsh-community-skin-installer/scripts/install-alpha.mjs';

const item = { catalogId: 1101, slug: 'one', sourceRepository: 'example/palettes', sourceRevision: 'a'.repeat(40), packageName: 'palettes', packageVersion: '1.0.0', specifier: 'palettes@1.0.0', profile: 'web', validation: { status: 'runtime-verified' }, activation: { themeId: 'one' } };
const catalog = { dshVersion: '0.1.3-alpha.1', items: [item, { ...item, catalogId: 1102, slug: 'two', activation: { themeId: 'two' } }] };
test('one palette package is installed once while each selected palette keeps its own activation', async () => {
  const calls = [];
  const runDsh = async (args) => {
    calls.push(args);
    return { code: 0, stderr: '', stdout: args[0] === '--version' ? catalog.dshVersion : args[3] === 'list' ? '[{"dependencies":{"palettes":{"version":"1.0.0"}}}]' : 'palettes' };
  };
  const result = await installCommunityItems(catalog, { ids: ['#1101', '#1102'] }, { runDsh });
  assert.equal(calls.filter((args) => args[3] === 'add').length, 1);
  assert.deepEqual(result.items.map((entry) => entry.activation.themeId), ['one', 'two']);
  assert.deepEqual(result.items.map((entry) => entry.status), ['installed', 'already-installed']);
});
test('pending community items can be inspected and cannot trigger installation', async () => {
  const pending = { ...catalog, items: [{ ...item, validation: { status: 'source-reviewed' } }] };
  const runDsh = () => { throw new Error('must not run'); };
  assert.equal((await installCommunityItems(pending, { ids: ['#1101'], inspect: true }, { runDsh })).status, 'inspected');
  await assert.rejects(() => installCommunityItems(pending, { ids: ['#1101'] }, { runDsh }), /not passed Alpha/);
});
test('changed archive bytes fail before writing a package cache', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-community-alpha-'));
  try {
    const archive = { ...item, artifact: { url: 'https://github.com/example/palettes/releases/download/v1.0.0/palettes.tgz', sha256: 'a'.repeat(64) } };
    await assert.rejects(() => prepareArtifact(archive, { cacheDirectory: directory, fetchArtifact: async () => new Response('changed archive') }), /digest differs/);
    await assert.rejects(() => prepareArtifact({ ...item, artifact: { path: '../outside.tgz', sha256: 'a'.repeat(64) } }), /Invalid bundled archive/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('activation clears other installed groups before selecting one exact palette', async () => {
  const { activateCommunityItem } = await import('../skills/dsh-community-skin-installer/scripts/install-alpha.mjs');
  const calls = [];
  const target = { ...item, activation: { kind: 'http', deselectRequests: [{ path: '/api/dsh-community-palettes/catppuccin', body: { selection: 'off' } }], request: { path: '/api/dsh-community-palettes/theme-pack', body: { catalogId: 1101, base: 'system' } } } };
  const result = await activateCommunityItem(target, { request: async (url, options) => { calls.push([url, JSON.parse(options.body)]); return { status: calls.length === 1 ? 404 : 200 }; } });
  assert.equal(result.status, 'selected'); assert.equal(result.reloadRequired, true);
  assert.deepEqual(calls, [['/api/dsh-community-palettes/catppuccin', { selection: 'off' }], ['/api/dsh-community-palettes/theme-pack', { catalogId: 1101, base: 'system' }]]);
  await assert.rejects(() => activateCommunityItem(target, { request: async () => ({ status: 401 }) }), /HTTP 401/);
  await assert.rejects(() => activateCommunityItem({ ...target, activation: { ...target.activation, request: { path: 'https://example.com', body: {} } } }, { request: () => { throw Error('must not send'); } }), /Invalid palette/);
});


test('real palette and Xiaoyao recipe artifact shapes pass their own installation contract', async () => {
  const actual = JSON.parse(await readFile(new URL('../skills/dsh-community-skin-installer/references/community-recipes.json', import.meta.url)));
  for (const catalogId of [1101, 2307]) {
    const recipe = actual.items.find(item => item.catalogId === catalogId);
    assert.equal(recipe.validation.status, 'runtime-verified');
    assert.equal(recipe.artifact.packageVersion, undefined);
    const calls = [];
    const result = await installCommunityItems(actual, { ids: [`#${catalogId}`] }, {
      prepare: async item => { assert.equal(item, recipe); return '/verified/archive.tgz'; },
      runDsh: async args => {
        calls.push(args);
        return { code: 0, stderr: '', stdout: args[0] === '--version' ? actual.dshVersion : args[3] === 'list' ? JSON.stringify([{ dependencies: { [recipe.packageName]: { version: recipe.packageVersion } } }]) : recipe.packageName };
      },
    });
    assert.equal(result.status, 'installed');
    assert.ok(calls.some(args => args[3] === 'add' && args[4] === '/verified/archive.tgz'));
  }
});
