import type { PoolClient } from 'pg';
import type { GoalArtifactBinding } from '../../../../packages/contracts/src/goals.js';
import type { GoalDeliveryExecution, GoalDeliveryNodeState, GoalDeliveryState } from '../../../../packages/contracts/src/goal-delivery.js';
import { HttpError } from '../database.js';
import { knowledgeCurrent } from '../goal-context/freshness.js';
import { currentDeliveries } from '../goals/state.js';
import { readLiveMetadata, type LiveExecution, type PlanMetadata } from './metadata.js';
import { inputReference } from './plan.js';

export async function readState(client: PoolClient, plan: PlanMetadata, nodeIds: string[]): Promise<GoalDeliveryState> {
  const available = new Set(plan.nodes.map(node => node.id));
  if (nodeIds.some(id => !available.has(id))) throw new HttpError(404, 'goal_node_not_found', 'A requested node is outside this current goal plan.');
  const live = await readLiveMetadata(client, plan);
  const validity = currentDeliveries(live);
  const nodes = nodeIds.map(nodeId => {
    const definition = plan.inputs.get(nodeId);
    const stored = live.nodes.get(nodeId);
    const execution = stored?.latest_execution_id ? live.executions.get(stored.latest_execution_id) : undefined;
    const knowledgeReady = !definition || knowledgeCurrent(definition.input, plan.projectId, live.knowledgeHeads);
    const dependenciesReady = validity.dependencies(nodeId) !== null;
    const accepted = stored?.accepted_binding ?? null;
    const deliveryCurrent = validity.current(nodeId) !== null;
    const current = execution ? validity.isCurrent(execution) : false;
    const reason: GoalDeliveryNodeState['reason'] = !definition ? 'input-undefined' : !knowledgeReady ? 'knowledge-stale' : !dependenciesReady && !current ? 'dependencies-unavailable'
      : execution?.task.status === 'uncertain' ? 'execution-uncertain' : execution && !current ? 'execution-stale' : deliveryCurrent ? 'accepted-current' : accepted ? 'accepted-stale' : 'not-accepted';
    return { nodeId, inputRef: inputReference(plan, nodeId), knowledgeCurrent: knowledgeReady, dependenciesReady,
      execution: execution ? executionView(plan, execution, current) : null, accepted, deliveryCurrent, reason };
  });
  return { view: 'state', goalId: plan.goalId, projectId: plan.projectId, observedAt: new Date().toISOString(), nodes };
}
function executionView(plan: PlanMetadata, execution: LiveExecution, inputCurrent: boolean): GoalDeliveryExecution {
  const task = execution.task;
  const artifact: GoalArtifactBinding | null = task.latest_artifact_id && task.latest_artifact_version && execution.artifact_detail_id
    ? { nodeId: execution.node_id, executionId: execution.id, taskId: task.id, artifactId: task.latest_artifact_id, artifactVersion: task.latest_artifact_version, detailId: execution.artifact_detail_id } : null;
  return { id: execution.id, inputRef: inputReference(plan, execution.node_id, execution.input_version)!, inputCurrent, dependencyCount: execution.dependencies.length,
    task: { id: task.id, status: task.status, verificationStatus: task.verification_status, updatedAt: new Date(task.updated_at).toISOString(), attemptId: task.current_attempt_id, ownerVersion: task.owner_version },
    pendingDecision: task.decision_id ? { goalId: plan.goalId, nodeId: execution.node_id, taskId: task.id, decisionId: task.decision_id } : null, artifact };
}
