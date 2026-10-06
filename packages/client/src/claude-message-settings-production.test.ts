import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { open, statfs, type FileHandle } from 'node:fs/promises';
import { Pool } from 'pg';
import { afterAll, beforeAll, expect, it } from 'vitest';
import {
  CLAUDE_TURN_SETTINGS_PROTOCOL, conversationCreationSchema,
  type ClaudeTurnSettings, type ConversationQueueEnqueue, type ConversationTurnAdmission,
  type ExecutionProfileConfiguration,
} from '@flow/contracts';
import { createServer } from '../../../apps/server/src/index.js';
import { FlowClient } from './index.js';

const database = `flow_f01_settings_${randomUUID().replaceAll('-', '')}`;
const marker = randomUUID(), ownerToken = randomUUID();
const adminUrl = 'postgresql://flow:flow-local-only@127.0.0.1:55432/postgres';
const databaseUrl = adminUrl.replace(/postgres$/, database);
const bounds = { max: 1, connectionTimeoutMillis: 2000, statement_timeout: 5000, query_timeout: 6000 };
const admin = new Pool({ connectionString: adminUrl, ...bounds });
const pool = new Pool({ connectionString: databaseUrl, ...bounds });
const evidencePath = `docs/evidence/f01/claude-message-settings-production-${marker}.json`;
const facts: Record<string, unknown> = { database, marker, providerCalls: 0, runtimeStarts: 0, startedAt: new Date().toISOString() };
let evidence: FileHandle | undefined, admitted = false, created = false, marked = false;
let app: Awaited<ReturnType<typeof createServer>> | undefined, client: FlowClient, origin = '';
const signal = () => AbortSignal.timeout(5000);

async function checkpoint(phase: string) {
  if (!evidence) return;
  const bytes = Buffer.from(JSON.stringify({ ...facts, phase }, null, 2) + '\n');
  assert(bytes.length <= 32768);
  const result = await evidence.write(bytes, 0, bytes.length, 0);
  assert.equal(result.bytesWritten, bytes.length);
  await evidence.truncate(bytes.length); await evidence.sync();
}
async function start() {
  // No manual migration or custom route registration: this must exercise production ordering.
  app = await createServer({ databaseUrl, ownerToken, leaseMs: 30_000 });
  origin = await app.listen({ host: '127.0.0.1', port: 0 });
  client = new FlowClient({ baseUrl: origin, token: ownerToken });
}
beforeAll(async () => {
  const space = await statfs(process.cwd()); facts.freeBytesBefore = space.bavail * space.bsize;
  assert(space.bavail * space.bsize >= 1024 ** 3 + 32 * 1024 ** 2, 'Insufficient reserve; no DB created.');
  evidence = await open(evidencePath, 'wx', 0o600);
  admitted = true;
  console.info(JSON.stringify({ settingsProductionEvidence: evidencePath, database }));
  facts.before = (await admin.query('SELECT datname FROM pg_database WHERE datname=$1', [database])).rows;
  assert.deepEqual(facts.before, []);
  await checkpoint('database-name-reserved');
  facts.creationRequested = true; await checkpoint('before-create');
  await admin.query(`CREATE DATABASE "${database}"`); created = true; facts.created = true;
  await checkpoint('created-awaiting-marker');
  await admin.query(`COMMENT ON DATABASE "${database}" IS '${marker}'`); marked = true; facts.marked = true;
  await checkpoint('before-production-start');
  await start();
}, 30_000);
afterAll(async () => {
  if (!admitted) { await pool.end(); await admin.end(); return; }
  const errors: string[] = [];
  let appClosed = false, poolClosed = false;
  try {
    try { await app?.close(); app = undefined; appClosed = true; } catch { errors.push('app-close'); }
    try { await pool.end(); poolClosed = true; } catch { errors.push('pool-close'); }
    Object.assign(facts, { appClosed, poolClosed });
    if (created && marked && appClosed && poolClosed) {
      try {
        const row = (await admin.query("SELECT shobj_description(oid,'pg_database') AS marker,pg_database_size(oid)::text AS bytes FROM pg_database WHERE datname=$1", [database])).rows[0];
        assert.equal(row?.marker, marker); facts.databaseBytes = Number(row.bytes);
        facts.connections = (await admin.query('SELECT pid FROM pg_stat_activity WHERE datname=$1', [database])).rows;
        assert.deepEqual(facts.connections, []);
        await checkpoint('before-normal-drop');
        await admin.query(`DROP DATABASE "${database}"`); facts.dropped = true;
      } catch { errors.push('database-cleanup-unconfirmed'); }
    } else if (facts.creationRequested) errors.push('ownership-or-close-unconfirmed');
    try {
      facts.remaining = (await admin.query('SELECT datname FROM pg_database WHERE datname=$1', [database])).rows;
      if ((facts.remaining as unknown[]).length) errors.push('database-retained');
    } catch { errors.push('database-absence-unconfirmed'); }
  } finally {
    try { await admin.end(); facts.adminClosed = true; } catch { errors.push('admin-close'); }
    Object.assign(facts, { errors, endedAt: new Date().toISOString() });
    await checkpoint(errors.length ? 'unknown-retain-resources' : 'cleaned');
    await evidence?.close();
  }
  expect(errors).toEqual([]); expect(facts.remaining).toEqual([]);
}, 30_000);

const choices: ClaudeTurnSettings['requested'][] = [
  { model: 'synthetic-alias-a', thinking: 'adaptive', effort: { kind: 'level', value: 'high' }, speed: 'fast' },
  { model: 'synthetic-alias-b', thinking: 'disabled', effort: { kind: 'level', value: 'low' }, speed: 'standard' },
];
const legacy: ExecutionProfileConfiguration = {
  harness: 'claude', adapterVersion: 'claude-sdk-0.3.290-v2', model: 'synthetic-legacy', thinking: 'disabled',
  permissionMode: 'dontAsk', access: 'none', requireReadApproval: false, materialScopeDigest: 'a'.repeat(64),
  limits: { maxTurns: 1, maxBudgetUsd: 0.1, timeoutMs: 1000 },
};
async function publish(optIn: boolean) {
  const runner = await client.registerRunner({ name: 'Synthetic settings production reader', harnesses: ['claude'], capacity: 1 }, signal());
  const runnerClient = new FlowClient({ baseUrl: origin, token: runner.token });
  const configuration: ExecutionProfileConfiguration = { ...legacy,
    ...(optIn ? { turnSettings: { protocol: CLAUDE_TURN_SETTINGS_PROTOCOL, choices } } : {}) };
  return (await runnerClient.publishExecutionProfile({ configuration }, signal())).profile.reference;
}

it('uses the production migration and public client to preserve opt-in send and queued settings across restart', { timeout: 30_000 }, async () => {
  expect((await pool.query('SELECT count(*)::int AS n FROM flow.migrations WHERE version=32')).rows[0].n).toBe(1);
  const reference = await publish(true), oldReference = await publish(false);
  const catalog = await client.claudeMessageSettingsProfiles({ limit: 1 }, signal());
  expect(catalog.profiles).toHaveLength(1); expect(catalog.profiles[0]!.profile.reference).toEqual(reference);
  expect((await client.executionProfiles({ limit: 1 }, signal())).profiles.map(profile => profile.reference)).toEqual([oldReference]);
  const createdConversation = await client.createConversation(conversationCreationSchema.parse({ title: 'Public settings integration', executionProfile: reference }), randomUUID(), signal());
  const id = createdConversation.conversation.id;
  expect(createdConversation.capabilities.messageSettings).toEqual({ protocol: CLAUDE_TURN_SETTINGS_PROTOCOL, profile: reference, choices: 'execution-profile' });
  const snapshot = (index: number): ClaudeTurnSettings => ({ protocol: CLAUDE_TURN_SETTINGS_PROTOCOL, profile: reference, requested: structuredClone(choices[index]!) });
  const a: ConversationTurnAdmission = { expectedRevision: 0, mode: 'follow-up', text: 'Frozen A', messageSettings: snapshot(0) };
  const frozenA = structuredClone(a), sendKey = randomUUID();
  const pendingA = client.submitConversationTurn(id, a, sendKey, signal());
  a.messageSettings!.requested.model = 'later-unsent-draft-c';
  const accepted = await pendingA;
  expect(accepted.turn.messageSettings).toEqual(frozenA.messageSettings);
  const b: ConversationQueueEnqueue = { expectedQueueRevision: 0, text: 'a'.repeat(509) + '🙂 queued B', messageSettings: snapshot(1) };
  const frozenB = structuredClone(b), queueKey = randomUUID();
  const pendingB = client.enqueueConversationTurn(id, b, queueKey, signal());
  b.messageSettings!.requested.model = 'another-unsent-draft';
  const queued = await pendingB;
  expect(queued.item).toMatchObject({ messageSettings: frozenB.messageSettings, preview: 'a'.repeat(509), truncated: true, state: 'waiting', promoted: null });
  expect((await client.conversation(id, signal())).lastTurn!.messageSettings).toEqual(frozenA.messageSettings);
  expect((await client.conversationQueueItem(id, queued.item.id, signal())).item).toMatchObject({ text: frozenB.text, messageSettings: frozenB.messageSettings });
  facts.accepted = { taskId: accepted.turn.task.id, queueItemId: queued.item.id, sendKey, queueKey };
  await checkpoint('accepted-before-restart');
  await app!.close(); app = undefined; await start();
  expect(await client.submitConversationTurn(id, frozenA, sendKey, signal())).toEqual({ ...accepted, replayed: true });
  expect(await client.enqueueConversationTurn(id, frozenB, queueKey, signal())).toEqual({ ...queued, replayed: true });
  await expect(client.enqueueConversationTurn(id, { ...frozenB, messageSettings: snapshot(0) }, queueKey, signal())).rejects.toMatchObject({ status: 409 });
  expect((await pool.query('SELECT submission FROM flow.tasks WHERE id=$1', [accepted.turn.task.id])).rows[0].submission.messageSettings).toEqual(frozenA.messageSettings);
  expect((await pool.query('SELECT message_settings FROM flow.conversation_queue WHERE id=$1', [queued.item.id])).rows[0].message_settings).toEqual(frozenB.messageSettings);
  expect((await pool.query('SELECT count(*)::int AS n FROM flow.migrations WHERE version=32')).rows[0].n).toBe(1);
  const counts = (await pool.query('SELECT (SELECT count(*)::int FROM flow.tasks) AS tasks,(SELECT count(*)::int FROM flow.attempts) AS attempts,(SELECT count(*)::int FROM flow.conversation_queue) AS queued')).rows[0];
  expect(counts).toEqual({ tasks: 1, attempts: 0, queued: 1 });
  facts.journey = { migrationAtStartup: true, publicCatalogNegotiated: true, legacyCatalogIsolated: true, receivedAckThenRestart: true, snapshotsFrozen: true, counts };
  await checkpoint('journey-verified');
});
