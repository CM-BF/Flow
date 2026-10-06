import { randomUUID, createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { Pool } from 'pg';
import { beforeAll, afterAll, expect, it } from 'vitest';
import { conversationCreationSchema, taskSubmissionSchema, type EventBatch } from '@flow/contracts';
import { FlowClient } from './index.js';
import { createServer } from '../../../apps/server/src/index.js';

const name = `flow_f01_stream_${randomUUID().replaceAll('-', '')}`;
const admin = new Pool({ connectionString: 'postgresql://flow:flow-local-only@127.0.0.1:55432/postgres', max: 1 });
const databaseUrl = `postgresql://flow:flow-local-only@127.0.0.1:55432/${name}`;
const pool = new Pool({ connectionString: databaseUrl, max: 1 });
const facts: Record<string, unknown> = { database: name, startedAt: new Date().toISOString(), providerQueries: 0, productionFactory: true, automaticQueueScan: 'default' };
const token = 'f01-stream-owner';
let app: Awaited<ReturnType<typeof createServer>> | undefined;
let old: FlowClient, client: FlowClient, base: string;
let created = false;
async function start() {
  // The actual production factory owns all migration, read routes and negotiation wiring.
  app = await createServer({ databaseUrl, ownerToken: token, leaseMs: 300_000 });
  base = await app.listen({ host: '127.0.0.1', port: 0 });
  old = new FlowClient({ baseUrl: base, token });
  client = new FlowClient({ baseUrl: base, token, assistantStreamProtocol: 'patch-v1' });
}
beforeAll(async () => {
  facts.before = (await admin.query('SELECT datname FROM pg_database WHERE datname=$1', [name])).rows;
  if ((facts.before as unknown[]).length) throw Error('Refuse existing stream test database');
  await admin.query(`CREATE DATABASE ${name}`); created = true; await start();
});
afterAll(async () => {
  try {
    await app?.close(); await pool.end();
    facts.created = created;
    facts.connectionsBeforeDrop = (await admin.query('SELECT pid FROM pg_stat_activity WHERE datname=$1', [name])).rows;
    if (created) await admin.query(`DROP DATABASE ${name}`);
    facts.remaining = (await admin.query('SELECT datname FROM pg_database WHERE datname=$1', [name])).rows;
    facts.endedAt = new Date().toISOString();
    if (process.env.FLOW_F01_STREAM_EVIDENCE) await writeFile(process.env.FLOW_F01_STREAM_EVIDENCE, JSON.stringify(facts, null, 2));
  } finally { await admin.end(); }
});

it('mounts 022 before default startup and opts in only readable GETs while preserving old clients and creation replays', async () => {
  expect((await pool.query('SELECT version FROM flow.migrations WHERE version=22')).rowCount).toBe(1);
  expect(app!.hasRoute({ method: 'GET', url: '/api/tasks/:id/assistant-stream/patches' })).toBe(true);
  const input = conversationCreationSchema.parse({ title: 'Protocol negotiation 古🙂' }); const key = randomUUID();
  const accepted = await client.createConversation(input, key);
  expect(accepted.capabilities.liveAssistantText).toBe(false);
  expect(await old.createConversation(input, key)).toEqual({ ...accepted, replayed: true });
  expect((await old.conversation(accepted.conversation.id)).capabilities.liveAssistantText).toBe(false);
  expect((await client.conversation(accepted.conversation.id)).capabilities.liveAssistantText).toBe(true);
  // No turn/runner exists: this is connection readability, not a claim of provider streaming.
  for (const header of [undefined, 'future-v2', 'patch-v1']) {
    const response = await fetch(`${base}/api/conversations/${accepted.conversation.id}`, { headers: { authorization: `Bearer ${token}`, ...(header ? { 'X-Flow-Assistant-Stream': header } : {}) } });
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect((await response.json()).capabilities.liveAssistantText).toBe(header === 'patch-v1');
  }
  const stored = (await pool.query("SELECT response FROM flow.commands WHERE operation='conversation.create' AND key=$1", [key])).rows[0].response;
  expect(stored.capabilities.liveAssistantText).toBe(false);
  facts.negotiation = { oldFalse: true, optedInTrueWithoutTurns: true, unknownFalse: true, createReplayStableFalse: true, noStoreAllVariants: true };
});

it('reads bound durable Unicode patches through production client routes, hides generic references and resumes after restart', async () => {
  const registration = await old.registerRunner({ name: 'Stream integration synthetic', harnesses: ['claude'], capacity: 1 });
  let runner = new FlowClient({ baseUrl: base, token: registration.token });
  const accepted = await old.submit(taskSubmissionSchema.parse({ title: 'Incremental body', prompt: 'No provider or SDK query', harness: 'claude' }), randomUUID());
  let assignment: Awaited<ReturnType<FlowClient['claim']>>['assignment'];
  await expect.poll(async () => { assignment = (await runner.claim()).assignment; return assignment?.task.id; }, { timeout: 5000 }).toBe(accepted.task.id);
  const nativeSessionId = randomUUID(), nativeMessageId = randomUUID();
  const digest = (text: string) => createHash('sha256').update(text).digest('hex');
  const streamId = digest(JSON.stringify([nativeSessionId, nativeMessageId, 0]));
  const text = '逐段正文🙂';
  const batch: EventBatch = { attemptId: assignment!.attempt.id, ownerVersion: assignment!.attempt.ownerVersion, events: [
    { id: randomUUID(), sequence: 1, type: 'session', nativeSessionId, adapterVersion: 'claude-sdk-0.3.290-v2' },
    { id: randomUUID(), sequence: 2, type: 'assistant-stream', streamId, nativeSessionId, nativeMessageId, parentToolUseId: null,
      source: 'claude.sdk.stream', sourceMessageId: randomUUID(), blockIndex: 0, revision: 1, fromBytes: 0, text, prefixDigest: digest(text), phase: 'streaming', reason: null, truncated: false },
  ] };
  await runner.report(batch); expect(await runner.report(batch)).toMatchObject({ accepted: 0, lastSequence: 2 });
  const page = await client.assistantStream(accepted.task.id, { limit: 1 });
  expect(page).toMatchObject({ taskId: accepted.task.id, attemptId: assignment!.attempt.id, finalMessageId: null });
  expect(page.blocks).toHaveLength(1); expect(JSON.stringify(page)).not.toContain(text);
  expect(await client.assistantStreamPatches(accepted.task.id, { attemptId: assignment!.attempt.id, limit: 8 })).toMatchObject({ nextCursor: 2, hasMore: false, patches: [{ text, fromBytes: 0, prefixDigest: digest(text) }] });
  expect(await client.assistantStreamBlock(accepted.task.id, streamId)).toMatchObject({ content: text, bytes: Buffer.byteLength(text) });
  await expect(runner.assistantStreamBlock(accepted.task.id, streamId)).rejects.toMatchObject({ status: 403 });
  expect((await fetch(`${base}/api/tasks/${accepted.task.id}/assistant-stream`)).status).toBe(401);
  const hidden = await old.events(accepted.task.id, 1);
  expect(hidden.entries).toEqual([]); expect(hidden.nextCursor).toBe(2); expect(hidden.watermark).toBe(2); expect(hidden.hasMore).toBe(false);
  await app!.close(); app = undefined; await start(); runner = new FlowClient({ baseUrl: base, token: registration.token });
  expect(await runner.report(batch)).toMatchObject({ accepted: 0, lastSequence: 2 });
  expect((await client.assistantStreamPatches(accepted.task.id, { attemptId: assignment!.attempt.id, after: 2 })).patches).toEqual([]);
  expect(await client.assistantStreamBlock(accepted.task.id, streamId)).toMatchObject({ content: text });
  await runner.report({ ...batch, events: [{ id: randomUUID(), sequence: 3, type: 'message', text: 'Visible after stream' }] });
  expect((await old.events(accepted.task.id, hidden.nextCursor)).entries).toMatchObject([{ cursor: 3, text: 'Visible after stream' }]);
  await runner.report({ ...batch, events: [{ id: randomUUID(), sequence: 4, type: 'completed', outcome: 'cancelled' }] });
  facts.stream = { taskId: accepted.task.id, attemptId: assignment!.attempt.id, bytes: Buffer.byteLength(text), patches: 1, restartPreserved: true, duplicateAccepted: 0, genericReferencesHidden: true, nextOrdinaryCursor: 3 };
});
