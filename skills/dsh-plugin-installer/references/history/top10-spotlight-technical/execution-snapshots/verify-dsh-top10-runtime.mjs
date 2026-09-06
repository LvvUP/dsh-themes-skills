#!/usr/bin/env node
// Real numbered Top 10 operations in one isolated home. No model/account tasks.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
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

import { boot, browserCommand } from './verify-dsh-plugin-runtime.mjs';
import { checkSpotlightSurface } from './verify-dsh-spotlight-runtime.mjs';

const skills = resolve(process.argv[2] || '../dsh-themes-skills'),
  plugin = join(skills, 'skills/dsh-plugin-installer');
const {
  installPlugins,
  createDshExecutor,
  prepareRegistryArchive,
  prepareSourceArchive,
} = await import(pathToFileURL(join(plugin, 'scripts/install-plugins.mjs')));
const { uninstallPlugins } = await import(
  pathToFileURL(join(plugin, 'scripts/uninstall-plugins.mjs'))
);
const catalogBytes = await readFile(join(plugin, 'references/plugins.json')),
  catalog = JSON.parse(catalogBytes);
const items = catalog.top10.map((id) =>
  catalog.items.find((item) => item.catalogId === id)
);
assert.equal(items.length, 10);
assert.deepEqual(
  catalog.top10,
  [3092, 3052, 3032, 3033, 3040, 3044, 3036, 3010, 3041, 3004]
);
assert(items.every((item) => item.validation.status === 'runtime-verified'));
assert(items.every((item) => item.profile === 'web'));
const { loadRecommendationTransition } = await import(
  pathToFileURL(join(skills, 'scripts/plugin-recommendation-contract.mjs'))
);
const recommendation = await loadRecommendationTransition(skills);
assert.equal(recommendation?.status, 'verified-recommendation-only');
const skin = JSON.parse(
  await readFile('public/theme-packages/index.json')
).themes.find((item) => item.catalogId === 2002);
assert.equal(
  skin.artifactSha256,
  '2e2f0431987db9872de2f7a8fa11d02ea1217a6d8d8b89b8b4173aba227d64e6'
);
const skinArchive = resolve(
  '.cache/dsh-alpha/final-packages',
  skin.artifactFile
);
assert.equal(
  createHash('sha256')
    .update(await readFile(skinArchive))
    .digest('hex'),
  skin.artifactSha256
);
const skinManifest = JSON.parse(
  execFileSync('tar', ['-xOf', skinArchive, 'package/skin.json'], {
    encoding: 'utf8',
  })
);
const skinCssSha256 = createHash('sha256')
  .update(execFileSync('tar', ['-xOf', skinArchive, 'package/skin.css']))
  .digest('hex');
const disk = await statfs(process.cwd());
if (disk.bavail * disk.bsize < 1.2 * 1024 * 1024 * 1024)
  throw Error(
    'Top 10 requires at least 1.2 GiB free before installation, based on the measured combination footprint.'
  );
const home = resolve('.cache/dsh-top10-runtime/run-' + Date.now());
await mkdir(home, { recursive: true });
const env = {
  ...process.env,
  DSH_HOME: home,
  PNPM_CONFIG_STORE_DIR: join(home, 'pnpm-store'),
  CI: 'true',
  DSH_TELEMETRY_DISABLED: '1',
};
const launcher = join(skills, 'skills/dsh-theme-manager/scripts/dsh-alpha.mjs'),
  online = createDshExecutor({ env, launcher, timeoutMs: 180000 }),
  offline = createDshExecutor({
    env: { ...env, PNPM_CONFIG_OFFLINE: 'true' },
    launcher,
    timeoutMs: 90000,
  });
const redact = (s) =>
  s.replace(/([?&]token=)[A-Za-z0-9_-]+/g, '$1[local-token]');
const report = {
  schemaVersion: 2,
  kind: 'top10-public-entrypoint-lifecycle',
  dshVersion: catalog.dshVersion,
  dshSourceRevision: 'd347e703908d0406b7a7ef80e3a0e594d86b2215',
  catalogSha256: createHash('sha256').update(catalogBytes).digest('hex'),
  recommendationTransitionSha256: recommendation.transitionSha256,
  startedAt: new Date().toISOString(),
  home,
  items: items.map((item) => ({
    catalogId: item.catalogId,
    packageName: item.packageName,
    profile: item.profile,
    sourceRevision: item.sourceRevision,
    specifier: item.specifier,
    artifact: item.artifact ?? null,
  })),
  helperSha256: {},
  executionSnapshots: [],
  commands: [],
  stages: [],
  modelTask: false,
  spotlightCoexistence: {
    status: 'pending',
    skin: {
      catalogId: skin.catalogId,
      slug: skin.slug,
      packageName: skin.packageName,
      version: skin.version,
      artifactSha256: skin.artifactSha256,
      cssSha256: skinCssSha256,
    },
    commands: [],
    phases: [],
  },
  status: 'running',
};
for (const file of ['install-plugins.mjs', 'uninstall-plugins.mjs'])
  report.helperSha256[file] = createHash('sha256')
    .update(await readFile(join(plugin, 'scripts', file)))
    .digest('hex');
report.helperSha256['dsh-alpha.mjs'] = createHash('sha256')
  .update(await readFile(launcher))
  .digest('hex');
await mkdir(join(home, 'execution-snapshots'));
for (const [name, path] of [
  ['install-plugins.mjs', join(plugin, 'scripts/install-plugins.mjs')],
  ['uninstall-plugins.mjs', join(plugin, 'scripts/uninstall-plugins.mjs')],
  ['dsh-alpha.mjs', launcher],
  [
    'verify-dsh-top10-runtime.mjs',
    resolve('scripts/verify-dsh-top10-runtime.mjs'),
  ],
  [
    'verify-dsh-plugin-runtime.mjs',
    resolve('scripts/verify-dsh-plugin-runtime.mjs'),
  ],
  [
    'verify-dsh-spotlight-runtime.mjs',
    resolve('scripts/verify-dsh-spotlight-runtime.mjs'),
  ],
  [
    'dsh-plugin-optional-runtime.mjs',
    resolve('scripts/dsh-plugin-optional-runtime.mjs'),
  ],
  [
    'plugin-recommendation-contract.mjs',
    join(skills, 'scripts/plugin-recommendation-contract.mjs'),
  ],
]) {
  const bytes = await readFile(path);
  const snapshotPath = join(home, 'execution-snapshots', name);
  await writeFile(snapshotPath, bytes);
  report.executionSnapshots.push({
    name,
    path,
    snapshotPath,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  });
}
const save = () =>
  writeFile(join(home, 'receipt.json'), JSON.stringify(report, null, 2) + '\n');
await writeFile(join(home, 'catalog-snapshot.json'), catalogBytes);
await save();
const archiveMetadata = new Map();
function completeLocalArchive(file) {
  if (archiveMetadata.has(file)) return archiveMetadata.get(file);
  try {
    const entries = execFileSync('tar', ['-tzf', file], { encoding: 'utf8' })
      .trim()
      .split('\n');
    const manifest = entries.find((name) =>
      /^[^/]+\/package\.json$/.test(name)
    );
    if (!manifest) throw Error('No package manifest in archive');
    const value = JSON.parse(
      execFileSync('tar', ['-xOf', file, manifest], { encoding: 'utf8' })
    );
    const complete =
      Object.keys(value.dependencies ?? {}).length === 0 &&
      Object.keys(value.optionalDependencies ?? {}).length === 0;
    archiveMetadata.set(file, complete);
    return complete;
  } catch {
    return false;
  }
}
async function runDsh(args) {
  const before = await statfs(home),
    beforeBytes = before.bavail * before.bsize;
  const adding = args[0] === 'plugin' && args[3] === 'add',
    removing = args[0] === 'plugin' && args[3] === 'remove';
  const useOffline = removing || (adding && completeLocalArchive(args[4]));
  const executionMode = removing
    ? 'offline-removal'
    : useOffline
      ? 'offline-complete-archive'
      : 'online-dependency-resolution';
  const result =
    adding && beforeBytes < 400 * 1024 * 1024
      ? {
          code: 2,
          stdout: '',
          stderr: 'Stopped before add: less than 400 MiB reserve.',
        }
      : await (useOffline ? offline : online)(args);
  const after = await statfs(home);
  report.commands.push({
    args,
    executionMode,
    availableBeforeBytes: beforeBytes,
    availableAfterBytes: after.bavail * after.bsize,
    ...result,
    stdout: redact(result.stdout),
    stderr: redact(result.stderr),
  });
  await save();
  return result;
}
const deps = {
  runDsh,
  environment: env,
  prepareSource: (item) =>
    prepareSourceArchive(item, {
      cacheDirectory: resolve('.cache/dsh-plugin-runtime/source-archives'),
    }),
  prepareRegistry: (item) =>
    prepareRegistryArchive(item, {
      cacheDirectory: resolve(
        '.cache/dsh-plugin-runtime/npm-certified-archives'
      ),
    }),
  onProgress: (item) =>
    process.stdout.write(`#${item.catalogId} ${item.status}\n`),
};
async function stage(name, action, check) {
  const value = await action();
  report.stages.push({ name, result: value });
  await save();
  check(value);
  return value;
}
async function skinCommand(args) {
  const result = await offline(args);
  report.spotlightCoexistence.commands.push({
    args,
    ...result,
    stdout: redact(result.stdout),
    stderr: redact(result.stderr),
  });
  await save();
  assert.equal(result.code, 0, 'Coexistence skin CLI operation failed');
  return result;
}
async function surface(phase, withSpotlight, withSkin) {
  const result = await checkSpotlightSurface({
    env,
    skillsRoot: skills,
    phase,
    skin,
    manifest: skinManifest,
    cssSha256: skinCssSha256,
    withSpotlight,
    withSkin,
  });
  report.spotlightCoexistence.phases.push(result);
  await save();
  assert.equal(result.status, 'passed', 'Spotlight surface ' + phase);
  return result;
}
let skinInstalled = false;
try {
  await stage(
    'install-top10',
    () => installPlugins(catalog, { top10: true }, deps),
    (r) => assert(r.status === 'installed' && r.items.length === 10)
  );
  const beforeRepeat = report.commands.filter(
    (c) => c.args[0] === 'plugin' && c.args[3] === 'add'
  ).length;
  await stage(
    'repeat-install-top10',
    () => installPlugins(catalog, { top10: true }, deps),
    (r) => assert(r.items.every((i) => i.status === 'already-installed'))
  );
  assert.equal(
    report.commands.filter((c) => c.args[0] === 'plugin' && c.args[3] === 'add')
      .length,
    beforeRepeat
  );
  await browserCommand(['open', 'about:blank', '--browser=chrome']);
  const runtimeRows = [];
  try {
    for (const item of items) {
      const runtime = await boot(item, env);
      runtimeRows.push({ catalogId: item.catalogId, runtime });
      if (item.profile === 'web')
        await copyFile(
          join(home, 'browser.png'),
          join(home, 'browser-' + item.catalogId + '.png')
        ).catch(() => {});
      report.runtime = runtimeRows;
      await save();
      assert.equal(
        runtime.status,
        'boot-passed',
        `Top10 combined profile #${item.catalogId}`
      );
    }
  } finally {
    await browserCommand(['close']);
  }
  await surface('before-skin', true, false);
  await skinCommand(['plugin', '--profile', 'web', 'add', skinArchive]);
  skinInstalled = true;
  await surface('with-skin', true, true);
  const pair = { ids: ['#3092', '#3052'] };
  await stage(
    'remove-pair-for-controlled-install-failure',
    () => uninstallPlugins(catalog, pair, { runDsh, environment: env }),
    (r) => assert.equal(r.status, 'removed')
  );
  let injected = false;
  const missingPath = join(home, 'controlled-missing-private-artifact.tgz');
  await stage(
    'partial-install-disappeared-private-archive',
    () =>
      installPlugins(catalog, pair, {
        ...deps,
        runDsh: async (args) => {
          if (
            !injected &&
            args[0] === 'plugin' &&
            args[3] === 'add' &&
            args[4] ===
              join(
                plugin,
                items.find((i) => i.catalogId === 3092).artifact.path
              )
          ) {
            injected = true;
            return runDsh([...args.slice(0, 4), missingPath, ...args.slice(5)]);
          }
          return runDsh(args);
        },
      }),
    (r) => {
      assert(injected);
      assert.equal(r.status, 'incomplete');
      assert.equal(r.items.find((i) => i.catalogId === 3092).status, 'failed');
      assert.equal(
        r.items.find((i) => i.catalogId === 3052).status,
        'installed'
      );
    }
  );
  await stage(
    'repair-controlled-install-failure',
    () => installPlugins(catalog, { ids: ['#3092'] }, deps),
    (r) => assert.equal(r.status, 'installed')
  );
  await stage(
    'uninstall-top10',
    () =>
      uninstallPlugins(catalog, { top10: true }, { runDsh, environment: env }),
    (r) =>
      assert(
        r.status === 'removed' &&
          r.items.length === 10 &&
          r.items.every((i) => i.status === 'removed')
      )
  );
  await stage(
    'repeat-uninstall-top10',
    () =>
      uninstallPlugins(catalog, { top10: true }, { runDsh, environment: env }),
    (r) => assert(r.items.every((i) => i.status === 'already-removed'))
  );
  const remainingSkin = await surface('after-spotlight-removal', false, true);
  const combinedSkin = report.spotlightCoexistence.phases.find(
    (p) => p.phase === 'with-skin'
  );
  assert.deepEqual(
    remainingSkin.browser.before.tokens,
    combinedSkin.browser.before.tokens
  );
  await skinCommand(['plugin', '--profile', 'web', 'remove', skin.packageName]);
  skinInstalled = false;
  const baseline = await surface('after-skin-removal', false, false);
  const beforeSkin = report.spotlightCoexistence.phases.find(
    (p) => p.phase === 'before-skin'
  );
  assert.deepEqual(
    baseline.browser.before.tokens,
    beforeSkin.browser.before.tokens
  );
  report.spotlightCoexistence.status = 'passed';
  for (const snapshot of report.executionSnapshots) {
    assert.equal(
      createHash('sha256')
        .update(await readFile(snapshot.path))
        .digest('hex'),
      snapshot.sha256,
      `Execution file changed during verification: ${snapshot.name}`
    );
  }
  assert.deepEqual(
    await readFile(join(plugin, 'references/plugins.json')),
    catalogBytes,
    'Catalog changed during Top 10 verification'
  );
  report.snapshotsUnchangedAtCompletion = true;
  report.status = 'passed';
} catch (error) {
  report.status = 'failed';
  report.error = error.stack;
  try {
    report.cleanup = await uninstallPlugins(
      catalog,
      { top10: true },
      { runDsh, environment: env }
    );
  } catch (cleanup) {
    report.cleanupError = cleanup.message;
  }
  if (skinInstalled) {
    try {
      await skinCommand([
        'plugin',
        '--profile',
        'web',
        'remove',
        skin.packageName,
      ]);
      skinInstalled = false;
    } catch (error) {
      report.spotlightCoexistence.cleanupError = error.message;
    }
  }
  process.exitCode = 1;
} finally {
  report.finishedAt = new Date().toISOString();
  await save();
  await browserCommand(['close']).catch(() => {});
  if (
    !skinInstalled &&
    (report.status === 'passed' || report.cleanup?.status === 'removed')
  ) {
    for (const profile of new Set(items.map((i) => i.profile)))
      await rm(join(home, 'profiles', profile, 'node_modules'), {
        recursive: true,
        force: true,
      });
    await rm(join(home, 'pnpm-store'), { recursive: true, force: true });
  }
  console.log(
    JSON.stringify({
      status: report.status,
      receipt: join(home, 'receipt.json'),
    })
  );
}
