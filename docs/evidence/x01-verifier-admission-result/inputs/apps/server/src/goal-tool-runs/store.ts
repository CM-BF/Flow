import { revokeAuthority, type AuthorityStore } from '../goal-run-authority/runner-project-fence.js';
import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import type { PgBoss } from 'pg-boss';
import type { GoalToolAudit, GoalToolRun, GoalToolRunAdmission, GoalToolRunAccepted, GoalToolRunRevoked, GoalToolScope } from '../../../../packages/contracts/src/goal-tool-runs.js';
import { HttpError, transaction } from '../database.js';
import { acceptTask, command } from '../tasks.js';
import { loadState, requireNode } from '../goals/state.js';

export interface RunRow { id: string; version: 1; goal_id: string; task_id: string; scope: GoalToolScope; mode: 'fixture' | 'claude'; used_commands: number; created_at: Date; revoked_at: Date | null; revocation_reason: string | null }
export function runView(row: RunRow): GoalToolRun {
  return { id: row.id, version: row.version, goalId: row.goal_id, taskId: row.task_id, scope: row.scope, mode: row.mode,
    usedCommands: row.used_commands, createdAt: row.created_at.toISOString(), revokedAt: row.revoked_at?.toISOString() ?? null, revocationReason: row.revocation_reason };
}
export async function runRow(client: PoolClient, id: string, lock = false): Promise<RunRow> {
  const row = (await client.query<RunRow>(`SELECT * FROM flow.goal_tool_runs WHERE id=$1${lock ? ' FOR UPDATE' : ''}`, [id])).rows[0];
  if (!row) throw new HttpError(404, 'goal_tool_run_not_found', 'Goal tool run not found.');
  return row;
}
export const nodeAuthorityStore: AuthorityStore<RunRow> = {
  code: 'goal_tool',
  async find(client, attemptId) { return (await client.query<{ id: string; goal_id: string; runner_id: string }>('SELECT g.id,g.goal_id,a.runner_id FROM flow.goal_tool_runs g JOIN flow.attempts a ON a.task_id=g.task_id WHERE a.id=$1', [attemptId])).rows[0]; },
  lock: (client, id) => runRow(client, id, true),
  async revoke(client, id, reason) { return (await client.query<RunRow>('UPDATE flow.goal_tool_runs SET revoked_at=clock_timestamp(),revocation_reason=$2 WHERE id=$1 RETURNING *', [id, reason])).rows[0]!; },
};
export async function admit(pool: Pool, boss: PgBoss, goalId: string, input: GoalToolRunAdmission, key: string): Promise<GoalToolRunAccepted> {
  const accepted = await command(pool, `goal-tool-run:create:${goalId}`, key, input, async client => {
    const state = await loadState(client, goalId, true);
    for (const nodeId of input.scope.allowedNodeIds) requireNode(state, nodeId);
    const prompt = JSON.stringify({ goal: { originalGoal: state.goal.originalGoal, constraints: state.goal.constraints, acceptance: state.goal.acceptance }, instruction: input.prompt });
    if (prompt.length > 16_000) throw new HttpError(409, 'input_too_large', 'Goal tool input exceeds the task limit; no text was truncated.');
    const execution = input.execution.harness === 'fixture'
      ? { harness: 'fixture' as const, fixture: { scenario: 'success' as const } }
      : { harness: 'claude' as const, executionProfile: input.execution.executionProfile };
    const task = await acceptTask(client, boss, { title: 'Goal tool run', prompt, ...execution }, input.execution.harness === 'claude' ? 'goal-tools' : 'ordinary');
    const row = (await client.query<RunRow>('INSERT INTO flow.goal_tool_runs(id,goal_id,task_id,version,scope,mode) VALUES($1,$2,$3,1,$4,$5) RETURNING *', [randomUUID(), goalId, task.id, input.scope, input.execution.harness])).rows[0]!;
    return { run: runView(row), task };
  });
  return { ...accepted.value, replayed: accepted.replayed };
}
export async function getRun(pool: Pool, id: string) { return transaction(pool, async client => runView(await runRow(client, id)), true); }
export async function revoke(pool: Pool, id: string, reason: string, key: string): Promise<GoalToolRunRevoked> {
  const changed = await command(pool, `goal-tool-run:revoke:${id}`, key, { reason }, async client => {
    const result = await revokeAuthority(client, nodeAuthorityStore, id, reason);
    return { run: runView(result.row), changed: result.changed };
  });
  return { ...changed.value, replayed: changed.replayed };
}
export async function audit(pool: Pool, id: string, after: number, limit: number) {
  return transaction(pool, async client => {
    const run = runView(await runRow(client, id));
    const rows = (await client.query<{ sequence: number; attempt_id: string; owner_version: number; command_key: string; digest: string; kind: GoalToolAudit['kind']; node_id: string; result: GoalToolAudit['result']; created_at: Date }>('SELECT * FROM flow.goal_tool_calls WHERE run_id=$1 AND sequence>$2 ORDER BY sequence LIMIT $3', [id, after, limit + 1])).rows;
    const calls: GoalToolAudit[] = rows.slice(0, limit).map(row => ({ sequence: row.sequence, attemptId: row.attempt_id, ownerVersion: row.owner_version, key: row.command_key, digest: row.digest, kind: row.kind, nodeId: row.node_id, result: row.result, createdAt: row.created_at.toISOString() }));
    return { run, calls, nextCursor: rows.length > limit ? calls.at(-1)!.sequence : null };
  }, true);
}
