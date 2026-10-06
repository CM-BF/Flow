import { randomUUID } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import { Pool, type PoolClient } from 'pg';
import { mkdtemp, readFile, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { runRunner } from '../../../runner/src/runtime.js';
import { createClaudeAdapter, type ClaudeQuery } from '../../../runner/src/claude.js';
type SDKMessage = ReturnType<ClaudeQuery> extends AsyncIterable<infer Message> ? Message : never;
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { createServer } from '../index.js';
import { sha256 } from '../database.js';
import { migrateAssistantMessages, registerAssistantRoutes } from './index.js';

const admin = new Pool({ connectionString: 'postgresql://flow:flow-local-only@127.0.0.1:55432/postgres', max: 1 });
const databaseUrl = 'postgresql://flow:flow-local-only@127.0.0.1:55432/flow_chat02';
let lock: PoolClient;
let created = false;
let app: Awaited<ReturnType<typeof createServer>>;
let base = '';
let pool: Pool;
async function start(port = 0, leaseMs = 5000) { app = await createServer({ databaseUrl, ownerToken: 'chat02-owner', leaseMs }); pool = new Pool({ connectionString: databaseUrl });
  if (!app.hasRoute({ method: 'GET', url: '/api/assistant-messages/:id' })) { await migrateAssistantMessages(pool); registerAssistantRoutes(app, pool); }
  base = await app.listen({ host: '127.0.0.1', port }); }
beforeAll(async () => {
  lock = await admin.connect();
  expect((await lock.query("SELECT pg_try_advisory_lock(hashtextextended('flow_chat02_exclusive',0)) AS locked")).rows[0].locked).toBe(true);
  if ((await lock.query("SELECT 1 FROM pg_database WHERE datname='flow_chat02'")).rowCount) throw Error('Existing flow_chat02 must be preserved.');
  await lock.query('CREATE DATABASE flow_chat02'); created = true; await start();
});
afterAll(async () => { try { await app?.close(); await pool?.end(); } finally { try { if (created) await lock.query('DROP DATABASE flow_chat02'); } finally { lock?.release(); await admin.end(); } } });
async function request(path: string, body?: unknown, token = 'chat02-owner', expected = 200) {
  const response = await fetch(`${base}${path}`, { method: body === undefined ? 'GET' : 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', 'idempotency-key': randomUUID() }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(5000) });
  const json = await response.json(); expect(response.status, JSON.stringify(json)).toBe(expected); return json;
}
async function attempt() {
  const runner = await request('/api/runners', { name: 'CHAT02 synthetic SDK', harnesses: ['claude'], capacity: 1 });
  const accepted = await request('/api/tasks', { title: 'Final reply', prompt: 'Synthetic only', harness: 'claude' }, undefined, 202);
  let claimed: any;
  for (let tries = 0; tries < 100; tries++) { claimed = await request('/api/runner/claim', {}, runner.token); if (claimed.assignment) break; await sleep(10); }
  expect(claimed.assignment.task.id).toBe(accepted.task.id);
  const ownership = { attemptId: claimed.assignment.attempt.id, ownerVersion: claimed.assignment.attempt.ownerVersion };
  const sessionId = randomUUID();
  return { taskId: accepted.task.id, token: runner.token, sessionId, ownership,
    session: { id: randomUUID(), sequence: 1, type: 'session', nativeSessionId: sessionId, adapterVersion: 'claude-sdk-0.3.290-v2' },
  };
}
function final(sessionId: string, sequence = 2, content = '最终正文 🌱') {
  const sourceMessageId = randomUUID();
  return { id: randomUUID(), sequence, type: 'assistant-final', messageId: sha256(JSON.stringify([sessionId, sourceMessageId])), nativeSessionId: sessionId,
    source: 'claude.sdk.result', sourceMessageId, content,
    settings: { requested: { model: 'sonnet', permissionMode: 'dontAsk', thinking: 'disabled' }, effective: { model: null, permissionMode: null, tools: null, thinking: 'unknown' } },
  };
}
it('accepts a typed final through the ordered authenticated event interface', async () => {
  const a = await attempt(); const event = final(a.sessionId);
  expect(await request('/api/runner/events', { ...a.ownership, events: [a.session, event] }, a.token)).toEqual({ accepted: 2, lastSequence: 2 });
  const page = await request(`/api/tasks/${a.taskId}/assistant-messages`);
  expect(page.messages).toHaveLength(1); expect(page.messages[0]).toMatchObject({ id: event.messageId, taskId: a.taskId, attemptId: a.ownership.attemptId });
  expect(page.messages[0]).not.toHaveProperty('content'); expect(page.messages[0]).not.toHaveProperty('settings');
  expect(await request(`/api/assistant-messages/${event.messageId}`)).toMatchObject({ content: '最终正文 🌱', contentDigest: sha256('最终正文 🌱') });
});

it('deduplicates an acknowledged final across center restart and terminal acknowledgement replay', async () => {
  const a = await attempt(); const event = final(a.sessionId);
  const completed = { id: randomUUID(), sequence: 3, type: 'completed', outcome: 'succeeded' };
  const batch = { ...a.ownership, events: [a.session, event, completed] };
  expect(await request('/api/runner/events', batch, a.token)).toEqual({ accepted: 3, lastSequence: 3 });
  const port = Number(new URL(base).port); await app.close(); await pool.end(); await start(port);
  expect(await request('/api/runner/events', batch, a.token)).toEqual({ accepted: 0, lastSequence: 3 });
  expect((await request(`/api/tasks/${a.taskId}/assistant-messages`)).messages).toHaveLength(1);
  expect(await request(`/api/assistant-messages/${event.messageId}`)).toMatchObject({ content: event.content });
  await request('/api/runner/events', { ...a.ownership, events: [{ ...event, content: 'changed' }] }, a.token, 409);
});
it('requires a matching recorded session and rolls back an out-of-order batch atomically', async () => {
  const a = await attempt();
  await request('/api/runner/events', { ...a.ownership, events: [final(a.sessionId, 1)] }, a.token, 409);
  await request('/api/runner/events', { ...a.ownership, events: [a.session, final(a.sessionId, 3)] }, a.token, 409);
  expect((await request(`/api/tasks/${a.taskId}`)).attempt).not.toHaveProperty('nativeSessionId');
  expect((await request(`/api/tasks/${a.taskId}/assistant-messages`)).messages).toEqual([]);
  await request('/api/runner/events', { ...a.ownership, events: [a.session] }, a.token);
  await request('/api/runner/events', { ...a.ownership, events: [final('wrong-session')] }, a.token, 409);
  await request('/api/runner/events', { ...a.ownership, events: [final(a.sessionId)] }, a.token);
});
it('rejects foreign credentials, wrong fence and caller-invented conversation ownership', async () => {
  const a = await attempt(); const other = await attempt(); const event = final(a.sessionId);
  await request('/api/runner/events', { ...a.ownership, events: [a.session] }, other.token, 403);
  await request('/api/runner/events', { ...a.ownership, ownerVersion: 9, events: [a.session] }, a.token, 409);
  await request('/api/runner/events', { ...a.ownership, events: [a.session, { ...event, conversationId: 'injected' }] }, a.token, 400);
  await request('/api/runner/events', { ...a.ownership, events: [a.session, { ...event, thinking: 'must never persist' }] }, a.token, 400);
  expect((await request(`/api/tasks/${a.taskId}/assistant-messages`)).messages).toEqual([]);
  await request(`/api/tasks/${a.taskId}/assistant-messages`, undefined, a.token, 403);
  await request('/api/runner/events', { ...a.ownership, events: [a.session, event] }, a.token);
  await request(`/api/assistant-messages/${event.messageId}`, undefined, a.token, 403);
  expect((await request(`/api/tasks/${other.taskId}/assistant-messages`)).messages).toEqual([]);
});
it('keeps a single immutable final per attempt and checks stable native identity', async () => {
  const a = await attempt(); const event = final(a.sessionId);
  await request('/api/runner/events', { ...a.ownership, events: [a.session, { ...event, messageId: '0'.repeat(64) }] }, a.token, 409);
  await request('/api/runner/events', { ...a.ownership, events: [a.session, event] }, a.token);
  await request('/api/runner/events', { ...a.ownership, events: [{ ...event, id: randomUUID(), sequence: 3 }] }, a.token, 409);
  await request('/api/runner/events', { ...a.ownership, events: [final(a.sessionId, 3, 'replacement')] }, a.token, 409);
  expect((await request(`/api/tasks/${a.taskId}/assistant-messages`)).messages).toHaveLength(1);
  expect((await request(`/api/assistant-messages/${event.messageId}`)).content).toBe(event.content);
});
it('keeps large assistant bodies out of light pages and binds bounded cursors to their task', async () => {
  const a = await attempt(); const other = await attempt(); const body = '汉🌱'.repeat(70_000); const event = final(a.sessionId, 2, body);
  await request('/api/runner/events', { ...a.ownership, events: [a.session, event] }, a.token);
  const page = await request(`/api/tasks/${a.taskId}/assistant-messages?limit=1`);
  expect(Buffer.byteLength(JSON.stringify(page))).toBeLessThan(3000);
  expect(page.messages).toHaveLength(1); expect(page.messages[0]).not.toHaveProperty('content'); expect(page.messages[0]).not.toHaveProperty('settings');
  expect((await request(`/api/assistant-messages/${event.messageId}`)).content).toBe(body);
  expect((await request(`/api/tasks/${a.taskId}`)).entries.every((entry: any) => entry.kind === 'reference')).toBe(true);
  expect((await request(`/api/tasks/${a.taskId}/assistant-messages?after=${event.messageId}`)).messages).toEqual([]);
  await request(`/api/tasks/${other.taskId}/assistant-messages?after=${event.messageId}`, undefined, undefined, 400);
  for (const value of ['0', '101', '1.5', 'abc']) await request(`/api/tasks/${a.taskId}/assistant-messages?limit=${value}`, undefined, undefined, 400);
  await request('/api/assistant-messages/missing', undefined, undefined, 404);
});

it.each(['before-save', 'after-save'] as const)('recovers a durable final after runner and center restart with a lost response %s', async window => {
  const directory = await mkdtemp(join(tmpdir(), 'flow-chat02-runtime-'));
  const firstStop = new AbortController(); const secondStop = new AbortController();
  let firstRun: Promise<void> | undefined; let secondRun: Promise<void> | undefined;
  const nativeFetch = globalThis.fetch; let intercepted = false; let calls = 0;
  let savedBatch: any;
  const runner = await request('/api/runners', { name: 'Durable synthetic SDK', harnesses: ['claude'], capacity: 1 });
  const accepted = await request('/api/tasks', { title: 'Actual adapter final', prompt: 'No model call', harness: 'claude' }, undefined, 202);
  const session = randomUUID(); const source = randomUUID();
  const query: ClaudeQuery = () => { calls++; return Object.assign((async function* () {
    yield { type: 'result', subtype: 'success', is_error: false, uuid: source, session_id: session, result: '持久回复 🌱', modelUsage: {}, permission_denials: [] } as unknown as SDKMessage;
  })(), { close() {} }); };
  const adapter = createClaudeAdapter({ materialFiles: [], query });
  const transport = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
    if (!intercepted && String(url).endsWith('/api/runner/events') && typeof init?.body === 'string') {
      const batch = JSON.parse(init.body);
      if (batch.events.some((event: any) => event.type === 'assistant-final')) {
        intercepted = true; savedBatch = batch;
        if (window === 'after-save') { const response = await nativeFetch(url, init); expect(response.status).toBe(200); await response.text(); }
        throw new Error('Injected lost acknowledgement');
      }
    }
    return nativeFetch(url, init);
  });
  try {
    firstRun = runRunner({ baseUrl: base, token: runner.token, workingDirectory: directory, signal: firstStop.signal, adapters: [adapter], pollIntervalMs: 10,
      onNotice(notice) { if (notice.type === 'ownership-lost') firstStop.abort(); },
    });
    await expect.poll(() => intercepted, { timeout: 3000, interval: 20 }).toBe(true); await firstRun;
    transport.mockRestore();
    const pending = join(directory, sha256(base), sha256(savedBatch.attemptId), 'pending-events.json');
    expect(JSON.parse(await readFile(pending, 'utf8'))).toEqual(savedBatch);
    const before = await request(`/api/tasks/${accepted.task.id}/assistant-messages`);
    expect(before.messages).toHaveLength(window === 'after-save' ? 1 : 0);
    const port = Number(new URL(base).port); await app.close(); await pool.end(); await start(port);
    secondRun = runRunner({ baseUrl: base, token: runner.token, workingDirectory: directory, signal: secondStop.signal, adapters: [adapter], pollIntervalMs: 10 });
    await expect.poll(async () => { try { await access(pending); return false; } catch { return true; } }, { timeout: 2000, interval: 20 }).toBe(true);
    secondStop.abort(); await secondRun;
    const page = await request(`/api/tasks/${accepted.task.id}/assistant-messages`);
    expect(page.messages).toHaveLength(1); expect(calls).toBe(1);
    expect(page.messages[0]).toMatchObject({ eventId: savedBatch.events[0].id, sequence: savedBatch.events[0].sequence, attemptId: savedBatch.attemptId });
    expect((await request(`/api/assistant-messages/${page.messages[0].id}`)).content).toBe('持久回复 🌱');
    expect((await request(`/api/tasks/${accepted.task.id}`)).verificationStatus).toBe('passed');
  } finally {
    firstStop.abort(); secondStop.abort(); transport.mockRestore();
    await Promise.allSettled([firstRun, secondRun]); await rm(directory, { recursive: true, force: true });
  }
});
it('refuses a new final after lease expiry even when its native session remains recorded', async () => {
  const port = Number(new URL(base).port); await app.close(); await pool.end(); await start(port, 100);
  const a = await attempt(); await request('/api/runner/events', { ...a.ownership, events: [a.session] }, a.token);
  await sleep(160);
  await request('/api/runner/events', { ...a.ownership, events: [final(a.sessionId)] }, a.token, 409);
  expect((await request(`/api/tasks/${a.taskId}/assistant-messages`)).messages).toEqual([]);
  await expect.poll(async () => (await request(`/api/tasks/${a.taskId}`)).status, { timeout: 1500, interval: 20 }).toBe('uncertain');
  await app.close(); await pool.end(); await start(port);
});

it('records a failed synthetic SDK run without persisting error text as an assistant reply', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'flow-chat02-error-')); const stop = new AbortController();
  const runner = await request('/api/runners', { name: 'SDK error', harnesses: ['claude'], capacity: 1 });
  const accepted = await request('/api/tasks', { title: 'Failed reply', prompt: 'Synthetic error only', harness: 'claude' }, undefined, 202);
  const query: ClaudeQuery = () => Object.assign((async function* () {
    yield { type: 'result', subtype: 'success', is_error: true, uuid: randomUUID(), session_id: randomUUID(), result: 'API error must not become assistant text', modelUsage: {}, permission_denials: [] } as unknown as SDKMessage;
  })(), { close() {} });
  const running = runRunner({ baseUrl: base, token: runner.token, workingDirectory: directory, signal: stop.signal, adapters: [createClaudeAdapter({ materialFiles: [], query })], pollIntervalMs: 10 });
  try {
    await expect.poll(async () => (await request(`/api/tasks/${accepted.task.id}`)).status, { timeout: 3000, interval: 20 }).toBe('failed');
    expect((await request(`/api/tasks/${accepted.task.id}/assistant-messages`)).messages).toEqual([]);
    const task = await request(`/api/tasks/${accepted.task.id}`);
    expect(task.entries.some((entry: any) => entry.reference?.title === 'Claude result' || entry.reference?.title === 'Assistant reply')).toBe(false);
  } finally { stop.abort(); await running; await rm(directory, { recursive: true, force: true }); }
});
