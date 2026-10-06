import { randomUUID } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CLAUDE_CONTEXT_SOURCE, type ContextObservationEvent } from '../../../../packages/contracts/src/context-observation-event.js';
import type { TaskRecord } from '../tasks.js';
import type { AttemptRecord } from '../runners.js';
import { readLatestHistory, record } from './store.js';
import { nativeExecutionProfileConfigurationJson, type ExecutionProfileConfiguration } from '../../../../packages/contracts/src/execution-profiles.js';
import { canonical, migrate, sha256, transaction } from '../database.js';
import { CONTEXT_DETAIL_TITLE } from '../../../../packages/contracts/src/context-observation-history.js';
import { migrateContextObservationHistory } from './migration.js';
import { ownedAttempt, registerRunner } from '../runners.js';
import { loadTask } from '../tasks.js';
import { recordSession } from '../sessions.js';
import { saveDetail } from '../evidence.js';
import { migrateProjects } from '../projects/index.js';
import { migrateGoals } from '../goals/index.js';
import { migrateConversations } from '../conversations/index.js';
import { migrateExecutionProfiles } from '../execution-profiles/index.js';
import { publishProfile } from '../execution-profiles/store.js';
import { migrateConversationQueue } from '../conversation-queue/index.js';
import { migrateKnowledge } from '../knowledge/index.js';
import { migrateConversationContext } from '../conversation-context/index.js';
import { migrateGoalContext } from '../goal-context/index.js';
import { createProject } from '../projects/commands.js';
import { createSource } from '../knowledge/storage.js';
import { bindExecutionInput, freezeContext } from '../conversation-context/store.js';
import type { KnowledgeCitation } from '../../../../packages/contracts/src/knowledge.js';

function event(): ContextObservationEvent {
  return { id: 'event-1', sequence: 1, type: 'context-observation', observation: { source: CLAUDE_CONTEXT_SOURCE,
    observationId: 'observation-1', observedAt: '2026-10-06T10:00:00.000Z', nativeSessionId: 'session-1', resolvedModel: null, used: null, compactionWindow: null, categories: [] } };
}
it('rejects invalid wire metadata before any database or detail work', async () => {
  let queries = 0; const client = { async query() { queries++; throw new Error('No database access expected'); } } as unknown as PoolClient;
  await expect(record(client, {} as TaskRecord, {} as AttemptRecord, { ...event(), observation: { ...event().observation, text: 'private' } } as never)).rejects.toMatchObject({ status: 400 });
  expect(queries).toBe(0);
});
it('rejects a task/attempt ownership mismatch before looking up source authorization', async () => {
  let queries = 0; const client = { async query() { queries++; throw new Error('No database access expected'); } } as unknown as PoolClient;
  await expect(record(client, { id: 'task', current_attempt_id: 'attempt-A' } as TaskRecord, { id: 'attempt-B' } as AttemptRecord, event())).rejects.toMatchObject({ status: 409 });
  expect(queries).toBe(0);
});
it('does not invent zero context when the center has no attempt', async () => {
  const client = { async query() { throw new Error('No sample query expected'); } } as unknown as PoolClient;
  const result = await readLatestHistory(client, { id: 'task', current_attempt_id: null } as TaskRecord);
  expect(result.latest).toBeNull(); expect(result.current.value).toBeNull(); expect(result.remaining.value).toBeNull();
});
it('selects only the center task attempt and keeps a missing sample unknown', async () => {
  const selected: unknown[][] = [];
  const client = { async query(_sql: string, values: unknown[]) { selected.push(values); return { rows: [] }; } } as unknown as PoolClient;
  const result = await readLatestHistory(client, { id: 'task', current_attempt_id: 'center-attempt' } as TaskRecord);
  expect(selected).toEqual([['task', 'center-attempt']]); expect(result.attemptId).toBe('center-attempt'); expect(result.latest).toBeNull(); expect(result.remaining.kind).toBe('unknown');
});

// A deterministic transaction consumer, not PostgreSQL evidence. Real constraints/rollback require the allocated migration.
function transactionFixture() {
  const runnerId = '00000000-0000-4000-8000-000000000002';
  const configuration: ExecutionProfileConfiguration = { harness: 'claude', adapterVersion: 'claude-sdk-0.3.290-v2', model: 'sonnet', thinking: 'disabled', permissionMode: 'dontAsk', access: 'none', requireReadApproval: false, materialScopeDigest: '0'.repeat(64), limits: { maxTurns: 1, maxBudgetUsd: 0.1, timeoutMs: 1000 } };
  const profile = { id: '00000000-0000-4000-8000-000000000001', runner_id: runnerId, config_digest: sha256(nativeExecutionProfileConfigurationJson(configuration)), configuration, revoked: false, created_at: new Date('2026-10-06T09:00:00Z') };
  const task = { id: 'task', current_attempt_id: 'attempt', owner_version: 1, submission: { harness: 'claude', prompt: 'private prompt never returned', title: 'test', executionProfile: { id: profile.id, runnerId, configDigest: profile.config_digest } } } as TaskRecord;
  const attempt = { id: 'attempt', task_id: task.id, runner_id: runnerId, owner_version: 1, native_session_id: 'session-1' } as AttemptRecord;
  let saved: Record<string, unknown> | undefined; let detailWrites = 0;
  let detail: unknown[] = [];
  const client = { async query(sql: string, values: unknown[] = []) {
    if (sql.includes('FROM flow.attempts a JOIN flow.sessions')) return { rows: [{ attempt_id: attempt.id, runner_id: runnerId, native_session_id: attempt.native_session_id, active_task_id: task.id }] };
    if (sql.includes("kind='session'")) return { rows: [{ id: 'session-detail', content: JSON.stringify({ id: 'session-event', sequence: 1, type: 'session', nativeSessionId: 'session-1', adapterVersion: configuration.adapterVersion }) }] };
    if (sql.includes('FROM flow.execution_profiles')) return { rows: [profile] };
    if (sql.includes('FROM flow.context_observations')) return { rows: saved ? [saved] : [] };
    if (sql.startsWith('SELECT conversation_input_id')) return { rows: [{ conversation_input_id: null, goal_input_id: null }] };
    if (sql.startsWith('INSERT INTO flow.details')) { detailWrites++; detail = values; return { rows: [] }; }
    if (sql.startsWith('INSERT INTO flow.context_observations')) {
      saved = { task_id: values[0], attempt_id: values[1], observation_id: values[2], event_sequence: values[3], wire_canonical: values[4], wire_digest: values[5], sample: JSON.parse(values[6] as string), detail_id: values[7], observed_at: new Date(values[8] as string), received_at: new Date('2026-10-06T10:00:01.000Z'), detail_task_id: detail[1], detail_attempt_id: detail[2], detail_title: detail[3], detail_kind: detail[4], detail_content: detail[5], detail_media_type: detail[6], attempt_owner_version: attempt.owner_version, attempt_runner_id: runnerId, attempt_native_session_id: attempt.native_session_id };
      return { rows: [{ received_at: saved.received_at }] };
    }
    throw new Error('Unexpected transaction operation.');
  } } as unknown as PoolClient;
  return { client, task, attempt, profile, get saved() { return saved; }, get detailWrites() { return detailWrites; } };
}
it('binds the requested alias separately from a host resolved model and creates a real detail reference', async () => {
  const fixture = transactionFixture(); const input = event();
  input.observation.resolvedModel = 'claude-sonnet-resolved'; input.observation.used = 120; input.observation.compactionWindow = 100;
  const sample = await record(fixture.client, fixture.task, fixture.attempt, input);
  const history = await readLatestHistory(fixture.client, fixture.task);
  expect(history.latest).toEqual(sample);
  expect(sample.observation.identity).toMatchObject({ requestedModel: 'sonnet', resolvedModel: 'claude-sonnet-resolved', executionInputDigest: null, materialRevisionDigest: null, historyEpoch: null });
  expect(sample.detailRef).toMatchObject({ title: CONTEXT_DETAIL_TITLE }); expect(sample.detailRef.id).toMatch(/^[0-9a-f-]{36}$/);
  expect(sample.observation.used).toMatchObject({ kind: 'estimate', value: 120, evidenceRef: sample.detailRef });
  expect(sample.observation.modelCapacity.kind).toBe('unknown'); expect(sample.materials.state).toBe('unknown');
  expect(history.current.kind).toBe('unknown'); expect(history.remaining.value).toBeNull(); expect(JSON.stringify(history)).not.toContain('private prompt');
});
it('replays full canonical metadata without refreshing time, sequence or reference, and conflicts on changed metadata', async () => {
  const fixture = transactionFixture(); const first = await record(fixture.client, fixture.task, fixture.attempt, event());
  const repeated = await record(fixture.client, fixture.task, fixture.attempt, { ...event(), id: 'different-envelope', sequence: 7 });
  expect(repeated).toEqual(first); expect(fixture.detailWrites).toBe(1);
  const changed = event(); changed.observation.observedAt = '2026-10-06T10:00:00.001Z';
  await expect(record(fixture.client, fixture.task, fixture.attempt, changed)).rejects.toMatchObject({ status: 409, code: 'context_observation_conflict' });
  expect(fixture.detailWrites).toBe(1);
});
it.each(['detail-owner', 'wire-body', 'measurement', 'attempt-owner'])('rejects a stored %s mismatch on readback', async mode => {
  const fixture = transactionFixture(); const input = event(); input.observation.resolvedModel = 'resolved-model'; input.observation.used = 10;
  await record(fixture.client, fixture.task, fixture.attempt, input);
  const row = fixture.saved!;
  if (mode === 'detail-owner') row.detail_task_id = 'foreign';
  if (mode === 'wire-body') row.detail_content = '{}';
  if (mode === 'measurement') (row.sample as { observation: { used: { value: number } } }).observation.used.value = 11;
  if (mode === 'attempt-owner') row.attempt_owner_version = 2;
  await expect(readLatestHistory(fixture.client, fixture.task)).rejects.toMatchObject({ status: 409 });
});
it('denies revoked source authorization before creating evidence', async () => {
  const revoked = transactionFixture(); revoked.profile.revoked = true;
  await expect(record(revoked.client, revoked.task, revoked.attempt, event())).rejects.toMatchObject({ status: 409 }); expect(revoked.detailWrites).toBe(0);
});

// Opt in explicitly: one random database, no server, runner, model or production auth.
// Every table comes from its real migration; 027 does not depend on attachment 026.
describe.skipIf(process.env.FLOW_WPF04_PG !== '1')('PostgreSQL history', () => {
  const database = `flow_wpf04_${randomUUID().replaceAll('-', '')}`;
  const admin = new Pool({ connectionString: 'postgresql://flow:flow-local-only@127.0.0.1:55432/postgres', max: 1, connectionTimeoutMillis: 2000, statement_timeout: 5000, query_timeout: 7000 });
  const connectionString = `postgresql://flow:flow-local-only@127.0.0.1:55432/${database}`;
  const openPool = () => new Pool({ connectionString, max: 2, connectionTimeoutMillis: 2000, statement_timeout: 5000, query_timeout: 7000 });
  let pool = openPool();
  let creationRequested = false;
  let legacy: { taskId: string; evidence: unknown[] };
  const facts: Record<string, unknown> = { database, startedAt: new Date().toISOString(), created: false, dropped: false };
  beforeAll(async () => {
    expect((await admin.query('SELECT datname FROM pg_database WHERE datname=$1', [database])).rows).toEqual([]);
    creationRequested = true;
    await admin.query(`CREATE DATABASE "${database}"`); facts.created = true;
    await migrate(pool);
    // Real prerequisite migrations for source profiles and frozen metadata only.
    for (const apply of [migrateProjects, migrateGoals, migrateConversations, migrateExecutionProfiles, migrateConversationQueue,
      migrateKnowledge, migrateConversationContext, migrateGoalContext]) await apply(pool);
    facts.prerequisites = (await pool.query('SELECT version FROM flow.migrations ORDER BY version')).rows;
    expect((await pool.query('SELECT 1 FROM flow.migrations WHERE version=26')).rowCount).toBe(0);
    expect((await pool.query("SELECT to_regclass('flow.context_observations') AS relation")).rows[0]!.relation).toBeNull();
    const existing = await fixture(); legacy = { taskId: existing.taskId, evidence: await details(existing) };
    await migrateContextObservationHistory(pool);
  });
  afterAll(async () => {
    try {
      await pool.end();
      if (creationRequested) {
        // Check the exact originally absent random name even when CREATE acknowledgement was lost.
        const exists = (await admin.query('SELECT datname FROM pg_database WHERE datname=$1', [database])).rowCount;
        facts.connectionsBeforeDrop = (await admin.query('SELECT count(*)::int AS count FROM pg_stat_activity WHERE datname=$1', [database])).rows[0]!.count;
        expect(facts.connectionsBeforeDrop).toBe(0);
        if (exists) { await admin.query(`DROP DATABASE "${database}"`); facts.dropped = true; }
        facts.remaining = (await admin.query('SELECT datname FROM pg_database WHERE datname=$1', [database])).rows;
        expect(facts.remaining).toEqual([]);
      }
    } finally {
      try { await admin.end(); }
      finally { facts.endedAt = new Date().toISOString(); console.log('WPF04_DATABASE_FACTS', JSON.stringify(facts)); }
    }
  });
  async function fixture() {
    const runner = await registerRunner(pool, { name: 'Context history test', harnesses: ['claude'], capacity: 1 });
    const configuration: ExecutionProfileConfiguration = { harness: 'claude', adapterVersion: 'claude-sdk-0.3.290-v2', model: 'sonnet', thinking: 'disabled', permissionMode: 'dontAsk', access: 'none', requireReadApproval: false, materialScopeDigest: '0'.repeat(64), limits: { maxTurns: 1, maxBudgetUsd: 0.1, timeoutMs: 1000 } };
    const published = await publishProfile(pool, runner.runnerId, configuration);
    const taskId = randomUUID(), attemptId = randomUUID(), nativeSessionId = randomUUID();
    await transaction(pool, async client => {
      await client.query("INSERT INTO flow.tasks(id,submission,status,current_attempt_id,owner_version) VALUES($1,$2,'running',$3,1)", [taskId, { title: 'History', prompt: 'Private prompt 中文 never in metadata', harness: 'claude', executionProfile: published.profile.reference }, attemptId]);
      await client.query("INSERT INTO flow.attempts(id,task_id,runner_id,owner_version,lease_expires_at) VALUES($1,$2,$3,1,clock_timestamp()+interval '5 minutes')", [attemptId, taskId, runner.runnerId]);
      const { task, attempt } = await ownedAttempt(client, runner.runnerId, { attemptId, ownerVersion: 1 });
      const session = { id: randomUUID(), sequence: 1, type: 'session' as const, nativeSessionId, adapterVersion: configuration.adapterVersion };
      await recordSession(client, task, attempt, session);
      await saveDetail(client, taskId, attemptId, { title: 'Native session', kind: 'session', content: JSON.stringify(session), mediaType: 'application/json' });
    });
    const input = event(); input.id = randomUUID(); input.sequence = 2; input.observation.observationId = randomUUID(); input.observation.nativeSessionId = nativeSessionId;
    input.observation.resolvedModel = 'claude-sonnet-resolved'; input.observation.used = 120; input.observation.compactionWindow = 100;
    input.observation.categories = [{ kind: 'used', tokens: 120 }];
    return { runnerId: runner.runnerId, taskId, attemptId, input };
  }
  type Fixture = Awaited<ReturnType<typeof fixture>>;
  const save = (f: Fixture, input = f.input) => transaction(pool, async client => {
    const owned = await ownedAttempt(client, f.runnerId, { attemptId: f.attemptId, ownerVersion: 1 });
    return record(client, owned.task, owned.attempt, input);
  });
  const read = (f: Fixture) => transaction(pool, async client => readLatestHistory(client, await loadTask(client, f.taskId)), true);
  const details = async (f: Fixture) => (await pool.query('SELECT id,content FROM flow.details WHERE task_id=$1 ORDER BY id', [f.taskId])).rows;

  it('installs only official 027 once and preserves pre-existing evidence', async () => {
    expect((await pool.query('SELECT id,content FROM flow.details WHERE task_id=$1 ORDER BY id', [legacy.taskId])).rows).toEqual(legacy.evidence);
    await migrateContextObservationHistory(pool);
    expect((await pool.query('SELECT id,content FROM flow.details WHERE task_id=$1 ORDER BY id', [legacy.taskId])).rows).toEqual(legacy.evidence);
    expect((await pool.query('SELECT version FROM flow.migrations WHERE version IN (26,27)')).rows).toEqual([{ version: 27 }]);
  });
  it('persists alias/resolved estimates and real references, with DB time and unknown current', async () => {
    const f = await fixture();
    const before = (await pool.query('SELECT clock_timestamp() AS at')).rows[0]!.at as Date;
    const sample = await save(f); const result = await read(f);
    const after = (await pool.query('SELECT clock_timestamp() AS at')).rows[0]!.at as Date;
    expect(result.latest).toEqual(sample); expect(Date.parse(sample.receivedAt)).toBeGreaterThanOrEqual(before.getTime()); expect(Date.parse(sample.receivedAt)).toBeLessThanOrEqual(after.getTime());
    expect(sample.observation.identity).toMatchObject({ requestedModel: 'sonnet', resolvedModel: 'claude-sonnet-resolved', executionInputDigest: null, materialRevisionDigest: null, historyEpoch: null });
    expect(sample.observation.used).toMatchObject({ kind: 'estimate', value: 120, evidenceRef: sample.detailRef });
    expect(sample.observation.compactionWindow.value).toBe(100); expect(sample.observation.modelCapacity.kind).toBe('unknown'); expect(sample.materials.state).toBe('unknown');
    expect(result.current.value).toBeNull(); expect(result.remaining.value).toBeNull(); expect(JSON.stringify(result)).not.toContain('Private prompt');
    const actual = (await pool.query('SELECT task_id,attempt_id,content FROM flow.details WHERE id=$1', [sample.detailRef.id])).rows[0]!;
    expect(actual).toEqual({ task_id: f.taskId, attempt_id: f.attemptId, content: canonical(f.input.observation) });
  });
  it('replays canonical metadata without changing first sequence, exact DB time or reference', async () => {
    const f = await fixture(); const first = await save(f);
    const persisted = async () => (await pool.query('SELECT event_sequence,received_at::text,detail_id,wire_canonical,wire_digest FROM flow.context_observations WHERE attempt_id=$1', [f.attemptId])).rows;
    const before = await persisted(); const evidence = await details(f);
    expect(await save(f, { ...f.input, id: randomUUID(), sequence: 9 })).toEqual(first);
    expect(await persisted()).toEqual(before); expect(await details(f)).toEqual(evidence);
    const changed = structuredClone(f.input); changed.observation.observedAt = '2026-10-06T10:00:00.001Z';
    await expect(save(f, changed)).rejects.toMatchObject({ status: 409, code: 'context_observation_conflict' });
    expect(await persisted()).toEqual(before); expect(await details(f)).toEqual(evidence);
  });
  it('rolls back a newly created detail when the event sequence constraint rejects the sample', async () => {
    const f = await fixture(); await save(f); const before = await details(f);
    const changed = structuredClone(f.input); changed.observation.observationId = randomUUID();
    await expect(save(f, changed)).rejects.toMatchObject({ code: '23505' });
    expect(await details(f)).toEqual(before);
    expect((await pool.query('SELECT count(*)::int AS count FROM flow.context_observations WHERE attempt_id=$1', [f.attemptId])).rows[0]!.count).toBe(1);
  });
  it('rolls back sample and detail when the enclosing event transaction aborts', async () => {
    const f = await fixture(); const before = await details(f);
    await expect(transaction(pool, async client => {
      const owned = await ownedAttempt(client, f.runnerId, { attemptId: f.attemptId, ownerVersion: 1 });
      await record(client, owned.task, owned.attempt, f.input); throw new Error('Injected enclosing event rollback');
    })).rejects.toThrow('Injected enclosing event rollback');
    expect(await details(f)).toEqual(before); expect((await read(f)).latest).toBeNull();
  });
  it('enforces task/attempt/detail ownership and bounded immutable history in PostgreSQL', async () => {
    const f = await fixture(), foreign = await fixture(); const sample = await save(f);
    const values = (await pool.query('SELECT * FROM flow.context_observations WHERE attempt_id=$1', [f.attemptId])).rows[0]!;
    const foreignDetail = (await details(foreign))[0]!.id;
    const insert = (overrides: Record<string, unknown>) => {
      const row = { ...values, observation_id: randomUUID(), event_sequence: 3, ...overrides };
      return pool.query(`INSERT INTO flow.context_observations(task_id,attempt_id,observation_id,event_sequence,wire_canonical,wire_digest,sample,detail_id,observed_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [row.task_id,row.attempt_id,row.observation_id,row.event_sequence,row.wire_canonical,row.wire_digest,row.sample,row.detail_id,row.observed_at]);
    };
    await expect(insert({ task_id: foreign.taskId, detail_id: foreignDetail })).rejects.toMatchObject({ code: '23503' });
    await expect(insert({ detail_id: foreignDetail })).rejects.toMatchObject({ code: '23503' });
    await expect(insert({ event_sequence: 0, detail_id: foreignDetail })).rejects.toMatchObject({ code: '23514' });
    await expect(insert({ wire_canonical: 'x'.repeat(65537), detail_id: foreignDetail })).rejects.toMatchObject({ code: '23514' });
    await expect(pool.query('UPDATE flow.context_observations SET event_sequence=9 WHERE detail_id=$1', [sample.detailRef.id])).rejects.toMatchObject({ code: '23514' });
    await expect(pool.query('DELETE FROM flow.context_observations WHERE detail_id=$1', [sample.detailRef.id])).rejects.toMatchObject({ code: '23514' });
  });
  it('rejects mismatched task and unauthorized session before adding a detail', async () => {
    const f = await fixture(); const before = await details(f);
    await expect(transaction(pool, async client => {
      const owned = await ownedAttempt(client, f.runnerId, { attemptId: f.attemptId, ownerVersion: 1 });
      return record(client, { ...owned.task, id: randomUUID() }, owned.attempt, f.input);
    })).rejects.toMatchObject({ status: 409 });
    await pool.query('UPDATE flow.sessions SET active_task_id=NULL WHERE id=$1', [f.input.observation.nativeSessionId]);
    await expect(save(f)).rejects.toMatchObject({ status: 409 });
    expect(await details(f)).toEqual(before); expect((await read(f)).latest).toBeNull();
  });
  it('uses the real frozen citation seam for exact material bytes without returning content', async () => {
    const f = await fixture();
    const project = (await createProject(pool, { workspaceId: 'personal', title: 'Context metadata' }, randomUUID())).snapshot.project.id;
    const text = '私有材料🙂'; const source = await createSource(pool, project, { expectedVersion: 0, title: 'Source', text }, randomUUID());
    const citation: KnowledgeCitation = { projectId: project, sourceId: source.source.id, version: 1, contentDigest: source.version.contentDigest,
      locator: { kind: 'utf8-bytes', start: 0, end: Buffer.byteLength(text) } };
    const conversationId = randomUUID();
    await transaction(pool, async client => {
      await client.query("INSERT INTO flow.conversations(id,title,harness,requested,project_id) VALUES($1,'Context','claude','{}',$2)", [conversationId, project]);
      const inputId = await freezeContext(client, conversationId, project, 'Private prompt 中文 never in metadata', [citation]);
      await bindExecutionInput(client, f.taskId, inputId, conversationId);
    });
    const sample = await save(f); const history = await read(f);
    expect(sample.materials).toEqual({ state: 'known', sources: [{ citation, byteLength: Buffer.byteLength(text), tokens: null }] });
    expect(sample.observation.identity.executionInputDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(sample.observation.identity.materialRevisionDigest).toBe(sha256(canonical({ version: 1, citations: [citation] })));
    expect(history.latest).toEqual(sample); expect(JSON.stringify(history)).not.toContain(text); expect(JSON.stringify(history)).not.toContain('Private prompt');
    expect(history.current.kind).toBe('unknown'); expect(history.remaining.value).toBeNull();
  });
  it('reads latest by original sequence after close/reopen, including resolved-model unknown', async () => {
    const f = await fixture(); await save(f);
    const later = structuredClone(f.input); later.sequence = 3; later.observation.observationId = randomUUID();
    later.observation.observedAt = '2026-10-06T09:00:00.000Z'; later.observation.resolvedModel = null;
    later.observation.used = null; later.observation.compactionWindow = null; later.observation.categories = [];
    const expected = await save(f, later); await pool.end(); pool = openPool();
    await migrateContextObservationHistory(pool);
    const history = await read(f); expect(history.latest).toEqual(expected); expect(history.latest!.observation.used.kind).toBe('unknown');
    expect(history.latest!.observation.identity.resolvedModel).toBeNull(); expect(history.current.kind).toBe('unknown'); expect(history.remaining.value).toBeNull();
  });
});
