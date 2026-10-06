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
import { migrateNativeActivities, registerNativeActivityRoutes } from './index.js';
import { migrateConversationContext } from '../conversation-context/index.js';
import { mapNativeActivity } from '../../../runner/src/native-activity/index.js';
const db=`flow_chat05_${randomUUID().replaceAll('-','')}`;
const admin=new Pool({connectionString:'postgresql://flow:flow-local-only@127.0.0.1:55432/postgres',max:1});
const databaseUrl=`postgresql://flow:flow-local-only@127.0.0.1:55432/${db}`;
const pool=new Pool({connectionString:databaseUrl,max:2});
let created=false; let app:Awaited<ReturnType<typeof createServer>>; let base='';
async function start(port=0){
  app=await createServer({databaseUrl,ownerToken:'chat05-owner',leaseMs:300_000,automaticQueueScan:false});
  await migrateConversationContext(pool);
  await migrateNativeActivities(pool);
  if(!app.hasRoute({method:'GET',url:'/api/native-activities/:id'})) registerNativeActivityRoutes(app,pool);
  base=await app.listen({host:'127.0.0.1',port});
}
async function stop(){if(app){app.server.closeAllConnections();await app.close();}}
beforeAll(async()=>{await admin.query(`CREATE DATABASE ${db}`);created=true;await start();});
afterAll(async()=>{try{await stop();}finally{await pool.end();try{if(created)await admin.query(`DROP DATABASE ${db}`);}finally{await admin.end();}}});
async function request(path:string,body?:unknown,token='chat05-owner',status=200){
  const response=await fetch(`${base}${path}`,{method:body===undefined?'GET':'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json','idempotency-key':randomUUID()},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(5000)});
  const json=await response.json();expect(response.status,JSON.stringify(json)).toBe(status);return json;
}
async function attempt(){
  const runner=await request('/api/runners',{name:'CHAT05 fixture',harnesses:['claude'],capacity:1});
  const accepted=await request('/api/tasks',{title:'Activity test',prompt:'Synthetic frames only',harness:'claude'},undefined,202);
  // Make dispatch deterministic without claiming or mutating any shared database.
  await pool.query('UPDATE flow.tasks SET dispatch_ready=true WHERE id=$1',[accepted.task.id]);
  const claim=await request('/api/runner/claim',{},runner.token);
  expect(claim.assignment.task.id).toBe(accepted.task.id);
  const sessionId=randomUUID();
  return {taskId:accepted.task.id,token:runner.token,sessionId,ownership:{attemptId:claim.assignment.attempt.id,ownerVersion:claim.assignment.attempt.ownerVersion},session:{id:randomUUID(),sequence:1,type:'session',nativeSessionId:sessionId,adapterVersion:'claude-sdk-0.3.290-v2'}};
}
type Attempt=Awaited<ReturnType<typeof attempt>>;
function block(a:Attempt,content:unknown[],sequence=2,extra={}){
  return mapNativeActivity({type:'assistant',uuid:randomUUID(),session_id:a.sessionId,parent_tool_use_id:null,message:{id:randomUUID(),content},...extra} as SDKMessage,a.sessionId).map((event,index)=>({...event,id:randomUUID(),sequence:sequence+index}));
}
function result(a:Attempt,toolId:string,sequence:number,extra={}){
  return {...mapNativeActivity({type:'user',uuid:randomUUID(),session_id:a.sessionId,parent_tool_use_id:null,message:{content:[{type:'tool_result',tool_use_id:toolId,content:'SECRET_OUTPUT'}]},...extra} as SDKMessage,a.sessionId)[0]!,id:randomUUID(),sequence};
}
const post=(a:Attempt,events:unknown[],status=200)=>request('/api/runner/events',{...a.ownership,events},a.token,status);
const page=(a:Attempt)=>request(`/api/tasks/${a.taskId}/native-activities`);
it('migrates an existing center idempotently without changing accepted tasks',async()=>{
  const task=await request('/api/tasks',{title:'Preserved pre-activity task',prompt:'No execution',harness:'fixture'},undefined,202);
  await migrateNativeActivities(pool);await migrateNativeActivities(pool);
  expect((await request(`/api/tasks/${task.task.id}`)).status).toBe('queued');
  expect((await request(`/api/tasks/${task.task.id}/native-activities`)).activities).toEqual([]);
  expect((await pool.query('SELECT version FROM flow.migrations WHERE version=20')).rows).toHaveLength(1);
});
it('persists typed light references and lazily reads bounded content through owner HTTP',async()=>{
  const a=await attempt();const events=block(a,[{type:'text',text:'SECRET_TEXT'},{type:'thinking',thinking:'SECRET_THINKING',signature:'NEVER_STORE'},{type:'tool_use',id:'read1',name:'Read',input:{path:'SECRET_INPUT'}}]);
  await post(a,[a.session,...events]);const list=await page(a);expect(list.activities).toHaveLength(3);
  expect(JSON.stringify(list)).not.toMatch(/SECRET|NEVER_STORE|content/);
  expect(list.activities[2]).toMatchObject({phase:'input-ready',status:'input-ready',attemptId:a.ownership.attemptId});
  expect(await request(`/api/native-activities/${events[0]!.activityId}`)).toMatchObject({body:{content:'SECRET_TEXT'}});
  const timeline=await request(`/api/tasks/${a.taskId}/events`);
  expect(timeline.entries.at(-1).reference.activity).toEqual({kind:'native-activity',activityId:events[2]!.activityId});
  await request(`/api/tasks/${a.taskId}/native-activities`,undefined,'',401);
  await request(`/api/native-activities/${events[0]!.activityId}`,undefined,a.token,403);
});
it('keeps input, progress and SDK result distinct and forbids a second terminal result',async()=>{
  const a=await attempt();const input=block(a,[{type:'tool_use',id:'read1',name:'Read',input:{}}]);
  const progress={...mapNativeActivity({type:'tool_progress',uuid:randomUUID(),session_id:a.sessionId,parent_tool_use_id:null,tool_use_id:'read1',tool_name:'Read',elapsed_time_seconds:1} as SDKMessage,a.sessionId)[0],id:randomUUID(),sequence:3};
  await post(a,[a.session,...input,progress]);expect((await page(a)).activities.map((x:any)=>x.status)).toEqual(['running','running']);
  await post(a,[result(a,'read1',4)]);expect((await page(a)).activities.map((x:any)=>x.status)).toEqual(['succeeded','succeeded','succeeded']);
  await post(a,[result(a,'read1',5)],409);
  const late={...progress,sourceMessageId:randomUUID(),id:randomUUID(),sequence:5};
  await post(a,[{...late,activityId:sha256(JSON.stringify([a.sessionId,late.sourceMessageId,0,'tool']))}]);
  expect((await page(a)).activities.map((x:any)=>x.status)).toEqual(['succeeded','succeeded','succeeded','succeeded']);
});
it('deduplicates original transport and repeated native frames, rejects changed payload, and survives restart',async()=>{
  const a=await attempt();const event=block(a,[{type:'text',text:'same'}])[0]!;const batch=[a.session,event];
  await post(a,batch);expect(await post(a,batch)).toMatchObject({accepted:0,lastSequence:2});
  await post(a,[{...event,id:randomUUID(),sequence:3}]);expect((await page(a)).activities).toHaveLength(1);
  await post(a,[{...event,id:randomUUID(),sequence:4,body:null}],409);
  const changedKind={...event,id:randomUUID(),sequence:4,kind:'thinking'};
  await post(a,[{...changedKind,activityId:sha256(JSON.stringify([a.sessionId,event.sourceMessageId,event.blockIndex,'thinking']))}],409);
  const port=Number(new URL(base).port);await stop();await start(port);
  expect((await page(a)).activities).toHaveLength(1);expect(await post(a,batch)).toMatchObject({accepted:0,lastSequence:3});
});
it('rejects cross-session/parent/tool/attempt facts atomically without partial timeline records',async()=>{
  const a=await attempt();const event=block(a,[{type:'text',text:'owned'}])[0]!;
  await post(a,[a.session,{...event,nativeSessionId:'wrong'}],409);expect((await page(a)).activities).toHaveLength(0);
  await post(a,[a.session,...block(a,[{type:'tool_use',id:'parent',name:'Agent',input:{}}])]);
  await post(a,block(a,[{type:'text',text:'child'}],3,{parent_tool_use_id:'missing'}),409);
  await post(a,[result(a,'unseen',3)],409);
  await post(a,block(a,[{type:'tool_use',id:'child',name:'Read',input:{}}],3,{parent_tool_use_id:'parent'}));
  await post(a,[result(a,'child',4)],409);
  await post(a,[result(a,'child',4,{parent_tool_use_id:'parent'})]);
  const b=await attempt();await post(b,[b.session]);
  await post(b,[{...event,id:randomUUID(),sequence:2}],409);
  await request('/api/runner/events',{...a.ownership,ownerVersion:a.ownership.ownerVersion+1,events:[{...event,sequence:4}]},a.token,409);
});
it('reports unfinished tool state as unknown after cancellation and rejects late reports',async()=>{
  const a=await attempt();await post(a,[a.session,...block(a,[{type:'tool_use',id:'pending',name:'Read',input:{}}])]);
  await request(`/api/tasks/${a.taskId}/cancel`,{});
  expect((await page(a)).activities[0].status).toBe('input-ready');
  await post(a,[{type:'completed',outcome:'cancelled',id:randomUUID(),sequence:3}]);
  expect((await page(a)).activities[0]).toMatchObject({phase:'input-ready',status:'unknown'});
  await post(a,[result(a,'pending',4)],409);
});
it('paginates within a task and rejects a cursor from another task',async()=>{
  const a=await attempt();const events=block(a,[{type:'text',text:'one'},{type:'text',text:'two'}]);await post(a,[a.session,...events]);
  const first=await request(`/api/tasks/${a.taskId}/native-activities?limit=1`);expect(first.activities).toHaveLength(1);expect(first.nextCursor).toBe(events[0]!.activityId);
  const next=await request(`/api/tasks/${a.taskId}/native-activities?limit=1&after=${first.nextCursor}`);expect(next.activities[0].id).toBe(events[1]!.activityId);expect(next.nextCursor).toBeNull();
  const b=await attempt();await request(`/api/tasks/${b.taskId}/native-activities?after=${first.nextCursor}`,undefined,undefined,400);
});

it('does not attribute historical same-session observations to a resumed task/attempt',async()=>{
  const a=await attempt();const event=block(a,[{type:'text',text:'old turn'}])[0]!;
  await post(a,[a.session,event,{type:'completed',outcome:'succeeded',id:randomUUID(),sequence:3}]);
  const next=await request('/api/tasks',{title:'Resume',prompt:'Synthetic next turn',harness:'claude',resumeSessionId:a.sessionId},undefined,202);
  await pool.query('UPDATE flow.tasks SET dispatch_ready=true WHERE id=$1',[next.task.id]);
  const claim=await request('/api/runner/claim',{},a.token);expect(claim.assignment.task.id).toBe(next.task.id);
  const ownership={attemptId:claim.assignment.attempt.id,ownerVersion:claim.assignment.attempt.ownerVersion};
  await request('/api/runner/events',{...ownership,events:[{...a.session,id:randomUUID()},{...event,id:randomUUID()}]},a.token,409);
  expect((await request(`/api/tasks/${next.task.id}/native-activities`)).activities).toHaveLength(0);
});
it('protects detail integrity and retains an unresolved tool as unknown on lease loss',async()=>{
  const a=await attempt();const event=block(a,[{type:'tool_use',id:'tool',name:'Read',input:{}}])[0]!;
  await post(a,[a.session,event]);
  await pool.query("UPDATE flow.tasks SET status='uncertain' WHERE id=$1",[a.taskId]);
  expect((await page(a)).activities[0].status).toBe('unknown');
  await pool.query("UPDATE flow.details SET content='tampered' WHERE id=(SELECT detail_id FROM flow.native_activities WHERE id=$1)",[event.activityId]);
  await request(`/api/native-activities/${event.activityId}`,undefined,undefined,409);
});
it.each(['success','cancel'] as const)('connects injected SDK to real runtime/outbox/PG/owner read on %s',async mode=>{
  const directory=await mkdtemp(join(tmpdir(),'flow-chat05-runtime-'));const stop=new AbortController();
  const runner=await request('/api/runners',{name:`SDK ${mode}`,harnesses:['claude'],capacity:1});
  const accepted=await request('/api/tasks',{title:'Native activity closure',prompt:'Synthetic SDK, no provider',harness:'claude'},undefined,202);
  const sessionId=randomUUID();let calls=0;let closed=false;
  const query:ClaudeQuery=({options})=>{calls++;return Object.assign((async function*(){
    yield {type:'system',subtype:'init',session_id:sessionId,uuid:randomUUID(),model:'synthetic',tools:[],permissionMode:'dontAsk',mcp_servers:[],plugins:[],skills:[],slash_commands:[],agents:[],apiKeySource:'none',betas:[]} as unknown as SDKMessage;
    yield {type:'assistant',uuid:randomUUID(),session_id:sessionId,parent_tool_use_id:null,message:{id:randomUUID(),content:[{type:'text',text:'PUBLIC_ACTIVITY'},{type:'tool_use',id:'sdk-tool',name:'Read',input:{synthetic:true}}]}} as SDKMessage;
    if(mode==='cancel'){
      await new Promise<void>(resolve=>{const signal=options!.abortController!.signal;if(signal.aborted)resolve();else signal.addEventListener('abort',()=>resolve(),{once:true});});
      options!.abortController!.signal.throwIfAborted();
    }else{
      yield {type:'user',uuid:randomUUID(),session_id:sessionId,parent_tool_use_id:null,message:{content:[{type:'tool_result',tool_use_id:'sdk-tool',content:'SDK_RESULT'}]}} as SDKMessage;
      yield {type:'result',subtype:'success',is_error:false,uuid:randomUUID(),session_id:sessionId,result:'FINAL_REPLY',modelUsage:{synthetic:{inputTokens:2,outputTokens:3,cacheReadInputTokens:0,cacheCreationInputTokens:0,costUSD:0}},permission_denials:[],total_cost_usd:0} as unknown as SDKMessage;
    }
  })(),{close(){closed=true;}});};
  const running=runRunner({baseUrl:base,token:runner.token,workingDirectory:directory,signal:stop.signal,adapters:[createClaudeAdapter({materialFiles:[],allowRead:false,query})],pollIntervalMs:10,heartbeatIntervalMs:50});
  try{
    await expect.poll(async()=>{const p=await request(`/api/tasks/${accepted.task.id}/native-activities`);return p.activities.length;},{timeout:4000,interval:20}).toBeGreaterThanOrEqual(2);
    if(mode==='cancel')await request(`/api/tasks/${accepted.task.id}/cancel`,{});
    await expect.poll(async()=>(await request(`/api/tasks/${accepted.task.id}`)).status,{timeout:4000,interval:20}).toBe(mode==='cancel'?'cancelled':'succeeded');
    const activities=(await request(`/api/tasks/${accepted.task.id}/native-activities`)).activities;
    expect(activities.find((item:any)=>item.phase==='input-ready').status).toBe(mode==='cancel'?'unknown':'succeeded');
    expect(await request(`/api/native-activities/${activities[0].id}`)).toMatchObject({body:{content:'PUBLIC_ACTIVITY'}});
    const finals=await request(`/api/tasks/${accepted.task.id}/assistant-messages`);
    expect(finals.messages).toHaveLength(mode==='cancel'?0:1);
    if(mode==='success')expect(await request(`/api/assistant-messages/${finals.messages[0].id}`)).toMatchObject({content:'FINAL_REPLY'});
    expect(calls).toBe(1);expect(closed).toBe(true);
  }finally{stop.abort();await running;await rm(directory,{recursive:true,force:true});}
});

it.each(['before-save','after-save'] as const)('recovers an activity outbox after lost acknowledgement %s and center restart',async window=>{
  const directory=await mkdtemp(join(tmpdir(),'flow-chat05-replay-'));
  const firstStop=new AbortController();const secondStop=new AbortController();let firstRun:Promise<void>|undefined;let secondRun:Promise<void>|undefined;
  const runner=await request('/api/runners',{name:'SDK lost ACK',harnesses:['claude'],capacity:1});
  const accepted=await request('/api/tasks',{title:'Lost ACK',prompt:'Synthetic only',harness:'claude'},undefined,202);
  const sessionId=randomUUID();let calls=0;let saved:any;const originalFetch=globalThis.fetch;
  const query:ClaudeQuery=()=>{calls++;return Object.assign((async function*(){
    yield {type:'system',subtype:'init',session_id:sessionId,uuid:randomUUID(),model:'synthetic',tools:[],permissionMode:'dontAsk',mcp_servers:[],plugins:[],skills:[],slash_commands:[],agents:[],apiKeySource:'none',betas:[]} as unknown as SDKMessage;
    yield {type:'assistant',uuid:randomUUID(),session_id:sessionId,parent_tool_use_id:null,message:{id:randomUUID(),content:[{type:'text',text:'DURABLE_ACTIVITY'}]}} as SDKMessage;
  })(),{close(){}});};
  const adapter=createClaudeAdapter({materialFiles:[],allowRead:false,query});
  const transport=vi.spyOn(globalThis,'fetch').mockImplementation(async(url,init)=>{
    if(!saved&&String(url).endsWith('/api/runner/events')&&typeof init?.body==='string'){
      const batch=JSON.parse(init.body);
      if(batch.events.some((event:any)=>event.type==='native-activity')){
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
    expect((await request(`/api/tasks/${accepted.task.id}/native-activities`)).activities).toHaveLength(window==='after-save'?1:0);
    const port=Number(new URL(base).port);await stop();await start(port);
    secondRun=runRunner({baseUrl:base,token:runner.token,workingDirectory:directory,signal:secondStop.signal,adapters:[adapter],pollIntervalMs:10});
    await expect.poll(async()=>{try{await access(pending);return false;}catch{return true;}},{timeout:2000,interval:20}).toBe(true);
    secondStop.abort();await secondRun;
    const list=await request(`/api/tasks/${accepted.task.id}/native-activities`);expect(list.activities).toHaveLength(1);expect(calls).toBe(1);
    expect(list.activities[0]).toMatchObject({eventId:saved.events[0].id,sequence:saved.events[0].sequence,attemptId:saved.attemptId});
    expect(await request(`/api/native-activities/${list.activities[0].id}`)).toMatchObject({body:{content:'DURABLE_ACTIVITY'}});
  }finally{firstStop.abort();secondStop.abort();transport.mockRestore();await Promise.allSettled([firstRun,secondRun]);await rm(directory,{recursive:true,force:true});}
});
