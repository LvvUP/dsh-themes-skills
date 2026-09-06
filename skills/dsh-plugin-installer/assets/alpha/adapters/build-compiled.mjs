#!/usr/bin/env node
// Prepare immutable compiled releases without running their lifecycle scripts.
import { readFile, writeFile, mkdir, cp, readdir, rm, symlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import http from 'node:http';

const here = path.dirname(fileURLToPath(import.meta.url));
const [id, cacheInput, outputInput, esbuildInput, runtimeInput] = process.argv.slice(2);
if (!id || !cacheInput || !outputInput || !esbuildInput || !runtimeInput) throw Error('Usage: build-compiled.mjs ID CACHE OUTPUT ESBUILD DSH_SOURCE');
const recipe = JSON.parse(await readFile(path.join(here, 'compiled-bundles.json'))).find(item => item.catalogId === Number(id));
if (!recipe) throw Error('Unknown reviewed build');
const cache = path.resolve(cacheInput), output = path.resolve(outputInput), runtime = path.resolve(runtimeInput);
if ((await readdir(output).catch(() => [])).length) throw Error('Use a fresh empty output directory.');
if (execFileSync('git', ['-C', runtime, 'rev-parse', 'HEAD'], { encoding:'utf8' }).trim() !== 'd347e703908d0406b7a7ef80e3a0e594d86b2215') throw Error('Use the fixed Alpha source.');
const require = createRequire(import.meta.url);
const esbuildPath = path.resolve(esbuildInput);
if (JSON.parse(await readFile(path.join(esbuildPath, 'package.json'))).version !== '0.28.2') throw Error('Use esbuild 0.28.2.');
const esbuild = require(esbuildPath);
await mkdir(cache, { recursive:true });
const resetProxy = http.setGlobalProxyFromEnv?.();
async function unpack(specification, destination) {
  const archive = path.join(cache, `${specification.sha256}.tgz`);
  let data = await readFile(archive).catch(() => null);
  if (!data) {
    const response = await fetch(specification.url, { signal:AbortSignal.timeout(60_000) });
    if (!response.ok) throw Error(`Archive HTTP ${response.status}`);
    data = Buffer.from(await response.arrayBuffer());
  }
  const [algorithm, digest] = specification.integrity.split('-');
  if (data.length !== specification.bytes || createHash('sha256').update(data).digest('hex') !== specification.sha256 || createHash(algorithm).update(data).digest('base64') !== digest) throw Error('Archive integrity mismatch');
  await writeFile(archive, data);
  execFileSync('python3', [path.join(here, 'unpack-reviewed.py'), archive, destination]);
}
try {
  await unpack(recipe.baseArtifact, output);
  const dependencyRoot = path.join(cache, `dependencies-${id}`);
  const dependencyDirectory = dependency => recipe.dependencyLayout === 'versioned'
    ? path.join(dependencyRoot, '.packages', dependency.key.replaceAll('/', '+'))
    : path.join(dependencyRoot, dependency.name);
  for (const dependency of recipe.dependencies) await unpack(dependency, dependencyDirectory(dependency));
  if (recipe.dependencyLayout === 'versioned') {
    const byKey = new Map(recipe.dependencies.map(dependency => [dependency.key, dependency]));
    async function linkDependency(name, key, directory) {
      const target = byKey.get(key);
      if (!target) throw Error(`Missing fixed dependency ${key}`);
      const link = path.join(directory, name);
      await mkdir(path.dirname(link), {recursive:true});
      await rm(link, {recursive:true, force:true});
      await symlink(path.relative(path.dirname(link), dependencyDirectory(target)), link);
    }
    for (const dependency of recipe.dependencies) for (const [name, key] of Object.entries(dependency.resolvedDependencies)) await linkDependency(name, key, path.join(dependencyDirectory(dependency), 'node_modules'));
    for (const key of recipe.dependencyRoots) await linkDependency(byKey.get(key).name, key, dependencyRoot);
  }
  let bundledDependencyKeys = null;
  const manifest = JSON.parse(await readFile(path.join(output, 'package.json')));
  if (manifest.name !== recipe.packageName) throw Error('Package name mismatch');
  if (Number(id) === 3045) {
    let original = await readFile(path.join(output, 'lib/index.js'), 'utf8');
    const previous = 'import { LlmError, assertNever, createUserMessage, errorChain } from "@deepseek-ai/dsh-llm";';
    if (original.split(previous).length !== 2) throw Error('Re-review changed TUI exhaustive variant guard');
    const liveEvents = /\b(agent\.session|session|live)\.events\b/g;
    if ([...original.matchAll(liveEvents)].length !== 12) throw Error('Re-review TUI live session reads');
    original = original.replace(liveEvents, '$1.snapshotEvents()');
    const questionStart = original.indexOf('function createQuestionQueue(deps) {');
    const questionEnd = original.indexOf('\n//#endregion', questionStart);
    if (questionStart < 0 || questionEnd < 0) throw Error('Re-review changed TUI question queue');
    let question = original.slice(questionStart, questionEnd);
    const provider = 'unregister: ctx.userQuestions.registerProvider({ ask(request) {';
    if (question.split(provider).length !== 2 || question.split('\n\t\t} })').length !== 2) throw Error('Re-review changed TUI provider lifecycle');
    question = question.replace(provider, 'unregister: ctx.on("user-questions/request", (request, next) => {\n\t\t\tif (request.agent !== deps.targetAgent) return next();').replace('\n\t\t} })', '\n\t\t})');
    original = original.slice(0, questionStart) + question + original.slice(questionEnd);
    const queueCall = 'createQuestionQueue({';
    if (original.split(queueCall).length !== 2) throw Error('Re-review changed TUI queue agent ownership');
    original = original.replace(queueCall, queueCall + '\n targetAgent: agent,');
    const commandCall = 'ctx.commands.execute(agent, text, controller.signal)';
    if (original.split(commandCall).length !== 2) throw Error('Re-review changed TUI command request');
    original = original.replace(commandCall, 'ctx.commands.execute(agent, text, [], controller.signal)');
    await writeFile(path.join(output, 'lib/index.js'), original.replace(previous, 'import { LlmError, createUserMessage, errorChain } from "@deepseek-ai/dsh-llm";\nimport { assertNever } from "@deepseek-ai/dsh-util-values";'));
    for (const file of ['src/index.ts', 'src/chat/tokens.ts', 'src/chat/helpers.ts', 'src/chat/resume.ts']) {
      const contents = await readFile(path.join(output, file), 'utf8');
      await writeFile(path.join(output, file), contents.replace(liveEvents, '$1.snapshotEvents()'));
    }
    const questionSourcePath = path.join(output, 'src/chat/questions.ts');
    let questionSource = await readFile(questionSourcePath, 'utf8');
    const sourceProvider = 'const unregister = ctx.userQuestions.registerProvider({\n    ask(request) {';
    if (questionSource.split(sourceProvider).length !== 2 || questionSource.split('\n    },\n  })').length !== 2) throw Error('Re-review changed TUI source provider');
    questionSource = "import type { Agent } from '@deepseek-ai/dsh-agent'\n" + questionSource.replace('export interface QuestionQueueDeps extends ChatChannelDeps {', 'export interface QuestionQueueDeps extends ChatChannelDeps {\n  targetAgent: Agent').replace(sourceProvider, "const unregister = ctx.on('user-questions/request', (request, next) => {\n      if (request.agent !== deps.targetAgent) return next()").replace('\n    },\n  })', '\n  })');
    await writeFile(questionSourcePath, questionSource);
    const sourceIndexPath = path.join(output, 'src/index.ts');
    const sourceIndex = await readFile(sourceIndexPath, 'utf8');
    if (sourceIndex.split(queueCall).length !== 2) throw Error('Re-review changed source queue owner');
    await writeFile(sourceIndexPath, sourceIndex.replace(queueCall, queueCall + '\n    targetAgent: agent,').replace(commandCall, 'ctx.commands.execute(agent, text, [], controller.signal)'));
    const entryPoints = ['index', 'startup', 'prompt', 'invariant'].map(name => path.join(output, 'lib', `${name}.js`));
    const temporary = path.join(output, '.compiled');
    await esbuild.build({ absWorkingDir:output, entryPoints, outdir:temporary, bundle:true, splitting:true, format:'esm', platform:'node', target:'es2024', external:['@deepseek-ai/*'], nodePaths:[dependencyRoot], minify:true, legalComments:'none', banner:{js:'import { createRequire as __alphaCreateRequire } from "node:module"; const require = __alphaCreateRequire(import.meta.url);'} });
    for (const file of await readdir(temporary)) await cp(path.join(temporary, file), path.join(output, 'lib', file));
    await rm(temporary, { recursive:true });
    const patchPath = path.join(output, 'cordis.patch.yml');
    let patch = await readFile(patchPath, 'utf8');
    const duplicateRows = "    - id: storage\n      name: '@deepseek-ai/dsh-storage'\n    - id: storage-json\n      name: '@deepseek-ai/dsh-storage-json'\n      config:\n        root: !!js dshHomePath('storages')\n    - id: storage-domain\n      name: '@deepseek-ai/dsh-storage-domain'\n      config:\n        backend: json\n    - id: session-projection-cache\n      name: '@deepseek-ai/dsh-session-projection-cache'\n      config:\n        writeEveryEvents: 200\n        writeIntervalMs: 5000\n";
    if (patch.split(duplicateRows).length !== 2) throw Error('Re-review changed TUI storage rows');
    patch = patch.replace(duplicateRows, '    # These identical storage and projection-cache rows are supplied by the Alpha base.\n');
    await writeFile(patchPath, patch);
  } else if (Number(id) === 3097) {
    const filePath = path.join(output, 'lib/index.js');
    const temporary = path.join(output, '.compiled');
    const compiled = await esbuild.build({absWorkingDir:output, entryPoints:[filePath], outdir:temporary, metafile:true, bundle:true, splitting:true, format:'esm', platform:'node', target:'es2024', external:['@deepseek-ai/*'], nodePaths:[dependencyRoot], minify:true, legalComments:'eof', banner:{js:'import { createRequire as __alphaCreateRequire } from "node:module"; const require = __alphaCreateRequire(import.meta.url);'}});
    bundledDependencyKeys = new Set(recipe.dependencies.filter(dependency => Object.keys(compiled.metafile.inputs).some(input => path.resolve(output, input).startsWith(dependencyDirectory(dependency) + path.sep))).map(dependency => dependency.key));
    await writeFile(path.join(output, 'BUNDLED-DEPENDENCIES.json'), JSON.stringify([...bundledDependencyKeys].sort(), null, 2) + '\n');
    for (const file of await readdir(temporary)) await cp(path.join(temporary, file), path.join(output, 'lib', file));
    await rm(temporary, {recursive:true});
    manifest.dsh.client.inject = manifest.dsh.client.inject.filter(name => name !== '@deepseek-ai/dsh-client-runtime');
  } else if (Number(id) === 3047) {
    const filePath = path.join(output, 'lib/index.js');
    let original = await readFile(filePath, 'utf8');
    function replaceOnce(before, after) {
      if (original.split(before).length !== 2) throw Error('Re-review Search MCP settings contract');
      original = original.replace(before, after);
    }
    replaceOnce("import { installSettingsSection, settingsNamespace } from '@deepseek-ai/dsh-settings';", '// Settings sections attach through the Alpha settings service.');
    replaceOnce("settingsNamespace('search-mcp')", "'search-mcp'");
    replaceOnce("export const inject = ['web'];", "export const inject = ['web', 'settings'];");
    replaceOnce('installSettingsSection(ctx, SEARCH_MCP_SETTINGS_NAMESPACE', 'ctx.settings.installSection(ctx, SEARCH_MCP_SETTINGS_NAMESPACE');
    await writeFile(filePath, original);
    const browserPath = path.join(output, 'lib/client.browser.js');
    const browser = await readFile(browserPath, 'utf8');
    if (browser.split('require("@deepseek-ai/dsh-client-runtime/client")').length !== 2) throw Error('Re-review Search MCP browser store');
    await writeFile(browserPath, browser.replace('require("@deepseek-ai/dsh-client-runtime/client")', 'require("@deepseek-ai/dsh-client-store")'));
    const temporary = path.join(output, '.compiled');
    const compiled = await esbuild.build({absWorkingDir:output, entryPoints:[filePath], outdir:temporary, metafile:true, bundle:true, splitting:true, format:'esm', platform:'node', target:'es2024', external:['@deepseek-ai/*'], nodePaths:[dependencyRoot], minify:true, legalComments:'eof', banner:{js:'import { createRequire as __alphaCreateRequire } from "node:module"; const require = __alphaCreateRequire(import.meta.url);'}});
    bundledDependencyKeys = new Set(recipe.dependencies.filter(dependency => Object.keys(compiled.metafile.inputs).some(input => path.resolve(output, input).startsWith(dependencyDirectory(dependency) + path.sep))).map(dependency => dependency.key));
    await writeFile(path.join(output, 'BUNDLED-DEPENDENCIES.json'), JSON.stringify([...bundledDependencyKeys].sort(), null, 2) + '\n');
    for (const file of await readdir(temporary)) await cp(path.join(temporary, file), path.join(output, 'lib', file));
    await rm(temporary, {recursive:true});
    manifest.dsh.client.inject = manifest.dsh.client.inject.filter(name => name !== '@deepseek-ai/dsh-client-runtime');
  } else if ([3072, 3080].includes(Number(id))) {
    const hostPath = path.join(output, 'lib/index.js');
    const host = await readFile(hostPath, 'utf8');
    if (host.split('inFlightAssistantText(session.events)').length !== 2) throw Error('Re-review research workspace live session read');
    await writeFile(hostPath, host.replace('inFlightAssistantText(session.events)', 'inFlightAssistantText(session.snapshotEvents())'));
    for (const file of ['src/assistant-text.ts', 'lib/types/assistant-text.js']) {
      const filePath = path.join(output, file);
      const text = await readFile(filePath, 'utf8').catch(() => null);
      if (text) await writeFile(filePath, text.replace('inFlightAssistantText(session.events)', 'inFlightAssistantText(session.snapshotEvents())'));
    }
    const entryPoints = ['index', 'invariant', 'typert.host', 'typert.remote-client'].map(name => path.join(output, 'lib', `${name}.js`));
    const temporary = path.join(output, '.compiled');
    await esbuild.build({ absWorkingDir:output, entryPoints, outdir:temporary, bundle:true, splitting:true, format:'esm', platform:'node', target:'es2024', external:['@deepseek-ai/*'], alias:{ '@deepseek-ai/dsh-storage-sqlite':path.join(runtime,'packages/storage/storage-sqlite/src/index.ts'), '@deepseek-ai/dsh-web-fetch-http':path.join(runtime,'packages/web/web-fetch-http/src/index.ts') }, nodePaths:[dependencyRoot], minify:true, legalComments:'eof', ...(Number(id) === 3072 ? {banner:{js:'import { createRequire as __alphaCreateRequire } from "node:module"; const require = __alphaCreateRequire(import.meta.url);'}} : {}) });
    for (const file of await readdir(temporary)) await cp(path.join(temporary, file), path.join(output, 'lib', file));
    await rm(temporary, { recursive:true });
    manifest.dsh.client.inject = manifest.dsh.client.inject.filter(name => name !== '@deepseek-ai/dsh-client-runtime');
    await cp(path.join(runtime, 'LICENSE'), path.join(output, 'LICENSE.deepseek'));
  } else if (Number(id) === 3038) {
    const expectedFiles = ['lib', 'cordis.patch.yml', 'docs/provider-pricing.json'];
    if (JSON.stringify(manifest.files) !== JSON.stringify(expectedFiles)) throw Error('Re-review Cost Meter runtime file declarations');
    for (const name of await readdir(output)) {
      if (['lib', 'docs', 'src', 'package.json', 'cordis.patch.yml'].includes(name) || /^(?:README|LICEN[SC]E)/i.test(name)) continue;
      await rm(path.join(output, name), { recursive:true });
    }
    for (const name of await readdir(path.join(output, 'docs'))) if (name !== 'provider-pricing.json') await rm(path.join(output, 'docs', name), {recursive:true});
    const entryPoints = ['index', 'typert.host'].map(name => path.join(output, 'lib', `${name}.js`));
    const temporary = path.join(output, '.compiled');
    await esbuild.build({ absWorkingDir:output, entryPoints, outdir:temporary, bundle:true, splitting:true, format:'esm', platform:'node', target:'es2024', external:['@deepseek-ai/*'], nodePaths:[dependencyRoot], minify:true, legalComments:'eof' });
    for (const file of await readdir(temporary)) await cp(path.join(temporary, file), path.join(output, 'lib', file));
    await rm(temporary, { recursive:true });
  } else if (Number(id) === 3113) {
    await mkdir(path.join(output, 'lib/vendor'), { recursive:true });
    const implementation = await readFile(path.join(dependencyRoot, '@openmaic/generation/dist/interactive-post-processor.js'));
    if (/^(?:import|export.*from)\s/m.test(implementation.toString())) throw Error('Re-review post-processor dependencies');
    await writeFile(path.join(output, 'lib/vendor/openmaic-interactive.js'), implementation);
    const hostPath = path.join(output, 'lib/index.js');
    const host = await readFile(hostPath, 'utf8');
    const before = 'from "@openmaic/generation";';
    if (host.split(before).length !== 2) throw Error('Re-review OpenMAIC generation import');
    await writeFile(hostPath, host.replace(before, 'from "./vendor/openmaic-interactive.js";'));
    manifest.dsh.client.inject = manifest.dsh.client.inject.filter(name => name !== '@deepseek-ai/dsh-client-runtime');
  } else if (Number(id) === 3114) {
    const vendor = path.join(output, 'vendor/node_modules');
    for (const dependency of recipe.dependencies) await cp(dependencyDirectory(dependency), path.join(vendor, dependency.name), {recursive:true});
    for (const relative of ['lib/connection.js', 'lib/runtime.js']) {
      const filePath = path.join(output, relative);
      const original = await readFile(filePath, 'utf8');
      const before = "from 'ssh2'";
      if (original.split(before).length !== 2) throw Error('Re-review SSH transport import');
      await writeFile(filePath, original.replace(before, "from '../vendor/node_modules/ssh2/lib/index.js'"));
    }
    manifest.peerDependencies = Object.fromEntries(Object.entries(manifest.dependencies).filter(([name]) => name.startsWith('@deepseek-ai/')));
    manifest.dsh.client.inject = manifest.dsh.client.inject.filter(name => name !== '@deepseek-ai/dsh-client-runtime');
  } else if (Number(id) === 3101) {
    const vendor = path.join(output, 'vendor/node_modules');
    for (const dependency of recipe.dependencies) await cp(dependencyDirectory(dependency), path.join(vendor, dependency.name), {recursive:true});
    const filePath = path.join(output, 'lib/client.js');
    const original = await readFile(filePath, 'utf8');
    const before = "await import('undici')";
    if (original.split(before).length !== 2) throw Error('Re-review JumpServer optional TLS transport');
    await writeFile(filePath, original.replace(before, "await import('../vendor/node_modules/undici/index.js')"));
  } else if (Number(id) === 3106) {
    const vendor = path.join(output, 'lib/vendor/node_modules');
    for (const dependency of recipe.dependencies) await cp(path.join(dependencyRoot, dependency.name), path.join(vendor, dependency.name), {recursive:true});
    const filePath = path.join(output, 'lib/runtime.js');
    const original = await readFile(filePath, 'utf8');
    const before = "from 'quickjs-emscripten';";
    if (original.split(before).length !== 2) throw Error('Re-review Workflow QuickJS import');
    await writeFile(filePath, original.replace(before, "from './vendor/node_modules/quickjs-emscripten/dist/index.mjs';"));
  } else if (Number(id) === 3105) {
    await mkdir(path.join(output, 'lib/vendor'), { recursive:true });
    await cp(path.join(dependencyRoot, 'fzstd/esm/index.mjs'), path.join(output, 'lib/vendor/fzstd.mjs'));
    for (const file of ['lib/discovery.mjs', 'lib/dsh.mjs']) {
      let contents = await readFile(path.join(output, file), 'utf8');
      const before = "import { decompress } from 'fzstd'";
      if (contents.split(before).length !== 2) throw Error('Re-review changed decompression import');
      await writeFile(path.join(output, file), contents.replace(before, "import { decompress } from './vendor/fzstd.mjs'"));
    }
  }
  for (const dependency of recipe.dependencies) {
    if (bundledDependencyKeys && !bundledDependencyKeys.has(dependency.key)) continue;
    const directory = dependencyDirectory(dependency);
    const licenseName = (recipe.dependencyLayout === 'versioned' ? dependency.key : dependency.name).replaceAll('/', '_');
    const license = (await readdir(directory)).find(name => /^licen[sc]e(?:\.|$)/i.test(name));
    if (license) await cp(path.join(directory, license), path.join(output, `LICENSE.${licenseName}`));
    else {
      if (!dependency.licenseSource) throw Error(`Missing dependency license ${dependency.name}`);
      const data = await readFile(path.join(here, dependency.licenseSource.file));
      if (createHash('sha256').update(data).digest('hex') !== dependency.licenseSource.sha256) throw Error('Pinned dependency license changed');
      await writeFile(path.join(output, `LICENSE.${licenseName}`), data);
    }
  }
  manifest.version += '-dsh.alpha.1';
  delete manifest.scripts; delete manifest.devDependencies; delete manifest.dependencies;
  for (const name of Object.keys(manifest.peerDependencies ?? {})) if (name.startsWith('@deepseek-ai/dsh-')) manifest.peerDependencies[name] = '0.1.3-alpha.1';
  await writeFile(path.join(output, 'package.json'), JSON.stringify(manifest, null, 2)+'\n');
  await writeFile(path.join(output, 'ALPHA-ADAPTATION.json'), JSON.stringify(recipe, null, 2)+'\n');
  await writeFile(path.join(output, 'NOTICE.alpha'), 'Adaptation by DSH Themes contributors. Upstream source, license and package identity are retained.\n'+recipe.changes.join('\n')+'\n');
} finally { resetProxy?.(); }
process.stdout.write('Built reviewed package; runtime verification remains pending.\n');
