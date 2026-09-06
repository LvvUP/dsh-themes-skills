#!/usr/bin/env node
// Build the fixed Focus Chat sources with caller-supplied, already installed tools.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const folder = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(folder, 'source');
const flags = {};
for (let index = 2; index < process.argv.length; index += 2) {
  const key = process.argv[index];
  if (!['--runtime', '--esbuild', '--lightningcss', '--typescript', '--diff', '--clsx', '--out'].includes(key) || !process.argv[index + 1]) throw new Error(`Unknown or incomplete option: ${key}`);
  flags[key.slice(2)] = path.resolve(process.argv[index + 1]);
}
for (const key of ['runtime', 'esbuild', 'lightningcss', 'typescript', 'diff', 'clsx', 'out']) if (!flags[key]) throw new Error(`Missing --${key}.`);
const runtimeRevision = execFileSync('git', ['-C', flags.runtime, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (runtimeRevision !== 'd347e703908d0406b7a7ef80e3a0e594d86b2215') throw new Error('Use the fixed DSH 0.1.3-alpha.1 checkout.');
const require = createRequire(import.meta.url);
const tools = {};
for (const [key, version] of [['esbuild', '0.28.2'], ['lightningcss', '1.32.0'], ['diff', '8.0.4'], ['clsx', '2.1.1']]) {
  const manifest = JSON.parse(await readFile(path.join(flags[key], 'package.json')));
  if (manifest.version !== version) throw new Error(`Expected ${key} ${version}.`);
  tools[key] = require(flags[key]);
}
const ts = require(flags.typescript);
const source = JSON.parse(await readFile(path.join(root, 'SOURCE.json')));
for (const [file, sha] of Object.entries(source.files)) {
  if (createHash('sha256').update(await readFile(path.join(root, file))).digest('hex') !== sha) throw new Error(`Source drift: ${file}`);
}
const id = '@dingyi222666/dsh-focus-chat';
const platform = ['react', 'react/jsx-runtime', 'react-dom', 'react-dom/client', '@deepseek-ai/cordis', '@deepseek-ai/dsh-client-store', '@deepseek-ai/dsh-client-ui-slots', '@deepseek-ai/dsh-client-ui-primitives'];
const paths = ts.readConfigFile(path.join(flags.runtime, 'tsconfig.base.json'), ts.sys.readFile).config.compilerOptions.paths;
const aliases = Object.fromEntries(Object.entries(paths).filter(([key]) => !key.includes('*') && !platform.includes(key)).map(([key, values]) => [key, path.resolve(flags.runtime, values[0])]));
aliases.diff = path.join(flags.diff, 'libesm/index.js');
aliases.clsx = flags.clsx;
const css = { name: 'inline-css', setup(build) {
  build.onLoad({ filter: /\.module\.css$/ }, async ({ path: filename }) => {
    const result = tools.lightningcss.transform({ filename: path.relative(root, filename), code: await readFile(filename), cssModules: { pattern: '[hash]_[local]' }, minify: true });
    const classMap = Object.fromEntries(Object.entries(result.exports || {}).sort(([a], [b]) => a.localeCompare(b, 'en')).map(([key, value]) => [key, value.name]));
    const tagId = `${id}/${path.basename(filename)}`;
    return { loader: 'js', contents: `const tagId=${JSON.stringify(tagId)};if(typeof document!=='undefined'&&!document.querySelector('style[data-plugin-css='+JSON.stringify(tagId)+']')){const tag=document.createElement('style');tag.dataset.plugin=${JSON.stringify(id)};tag.dataset.pluginCss=tagId;tag.textContent=${JSON.stringify(result.code.toString())};document.head.appendChild(tag);}export default ${JSON.stringify(classMap)};` };
  });
} };
await mkdir(path.join(flags.out, 'lib'), { recursive: true });
await tools.esbuild.build({ absWorkingDir: root, entryPoints: ['src/index.ts', 'src/invariant.ts'], outdir: path.join(flags.out, 'lib'), bundle: true, format: 'esm', platform: 'node', target: 'es2024', packages: 'external', minify: true, legalComments: 'none' });
await tools.esbuild.build({ absWorkingDir: root, entryPoints: ['src/client/index.ts'], outfile: path.join(flags.out, 'lib/client.js'), bundle: true, format: 'cjs', platform: 'browser', target: 'es2024', external: platform, alias: aliases, nodePaths: [path.join(flags.runtime, 'node_modules')], jsx: 'automatic', minify: true, legalComments: 'none', define: { 'process.env.NODE_ENV': '"production"', 'import.meta.env.MODE': '"production"', 'import.meta.env': '{"MODE":"production"}' }, plugins: [css], banner: { js: `window.__ModuleLoader__.load({id:${JSON.stringify(id)},factory:(require)=>{var module={exports:{}};var exports=module.exports;` }, footer: { js: 'return module.exports;}});' } }).then((result) => { if (result.warnings.length) throw new Error('Resolve all build warnings before packaging.'); });
const manifest = JSON.parse(await readFile(path.join(root, 'package.json')));
manifest.version += '-dsh.alpha.1';
delete manifest.scripts;
delete manifest.devDependencies;
manifest.files = ['lib', 'cordis.patch.yml', 'README.md', 'SOURCE.json', 'NOTICE', 'LICENSE.deepseek', 'LICENSE.diff', 'LICENSE.clsx'];
await writeFile(path.join(flags.out, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`);
for (const file of ['cordis.patch.yml', 'README.md', 'SOURCE.json']) await writeFile(path.join(flags.out, file), await readFile(path.join(root, file)));
await writeFile(path.join(flags.out, 'LICENSE.deepseek'), await readFile(path.join(flags.runtime, 'LICENSE')));
await writeFile(path.join(flags.out, 'LICENSE.diff'), await readFile(path.join(flags.diff, 'LICENSE')));
await writeFile(path.join(flags.out, 'LICENSE.clsx'), await readFile(path.join(flags.clsx, 'license')));
await writeFile(path.join(flags.out, 'NOTICE'), `Build adaptation by DSH Themes contributors. Focus Chat upstream declares BSD-3-Clause in its package metadata; no standalone LICENSE file is present at this revision. Preserve the source package metadata and attribution.\nSource: https://github.com/${source.sourceRepository}/tree/${source.sourceRevision}\nBundled pure DSH helpers: DeepSeek, MIT, revision ${runtimeRevision}.\nBundled diff 8.0.4 and clsx 2.1.1 retain their license notices.\nThe application logic is unchanged. The build uses pinned esbuild and lightningcss with the upstream module-loader and CSS-module structure.\n`);
process.stdout.write('Built Focus Chat from pinned sources. Runtime verification remains a separate step.\n');
