import { createHash, randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { taskSubmissionSchema, type NativeActivityBodyInput } from '@flow/contracts';
import { runRunner } from '../../../runner/src/runtime.js';
import { bodyFixture } from './fixture.js';

let fixture: Awaited<ReturnType<typeof bodyFixture>>;
beforeAll(async () => {
  const evidencePath=process.env.FLOW_CHAT05P02_PG_EVIDENCE;
  if(!evidencePath)throw new Error('Explicit P02 run evidence is required.');
  fixture=await bodyFixture({mode:'production',evidencePath});
});
afterAll(async () => {if(fixture)await fixture.close();});
function material(content: Buffer, sessionId: string): NativeActivityBodyInput {
  const prefix=content.subarray(0,65536).toString(),sha256=createHash('sha256').update(content).digest('hex');
  return{content,activity:{type:'native-activity',activityId:createHash('sha256').update(sessionId).digest('hex'),nativeSessionId:sessionId,
    source:'claude.sdk.message',sourceMessageId:randomUUID(),nativeMessageId:null,blockIndex:0,parentToolUseId:null,kind:'tool',phase:'input-ready',toolUseId:'tool',toolName:'Read',
    body:{content:prefix,originalBytes:content.length,sha256,truncated:content.length>Buffer.byteLength(prefix),mediaType:'text/plain'}}};
}

it('mounts 033 and authenticated public reads from the actual factory without a test route fallback',async()=>{
  expect((await fixture.pool.query('SELECT version FROM flow.migrations WHERE version=33')).rows).toEqual([{version:33}]);
  const a=await fixture.prepareAttempt(),owner=fixture.owner(),runner=fixture.runner(a.token),input=material(Buffer.from('public legacy prefix'),a.sessionId);
  expect(await runner.nativeActivityBodySupport()).toMatchObject({protocol:'native-activity-body-v1'});
  await expect(owner.nativeActivityBodySupport()).rejects.toMatchObject({status:403});
  await runner.report({...a.ownership,events:[{id:randomUUID(),sequence:1,type:'session',nativeSessionId:a.sessionId,adapterVersion:'fixture'},
    {...input.activity,id:randomUUID(),sequence:2},{id:randomUUID(),sequence:3,type:'completed',outcome:'succeeded'}]});
  const path=`/api/tasks/${a.taskId}/native-activities/${input.activity.activityId}/body`;
  expect(await owner.nativeActivityBody(a.taskId,input.activity.activityId)).toMatchObject({state:'legacy',bytes:null});
  await expect(runner.nativeActivityBody(a.taskId,input.activity.activityId)).rejects.toMatchObject({status:403});
  await expect(owner.nativeActivityBody('other-task',input.activity.activityId)).rejects.toMatchObject({status:404});
  await fixture.http(path,'',401);
  const cookie=await fixture.browserCookie();
  for(const [suffix,status] of [[path,200],[path.replace(a.taskId,'other-task'),404],['/api/runner/native-activity-body-support',403]] as const) {
    const response=await fetch(fixture.baseUrl()+suffix,{headers:{cookie,origin:fixture.baseUrl()},signal:AbortSignal.timeout(3000)});
    try {expect(response.status).toBe(status);if(status===200)expect(await response.json()).toMatchObject({state:'legacy'});}
    finally{await response.body?.cancel();}
  }
  const light=await owner.nativeActivities(a.taskId);
  expect(JSON.stringify(light)).not.toContain('public legacy prefix');
  expect(light.activities[0]).not.toHaveProperty('body');
  await fixture.restart();
  expect((await fixture.pool.query('SELECT version FROM flow.migrations WHERE version=33')).rows).toEqual([{version:33}]);
  expect(await fixture.owner().nativeActivityBody(a.taskId,input.activity.activityId)).toMatchObject({state:'legacy',bytes:null});
  fixture.facts.productionAuthorization={factoryOnly:true,roles:['owner','browser','runner','unauthenticated'],crossTask404:true,legacyUnchanged:true};
});

it('uses real runRunner confirmation, outbox and FlowClient paging for over 2MiB public material',async()=>{
  const owner=fixture.owner(),registration=await owner.registerRunner({name:'CHAT05P02 no-provider',harnesses:['fixture'],capacity:1});
  const accepted=await owner.submit(taskSubmissionSchema.parse({title:'Full public material',prompt:'No provider',harness:'fixture'}),randomUUID());
  await fixture.pool.query('UPDATE flow.tasks SET dispatch_ready=true WHERE id=$1',[accepted.task.id]);
  const content=Buffer.from('x'.repeat(65535)+'🌱'+'公开材料'.repeat(180000)),input=material(content,randomUUID());
  // This direct material is SDK-public UTF8, not the provider HTTP stream or hidden reasoning.
  input.activity.body!.content=content.subarray(0,65535).toString();
  expect(content.length).toBeGreaterThan(2*1024*1024);
  const stop=new AbortController();let calls=0;
  const running=runRunner({baseUrl:fixture.baseUrl(),token:registration.token,workingDirectory:fixture.directory,signal:stop.signal,
    nativeActivityBodies:true,pollIntervalMs:20,requestTimeoutMs:5000,adapters:[{name:'fixture',version:'public-material',async run(context){
      calls++;expect(context.activityBodies).toBeDefined();await context.emit({type:'session',nativeSessionId:input.activity.nativeSessionId,adapterVersion:'fixture'});
      await context.activityBodies!.publish(input);
    }}]});
  void running.catch(()=>undefined);
  try{
    const deadline=performance.now()+30000;let state='';
    while(performance.now()<deadline){state=(await owner.show(accepted.task.id)).status;if(state==='succeeded'||state==='failed'||state==='uncertain')break;await delay(20);}
    expect(state).toBe('succeeded');expect(calls).toBe(1);
  }finally{stop.abort();await running;}
  const descriptor=await owner.nativeActivityBody(accepted.task.id,input.activity.activityId),reader=owner.nativeActivityBodyPages(descriptor);
  const chunks:Uint8Array[]=[];let requests=0;
  try{
    for(;;){const page=await reader.readNext();requests++;chunks.push(...page.chunks);if(!page.hasMore){expect(page.integrity).toBe('complete');break;}expect(requests).toBeLessThan(40);}
    expect(Buffer.concat(chunks).equals(content)).toBe(true);expect(reader.completeText()).toBe(content.toString());
  }finally{reader.close();}
  expect((await fixture.pool.query('SELECT complete,bytes FROM flow.native_activity_bodies WHERE activity_id=$1',[input.activity.activityId])).rows).toEqual([{complete:true,bytes:content.length}]);
  const light=JSON.stringify(await owner.nativeActivities(accepted.task.id));expect(light).not.toContain('公开材料');expect(light).not.toContain('base64');
  fixture.facts.realHost={adapterCalls:calls,providerCalls:0,materialBytes:content.length,pageRequests:requests,completeBytesEqual:true,defaultEnablement:false};
});
