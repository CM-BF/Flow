import { afterEach, expect, it, vi } from 'vitest';
import { FlowClient } from './index.js';

const protocol = 'patch-select-v1' as const;
const id = 'a'.repeat(64);
const client = () => new FlowClient({ baseUrl: 'http://127.0.0.1:1', token: 'fixture-only', assistantStreamProtocol: protocol });
const metadata = { protocol, taskId: 'task', attemptId: 'attempt', blocks: [], nextCursor: null, taskStatus: 'running', taskUpdatedAt: '2026-10-07T00:00:00.000Z', finalMessageId: null, settlement: null };
const patchPage = { protocol, selection: { kind: 'text' }, taskId: 'task', attemptId: 'attempt', patches: [], nextCursor: 0, hasMore: false };
const block = { taskId: 'task', id, streamId: id, content: '' };
const reads = [
  { name: 'metadata', cap: 576 * 1024, body: metadata, read: (c: FlowClient, signal?: AbortSignal) => c.assistantStreamSelectedMetadata('task', {}, signal) },
  { name: 'patch', cap: 448 * 1024, body: patchPage, read: (c: FlowClient, signal?: AbortSignal) => c.assistantStreamSelectedPatches('task', { attemptId: 'attempt', selection: { kind: 'text' } }, signal) },
  { name: 'block', cap: 6 * 1024 * 1024 + 8192, body: block, read: (c: FlowClient, signal?: AbortSignal) => c.assistantStreamBlock('task', id, signal) },
];
afterEach(() => vi.restoreAllMocks());
it.each(reads)('$name rejects bytes beyond its policy before parsing', async ({ cap, body, read }) => {
  const json = JSON.stringify(body), cancel = vi.fn();
  const response = new Response(new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode(json.padEnd(cap + 1))); }, cancel }));
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(response);
  await expect(read(client())).rejects.toThrow('byte limit');
  expect(cancel).toHaveBeenCalledOnce();
});
it.each(reads)('$name cancels an active read and preserves abort reason', async ({ read }) => {
  let started!: () => void;
  const ready = new Promise<void>(resolve => { started = resolve; }), cancel = vi.fn();
  const response = new Response(new ReadableStream({ pull() { started(); return new Promise(() => {}); }, cancel }));
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(response);
  const controller = new AbortController(), reason = new Error('caller closed disclosure');
  const pending = read(client(), controller.signal); await ready; await Promise.resolve(); controller.abort(reason);
  await expect(pending).rejects.toBe(reason); expect(cancel).toHaveBeenCalledOnce();
});
it('full block accepts a legal 1MiB control-character body plus its complete envelope', async () => {
  const ordinaryId = '\u0001'.repeat(128), content = '\u0001'.repeat(1048576);
  const full = { ...block, attemptId: ordinaryId, nativeSessionId: ordinaryId, nativeMessageId: ordinaryId, nativeTurnId: ordinaryId, sourceMessageId: ordinaryId,
    source: 'codex.app-server.stream', channel: 'reasoning-text', parentToolUseId: null, prefixDigest: id, blockIndex: 10000, revision: 128,
    firstSequence: 1, lastSequence: 128, bytes: 1048576, createdAt: '+275760-09-13T00:00:00.000Z', updatedAt: '+275760-09-13T00:00:00.000Z',
    phase: 'block-complete', reason: null, truncated: false, status: 'final-available', content };
  const json = JSON.stringify(full); expect(Buffer.byteLength(json)).toBeGreaterThan(6 * 1024 * 1024);
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(json));
  expect((await client().assistantStreamBlock('task', id)).content).toBe(content);
});
it('selected errors preserve status and code; oversized error bodies use the same status with a safe fallback', async () => {
  const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: 'wrong_role', message: 'Owner only.' } }), { status: 403 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: 'untrusted', message: 'x'.repeat(5000) } }), { status: 429 }));
  await expect(client().assistantStreamBlock('task', id)).rejects.toMatchObject({ status: 403, code: 'wrong_role', message: 'Owner only.' });
  await expect(client().assistantStreamBlock('task', id)).rejects.toMatchObject({ status: 429, code: 'http_error', message: 'The center returned HTTP 429.' });
  expect(fetch).toHaveBeenCalledTimes(2);
});
it('legacy stream error payload handling remains unchanged', async () => {
  const message = 'x'.repeat(5000);
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ error: { code: 'legacy', message } }), { status: 409 }));
  const legacy = new FlowClient({ baseUrl: 'http://127.0.0.1:1', token: 'fixture', assistantStreamProtocol: 'patch-v2' });
  await expect(legacy.assistantStreamBlock('task', id)).rejects.toMatchObject({ status: 409, code: 'legacy', message });
});

it('accepts 100 escaped metadata references and the complete 256-block settlement', async () => {
  const longId = '\u0001'.repeat(128), now = '+275760-09-13T00:00:00.000Z';
  const references = Array.from({ length: 100 }, (_, index) => ({ id: index.toString(16).padStart(64, '0'), streamId: index.toString(16).padStart(64, '0'), taskId: longId, attemptId: longId,
    nativeSessionId: longId, nativeMessageId: longId, nativeTurnId: longId, sourceMessageId: longId, parentToolUseId: null,
    source: 'codex.app-server.stream', channel: 'reasoning-summary', blockIndex: 10000, revision: 100000, prefixDigest: id,
    phase: 'incomplete', reason: 'source-mismatch', truncated: false, firstSequence: 2147483647, lastSequence: 2147483647,
    bytes: 1048576, createdAt: now, updatedAt: now, status: 'final-available' }));
  const page = { ...metadata, taskId: longId, attemptId: longId, taskStatus: 'cancel_requested', taskUpdatedAt: now, blocks: references, finalMessageId: id,
    nextCursor: references.at(-1)!.id, settlement: { policy: 'flow.assistant-draft', policyVersion: '1', correlation: 'unavailable', unavailableReason: 'missing-tool-evidence',
      taskId: longId, attemptId: longId, nativeSessionId: longId, finalMessageId: id, replaceStreamIds: [], retainStreamIds: Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(64, '0')) } };
  const json = JSON.stringify(page); expect(Buffer.byteLength(json)).toBeGreaterThan(512 * 1024);
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(json));
  expect((await client().assistantStreamSelectedMetadata(longId, { limit: 100 })).blocks).toEqual(references);
});
it('accepts eight complete escaped patches above the old material response cap', async () => {
  const longId = '\u0001'.repeat(128);
  const patches = Array.from({ length: 8 }, (_, i) => ({ type: 'assistant-stream', streamId: id, nativeSessionId: longId, nativeMessageId: longId, nativeTurnId: longId,
    sourceMessageId: longId, parentToolUseId: null, source: 'codex.app-server.stream', channel: 'reasoning-text', blockIndex: 10000,
    revision: 100000, fromBytes: i * 8192, text: '\u0001'.repeat(8192), prefixDigest: id, phase: 'incomplete', reason: 'source-mismatch', truncated: false,
    taskId: longId, attemptId: longId, eventId: longId, sequence: 2147483640 + i, createdAt: '+275760-09-13T00:00:00.000Z' }));
  const page = { ...patchPage, taskId: longId, attemptId: longId, selection: { kind: 'block', streamId: id }, patches, nextCursor: 2147483647 };
  const json = JSON.stringify(page); expect(Buffer.byteLength(json)).toBeGreaterThan(384 * 1024);
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(json));
  expect((await client().assistantStreamSelectedPatches(longId, { attemptId: longId, selection: { kind: 'block', streamId: id } })).patches).toEqual(patches);
});
it('preserves abort instead of converting a failed error-body read into HTTP fallback', async () => {
  const controller = new AbortController(), reason = new Error('cancel error body');
  let pulling!: () => void;
  const ready = new Promise<void>(resolve => { pulling = resolve; });
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(new ReadableStream({ pull() { pulling(); return new Promise(() => {}); } }), { status: 403 }));
  const pending = client().assistantStreamSelectedMetadata('task', {}, controller.signal);
  await ready; await Promise.resolve(); controller.abort(reason);
  await expect(pending).rejects.toBe(reason);
});

it.each(reads)('$name bounds arbitrary error JSON while retaining HTTP status', async ({ read }) => {
  const fetch = vi.spyOn(globalThis, 'fetch');
  for (const body of ['null', '<proxy>', JSON.stringify({ error: { message: 'x'.repeat(5000) } })]) {
    fetch.mockResolvedValueOnce(new Response(body, { status: 503 }));
    await expect(read(client())).rejects.toMatchObject({ status: 503, code: 'http_error', message: 'The center returned HTTP 503.' });
  }
});
