import { z } from 'zod';
import { idSchema, type TaskSummary } from './tasks.js';
import { executionProfileReferenceSchema } from './execution-profiles.js';
import { ownershipSchema } from './runner.js';
import { projectNodeReferenceSchema, projectVersionSchema } from './projects.js';
import { GOAL_INPUT_PROPOSAL_PROTOCOL, goalGraphProposalInputSchema, goalGraphProposalApplySchema, type GoalGraphProposalSummary, type GoalGraphProposalReceipt, type GoalGraphProposalInput } from './goal-graph-proposals.js';

export const goalGraphScopeSchema = z.strictObject({
  baseRevision: projectVersionSchema,
  allowedExistingNodes: z.array(projectNodeReferenceSchema).max(200).refine(nodes => new Set(nodes.map(node => node.nodeId)).size === nodes.length),
  maxProposals: z.number().int().min(1).max(2),
  maxApplications: z.number().int().min(0).max(1),
  maxNewNodes: z.number().int().min(1).max(16),
  maxNewEdges: z.number().int().min(0).max(128),
  // Absent legacy grants retain exactly their original graph-only authority and JSON.
  inputProposalProtocol: z.literal(GOAL_INPUT_PROPOSAL_PROTOCOL).optional(),
});
export type GoalGraphScope = z.infer<typeof goalGraphScopeSchema>;
export const goalGraphRunAdmissionSchema = z.strictObject({
  scope: goalGraphScopeSchema, prompt: z.string().trim().min(1).max(4_000),
  // Missing native profile remains representable so the center can reject it explicitly.
  execution: z.discriminatedUnion('harness', [z.strictObject({ harness: z.literal('fixture') }),
    z.strictObject({ harness: z.literal('claude'), executionProfile: executionProfileReferenceSchema.optional() })]),
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
export type GoalGraphCommand = z.infer<typeof goalGraphCommandSchema>;
export const goalGraphCommandCallSchema = goalGraphRunCallSchema.extend({ command: goalGraphCommandSchema });
export const goalGraphRevokeSchema = z.strictObject({ reason: z.string().trim().min(1).max(1_000) });
export const goalGraphAuditQuerySchema = z.strictObject({ after: z.coerce.number().int().min(0).default(0), limit: z.coerce.number().int().min(1).max(50).default(20) });
export type GoalGraphReadCall = z.infer<typeof goalGraphReadCallSchema>;
export type GoalGraphDetailCall = z.infer<typeof goalGraphDetailCallSchema>;
export type GoalGraphCommandCall = z.infer<typeof goalGraphCommandCallSchema>;
export interface GoalGraphRun {
  id: string; version: 1; goalId: string; projectId: string; goalDigest: string; taskId: string;
  scope: GoalGraphScope; mode: 'fixture' | 'claude'; usedCommands: number; usedProposals: number; usedApplications: number;
  createdAt: string; revokedAt: string | null; revocationReason: string | null;
}
export interface GoalGraphRunAccepted { run: GoalGraphRun; task: TaskSummary; replayed: boolean }
export const goalGraphRunListQuerySchema = z.strictObject({
  after: z.string().min(1).max(1_024).optional(),
  limit: z.coerce.number().int().min(1).max(20).default(10),
});
/** A live, body-free planning reference; task status is observed at this read, not a persisted result. */
export interface GoalGraphRunSummary {
  id: string; version: 1; goalId: string; projectId: string; goalDigest: string;
  baseRevision: number; mode: 'fixture' | 'claude'; task: TaskSummary;
  createdAt: string; revokedAt: string | null;
}
export interface GoalGraphRunPage {
  goalId: string; projectId: string; runs: GoalGraphRunSummary[]; nextCursor: string | null;
}
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

/** Host-only port: a fixed run is captured by closures; no token or arbitrary goal input reaches MCP. */
export interface GoalGraphToolPort {
  readGraph(page: { after?: string; limit?: number }): Promise<GoalGraphReadPage>;
  readProposal(proposalId: string): Promise<GoalGraphDetailResult>;
  commandGraph(command: GoalGraphCommand, key: string): Promise<GoalGraphCommandResult>;
}
export interface GoalGraphCapability { goalId: string; runId: string; scope: GoalGraphScope; port: GoalGraphToolPort }
