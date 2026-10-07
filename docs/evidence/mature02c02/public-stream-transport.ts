import { randomUUID } from 'node:crypto';
import type { CloseReport, CodexTransport, Inbound, Json } from '../../../apps/runner/src/codex/types.js';
import type { CodexTransportFactory } from '../../../apps/runner/src/native-harness/codex/turn.js';

/** In-memory test port only. Lazy frames cross the real adapter; no child, SDK, auth or native process. */
export function publicStreamTransport(fragments: 32 | 512) {
  const threadId = randomUUID(), turnId = randomUUID(), itemId = 'answer';
  const text = '中文🙂'.repeat(512), summary = '公开摘要🙂', reasoning = '公开推理文本';
  let start!: () => void, release!: () => void, drained!: () => void, closeResolve!: (report: CloseReport) => void;
  const started = new Promise<void>(resolve => { start = resolve; });
  const finish = new Promise<void>(resolve => { release = resolve; });
  const deltasDelivered = new Promise<void>(resolve => { drained = resolve; });
  const closed = new Promise<CloseReport>(resolve => { closeResolve = resolve; });
  const report: CloseReport = { reason: 'CLOSED', child: 'confirmed-exited', exitCode: 0, signal: null, remoteEffects: 'unknown' };
  const state = { closed: false, receiving: 0, peakReceiving: 0, delivered: 0, factories: 0 };
  const final = { type: 'agentMessage', id: itemId, text, phase: 'final_answer', delivery: null, questions: null };
  const reasoningItem = { type: 'reasoning', id: 'reason', summary: [summary], content: [reasoning] };
  const notify = (method: string, params: Json): Inbound => ({ kind: 'notification', method, params });
  async function* frames(): AsyncGenerator<Inbound> {
    await started;
    yield notify('item/reasoning/summaryTextDelta', { threadId, turnId, itemId: 'reason', summaryIndex: 0, delta: summary });
    yield notify('item/reasoning/textDelta', { threadId, turnId, itemId: 'reason', contentIndex: 0, delta: reasoning });
    for (let i = 0; i < fragments; i++) yield notify('item/agentMessage/delta', { threadId, turnId, itemId, delta: '中文🙂'.repeat(512 / fragments) });
    drained(); await finish;
    if (state.closed) return;
    yield notify('item/completed', { threadId, turnId, completedAtMs: 1, item: reasoningItem });
    yield notify('item/completed', { threadId, turnId, completedAtMs: 2, item: final });
    yield notify('turn/completed', { threadId, turn: { id: turnId, status: 'completed', itemsView: 'full', items: [reasoningItem, final], error: null } });
  }
  const iterator = frames();
  const factory: CodexTransportFactory = () => {
    if (++state.factories !== 1) throw Error('Only one fixture factory is permitted.');
    const port: CodexTransport = {
      ready: Promise.resolve({ userAgent: 'memory-fixture', platformFamily: 'fixture', platformOs: 'fixture' }), closed,
      async request(method): Promise<Json> {
        if (method === 'thread/start') return { thread: { id: threadId }, model: 'fixture-model', modelProvider: 'fixture', serviceTier: null,
          reasoningEffort: null, approvalPolicy: 'never', sandbox: { type: 'readOnly', networkAccess: false } };
        if (method !== 'turn/start') throw Error('Unexpected fixture request.');
        start(); return { turn: { id: turnId, status: 'inProgress', itemsView: 'full', items: [], error: null } };
      },
      async receive() {
        if (state.closed) return null;
        state.receiving++; state.peakReceiving = Math.max(state.peakReceiving, state.receiving);
        if (state.receiving !== 1) throw Error('Concurrent fixture receive.');
        try { const next = await iterator.next(); if (next.done || state.closed) return null; state.delivered++; return next.value; }
        finally { state.receiving--; }
      },
      async respond() { throw Error('No fixture server requests.'); },
      async close() { state.closed = true; start(); release(); await iterator.return(undefined); closeResolve(report); return report; },
      snapshot() { throw Error('No snapshot authority.'); },
    };
    return port;
  };
  return { factory, release, deltasDelivered, state, threadId, turnId, itemId, text, summary, reasoning };
}
