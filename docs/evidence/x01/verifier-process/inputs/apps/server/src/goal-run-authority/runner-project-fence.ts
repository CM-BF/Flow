import type { Pool, PoolClient } from 'pg';
import type { Ownership } from '../../../../packages/contracts/src/runner.js';
import { HttpError, transaction } from '../database.js';
import { lockRunner, ownedAttempt } from '../runners.js';
import { loadState, type GoalState } from '../goals/state.js';

export interface AuthorityRow { id: string; version: number; goal_id: string; task_id: string; mode: string; revoked_at: Date | null }
/** Server-private adapters are fixed in source; no caller-provided SQL/table names. */
export interface AuthorityStore<Row extends AuthorityRow> {
  code: 'goal_tool' | 'goal_graph';
  find(client: PoolClient, attemptId: string): Promise<{ id: string; goal_id: string; runner_id: string } | undefined>;
  lock(client: PoolClient, id: string): Promise<Row>;
  revoke(client: PoolClient, id: string, reason: string): Promise<Row>;
}
export function withRunnerAuthority<Row extends AuthorityRow, T>(pool: Pool, store: AuthorityStore<Row>, runnerId: string,
  ownership: Ownership, expected: { id: string; version: number } | undefined,
  action: (client: PoolClient, run: Row, state: GoalState) => Promise<T>): Promise<T> {
  return transaction(pool, async client => {
    await lockRunner(client, runnerId);
    const found = await store.find(client, ownership.attemptId);
    if (!found || found.runner_id !== runnerId) throw new HttpError(403, `${store.code}_forbidden`, 'This attempt has no granted authority.');
    // Same project -> task order as goal commands; revoke never waits on project.
    const state = await loadState(client, found.goal_id, true);
    const { attempt, task } = await ownedAttempt(client, runnerId, ownership);
    const run = await store.lock(client, found.id);
    if (expected && (expected.id !== run.id || expected.version !== run.version)) throw new HttpError(409, `${store.code}_grant_mismatch`, 'The requested grant does not match this attempt.');
    if (run.revoked_at) throw new HttpError(409, `${store.code}_revoked`, 'Authority was revoked.');
    const live = (await client.query<{ live: boolean }>('SELECT $1::timestamptz>clock_timestamp() AS live', [attempt.lease_expires_at])).rows[0]!.live;
    if (!live || attempt.completed_at || task.status !== 'running') throw new HttpError(409, `${store.code}_inactive`, 'This attempt no longer has active authority.');
    if (run.task_id !== task.id || task.submission.harness !== run.mode) throw new HttpError(409, `${store.code}_task_mismatch`, 'The planner task does not match the grant.');
    return action(client, run, state);
  });
}
export async function revokeAuthority<Row extends AuthorityRow>(client: PoolClient, store: AuthorityStore<Row>, id: string, reason: string) {
  const existing = await store.lock(client, id);
  return existing.revoked_at ? { row: existing, changed: false } : { row: await store.revoke(client, id, reason), changed: true };
}
