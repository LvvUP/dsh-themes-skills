import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, writeFile, rm, realpath } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import test from 'node:test';
import { ALPHA_SOURCE, readAlphaRuntime } from '../skills/dsh-theme-manager/scripts/dsh-alpha.mjs';
import { alphaRuntimeProjection, validateAlphaRelease, loadAlphaHostedAuthority } from '../skills/dsh-theme-manager/scripts/alpha-authority.mjs';
import { runFinder } from '../skills/dsh-theme-finder/scripts/find-themes.mjs';
import { assertActiveTheme, validateAlphaRecovery, createAlphaRecovery, alphaRestorePlan } from '../skills/dsh-theme-manager/scripts/alpha-state.mjs';

test('source runtime has independent evidence and grants no item installation by itself', () => {
  const runtime = readAlphaRuntime();
  assert.equal(runtime.status, 'verified-source-runtime');
  assert.equal(runtime.itemAuthority, 'separate-receipt-required');
  assert.equal(runtime.compatibility.npmArtifacts, null);
  assert.equal(runtime.compatibility.officialRelease.sourceCommit, ALPHA_SOURCE.commit);
  assert.equal(alphaRuntimeProjection().distribution, 'source');
  assert.throws(() => validateAlphaRelease({ verified: false, manifest: {} }, 'https://dsh-themes.com'), /mismatched runtime/);
});

test('Alpha discovery uses one public number and preserves a missing number without replacement', async () => {
  const known = await runFinder(['--selection', '#3004', '--dsh-version', ALPHA_SOURCE.version, '--locale', 'es']);
  assert.equal(known.count, 1);
  assert.equal(known.selection.authority, 'unique-catalog-id');
  assert.equal(known.items[0].installer, 'dsh-plugin-installer');
  assert.equal(known.items[0].handoff.catalogId, 3004);
  const missing = await runFinder(['--selection', '#9999', '--dsh-version', ALPHA_SOURCE.version]);
  assert.equal(missing.count, 0);
  assert.equal(missing.installableResultsAllowed, false);
  assert.match(missing.reason, /never reassigned/);
});

test('Alpha recovery refuses profile ambiguity, unexpected later selections and historical records', async () => {
  const installed = (dependencies) => [{ name: 'dsh-profile-web', dependencies }];
  const previous = { packageName: '@dsh-themes/deep-ocean', version: '1.2.1-alpha.1' };
  assertActiveTheme(installed({ '@dsh-themes/deep-ocean': { resolvedVersion: '1.2.1-alpha.1' }, 'unrelated-plugin': '2.0.0' }), previous);
  assertActiveTheme(installed({ 'unrelated-plugin': '2.0.0' }), null);
  assert.throws(() => assertActiveTheme(installed({ '@dsh-themes/jade-circuit': '1.2.1-alpha.1' }), previous), /differs/);
  assert.throws(() => assertActiveTheme(installed({ '@dsh-themes/deep-ocean': '^1.2.1-alpha.1' }), previous), /exact semantic version/);
  assert.throws(() => assertActiveTheme(installed({ '@dsh-themes/deep-ocean': '1.2.1-alpha.1', '@dsh-themes/jade-circuit': '1.2.1-alpha.1' }), previous), /Multiple/);
  await assert.rejects(validateAlphaRecovery({ schemaVersion: 2, profile: 'web', dshPackageVersion: '0.1.0-rc.8' }), /verification is incomplete|Unsupported Alpha recovery/);
});

test('Alpha recovery snapshots exact packages, handles partial installs, and rejects modified bytes', async () => {
  const entries = loadAlphaHostedAuthority().entries;
  const entry = (slug) => {
    const item = entries.find((item) => item.slug === slug);
    return { packageName: item.packageName, version: item.version, artifactSha256: item.artifactSha256,
      artifactPath: fileURLToPath(new URL(`fixtures/${slug}-${item.version}.tgz`, import.meta.url)) };
  };
  const dir = await mkdtemp(path.join(os.tmpdir(), 'dsh-alpha-recovery-'));
  const cwd = process.cwd();
  const list = (item) => [{name: 'dsh-profile-web', dependencies: item ? {[item.packageName]: item.version, 'unrelated-plugin': '1.0.0'} : {'unrelated-plugin': '1.0.0'}}];
  try {
    process.chdir(await realpath(dir));
    const previous = entry('deep-ocean'), target = entry('jade-circuit');
    const record = await createAlphaRecovery({previous, target}, list(previous));
    assert.notEqual(record.previous.artifactPath, previous.artifactPath);
    assert.deepEqual(await validateAlphaRecovery(record), record);
    const plan = await alphaRestorePlan(record, list(target));
    assert.deepEqual(plan.commands, [
      ['--source','plugin','--profile','web','remove', target.packageName],
      ['--source','plugin','--profile','web','add', record.previous.artifactPath,'--save-exact'],
    ]);
    assert.equal((await alphaRestorePlan(record, list(null))).commands.length, 1);
    assert.equal((await alphaRestorePlan(record, list(previous))).status, 'already-restored');
    await assert.rejects(alphaRestorePlan(record, list({packageName:'@dsh-themes/high-signal',version:target.version})), /unrelated/);
    await assert.rejects(validateAlphaRecovery({...record, previous:{...record.previous, payloadSha256:'0'.repeat(64)}}), /changed/);
    await writeFile(record.previous.artifactPath, Buffer.from('not the approved package'));
    await assert.rejects(validateAlphaRecovery(record), /allowlist|snapshot/);
  } finally { process.chdir(cwd); await rm(dir, {recursive: true, force: true}); }
});

test('source launcher termination also stops its command and grandchild', { skip: process.platform === 'win32' }, async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'dsh-alpha-signals-'));
  const pidFile = path.join(dir, 'pids.json');
  const launcherModule = new URL('../skills/dsh-theme-manager/scripts/dsh-alpha.mjs', import.meta.url).href;
  const childFile = path.join(dir, 'child.mjs');
  const wrapperFile = path.join(dir, 'wrapper.mjs');
  await writeFile(childFile, `import {spawn} from 'node:child_process'; import {writeFileSync} from 'node:fs';
const child=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});
writeFileSync(${JSON.stringify(pidFile)},JSON.stringify([process.pid,child.pid]));setInterval(()=>{},1000);`);
  await writeFile(wrapperFile, `import {runSourceCommand} from ${JSON.stringify(launcherModule)};
try {await runSourceCommand(process.execPath,[${JSON.stringify(childFile)}],${JSON.stringify(dir)});} catch {process.exitCode=1;}`);
  const wrapper = spawn(process.execPath, [wrapperFile], { stdio: 'ignore' });
  const done = new Promise((resolve) => wrapper.once('exit', resolve));
  let pids = [];
  const alive = (pid) => { try { process.kill(pid, 0); return true; } catch (error) { if (error.code === 'ESRCH') return false; throw error; } };
  try {
    for (let i = 0; i < 100; i++) {
      try { pids = JSON.parse(await readFile(pidFile, 'utf8')); break; } catch { await delay(20); }
    }
    assert.equal(pids.length, 2);
    assert.ok(pids.every(alive));
    wrapper.kill('SIGTERM');
    await Promise.race([done, delay(5000).then(() => { throw new Error('Launcher did not exit'); })]);
    for (let i = 0; i < 100 && pids.some(alive); i++) await delay(20);
    assert.ok(pids.every((pid) => !alive(pid)), 'Source command descendants remained running');
  } finally {
    wrapper.kill('SIGKILL');
    for (const pid of pids) { try { process.kill(pid, 'SIGKILL'); } catch {} }
    await rm(dir, { recursive: true, force: true });
  }
});
