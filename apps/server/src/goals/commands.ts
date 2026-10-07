import { normalizeGoalInput } from '../goal-context/input.js';
import { knowledgeCurrent } from '../goal-context/freshness.js';
import { freezeGoalContext, bindGoalExecutionInput } from '../goal-context/store.js';
import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import type { PgBoss } from 'pg-boss';
import type { GoalArtifactBinding, GoalCommand, GoalCommandResult, GoalCreation, GoalExplanation } from '../../../../packages/contracts/src/goals.js';
import type { ExecutionProfileReference } from '../../../../packages/contracts/src/execution-profiles.js';
import { taskSubmissionSchema } from '../../../../packages/contracts/src/tasks.js';
import { canonical, HttpError } from '../database.js';
import { dependencyContent } from './dependency-content.js';
import { loadProject } from '../projects/storage.js';
import { acceptTask, command, loadTask } from '../tasks.js';
import { currentDeliveries, equalBindings, executionRows, explanationView, loadState, requireNode, sortBindings, type GoalState } from './state.js';

type Result = Omit<GoalCommandResult, 'replayed'>;
export async function createGoal(pool: Pool, input: GoalCreation, key: string) {
  const accepted = await command(pool, 'goal:create', key, input, async client => {
    await loadProject(client, input.projectId, true);
    if ((await client.query('SELECT 1 FROM flow.goals WHERE project_id=$1', [input.projectId])).rowCount) throw new HttpError(409, 'goal_exists', 'This project already has a goal.');
    const id = randomUUID(); const { projectId, ...original } = input;
    const saved = await client.query<{ created_at: Date }>('INSERT INTO flow.goals(id,project_id,original) VALUES($1,$2,$3) RETURNING created_at', [id, projectId, JSON.stringify(original)]);
    const state = await loadState(client, id);
    await explain(client, state, 'created', 'Original goal, constraints and acceptance were saved.', {});
    return { id, ...input, createdAt: saved.rows[0]!.created_at.toISOString() };
  });
  return { goal: accepted.value, replayed: accepted.replayed };
}
export async function changeGoal(pool: Pool, boss: PgBoss, goalId: string, input: GoalCommand, key: string): Promise<GoalCommandResult> {
  const accepted = await command(pool, `goal:command:${goalId}`, key, input, client => applyGoalCommand(client, boss, goalId, input));
  return { ...accepted.value, replayed: accepted.replayed };
}
/** Apply within the caller's transaction; authorization and command replay are caller-owned. */
export async function applyGoalCommand(client: PoolClient, boss: PgBoss, goalId: string, input: GoalCommand, authorizedState?: GoalState): Promise<Result> {
  const state = authorizedState ?? await loadState(client, goalId, true);
  requireNode(state, input.nodeId);
  if (input.kind === 'define-input') return defineInput(client, state, input);
  if (input.kind === 'execute') return executeGoalNode(client, boss, state, input, { harness: 'fixture', fixture: input.fixture });
  return acceptDelivery(client, state, input);
}

async function explain(client: PoolClient, state: GoalState, kind: GoalExplanation['kind'], text: string, source: Omit<GoalExplanation['source'], 'projectRevision'>): Promise<GoalExplanation> {
  const updated = await client.query<{ explanation_version: number }>('UPDATE flow.goals SET explanation_version=explanation_version+1 WHERE id=$1 RETURNING explanation_version', [state.goal.id]);
  const version = updated.rows[0]!.explanation_version;
  const provenance = { ...source, projectRevision: state.project.project.revision };
  const saved = await client.query<{ created_at: Date }>('INSERT INTO flow.goal_explanations(goal_id,version,kind,text,source) VALUES($1,$2,$3,$4,$5) RETURNING created_at', [state.goal.id, version, kind, text, JSON.stringify(provenance)]);
  return { version, kind, text, source: provenance, createdAt: saved.rows[0]!.created_at.toISOString() };
}
async function defineInput(client: PoolClient, state: GoalState, input: Extract<GoalCommand, { kind: 'define-input' }>): Promise<Result> {
  const current = state.inputs.get(input.nodeId);
  if ((current?.version ?? 0) !== input.expectedInputVersion) throw new HttpError(409, 'input_version', 'Refresh the actual input version before editing.');
  const actualInput = normalizeGoalInput(input.input);
  if (current && canonical(normalizeGoalInput(current.input)) === canonical(actualInput)) return {
    goalId: state.goal.id, nodeId: input.nodeId, inputVersion: current.version, changed: false, explanation: await inputExplanation(client, state.goal.id, input.nodeId, current.version),
  };
  const version = input.expectedInputVersion + 1;
  await client.query('INSERT INTO flow.goal_inputs(goal_id,node_id,version,input,project_revision) VALUES($1,$2,$3,$4,$5)', [state.goal.id, input.nodeId, version, JSON.stringify(actualInput), state.project.project.revision]);
  await freezeGoalContext(client, state.goal.projectId, state.goal.id, input.nodeId, version, actualInput);
  await client.query(`INSERT INTO flow.goal_nodes(goal_id,node_id,input_version) VALUES($1,$2,$3)
    ON CONFLICT(goal_id,node_id) DO UPDATE SET input_version=EXCLUDED.input_version`, [state.goal.id, input.nodeId, version]);
  const explanation = await explain(client, state, input.kind, `Actual input version ${version} was saved. ${input.reason}`, { nodeId: input.nodeId, inputVersion: version });
  return { goalId: state.goal.id, nodeId: input.nodeId, inputVersion: version, explanation, changed: true };
}
type ExecutionInput = Omit<Extract<GoalCommand, { kind: 'execute' }>, 'fixture'>;
type ExecutionTarget = { harness: 'fixture'; fixture: Extract<GoalCommand, { kind: 'execute' }>['fixture'] }
  | { harness: 'claude'; executionProfile: ExecutionProfileReference };
/** Caller owns authorization/transaction; both owner-native and fixture commands share exact input binding. */
export async function executeGoalNode(client: PoolClient, boss: PgBoss, state: GoalState, input: ExecutionInput, target: ExecutionTarget, progressionId?: string): Promise<Result> {
  requireNode(state, input.nodeId);
  const definition = state.inputs.get(input.nodeId);
  if (!definition || definition.version !== input.expectedInputVersion) throw new HttpError(409, 'input_version', 'Execution requires the current actual input version.');
  if (!knowledgeCurrent(definition.input, state.goal.projectId, state.knowledgeHeads)) throw new HttpError(409, 'goal_knowledge_obsolete', 'Selected knowledge has changed; redefine the input with current references.');
  const validity = currentDeliveries(state);
  const dependencies = progressionId ? validity.progressionDependencies(progressionId, input.nodeId) : validity.dependencies(input.nodeId);
  if (dependencies === null || !equalBindings(dependencies, input.dependencies)) throw new HttpError(409, 'dependency_version', 'Execution requires the exact current verified dependencies.');
  await requirePreviousStopped(client, state, input);
  const context = await dependencyContent(client, dependencies);
  const prompt = JSON.stringify({ goal: { originalGoal: state.goal.originalGoal, constraints: state.goal.constraints, acceptance: state.goal.acceptance }, input: definition.input, dependencies: context });
  if (prompt.length > 16_000) throw new HttpError(409, 'input_too_large', 'Actual inputs exceed the task prompt limit; no context was truncated.');
  const taskInput = taskSubmissionSchema.parse({ title: requireNode(state, input.nodeId).title, prompt, ...target, verification: definition.input.verification });
  const task = await acceptTask(client, boss, taskInput);
  if (definition.input.knowledge?.length) await bindGoalExecutionInput(client, task.id, state.goal.id, input.nodeId, definition.version, prompt);
  const id = randomUUID();
  await client.query('INSERT INTO flow.goal_executions(id,goal_id,node_id,task_id,input_version,dependencies,project_revision) VALUES($1,$2,$3,$4,$5,$6,$7)', [id, state.goal.id, input.nodeId, task.id, definition.version, JSON.stringify(sortBindings(dependencies)), state.project.project.revision]);
  await client.query('UPDATE flow.goal_nodes SET latest_execution_id=$3 WHERE goal_id=$1 AND node_id=$2', [state.goal.id, input.nodeId, id]);
  const explanation = await explain(client, state, input.kind, `Execution was authorized with input version ${definition.version} and ${dependencies.length} fixed dependencies. ${input.reason}`, { nodeId: input.nodeId, inputVersion: definition.version, executionId: id });
  return { goalId: state.goal.id, nodeId: input.nodeId, inputVersion: definition.version, executionId: id, task, explanation, changed: true };
}
async function requirePreviousStopped(client: PoolClient, state: GoalState, input: ExecutionInput) {
  const previous = state.nodes.get(input.nodeId)?.latest_execution_id ?? null;
  if (previous !== input.previousExecutionId) throw new HttpError(409, 'execution_version', 'A new execution must explicitly name its predecessor.');
  if (!previous) return;
  const execution = state.executions.get(previous)!;
  const task = await loadTask(client, execution.task_id, true);
  if (!['succeeded', 'failed', 'cancelled'].includes(task.status)) throw new HttpError(409, 'execution_unsettled', 'The previous execution is active or uncertain; reconcile it before authorizing another.');
}

async function acceptDelivery(client: PoolClient, state: GoalState, input: Extract<GoalCommand, { kind: 'accept-delivery' }>): Promise<Result> {
  const current = state.nodes.get(input.nodeId)?.accepted_binding ?? null;
  if ((current?.executionId ?? null) !== input.expectedCurrentExecutionId) throw new HttpError(409, 'delivery_version', 'Refresh the current accepted delivery before replacing it.');
  const execution = (await executionRows(client, state.goal.id, [input.executionId]))[0];
  if (!execution || execution.node_id !== input.nodeId) throw new HttpError(404, 'execution_not_found', 'Execution does not belong to this goal node.');
  if (!currentDeliveries(state).isCurrent(execution)) throw new HttpError(409, 'execution_obsolete', 'The execution uses obsolete actual inputs or dependencies.');
  const task = await loadTask(client, execution.task_id, true);
  if (task.status !== 'succeeded' || task.verification_status !== 'passed' || !task.latest_artifact_id || !task.latest_artifact_version) throw new HttpError(409, 'delivery_unverified', 'Only a succeeded task with a verified exact artifact can be accepted.');
  const artifact = (await client.query<{ detail_id: string }>('SELECT detail_id FROM flow.artifacts WHERE task_id=$1 AND artifact_id=$2 AND version=$3', [task.id, task.latest_artifact_id, task.latest_artifact_version])).rows[0];
  if (!artifact) throw new HttpError(409, 'delivery_artifact', 'Verified artifact is unavailable.');
  const binding: GoalArtifactBinding = { nodeId: input.nodeId, executionId: execution.id, taskId: task.id, artifactId: task.latest_artifact_id, artifactVersion: task.latest_artifact_version, detailId: artifact.detail_id };
  if (current && canonical(current) === canonical(binding)) return { goalId: state.goal.id, nodeId: input.nodeId, delivery: current, changed: false, explanation: await deliveryExplanation(client, state.goal.id, current) };
  const explanation = await explain(client, state, input.kind, `A verified delivery was accepted for actual input version ${execution.input_version}. ${input.reason}`, { nodeId: input.nodeId, inputVersion: execution.input_version, executionId: execution.id });
  await client.query('INSERT INTO flow.goal_acceptances(goal_id,explanation_version,binding) VALUES($1,$2,$3)', [state.goal.id, explanation.version, JSON.stringify(binding)]);
  await client.query('UPDATE flow.goal_nodes SET accepted_binding=$3 WHERE goal_id=$1 AND node_id=$2', [state.goal.id, input.nodeId, JSON.stringify(binding)]);
  return { goalId: state.goal.id, nodeId: input.nodeId, executionId: execution.id, delivery: binding, changed: true, explanation };
}

async function inputExplanation(client: PoolClient, goalId: string, nodeId: string, version: number): Promise<GoalExplanation> {
  const row = (await client.query<GoalExplanation & { created_at: Date }>(`SELECT * FROM flow.goal_explanations
    WHERE goal_id=$1 AND kind='define-input' AND source->>'nodeId'=$2 AND source->>'inputVersion'=$3 LIMIT 1`, [goalId, nodeId, String(version)])).rows[0];
  if (!row) throw new Error('Persisted input explanation is missing.');
  return explanationView(row);
}
async function deliveryExplanation(client: PoolClient, goalId: string, binding: GoalArtifactBinding): Promise<GoalExplanation> {
  const row = (await client.query<GoalExplanation & { created_at: Date }>(`SELECT e.* FROM flow.goal_acceptances a
    JOIN flow.goal_explanations e ON (e.goal_id,e.version)=(a.goal_id,a.explanation_version)
    WHERE a.goal_id=$1 AND a.binding->>'executionId'=$2 AND a.binding=$3::jsonb ORDER BY a.explanation_version DESC LIMIT 1`, [goalId, binding.executionId, JSON.stringify(binding)])).rows[0];
  if (!row) throw new Error('Persisted delivery explanation is missing.');
  return explanationView(row);
}
