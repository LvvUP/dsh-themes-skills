import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { closeSync, openSync } from 'node:fs';
import { mkdir, readFile, realpath, statfs, writeFile } from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Prepared only. Execution needs a final verified catalog SHA and root's window.
const ownPath = fileURLToPath(import.meta.url);
const preparedRoot = path.dirname(ownPath);
const root = path.resolve(preparedRoot, '../..');
const publicRoot = path.resolve(root, '../dsh-themes-skills');
const skill = path.join(publicRoot, 'skills/dsh-community-skin-installer');
const installerPath = path.join(skill, 'scripts/install-alpha.mjs');
const executorPath = path.join(publicRoot, 'skills/dsh-plugin-installer/scripts/install-plugins.mjs');
const launcherPath = path.join(publicRoot, 'skills/dsh-theme-manager/scripts/dsh-alpha.mjs');
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const args = process.argv.slice(2);
assert.equal(args.length, 3, 'Use --execute --expected-catalog-sha ACTUAL_FINAL_SHA after root releases the runtime window.');
assert.equal(args[0], '--execute');
assert.equal(args[1], '--expected-catalog-sha');
assert.match(args[2], /^[a-f0-9]{64}$/);
const inputsPath = path.join(preparedRoot, 'upgrade-inputs.json');
const inputsBytes = await readFile(inputsPath);
assert.equal(hash(inputsBytes), '849df1eec029f241fb92853ec0d2b8712099496d923b3c18cea8803307be8c3f');
const inputs = JSON.parse(inputsBytes);
const catalogPath = path.join(skill, 'references/community-recipes.json');
const catalogBytes = await readFile(catalogPath);
assert.equal(hash(catalogBytes), args[2]);
const catalog = JSON.parse(catalogBytes);
assert.equal(catalog.items.length, 38);
const selected = inputs.catalogIds.map(id => catalog.items.find(item => item.catalogId === id));
assert.equal(selected.length, 15);
const sourceInputs = [ownPath, inputsPath, catalogPath, ...inputs.frozenHelpers.map(item => path.join(publicRoot, item.path))];
for (const helper of inputs.frozenHelpers) assert.equal(hash(await readFile(path.join(publicRoot, helper.path))), helper.sha256);
for (const item of selected) {
  assert.equal(item.validation.status, 'runtime-verified');
  const fixed = inputs.packages.find(p => p.packageName === item.packageName);
  assert.ok(fixed);
  assert.equal(item.packageVersion, fixed.new.version);
  assert.equal(item.artifact.sha256, fixed.new.artifactSha256);
  assert.equal(path.join(skill, item.artifact.path), path.join(publicRoot, fixed.new.artifactPath));
  const receiptPath = path.join(skill, item.validation.runtimeReceipt);
  const bytes = await readFile(receiptPath);
  assert.equal(hash(bytes), item.validation.runtimeReceiptSha256);
  const receipt = JSON.parse(bytes);
  assert.equal(receipt.status, 'runtime-verified');
  assert.ok(receipt.packages.some(p => p.packageName === item.packageName && p.version === item.packageVersion && p.artifactSha256 === item.artifact.sha256));
  sourceInputs.push(receiptPath);
}
for (const pkg of inputs.packages) for (const stage of ['old', 'new']) assert.equal(hash(await readFile(path.join(publicRoot, pkg[stage].artifactPath))), pkg[stage].artifactSha256);
const freeMiB = async () => { const s = await statfs(root); return Math.floor(s.bavail * s.bsize / 1048576); };
function portClosed(port) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: '127.0.0.1', port });
    socket.setTimeout(1500);
    socket.once('connect', () => { socket.destroy(); resolve(false); });
    socket.once('timeout', () => { socket.destroy(); reject(Error('Port probe timed out; no closure is inferred.')); });
    socket.once('error', error => { socket.destroy(); error.code === 'ECONNREFUSED' ? resolve(true) : reject(error); });
  });
}
assert.ok(await freeMiB() >= 700, 'Known local four-package upgrade requires the 700 MiB starting floor.');
for (const port of [3427, 3428, 4015]) assert.ok(await portClosed(port), `Port ${port} is occupied; wait for the assigned serial window.`);
const work = path.join(preparedRoot, 'upgrade-runs', `attempt-${Date.now()}-${randomUUID()}`);
const dshHome = path.join(work, 'profile');
await mkdir(path.join(work, 'commands'), { recursive: true });
await mkdir(path.join(work, 'snapshots'));
const snapshots = [];
for (const file of new Set(sourceInputs)) {
  const bytes = await readFile(file); const digest = hash(bytes);
  const target = path.join(work, 'snapshots', `${snapshots.length}-${path.basename(file)}`);
  await writeFile(target, bytes, { flag: 'wx', mode: 0o600 });
  snapshots.push({ sourcePath: path.relative(root, file), path: path.relative(work, target), sha256: digest });
}
const environment = { ...process.env, DSH_HOME: dshHome, CI: 'true', DSH_TELEMETRY_DISABLED: '1', PNPM_CONFIG_OFFLINE: 'true', PNPM_CONFIG_STORE_DIR: path.join(work, 'pnpm-store') };
const { createDshExecutor, parsePluginList } = await import(pathToFileURL(executorPath));
const { installCommunityItems, activateCommunityItem } = await import(pathToFileURL(installerPath));
const execute = createDshExecutor({ env: environment, cwd: root, timeoutMs: 180000 });
const commands = [];
const receipt = { schemaVersion: 1, status: 'running', catalogSha256: hash(catalogBytes), catalogIds: inputs.catalogIds, dshVersion: catalog.dshVersion, snapshots, packages: inputs.packages, commands, profile: path.relative(root, dshHome), startedAt: new Date().toISOString(), sourceCommit: 'd347e703908d0406b7a7ef80e3a0e594d86b2215', webStartedBeforeNewPackageBytesVerified: false };
const save = async () => writeFile(path.join(work, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n', { mode: 0o600 });
async function runDsh(command) {
  assert.ok(await freeMiB() >= 400, '400 MiB hard floor reached.');
  assert.ok(command[0] === 'plugin' || command[0] === '--version' || command[0] === '--profile' || command[0] === '--check-build', 'Only fixed CLI lifecycle commands are permitted.');
  const result = await execute(command);
  const number = String(commands.length + 1).padStart(3, '0');
  for (const stream of ['stdout', 'stderr']) await writeFile(path.join(work, 'commands', `${number}.${stream}.log`), result[stream], { flag: 'wx', mode: 0o600 });
  commands.push({ args: command, code: result.code, stdoutSha256: hash(Buffer.from(result.stdout)), stderrSha256: hash(Buffer.from(result.stderr)) });
  await save();
  return result;
}
const success = (result) => { assert.equal(result.code, 0, 'Official CLI failed; private command logs retain the real diagnostic.'); return result; };
async function listing() {
  const result = success(await runDsh(['plugin', '--profile', 'web', 'list', '--depth', '0', '--json']));
  const profiles = JSON.parse(result.stdout);
  assert.equal(profiles.length, 1);
  assert.equal(profiles[0].path, path.join(dshHome, 'profiles/web'));
  return parsePluginList(result.stdout);
}
async function verifyInstalled(stage) {
  const dependencies = await listing();
  const records = [];
  for (const pkg of inputs.packages) {
    const expected = pkg[stage];
    assert.equal(dependencies[pkg.packageName]?.version, expected.version);
    const directory = await realpath(path.join(dshHome, 'profiles/web/node_modules', pkg.packageName));
    assert.ok(directory.startsWith(path.join(dshHome, 'profiles/web') + path.sep));
    const files = [];
    for (const file of expected.files) {
      const target = await realpath(path.join(directory, file.path));
      assert.ok(target.startsWith(directory + path.sep));
      const bytes = await readFile(target);
      assert.equal(hash(bytes), file.sha256); assert.equal(bytes.length, file.bytes);
      files.push(file);
    }
    records.push({ packageName: pkg.packageName, version: expected.version, artifactSha256: expected.artifactSha256, files });
  }
  return records;
}
function readSelection(route, body) {
  const selected = route === '/api/dsh-community-palettes/premium/palette' ? body?.palette : body?.selection;
  assert.equal(typeof selected, 'string', 'Palette response must expose its real selection field.');
  return selected;
}
function safeError(error) {
  return {
    name: String(error?.name ?? 'Error').slice(0, 80),
    message: String(error?.message ?? error)
      .replace(/([?&](?:token|access_token|api_key|authorization)=)[^&\s"'<>]+/gi, '$1[redacted]')
      .replace(/(?:["']?(?:set-cookie|cookie|authorization)["']?)\s*[:=]\s*[^\r\n]*/gi, '[credential header redacted]')
      .slice(0, 8000),
  };
}
const ids = selected.map(item => `#${item.catalogId}`);
const origin = 'http://127.0.0.1:3428';
let server;
let serverClosed;
let newBytesVerified = false;
async function stop() {
  if (!server) return;
  const child = server;
  if (child.exitCode === null && child.signalCode === null) {
    try { process.kill(-child.pid, 'SIGTERM'); } catch (error) { if (error.code !== 'ESRCH') throw error; }
  }
  let timeout;
  try { await Promise.race([serverClosed, new Promise((_, reject) => { timeout = setTimeout(() => reject(Error('Owned host did not exit after SIGTERM.')), 15000); })]); } finally { clearTimeout(timeout); }
  assert.ok(await portClosed(3428));
  server = undefined;
}
async function start(label) {
  assert.ok(newBytesVerified, 'Never start the old package Web profile.');
  assert.ok(await portClosed(3428));
  assert.ok(await freeMiB() >= 400);
  const logPath = path.join(work, `${label}.server.log`);
  const fd = openSync(logPath, 'wx', 0o600);
  server = spawn(process.execPath, [launcherPath, 'web', '--host', '127.0.0.1', '--port', '3428', '--no-open'], { cwd: root, env: environment, detached: true, stdio: ['ignore', fd, fd] });
  closeSync(fd);
  let startupError;
  serverClosed = new Promise(resolve => { server.once('close', resolve); server.once('error', error => { startupError = error; resolve(); }); });
  let tokenUrl;
  for (let i = 0; i < 300; i++) {
    assert.ok(!startupError, 'Official new Web process could not start.');
    assert.equal(server.exitCode, null, 'Official new Web host exited during startup.');
    tokenUrl = (await readFile(logPath, 'utf8')).match(/http:\/\/127\.0\.0\.1:3428\/\?token=\S+/)?.[0];
    if (tokenUrl && !await portClosed(3428)) break;
    await delay(100);
  }
  assert.ok(tokenUrl);
  const listen = spawnSync('lsof', ['-ti', 'TCP:3428', '-sTCP:LISTEN'], { encoding: 'utf8' });
  assert.equal(listen.status, 0);
  const owners = [...new Set(listen.stdout.trim().split(/\s+/).map(Number))];
  for (const pid of owners) {
    let current = pid; const chain = [];
    for (let i = 0; i < 20; i++) {
      chain.push(current); if (current === server.pid) break;
      const parent = spawnSync('ps', ['-o', 'ppid=', '-p', String(current)], { encoding: 'utf8' });
      assert.equal(parent.status, 0); current = Number(parent.stdout.trim()); assert.ok(current > 1);
    }
    assert.ok(chain.includes(server.pid), 'The listener must belong to this created official host process.');
    (receipt.hosts ??= []).push({ phase: label, launcherPid: server.pid, listenerPid: pid, parentChain: chain });
  }
  const cookies = new Map(); let current = tokenUrl; let complete = false;
  for (let i = 0; i < 6; i++) {
    assert.equal(new URL(current).origin, origin);
    const response = await fetch(current, { redirect: 'manual', signal: AbortSignal.timeout(10000), headers: { cookie: [...cookies].map(([key, value]) => `${key}=${value}`).join('; ') } });
    for (const cookie of response.headers.getSetCookie()) { const first = cookie.split(';')[0]; const separator = first.indexOf('='); assert.ok(separator > 0); cookies.set(first.slice(0, separator), first.slice(separator + 1)); }
    await response.arrayBuffer();
    if (response.status >= 300 && response.status < 400) { const location = response.headers.get('location'); assert.ok(location); current = new URL(location, origin).href; continue; }
    assert.equal(response.status, 200); complete = true; break;
  }
  assert.ok(complete && cookies.size > 0, 'Official bootstrap must complete and issue its real session cookie.');
  return async (route, options = {}) => {
    assert.match(route, /^\/api\/dsh-community-palettes\/[a-z-]+(?:\/palette)?$/);
    const response = await fetch(origin + route, { ...options, redirect: 'manual', signal: AbortSignal.timeout(10000), headers: { ...options.headers, origin, cookie: [...cookies].map(([key, value]) => `${key}=${value}`).join('; ') } });
    const text = await response.text(); let body = null;
    try { body = JSON.parse(text); } catch {}
    return { status: response.status, body };
  };
}
let clean = false;
try {
  success(await runDsh(['--check-build']));
  assert.ok(success(await runDsh(['--version'])).stdout.split(/\s+/).includes(catalog.dshVersion));
  assert.deepEqual(await listing(), {});
  const workspaceBytes = await readFile(path.join(dshHome, 'profiles/web/pnpm-workspace.yaml'));
  assert.match(workspaceBytes.toString(), /^nodeLinker: hoisted$/m);
  assert.match(workspaceBytes.toString(), /^autoInstallPeers: false$/m);
  const offline = spawnSync('corepack', ['pnpm', 'config', 'get', 'offline'], { cwd: path.join(dshHome, 'profiles/web'), env: environment, encoding: 'utf8', timeout: 15000 });
  assert.equal(offline.status, 0); assert.equal(offline.stdout.trim(), 'true');
  receipt.packageManagerPolicy = { workspaceSha256: hash(workspaceBytes), offlineObserved: offline.stdout.trim(), scope: 'Official profile defaults retained; PNPM_CONFIG_OFFLINE read back from the isolated profile, not a packet-capture claim.' };
  receipt.oldInstallation = [];
  for (const pkg of inputs.packages) {
    success(await runDsh(['plugin', '--profile', 'web', 'add', path.join(publicRoot, pkg.old.artifactPath), '--save-exact']));
    receipt.oldInstallation.push({ packageName: pkg.packageName, artifactSha256: pkg.old.artifactSha256 });
  }
  receipt.oldInstalledBytes = await verifyInstalled('old');
  const startCommand = commands.length;
  receipt.upgrade = await installCommunityItems(catalog, { ids }, { runDsh, dshHome });
  assert.equal(receipt.upgrade.status, 'installed');
  const upgradeAdds = commands.slice(startCommand).filter(c => c.args[0] === 'plugin' && c.args[3] === 'add');
  assert.equal(upgradeAdds.length, 4);
  assert.equal(receipt.upgrade.items.filter(x => x.status === 'installed').length, 4);
  assert.equal(receipt.upgrade.items.filter(x => x.status === 'already-installed').length, 11);
  receipt.upgradeAddCalls = upgradeAdds;
  receipt.newInstalledBytes = await verifyInstalled('new');
  newBytesVerified = true;
  await save();
  let request = await start('upgraded');
  receipt.activations = [];
  for (const item of selected) {
    const activation = await activateCommunityItem(item, { request });
    assert.equal(activation.status, 'selected');
    const observed = await request(item.activation.request.path);
    assert.equal(observed.status, 200); assert.equal(readSelection(item.activation.request.path, observed.body), item.activation.themeId);
    receipt.activations.push({ catalogId: item.catalogId, status: activation.status, observedSelection: readSelection(item.activation.request.path, observed.body) });
  }
  const routes = [...new Set(selected.map(item => item.activation.request.path))];
  const before = {};
  for (const route of routes) { const result = await request(route); assert.equal(result.status, 200); before[route] = readSelection(route, result.body); }
  await stop(); request = await start('upgraded-cold-restart');
  const after = {};
  for (const route of routes) { const result = await request(route); assert.equal(result.status, 200); after[route] = readSelection(route, result.body); }
  assert.deepEqual(after, before);
  receipt.coldRestart = { status: 'passed', beforeSelections: before, afterSelections: after, scope: 'One actual cold restart of the last selected #1203 state across all four palette APIs.' };
  await stop();
  const beforeRemove = commands.length;
  receipt.removal = await installCommunityItems(catalog, { ids, remove: true }, { runDsh, dshHome });
  assert.equal(receipt.removal.status, 'removed');
  assert.equal(commands.slice(beforeRemove).filter(c => c.args[0] === 'plugin' && c.args[3] === 'remove').length, 4);
  const beforeRepeat = commands.length;
  receipt.repeatedRemoval = await installCommunityItems(catalog, { ids, remove: true }, { runDsh, dshHome });
  assert.equal(receipt.repeatedRemoval.status, 'removed');
  assert.equal(commands.slice(beforeRepeat).filter(c => c.args[0] === 'plugin' && c.args[3] === 'remove').length, 0);
  assert.deepEqual(await listing(), {});
  request = await start('removed-cold-restart');
  receipt.removedRoutes = [];
  for (const route of routes) { const response = await request(route); assert.equal(response.status, 404); receipt.removedRoutes.push({ route, status: response.status }); }
  await stop(); clean = true;
  for (const snapshot of snapshots) assert.equal(hash(await readFile(path.resolve(root, snapshot.sourcePath))), snapshot.sha256);
  receipt.cleanup = { officialPackageRemoval: true, repeatedRemoveCalls: 0, port3428Closed: await portClosed(3428) };
  receipt.status = 'passed';
  receipt.scope = 'Real official CLI old four-package installation without old Web startup, unchanged public installCommunityItems upgrade of 15 IDs with four add calls, exact installed file checks, legitimate new-Web authentication, 15 actual API selections, one last-state cold restart, official removal and repeat removal, and absent routes after cold restart. No browser, screenshot, model, account or visual claims.';
} catch (error) {
  receipt.status = 'failed'; receipt.error = safeError(error);
  process.exitCode = 1;
} finally {
  try { await stop(); } catch { receipt.stopFailed = true; receipt.status = 'failed'; process.exitCode = 1; }
  if (!clean) {
    try { receipt.failureCleanup = await installCommunityItems(catalog, { ids, remove: true }, { runDsh, dshHome }); }
    catch { receipt.failureCleanup = { status: 'incomplete' }; }
  }
  receipt.completedAt = new Date().toISOString(); receipt.freeAfterMiB = await freeMiB();
  await save();
  console.log(JSON.stringify({ status: receipt.status, path: path.relative(root, path.join(work, 'receipt.json')), sha256: hash(await readFile(path.join(work, 'receipt.json'))) }));
}
