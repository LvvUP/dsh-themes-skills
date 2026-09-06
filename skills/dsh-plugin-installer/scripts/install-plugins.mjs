#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { link, mkdir, readFile, rm, writeFile, stat } from 'node:fs/promises';
import http from 'node:http';
import { homedir } from 'node:os';
import { dirname, join, resolve, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

const skillRoot = fileURLToPath(new URL('../', import.meta.url));
const catalogUrl = new URL('../references/plugins.json', import.meta.url);
const launcherPath = fileURLToPath(new URL('../../dsh-theme-manager/scripts/dsh-alpha.mjs', import.meta.url));
const publicIdPattern = /^#[1-9]\d{3}$/;
const packageNamePattern = /^(@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/i;
function installerHome(environment = process.env) {
  let home = environment.DSH_HOME?.trim() ? environment.DSH_HOME : join(homedir(), '.dsh');
  if (home === '~') home = homedir();
  else if (/^~[/\\]/.test(home)) home = join(homedir(), home.slice(2));
  if (!isAbsolute(home)) throw new Error('DSH_HOME must be an absolute path for this installer.');
  return resolve(home);
}
const sourceCacheDirectory = (environment = process.env) => join(installerHome(environment), 'dsh-themes-artifacts');

export function selectPlugins(catalog, { ids, top10 = false } = {}) {
  if (Boolean(ids?.length) === top10) throw new Error('Choose --ids or --top10.');
  const selections = top10 ? catalog.top10.map((id) => `#${id}`) : ids;
  const seen = new Set();
  return selections.map((input) => {
    if (!publicIdPattern.test(input)) throw new Error(`Use the exact catalog number, such as #3006: ${input}`);
    if (seen.has(input)) throw new Error(`Duplicate catalog number: ${input}`);
    seen.add(input);
    const item = catalog.items.find((entry) => entry.catalogId === Number(input.slice(1)));
    if (!item) throw new Error(`${input} is not in the current curated catalog. No replacement was selected.`);
    return item;
  });
}

export function validateRecipe(item) {
  if (!Number.isInteger(item.catalogId) || item.catalogId < 1000 || item.catalogId > 3999) throw new Error('Invalid catalog number.');
  if (!packageNamePattern.test(item.packageName)) throw new Error(`Invalid package name for #${item.catalogId}.`);
  if (!/^[a-z0-9][a-z0-9_-]*$/i.test(item.profile)) throw new Error(`Invalid profile for #${item.catalogId}.`);
  const github = /^github:([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)#([a-f0-9]{40})$/;
  const npm = /^(@[a-z0-9._-]+\/)?[a-z0-9._-]+@\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?(?:\+[a-z0-9.-]+)?$/i;
  if (!github.test(item.specifier) && !npm.test(item.specifier)) throw new Error(`An exact npm version or GitHub commit is required for #${item.catalogId}.`);
  const git = item.specifier.match(github);
  if (git && (git[1] !== item.sourceRepository || git[2] !== item.sourceRevision)) throw new Error(`Source and installation recipe disagree for #${item.catalogId}.`);
  if (!git && !item.specifier.startsWith(`${item.packageName}@`)) throw new Error(`Package and installation recipe disagree for #${item.catalogId}.`);
  if ((item.allowBuilds ?? []).some((name) => !packageNamePattern.test(name))) throw new Error(`Invalid build package for #${item.catalogId}.`);
  if ((item.dependencies ?? []).some((specifier) => !npm.test(specifier))) throw new Error(`Additional dependencies must use exact npm versions for #${item.catalogId}.`);
  if ((item.requiredEnvironmentFiles ?? []).some((name) => !/^[A-Z][A-Z0-9_]{0,63}$/.test(name))) throw new Error(`Invalid required environment variable for #${item.catalogId}.`);
  if (item.artifact && (!/^assets\/alpha\/artifacts\/[a-f0-9]{64}\.tgz$/.test(item.artifact.path) || !/^[a-f0-9]{64}$/.test(item.artifact.sha256) || !npm.test(`${item.packageName}@${item.artifact.packageVersion}`) || !item.artifact.path.includes(item.artifact.sha256))) throw new Error(`Invalid adapted artifact for #${item.catalogId}.`);
  return item;
}

export function parsePluginList(stdout) {
  let profiles;
  try { profiles = JSON.parse(stdout); } catch { throw new Error('DSH plugin list did not return valid JSON.'); }
  if (!Array.isArray(profiles)) throw new Error('DSH plugin list did not return a JSON array.');
  return Object.assign({}, ...profiles.map((profile) => profile.dependencies ?? {}));
}

function parseProfilePlugins(stdout, profile, environment) {
  const dependencies = parsePluginList(stdout);
  const profiles = JSON.parse(stdout);
  const expected = join(installerHome(environment), 'profiles', profile);
  if (profiles.length !== 1 || typeof profiles[0].path !== 'string' || !isAbsolute(profiles[0].path) || profiles[0].path !== resolve(profiles[0].path) || profiles[0].path !== expected) throw new Error('DSH plugin list did not identify the requested profile directory.');
  return Object.fromEntries(Object.entries(dependencies).map(([name, entry]) => [name, {
    ...entry,
    // pnpm reports local tarballs relative to the profile, not the caller cwd.
    archivePath: typeof entry.resolved === 'string' && entry.resolved.startsWith('file:') ? resolve(expected, entry.resolved.slice(5)) : null,
  }]));
}

export function createDshExecutor({ env = process.env, cwd = process.cwd(), timeoutMs = 300_000, launcher = launcherPath } = {}) {
  return (args) => new Promise((done) => {
    const child = spawn(process.execPath, [launcher, ...args], { cwd, env, stdio: ['ignore', 'pipe', 'pipe'], shell: false, detached: process.platform !== 'win32' });
    let stdout = '';
    let stderr = '';
    const timeout = setTimeout(() => {
      // Stop the launcher and pnpm/build descendants together on Unix.
      if (process.platform !== 'win32' && child.pid) {
        try { process.kill(-child.pid, 'SIGTERM'); } catch {}
      } else child.kill('SIGTERM');
    }, timeoutMs);
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.once('error', (error) => { clearTimeout(timeout); done({ code: 1, stdout, stderr: error.message }); });
    child.once('close', (code, signal) => {
      clearTimeout(timeout);
      done({ code: code ?? 1, stdout, stderr: signal ? `${stderr}\nDSH command ended with ${signal}.` : stderr });
    });
  });
}

export function requireDshSuccess(result, action) {
  // Even an ordinary YAML parse error can quote a user's API key. Command
  // diagnostics stay local to DSH; never copy them into the installer result.
  if (result.code !== 0) throw new Error(`${action} failed (exit ${Number.isInteger(result.code) ? result.code : 'unknown'}). Inspect the DSH command locally for its private diagnostic.`);
  return result;
}

async function cacheVerifiedArchive(file, bytes, verify) {
  await mkdir(dirname(file), { recursive: true });
  const pending = `${file}.${randomUUID()}.tmp`;
  try {
    await writeFile(pending, bytes, { flag: 'wx', mode: 0o600 });
    // Publish only complete, verified bytes. A concurrent writer may win, but
    // its file must pass the same digest check before this call can reuse it.
    try { await link(pending, file); } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      verify(await readFile(file));
    }
  } finally { await rm(pending, { force: true }); }
  return file;
}

function registryArchiveInfo(item, cacheDirectory = sourceCacheDirectory()) {
  const integrity = item.validation?.registryIntegrity;
  const encoded = typeof integrity === 'string' ? integrity.slice(7) : '';
  if (!/^sha512-[A-Za-z0-9+/]{86}==$/.test(integrity ?? '') || Buffer.from(encoded, 'base64').toString('base64') !== encoded) throw new Error(`#${item.catalogId} needs a reviewed npm archive SHA-512 integrity.`);
  const version = item.specifier.slice(item.packageName.length + 1);
  const basename = item.packageName.split('/').at(-1);
  return {
    url: `https://registry.npmjs.org/${item.packageName}/-/${basename}-${version}.tgz`,
    integrity,
    path: resolve(cacheDirectory, `npm-${createHash('sha256').update(integrity).digest('hex')}.tgz`),
  };
}

export async function prepareRegistryArchive(item, { fetchArchive = fetch, cacheDirectory = sourceCacheDirectory() } = {}) {
  validateRecipe(item);
  if (item.artifact || item.specifier.startsWith('github:')) throw new Error('Use the declared artifact or source archive for this recipe.');
  const archive = registryArchiveInfo(item, cacheDirectory);
  const verify = (bytes) => {
    if (`sha512-${createHash('sha512').update(bytes).digest('base64')}` !== archive.integrity) throw new Error(`Npm archive integrity differs for #${item.catalogId}.`);
  };
  try { const bytes = await readFile(archive.path); verify(bytes); return archive.path; } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const restoreProxy = http.setGlobalProxyFromEnv?.();
  try {
    const response = await fetchArchive(archive.url, { signal: AbortSignal.timeout(120_000), redirect: 'error' });
    if (!response.ok) throw new Error(`Npm archive returned HTTP ${response.status}.`);
    const chunks = []; let size = 0;
    for await (const chunk of response.body) { size += chunk.length; if (size > 100 * 1024 * 1024) throw new Error('Npm archive exceeds 100 MiB.'); chunks.push(chunk); }
    const bytes = Buffer.concat(chunks);
    verify(bytes);
    return await cacheVerifiedArchive(archive.path, bytes, verify);
  } finally { restoreProxy?.(); }
}

export async function prepareSourceArchive(item, { fetchArchive = fetch, cacheDirectory = sourceCacheDirectory() } = {}) {
  const review = item.validation?.prebuiltArchive;
  if (review?.status !== 'verified' || !/^[a-f0-9]{64}$/.test(review.archiveSha256)) throw new Error(`#${item.catalogId} needs a verified source archive digest.`);
  const file = resolve(cacheDirectory, `${review.archiveSha256}.tgz`);
  const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
  try { const bytes = await readFile(file); if (hash(bytes) !== review.archiveSha256) throw new Error('Cached source archive has changed.'); return file; } catch (error) { if (error.code !== 'ENOENT') throw error; }
  // Respect an existing proxy configuration without adding a network dependency.
  const restoreProxy = http.setGlobalProxyFromEnv?.();
  try {
    const response = await fetchArchive(packageInstallSpecifier(item), { signal: AbortSignal.timeout(120_000), redirect: 'error' });
    if (!response.ok) throw new Error(`Source archive returned HTTP ${response.status}.`);
    const chunks = []; let size = 0;
    for await (const chunk of response.body) { size += chunk.length; if (size > 100 * 1024 * 1024) throw new Error('Source archive exceeds 100 MiB.'); chunks.push(chunk); }
    const bytes = Buffer.concat(chunks);
    if (hash(bytes) !== review.archiveSha256) throw new Error('Source archive digest differs.');
    return await cacheVerifiedArchive(file, bytes, (existing) => { if (hash(existing) !== review.archiveSha256) throw new Error('Cached source archive has changed.'); });
  } finally { restoreProxy?.(); }
}

export function packageInstallSpecifier(item) {
  if (item.artifact) return resolve(skillRoot, item.artifact.path);
  const github = item.specifier.match(/^github:([^#]+)#([a-f0-9]{40})$/);
  // This is a download URL only. pnpm recognizes GitHub URLs and may run
  // prepare; installPlugins passes the verified local archive to the CLI.
  if (github && item.validation?.prebuiltArchive?.status !== 'verified') throw new Error(`#${item.catalogId} needs a reviewed, complete prebuilt archive before installation.`);
  return github ? `https://codeload.github.com/${github[1]}/tar.gz/${github[2]}` : item.specifier;
}

function isSameSource(installed, item, archivePath) {
  if (!installed) return false;
  if (installed.archivePath !== resolve(archivePath)) return false;
  if (item.artifact) return installed.version === item.artifact.packageVersion;
  return item.specifier.startsWith('github:') || installed.version === item.specifier.slice(item.packageName.length + 1);
}

export async function installPlugins(catalog, options, { runDsh = createDshExecutor(), onProgress = () => {}, prepareSource = prepareSourceArchive, prepareRegistry, environment = process.env } = {}) {
  const items = selectPlugins(catalog, options).map(validateRecipe);
  const cacheDirectory = sourceCacheDirectory(environment);
  const registryArchives = items.map(item => {
    if (item.artifact || item.specifier.startsWith('github:')) return null;
    try { return registryArchiveInfo(item, cacheDirectory); } catch { return null; }
  });
  const plan = items.map((item, index) => {
    let archivePath = null;
    let archivePreparation = null;
    if (item.artifact) archivePath = packageInstallSpecifier(item);
    else if (item.specifier.startsWith('github:')) {
      const review = item.validation?.prebuiltArchive;
      if (review?.status === 'verified' && /^[a-f0-9]{64}$/.test(review.archiveSha256)) archivePath = join(cacheDirectory, `${review.archiveSha256}.tgz`);
      archivePreparation = {
        url: review?.status === 'verified' ? packageInstallSpecifier(item) : null,
        sha256: review?.archiveSha256 ?? null,
        installation: 'Download, verify the digest, and pass the local .tgz to DSH. Do not pass the GitHub URL directly to pnpm.',
      };
    } else {
      const registry = registryArchives[index];
      archivePath = registry?.path ?? null;
      archivePreparation = { url: registry?.url ?? null, integrity: item.validation?.registryIntegrity ?? null, installation: 'Download from the fixed npm registry, verify the reviewed integrity, and pass the local .tgz to DSH.' };
    }
    return {
      catalogId: item.catalogId,
      slug: item.slug,
      packageName: item.packageName,
      profile: item.profile,
      setup: item.setup ?? null,
      requiredEnvironmentFiles: item.requiredEnvironmentFiles ?? [],
      archivePreparation,
      command: archivePath ? ['plugin', '--profile', item.profile, 'add', archivePath, ...(item.dependencies ?? []), '--save-exact', ...(item.allowBuilds ?? []).map((name) => `--allow-build=${name}`)] : null,
    };
  });
  if (options.dryRun) return { dshVersion: catalog.dshVersion, status: 'planned', items: plan };
  const blocked = plan.find((item) => item.command === null);
  if (blocked) throw new Error(`#${blocked.catalogId} needs a reviewed archive digest before installation.`);
  for (const item of items.filter((entry) => entry.artifact)) {
    const bytes = await readFile(packageInstallSpecifier(item));
    if (createHash('sha256').update(bytes).digest('hex') !== item.artifact.sha256) throw new Error(`Adapted archive digest differs for #${item.catalogId}.`);
  }
  const version = requireDshSuccess(await runDsh(['--version']), 'Read DSH version');
  if (!version.stdout.split(/\s+/).includes(catalog.dshVersion)) throw new Error(`This catalog targets DSH ${catalog.dshVersion}; the installed version differs.`);

  const results = [];
  for (const [index, item] of items.entries()) {
    onProgress({ catalogId: item.catalogId, status: 'installing' });
    try {
      for (const variable of item.requiredEnvironmentFiles ?? []) {
        const file = environment[variable];
        if (!file || !isAbsolute(file) || !(await stat(file).then((entry) => entry.isFile(), () => false))) throw new Error(`Set ${variable} to the absolute path of the installed prerequisite before installing #${item.catalogId}. See this plugin's setup instructions.`);
      }
      const command = [...plan[index].command];
      if (!item.artifact) command[4] = item.specifier.startsWith('github:') ? await prepareSource(item) : await (prepareRegistry ?? ((entry) => prepareRegistryArchive(entry, { cacheDirectory })))(item);
      if (!isAbsolute(command[4])) throw new Error('Verified package archive must have an absolute path.');
      const before = parseProfilePlugins(requireDshSuccess(await runDsh(['plugin', '--profile', item.profile, 'list', '--depth', '0', '--json']), 'Read installed plugins').stdout, item.profile, environment);
      const dependenciesMatch = (listing) => (item.dependencies ?? []).every((specifier) => { const separator = specifier.lastIndexOf('@'); return listing[specifier.slice(0, separator)]?.version === specifier.slice(separator + 1); });
      const alreadyInstalled = isSameSource(before[item.packageName], item, command[4]) && dependenciesMatch(before);
      if (!alreadyInstalled) {
        requireDshSuccess(await runDsh(command), `Install #${item.catalogId}`);
      }
      const after = parseProfilePlugins(requireDshSuccess(await runDsh(['plugin', '--profile', item.profile, 'list', '--depth', '0', '--json']), 'Verify installed package').stdout, item.profile, environment);
      if (!after[item.packageName]) throw new Error(`DSH did not list ${item.packageName} after installation.`);
      if (!dependenciesMatch(after)) throw new Error('An additional pinned dependency did not install at the requested version.');
      if (!isSameSource(after[item.packageName], item, command[4])) throw new Error(`DSH installed a different source version for ${item.packageName}.`);
      const composition = requireDshSuccess(await runDsh(['--profile', item.profile, '--dump-config']), 'Verify profile composition');
      if (!composition.stdout.includes(item.packageName)) throw new Error(`${item.packageName} was installed as a dependency but did not join the DSH profile.`);
      results.push({ catalogId: item.catalogId, slug: item.slug, packageName: item.packageName, profile: item.profile, status: alreadyInstalled ? 'already-installed' : 'installed', installedVersion: after[item.packageName].version, setup: item.setup ?? null });
    } catch (error) {
      results.push({ catalogId: item.catalogId, slug: item.slug, profile: item.profile, status: 'failed', error: error.message });
    }
    onProgress(results.at(-1));
  }
  return { dshVersion: catalog.dshVersion, status: results.some((item) => item.status === 'failed') ? 'incomplete' : 'installed', items: results };
}

export function parseArguments(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index];
    if (flag === '--ids') options.ids = args[++index]?.split(',').map((value) => value.trim());
    else if (flag === '--top10') options.top10 = true;
    else if (flag === '--dry-run') options.dryRun = true;
    else throw new Error(`Unknown option: ${flag}`);
  }
  return options;
}

async function main() {
  const catalog = JSON.parse(await readFile(catalogUrl, 'utf8'));
  const options = parseArguments(process.argv.slice(2));
  if (!options.dryRun) {
    const pending = selectPlugins(catalog, options).find((item) => item.validation?.status !== 'runtime-verified');
    if (pending) throw new Error(`#${pending.catalogId} has not passed Alpha runtime verification. Use --dry-run to inspect it.`);
  }
  const result = await installPlugins(catalog, options, {
    onProgress: (item) => process.stderr.write(`#${item.catalogId}: ${item.status}\n`),
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (result.status === 'incomplete') process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
}
