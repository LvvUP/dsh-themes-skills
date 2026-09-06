#!/usr/bin/env node
import {createRequire} from 'node:module';
import {dirname,resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {mkdir,writeFile} from 'node:fs/promises';
const root=dirname(fileURLToPath(import.meta.url));
const esbuildRoot=process.argv[2];if(!esbuildRoot)throw new Error('Usage: node build.mjs <absolute-esbuild-0.28.2-package-dir>');
const esbuild=createRequire(import.meta.url)(resolve(esbuildRoot));if(esbuild.version!=='0.28.2')throw new Error('Exact esbuild 0.28.2 required');
await mkdir(join(root,'source/lib'),{recursive:true});
const common={absWorkingDir:join(root,'source'),bundle:true,minify:true,legalComments:'inline',charset:'utf8',write:false,sourcemap:false,metafile:true,logLevel:'warning'};
const host=await esbuild.build({...common,entryPoints:['src/index.ts'],platform:'node',format:'esm',target:'node24',outfile:'lib/index.js'});
const clientOptions={...common,entryPoints:['src/client/index.ts'],platform:'browser',format:'cjs',target:'es2022',jsx:'automatic',external:['react','react/jsx-runtime'],outfile:'lib/client.js',define:{__DSH_SESSION_TREE_CSS__:'""'}};
const pass1=await esbuild.build(clientOptions);const css=pass1.outputFiles.find(f=>f.path.endsWith('.css'))?.text;if(!css)throw new Error('Missing complete CSS Modules output');
const pass2=await esbuild.build({...clientOptions,define:{__DSH_SESSION_TREE_CSS__:JSON.stringify(css)}});if(pass2.outputFiles.find(f=>f.path.endsWith('.css'))?.text!==css)throw new Error('CSS module output changed between passes');
const client=pass2.outputFiles.find(f=>f.path.endsWith('.js')).text;
if(pass2.metafile.outputs['lib/client.js'].imports.some(i=>!['react','react/jsx-runtime'].includes(i.path)))throw new Error('Unexpected client import');
await writeFile(join(root,'source/lib/index.js'),host.outputFiles[0].contents);
await writeFile(join(root,'source/lib/client.js'),`window.__ModuleLoader__.load({id:"dsh-session-tree",factory:(require)=>{var module={exports:{}};var exports=module.exports;\n${client}\nreturn module.exports;}});\n`);
// This pure function entry is retained for isolated algorithm fixtures.
const model=await esbuild.build({...common,entryPoints:['src/client/tree-model.ts'],platform:'node',format:'esm',target:'node24',outfile:'lib/tree-model.js'});await writeFile(join(root,'source/lib/tree-model.js'),model.outputFiles[0].contents);
console.log(JSON.stringify({esbuildVersion:esbuild.version,clientBytes:Buffer.byteLength(client),inlineCssBytes:Buffer.byteLength(css),modelBytes:model.outputFiles[0].contents.length},null,2));
