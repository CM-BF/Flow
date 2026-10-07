import { z } from 'zod';
import { executionProfileReferenceSchema } from './execution-profiles.js';
import { goalArtifactBindingSchema } from './goals.js';
import { goalGraphProposalKeySchema, MAX_GRAPH_PROPOSAL_NODES, type GoalGraphProposalReceipt } from './goal-graph-proposals.js';
import { projectVersionSchema } from './projects.js';
import type { GoalContextReference } from './goal-context.js';
import type { GoalProgressionSnapshot } from './goal-progression.js';

export const GOAL_PLAN_CONFIRMATION_MAX_BYTES = 65_536;
export const goalPlanConfirmationSchema = z.strictObject({
  protocol: z.literal('flow.goal-plan-confirmation.v1'),
  proposalDigest: z.string().regex(/^[a-f0-9]{64}$/),
  expectedProjectRevision: projectVersionSchema,
  nodes: z.array(z.strictObject({
    key: goalGraphProposalKeySchema, executionProfile: executionProfileReferenceSchema,
    externalDependencies: z.array(goalArtifactBindingSchema).max(199),
  })).min(1).max(MAX_GRAPH_PROPOSAL_NODES),
  maxAdmissions: z.number().int().min(1).max(MAX_GRAPH_PROPOSAL_NODES),
  intermediatePolicy: z.literal('verified-artifact-within-this-authorization'),
  expiresAt: z.iso.datetime({ offset: true }),
  reason: z.string().trim().min(1).max(1_000),
}).superRefine((value, context) => {
  if (new Set(value.nodes.map(node => node.key)).size !== value.nodes.length) context.addIssue({ code: 'custom', message: 'Confirmation node keys must be unique.' });
  if (value.maxAdmissions > value.nodes.length) context.addIssue({ code: 'custom', message: 'Admission budget exceeds confirmed nodes.' });
  if (new TextEncoder().encode(JSON.stringify(value)).byteLength > GOAL_PLAN_CONFIRMATION_MAX_BYTES) context.addIssue({ code: 'custom', message: 'Confirmation exceeds byte bound.' });
});
export type GoalPlanConfirmation = z.infer<typeof goalPlanConfirmationSchema>;
export interface GoalPlanConfirmationReceipt {
  proposalId: string; proposalDigest: string; confirmationDigest: string;
  goalId: string; projectId: string; graph: GoalGraphProposalReceipt;
  inputs: { key: string; nodeId: string; inputVersion: number; context?: GoalContextReference }[];
  progressionId: string; authorizationDigest: string; confirmedAt: string;
}
export interface GoalPlanConfirmationResult {
  confirmation: GoalPlanConfirmationReceipt; progression: GoalProgressionSnapshot;
  alreadyConfirmed: boolean; replayed: boolean;
}
