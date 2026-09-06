import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const source = join(root, 'source');
const sha = data => createHash('sha256').update(data).digest('hex');
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === '@deepseek-ai/dsh-storage-domain') {
      return { url: 'data:text/javascript,export const defineDomain = s => s; export const domainTable = s => ({schema:s});', shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});
const { computerUseSessionStateSchema: schema } = await import('./source/lib/leases.js');
hooks.deregister();

test('fixture: actual bundled schema preserves valid lease rows and rejects unsafe timestamps', () => {
  const valid = { session: { createdAt: 42, cwd: '/fixture-only' }, readGrants: ['fixture.app'], denied: [{ bundleId: 'fixture.other', scope: 'control' }] };
  assert.deepEqual(schema.parse(valid), valid);
  for (const createdAt of [-1, 1.5, Number.MAX_SAFE_INTEGER + 1, NaN, Infinity]) {
    assert.equal(schema.safeParse({ ...valid, session: { createdAt } }).success, false);
  }
});

test('fixture: actual bundled schema rejects duplicate grants/denials and malformed permissions', () => {
  const base = { session: { createdAt: 1 }, readGrants: [], denied: [] };
  for (const row of [
    { ...base, readGrants: ['a', 'a'] },
    { ...base, readGrants: [''] },
    { ...base, denied: [{ bundleId: 'a', scope: 'read' }, { bundleId: 'a', scope: 'read' }] },
    { ...base, denied: [{ bundleId: 'a', scope: 'execute' }] },
  ]) assert.equal(schema.safeParse(row).success, false);
  assert.equal(schema.safeParse({ ...base, denied: [{ bundleId: 'a', scope: 'read' }, { bundleId: 'a', scope: 'control' }] }).success, true);
});

test('static: original native binary and Swift source hashes remain exact and executable', () => {
  const native = join(source, 'native/macos');
  const manifest = JSON.parse(readFileSync(join(native, 'manifest.json')));
  const binary = join(native, manifest.binary.path);
  assert.equal(sha(readFileSync(binary)), manifest.binary.sha256);
  assert.equal(statSync(binary).mode & 0o777, 0o755);
  const h = createHash('sha256');
  const swift = join(native, 'Sources/Helper');
  for (const name of readdirSync(swift).filter(f => f.endsWith('.swift')).sort()) {
    h.update(name).update('\0').update(readFileSync(join(swift, name))).update('\0');
  }
  assert.equal(h.digest('hex'), manifest.sourceSha256);
  assert.deepEqual(manifest.binary.architectures, ['arm64', 'x86_64']);
  assert.equal(manifest.binary.minimumMacOS, '14.0');
});

test('static: complete runtime graph, package exports and Alpha aliases are present', () => {
  const files = [];
  function walk(path) {
    for (const name of readdirSync(path)) {
      const f = join(path, name);
      if (statSync(f).isDirectory()) walk(f);
      else if (name.endsWith('.js')) files.push(f);
    }
  }
  walk(join(source, 'lib'));
  assert.equal(files.length, 20);
  for (const file of files) {
    const body = readFileSync(file, 'utf8');
    for (const m of body.matchAll(/(?:from\s*|import\s*\(\s*)["'](\.[^"']+)["']/g)) {
      assert.equal(statSync(resolve(dirname(file), m[1])).isFile(), true, `${file}: ${m[1]}`);
    }
  }
  const pkg = JSON.parse(readFileSync(join(source, 'package.json')));
  function checkExports(v) {
    if (typeof v === 'string') assert.equal(statSync(join(source, v)).isFile(), true, v);
    else for (const x of Object.values(v)) checkExports(x);
  }
  checkExports(pkg.exports);
  assert.equal(pkg.dependencies, undefined);
  assert.equal(pkg.scripts, undefined);
  assert.equal(pkg.peerDependencies, undefined);
  assert.equal(pkg.dsh.client.inject.includes('@deepseek-ai/dsh-client-ui-renderer'), true);
  const client = readFileSync(join(source, 'lib/client.js'), 'utf8');
  assert.doesNotMatch(client, /--dsw-alias-(?:border-subtle|fg-muted)/);
  assert.match(client, /--dsw-alias-border-l1/);
  assert.match(client, /--dsw-alias-label-secondary/);
});

// This fixture imports only pure configuration with the real fixed Alpha
// Schemastery package. No service or native-provider module is evaluated.
test('fixture: configuration loads against real Alpha Schemastery and preserves settings validation', {skip: !process.env.DSH_ALPHA_FIXTURE_ROOT}, async () => {
  const {pathToFileURL}=await import('node:url');
  const resolver=registerHooks({resolve(specifier,context,nextResolve){
    if(specifier==='@deepseek-ai/schemastery')return {url:pathToFileURL(join(process.env.DSH_ALPHA_FIXTURE_ROOT,'vendor/schemastery/lib/index.mjs')).href,shortCircuit:true};
    return nextResolve(specifier,context);
  }});
  let config;
  try {config=await import('./source/lib/config.js');} finally {resolver.deregister();}
  assert.equal(config.COMPUTER_USE_SETTINGS_NAMESPACE,'computer-use');
  const defaults=config.resolveConfig(config.Config({}));
  assert.equal(defaults.helper.allowSourceBuild,false);
  assert.equal(defaults.allowAllApps,false);
  assert.equal(defaults.interaction.pointerInputPolicy,'targeted');
  assert.deepEqual(defaults.grants,[]);
  const changed=config.resolveConfig(config.Config({helper:{path:'/fixture-only/helper',allowSourceBuild:false},interaction:{focusPolicy:'activate',cursorVisualization:'hidden'},grants:[{bundleId:'fixture.app',control:true}]}));
  assert.equal(changed.helper.path,'/fixture-only/helper');
  assert.equal(changed.interaction.focusPolicy,'activate');
  assert.equal(changed.interaction.cursorVisualization,'hidden');
  assert.deepEqual(changed.grants,[{bundleId:'fixture.app',read:true,control:true}]);
  for(const input of [{grants:[{bundleId:'*'}]},{grants:[{bundleId:'a'},{bundleId:'a'}]},{actionTimeoutMs:0},{interaction:{focusPolicy:'invalid'}}])assert.throws(()=>config.resolveConfig(input));
});

test('static: Alpha settings retains live watch, revision conflicts, same-origin route and complete UI',()=>{
  const config=readFileSync(join(source,'lib/config.js'),'utf8');
  assert.doesNotMatch(config,/settingsNamespace|dsh-settings/);
  const provider=readFileSync(join(source,'lib/providers/macos.js'),'utf8');
  assert.match(provider,/settings\.register\(COMPUTER_USE_SETTINGS_NAMESPACE/);
  assert.match(provider,/applies: 'live'/);
  assert.match(provider,/\.watch\(/);
  const web=readFileSync(join(source,'lib/web.js'),'utf8');
  assert.match(web,/settings\.replace\(COMPUTER_USE_SETTINGS_NAMESPACE/);
  assert.match(web,/SettingsConflictError/);
  assert.match(web,/sameOriginPost\(req\)/);
  const client=readFileSync(join(source,'lib/client.js'),'utf8');
  assert.match(client,/settings\/document-updated/);
  assert.match(client,/connection\/reset/);
  assert.match(client,/slots\.inject\('settings.section'/);
  assert.match(client,/SettingsSection/);
});
