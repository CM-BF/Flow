import { loadGoalKnowledgeHeads, knowledgeCurrent } from '../goal-context/freshness.js';
import { goalExecutionReferences } from '../goal-context/store.js';
import type { GoalExecutionContextReference } from '../../../../packages/contracts/src/goal-context.js';
import type { PoolClient } from 'pg';
import type { GoalArtifactBinding, GoalDefinition, GoalExecution, GoalExplanation, GoalInput, GoalSnapshot, GoalView } from '../../../../packages/contracts/src/goals.js';
import type { ProjectSnapshot } from '../../../../packages/contracts/src/projects.js';
import { canonical, HttpError } from '../database.js';
import { loadProject, readProject } from '../projects/storage.js';
import type { TaskRecord } from '../tasks.js';

interface GoalRow { id: string; project_id: string; original: Omit<GoalView, 'id' | 'projectId' | 'createdAt'>; created_at: Date }
interface InputRow { node_id: string; version: number; input: GoalInput; project_revision: number; created_at: Date }
interface NodeRow { node_id: string; input_version: number; latest_execution_id: string | null; accepted_binding: GoalArtifactBinding | null }
type ExecutionTask = Pick<TaskRecord, 'id' | 'status' | 'verification_status' | 'latest_artifact_id' | 'latest_artifact_version' | 'created_at' | 'updated_at'> & { title: string; harness: TaskRecord['submission']['harness'] };
export interface ExecutionRow {
  id: string; node_id: string; task_id: string; input_version: number; input: GoalInput;
  dependencies: GoalArtifactBinding[]; project_revision: number; created_at: Date; task: ExecutionTask; context?: GoalExecutionContextReference;
}
export interface GoalState {
  goal: GoalView; project: ProjectSnapshot; inputs: Map<string, GoalDefinition>;
  knowledgeHeads: Map<string, number>; nodes: Map<string, NodeRow>; executions: Map<string, ExecutionRow>;
}
export function definition(row: InputRow): GoalDefinition {
  return { nodeId: row.node_id, version: row.version, input: row.input, projectRevision: row.project_revision, createdAt: row.created_at.toISOString() };
}
export async function loadState(client: PoolClient, goalId: string, lock = false): Promise<GoalState> {
  const goal = (await client.query<GoalRow>('SELECT * FROM flow.goals WHERE id=$1', [goalId])).rows[0];
  if (!goal) throw new HttpError(404, 'goal_not_found', 'Goal not found.');
  await loadProject(client, goal.project_id, lock);
  const project = await readProject(client, goal.project_id);
  const nodes = (await client.query<NodeRow>('SELECT * FROM flow.goal_nodes WHERE goal_id=$1 AND node_id=ANY($2::text[])', [goalId, project.graph.nodes.map(node => node.id)])).rows;
  const inputs = (await client.query<InputRow>(`SELECT i.* FROM flow.goal_inputs i JOIN flow.goal_nodes n
    ON (i.goal_id,i.node_id,i.version)=(n.goal_id,n.node_id,n.input_version) WHERE i.goal_id=$1 AND i.node_id=ANY($2::text[])`, [goalId, project.graph.nodes.map(node => node.id)])).rows;
  const executionIds = nodes.flatMap(node => [node.latest_execution_id, node.accepted_binding?.executionId]).filter((id): id is string => Boolean(id));
  const executions = executionIds.length ? await executionRows(client, goalId, executionIds) : [];
  const knowledgeHeads = await loadGoalKnowledgeHeads(client, goal.project_id, inputs.map(row => row.input));
  return {
    knowledgeHeads, goal: { id: goal.id, projectId: goal.project_id, ...goal.original, createdAt: goal.created_at.toISOString() }, project,
    nodes: new Map(nodes.map(row => [row.node_id, row])), inputs: new Map(inputs.map(row => [row.node_id, definition(row)])),
    executions: new Map(executions.map(row => [row.id, row])),
  };
}
export async function executionRows(client: PoolClient, goalId: string, ids: string[]): Promise<ExecutionRow[]> {
  const rows = (await client.query<ExecutionRow>(`SELECT e.*, i.input, json_build_object('id',t.id,'title',t.submission->>'title','harness',t.submission->>'harness',
    'status',t.status,'verification_status',t.verification_status,'latest_artifact_id',t.latest_artifact_id,
    'latest_artifact_version',t.latest_artifact_version,'created_at',t.created_at,'updated_at',t.updated_at) AS task FROM flow.goal_executions e
    JOIN flow.goal_inputs i ON (i.goal_id,i.node_id,i.version)=(e.goal_id,e.node_id,e.input_version)
    JOIN flow.tasks t ON t.id=e.task_id WHERE e.goal_id=$1 AND e.id=ANY($2::text[])`, [goalId, ids])).rows;
  const contexts = await goalExecutionReferences(client, rows.filter(row => row.input.knowledge?.length).map(row => row.task_id));
  for (const row of rows) {
    row.context = contexts.get(row.task_id);
    // JSON timestamp fields need explicit Date conversion for the public summary.
    row.task.created_at = new Date(row.task.created_at); row.task.updated_at = new Date(row.task.updated_at);
  }
  return rows;
}
export function requireNode(state: GoalState, nodeId: string) {
  const node = state.project.graph.nodes.find(item => item.id === nodeId);
  if (!node) throw new HttpError(404, 'goal_node_not_found', 'The node is not in this goal project.');
  return node;
}
export function currentDeliveries(state: GoalState) {
  const memo = new Map<string, GoalArtifactBinding | null>();
  const visiting = new Set<string>();
  function current(nodeId: string): GoalArtifactBinding | null {
    if (memo.has(nodeId)) return memo.get(nodeId)!;
    if (visiting.has(nodeId)) return null;
    visiting.add(nodeId);
    const binding = state.nodes.get(nodeId)?.accepted_binding;
    const execution = binding ? state.executions.get(binding.executionId) : undefined;
    const task = execution?.task;
    const result = binding && execution && isCurrent(execution) && task?.status === 'succeeded' && task.verification_status === 'passed'
      && task.latest_artifact_id === binding.artifactId && task.latest_artifact_version === binding.artifactVersion ? binding : null;
    visiting.delete(nodeId); memo.set(nodeId, result); return result;
  }
  function dependencies(nodeId: string): GoalArtifactBinding[] | null {
    const node = state.project.graph.nodes.find(item => item.id === nodeId);
    if (!node) return null;
    const bindings = node.dependsOn.map(current);
    return bindings.every((binding): binding is GoalArtifactBinding => binding !== null) ? sortBindings(bindings) : null;
  }
  function isCurrent(execution: ExecutionRow): boolean {
    const definition = state.inputs.get(execution.node_id);
    const bindings = dependencies(execution.node_id);
    return definition?.version === execution.input_version && knowledgeCurrent(definition.input, state.goal.projectId, state.knowledgeHeads) && bindings !== null && equalBindings(bindings, execution.dependencies);
  }
  return { current, dependencies, isCurrent };
}
export function sortBindings(bindings: GoalArtifactBinding[]) { return [...bindings].sort((left, right) => left.nodeId.localeCompare(right.nodeId)); }
export function equalBindings(left: GoalArtifactBinding[], right: GoalArtifactBinding[]) { return canonical(sortBindings(left)) === canonical(sortBindings(right)); }
export function executionView(row: ExecutionRow, inputCurrent: boolean): GoalExecution {
  return { id: row.id, nodeId: row.node_id, task: { id: row.task.id, title: row.task.title, harness: row.task.harness, status: row.task.status, verificationStatus: row.task.verification_status, createdAt: row.task.created_at.toISOString(), updatedAt: row.task.updated_at.toISOString() }, inputVersion: row.input_version, input: row.input,
    dependencies: row.dependencies, projectRevision: row.project_revision, createdAt: row.created_at.toISOString(), inputCurrent, ...(row.context ? { context: row.context } : {}) };
}
export async function explanations(client: PoolClient, goalId: string): Promise<GoalExplanation[]> {
  const rows = (await client.query<GoalExplanation & { created_at: Date }>(
    'SELECT * FROM flow.goal_explanations WHERE goal_id=$1 ORDER BY version DESC LIMIT 50', [goalId])).rows;
  return rows.reverse().map(explanationView);
}
export async function snapshot(client: PoolClient, state: GoalState): Promise<GoalSnapshot> {
  const validity = currentDeliveries(state);
  return {
    goal: state.goal, projectRevision: state.project.project.revision, explanations: await explanations(client, state.goal.id),
    nodes: state.project.graph.nodes.map(node => {
      const stored = state.nodes.get(node.id); const fullDefinition = state.inputs.get(node.id);
      const definition = fullDefinition ? { nodeId: fullDefinition.nodeId, version: fullDefinition.version, projectRevision: fullDefinition.projectRevision, createdAt: fullDefinition.createdAt } : null;
      const execution = stored?.latest_execution_id ? state.executions.get(stored.latest_execution_id) : undefined;
      const accepted = stored?.accepted_binding ?? null; const deliveryCurrent = validity.current(node.id) !== null;
      const dependenciesReady = validity.dependencies(node.id) !== null;
      const knowledgeReady = fullDefinition ? knowledgeCurrent(fullDefinition.input, state.goal.projectId, state.knowledgeHeads) : true;
      return { nodeId: node.id, title: node.title, dependsOn: node.dependsOn, definition,
        ...(fullDefinition?.input.knowledge?.length ? { knowledgeCurrent: knowledgeReady, knowledgeReferenceCount: fullDefinition.input.knowledge.length } : {}),
        execution: execution ? executionSummary(execution, validity.isCurrent(execution)) : null, accepted, deliveryCurrent, dependenciesReady,
        reason: !definition ? 'Actual input has not been defined.' : !knowledgeReady ? 'Selected knowledge sources have newer versions; redefine this input before executing or accepting.' : !dependenciesReady ? 'A dependency needs a current verified delivery.'
          : deliveryCurrent ? 'The accepted delivery matches current inputs and dependencies.' : accepted ? 'The previous delivery needs rechecking against current inputs.' : 'No current delivery has been accepted.',
      };
    }),
  };
}

function executionSummary(row: ExecutionRow, inputCurrent: boolean) {
  const { input: _input, dependencies: _dependencies, ...metadata } = executionView(row, inputCurrent);
  return metadata;
}

export function explanationView(row: GoalExplanation & { created_at: Date }): GoalExplanation {
  return { version: row.version, kind: row.kind, text: row.text, source: row.source, createdAt: row.created_at.toISOString() };
}
