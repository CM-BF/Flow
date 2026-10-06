import { randomUUID } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import { Pool, type PoolClient } from 'pg';
import { afterAll, beforeAll, expect, it } from 'vitest';
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
async function start() { app = await createServer({ databaseUrl, ownerToken: 'chat02-owner', leaseMs: 5000 }); pool = new Pool({ connectionString: databaseUrl });
  if (!app.hasRoute({ method: 'GET', url: '/api/assistant-messages/:id' })) { await migrateAssistantMessages(pool); registerAssistantRoutes(app, pool); }
  base = await app.listen({ host: '127.0.0.1', port: 0 }); }
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
  expect(page.messages[0]).not.toHaveProperty('content');
  expect(await request(`/api/assistant-messages/${event.messageId}`)).toMatchObject({ content: '最终正文 🌱', contentDigest: sha256('最终正文 🌱') });
});
