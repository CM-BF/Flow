import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import type { PgBoss } from 'pg-boss';
import { goalGraphScopeSchema, type GoalGraphAudit, type GoalGraphAuditPage, type GoalGraphRun, type GoalGraphRunAdmission, type GoalGraphRunAccepted, type GoalGraphRunRevoked, type GoalGraphScope, type GoalGraphRunPage } from '../../../../packages/contracts/src/goal-graph-runs.js';
import { HttpError, transaction } from '../database.js';
import { acceptTask, command } from '../tasks.js';
import { goalContext } from '../goal-graph-proposals/store.js';
import { readProject } from '../projects/storage.js';
import { revokeAuthority, type AuthorityStore } from '../goal-run-authority/runner-project-fence.js';
import { TASK_SUMMARY_COLUMNS, toTaskSummary, type TaskSummaryRow } from '../task-read-projection.js';

export interface GraphRunRow {
  id: string; version: 1; goal_id: string; task_id: string; mode: 'fixture' | 'claude'; used_commands: number;
  scope: GoalGraphScope & { projectId: string; goalDigest: string };
  created_at: Date; revoked_at: Date | null; revocation_reason: string | null;
}
export async function runRow(client: PoolClient, id: string, lock = false) {
  const row = (await client.query<GraphRunRow>(`SELECT * FROM flow.goal_graph_runs WHERE id=$1${lock ? ' FOR UPDATE' : ''}`, [id])).rows[0];
  if (!row) throw new HttpError(404, 'goal_graph_run_not_found', 'Graph run not found.');
  return row;
}
export const graphAuthorityStore: AuthorityStore<GraphRunRow> = {
  code: 'goal_graph',
  async find(client, attemptId) { return (await client.query<{ id: string; goal_id: string; runner_id: string }>('SELECT g.id,g.goal_id,a.runner_id FROM flow.goal_graph_runs g JOIN flow.attempts a ON a.task_id=g.task_id WHERE a.id=$1', [attemptId])).rows[0]; },
  lock: (client, id) => runRow(client, id, true),
  async revoke(client, id, reason) { return (await client.query<GraphRunRow>('UPDATE flow.goal_graph_runs SET revoked_at=clock_timestamp(),revocation_reason=$2 WHERE id=$1 RETURNING *', [id, reason])).rows[0]!; },
};
export async function counts(client: PoolClient, id: string) {
  const row = (await client.query<{ proposals: number; applications: number }>("SELECT count(*) FILTER (WHERE kind='propose')::int AS proposals,count(*) FILTER (WHERE kind='apply')::int AS applications FROM flow.goal_graph_calls WHERE run_id=$1", [id])).rows[0]!;
  return row;
}
export async function runView(client: PoolClient, row: GraphRunRow): Promise<GoalGraphRun> {
  const { projectId, goalDigest, ...scope } = row.scope;
  const used = await counts(client, row.id);
  return { id: row.id, version: row.version, goalId: row.goal_id, projectId, goalDigest, taskId: row.task_id, scope, mode: row.mode,
    usedCommands: row.used_commands, usedProposals: used.proposals, usedApplications: used.applications,
    createdAt: row.created_at.toISOString(), revokedAt: row.revoked_at?.toISOString() ?? null, revocationReason: row.revocation_reason };
}
export async function admit(pool: Pool, boss: PgBoss, goalId: string, input: GoalGraphRunAdmission, key: string): Promise<GoalGraphRunAccepted> {
  // Persist the explicitly admitted capability; absent legacy fields are never defaulted.
  const scope = goalGraphScopeSchema.parse(input.scope);
  if (input.execution.harness === 'claude' && !input.execution.executionProfile) throw new HttpError(409, 'native_graph_tools_unavailable', 'Native graph tools require their dedicated execution bridge.');
  const result = await command(pool, `goal-graph-run:create:${goalId}`, key, input, async client => {
    const context = await goalContext(client, goalId, true);
    if (context.project.revision !== scope.baseRevision) throw new HttpError(409, 'stale_project_revision', 'The grant must name the current project revision.');
    const graph = await readProject(client, context.project.id, scope.baseRevision);
    for (const ref of scope.allowedExistingNodes) {
      if (!graph.graph.nodes.some(node => node.id === ref.nodeId && node.version === ref.expectedVersion)) throw new HttpError(409, 'goal_graph_scope', 'An allowed existing reference is not in the base graph.');
    }
    const native = input.execution.harness === 'claude';
    const prompt = native ? JSON.stringify({ goal: context.goal.original, instruction: input.prompt }) : input.prompt;
    if (prompt.length > 16_000) throw new HttpError(409, 'input_too_large', 'Graph input exceeds the task limit; no text was truncated.');
    const execution = input.execution.harness === 'fixture'
      ? { harness: 'fixture' as const, fixture: { scenario: 'success' as const } }
      : { harness: 'claude' as const, executionProfile: input.execution.executionProfile };
    const task = await acceptTask(client, boss, { title: 'Goal graph run', prompt, ...execution }, native ? 'goal-graph-tools' : 'ordinary');
    const row = (await client.query<GraphRunRow>('INSERT INTO flow.goal_graph_runs(id,goal_id,task_id,version,scope,mode) VALUES($1,$2,$3,1,$4,$5) RETURNING *', [randomUUID(), goalId, task.id, { ...scope, projectId: context.project.id, goalDigest: context.goalDigest }, input.execution.harness])).rows[0]!;
    return { run: await runView(client, row), task };
  });
  return { ...result.value, replayed: result.replayed };
}
export function getRun(pool: Pool, id: string) { return transaction(pool, async client => runView(client, await runRow(client, id)), true); }

type RunCursor = { version: 1; goalId: string; at: string; id: string };
function listCursor(goalId: string, after?: string): RunCursor | null {
  if (!after) return null;
  try {
    if (!/^[A-Za-z0-9_-]+$/.test(after) || after.length > 1024) throw Error();
    const cursor = JSON.parse(Buffer.from(after, 'base64url').toString('utf8')) as RunCursor;
    if (Object.keys(cursor).sort().join(',') !== 'at,goalId,id,version' || cursor.version !== 1 || cursor.goalId !== goalId || typeof cursor.id !== 'string' || cursor.id.length < 1 || cursor.id.length > 128 || typeof cursor.at !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/.test(cursor.at) || new Date(cursor.at).toISOString() !== cursor.at.slice(0, 23) + 'Z') throw Error();
    return cursor;
  } catch { throw new HttpError(400, 'invalid_goal_graph_cursor', 'Use the cursor returned for this goal.'); }
}
/** Existing grant/task rows are the authority; this is a body-free live read, not another execution ledger. */
export function listRuns(pool: Pool, goalId: string, after?: string, limit = 10): Promise<GoalGraphRunPage> {
  const cursor = listCursor(goalId, after);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 20) throw new HttpError(400, 'invalid_graph_run', 'Invalid planning page size.');
  return transaction(pool, async client => {
    const goal = (await client.query<{ project_id: string }>('SELECT project_id FROM flow.goals WHERE id=$1', [goalId])).rows[0];
    if (!goal) throw new HttpError(404, 'goal_not_found', 'Goal not found.');
    const rows = (await client.query<{ id: string; version: 1; task_id: string; project_id: string; goal_digest: string; base_revision: number; mode: 'fixture' | 'claude'; created_at: Date; revoked_at: Date | null; sort_time: string }>(`SELECT id,version,task_id,scope->>'projectId' AS project_id,scope->>'goalDigest' AS goal_digest,
      (scope->>'baseRevision')::int AS base_revision,mode,created_at,revoked_at,
      to_char(created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS sort_time
      FROM flow.goal_graph_runs WHERE goal_id=$1 AND ($2::timestamptz IS NULL OR (created_at,id)<($2::timestamptz,$3::text))
      ORDER BY created_at DESC,id DESC LIMIT $4`, [goalId, cursor?.at ?? null, cursor?.id ?? null, limit + 1])).rows;
    const page = rows.slice(0, limit);
    const tasks = page.length ? (await client.query<TaskSummaryRow>(`SELECT ${TASK_SUMMARY_COLUMNS} FROM flow.tasks WHERE id=ANY($1)`, [page.map(row => row.task_id)])).rows : [];
    const byTask = new Map(tasks.map(task => [task.id, task]));
    const runs = page.map(row => {
      const task = byTask.get(row.task_id);
      if (row.project_id !== goal.project_id || !task || task.harness !== row.mode) throw new HttpError(409, 'goal_graph_run_identity', 'The planning run and task association is inconsistent.');
      return { id: row.id, version: row.version, goalId, projectId: goal.project_id, goalDigest: row.goal_digest, baseRevision: row.base_revision,
        mode: row.mode, task: toTaskSummary(task), createdAt: row.created_at.toISOString(), revokedAt: row.revoked_at?.toISOString() ?? null };
    });
    const last = page.at(-1);
    return { goalId, projectId: goal.project_id, runs, nextCursor: rows.length > limit && last
      ? Buffer.from(JSON.stringify({ version: 1, goalId, at: last.sort_time, id: last.id } satisfies RunCursor)).toString('base64url') : null };
  }, true);
}
export async function revoke(pool: Pool, id: string, reason: string, key: string): Promise<GoalGraphRunRevoked> {
  const result = await command(pool, `goal-graph-run:revoke:${id}`, key, { reason }, async client => {
    const changed = await revokeAuthority(client, graphAuthorityStore, id, reason);
    return { run: await runView(client, changed.row), changed: changed.changed };
  });
  return { ...result.value, replayed: result.replayed };
}
export function audit(pool: Pool, id: string, after: number, limit: number): Promise<GoalGraphAuditPage> {
  return transaction(pool, async client => {
    const run = await runView(client, await runRow(client, id));
    const rows = (await client.query<{ sequence: number; runner_id: string; attempt_id: string; owner_version: number; command_key: string; digest: string; kind: GoalGraphAudit['kind']; proposal_id: string; proposal_digest: string; applied_revision: number | null; created_at: Date }>('SELECT * FROM flow.goal_graph_calls WHERE run_id=$1 AND sequence>$2 ORDER BY sequence LIMIT $3', [id, after, limit + 1])).rows;
    const calls = rows.slice(0, limit).map(row => ({ sequence: row.sequence, runnerId: row.runner_id, attemptId: row.attempt_id, ownerVersion: row.owner_version, key: row.command_key, digest: row.digest,
      kind: row.kind, proposalId: row.proposal_id, proposalDigest: row.proposal_digest, appliedRevision: row.applied_revision, createdAt: row.created_at.toISOString() }));
    return { run, calls, nextCursor: rows.length > limit ? calls.at(-1)!.sequence : null };
  }, true);
}
