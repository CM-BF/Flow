import { createServer } from 'node:http';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import type { ClaudeTurnSettings, ConversationQueueAccepted, ConversationQueueEnqueue } from '@flow/contracts';
import type { AddressInfo } from 'node:net';
import { expect, it } from 'vitest';
import { FlowClient, decodeConversationQueueAccepted, UnknownConversationAcknowledgementError } from './index.js';

function queuedSettings() {
  const snapshot: ClaudeTurnSettings = { protocol: 'flow.claude-turn-settings.v1',
    profile: { id: randomUUID(), runnerId: randomUUID(), configDigest: 'a'.repeat(64) },
    requested: { model: 'configured-alias', thinking: 'adaptive', effort: { kind: 'level', value: 'high' }, speed: 'fast' } };
  const input: ConversationQueueEnqueue = { expectedQueueRevision: 3, text: '  Queued 中文🙂\n', messageSettings: snapshot };
  const receipt: ConversationQueueAccepted = { conversationId: randomUUID(), queueRevision: 4, replayed: false,
    item: { id: randomUUID(), conversationId: '', sequence: 4, state: 'waiting', preview: input.text, truncated: false,
      promoted: null, createdAt: '2026-10-06T00:00:00Z', updatedAt: '2026-10-06T00:00:00Z', messageSettings: structuredClone(snapshot) } };
  receipt.item.conversationId = receipt.conversationId;
  return { input, receipt };
}

it('opt-in queue accepts the original snapshot after the caller mutates nested fields during HTTP', async () => {
  const { input, receipt } = queuedSettings(); const sent = JSON.stringify(input); let received = '';
  const server = createServer(async (request, response) => {
    for await (const chunk of request) received += chunk;
    response.setHeader('content-type', 'application/json'); response.end(JSON.stringify(receipt));
  }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const client = new FlowClient({ baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, token: 'synthetic-owner' });
  try {
    const pending = client.enqueueConversationTurn(receipt.conversationId, input, 'frozen-queue');
    input.messageSettings!.requested.model = 'later-model'; input.messageSettings!.profile.runnerId = randomUUID();
    input.messageSettings!.requested.effort = { kind: 'level', value: 'low' };
    expect(await pending).toEqual(receipt); expect(received).toBe(sent);
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
});

it('opt-in queue freezes nested request bytes and recovers the immutable original receipt explicitly', async () => {
  const { input, receipt } = queuedSettings(); const frozen = structuredClone(input); const sent = JSON.stringify(input);
  const requests: { body: string; key: unknown }[] = []; let good = false;
  const server = createServer(async (request, response) => {
    let body = ''; for await (const chunk of request) body += chunk;
    requests.push({ body, key: request.headers['idempotency-key'] });
    response.setHeader('content-type', 'application/json');
    response.end(good ? JSON.stringify({ ...receipt, replayed: true }) : JSON.stringify({ ...receipt, item: { ...receipt.item, messageSettings: undefined } }));
  }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const client = new FlowClient({ baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, token: 'synthetic-owner' });
  try {
    const first = client.enqueueConversationTurn(receipt.conversationId, input, 'queue-settings-original');
    input.messageSettings!.requested.model = 'later-draft'; input.messageSettings!.profile.id = randomUUID();
    await expect(first).rejects.toMatchObject({ code: 'conversation_ack_unknown' });
    expect(requests).toEqual([{ body: sent, key: 'queue-settings-original' }]);
    good = true;
    expect((await client.enqueueConversationTurn(receipt.conversationId, frozen, 'queue-settings-original')).replayed).toBe(true);
    expect(requests).toEqual([{ body: sent, key: 'queue-settings-original' }, { body: sent, key: 'queue-settings-original' }]);
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
});

it('opt-in queue rejects wrong identity, revisions, promotion, preview and settings without accepting current state as an ACK', () => {
  const { input, receipt } = queuedSettings();
  const badItems = [
    { id: 'not-a-uuid' }, { conversationId: randomUUID() }, { sequence: 5 }, { state: 'promoted' },
    { promoted: { taskId: randomUUID(), turnId: randomUUID(), turnNumber: 1 } }, { createdAt: 'invalid' },
    { preview: 'different' }, { preview: ' ' }, { truncated: true }, { messageSettings: null },
    { messageSettings: { ...input.messageSettings, profile: { ...input.messageSettings!.profile, configDigest: 'b'.repeat(64) } } },
  ];
  for (const patch of badItems) expect(() => decodeConversationQueueAccepted({ ...receipt, item: { ...receipt.item, ...patch } }, receipt.conversationId, input)).toThrow(UnknownConversationAcknowledgementError);
  for (const patch of [{ conversationId: randomUUID() }, { queueRevision: 4.5 }, { queueRevision: 5 }, { queueRevision: 2 ** 31 }, { replayed: 'true' }]) {
    expect(() => decodeConversationQueueAccepted({ ...receipt, ...patch }, receipt.conversationId, input)).toThrow(UnknownConversationAcknowledgementError);
  }
  expect(decodeConversationQueueAccepted({ ...receipt, replayed: true }, receipt.conversationId, input).item.state).toBe('waiting');
});

it('opt-in queue preview is UTF-8 bounded and never substitutes for a full-text receipt', () => {
  const { input, receipt } = queuedSettings(); input.text = '🙂'.repeat(130);
  receipt.item.preview = '🙂'.repeat(128); receipt.item.truncated = true;
  expect(decodeConversationQueueAccepted(receipt, receipt.conversationId, input)).toBe(receipt);
  receipt.item.preview += '🙂';
  expect(() => decodeConversationQueueAccepted(receipt, receipt.conversationId, input)).toThrow(UnknownConversationAcknowledgementError);
  receipt.item.preview = 'wrong prefix';
  expect(() => decodeConversationQueueAccepted(receipt, receipt.conversationId, input)).toThrow(UnknownConversationAcknowledgementError);
});

it('opt-in queue malformed JSON stays unknown while abort and HTTP conflict keep their existing errors', async () => {
  const { input, receipt } = queuedSettings(); let calls = 0;
  const server = createServer((request, response) => {
    calls++; request.resume();
    if (request.headers['idempotency-key'] === 'conflict') { response.writeHead(409, { 'content-type': 'application/json' }); response.end(JSON.stringify({ error: { code: 'revision', message: 'Refresh.' } })); }
    else { response.writeHead(200, { 'content-type': 'application/json' }); response.end('{invalid'); }
  }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const client = new FlowClient({ baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, token: 'synthetic-owner' });
  try {
    await expect(client.enqueueConversationTurn(receipt.conversationId, input, 'unknown')).rejects.toMatchObject({ code: 'conversation_ack_unknown' });
    await expect(client.enqueueConversationTurn(receipt.conversationId, input, 'conflict')).rejects.toMatchObject({ status: 409, code: 'revision' });
    await expect(client.enqueueConversationTurn(receipt.conversationId, input, 'abort', AbortSignal.abort())).rejects.toThrow();
    expect(calls).toBe(2);
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
});

it('preserves queue command identity, independent revisions and pause/resume semantics without retries', async () => {
  const seen: { path: string; method: string; key?: string; body: unknown }[] = [];
  const receipt = { conversationId: 'conversation/1', queueRevision: 3, replayed: true };
  const server = createServer(async (request, response) => {
    expect(request.headers.authorization).toBe('Bearer queue-owner');
    let raw = ''; for await (const part of request) raw += part;
    const body = raw ? JSON.parse(raw) : null;
    seen.push({ path: request.url!, method: request.method!, key: request.headers['idempotency-key'] as string | undefined, body });
    const conflict = body?.expectedQueueRevision === 99;
    response.writeHead(conflict ? 409 : 200, { 'content-type': 'application/json' });
    response.end(JSON.stringify(conflict ? { error: { code: 'queue_revision_conflict', message: 'Reload queue.' } } : receipt));
  }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const client = new FlowClient({ baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, token: 'queue-owner' });
  try {
    expect(await client.enqueueConversationTurn('conversation/1', { expectedQueueRevision: 3, text: '  下一轮🙂\n' }, 'enqueue-once')).toEqual(receipt);
    await client.conversationQueue('conversation/1', { after: 0, limit: 4 });
    await client.conversationQueueItem('conversation/1', 'item/2');
    await client.cancelConversationQueueItem('conversation/1', 'item/2', { expectedQueueRevision: 4 }, 'cancel-once');
    await client.pauseConversationQueue('conversation/1', { expectedQueueRevision: 5 }, 'pause-once');
    await client.resumeConversationQueue('conversation/1', { expectedQueueRevision: 6, expectedTaskId: null }, 'resume-once');
    await expect(client.resumeConversationQueue('conversation/1', { expectedQueueRevision: 99, expectedTaskId: 'task-1' }, 'resume-conflict')).rejects.toMatchObject({ status: 409, code: 'queue_revision_conflict' });
    expect(seen.map(r => r.path)).toEqual([
      '/api/conversations/conversation%2F1/queue', '/api/conversations/conversation%2F1/queue?after=0&limit=4',
      '/api/conversations/conversation%2F1/queue/item%2F2', '/api/conversations/conversation%2F1/queue/item%2F2/cancel',
      '/api/conversations/conversation%2F1/queue/pause', '/api/conversations/conversation%2F1/queue/resume',
      '/api/conversations/conversation%2F1/queue/resume',
    ]);
    expect(seen.map(r => r.method)).toEqual(['POST', 'GET', 'GET', 'POST', 'POST', 'POST', 'POST']);
    expect(seen[0]).toMatchObject({ key: 'enqueue-once', body: { expectedQueueRevision: 3, text: '  下一轮🙂\n' } });
    expect(seen[3]).toMatchObject({ key: 'cancel-once', body: { expectedQueueRevision: 4 } });
    expect(seen[4]).toMatchObject({ key: 'pause-once', body: { expectedQueueRevision: 5 } });
    expect(seen[5]).toMatchObject({ key: 'resume-once', body: { expectedQueueRevision: 6, expectedTaskId: null } });
    await expect(client.conversationQueue('conversation/1', {}, AbortSignal.abort())).rejects.toThrow();
    expect(seen).toHaveLength(7); // No automatic retry, task cancellation, promotion or fresh-key substitution.
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});
