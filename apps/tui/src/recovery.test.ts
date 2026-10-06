import { afterEach, expect, test } from 'vitest';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FlowClient } from '@flow/client';
import type { ConversationCreated, ConversationSnapshot, ConversationTurnAccepted } from '@flow/contracts';
import { createInteractionController, type Intent, type InteractionClient } from '@flow/interaction';
import { openIntentStore } from './intent-store.js';
import { closeTerminalResources } from './lifecycle.js';
const closers: (() => Promise<void>)[] = [];
afterEach(async () => { for (const close of closers.splice(0).reverse()) await close(); });
const connectionId = 'd'.repeat(64);
test('deferred save rejection with concurrent dispose settles and permits the private journal to reopen', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'flow-tui01a-recovery-')); closers.push(() => rm(directory, { recursive: true, force: true }));
  const journal = await openIntentStore(directory, connectionId); closers.push(() => journal.close());
  let rejectSave!: (error: Error) => void; let entered!: () => void; let posts = 0;
  const saving = new Promise<void>(done => { entered = done; });
  const controller = createInteractionController({ connectionId, client: { createConversation: async () => { posts++; throw new Error('Unexpected POST'); } } as unknown as InteractionClient,
    intents: { load: () => journal.load(), clear: () => journal.clear(), save: async () => { entered(); await new Promise<void>((_done, reject) => { rejectSave = reject; }); } } });
  await controller.initialize(); const sending = controller.input('/new deferred disk failure'); await saving;
  let unmounted = false;
  const disposing = controller.dispose();
  const closing = closeTerminalResources({ settle: controller.dispose, unmount: () => { unmounted = true; }, closeJournal: journal.close });
  rejectSave(new Error('synthetic ENOSPC'));
  expect((await sending).code).toBe('READ_FAILED'); await expect(disposing).resolves.toBeUndefined();
  expect(posts).toBe(0); await closing; expect(unmounted).toBe(true);
  const reopened = await openIntentStore(directory, connectionId); await reopened.close();
});
function accepted(): ConversationCreated {
  return { conversation: { id: randomUUID(), title: 'Original', harness: 'claude', requested: { model: 'runner-default', thinking: 'disabled', tools: 'configured-readonly' }, revision: 0, createdAt: '2026-10-06T00:00:00Z', updatedAt: '2026-10-06T00:00:00Z' },
    capabilities: { followUp: true, queue: false, steer: false, perTurnModel: false, perTurnThinking: false, perTurnTools: false }, replayed: true };
}
async function httpFixture(bad: (value: unknown) => unknown, kind: 'create' | 'send') {
  const creation = accepted(); const conversation = creation.conversation; const posts: { key: string | undefined; body: string }[] = [];
  const turn: ConversationTurnAccepted = { conversation: { ...conversation, revision: 1 }, replayed: true, turn: {
    id: randomUUID(), conversationId: conversation.id, number: 1, createdAt: conversation.createdAt,
    user: { role: 'user', text: '  Exact original 中文🙂\n' },
    task: { id: randomUUID(), title: conversation.title, harness: 'claude', status: 'queued', verificationStatus: 'pending', createdAt: conversation.createdAt, updatedAt: conversation.updatedAt },
    assistant: { state: 'pending', reason: 'execution-pending' }, effective: { model: null, thinking: 'unknown', tools: null, source: null },
    telemetry: { kind: 'execution', taskId: '', title: 'Execution' },
  } }; turn.turn.telemetry.taskId = turn.turn.task.id;
  const snapshot: ConversationSnapshot = { conversation, capabilities: creation.capabilities, nativeSession: null, lastTurn: null };
  const server = createServer(async (request, response) => {
    const chunks: Buffer[] = []; for await (const chunk of request) chunks.push(chunk as Buffer);
    let value: unknown;
    if (request.method === 'POST') {
      posts.push({ key: request.headers['idempotency-key'] as string | undefined, body: Buffer.concat(chunks).toString() });
      const valid = kind === 'create' ? creation : turn; value = posts.length === 1 ? bad(structuredClone(valid)) : valid;
    } else if (request.url?.includes('/turns')) value = { conversation: posts.length > 1 && kind === 'send' ? turn.conversation : conversation, turns: [], nextCursor: null };
    else value = snapshot;
    response.writeHead(200, { 'content-type': 'application/json' }); response.end(JSON.stringify(value));
  });
  await new Promise<void>(done => server.listen(0, '127.0.0.1', done));
  closers.push(async () => { server.closeAllConnections(); await new Promise<void>(done => server.close(() => done())); });
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('Fixture port missing');
  let saved: Intent | null = null;
  const controller = createInteractionController({ client: new FlowClient({ baseUrl: `http://127.0.0.1:${address.port}`, token: 'synthetic-owner' }), connectionId, pollMs: 60_000,
    intents: { load: async () => saved, save: async value => { saved = structuredClone(value); }, clear: async () => { saved = null; } } });
  closers.push(() => controller.dispose()); await controller.initialize();
  if (kind === 'send') expect((await controller.execute({ type: 'open', id: conversation.id })).code).toBe('OPENED');
  const response = await controller.execute(kind === 'create' ? { type: 'new', title: 'Original' } : { type: 'send', text: turn.turn.user.text });
  expect(response.code).toBe('UNKNOWN'); expect(saved).not.toBeNull(); expect(posts).toHaveLength(1);
  expect((await controller.execute({ type: 'recover' })).code).toBe('ACCEPTED');
  expect(posts).toHaveLength(2); expect(posts[1]).toEqual(posts[0]); expect(saved).toBeNull();
}
test('HTTP 200 empty create ACK preserves the original request and explicit recovery identity', () => httpFixture(() => ({}), 'create'));
test('HTTP 200 mismatched creation fields preserve the original request', () => httpFixture(value => ({ ...value as ConversationCreated, conversation: { ...(value as ConversationCreated).conversation, title: 'Different' } }), 'create'));
test.each(['text', 'conversation', 'number', 'task'] as const)('HTTP 200 send ACK with wrong %s keeps the exact original request', field => httpFixture(value => {
  const ack = value as ConversationTurnAccepted;
  if (field === 'text') ack.turn.user.text = 'Different';
  if (field === 'conversation') ack.turn.conversationId = randomUUID();
  if (field === 'number') ack.turn.number = 2;
  if (field === 'task') ack.turn.task.id = '';
  return ack;
}, 'send'));

test('independent terminal cleanup closes the journal even when settle and unmount fail', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'flow-tui01a-cleanup-')); closers.push(() => rm(directory, { recursive: true, force: true }));
  const journal = await openIntentStore(directory, connectionId); closers.push(() => journal.close()); let unmounted = false;
  await expect(closeTerminalResources({ settle: async () => { throw new Error('Synthetic settle failure'); },
    unmount: () => { unmounted = true; throw new Error('Synthetic unmount failure'); }, closeJournal: journal.close })).rejects.toThrow();
  expect(unmounted).toBe(true); const reopened = await openIntentStore(directory, connectionId); await reopened.close();
});


test('two public HTTP clients alternate turns, preserve a stale draft, recover the original ACK and observe work after one disconnects', async () => {
  // A bounded HTTP contract fixture; no real runner/PG/provider and no claim of native execution.
  const creation = accepted(); let conversation = structuredClone(creation.conversation);
  const turns: ConversationTurnAccepted['turn'][] = [];
  const receipts = new Map<string, { body: string; value: ConversationTurnAccepted }>();
  const posts: { path: string; key?: string; body: string }[] = [];
  let hideNextAck = false; let failReads = false; let reads = 0; let rightSubmitted = false;
  const server = createServer(async (request, response) => {
    const pieces: Buffer[] = []; for await (const piece of request) pieces.push(piece as Buffer);
    const body = Buffer.concat(pieces).toString(); const key = request.headers['idempotency-key'] as string | undefined;
    let value: unknown; let status = 200;
    if (request.method === 'POST') {
      posts.push({ path: request.url!, key, body }); const input = JSON.parse(body);
      if (request.headers.authorization === 'Bearer synthetic-right') rightSubmitted = true;
      const old = key ? receipts.get(key) : undefined;
      if (old) {
        if (old.body !== body) { status = 409; value = { error: { code: 'idempotency_conflict', message: 'different original body' } }; }
        else value = { ...old.value, replayed: true };
      } else if (!request.url?.endsWith('/turns') || input.expectedRevision !== conversation.revision) {
        status = 409; value = { error: { code: 'conversation_revision_conflict', message: 'another client advanced the conversation' } };
      } else {
        const taskId = randomUUID(); conversation = { ...conversation, revision: conversation.revision + 1 };
        const turn: ConversationTurnAccepted['turn'] = { id: randomUUID(), conversationId: conversation.id, number: conversation.revision, createdAt: conversation.createdAt,
          user: { role: 'user', text: input.text }, task: { id: taskId, title: conversation.title, harness: 'claude', status: 'running', verificationStatus: 'pending', createdAt: conversation.createdAt, updatedAt: conversation.updatedAt },
          assistant: { state: 'pending', reason: 'execution-pending' }, effective: { model: null, tools: null, thinking: 'unknown', source: null }, telemetry: { kind: 'execution', taskId, title: 'Fixture execution' } };
        turns.push(turn); const receipt: ConversationTurnAccepted = { conversation: structuredClone(conversation), turn: structuredClone(turn), replayed: false };
        receipts.set(key!, { body, value: receipt }); value = hideNextAck ? {} : receipt; hideNextAck = false;
      }
    } else {
      reads++;
      if (failReads) { status = 503; value = { error: { code: 'synthetic_read_failure', message: 'read unavailable' } }; }
      else {
        // Freeze only the right client's initial read view until it attempts its stale CAS.
        // This avoids timing the conflict against the 100ms observer under shared-host load.
        const initialRight = request.headers.authorization === 'Bearer synthetic-right' && !rightSubmitted;
        const visibleConversation = initialRight ? creation.conversation : conversation; const visibleTurns = initialRight ? [] : turns;
        value = request.url?.includes('/turns') ? { conversation: visibleConversation, turns: visibleTurns, nextCursor: null }
          : { conversation: visibleConversation, capabilities: creation.capabilities, nativeSession: null, lastTurn: visibleTurns.at(-1) ?? null };
      }
    }
    response.writeHead(status, { 'content-type': 'application/json' }); response.end(JSON.stringify(value));
  });
  await new Promise<void>(done => server.listen(0, '127.0.0.1', done));
  closers.push(() => new Promise<void>(done => { server.closeAllConnections(); server.close(() => done()); }));
  const address = server.address(); if (!address || typeof address === 'string') throw Error('Fixture address missing');
  const options = { baseUrl: `http://127.0.0.1:${address.port}`, token: 'synthetic-owner' };
  const leftClient = new FlowClient(options); const rightClient = new FlowClient({ ...options, token: 'synthetic-right' });
  const state = () => { let pending: Intent | null = null; return { load: async () => pending, save: async (value: Intent) => { pending = structuredClone(value); }, clear: async () => { pending = null; }, current: () => pending }; };
  const leftStore = state(); const rightStore = state();
  const left = createInteractionController({ client: leftClient, connectionId: 'left', intents: leftStore, pollMs: 60_000 });
  const right = createInteractionController({ client: rightClient, connectionId: 'right', intents: rightStore, pollMs: 100 });
  closers.push(() => left.dispose(), () => right.dispose());
  await left.initialize(); await right.initialize(); await left.execute({ type: 'open', id: conversation.id }); await right.execute({ type: 'open', id: conversation.id });
  const waitFor = async (ready: () => boolean) => { for (let attempt = 0; attempt < 100 && !ready(); attempt++) await new Promise(done => setTimeout(done, 10)); expect(ready()).toBe(true); };
  left.setDraft('First by left'); expect((await left.execute({ type: 'send', text: 'First by left' })).code).toBe('ACCEPTED');
  right.setDraft('  Preserved right draft 中文🙂\n'); const originalDraft = right.snapshot().draft;
  expect((await right.execute({ type: 'send', text: originalDraft })).code).toBe('HTTP_409');
  expect(right.snapshot().draft).toBe(originalDraft); expect(right.snapshot().selected?.revision).toBe(1); expect(rightStore.current()).toBeNull();
  const before = reads; await waitFor(() => reads > before); expect(posts).toHaveLength(2);
  turns[0]!.task.status = 'succeeded'; hideNextAck = true;
  expect((await right.execute({ type: 'send', text: originalDraft })).code).toBe('UNKNOWN');
  expect(rightStore.current()).not.toBeNull(); const originalPost = posts[2]!;
  expect((await left.execute({ type: 'quit' })).code).toBe('QUIT');
  expect(turns[1]!.task.status).toBe('running'); expect(posts).toHaveLength(3);
  await waitFor(() => right.snapshot().turns.at(-1)?.status === 'running');
  turns[1]!.task.status = 'succeeded'; await waitFor(() => right.snapshot().turns.at(-1)?.status === 'succeeded');
  // The separate public client advances once more while the terminal still holds turn 2's unknown ACK.
  await leftClient.submitConversationTurn(conversation.id, { expectedRevision: 2, text: 'Third explicit turn', mode: 'follow-up' }, randomUUID());
  await waitFor(() => right.snapshot().selected?.revision === 3);
  expect((await right.execute({ type: 'recover' })).code).toBe('ACCEPTED');
  expect(posts[4]).toEqual(originalPost); expect(posts).toHaveLength(5); expect(rightStore.current()).toBeNull();
  expect(right.snapshot().turns[1]?.status).toBe('succeeded'); expect(right.snapshot().selected?.revision).toBe(3);
  turns[2]!.task.status = 'succeeded'; await waitFor(() => right.snapshot().turns.at(-1)?.status === 'succeeded');
  expect((await leftClient.conversation(conversation.id)).lastTurn?.task.status).toBe('succeeded');
  expect(posts.every(post => post.path.endsWith('/turns'))).toBe(true);
  failReads = true; expect((await right.execute({ type: 'recover' })).ok).toBe(false); expect(right.snapshot().connected).toBe(false);
});
