import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { Pool } from 'pg';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { conversationCreationSchema, conversationTurnSchema, type KnowledgeCitation } from '@flow/contracts';
import { createServer } from '../../../apps/server/src/index.js';
import { FlowClient } from './index.js';

const name = `flow_f01_context_${randomUUID().replaceAll('-', '')}`;
const admin = new Pool({ connectionString: 'postgresql://flow:flow-local-only@127.0.0.1:55432/postgres', max: 1 });
const options = { databaseUrl: `postgresql://flow:flow-local-only@127.0.0.1:55432/${name}`, ownerToken: 'f01-context-owner' };
const pool = new Pool({ connectionString: options.databaseUrl, max: 2 });
let app: Awaited<ReturnType<typeof createServer>> | undefined;
let client: FlowClient;
let created = false;
const facts: Record<string, unknown> = { database: name, startedAt: new Date().toISOString(), models: 0 };
async function start() {
  // No module registration, manual migrate, scan call or disabled automatic scanning in this fixture.
  app = await createServer(options);
  client = new FlowClient({ baseUrl: await app.listen({ host: '127.0.0.1', port: 0 }), token: options.ownerToken });
}
beforeAll(async () => { await admin.query(`CREATE DATABASE ${name}`); created = true; await start(); });
afterAll(async () => {
  try {
    await app?.close(); await pool.end();
    if (created) await admin.query(`DROP DATABASE ${name}`);
    facts.remainingDatabases = (await admin.query('SELECT datname FROM pg_database WHERE datname=$1', [name])).rows;
    facts.endedAt = new Date().toISOString();
    await writeFile('docs/evidence/f01/context-production-facts.json', JSON.stringify(facts, null, 2));
  } finally { await admin.end(); }
});

it('mounts 018 and 019 before default queue readiness and restores frozen context through real HTTP after restart', async () => {
  expect(app!.hasRoute({ method: 'GET', url: '/api/conversations/:conversationId/contexts/:contextId' })).toBe(true);
  const migrations = (await pool.query('SELECT version FROM flow.migrations ORDER BY version')).rows.map(row => row.version);
  expect(migrations).toEqual(expect.arrayContaining([7, 11, 15, 17, 18, 19]));
  facts.migrationsAtReady = migrations;
  const project = await client.createProject({ workspaceId: 'personal', title: 'Context integration' }, randomUUID());
  const projectId = project.snapshot.project.id;
  const text = 'Private material 古😀 v1';
  const source = await client.createKnowledgeSource(projectId, { expectedVersion: 0, title: 'Selected material', text }, randomUUID());
  const citation: KnowledgeCitation = { projectId, sourceId: source.source.id, version: 1, contentDigest: source.version.contentDigest, locator: { kind: 'utf8-bytes', start: 0, end: Buffer.byteLength(text) } };
  const conversation = await client.createConversation(conversationCreationSchema.parse({ title: 'Frozen queue', projectId }), randomUUID());
  const id = conversation.conversation.id;
  expect(conversation.capabilities.knowledgeContext).toBe(true);
  await client.pauseConversationQueue(id, { expectedQueueRevision: 0 }, randomUUID());
  const enqueueInput = { expectedQueueRevision: 1, text: 'Use my selected reference.', knowledge: [citation] };
  const key = randomUUID();
  const accepted = await client.enqueueConversationTurn(id, enqueueInput, key);
  expect(accepted.item.state).toBe('waiting');
  expect(accepted.item.context).toBeDefined();
  expect(JSON.stringify(accepted)).not.toContain(text);
  await client.publishKnowledgeVersion(projectId, source.source.id, { expectedVersion: 1, text: 'Changed v2' }, randomUUID());
  await app!.close(); app = undefined;
  // A persisted unpaused intent is the startup recovery input. This is fixture setup, not a product unpause command.
  await pool.query('UPDATE flow.conversations SET queue_paused=false WHERE id=$1', [id]);
  await start();
  const promoted = await client.conversationQueueItem(id, accepted.item.id);
  expect(promoted.item.state).toBe('promoted');
  expect(promoted.item.context).toEqual(accepted.item.context);
  expect(await client.enqueueConversationTurn(id, enqueueInput, key)).toEqual({ ...accepted, replayed: true });
  const taskId = promoted.item.promoted!.taskId;
  const snapshot = await client.conversation(id);
  expect(snapshot.lastTurn?.task.id).toBe(taskId);
  expect(snapshot.lastTurn?.user.text).toBe(enqueueInput.text);
  expect(JSON.stringify(snapshot)).not.toContain(text);
  expect((await client.show(taskId)).prompt).toBe(enqueueInput.text);
  const contextId = accepted.item.context!.id;
  const detail = await client.conversationContext(id, contextId);
  expect(detail.sources[0]).toMatchObject({ text, currentVersion: 2, isCurrent: false });
  const registration = await client.registerRunner({ name: 'No model context consumer', harnesses: ['claude'], capacity: 1 });
  const runner = new FlowClient({ baseUrl: app!.listeningOrigin, token: registration.token });
  await expect(runner.conversationContext(id, contextId)).rejects.toMatchObject({ status: 403, code: 'wrong_role' });
  const other = await client.createConversation(conversationCreationSchema.parse({ title: 'Other' }), randomUUID());
  await expect(client.conversationContext(other.conversation.id, contextId)).rejects.toMatchObject({ status: 404 });
  let assignment: Awaited<ReturnType<FlowClient['claim']>>['assignment'];
  await expect.poll(async () => { assignment = (await runner.claim()).assignment; return assignment?.task.id; }, { timeout: 5000 }).toBe(taskId);
  expect(assignment!.task.prompt).toContain(text);
  expect(assignment!.task.prompt).not.toContain('Changed v2');
  expect(assignment!.conversationContext).toMatchObject({ id: contextId, contextDigest: accepted.item.context!.contextDigest });
  await runner.report({ attemptId: assignment!.attempt.id, ownerVersion: assignment!.attempt.ownerVersion, events: [{ id: randomUUID(), sequence: 1, type: 'completed', outcome: 'cancelled' }] });
  facts.context = { conversationId: id, taskId, queueItemId: accepted.item.id, contextId, frozenVersion: 1, currentVersion: 2, defaultStartupPromoted: true, publicPromptUnchanged: true, privateClaimContainsFrozenText: true };
});

it('keeps legacy plain conversations and claims unchanged with the two new migrations mounted', async () => {
  const conversation = await client.createConversation(conversationCreationSchema.parse({ title: 'Plain legacy' }), randomUUID());
  const accepted = await client.submitConversationTurn(conversation.conversation.id, conversationTurnSchema.parse({ expectedRevision: 0, text: 'Only the user text.' }), randomUUID());
  expect(accepted.turn.context).toBeUndefined();
  const registration = await client.registerRunner({ name: 'Legacy consumer', harnesses: ['claude'], capacity: 1 });
  const runner = new FlowClient({ baseUrl: app!.listeningOrigin, token: registration.token });
  let assignment: Awaited<ReturnType<FlowClient['claim']>>['assignment'];
  await expect.poll(async () => { assignment = (await runner.claim()).assignment; return assignment?.task.id; }, { timeout: 5000 }).toBe(accepted.turn.task.id);
  expect(assignment!.task.prompt).toBe('Only the user text.');
  expect(assignment!.conversationContext).toBeUndefined();
  facts.legacyPlainClaim = true;
});
