import { afterEach, expect, it, vi } from 'vitest';
import { FlowClient } from '@flow/client';
import type { ClaimedTask, HarnessContext, RunnerEventData, HeartbeatResponse } from '@flow/contracts';
import { AttemptControl } from './attempt-control.js';
import { createCodexAdapter } from './native-harness/codex/adapter.js';
import type { CodexTransport, Inbound, Json } from './codex/types.js';

const grant = (remainingLeaseMs: number, action: HeartbeatResponse['action'] = 'continue'): HeartbeatResponse => ({ action, remainingLeaseMs, leaseExpiresAt: '2099-01-01T00:00:00.000Z', decision: null });
const controls: AttemptControl[] = [];
afterEach(() => { controls.splice(0).forEach(control => control.close()); vi.useRealTimers(); });
function controlFixture(lease = 10000) {
  const shutdown = new AbortController();
  const client = new FlowClient({ baseUrl: 'http://unused.invalid', token: 'injected' });
  const heartbeat = vi.spyOn(client, 'heartbeat').mockResolvedValue(grant(lease));
  const assignment = { attempt: { id: 'attempt', ownerVersion: 1 } } as ClaimedTask;
  const control = new AttemptControl(assignment, client, { baseUrl: 'http://unused.invalid', token: 'injected', workingDirectory: '/synthetic', signal: shutdown.signal, heartbeatIntervalMs: 2000 }, { remainingLeaseMs: lease, requestedAt: performance.now() });
  controls.push(control); return { control, heartbeat, shutdown };
}

it.each([{fragments:32,mode:'normal'}, {fragments:512,mode:'normal'}, {fragments:32,mode:'cancel-between-patches'}, {fragments:32,mode:'cancel-after-session'}, {fragments:32,mode:'deny-before-native'}, {fragments:32,mode:'sink-failure'}])('guards $mode with $fragments injected fragments', async ({fragments,mode}) => {
  vi.useFakeTimers({ toFake: ['setTimeout','clearTimeout','setInterval','clearInterval','performance'] });
  const { control, heartbeat } = controlFixture();
  if(mode==='deny-before-native') heartbeat.mockResolvedValueOnce(grant(0,'cancel'));
  let factories=0;
  const events: RunnerEventData[] = [], queue: Inbound[] = [];
  let receive: ((message: Inbound | null) => void) | undefined, closed = false;
  const close = { reason: 'CLOSED' as const, child: 'confirmed-exited' as const, exitCode: 0, signal: null, remoteEffects: 'unknown' as const };
  const text = 'x'.repeat(32768);
  const item = { type: 'agentMessage', id: 'item', text, phase: 'final_answer', memoryCitation: null, delivery: null, questions: null };
  const notify = (method: string, params: Json) => { const message: Inbound = { kind: 'notification', method, params }; if (receive) { const deliver=receive;receive=undefined;deliver(message); } else queue.push(message); };
  const port: CodexTransport = {
    ready: Promise.resolve({ userAgent:'injected', platformFamily:'fixture', platformOs:'fixture' }), closed: Promise.resolve(close),
    async request(method): Promise<Json> {
      if (method==='thread/start') return { thread:{id:'thread'}, model:'synthetic-model', modelProvider:'fixture', serviceTier:null, reasoningEffort:null, approvalPolicy:'never', sandbox:{type:'readOnly',networkAccess:false} };
      for(let index=0;index<fragments;index++) notify('item/agentMessage/delta',{threadId:'thread',turnId:'turn',itemId:'item',delta:text.slice(index*text.length/fragments,(index+1)*text.length/fragments)});
      notify('item/completed',{threadId:'thread',turnId:'turn',completedAtMs:1,item});
      notify('turn/completed',{threadId:'thread',turn:{id:'turn',status:'completed',itemsView:'full',items:[item],error:null}});
      return {turn:{id:'turn',status:'inProgress',itemsView:'full',items:[],error:null}};
    },
    async receive(){return queue.length?queue.shift()!:closed?null:await new Promise<Inbound|null>(resolve=>{receive=resolve;});},
    async respond(){throw Error('No server request');}, async close(){closed=true;receive?.(null);receive=undefined;return close;},snapshot(){throw Error('Unused');}
  };
  const profile={harness:'codex' as const,adapterVersion:'codex-app-server-0.154.0-v1' as const,model:'synthetic-model',reasoningEffort:null,serviceTier:null,serviceTierForTurn:'default' as const,access:'none' as const,approvalPolicy:'never' as const,sandboxMode:'read-only' as const,hostLimits:{wallTimeMs:1000,maxOutputBytes:65536}};
  let checks=0;
  const result = await createCodexAdapter(profile,()=>{factories++;return port;}).run({task:{title:'Counter',prompt:'Injected',harness:'codex',executionProfile:{id:'profile',runnerId:'runner',configDigest:'a'.repeat(64)},verification:{kind:'contains',expected:'x'}},workingDirectory:'/synthetic',signal:control.signal,
    async assertOwnership(){checks++;await control.assertOwnership();},async emit(event){
      if(mode==='sink-failure' && event.type==='assistant-stream') throw Error('Injected sink failure');
      events.push(event);
      if((mode==='cancel-after-session' && event.type==='session') || (mode==='cancel-between-patches' && event.type==='assistant-stream')) heartbeat.mockResolvedValueOnce(grant(0,'cancel'));
    },async waitForDecision(){throw Error('Unused');}} satisfies HarnessContext).catch(error=>error);
  const patches=events.filter(event=>event.type==='assistant-stream');
  if(mode==='deny-before-native'){expect(result).toMatchObject({reason:'cancel'});expect(factories).toBe(0);expect(events).toEqual([]);return;}
  if(mode!=='normal'){
    expect(result).toMatchObject({settlement:'unknown'});expect(closed).toBe(true);
    expect(events.some(event=>event.type==='assistant-final')).toBe(false);
    expect(patches).toHaveLength(mode==='cancel-between-patches'?1:0);return;
  }
  expect(result).toBeUndefined();expect(factories).toBe(1);
  expect(events[0]?.type).toBe('session');expect(patches.map(p=>p.text).join('')).toBe(text);
  expect(events.filter(e=>e.type==='assistant-final')).toHaveLength(1);expect(events.at(-1)).toMatchObject({type:'verification',result:'passed'});
  expect(heartbeat).toHaveBeenCalledTimes(checks);expect(checks).toBe(patches.length+6);
  console.log(JSON.stringify({kind:'ownership-count',fragments,patches:patches.length,events:events.length,ownershipChecks:checks,heartbeats:heartbeat.mock.calls.length,clockMs:performance.now(),realHTTP:0,nativeProcesses:0}));
});

it.each(['cancel','stop','disconnect'] as const)('does not reuse a previous authorization when next check observes %s', async mode => {
  const {control,heartbeat}=controlFixture();await control.assertOwnership();
  if(mode==='disconnect')heartbeat.mockRejectedValueOnce(Error('offline'));else heartbeat.mockResolvedValueOnce(grant(0,mode));
  await expect(control.assertOwnership()).rejects.toMatchObject({reason:mode==='cancel'?'cancel':'lost'});
  expect(heartbeat).toHaveBeenCalledTimes(2);expect(control.signal.aborted).toBe(true);
});
it('checks periodically without patches, and expiry cannot be renewed by a late response', async()=>{
  vi.useFakeTimers({toFake:['setTimeout','clearTimeout','setInterval','clearInterval','performance']});
  const {control,heartbeat}=controlFixture(3000);await vi.advanceTimersByTimeAsync(2000);expect(heartbeat).toHaveBeenCalledTimes(1);
  let reply:((value:HeartbeatResponse)=>void)|undefined;
  heartbeat.mockImplementationOnce(()=>new Promise(resolve=>{reply=resolve;}));
  const pending=control.assertOwnership().catch(error=>error);await vi.advanceTimersByTimeAsync(3000);
  expect(control.signal.aborted).toBe(true);reply?.(grant(3000));expect(await pending).toMatchObject({reason:'lost'});
});
it('shutdown prevents a new check and in-flight concurrent checks share only that request', async()=>{
  const {control,heartbeat,shutdown}=controlFixture();let reply:((value:HeartbeatResponse)=>void)|undefined;
  heartbeat.mockImplementationOnce(()=>new Promise(resolve=>{reply=resolve;}));
  const a=control.assertOwnership(),b=control.assertOwnership();expect(heartbeat).toHaveBeenCalledTimes(1);
  reply?.(grant(10000));await Promise.all([a,b]);shutdown.abort();
  await expect(control.assertOwnership()).rejects.toMatchObject({reason:'shutdown'});expect(heartbeat).toHaveBeenCalledTimes(1);
});
