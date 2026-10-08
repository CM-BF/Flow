import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {FlowClient} from '/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-workspace-composition/packages/client/src/index.ts';
import {ConversationQueueProjection} from '/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-workspace-composition/apps/web/src/conversations/queue/projection.ts';
import {ConversationProjection} from '/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-workspace-composition/apps/web/src/conversations/projection.ts';
const base='/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-workspace-composition';
const require=createRequire(import.meta.url),ts=require(base+'/node_modules/typescript/lib/typescript.js');
const fixture=base+'/apps/web/test/workspace-layout.fixture.ts';
function exactQueueHandler(text){
 const ast=ts.createSourceFile('fixture.ts',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);assert.equal(ast.parseDiagnostics.length,0);
 const blocks=[];function visit(node){if(ts.isIfStatement(node)&&node.expression.getText(ast)==='queue && method === "GET"')blocks.push(node.thenStatement);ts.forEachChild(node,visit);}visit(ast);assert.equal(blocks.length,1);
 const code=ts.transpileModule(blocks[0].getText(ast),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None},reportDiagnostics:true});assert.equal(code.diagnostics.length,0);
 return (id,detail)=>{let result;const json=(_response,value,status=200)=>{assert.equal(result,undefined);result={value,status};};
  new Function('queue','method','at','response','url','json','bodyResponse',code.outputText)(['',id,detail],'GET','2026-10-08T00:13:00.000Z',{}, {pathname:'/api/conversations/'+id+'/queue'+(detail?'/'+detail:'')},json,(_path,_response,send)=>send());assert.ok(result);return result;};
}
const old=exactQueueHandler(readFileSync(new URL('./before.fixture.ts',import.meta.url),'utf8')),current=exactQueueHandler(readFileSync(fixture,'utf8'));
const cases=[],originalFetch=globalThis.fetch;
async function validated(id,value){
 let calls=0;globalThis.fetch=async (url,init)=>{calls++;assert.equal(new URL(url).pathname,'/api/conversations/'+id+'/queue');assert.ok(!init.method||init.method==='GET');return new Response(JSON.stringify(value),{headers:{'content-type':'application/json'}});};
 const client=new FlowClient({baseUrl:'http://not-contacted.invalid',token:'pure-fixture-only'}),queue=new ConversationQueueProjection(client);
 queue.configure(id,true);const valid=await queue.refresh();assert.equal(calls,1);return {queue,valid};
}
const sendReason=(queue,status='succeeded')=>ConversationProjection.prototype.sendDisabledReason.call({online:true,id:'chat-4',state:{loading:false,outbox:null,snapshot:{lastTurn:{task:{status}}}},queue},'follow-up');
try{
 const before=await validated('chat-4',old('chat-4').value);try{assert.equal(before.valid,true);assert.match(sendReason(before.queue),/queue is paused/);cases.push('Original chat4 actual queue DTO validates and blocks follow-up');}finally{before.queue.dispose();}
 for(const n of [1,2,3]){const id='chat-'+n;assert.deepEqual(current(id),old(id));assert.deepEqual(current(id,id+'-queue'),old(id,id+'-queue'));const read=await validated(id,current(id).value);try{assert.equal(read.valid,true);assert.match(sendReason(read.queue),/queue is paused/);cases.push(id+' paused page/full detail unchanged and follow-up blocked');}finally{read.queue.dispose();}}
 const material=await validated('chat-4',current('chat-4').value);try{assert.equal(material.valid,true);assert.deepEqual(material.queue.getSnapshot().page.items,[]);assert.equal(material.queue.getSnapshot().page.paused,false);assert.equal(sendReason(material.queue),null);cases.push('Fixed chat4 exact DTO passes real queue validation and completed-task follow-up guard');assert.match(sendReason(material.queue,'running'),/turn is active/);cases.push('Active task still blocks follow-up; original guard unchanged');}finally{material.queue.dispose();}
 const wrong=await validated('chat-4',{...current('chat-4').value,conversationId:'another-chat'});try{assert.equal(wrong.valid,false);assert.equal(wrong.queue.getSnapshot().stale,true);assert.match(sendReason(wrong.queue),/Wait for the current queue/);cases.push('Wrong-identity queue rejected by actual read model and cannot enable Send');}finally{wrong.queue.dispose();}
 assert.equal(current('chat-4','chat-4-queue').status,404);cases.push('Empty material queue cannot fabricate a waiting detail');
}finally{globalThis.fetch=originalFetch;}
assert.equal(cases.length,8);
const result={passed:cases.length,failed:0,cases,method:'AST extracts original/fixed actual fixture queue branch. Actual FlowClient JSON read via local Response only, actual ConversationQueueProjection validates page and owns cleanup. Actual ConversationProjection.sendDisabledReason invoked with explicit controlled completed/active states; not mounted App or HTTP. No duplicated guard/decoder implementation.',limitations:['Pure controlled state, not browser/recovery/attachment preparation','No claim that FlowClient itself has a standalone queue schema: current validation is the actual queue projection'],sourcePins:[fixture,base+'/packages/client/src/index.ts',base+'/apps/web/src/conversations/projection.ts',base+'/apps/web/src/conversations/queue/projection.ts'].map(path=>({path,sha256:createHash('sha256').update(readFileSync(path)).digest('hex')}))};
writeFileSync(new URL('./pure-result.json',import.meta.url),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
