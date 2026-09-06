#!/usr/bin/env node
// Bundle reviewed Markdown Preview dependencies without running package scripts.
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const flags = {};
for (let i = 2; i < process.argv.length; i += 2) {
  if (!['--esbuild', '--markdown-it', '--highlight', '--out'].includes(process.argv[i]) || !process.argv[i + 1]) throw new Error('Unknown or missing build argument.');
  flags[process.argv[i].slice(2)] = path.resolve(process.argv[i + 1]);
}
for (const key of ['esbuild', 'markdown-it', 'highlight', 'out']) if (!flags[key]) throw new Error(`Missing --${key}.`);
const folder = path.dirname(fileURLToPath(import.meta.url));
const digest = '3ffd7864e2e9a464073d9aa810cf4059ffee16aa48ca320bb49a87bd2315833e';
const archive = path.resolve(folder, '../artifacts', `${digest}.tgz`);
if (createHash('sha256').update(await readFile(archive)).digest('hex') !== digest) throw new Error('Base adaptation digest changed.');
for (const [key, name, version] of [['esbuild', 'esbuild', '0.28.2'], ['markdown-it', 'markdown-it', '15.0.0'], ['highlight', 'highlight.js', '11.11.1']]) {
  const manifest = JSON.parse(await readFile(path.join(flags[key], 'package.json')));
  if (manifest.name !== name || manifest.version !== version) throw new Error(`Use the pinned ${name} ${version}.`);
}
await mkdir(flags.out, { recursive: true });
execFileSync('python3', ['-c', `import pathlib,sys,tarfile
root=pathlib.Path(sys.argv[2])
with tarfile.open(sys.argv[1]) as t:
 for m in t.getmembers():
  parts=pathlib.PurePosixPath(m.name).parts
  if not m.isfile() or parts[0]!='package' or '..' in parts: raise ValueError('Unsafe base artifact member')
  target=root.joinpath(*parts[1:]);target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(t.extractfile(m).read())
`, archive, flags.out]);
const clientPath = path.join(flags.out, 'lib/client.js');
let client = await readFile(clientPath, 'utf8');
for (const [before, after] of [['"conversationEvents"', '"uiConversation"'], ['ctx.conversationEvents.register(', 'ctx.uiConversation.events.register(']]) {
  if (client.split(before).length !== 2) throw new Error(`Unexpected Markdown Preview service source: ${before}`);
  client = client.replace(before, after);
}
await writeFile(clientPath, client);
const require = createRequire(import.meta.url);
const esbuild = require(flags.esbuild);
const result = await esbuild.build({
  entryPoints: [path.join(flags.out, 'lib/index.js')],
  outfile: path.join(flags.out, 'lib/index.js'), allowOverwrite: true,
  bundle: true, platform: 'node', format: 'esm', target: 'es2024',
  alias: { 'markdown-it': flags['markdown-it'], 'highlight.js': flags.highlight },
  external: ['@deepseek-ai/*'], minify: true, legalComments: 'inline', metafile: true,
});
if (result.warnings.length) throw new Error('Resolve build warnings before packaging.');
const dependencies = new Map();
for (const input of Object.keys(result.metafile.inputs)) {
  let directory = path.dirname(path.resolve(input));
  while (directory !== path.parse(directory).root) {
    const filename = path.join(directory, 'package.json');
    if (await access(filename).then(() => true, () => false)) {
      const manifest = JSON.parse(await readFile(filename));
      if (directory !== flags.out) dependencies.set(manifest.name, { directory, name: manifest.name, version: manifest.version, license: manifest.license });
      break;
    }
    directory = path.dirname(directory);
  }
}
await mkdir(path.join(flags.out, 'LICENSES'), { recursive: true });
for (const dependency of dependencies.values()) {
  const license = await Promise.all(['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'LICENSE-MIT.txt', 'license', 'license.md'].map(async name => ({ name, bytes: await readFile(path.join(dependency.directory, name)).catch(() => null) })));
  const found = license.find(file => file.bytes);
  if (!found) throw new Error(`Missing license for ${dependency.name}.`);
  await writeFile(path.join(flags.out, 'LICENSES', `${dependency.name.replaceAll('/', '_')}.txt`), found.bytes);
}
const manifestPath = path.join(flags.out, 'package.json');
const manifest = JSON.parse(await readFile(manifestPath));
delete manifest.dependencies;
manifest.files.push('LICENSES', 'BUILD.json');
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
await writeFile(path.join(flags.out, 'BUILD.json'), `${JSON.stringify({ baseArtifactSha256: digest, esbuild: '0.28.2', dependencies: [...dependencies.values()].map(({ directory, ...item }) => item).sort((a, b) => a.name.localeCompare(b.name)) }, null, 2)}\n`);
await writeFile(path.join(flags.out, 'NOTICE'), `${await readFile(path.join(flags.out, 'NOTICE'), 'utf8')}The browser conversationEvents registration uses the official Alpha uiConversation.events service. Markdown rendering dependencies are bundled from the versions recorded in BUILD.json; their license notices are in LICENSES. Application behavior and safe Markdown settings are retained.\n`);
process.stdout.write('Markdown Preview dependencies bundled; runtime verification remains required.\n');
