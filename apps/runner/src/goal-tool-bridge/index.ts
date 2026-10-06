import type { FlowClient } from '@flow/client';
import type { ClaimedTask } from '@flow/contracts';
import { goalToolScopeSchema, type GoalToolCapability } from '../../../../packages/contracts/src/goal-tool-runs.js';
import { GoalToolError } from '../goal-tools/index.js';

/** Only the host sees this client; the model receives schemas and bounded tool results. */
export async function bindGoalToolCapability(input: {
  client: FlowClient; assignment: ClaimedTask; signal: AbortSignal; assertOwnership(): Promise<void>;
}): Promise<GoalToolCapability> {
  const { client, assignment, signal, assertOwnership } = input;
  const reference = assignment.goalToolRun;
  if (!reference || assignment.task.harness !== 'claude' || !assignment.task.executionProfile) throw new Error('Native goal authority is missing.');
  const ownership = { attemptId: assignment.attempt.id, ownerVersion: assignment.attempt.ownerVersion };
  const requestSignal = () => AbortSignal.any([signal, AbortSignal.timeout(5000)]);
  await assertOwnership();
  const run = await client.goalToolGrant(ownership, requestSignal());
  await assertOwnership();
  if (run.id !== reference.id || run.version !== reference.version || run.taskId !== assignment.task.id || run.mode !== 'claude' || run.revokedAt !== null) throw new Error('Native goal authority does not match the assignment.');
  const scope = goalToolScopeSchema.parse(run.scope);
  const call = { ...ownership, grant: { id: run.id, version: run.version } };
  async function authorized<T>(goalId: string, operation: () => Promise<T>): Promise<T> {
    if (goalId !== run.goalId) throw new GoalToolError('scope_denied', 'This goal is outside the granted tool scope.');
    signal.throwIfAborted(); await assertOwnership();
    const result = await operation();
    signal.throwIfAborted(); await assertOwnership();
    return result;
  }
  return { goalId: run.goalId, allowedNodeIds: scope.allowedNodeIds, allowedCommands: scope.allowedCommands, port: {
    readGoal: goalId => authorized(goalId, () => client.goalToolSnapshot(call, requestSignal())),
    readGoalInput(goalId, nodeId, version) {
      if (!Number.isSafeInteger(version) || version! < 1) throw new GoalToolError('invalid_input', 'An explicit input version is required.');
      return authorized(goalId, () => client.goalToolInput({ ...call, nodeId, version: version! }, requestSignal()));
    },
    commandGoal: (goalId, command, key) => authorized(goalId, () => client.goalToolCommand({ ...call, command }, key, requestSignal())),
  } };
}
