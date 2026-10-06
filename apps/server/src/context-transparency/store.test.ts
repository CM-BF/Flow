import type { PoolClient } from 'pg';
import { expect, it } from 'vitest';
import { CLAUDE_CONTEXT_SOURCE, type ContextObservationEvent } from '../../../../packages/contracts/src/context-observation-event.js';
import type { TaskRecord } from '../tasks.js';
import type { AttemptRecord } from '../runners.js';
import { readLatestHistory, record } from './store.js';
import { nativeExecutionProfileConfigurationJson, type ExecutionProfileConfiguration } from '../../../../packages/contracts/src/execution-profiles.js';
import { sha256 } from '../database.js';
import { CONTEXT_DETAIL_TITLE } from '../../../../packages/contracts/src/context-observation-history.js';

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
