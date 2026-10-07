import { z } from 'zod';
import { idSchema } from './tasks.js';
import { projectVersionSchema, type GraphRunActor, type ProjectActor } from './projects.js';
import { goalInputSchema } from './goals.js';

export const MAX_GRAPH_PROPOSAL_BYTES = 65_536;
export const MAX_GRAPH_PROPOSAL_NODES = 16;
export const MAX_GRAPH_PROPOSAL_EDGES = 128;
export const goalGraphProposalKeySchema = z.string().regex(/^[A-Za-z][A-Za-z0-9_-]{0,47}$/);
const key = goalGraphProposalKeySchema;
export const GOAL_INPUT_PROPOSAL_PROTOCOL = 'flow.goal-input-proposal.v1';
export const goalInputProposalSchema = z.strictObject({
  protocol: z.literal(GOAL_INPUT_PROPOSAL_PROTOCOL),
  nodes: z.array(z.strictObject({ key, input: goalInputSchema })).min(1).max(MAX_GRAPH_PROPOSAL_NODES),
});
const digest = z.string().regex(/^[a-f0-9]{64}$/);
export const goalGraphReferenceSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('proposed'), key }),
  z.strictObject({ kind: z.literal('existing'), nodeId: idSchema, expectedVersion: projectVersionSchema }),
]);
export const goalGraphProposalInputSchema = z.strictObject({
  expectedProjectRevision: projectVersionSchema,
  reason: z.string().trim().min(1).max(4_000),
  additions: z.array(z.strictObject({
    key, title: z.string().trim().min(1).max(180),
    dependencies: z.array(goalGraphReferenceSchema).max(MAX_GRAPH_PROPOSAL_EDGES),
  })).min(1).max(MAX_GRAPH_PROPOSAL_NODES),
  inputProposal: goalInputProposalSchema.optional(),
}).superRefine((value, context) => {
  if (new Set(value.additions.map(node => node.key)).size !== value.additions.length) context.addIssue({ code: 'custom', message: 'Proposal keys must be unique.' });
  if (value.additions.reduce((sum, node) => sum + node.dependencies.length, 0) > MAX_GRAPH_PROPOSAL_EDGES) context.addIssue({ code: 'custom', message: 'The proposal has too many dependencies.' });
  if (value.inputProposal) {
    const keys = new Set(value.inputProposal.nodes.map(node => node.key));
    if (keys.size !== value.inputProposal.nodes.length || keys.size !== value.additions.length || value.additions.some(node => !keys.has(node.key))) {
      context.addIssue({ code: 'custom', message: 'Every proposed node requires exactly one complete actual input.' });
    }
  }
});
export type GoalGraphProposalInput = z.infer<typeof goalGraphProposalInputSchema>;
export const goalGraphProposalApplySchema = z.strictObject({ expectedProjectRevision: projectVersionSchema, proposalDigest: digest });
export type GoalGraphProposalApply = z.infer<typeof goalGraphProposalApplySchema>;
export const goalGraphProposalPageSchema = z.strictObject({ after: idSchema.optional(), limit: z.coerce.number().int().min(1).max(50).default(20) });
export interface GoalGraphProposalSummary {
  id: string; goalId: string; projectId: string; baseRevision: number; goalDigest: string; proposalDigest: string;
  source: { kind: 'owner-submission' } | GraphRunActor; createdAt: string; nodeCount: number; edgeCount: number;
  state: 'proposed' | 'applied'; appliedRevision: number | null;
}
export interface GoalGraphProposal extends GoalGraphProposalSummary { input: GoalGraphProposalInput }
export interface GoalGraphProposalCreated { proposal: GoalGraphProposal; replayed: boolean }
export interface GoalGraphProposalPage { proposals: GoalGraphProposalSummary[]; nextCursor: string | null }
export interface GoalGraphProposalReceipt {
  proposalId: string; goalId: string; projectId: string; proposalDigest: string;
  fromRevision: number; toRevision: number; nodeIds: Record<string, string>;
  actor: ProjectActor; appliedAt: string;
}
export interface GoalGraphProposalApplied { receipt: GoalGraphProposalReceipt; alreadyApplied: boolean; replayed: boolean }
