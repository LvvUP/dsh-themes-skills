import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  installPlugins,
  parseArguments,
  parsePluginList,
  prepareSourceArchive,
  prepareRegistryArchive,
  selectPlugins,
  validateRecipe,
} from '../skills/dsh-plugin-installer/scripts/install-plugins.mjs';

const item = {
  catalogId: 3006,
  slug: 'test-plugin',
  packageName: '@example/test-plugin',
  specifier: '@example/test-plugin@1.2.3',
  profile: 'web',
  sourceRepository: 'example/test-plugin',
  sourceRevision: 'a'.repeat(40),
  validation: { registryIntegrity: `sha512-${createHash('sha512').update('reviewed fixture').digest('base64')}` },
};
const terminal = { ...item, catalogId: 3045, slug: 'terminal', packageName: 'terminal', specifier: 'terminal@2.0.0', profile: 'tui' };
const catalog = { dshVersion: '0.1.3-alpha.1', top10: [3006, 3045], items: [item, terminal] };
const fixtureEnvironment = { DSH_HOME: resolve('/fixture/dsh-home') };
const fixtureArchive = (entry) => resolve('/fixture/archives', `${entry.catalogId}.tgz`);
const ok = (stdout = '') => ({ code: 0, stdout, stderr: '' });

function fakeDsh({ failId, noBundle = false, installed = {} } = {}) {
  const calls = [];
  const state = new Map(Object.entries(installed));
  return {
    calls,
    environment: fixtureEnvironment,
    prepareRegistry: async entry => fixtureArchive(entry),
    runDsh: async (args) => {
      calls.push(args);
      if (args[0] === '--version') return ok('dsh 0.1.3-alpha.1\n');
      if (args[0] === '--profile') return ok(noBundle ? '# base only' : catalog.items.filter((entry) => entry.profile === args[1]).map((entry) => entry.packageName).join('\n'));
      const profile = args[2];
      if (args[3] === 'list') return ok(JSON.stringify([{ path: join(fixtureEnvironment.DSH_HOME, 'profiles', profile), dependencies: state.get(profile) ?? {} }]));
      const selected = catalog.items.find((entry) => fixtureArchive(entry) === args[4]);
      if (selected.catalogId === failId) return { code: 1, stdout: '', stderr: 'fixture install failed' };
      state.set(profile, { ...state.get(profile), [selected.packageName]: { version: selected.specifier.slice(selected.packageName.length + 1), resolved: `file:${relative(join(fixtureEnvironment.DSH_HOME, 'profiles', profile), args[4])}` } });
      return ok();
    },
  };
}

test('exact numbers select recipes; names, retired IDs, duplicates and mixed selection fail before executing', () => {
  assert.deepEqual(selectPlugins(catalog, { ids: ['#3045'] }), [terminal]);
  for (const ids of [['terminal'], ['#3999'], ['#3006', '#3006'], ['#03006']]) {
    assert.throws(() => selectPlugins(catalog, { ids }));
  }
  assert.throws(() => selectPlugins(catalog, { ids: ['#3006'], top10: true }));
});

test('source recipes require exact, matching coordinates', () => {
  assert.equal(validateRecipe(item), item);
  const github = { ...item, specifier: `github:example/test-plugin#${item.sourceRevision}` };
  assert.equal(validateRecipe(github), github);
  for (const specifier of ['@example/test-plugin@latest', 'other-plugin@1.2.3', 'github:example/test-plugin#main', `github:other/plugin#${item.sourceRevision}`, '@example/test-plugin@1.2.3;touch /tmp/example']) {
    assert.throws(() => validateRecipe({ ...item, specifier }));
  }
  assert.throws(() => validateRecipe({ ...item, profile: 'web;echo bad' }));
  assert.throws(() => validateRecipe({ ...item, allowBuilds: ['--ignore-scripts'] }));
  assert.throws(() => validateRecipe({ ...item, dependencies: ['schemastery@latest'] }));
  assert.throws(() => validateRecipe({ ...item, dependencies: ['--ignore-scripts'] }));
});

test('published recipes keep 100 identities and a ten-item subset with exact sources', async () => {
  const current = JSON.parse(await readFile(new URL('../skills/dsh-plugin-installer/references/plugins.json', import.meta.url), 'utf8'));
  assert.equal(current.items.length, 100);
  assert.equal(new Set(current.items.map((entry) => entry.catalogId)).size, 100);
  assert.equal(new Set(current.items.map((entry) => entry.slug)).size, 100);
  assert.equal(selectPlugins(current, { top10: true }).length, 10);
  for (const entry of current.items) validateRecipe(entry);
  assert.ok(current.items.some((entry) => entry.profile !== 'web'));
});

test('dry run resolves the frozen collection and each profile without invoking DSH', async () => {
  const result = await installPlugins(catalog, { top10: true, dryRun: true }, { runDsh: () => { throw new Error('must not run'); } });
  assert.equal(result.status, 'planned');
  assert.deepEqual(result.items.map((entry) => entry.profile), ['web', 'tui']);
  assert.deepEqual(result.items[1].command.slice(0, 4), ['plugin', '--profile', 'tui', 'add']);
  assert.match(result.items[1].command[4], /npm-[a-f0-9]{64}\.tgz$/);
  assert.equal(result.items[1].archivePreparation.integrity, terminal.validation.registryIntegrity);
});

test('batch installation registers packages in the declared profiles', async () => {
  const executor = fakeDsh();
  const result = await installPlugins(catalog, { top10: true }, executor);
  assert.equal(result.status, 'installed');
  assert.deepEqual(result.items.map((entry) => entry.status), ['installed', 'installed']);
  assert.equal(executor.calls.filter((args) => args[3] === 'add').length, 2);
});

test('one install failure is reported while independent selected plugins still finish', async () => {
  const result = await installPlugins(catalog, { top10: true }, fakeDsh({ failId: 3006 }));
  assert.equal(result.status, 'incomplete');
  assert.deepEqual(result.items.map((entry) => entry.status), ['failed', 'installed']);
  assert.match(result.items[0].error, /Install #3006 failed \(exit 1\)/);
});

test('an already installed exact version skips add and still checks composition', async () => {
  const executor = fakeDsh({ installed: { web: { [item.packageName]: { version: '1.2.3', resolved: `file:${fixtureArchive(item)}` } } } });
  const result = await installPlugins(catalog, { ids: ['#3006'] }, executor);
  assert.equal(result.items[0].status, 'already-installed');
  assert.equal(executor.calls.filter((args) => args[3] === 'add').length, 0);
  assert.ok(executor.calls.some((args) => args.includes('--dump-config')));
});

test('the same npm version from another archive is replaced by the reviewed archive', async () => {
  const executor = fakeDsh({ installed: { web: { [item.packageName]: { version: '1.2.3', resolved: `file:/unrelated/${item.catalogId}.tgz` } } } });
  const result = await installPlugins(catalog, { ids: ['#3006'] }, executor);
  assert.equal(result.items[0].status, 'installed');
  assert.equal(executor.calls.filter(args => args[3] === 'add').length, 1);
  assert.equal(executor.calls.find(args => args[3] === 'add')[4], fixtureArchive(item));
});

test('a list from another profile cannot authorize installation or reuse', async () => {
  const executor = fakeDsh();
  const runDsh = async args => args[3] === 'list' ? ok(JSON.stringify([{ path: '/unrelated/profiles/web', dependencies: {} }])) : executor.runDsh(args);
  const result = await installPlugins(catalog, { ids: ['#3006'] }, { ...executor, runDsh });
  assert.equal(result.status, 'incomplete');
  assert.match(result.items[0].error, /requested profile/);
  assert.ok(!executor.calls.some(args => args[3] === 'add'));
});

test('a successful add with a different resolved archive fails final source verification', async () => {
  const executor = fakeDsh();
  const runDsh = async args => {
    const result = await executor.runDsh(args);
    if (args[3] === 'list') {
      const profiles = JSON.parse(result.stdout);
      if (profiles[0].dependencies[item.packageName]) profiles[0].dependencies[item.packageName].resolved = 'file:/unreviewed/copy.tgz';
      return ok(JSON.stringify(profiles));
    }
    return result;
  };
  const result = await installPlugins(catalog, { ids: ['#3006'] }, { ...executor, runDsh });
  assert.equal(result.status, 'incomplete');
  assert.match(result.items[0].error, /different source version/);
  assert.ok(executor.calls.some(args => args[3] === 'add'));
});

test('command errors never expose configuration snippets or credentials in installer results', async () => {
  for (const failingCommand of ['add', '--dump-config']) {
    const executor = fakeDsh();
    const runDsh = async args => args.includes(failingCommand) ? { code: 1, stdout: 'apiKey: FAKE_SECRET_ONLY', stderr: 'YAMLException\npassword: PRIVATE_FIXTURE_VALUE' } : executor.runDsh(args);
    const result = await installPlugins(catalog, { ids: ['#3006'] }, { ...executor, runDsh });
    assert.equal(result.status, 'incomplete');
    assert.match(result.items[0].error, /failed \(exit 1\)/);
    assert.doesNotMatch(JSON.stringify(result), /FAKE_SECRET_ONLY|PRIVATE_FIXTURE_VALUE|YAMLException/);
  }
});

test('an npm dependency without a profile bundle is not reported as installed successfully', async () => {
  const result = await installPlugins(catalog, { ids: ['#3006'] }, fakeDsh({ noBundle: true }));
  assert.equal(result.status, 'incomplete');
  assert.match(result.items[0].error, /did not join the DSH profile/);
});

test('a different DSH version is rejected before profile operations', async () => {
  const calls = [];
  await assert.rejects(installPlugins(catalog, { ids: ['#3006'] }, { runDsh: async (args) => { calls.push(args); return ok('0.1.0-rc.8'); } }), /targets DSH/);
  assert.deepEqual(calls, [['--version']]);
});

test('parser handles comma-separated IDs and list output without command evaluation', () => {
  assert.deepEqual(parseArguments(['--ids', '#3006, #3045', '--dry-run']), { ids: ['#3006', '#3045'], dryRun: true });
  assert.throws(() => parseArguments(['--profile', 'web']));
  assert.deepEqual(parsePluginList('[{"dependencies":{"plugin":{"version":"1.0.0"}}}]'), { plugin: { version: '1.0.0' } });
  assert.throws(() => parsePluginList('not-json'));
});

test('a source archive is verified before caching and modified cache bytes are rejected', async () => {
  const cacheDirectory = await mkdtemp(join(tmpdir(), 'dsh-source-test-'));
  const bytes = Buffer.from('fixture archive bytes');
  const archiveSha256 = createHash('sha256').update(bytes).digest('hex');
  const source = { ...item, specifier: `github:example/test-plugin#${item.sourceRevision}`, validation: { prebuiltArchive: { status: 'verified', archiveSha256 } } };
  const calls = [];
  try {
    const file = await prepareSourceArchive(source, { cacheDirectory, fetchArchive: async (url) => { calls.push(url); return new Response(bytes); } });
    assert.equal(file, join(cacheDirectory, `${archiveSha256}.tgz`));
    assert.deepEqual(await readFile(file), bytes);
    assert.equal(calls[0], `https://codeload.github.com/example/test-plugin/tar.gz/${item.sourceRevision}`);
    assert.equal(await prepareSourceArchive(source, { cacheDirectory, fetchArchive: () => { throw new Error('cache must avoid the network'); } }), file);
    await writeFile(file, 'changed bytes');
    await assert.rejects(prepareSourceArchive(source, { cacheDirectory }), /Cached source archive has changed/);
    await rm(file);
    await assert.rejects(prepareSourceArchive(source, { cacheDirectory, fetchArchive: async () => new Response('wrong archive') }), /digest differs/);
    await assert.rejects(prepareSourceArchive({ ...source, validation: { prebuiltArchive: { status: 'verified' } } }, { cacheDirectory }), /verified source archive digest/);
  } finally { await rm(cacheDirectory, { recursive: true, force: true }); }
});

test('npm archives bind exact registry URLs and reviewed integrity before caching or installation', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-npm-integrity-test-'));
  const bytes = Buffer.from('reviewed fixture');
  const calls = [];
  try {
    const fetchArchive = async (url, options) => {
      calls.push(url);
      assert.equal(options.redirect, 'error');
      assert.ok(options.signal instanceof AbortSignal);
      return new Response(bytes);
    };
    // Both concurrent callers may download; only a complete verified file is published.
    const paths = await Promise.all([1, 2].map(() => prepareRegistryArchive(item, { cacheDirectory: directory, fetchArchive })));
    assert.equal(paths[0], paths[1]);
    assert.ok(calls.every(url => url === 'https://registry.npmjs.org/@example/test-plugin/-/test-plugin-1.2.3.tgz'));
    assert.deepEqual(await readFile(paths[0]), bytes);
    assert.equal(await prepareRegistryArchive(item, { cacheDirectory: directory, fetchArchive: () => { throw Error('must reuse verified cache'); } }), paths[0]);
    await writeFile(paths[0], 'different local bytes');
    await assert.rejects(prepareRegistryArchive(item, { cacheDirectory: directory, fetchArchive }), /integrity differs/);
    await rm(paths[0]);
    await assert.rejects(prepareRegistryArchive(item, { cacheDirectory: directory, fetchArchive: async () => new Response('unreviewed registry bytes') }), /integrity differs/);
    await assert.rejects(readFile(paths[0]), { code: 'ENOENT' });
    await assert.rejects(prepareRegistryArchive({ ...item, validation: {} }, { cacheDirectory: directory, fetchArchive }), /reviewed npm archive/);
    const executor = fakeDsh();
    await assert.rejects(installPlugins({ ...catalog, items: [{ ...item, validation: {} }] }, { ids: ['#3006'] }, executor), /reviewed archive digest/);
    assert.equal(executor.calls.length, 0);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('GitHub installation passes a verified local archive to the official CLI', async () => {
  const archiveSha256 = 'b'.repeat(64);
  const source = { ...item, specifier: `github:example/test-plugin#${item.sourceRevision}`, validation: { prebuiltArchive: { status: 'verified', archiveSha256 } } };
  const file = resolve('/isolated/cache', `${archiveSha256}.tgz`);
  const plan = await installPlugins({ ...catalog, items: [source] }, { ids: ['#3006'], dryRun: true });
  assert.equal(basename(plan.items[0].command[4]), `${archiveSha256}.tgz`);
  assert.ok(!plan.items[0].command.some((argument) => argument.startsWith('https://')));
  let installed = false;
  const calls = [];
  const runDsh = async (args) => {
    calls.push(args);
    if (args[0] === '--version') return ok(catalog.dshVersion);
    if (args[0] === '--profile') return ok(source.packageName);
    if (args[3] === 'list') return ok(JSON.stringify([{ path: join(fixtureEnvironment.DSH_HOME, 'profiles', source.profile), dependencies: installed ? { [source.packageName]: { version: '1.2.3', resolved: `file:${file}` } } : {} }]));
    assert.equal(args[4], file);
    installed = true;
    return ok();
  };
  const result = await installPlugins({ ...catalog, items: [source] }, { ids: ['#3006'] }, { runDsh, environment: fixtureEnvironment, prepareSource: async (entry) => { assert.equal(entry, source); return file; } });
  assert.equal(result.status, 'installed');
  assert.ok(calls.some((args) => args[3] === 'add' && args[4] === file));
  assert.ok(!calls.some((args) => args.some((arg) => String(arg).startsWith('https://'))));
});

test('adapted artifacts must bind their path, digest, and exact package version', () => {
  const sha256 = 'c'.repeat(64);
  const artifact = { path: `assets/alpha/artifacts/${sha256}.tgz`, sha256, packageVersion: '1.2.3-dsh.alpha.1' };
  assert.equal(validateRecipe({ ...item, artifact }).artifact, artifact);
  for (const altered of [{ ...artifact, path: '../unsafe.tgz' }, { ...artifact, sha256: 'd'.repeat(64) }, { ...artifact, packageVersion: 'latest' }]) {
    assert.throws(() => validateRecipe({ ...item, artifact: altered }), /adapted artifact/);
  }
});

test('a reverified adapted archive is reused without add, while altered bytes fail before CLI calls', async () => {
  const bytes = Buffer.from(`Isolated archive-byte fixture ${randomUUID()}`);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const artifact = { path: `assets/alpha/artifacts/${sha256}.tgz`, sha256, packageVersion: '1.2.3-dsh.alpha.1' };
  const file = fileURLToPath(new URL(`../skills/dsh-plugin-installer/${artifact.path}`, import.meta.url));
  // Exclusive creation and exact cleanup keep every real reviewed archive intact.
  await writeFile(file, bytes, { flag: 'wx', mode: 0o600 });
  const calls = [];
  const runDsh = async args => {
    calls.push(args);
    assert.notEqual(args[3], 'add');
    return ok(args[0] === '--version' ? catalog.dshVersion : args[3] === 'list' ? JSON.stringify([{ path: join(fixtureEnvironment.DSH_HOME, 'profiles', 'web'), dependencies: { [item.packageName]: { version: artifact.packageVersion, resolved: `file:${file}` } } }]) : item.packageName);
  };
  const selected = { ...catalog, items: [{ ...item, artifact }] };
  try {
    const result = await installPlugins(selected, { ids: ['#3006'] }, { runDsh, environment: fixtureEnvironment });
    assert.equal(result.items[0].status, 'already-installed');
    assert.ok(calls.some(args => args.includes('--dump-config')));
    await writeFile(file, 'altered local archive bytes');
    calls.length = 0;
    await assert.rejects(installPlugins(selected, { ids: ['#3006'] }, { runDsh, environment: fixtureEnvironment }), /archive digest differs/);
    assert.equal(calls.length, 0);
  } finally { await rm(file); }
});

test('missing local prerequisites fail before package changes and configured paths permit installation', async () => {
  const recipe = { ...item, requiredEnvironmentFiles: ['TEST_TOOL_CLI_PATH'] };
  const current = { ...catalog, items: [recipe] };
  const executor = fakeDsh();
  const missing = await installPlugins(current, { ids: ['#3006'] }, { ...executor, environment: {} });
  assert.equal(missing.status, 'incomplete');
  assert.match(missing.items[0].error, /Set TEST_TOOL_CLI_PATH/);
  assert.ok(!executor.calls.some((args) => args[3] === 'add'));
  const folder = await mkdtemp(join(tmpdir(), 'dsh-plugin-prerequisite-test-'));
  try {
    const file = join(folder, 'tool.mjs');
    await writeFile(file, '// Test fixture; never executed.\n');
    const ready = await installPlugins(current, { ids: ['#3006'] }, { ...fakeDsh(), environment: { ...fixtureEnvironment, TEST_TOOL_CLI_PATH: file } });
    assert.equal(ready.status, 'installed');
  } finally { await rm(folder, { recursive: true, force: true }); }
});
