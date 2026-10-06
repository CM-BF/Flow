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
