import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';

// Offline evidence review only. Never imports/runs either runtime driver or
// opens server logs. Command stdout/stderr bytes are hashed, not emitted.
const root = process.cwd();
const base = '.cache/alpha-community-security-public-sync';
const publicRoot = path.resolve('../dsh-themes-skills');
const skill = path.join(publicRoot, 'skills/dsh-community-skin-installer');
const threeWork = '.cache/dsh-skin-center-alpha/public-installation-1788700824531';
const execWork = `${base}/3id-execution-1788700824293852000`;
const upgradeWork = `${base}/upgrade-runs/attempt-1788700880065-45343960-df51-485c-808d-f3e316828254`;
const hash = b => createHash('sha256').update(b).digest('hex');
const read = p => fs.readFileSync(p);
const json = p => JSON.parse(read(p));
const binding = p => ({ path: path.relative(root, path.resolve(p)), sha256: hash(read(p)) });
const three = json(`${threeWork}/receipt.json`);
const upgrade = json(`${upgradeWork}/receipt.json`);
const execution = json(`${execWork}/execution.json`);
assert.equal(hash(read(`${threeWork}/receipt.json`)), 'a487dd27baa23aa50185a0f6ffd157de42e7e7eee30127a31ebfa32118c9c4b6');
assert.equal(hash(read(`${upgradeWork}/receipt.json`)), '8bcb406721ea138befa468b7003d67c2de2f2c6d98d82471ba474c61a52e99f8');
assert.equal(three.status, 'passed');
assert.equal(upgrade.status, 'passed');
assert.equal(execution.exitCode, 0);
assert.equal(execution.inputsStillExact, true);
assert.equal(hash(read(`${execWork}/command.log`)), execution.commandLogSha256);

function verifySnapshots(entries, baseDirectory) {
  return entries.map(s => {
    const snapshot = path.resolve(baseDirectory, s.path);
    assert.equal(hash(read(snapshot)), s.sha256, 'Snapshot digest mismatch');
    const source = path.resolve(root, s.sourcePath);
    return { ...s, snapshotVerified: true, currentSourceStillExact: fs.existsSync(source) && hash(read(source)) === s.sha256 };
  });
}
const threeSnapshots = verifySnapshots(execution.snapshots, root);
const upgradeSnapshots = verifySnapshots(upgrade.snapshots, upgradeWork);
const threeDriver = execution.snapshots.find(s => s.sourcePath.endsWith('/verify-public-installation.mjs'));
assert.equal(threeDriver.sha256, 'e178507eb9f85359e6b9091f45afb19bd860c72ef9e1cc927139bf7377ce70a7');
const upgradeDriver = upgrade.snapshots.find(s => s.sourcePath.endsWith('/verify-real-upgrade.mjs'));
assert.equal(upgradeDriver.sha256, '5272dbb16fac552b70327e0fd9081ed9c966da54c36224f9adaf04bcacd7c58a');
const threeCatalog = json(execution.snapshots.find(s => s.sourcePath.endsWith('/community-recipes.json')).path);
const upgradeCatalog = json(path.join(upgradeWork, upgrade.snapshots.find(s => s.sourcePath.endsWith('/community-recipes.json')).path));
assert.deepEqual(threeCatalog, upgradeCatalog);
assert.equal(three.catalogSha256, upgrade.catalogSha256);
assert.equal(three.catalogSha256, execution.catalogSha256);
const inputs = json(path.join(upgradeWork, upgrade.snapshots.find(s => s.sourcePath.endsWith('/upgrade-inputs.json')).path));
assert.deepEqual(upgrade.catalogIds, inputs.catalogIds);
assert.deepEqual(three.catalogIds, [1101, 2206, 2207]);
assert.equal(new Set(inputs.catalogIds).size, 15);

function checkCommands(receipt, work) {
  const entries = [];
  const lists = [];
  for (let i = 0; i < receipt.commands.length; i++) {
    const command = receipt.commands[i];
    assert.equal(command.code, 0, `Nonzero official command ${i + 1}`);
    const record = { ordinal: i + 1, kind: command.args[0] === 'plugin' ? command.args[3] : command.args.includes('--dump-config') ? 'compose' : command.args[0], code: command.code, streams: {} };
    for (const stream of ['stdout', 'stderr']) {
      const file = path.join(work, 'commands', `${String(i + 1).padStart(3, '0')}.${stream}.log`);
      const bytes = read(file);
      assert.equal(hash(bytes), command[`${stream}Sha256`], 'Command raw digest mismatch');
      record.streams[stream] = { path: path.relative(root, path.resolve(file)), sha256: hash(bytes), bytes: bytes.length, mode: (fs.statSync(file).mode & 0o777).toString(8) };
      if (stream === 'stdout' && record.kind === 'list') {
        const profiles = JSON.parse(bytes);
        assert.equal(profiles.length, 1);
        assert.equal(profiles[0].path, path.resolve(work, 'profile/profiles/web'));
        lists.push({ ordinal: i + 1, dependencies: profiles[0].dependencies ?? {} });
      }
    }
    entries.push(record);
  }
  const expected = new Set(entries.flatMap(e => Object.values(e.streams).map(s => path.basename(s.path))));
  assert.deepEqual(fs.readdirSync(path.join(work, 'commands')).sort(), [...expected].sort());
  assert.deepEqual(lists[0].dependencies, {});
  assert.deepEqual(lists.at(-1).dependencies, {});
  return { entries, lists, count: entries.length, rawStreamCount: entries.length * 2, allExitZero: true };
}
const threeCommands = checkCommands(three, threeWork);
const upgradeCommands = checkCommands(upgrade, upgradeWork);
assert.equal(threeCommands.count, 28);
assert.equal(upgradeCommands.count, 75);
const isAction = action => c => c.args[0] === 'plugin' && c.args[3] === action;
const threeAdds = three.commands.filter(isAction('add'));
const threeRemoves = three.commands.filter(isAction('remove'));
assert.equal(threeAdds.length, 2);
assert.equal(threeRemoves.length, 2);
assert.equal(new Set(threeAdds.map(c => c.args[4])).size, 2);
assert.equal(new Set(threeRemoves.map(c => c.args[4])).size, 2);
assert.equal(three.installation.status, 'installed');
assert.deepEqual(three.installation.items.map(i => i.status), ['installed', 'installed', 'already-installed']);
for (const artifact of three.artifacts) {
  const item = threeCatalog.items.find(i => i.catalogId === artifact.catalogId);
  assert.equal(item.packageVersion, artifact.packageVersion);
  assert.equal(item.artifact.sha256, artifact.sha256);
  assert.equal(hash(read(path.join(skill, artifact.path))), artifact.sha256);
}
for (const implementation of three.implementations) {
  const snap = execution.snapshots.find(s => s.sourcePath.endsWith(`/${implementation.path}`));
  assert.equal(snap.sha256, implementation.sha256);
}
assert.equal(hash(read(`${threeWork}/installed-pnpm-lock.yaml`)), three.installedLockSha256);
const finalProfile = json(`${threeWork}/profile/profiles/web/package.json`);
assert.ok(!Object.keys(finalProfile.dependencies ?? {}).some(k => three.artifacts.some(a => a.packageName === k)));

function tarRegularFiles(archive) {
  const bytes = gunzipSync(read(archive));
  const members = new Map();
  for (let offset = 0; offset + 512 <= bytes.length;) {
    const header = bytes.subarray(offset, offset + 512);
    if (header.every(byte => byte === 0)) break;
    const name = header.subarray(0, 100).toString().replace(/\0.*$/s, '');
    const size = parseInt(header.subarray(124, 136).toString().replace(/\0.*$/s, '').trim(), 8) || 0;
    const type = header[156];
    assert.ok(type === 0 || type === 48 || type === 53, 'Only regular files and directory entries expected');
    if (type === 0 || type === 48) {
      assert.ok(!members.has(name));
      members.set(name, bytes.subarray(offset + 512, offset + 512 + size));
    }
    offset += 512 + Math.ceil(size / 512) * 512;
  }
  return members;
}
const archiveChecks = [];
assert.equal(upgrade.oldInstalledBytes.length, 4);
assert.equal(upgrade.newInstalledBytes.length, 4);
for (const item of inputs.packages) {
  for (const stage of ['old', 'new']) {
    const expected = item[stage];
    const file = path.join(publicRoot, expected.artifactPath);
    assert.equal(hash(read(file)), expected.artifactSha256);
    const members = tarRegularFiles(file);
    assert.deepEqual([...members.keys()].sort(), expected.files.map(f => `package/${f.path}`).sort());
    for (const f of expected.files) {
      const b = members.get(`package/${f.path}`);
      assert.equal(hash(b), f.sha256); assert.equal(b.length, f.bytes);
    }
    const manifest = JSON.parse(members.get('package/package.json'));
    assert.equal(manifest.name, item.packageName); assert.equal(manifest.version, expected.version);
    const installed = upgrade[`${stage}InstalledBytes`].find(p => p.packageName === item.packageName);
    assert.equal(installed.version, expected.version); assert.equal(installed.artifactSha256, expected.artifactSha256);
    assert.deepEqual(installed.files, expected.files);
    assert.ok(upgradeCommands.lists.some(list => list.dependencies[item.packageName]?.version === expected.version));
    archiveChecks.push({ packageName: item.packageName, stage, version: expected.version, sha256: expected.artifactSha256, fileCount: expected.files.length, archiveFilesAndRecordedInstalledFilesMatch: true, rawOfficialListVersionObserved: true });
  }
}
const upgradeAdds = upgrade.commands.filter(isAction('add'));
assert.equal(upgradeAdds.length, 8);
assert.deepEqual(upgradeAdds.slice(0, 4).map(c => c.args[4]), inputs.packages.map(p => path.join(publicRoot, p.old.artifactPath)));
assert.deepEqual(upgradeAdds.slice(4), upgrade.upgradeAddCalls);
assert.deepEqual(new Set(upgrade.upgradeAddCalls.map(c => c.args[4])), new Set(inputs.packages.map(p => path.join(publicRoot, p.new.artifactPath))));
assert.equal(upgrade.upgrade.items.filter(i => i.status === 'installed').length, 4);
assert.equal(upgrade.upgrade.items.filter(i => i.status === 'already-installed').length, 11);
assert.equal(upgrade.commands.filter(isAction('remove')).length, 4);
assert.equal(upgrade.removal.status, 'removed'); assert.equal(upgrade.repeatedRemoval.status, 'removed');
assert.equal(upgrade.cleanup.repeatedRemoveCalls, 0);
const lastActualRemoval = upgrade.commands.findLastIndex(isAction('remove'));
assert.ok(!upgrade.commands.slice(lastActualRemoval + 1).some(isAction('remove')));
assert.equal(upgrade.cleanup.port3428Closed, true);
assert.equal(upgrade.cleanup.officialPackageRemoval, true);
assert.equal(upgrade.webStartedBeforeNewPackageBytesVerified, false);
assert.equal(upgrade.packageManagerPolicy.offlineObserved, 'true');
assert.deepEqual(upgrade.activations.map(a => a.catalogId), inputs.catalogIds);
for (const activation of upgrade.activations) {
  const item = upgradeCatalog.items.find(i => i.catalogId === activation.catalogId);
  assert.equal(activation.status, 'selected'); assert.equal(activation.observedSelection, item.activation.themeId);
}
assert.equal(upgrade.coldRestart.status, 'passed');
assert.deepEqual(upgrade.coldRestart.beforeSelections, upgrade.coldRestart.afterSelections);
assert.deepEqual(upgrade.coldRestart.beforeSelections, {
  '/api/dsh-community-palettes/theme-pack': 'off', '/api/dsh-community-palettes/catppuccin': 'off',
  '/api/dsh-community-palettes/solarized': 'off', '/api/dsh-community-palettes/premium/palette': 'dsh-alpha-premium-tokyo-night',
});
assert.deepEqual(upgrade.removedRoutes.map(r => r.route).sort(), Object.keys(upgrade.coldRestart.beforeSelections).sort());
assert.ok(upgrade.removedRoutes.every(r => r.status === 404));
assert.deepEqual(upgrade.hosts.map(h => h.phase), ['upgraded', 'upgraded-cold-restart', 'removed-cold-restart']);
for (const host of upgrade.hosts) {
  assert.equal(host.parentChain[0], host.listenerPid);
  assert.equal(host.parentChain.at(-1), host.launcherPid);
  assert.ok(host.parentChain.every(p => Number.isInteger(p) && p > 1));
}

assert.deepEqual(three.activations.map(a => a.catalogId), [1101, 2206, 2207]);
for (const activation of three.activations) {
  const item = threeCatalog.items.find(i => i.catalogId === activation.catalogId);
  assert.equal(activation.status, 'selected'); assert.equal(activation.observedSelection, item.activation.themeId);
  assert.equal(activation.themePackSelection, item.catalogId === 1101 ? item.activation.themeId : 'off');
}
assert.equal(three.recoveryConflict.firstAttempt.status, 'incomplete');
assert.equal(three.recoveryConflict.firstAttempt.items.find(i => i.catalogId === 2206).status, 'failed');
assert.match(three.recoveryConflict.firstAttempt.items.find(i => i.catalogId === 2206).error, /Companion bytes differ/);
for (const flag of ['fixtureOnly','packageAbsentAfterFirstAttempt','editedFilePreserved','editResolvedToReviewedBytes','publicEntryRetrySucceeded']) assert.equal(three.recoveryConflict[flag], true);
assert.equal(three.removal.status, 'removed');
assert.equal(three.removal.items[2].status, 'already-removed');
const companionChecks = [];
for (const item of threeCatalog.items.filter(i => [2206,2207].includes(i.catalogId))) {
  const installed = three.installedCompanions.find(c => c.catalogId === item.catalogId);
  assert.deepEqual(installed.files, item.companion.files);
  for (const f of installed.files) {
    const bytes = read(path.join(skill, item.companion.sourcePath, f.path));
    assert.equal(hash(bytes), f.sha256); assert.equal(bytes.length, f.bytes);
  }
  const restored = three.restoredCompanions.find(c => c.skinId === item.skinId);
  assert.equal(restored.files.length, 6);
  const restoredDirectory = `${threeWork}/profile/skins/${item.skinId}`;
  assert.deepEqual(fs.readdirSync(restoredDirectory).sort(), restored.files.map(f => f.path).sort());
  for (const f of restored.files) {
    const result = read(path.join(restoredDirectory, f.path));
    const original = read(path.join(skill, 'assets/skins', item.skinId, f.path));
    assert.equal(hash(result), f.sha256); assert.equal(result.length, f.bytes); assert.ok(result.equals(original));
  }
  companionChecks.push({ catalogId:item.catalogId, skinId:item.skinId, installedFixtureFiles:installed.files.length, finalRestoredFiles:restored.files.length, finalBytesEqualOriginalPublicFixtures:true });
}
const managed = read(path.join(skill, threeCatalog.items.find(i => i.catalogId === 2206).companion.sourcePath, 'patches.css'));
assert.equal(hash(managed), three.recoveryConflict.managedFileSha256);
assert.equal(hash(Buffer.concat([managed, Buffer.from('\n/* isolated recovery-conflict fixture */\n')])), three.recoveryConflict.editedFileSha256);
assert.deepEqual(three.removedRoutes.map(r => r.path), ['/api/dsh-community-palettes/theme-pack','/api/skin-center/v2/active','/api/skin-center/v2/skins/qq98/stylesheet','/api/skin-center/v2/skins/ths/stylesheet']);
assert.ok(three.removedRoutes.every(r => r.status === 404));
assert.equal(three.dependencies.reusedStore, true);
assert.equal(three.dependencies.offline, false);
assert.equal(three.dependencies.lifecycleOfflineObserved, 'true');
assert.equal(path.resolve(three.dependencies.storeDirectory), execution.environmentPolicy.DSH_PUBLIC_INSTALL_STORE_DIR);
const launchWrapper = `${base}/run-reviewed-3id.py`;
assert.match(read(launchWrapper).toString(), /assert not store\.exists\(\)/);

const report = {
  schemaVersion:1, status:'independent-review-of-actual-public-runs-complete', reviewedAt:new Date().toISOString(), reviewer:'/root/upstream_docs_plan',
  reviewScript:binding(import.meta.filename), receipts:{threeId:binding(`${threeWork}/receipt.json`),upgrade:binding(`${upgradeWork}/receipt.json`),threeIdExecution:binding(`${execWork}/execution.json`)},
  sourceBindings:{catalogSha256:three.catalogSha256,threeIdDriverSha256:threeDriver.sha256,upgradeDriverSha256:upgradeDriver.sha256,threeIdSnapshots:threeSnapshots,upgradeSnapshots,threeIdLaunchWrapper:binding(launchWrapper)},
  sourceCommit:three.sourceCommit,dshVersion:three.dshVersion,
  threeId:{catalogIds:three.catalogIds,commands:threeCommands.entries,commandCount:28,rawStreamsVerified:56,actualAddCalls:2,actualRemoveCalls:2,activations:three.activations,recoveryConflict:three.recoveryConflict,restoredCompanionChecks:companionChecks,removedRoutes:three.removedRoutes,installedLock:binding(`${threeWork}/installed-pnpm-lock.yaml`),
    storeInterpretation:{rawReusedStore:true,meaning:'The raw driver computes Boolean(DSH_PUBLIC_INSTALL_STORE_DIR), not whether cache content already existed.',actualRun:'Fresh task-owned custom store; not a warm-store reuse run.',basis:'Root confirms the prelaunch nonexistence assertion was executed; read-only inspection of run-reviewed-3id.py shows assert not store.exists() before the recorded native command, and execution.json records the exact unique store path. The wrapper itself was not snapshotted in execution.json.',initialInstallNetworkPolicy:'Offline=false; fixed native dependency install could use registry. Subsequent lifecycle switches to PNPM_CONFIG_OFFLINE=true and records true from pnpm config get. Not packet-capture evidence.'}},
  upgrade:{catalogIds:upgrade.catalogIds,commands:upgradeCommands.entries,commandCount:75,rawStreamsVerified:150,archiveChecks,recordedInstalledFileChecks:48,oldAddCalls:4,newAddCalls:4,batchDedupStatuses:{installed:4,alreadyInstalled:11},activations:upgrade.activations,coldRestart:upgrade.coldRestart,actualRemoveCalls:4,repeatedRemoveCalls:0,removedRoutes:upgrade.removedRoutes,hostOwnershipRecords:upgrade.hosts,cleanup:upgrade.cleanup,startedAt:upgrade.startedAt,completedAt:upgrade.completedAt},
  confirmedFindings:[],
  claimableScope:['3 ID public installer API/official CLI run on a fresh custom store: two actual archive adds, three authenticated selections, companion edit conflict preserved after package removal, resolving that controlled edit followed by successful high-level retry, two actual removals total, and twelve original fixture files restored byte-for-byte.','Real four-package alpha.1 to alpha.2 CLI upgrade in a separate empty profile; the old Web host was never started. All eight archive digests and 48 fixed package-file values agree with the recorded installed-byte checks and official raw list versions. Fifteen IDs cause four new add calls and eleven within-batch skips.','Fifteen actual authenticated palette selections, then one cold restart preserving the last four-route selection state. Four removals, zero repeated removal calls, and four routes return 404 after the removed profile starts.'],
  limits:['This reviewer performed offline evidence/source/file reads only, not a new run, installation, HTTP request, browser or process probe.','All 206 command stdout/stderr files were read only for SHA/size and, for list stdout, isolated profile/version/absence checks. No raw command values are emitted. Server logs were not read, hashed or copied.','The 48 installed package-file hashes are driver observations made before successful uninstall; their input archive bytes and raw version listings were independently rechecked, but those removed installed trees cannot now be reread.','Intermediate HTTP responses and the conflict-time edited file were not separately snapshotted; receipt values are supported by exact executed source assertions. The edited digest was independently reconstructed; the twelve final restored files still exist and were independently reread.','No fifteen independent cold restarts, alpha.1 preference migration, browser rendering/visual proof, custom import/delete, cross-site browser or credentialed model functionality is certified by these two runs.','3 ID host cleanup was checked by its existing lsof-based driver; this review does not upgrade that evidence to the upgraded driver’s separate TCP/owner-chain protocol.','Source snapshots remain authoritative even if a current working file later changes; currentSourceStillExact is recorded individually. Raw original reports remain unchanged.'],
  noServerLogRead:true,noRawCredentialOutput:true,runtimeRerun:false,trackedSourceModified:false,
};
assert.equal(three.sourceCommit, upgrade.sourceCommit);assert.equal(three.dshVersion, upgrade.dshVersion);
const output = `${base}/actual-public-runs-independent-review.json`;
fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n',{flag:'wx',mode:0o600});
console.log(JSON.stringify({path:output,sha256:hash(read(output)),status:report.status,commandsVerified:103,rawStreamsVerified:206,archiveFileChecks:48,restoredFiles:12}));
