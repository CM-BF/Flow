import type { Pool, PoolClient } from 'pg';
import type { Ownership } from '../../../../packages/contracts/src/runner.js';
import type { GoalToolRunReference } from '../../../../packages/contracts/src/goal-tool-runs.js';
import { HttpError, transaction } from '../database.js';
import { lockRunner, ownedAttempt } from '../runners.js';
import { loadState, type GoalState } from '../goals/state.js';
import { runRow, type RunRow } from './store.js';

/** Lock project before planner task, matching existing goal commands' project -> child task order. */
export async function authorized<T>(pool: Pool, runnerId: string, ownership: Ownership, expected: GoalToolRunReference | undefined,
  action: (client: PoolClient, run: RunRow, state: GoalState) => Promise<T>): Promise<T> {
  return transaction(pool, async client => {
    await lockRunner(client, runnerId);
    const found = (await client.query<{ id: string; goal_id: string; runner_id: string }>(`SELECT g.id,g.goal_id,a.runner_id FROM flow.goal_tool_runs g JOIN flow.attempts a ON a.task_id=g.task_id WHERE a.id=$1`, [ownership.attemptId])).rows[0];
    if (!found || found.runner_id !== runnerId) throw new HttpError(403, 'goal_tool_forbidden', 'This attempt has no granted goal tool authority.');
    const state = await loadState(client, found.goal_id, true);
    const { attempt, task } = await ownedAttempt(client, runnerId, ownership);
    const run = await runRow(client, found.id, true);
    if (expected && (expected.id !== run.id || expected.version !== run.version)) throw new HttpError(409, 'goal_tool_grant_mismatch', 'The requested grant does not match this attempt.');
    if (run.revoked_at) throw new HttpError(409, 'goal_tool_revoked', 'Goal tool authority was revoked.');
    const live = (await client.query<{ live: boolean }>('SELECT $1::timestamptz>clock_timestamp() AS live', [attempt.lease_expires_at])).rows[0]!.live;
    if (!live || attempt.completed_at || task.status !== 'running') throw new HttpError(409, 'goal_tool_inactive', 'This attempt no longer has active goal tool authority.');
    if (run.task_id !== task.id || task.submission.harness !== run.mode) throw new HttpError(409, 'goal_tool_task_mismatch', 'The planner task does not match the grant.');
    return action(client, run, state);
  });
}
export function requireGrantedNode(run: RunRow, nodeId: string) {
  if (!run.scope.allowedNodeIds.includes(nodeId)) throw new HttpError(403, 'goal_tool_scope', 'The node is outside this grant.');
}
