import type { Pool } from 'pg';
import type { PgBoss } from 'pg-boss';
import { HttpError, transaction } from '../database.js';
import { executeGoalNode } from '../goals/commands.js';
import { currentDeliveries, loadState } from '../goals/state.js';
import { assessProgression, progressionRow, requireReadonlyProfile } from './store.js';

/** A single bounded sweep; the existing center lifecycle owns scheduling and shutdown. */
export async function scanGoalProgressions(pool: Pool, boss: PgBoss, limit = 20) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 20) throw new RangeError('Invalid progression scan bound.');
  // Commit rotation first: never hold a grant lock while waiting for its project.
  const candidates = await transaction(pool, async client => (await client.query<{ id: string; goal_id: string }>(`WITH selected AS (
    SELECT id FROM flow.goal_progressions WHERE revoked_at IS NULL AND finished_at IS NULL AND halted IS NULL
    ORDER BY checked_at,id LIMIT $1 FOR UPDATE SKIP LOCKED)
    UPDATE flow.goal_progressions p SET checked_at=clock_timestamp() FROM selected WHERE p.id=selected.id RETURNING p.id,p.goal_id`, [limit])).rows);
  const errors: Error[] = []; let admitted = 0;
  for (const candidate of candidates) {
    try { if (await advanceProgression(pool, boss, candidate.goal_id, candidate.id)) admitted++; }
    catch (error) { errors.push(error instanceof Error ? error : new Error('Progression scan failed.')); }
  }
  return { examined: candidates.length, admitted, errors };
}
async function advanceProgression(pool: Pool, boss: PgBoss, goalId: string, id: string) {
  return transaction(pool, async client => {
    await loadState(client, goalId, true, id);
    const row = await progressionRow(client, goalId, id, true);
    await client.query(`SELECT t.id FROM flow.tasks t JOIN flow.goal_executions e ON e.task_id=t.id
      JOIN flow.goal_progression_executions l ON l.execution_id=e.id WHERE l.progression_id=$1 ORDER BY t.id FOR UPDATE OF t`, [id]);
    const state = await loadState(client, goalId, false, id), assessment = assessProgression(row, state);
    if (assessment.state === 'finished') {
      if (!row.finished_at) await client.query('UPDATE flow.goal_progressions SET finished_at=clock_timestamp() WHERE id=$1', [id]);
      return false;
    }
    if (assessment.permanent) {
      if (!row.halted) await client.query('UPDATE flow.goal_progressions SET halted=$2 WHERE id=$1', [id, JSON.stringify(assessment.cause)]);
      return false;
    }
    if (!assessment.readyNodeId) return false;
    const selection = row.authorization.nodes.find(node => node.nodeId === assessment.readyNodeId)!;
    await client.query('SAVEPOINT progression_admission');
    try {
      const executionProfile = await requireReadonlyProfile(client, selection);
      const dependencies = currentDeliveries(state).progressionDependencies(id, selection.nodeId)!;
      const result = await executeGoalNode(client, boss, state, { kind: 'execute', nodeId: selection.nodeId, expectedInputVersion: selection.inputVersion,
        previousExecutionId: selection.previousExecutionId, dependencies, reason: row.authorization.reason }, { harness: 'claude', executionProfile }, id);
      await client.query('INSERT INTO flow.goal_progression_executions(progression_id,node_id,execution_id) VALUES($1,$2,$3)', [id, selection.nodeId, result.executionId]);
      await client.query('RELEASE SAVEPOINT progression_admission');
      return true;
    } catch (error) {
      await client.query('ROLLBACK TO SAVEPOINT progression_admission');
      if (!(error instanceof HttpError)) throw error;
      await client.query('UPDATE flow.goal_progressions SET halted=$2 WHERE id=$1', [id, JSON.stringify({ code: error.code, nodeId: selection.nodeId })]);
      return false;
    }
  });
}
