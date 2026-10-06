import { z } from 'zod';
import { idSchema, type TaskSummary } from './tasks.js';
import { ownershipSchema } from './runner.js';
import { projectNodeReferenceSchema, projectVersionSchema } from './projects.js';
import { goalGraphProposalInputSchema, goalGraphProposalApplySchema, type GoalGraphProposalSummary, type GoalGraphProposalReceipt, type GoalGraphProposalInput } from './goal-graph-proposals.js';

export const goalGraphScopeSchema = z.strictObject({
  baseRevision: projectVersionSchema,
  allowedExistingNodes: z.array(projectNodeReferenceSchema).max(200).refine(nodes => new Set(nodes.map(node => node.nodeId)).size === nodes.length),
  maxProposals: z.number().int().min(1).max(2),
  maxApplications: z.number().int().min(0).max(1),
  maxNewNodes: z.number().int().min(1).max(16),
  maxNewEdges: z.number().int().min(0).max(128),
});
export type GoalGraphScope = z.infer<typeof goalGraphScopeSchema>;
export const goalGraphRunAdmissionSchema = z.strictObject({
  scope: goalGraphScopeSchema, prompt: z.string().trim().min(1).max(4_000),
  // Native intent is representable, but the center rejects it until its dedicated bridge exists.
  execution: z.strictObject({ harness: z.enum(['fixture', 'claude']) }),
});
export type GoalGraphRunAdmission = z.infer<typeof goalGraphRunAdmissionSchema>;
export const goalGraphRunReferenceSchema = z.strictObject({ id: idSchema, version: z.literal(1) });
export type GoalGraphRunReference = z.infer<typeof goalGraphRunReferenceSchema>;
export const goalGraphRunCallSchema = ownershipSchema.extend({ grant: goalGraphRunReferenceSchema });
export const goalGraphReadCallSchema = goalGraphRunCallSchema.extend({ after: z.string().min(1).max(2_000).optional(), limit: z.number().int().min(1).max(50).default(20) });
export const goalGraphDetailCallSchema = goalGraphRunCallSchema.extend({ proposalId: idSchema });
export const goalGraphCommandSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('propose'), proposal: goalGraphProposalInputSchema }),
  z.strictObject({ kind: z.literal('apply'), proposalId: idSchema, ...goalGraphProposalApplySchema.shape }),
]);
export const goalGraphCommandCallSchema = goalGraphRunCallSchema.extend({ command: goalGraphCommandSchema });
export const goalGraphRevokeSchema = z.strictObject({ reason: z.string().trim().min(1).max(1_000) });
export const goalGraphAuditQuerySchema = z.strictObject({ after: z.coerce.number().int().min(0).default(0), limit: z.coerce.number().int().min(1).max(50).default(20) });
export type GoalGraphReadCall = z.infer<typeof goalGraphReadCallSchema>;
export type GoalGraphDetailCall = z.infer<typeof goalGraphDetailCallSchema>;
export type GoalGraphCommandCall = z.infer<typeof goalGraphCommandCallSchema>;
export interface GoalGraphRun {
  id: string; version: 1; goalId: string; projectId: string; goalDigest: string; taskId: string;
  scope: GoalGraphScope; mode: 'fixture'; usedCommands: number; usedProposals: number; usedApplications: number;
  createdAt: string; revokedAt: string | null; revocationReason: string | null;
}
export interface GoalGraphRunAccepted { run: GoalGraphRun; task: TaskSummary; replayed: boolean }
export interface GoalGraphRunRevoked { run: GoalGraphRun; changed: boolean; replayed: boolean }
/** Nodes always come from the immutable base revision, including after a successful apply. */
export interface GoalGraphReadPage {
  goalId: string; projectId: string; baseRevision: number; currentRevision: number; stale: boolean;
  nodes: { id: string; title: string; version: number }[]; nextCursor: string | null;
}
export type GoalGraphCommandResult =
  | { kind: 'propose'; proposal: GoalGraphProposalSummary; replayed: boolean }
  | { kind: 'apply'; receipt: GoalGraphProposalReceipt; alreadyApplied: boolean; replayed: boolean };
export interface GoalGraphAudit {
  sequence: number; runnerId: string; attemptId: string; ownerVersion: number; key: string; digest: string;
  kind: 'propose' | 'apply'; proposalId: string; proposalDigest: string; appliedRevision: number | null; createdAt: string;
}
export interface GoalGraphAuditPage { run: GoalGraphRun; calls: GoalGraphAudit[]; nextCursor: number | null }

/** Full immutable proposal text is fetched separately, after checking this grant owns it. */
export interface GoalGraphDetailResult { id: string; proposalDigest: string; baseRevision: number; input: GoalGraphProposalInput }
