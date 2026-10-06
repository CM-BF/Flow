import { randomUUID } from 'node:crypto';
import { request as httpRequest } from 'node:http';
import Fastify from 'fastify';
import { Pool } from 'pg';
import type { PgBoss } from 'pg-boss';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { createServer } from '../index.js';
import { HttpError, sha256 } from '../database.js';
import { registerConversationRoutes } from '../conversations/index.js';
import { migrateAssistantStreams, registerAssistantStreamRoutes } from '../assistant-stream/index.js';

const database = `flow_chat06c02_${randomUUID().replaceAll('-', '')}`;
const admin = new Pool({ connectionString: 'postgresql://flow:flow-local-only@127.0.0.1:55432/postgres', max: 1 });
const databaseUrl = `postgresql://flow:flow-local-only@127.0.0.1:55432/${database}`;
const pool = new Pool({ connectionString: databaseUrl, max: 2 });
const owner = 'chat06c02-test-owner';
const servers: Awaited<ReturnType<typeof createServer>>[] = [];
let base: string, enabled: string, unmounted: string, disabled: string;
let created = false;
async function readApp(routes: boolean, assistantStreamReadable = true) {
  const app = Fastify();
  app.addHook('preHandler', async request => { if (request.headers.authorization !== `Bearer ${owner}`) throw new HttpError(401, 'unauthorized', 'Owner required.'); });
  app.setErrorHandler((error, _request, reply) => reply.code(error instanceof HttpError ? error.status : 500).send({ error: error instanceof Error ? error.message : 'Test server failed.' }));
  // Creation/snapshot do not invoke the admission-only scheduler dependency.
  registerConversationRoutes(app, pool, undefined as unknown as PgBoss, { assistantStreamReadable });
  if (routes) registerAssistantStreamRoutes(app, pool);
  servers.push(app);
  return app.listen({ host: '127.0.0.1', port: 0 });
}
beforeAll(async () => {
  await admin.query(`CREATE DATABASE ${database}`); created = true;
  const app = await createServer({ databaseUrl, ownerToken: owner, automaticQueueScan: false, leaseMs: 300_000 });
  servers.push(app); base = await app.listen({ host: '127.0.0.1', port: 0 });
  enabled = await readApp(true); unmounted = await readApp(false); disabled = await readApp(true, false);
});
afterAll(async () => {
  try { for (const app of servers.reverse()) { app.server.closeAllConnections(); await app.close(); } }
  finally { await pool.end(); try { if (created) await admin.query(`DROP DATABASE ${database}`); } finally { await admin.end(); } }
});
async function request(url: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
  const response = await fetch(`${url}${path}`, { method: body === undefined ? 'GET' : 'POST',
    headers: { authorization: `Bearer ${owner}`, ...(body === undefined ? {} : { 'content-type': 'application/json', 'idempotency-key': randomUUID() }), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(5000) });
  if (body === undefined && /^\/api\/conversations\/[^/]+$/.test(path)) expect(response.headers.get('cache-control')).toBe('no-store');
  const value = await response.json(); expect(response.ok, JSON.stringify(value)).toBe(true); return value;
}
const header = { 'x-flow-assistant-stream': 'patch-v1' };
const conversationInput = { title: 'Read protocol compatibility', harness: 'claude' };
let conversationId: string;
it('requires both the explicit mounting option and readable 022 routes before advertising patch-v1', async () => {
  conversationId = (await request(enabled, '/api/conversations', conversationInput)).conversation.id;
  const path = `/api/conversations/${conversationId}`;
  // Work with both the old factory and the production factory that already mounts 022.
  await migrateAssistantStreams(pool);
  // Readiness fault injection in this test's private DB, not a first-upgrade claim.
  await pool.query('ALTER TABLE flow.assistant_stream_patches RENAME TO chat06c02_hidden_patches');
  try {
    expect((await request(enabled, path, undefined, header)).capabilities.liveAssistantText).toBe(false);
  } finally {
    await pool.query('ALTER TABLE flow.chat06c02_hidden_patches RENAME TO assistant_stream_patches');
  }
  expect((await request(unmounted, path, undefined, header)).capabilities.liveAssistantText).toBe(false);
  expect((await request(disabled, path, undefined, header)).capabilities.liveAssistantText).toBe(false);
  expect((await request(enabled, path, undefined, header)).capabilities.liveAssistantText).toBe(true);
});
it('keeps missing, unknown and combined headers false while explicit opt-in is independent of a last turn', async () => {
  const path = `/api/conversations/${conversationId}`;
  for (const value of [undefined, '', 'patch-v2', 'PATCH-V1', 'patch-v1, patch-v1', 'patch-v1, unknown']) {
    const response = await request(enabled, path, undefined, value === undefined ? {} : { 'x-flow-assistant-stream': value });
    expect(response.capabilities.liveAssistantText).toBe(false);
  }
  const opted = await request(enabled, path, undefined, header);
  expect(opted.lastTurn).toBeNull(); expect(opted.capabilities.liveAssistantText).toBe(true);
});
it('rejects duplicated raw HTTP negotiation headers even when both have the supported value', async () => {
  const value = await new Promise<any>((resolve, reject) => {
    const req = httpRequest(`${enabled}/api/conversations/${conversationId}`, { headers: { authorization: `Bearer ${owner}`, 'X-Flow-Assistant-Stream': ['patch-v1', 'patch-v1'] } }, response => {
      let text = ''; response.setEncoding('utf8'); response.on('data', chunk => { text += chunk; }); response.on('end', () => { try { if (response.statusCode !== 200) throw new Error(`Unexpected HTTP status ${response.statusCode}`); resolve(JSON.parse(text)); } catch (error) { reject(error); } });
    }); req.setTimeout(5000, () => req.destroy(new Error('HTTP test timed out'))); req.on('error', reject); req.end();
  });
  expect(value.capabilities.liveAssistantText).toBe(false);
});
it('keeps creation receipts stable and false across header and connection changes', async () => {
  const key = randomUUID();
  const first = await request(enabled, '/api/conversations', conversationInput, { ...header, 'idempotency-key': key });
  const replay = await request(base, '/api/conversations', conversationInput, { 'idempotency-key': key });
  expect(first.capabilities.liveAssistantText).toBe(false); expect(replay).toEqual({ ...first, replayed: true });
  const stored = (await pool.query("SELECT response FROM flow.commands WHERE operation='conversation.create' AND key=$1", [key])).rows[0].response;
  expect(stored).toEqual({ conversation: first.conversation, capabilities: first.capabilities });
  expect((await request(enabled, `/api/conversations/${first.conversation.id}`, undefined, header)).capabilities.liveAssistantText).toBe(true);
  expect((await request(base, `/api/conversations/${first.conversation.id}`)).capabilities.liveAssistantText).toBe(false);
});
async function streamTask(count: number) {
  const runner = await request(base, '/api/runners', { name: 'Synthetic stream runner', harnesses: ['claude'], capacity: 1 });
  const task = (await request(base, '/api/tasks', { title: 'Legacy projection', prompt: 'No provider', harness: 'claude' })).task;
  await pool.query('UPDATE flow.tasks SET dispatch_ready=true WHERE id=$1', [task.id]);
  const claim = await request(base, '/api/runner/claim', {}, { authorization: `Bearer ${runner.token}` });
  expect(claim.assignment.task.id).toBe(task.id);
  const sessionId = randomUUID(), nativeMessageId = randomUUID();
  const streamId = sha256(JSON.stringify([sessionId, nativeMessageId, 0]));
  const ownership = { attemptId: claim.assignment.attempt.id, ownerVersion: claim.assignment.attempt.ownerVersion };
  const events: any[] = [{ id: randomUUID(), sequence: 1, type: 'session', nativeSessionId: sessionId, adapterVersion: 'claude-sdk-0.3.290-v2' }];
  for (let index = 0; index < count; index++) events.push({ id: randomUUID(), sequence: index + 2, type: 'assistant-stream', streamId, nativeSessionId: sessionId, nativeMessageId,
    parentToolUseId: null, source: 'claude.sdk.stream', sourceMessageId: randomUUID(), blockIndex: 0, revision: index + 1, fromBytes: index, text: 'x', prefixDigest: sha256('x'.repeat(index + 1)), phase: 'streaming', reason: null, truncated: false });
  for (let offset = 0; offset < events.length; offset += 40) await request(base, '/api/runner/events', { ...ownership, events: events.slice(offset, offset + 40) }, { authorization: `Bearer ${runner.token}` });
  const append = () => request(base, '/api/runner/events', { ...ownership, events: [{ id: randomUUID(), sequence: count + 2, type: 'message', text: 'Visible after hidden stream' }] }, { authorization: `Bearer ${runner.token}` });
  return { taskId: task.id, streamId, count, append };
}
it('filters legacy task and event reads without altering raw typed entries or patch retrieval', async () => {
  const task = await streamTask(3); await task.append();
  const snapshot = await request(base, `/api/tasks/${task.taskId}`);
  const page = await request(base, `/api/tasks/${task.taskId}/events`);
  expect(JSON.stringify(snapshot)).not.toContain(task.streamId); expect(JSON.stringify(page)).not.toContain(task.streamId);
  expect(page.entries.at(-1).text).toBe('Visible after hidden stream');
  const raw = (await pool.query('SELECT entry FROM flow.timeline WHERE task_id=$1 ORDER BY cursor', [task.taskId])).rows;
  expect(raw.filter(row => row.entry.reference?.stream)).toHaveLength(3);
  const block = await request(enabled, `/api/tasks/${task.taskId}/assistant-stream/${task.streamId}`);
  expect(block.content).toBe('xxx');
});
it('advances stream-only event pages using raw rows and reaches the next ordinary entry', async () => {
  const task = await streamTask(3); await task.append();
  const first = await request(base, `/api/tasks/${task.taskId}/events?after=1&limit=2`);
  expect(first.entries).toEqual([]); expect(first.nextCursor).toBe(3); expect(first.hasMore).toBe(true);
  const second = await request(base, `/api/tasks/${task.taskId}/events?after=${first.nextCursor}&limit=2`);
  expect(second.entries).toHaveLength(1); expect(second.entries[0].text).toBe('Visible after hidden stream');
  expect(second.nextCursor).toBe(5); expect(second.hasMore).toBe(false);
});
async function ssePage(taskId: string, after: number) {
  const abort = new AbortController(); const timeout = setTimeout(() => abort.abort(), 5000);
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  try {
    const response = await fetch(`${base}/api/tasks/${taskId}/stream?after=${after}`, { headers: { authorization: `Bearer ${owner}` }, signal: abort.signal });
    expect(response.status).toBe(200); reader = response.body!.getReader(); const decoder = new TextDecoder(); let text = '';
    while (!text.includes('\n\n')) { const part = await reader.read(); if (part.done) throw new Error('SSE ended before update'); text += decoder.decode(part.value, { stream: true }); }
    return JSON.parse(text.split('\n').find(line => line.startsWith('data: '))!.slice(6));
  } finally { abort.abort(); await reader?.cancel().catch(() => {}); clearTimeout(timeout); }
}
it('reconnects SSE after a hidden-only page and does not lose a subsequently committed ordinary entry', async () => {
  const task = await streamTask(35);
  const first = await ssePage(task.taskId, 1); expect(first.entries).toEqual([]); expect(first.nextCursor).toBe(33); expect(first.hasMore).toBe(true);
  await task.append();
  const resumed = await ssePage(task.taskId, first.nextCursor);
  expect(resumed.entries.map((entry: any) => entry.text)).toEqual(['Visible after hidden stream']);
  expect(resumed.nextCursor).toBe(37); expect(JSON.stringify(resumed)).not.toContain(task.streamId);
});
it('preserves forward and backward workspace cursors on stream-only pages', async () => {
  const before = await request(base, '/api/workspace?after=0&limit=100');
  const task = await streamTask(3); await task.append();
  await request(base, '/api/workspace?after=0&limit=100');
  const raw = (await pool.query('SELECT ordinal::int,entry FROM flow.workspace_feed WHERE task_id=$1 ORDER BY ordinal', [task.taskId])).rows;
  const hidden = raw.filter(row => row.entry.reference?.stream); expect(hidden).toHaveLength(3);
  const forward = await request(base, `/api/workspace?after=${hidden[0].ordinal - 1}&limit=2`);
  expect(forward.entries).toEqual([]); expect(forward.nextCursor).toBe(hidden[1].ordinal); expect(forward.hasMore).toBe(true);
  const next = await request(base, `/api/workspace?after=${forward.nextCursor}&limit=2`);
  expect(next.entries).toHaveLength(1); expect(next.entries[0].entry.text).toBe('Visible after hidden stream');
  const backward = await request(base, `/api/workspace?before=${hidden[2].ordinal + 1}&limit=2`);
  expect(backward.entries).toEqual([]); expect(backward.previousCursor).toBe(hidden[1].ordinal); expect(backward.hasEarlier).toBe(true);
  expect(forward.watermark).toBeGreaterThan(before.watermark); expect(JSON.stringify(next)).not.toContain(task.streamId);
});
