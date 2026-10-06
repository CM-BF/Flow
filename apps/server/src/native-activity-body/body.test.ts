import { randomUUID } from 'node:crypto';
import { mkdir,readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterAll,beforeAll,expect,it } from 'vitest';
import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import type { EventBatch,RunnerEvent,NativeActivityPage,NativeActivity } from '@flow/contracts';
import type { NativeActivityBodyDescriptor,NativeActivityBodyPage } from '../../../../packages/contracts/src/native-activity-body.js';
import { bodyBatches,bodyDigest,planBody } from '../../../runner/src/native-activity-body/plan.js';
import { nativeActivityObservations,mapNativeActivity } from '../../../runner/src/native-activity/index.js';
import { EventOutbox,replayPending,reportBatch } from '../../../runner/src/outbox.js';
import { migrateNativeActivityBodies } from './index.js';
import { bodyFixture } from './fixture.js';
let fixture:Awaited<ReturnType<typeof bodyFixture>>;
beforeAll(async()=>{fixture=await bodyFixture();});
afterAll(async()=>{if(fixture)await fixture.close();});
type Attempt=Awaited<ReturnType<typeof fixture.prepareAttempt>>;
function material(a:Attempt,text:string,kind:'input'|'result'='input') {
  const content=kind==='input'?[{type:'tool_use',id:'tool1',name:'Read',input:{text}}]:[{type:'tool_result',tool_use_id:'tool1',content:text}];
  const frame={type:kind==='input'?'assistant':'user',uuid:randomUUID(),session_id:a.sessionId,parent_tool_use_id:null,message:{id:randomUUID(),content}} as SDKMessage;
  return [...nativeActivityObservations(frame,a.sessionId,true)][0]!.material!;
}
const url=(a:Attempt,id:string)=>`/api/tasks/${a.taskId}/native-activities/${id}/body`;
function session(a:Attempt):RunnerEvent {return{type:'session',nativeSessionId:a.sessionId,adapterVersion:'synthetic-body-contract',sequence:1,id:randomUUID()};}
const report=(a:Attempt,batch:EventBatch)=>reportBatch(fixture.runner(a.token),batch,AbortSignal.timeout(5000));
async function newAttempt() {const a=await fixture.prepareAttempt();await report(a,{...a.ownership,events:[session(a)]});return a;}
it('recovers >2MiB input after an admitted lost ACK and restart, then pages all input/result bytes with no eager body',async()=>{
  const a=await newAttempt(),input=material(a,'公开材料'.repeat(180_000)),root=join(fixture.directory,'outbox');await mkdir(root);
  const directory=join(root,bodyDigest(Buffer.from(a.ownership.attemptId)));await mkdir(directory);
  const outbox=new EventOutbox(directory,a.ownership,batch=>report(a,batch),1);
  expect(input.content.length).toBeGreaterThan(2*1024*1024);fixture.loseReply();
  await expect(outbox.publishActivityBody(input)).rejects.toThrow();
  const pending=JSON.parse(await readFile(join(directory,'pending-events.json'),'utf8')) as EventBatch;
  expect((await fixture.pool.query('SELECT last_sequence FROM flow.attempts WHERE id=$1',[a.ownership.attemptId])).rows[0].last_sequence).toBe(pending.events.at(-1)!.sequence);
  const light=(await fixture.http<NativeActivityPage>(`/api/tasks/${a.taskId}/native-activities`)).value;
  expect(JSON.stringify(light)).not.toContain('公开材料');
  expect((await fixture.http<NativeActivityBodyDescriptor>(url(a,input.activity.activityId))).value.state).toBe('receiving');
  await fixture.restart();await replayPending(root,batch=>report(a,batch),()=>{throw new Error('Unexpected retained fence');});
  const end=(await fixture.pool.query<{last_sequence:number}>('SELECT last_sequence FROM flow.attempts WHERE id=$1',[a.ownership.attemptId])).rows[0]!.last_sequence;
  const recovered=new EventOutbox(directory,a.ownership,batch=>report(a,batch),end),result=material(a,'工具结果'.repeat(6000),'result');
  await recovered.publishActivityBody(result);
  let requests=0,wireBytes=0;
  for(const original of [input,result]) {
    const descriptor=(await fixture.http<NativeActivityBodyDescriptor>(url(a,original.activity.activityId))).value;
    expect(descriptor).toMatchObject({state:'complete',bytes:original.content.length,sha256:bodyDigest(original.content)});
    const bytes:Buffer[]=[];let afterIndex=0;
    do {
      const page=await fixture.http<NativeActivityBodyPage>(url(a,original.activity.activityId)+`/chunks?afterIndex=${afterIndex}&limit=4`);requests++;wireBytes+=page.bytes;
      expect(page.value.chunks.length).toBeLessThanOrEqual(4);
      for(const chunk of page.value.chunks) {const content=Buffer.from(chunk.base64,'base64');expect(bodyDigest(content)).toBe(chunk.sha256);bytes.push(content);}
      expect(page.value.nextIndex).toBeGreaterThan(afterIndex);afterIndex=page.value.nextIndex;if(!page.value.hasMore)break;
    }while(requests<40);
    expect(Buffer.concat(bytes).equals(Buffer.from(original.content))).toBe(true);
  }
  await fixture.http(url(a,input.activity.activityId),'',401);await fixture.http(url(a,input.activity.activityId),a.token,403);
  await fixture.http(`/api/tasks/not-this-task/native-activities/${input.activity.activityId}/body`,undefined,404);
  await fixture.http(url(a,input.activity.activityId)+'/chunks?limit=5',undefined,400);
  await recovered.emit({type:'completed',outcome:'succeeded'});
  fixture.facts.largeMaterial={inputBytes:input.content.length,resultBytes:result.content.length,pageRequests:requests,pageWireBytes:wireBytes,originalPendingEvents:pending.events.length,scope:'JSON wire and decoded body bytes; not PG/WAL/storage physical bytes'};
});
it('rejects conflicting chunks atomically, blocks successful finalization, and retains incomplete material after cancellation',async()=>{
  const a=await newAttempt(),input=material(a,'x'.repeat(90_000)),job=planBody(input,a.ownership,2),events=[...bodyBatches(job,input.content)].flatMap(batch=>batch.events);
  await report(a,{...a.ownership,events:events.slice(0,2)});
  const first=events[2]!;if(first.type!=='native-activity-body'||first.action!=='chunk')throw new Error('Expected chunk');
  await expect(report(a,{...a.ownership,events:[{...first,offset:1}]})).rejects.toMatchObject({status:409});
  expect((await fixture.pool.query('SELECT received_bytes FROM flow.native_activity_bodies WHERE activity_id=$1',[input.activity.activityId])).rows[0].received_bytes).toBe(0);
  await expect(report(a,{...a.ownership,events:[{type:'completed',outcome:'succeeded',id:randomUUID(),sequence:first.sequence}]})).rejects.toMatchObject({status:409,code:'activity_body_incomplete'});
  await report(a,{...a.ownership,events:[first]});
  await expect(report(a,{...a.ownership,ownerVersion:a.ownership.ownerVersion+1,events:[events[3]!]})).rejects.toMatchObject({status:409});
  await report(a,{...a.ownership,events:[{type:'completed',outcome:'cancelled',id:randomUUID(),sequence:first.sequence+1}]});
  expect((await fixture.http<NativeActivityBodyDescriptor>(url(a,input.activity.activityId))).value).toMatchObject({state:'interrupted',receivedBytes:65536});
  await expect(report(a,{...a.ownership,events:[{...events[3]!,id:randomUUID(),sequence:first.sequence+2}]})).rejects.toMatchObject({status:409});
  await fixture.pool.query("UPDATE flow.native_activity_body_chunks SET content=decode(repeat('00',bytes),'hex') WHERE activity_id=$1",[input.activity.activityId]);
  await fixture.http(url(a,input.activity.activityId)+'/chunks',undefined,409);
  fixture.facts.interruptedAndConflict=true;
});
it('keeps legacy prefixes honest and reruns migration without rewriting old activity detail',async()=>{
  const a=await newAttempt(),frame={type:'assistant',uuid:randomUUID(),session_id:a.sessionId,parent_tool_use_id:null,message:{id:randomUUID(),content:[{type:'tool_use',id:'legacy',name:'Read',input:{text:'old-prefix'.repeat(9000)}}]}} as SDKMessage;
  const activity=mapNativeActivity(frame,a.sessionId)[0]!;
  await report(a,{...a.ownership,events:[{...activity,id:randomUUID(),sequence:2},{type:'completed',outcome:'succeeded',id:randomUUID(),sequence:3}]});
  const before=(await fixture.http<NativeActivity>(`/api/native-activities/${activity.activityId}`)).value;
  expect(before.body!.truncated).toBe(true);expect((await fixture.http<NativeActivityBodyDescriptor>(url(a,activity.activityId))).value).toMatchObject({state:'legacy',bytes:null,receivedChunks:0});
  await migrateNativeActivityBodies(fixture.pool);await migrateNativeActivityBodies(fixture.pool);
  expect((await fixture.http<NativeActivity>(`/api/native-activities/${activity.activityId}`)).value).toEqual(before);
  expect((await fixture.pool.query('SELECT version FROM flow.migrations WHERE version=33')).rows).toEqual([{version:33}]);
  fixture.facts.legacyUnchanged=true;
});
