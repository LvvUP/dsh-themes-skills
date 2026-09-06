import {test} from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks,createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {runInNewContext} from 'node:vm';
import {createHash} from 'node:crypto';
const root=dirname(fileURLToPath(import.meta.url));
const runtime=process.env.DSH_FIXTURE_RUNTIME;
if (!runtime) throw new Error('Set DSH_FIXTURE_RUNTIME to the existing pinned Alpha source checkout. This fixture starts no server.');
const hook=registerHooks({resolve(specifier,context,nextResolve){
 if(specifier==='@deepseek-ai/dsh-session')return {url:pathToFileURL(resolve(runtime,'packages/core/session/lib/index.js')).href,shortCircuit:true};
 return nextResolve(specifier,context);
}});
const host=await import('./source/lib/index.js');
hook.deregister();
const counter=host.createDeepSeekTokenCounter();
function fold(){const def=host.createLiveTokenUsageProjectionDefinition(counter);let state=def.init();let seq=0;return {def,get state(){return state},set state(v){state=v},event(type,data,time=seq*1000,extra={}){state=def.apply(state,{type,data,time,seq:seq++,...extra});assert.doesNotThrow(()=>def.stateSchema.parse(JSON.parse(JSON.stringify(state))));return def.wire.viewSchema.parse(def.wire.view(state));}};}
test('unaltered complete tokenizer assets produce genuine DeepSeek token counts',()=>{
 for(const [file,digest] of [['tokenizer.json','ecb6f9fc369894346f0511f4074ca75cee5cd5f3b06d02f1ba35fcd39f8e121d'],['tokenizer_config.json','144a6d92b6012baeb4f2ac41d48ed3458e758f977a0fb5caf75ff07698fc844c']])assert.equal(createHash('sha256').update(readFileSync(resolve(root,'source/assets/deepseek-v3',file))).digest('hex'),digest);
 assert.equal(counter.countText('ok'),1);assert.equal(counter.countAssistantOutput([{type:'text',text:'ok'}]),2);assert.ok(counter.countText('中文与 English')>0);
});
test('Alpha state/wire contract streams estimates and TPS then preserves provider correction',()=>{
 const f=fold();assert.equal(f.def.stateVersion,3);assert.equal(f.def.schema,undefined);assert.equal(f.def.view,undefined);
 f.event('user/message',{role:'user',source:{kind:'user'},content:[{type:'text',text:'abcd'}]},0,{surfaceOp:'append'});
 f.event('step/start',{turn:1,step:1},1000);
 f.event('request/header',{header:{config:{provider:'fixture',model:'fixture'},system:'abcd'},reason:'initial'},1000);
 f.event('assistant/chunk',{turn:1,step:1,chunk:{type:'text-delta',index:0,text:'abcd'}},2000);
 const v=f.event('assistant/chunk',{turn:1,step:1,chunk:{type:'text-delta',index:0,text:'efgh'}},3000);
 assert.equal(v.estimated,true);assert.equal(v.tokensPerSecond,counter.countText('efgh'));
 const corrected=f.event('assistant/chunk',{turn:1,step:1,chunk:{type:'usage',usage:{inputTokens:20,outputTokens:30,cacheReadTokens:80}}},4000);
 assert.equal(corrected.estimated,false);assert.equal(corrected.outputTokens,30);assert.equal(corrected.cacheReadTokens,80);
 const settled=f.event('step/end',{turn:1,step:1},5000);assert.deepEqual(settled,corrected);
});
test('sparse stream indexes survive checkpoint JSON and continue without missing-block crashes',()=>{
 const f=fold();f.event('step/start',{turn:1,step:1},0);
 f.event('assistant/chunk',{turn:1,step:1,chunk:{type:'text-delta',index:2,text:'ok'}},1000);
 f.state=f.def.stateSchema.parse(JSON.parse(JSON.stringify(f.state)));
 assert.deepEqual(f.state.active.blocks.slice(0,2),[null,null]);
 const v=f.event('assistant/chunk',{turn:1,step:1,chunk:{type:'block-end',index:2,block:{type:'text',text:'ok'}}},2000);assert.equal(v.outputTokens,2);
 assert.equal(f.def.stateSchema.safeParse({...f.state,surfaceTokens:-1}).success,false);
 assert.equal(f.def.stateSchema.safeParse({...f.state,active:{...f.state.active,blocks:[{type:'text',text:7}]}}).success,false);
});
test('client keeps real children, usage groups, TPS, and disposable slot registration',()=>{
 const require=createRequire(resolve(runtime,'node_modules/.pnpm/react@18.3.1/node_modules/react/package.json'));
 let entry;runInNewContext(readFileSync(resolve(root,'source/lib/client.js'),'utf8'),{window:{__ModuleLoader__:{load(v){entry=v}}},Intl});
 assert.equal(entry.id,'@proton1917/dsh-live-stats');const client=entry.factory(require);
 assert.deepEqual(Array.from(client.inject),['slots','locale']);let disposed=0;const callbacks=[],registered=[];
 client.apply({effect(fn){callbacks.push(fn());},locale:{register(){return()=>disposed++;}},slots:{inject(name,fn){assert.equal(name,'conversation.composer.dock');callbacks.push(fn());},register(meta,component){registered.push({meta,component});return()=>disposed++;}}});
 assert.equal(registered.length,2);assert.deepEqual(registered.map(x=>x.meta.id),['stats','live-tps']);
 const t=(key,values={})=>key+' '+JSON.stringify(values);
 const visible=node=>node==null?'':Array.isArray(node)?node.map(visible).join(' '):typeof node==='object'?visible(node.props?.children):String(node);
 const values={sessionStats:{steps:1,turns:1,llmMs:500,toolMs:20,ttftSteps:1,ttftMs:30},tokenUsage:{uncachedInputTokens:20,outputTokens:30,cacheReadTokens:80,cacheWriteTokens:0},liveTokenUsage:{uncachedInputTokens:20,outputTokens:30,cacheReadTokens:80,cacheWriteTokens:0,estimated:false,tokensPerSecond:12.5}};
 const stats=visible(client.LiveStatsLine.type({useProjection:k=>values[k],t}));assert.match(stats,/counts/);assert.match(stats,/cacheHit/);assert.match(stats,/tokens/);assert.match(stats,/130/);
 assert.match(visible(client.TpsLine.type({useProjection:k=>values[k],t})),/12.5/);
 assert.equal(client.TpsLine.type({useProjection:()=>undefined,t}),null);
 callbacks.reverse().forEach(fn=>fn());assert.equal(disposed,3);
});
