import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, lstat, rm, statfs, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { Pool } from 'pg';
import { afterAll, beforeAll, expect, it } from 'vitest';
import type { GoalProgressionAuthorization } from '../../contracts/src/goal-progression.js';
import { createServer } from '../../../apps/server/src/index.js';
import { createClaudeAdapter, type ClaudeQuery } from '../../../apps/runner/src/claude.js';
import { describeExecutionProfile, guardExecutionProfile } from '../../../apps/runner/src/execution-profiles.js';
import { runRunner } from '../../../apps/runner/src/runtime.js';
import { FlowClient } from './index.js';
import { conversationCreationSchema } from '@flow/contracts';

const name = `flow_f01_progress_${randomUUID().replaceAll('-', '')}`, marker = randomUUID(), token = randomUUID();
const adminUrl = 'postgresql://flow:flow-local-only@127.0.0.1:55432/postgres';
const databaseUrl = adminUrl.replace(/postgres$/, name);
const admin = new Pool({ connectionString: adminUrl, max: 1, connectionTimeoutMillis: 2000, statement_timeout: 5000 });
const pool = new Pool({ connectionString: databaseUrl, max: 3, statement_timeout: 5000 });
const facts: Record<string, unknown> = { database: name, startedAt: new Date().toISOString(), providerCalls: 0 };
let created = false, app: Awaited<ReturnType<typeof createServer>> | undefined, client: FlowClient, base = '';
let directory = '', directoryIdentity: { dev: number; ino: number }, runtime: Promise<void> | undefined;
const stop = new AbortController();
async function start(automaticQueueScan = true) {
  app = await createServer({ databaseUrl, ownerToken: token, leaseMs: 30_000, automaticQueueScan });
  base = await app.listen({ host: '127.0.0.1', port: 0 }); client = new FlowClient({ baseUrl: base, token });
}
beforeAll(async () => {
  const space = await statfs(tmpdir()); facts.availableBeforeBytes = space.bavail * space.bsize;
  assert(space.bavail * space.bsize >= 1024 ** 3 + 32 * 1024 ** 2, 'Insufficient reserve; no DB created.');
  facts.before = (await admin.query('SELECT datname FROM pg_database WHERE datname=$1', [name])).rows; assert.deepEqual(facts.before, []);
  await admin.query(`CREATE DATABASE "${name}"`); created = true;
  await admin.query(`COMMENT ON DATABASE "${name}" IS '${marker}'`);
  directory = await mkdtemp(join(tmpdir(), 'flow-f01-progress-')); const st = await lstat(directory); directoryIdentity = { dev: st.dev, ino: st.ino };
  await start(false);
});
afterAll(async () => {
  try {
    stop.abort(); await runtime; await app?.close(); await pool.end();
    if (created) {
      expect((await admin.query("SELECT shobj_description(oid,'pg_database') AS marker FROM pg_database WHERE datname=$1", [name])).rows[0].marker).toBe(marker);
      facts.databaseBytes = Number((await admin.query('SELECT pg_database_size($1)::text AS bytes', [name])).rows[0].bytes);
      facts.connections = (await admin.query('SELECT pid FROM pg_stat_activity WHERE datname=$1', [name])).rows; assert.deepEqual(facts.connections, []);
      await admin.query(`DROP DATABASE "${name}"`);
    }
    facts.remaining = (await admin.query('SELECT datname FROM pg_database WHERE datname=$1', [name])).rows; assert.deepEqual(facts.remaining, []);
    if (directory) { const st = await lstat(directory); assert(st.isDirectory() && !st.isSymbolicLink() && st.dev === directoryIdentity.dev && st.ino === directoryIdentity.ino); await rm(directory, { recursive: true }); facts.directoryRemoved = true; }
  } finally { await admin.end(); facts.endedAt = new Date().toISOString(); await writeFile('docs/evidence/f01/goal-progression-production-facts.json', JSON.stringify(facts, null, 2) + '\n'); }
});
async function goal(pin: GoalProgressionAuthorization['nodes'][number]['executionProfile'], count = 2) {
  let snapshot = (await client.createProject({ title: 'Real factory progression', workspaceId: 'personal' }, randomUUID())).snapshot;
  const ids: string[] = [];
  for (let index = 0; index < count; index++) {
    const result = await client.changeProject(snapshot.project.id, { expectedRevision: snapshot.project.revision, reason: 'Explicit synthetic plan', change: { kind: 'add-node', title: `TITLE-NOT-INPUT ${index}`, taskId: null, parent: null } }, randomUUID());
    ids.push(result.changedNodeId!); snapshot = result.snapshot;
  }
  if (count > 1) snapshot = (await client.changeProject(snapshot.project.id, { expectedRevision: snapshot.project.revision, reason: 'Two-node dependency', change: { kind: 'set-dependencies', nodeId: ids[1]!, expectedNodeVersion: snapshot.graph.nodes[1]!.version, dependencies: [{ nodeId: ids[0]!, expectedVersion: snapshot.graph.nodes[0]!.version }] } }, randomUUID())).snapshot;
  const goal = (await client.createGoal({ projectId: snapshot.project.id, originalGoal: 'Fixed synthetic two-step text delivery', constraints: 'No model provider', acceptance: 'Separate owner decision' }, randomUUID())).goal;
  for (const [index, nodeId] of ids.entries()) await client.commandGoal(goal.id, { kind: 'define-input', nodeId, expectedInputVersion: 0, reason: 'Freeze exact input', input: { goal: `Actual input ${index}`, constraints: 'No engineering writes', acceptance: 'Owner review', verification: { kind: 'nonempty' } } }, randomUUID());
  const authorization: GoalProgressionAuthorization = { protocol: 'flow.goal-progression.v1', projectRevision: snapshot.project.revision,
    nodes: snapshot.graph.nodes.map(node => ({ nodeId: node.id, nodeVersion: node.version, inputVersion: 1, previousExecutionId: null, executionProfile: pin, externalDependencies: [] })),
    maxAdmissions: count, intermediatePolicy: 'verified-artifact-within-this-authorization', expiresAt: new Date(Date.now() + 60_000).toISOString(), reason: 'Bounded owner permission' };
  return { goalId: goal.id, projectId: snapshot.project.id, authorization };
}
let pin: GoalProgressionAuthorization['nodes'][number]['executionProfile'];
it('migrates 030 before default readiness, resumes queue and progression without a client loop, and preserves two native inputs', { timeout: 20_000 }, async () => {
  expect((await pool.query('SELECT version FROM flow.migrations WHERE version=30')).rows).toEqual([{ version: 30 }]);
  const runner = await client.registerRunner({ name: 'Production synthetic Claude', harnesses: ['claude'], capacity: 1 });
  const material = join(directory, 'source.txt'); await writeFile(material, 'Synthetic source', { mode: 0o600 });
  const prompts: string[] = []; let closed = 0;
  type Message = ReturnType<ClaudeQuery> extends AsyncIterable<infer T> ? T : never;
  const query: ClaudeQuery = ({ prompt }) => Object.assign((async function* () {
    prompts.push(String(prompt)); const session = randomUUID();
    yield { type: 'result', subtype: 'success', is_error: false, uuid: randomUUID(), session_id: session, result: `Synthetic output ${prompts.length}`, modelUsage: {}, permission_denials: [] } as unknown as Message;
  })(), { close() { closed++; } });
  const options = { materialFiles: [material], allowRead: true, requireReadApproval: false, model: 'synthetic', timeoutMs: 5000, maxTurns: 2, maxBudgetUsd: 0.1, query };
  const adapter = createClaudeAdapter(options), configuration = describeExecutionProfile(options, adapter);
  pin = (await new FlowClient({ baseUrl: base, token: runner.token }).publishExecutionProfile({ configuration })).profile.reference;
  const s = await goal(pin), key = randomUUID();
  const receipt = await client.authorizeGoalProgression(s.goalId, s.authorization, key);
  expect(receipt.progression.admissions).toBe(0);
  await expect(new FlowClient({ baseUrl: base, token: 'invalid' }).goalProgression(s.goalId, receipt.progression.id)).rejects.toMatchObject({ status: 401 });
  await expect(new FlowClient({ baseUrl: base, token: runner.token }).goalProgression(s.goalId, receipt.progression.id)).rejects.toMatchObject({ status: 403 });
  const conversation = await client.createConversation(conversationCreationSchema.parse({ title: 'Existing queue lifecycle' }), randomUUID());
  const queued = await client.enqueueConversationTurn(conversation.conversation.id, { expectedQueueRevision: 0, text: 'Existing waiting intent' }, randomUUID());
  await delay(1100);
  expect((await client.goalProgression(s.goalId, receipt.progression.id)).admissions).toBe(0);
  expect((await client.conversationQueueItem(conversation.conversation.id, queued.item.id)).item.state).toBe('waiting');
  await app!.close(); app = undefined; await start();
  expect((await client.conversationQueueItem(conversation.conversation.id, queued.item.id)).item.state).toBe('promoted');
  const queueTask = (await client.conversation(conversation.conversation.id)).lastTurn!.task.id;
  await client.cancel(queueTask, randomUUID()); // This test explicitly owns and cancels its unused synthetic queue task.
  expect((await client.goalProgression(s.goalId, receipt.progression.id)).admissions).toBe(1);
  expect((await client.authorizeGoalProgression(s.goalId, s.authorization, key)).replayed).toBe(true);
  runtime = runRunner({ baseUrl: base, token: runner.token, workingDirectory: directory, signal: stop.signal, pollIntervalMs: 20,
    adapters: [guardExecutionProfile(adapter, pin, configuration)] });
  await expect.poll(async () => (await client.goalProgression(s.goalId, receipt.progression.id)).state, { interval: 25, timeout: 10_000 }).toBe('finished');
  stop.abort(); await runtime; runtime = undefined;
  const finished = await client.goalProgression(s.goalId, receipt.progression.id);
  expect(finished.admissions).toBe(2); expect(finished.acceptance).toBe('separate-owner-decision'); expect(prompts).toHaveLength(2); expect(closed).toBe(2);
  expect(prompts[0]).toContain('Actual input 0'); expect(prompts[1]).toContain('Actual input 1'); expect(prompts[1]).toContain('Synthetic output 1'); expect(prompts.join()).not.toContain('TITLE-NOT-INPUT');
  expect((await client.readGoal(s.goalId)).nodes.map(node => ({ accepted: node.accepted, current: node.deliveryCurrent }))).toEqual([{ accepted: null, current: false }, { accepted: null, current: false }]);
  await app!.close(); app = undefined; await start();
  expect((await client.goalProgression(s.goalId, receipt.progression.id)).admissions).toBe(2);
  expect((await pool.query('SELECT count(*)::int AS n FROM flow.goal_progression_executions')).rows[0].n).toBe(2);
  facts.journey = { defaultReadyQueue: true, defaultReadyProgression: true, intervalSecondNode: true, actualInjectedQueries: prompts.length, providerCalls: 0, admissions: 2, accepted: false, recoveredKey: true };
});
it('keeps one in-flight work scan and drains it before closing the production pool', { timeout: 10_000 }, async () => {
  const s = await goal(pin, 1), receipt = await client.authorizeGoalProgression(s.goalId, s.authorization, randomUUID());
  const lock = await pool.connect(); let closing: Promise<void> | undefined;
  const blockedScans = async () => Number((await pool.query("SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%flow.projects%' ")).rows[0].n);
  try {
    await lock.query('BEGIN'); await lock.query('SELECT id FROM flow.projects WHERE id=$1 FOR UPDATE', [s.projectId]);
    await expect.poll(blockedScans, { timeout: 3000, interval: 20 }).toBe(1);
    await delay(1100); expect(await blockedScans()).toBe(1);
    let closed = false; closing = app!.close().then(() => { closed = true; }); await delay(40); expect(closed).toBe(false);
    await lock.query('COMMIT'); await closing; app = undefined;
    expect((await pool.query('SELECT count(*)::int AS n FROM flow.goal_progression_executions WHERE progression_id=$1', [receipt.progression.id])).rows[0].n).toBe(1);
    facts.lifecycle = { maxBlockedScans: 1, waitedForInFlightBeforePoolClose: true };
  } finally { await lock.query('ROLLBACK'); lock.release(); await closing; }
});
