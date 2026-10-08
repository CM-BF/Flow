import type { Pool, PoolClient } from 'pg';
import type { PgBoss } from 'pg-boss';
import { goalGraphProposalInputSchema } from '../../../../packages/contracts/src/goal-graph-proposals.js';
import { goalProgressionAuthorizationSchema } from '../../../../packages/contracts/src/goal-progression.js';
import type { GoalPlanConfirmation, GoalPlanConfirmationReceipt, GoalPlanConfirmationResult } from '../../../../packages/contracts/src/goal-plan-confirmation.js';
import { canonical, HttpError, sha256, transaction } from '../database.js';
import { applyProposalInTransaction, goalContext, readProposalInTransaction } from '../goal-graph-proposals/store.js';
import { applyGoalCommand } from '../goals/commands.js';
import { loadState, requireNode } from '../goals/state.js';
import { authorizeProgressionInTransaction, progressionRow, progressionSnapshot } from '../goal-progression/store.js';
import { commandInTransaction } from '../tasks.js';

interface ConfirmationRow { confirmation_digest: string; receipt: GoalPlanConfirmationReceipt; progression_id: string }
type Confirmed = Omit<GoalPlanConfirmationResult, 'replayed'>;

/** Owner authentication belongs to the route; this module composes existing authorities in one transaction. */
export async function confirmGoalPlan(pool: Pool, boss: PgBoss, proposalId: string, input: GoalPlanConfirmation, key: string): Promise<GoalPlanConfirmationResult> {
  return transaction(pool, async client => {
    const found = await readProposalInTransaction(client, proposalId);
    await goalContext(client, found.goal_id, true);
    await client.query('SELECT id FROM flow.goal_graph_proposals WHERE id=$1 FOR UPDATE', [proposalId]);
    const proposal = await readProposalInTransaction(client, proposalId);
    if (proposal.proposal_digest !== input.proposalDigest) throw new HttpError(409, 'proposal_mismatch', 'Confirm the exact saved proposal digest.');
    const result = await commandInTransaction(client, `goal:plan-confirmation:${proposalId}`, key, input,
      () => confirmInTransaction(client, boss, proposal, input));
    return { ...result.value, replayed: result.replayed };
  });
}
async function confirmInTransaction(client: PoolClient, boss: PgBoss, proposal: Awaited<ReturnType<typeof readProposalInTransaction>>, input: GoalPlanConfirmation): Promise<Confirmed> {
  const digest = sha256(canonical(input));
  const existing = (await client.query<ConfirmationRow>('SELECT confirmation_digest,receipt,progression_id FROM flow.goal_plan_confirmations WHERE proposal_id=$1', [proposal.id])).rows[0];
  if (existing) {
    if (existing.confirmation_digest !== digest) throw new HttpError(409, 'plan_already_confirmed', 'This proposal was confirmed with different execution authority.');
    const row = await progressionRow(client, proposal.goal_id, existing.progression_id);
    return { confirmation: existing.receipt, progression: progressionSnapshot(row, await loadState(client, proposal.goal_id, false, row.id)), alreadyConfirmed: true };
  }
  const parsed = goalGraphProposalInputSchema.safeParse(proposal.input);
  if (!parsed.success || !parsed.data.inputProposal) throw new HttpError(409, 'complete_inputs_required', 'The saved proposal must contain complete actual inputs.');
  const actualInputs = parsed.data.inputProposal.nodes;
  const keys = new Set(input.nodes.map(node => node.key));
  if (keys.size !== actualInputs.length || actualInputs.some(node => !keys.has(node.key))) throw new HttpError(409, 'confirmation_nodes', 'Confirm exactly the saved proposal node keys.');
  const context = await goalContext(client, proposal.goal_id);
  if (context.project.revision !== input.expectedProjectRevision) throw new HttpError(409, 'stale_project_revision', 'Refresh the graph before confirming inputs.');
  if (context.project.revision !== (proposal.applied_revision ?? proposal.base_revision)) throw new HttpError(409, 'proposal_graph_changed', 'The proposal graph changed; no silent rebase is allowed.');
  const encoding = (await client.query<{ bytes: number }>('SELECT octet_length($1::jsonb::text) AS bytes', [JSON.stringify(input)])).rows[0]!;
  if (encoding.bytes > 65_536) throw new HttpError(400, 'confirmation_size', 'Stored confirmation exceeds its byte bound.');

  const { receipt: graph } = await applyProposalInTransaction(client, proposal.id, { expectedProjectRevision: proposal.base_revision, proposalDigest: proposal.proposal_digest });
  for (const selection of actualInputs) {
    const nodeId = graph.nodeIds[selection.key];
    if (!nodeId) throw new HttpError(409, 'proposal_node_mapping', 'Saved graph mapping is incomplete.');
    await applyGoalCommand(client, boss, proposal.goal_id, { kind: 'define-input', nodeId, expectedInputVersion: 0, input: selection.input, reason: input.reason });
  }
  const state = await loadState(client, proposal.goal_id);
  const authorization = goalProgressionAuthorizationSchema.safeParse({
    protocol: 'flow.goal-progression.v1', projectRevision: state.project.project.revision,
    nodes: input.nodes.map(selection => {
      const nodeId = graph.nodeIds[selection.key]!, node = requireNode(state, nodeId), definition = state.inputs.get(nodeId)!;
      return { nodeId, nodeVersion: node.version, inputVersion: definition.version, previousExecutionId: null,
        executionProfile: selection.executionProfile, externalDependencies: selection.externalDependencies };
    }),
    maxAdmissions: input.maxAdmissions, intermediatePolicy: input.intermediatePolicy, expiresAt: input.expiresAt, reason: input.reason,
  });
  if (!authorization.success) throw new HttpError(409, 'confirmation_authorization_bound', 'The complete derived authorization exceeds its bounded contract.');
  const progression = await authorizeProgressionInTransaction(client, proposal.goal_id, authorization.data);
  const now = (await client.query<{ now: Date }>('SELECT clock_timestamp() AS now')).rows[0]!.now;
  const confirmation: GoalPlanConfirmationReceipt = {
    proposalId: proposal.id, proposalDigest: proposal.proposal_digest, confirmationDigest: digest,
    goalId: proposal.goal_id, projectId: proposal.project_id, graph,
    inputs: actualInputs.map(selection => ({ key: selection.key, nodeId: graph.nodeIds[selection.key]!, inputVersion: state.inputs.get(graph.nodeIds[selection.key]!)!.version })),
    progressionId: progression.id, authorizationDigest: progression.authorizationDigest, confirmedAt: now.toISOString(),
  };
  await client.query(`INSERT INTO flow.goal_plan_confirmations(proposal_id,goal_id,project_id,progression_id,confirmation,confirmation_digest,receipt,confirmed_at)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8)`, [proposal.id, proposal.goal_id, proposal.project_id, progression.id, JSON.stringify(input), digest, JSON.stringify(confirmation), now]);
  return { confirmation, progression, alreadyConfirmed: false };
}
