import type { PoolClient } from 'pg';
import type { GoalInput } from '../../../../packages/contracts/src/goals.js';
import { HttpError } from '../database.js';
/** No references means no added query, including callers using an earlier migration stage. */
export async function loadGoalKnowledgeHeads(client: PoolClient, projectId: string, inputs: Pick<GoalInput, 'knowledge'>[]): Promise<Map<string, number>> {
  const ids = [...new Set(inputs.flatMap(input => (input.knowledge ?? []).map(ref => ref.sourceId)))];
  if (!ids.length) return new Map();
  if (ids.length > 128) throw new HttpError(409, 'goal_context_invalid', 'Goal references exceed the project source bound.');
  const rows = (await client.query<{ id: string; current_version: number }>('SELECT id,current_version FROM flow.knowledge_sources WHERE project_id=$1 AND id=ANY($2::uuid[])', [projectId, ids])).rows;
  return new Map(rows.map(row => [row.id, row.current_version]));
}
export function knowledgeCurrent(input: Pick<GoalInput, 'knowledge'>, projectId: string, heads: Map<string, number>): boolean {
  return (input.knowledge ?? []).every(ref => ref.projectId === projectId && heads.get(ref.sourceId) === ref.version);
}
