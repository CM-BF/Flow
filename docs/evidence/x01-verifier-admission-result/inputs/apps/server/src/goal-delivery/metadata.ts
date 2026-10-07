import { readProgressionProvenance } from '../goal-progression/provenance.js';
import type { PoolClient } from 'pg';
import { GOAL_DELIVERY_MAX_NODES } from '../../../../packages/contracts/src/goal-delivery.js';
import type { GoalArtifactBinding, GoalInput } from '../../../../packages/contracts/src/goals.js';
import { MAX_PROJECT_EDGES, type ProjectNode } from '../../../../packages/contracts/src/projects.js';
import type { TaskStatus, VerificationStatus } from '../../../../packages/contracts/src/tasks.js';
import { HttpError } from '../database.js';
import { loadGoalKnowledgeHeads } from '../goal-context/freshness.js';
import type { GoalValidityState } from '../goals/state.js';

export interface PlanMetadata {
  goalId: string; projectId: string; projectRevision: number; nodes: ProjectNode[];
  inputs: Map<string, { version: number; input: Pick<GoalInput, 'knowledge'> }>;
}
export async function readPlanMetadata(client: PoolClient, goalId: string): Promise<PlanMetadata> {
  const record = (await client.query<{ project_id: string; revision: number; nodes: ProjectNode[] }>(`SELECT g.project_id,p.revision,r.nodes FROM flow.goals g
    JOIN flow.projects p ON p.id=g.project_id JOIN flow.project_revisions r ON (r.project_id,r.revision)=(p.id,p.revision) WHERE g.id=$1`, [goalId])).rows[0];
  if (!record) throw new HttpError(404, 'goal_not_found', 'Goal not found.');
  if (record.nodes.length > GOAL_DELIVERY_MAX_NODES || record.nodes.reduce((count, node) => count + node.dependsOn.length, 0) > MAX_PROJECT_EDGES) throw bound();
  const rows = (await client.query<{ node_id: string; version: number; knowledge: GoalInput['knowledge'] | null }>(`SELECT i.node_id,i.version,i.input->'knowledge' AS knowledge
    FROM flow.goal_nodes n JOIN flow.goal_inputs i ON (i.goal_id,i.node_id,i.version)=(n.goal_id,n.node_id,n.input_version)
    WHERE n.goal_id=$1 AND n.node_id=ANY($2::text[]) LIMIT 201`, [goalId, record.nodes.map(node => node.id)])).rows;
  if (rows.length > GOAL_DELIVERY_MAX_NODES) throw bound();
  return { goalId, projectId: record.project_id, projectRevision: record.revision, nodes: record.nodes,
    inputs: new Map(rows.map(row => [row.node_id, { version: row.version, input: row.knowledge ? { knowledge: row.knowledge } : {} }])) };
}
export interface LiveExecution {
  id: string; node_id: string; task_id: string; input_version: number; dependencies: GoalArtifactBinding[];
  task: { id: string; status: TaskStatus; verification_status: VerificationStatus; latest_artifact_id: string | null; latest_artifact_version: string | null; updated_at: string; current_attempt_id: string | null; owner_version: number; decision_id: string | null };
  artifact_detail_id: string | null;
}
export interface LiveMetadata extends GoalValidityState { executions: Map<string, LiveExecution>; nodes: Map<string, { latest_execution_id: string | null; accepted_binding: GoalArtifactBinding | null }> }
export async function readLiveMetadata(client: PoolClient, plan: PlanMetadata): Promise<LiveMetadata> {
  const nodes = (await client.query<{ node_id: string; latest_execution_id: string | null; accepted_binding: GoalArtifactBinding | null }>(`SELECT node_id,latest_execution_id,accepted_binding
    FROM flow.goal_nodes WHERE goal_id=$1 AND node_id=ANY($2::text[]) LIMIT 201`, [plan.goalId, plan.nodes.map(node => node.id)])).rows;
  if (nodes.length > GOAL_DELIVERY_MAX_NODES) throw bound();
  const ids = [...new Set(nodes.flatMap(node => [node.latest_execution_id, node.accepted_binding?.executionId]).filter((id): id is string => Boolean(id)))];
  if (ids.length > GOAL_DELIVERY_MAX_NODES * 2) throw bound();
  const rows = ids.length ? (await client.query<LiveExecution>(`SELECT e.id,e.node_id,e.task_id,e.input_version,e.dependencies,
    json_build_object('id',t.id,'status',t.status,'verification_status',t.verification_status,'latest_artifact_id',t.latest_artifact_id,
    'latest_artifact_version',t.latest_artifact_version,'updated_at',t.updated_at,'current_attempt_id',t.current_attempt_id,'owner_version',t.owner_version,
    'decision_id',t.pending_decision->>'id') AS task,a.detail_id AS artifact_detail_id
    FROM flow.goal_executions e JOIN flow.tasks t ON t.id=e.task_id
    LEFT JOIN flow.artifacts a ON (a.task_id,a.artifact_id,a.version,a.attempt_id)=(t.id,t.latest_artifact_id,t.latest_artifact_version,t.current_attempt_id)
    WHERE e.goal_id=$1 AND e.id=ANY($2::text[]) LIMIT 401`, [plan.goalId, ids])).rows : [];
  if (rows.length > GOAL_DELIVERY_MAX_NODES * 2 || rows.some(row => row.dependencies.length >= GOAL_DELIVERY_MAX_NODES)) throw bound();
  return { progressions: await readProgressionProvenance(client, plan.goalId, ids), goal: { projectId: plan.projectId }, project: { graph: { nodes: plan.nodes } }, inputs: plan.inputs,
    knowledgeHeads: await loadGoalKnowledgeHeads(client, plan.projectId, [...plan.inputs.values()].map(def => def.input)),
    nodes: new Map(nodes.map(node => [node.node_id, node])), executions: new Map(rows.map(row => [row.id, row])) };
}
function bound() { return new HttpError(409, 'goal_delivery_bound', 'Goal metadata exceeds the supported read bound.'); }
