import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { createClaudeAdapter, type ClaudeQuery } from '../../../runner/src/claude.js';
import { runRunner } from '../../../runner/src/runtime.js';
import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import { sha256 } from '../database.js';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
type SDKMessage = ReturnType<ClaudeQuery> extends AsyncIterable<infer Message> ? Message : never;
import { createServer } from '../index.js';
import { migrateNativeActivities, registerNativeActivityRoutes } from '../native-activity/index.js';
import { migrateAssistantStreams, registerAssistantStreamRoutes } from './index.js';
import { AssistantTextAccumulator } from '../../../runner/src/assistant-stream/index.js';
import { migrateConversationContext } from '../conversation-context/index.js';
import { mapNativeActivity } from '../../../runner/src/native-activity/index.js';
const db=`flow_chat06_${randomUUID().replaceAll('-','')}`;
const admin=new Pool({connectionString:'postgresql://flow:flow-local-only@127.0.0.1:55432/postgres',max:1});
const databaseUrl=`postgresql://flow:flow-local-only@127.0.0.1:55432/${db}`;
const pool=new Pool({connectionString:databaseUrl,max:2});
let created=false; let app:Awaited<ReturnType<typeof createServer>>; let base='';
async function start(port=0){
  app=await createServer({databaseUrl,ownerToken:'chat06-owner',leaseMs:300_000,automaticQueueScan:false});
  await migrateConversationContext(pool);
  await migrateNativeActivities(pool);
  await migrateAssistantStreams(pool);
  if(!app.hasRoute({method:'GET',url:'/api/tasks/:id/assistant-stream'})) registerAssistantStreamRoutes(app,pool);
  if(!app.hasRoute({method:'GET',url:'/api/native-activities/:id'})) registerNativeActivityRoutes(app,pool);
  base=await app.listen({host:'127.0.0.1',port});
}
async function stop(){if(app){app.server.closeAllConnections();await app.close();}}
beforeAll(async()=>{await admin.query(`CREATE DATABASE ${db}`);created=true;await start();});
afterAll(async()=>{try{await stop();}finally{await pool.end();try{if(created)await admin.query(`DROP DATABASE ${db}`);}finally{await admin.end();}}});
async function request(path:string,body?:unknown,token='chat06-owner',status=200){
  const response=await fetch(`${base}${path}`,{method:body===undefined?'GET':'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json','idempotency-key':randomUUID()},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(5000)});
  const json=await response.json();expect(response.status,JSON.stringify(json)).toBe(status);return json;
}
async function attempt(){
  const runner=await request('/api/runners',{name:'CHAT06 fixture',harnesses:['claude'],capacity:1});
  const accepted=await request('/api/tasks',{title:'Activity test',prompt:'Synthetic frames only',harness:'claude'},undefined,202);
  // Make dispatch deterministic without claiming or mutating any shared database.
  await pool.query('UPDATE flow.tasks SET dispatch_ready=true WHERE id=$1',[accepted.task.id]);
  const claim=await request('/api/runner/claim',{},runner.token);
  expect(claim.assignment.task.id).toBe(accepted.task.id);
  const sessionId=randomUUID();
  return {taskId:accepted.task.id,token:runner.token,sessionId,ownership:{attemptId:claim.assignment.attempt.id,ownerVersion:claim.assignment.attempt.ownerVersion},session:{id:randomUUID(),sequence:1,type:'session',nativeSessionId:sessionId,adapterVersion:'claude-sdk-0.3.290-v2'}};
}
type Attempt=Awaited<ReturnType<typeof attempt>>;
function patches(a:Attempt,text='你好🙂'){
  const stream=new AssistantTextAccumulator();
  const frame=(event:object)=>({type:'stream_event',uuid:randomUUID(),session_id:a.sessionId,parent_tool_use_id:null,event} as SDKMessage);
  stream.observe(frame({type:'message_start',message:{id:randomUUID(),content:[]}}));
  stream.observe(frame({type:'content_block_start',index:0,content_block:{type:'text',text:''}}));
  const emitted=stream.observe(frame({type:'content_block_delta',index:0,delta:{type:'text_delta',text}}));
  return [...emitted,...stream.flush()].map((patch,index)=>({...patch,id:randomUUID(),sequence:index+2}));
}
const post=(a:Attempt,events:unknown[],status=200)=>request('/api/runner/events',{...a.ownership,events},a.token,status);
const page=(a:Attempt)=>request(`/api/tasks/${a.taskId}/assistant-stream`);
it('makes durable root text readable before final through task-bound owner patch and block routes',async()=>{
  const a=await attempt();const patch=patches(a)[0]!;
  await post(a,[a.session,patch]);
  const list=await page(a); expect(list.blocks).toHaveLength(1);
  expect(list.blocks[0]).toMatchObject({id:patch.streamId,bytes:10,revision:1,status:'streaming'});
  expect(JSON.stringify(list)).not.toContain('你好');expect(list.finalMessageId).toBeNull();
  const changes=await request(`/api/tasks/${a.taskId}/assistant-stream/patches?attemptId=${a.ownership.attemptId}`);
  expect(changes.patches).toHaveLength(1);expect(changes.patches[0].text).toBe('你好🙂');expect(changes.nextCursor).toBe(2);
  expect(await request(`/api/tasks/${a.taskId}/assistant-stream/${patch.streamId}`)).toMatchObject({content:'你好🙂',attemptId:a.ownership.attemptId});
  const timeline=await request(`/api/tasks/${a.taskId}/events`);
  expect(timeline.entries.at(-1).reference.stream).toEqual({kind:'assistant-stream',streamId:patch.streamId,revision:1});
});

it('rejects cross-task block/attempt reads and keeps stream endpoints owner-only',async()=>{
  const a=await attempt(),b=await attempt();const patch=patches(a)[0]!;await post(a,[a.session,patch]);
  await request(`/api/tasks/${b.taskId}/assistant-stream/${patch.streamId}`,undefined,undefined,404);
  await request(`/api/tasks/${b.taskId}/assistant-stream/patches?attemptId=${a.ownership.attemptId}`,undefined,undefined,404);
  await request(`/api/tasks/${a.taskId}/assistant-stream/patches`,undefined,undefined,400);
  await request(`/api/tasks/${a.taskId}/assistant-stream`,undefined,'',401);
  await request(`/api/tasks/${a.taskId}/assistant-stream/${patch.streamId}`,undefined,a.token,403);
});
it('rejects offset/revision/hash/session conflicts atomically and preserves ordered idempotent patches through restart',async()=>{
  const a=await attempt();const patch=patches(a,'durable')[0]!;
  await post(a,[a.session,{...patch,fromBytes:1}],409);expect((await page(a)).blocks).toEqual([]);
  await post(a,[a.session,{...patch,prefixDigest:'0'.repeat(64)}],409);
  await post(a,[a.session,{...patch,nativeSessionId:'another-session'}],409);
  await post(a,[a.session,patch]);expect(await post(a,[a.session,patch])).toMatchObject({accepted:0,lastSequence:2});
  await post(a,[{...patch,id:randomUUID(),sequence:3}]);
  await post(a,[{...patch,id:randomUUID(),sequence:4,text:'mutated'}],409);
  await post(a,[{...patch,id:randomUUID(),sequence:4,revision:3,fromBytes:7,text:'x',prefixDigest:sha256('durablex')}],409);
  await request('/api/runner/events',{...a.ownership,ownerVersion:a.ownership.ownerVersion+1,events:[{...patch,id:randomUUID(),sequence:4}]},a.token,409);
  const port=Number(new URL(base).port);await stop();await start(port);
  expect((await request(`/api/tasks/${a.taskId}/assistant-stream/patches?attemptId=${a.ownership.attemptId}`)).patches).toHaveLength(1);
  expect(await post(a,[a.session,patch])).toMatchObject({accepted:0,lastSequence:3});
});
it('transfers each text byte once across bounded patch pages and reconnects without growing-prefix reads',async()=>{
  const a=await attempt();const text='🙂'.repeat(24576);const events=patches(a,text);expect(events).toHaveLength(12);
  await post(a,[a.session,...events]);let cursor=0;let rebuilt='';let pages=0,wireBytes=0;
  do{
    const response=await request(`/api/tasks/${a.taskId}/assistant-stream/patches?attemptId=${a.ownership.attemptId}&after=${cursor}&limit=8`);
    expect(response.patches.length).toBeLessThanOrEqual(8);wireBytes+=Buffer.byteLength(JSON.stringify(response));pages++;
    for(const patch of response.patches){expect(patch.fromBytes).toBe(Buffer.byteLength(rebuilt));rebuilt+=patch.text;expect(sha256(rebuilt)).toBe(patch.prefixDigest);}
    cursor=response.nextCursor;if(!response.hasMore)break;
  }while(pages<5);
  expect(rebuilt).toBe(text);expect(pages).toBe(2);expect(wireBytes).toBeLessThan(Buffer.byteLength(text)*1.2);
  const connected=await request(`/api/tasks/${a.taskId}/assistant-stream/patches?attemptId=${a.ownership.attemptId}&after=${cursor}`);
  expect(connected.patches).toEqual([]);expect(connected.nextCursor).toBe(cursor);
  const stored=await pool.query<{bytes:string}>("SELECT sum(octet_length(data->>'text')) AS bytes FROM flow.assistant_stream_patches WHERE attempt_id=$1",[a.ownership.attemptId]);
  expect(Number(stored.rows[0]!.bytes)).toBe(Buffer.byteLength(text));
  const logical=(await pool.query<{bytes:string}>('SELECT sum(octet_length(data::text)) AS bytes FROM flow.assistant_stream_patches WHERE attempt_id=$1',[a.ownership.attemptId])).rows[0]!;
  console.log('CHAT06_WIRE_BYTES',JSON.stringify({payloadBytes:Buffer.byteLength(text),persistedTextBytes:Number(stored.rows[0]!.bytes),persistedPatchJsonBytes:Number(logical.bytes),ownerPageBytes:wireBytes,requests:pages,patches:events.length,scope:'logical JSON bytes, not PostgreSQL WAL or provider traffic'}));
});
it.each(['cancelled','failed','uncertain'])('retains the persisted prefix with interrupted state after %s',async outcome=>{
  const a=await attempt();const patch=patches(a,'unfinished')[0]!;await post(a,[a.session,patch]);
  if(outcome==='uncertain')await pool.query("UPDATE flow.tasks SET status='uncertain' WHERE id=$1",[a.taskId]);
  else await post(a,[{type:'completed',outcome,id:randomUUID(),sequence:3}]);
  expect((await page(a)).blocks[0]).toMatchObject({status:'interrupted',phase:'streaming'});
  expect((await page(a)).finalMessageId).toBeNull();
  await post(a,[{...patch,id:randomUUID(),sequence:4,revision:2,text:'late',fromBytes:10,prefixDigest:sha256('unfinishedlate')}],409);
});

it.each(['success','failure','cancel'] as const)('streams injected SDK text through outbox before result and preserves %s semantics',async mode=>{
  const directory=await mkdtemp(join(tmpdir(),'flow-chat06-runtime-'));const stopRunner=new AbortController();let release=()=>{};
  const continueSDK=new Promise<void>(resolve=>release=resolve);const runner=await request('/api/runners',{name:`Stream ${mode}`,harnesses:['claude'],capacity:1});
  const accepted=await request('/api/tasks',{title:'Partial text closure',prompt:'Synthetic only, no provider',harness:'claude'},undefined,202);
  const sessionId=randomUUID();let calls=0;let closed=false;
  const partial=(event:object)=>({type:'stream_event',uuid:randomUUID(),session_id:sessionId,parent_tool_use_id:null,event} as unknown as SDKMessage);
  const full=(id:string,content:unknown[])=>({type:'assistant',uuid:randomUUID(),session_id:sessionId,parent_tool_use_id:null,message:{id,content}} as unknown as SDKMessage);
  async function* message(id:string,text:string){
    yield partial({type:'message_start',message:{id,content:[]}});yield partial({type:'content_block_start',index:0,content_block:{type:'text',text:''}});
    yield partial({type:'content_block_delta',index:0,delta:{type:'text_delta',text}});yield full(id,[{type:'text',text}]);
    yield partial({type:'content_block_stop',index:0});yield partial({type:'message_stop'});
  }
  const query:ClaudeQuery=({options})=>{calls++;expect(options!.includePartialMessages).toBe(true);return Object.assign((async function*(){
    yield {type:'system',subtype:'init',session_id:sessionId,uuid:randomUUID(),model:'synthetic',tools:[],permissionMode:'dontAsk',mcp_servers:[],plugins:[],skills:[],slash_commands:[],agents:[],apiKeySource:'none',betas:[]} as unknown as SDKMessage;
    yield* message('explanation-one','First explanation');yield* message('explanation-two','Second explanation');
    yield full('tool-message',[{type:'tool_use',id:'synthetic-read',name:'Read',input:{synthetic:true}}]);
    yield {type:'user',uuid:randomUUID(),session_id:sessionId,parent_tool_use_id:null,message:{content:[{type:'tool_result',tool_use_id:'synthetic-read',content:'synthetic result'}]}} as unknown as SDKMessage;
    yield partial({type:'message_start',message:{id:'answer-message',content:[]}});yield partial({type:'content_block_start',index:0,content_block:{type:'text',text:''}});
    yield partial({type:'content_block_delta',index:0,delta:{type:'text_delta',text:'Live answer🙂'}});
    await Promise.race([continueSDK,new Promise<void>(resolve=>options!.abortController!.signal.addEventListener('abort',()=>resolve(),{once:true}))]);
    options!.abortController!.signal.throwIfAborted();
    if(mode==='failure')throw new Error('Injected SDK failure');
    yield full('answer-message',[{type:'text',text:'Live answer🙂'}]);yield partial({type:'content_block_stop',index:0});yield partial({type:'message_stop'});
    yield {type:'result',subtype:'success',is_error:false,uuid:randomUUID(),session_id:sessionId,result:'Canonical answer replaces draft',modelUsage:{synthetic:{inputTokens:1,outputTokens:1,cacheReadInputTokens:0,cacheCreationInputTokens:0,costUSD:0}},permission_denials:[],total_cost_usd:0} as unknown as SDKMessage;
  })(),{close(){closed=true;}});};
  const running=runRunner({baseUrl:base,token:runner.token,workingDirectory:directory,signal:stopRunner.signal,adapters:[createClaudeAdapter({materialFiles:[],allowRead:false,query})],pollIntervalMs:10,heartbeatIntervalMs:50});
  try{
    await expect.poll(async()=>(await request(`/api/tasks/${accepted.task.id}/assistant-stream`)).blocks.length,{timeout:5000,interval:20}).toBe(3);
    const before=await request(`/api/tasks/${accepted.task.id}/assistant-stream`);expect(before.finalMessageId).toBeNull();expect(before.taskStatus).toBe('running');
    const live=await request(`/api/tasks/${accepted.task.id}/assistant-stream/patches?attemptId=${before.attemptId}`);expect(live.patches.map((patch:any)=>patch.text).join('')).toContain('Live answer🙂');
    if(mode==='cancel')await request(`/api/tasks/${accepted.task.id}/cancel`,{});else release();
    await expect.poll(async()=>(await request(`/api/tasks/${accepted.task.id}`)).status,{timeout:5000,interval:20}).toBe(mode==='success'?'succeeded':mode==='cancel'?'cancelled':'failed');
    const done=await request(`/api/tasks/${accepted.task.id}/assistant-stream`);
    if(mode==='success'){
      expect(done.settlement).toMatchObject({policy:'flow.assistant-draft',policyVersion:'1',correlation:'presentation-policy',unavailableReason:null,taskId:accepted.task.id,attemptId:before.attemptId,finalMessageId:done.finalMessageId});
      expect(done.settlement.retainStreamIds).toEqual(done.blocks.slice(0,2).map((block:any)=>block.id));expect(done.settlement.replaceStreamIds).toEqual([done.blocks[2].id]);
      expect((await request(`/api/assistant-messages/${done.finalMessageId}`)).content).toBe('Canonical answer replaces draft');
      expect((await request(`/api/tasks/${accepted.task.id}/assistant-stream/${done.blocks[0].id}`)).content).toBe('First explanation');
    }else{expect(done.settlement).toBeNull();expect(done.finalMessageId).toBeNull();expect(done.blocks.at(-1).status).toBe('interrupted');}
    expect(calls).toBe(1);expect(closed).toBe(true);
  }finally{release();stopRunner.abort();await running;await rm(directory,{recursive:true,force:true});}
});

it.each(['before-save','after-save'] as const)('recovers a text outbox after lost acknowledgement %s and center restart',async window=>{
  const directory=await mkdtemp(join(tmpdir(),'flow-chat06-replay-'));
  const firstStop=new AbortController();const secondStop=new AbortController();let firstRun:Promise<void>|undefined;let secondRun:Promise<void>|undefined;
  const runner=await request('/api/runners',{name:'SDK lost ACK',harnesses:['claude'],capacity:1});
  const accepted=await request('/api/tasks',{title:'Lost ACK',prompt:'Synthetic only',harness:'claude'},undefined,202);
  const sessionId=randomUUID();let calls=0;let saved:any;const originalFetch=globalThis.fetch;
  const query:ClaudeQuery=()=>{calls++;return Object.assign((async function*(){
    yield {type:'system',subtype:'init',session_id:sessionId,uuid:randomUUID(),model:'synthetic',tools:[],permissionMode:'dontAsk',mcp_servers:[],plugins:[],skills:[],slash_commands:[],agents:[],apiKeySource:'none',betas:[]} as unknown as SDKMessage;
    for (const event of [{type:'message_start',message:{id:'recover-message',content:[]}},{type:'content_block_start',index:0,content_block:{type:'text',text:''}},{type:'content_block_delta',index:0,delta:{type:'text_delta',text:'DURABLE_TEXT'}}]) yield {type:'stream_event',uuid:randomUUID(),session_id:sessionId,parent_tool_use_id:null,event} as unknown as SDKMessage;
  })(),{close(){}});};
  const adapter=createClaudeAdapter({materialFiles:[],allowRead:false,query});
  const transport=vi.spyOn(globalThis,'fetch').mockImplementation(async(url,init)=>{
    if(!saved&&String(url).endsWith('/api/runner/events')&&typeof init?.body==='string'){
      const batch=JSON.parse(init.body);
      if(batch.events.some((event:any)=>event.type==='assistant-stream')){
        saved=batch;
        if(window==='after-save'){const response=await originalFetch(url,init);expect(response.status).toBe(200);await response.text();}
        throw new Error('Synthetic lost acknowledgement');
      }
    }
    return originalFetch(url,init);
  });
  try{
    firstRun=runRunner({baseUrl:base,token:runner.token,workingDirectory:directory,signal:firstStop.signal,adapters:[adapter],pollIntervalMs:10,onNotice(notice){if(notice.type==='ownership-lost')firstStop.abort();}});
    await expect.poll(()=>Boolean(saved),{timeout:4000,interval:20}).toBe(true);await firstRun;transport.mockRestore();
    const pending=join(directory,sha256(base),sha256(saved.attemptId),'pending-events.json');expect(JSON.parse(await readFile(pending,'utf8'))).toEqual(saved);
    expect((await request(`/api/tasks/${accepted.task.id}/assistant-stream`)).blocks).toHaveLength(window==='after-save'?1:0);
    const port=Number(new URL(base).port);await stop();await start(port);
    secondRun=runRunner({baseUrl:base,token:runner.token,workingDirectory:directory,signal:secondStop.signal,adapters:[adapter],pollIntervalMs:10});
    await expect.poll(async()=>{try{await access(pending);return false;}catch{return true;}},{timeout:2000,interval:20}).toBe(true);
    secondStop.abort();await secondRun;
    const list=await request(`/api/tasks/${accepted.task.id}/assistant-stream`);expect(list.blocks).toHaveLength(1);expect(calls).toBe(1);
    expect(list.blocks[0]).toMatchObject({firstSequence:saved.events[0].sequence,attemptId:saved.attemptId});
    expect(await request(`/api/tasks/${accepted.task.id}/assistant-stream/${list.blocks[0].id}`)).toMatchObject({content:'DURABLE_TEXT'});
  }finally{firstStop.abort();secondStop.abort();transport.mockRestore();await Promise.allSettled([firstRun,secondRun]);await rm(directory,{recursive:true,force:true});}
});

function finalEvent(a:Attempt,sequence:number){
  const uuid=randomUUID();return {type:'assistant-final',id:randomUUID(),sequence,messageId:sha256(JSON.stringify([a.sessionId,uuid])),nativeSessionId:a.sessionId,source:'claude.sdk.result',sourceMessageId:uuid,content:'Canonical final',settings:{requested:{model:'synthetic',permissionMode:'dontAsk',thinking:'disabled'},effective:{model:'synthetic',permissionMode:'dontAsk',tools:[],thinking:'unknown'}}};
}
it('settles no-tool drafts once in the final transaction and never appends or accepts later patches',async()=>{
  const a=await attempt();const patch={...patches(a,'Draft')[0]!,phase:'block-complete'};const final=finalEvent(a,3);
  await post(a,[a.session,patch,final]);const settled=await page(a);
  expect(settled.settlement).toMatchObject({correlation:'presentation-policy',replaceStreamIds:[patch.streamId],retainStreamIds:[]});
  expect(await post(a,[a.session,patch,final])).toMatchObject({accepted:0,lastSequence:3});
  expect((await pool.query('SELECT count(*)::int AS count FROM flow.assistant_stream_settlements WHERE attempt_id=$1',[a.ownership.attemptId])).rows[0].count).toBe(1);
  const content=await request(`/api/tasks/${a.taskId}/assistant-stream/${patch.streamId}`);expect(content.content).toBe('Draft');
  await post(a,[{...patch,id:randomUUID(),sequence:4,revision:2,fromBytes:5,text:'late',prefixDigest:sha256('Draftlate')}],409);
});
it('does not invent a replacement mapping for source-gap or aborted text; final still remains readable',async()=>{
  const a=await attempt();const patch={...patches(a,'Partial')[0]!,phase:'incomplete',reason:'aborted'};const final=finalEvent(a,3);
  await post(a,[a.session,patch,final]);const list=await page(a);
  expect(list.settlement).toMatchObject({correlation:'unavailable',unavailableReason:'incomplete-stream',replaceStreamIds:[],retainStreamIds:[patch.streamId]});
  expect((await request(`/api/assistant-messages/${final.messageId}`)).content).toBe('Canonical final');
});
it('rejects over-limit durable bytes and preserves its acknowledged prefix',async()=>{
  const a=await attempt();const body='x'.repeat(1048576);const events=patches(a,body);expect(events).toHaveLength(128);
  await post(a,[a.session]);for(let index=0;index<events.length;index+=40)await post(a,events.slice(index,index+40));
  const last=events.at(-1)!;
  await post(a,[{...last,id:randomUUID(),sequence:last.sequence+1,revision:last.revision+1,fromBytes:1048576,text:'extra',prefixDigest:sha256(body+'extra')}],409);
  expect((await page(a)).blocks[0].bytes).toBe(1048576);
});
it('keeps final and settlement atomic when a forged tool boundary lacks supporting native input',async()=>{
  const a=await attempt();const patch={...patches(a,'Before')[0]!,phase:'block-complete'};
  const source=randomUUID(),tool='not-observed';const marker={type:'assistant-stream-marker',id:randomUUID(),sequence:3,markerId:sha256(JSON.stringify([a.sessionId,source,'tool-boundary',tool,null])),nativeSessionId:a.sessionId,sourceMessageId:source,kind:'tool-boundary',toolUseId:tool,reason:null};
  const final=finalEvent(a,4);await post(a,[a.session,patch,marker,final]);
  expect((await page(a)).settlement).toMatchObject({correlation:'unavailable',unavailableReason:'missing-tool-evidence',replaceStreamIds:[],retainStreamIds:[patch.streamId]});
});
it('detects a text block crossing an ordered tool boundary instead of guessing a replacement set',async()=>{
  const a=await attempt(),first=patches(a,'before')[0]!;const tool='crossing-tool',source=randomUUID();
  const marker={type:'assistant-stream-marker',id:randomUUID(),sequence:3,markerId:sha256(JSON.stringify([a.sessionId,source,'tool-boundary',tool,null])),nativeSessionId:a.sessionId,sourceMessageId:source,kind:'tool-boundary',toolUseId:tool,reason:null};
  const native=mapNativeActivity({type:'assistant',uuid:randomUUID(),session_id:a.sessionId,parent_tool_use_id:null,message:{id:'tool-cross',content:[{type:'tool_use',id:tool,name:'Read',input:{}}]}} as unknown as SDKMessage,a.sessionId)[0]!;
  const later={...first,id:randomUUID(),sequence:5,revision:2,fromBytes:6,text:'after',prefixDigest:sha256('beforeafter'),phase:'block-complete'};
  await post(a,[a.session,first,marker,{...native,id:randomUUID(),sequence:4},later,finalEvent(a,6)]);
  expect((await page(a)).settlement).toMatchObject({correlation:'unavailable',unavailableReason:'crossed-tool-boundary',replaceStreamIds:[],retainStreamIds:[first.streamId]});
});
it('rolls back all preceding text and final facts when a marker identity fails in their batch',async()=>{
  const a=await attempt(),patch=patches(a)[0]!;
  const marker={type:'assistant-stream-marker',id:randomUUID(),sequence:3,markerId:'0'.repeat(64),nativeSessionId:a.sessionId,sourceMessageId:randomUUID(),kind:'unavailable',toolUseId:null,reason:'source-gap'};
  await post(a,[a.session,patch,marker,finalEvent(a,4)],409);
  expect((await page(a)).blocks).toEqual([]);expect((await request(`/api/tasks/${a.taskId}/assistant-messages`)).messages).toEqual([]);
});
it('refuses corrupted persisted patch data through the active incremental read route',async()=>{
  const a=await attempt();const patch=patches(a,'original')[0]!;await post(a,[a.session,patch]);
  await pool.query("UPDATE flow.assistant_stream_patches SET data=jsonb_set(data,'{text}',to_jsonb('tampered'::text)) WHERE stream_id=$1",[patch.streamId]);
  await request(`/api/tasks/${a.taskId}/assistant-stream/patches?attemptId=${a.ownership.attemptId}`,undefined,undefined,409);
});
