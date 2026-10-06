import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { runnerEventSchema, type Ownership, type RunnerEvent, type RunnerEventData, type TaskSubmission } from '@flow/contracts';
import type { SteeringFinalizationInput } from '../../../packages/contracts/src/active-steering.js';
import { verifyText } from '../../runner/src/verifier.js';
import { finalizeSteering, steeringProposalStatus } from './active-steering/finalization.js';
import { sha256, transaction } from './database.js';
import { reportEvents } from './events.js';
import { createServer } from './index.js';
import { claim, registerRunner } from './runners.js';
import { loadTask } from './tasks.js';

const databaseName = `flow_s01p05_${randomUUID().replaceAll('-', '')}`;
let admin: Pool | undefined;
let pool: Pool;
let bootstrap: Awaited<ReturnType<typeof createServer>> | undefined;
let creationRequested = false;
let postgresVersionNumber: string | undefined;
let taskCount = 0;
async function boundedClose(close: Promise<unknown>) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try { await Promise.race([close, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Owned closure unconfirmed')), 4000); })]); }
  finally { clearTimeout(timer); }
}

beforeAll(async () => {
  const configured = process.env.FLOW_S01P05_ADMIN_URL;
  if (!configured) throw new Error('FLOW_S01P05_ADMIN_URL must identify the approved local PG16 endpoint.');
  const url = new URL(configured);
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || url.hostname !== '127.0.0.1' || url.port !== '55432') throw new Error('Dedicated PG16 loopback endpoint required.');
  url.pathname = '/postgres';
  admin = new Pool({ connectionString: url.href, max: 1, connectionTimeoutMillis: 1500, statement_timeout: 2000, query_timeout: 3000 });
  postgresVersionNumber = (await admin.query<{ server_version_num: string }>('SHOW server_version_num')).rows[0]!.server_version_num;
  expect(Math.floor(Number(postgresVersionNumber) / 10_000)).toBe(16);
  expect((await admin.query('SELECT 1 FROM pg_database WHERE datname=$1', [databaseName])).rowCount).toBe(0);
  creationRequested = true;
  await admin.query(`CREATE DATABASE ${databaseName}`);
  url.pathname = `/${databaseName}`;
  bootstrap = await createServer({ databaseUrl: url.href, ownerToken: 's01p05-synthetic-owner', automaticQueueScan: false, activeSteering: true });
  await boundedClose(bootstrap.close());
  bootstrap = undefined;
  pool = new Pool({ connectionString: url.href, max: 1, connectionTimeoutMillis: 1500, statement_timeout: 3000, query_timeout: 4000, idle_in_transaction_session_timeout: 5000 });
  // Private DB-only instrumentation: observe real row writes and fail precisely the final state write.
  await pool.query(`CREATE SCHEMA s01p05;
    CREATE TABLE s01p05.task_writes(task_id text, sequence integer, event_at timestamptz, state jsonb);
    CREATE TABLE s01p05.reject_write(task_id text PRIMARY KEY);
    CREATE FUNCTION s01p05.audit_task() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      INSERT INTO s01p05.task_writes SELECT NEW.id,a.last_sequence,a.last_event_at,to_jsonb(NEW) FROM flow.attempts a WHERE a.id=NEW.current_attempt_id;
      RETURN NEW; END $$;
    CREATE TRIGGER s01p05_audit AFTER UPDATE ON flow.tasks FOR EACH ROW EXECUTE FUNCTION s01p05.audit_task();
    CREATE FUNCTION s01p05.reject_task() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF EXISTS(SELECT 1 FROM s01p05.reject_write WHERE task_id=NEW.id) THEN RAISE EXCEPTION 'Synthetic final write rejection' USING ERRCODE='23514'; END IF;
      RETURN NEW; END $$;
    CREATE TRIGGER s01p05_reject BEFORE UPDATE OF usage ON flow.tasks FOR EACH ROW EXECUTE FUNCTION s01p05.reject_task();`);
}, 20_000);

afterAll(async () => {
  let databaseAbsent = !creationRequested;
  let connectionsClosed = false;
  let adminClosed = false;
  try {
    if (bootstrap) await boundedClose(bootstrap.close());
    bootstrap = undefined;
    if (pool) await boundedClose(pool.end());
    connectionsClosed = true;
    if (creationRequested && admin) {
      const exists = (await admin.query('SELECT 1 FROM pg_database WHERE datname=$1', [databaseName])).rowCount !== 0;
      if (exists) {
        const connections = (await admin.query<{ count: number }>('SELECT count(*)::int AS count FROM pg_stat_activity WHERE datname=$1', [databaseName])).rows[0]!.count;
        if (connections !== 0) throw new Error('Owned connections remain');
        await admin.query(`DROP DATABASE ${databaseName}`);
      }
      databaseAbsent = (await admin.query('SELECT 1 FROM pg_database WHERE datname=$1', [databaseName])).rowCount === 0;
      if (!databaseAbsent) throw new Error('Database absence unconfirmed');
    }
  } catch { throw new Error(`Fixture cleanup unknown; retained identity ${databaseName}`); }
  finally {
    try { if (admin) await boundedClose(admin.end()); adminClosed = true; }
    finally { console.info(JSON.stringify({ kind: 's01p05-cleanup', databaseName, postgresVersionNumber, taskCount, connectionsClosed, databaseAbsent, adminClosed })); }
  }
}, 20_000);

type Assigned = { runnerId: string; taskId: string; ownership: Ownership; session: string; sequence: number };
async function assign(harness: 'fixture' | 'claude' = 'fixture'): Promise<Assigned> {
  if (++taskCount > 16) throw new Error('Functional fixture task bound exceeded');
  const taskId = randomUUID();
  const submission: TaskSubmission = { title: 'Private event state check', prompt: 'Synthetic local evidence', harness,
    ...(harness === 'fixture' ? { fixture: { scenario: 'success' as const } } : {}) };
  await pool.query('INSERT INTO flow.tasks(id,submission,dispatch_ready) VALUES($1,$2,true)', [taskId, submission]);
  const { runnerId } = await registerRunner(pool, { name: 'Private event state runner', harnesses: [harness], capacity: 1 });
  const response = await claim(pool, runnerId, 60_000);
  expect(response.assignment?.task.id).toBe(taskId);
  const attempt = response.assignment!.attempt;
  await clearWrites(taskId);
  return { runnerId, taskId, ownership: { attemptId: attempt.id, ownerVersion: attempt.ownerVersion }, session: randomUUID(), sequence: 0 };
}
const clearWrites = (taskId: string) => pool.query('DELETE FROM s01p05.task_writes WHERE task_id=$1', [taskId]);
const writes = (taskId: string) => pool.query<{ sequence: number; event_at: Date; state: Record<string, unknown> }>('SELECT sequence,event_at,state FROM s01p05.task_writes WHERE task_id=$1', [taskId]);
const task = (a: Assigned) => transaction(pool, client => loadTask(client, a.taskId), true);
function events(a: Assigned, data: RunnerEventData[]): RunnerEvent[] {
  return data.map((event, index) => runnerEventSchema.parse({ ...event, id: randomUUID(), sequence: a.sequence + index + 1 }));
}
async function send(a: Assigned, data: RunnerEventData[]) {
  const batch = events(a, data);
  const ack = await reportEvents(pool, a.runnerId, { ...a.ownership, events: batch });
  expect(ack).toEqual({ accepted: batch.length, lastSequence: a.sequence + batch.length });
  a.sequence = ack.lastSequence;
  return batch;
}
const session = (a: Assigned): RunnerEventData => ({ type: 'session', nativeSessionId: a.session, adapterVersion: 'claude-sdk-0.3.290-v2' });
const usage = (a: Assigned, known = true): RunnerEventData => ({ type: 'usage', source: 'fixture', scope: 'session', scopeId: a.session, sampleId: randomUUID(), cumulative: false,
  accounting: 'authoritative', costKind: known ? 'sdk_estimate' : 'unknown', inputTokens: known ? 3 : null, outputTokens: known ? 5 : null, costUsd: known ? 0.125 : null });
const artifact = (id: string, content: string): RunnerEventData => ({ type: 'artifact', artifactId: id, title: 'Private artifact', content, version: sha256(content), mediaType: 'text/plain' });
async function expectSingleWrite(a: Assigned) {
  const rows = (await writes(a.taskId)).rows;
  expect(rows).toHaveLength(1);
  expect(rows[0]!.sequence).toBe(a.sequence);
  expect(rows[0]!.event_at).toBeInstanceOf(Date);
  expect(rows[0]!.state).toMatchObject({ id: a.taskId, cursor: (await task(a)).cursor });
  await clearWrites(a.taskId);
}
// A full private snapshot catches orphan side effects and timestamp changes, not merely public summaries.
async function persisted(a: Assigned) {
  const queries = [
    ['task', 'SELECT to_jsonb(t) AS row FROM flow.tasks t WHERE id=$1', a.taskId],
    ['attempt', 'SELECT to_jsonb(t) AS row FROM flow.attempts t WHERE id=$1', a.ownership.attemptId],
    ...['timeline', 'details', 'artifacts', 'usage_samples', 'decisions', 'assistant_messages'].map(table => [table, `SELECT to_jsonb(t) AS row FROM flow.${table} t WHERE task_id=$1 ORDER BY to_jsonb(t)::text`, a.taskId]),
    ...['runner_events', 'steering_attempts', 'steering_audit'].map(table => [table, `SELECT to_jsonb(t) AS row FROM flow.${table} t WHERE attempt_id=$1 ORDER BY to_jsonb(t)::text`, a.ownership.attemptId]),
    ['session', 'SELECT to_jsonb(t) AS row FROM flow.sessions t WHERE id=$1', a.session],
    ['commands', 'SELECT to_jsonb(t) AS row FROM flow.commands t WHERE operation LIKE $1 ORDER BY key', `%:${a.ownership.attemptId}`],
    ['writes', 'SELECT to_jsonb(t) AS row FROM s01p05.task_writes t WHERE task_id=$1 ORDER BY to_jsonb(t)::text', a.taskId],
  ];
  const result: Record<string, unknown> = {};
  for (const [name, sql, id] of queries) result[name!] = (await pool.query(sql!, [id])).rows;
  return result;
}

test('persists one task UPDATE per accepted batch with all materialized values and attempt first', async () => {
  const a = await assign(), id = randomUUID(), content = 'Verified fixture';
  await send(a, [session(a), { type: 'message', text: 'Started' }, usage(a), artifact(id, content), verifyText(id, content)]);
  expect(await task(a)).toMatchObject({ status: 'running', cursor: 5, pending_decision: null, verification_status: 'passed', latest_artifact_id: id,
    latest_artifact_version: sha256(content), usage: { inputTokens: 3, outputTokens: 5, costUsd: 0.125, costKind: 'sdk_estimate', incomplete: false } });
  await expectSingleWrite(a);
  const decisionId = randomUUID();
  await send(a, [{ type: 'decision', decisionId, prompt: 'Continue?' }]);
  expect(await task(a)).toMatchObject({ status: 'waiting', cursor: 5, pending_decision: { id: decisionId, prompt: 'Continue?' } });
  await expectSingleWrite(a);
  await send(a, [{ type: 'completed', outcome: 'succeeded' }]);
  expect(await task(a)).toMatchObject({ status: 'succeeded', pending_decision: null, verification_status: 'passed' });
  await expectSingleWrite(a);
  expect((await pool.query('SELECT completed_at FROM flow.attempts WHERE id=$1', [a.ownership.attemptId])).rows[0].completed_at).toBeInstanceOf(Date);
  expect((await pool.query('SELECT active_task_id FROM flow.sessions WHERE id=$1', [a.session])).rows[0].active_task_id).toBeNull();
});

test('preserves unknown usage and exact latest artifact verification across unrelated batches', async () => {
  const a = await assign(), id = randomUUID();
  await send(a, [session(a), usage(a, false), artifact(id, 'first'), verifyText(id, 'first')]);
  const unknown = { inputTokens: null, outputTokens: null, costUsd: null, costKind: 'unknown', incomplete: true };
  expect((await task(a)).usage).toEqual(unknown);
  await clearWrites(a.taskId);
  await send(a, [artifact(id, 'second'), verifyText(id, 'first'), { type: 'message', text: 'No new usage' }]);
  expect(await task(a)).toMatchObject({ usage: unknown, verification_status: 'pending', latest_artifact_version: sha256('second') });
  await expectSingleWrite(a);
  await send(a, [verifyText(id, 'second')]);
  expect(await task(a)).toMatchObject({ usage: unknown, verification_status: 'passed' });
});

test('pure replay after terminal and expired lease preserves timestamps and every persisted side effect', async () => {
  const a = await assign();
  const saved = await send(a, [{ type: 'message', text: 'Durable' }, { type: 'completed', outcome: 'succeeded' }]);
  await pool.query("UPDATE flow.attempts SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE id=$1", [a.ownership.attemptId]);
  await clearWrites(a.taskId);
  const before = await persisted(a);
  expect(await reportEvents(pool, a.runnerId, { ...a.ownership, events: saved })).toEqual({ accepted: 0, lastSequence: 2 });
  expect(await persisted(a)).toEqual(before);
  expect((await writes(a.taskId)).rowCount).toBe(0);
});

test('mixed replay writes only the accepted suffix and conflicting or gapped batches roll back', async () => {
  const a = await assign();
  const saved = await send(a, [{ type: 'message', text: 'First' }]);
  const fresh = events(a, [{ type: 'message', text: 'Second' }]);
  await clearWrites(a.taskId);
  expect(await reportEvents(pool, a.runnerId, { ...a.ownership, events: [...saved, ...fresh] })).toEqual({ accepted: 1, lastSequence: 2 });
  a.sequence = 2;
  await expectSingleWrite(a);
  const before = await persisted(a);
  await expect(reportEvents(pool, a.runnerId, { ...a.ownership, events: [{ ...saved[0]!, type: 'message', text: 'Changed' }] })).rejects.toMatchObject({ status: 409, code: 'event_conflict' });
  await expect(reportEvents(pool, a.runnerId, { ...a.ownership, events: [{ ...fresh[0]!, id: randomUUID(), sequence: 4 }] })).rejects.toMatchObject({ status: 409, code: 'event_gap' });
  const unordered = events(a, [{ type: 'message', text: 'Will roll back' }, { type: 'message', text: 'Wrong order' }]);
  unordered[1]!.sequence = 5;
  await expect(reportEvents(pool, a.runnerId, { ...a.ownership, events: unordered })).rejects.toMatchObject({ code: 'event_order' });
  expect(await persisted(a)).toEqual(before);
});

test('reportEvents rolls back all side effects on final task write rejection and late verification error', async () => {
  const a = await assign(), id = randomUUID(), text = 'Rollback text';
  const batch = events(a, [session(a), usage(a), artifact(id, text), verifyText(id, text)]);
  const before = await persisted(a);
  await pool.query('INSERT INTO s01p05.reject_write VALUES($1)', [a.taskId]);
  try { await expect(reportEvents(pool, a.runnerId, { ...a.ownership, events: batch })).rejects.toMatchObject({ code: '23514' }); }
  finally { await pool.query('DELETE FROM s01p05.reject_write WHERE task_id=$1', [a.taskId]); }
  expect(await persisted(a)).toEqual(before);
  const invalid = structuredClone(batch);
  const verification = invalid[3]!;
  if (verification.type !== 'verification') throw new Error('Expected verification fixture');
  verification.inputDigest = '0'.repeat(64);
  await expect(reportEvents(pool, a.runnerId, { ...a.ownership, events: invalid })).rejects.toMatchObject({ status: 409 });
  expect(await persisted(a)).toEqual(before);
  expect(await reportEvents(pool, a.runnerId, { ...a.ownership, events: batch })).toEqual({ accepted: 4, lastSequence: 4 });
});

async function finalProposal(): Promise<{ a: Assigned; input: SteeringFinalizationInput }> {
  const a = await assign('claude'), resultId = randomUUID(), text = 'Synthetic final result', artifactId = randomUUID();
  await send(a, [session(a), { type: 'steering-result', result: { nativeSessionId: a.session, sourceMessageId: resultId,
    consumedUserMessageUuids: [], queuedTurnCount: 0, outcome: 'success', contentDigest: sha256(text) } }]);
  const final: RunnerEventData = { type: 'assistant-final', messageId: sha256(JSON.stringify([a.session, resultId])), nativeSessionId: a.session,
    source: 'claude.sdk.result', sourceMessageId: resultId, content: text,
    settings: { requested: { model: 'synthetic', thinking: 'disabled', permissionMode: 'dontAsk' }, effective: { model: 'synthetic', thinking: 'unknown', permissionMode: 'dontAsk', tools: [] } } };
  await clearWrites(a.taskId);
  return { a, input: { ...a.ownership, proposalId: randomUUID(), expectedRevision: 0, afterSequence: a.sequence, nativeSessionId: a.session, resultId,
    events: events(a, [artifact(artifactId, text), verifyText(artifactId, text), final]) } };
}

test('finalizeSteering commits seal final artifact and receipt once and replays unchanged after completion', async () => {
  const { a, input } = await finalProposal();
  const committed = await finalizeSteering(pool, a.runnerId, input);
  expect(committed).toEqual({ state: 'committed', proposalId: input.proposalId, lastSequence: 5, replayed: false });
  a.sequence = 5;
  await expectSingleWrite(a);
  expect(await task(a)).toMatchObject({ status: 'running', verification_status: 'passed' });
  expect((await pool.query('SELECT seal FROM flow.steering_attempts WHERE attempt_id=$1', [a.ownership.attemptId])).rows[0].seal).not.toBeNull();
  expect((await pool.query('SELECT 1 FROM flow.assistant_messages WHERE attempt_id=$1', [a.ownership.attemptId])).rowCount).toBe(1);
  await send(a, [{ type: 'completed', outcome: 'succeeded' }]);
  await clearWrites(a.taskId);
  const before = await persisted(a);
  expect(await finalizeSteering(pool, a.runnerId, input)).toEqual({ ...committed, replayed: true });
  expect(await persisted(a)).toEqual(before);
  await expect(finalizeSteering(pool, a.runnerId, { ...input, expectedRevision: 1 })).rejects.toMatchObject({ code: 'idempotency_conflict' });
  await expect(finalizeSteering(pool, a.runnerId, { ...input, ownerVersion: 999 })).rejects.toMatchObject({ code: 'stale_owner' });
});

test('finalizeSteering rolls back seal artifact final and receipt on verifier or task write failure', async () => {
  const { a, input } = await finalProposal();
  const before = await persisted(a);
  const invalid = structuredClone(input);
  const verification = invalid.events[1]!;
  if (verification.type !== 'verification') throw new Error('Expected verification fixture');
  verification.result = 'failed';
  await expect(finalizeSteering(pool, a.runnerId, invalid)).rejects.toMatchObject({ status: 409 });
  expect(await persisted(a)).toEqual(before);
  await pool.query('INSERT INTO s01p05.reject_write VALUES($1)', [a.taskId]);
  try { await expect(finalizeSteering(pool, a.runnerId, input)).rejects.toMatchObject({ code: '23514' }); }
  finally { await pool.query('DELETE FROM s01p05.reject_write WHERE task_id=$1', [a.taskId]); }
  expect(await persisted(a)).toEqual(before);
  expect(await steeringProposalStatus(pool, a.runnerId, input)).toEqual({ state: 'absent', proposalId: input.proposalId });
  expect(await finalizeSteering(pool, a.runnerId, input)).toMatchObject({ state: 'committed' });
});

test('rejects stale owner current-attempt mismatch expired and uncertain new events without writes', async () => {
  const a = await assign();
  const batch = events(a, [{ type: 'message', text: 'Must not persist' }]);
  const before = await persisted(a);
  await expect(reportEvents(pool, a.runnerId, { ...a.ownership, ownerVersion: 999, events: batch })).rejects.toMatchObject({ code: 'stale_owner' });
  expect(await persisted(a)).toEqual(before);
  await pool.query('UPDATE flow.tasks SET current_attempt_id=NULL WHERE id=$1', [a.taskId]);
  const changed = await persisted(a);
  await expect(reportEvents(pool, a.runnerId, { ...a.ownership, events: batch })).rejects.toMatchObject({ code: 'stale_owner' });
  expect(await persisted(a)).toEqual(changed);
  await pool.query("UPDATE flow.tasks SET current_attempt_id=$2,status='uncertain' WHERE id=$1", [a.taskId, a.ownership.attemptId]);
  const uncertain = await persisted(a);
  await expect(reportEvents(pool, a.runnerId, { ...a.ownership, events: batch })).rejects.toMatchObject({ code: 'stale_owner' });
  expect(await persisted(a)).toEqual(uncertain);
  await pool.query("UPDATE flow.tasks SET status='running' WHERE id=$1", [a.taskId]);
  await pool.query("UPDATE flow.attempts SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE id=$1", [a.ownership.attemptId]);
  const expired = await persisted(a);
  await expect(reportEvents(pool, a.runnerId, { ...a.ownership, events: batch })).rejects.toMatchObject({ code: 'stale_owner' });
  expect(await persisted(a)).toEqual(expired);
});

async function bindInput(a: Assigned, kind: 'conversation' | 'goal') {
  const projectId = randomUUID(), parentId = randomUUID(), contextId = randomUUID(), inputId = randomUUID();
  await transaction(pool, async client => {
    await client.query("INSERT INTO flow.projects(id,workspace_id,title,revision) VALUES($1,'personal','Private context',1)", [projectId]);
    await client.query("INSERT INTO flow.project_revisions(project_id,revision,reason,actor,nodes) VALUES($1,1,'fixture','owner','[]')", [projectId]);
    if (kind === 'conversation') {
      await client.query("INSERT INTO flow.conversations(id,title,harness,requested,project_id) VALUES($1,'Private','claude','{}',$2)", [parentId, projectId]);
      await client.query("INSERT INTO flow.conversation_contexts(id,conversation_id,project_id,context_digest,sources,raw_bytes) VALUES($1,$2,$3,$4,'[{}]',0)", [contextId, parentId, projectId, sha256('context')]);
      await client.query("INSERT INTO flow.conversation_execution_inputs(id,context_id,user_text,template_version,execution_prompt,execution_input_digest) VALUES($1,$2,'input',1,'input',$3)", [inputId, contextId, sha256('input')]);
      await client.query('UPDATE flow.tasks SET conversation_input_id=$2 WHERE id=$1', [a.taskId, inputId]);
    } else {
      await client.query("INSERT INTO flow.goals(id,project_id,original) VALUES($1,$2,'{}')", [parentId, projectId]);
      await client.query("INSERT INTO flow.goal_inputs(goal_id,node_id,version,input,project_revision) VALUES($1,'node',1,'{}',1)", [parentId]);
      await client.query("INSERT INTO flow.goal_contexts(id,goal_id,node_id,input_version,project_id,context_digest,sources,raw_bytes) VALUES($1,$2,'node',1,$3,$4,'[{}]',0)", [contextId, parentId, projectId, sha256('context')]);
      await client.query("INSERT INTO flow.goal_execution_inputs(id,context_id,public_prompt,template_version,execution_prompt,execution_input_digest) VALUES($1,$2,'input',1,'input',$3)", [inputId, contextId, sha256('input')]);
      await client.query('UPDATE flow.tasks SET goal_input_id=$2 WHERE id=$1', [a.taskId, inputId]);
    }
  });
  return inputId;
}

test('preserves nonnull conversation and goal bindings and enabled UPDATE OF immutable guards', async () => {
  const guards = (await pool.query<{ tgname: string; tgenabled: string; definition: string }>("SELECT tgname,tgenabled,pg_get_triggerdef(oid) AS definition FROM pg_trigger WHERE tgrelid='flow.tasks'::regclass AND tgname IN ('task_conversation_input_immutable','task_goal_input_immutable') ORDER BY tgname")).rows;
  expect(guards).toHaveLength(2);
  for (const guard of guards) { expect(guard.tgenabled).toBe('O'); expect(guard.definition).toMatch(/BEFORE UPDATE OF (conversation|goal)_input_id ON flow.tasks/); }
  for (const kind of ['conversation', 'goal'] as const) {
    const a = await assign(), inputId = await bindInput(a, kind), before = await task(a);
    await clearWrites(a.taskId);
    await send(a, [{ type: 'message', text: 'Update only event state' }]);
    await expectSingleWrite(a);
    const binding = await pool.query<{ binding: string }>(`SELECT ${kind}_input_id AS binding FROM flow.tasks WHERE id=$1`, [a.taskId]);
    expect(binding.rows[0]!.binding).toBe(inputId);
    expect((await task(a)).submission).toEqual(before.submission);
    await expect(pool.query(`UPDATE flow.tasks SET ${kind}_input_id=NULL WHERE id=$1`, [a.taskId])).rejects.toMatchObject({ code: '23514' });
    expect((await pool.query(`SELECT ${kind}_input_id AS binding FROM flow.tasks WHERE id=$1`, [a.taskId])).rows[0].binding).toBe(inputId);
  }
});
