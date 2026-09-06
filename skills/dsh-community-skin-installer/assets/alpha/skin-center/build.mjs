import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { bindLoadedStylesheet } from './stylesheet-ledger.mjs';

const iteration = process.argv.includes('--iteration=1') ? 1 : 2;
const packageVersion = `0.2.5-alpha.${iteration}`;
const hashOnly = process.argv.includes('--hash-only');

const root = path.resolve(import.meta.dirname, '../../..');
const work = path.join(root, '.cache/dsh-skin-center-alpha');
const archive =
  process.argv.find((arg) => arg.startsWith('--archive='))?.slice(10) ??
  path.join(work, 'upstream-0.2.5.tgz');
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const originalBytes = await readFile(archive);
assert.equal(originalBytes.length, 58_988_084);
assert.equal(
  sha(originalBytes),
  '5b0c06426320a011a54cc8ddbe921e7b3f2d8d11a3d18bf0b92ad186ffb39499'
);
const codeRoot = path.join(work, 'adapted');
await mkdir(codeRoot, { recursive: true });
const extraction = spawnSync(
  'python3',
  [
    '-c',
    `
import tarfile,pathlib,sys
root=pathlib.Path(sys.argv[2])
with tarfile.open(sys.argv[1]) as source:
 for member in source.getmembers():
  parts=pathlib.PurePosixPath(member.name).parts
  if parts[0]!='package' or '..' in parts or member.issym() or member.islnk(): raise ValueError('Unsafe source archive')
  if member.isfile() and (member.name in ['package/package.json','package/cordis.patch.yml','package/lib/client.js','package/lib/index.js','package/LICENSE'] or member.name.startswith('package/skins/') and member.name.endswith(('.css','.mjs','.json','.md','.txt'))):
   destination=root/pathlib.PurePosixPath(member.name).relative_to('package')
   destination.parent.mkdir(parents=True,exist_ok=True)
   destination.write_bytes(source.extractfile(member).read())
`,
    archive,
    codeRoot,
  ],
  { encoding: 'utf8' }
);
assert.equal(extraction.status, 0, extraction.stderr);
const changes = [];
async function change(relative, transform) {
  const destination = path.join(codeRoot, relative);
  const input = await readFile(destination);
  const output = Buffer.from(transform(input.toString()));
  await writeFile(destination, output);
  changes.push({
    path: relative,
    sourceSha256: sha(input),
    outputSha256: sha(output),
    sourceBytes: input.length,
    outputBytes: output.length,
  });
}
function replaceExact(source, from, to, count = 1) {
  assert.equal(
    source.split(from).length - 1,
    count,
    `Unexpected upstream structure: ${from}`
  );
  return source.split(from).join(to);
}
const packageName = '@dsh-themes-community/skin-center-alpha';
await change('lib/index.js', (source) => {
  source = replaceExact(
    source,
    'import { installSettingsSection, settingsNamespace } from "@deepseek-ai/dsh-settings";\n',
    ''
  );
  source = replaceExact(
    source,
    'import z from "schemastery";',
    'import z from "@deepseek-ai/schemastery";'
  );
  for (const namespace of ['skin-background', 'skin-wallpaper'])
    source = replaceExact(
      source,
      `settingsNamespace("${namespace}")`,
      `"${namespace}"`
    );
  source = replaceExact(
    source,
    'const inject = ["webServer"];',
    'const inject = ["settings", "webServer"];'
  );
  source = replaceExact(
    source,
    'installSettingsSection(ctx,',
    'ctx.settings.installSection(ctx,',
    2
  );
  source = replaceExact(
    source,
    'mountOnce("@linxin666/dsh-client-ui-skin-center", applyImpl)',
    `mountOnce("${packageName}", applyImpl)`
  );
  return source;
});
await change('lib/client.js', (source) => {
  source = replaceExact(
    source,
    'id: "@linxin666/dsh-client-ui-skin-center",',
    `id: "${packageName}",`
  );
  if (iteration === 1) return source;
  const original =
    'function trackStylesheet(activation, label, href) {\n\t\t\t\tconst link = doc.head.querySelector(`link[href="${href}"]`);\n\t\t\t\tledger.record(activation, `style:${label}`, () => link?.remove());\n\t\t\t}';
  return replaceExact(
    source,
    original,
    `${bindLoadedStylesheet.toString()}\nfunction trackStylesheet(activation, label, href) { bindLoadedStylesheet(doc, ledger, activation, label, href); }`
  );
});
await change(
  'cordis.patch.yml',
  () =>
    `# Alpha adapter; original Skin Center remains one shared package.\n- insert:\n    - id: ui-skin-center\n      name: '${packageName}'\n`
);
await change('package.json', (source) => {
  const original = JSON.parse(source);
  const {
    scripts: _scripts,
    devDependencies: _dev,
    peerDependencies: _peer,
    ...manifest
  } = original;
  return `${JSON.stringify({ ...manifest, name: packageName, version: packageVersion, description: `${original.description}; DSH Themes compatibility adaptation for official DSH 0.1.3-alpha.1`, license: 'SEE LICENSE IN LICENSE', dependencies: { lightningcss: '1.32.0' }, dsh: { ...original.dsh, client: { ...original.dsh.client, inject: original.dsh.client.inject.filter((id) => id !== '@deepseek-ai/dsh-client-runtime') } }, dshThemesAdaptation: { upstreamPackage: original.name, upstreamVersion: original.version, upstreamRevision: 'dda2780bd6467de92ad7533f9f1c28a7a5a04118', upstreamArchiveSha256: sha(originalBytes), licenseConflict: 'Original package metadata says Apache-2.0; its included LICENSE is BSD-3-Clause. Both provenance facts and every skin notice remain intact.' } }, null, 2)}\n`;
});
const provenance = {
  schemaVersion: 1,
  dshVersion: '0.1.3-alpha.1',
  runtimeVerification: 'pending',
  source: {
    repository: 'zhu1090093659/dsh-web-ui',
    revision: 'dda2780bd6467de92ad7533f9f1c28a7a5a04118',
    packageName: '@linxin666/dsh-client-ui-skin-center',
    version: '0.2.5',
    url: 'https://registry.npmjs.org/@linxin666/dsh-client-ui-skin-center/-/dsh-client-ui-skin-center-0.2.5.tgz',
    sha256: sha(originalBytes),
    sizeBytes: originalBytes.length,
  },
  adaptation: { packageName, packageVersion, changes },
  preserved:
    'All 15 upstream built-in skin directories, assets, CSS, hooks, contracts and license bytes; qq98/ths remain separately reviewed user skin directories.',
};
if (process.argv.includes('--pack') || hashOnly) {
  const output = path.join(work, `skin-center-alpha-${packageVersion}.tgz`);
  const packed = spawnSync(
    'python3',
    [
      '-c',
      `
import tarfile,gzip,pathlib,sys,io,hashlib,json
source_path,changed_root,output_path,hash_only=sys.argv[1:]
class HashSink:
 def __init__(self): self.sha=hashlib.sha256();self.size=0
 def write(self,data): self.sha.update(data);self.size+=len(data);return len(data)
 def flush(self): pass
sink=HashSink()
output=sink if hash_only=='yes' else open(output_path,'wb')
changed={'package.json','cordis.patch.yml','lib/index.js','lib/client.js'}
with tarfile.open(source_path) as source, gzip.GzipFile(fileobj=output,mode='wb',mtime=0,filename='') as gz, tarfile.open(fileobj=gz,mode='w|',format=tarfile.USTAR_FORMAT) as target:
 for old in sorted(source.getmembers(), key=lambda item:item.name):
  if not old.isfile(): continue
  relative=str(pathlib.PurePosixPath(old.name).relative_to('package'))
  data=pathlib.Path(changed_root,relative).read_bytes() if relative in changed else source.extractfile(old).read()
  item=tarfile.TarInfo(old.name);item.size=len(data);item.mode=0o644;item.mtime=0
  target.addfile(item,io.BytesIO(data))
if hash_only=='yes': print(json.dumps({'sha256':sink.sha.hexdigest(),'sizeBytes':sink.size}))
else: output.close()
`,
      archive,
      codeRoot,
      output,
      hashOnly ? 'yes' : 'no',
    ],
    { encoding: 'utf8' }
  );
  assert.equal(packed.status, 0, packed.stderr);
  if (hashOnly) {
    provenance.reproduction = JSON.parse(packed.stdout);
  } else {
    const bytes = await readFile(output);
    provenance.artifact = {
      path: path.relative(root, output),
      sha256: sha(bytes),
      sizeBytes: bytes.length,
    };
  }
}
await writeFile(
  path.join(
    import.meta.dirname,
    hashOnly ? `reproduction-alpha.${iteration}.json` : 'source-provenance.json'
  ),
  `${JSON.stringify(provenance, null, 2)}\n`
);
console.log(
  JSON.stringify({
    codeRoot: path.relative(root, codeRoot),
    changedFiles: changes.length,
    artifact: provenance.artifact ?? null,
    reproduction: provenance.reproduction ?? null,
  })
);
