import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { Pool } from 'pg';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { createServer } from '../../../apps/server/src/index.js';
import { FlowClient } from './index.js';
import { conversationCreationSchema } from '@flow/contracts';

const name = `flow_f01_queue_${randomUUID().replaceAll('-', '')}`;
const admin = new Pool({ connectionString: 'postgresql://flow:flow-local-only@127.0.0.1:55432/postgres', max: 1 });
const databaseUrl = `postgresql://flow:flow-local-only@127.0.0.1:55432/${name}`;
const pool = new Pool({ connectionString: databaseUrl, max: 3 });
let server: Awaited<ReturnType<typeof createServer>> | undefined;
let client: FlowClient;
let created = false;
async function start() {
  server = await createServer({ databaseUrl, ownerToken: 'f01-queue-owner' });
  client = new FlowClient({ baseUrl: await server.listen({ host: '127.0.0.1', port: 0 }), token: 'f01-queue-owner' });
}
beforeAll(async () => { await admin.query(`CREATE DATABASE ${name}`); created = true; await start(); });
afterAll(async () => {
  try { await server?.close(); await pool.end(); if (created) await admin.query(`DROP DATABASE ${name}`); }
  finally { await admin.end(); }
});

it('mounts queue commands under authentication and recovers durable waiting work during center readiness', async () => {
  const { conversation } = await client.createConversation(conversationCreationSchema.parse({ title: 'Production queue' }), randomUUID());
  expect((await client.conversation(conversation.id)).capabilities.queue).toBe(true);
  await client.pauseConversationQueue(conversation.id, { expectedQueueRevision: 0 }, randomUUID());
  const accepted = await client.enqueueConversationTurn(conversation.id, { expectedQueueRevision: 1, text: 'Persist across restart' }, randomUUID());
  await server!.close(); server = undefined;
  // Controlled startup fixture: an already-persisted, unpaused queue; not a product recovery command.
  await pool.query('UPDATE flow.conversations SET queue_paused=false WHERE id=$1', [conversation.id]);
  await start();
  const item = await client.conversationQueueItem(conversation.id, accepted.item.id);
  expect(item.item.state).toBe('promoted');
  expect(item.item.promoted?.taskId).toBe((await client.conversation(conversation.id)).lastTurn?.task.id);
  expect((await pool.query('SELECT count(*)::int AS n FROM flow.conversation_turns WHERE conversation_id=$1', [conversation.id])).rows[0].n).toBe(1);
  const response = await server!.inject({ method: 'GET', url: `/api/conversations/${conversation.id}/queue` });
  expect(response.statusCode).toBe(401);
});

it('waits for an in-flight scan before disposing its pool and does not overlap interval scans', async () => {
  const { conversation } = await client.createConversation(conversationCreationSchema.parse({ title: 'Drain queue scan' }), randomUUID());
  await client.pauseConversationQueue(conversation.id, { expectedQueueRevision: 0 }, randomUUID());
  const accepted = await client.enqueueConversationTurn(conversation.id, { expectedQueueRevision: 1, text: 'One durable intent' }, randomUUID());
  const lock = await pool.connect();
  let closing: Promise<void> | undefined;
  try {
    await lock.query('BEGIN');
    await lock.query('SELECT id FROM flow.conversation_queue WHERE id=$1 FOR UPDATE', [accepted.item.id]);
    await pool.query('UPDATE flow.conversations SET queue_paused=false WHERE id=$1', [conversation.id]);
    await expect.poll(async () => (await pool.query("SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%conversation_queue%' ")).rows[0].n, { timeout: 5000 }).toBe(1);
    // A second interval cannot start another scan while this transaction is still blocked.
    await delay(1100);
    expect((await pool.query("SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%conversation_queue%' ")).rows[0].n).toBe(1);
    let closed = false;
    closing = server!.close().then(() => { closed = true; });
    await delay(50); expect(closed).toBe(false);
    await lock.query('COMMIT');
    await closing; server = undefined;
    expect((await pool.query('SELECT count(*)::int AS n FROM flow.conversation_turns WHERE conversation_id=$1', [conversation.id])).rows[0].n).toBe(1);
  } finally {
    await lock.query('ROLLBACK'); lock.release();
    await closing;
  }
});
