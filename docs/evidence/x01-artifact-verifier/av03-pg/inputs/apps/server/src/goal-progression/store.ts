import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import type { GoalProgressionAuthorization, GoalProgressionCause, GoalProgressionResult, GoalProgressionSnapshot } from '../../../../packages/contracts/src/goal-progression.js';
import { canonical, HttpError, sha256, transaction } from '../database.js';
import { requireExecutionProfile } from '../execution-profiles/store.js';
import { knowledgeCurrent } from '../goal-context/freshness.js';
import { currentDeliveries, equalBindings, loadState, requireNode, type GoalState } from '../goals/state.js';
import { command, loadTask } from '../tasks.js';

export interface ProgressionRow {
  id: string; goal_id: string; project_id: string; authorization: GoalProgressionAuthorization; authorization_digest: string;
  created_at: Date; expires_at: Date; revoked_at: Date | null; finished_at: Date | null; halted: GoalProgressionCause | null;
}
export async function progressionRow(client: PoolClient, goalId: string, id: string, lock = false): Promise<ProgressionRow> {
  const row = (await client.query<ProgressionRow>(`SELECT *,manifest AS "authorization" FROM flow.goal_progressions WHERE goal_id=$1 AND id=$2${lock ? ' FOR UPDATE' : ''}`, [goalId, id])).rows[0];
  if (!row) throw new HttpError(404, 'goal_progression_not_found', 'Progression does not belong to this goal.');
  return row;
}
export async function requireReadonlyProfile(client: PoolClient, selection: GoalProgressionAuthorization['nodes'][number]) {
  const profile = await requireExecutionProfile(client, selection.executionProfile, 'ordinary');
  if (profile.configuration.access !== 'configured-readonly') throw new HttpError(409, 'goal_readonly_profile_required', 'Continuation requires a configured readonly profile.');
  return profile.reference;
}
export async function authorizeProgression(pool: Pool, goalId: string, input: GoalProgressionAuthorization, key: string): Promise<GoalProgressionResult> {
  const result = await command(pool, `goal:progression:${goalId}`, key, input, client => authorizeProgressionInTransaction(client, goalId, input));
  return { progression: result.value, replayed: result.replayed };
}
/** Caller owns current authorization, transaction and replay; ordinary owner and plan confirmation share this admission. */
export async function authorizeProgressionInTransaction(client: PoolClient, goalId: string, input: GoalProgressionAuthorization): Promise<GoalProgressionSnapshot> {
  const state = await loadState(client, goalId, true);
  const encoding = (await client.query<{ now: Date; bytes: number }>('SELECT clock_timestamp() AS now,octet_length($1::jsonb::text) AS bytes', [JSON.stringify(input)])).rows[0]!;
  if (encoding.bytes > 65_536) throw new HttpError(400, 'progression_manifest_size', 'Stored authorization exceeds its byte bound.');
  const now = encoding.now;
  if (Date.parse(input.expiresAt) <= now.getTime() || Date.parse(input.expiresAt) > now.getTime() + 86_400_000) throw new HttpError(409, 'progression_expiry', 'Expiry must be in the next 24 hours.');
  if ((await client.query('SELECT 1 FROM flow.goal_progressions WHERE goal_id=$1 AND revoked_at IS NULL AND finished_at IS NULL', [goalId])).rowCount) throw new HttpError(409, 'progression_active', 'Revoke the existing authorization before replacing it.');
  await validateAuthorization(client, state, input);
  const row = (await client.query<ProgressionRow>(`INSERT INTO flow.goal_progressions(id,goal_id,project_id,manifest,authorization_digest,created_at,expires_at)
    VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *,manifest AS "authorization"`, [randomUUID(), goalId, state.goal.projectId, JSON.stringify(input), sha256(canonical(input)), now, input.expiresAt])).rows[0]!;
  return progressionSnapshot(row, await loadState(client, goalId, false, row.id));
}
async function validateAuthorization(client: PoolClient, state: GoalState, input: GoalProgressionAuthorization) {
  if (state.project.project.revision !== input.projectRevision) throw new HttpError(409, 'progression_graph_changed', 'Authorization must name the current graph revision.');
  const selected = new Set(input.nodes.map(node => node.nodeId));
  const validity = currentDeliveries(state);
  for (const selection of input.nodes) {
    const node = requireNode(state, selection.nodeId), definition = state.inputs.get(node.id);
    if (node.version !== selection.nodeVersion || definition?.version !== selection.inputVersion) throw new HttpError(409, 'progression_input_changed', 'Every selected node needs exact current node and actual input versions.');
    if (!knowledgeCurrent(definition.input, state.goal.projectId, state.knowledgeHeads)) throw new HttpError(409, 'goal_knowledge_obsolete', 'Selected knowledge must be current.');
    const previous = state.nodes.get(node.id)?.latest_execution_id ?? null;
    if (previous !== selection.previousExecutionId) throw new HttpError(409, 'execution_version', 'Authorization must name each current predecessor.');
    if (previous) {
      const task = await loadTask(client, state.executions.get(previous)!.task_id, true);
      if (!['succeeded', 'failed', 'cancelled'].includes(task.status)) throw new HttpError(409, 'execution_unsettled', 'An earlier execution is not settled.');
    }
    const external = node.dependsOn.filter(id => !selected.has(id)).map(id => validity.current(id));
    if (external.some(binding => binding === null) || !equalBindings(external.filter(binding => binding !== null), selection.externalDependencies)) throw new HttpError(409, 'dependency_version', 'External dependencies require exact current owner-accepted artifacts.');
    await requireReadonlyProfile(client, selection);
  }
}
export async function getProgression(pool: Pool, goalId: string, id: string): Promise<GoalProgressionSnapshot> {
  return transaction(pool, async client => progressionSnapshot(await progressionRow(client, goalId, id), await loadState(client, goalId, false, id)), true);
}
export async function revokeProgression(pool: Pool, goalId: string, id: string, reason: string, key: string): Promise<GoalProgressionResult> {
  const result = await command(pool, `goal:progression:revoke:${goalId}:${id}`, key, { reason }, async client => {
    const state = await loadState(client, goalId, true, id);
    const row = await progressionRow(client, goalId, id, true);
    if (!row.revoked_at) {
      const changed = (await client.query<ProgressionRow>('UPDATE flow.goal_progressions SET revoked_at=clock_timestamp(),revocation_reason=$2 WHERE id=$1 RETURNING *,manifest AS "authorization"', [id, reason])).rows[0]!;
      return progressionSnapshot(changed, state);
    }
    return progressionSnapshot(row, state);
  });
  return { progression: result.value, replayed: result.replayed };
}
export interface Assessment { state: GoalProgressionSnapshot['state']; cause: GoalProgressionCause | null; readyNodeId?: string; permanent?: boolean }
export function assessProgression(row: ProgressionRow, state: GoalState): Assessment {
  const stop = (code: string, nodeId: string | null = null): Assessment => ({ state: 'blocked', cause: { code, nodeId }, permanent: true });
  if (row.revoked_at) return { state: 'revoked', cause: { code: 'revoked', nodeId: null } };
  if (row.halted) return { state: row.halted.code === 'expired' ? 'expired' : 'blocked', cause: row.halted, permanent: true };
  const links = state.progressions?.scopes.get(row.id)?.executions ?? new Map<string, string>();
  const validity = currentDeliveries(state);
  if (row.finished_at) return { state: 'finished', cause: null };
  if (row.expires_at.getTime() <= Date.now()) return { state: 'expired', cause: { code: 'expired', nodeId: null }, permanent: true };
  if (state.project.project.revision !== row.authorization.projectRevision) return stop('graph-changed');
  let pendingCause: GoalProgressionCause | undefined;
  for (const selected of row.authorization.nodes) {
    const node = state.project.graph.nodes.find(node => node.id === selected.nodeId), input = state.inputs.get(selected.nodeId);
    if (!node || node.version !== selected.nodeVersion || input?.version !== selected.inputVersion) return stop('input-changed', selected.nodeId);
    if (!knowledgeCurrent(input.input, state.goal.projectId, state.knowledgeHeads)) return stop('knowledge-changed', selected.nodeId);
    const linked = links.get(node.id), expected = linked ?? selected.previousExecutionId;
    if ((state.nodes.get(node.id)?.latest_execution_id ?? null) !== expected) return stop('execution-replaced', node.id);
    if (!linked) continue;
    const execution = state.executions.get(linked);
    if (!execution || !validity.isCurrent(execution)) return stop('dependency-changed', node.id);
    const task = execution.task;
    if (['uncertain', 'failed', 'cancelled', 'cancel_requested'].includes(task.status)) return stop('execution-' + task.status, node.id);
    if (task.status === 'succeeded' && task.verification_status === 'failed') return stop('verification-failed', node.id);
    if (task.status !== 'succeeded' || task.verification_status !== 'passed') pendingCause = { code: task.status === 'waiting' ? 'decision-required' : task.status === 'succeeded' ? 'verification-pending' : 'execution-active', nodeId: node.id };
    else if (!validity.operationalBinding(row.id, node.id)) return stop('artifact-unavailable', node.id);
  }
  if (pendingCause) return { state: 'active', cause: pendingCause };
  if (links.size === row.authorization.nodes.length) return { state: 'finished', cause: null };
  if (links.size >= row.authorization.maxAdmissions) return stop('admission-budget-exhausted');
  const next = row.authorization.nodes.find(node => !links.has(node.nodeId) && validity.progressionDependencies(row.id, node.nodeId) !== null);
  return next ? { state: 'active', cause: null, readyNodeId: next.nodeId } : stop('dependency-unavailable');
}
export function progressionSnapshot(row: ProgressionRow, state: GoalState): GoalProgressionSnapshot {
  const assessment = assessProgression(row, state), links = state.progressions?.scopes.get(row.id)?.executions ?? new Map<string, string>();
  const validity = currentDeliveries(state);
  return { id: row.id, goalId: row.goal_id, projectId: row.project_id, authorization: row.authorization, authorizationDigest: row.authorization_digest,
    createdAt: row.created_at.toISOString(), revokedAt: row.revoked_at?.toISOString() ?? null, state: assessment.state, cause: assessment.cause,
    admissions: links.size, acceptance: 'separate-owner-decision', nodes: row.authorization.nodes.map(node => {
      const executionId = links.get(node.nodeId) ?? null, execution = executionId ? state.executions.get(executionId) : undefined;
      return { nodeId: node.nodeId, inputVersion: node.inputVersion, executionId, artifact: validity.operationalBinding(row.id, node.nodeId),
        task: execution ? { id: execution.task_id, status: execution.task.status, verificationStatus: execution.task.verification_status, decisionId: execution.task.decision_id ?? null } : null };
    }) };
}
