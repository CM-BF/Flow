import { afterEach, expect, test } from 'vitest';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { FlowClient } from './index.js';
import { conversationCreationSchema, type ConversationCreated, type ConversationTurnAccepted } from '@flow/contracts';
const closers: (() => Promise<void>)[] = [];
afterEach(async () => { for (const close of closers.splice(0).reverse()) await close(); });
const creation = conversationCreationSchema.parse({ title: 'Original' });
function created(): ConversationCreated {
  return { conversation: { ...creation, id: randomUUID(), revision: 0, createdAt: '2026-10-06T00:00:00Z', updatedAt: '2026-10-06T00:00:00Z' },
    capabilities: { followUp: true, queue: false, steer: false, perTurnModel: false, perTurnThinking: false, perTurnTools: false }, replayed: false };
}
function accepted(): ConversationTurnAccepted {
  const value = created(); const id = randomUUID();
  return { conversation: { ...value.conversation, revision: 1 }, replayed: false, turn: {
    id: randomUUID(), conversationId: value.conversation.id, number: 1, createdAt: value.conversation.createdAt,
    user: { role: 'user', text: '  Original 中文🙂\n' },
    task: { id, title: value.conversation.title, harness: 'claude', status: 'queued', verificationStatus: 'pending', createdAt: value.conversation.createdAt, updatedAt: value.conversation.updatedAt },
    effective: { model: null, tools: null, thinking: 'unknown', source: null }, assistant: { state: 'pending', reason: 'execution-pending' },
    telemetry: { kind: 'execution', taskId: id, title: 'Execution' },
  } };
}
async function http(reply: (body: string, key: string | undefined) => string | Promise<string>) {
  const requests: { body: string; key?: string }[] = [];
  const server = createServer(async (request, response) => {
    const pieces: Buffer[] = []; for await (const piece of request) pieces.push(piece as Buffer);
    const body = Buffer.concat(pieces).toString(); const key = request.headers['idempotency-key'] as string | undefined;
    requests.push({ body, key }); response.setHeader('content-type', 'application/json'); response.end(await reply(body, key));
  });
  await new Promise<void>(done => server.listen(0, '127.0.0.1', done));
  closers.push(() => new Promise<void>(done => { server.closeAllConnections(); server.close(() => done()); }));
  const address = server.address(); if (!address || typeof address === 'string') throw Error('Fixture address missing');
  return { client: new FlowClient({ baseUrl: `http://127.0.0.1:${address.port}`, token: 'synthetic-owner' }), requests };
}
test.each(['{}', '{not-json', 'null'])('HTTP 200 unconfirmed creation ACK %s is unknown without hidden retry or raw data', async raw => {
  const { client, requests } = await http(() => raw);
  await expect(client.createConversation(creation, 'original-key')).rejects.toMatchObject({ code: 'conversation_ack_unknown' });
  expect(requests).toEqual([{ key: 'original-key', body: JSON.stringify(creation) }]);
});
test('HTTP request identity is captured from the sent bytes before the caller can mutate its input', async () => {
  const value = created(); const input = structuredClone(creation);
  const { client, requests } = await http(() => JSON.stringify(value));
  const sending = client.createConversation(input, 'frozen-key'); input.title = 'Later title'; input.requested.model = 'Later model';
  expect((await sending).conversation.title).toBe('Original');
  expect(requests).toEqual([{ key: 'frozen-key', body: JSON.stringify(creation) }]);
});
test('HTTP mismatched accepted turn is unknown and never becomes delivery success', async () => {
  const value = accepted(); const input = { expectedRevision: 0, text: value.turn.user.text, mode: 'follow-up' as const };
  value.turn.conversationId = randomUUID();
  const { client, requests } = await http(() => JSON.stringify(value));
  await expect(client.submitConversationTurn(value.conversation.id, input, 'turn-key')).rejects.toMatchObject({ code: 'conversation_ack_unknown' });
  expect(requests).toHaveLength(1);
});
