#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createDshExecutor, parseArguments, parsePluginList,
  requireDshSuccess, selectPlugins, validateRecipe,
} from './install-plugins.mjs';

function requestedProfile(stdout, profile, environment) {
  const dependencies = parsePluginList(stdout);
  const profiles = JSON.parse(stdout);
  let home = environment.DSH_HOME?.trim() ? environment.DSH_HOME : join(homedir(), '.dsh');
  if (home === '~') home = homedir();
  else if (/^~[/\\]/.test(home)) home = join(homedir(), home.slice(2));
  if (!isAbsolute(home)) throw new Error('DSH_HOME must be an absolute path for this uninstaller.');
  if (profiles.length !== 1 || profiles[0].path !== join(resolve(home), 'profiles', profile))
    throw new Error('DSH plugin list did not identify the requested profile directory.');
  return dependencies;
}

/** Removes only the selected direct packages; other dependencies and settings stay under DSH control. */
export async function uninstallPlugins(catalog, options, {
  runDsh = createDshExecutor(), environment = process.env, onProgress = () => {},
} = {}) {
  const items = selectPlugins(catalog, options).map(validateRecipe);
  const plan = items.map((item) => ({
    catalogId: item.catalogId, slug: item.slug,
    packageName: item.packageName, profile: item.profile,
    command: ['plugin', '--profile', item.profile, 'remove', item.packageName],
  }));
  if (options.dryRun) return { dshVersion: catalog.dshVersion, status: 'planned', items: plan };
  const version = requireDshSuccess(await runDsh(['--version']), 'Read DSH version');
  if (!version.stdout.split(/\s+/).includes(catalog.dshVersion))
    throw new Error(`This catalog targets DSH ${catalog.dshVersion}; the installed version differs.`);
  const results = [];
  for (const item of plan) {
    onProgress({ catalogId: item.catalogId, status: 'removing' });
    try {
      const listArgs = ['plugin', '--profile', item.profile, 'list', '--depth', '0', '--json'];
      const before = requestedProfile(requireDshSuccess(await runDsh(listArgs), 'Read installed plugins').stdout, item.profile, environment);
      const present = Boolean(before[item.packageName]);
      if (present) requireDshSuccess(await runDsh(item.command), `Remove #${item.catalogId}`);
      const after = requestedProfile(requireDshSuccess(await runDsh(listArgs), 'Verify removal').stdout, item.profile, environment);
      if (after[item.packageName]) throw new Error('The selected package is still installed.');
      const composition = requireDshSuccess(await runDsh(['--profile', item.profile, '--dump-config']), 'Verify profile composition after removal');
      if (composition.stdout.includes(item.packageName))
        throw new Error('The package is absent but the profile still references it. Use the same reviewed package to repair the installation before retrying removal.');
      results.push({ catalogId: item.catalogId, slug: item.slug, packageName: item.packageName, profile: item.profile, status: present ? 'removed' : 'already-removed', restartRequired: present });
    } catch (error) {
      results.push({ catalogId: item.catalogId, slug: item.slug, profile: item.profile, status: 'failed', error: error.message });
    }
    onProgress(results.at(-1));
  }
  return { dshVersion: catalog.dshVersion, status: results.some((item) => item.status === 'failed') ? 'incomplete' : 'removed', items: results };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  (async () => {
    const catalog = JSON.parse(await readFile(new URL('../references/plugins.json', import.meta.url), 'utf8'));
    const result = await uninstallPlugins(catalog, parseArguments(process.argv.slice(2)), {
      onProgress: (item) => process.stderr.write(`#${item.catalogId}: ${item.status}\n`),
    });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (result.status === 'incomplete') process.exitCode = 1;
  })().catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
}
