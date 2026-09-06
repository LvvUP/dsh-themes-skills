#!/usr/bin/env node
import {createRequire} from 'node:module';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFile,writeFile,readdir,lstat,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=dirname(fileURLToPath(import.meta.url));
const [esbuildPath,depsPath]=process.argv.slice(2);
if(!esbuildPath||!depsPath)throw Error('Usage: node build.mjs <esbuild-0.28.2-package-dir> <fixed-node_modules>');
const esbuild=createRequire(import.meta.url)(resolve(esbuildPath));
if(esbuild.version!=='0.28.2')throw Error('Exact esbuild 0.28.2 required');
const sha=b=>createHash('sha256').update(b).digest('hex');
const upstream=JSON.parse(await readFile(join(root,'UPSTREAM.json'),'utf8'));
if(sha(await readFile(join(root,'upstream-leases.js')))!==upstream.completeTreeFiles['lib/leases.js'].sha256)throw Error('Lease source changed');
const dependency=JSON.parse(await readFile(join(root,'DEPENDENCIES.json'),'utf8')).bundled[0];
if(dependency.name!=='zod'||dependency.version!=='4.4.3')throw Error('Unexpected dependency');
const zodRoot=join(resolve(depsPath),'zod');
const actual=[];async function walk(p,prefix=''){for(const entry of await readdir(p,{withFileTypes:true})){const n=prefix+entry.name;const file=join(p,entry.name);if((await lstat(file)).isSymbolicLink())throw Error('Dependency symlink');if(entry.isDirectory())await walk(file,n+'/');else actual.push(n);}}
await walk(zodRoot);
if(JSON.stringify(actual.sort())!==JSON.stringify(dependency.files.map(f=>f.path).sort()))throw Error('Zod inventory changed');
for(const f of dependency.files){const b=await readFile(join(zodRoot,f.path));if(b.length!==f.bytes||sha(b)!==f.sha256)throw Error('Zod bytes changed: '+f.path);}
const out=await esbuild.build({absWorkingDir:root,entryPoints:['upstream-leases.js'],bundle:true,minify:true,platform:'node',format:'esm',target:'node24',write:false,sourcemap:false,charset:'utf8',legalComments:'inline',outfile:'source/lib/leases.js',external:['@deepseek-ai/*'],plugins:[{name:'preserve-upstream-module-boundaries',setup(build){build.onResolve({filter:/^\.\/(approval-policy|errors)\.js$/},args=>args.importer===join(root,'upstream-leases.js')?{path:args.path,external:true}:undefined);}}],alias:{zod:join(zodRoot,'index.js')},metafile:true});
const imports=out.metafile.outputs['source/lib/leases.js'].imports.map(x=>x.path).sort();
if(JSON.stringify(imports)!==JSON.stringify(['./approval-policy.js','./errors.js','@deepseek-ai/dsh-storage-domain'].sort()))throw Error('Unexpected compiled imports: '+imports);
await writeFile(join(root,'source/lib/leases.js'),out.outputFiles[0].contents);
await rm(join(root,'source/lib/leases.js.map'),{force:true});
console.log(JSON.stringify({esbuildVersion:esbuild.version,compiledBytes:out.outputFiles[0].contents.length,sha256:sha(out.outputFiles[0].contents),externalImports:imports}));

// Alpha Settings validates the literal namespace internally; its old public
// settingsNamespace factory and branded type are no longer exported.
const configTs=await readFile(join(root,'source/src/config.ts'),'utf8');
if(/settingsNamespace/.test(configTs))throw Error('Obsolete Settings API remains');
const config=await esbuild.transform(configTs.replace("'./errors.ts'", "'./errors.js'"), {loader:'ts',target:'es2022',format:'esm',sourcefile:'../src/config.ts',sourcemap:'external',sourcesContent:false,legalComments:'inline'});
await writeFile(join(root,'source/lib/config.js'),config.code+'//# sourceMappingURL=config.js.map\n');
await writeFile(join(root,'source/lib/config.js.map'),config.map);
console.log(JSON.stringify({configurationBytes:Buffer.byteLength(config.code),configurationSha256:sha(config.code),namespace:'computer-use'}));
