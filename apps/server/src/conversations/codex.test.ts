import { expect, it, vi } from 'vitest';
import type { Pool, PoolClient } from 'pg';
import { assertConversationProfile } from './policy.js';
import { conversationList } from './queries.js';
import { sessionEvidences } from './replies.js';
import type { TaskRecord } from '../tasks.js';
import type { NativeExecutionProfile } from '../../../../packages/contracts/src/execution-profiles.js';
import { conversationCreationSchema } from '../../../../packages/contracts/src/conversations.js';
const pin = { id: '00000000-0000-4000-8000-000000000001', runnerId: '00000000-0000-4000-8000-000000000002', configDigest: 'a'.repeat(64) };
const input = conversationCreationSchema.parse({title:'Native',harness:'codex',executionProfile:pin,requested:{model:'runner-default',thinking:'unknown',tools:'none'}});
const profile = { reference:pin,configuration:{harness:'codex',model:'model',sessionPersistence:'host-owned'} } as NativeExecutionProfile;
it('requires matching persistent profiles before conversation creation', () => { expect(() => assertConversationProfile(input,profile)).not.toThrow(); for(const p of [undefined,{...profile,configuration:{...profile.configuration,sessionPersistence:undefined}},{...profile,configuration:{...profile.configuration,harness:'claude'}}]) expect(() => assertConversationProfile(input,p as NativeExecutionProfile)).toThrow(); });
it('keeps Claude defaults and model constraints', () => { expect(() => assertConversationProfile(conversationCreationSchema.parse({title:'old'}))).not.toThrow(); expect(() => assertConversationProfile({...input,requested:{...input.requested,model:'other'}},profile)).toThrow(); });
it.each([false,true])('filters directory eligibility before LIMIT with native=%s', async native => { const query=vi.fn(async(sql:string,args?:unknown[])=> { if(sql.startsWith('SELECT')) {expect(sql).toContain("($3::boolean OR harness='claude')"); expect(sql.indexOf('harness')).toBeLessThan(sql.indexOf('LIMIT')); expect(args).toEqual([null,2,native]);} return {rows:[]};});const release=vi.fn(); await expect(conversationList({connect:async()=>({query,release})} as unknown as Pool,undefined,1,native)).resolves.toEqual({conversations:[],nextCursor:null}); expect(release).toHaveBeenCalledOnce(); });
it('binds batch session rows to task/attempt/owner and harness with per-task LIMIT2', async()=>{ const query=vi.fn(async(sql:string,args:unknown[])=>{expect(sql).toContain('s.harness=request.harness');expect(sql).toContain("kind='session' LIMIT 2");expect(args).toEqual([['t'],['a'],[2],['codex']]);return {rows:[]};}); await expect(sessionEvidences({query} as unknown as PoolClient,[{id:'t',current_attempt_id:'a',owner_version:2,submission:{harness:'codex'}} as TaskRecord])).resolves.toEqual(new Map()); });

import Fastify from 'fastify';
import { registerConversationRoutes } from './index.js';
import type { PgBoss } from 'pg-boss';
import { assistantProjections } from './replies.js';
import { readAssistantFinalPreviews } from '../assistant/index.js';
import { listNativeProfiles } from '../execution-profiles/store.js';
import { createHash } from 'node:crypto';
import { nativeExecutionProfileConfigurationJson, type NativeExecutionProfileConfiguration } from '../../../../packages/contracts/src/execution-profiles.js';
vi.mock('../assistant/index.js', () => ({ readAssistantFinalPreviews: vi.fn() }));

it('guards every direct Codex route including queue and context under a legacy codec', async () => {
 const app=Fastify(); const pool={query:async()=>({rows:[{harness:'codex'}]})} as unknown as Pool;
 registerConversationRoutes(app,pool,{} as PgBoss);
 app.get('/api/conversations/:id/queue',async()=>({allowed:true})); app.get('/api/conversations/:id/contexts/:context',async()=>({allowed:true}));
 app.setErrorHandler((error,_request,reply)=>reply.code((error as {status?:number}).status??500).send({error:{code:(error as {code?:string}).code}}));
 try { for(const url of ['/api/conversations/c/queue','/api/conversations/c/contexts/x','/api/conversations/c/turns/t/details/d']) {const response=await app.inject({url});expect(response.statusCode).toBe(409);expect(response.json().error.code).toBe('conversation_protocol_required');}
 const allowed=await app.inject({url:'/api/conversations/c/queue',headers:{'X-Flow-Conversation':'native-v1'}});expect(allowed.statusCode).toBe(200);
 } finally {await app.close();}
});

const nativeConfig: NativeExecutionProfileConfiguration = {harness:'codex',adapterVersion:'codex-app-server-0.154.0-v1',model:'model',reasoningEffort:null,serviceTier:null,serviceTierForTurn:null,access:'none',approvalPolicy:'never',sandboxMode:'read-only',hostLimits:{wallTimeMs:1000,maxOutputBytes:1024},sessionPersistence:'host-owned'};
it.each(['native-v1','native-v2'] as const)('uses %s eligibility before LIMIT without rewriting the immutable profile', async version => {
 const configuration=nativeConfig;const config_digest=createHash('sha256').update(nativeExecutionProfileConfigurationJson(configuration)).digest('hex');
 const row={id:pin.id,runner_id:pin.runnerId,config_digest,configuration,created_at:new Date('2026-10-07T00:00:00Z')};
 const query=vi.fn(async(sql:string,args?:unknown[])=>{if(sql.startsWith('SELECT')) {expect(sql).toContain("($3::boolean OR NOT (p.configuration ? 'sessionPersistence'))");expect(args).toEqual([null,2,version==='native-v2']);return {rows:version==='native-v2'?[row]:[]};}return{rows:[]};});
 const pool={connect:async()=>({query,release:vi.fn()})} as unknown as Pool;
 if(version==='native-v2'){const page=await listNativeProfiles(pool,undefined,1,version);expect(page.profiles[0]!.profile.configuration).toEqual(configuration);expect(page.profiles[0]!.conversation.state).toBe('native-conversation');}
 else expect((await listNativeProfiles(pool,undefined,1,version)).profiles).toEqual([]);
});
it('validates the native directory sentinel instead of hiding corruption beyond page size', async()=>{
 const configuration=nativeConfig;const row={id:pin.id,runner_id:pin.runnerId,config_digest:createHash('sha256').update(nativeExecutionProfileConfigurationJson(configuration)).digest('hex'),configuration,created_at:new Date()};
 const pool={connect:async()=>({query:async(sql:string)=>({rows:sql.startsWith('SELECT')?[row,{...row,id:pin.runnerId,config_digest:'bad'}]:[]}),release:vi.fn()})} as unknown as Pool;
 await expect(listNativeProfiles(pool,undefined,1,'native-v2')).rejects.toMatchObject({code:'execution_profile_unavailable'});
});
const settings={requested:{model:'model',reasoningEffort:null,serviceTier:null,serviceTierForTurn:null,access:'none' as const},observedThreadConfiguration:null,actualExecution:{model:null,reasoningEffort:null,serviceTier:null,tools:null,evidence:'unknown' as const}};
it.each(['valid','wrong-source','wrong-session','missing','invalid'] as const)('projects Codex typed final %s without a legacy artifact fallback',async kind=>{
 const task={id:'t',current_attempt_id:'a',owner_version:2,status:'succeeded',verification_status:'passed',submission:{harness:'codex'}} as TaskRecord;
 const query=vi.fn(async(sql:string)=>{expect(sql).not.toContain('flow.artifacts');return {rows:[{harness:'codex',task_id:'t',attempt_id:'a',native_session_id:'thread',runner_id:pin.runnerId,active_task_id:null,details:[{id:'session-detail',content:JSON.stringify({id:'session-event',sequence:1,type:'session',nativeSessionId:'thread',adapterVersion:nativeConfig.adapterVersion})}]}]};});
 const preview={source:'codex.app-server.agent-message',id:'message',taskId:'t',attemptId:'a',nativeSessionId:kind==='wrong-session'?'other':'thread',nativeSourceIdentity:{turnId:'turn',itemId:'item'},eventId:'final-event',sourceMessageId:'s',contentDigest:'a'.repeat(64),text:'同一正文🙂',truncated:false,settings,detail:{id:'detail',title:'Final'}};
 if(kind==='wrong-source')preview.source='claude.sdk.result';
 vi.mocked(readAssistantFinalPreviews).mockResolvedValueOnce((kind==='invalid'?[{error:new Error('invalid')}]:[{preview:kind==='missing'?null:preview}]) as unknown as Awaited<ReturnType<typeof readAssistantFinalPreviews>>);
 const [result]=await assistantProjections({query} as unknown as PoolClient,[task]);
 if(kind==='valid'){expect(result!.assistant).toMatchObject({state:'available',text:'同一正文🙂',source:{source:'codex.app-server.agent-message',nativeSourceIdentity:{turnId:'turn',itemId:'item'}}});expect(result!.effective).toMatchObject({model:null,thinking:'unknown',tools:'unknown',codex:settings});expect(result!.effective).not.toHaveProperty('runnerRequested');}
 else expect(result!.assistant).toMatchObject({state:'unavailable',reason:kind==='missing'?'missing-result':'invalid-result'});
});

import { prepareTurnAdmission } from './admission.js';
import type { ConversationRow } from './state.js';
import { registerExecutionProfileRoutes } from '../execution-profiles/index.js';
it.each(['same','other-runner','other-harness','busy','uncertain'] as const)('resumes only the recorded session on the pinned runner: %s',async kind=>{
 const digest=createHash('sha256').update(nativeExecutionProfileConfigurationJson(nativeConfig)).digest('hex');const reference={...pin,configDigest:digest};
 const conversation={id:'c',title:'Native',harness:'codex',requested:input.requested,execution_profile:reference,revision:1} as ConversationRow;
 const task={id:'t',current_attempt_id:'a',owner_version:2,status:kind==='uncertain'?'uncertain':'succeeded',submission:{harness:kind==='other-harness'?'claude':'codex',executionProfile:reference}} as TaskRecord;
 const query=vi.fn(async(sql:string,args:unknown[])=>{
  if(sql.includes('FROM flow.conversation_turns'))return{rows:[{task_id:'t'}]};
  if(sql.includes('FROM flow.tasks'))return{rows:[task]};
  if(sql.includes('FROM flow.attempts'))return{rows:[{harness:'codex',task_id:'t',attempt_id:'a',native_session_id:'thread',runner_id:pin.runnerId,active_task_id:kind==='busy'?'other':null,details:[{id:'d',content:JSON.stringify({id:'e',sequence:1,type:'session',nativeSessionId:'thread',adapterVersion:nativeConfig.adapterVersion})}]}]};
  if(sql.includes('FROM flow.execution_profiles'))return{rows:[{id:pin.id,runner_id:pin.runnerId,config_digest:digest,configuration:nativeConfig,created_at:new Date(),revoked:false}]};
  if(sql.includes('FROM flow.sessions')){expect(args).toEqual(['thread','codex']);return{rows:[{runner_id:kind==='other-runner'?'other':pin.runnerId}]};}
  throw Error('unexpected SQL');
 });
 const action=prepareTurnAdmission({query} as unknown as PoolClient,conversation,'next','follow-up');
 if(kind==='same')await expect(action).resolves.toMatchObject({harness:'codex',resumeSessionId:'thread',executionProfile:reference,prompt:'next'});
 else await expect(action).rejects.toMatchObject({code:kind==='other-runner'?'profile_session_mismatch':kind==='other-harness'?'conversation_resume_unavailable':'conversation_busy'});
});
it('routes only the exact new directory codec to the native-v2 SQL choice',async()=>{
 const app=Fastify();const choices:unknown[]=[];const pool={connect:async()=>({query:async(sql:string,args?:unknown[])=>{if(sql.startsWith('SELECT'))choices.push(args?.[2]);return{rows:[]};},release:vi.fn()})} as unknown as Pool;
 registerExecutionProfileRoutes(app,pool);
 try {const response=await app.inject({url:'/api/execution-profiles',headers:{'X-Flow-Execution-Profile':'native-v2'}});expect(response.statusCode).toBe(200);expect(response.json().protocol).toBe('flow.native-execution-profile-catalog.v2');expect(choices).toEqual([true]);}finally{await app.close();}
});

import { turnViews } from './turn-read.js';
it.each(['codex', 'claude'] as const)('projects legacy session settings only for its matching harness: %s', async harness => {
  const adapterVersion = 'claude-sdk-0.3.290-v1';
  const task = { id: 't', current_attempt_id: 'a', owner_version: 2, status: 'succeeded', verification_status: 'passed', submission: { harness } } as TaskRecord;
  const query = vi.fn(async (sql: string) => {
    if (sql.includes('flow.artifacts')) {
      expect(harness).toBe('claude');
      return { rows: [] };
    }
    return { rows: [{ harness, task_id: 't', attempt_id: 'a', native_session_id: 'thread', runner_id: pin.runnerId, active_task_id: null,
      details: [{ id: 'session-detail', content: JSON.stringify({ id: 'session-event', sequence: 1, type: 'session', nativeSessionId: 'thread', adapterVersion, resources: ['model:recorded-model'] }) }] }] };
  });
  const previews = vi.mocked(readAssistantFinalPreviews).mockReset();
  previews.mockResolvedValue(harness === 'claude' ? [{ preview: null }] : []);
  const client = { query } as unknown as PoolClient;
  const [projection] = await assistantProjections(client, [task]);
  if (harness === 'codex') {
    expect(projection).toEqual({ assistant: { state: 'unavailable', reason: 'unknown-adapter' }, effective: { model: null, thinking: 'unknown', tools: 'unknown', source: null } });
    expect(previews).toHaveBeenCalledWith(client, []);
    expect(query).toHaveBeenCalledTimes(1);
  } else {
    expect(projection).toEqual({ assistant: { state: 'unavailable', reason: 'missing-result' }, effective: { model: 'recorded-model', thinking: 'disabled', tools: 'configured-readonly', source: { kind: 'recorded-adapter-session', adapterVersion, taskId: 't', attemptId: 'a', detailId: 'session-detail' } } });
    expect(previews).toHaveBeenCalledWith(client, [{ taskId: 't', attemptId: 'a' }]);
    expect(query).toHaveBeenCalledTimes(2);
  }
});

it('rejects a foreign-harness task before any batch detail/context reads',async()=>{
 const query=vi.fn(async()=>({rows:[{id:'task',submission:{harness:'claude'}}]}));
 await expect(turnViews({query} as unknown as PoolClient,[{id:'turn',task_id:'task',conversation_id:'conversation',number:1,user_text:'text',created_at:new Date()}],'codex')).rejects.toMatchObject({code:'conversation_task_mismatch'});
 expect(query).toHaveBeenCalledTimes(1);
});
