import { ConversationStreamProjection, type StreamPort } from '../../interaction/src/stream/projection.js';
import type { ConversationTurn } from '@flow/contracts';
import { createServer } from 'node:http';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { expect, it, vi } from 'vitest';
import { conversationCreationSchema } from '@flow/contracts';
import { FlowClient } from './index.js';

it('opts in only snapshot reads and keeps stable creation receipts, task bindings, patch cursors and errors', async () => {
  const requests: { url: string; protocol: string | undefined; key: string | undefined; body: unknown }[] = [];
  const responseBody = { taskId: 'task/1', attemptId: 'attempt/1', patches: [], nextCursor: 9, hasMore: false };
  const server = createServer(async (request, response) => {
    expect(request.headers.authorization).toBe('Bearer stream-owner');
    const chunks: Buffer[] = []; for await (const part of request) chunks.push(Buffer.from(part));
    requests.push({ url: request.url!, protocol: request.headers['x-flow-assistant-stream'] as string | undefined,
      key: request.headers['idempotency-key'] as string | undefined, body: chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : undefined });
    const denied = request.url!.includes('denied');
    const creationReceipt = request.method === 'POST' && request.url === '/api/conversations'
      ? { conversation: { ...conversationCreationSchema.parse(requests.at(-1)!.body), id: 'chat/1', revision: 0,
        createdAt: '2026-10-06T00:00:00Z', updatedAt: '2026-10-06T00:00:00Z' }, replayed: false,
        capabilities: { followUp: true, queue: false, steer: false, liveAssistantText: false,
          perTurnModel: false, perTurnThinking: false, perTurnTools: false } }
      : undefined;
    response.writeHead(denied ? 403 : 200, { 'content-type': 'application/json' });
    response.end(JSON.stringify(denied ? { error: { code: 'wrong_role', message: 'Owner only.' } } : creationReceipt ?? responseBody));
  }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const options = { baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, token: 'stream-owner' };
  const old = new FlowClient(options); const client = new FlowClient({ ...options, assistantStreamProtocol: 'patch-v1' });
  const input = conversationCreationSchema.parse({ title: 'Exact original title 古😀' });
  try {
    await old.conversation('chat/1'); await client.conversation('chat/1');
    await client.createConversation(input, 'stable-create');
    expect(await client.assistantStream('task/1', { after: 'block/0', limit: 2 })).toEqual(responseBody);
    expect(await client.assistantStreamPatches('task/1', { attemptId: 'attempt/1', after: 9, limit: 8 })).toEqual(responseBody);
    expect(await client.assistantStreamBlock('task/1', 'block/1')).toEqual(responseBody);
    await expect(client.assistantStreamBlock('denied', 'block/1')).rejects.toMatchObject({ status: 403, code: 'wrong_role' });
    await expect(client.assistantStreamPatches('task/1', { attemptId: 'attempt/1' }, AbortSignal.abort())).rejects.toThrow();
    expect(requests.map(r => r.url)).toEqual(['/api/conversations/chat%2F1', '/api/conversations/chat%2F1', '/api/conversations',
      '/api/tasks/task%2F1/assistant-stream?after=block%2F0&limit=2', '/api/tasks/task%2F1/assistant-stream/patches?attemptId=attempt%2F1&after=9&limit=8',
      '/api/tasks/task%2F1/assistant-stream/block%2F1', '/api/tasks/denied/assistant-stream/block%2F1']);
    expect(requests.map(r => r.protocol)).toEqual([undefined, 'patch-v1', undefined, undefined, undefined, undefined, undefined]);
    expect(requests[2]).toMatchObject({ key: 'stable-create', body: input });
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});

it('sends the explicit v2 codec for task-bound reads without changing mutation receipts', async () => {
  const seen: {path:string;headers:Headers}[]=[];
  const fetch=vi.spyOn(globalThis,'fetch').mockImplementation(async (url,init)=>{seen.push({path:String(url),headers:new Headers(init?.headers)});return new Response('{}',{status:200,headers:{'content-type':'application/json'}})});
  try {
    const client=new FlowClient({baseUrl:'http://127.0.0.1:1',token:'fixture-only',assistantStreamProtocol:'patch-v2'});
    await client.assistantStream('task');await client.assistantStreamPatches('task',{attemptId:'attempt'});await client.assistantStreamBlock('task','block');await client.conversation('conversation');
    expect(seen.map(x=>x.headers.get('X-Flow-Assistant-Stream'))).toEqual(Array(4).fill('patch-v2'));
  } finally {fetch.mockRestore();}
});

const selectedProtocol = 'patch-select-v1' as const;
const streamId = 'a'.repeat(64);
function selectedClient() { return new FlowClient({ baseUrl: 'http://127.0.0.1:1', token: 'fixture-only', assistantStreamProtocol: selectedProtocol }); }
function patch(sequence = 7, channel: 'text' | 'reasoning-text' = 'text') {
  return { type: 'assistant-stream', streamId, nativeSessionId: 'session', nativeMessageId: 'message', nativeTurnId: 'turn',
    parentToolUseId: null, source: 'codex.app-server.stream', channel, sourceMessageId: 'message', blockIndex: 0,
    revision: 1, fromBytes: 0, text: '古😀', prefixDigest: 'b'.repeat(64), phase: 'streaming', reason: null, truncated: false,
    taskId: 'task/1', attemptId: 'attempt/1', eventId: 'event', sequence, createdAt: '2026-10-07T00:00:00Z' };
}
function selectedPage() { return { protocol: selectedProtocol, taskId: 'task/1', attemptId: 'attempt/1', selection: { kind: 'text' }, patches: [patch()], nextCursor: 7, hasMore: false }; }
const jsonResponse = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });

it('reads text by default and detaches explicit block selection before asynchronous transport', async () => {
  const seen: { url: string; headers: Headers; credentials: RequestCredentials | undefined }[] = [];
  let finish: ((response: Response) => void) | undefined;
  const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
    seen.push({ url: String(url), headers: new Headers(init?.headers), credentials: init?.credentials });
    if (seen.length === 1) return jsonResponse(selectedPage());
    return new Promise<Response>(resolve => { finish = resolve; });
  });
  try {
    const client = selectedClient();
    expect((await client.assistantStreamPatches('task/1', { attemptId: 'attempt/1', after: 2 })).nextCursor).toBe(7);
    const selection = { kind: 'block' as const, streamId };
    const pending = client.assistantStreamSelectedPatches('task/1', { attemptId: 'attempt/1', after: 7, limit: 2, selection });
    selection.streamId = 'c'.repeat(64);
    finish!(jsonResponse({ ...selectedPage(), selection: { kind: 'block', streamId }, patches: [patch(9, 'reasoning-text')], nextCursor: 9 }));
    expect((await pending).nextCursor).toBe(9);
    expect(seen[0]!.url).toContain('attemptId=attempt%2F1&after=2&limit=8&selection=text');
    expect(seen[1]!.url).toContain(`after=7&limit=2&selection=block&streamId=${streamId}`);
    expect(seen.every(request => request.headers.get('X-Flow-Assistant-Stream') === selectedProtocol && request.headers.get('Authorization') === 'Bearer fixture-only' && request.credentials === 'omit')).toBe(true);
  } finally { fetch.mockRestore(); }
});

it('requires a matching acknowledgement on every metadata page', async () => {
  const metadata = { protocol: selectedProtocol, taskId: 'task/1', attemptId: 'attempt/1', blocks: [], nextCursor: null };
  const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(metadata));
  try {
    const client = selectedClient();
    expect((await client.assistantStreamSelectedMetadata('task/1')).protocol).toBe(selectedProtocol);
    fetch.mockResolvedValue(jsonResponse({ ...metadata, protocol: undefined }));
    await expect(client.assistantStream('task/1', { after: streamId })).rejects.toThrow('Unconfirmed');
    fetch.mockResolvedValue(jsonResponse({ ...metadata, taskId: 'other' }));
    await expect(client.assistantStream('task/1')).rejects.toThrow('Unconfirmed');
    expect(fetch.mock.calls.every(([url]) => !String(url).includes('/patches'))).toBe(true);
  } finally { fetch.mockRestore(); }
});

it('rejects wrong selection, attempt, hidden reasoning, regressing cursors and malformed patches without retry', async () => {
  const failures = [
    { ...selectedPage(), protocol: undefined }, { ...selectedPage(), selection: { kind: 'block', streamId } },
    { ...selectedPage(), attemptId: 'other' }, { ...selectedPage(), patches: [patch(7, 'reasoning-text')] },
    { ...selectedPage(), nextCursor: 6 }, { ...selectedPage(), patches: [], nextCursor: 1 },
    { ...selectedPage(), patches: [{ ...patch(), text: '\ud800' }] },
  ];
  const fetch = vi.spyOn(globalThis, 'fetch');
  try {
    for (const value of failures) {
      fetch.mockResolvedValueOnce(jsonResponse(value));
      await expect(selectedClient().assistantStreamSelectedPatches('task/1', { attemptId: 'attempt/1', after: 2, selection: { kind: 'text' } })).rejects.toThrow();
    }
    expect(fetch).toHaveBeenCalledTimes(failures.length);
    const old = new FlowClient({ baseUrl: 'http://127.0.0.1:1', token: 'x', assistantStreamProtocol: 'patch-v2' });
    await expect(old.assistantStreamSelectedPatches('task/1', { attemptId: 'attempt/1', selection: { kind: 'text' } })).rejects.toThrow('opt-in');
    await expect(selectedClient().assistantStreamSelectedPatches('task/1', { attemptId: 'attempt/1', after: 1.5, selection: { kind: 'text' } })).rejects.toThrow('cursor');
    expect(fetch).toHaveBeenCalledTimes(failures.length);
  } finally { fetch.mockRestore(); }
});

it('keeps empty selected cursors and complete block reads separate from conversation v2 and propagates abort/errors', async () => {
  const seen: Headers[] = [];
  const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
    seen.push(new Headers(init?.headers)); return jsonResponse({ ...selectedPage(), patches: [], nextCursor: 12 });
  });
  try {
    const client = selectedClient();
    expect((await client.assistantStreamPatches('task/1', { attemptId: 'attempt/1', after: 12 })).nextCursor).toBe(12);
    fetch.mockResolvedValueOnce(jsonResponse({ taskId: 'task/1', attemptId: 'attempt/1', id: streamId, streamId, content: '古😀' }));
    expect((await client.assistantStreamBlock('task/1', streamId)).content).toBe('古😀');
    fetch.mockResolvedValueOnce(jsonResponse({ taskId: 'other', id: streamId, streamId, content: 'x' }));
    await expect(client.assistantStreamBlock('task/1', streamId)).rejects.toThrow('identity');
    await client.conversation('conversation'); expect(seen.at(-1)!.get('X-Flow-Assistant-Stream')).toBe('patch-v2');
    fetch.mockResolvedValueOnce(jsonResponse({ error: { code: 'wrong_role', message: 'Denied' } }, 403));
    await expect(client.assistantStream('task/1')).rejects.toMatchObject({ status: 403, code: 'wrong_role' });
    const before = fetch.mock.calls.length;
    await expect(client.assistantStream('task/1', {}, AbortSignal.abort())).rejects.toThrow();
    // Transport may receive an already-aborted signal; it must not publish a response.
    expect(fetch.mock.calls.length - before).toBeLessThanOrEqual(1);
  } finally { fetch.mockRestore(); }
});


it('binds the public methods to the existing projection and rejects an old server before any body request', async () => {
  const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ taskId: 'task', attemptId: 'attempt', blocks: [], nextCursor: null }));
  const client = selectedClient();
  const port: StreamPort = {
    readMetadata: (options, signal) => client.assistantStreamSelectedMetadata('task', options, signal),
    readPatches: (options, signal) => client.assistantStreamPatches('task', options, signal),
    readSelectedPatches: (options, signal) => client.assistantStreamSelectedPatches('task', options, signal),
    readBlock: (id, signal) => client.assistantStreamBlock('task', id, signal),
  };
  const at = '2026-10-07T00:00:00Z';
  const turn: ConversationTurn = { id: 'turn', conversationId: 'chat', number: 1, createdAt: at, user: { role: 'user', text: 'Hi' },
    task: { id: 'task', title: 'Chat', harness: 'codex', status: 'running', verificationStatus: 'pending', createdAt: at, updatedAt: at },
    assistant: { state: 'pending', reason: 'execution-pending' }, effective: { model: null, thinking: 'unknown', tools: null, source: null },
    telemetry: { kind: 'execution', taskId: 'task', title: 'Chat' } };
  const projection = new ConversationStreamProjection({ connectionId: 'connection', viewId: 'view', conversationId: 'chat', turnId: 'turn', taskId: 'task' }, port);
  try {
    projection.updateHost({ turn, protocol: selectedProtocol, capability: true, visible: true, online: true });
    await projection.refresh();
    expect(projection.getSnapshot().error).toContain('Unconfirmed');
    await expect(projection.openReasoning(streamId)).rejects.toThrow();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0]![0]).toBe('http://127.0.0.1:1/api/tasks/task/assistant-stream?limit=100');
  } finally { projection.dispose(); fetch.mockRestore(); }
});
