import type { FlowClient } from '@flow/client';
import { goalGraphScopeSchema, type GoalGraphCapability } from '../../../../packages/contracts/src/goal-graph-runs.js';
import { ownedCalls, assertNativeGrant, type HostAuthority } from '../goal-tool-bridge/authority.js';

/** The credential and fixed ownership remain in host closures, outside SDK tool arguments/results. */
export async function bindGraphToolCapability(input: HostAuthority & { client: FlowClient }): Promise<GoalGraphCapability> {
  const { client, assignment } = input;
  const reference = assignment.goalGraphRun;
  if (!reference || assignment.goalToolRun || assignment.task.harness !== 'claude' || !assignment.task.executionProfile) throw new Error('Native graph authority is missing.');
  const ownership = { attemptId: assignment.attempt.id, ownerVersion: assignment.attempt.ownerVersion };
  const invoke = ownedCalls(input);
  const run = await invoke(signal => client.goalGraphGrant(ownership, signal));
  assertNativeGrant(assignment, reference, run);
  const scope = goalGraphScopeSchema.parse(run.scope);
  const call = { ...ownership, grant: { id: run.id, version: run.version } };
  return { goalId: run.goalId, runId: run.id, scope, port: {
    readGraph: page => invoke(signal => client.goalGraphRead({ ...call, ...page, limit: page.limit ?? 20 }, signal)),
    readProposal: proposalId => invoke(signal => client.goalGraphDetail({ ...call, proposalId }, signal)),
    commandGraph: (command, key) => invoke(signal => client.goalGraphCommand({ ...call, command }, key, signal)),
  } };
}
