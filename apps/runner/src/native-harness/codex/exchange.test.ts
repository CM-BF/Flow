import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { createCodexTransport } from '../../codex/index.js';
import type { CodexTransport, Inbound, Json, Reply } from '../../codex/types.js';
import { runOrdinaryCodexTurn } from './turn.js';
import { createHash } from 'node:crypto';
import { createTrustedToolWriter } from '../../engineering/native-tool-writer.js';
import { createNativeToolRecipe } from '../../engineering/native-tool-policy.js';
import { runCodexExchange } from './exchange.js';

function toolPeer(afterReply: (reply: Reply, push: (frame: Inbound) => void) => void) {
  const frames: Inbound[] = []; let pending: ((value: Inbound | null) => void) | undefined;
  let closed = false, receiving = 0, peak = 0, replies = 0;
  const args = { expectedSha256: createHash('sha256').update('old').digest('hex'), contentsBase64: 'bmV3' };
  const item = { id: 'call', type: 'dynamicToolCall', tool: 'flow_calculator_update', status: 'inProgress', arguments: args };
  const close = { reason: 'CLOSED' as const, child: 'confirmed-exited' as const, exitCode: 0, signal: null, remoteEffects: 'unknown' as const };
  function push(frame: Inbound) { if (pending) { const callback = pending; pending = undefined; callback(frame); } else frames.push(frame); }
  const port: CodexTransport = {
    ready: Promise.resolve({ userAgent: 'injected', platformFamily: 'fixture', platformOs: 'fixture' }), closed: Promise.resolve(close),
    async request(method): Promise<Json> {
      if (method === 'thread/start') return { thread: { id: 'thread' }, model: 'gpt-6-astra', approvalPolicy: 'never', sandbox: { type: 'readOnly', networkAccess: false } };
      // The real transport's JSONL response and notifications are exercised by the two unchanged consumers below.
      setImmediate(() => {
        push({ kind: 'notification', method: 'item/started', params: { threadId: 'thread', turnId: 'turn', item } });
        push({ kind: 'server-request', id: 10, method: 'item/tool/call', params: { threadId: 'thread', turnId: 'turn', callId: 'call', tool: 'flow_calculator_update', arguments: args } });
      });
      return { turn: { id: 'turn', status: 'inProgress', itemsView: 'full', items: [], error: null } };
    },
    async receive() {
      receiving++; peak = Math.max(peak, receiving);
      try { return closed ? null : frames.shift() ?? await new Promise<Inbound | null>(resolve => { pending = resolve; }); }
      finally { receiving--; }
    },
    async respond(_, reply) { replies++; afterReply(reply, push); },
    async close() { closed = true; pending?.(null); pending = undefined; return close; }, snapshot() { throw Error('Not used'); },
  };
  return { port, item, get peak() { return peak; }, get receiving() { return receiving; }, get replies() { return replies; } };
}

it('awaits one async host tool response in the existing pump before accepting its final evidence', async () => {
  let text = 'old', writes = 0, closes = 0;
  const abort = new AbortController();
  const writer = createTrustedToolWriter({ binding: { identity: { taskId: 'task', attemptId: 'attempt', runnerId: 'runner', ownerVersion: 1 }, leaseId: '5b647dc2-9b9d-4c5c-9fd3-79a6d1b0a0f8', baseCommit: 'a'.repeat(40), generation: 1 },
    signal: abort.signal, async assertOwnership() { await new Promise<void>(done => setImmediate(done)); },
    target: { identity: { path: '/fixture/calculator.mjs', device: '1', inode: '2' }, async read() { return Buffer.from(text); },
      async replace(bytes) { await new Promise<void>(done => setImmediate(done)); writes++; text = Buffer.from(bytes).toString(); }, async close() { closes++; } } });
  const peer = toolPeer((reply, push) => {
    if (!('result' in reply) || !reply.result || typeof reply.result !== 'object' || Array.isArray(reply.result)) throw Error('Missing reply');
    const item = { ...peer.item, status: 'completed', success: true, contentItems: reply.result.contentItems! };
    const final = { type: 'agentMessage', id: 'final', phase: 'final_answer', delivery: null, questions: null, text: 'Host updated.' };
    for (const value of [item, final]) push({ kind: 'notification', method: 'item/completed', params: { threadId: 'thread', turnId: 'turn', completedAtMs: 1, item: value } });
    push({ kind: 'notification', method: 'turn/completed', params: { threadId: 'thread', turn: { id: 'turn', status: 'completed', error: null, itemsView: 'full', items: [item, final] } } });
  });
  try {
    const result = await runCodexExchange(() => peer.port, { signal: abort.signal, workingDirectory: '/fixture', async assertOwnership() {} },
      { wallTimeMs: 500, maxOutputBytes: 1024 }, createNativeToolRecipe({ model: 'gpt-6-astra', cwd: '/fixture', prompt: 'Injected tool request', writer }));
    expect(result.observation.state).toBe('completed'); expect(writes).toBe(1); expect(peer.replies).toBe(1); expect(peer.peak).toBe(1); expect(peer.receiving).toBe(0);
  } finally { await writer.close(new AbortController().signal); await peer.port.close(); }
  expect(closes).toBe(1);
});

it('returns unknown on async tool cancellation while its writer retains the pending effect', async () => {
  let enter!: () => void, finish!: () => void;
  const entered = new Promise<void>(done => { enter = done; }), held = new Promise<void>(done => { finish = done; });
  let text = 'old', writes = 0, closes = 0; const abort = new AbortController();
  const writer = createTrustedToolWriter({ binding: { identity: { taskId: 'task', attemptId: 'attempt', runnerId: 'runner', ownerVersion: 1 }, leaseId: '5b647dc2-9b9d-4c5c-9fd3-79a6d1b0a0f8', baseCommit: 'a'.repeat(40), generation: 1 },
    signal: new AbortController().signal, async assertOwnership() {}, target: { identity: { path: '/fixture/calculator.mjs', device: '1', inode: '2' },
      async read() { return Buffer.from(text); }, async replace(bytes) { enter(); await held; writes++; text = Buffer.from(bytes).toString(); }, async close() { closes++; } } });
  const peer = toolPeer(() => { throw Error('No success response after abort'); });
  const result = runCodexExchange(() => peer.port, { signal: abort.signal, workingDirectory: '/fixture', async assertOwnership() {} },
    { wallTimeMs: 500, maxOutputBytes: 1024 }, createNativeToolRecipe({ model: 'gpt-6-astra', cwd: '/fixture', prompt: 'Injected cancel', writer }));
  const rejected = expect(result).rejects.toMatchObject({ settlement: 'unknown' });
  try {
    await entered; abort.abort(); await rejected; expect(peer.replies).toBe(0); expect(closes).toBe(0); expect(writes).toBe(0);
    expect((await writer.close(abort.signal)).hostWrite).toBe('unknown');
  } finally { finish(); await writer.close(new AbortController().signal); await peer.port.close(); }
  expect(writes).toBe(1); expect(closes).toBe(1); expect(peer.peak).toBe(1); expect(peer.receiving).toBe(0);
});

it('keeps the extracted ordinary consumer on one receive pump and closes its owned JSONL peer', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'flow-eng01g-exchange-'));
  let peer: CodexTransport | undefined, active = 0, peak = 0, calls = 0;
  try {
    const final = await runOrdinaryCodexTurn({ harness: 'codex', adapterVersion: 'codex-app-server-0.154.0-v1', model: 'synthetic-model', reasoningEffort: null,
      serviceTier: null, serviceTierForTurn: 'default', access: 'none', approvalPolicy: 'never', sandboxMode: 'read-only', hostLimits: { wallTimeMs: 2000, maxOutputBytes: 1024 } },
    options => {
      peer = createCodexTransport({ spawn: { executable: process.execPath, args: [fileURLToPath(new URL('./peer.mjs', import.meta.url)), 'success'], cwd: directory, environment: { LANG: 'C' } },
        initialize: { clientInfo: { name: 'eng01g-peer', title: null, version: '1' }, capabilities: null }, signal: options.signal, limits: { terminateMs: 50, killMs: 50 } });
      const port = peer; return { ...port, async receive() { calls++; active++; peak = Math.max(peak, active); try { return await port.receive(); } finally { active--; } } };
    }, { prompt: 'Ordinary input', workingDirectory: directory, signal: new AbortController().signal, async assertOwnership() {} });
    expect(final.settings.actualExecution.evidence).toBe('unknown'); expect(final.content).toBe('Native peer result 中文🙂');
    expect(peak).toBe(1); expect(calls).toBeGreaterThan(1); expect(active).toBe(0);
    expect(peer!.snapshot().state).toBe('closed');
  } finally { if (peer) expect((await peer.close()).child).toBe('confirmed-exited'); await rm(directory, { recursive: true, force: true }); }
});

it.each([32, 512])('preserves the same Unicode final and published summary through %i paced real JSONL fragments', async fragments => {
  const directory = await mkdtemp(join(tmpdir(), 'flow-c02-stream-'));
  let peer: CodexTransport | undefined, receiving = 0, peakReceiving = 0, activeSink = 0, peakSink = 0;
  const text: string[] = [], summaries: string[] = [];
  try {
    const final = await runOrdinaryCodexTurn({ harness: 'codex', adapterVersion: 'codex-app-server-0.154.0-v1', model: 'synthetic-model', reasoningEffort: null,
      serviceTier: null, serviceTierForTurn: 'default', access: 'none', approvalPolicy: 'never', sandboxMode: 'read-only', hostLimits: { wallTimeMs: 2000, maxOutputBytes: 16_384 } },
    options => {
      peer = createCodexTransport({ spawn: { executable: process.execPath, args: [fileURLToPath(new URL('./peer.mjs', import.meta.url)), `stream:${fragments}`], cwd: directory, environment: { LANG: 'C' } },
        initialize: { clientInfo: { name: 'c02-stream-peer', title: null, version: '1' }, capabilities: null }, signal: options.signal, limits: { terminateMs: 50, killMs: 50 } });
      const port = peer; return { ...port, async receive() { receiving++; peakReceiving = Math.max(peakReceiving, receiving); try { return await port.receive(); } finally { receiving--; } } };
    }, { prompt: 'Synthetic stream', workingDirectory: directory, signal: new AbortController().signal, async assertOwnership() {}, async onStream(delta) {
      activeSink++; peakSink = Math.max(peakSink, activeSink);
      await new Promise<void>(resolve => setImmediate(resolve));
      if (delta.kind === 'text') text.push(delta.delta); else if (delta.kind === 'reasoning-summary') summaries.push(delta.delta);
      activeSink--;
    } });
    expect(text).toHaveLength(fragments); expect(text.join('')).toBe('中文🙂'.repeat(512)); expect(final.content).toBe(text.join(''));
    expect(summaries).toEqual(['公开摘要🙂']); expect(peakReceiving).toBe(1); expect(peakSink).toBe(1);
    expect(final.settings.actualExecution.evidence).toBe('unknown'); expect(JSON.stringify(final)).not.toContain('private-server');
    expect(peer!.snapshot().state).toBe('closed');
  } finally { if (peer) expect((await peer.close()).child).toBe('confirmed-exited'); await rm(directory, { recursive: true, force: true }); }
});

it('still rejects a real JSONL burst exceeding the R06 instantaneous queue', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'flow-c02-stream-burst-')); let peer: CodexTransport | undefined; const calls: string[] = [];
  try {
    await expect(runOrdinaryCodexTurn({ harness: 'codex', adapterVersion: 'codex-app-server-0.154.0-v1', model: 'synthetic-model', reasoningEffort: null,
      serviceTier: null, serviceTierForTurn: 'default', access: 'none', approvalPolicy: 'never', sandboxMode: 'read-only', hostLimits: { wallTimeMs: 2000, maxOutputBytes: 16_384 } },
    options => {
      peer = createCodexTransport({ spawn: { executable: process.execPath, args: [fileURLToPath(new URL('./peer.mjs', import.meta.url)), 'stream-burst'], cwd: directory, environment: { LANG: 'C' } },
        initialize: { clientInfo: { name: 'c02-burst-peer', title: null, version: '1' }, capabilities: null }, signal: options.signal, limits: { inboundFrames: 8, terminateMs: 50, killMs: 50 } });
      const port = peer; return { ...port, request(method, params, options) { calls.push(method); return port.request(method, params, options); } };
    }, { prompt: 'Burst', workingDirectory: directory, signal: new AbortController().signal, async assertOwnership() {} })).rejects.toMatchObject({ settlement: 'unknown' });
    expect(calls).toEqual(['thread/start', 'turn/start']); expect((await peer!.closed).reason).toBe('LIMIT');
  } finally { if (peer) expect((await peer.close()).child).toBe('confirmed-exited'); await rm(directory, { recursive: true, force: true }); }
});

it('yields a hot ready-notification pump to cancellation without changing the terminal requirement', async () => {
  const { runCodexExchange } = await import('./exchange.js');
  const { OrdinaryTurnEvidence } = await import('./evidence.js');
  const controller = new AbortController(); let closed = false, received = 0, aborted = false;
  const timer = setTimeout(() => { aborted = true; controller.abort(); }, 5);
  const close = { reason: 'CLOSED' as const, child: 'confirmed-exited' as const, exitCode: 0, signal: null, remoteEffects: 'unknown' as const };
  const port: CodexTransport = {
    ready: Promise.resolve({ userAgent: 'synthetic', platformFamily: 'test', platformOs: 'test' }), closed: Promise.resolve(close),
    async request(method): Promise<Json> { return method === 'thread/start' ? { threadId: 'thread' } : { turn: { id: 'turn', status: 'inProgress', itemsView: 'full', items: [], error: null } }; },
    async receive() { received++; return closed ? null : { kind: 'notification', method: 'remoteControl/status/changed', params: { status: 'disabled', serverName: '', installationId: '', environmentId: null } }; },
    async respond() { throw Error('No server requests'); }, async close() { closed = true; return close; }, snapshot() { throw Error('Snapshot unused'); },
  };
  try {
    await expect(runCodexExchange(() => port, { signal: controller.signal, workingDirectory: '/synthetic', async assertOwnership() {} },
      { wallTimeMs: 500, maxOutputBytes: 1024 }, { evidence: new OrdinaryTurnEvidence(), startThread: {}, startTurn: () => ({}), readThread: () => ({ threadId: 'thread' }), checkCompletion() {}, respond() { throw Error('No server requests'); } })).rejects.toMatchObject({ settlement: 'unknown' });
    expect(aborted).toBe(true); expect(received).toBeGreaterThanOrEqual(32); expect(closed).toBe(true);
  } finally { clearTimeout(timer); }
});

it.each(['input-abort', 'deadline'])('does not await a pending stream sink forever after %s', async mode => {
  const { runCodexExchange } = await import('./exchange.js');
  const { OrdinaryTurnEvidence } = await import('./evidence.js');
  const controller = new AbortController(); let first = true, closed = false, sinkCalls = 0;
  let sinkSignal: AbortSignal | undefined, abortTimer: ReturnType<typeof setTimeout> | undefined;
  let releaseReceive: ((value: null) => void) | undefined;
  const close = { reason: 'CLOSED' as const, child: 'confirmed-exited' as const, exitCode: 0, signal: null, remoteEffects: 'unknown' as const };
  const port: CodexTransport = {
    ready: Promise.resolve({ userAgent: 'synthetic', platformFamily: 'test', platformOs: 'test' }), closed: Promise.resolve(close),
    async request(method): Promise<Json> { return method === 'thread/start' ? {} : { turn: { id: 'turn', status: 'inProgress', itemsView: 'full', items: [], error: null } }; },
    async receive() {
      if (closed) return null;
      if (first) { first = false; return { kind: 'notification', method: 'item/agentMessage/delta', params: { threadId: 'thread', turnId: 'turn', itemId: 'item', delta: 'observed' } }; }
      return new Promise<null>(resolve => { releaseReceive = resolve; });
    },
    async respond() { throw Error('No server requests'); },
    async close() { closed = true; releaseReceive?.(null); return close; }, snapshot() { throw Error('Snapshot unused'); },
  };
  try {
    await expect(runCodexExchange(() => port, { signal: controller.signal, workingDirectory: '/synthetic', async assertOwnership() {} },
      { wallTimeMs: mode === 'deadline' ? 30 : 500, maxOutputBytes: 1024 }, {
        evidence: new OrdinaryTurnEvidence(), startThread: {}, startTurn: () => ({}), readThread: () => ({ threadId: 'thread' }), checkCompletion() {}, respond() { throw Error('No server requests'); },
        async onStream(_, signal) { sinkCalls++; sinkSignal = signal; if (mode === 'input-abort') abortTimer = setTimeout(() => controller.abort(), 5); await new Promise<void>(() => {}); },
      })).rejects.toMatchObject({ settlement: 'unknown' });
    expect(sinkCalls).toBe(1); expect(sinkSignal?.aborted).toBe(true); expect(closed).toBe(true);
  } finally { clearTimeout(abortTimer); await port.close(); }
});
