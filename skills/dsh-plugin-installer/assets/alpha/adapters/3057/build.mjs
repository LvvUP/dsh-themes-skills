#!/usr/bin/env node
import { createRequire } from 'node:module';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const root=dirname(fileURLToPath(import.meta.url));
const [esbuildRoot,dependenciesRoot]=process.argv.slice(2);
if (!esbuildRoot || !dependenciesRoot) throw new Error('Usage: node build.mjs <absolute-esbuild-package-dir> <absolute-pinned-node_modules-dir>');
const esbuild=createRequire(import.meta.url)(resolve(esbuildRoot));
if (esbuild.version!=='0.28.2') throw new Error('Reproduction requires esbuild 0.28.2');
const dependencies=JSON.parse(await readFile(join(root,'DEPENDENCIES.json'),'utf8'));
for(const dep of dependencies) for(const file of dep.files) {
 const b=await readFile(join(dependenciesRoot,dep.name,file.path));
 if(b.length!==file.bytes||createHash('sha256').update(b).digest('hex')!==file.sha256)throw new Error(`Dependency identity mismatch: ${dep.name}/${file.path}`);
}
await mkdir(join(root,'source/lib'),{recursive:true});
const common={absWorkingDir:join(root,'source'),bundle:true,minify:true,legalComments:'inline',charset:'utf8',nodePaths:[resolve(dependenciesRoot)],sourcemap:false,metafile:true,write:false,logLevel:'warning'};
const host=await esbuild.build({...common,entryPoints:['src/index.ts'],platform:'node',format:'esm',target:'node24',external:['@deepseek-ai/*'],outfile:'lib/index.js'});
const client=await esbuild.build({...common,entryPoints:['src/client/index.ts'],platform:'browser',format:'cjs',target:'es2022',jsx:'automatic',external:['@deepseek-ai/*','react','react/jsx-runtime'],outfile:'lib/client.js'});
const hostBytes=host.outputFiles[0].contents;
const clientBytes=Buffer.from(`window.__ModuleLoader__.load({id:"@proton1917/dsh-live-stats",factory:(require)=>{var module={exports:{}};var exports=module.exports;\n${client.outputFiles[0].text}\nreturn module.exports;}});\n`);
await writeFile(join(root,'source/lib/index.js'),hostBytes);
await writeFile(join(root,'source/lib/client.js'),clientBytes);
console.log(JSON.stringify({esbuildVersion:esbuild.version,hostBytes:hostBytes.length,clientBytes:clientBytes.length,hostImports:host.metafile.outputs['lib/index.js'].imports,clientImports:client.metafile.outputs['lib/client.js'].imports},null,2));
