import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { EventEmitter } from 'node:events';
const base='/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-workspace-composition';
const require=createRequire(import.meta.url);
const ts=require(base+'/node_modules/typescript/lib/typescript.js');
const inputs=[['apps/web/test/workspace-layout.fixture.ts','workspaceReadKind'],['apps/web/test/workspace-layout.browser.ts','observeBodyRequests']];
const pins=[];
const parts=inputs.map(([path,name])=>{
 const text=readFileSync(base+'/'+path,'utf8');
 const source=ts.createSourceFile(path,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
 assert.equal(source.parseDiagnostics.length,0);
 const found=source.statements.filter(node=>ts.isFunctionDeclaration(node)&&node.name?.text===name);
 assert.equal(found.length,1);
 pins.push({path,name,sha256:createHash('sha256').update(text).digest('hex')});
 return found[0].getText(source).replace(/^export\s+/,'');
});
const compiled=ts.transpileModule(parts.join('\n'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None},reportDiagnostics:true});
assert.equal(compiled.diagnostics.length,0);
const {workspaceReadKind,observeBodyRequests}=new Function(compiled.outputText+'\nreturn {workspaceReadKind,observeBodyRequests};')();
const origin='http://127.0.0.1:43210';
const reply='/api/conversations/chat-1/turns/turn-1/details/reply-1',queue='/api/conversations/chat-1/queue/item-1';
const req=(path,method='GET',host=origin)=>({url:()=>host+path,method:()=>method});
const setup=()=>{const page=new EventEmitter();return {page,observer:observeBodyRequests(page,origin,[reply,queue])};};
const cases=[];
const check=(name,operation)=>{try{operation();cases.push({name,state:'PASS'});}catch(error){cases.push({name,state:'FAIL',error:String(error)});}};
check('exact public reply, queue, global detail and task stream',()=>{
 for(const path of [reply,queue,'/api/details/task-reply'])assert.equal(workspaceReadKind(path),'body');
 assert.equal(workspaceReadKind('/api/tasks/task-1/stream'),'stream');
});
check('four observed Vite queue modules ignored',()=>{
 for(const name of ['commands.ts','projection.ts','ConversationQueue.tsx','queue-elements.tsx'])assert.equal(workspaceReadKind('/src/conversations/queue/'+name),null);
});
check('metadata and list endpoints ignored',()=>{
 for(const path of ['/api/conversations/chat-1/queue','/api/conversations/chat-1','/api/tasks/task-1','/api/tasks/task-1/patches'])assert.equal(workspaceReadKind(path),null);
});
check('prefix and suffix near misses ignored',()=>{
 for(const path of ['/src'+reply,reply+'/extra',queue+'/', '/api/tasks/task-1/stream/extra','/api/other/details/item'])assert.equal(workspaceReadKind(path),null);
});
check('actual observer emits nothing for Vite lifecycle',()=>{
 const {page,observer}=setup();const r=req('/src/conversations/queue/commands.ts');page.emit('request',r);page.emit('response',{request:()=>r,status:()=>200});page.emit('requestfinished',r);
 assert.deepEqual(observer.snapshot().rows,[]);assert.deepEqual(observer.snapshot().errors,[]);observer.close();
});
check('query uses pathname and successful body lifecycle',()=>{
 const {page,observer}=setup();const r=req(reply+'?revision=2');page.emit('request',r);assert.deepEqual(observer.pending(),[reply]);page.emit('response',{request:()=>r,status:()=>200});page.emit('requestfinished',r);
 assert.equal(observer.bodies()[0].status,200);assert.equal(typeof observer.bodies()[0].finishedMs,'number');assert.deepEqual(observer.pending(),[]);assert.deepEqual(observer.snapshot().errors,[]);observer.close();
});
check('unexpected real API is retained and rejected',()=>{
 const {page,observer}=setup();page.emit('request',req('/api/conversations/other/queue/unexpected'));assert.equal(observer.bodies().length,1);assert.deepEqual(observer.snapshot().errors,['Unexpected or duplicate body request']);observer.close();
});
check('duplicate expected body is retained and rejected',()=>{
 const {page,observer}=setup();page.emit('request',req(reply));page.emit('request',req(reply));assert.equal(observer.bodies().length,2);assert.deepEqual(observer.snapshot().errors,['Unexpected or duplicate body request']);observer.close();
});
check('non-GET real body is retained and rejected',()=>{
 const {page,observer}=setup();page.emit('request',req(queue,'POST'));assert.equal(observer.bodies()[0].method,'POST');assert.deepEqual(observer.snapshot().errors,['Unexpected or duplicate body request']);observer.close();
});
check('foreign origin ignored',()=>{
 const {page,observer}=setup();page.emit('request',req(reply,'GET','http://127.0.0.1:54321'));assert.deepEqual(observer.snapshot().rows,[]);observer.close();
});
check('task stream tracked separately from body pending',()=>{
 const {page,observer}=setup();page.emit('request',req('/api/tasks/task-1/stream'));assert.equal(observer.snapshot().rows[0].kind,'stream');assert.deepEqual(observer.bodies(),[]);assert.deepEqual(observer.pending(),[]);observer.close();
});
check('failed body leaves pending and close detaches all callbacks',()=>{
 const {page,observer}=setup();const r=req(reply);page.emit('request',r);page.emit('requestfailed',r);assert.deepEqual(observer.pending(),[]);assert.equal(typeof observer.bodies()[0].failedMs,'number');observer.close();
 for(const event of ['request','response','requestfinished','requestfailed'])assert.equal(page.listenerCount(event),0);
 page.emit('request',req(queue));assert.equal(observer.bodies().length,1);
});
const result={method:'AST extraction of actual fixed functions; EventEmitter callback consumer, no HTTP or browser',pins,passed:cases.filter(c=>c.state==='PASS').length,failed:cases.filter(c=>c.state==='FAIL').length,cases};
writeFileSync(new URL('./pure-result.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result));
if(result.failed)process.exitCode=1;
