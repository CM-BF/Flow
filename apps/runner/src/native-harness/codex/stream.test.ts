import { mkdtemp, lstat, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import type { HarnessContext, RunnerEventData } from '@flow/contracts';
import { createCodexTransport } from '../../codex/index.js';
import type { CodexTransport, Inbound, Json } from '../../codex/types.js';
import { fileURLToPath } from 'node:url';
import { createCodexAdapter } from './adapter.js';
import { CodexAssistantStream } from './stream.js';
const delta = { kind:'text' as const,threadId:'thread',turnId:'turn',itemId:'item',index:null,delta:'中文🙂' };
it('keeps source/channel/turn identity and rejects changed completion, foreign turn and post-completion text', () => {
  const stream = new CodexAssistantStream(); const first = stream.accept(delta)[0]!;
  expect(first).toMatchObject({source:'codex.app-server.stream',nativeTurnId:'turn',channel:'text',revision:1});
  expect(() => stream.accept({...delta,turnId:'foreign'})).toThrow();
  expect(() => stream.accept({...delta,delta:'',completedText:'other'})).toThrow();
  expect(stream.accept({...delta,delta:'',completedText:delta.delta})).toMatchObject([{phase:'block-complete',text:'',revision:2}]);
  expect(() => stream.accept(delta)).toThrow();
  const other = new CodexAssistantStream().accept({...delta,turnId:'other'})[0]!; expect(other.streamId).not.toBe(first.streamId);
});
it('enforces total decoded text and separates two explicitly published reasoning channels', () => {
  const stream = new CodexAssistantStream(); const a = stream.accept({...delta,kind:'reasoning-summary',index:0})[0]!;
  const b = stream.accept({...delta,kind:'reasoning-text',index:0})[0]!; expect(a.streamId).not.toBe(b.streamId);
  expect(() => stream.accept({...delta,delta:'x'.repeat(1048576)})).toThrow('byte limit');
  expect(() => new CodexAssistantStream().accept({...delta,delta:'\ud800'})).toThrow();
});
it.each([32,512])('publishes session then public patches and one final from %i real synthetic JSONL fragments', async count => {
  const root = await mkdtemp(join(tmpdir(),'flow-c02-public-')); const identity = await lstat(root); let child: CodexTransport | undefined;
  const events: RunnerEventData[] = []; let ownershipChecks = 0;
  const profile = {harness:'codex' as const,adapterVersion:'codex-app-server-0.154.0-v1' as const,model:'synthetic-model',reasoningEffort:null,
    serviceTier:null,serviceTierForTurn:'default' as const,access:'none' as const,approvalPolicy:'never' as const,sandboxMode:'read-only' as const,hostLimits:{wallTimeMs:3000,maxOutputBytes:16384}};
  try {
    const adapter = createCodexAdapter(profile, options => child = createCodexTransport({spawn:{executable:process.execPath,args:[fileURLToPath(new URL('./peer.mjs',import.meta.url)),`stream:${count}`],cwd:root,environment:{LANG:'C'}},
      initialize:{clientInfo:{name:'public-stream-fixture',title:null,version:'1'},capabilities:null},signal:options.signal,limits:{terminateMs:50,killMs:50}}));
    await adapter.run({task:{title:'Public stream',prompt:'Synthetic',harness:'codex',executionProfile:{id:'profile',runnerId:'runner',configDigest:'a'.repeat(64)}},workingDirectory:root,signal:new AbortController().signal,
      async assertOwnership(){ownershipChecks++;},async emit(event){events.push(event)},async waitForDecision(){throw Error('unused')}} as HarnessContext);
    const patches = events.filter(event => event.type==='assistant-stream');
    expect(events[0]?.type).toBe('session'); expect(events.filter(event=>event.type==='session')).toHaveLength(1);
    expect(patches.filter(p=>p.channel==='text').map(p=>p.text).join('')).toBe('中文🙂'.repeat(512));
    expect(patches.filter(p=>p.channel==='reasoning-summary').map(p=>p.text).join('')).toBe('公开摘要🙂');
    expect(patches.filter(p=>p.phase==='block-complete')).toHaveLength(2);
    expect(patches.length).toBeLessThanOrEqual(16);
    console.log(JSON.stringify({kind:"public-stream-injected-observation",fragments:count,emittedPatches:patches.length,emitCalls:events.length,ownershipChecks,finalDigest:createHash("sha256").update(patches.filter(p=>p.channel==="text").map(p=>p.text).join("")).digest("hex"),httpRequests:"NOT_MEASURED"}));
    expect(events.filter(event=>event.type==='assistant-final')).toHaveLength(1); expect(events.at(-3)?.type).toBe('assistant-final');
    expect(JSON.stringify(events)).not.toContain('private-server'); expect(child!.snapshot().state).toBe('closed');
  } finally {
    if(child) expect((await child.close()).child).toBe('confirmed-exited');
    const current = await lstat(root); expect([current.dev,current.ino]).toEqual([identity.dev,identity.ino]); await rm(root,{recursive:true});
  }
});

it('coalesces receive bursts by byte/time while retaining first text and completion with equal Unicode prefixes', () => {
  const text = '中文🙂'.repeat(512), observations: { fragments:number; emits:number; digest:string }[] = [];
  for (const fragments of [32,512]) {
    let now = 1; const stream = new CodexAssistantStream(() => now);
    const point = '中文🙂'.repeat(512 / fragments), patches = [];
    for (let i=0;i<fragments;i++) patches.push(...stream.accept({...delta,delta:point}));
    expect(patches).toHaveLength(1); // First observable prefix is not delayed.
    patches.push(...stream.accept({...delta,delta:'',completedText:text}));
    expect(patches.map(patch=>patch.text).join('')).toBe(text);
    const digest=createHash('sha256').update(text).digest('hex');
    expect(patches.at(-1)).toMatchObject({phase:'block-complete',prefixDigest:digest});
    observations.push({fragments,emits:patches.length,digest});
  }
  expect(observations[0]!.emits).toBe(2); expect(observations[1]!.emits).toBe(2);
  expect(observations[0]!.digest).toBe(observations[1]!.digest);
  let now=0; const timed=new CodexAssistantStream(()=>now);
  expect(timed.accept({...delta,delta:'a'})).toHaveLength(1);
  now=249; expect(timed.accept({...delta,delta:'b'})).toEqual([]);
  now=250; expect(timed.accept({...delta,delta:'c'})).toMatchObject([{text:'bc',fromBytes:1}]);
  now=251; expect(timed.accept({...delta,delta:'x'.repeat(8192)})).toMatchObject([{text:'x'.repeat(8192),fromBytes:3}]);
});

it.each(['silent', 'abort-before-due', 'ownership-loss', 'emit-failure', 'pending-abort', 'pending-deadline'])('scheduled flush preserves silence/cancellation lifecycle: %s', async mode => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
  const controller = new AbortController(), events: RunnerEventData[] = [];
  let waiter: ((value: Inbound | null) => void) | undefined, closed = false, receiving = 0, peakReceiving = 0;
  let receives = 0, patchCalls = 0, ownershipLost = false;
  const queue: Inbound[] = [];
  const close = { reason: 'CLOSED' as const, child: 'confirmed-exited' as const, exitCode: 0, signal: null, remoteEffects: 'unknown' as const };
  const port: CodexTransport = {
    ready: Promise.resolve({ userAgent: 'in-memory', platformFamily: 'fixture', platformOs: 'fixture' }), closed: Promise.resolve(close),
    async request(method): Promise<Json> {
      if (method === 'thread/start') return { thread: { id: 'thread' }, model: 'synthetic-model', modelProvider: 'fixture', serviceTier: null,
        reasoningEffort: null, approvalPolicy: 'never', sandbox: { type: 'readOnly', networkAccess: false } };
      for (const text of ['a', 'b']) {
        const message: Inbound = { kind: 'notification', method: 'item/agentMessage/delta', params: { threadId: 'thread', turnId: 'turn', itemId: 'item', delta: text } };
        if (waiter) { const deliver = waiter; waiter = undefined; deliver(message); } else queue.push(message);
      }
      return { turn: { id: 'turn', status: 'inProgress', itemsView: 'full', items: [], error: null } };
    },
    async receive() {
      receives++; receiving++; peakReceiving = Math.max(peakReceiving, receiving);
      try { return queue.length ? queue.shift()! : closed ? null : await new Promise<Inbound | null>(resolve => { waiter = resolve; }); }
      finally { receiving--; }
    },
    async respond() { throw Error('No requests'); },
    async close() { closed = true; waiter?.(null); waiter = undefined; return close; }, snapshot() { throw Error('Unused'); },
  };
  const profile = { harness: 'codex' as const, adapterVersion: 'codex-app-server-0.154.0-v1' as const, model: 'synthetic-model', reasoningEffort: null,
    serviceTier: null, serviceTierForTurn: 'default' as const, access: 'none' as const, approvalPolicy: 'never' as const, sandboxMode: 'read-only' as const,
    hostLimits: { wallTimeMs: 1000, maxOutputBytes: 16384 } };
  const run = createCodexAdapter(profile, () => port).run({ task: { title: 'Silent stream', prompt: 'Synthetic', harness: 'codex',
    executionProfile: { id: 'profile', runnerId: 'runner', configDigest: 'a'.repeat(64) } }, workingDirectory: '/synthetic', signal: controller.signal,
    async assertOwnership() { if (ownershipLost) throw Error('Lost owner'); },
    async emit(event) {
      if (event.type === 'assistant-stream' && ++patchCalls === 2) {
        if (mode === 'emit-failure') throw Error('Delivery failed');
        if (mode.startsWith('pending-')) await new Promise<void>(() => {});
      }
      events.push(event);
    }, async waitForDecision() { throw Error('Unused'); },
  } as HarnessContext).catch(error => error);
  try {
    await vi.advanceTimersByTimeAsync(0);
    expect(events.filter(event => event.type === 'assistant-stream').map(event => event.text)).toEqual(['a']);
    expect(receives).toBe(3); expect(receiving).toBe(1);
    await vi.advanceTimersByTimeAsync(249);
    expect(patchCalls).toBe(1);
    if (mode === 'abort-before-due') controller.abort();
    if (mode === 'ownership-loss') ownershipLost = true;
    await vi.advanceTimersByTimeAsync(1);
    if (mode === 'silent') {
      expect(events.filter(event => event.type === 'assistant-stream').map(event => [event.text, event.phase])).toEqual([['a', 'streaming'], ['b', 'streaming']]);
      // With no buffered output only the wall deadline remains; no polling timer or new receive.
      expect(vi.getTimerCount()).toBe(1); expect(receives).toBe(3);
    }
    if (mode === 'pending-deadline') await vi.advanceTimersByTimeAsync(750);
    else controller.abort();
    expect(await run).toMatchObject({ settlement: 'unknown' });
    expect(closed).toBe(true); expect(receiving).toBe(0); expect(peakReceiving).toBe(1);
    expect(events.some(event => event.type === 'assistant-final')).toBe(false);
    if (mode !== 'silent') expect(events.filter(event => event.type === 'assistant-stream').map(event => event.text)).toEqual(['a']);
    expect(vi.getTimerCount()).toBe(0);
    const count = patchCalls; await vi.advanceTimersByTimeAsync(2000); expect(patchCalls).toBe(count);
  } finally { controller.abort(); await port.close(); vi.useRealTimers(); }
});
