import { afterEach, expect, test, vi } from 'vitest';
import { FlowApiError } from '@flow/client';
import { randomUUID } from 'node:crypto';
import type { ConversationCreated, ConversationCreation, ConversationSnapshot, ConversationSummary, ConversationTurn } from '@flow/contracts';
import type { ObservationClient } from './observation/index.js';
import { createInteractionController, parseInput, completeInput, terminalText, type Intent, type InteractionClient, type InteractionController, type IntentStore } from './index.js';
const id = randomUUID();
const conversation: ConversationSummary = { id, title: 'Saved conversation', harness: 'claude', requested: { model: 'runner-default', thinking: 'disabled', tools: 'configured-readonly' }, revision: 0, createdAt: '2026-01-01', updatedAt: '2026-01-01' };
const snapshot: ConversationSnapshot = { conversation, capabilities: { followUp: true, queue: false, steer: false, perTurnModel: false, perTurnThinking: false, perTurnTools: false }, nativeSession: null, lastTurn: null };
const created: ConversationCreated = { conversation, capabilities: snapshot.capabilities, replayed: false };
const controllers: InteractionController[] = [];
afterEach(async () => { await Promise.all(controllers.splice(0).map(controller => controller.dispose())); vi.useRealTimers(); });
function setup(overrides: Partial<InteractionClient> = {}, initial: Intent | null = null) {
  let saved = initial; const writes: unknown[] = []; const calls: { input: unknown; key: string }[] = [];
  const store: IntentStore = { load: async () => saved, save: async intent => { saved = structuredClone(intent); writes.push(saved); }, clear: async () => { saved = null; writes.push(null); } };
  const client: InteractionClient = {
    conversations: async () => ({ conversations: [conversation], nextCursor: null }), conversation: async () => snapshot,
    conversationTurns: async () => ({ conversation, turns: [], nextCursor: null }), executionProfiles: async () => ({ profiles: [], nextCursor: null }),
    createConversation: async (input, key) => { calls.push({ input, key }); return { ...created, conversation: { ...conversation, ...input } }; },
    submitConversationTurn: async () => { throw new Error('No fixture turn configured'); }, ...overrides,
  };
  const controller = createInteractionController({ client, intents: store, connectionId: 'test-connection', pollMs: 60_000 }); controllers.push(controller);
  return { controller, calls, writes, saved: () => saved };
}
test('descriptors parse commands, complete names and preserve ordinary text exactly', () => {
  expect(parseInput('  hi\n中文🙂  ')).toEqual({ type: 'send', text: '  hi\n中文🙂  ' });
  expect(parseInput('/new --profile 00000000-0000-4000-8000-000000000001 Hello')).toEqual({ type: 'new', profileId: '00000000-0000-4000-8000-000000000001', title: 'Hello' });
  expect(completeInput('/pro')).toEqual(['/profiles']); expect(() => parseInput('/steer x')).toThrow();
});
test('help is offline and creation persists before the typed client mutation', async () => {
  const { controller, calls, writes, saved } = setup(); await controller.initialize();
  expect((await controller.input('/help')).message).toContain('/recover'); expect(calls).toHaveLength(0);
  expect((await controller.execute({ type: 'new', title: 'Hello' })).code).toBe('ACCEPTED');
  expect(writes[0]).toMatchObject({ kind: 'create', input: { title: 'Hello' } }); expect(calls[0]?.key).toBe((writes[0] as Intent).key);
  expect(saved()).toBeNull(); expect(controller.snapshot().selected?.id).toBe(id);
});
test('lost creation ACK retains the immutable body/key and only explicit recover replays it', async () => {
  const seen: { input: unknown; key: string }[] = [];
  const { controller, saved } = setup({ createConversation: async (input, key) => { seen.push({ input, key }); if (seen.length === 1) throw new Error('lost ACK'); return { ...created, conversation: { ...conversation, ...input }, replayed: true }; } });
  await controller.initialize(); expect((await controller.input('/new Unchanged')).code).toBe('UNKNOWN');
  expect((await controller.input('/new replacement')).code).toBe('UNRESOLVED'); expect(seen).toHaveLength(1);
  expect(saved()).toMatchObject({ kind: 'create', input: { title: 'Unchanged' } });
  expect((await controller.input('/recover')).ok).toBe(true); expect(seen[1]).toEqual(seen[0]); expect(saved()).toBeNull();
});
test('startup with saved intent sends nothing and rejects a different connection binding', async () => {
  const intent: Intent = { version: 1, connectionId: 'test-connection', key: randomUUID(), kind: 'create', input: { title: 'Recover me', harness: 'claude', requested: conversation.requested } };
  const { controller, calls } = setup({}, intent); await controller.initialize(); expect(calls).toHaveLength(0); expect(controller.snapshot().pending?.status).toBe('unknown');
  const wrong = setup({}, { ...intent, connectionId: 'another' }); await expect(wrong.controller.initialize()).rejects.toThrow('another connection');
});
test('disconnect ignores a late read from the old epoch and does not cancel center work', async () => {
  let resolve!: (value: ConversationSnapshot) => void;
  const { controller } = setup({ conversation: () => new Promise(done => { resolve = done; }) }); await controller.initialize();
  const opening = controller.execute({ type: 'open', id }); await Promise.resolve(); controller.disconnect(); resolve(snapshot); await opening;
  expect(controller.snapshot().selected).toBeNull(); expect(controller.snapshot().connected).toBe(false);
});
test('disconnect during a mutation keeps unknown and quit waits for local cleanup only', async () => {
  let resolve!: (value: ConversationCreated) => void;
  const { controller, saved } = setup({ createConversation: () => new Promise(done => { resolve = done; }) }); await controller.initialize();
  const sending = controller.input('/new interrupted'); await Promise.resolve(); await Promise.resolve();
  controller.disconnect(); resolve(created); expect((await sending).code).toBe('UNKNOWN');
  await controller.dispose(); expect(saved()).not.toBeNull(); expect(controller.snapshot().closed).toBe(true);
});
test('raw draft is preserved while terminal display escapes OSC, ANSI and bidi controls', async () => {
  const { controller } = setup(); await controller.initialize();
  const raw = '\u001b]52;c;secret\u0007 中文🙂\u202e'; expect(controller.setDraft(raw)).toBe(true); expect(controller.snapshot().draft).toBe(raw);
  const display = terminalText(raw); expect(display).not.toMatch(/[\x1b\x07\u202e]/); expect(display).toContain('中文🙂');
  expect(controller.setDraft('x'.repeat(16_001))).toBe(false); expect(controller.snapshot().draft).toBe(raw);
});

test('disconnect during durable save never dispatches a new POST on the replacement epoch', async () => {
  let release!: () => void; let saved: Intent | null = null; let posts = 0;
  const client = { createConversation: async () => { posts++; return created; } } as unknown as InteractionClient;
  const controller = createInteractionController({ client, connectionId: 'test-connection', intents: {
    load: async () => null,
    save: async value => { saved = value; await new Promise<void>(done => { release = done; }); }, clear: async () => {},
  } }); controllers.push(controller); await controller.initialize();
  const posting = controller.input('/new interrupted before dispatch'); await Promise.resolve(); controller.disconnect(); release();
  expect((await posting).code).toBe('UNKNOWN'); expect(posts).toBe(0); expect(saved).not.toBeNull();
});
test('disconnect during ACK journal cleanup cannot reselect or reconnect the old epoch', async () => {
  let release!: () => void; let entered!: () => void;
  const clearing = new Promise<void>(done => { entered = done; });
  const client = { createConversation: async (input: ConversationCreation) => ({ ...created, conversation: { ...conversation, ...input } }) } as unknown as InteractionClient;
  const controller = createInteractionController({ client, connectionId: 'test-connection', intents: {
    load: async () => null, save: async () => {}, clear: async () => { entered(); await new Promise<void>(done => { release = done; }); },
  } }); controllers.push(controller); await controller.initialize();
  const posting = controller.input('/new accepted before disconnect'); await clearing; controller.disconnect(); release();
  expect((await posting).code).toBe('ACCEPTED'); expect(controller.snapshot().selected).toBeNull();
  expect(controller.snapshot().connected).toBe(false); expect(controller.snapshot().pending).toBeNull();
});

test('saved unsupported queue intent is rejected without dispatch', async () => {
  const { controller, calls } = setup({}, { version: 1, connectionId: 'test-connection', key: randomUUID(), kind: 'send', conversationId: id,
    input: { text: 'Do not dispatch', expectedRevision: 0, mode: 'queue' } } as unknown as Intent);
  await expect(controller.initialize()).rejects.toThrow(); expect(calls).toHaveLength(0);
});

test('discovery pages remain selectable while a conversation is open and expose every bounded row', async () => {
  let limit: number | undefined;
  const { controller } = setup({ conversations: async options => { limit = options?.limit; return { conversations: [conversation], nextCursor: 'next-page' }; } });
  await controller.initialize(); await controller.execute({ type: 'open', id }); expect(controller.snapshot().view).toBe('conversation');
  await controller.input('/conversations'); expect(limit).toBe(6); expect(controller.snapshot().view).toBe('conversations');
  expect(controller.snapshot().selected?.id).toBe(id); expect(controller.snapshot().conversationCursor).toBe('next-page');
  await controller.input('/profiles'); expect(controller.snapshot().view).toBe('profiles');
});


test('a stale send rejection preserves the draft, reloads only observations and resumes polling', async () => {
  vi.useFakeTimers(); let reads = 0; let sends = 0; let revision = 0;
  const { controller, saved } = setup({
    conversation: async () => { reads++; return { ...snapshot, conversation: { ...conversation, revision } }; },
    conversationTurns: async () => ({ conversation: { ...conversation, revision }, turns: [], nextCursor: null }),
    submitConversationTurn: async () => { sends++; throw new FlowApiError(409, 'conversation_revision_conflict', 'Other client already submitted'); },
  });
  await controller.initialize(); await controller.execute({ type: 'open', id });
  controller.setDraft('Unsent original draft'); revision = 1;
  expect((await controller.execute({ type: 'send', text: 'Unsent original draft' })).code).toBe('HTTP_409');
  expect(controller.snapshot().draft).toBe('Unsent original draft'); expect(saved()).toBeNull();
  expect(controller.snapshot().selected?.revision).toBe(1); expect(controller.snapshot().connected).toBe(true);
  const before = reads; await vi.advanceTimersByTimeAsync(60_001);
  expect(reads).toBeGreaterThan(before); expect(sends).toBe(1);
});
test('a failed explicit observation recovery becomes disconnected instead of a silent connected non-poller', async () => {
  let fail = false;
  const { controller } = setup({ conversation: async () => { if (fail) throw Error('synthetic read failure'); return snapshot; } });
  await controller.initialize(); await controller.execute({ type: 'open', id }); fail = true;
  expect((await controller.execute({ type: 'recover' })).ok).toBe(false);
  expect(controller.snapshot().connected).toBe(false);
});

test.each([false, true])('confirmed new conversation resets the old focused turn (lost ACK: %s)', async lostAck => {
  const first = { ...conversation, revision: 3 };
  let second = { ...conversation, id: randomUUID(), title: 'Second conversation' };
  const turn = (owner: ConversationSummary, number: number, text: string): ConversationTurn => {
    const taskId = randomUUID();
    return { id: randomUUID(), conversationId: owner.id, number, createdAt: owner.createdAt,
      user: { role: 'user', text }, task: { id: taskId, title: owner.title, harness: 'claude', status: 'running',
        verificationStatus: 'pending', createdAt: owner.createdAt, updatedAt: owner.updatedAt },
      assistant: { state: 'pending', reason: 'execution-pending' }, effective: { model: null, thinking: 'unknown', tools: null, source: null },
      telemetry: { kind: 'execution', taskId, title: 'Execution' } };
  };
  const firstTurns = [1, 2, 3].map(number => turn(first, number, 'Earlier message'));
  const secondTurns: ConversationTurn[] = [];
  const requests: { input: ConversationCreation; key: string }[] = [];
  const activityTasks: string[] = [];
  let saved: Intent | null = null;
  const client: InteractionClient = {
    conversations: async () => ({ conversations: [first], nextCursor: null }), executionProfiles: async () => ({ profiles: [], nextCursor: null }),
    conversation: async id => ({ ...snapshot, conversation: id === first.id ? first : second,
      lastTurn: (id === first.id ? firstTurns : secondTurns).at(-1) ?? null }),
    conversationTurns: async id => ({ conversation: id === first.id ? first : second, turns: id === first.id ? firstTurns : secondTurns, nextCursor: null }),
    createConversation: async (input, key) => {
      requests.push({ input, key });
      if (lostAck && requests.length === 1) throw Error('Accepted create; acknowledgement lost');
      return { ...created, conversation: second, replayed: lostAck };
    },
    submitConversationTurn: async (id, input) => {
      expect(id).toBe(second.id); expect(input.expectedRevision).toBe(0);
      second = { ...second, revision: 1 }; const accepted = turn(second, 1, input.text); secondTurns.push(accepted);
      return { conversation: second, turn: accepted, replayed: false };
    },
  };
  const noBody = async (): Promise<never> => { throw Error('Unexpected detail or stream request'); };
  const observe: ObservationClient = { assistantStream: noBody, assistantStreamPatches: noBody, nativeActivity: noBody, conversationDetail: noBody,
    nativeActivities: async taskId => { activityTasks.push(taskId); return { activities: [], nextCursor: null }; } };
  const controller = createInteractionController({ client, observe, connectionId: 'test-connection', pollMs: 60_000,
    intents: { load: async () => null, save: async value => { saved = value; }, clear: async () => { saved = null; } } });
  controllers.push(controller); await controller.initialize();
  expect((await controller.input('/open ' + first.id)).ok).toBe(true);
  expect((await controller.input('/turn 3')).ok).toBe(true);
  expect(controller.snapshot().observation?.turnId).toBe(firstTurns[2]!.id);
  const creating = await controller.input('/new Second conversation');
  if (lostAck) {
    expect(creating.code).toBe('UNKNOWN'); expect(saved).not.toBeNull();
    expect(controller.snapshot().selected?.id).toBe(first.id);
    expect(controller.snapshot().observation?.turnId).toBe(firstTurns[2]!.id);
    expect((await controller.input('/recover')).code).toBe('ACCEPTED'); expect(requests[1]).toEqual(requests[0]);
  } else expect(creating.code).toBe('ACCEPTED');
  expect(saved).toBeNull(); expect(controller.snapshot().observation).toBeNull();
  expect((await controller.input('First message in second conversation')).code).toBe('ACCEPTED');
  expect(controller.snapshot().observation).toMatchObject({ turnId: secondTurns[0]!.id, number: 1 });
  expect((await controller.input('/activity')).ok).toBe(true);
  expect(activityTasks).toEqual([secondTurns[0]!.task.id]);
});
