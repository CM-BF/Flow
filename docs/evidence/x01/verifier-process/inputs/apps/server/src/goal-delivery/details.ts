import type { PoolClient } from 'pg';
import type { GoalDefinition, GoalView } from '../../../../packages/contracts/src/goals.js';
import type { GoalDeliveryDecision, GoalDeliveryGoal, GoalDeliveryInput } from '../../../../packages/contracts/src/goal-delivery.js';
import { HttpError } from '../database.js';

export async function readGoal(client: PoolClient, goalId: string): Promise<GoalDeliveryGoal> {
  const goal = (await client.query<{ project_id: string; original: Omit<GoalView, 'id' | 'projectId' | 'createdAt'>; created_at: Date }>('SELECT project_id,original,created_at FROM flow.goals WHERE id=$1', [goalId])).rows[0];
  if (!goal) throw new HttpError(404, 'goal_not_found', 'Goal not found.');
  return { view: 'goal', goal: { id: goalId, projectId: goal.project_id, ...goal.original, createdAt: goal.created_at.toISOString() } };
}
export async function readInput(client: PoolClient, goalId: string, nodeId: string, version: number): Promise<GoalDeliveryInput> {
  const row = (await client.query<{ input: GoalDefinition['input']; project_revision: number; created_at: Date; current_version: number | null }>(`SELECT i.input,i.project_revision,i.created_at,
    CASE WHEN EXISTS (SELECT 1 FROM jsonb_array_elements(r.nodes) n WHERE n->>'id'=i.node_id) THEN n.input_version ELSE NULL END AS current_version
    FROM flow.goal_inputs i JOIN flow.goals g ON g.id=i.goal_id JOIN flow.projects p ON p.id=g.project_id
    JOIN flow.project_revisions r ON (r.project_id,r.revision)=(p.id,p.revision)
    LEFT JOIN flow.goal_nodes n ON (n.goal_id,n.node_id)=(i.goal_id,i.node_id)
    WHERE i.goal_id=$1 AND i.node_id=$2 AND i.version=$3`, [goalId, nodeId, version])).rows[0];
  if (!row) throw new HttpError(404, 'goal_input_not_found', 'Exact goal input not found.');
  return { view: 'input', reference: { goalId, nodeId, version }, definition: { nodeId, version, input: row.input, projectRevision: row.project_revision, createdAt: row.created_at.toISOString() }, currentVersion: row.current_version, stale: row.current_version !== version };
}
export async function readDecision(client: PoolClient, goalId: string, nodeId: string, taskId: string, decisionId: string): Promise<GoalDeliveryDecision> {
  const row = (await client.query<{ prompt: string; answer: 'approve' | 'reject' | null; pending: boolean }>(`SELECT d.prompt,d.answer,(t.status='waiting' AND t.pending_decision->>'id'=d.id) AS pending
    FROM flow.goal_executions e JOIN flow.tasks t ON t.id=e.task_id JOIN flow.decisions d ON d.task_id=t.id
    WHERE e.goal_id=$1 AND e.node_id=$2 AND e.task_id=$3 AND d.id=$4`, [goalId, nodeId, taskId, decisionId])).rows[0];
  if (!row) throw new HttpError(404, 'goal_decision_not_found', 'Decision does not belong to the selected goal execution.');
  return { view: 'decision', reference: { goalId, nodeId, taskId, decisionId }, prompt: row.prompt, pending: row.pending, answer: row.answer };
}
