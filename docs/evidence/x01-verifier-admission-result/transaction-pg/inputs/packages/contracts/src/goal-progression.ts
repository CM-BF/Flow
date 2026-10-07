import { z } from 'zod';
import { executionProfileReferenceSchema } from './execution-profiles.js';
import { goalArtifactBindingSchema, type GoalArtifactBinding } from './goals.js';
import { projectVersionSchema } from './projects.js';
import { idSchema, type TaskStatus, type VerificationStatus } from './tasks.js';

export const GOAL_PROGRESSION_MAX_NODES = 20;
export const GOAL_PROGRESSION_MAX_BYTES = 65_536;
export const goalProgressionAuthorizationSchema = z.strictObject({
  protocol: z.literal('flow.goal-progression.v1'),
  projectRevision: projectVersionSchema,
  nodes: z.array(z.strictObject({
    nodeId: idSchema, nodeVersion: projectVersionSchema, inputVersion: projectVersionSchema,
    previousExecutionId: idSchema.nullable(), executionProfile: executionProfileReferenceSchema,
    externalDependencies: z.array(goalArtifactBindingSchema).max(199),
  })).min(1).max(GOAL_PROGRESSION_MAX_NODES),
  maxAdmissions: z.number().int().min(1).max(GOAL_PROGRESSION_MAX_NODES),
  intermediatePolicy: z.literal('verified-artifact-within-this-authorization'),
  expiresAt: z.iso.datetime({ offset: true }),
  reason: z.string().trim().min(1).max(1_000),
}).superRefine((value, context) => {
  if (new Set(value.nodes.map(node => node.nodeId)).size !== value.nodes.length) context.addIssue({ code: 'custom', message: 'Node identities must be unique.' });
  if (value.maxAdmissions > value.nodes.length) context.addIssue({ code: 'custom', message: 'Admission budget exceeds selected nodes.' });
  if (new TextEncoder().encode(JSON.stringify(value)).byteLength > GOAL_PROGRESSION_MAX_BYTES) context.addIssue({ code: 'custom', message: 'Authorization exceeds byte bound.' });
});
export type GoalProgressionAuthorization = z.infer<typeof goalProgressionAuthorizationSchema>;
export const goalProgressionRevocationSchema = z.strictObject({ reason: z.string().trim().min(1).max(1_000) });
export type GoalProgressionRevocation = z.infer<typeof goalProgressionRevocationSchema>;

export interface GoalProgressionNode {
  nodeId: string; inputVersion: number; executionId: string | null;
  task: { id: string; status: TaskStatus; verificationStatus: VerificationStatus; decisionId: string | null } | null;
  artifact: GoalArtifactBinding | null;
}
export interface GoalProgressionCause { code: string; nodeId: string | null }
export interface GoalProgressionSnapshot {
  id: string; goalId: string; projectId: string; authorization: GoalProgressionAuthorization;
  authorizationDigest: string; createdAt: string; revokedAt: string | null;
  state: 'active' | 'blocked' | 'expired' | 'revoked' | 'finished';
  cause: GoalProgressionCause | null; admissions: number;
  /** Mechanical completion never implies the owner's semantic acceptance. */
  acceptance: 'separate-owner-decision'; nodes: GoalProgressionNode[];
}
export interface GoalProgressionResult { progression: GoalProgressionSnapshot; replayed: boolean }
