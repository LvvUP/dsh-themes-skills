#!/usr/bin/env node
import http from 'node:http';
import { createHash } from 'node:crypto';
import { mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDshExecutor, parsePluginList, requireDshSuccess, selectPlugins, validateRecipe } from '../../dsh-plugin-installer/scripts/install-plugins.mjs';

import { inspectCompanion, installCompanion, restoreCompanions } from './companion-files.mjs';

const skillRoot = fileURLToPath(new URL('../', import.meta.url));
const catalogUrl = new URL('../references/community-recipes.json', import.meta.url);
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');

export async function prepareArtifact(item, { fetchArtifact = fetch, cacheDirectory = join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'dsh-themes-artifacts') } = {}) {
  const artifact = item.artifact;
  if (!/^[a-f0-9]{64}$/.test(artifact.sha256)) throw new Error('A complete archive SHA-256 is required.');
  if (artifact.path) {
    if (isAbsolute(artifact.path) || !artifact.path.startsWith('assets/alpha/artifacts/')) throw new Error('Invalid bundled archive path.');
    const file = await realpath(join(skillRoot, artifact.path));
    if (relative(await realpath(skillRoot), file).startsWith('..')) throw new Error('Archive is outside this Skill.');
    if (hash(await readFile(file)) !== artifact.sha256) throw new Error(`Archive digest differs for #${item.catalogId}.`);
    return file;
  }
  if (!/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/releases\/download\/[^\s?#]+\/[^\s?#]+\.tgz$/.test(artifact.url)) throw new Error('Use an exact GitHub release archive.');
  http.setGlobalProxyFromEnv?.();
  const response = await fetchArtifact(artifact.url, { signal: AbortSignal.timeout(120_000) });
  if (!response.ok) throw new Error(`Archive download returned HTTP ${response.status}.`);
  const chunks = []; let size = 0;
  for await (const chunk of response.body) { size += chunk.length; if (size > 100 * 1024 * 1024) throw new Error('Archive exceeds 100 MiB.'); chunks.push(chunk); }
  const bytes = Buffer.concat(chunks);
  if (hash(bytes) !== artifact.sha256) throw new Error(`Archive digest differs for #${item.catalogId}.`);
  const file = join(cacheDirectory, `${artifact.sha256}.tgz`);
  await mkdir(dirname(file), { recursive: true });
  try { await writeFile(file, bytes, { flag: 'wx', mode: 0o600 }); } catch (error) { if (error.code !== 'EEXIST') throw error; if (hash(await readFile(file)) !== artifact.sha256) throw new Error('Existing cached archive has changed.'); }
  return file;
}

// Pass a request adapter running in the authenticated local DSH browser.
// The adapter receives same-origin paths and JSON; no cookie or token is exported.
export async function activateCommunityItem(item, { request } = {}) {
  if (item.validation?.status !== 'runtime-verified') throw new Error('This item has not passed Alpha runtime verification.');
  const activation = item.activation;
  if (activation?.kind !== 'http') return { catalogId: item.catalogId, status: activation?.kind === 'automatic' ? 'automatic' : 'controls-required', activation };
  if (typeof request !== 'function') throw new Error('Use an authenticated local DSH browser request adapter.');
  const requests = [...(activation.deselectRequests || []), activation.request];
  for (const entry of requests) {
    if (!entry || !/^\/api\/(?:dsh-community-palettes\/[a-z-]+(?:\/palette)?|skin-center\/v2\/active)$/.test(entry.path) || !entry.body || typeof entry.body !== 'object' || Array.isArray(entry.body)) throw new Error('Invalid palette activation request.');
  }
  for (const [index, entry] of requests.entries()) {
    const result = await request(entry.path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(entry.body) });
    const optional = index < requests.length - 1;
    if (!(result.status >= 200 && result.status < 300) && !(optional && result.status === 404)) throw new Error(`Palette activation returned HTTP ${result.status} for ${entry.path}.`);
  }
  return { catalogId: item.catalogId, status: 'selected', reloadRequired: true, verification: 'Reload DSH and check the selected palette before reporting completion.' };
}

export async function installCommunityItems(catalog, options, { runDsh = createDshExecutor(), prepare = prepareArtifact, dshHome = process.env.DSH_HOME || join(homedir(), '.dsh'), companionSkillRoot = skillRoot } = {}) {
  const items = selectPlugins(catalog, { ids: options.ids });
  if (options.inspect) return { dshVersion: catalog.dshVersion, status: 'inspected', items };
  for (const item of items) {
    if (item.validation?.status !== 'runtime-verified') throw new Error(`#${item.catalogId} has not passed Alpha runtime verification.`);
    // Community archives declare packageVersion on the recipe, not the plugin artifact.
    validateRecipe({ ...item, artifact: undefined, specifier: `${item.packageName}@${item.packageVersion}` });
    if (!options.remove) await inspectCompanion(item, { skillRoot: companionSkillRoot });
  }
  const version = await runDsh(['--version']);
  if (version.code !== 0 || !version.stdout.split(/\s+/).includes(catalog.dshVersion)) throw new Error(`This catalog requires DSH ${catalog.dshVersion}.`);
  const results = [];
  const installedPackages = new Set();
  const removedPackages = new Map();
  for (const item of items) {
    let recoveredCompanions;
    try {
      if (options.remove) {
        const removalKey = `${item.profile}:${item.packageName}`;
        if (removedPackages.has(removalKey)) {
          results.push({ catalogId: item.catalogId, status: 'already-removed', packageName: item.packageName, profile: item.profile, sharedPackage: true, companions: removedPackages.get(removalKey) });
          continue;
        }
        const before = requireDshSuccess(await runDsh(['plugin', '--profile', item.profile, 'list', '--depth', '0', '--json']), 'Read installed packages before removal');
        // A prior attempt may have removed the package and stopped at an edited
        // companion. Absence must not prevent the protected recovery retry.
        if (parsePluginList(before.stdout)[item.packageName]) requireDshSuccess(await runDsh(['plugin', '--profile', item.profile, 'remove', item.packageName]), 'Remove community package');
        const listing = await runDsh(['plugin', '--profile', item.profile, 'list', '--depth', '0', '--json']);
        if (listing.code !== 0 || parsePluginList(listing.stdout)[item.packageName]) throw new Error('Package removal was not confirmed.');
        const companions = await restoreCompanions(item.packageName, { dshHome });
        recoveredCompanions = companions;
        const composition = await runDsh(['--profile', item.profile, '--dump-config']);
        if (composition.code !== 0 || composition.stdout.includes(item.packageName)) throw new Error('The package is absent, but the DSH profile still references it or could not be composed. Companion recovery has completed. Reinstall this same reviewed package with this installer, then remove it again; inspect the profile locally if composition still fails.');
        removedPackages.set(removalKey, companions);
        results.push({ catalogId: item.catalogId, status: 'removed', packageName: item.packageName, profile: item.profile, companions });
        continue;
      }
      const key = `${item.profile}:${item.packageName}:${item.packageVersion}:${item.artifact?.sha256 || item.specifier}`;
      const alreadyInstalled = installedPackages.has(key);
      if (!alreadyInstalled) {
        const specifier = item.artifact ? await prepare(item) : validateRecipe(item).specifier;
        requireDshSuccess(await runDsh(['plugin', '--profile', item.profile, 'add', specifier, '--save-exact']), 'Install community package');
      }
      const listing = await runDsh(['plugin', '--profile', item.profile, 'list', '--depth', '0', '--json']);
      if (listing.code !== 0 || parsePluginList(listing.stdout)[item.packageName]?.version !== item.packageVersion) throw new Error('Installed package name or version differs.');
      const composition = await runDsh(['--profile', item.profile, '--dump-config']);
      if (composition.code !== 0 || !composition.stdout.includes(item.packageName)) throw new Error('The installed package did not join the profile.');
      const companion = await installCompanion(item, { skillRoot: companionSkillRoot, dshHome });
      installedPackages.add(key);
      results.push({ catalogId: item.catalogId, status: alreadyInstalled ? 'already-installed' : 'installed', packageName: item.packageName, profile: item.profile, companion, activation: item.activation, activationRequired: item.activation?.kind !== 'automatic' });
    } catch (error) { results.push({ catalogId: item.catalogId, status: 'failed', error: error.message, ...(recoveredCompanions !== undefined ? { companions: recoveredCompanions } : {}) }); }
  }
  return { dshVersion: catalog.dshVersion, status: results.some((item) => item.status === 'failed') ? 'incomplete' : options.remove ? 'removed' : 'installed', items: results };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  (async () => {
    const args = process.argv.slice(2); const options = {};
    for (let index = 0; index < args.length; index++) {
      if (args[index] === '--ids') options.ids = args[++index]?.split(',').map((value) => value.trim());
      else if (args[index] === '--inspect') options.inspect = true;
      else if (args[index] === '--remove') options.remove = true;
      else throw new Error(`Unknown option: ${args[index]}`);
    }
    const result = await installCommunityItems(JSON.parse(await readFile(catalogUrl, 'utf8')), options);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (result.status === 'incomplete') process.exitCode = 1;
  })().catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
}
