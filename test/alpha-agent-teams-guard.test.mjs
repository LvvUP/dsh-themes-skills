import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import vm from 'node:vm';
const root=new URL('../',import.meta.url);
async function loadGuard(){
 const catalog=JSON.parse(await readFile(new URL('skills/dsh-plugin-installer/references/plugins.json',root)));
 const item=catalog.items.find(i=>i.catalogId===3076);
 const tar=gunzipSync(await readFile(new URL('skills/dsh-plugin-installer/'+item.artifact.path,root)));
 let source;
 for(let offset=0;offset+512<=tar.length;){const header=tar.subarray(offset,offset+512);const name=header.subarray(0,100).toString().replace(/\0.*$/s,'');if(!name)break;const size=parseInt(header.subarray(124,136).toString().replace(/\0.*$/s,'').trim(),8);if(name==='package/lib/harness-compat.js')source=tar.subarray(offset+512,offset+512+size).toString();offset+=512+Math.ceil(size/512)*512;}
 assert.ok(source);assert.equal(source.split("import { SubagentError } from '@deepseek-ai/dsh-subagent';").length,2);
 const context={SubagentError:class extends Error{constructor(message,code){super(message);this.code=code;}}};
 vm.runInNewContext(source.replace("import { SubagentError } from '@deepseek-ai/dsh-subagent';",'').replaceAll('export function ','function ').replaceAll('export async function ','async function ')+ '\nthis.api={guardSubagentDelivery,queueMemberPrompt};',context);
 return context.api;
}
function fixture(){
 const symbol=Symbol.for('dsh.subagent.deliverPrompt'),calls=[],cleanups=[];
 const prototype={ [symbol](...args){calls.push({kind:'host',receiver:this,args});return 'host-ok';},sendMessage(...args){calls.push({kind:'send',receiver:this,args});return 'send-ok';}};
 const runtime=Object.create(prototype);const ctx={subagents:runtime,effect(fn){cleanups.push(fn());}};
 return {symbol,calls,cleanups,runtime,ctx,prototype};
}
test('Alpha AgentTeams guards queue, steer and public delivery without bypassing retired members',async()=>{
 const api=await loadGuard(),f=fixture(),parent={},signal=new AbortController().signal;
 api.guardSubagentDelivery(f.ctx,async(_sender,id)=>id==='retired');
 for(const delivery of ['queue','steer'])await assert.rejects(f.runtime[f.symbol](parent,'retired',[],{},signal,delivery),e=>e.code==='NOT_RESUMABLE');
 await assert.rejects(f.runtime.sendMessage(parent,'retired',[],{signal}),e=>e.code==='NOT_RESUMABLE');
 assert.equal(f.calls.length,0);
 assert.equal(await f.runtime[f.symbol](parent,'active',[],{kind:'plugin'},signal,'steer'),'host-ok');
 assert.equal(f.calls[0].receiver,f.runtime);assert.equal(f.calls[0].args[5],'steer');assert.equal(f.calls[0].args[4],signal);
 await api.queueMemberPrompt(f.runtime,parent,'active',[],signal);assert.equal(f.calls[1].args[5],'queue');assert.equal(f.calls[1].args[3].plugin,'dsh-agent-teams');
 f.cleanups[0]();assert.equal(Object.hasOwn(f.runtime,f.symbol),false);assert.equal(Object.hasOwn(f.runtime,'sendMessage'),false);
});
test('Alpha AgentTeams still rejects an incomplete contract and preserves a later owner on disposal',async()=>{
 const api=await loadGuard(),f=fixture();assert.throws(()=>api.guardSubagentDelivery({subagents:{sendMessage(){}},effect(){}},async()=>false),/complete retired-member guard/);
 api.guardSubagentDelivery(f.ctx,async()=>false);const later=()=>{};f.runtime[f.symbol]=later;f.cleanups[0]();assert.equal(f.runtime[f.symbol],later);
});
