import { z } from 'zod';
import type { PoolClient } from 'pg';
import type { GoalExplanation } from '../../../../packages/contracts/src/goals.js';
import type { GoalDeliveryExplanation, GoalDeliveryExplanations } from '../../../../packages/contracts/src/goal-delivery.js';
import { HttpError } from '../database.js';
import { explanationView } from '../goals/state.js';

const cursorSchema = z.tuple([z.literal(1), z.string(), z.number().int().min(1).max(2_147_483_647), z.number().int().min(1).max(2_147_483_647)]);
function pagePosition(after: string | undefined, goalId: string, current: number) {
  if (!after) return { through: current, last: 0 };
  try {
    const [_, goal, through, last] = cursorSchema.parse(JSON.parse(Buffer.from(after, 'base64url').toString('utf8')));
    if (goal !== goalId || last >= through || through > current) throw Error();
    return { through, last };
  } catch { throw new HttpError(400, 'invalid_goal_explanation_cursor', 'Choose a cursor from this goal history.'); }
}
export async function explanationPage(client: PoolClient, goalId: string, limit: number, after?: string): Promise<GoalDeliveryExplanations> {
  const goal = (await client.query<{ explanation_version: number }>('SELECT explanation_version FROM flow.goals WHERE id=$1', [goalId])).rows[0];
  if (!goal) throw new HttpError(404, 'goal_not_found', 'Goal not found.');
  const { through, last } = pagePosition(after, goalId, goal.explanation_version);
  // The existing (goal_id,version) primary key supplies bounded keyset reads, without material text.
  const rows = (await client.query<Omit<GoalExplanation, 'text' | 'createdAt'> & { created_at: Date }>(
    'SELECT version,kind,source,created_at FROM flow.goal_explanations WHERE goal_id=$1 AND version>$2 AND version<=$3 ORDER BY version LIMIT $4', [goalId, last, through, limit + 1])).rows;
  const page = rows.slice(0, limit);
  return { view: 'explanations', goalId, throughVersion: through,
    items: page.map(row => ({ reference: { goalId, version: row.version }, kind: row.kind, source: row.source, createdAt: row.created_at.toISOString() })),
    nextCursor: rows.length > limit ? Buffer.from(JSON.stringify([1, goalId, through, page.at(-1)!.version])).toString('base64url') : null };
}
export async function readExplanation(client: PoolClient, goalId: string, version: number): Promise<GoalDeliveryExplanation> {
  const row = (await client.query<GoalExplanation & { created_at: Date }>('SELECT version,kind,text,source,created_at FROM flow.goal_explanations WHERE goal_id=$1 AND version=$2', [goalId, version])).rows[0];
  if (!row) throw new HttpError(404, 'goal_explanation_not_found', 'Exact goal explanation not found.');
  return { view: 'explanation', reference: { goalId, version }, explanation: explanationView(row), historical: true };
}
