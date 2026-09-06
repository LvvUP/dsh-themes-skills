import assert from 'node:assert/strict';
import test from 'node:test';
import { join, resolve } from 'node:path';
import { uninstallPlugins } from '../skills/dsh-plugin-installer/scripts/uninstall-plugins.mjs';

const items = [
  { catalogId: 3006, slug: 'first', packageName: '@example/first', specifier: '@example/first@1.0.0', profile: 'web' },
  { catalogId: 3045, slug: 'terminal', packageName: '@example/terminal', specifier: '@example/terminal@1.0.0', profile: 'tui' },
];
const catalog = { dshVersion: '0.1.3-alpha.1', top10: [3006, 3045], items };
const environment = { DSH_HOME: resolve('/fixture/dsh') };
const ok = (stdout = '') => ({ code: 0, stdout, stderr: '' });

function fixture({ failRemoval, staleBundle = false, wrongProfile = false, dumpFailure = false } = {}) {
  const state = Object.fromEntries(items.map((item) => [item.profile, { [item.packageName]: { version: '1.0.0' }, unrelated: { version: '3.0.0' } }]));
  const calls = [];
  return { state, calls, environment, runDsh: async (args) => {
    calls.push(args);
    if (args[0] === '--version') return ok('0.1.3-alpha.1');
    if (args[0] === '--profile') {
      if (dumpFailure) return { code: 1, stdout: 'FAKE_SECRET_ONLY', stderr: 'config: FAKE_SECRET_ONLY' };
      return ok(staleBundle ? items.find((item) => item.profile === args[1]).packageName : Object.keys(state[args[1]]).join('\n'));
    }
    const profile = args[2];
    if (args[3] === 'list') return ok(JSON.stringify([{ path: join(environment.DSH_HOME, 'profiles', wrongProfile ? 'other' : profile), dependencies: state[profile] }]));
    if (args[4] === failRemoval) return { code: 1, stdout: '', stderr: 'private diagnostic FAKE_SECRET_ONLY' };
    delete state[profile][args[4]];
    return ok();
  } };
}

test('numbered uninstall plans make no DSH calls and reject ambiguous or retired IDs', async () => {
  const f = fixture();
  const result = await uninstallPlugins(catalog, { top10: true, dryRun: true }, f);
  assert.equal(result.status, 'planned'); assert.equal(f.calls.length, 0);
  assert.deepEqual(result.items[1].command, ['plugin', '--profile', 'tui', 'remove', '@example/terminal']);
  for (const ids of [['#3999'], ['#3006', '#3006'], ['first']])
    await assert.rejects(uninstallPlugins(catalog, { ids }, f));
  assert.equal(f.calls.length, 0);
});

test('multi-profile removal preserves unrelated packages and repeat removal skips mutations', async () => {
  const f = fixture();
  const first = await uninstallPlugins(catalog, { top10: true }, f);
  assert.equal(first.status, 'removed'); assert.ok(first.items.every((item) => item.status === 'removed' && item.restartRequired));
  assert.ok(Object.values(f.state).every((profile) => profile.unrelated?.version === '3.0.0'));
  const second = await uninstallPlugins(catalog, { ids: ['#3006', '#3045'] }, f);
  assert.ok(second.items.every((item) => item.status === 'already-removed' && !item.restartRequired));
  assert.equal(f.calls.filter((args) => args[3] === 'remove').length, 2);
});

test('a failed item is reported without private diagnostics while independent removals finish', async () => {
  const f = fixture({ failRemoval: '@example/first' });
  const result = await uninstallPlugins(catalog, { top10: true }, f);
  assert.equal(result.status, 'incomplete');
  assert.deepEqual(result.items.map((item) => item.status), ['failed', 'removed']);
  assert.ok(f.state.web['@example/first']);
  assert.doesNotMatch(JSON.stringify(result), /FAKE_SECRET_ONLY/);
});

test('wrong profiles, stale bundles and private dump errors cannot claim successful removal', async () => {
  for (const options of [{ wrongProfile: true }, { staleBundle: true }, { dumpFailure: true }]) {
    const f = fixture(options);
    const result = await uninstallPlugins(catalog, { ids: ['#3006'] }, f);
    assert.equal(result.status, 'incomplete'); assert.equal(result.items[0].status, 'failed');
    assert.doesNotMatch(JSON.stringify(result), /FAKE_SECRET_ONLY/);
    if (options.wrongProfile) assert.equal(f.calls.filter((args) => args[3] === 'remove').length, 0);
  }
});
