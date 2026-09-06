import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {runInNewContext} from 'node:vm';
import {projectSessionTree} from './source/lib/tree-model.js';
const root=dirname(fileURLToPath(import.meta.url));
const runtime=process.env.DSH_FIXTURE_RUNTIME;
if(!runtime)throw new Error('Set DSH_FIXTURE_RUNTIME to the existing Alpha source checkout; this fixture starts no DSH server.');
const require=createRequire(resolve(runtime,'node_modules/.pnpm/react-dom@18.3.1_react@18.3.1/node_modules/react-dom/package.json'));
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
function load(){const styles=[];let client;
 const document={createElement(){const tag={dataset:{},textContent:'',remove(){const i=styles.indexOf(tag);if(i>=0)styles.splice(i,1);}};return tag;},head:{appendChild(tag){styles.push(tag);}}};
 runInNewContext(readFileSync(resolve(root,'source/lib/client.js'),'utf8'),{window:{__ModuleLoader__:{load(entry){assert.equal(entry.id,'dsh-session-tree');client=entry.factory(require);}}},document});
 return {client,styles};}
test('lineage model preserves root, fork and subagent relationships without mutating input',()=>{
 const input=[{sessionId:'r'},{sessionId:'f',parentSessionId:'r'},{sessionId:'s',parentSessionId:'f',origin:'subagent'}];const original=JSON.stringify(input);const rows=projectSessionTree(input);
 assert.deepEqual(rows.map(x=>[x.sessionId,x.depth,x.relationship]),[['r',0,'root'],['f',1,'fork'],['s',2,'subagent']]);assert.equal(JSON.stringify(input),original);
});
test('duplicate, missing-parent and cycle handling remain deterministic and bounded',()=>{
 const rows=projectSessionTree([{sessionId:'a',parentSessionId:'b'},{sessionId:'b',parentSessionId:'a'},{sessionId:'o',parentSessionId:'missing'},{sessionId:'a'}]);assert.equal(rows.length,3);assert.ok(rows.some(x=>x.integrity==='cycle'));assert.ok(rows.some(x=>x.integrity==='orphan'));assert.equal(new Set(rows.map(x=>x.sessionId)).size,3);
 const chain=Array.from({length:2000},(_,i)=>({sessionId:String(i),...(i?{parentSessionId:String(i-1)}:{})}));assert.equal(projectSessionTree(chain).length,2000);
});
test('Alpha session actions, slot and inline CSS have explicit cleanup',()=>{
 const {client,styles}=load();assert.deepEqual(Array.from(client.inject),['slots','sessions','locale']);const disposers=[],opened=[];let entry,localeDisposed=0,slotDisposed=0;
 client.apply({effect(fn){disposers.push(fn());},locale:{register(){return()=>localeDisposed++;},bind(){return key=>key;}},sessions:{subagentAddress(id){if(id==='bad')throw new Error('gone');return id==='child'?{rootSessionId:'root',sessionId:id}:undefined;},open(id){opened.push(['session',id]);},openSubagent(address){opened.push(['subagent',address.sessionId]);}},slots:{inject(name,fn){assert.equal(name,'conversation.view');disposers.push(fn());},register(meta,component){entry={meta,component};return()=>slotDisposed++;}}});
 assert.equal(entry.meta.id,'dsh-session-tree');assert.equal(styles.length,1);assert.match(styles[0].textContent,/--dsw-alias-label-primary/);assert.ok(styles[0].textContent.length>2000);
 const actions=entry.meta.inject();assert.equal(actions.openSession('root'),true);assert.equal(actions.openSession('child'),true);assert.equal(actions.openSession('bad'),false);assert.deepEqual(opened,[['session','root'],['subagent','child']]);
 disposers.reverse().forEach(fn=>fn());assert.equal(styles.length,0);assert.equal(localeDisposed,1);assert.equal(slotDisposed,1);
});
test('real React rendering retains breadcrumb-only subagents and readable native navigation',()=>{
 const {client}=load();let Component;client.apply({effect(){},locale:{register(){return()=>{};},bind(){return k=>k;}},sessions:{},slots:{inject(_name,fn){return fn();},register(_meta,component){Component=component;return()=>{};}}});
 const sessions={ids:['r','f'],byId:{r:{id:'r',displayTitle:'Root research',running:false},f:{id:'f',parentId:'r',displayTitle:'Alternative plan',running:false},s:{id:'s',parentId:'f',origin:'subagent',displayTitle:'Research helper',running:true}},current:'s'};
 const html=renderToStaticMarkup(React.createElement(Component,{sessionId:'s',useSessions:selector=>selector(sessions),openSession:()=>true,t:(k,v)=>k+(v?' '+JSON.stringify(v):'')}));
 for(const text of ['Root research','Alternative plan','Research helper','tree.subagent','tree.current','tree.running'])assert.ok(html.includes(text),text);
 assert.match(html,/<button/);assert.ok(!html.includes('__DSH_SESSION_TREE_CSS__'));
});
