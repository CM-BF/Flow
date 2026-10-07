import { afterEach, expect, test, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { FlowApiError } from '@flow/client';
import type { ConversationSnapshot, ConversationQueuePage } from '@flow/contracts';
import { createInteractionController } from '../controller.js';
import type { Intent, InteractionClient, InteractionController } from '../types.js';
import type { QueueControlPort } from './index.js';

const controllers: InteractionController[] = [];
afterEach(async () => { for (const controller of controllers.splice(0)) await controller.dispose(); vi.useRealTimers(); });
const time = '2026-10-06T00:00:00Z';
function fixture(capability = true) {
  const id = randomUUID();
  const snapshot: ConversationSnapshot = { conversation: { id, title: 'Queue fixture', harness: 'claude', revision: 0, requested: { model: 'runner-default', thinking: 'disabled', tools: 'none' }, createdAt: time, updatedAt: time },
    capabilities: { followUp: true, queue: capability, steer: false, perTurnModel: false, perTurnThinking: false, perTurnTools: false }, lastTurn: null, nativeSession: null };
  let page: ConversationQueuePage = { conversationId: id, queueRevision: 4, items: [], nextCursor: null, blocked: null, paused: false, currentTurn: null };
  let saved: Intent | null = null; const requests: unknown[] = [];
  const client = { conversation: async () => snapshot, conversationTurns: async () => ({ conversation: snapshot.conversation, turns: [], nextCursor: null }) } as unknown as InteractionClient;
  const queue: QueueControlPort = {
    conversationQueue: async () => structuredClone(page),
    pauseConversationQueue: async (conversationId: string, input: unknown, key: string) => {
      requests.push({ conversationId, input: structuredClone(input), key, saved: structuredClone(saved) });
      page = { ...page, paused: true, queueRevision: 5, blocked: 'queue-paused' };
      return { conversationId, queueRevision: 5, paused: true as const, currentTurn: null, replayed: false };
    },
    resumeConversationQueue: async () => { throw Error('Unexpected resume'); },
  };
  const intents = { load: async () => saved, save: async (value: Intent) => { saved = structuredClone(value); }, clear: async () => { saved = null; } };
  const create = () => { const controller = createInteractionController({ client, queue, connectionId: 'queue-test', pollMs: 60_000, intents }); controllers.push(controller); return controller; };
  return { id, client, controller: create(), requests, queue, snapshot, create, intents, setPage: (value: ConversationQueuePage) => { page = value; }, saved: () => saved };
}
test('queue pause uses the observed revision and the one durable intent before dispatch', async () => {
  const f = fixture(); await f.controller.initialize();
  expect((await f.controller.input(`/open ${f.id}`)).code).toBe('OPENED');
  expect((await f.controller.input('/queue')).code).toBe('QUEUE');
  f.controller.setDraft('  preserve 中文🙂\n');
  expect((await f.controller.input('/pause')).code).toBe('ACCEPTED');
  expect(f.requests).toHaveLength(1);
  const request = f.requests[0] as { input: unknown; key: string; saved: Intent };
  expect(request.input).toEqual({ expectedQueueRevision: 4 });
  expect(request.saved).toMatchObject({ kind: 'queue-pause', input: request.input, key: request.key, conversationId: f.id });
  expect(f.saved()).toBeNull(); expect(f.controller.snapshot().draft).toBe('  preserve 中文🙂\n');
  expect(f.controller.snapshot().queue).toMatchObject({ queueRevision: 5, paused: true });
});

test('unknown malformed ACK survives restart and explicit recover reuses the original key/body', async () => {
  const f = fixture(); await f.controller.initialize(); await f.controller.input(`/open ${f.id}`); await f.controller.input('/queue');
  const pause = f.queue.pauseConversationQueue; let bad = true;
  f.queue.pauseConversationQueue = async (...args) => { const value = await pause(...args); return bad ? { ...value, conversationId: randomUUID() } : value; };
  expect((await f.controller.input('/pause')).code).toBe('UNKNOWN'); const original = structuredClone(f.saved());
  await f.controller.dispose(); const restored = f.create(); await restored.initialize();
  expect(f.requests).toHaveLength(1); expect(restored.snapshot().pending?.status).toBe('unknown');
  expect((await restored.input('/pause')).code).toBe('UNRESOLVED'); bad = false;
  expect((await restored.input('/recover')).code).toBe('ACCEPTED');
  expect(f.requests).toHaveLength(2); expect(f.requests[1]).toEqual(f.requests[0]);
  expect(original).toMatchObject({ kind: 'queue-pause', input: { expectedQueueRevision: 4 } }); expect(f.saved()).toBeNull();
});

test('deterministic CAS rejection keeps draft, refreshes queue and never retries with a new version', async () => {
  const f = fixture(); await f.controller.initialize(); await f.controller.input(`/open ${f.id}`); await f.controller.input('/queue');
  let posts = 0; f.queue.pauseConversationQueue = async () => { posts++; f.setPage({ conversationId: f.id, queueRevision: 8, items: [], nextCursor: null, blocked: 'queue-paused', paused: true, currentTurn: null }); throw new FlowApiError(409, 'conversation_queue_revision_conflict', 'changed'); };
  f.controller.setDraft('keep\n中文🙂'); expect((await f.controller.input('/pause')).code).toBe('HTTP_409');
  expect(f.controller.snapshot()).toMatchObject({ connected: true, draft: 'keep\n中文🙂', queue: { queueRevision: 8 } });
  expect(f.saved()).toBeNull(); await f.controller.input('/recover'); expect(posts).toBe(1);
});

test('resume persists observed task identity and ignores unexpected unsigned user fields', async () => {
  const f = fixture(); await f.controller.initialize(); await f.controller.input(`/open ${f.id}`);
  const taskId = randomUUID(), turnId = randomUUID();
  f.setPage({ conversationId: f.id, queueRevision: 9, items: [], nextCursor: null, blocked: 'queue-paused', paused: true, currentTurn: { taskId, taskStatus: 'succeeded', turnId, turnNumber: 1, queueItemId: null } });
  await f.controller.input('/queue'); let input: unknown;
  f.queue.resumeConversationQueue = async (...args: unknown[]) => { input = structuredClone(args[1]); throw Error('lost ACK'); };
  expect((await f.controller.execute({ type: 'resume', expectedTaskId: 'foreign' } as never)).code).toBe('INVALID_COMMAND');
  expect((await f.controller.input('/resume')).code).toBe('UNKNOWN');
  expect(input).toEqual({ expectedQueueRevision: 9, expectedTaskId: taskId });
  expect(f.saved()).toMatchObject({ kind: 'queue-resume', input });
});

test('old center capability false and unrelated queue pages fail closed', async () => {
  const f = fixture(false); await f.controller.initialize(); await f.controller.input(`/open ${f.id}`);
  expect((await f.controller.input('/queue')).code).toBe('UNSUPPORTED_QUEUE'); expect(f.requests).toHaveLength(0);
  f.snapshot.capabilities.queue = true; await f.controller.input('/recover');
  f.setPage({ conversationId: randomUUID(), queueRevision: 0, items: [], nextCursor: null, blocked: null, paused: false, currentTurn: null });
  expect((await f.controller.input('/queue')).ok).toBe(false); expect(f.controller.snapshot().queue).toBeNull();
});

test('a queue ACK with an impossible revision remains unknown and keeps its durable request', async () => {
  const f = fixture(); await f.controller.initialize(); await f.controller.input(`/open ${f.id}`); await f.controller.input('/queue');
  f.queue.pauseConversationQueue = async () => ({ conversationId: f.id, queueRevision: 99, paused: true, currentTurn: null, replayed: false });
  expect((await f.controller.input('/pause')).code).toBe('UNKNOWN'); expect(f.saved()).toMatchObject({ kind: 'queue-pause', input: { expectedQueueRevision: 4 } });
});

test('a resume ACK without promotion must retain the frozen task identity', async () => {
  const f = fixture(); await f.controller.initialize(); await f.controller.input(`/open ${f.id}`); await f.controller.input('/queue');
  f.queue.resumeConversationQueue = async () => ({ conversationId: f.id, queueRevision: 5, paused: false, replayed: false, promoted: null,
    currentTurn: { taskId: randomUUID(), taskStatus: 'running', turnId: randomUUID(), turnNumber: 1, queueItemId: null } });
  expect((await f.controller.input('/resume')).code).toBe('UNKNOWN'); expect(f.saved()).toMatchObject({ kind: 'queue-resume', input: { expectedTaskId: null } });
});

test('only twenty bounded previews are retained and unsolicited item bodies are omitted', async () => {
  const f = fixture(); await f.controller.initialize(); await f.controller.input(`/open ${f.id}`);
  const entry = { id: randomUUID(), conversationId: f.id, sequence: 1, state: 'waiting' as const, preview: '中文🙂', truncated: true, promoted: null, createdAt: time, updatedAt: time, text: 'must not retain full body' };
  const page: ConversationQueuePage = { conversationId: f.id, queueRevision: 30, items: [entry], nextCursor: null, blocked: null, paused: false, currentTurn: null };
  f.setPage(page); expect((await f.controller.input('/queue')).code).toBe('QUEUE'); expect(f.controller.snapshot().queue!.items[0]).not.toHaveProperty('text');
  f.setPage({ ...page, items: Array.from({ length: 21 }, (_, i) => ({ ...entry, id: randomUUID(), sequence: i + 1 })) });
  expect((await f.controller.input('/queue')).code).toBe('READ_FAILED'); expect(f.controller.snapshot().queue!.items).toHaveLength(1);
  f.setPage({ ...page, items: [{ ...entry, preview: '中'.repeat(171) }] });
  expect((await f.controller.input('/queue')).code).toBe('READ_FAILED'); expect(f.requests).toHaveLength(0);
});

test('disconnect drops a late queue read without installing it in the new epoch', async () => {
  const f = fixture(); await f.controller.initialize(); await f.controller.input(`/open ${f.id}`);
  let release!: (value: ConversationQueuePage) => void; let entered!: () => void;
  const started = new Promise<void>(done => { entered = done; });
  f.queue.conversationQueue = () => { entered(); return new Promise(done => { release = done; }); };
  const reading = f.controller.input('/queue'); await started; f.controller.disconnect();
  release({ conversationId: f.id, queueRevision: 30, items: [], nextCursor: null, blocked: null, paused: false, currentTurn: null });
  expect((await reading).code).toBe('STALE'); expect(f.controller.snapshot()).toMatchObject({ connected: false, queue: null });
});

function queuePage(conversationId: string, sequence: number): ConversationQueuePage {
  return { conversationId, queueRevision: 60, paused: false, blocked: null, currentTurn: null, nextCursor: sequence,
    items: [{ id: randomUUID(), conversationId, sequence, state: 'waiting', preview: `page ending ${sequence}`, truncated: false, promoted: null, createdAt: time, updatedAt: time }] };
}

test.each(['response', 'error'])('a late old-page poll %s cannot replace or disconnect the selected next page', async kind => {
  vi.useFakeTimers(); const f = fixture(); const first = queuePage(f.id, 20), second = queuePage(f.id, 40);
  const requested: number[] = []; let settle!: () => void; let entered!: () => void;
  const oldStarted = new Promise<void>(done => { entered = done; });
  f.queue.conversationQueue = async (_id, input) => {
    const after = input?.after ?? 0; requested.push(after);
    if (requested.length === 1) return first;
    if (after === 0) { entered(); return new Promise((done, reject) => { settle = () => kind === 'response' ? done(first) : reject(Error('old page failed')); }); }
    return after === 20 ? second : queuePage(f.id, 60);
  };
  await f.controller.initialize(); await f.controller.input(`/open ${f.id}`); await f.controller.input('/queue');
  f.controller.setDraft('保留草稿'); const poll = vi.advanceTimersByTimeAsync(60_000); await oldStarted;
  expect((await f.controller.input('/queue next')).code).toBe('QUEUE'); expect(f.controller.snapshot().queue).toEqual(second);
  settle(); await poll;
  expect(f.controller.snapshot()).toMatchObject({ connected: true, draft: '保留草稿', queue: second });
  expect((await f.controller.input('/queue next')).code).toBe('QUEUE');
  expect(requested).toEqual([0, 0, 20, 40]); expect(f.requests).toHaveLength(0);
});

test('a poll awaiting conversation metadata cannot start an old-page read during an explicit next-page selection', async () => {
  vi.useFakeTimers(); const f = fixture(); const first = queuePage(f.id, 20), second = queuePage(f.id, 40);
  f.setPage(first); await f.controller.initialize(); await f.controller.input(`/open ${f.id}`); await f.controller.input('/queue');
  let enterPoll!: () => void; let releasePoll!: () => void; let enterNext!: () => void; let releaseNext!: () => void;
  const pollStarted = new Promise<void>(done => { enterPoll = done; }); const nextStarted = new Promise<void>(done => { enterNext = done; });
  f.client.conversation = () => { enterPoll(); return new Promise(done => { releasePoll = () => done(f.snapshot); }); };
  const requested: number[] = [];
  f.queue.conversationQueue = (_id, input) => {
    requested.push(input?.after ?? 0);
    if (input?.after === 20) { enterNext(); return new Promise(done => { releaseNext = () => done(second); }); }
    return Promise.resolve(first);
  };
  const poll = vi.advanceTimersByTimeAsync(60_000); await pollStarted;
  const next = f.controller.input('/queue next'); await nextStarted;
  releasePoll(); await poll; releaseNext(); expect((await next).code).toBe('QUEUE');
  expect(requested).toEqual([20]); expect(f.controller.snapshot().queue).toEqual(second); expect(f.requests).toHaveLength(0);
});
