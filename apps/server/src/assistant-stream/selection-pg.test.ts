import {randomUUID} from 'node:crypto';
import {afterAll,beforeAll,expect,it} from 'vitest';
import type {AssistantStreamData,RunnerEventData} from '../../../../packages/contracts/src/index.js';
import type {CodexExecutionProfileConfiguration} from '../../../../packages/contracts/src/execution-profiles.js';
import {assistantStreamIdentity} from '../../../../packages/contracts/src/assistant-stream.js';
import {FlowClient} from '../../../../packages/client/src/index.js';
import {ContinuityCenterFixture} from '../../../../docs/evidence/mature02c02/pg-fixture.js';
import {CodexAssistantStream} from '../../../runner/src/native-harness/codex/stream.js';
import {sha256} from '../database.js';

// This file is excluded from all pure configs. Its existing fixture requires an explicit PG window.
const center=new ContinuityCenterFixture();
const headers={'X-Flow-Assistant-Stream':'patch-select-v1'};
const profile:CodexExecutionProfileConfiguration={harness:'codex',adapterVersion:'codex-app-server-0.154.0-v1',model:'fixture-model',reasoningEffort:null,serviceTier:null,serviceTierForTurn:'default',access:'none',approvalPolicy:'never',sandboxMode:'read-only',hostLimits:{wallTimeMs:5000,maxOutputBytes:16384}};
beforeAll(()=>center.preserve('setup',()=>center.start()),30000);
afterAll(()=>center.close(),75000);
const check=(name:string,body:()=>Promise<void>)=>it(name,()=>center.preserve(name,body),40000);
async function assigned(harness:'claude'|'codex') {
 const registration=await center.owner.registerRunner({name:'Lazy read fixture',harnesses:[harness],capacity:1});
 const client=new FlowClient({baseUrl:center.baseUrl,token:registration.token});
 const pin=harness==='codex'?(await client.publishNativeExecutionProfile({configuration:profile})).profile.reference:undefined;
 const accepted=await center.owner.submit({title:'Lazy read',prompt:'Public fixture only',harness,...(pin?{executionProfile:pin}:{})},randomUUID());
 await center.pool.query('UPDATE flow.tasks SET dispatch_ready=true WHERE id=$1',[accepted.task.id]);
 const assignment=(await client.claim()).assignment!;expect(assignment.task.id).toBe(accepted.task.id);
 const ownership={attemptId:assignment.attempt.id,ownerVersion:assignment.attempt.ownerVersion};let sequence=0;
 async function emit(data:RunnerEventData){const event={...data,id:randomUUID(),sequence:sequence+1};expect((await client.report({...ownership,events:[event]})).lastSequence).toBe(event.sequence);sequence=event.sequence;return sequence;}
 return {client,token:registration.token,taskId:accepted.task.id,ownership,emit};
}
check('keeps default HTTP bodies text-only across reasoning gaps, late-open increments, fences and final settlement',async()=>{
 const a=await assigned('codex'),thread=randomUUID(),stream=new CodexAssistantStream(()=>1000);
 const root=`/api/tasks/${a.taskId}/assistant-stream`,patches=`${root}/patches?attemptId=${a.ownership.attemptId}`;
 const get=(suffix='',h=headers)=>center.json(root+suffix,{headers:h});
 const selected=(after:number,limit=8,selection='text')=>center.json(`${patches}&after=${after}&limit=${limit}&selection=${selection}`,{headers});
 const reason='REASONING_ONLY_独🙂',text='正文🙂';
 await a.emit({type:'session',nativeSessionId:thread,adapterVersion:profile.adapterVersion});
 const delta=(kind:'text'|'reasoning-text',value:string,completedText?:string)=>({kind,threadId:thread,turnId:'turn',itemId:kind==='text'?'answer':'reason',index:null,delta:value,...(completedText!==undefined?{completedText}:{})});
 const reasonFirst=stream.accept(delta('reasoning-text',reason))[0]!;await a.emit(reasonFirst);
 const implicit=await center.json(patches,{headers});expect(implicit.value.patches).toEqual([]);expect(implicit.value.selection).toEqual({kind:'text'});
 const idle=await selected(0);expect(idle.status).toBe(200);expect(idle.value).toMatchObject({protocol:'patch-select-v1',selection:{kind:'text'},patches:[],nextCursor:0,hasMore:false});
 const bodyFirst=stream.accept(delta('text',text))[0]!;const textSequence=await a.emit(bodyFirst);
 // Complete this public reasoning block only after taking the initial snapshot.
 const initial=await get(`/${reasonFirst.streamId}`);expect(initial.value.content).toBe(reason);expect(initial.value.bytes).toBe(Buffer.byteLength(reason));
 const more='续🧠';stream.accept(delta('reasoning-text',more));
 for(const patch of stream.accept(delta('reasoning-text','',reason+more)))await a.emit(patch);
 const bodySecond=stream.accept(delta('text','',text))[0]!;const finalTextSequence=await a.emit(bodySecond);
 const page=await get();expect(page.value.protocol).toBe('patch-select-v1');expect(page.value.blocks).toHaveLength(2);expect(JSON.stringify(page.value)).not.toContain(reason);
 const first=await selected(0,1),second=await selected(first.value.nextCursor,1);
 expect(first.value.patches.map((p:AssistantStreamData)=>p.channel)).toEqual(['text']);expect(first.value.nextCursor).toBe(textSequence);expect(first.value.hasMore).toBe(true);
 expect(second.value.nextCursor).toBe(finalTextSequence);expect(second.value.hasMore).toBe(false);
 const metadataFirst=await get('?limit=1'),metadataNext=await get('?limit=1&after='+metadataFirst.value.nextCursor);expect(metadataFirst.value.protocol).toBe('patch-select-v1');expect(metadataNext.value.protocol).toBe('patch-select-v1');expect(metadataNext.value.nextCursor).toBeNull();
 const defaults=[implicit.value,idle.value,page.value,metadataFirst.value,metadataNext.value,first.value,second.value];
 const defaultReasoningBodyBytes=defaults.reduce((sum,value)=>sum+(value.patches??[]).filter((p:AssistantStreamData)=>p.source==='codex.app-server.stream'&&p.channel!=='text').reduce((n:number,p:AssistantStreamData)=>n+Buffer.byteLength(p.text),0),0);
 expect(defaultReasoningBodyBytes).toBe(0);expect(JSON.stringify(defaults)).not.toContain(reason);
 const opened=await selected(initial.value.lastSequence,8,`block&streamId=${reasonFirst.streamId}`);
 expect(opened.value.selection).toEqual({kind:'block',streamId:reasonFirst.streamId});expect(opened.value.patches.map((p:AssistantStreamData)=>p.text).join('')).toBe(more);
 expect(opened.value.patches[0].fromBytes).toBe(Buffer.byteLength(reason));expect(opened.value.patches.at(-1).prefixDigest).toBe(sha256(reason+more));
 const noMore=await selected(opened.value.nextCursor,8,`block&streamId=${reasonFirst.streamId}`);expect(noMore.value.patches).toEqual([]);expect(noMore.value.nextCursor).toBe(opened.value.nextCursor);
 expect((await center.json(`/api/tasks/${randomUUID()}/assistant-stream/${reasonFirst.streamId}`,{headers})).status).toBe(404);
 expect((await center.json(`${root}/patches?attemptId=${randomUUID()}&selection=text`,{headers})).status).toBe(404);
 expect((await fetch(center.baseUrl+root,{headers,signal:AbortSignal.timeout(3000)})).status).toBe(401);
 expect((await fetch(center.baseUrl+root,{headers:{...headers,Authorization:`Bearer ${a.token}`},signal:AbortSignal.timeout(3000)})).status).toBe(403);
 for(const protocol of ['patch-v1','patch-v2','unknown','patch-select-v1, patch-select-v1'])expect((await selectedHeader(protocol)).status).toBe(400);
 async function selectedHeader(protocol:string){return center.json(`${patches}&selection=text`,{headers:{'X-Flow-Assistant-Stream':protocol}});}
 const legacy=await get('/patches?attemptId='+a.ownership.attemptId,{'X-Flow-Assistant-Stream':'patch-v1'});expect(legacy.value.patches).toEqual([]);expect(legacy.value.protocol).toBeUndefined();
 const oldV2=await get('/patches?attemptId='+a.ownership.attemptId,{'X-Flow-Assistant-Stream':'patch-v2'});expect(oldV2.value.patches.some((p:AssistantStreamData)=>p.channel==='reasoning-text')).toBe(true);expect(oldV2.value.selection).toBeUndefined();
 const sourceMessageId=sha256(JSON.stringify(['turn','answer'])),source='codex.app-server.agent-message';
 const messageId=sha256(JSON.stringify([source,thread,sourceMessageId]));
 await a.emit({type:'assistant-final',source,nativeSessionId:thread,sourceMessageId,messageId,nativeSourceIdentity:{turnId:'turn',itemId:'answer'},content:text,settings:{requested:{model:profile.model,reasoningEffort:null,serviceTier:null,serviceTierForTurn:'default',access:'none'},observedThreadConfiguration:null,actualExecution:{model:null,reasoningEffort:null,serviceTier:null,tools:null,evidence:'unknown'}}});
 const final=await get();expect(final.value.finalMessageId).toBe(messageId);expect(final.value.settlement).toMatchObject({correlation:'presentation-policy',replaceStreamIds:[bodyFirst.streamId],retainStreamIds:[reasonFirst.streamId]});
 center.facts.selectedRead={defaultReasoningBodyBytes,defaultDecodedJSONBytes:Buffer.byteLength(JSON.stringify(defaults)),firstOpenBytes:initial.value.bytes,incrementalBytes:Buffer.byteLength(more),textSequence,finalTextSequence,reasoningCursor:opened.value.nextCursor,scope:'decoded real HTTP responses; not TCP/WAL/RSS or provider bytes'};
});
check('retains the default Claude public reader envelope and explicit text compatibility',async()=>{
 const a=await assigned('claude'),thread=randomUUID(),nativeMessageId='claude-answer';
 await a.emit({type:'session',nativeSessionId:thread,adapterVersion:'claude-sdk-0.3.290-v2'});
 const data:AssistantStreamData={type:'assistant-stream',source:'claude.sdk.stream',nativeSessionId:thread,nativeMessageId,parentToolUseId:null,sourceMessageId:'fixture-source',blockIndex:0,streamId:'',revision:1,fromBytes:0,text:'旧正文🙂',prefixDigest:sha256('旧正文🙂'),phase:'block-complete',reason:null,truncated:false};data.streamId=sha256(assistantStreamIdentity(data));await a.emit(data);
 const path=`/api/tasks/${a.taskId}/assistant-stream/patches?attemptId=${a.ownership.attemptId}`;
 const legacy=await center.json(path),selected=await center.json(path+'&selection=text',{headers});
 expect(legacy.status).toBe(200);expect(legacy.value.protocol).toBeUndefined();expect(legacy.value.patches[0].text).toBe(data.text);expect(selected.value.patches).toEqual(legacy.value.patches);expect(selected.value.selection).toEqual({kind:'text'});
});
