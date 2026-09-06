#!/usr/bin/env node
// Serial, isolated install/boot/remove evidence. Feature certification is separate.
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, statfs, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { classifyPluginBrowserDiagnostics } from './dsh-plugin-optional-runtime.mjs';

const skillsRoot = path.resolve(process.argv[2] ?? '../dsh-themes-skills');
const installerPath = path.join(
  skillsRoot,
  'skills/dsh-plugin-installer/scripts/install-plugins.mjs'
);
const launcher = path.join(
  skillsRoot,
  'skills/dsh-theme-manager/scripts/dsh-alpha.mjs'
);
const {
  installPlugins,
  createDshExecutor,
  prepareSourceArchive,
  prepareRegistryArchive,
  parsePluginList,
} = await import(pathToFileURL(installerPath));
const catalog = JSON.parse(
  await readFile(
    process.env.DSH_PLUGIN_TEST_CATALOG ||
      path.join(
        skillsRoot,
        'skills/dsh-plugin-installer/references/plugins.json'
      ),
    'utf8'
  )
);
const root = path.resolve('.cache/dsh-plugin-runtime');
const npmArchives = JSON.parse(
  await readFile(path.join(root, 'npm-revalidation/index.json')).catch(
    () => '[]'
  )
);
async function pinnedNpmArchive(item) {
  const entry = npmArchives.find((entry) => entry.catalogId === item.catalogId);
  if (
    !entry ||
    item.artifact ||
    item.specifier.startsWith('github:') ||
    entry.specifier !== item.specifier ||
    entry.sourceRevision !== item.sourceRevision ||
    entry.integrity !== item.validation.registryIntegrity
  )
    return null;
  const bytes = await readFile(entry.path);
  const [algorithm, digest] = entry.integrity.split('-');
  if (
    bytes.length !== entry.bytes ||
    createHash('sha256').update(bytes).digest('hex') !== entry.sha256 ||
    createHash(algorithm).update(bytes).digest('base64') !== digest
  )
    throw Error(`Pinned npm archive changed: #${item.catalogId}`);
  return entry;
}
const port = 4016;
let pauseRequested = false;
process.on('SIGTERM', () => {
  pauseRequested = true;
});
await mkdir(root, { recursive: true });
const chosen = process.argv.slice(3).map(Number);
const items =
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
    ? catalog.items.filter(
        (item) => !chosen.length || chosen.includes(item.catalogId)
      )
    : [];
const redact = (value) =>
  value.replace(/([?&]token=)[A-Za-z0-9_-]+/g, '$1[local-token]');

async function browserCommand(args) {
  const child = spawn(
    'pnpm',
    ['exec', 'playwright-cli', '-s=dsh-catalog-runtime', ...args],
    { stdio: ['ignore', 'pipe', 'pipe'], shell: false }
  );
  let output = '';
  child.stdout.on('data', (value) => {
    output += value;
  });
  child.stderr.on('data', (value) => {
    output += value;
  });
  return new Promise((resolve) =>
    child.once('exit', (code) => resolve({ code, output }))
  );
}
let browserOpened = false;

async function boot(item, env) {
  let hostProbe = null;
  const packageManifest = JSON.parse(
    await readFile(
      path.join(
        env.DSH_HOME,
        'profiles',
        item.profile,
        'node_modules',
        item.packageName,
        'package.json'
      ),
      'utf8'
    )
  );
  const expectsClient = Boolean(packageManifest.dsh?.client);
  if (['headless', 'web', 'tui'].includes(item.profile)) {
    const probePath = path.join(env.DSH_HOME, 'host-ready-probe.mjs');
    await writeFile(
      probePath,
      `export const name = 'dsh-catalog-host-ready-probe';\nexport function apply(ctx) {\n  ${item.profile === 'tui' ? "ctx.on('agent-loop/config-start-failed', ({sessionId,error}) => process.stdout.write('DSH_TUI_START_FAILURE ' + JSON.stringify({sessionId,message:error?.message,stack:error?.stack,cause:error?.cause?.stack}) + '\\n')); ctx.on('agent/created', ({agent}) => process.stdout.write('DSH_TUI_AGENT_CREATED ' + agent.id + '\\n'));" : ''}\n  ctx.get('appReady').onReady(async () => {\n    const entries = [...ctx.get('loader').entries()].filter(entry => entry.options.name === ${JSON.stringify(item.packageName)} || entry.options.name?.startsWith(${JSON.stringify(`${item.packageName}/`)}));\n    const result = { packageName: ${JSON.stringify(item.packageName)}, hostTreeReady: true, entries: entries.map(entry => ({ name: entry.options.name, disabled: entry.disabled, state: entry.fiber?.state })) };\n    result.packageActive = entries.some(entry => !entry.disabled && entry.fiber?.state === 2);\n    ${item.catalogId === 3102 ? `result.mcpEvidence = { active: [...ctx.get('loader').entries()].some(entry => entry.options.name === '@deepseek-ai/dsh-mcp-client' && !entry.disabled && entry.fiber?.state === 2), toolNames:ctx.get('tools').schemas().map(tool => tool.name).filter(name => name.startsWith('mcp__shopline__')), skillNames:(await ctx.get('skills').list({cwd:${JSON.stringify(env.DSH_HOME)}})).map(skill => skill.name).filter(name => name.startsWith('shopline-')), modelTask:false };` : ''}\n    process.stdout.write('DSH_CATALOG_HOST_READY ' + JSON.stringify(result) + '\\n');\n    ${item.profile === 'tui' ? "setTimeout(() => process.stdout.write('DSH_TUI_DIAGNOSTIC ' + JSON.stringify({ identities:ctx.get('configuredAgentIdentities'), startup:ctx.get('tuiStartup'), roots:ctx.get('agents').roots().map(agent => ({id:agent.id,status:agent.status})), configured:ctx.get('agentLoop')?.config?.agents, loop:[...ctx.get('loader').entries()].filter(entry => entry.options.name === '@deepseek-ai/dsh-agent-loop').map(entry => ({state:entry.fiber?.state,disabled:entry.disabled})) }) + '\\n'), 2000);" : ''}\n    ${item.profile === 'headless' ? "ctx.get('appExit')(result.packageActive ? 0 : 1);" : ''}\n  });\n}\n`
    );
    hostProbe = path.join(env.DSH_HOME, 'host-ready.patch.yml');
    await writeFile(
      hostProbe,
      `${item.profile === 'headless' ? '- id: headless-startup\n  disabled: true\n- id: headless-runner\n  disabled: true\n' : ''}- insert:\n    - id: dsh-catalog-host-ready-probe\n      name: ${JSON.stringify(probePath)}\n${item.catalogId === 3025 && process.env.DSH_MILESTONE_FIXTURE ? `    - id: milestone-browser-fixture\n      name: ${JSON.stringify(path.resolve('scripts/fixtures/dsh-milestone-browser.mjs'))}\n` : ''}`
    );
  }
  const args =
    item.profile === 'web'
      ? [
          'web',
          '--patch',
          hostProbe,
          '--no-open',
          '--host',
          '127.0.0.1',
          '--port',
          String(port),
        ]
      : hostProbe
        ? ['--profile', item.profile, '--patch', hostProbe]
        : ['--profile', item.profile, '--help'];
  const child =
    item.profile === 'tui'
      ? spawn(
          'python3',
          [
            path.resolve('scripts/dsh-plugin-tui-probe.py'),
            process.execPath,
            launcher,
            ...args,
          ],
          {
            env,
            detached: true,
            stdio: ['ignore', 'pipe', 'pipe'],
            shell: false,
          }
        )
      : spawn(process.execPath, [launcher, ...args], {
          env,
          detached: true,
          stdio: ['ignore', 'pipe', 'pipe'],
          shell: false,
        });
  let stdout = '',
    stderr = '',
    exited = false,
    code = null;
  child.stdout.on('data', (value) => {
    stdout += value;
  });
  child.stderr.on('data', (value) => {
    stderr += value;
  });
  child.on('exit', (value) => {
    exited = true;
    code = value;
  });
  for (
    let count = 0;
    count < (item.catalogId === 3102 ? 120 : 50) &&
    !exited &&
    !stdout.includes('dsh web:');
    count++
  )
    await new Promise((resolve) => setTimeout(resolve, 500));
  const authUrl = stdout.match(
    new RegExp(`http://127\\.0\\.0\\.1:${port}/\\?token=[A-Za-z0-9_-]+`)
  )?.[0];
  let httpStatus = null,
    htmlLoaded = false,
    browser = null;
  if (authUrl) {
    try {
      const screenshot = path.join(env.DSH_HOME, 'browser.png');
      const probe = await browserCommand([
        'run-code',
        `async page => {
        const errors = [], requests = [], servedResponses = [];
        const pageError = error => errors.push(error.message);
        const consoleError = message => { if (message.type() === 'error') errors.push(message.text()); };
        const responseError = response => { servedResponses.push({url:response.url(),status:response.status()}); if (response.status() >= 400) requests.push({ status: response.status(), url: response.url() }); };
        page.on('pageerror', pageError); page.on('console', consoleError); page.on('response', responseError);
        const response = await page.goto(${JSON.stringify(authUrl)});
        await page.waitForTimeout(1500);
        const continueButton = page.getByRole('button', { name: '继续', exact: true });
        if (await continueButton.count()) await continueButton.click();
        ${item.catalogId === 3025 && process.env.DSH_MILESTONE_FIXTURE ? `const later=page.getByRole('button',{name:'稍后配置',exact:true}); if(await later.count()) await later.click(); const ungrouped=page.getByText('未分组',{exact:true}); if(await ungrouped.count()) await ungrouped.click(); await page.waitForTimeout(500); await page.screenshot({path:${JSON.stringify(path.join(root, 'milestone-before-open.png'))}}); if (!(await page.getByText('Milestone browser fixture', {exact:true}).count())) throw Error('Fixture session absent: '+(await page.locator('body').innerText()).slice(0,3500)); await page.getByText('Milestone browser fixture', {exact:true}).first().click({timeout:5000}); await page.waitForTimeout(1200); const fixtureRail = await page.locator('[data-rail-dot]').count(); if (fixtureRail !== 3) {await page.screenshot({path:${JSON.stringify(path.join(root, 'milestone-open-failed.png'))}}); throw Error('Expected 3 actual milestone fixture dots, got '+fixtureRail+' errors='+JSON.stringify(errors)+' body='+(await page.locator('body').innerText()).slice(0,2500));} await page.locator('[data-rail-dot]').nth(1).click();` : ''}
        await page.screenshot({ path: ${JSON.stringify(screenshot)} });
        const clientEvidence = await page.evaluate(({ packageName, expected }) => {
          const boot = window.__DSH_BOOT__;
          const entry = boot?.entries?.find(entry => entry.id === packageName || entry.id === packageName + '/client');
          const batch = entry ? boot?.batches?.find(batch => batch.entries.includes(entry.id)) : null;
          const urls = [entry?.url, batch?.url].filter(Boolean).map(url => new URL(url, location.href).href);
          const resources = performance.getEntriesByType('resource').filter(resource => urls.includes(resource.name)).map(resource => ({url:resource.name, duration:resource.duration, responseStatus:resource.responseStatus}));
          return { expected, moduleEntry:entry ?? null, batch:batch ?? null, resources, loaded:expected ? !!entry && resources.length > 0 : true };
        }, {packageName:${JSON.stringify(item.packageName)}, expected:${expectsClient}});
        clientEvidence.responses = servedResponses.filter(response => clientEvidence.resources.some(resource => resource.url === response.url));
        const apiProbes = ${
          item.catalogId === 3091
            ? `await page.evaluate(async () => {
          const results = [];
          for (const endpoint of ['/memory-evolve/api/config', '/memory-evolve/api/memory-files']) {
            const response = await fetch(endpoint);
            const body = await response.json();
            results.push({path:endpoint,status:response.status,validShape:endpoint.endsWith('/config') ? typeof body.config?.memoryTabEnabled === 'boolean' : Array.isArray(body.files)});
          }
          return results;
        })`
            : '[]'
        };
        const sessionFixture = ${item.catalogId === 3025 && process.env.DSH_MILESTONE_FIXTURE ? `{kind:'synthetic-native-session',messages:3,actualRailDots:await page.locator('[data-rail-dot]').count(),jumpedToSecond:true,modelTask:false}` : 'null'};
        const result = { clientEvidence, apiProbes, sessionFixture, httpStatus: response.status(), title: await page.title(), body: (await page.locator('body').innerText()).slice(0, 1500), errors, requests };
        page.off('pageerror', pageError); page.off('console', consoleError); page.off('response', responseError);
        return result;
      }`,
      ]);
      const json = probe.output.match(/### Result\s*\n(\{[^\n]+\})/);
      if (!json) throw new Error(probe.output);
      browser = JSON.parse(json[1]);
      httpStatus = browser.httpStatus;
      htmlLoaded =
        (item.catalogId !== 3091 ||
          (browser.apiProbes?.length === 2 &&
            browser.apiProbes.every(
              (probe) => probe.status === 200 && probe.validShape
            ))) &&
        httpStatus === 200 &&
        (browser.title === 'DeepSeek Harness' ||
          (item.catalogId === 3025 &&
            process.env.DSH_MILESTONE_FIXTURE &&
            browser.title ===
              'Milestone browser fixture — DeepSeek Harness')) &&
        browser.body.length > 30 &&
        !/Failed to load plugins|failed to import loader entry/i.test(
          browser.body
        );
    } catch (error) {
      stderr += `\nHTTP check: ${error.message}`;
    }
  }
  if (!exited) {
    try {
      process.kill(-child.pid, 'SIGTERM');
    } catch {}
    for (let count = 0; count < 20 && !exited; count++)
      await new Promise((resolve) => setTimeout(resolve, 100));
  }
  const hostReadyMatch = stdout.match(/DSH_CATALOG_HOST_READY (\{[^\n]+\})/);
  const hostReady = hostReadyMatch ? JSON.parse(hostReadyMatch[1]) : null;
  const tuiMatch = stdout.match(/DSH_CATALOG_TUI (\{[^\n]+\})/);
  const tui = tuiMatch ? JSON.parse(tuiMatch[1]) : null;
  const fatal =
    /(?:\bError:|ERR_MODULE_NOT_FOUND|Cannot find|failed to|TypeError:|unhandled)/i.test(
      `${stdout}\n${stderr}`
    );
  const diagnostics = classifyPluginBrowserDiagnostics(item, browser);
  const storageEvidence =
    item.catalogId === 3051
      ? {
          directory: path.join(env.DSH_HOME, 'plugin-data', 'tdai-memory'),
          sqliteInitialized: await readFile(
            path.join(env.DSH_HOME, 'plugin-data', 'tdai-memory', 'vectors.db')
          ).then(
            (bytes) => bytes.subarray(0, 16).toString() === 'SQLite format 3\0',
            () => false
          ),
          globalDefaultAbsent: await readFile(
            path.join(
              process.env.HOME,
              '.memory-tencentdb',
              'memory-tdai',
              'vectors.db'
            )
          ).then(
            () => false,
            (error) => error.code === 'ENOENT'
          ),
          modelTask: false,
        }
      : null;
  return {
    status: (
      item.profile === 'web'
        ? htmlLoaded &&
          (!storageEvidence ||
            (storageEvidence.sqliteInitialized &&
              storageEvidence.globalDefaultAbsent)) &&
          !fatal &&
          !diagnostics.errors.length &&
          !diagnostics.requests.length &&
          hostReady?.hostTreeReady &&
          hostReady?.packageActive &&
          (item.catalogId !== 3102 ||
            (hostReady.mcpEvidence?.active &&
              hostReady.mcpEvidence.toolNames.length > 0 &&
              hostReady.mcpEvidence.skillNames.length === 8)) &&
          browser?.clientEvidence.loaded &&
          (!expectsClient ||
            browser.clientEvidence.responses.some(
              (response) => response.status === 200
            ))
        : item.profile === 'tui'
          ? hostReady?.hostTreeReady &&
            hostReady?.packageActive &&
            !fatal &&
            tui?.tty &&
            tui.helpSent &&
            tui.helpRendered &&
            tui.transcriptBytes > 500 &&
            tui.processStopped
          : code === 0 &&
            !fatal &&
            hostReady?.hostTreeReady &&
            hostReady?.packageActive
    )
      ? 'boot-passed'
      : 'boot-failed',
    profile: item.profile,
    command: args,
    hostReady,
    ...(storageEvidence ? { storageEvidence } : {}),
    ...(tui ? { tui } : {}),
    httpStatus,
    htmlLoaded,
    browser,
    ...(diagnostics.expectedResourceFailures.length
      ? { expectedResourceFailures: diagnostics.expectedResourceFailures }
      : {}),
    processStopped: exited,
    exitCode: code,
    stdout: redact(stdout),
    stderr: redact(stderr),
    featureVerification: 'pending',
    expectsClient,
  };
}

for (const item of items) {
  if (pauseRequested) {
    process.stdout.write('Paused after the completed item.\n');
    break;
  }
  const disk = await statfs(root);
  const archiveReview = item.validation?.prebuiltArchive;
  const npmArchive = await pinnedNpmArchive(item);
  // The root run permits a 400 MiB floor only for reviewed local archives
  // below 5 MiB with no production or optional dependencies.
  const smallLocalSource =
    archiveReview?.status === 'verified' &&
    archiveReview.runtimeDependencies &&
    Object.keys(archiveReview.runtimeDependencies).length === 0 &&
    archiveReview.archiveBytes < 5 * 1024 * 1024 &&
    (await readFile(
      path.join(root, 'source-archives', `${archiveReview.archiveSha256}.tgz`)
    ).then(
      () => true,
      () => false
    ));
  const smallAdaptedArtifact =
    item.artifact?.runtimeDependencies &&
    Object.keys(item.artifact.runtimeDependencies).length === 0 &&
    item.artifact.bytes < 5 * 1024 * 1024 &&
    (await readFile(
      path.join(skillsRoot, 'skills/dsh-plugin-installer', item.artifact.path)
    ).then(
      () => true,
      () => false
    ));
  const smallNpmArchive =
    npmArchive &&
    npmArchive.bytes < 5 * 1024 * 1024 &&
    Object.keys(npmArchive.runtimeDependencies).length === 0 &&
    !item.dependencies?.length;
  const minimumMiB =
    smallLocalSource || smallAdaptedArtifact || smallNpmArchive ? 400 : 700;
  if (disk.bavail * disk.bsize < minimumMiB * 1024 * 1024) {
    process.stdout.write(
      `Paused: less than ${minimumMiB} MiB available. Prune only rebuildable package caches, then resume.\n`
    );
    break;
  }
  if (item.profile === 'web' && !browserOpened) {
    await browserCommand(['open', 'about:blank', '--browser=chrome']);
    browserOpened = true;
  }
  const directory = path.join(root, `item-${item.catalogId}`);
  await mkdir(directory, { recursive: true });
  const previousEvidence = await readFile(
    path.join(directory, 'verification.json')
  ).catch(() => null);
  if (previousEvidence) {
    const { createHash } = await import('node:crypto');
    const digest = createHash('sha256').update(previousEvidence).digest('hex');
    const attempt = path.join(directory, 'attempts', digest);
    await mkdir(attempt, { recursive: true });
    await writeFile(path.join(attempt, 'verification.json'), previousEvidence);
    const screenshot = await readFile(
      path.join(directory, 'browser.png')
    ).catch(() => null);
    if (screenshot)
      await writeFile(path.join(attempt, 'browser.png'), screenshot);
  }
  const env = {
    ...process.env,
    DSH_HOME: directory,
    PNPM_CONFIG_STORE_DIR: path.join(root, 'isolated-pnpm-store'),
    CI: 'true',
    DSH_TELEMETRY_DISABLED: '1',
  };
  const run = createDshExecutor({ env, launcher });
  const runCleanup = createDshExecutor({
    env: { ...env, PNPM_CONFIG_OFFLINE: 'true' },
    launcher,
    timeoutMs: 60_000,
  });
  const commands = [];
  const runDsh = async (args) => {
    const result = await (args[3] === 'remove' ? runCleanup(args) : run(args));
    commands.push({
      args,
      ...result,
      stdout: redact(result.stdout),
      stderr: redact(result.stderr),
    });
    return result;
  };
  const startedAt = new Date().toISOString();
  let result;
  try {
    result = await installPlugins(
      catalog,
      { ids: [`#${item.catalogId}`] },
      {
        runDsh,
        environment: env,
        prepareRegistry: (entry) =>
          prepareRegistryArchive(entry, {
            cacheDirectory: path.join(root, 'npm-certified-archives'),
            ...(npmArchive
              ? {
                  fetchArchive: async () =>
                    new Response(await readFile(npmArchive.path)),
                }
              : {}),
          }),
        prepareSource: (entry) =>
          prepareSourceArchive(entry, {
            cacheDirectory: path.join(root, 'source-archives'),
          }),
        onProgress: (entry) => {
          if (entry.status === 'failed')
            process.stdout.write(
              `#${entry.catalogId} installation failed: ${redact(entry.error).slice(0, 1500)}\n`
            );
        },
      }
    );
  } catch (error) {
    result = {
      status: 'incomplete',
      items: [
        { catalogId: item.catalogId, status: 'failed', error: error.message },
      ],
    };
  }
  const runtime =
    result.status === 'installed'
      ? await boot(item, env)
      : { status: 'not-run' };
  const removal = await runDsh([
    'plugin',
    '--profile',
    item.profile,
    'remove',
    item.packageName,
  ]);
  const afterRemoval = await runDsh([
    'plugin',
    '--profile',
    item.profile,
    'list',
    '--depth',
    '0',
    '--json',
  ]);
  let packageAbsent = false;
  if (afterRemoval.code === 0) {
    try {
      packageAbsent = !Object.hasOwn(
        parsePluginList(afterRemoval.stdout),
        item.packageName
      );
    } catch {}
  }
  const evidence = {
    schemaVersion: 1,
    harnessVersion: 4,
    catalogId: item.catalogId,
    sourceRevision: item.sourceRevision,
    specifier: item.specifier,
    artifact: item.artifact ?? null,
    ...(npmArchive
      ? {
          npmArchive: {
            sha256: npmArchive.sha256,
            bytes: npmArchive.bytes,
            integrity: npmArchive.integrity,
            originalSpecifier: item.specifier,
          },
        }
      : {}),
    dshVersion: catalog.dshVersion,
    startedAt,
    finishedAt: new Date().toISOString(),
    installation: result.items[0],
    runtime,
    removal: {
      code: removal.code,
      verificationCode: afterRemoval.code,
      packageAbsent,
    },
    commands,
  };
  await writeFile(
    path.join(directory, 'verification.json'),
    `${JSON.stringify(evidence, null, 2)}\n`
  );
  // Only this script's isolated profile packages are disposable; retain all evidence.
  await rm(path.join(directory, 'profiles', item.profile, 'node_modules'), {
    recursive: true,
    force: true,
  });
  // This exact store belongs only to this serial harness. Package tarballs and
  // original source evidence remain in separate directories.
  await rm(path.join(root, 'isolated-pnpm-store'), {
    recursive: true,
    force: true,
  });
  if (browserOpened) {
    await browserCommand(['close']);
    browserOpened = false;
  }
  process.stdout.write(
    `#${item.catalogId} ${result.items[0].status} ${runtime.status}\n`
  );
}
if (browserOpened) await browserCommand(['close']);

export { boot, browserCommand };
