import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { closeSync, openSync, readFileSync } from 'node:fs';
import {
  cp,
  mkdir,
  readdir,
  readFile,
  statfs,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';
import { format } from 'prettier';

const root = path.resolve(import.meta.dirname, '../../..');
const skillRoot = path.resolve(
  root,
  '../dsh-themes-skills/skills/dsh-community-skin-installer'
);
const pluginRoot = path.resolve(skillRoot, '../dsh-plugin-installer');
const installerPath = path.join(skillRoot, 'scripts/install-alpha.mjs');
const helperPath = path.join(skillRoot, 'scripts/companion-files.mjs');
const executorPath = path.join(pluginRoot, 'scripts/install-plugins.mjs');
const wrapper = path.resolve(
  skillRoot,
  '../dsh-theme-manager/scripts/dsh-alpha.mjs'
);
const work = path.join(
  root,
  '.cache/dsh-skin-center-alpha',
  `public-installation-${Date.now()}`
);
const dshHome = path.join(work, 'profile');
await mkdir(work);
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const implementations = await Promise.all(
  [installerPath, helperPath, executorPath].map(async (file) => ({
    path: path.relative(path.resolve(skillRoot, '../..'), file),
    sha256: sha(await readFile(file)),
  }))
);
const catalogBytes = await readFile(
  path.join(skillRoot, 'references/community-recipes.json')
);
const catalog = JSON.parse(catalogBytes);
const selected = [1101, 2206, 2207].map((id) =>
  catalog.items.find((item) => item.catalogId === id)
);
assert.ok(selected.every(Boolean));
const { installCommunityItems, activateCommunityItem } = await import(
  pathToFileURL(installerPath)
);
const { createDshExecutor } = await import(pathToFileURL(executorPath));
const storeDirectory = process.env.DSH_PUBLIC_INSTALL_STORE_DIR
  ? path.resolve(process.env.DSH_PUBLIC_INSTALL_STORE_DIR)
  : path.join(work, 'pnpm-store');
assert.ok(
  storeDirectory.startsWith(path.join(root, '.cache/dsh-skin-center-alpha') + path.sep),
  'This fixture may only reuse a store inside its own isolated cache root.'
);
const env = {
  ...process.env,
  DSH_HOME: dshHome,
  CI: 'true',
  DSH_TELEMETRY_DISABLED: '1',
  npm_config_offline: process.env.DSH_PUBLIC_INSTALL_OFFLINE ?? 'true',
  PNPM_CONFIG_OFFLINE: process.env.DSH_PUBLIC_INSTALL_OFFLINE ?? 'true',
  PNPM_CONFIG_STORE_DIR: storeDirectory,
};
const execute = createDshExecutor({ env, cwd: root, timeoutMs: 180000 });
const commands = [];
await mkdir(path.join(work, 'commands'));
const runDsh = async (args) => {
  const result = await execute(args);
  const commandId = String(commands.length + 1).padStart(3, '0');
  for (const stream of ['stdout', 'stderr']) await writeFile(path.join(work, 'commands', `${commandId}.${stream}.log`), result[stream], { flag: 'wx', mode: 0o600 });
  commands.push({
    args,
    code: result.code,
    stdoutSha256: sha(Buffer.from(result.stdout)),
    stderrSha256: sha(Buffer.from(result.stderr)),
  });
  if (result.code !== 0)
    console.log(
      JSON.stringify({
        args,
        code: result.code,
        error: result.stderr || result.stdout,
      })
    );
  return result;
};
const free = async () => {
  const s = await statfs(root);
  return Math.floor((s.bavail * s.bsize) / 1048576);
};
const receipt = {
  schemaVersion: 1,
  dshVersion: catalog.dshVersion,
  sourceCommit: 'd347e703908d0406b7a7ef80e3a0e594d86b2215',
  checkedAt: '2026-09-06',
  implementations,
  catalogSha256: sha(catalogBytes),
  catalogIds: selected.map((item) => item.catalogId),
  artifacts: selected.map(
    ({ catalogId, packageName, packageVersion, artifact }) => ({
      catalogId,
      packageName,
      packageVersion,
      ...artifact,
    })
  ),
  commands,
  freeBeforeMiB: await free(),
  dependencies: { lightningcss: '1.32.0', detectLibcOverride: '2.1.2', os: 'darwin', cpu: 'arm64', offline: env.PNPM_CONFIG_OFFLINE === 'true', storeDirectory: path.relative(root, storeDirectory), reusedStore: Boolean(process.env.DSH_PUBLIC_INSTALL_STORE_DIR) },
  status: 'running',
};
const save = async () =>
  writeFile(
    path.join(work, 'receipt.json'),
    await format(JSON.stringify(receipt), { parser: 'json', printWidth: 80 })
  );
const origin = 'http://127.0.0.1:4015';
let serverPid;
const listeners = () =>
  spawnSync('lsof', ['-ti', 'TCP:4015', '-sTCP:LISTEN'], {
    encoding: 'utf8',
  }).stdout.trim();
async function stop() {
  if (serverPid) {
    try {
      process.kill(-serverPid, 'SIGTERM');
    } catch (error) {
      if (error.code !== 'ESRCH') throw error;
    }
  }
  for (let i = 0; i < 100; i++) {
    if (!listeners()) {
      serverPid = undefined;
      return;
    }
    await delay(100);
  }
  throw Error('The public-installation host did not release port 4015.');
}
async function start(label) {
  assert.equal(listeners(), '');
  assert.ok((await free()) >= 400);
  const logPath = path.join(work, `${label}-server.log`);
  const fd = openSync(logPath, 'w', 0o600);
  const child = spawn(
    process.execPath,
    [wrapper, 'web', '--host', '127.0.0.1', '--port', '4015', '--no-open'],
    { cwd: root, env, detached: true, stdio: ['ignore', fd, fd] }
  );
  closeSync(fd);
  child.unref();
  serverPid = child.pid;
  let tokenUrl;
  for (let i = 0; i < 200; i++) {
    tokenUrl = readFileSync(logPath, 'utf8').match(
      /http:\/\/127\.0\.0\.1:4015\/\?token=\S+/
    )?.[0];
    if (tokenUrl && listeners()) break;
    if (child.exitCode !== null)
      throw Error('Official host exited during startup.');
    await delay(100);
  }
  assert.ok(tokenUrl && listeners());
  const cookies = new Map();
  let current = tokenUrl;
  for (let i = 0; i < 6; i++) {
    assert.equal(new URL(current).origin, origin);
    const response = await fetch(current, {
      redirect: 'manual',
      headers: {
        cookie: [...cookies.entries()]
          .map(([key, value]) => `${key}=${value}`)
          .join('; '),
      },
    });
    for (const cookie of response.headers.getSetCookie()) {
      const first = cookie.split(';')[0];
      const split = first.indexOf('=');
      cookies.set(first.slice(0, split), first.slice(split + 1));
    }
    if (response.status >= 300 && response.status < 400) {
      current = new URL(response.headers.get('location'), origin).href;
      continue;
    }
    assert.equal(response.status, 200);
    break;
  }
  assert.ok(
    cookies.size > 0,
    'Official token authentication must issue a session cookie.'
  );
  return async (route, options = {}) => {
    assert.ok(route.startsWith('/api/'));
    const response = await fetch(`${origin}${route}`, {
      ...options,
      redirect: 'manual',
      headers: {
        ...options.headers,
        origin,
        cookie: [...cookies.entries()]
          .map(([key, value]) => `${key}=${value}`)
          .join('; '),
      },
    });
    const text = await response.text();
    return {
      status: response.status,
      body: (() => {
        try {
          return JSON.parse(text);
        } catch {
          return null;
        }
      })(),
    };
  };
}
try {
  assert.ok(
    receipt.freeBeforeMiB >= 600,
    'The known 67MiB package set requires the 600MiB initial floor.'
  );
  assert.equal(
    (
      await runDsh([
        'plugin',
        '--profile',
        'web',
        'list',
        '--depth',
        '0',
        '--json',
      ])
    ).code,
    0
  );
  await writeFile(
    path.join(dshHome, 'profiles/web/pnpm-workspace.yaml'),
    'nodeLinker: hoisted\nautoInstallPeers: false\noverrides:\n  detect-libc: 2.1.2\nsupportedArchitectures:\n  os: [darwin]\n  cpu: [arm64]\n'
  );
  const originals = [];
  for (const item of selected.filter((item) => item.companion)) {
    const target = path.join(dshHome, 'skins', item.companion.skinId);
    await cp(
      path.join(skillRoot, 'assets/skins', item.companion.skinId),
      target,
      { recursive: true }
    );
    originals.push({
      skinId: item.companion.skinId,
      files: await Promise.all(
        (await readdir(target)).sort().map(async (name) => {
          const bytes = await readFile(path.join(target, name));
          return { path: name, sha256: sha(bytes), bytes: bytes.length };
        })
      ),
    });
  }
  receipt.installation = await installCommunityItems(
    catalog,
    { ids: ['#1101', '#2206', '#2207'] },
    { runDsh, dshHome }
  );
  assert.equal(
    receipt.installation.status,
    'installed',
    JSON.stringify(receipt.installation)
  );
  const lockBytes = await readFile(path.join(dshHome, 'profiles/web/pnpm-lock.yaml'));
  await writeFile(path.join(work, 'installed-pnpm-lock.yaml'), lockBytes);
  receipt.installedLockSha256 = sha(lockBytes);
  // Every dependency is now present. Removal and subsequent checks require no
  // registry metadata and must not hang on an unrelated network lookup.
  env.npm_config_offline = 'true';
  env.PNPM_CONFIG_OFFLINE = 'true';
  const offlineConfig = spawnSync('corepack', ['pnpm', 'config', 'get', 'offline'], {
    cwd: path.join(dshHome, 'profiles/web'), env, encoding: 'utf8', timeout: 15000,
  });
  assert.equal(offlineConfig.status, 0, 'The isolated pnpm offline configuration must be readable.');
  assert.equal(offlineConfig.stdout.trim(), 'true', 'pnpm must actually resolve the lifecycle offline policy.');
  receipt.dependencies.lifecycleOffline = true;
  receipt.dependencies.lifecycleOfflineObserved = offlineConfig.stdout.trim();
  receipt.dependencies.lifecycleOfflinePolicy = 'PNPM_CONFIG_OFFLINE=true; configuration observed, not a packet-capture claim';
  const addCalls = commands.filter(
    (command) => command.args[0] === 'plugin' && command.args[3] === 'add'
  );
  assert.equal(
    addCalls.length,
    2,
    'One palette archive and one shared Skin Center archive should be installed.'
  );
  receipt.installedCompanions = [];
  for (const item of selected.filter((item) => item.companion)) {
    const files = [];
    for (const file of item.companion.files) {
      const bytes = await readFile(
        path.join(dshHome, 'skins', item.companion.skinId, file.path)
      );
      assert.equal(sha(bytes), file.sha256);
      assert.equal(bytes.length, file.bytes);
      files.push(file);
    }
    receipt.installedCompanions.push({
      catalogId: item.catalogId,
      skinId: item.companion.skinId,
      files,
    });
  }
  await save();
  const request = await start('installed');
  receipt.activations = [];
  for (const item of selected) {
    const activation = await activateCommunityItem(item, { request });
    assert.equal(activation.status, 'selected');
    const observed = await request(item.activation.request.path);
    assert.equal(observed.status, 200);
    if (item.catalogId === 1101)
      assert.equal(observed.body.selection, item.activation.themeId);
    else assert.equal(observed.body.active, item.skinId);
    const palette = await request('/api/dsh-community-palettes/theme-pack');
    if (item.catalogId !== 1101) assert.equal(palette.body.selection, 'off');
    receipt.activations.push({
      catalogId: item.catalogId,
      status: activation.status,
      observedSelection: observed.body.selection ?? observed.body.active,
      themePackSelection: palette.body.selection,
    });
  }
  await stop();
  // The originals are isolated copies of public fixture assets, never user data.
  // Exercise a real interrupted recovery without another package installation.
  const conflictItem = selected.find((item) => item.catalogId === 2206);
  const conflictPath = path.join(dshHome, 'skins', conflictItem.companion.skinId, 'patches.css');
  const managedBytes = await readFile(conflictPath);
  const editedBytes = Buffer.concat([managedBytes, Buffer.from('\n/* isolated recovery-conflict fixture */\n')]);
  await writeFile(conflictPath, editedBytes);
  const conflictRemoval = await installCommunityItems(
    catalog,
    { ids: ['#1101', '#2206', '#2207'], remove: true },
    { runDsh, dshHome }
  );
  assert.equal(conflictRemoval.status, 'incomplete');
  assert.match(conflictRemoval.items.find((item) => item.catalogId === 2206).error, /Companion bytes differ/);
  assert.equal(sha(await readFile(conflictPath)), sha(editedBytes));
  const absent = await runDsh(['plugin', '--profile', 'web', 'list', '--depth', '0', '--json']);
  assert.equal(absent.code, 0);
  assert.ok(JSON.parse(absent.stdout).every((profile) => !profile.dependencies?.[conflictItem.packageName]));
  receipt.recoveryConflict = {
    fixtureOnly: true,
    catalogId: conflictItem.catalogId,
    managedFileSha256: sha(managedBytes),
    editedFileSha256: sha(editedBytes),
    firstAttempt: conflictRemoval,
    packageAbsentAfterFirstAttempt: true,
    editedFilePreserved: true,
  };
  await save();
  await writeFile(conflictPath, managedBytes);
  assert.equal(sha(await readFile(conflictPath)), sha(managedBytes));
  receipt.removal = await installCommunityItems(
    catalog,
    { ids: ['#1101', '#2206', '#2207'], remove: true },
    { runDsh, dshHome }
  );
  assert.equal(
    receipt.removal.status,
    'removed',
    JSON.stringify(receipt.removal)
  );
  const removeCalls = commands.filter(
    (command) => command.args[0] === 'plugin' && command.args[3] === 'remove'
  );
  assert.equal(removeCalls.length, 2);
  assert.equal(
    removeCalls.filter((command) => command.args[4] === selected[1].packageName)
      .length,
    1
  );
  assert.equal(receipt.removal.items[2].status, 'already-removed');
  receipt.recoveryConflict.editResolvedToReviewedBytes = true;
  receipt.recoveryConflict.publicEntryRetrySucceeded = true;
  receipt.restoredCompanions = [];
  for (const original of originals) {
    const target = path.join(dshHome, 'skins', original.skinId);
    assert.deepEqual(
      (await readdir(target)).sort(),
      original.files.map((file) => file.path)
    );
    const files = [];
    for (const file of original.files) {
      const bytes = await readFile(path.join(target, file.path));
      assert.equal(sha(bytes), file.sha256);
      assert.equal(bytes.length, file.bytes);
      files.push(file);
    }
    receipt.restoredCompanions.push({ skinId: original.skinId, files });
  }
  const requestRemoved = await start('removed');
  receipt.removedRoutes = [];
  for (const route of [
    '/api/dsh-community-palettes/theme-pack',
    '/api/skin-center/v2/active',
    '/api/skin-center/v2/skins/qq98/stylesheet',
    '/api/skin-center/v2/skins/ths/stylesheet',
  ]) {
    const response = await requestRemoved(route);
    assert.equal(response.status, 404);
    receipt.removedRoutes.push({ path: route, status: response.status });
  }
  await stop();
  for (const implementation of implementations)
    assert.equal(
      sha(
        await readFile(path.resolve(skillRoot, '../..', implementation.path))
      ),
      implementation.sha256
    );
  receipt.freeAfterMiB = await free();
  assert.ok(receipt.freeAfterMiB >= 400);
  receipt.status = 'passed';
  receipt.scope =
    'Actual public installCommunityItems and activateCommunityItem calls using official CLI and authenticated local HTTP. Exact bundled archives and the declared pinned native dependency policy use an isolated package store; the installed lockfile is retained by SHA. Shared package add/remove are deduplicated. A controlled edit in an isolated fixture blocks restoration after package removal; resolving that edit and retrying the public entry restores both original companion directories byte-for-byte without repeating package removal. No browser or feature coverage is claimed beyond earlier frozen runtime receipts.';
  await save();
  if (process.env.DSH_PUBLIC_INSTALL_CANDIDATE_ONLY === 'true') {
    console.log(JSON.stringify({ status: receipt.status, candidateOnly: true, path: path.relative(root, path.join(work, 'receipt.json')), sha256: sha(await readFile(path.join(work, 'receipt.json'))) }));
    process.exitCode = 0;
  } else {
  const output = path.join(
    import.meta.dirname,
    'public-installation-receipt.json'
  );
  const previous = await readFile(output).catch((error) => { if (error.code === 'ENOENT') return null; throw error; });
  if (previous) {
    const history = path.join(import.meta.dirname, 'history');
    await mkdir(history, { recursive: true });
    const historical = path.join(history, `public-installation-${sha(previous)}.json`);
    try { await writeFile(historical, previous, { flag: 'wx' }); }
    catch (error) { if (error.code !== 'EEXIST') throw error; assert.equal(sha(await readFile(historical)), sha(previous)); }
  }
  await cp(path.join(work, 'receipt.json'), output);
  console.log(
    JSON.stringify({
      status: receipt.status,
      path: path.relative(root, output),
      sha256: sha(await readFile(output)),
      addCalls: addCalls.length,
      removeCalls: removeCalls.length,
      restoredFiles: originals.reduce(
        (sum, item) => sum + item.files.length,
        0
      ),
    })
  );
  }
} catch (error) {
  receipt.status = 'failed';
  receipt.error = String(error.message).replace(
    /([?&]token=)[^&\s]+/g,
    '$1[redacted]'
  );
  await save();
  throw error;
} finally {
  await stop();
}
