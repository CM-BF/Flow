import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { goalGraphProposalInputSchema } from '../../packages/contracts/src/goal-graph-proposals.ts';
import { goalPlanConfirmationSchema } from '../../packages/contracts/src/goal-plan-confirmation.ts';

/** Validate shape, provenance and finite permissions only. This never judges semantic adequacy. */
export function orderedProposal(proposal, state) {
  assert(proposal.goalId === state.goalId && proposal.projectId === state.projectId && proposal.state === 'proposed'
    && proposal.source.kind === 'goal-graph-run' && proposal.source.runId === state.admitted.runId
    && proposal.source.taskId === state.admitted.taskId && proposal.source.runnerId === state.runners.plan.profile.reference.runnerId);
  const input = goalGraphProposalInputSchema.parse(proposal.input);
  assert(input.additions.length === 2 && input.inputProposal?.nodes.length === 2);
  const first = input.additions.find(n => n.dependencies.length === 0), second = input.additions.find(n => n.dependencies.length === 1);
  assert(first && second && second.dependencies[0].kind === 'proposed' && second.dependencies[0].key === first.key);
  for (const node of input.inputProposal.nodes) assert(isDeepStrictEqual(node.input.knowledge, [state.citation]), 'Every input must name the exact fixed material citation.');
  return [first.key, second.key];
}
export function confirmationDraft(proposal, state) {
  const keys = orderedProposal(proposal, state);
  return { protocol: 'flow.goal-plan-confirmation.v1', proposalDigest: proposal.proposalDigest, expectedProjectRevision: proposal.baseRevision,
    nodes: keys.map(key => ({ key, executionProfile: state.runners.children.profile.reference, externalDependencies: [] })), maxAdmissions: 2,
    intermediatePolicy: 'verified-artifact-within-this-authorization', expiresAt: new Date(Date.now() + 3600000).toISOString(),
    reason: 'REPLACE AFTER reviewing actual inputs and the separate child budget. This draft is not owner consent.' };
}
export function validateConfirmation(input, proposal, state) {
  const value = goalPlanConfirmationSchema.parse(input), keys = orderedProposal(proposal, state);
  assert(value.proposalDigest === proposal.proposalDigest && value.expectedProjectRevision === proposal.baseRevision && value.maxAdmissions === 2
    && value.nodes.length === 2 && isDeepStrictEqual(value.nodes.map(n => n.key), keys)
    && value.nodes.every(n => isDeepStrictEqual(n.executionProfile, state.runners.children.profile.reference) && n.externalDependencies.length === 0)
    && !value.reason.startsWith('REPLACE AFTER') && Date.parse(value.expiresAt) > Date.now() && Date.parse(value.expiresAt) <= Date.now() + 86400000);
  return value;
}
export function expectedChildren(confirmed, body, state) {
  assert(confirmed.goalId === state.goalId && confirmed.projectId === state.projectId && confirmed.inputs.length === 2);
  return { goalId: state.goalId, projectId: state.projectId, progressionId: confirmed.progressionId, authorizationDigest: confirmed.authorizationDigest,
    nodes: body.nodes.map(node => { const input = confirmed.inputs.find(i => i.key === node.key); assert(input && input.nodeId === confirmed.graph.nodeIds[node.key]);
      return { nodeId: input.nodeId, inputVersion: input.inputVersion, executionProfile: node.executionProfile }; }) };
}
