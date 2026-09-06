import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../skills/dsh-plugin-installer');
const item=JSON.parse(readFileSync(path.join(root,'references/plugins.json'))).items.find(item=>item.catalogId===3091);
const source=execFileSync('tar',['-xOf',path.join(root,item.artifact.path),'package/lib/client.js'],{encoding:'utf8',maxBuffer:3*1024*1024});
const start=source.indexOf('  const memoryInitialConfig = fetch('),end=source.indexOf('\n  const t2 =',start);
assert(start>=0&&end>start,'The real package must contain the reviewed configuration-first probe.');
const helper=source.slice(start,end)+'\n globalThis.probe = fetchEnabledMemoryModule;';
function fixture(config,ok=true){const calls=[];const context=vm.createContext({fetch:async url=>{calls.push(url);return url.endsWith('/config')?{ok,status:ok?200:503,json:async()=>({config})}:{ok:true,status:200,url};}});vm.runInContext(helper,context);return {probe:context.probe,calls};}
test('disabled optional modules do not request their unregistered routes',async()=>{const f=fixture({coiEnabled:false});await assert.rejects(f.probe('coiEnabled','/memory-evolve/api/coi/config'),/disabled/);assert.deepEqual(f.calls,['/memory-evolve/api/config']);});
test('enabled modules use the original endpoint after the authoritative flag',async()=>{const f=fixture({coiEnabled:true});const result=await f.probe('coiEnabled','/memory-evolve/api/coi/config');assert.equal(result.status,200);assert.deepEqual(f.calls,['/memory-evolve/api/config','/memory-evolve/api/coi/config']);});
test('configuration failures remain failures and do not synthesize module responses',async()=>{const f=fixture({},false);await assert.rejects(f.probe('coiEnabled','/memory-evolve/api/coi/config'),/HTTP 503/);assert.deepEqual(f.calls,['/memory-evolve/api/config']);});
