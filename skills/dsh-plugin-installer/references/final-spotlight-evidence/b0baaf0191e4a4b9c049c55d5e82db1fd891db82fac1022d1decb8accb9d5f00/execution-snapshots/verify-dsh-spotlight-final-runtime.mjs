#!/usr/bin/env node
// A separate final coexistence run; the complete ten-plugin lifecycle stays immutable.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  copyFile,
  mkdir,
  readFile,
  rm,
  statfs,
  writeFile,
} from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  readCurrentSpotlightSkin,
  TOP10_TECHNICAL_SHA256,
} from './alpha-plugin-collection-contract.mjs';
import { assertFinalSpotlightCoexistence } from './alpha-spotlight-contract.mjs';
import { checkFinalSpotlightSurface } from './verify-dsh-spotlight-final-surface.mjs';

const siteRoot = process.cwd(),
  skillsRoot = resolve(process.argv[2] || '../dsh-themes-skills');
const pluginRoot = join(skillsRoot, 'skills/dsh-plugin-installer');
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const catalogBytes = await readFile(
  join(pluginRoot, 'references/plugins.json')
);
const catalog = JSON.parse(catalogBytes),
  item = catalog.items.find((i) => i.catalogId === 3004);
assert.ok(catalog.top10.includes(3004) && !catalog.top10.includes(3045));
assert.equal(
  item.artifact.sha256,
  'c37667331ed43b2cf75af5585fd9fd5b9e7b43637008765fded2647787a72b92'
);
const technicalBytes = await readFile(
  join(pluginRoot, 'references/history/top10-spotlight-technical/receipt.json')
);
assert.equal(hash(technicalBytes), TOP10_TECHNICAL_SHA256);
assert.equal(JSON.parse(technicalBytes).catalogSha256, hash(catalogBytes));
const { loadRecommendationTransition } = await import(
  pathToFileURL(join(skillsRoot, 'scripts/plugin-recommendation-contract.mjs'))
);
const recommendation = await loadRecommendationTransition(skillsRoot);
assert.equal(recommendation.status, 'verified-recommendation-only');
const currentSkin = await readCurrentSpotlightSkin(siteRoot);
assert.notEqual(
  currentSkin.skin.artifactSha256,
  '2e2f0431987db9872de2f7a8fa11d02ea1217a6d8d8b89b8b4173aba227d64e6'
);

const { installPlugins, createDshExecutor } = await import(
  pathToFileURL(join(pluginRoot, 'scripts/install-plugins.mjs'))
);
const { uninstallPlugins } = await import(
  pathToFileURL(join(pluginRoot, 'scripts/uninstall-plugins.mjs'))
);
const disk = await statfs(siteRoot);
assert.ok(
  disk.bavail * disk.bsize >= 700 * 1024 * 1024,
  'Final isolated two-package run requires a 700 MiB starting reserve'
);
const home = resolve('.cache/dsh-top10-runtime/final-spotlight-' + Date.now());
await mkdir(join(home, 'execution-snapshots'), { recursive: true });
const env = {
  ...process.env,
  DSH_HOME: home,
  PNPM_CONFIG_STORE_DIR: join(home, 'pnpm-store'),
  PNPM_CONFIG_OFFLINE: 'true',
  CI: 'true',
  DSH_TELEMETRY_DISABLED: '1',
};
const launcher = join(
  skillsRoot,
  'skills/dsh-theme-manager/scripts/dsh-alpha.mjs'
);
const execute = createDshExecutor({ env, launcher, timeoutMs: 90000 });
const redact = (value) =>
  value.replace(/([?&]token=)[A-Za-z0-9_-]+/g, '$1[local-token]');
const report = {
  schemaVersion: 1,
  kind: 'spotlight-final-skin-coexistence',
  status: 'running',
  home,
  startedAt: new Date().toISOString(),
  dshVersion: catalog.dshVersion,
  dshSourceRevision: 'd347e703908d0406b7a7ef80e3a0e594d86b2215',
  technicalReceiptSha256: TOP10_TECHNICAL_SHA256,
  catalogSha256: hash(catalogBytes),
  recommendationTransitionSha256: recommendation.transitionSha256,
  spotlight: {
    catalogId: item.catalogId,
    packageName: item.packageName,
    profile: item.profile,
    sourceRevision: item.sourceRevision,
    specifier: item.specifier,
    artifact: item.artifact,
  },
  helperSha256: {},
  executionSnapshots: [],
  commands: [],
  stages: [],
  modelTask: false,
  coexistence: {
    status: 'pending',
    skin: currentSkin.skin,
    commands: [],
    phases: [],
  },
};
const sources = [
  ['install-plugins.mjs', join(pluginRoot, 'scripts/install-plugins.mjs')],
  ['uninstall-plugins.mjs', join(pluginRoot, 'scripts/uninstall-plugins.mjs')],
  ['dsh-alpha.mjs', launcher],
  [
    'verify-dsh-spotlight-final-runtime.mjs',
    resolve('scripts/verify-dsh-spotlight-final-runtime.mjs'),
  ],
  [
    'verify-dsh-spotlight-final-surface.mjs',
    resolve('scripts/verify-dsh-spotlight-final-surface.mjs'),
  ],
  [
    'verify-dsh-plugin-runtime.mjs',
    resolve('scripts/verify-dsh-plugin-runtime.mjs'),
  ],
  [
    'dsh-plugin-optional-runtime.mjs',
    resolve('scripts/dsh-plugin-optional-runtime.mjs'),
  ],
  [
    'plugin-recommendation-contract.mjs',
    join(skillsRoot, 'scripts/plugin-recommendation-contract.mjs'),
  ],
  [
    'alpha-plugin-collection-contract.mjs',
    resolve('scripts/alpha-plugin-collection-contract.mjs'),
  ],
  [
    'alpha-spotlight-contract.mjs',
    resolve('scripts/alpha-spotlight-contract.mjs'),
  ],
];
for (const [name, path] of sources) {
  const bytes = await readFile(path),
    sha256 = hash(bytes);
  const snapshotPath = join(home, 'execution-snapshots', name);
  await writeFile(snapshotPath, bytes);
  report.executionSnapshots.push({ name, path, snapshotPath, sha256 });
  if (
    ['install-plugins.mjs', 'uninstall-plugins.mjs', 'dsh-alpha.mjs'].includes(
      name
    )
  )
    report.helperSha256[name] = sha256;
}
assert.deepEqual(report.helperSha256, JSON.parse(technicalBytes).helperSha256);
await writeFile(join(home, 'catalog-snapshot.json'), catalogBytes);
await copyFile(currentSkin.archive, join(home, 'skin-archive-snapshot.tgz'));
await copyFile(
  currentSkin.manifestPath,
  join(home, 'skin-manifest-snapshot.json')
);
const save = () =>
  writeFile(join(home, 'receipt.json'), JSON.stringify(report, null, 2) + '\n');
await save();
async function runDsh(args) {
  const before = await statfs(home);
  if (args[3] === 'add')
    assert.ok(
      before.bavail * before.bsize >= 400 * 1024 * 1024,
      '400 MiB reserve'
    );
  const result = await execute(args);
  report.commands.push({
    args,
    ...result,
    stdout: redact(result.stdout),
    stderr: redact(result.stderr),
  });
  await save();
  return result;
}
async function skinCommand(args) {
  const result = await runDsh(args);
  report.coexistence.commands.push({
    args,
    ...result,
    stdout: redact(result.stdout),
    stderr: redact(result.stderr),
  });
  await save();
  assert.equal(
    result.code,
    0,
    'Official skin CLI operation must exit successfully'
  );
}
async function surface(phase, withSpotlight, withSkin) {
  const result = await checkFinalSpotlightSurface({
    env,
    skillsRoot,
    phase,
    skin: currentSkin.skin,
    manifest: currentSkin.manifest,
    cssSha256: currentSkin.skin.cssSha256,
    withSpotlight,
    withSkin,
  });
  report.coexistence.phases.push(result);
  await save();
  assert.equal(result.status, 'passed', 'Final surface failed: ' + phase);
}
let spotlightInstalled = false,
  skinInstalled = false;
try {
  const installed = await installPlugins(
    catalog,
    { ids: ['#3004'] },
    { runDsh, environment: env }
  );
  report.stages.push({ name: 'install-spotlight', result: installed });
  await save();
  spotlightInstalled = installed.items.some((i) => i.status === 'installed');
  assert.equal(installed.status, 'installed');
  await surface('before-skin', true, false);
  await skinCommand(['plugin', '--profile', 'web', 'add', currentSkin.archive]);
  skinInstalled = true;
  await surface('with-skin', true, true);
  const removed = await uninstallPlugins(
    catalog,
    { ids: ['#3004'] },
    { runDsh, environment: env }
  );
  report.stages.push({ name: 'remove-spotlight', result: removed });
  await save();
  assert.equal(removed.status, 'removed');
  spotlightInstalled = false;
  await surface('after-spotlight-removal', false, true);
  await skinCommand(['plugin', '--profile', 'web', 'remove', itemSkinName()]);
  skinInstalled = false;
  await surface('after-skin-removal', false, false);
  report.coexistence.status = 'passed';
  assertFinalSpotlightCoexistence(report.coexistence, currentSkin);
  report.status = 'passed';
} catch (error) {
  report.status = 'failed';
  report.error = error.stack;
} finally {
  // Remove only this run's own packages through the official CLI. Keep all evidence.
  if (spotlightInstalled || report.status === 'failed')
    report.cleanupSpotlight = await uninstallPlugins(
      catalog,
      { ids: ['#3004'] },
      { runDsh, environment: env }
    ).catch((error) => ({ status: 'failed', error: error.message }));
  if (skinInstalled || report.status === 'failed')
    report.cleanupSkin = await runDsh([
      'plugin',
      '--profile',
      'web',
      'remove',
      itemSkinName(),
    ]).catch((error) => ({ code: 1, error: error.message }));
  report.snapshotsUnchangedAtCompletion = true;
  for (const snapshot of report.executionSnapshots) {
    if (hash(await readFile(snapshot.path)) !== snapshot.sha256)
      report.snapshotsUnchangedAtCompletion = false;
  }
  if (!report.snapshotsUnchangedAtCompletion) report.status = 'failed';
  report.finishedAt = new Date().toISOString();
  await save();
  if (report.status === 'passed') {
    await rm(join(home, 'profiles/web/node_modules'), {
      recursive: true,
      force: true,
    });
    await rm(join(home, 'pnpm-store'), { recursive: true, force: true });
  }
}
function itemSkinName() {
  return currentSkin.skin.packageName;
}
console.log(
  JSON.stringify(
    {
      status: report.status,
      home,
      receiptSha256: hash(await readFile(join(home, 'receipt.json'))),
      error: report.error,
    },
    null,
    2
  )
);
process.exitCode = report.status === 'passed' ? 0 : 1;
