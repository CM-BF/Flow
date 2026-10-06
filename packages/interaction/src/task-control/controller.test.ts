import { randomUUID } from 'node:crypto';
import { afterEach, expect, test } from 'vitest';
import { FlowApiError } from '@flow/client';
import type { ConversationSnapshot, ConversationTurn, TaskSummary } from '@flow/contracts';
import { completeInput, createInteractionController, intentSchema, parseInput, type Intent, type InteractionClient, type InteractionController } from '../index.js';
import type { QueueControlPort } from '../queue-control/index.js';
import type { TaskControlPort } from './index.js';

const controllers: InteractionController[] = [];
afterEach(async () => { for (const controller of controllers.splice(0)) await controller.dispose(); });
const time = '2026-10-06T00:00:00Z';
function fixture(withPort = true) {
  const id = randomUUID(), taskId = randomUUID(), turnId = randomUUID();
  const task: TaskSummary = { id: taskId, title: 'cancel fixture', harness: 'claude', status: 'running', verificationStatus: 'pending', createdAt: time, updatedAt: time };
  const turn: ConversationTurn = { id: turnId, conversationId: id, number: 1, createdAt: time, user: { role: 'user', text: '中文🙂' }, task,
    assistant: { state: 'pending', reason: 'execution-pending' }, effective: { model: null, thinking: 'unknown', tools: null, source: null },
    telemetry: { kind: 'execution', taskId, title: 'Execution' } };
  const snapshot: ConversationSnapshot = { conversation: { id, title: 'Cancel fixture', harness: 'claude', revision: 1,
    requested: { model: 'runner-default', thinking: 'disabled', tools: 'none' }, createdAt: time, updatedAt: time },
    capabilities: { followUp: true, queue: true, steer: false, perTurnModel: false, perTurnThinking: false, perTurnTools: false }, lastTurn: turn, nativeSession: null };
  let turns = [turn], saved: Intent | null = null;
  const requests: { taskId: string; key: string; saved: Intent | null; signal?: AbortSignal }[] = [];
  const client: InteractionClient = {
    conversations: async () => ({ conversations: [snapshot.conversation], nextCursor: null }),
    conversation: async () => structuredClone(snapshot),
    conversationTurns: async () => ({ conversation: structuredClone(snapshot.conversation), turns: structuredClone(turns), nextCursor: null }),
    executionProfiles: async () => ({ profiles: [], nextCursor: null }),
    createConversation: async () => { throw Error('Unexpected create'); },
    submitConversationTurn: async () => { throw Error('Unexpected send'); },
  };
  const port: TaskControlPort = { cancel: async (target, key, signal) => {
    requests.push({ taskId: target, key, saved: structuredClone(saved), signal });
    task.status = 'cancel_requested'; return { ...task, id: target };
  } };
  const queue: QueueControlPort = {
    conversationQueue: async () => ({ conversationId: id, queueRevision: 1, paused: false, blocked: 'previous-turn-active', items: [], nextCursor: null,
      currentTurn: { taskId, turnId, turnNumber: 1, taskStatus: task.status, queueItemId: null } }),
    pauseConversationQueue: async () => { throw Error('Unexpected pause'); },
    resumeConversationQueue: async () => { throw Error('Unexpected resume'); },
  };
  const intents = { load: async () => saved, save: async (value: Intent) => { saved = structuredClone(value); }, clear: async () => { saved = null; } };
  const create = () => {
    const controller = createInteractionController({ client, queue, taskControl: withPort ? port : undefined, connectionId: 'task-test', pollMs: 60_000, intents });
    controllers.push(controller); return controller;
  };
  return { id, taskId, turnId, task, turn, snapshot, client, port, requests, intents, create, controller: create(), saved: () => saved,
    replaceTurn: (next: ConversationTurn) => { turns = [next]; snapshot.lastTurn = next; snapshot.conversation.revision++; } };
}
async function open(f: ReturnType<typeof fixture>) { await f.controller.initialize(); expect((await f.controller.input(`/open ${f.id}`)).code).toBe('OPENED'); }

test('cancel requires an explicit displayed task and an installed transport before any journal write', async () => {
  const f = fixture(); await open(f);
  expect(parseInput(`/cancel ${f.taskId}`)).toEqual({ type: 'cancel', taskId: f.taskId }); expect(completeInput('/can')).toEqual(['/cancel']);
  for (const input of ['/cancel', '/cancel latest', `/cancel ${f.taskId} extra`]) expect((await f.controller.input(input)).code).toBe('INVALID_COMMAND');
  expect((await f.controller.execute({ type: 'cancel', taskId: f.taskId, attemptId: randomUUID() } as never)).code).toBe('INVALID_COMMAND');
  expect((await f.controller.input(`/cancel ${randomUUID()}`)).code).toBe('TASK_NOT_DISPLAYED');
  await f.controller.input('/help'); expect((await f.controller.input(`/cancel ${f.taskId}`)).code).toBe('TASK_NOT_DISPLAYED');
  expect(f.requests).toHaveLength(0); expect(f.saved()).toBeNull();
  const unavailable = fixture(false); await open(unavailable);
  expect((await unavailable.controller.input(`/cancel ${unavailable.taskId}`)).code).toBe('UNSUPPORTED_TASK_CONTROL'); expect(unavailable.saved()).toBeNull();
});

test('the current queue task uses the same durable empty-body intent without pausing or clearing a draft', async () => {
  const f = fixture(); await open(f); await f.controller.input('/queue'); f.controller.setDraft('  keep\n中文🙂  ');
  const response = await f.controller.input(`/cancel ${f.taskId}`);
  expect(response).toMatchObject({ ok: true, code: 'ACCEPTED' }); expect(response.message).toContain('does not prove');
  expect(f.requests).toHaveLength(1); const request = f.requests[0]!;
  expect(request.saved).toEqual({ version: 1, connectionId: 'task-test', key: request.key, kind: 'task-cancel', conversationId: f.id, turnId: f.turnId, taskId: f.taskId, input: {} });
  expect(request.signal).toBeInstanceOf(AbortSignal); expect(f.saved()).toBeNull();
  expect(f.controller.snapshot()).toMatchObject({ draft: '  keep\n中文🙂  ', turns: [{ taskId: f.taskId, status: 'cancel_requested' }] });
  expect(f.controller.snapshot().queue?.paused).toBe(false);
});

test('lost ACK survives a new controller and retries only the original task/key after another client changes the latest turn', async () => {
  const f = fixture(); await open(f); const cancel = f.port.cancel; let lost = true;
  f.port.cancel = async (...args) => { const receipt = await cancel(...args); if (lost) throw Error('ACK lost'); return receipt; };
  expect((await f.controller.input(`/cancel ${f.taskId}`)).code).toBe('UNKNOWN'); const original = structuredClone(f.saved());
  await f.controller.dispose();
  const nextTaskId = randomUUID(); f.replaceTurn({ ...f.turn, id: randomUUID(), number: 2, task: { ...f.task, id: nextTaskId, status: 'running' }, telemetry: { kind: 'execution', taskId: nextTaskId, title: 'New execution' } });
  const restored = f.create(); await restored.initialize(); expect(f.requests).toHaveLength(1);
  expect((await restored.input(`/cancel ${nextTaskId}`)).code).toBe('UNRESOLVED'); expect(f.saved()).toEqual(original);
  lost = false; expect((await restored.input('/recover')).code).toBe('ACCEPTED');
  expect(f.requests.map(({ taskId, key, saved }) => ({ taskId, key, saved }))).toEqual([
    { taskId: f.taskId, key: original!.key, saved: original }, { taskId: f.taskId, key: original!.key, saved: original },
  ]);
  expect(restored.snapshot().turns[0]).toMatchObject({ taskId: nextTaskId, status: 'running' }); expect(f.saved()).toBeNull();
});

test('malformed or wrong-task ACK is unknown; a replay receipt cannot replace newer uncertain facts', async () => {
  for (const kind of ['wrong-id', 'missing-id', 'active-state']) {
    const f = fixture(); await open(f); const cancel = f.port.cancel;
    f.port.cancel = async (...args) => {
      const value = await cancel(...args);
      return { ...value, id: kind === 'wrong-id' ? randomUUID() : kind === 'missing-id' ? undefined : value.id,
        status: kind === 'active-state' ? 'running' : value.status } as TaskSummary;
    };
    expect((await f.controller.input(`/cancel ${f.taskId}`)).code).toBe('UNKNOWN'); expect(f.saved()).toMatchObject({ taskId: f.taskId, input: {} });
  }
  const f = fixture(); await open(f);
  f.port.cancel = async () => { f.task.status = 'uncertain'; return { ...f.task, status: 'cancel_requested' }; };
  expect((await f.controller.input(`/cancel ${f.taskId}`)).code).toBe('ACCEPTED');
  expect(f.controller.snapshot().turns[0]?.status).toBe('uncertain');
});

test('a deterministic rejection preserves the draft and recovery observes without another cancellation', async () => {
  const f = fixture(); await open(f); let posts = 0;
  f.port.cancel = async () => { posts++; f.task.status = 'succeeded'; throw new FlowApiError(403, 'forbidden', 'rejected'); };
  f.controller.setDraft('do not submit\n中文'); expect((await f.controller.input(`/cancel ${f.taskId}`)).code).toBe('HTTP_403');
  expect(f.saved()).toBeNull(); expect(f.controller.snapshot()).toMatchObject({ draft: 'do not submit\n中文', turns: [{ status: 'succeeded' }] });
  await f.controller.input('/recover'); expect(posts).toBe(1);
});

test('disconnect and quit never cancel; a late cancellation ACK retains the original intent', async () => {
  const idle = fixture(); await open(idle); await idle.controller.input('/disconnect'); await idle.controller.input('/quit'); expect(idle.requests).toHaveLength(0);
  const f = fixture(); await open(f); let finish!: (task: TaskSummary) => void; let entered!: () => void;
  const started = new Promise<void>(resolve => { entered = resolve; });
  f.port.cancel = () => { entered(); return new Promise(resolve => { finish = resolve; }); };
  const posting = f.controller.input(`/cancel ${f.taskId}`); await started;
  await f.controller.input('/disconnect'); finish({ ...f.task, status: 'cancelled' });
  expect((await posting).code).toBe('UNKNOWN'); expect(f.saved()).toMatchObject({ taskId: f.taskId });
  expect(f.controller.snapshot()).toMatchObject({ connected: false, pending: { kind: 'task-cancel', status: 'unknown' } });
});

test('the public journal codec preserves old version-one entries and rejects extra cancellation scope', () => {
  const f = fixture(); const identity = { version: 1 as const, connectionId: 'task-test', key: randomUUID() };
  const old = [
    { ...identity, kind: 'create', input: { title: 'Legacy', harness: 'claude', requested: f.snapshot.conversation.requested } },
    { ...identity, kind: 'send', conversationId: f.id, input: { text: '中文', expectedRevision: 1, mode: 'follow-up' } },
    { ...identity, kind: 'queue-pause', conversationId: f.id, input: { expectedQueueRevision: 1 } },
    { ...identity, kind: 'queue-resume', conversationId: f.id, input: { expectedQueueRevision: 1, expectedTaskId: f.taskId } },
  ];
  for (const entry of old) expect(intentSchema.parse(JSON.parse(JSON.stringify(entry)))).toEqual(entry);
  const cancel = { ...identity, kind: 'task-cancel', conversationId: f.id, turnId: f.turnId, taskId: f.taskId, input: {} };
  expect(intentSchema.parse(cancel)).toEqual(cancel);
  expect(() => intentSchema.parse({ ...cancel, input: { attemptId: randomUUID() } })).toThrow();
  expect(() => intentSchema.parse({ ...cancel, target: 'latest' })).toThrow();
});
