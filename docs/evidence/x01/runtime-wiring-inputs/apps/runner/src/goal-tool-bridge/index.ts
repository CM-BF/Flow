import { ownedCalls, assertNativeGrant } from './authority.js';
import type { FlowClient } from '@flow/client';
import type { ClaimedTask } from '@flow/contracts';
import { goalToolScopeSchema, type GoalToolCapability } from '../../../../packages/contracts/src/goal-tool-runs.js';
import { GoalToolError } from '../goal-tools/index.js';

/** Only the host sees this client; the model receives schemas and bounded tool results. */
export async function bindGoalToolCapability(input: {
  client: FlowClient; assignment: ClaimedTask; signal: AbortSignal; assertOwnership(): Promise<void>;
}): Promise<GoalToolCapability> {
  const { client, assignment } = input;
  const reference = assignment.goalToolRun;
  if (!reference || assignment.task.harness !== 'claude' || !assignment.task.executionProfile) throw new Error('Native goal authority is missing.');
  const ownership = { attemptId: assignment.attempt.id, ownerVersion: assignment.attempt.ownerVersion };
  const invoke = ownedCalls(input);
  const run = await invoke(signal => client.goalToolGrant(ownership, signal));
  assertNativeGrant(assignment, reference, run);
  const scope = goalToolScopeSchema.parse(run.scope);
  const call = { ...ownership, grant: { id: run.id, version: run.version } };
  async function authorized<T>(goalId: string, operation: (signal: AbortSignal) => Promise<T>): Promise<T> {
    if (goalId !== run.goalId) throw new GoalToolError('scope_denied', 'This goal is outside the granted tool scope.');
    return invoke(operation);
  }
  return { goalId: run.goalId, allowedNodeIds: scope.allowedNodeIds, allowedCommands: scope.allowedCommands, port: {
    readGoal: goalId => authorized(goalId, signal => client.goalToolSnapshot(call, signal)),
    readGoalInput(goalId, nodeId, version) {
      if (!Number.isSafeInteger(version) || version! < 1) throw new GoalToolError('invalid_input', 'An explicit input version is required.');
      return authorized(goalId, signal => client.goalToolInput({ ...call, nodeId, version: version! }, signal));
    },
    commandGoal: (goalId, command, key) => authorized(goalId, signal => client.goalToolCommand({ ...call, command }, key, signal)),
  } };
}
