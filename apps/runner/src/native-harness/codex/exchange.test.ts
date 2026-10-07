import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { createCodexTransport } from '../../codex/index.js';
import type { CodexTransport, Json } from '../../codex/types.js';
import { runOrdinaryCodexTurn } from './turn.js';

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
