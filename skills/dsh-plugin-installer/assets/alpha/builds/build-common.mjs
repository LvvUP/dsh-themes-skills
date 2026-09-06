#!/usr/bin/env node
// Build pinned plugin sources with caller-supplied, already installed tools.
import { readFile, writeFile, mkdir, access, rm } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const folder = path.dirname(fileURLToPath(import.meta.url));

const flags = {};
for (let index = 2; index < process.argv.length; index += 2) {
  const key = process.argv[index];
  if (!['--catalog-id', '--runtime', '--esbuild', '--lightningcss', '--typescript', '--diff', '--clsx', '--zod', '--out'].includes(key) || !process.argv[index + 1]) throw new Error(`Unknown or incomplete option: ${key}`);
  flags[key.slice(2)] = key === '--catalog-id' ? process.argv[index + 1] : path.resolve(process.argv[index + 1]);
}
if (![3040, 3042, 3043, 3044, 3058, 3069, 3077, 3084, 3090, 3093, 3096, 3099, 3100, 3107, 3112, 3120, 3121, 3122].includes(Number(flags['catalog-id']))) throw new Error('Unsupported build number.');
const root = path.join(folder, flags['catalog-id'], 'source');
for (const key of ['zod', 'runtime', 'esbuild', 'lightningcss', 'typescript', 'diff', 'clsx', 'out']) if (!flags[key]) throw new Error(`Missing --${key}.`);
const runtimeRevision = execFileSync('git', ['-C', flags.runtime, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (runtimeRevision !== 'd347e703908d0406b7a7ef80e3a0e594d86b2215') throw new Error('Use the fixed DSH 0.1.3-alpha.1 checkout.');
const require = createRequire(import.meta.url);
const tools = {};
for (const [key, version] of [['esbuild', '0.28.2'], ['lightningcss', '1.32.0'], ['diff', '8.0.4'], ['clsx', '2.1.1'], ['zod', '4.4.3']]) {
  const manifest = JSON.parse(await readFile(path.join(flags[key], 'package.json')));
  if (manifest.version !== version) throw new Error(`Expected ${key} ${version}.`);
  tools[key] = require(flags[key]);
}
const ts = require(flags.typescript);
const source = JSON.parse(await readFile(path.join(root, 'SOURCE.json')));
for (const [file, sha] of Object.entries(source.files)) {
  if (createHash('sha256').update(await readFile(path.join(root, file))).digest('hex') !== sha) throw new Error(`Source drift: ${file}`);
}
const sourceManifest = JSON.parse(await readFile(path.join(root, 'package.json')));
const id = sourceManifest.name;
const platform = ['react', 'react/jsx-runtime', 'react-dom', 'react-dom/client', '@deepseek-ai/cordis', '@deepseek-ai/dsh-client-store', '@deepseek-ai/dsh-client-ui-slots', '@deepseek-ai/dsh-client-ui-primitives'];
const paths = ts.readConfigFile(path.join(flags.runtime, 'tsconfig.base.json'), ts.sys.readFile).config.compilerOptions.paths;
const aliases = Object.fromEntries(Object.entries(paths).filter(([key]) => !key.includes('*') && !platform.includes(key)).map(([key, values]) => [key, path.resolve(flags.runtime, values[0])]));
aliases.diff = path.join(flags.diff, 'libesm/index.js');
aliases.clsx = flags.clsx;
aliases.zod = flags.zod;
const css = { name: 'inline-css', setup(build) {
  build.onLoad({ filter: /\.module\.css$/ }, async ({ path: filename }) => {
    const result = tools.lightningcss.transform({ filename: path.relative(root, filename), code: await readFile(filename), cssModules: { pattern: '[hash]_[local]' }, minify: true });
    const classMap = Object.fromEntries(Object.entries(result.exports || {}).sort(([a], [b]) => a.localeCompare(b, 'en')).map(([key, value]) => [key, value.name]));
    const tagId = `${id}/${path.basename(filename)}`;
    return { loader: 'js', contents: `const tagId=${JSON.stringify(tagId)};if(typeof document!=='undefined'&&!document.querySelector('style[data-plugin-css='+JSON.stringify(tagId)+']')){const tag=document.createElement('style');tag.dataset.plugin=${JSON.stringify(id)};tag.dataset.pluginCss=tagId;tag.textContent=${JSON.stringify(result.code.toString())};document.head.appendChild(tag);}export default ${JSON.stringify(classMap)};` };
  });
} };
const alphaServices = { name: 'alpha-services', setup(build) {
  if (Number(flags['catalog-id']) === 3120) {
    build.onLoad({ filter: /\.tsx?$/ }, async ({ path: filename }) => {
      const relative = path.relative(root, filename);
      if (!['src/index.ts', 'src/deepseek-provider.ts', 'src/settings-routes.ts'].includes(relative)) return;
      let contents = await readFile(filename, 'utf8');
      const replacements = relative === 'src/index.ts' ? [
        ["import { installSettingsSection, settingsNamespace } from '@deepseek-ai/dsh-settings'", '// Settings register through the Alpha provider instance.'],
        ['  installSettingsSection(ctx, settingsNamespace(FIRECRAWL_SETTINGS_NAMESPACE), Config, config, {', "  ctx.inject(['settings'], (settingsCtx) => {\n  settingsCtx.settings.installSection(ctx, FIRECRAWL_SETTINGS_NAMESPACE, Config, config, {"],
        ['  // The browser settings page reaches this namespace', '  })\n\n  // The browser settings page reaches this namespace'],
      ] : relative === 'src/deepseek-provider.ts' ? [
        ["import { settingsNamespace, type SettingsNamespace } from '@deepseek-ai/dsh-settings'", "import type { SettingsNamespace } from '@deepseek-ai/dsh-settings'"],
        ["settingsNamespace('web-search-deepseek')", "'web-search-deepseek'"],
      ] : [
        ['  settingsNamespace,\n', ''],
        ['settingsNamespace(FIRECRAWL_SETTINGS_NAMESPACE)', 'FIRECRAWL_SETTINGS_NAMESPACE'],
      ];
      for (const [before, after] of replacements) {
        if (contents.split(before).length !== 2) throw new Error(`Unexpected Firecrawl settings source: ${before}`);
        contents = contents.replace(before, after);
      }
      return { loader: 'ts', contents };
    });
    return;
  }
  if (Number(flags['catalog-id']) !== 3096) return;
  build.onLoad({ filter: /\/src\/client\/index\.ts$/ }, async ({ path: filename }) => {
    if (filename !== path.join(root, 'src/client/index.ts')) return;
    let contents = await readFile(filename, 'utf8');
    for (const [before, after] of [
      ["['conversationEvents', 'slots', 'locale']", "['uiConversation', 'slots', 'locale']"],
      ['ctx.conversationEvents.register(', 'ctx.uiConversation.events.register('],
    ]) {
      if (contents.split(before).length !== 2) throw new Error(`Unexpected Agent Messaging service source: ${before}`);
      contents = contents.replace(before, after);
    }
    return { loader: 'ts', contents };
  });
} };
await mkdir(path.join(flags.out, 'lib'), { recursive: true });
const hostEntries = ['src/index.ts'];
if (await access(path.join(root, 'src/invariant.ts')).then(() => true, () => false)) hostEntries.push('src/invariant.ts');
if (Number(flags['catalog-id']) === 3069) hostEntries.push('src/policy.ts');
if (Number(flags['catalog-id']) === 3121) hostEntries.push('src/effort-decision.ts');
await tools.esbuild.build({ absWorkingDir: root, entryPoints: hostEntries, outdir: path.join(flags.out, Number(flags['catalog-id']) === 3069 ? 'dist' : 'lib'), ...(Number(flags['catalog-id']) === 3069 ? { outExtension: { '.js': '.mjs' } } : {}), bundle: true, format: 'esm', platform: 'node', target: 'es2024', external: ['@deepseek-ai/*', 'cordis'], alias: { zod: flags.zod, ...([3077, 3099, 3100, 3107].includes(Number(flags['catalog-id'])) ? { schemastery: '@deepseek-ai/schemastery' } : {}) }, minify: true, legalComments: 'none', plugins: [alphaServices] });
if (sourceManifest.dsh?.client) await tools.esbuild.build({ absWorkingDir: root, entryPoints: [Number(flags['catalog-id']) === 3120 ? 'src/client/index.tsx' : 'src/client/index.ts'], outfile: path.join(flags.out, 'lib/client.js'), bundle: true, format: 'cjs', platform: 'browser', target: 'es2024', external: platform, alias: aliases, nodePaths: [path.join(flags.runtime, 'node_modules')], jsx: 'automatic', minify: true, legalComments: 'none', define: { 'process.env.NODE_ENV': '"production"', 'import.meta.env.MODE': '"production"', 'import.meta.env': '{"MODE":"production"}' }, plugins: [alphaServices, css], banner: { js: `window.__ModuleLoader__.load({id:${JSON.stringify(id)},factory:(require)=>{var module={exports:{}};var exports=module.exports;` }, footer: { js: 'return module.exports;}});' } }).then((result) => { if (result.warnings.length) throw new Error('Resolve all build warnings before packaging.'); });
const manifest = JSON.parse(await readFile(path.join(root, 'package.json')));
manifest.version += '-dsh.alpha.1';
delete manifest.scripts;
delete manifest.devDependencies;
delete manifest.dependencies;
if (Number(flags['catalog-id']) === 3121) {
  manifest.main = 'lib/index.js';
  manifest.exports['.'] = './lib/index.js';
  manifest.exports['./effort-decision'] = './lib/effort-decision.js';
}
if (manifest.dsh?.client?.inject) manifest.dsh.client.inject = manifest.dsh.client.inject.filter((name) => name !== '@deepseek-ai/dsh-client-runtime');
for (const name of Object.keys(manifest.peerDependencies ?? {})) if (name.startsWith('@deepseek-ai/dsh-')) manifest.peerDependencies[name] = '0.1.3-alpha.1';
manifest.files = ['lib', 'cordis.patch.yml', 'README.md', 'SOURCE.json', 'NOTICE', 'LICENSE.deepseek', 'LICENSE.diff', 'LICENSE.clsx', 'LICENSE.zod', 'LICENSE', 'LICENSE.md'];
if (Number(flags['catalog-id']) === 3096) manifest.files.push('scripts');
if (Number(flags['catalog-id']) === 3069) manifest.files.push('dist');
await writeFile(path.join(flags.out, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`);
for (const file of ['cordis.patch.yml', 'README.md', 'SOURCE.json']) await writeFile(path.join(flags.out, file), await readFile(path.join(root, file)));
await writeFile(path.join(flags.out, 'LICENSE.deepseek'), await readFile(path.join(flags.runtime, 'LICENSE')));
await writeFile(path.join(flags.out, 'LICENSE.diff'), await readFile(path.join(flags.diff, 'LICENSE')));
await writeFile(path.join(flags.out, 'LICENSE.clsx'), await readFile(path.join(flags.clsx, 'license')));
await writeFile(path.join(flags.out, 'LICENSE.zod'), await readFile(path.join(flags.zod, 'LICENSE')));
for (const name of ['LICENSE', 'LICENSE.md']) if (source.files[name]) await writeFile(path.join(flags.out, name), await readFile(path.join(root, name)));
if (Number(flags['catalog-id']) === 3096) {
  await mkdir(path.join(flags.out, 'scripts'), { recursive: true });
  for (const name of ['cli.mjs', 'doctor.mjs', 'report.mjs']) await writeFile(path.join(flags.out, 'scripts', name), await readFile(path.join(root, 'scripts', name)));
}
await writeFile(path.join(flags.out, 'NOTICE'), `Build adaptation by DSH Themes contributors. ${id} upstream declares ${sourceManifest.license} in its package metadata. Preserve the source metadata, license files where present, and attribution.\nSource: https://github.com/${source.sourceRepository}/tree/${source.sourceRevision}\nBundled pure DSH helpers: DeepSeek, MIT, revision ${runtimeRevision}.\nBundled dependencies retain their license notices (diff 8.0.4, clsx 2.1.1, zod 4.4.3).\n${Number(flags['catalog-id']) === 3096 ? 'The browser conversationEvents service is migrated to the official Alpha uiConversation.events registry, retaining its message projection and disposer.' : Number(flags['catalog-id']) === 3120 ? 'Settings namespace strings are unchanged; settings registration is migrated to the official Alpha provider instance.' : 'The application logic is unchanged.'} Obsolete client-runtime injector declarations are removed; platform services and modules come from the Alpha host. The build uses pinned esbuild and lightningcss with the upstream module-loader and CSS-module structure.\n`);
if (Number(flags['catalog-id']) === 3122) {
  for (const name of ['LICENSE.deepseek', 'LICENSE.diff', 'LICENSE.clsx', 'LICENSE.zod']) await rm(path.join(flags.out, name));
  await writeFile(path.join(flags.out, 'NOTICE'), `Build adaptation by DSH Themes contributors. The fixed upstream package.json and README declare MIT; the upstream archive supplies no standalone license notice. No additional upstream copyright notice is invented.\nSource: https://github.com/${source.sourceRepository}/tree/${source.sourceRevision}\nThe original TypeScript is compiled with esbuild 0.28.2. The official DSH modules remain external Alpha host peers; no old host dependency is installed. The original loopback binding and explicit DeepSeek provider/model defaults are preserved.\n`);
}
process.stdout.write('Built the plugin from pinned sources. Runtime verification remains a separate step.\n');
