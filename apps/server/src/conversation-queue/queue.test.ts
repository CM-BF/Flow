import { setTimeout as delay } from 'node:timers/promises';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { Pool } from 'pg';
import { PgBoss } from 'pg-boss';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { createServer } from '../index.js';
import { migrateConversationQueue, registerConversationQueueRoutes, promoteReady, scanConversationQueue } from './index.js';

const databaseName = `flow_chat04_${process.pid}_${randomUUID().slice(0, 8)}`;
const localAdmin = process.env.FLOW_CHAT04_TEST_ADMIN ?? 'postgresql://flow:flow-local-only@127.0.0.1:55432/postgres';
const databaseUrl = new URL(localAdmin); databaseUrl.pathname = `/${databaseName}`;
const admin = new Pool({ connectionString: localAdmin, max: 1 });
const ownerToken = randomUUID();
let created = false;
let pool: Pool;
let boss: PgBoss;
let server: Awaited<ReturnType<typeof createServer>> | undefined;
let baseUrl: string;
const startedAt = new Date().toISOString();
async function start() {
  server = await createServer({ databaseUrl: databaseUrl.href, ownerToken });
  await migrateConversationQueue(pool);
  registerConversationQueueRoutes(server, pool);
  baseUrl = await server.listen({ host: '127.0.0.1', port: 0 });
}
async function request(path: string, body?: unknown, key = randomUUID()) {
  const response = await fetch(`${baseUrl}${path}`, { method: body === undefined ? 'GET' : 'POST', headers: { authorization: `Bearer ${ownerToken}`, 'content-type': 'application/json', 'idempotency-key': key }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(10_000) });
  return { status: response.status, body: await response.json() };
}
async function conversation() {
  const result = await request('/api/conversations', { title: 'Queue test' });
  expect(result.status).toBe(201);
  return result.body.conversation;
}
beforeAll(async () => {
  if ((await admin.query('SELECT 1 FROM pg_database WHERE datname=$1', [databaseName])).rowCount) throw new Error('Refusing existing test database.');
  await writeFile(new URL('../../../../docs/evidence/chat04/latest-resource.json', import.meta.url), JSON.stringify({ databaseName, startedAt }));
  await admin.query(`CREATE DATABASE "${databaseName}"`); created = true;
  pool = new Pool({ connectionString: databaseUrl.href, max: 10, statement_timeout: 5000 });
  await start();
  boss = new PgBoss({ connectionString: databaseUrl.href, max: 2 });
  boss.on('error', error => console.error('CHAT04 scheduler:', error.message));
  await boss.start();
});
afterAll(async () => {
  try {
    await server?.close();
    await boss?.stop({ graceful: true, timeout: 5000 });
    await pool?.end();
    if (created) {
      const deadline = performance.now() + 5000;
      while (Number((await admin.query('SELECT count(*) AS count FROM pg_stat_activity WHERE datname=$1', [databaseName])).rows[0].count)) {
        if (performance.now() > deadline) throw new Error('Own database still has live connections.');
        await delay(25);
      }
      await admin.query(`DROP DATABASE "${databaseName}"`);
    }
    const remaining = (await admin.query('SELECT datname FROM pg_database WHERE datname=$1', [databaseName])).rows;
    await writeFile(new URL('../../../../docs/evidence/chat04/latest-cleanup.json', import.meta.url), JSON.stringify({ startedAt, endedAt: new Date().toISOString(), databaseName, remaining }, null, 2));
  } finally { await admin.end(); }
});
it('persists an immutable enqueue receipt through ACK loss and exposes current cancellation with independent revision', async () => {
  const c = await conversation();
  const path = `/api/conversations/${c.id}/queue`;
  const key = randomUUID(); const input = { expectedQueueRevision: 0, text: 'First waiting intent' };
  const accepted = await request(path, input, key);
  expect(accepted.status).toBe(202);
  expect(accepted.body).toMatchObject({ queueRevision: 1, item: { sequence: 1, state: 'waiting', promoted: null }, replayed: false });
  const replay = await request(path, input, key);
  expect(replay.body).toEqual({ ...accepted.body, replayed: true });
  expect((await request(path, { ...input, text: 'changed' }, key)).status).toBe(409);
  const page = await request(path);
  expect(page.body.items).toEqual([accepted.body.item]);
  expect((await request(`/api/conversations/${c.id}`)).body.conversation.revision).toBe(0);
  const cancelKey = randomUUID();
  const cancelled = await request(`${path}/${accepted.body.item.id}/cancel`, { expectedQueueRevision: 1 }, cancelKey);
  expect(cancelled.body).toMatchObject({ outcome: 'cancelled', queueRevision: 2, item: { state: 'cancelled' } });
  expect((await request(`${path}/${accepted.body.item.id}/cancel`, { expectedQueueRevision: 1 }, cancelKey)).body).toEqual({ ...cancelled.body, replayed: true });
  expect((await request(path, input, key)).body).toEqual({ ...accepted.body, replayed: true });
  expect((await request(`${path}/${accepted.body.item.id}`)).body).toMatchObject({ queueRevision: 2, item: { state: 'cancelled', text: input.text } });
});
