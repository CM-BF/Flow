import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { Pool } from 'pg';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { taskSubmissionSchema, type ClaimedTask } from '@flow/contracts';
import { CLAUDE_CONTEXT_SOURCE } from '../../contracts/src/context-observation-event.js';
import { createServer } from '../../../apps/server/src/index.js';
import { FlowClient } from './index.js';

const database = `flow_f01_context_history_${randomUUID().replaceAll('-', '')}`;
const admin = new Pool({ connectionString: 'postgresql://flow:flow-local-only@127.0.0.1:55432/postgres', max: 1, connectionTimeoutMillis: 2000 });
const databaseUrl = `postgresql://flow:flow-local-only@127.0.0.1:55432/${database}`;
const pool = new Pool({ connectionString: databaseUrl, max: 1, connectionTimeoutMillis: 2000 });
const facts: Record<string, unknown> = { database, startedAt: new Date().toISOString(), providerCalls: 0, factoryOnly: true };
let app: Awaited<ReturnType<typeof createServer>> | undefined;
let owner: FlowClient;
let created = false;
async function start() {
  app = await createServer({ databaseUrl, ownerToken: 'synthetic-context-owner', leaseMs: 300_000 });
  owner = new FlowClient({ baseUrl: await app.listen({ host: '127.0.0.1', port: 0 }), token: 'synthetic-context-owner' });
}
beforeAll(async () => {
  facts.before = (await admin.query('SELECT datname FROM pg_database WHERE datname=$1', [database])).rows;
  if ((facts.before as unknown[]).length) throw new Error('Refuse pre-existing integration database');
  await admin.query(`CREATE DATABASE ${database}`); created = true; await start();
});
afterAll(async () => {
  try {
    await app?.close(); await pool.end();
    facts.connections = (await admin.query('SELECT pid FROM pg_stat_activity WHERE datname=$1', [database])).rows;
    if ((facts.connections as unknown[]).length) throw new Error('Owned database still has connections');
    if (created) await admin.query(`DROP DATABASE ${database}`);
    facts.remaining = (await admin.query('SELECT datname FROM pg_database WHERE datname=$1', [database])).rows;
  } finally {
    facts.created = created; facts.finishedAt = new Date().toISOString();
    await admin.end();
    if (process.env.FLOW_F01_CONTEXT_HISTORY_EVIDENCE) await writeFile(process.env.FLOW_F01_CONTEXT_HISTORY_EVIDENCE, JSON.stringify(facts, null, 2));
  }
});

it('mounts 027 and binds durable history to the authenticated report transaction across replay and restart', async () => {
  expect(app!.hasRoute({ method: 'GET', url: '/api/tasks/:id/context/history' })).toBe(true);
  expect((await pool.query('SELECT version FROM flow.migrations WHERE version=27')).rows).toEqual([{ version: 27 }]);
  const registration = await owner.registerRunner({ name: 'Context history fixture', harnesses: ['claude'], capacity: 1 });
  let runner = new FlowClient({ baseUrl: app!.listeningOrigin, token: registration.token });
  const { profile } = await runner.publishExecutionProfile({ configuration: { harness: 'claude', adapterVersion: CLAUDE_CONTEXT_SOURCE.adapterVersion,
    model: 'sonnet', thinking: 'disabled', permissionMode: 'dontAsk', access: 'none', requireReadApproval: false,
    materialScopeDigest: 'a'.repeat(64), limits: { maxTurns: 2, maxBudgetUsd: 0.2, timeoutMs: 60_000 } } });
  const accepted = await owner.submit(taskSubmissionSchema.parse({ title: 'Context metadata', prompt: 'PRIVATE_SYNTHETIC_PROMPT', harness: 'claude', executionProfile: profile.reference }), randomUUID());
  expect(await owner.contextHistory(accepted.task.id)).toMatchObject({ taskId: accepted.task.id, attemptId: null, latest: null, remaining: { kind: 'unknown', value: null } });
  let assignment: ClaimedTask | null = null;
  await expect.poll(async () => { assignment = (await runner.claim()).assignment; return assignment?.task.id; }, { timeout: 5000 }).toBe(accepted.task.id);
  const owned = assignment as unknown as ClaimedTask;
  const ownership = { attemptId: owned.attempt.id, ownerVersion: owned.attempt.ownerVersion };
  const nativeSessionId = randomUUID();
  await runner.report({ ...ownership, events: [{ id: randomUUID(), sequence: 1, type: 'session', nativeSessionId, adapterVersion: CLAUDE_CONTEXT_SOURCE.adapterVersion }] });
  const observation = { source: CLAUDE_CONTEXT_SOURCE, observationId: 'history-sample-1', observedAt: new Date().toISOString(), nativeSessionId,
    resolvedModel: 'synthetic-resolved-model', used: 123, compactionWindow: 1000, categories: [{ kind: 'used' as const, tokens: 123 }] };
  const batch = { ...ownership, events: [{ id: randomUUID(), sequence: 2, type: 'context-observation' as const, observation }] };
  await expect(runner.report({ ...batch, events: [{ ...batch.events[0]!, observation: { ...observation, nativeSessionId: 'wrong-session' } }] })).rejects.toMatchObject({ status: 409 });
  expect((await pool.query('SELECT count(*)::int AS n FROM flow.context_observations')).rows[0]!.n).toBe(0);
  expect(await runner.report(batch)).toEqual({ accepted: 1, lastSequence: 2 });
  const history = await owner.contextHistory(accepted.task.id);
  expect(history.latest?.observation.identity.subject).toMatchObject({ taskId: accepted.task.id, attemptId: owned.attempt.id, ownerVersion: owned.attempt.ownerVersion, nativeSessionId });
  expect(history.latest?.observation.used).toMatchObject({ kind: 'estimate', value: 123 });
  expect(history.current).toMatchObject({ kind: 'unknown', value: null });
  expect(history.remaining).toMatchObject({ kind: 'unknown', value: null });
  expect(JSON.stringify(history)).not.toContain('PRIVATE_SYNTHETIC_PROMPT');
  expect(await runner.report(batch)).toEqual({ accepted: 0, lastSequence: 2 });
  expect(await owner.contextHistory(accepted.task.id)).toEqual(history);
  const path = `/api/tasks/${accepted.task.id}/context/history`;
  expect((await fetch(app!.listeningOrigin + path)).status).toBe(401);
  await expect(runner.contextHistory(accepted.task.id)).rejects.toMatchObject({ status: 403 });
  const response = await fetch(app!.listeningOrigin + path, { headers: { authorization: 'Bearer synthetic-context-owner' } });
  expect(response.headers.get('cache-control')).toBe('no-store'); await response.arrayBuffer();
  await app!.close(); app = undefined; await start();
  runner = new FlowClient({ baseUrl: app!.listeningOrigin, token: registration.token });
  expect(await owner.contextHistory(accepted.task.id)).toEqual(history);
  expect(await runner.report(batch)).toEqual({ accepted: 0, lastSequence: 2 });
  expect((await pool.query('SELECT count(*)::int AS n FROM flow.context_observations')).rows[0]!.n).toBe(1);
  facts.taskId = accepted.task.id; facts.attemptId = owned.attempt.id; facts.sampleCount = 1;
  facts.replayStable = true; facts.restartStable = true;
});
