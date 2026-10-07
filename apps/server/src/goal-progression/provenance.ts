import type { PoolClient } from 'pg';
import type { GoalProgressionAuthorization } from '../../../../packages/contracts/src/goal-progression.js';
import { HttpError } from '../database.js';

export interface ProgressionProvenance {
  authorization: GoalProgressionAuthorization;
  executions: Map<string, string>;
}
export interface ProgressionProvenances {
  scopes: Map<string, ProgressionProvenance>;
  executionScopes: Map<string, string>;
}
/** Exact goal/execution references only; no material or caller-supplied qualification. */
export async function readProgressionProvenance(client: PoolClient, goalId: string, executionIds: string[], extraId?: string): Promise<ProgressionProvenances> {
  const result: ProgressionProvenances = { scopes: new Map(), executionScopes: new Map() };
  if (!executionIds.length && !extraId) return result;
  // Older factories and their direct consumers remain valid until migration030 is mounted.
  if (!(await client.query("SELECT to_regclass('flow.goal_progressions') AS present")).rows[0].present) return result;
  const rows = (await client.query<{ id: string; authorization: GoalProgressionAuthorization }>(`SELECT p.id,p.manifest AS "authorization" FROM flow.goal_progressions p
    WHERE p.goal_id=$1 AND (p.id=$3 OR p.id IN (SELECT progression_id FROM flow.goal_progression_executions WHERE execution_id=ANY($2::text[])))
    LIMIT 401`, [goalId, executionIds, extraId ?? null])).rows;
  if (rows.length > 400) throw new HttpError(409, 'goal_progression_bound', 'Too many execution authorizations in one read.');
  for (const row of rows) result.scopes.set(row.id, { authorization: row.authorization, executions: new Map() });
  if (!rows.length) return result;
  const links = (await client.query<{ progression_id: string; node_id: string; execution_id: string }>(`SELECT progression_id,node_id,execution_id
    FROM flow.goal_progression_executions WHERE progression_id=ANY($1::text[]) LIMIT 8001`, [rows.map(row => row.id)])).rows;
  if (links.length > 8000) throw new HttpError(409, 'goal_progression_bound', 'Too many fixed execution links.');
  for (const link of links) {
    result.scopes.get(link.progression_id)!.executions.set(link.node_id, link.execution_id);
    result.executionScopes.set(link.execution_id, link.progression_id);
  }
  return result;
}
