import { z } from 'zod';
import { idSchema, type TaskSummary } from './tasks.js';
import { ownershipSchema } from './runner.js';
import { executionProfileReferenceSchema } from './execution-profiles.js';
import { goalCommandSchema, type GoalCommandResult, type GoalDefinition, type GoalSnapshot, type GoalToolPort } from './goals.js';

const commandKind = z.enum(['define-input', 'execute', 'accept-delivery']);
export const goalToolScopeSchema = z.strictObject({
  readScope: z.literal('whole-goal'),
  allowedNodeIds: z.array(idSchema).min(1).max(200).refine(values => new Set(values).size === values.length),
  allowedCommands: z.array(commandKind).max(3).refine(values => new Set(values).size === values.length),
  maxCommands: z.number().int().min(1).max(32),
});
export type GoalToolScope = z.infer<typeof goalToolScopeSchema>;
export const goalToolRunAdmissionSchema = z.strictObject({
  scope: goalToolScopeSchema, prompt: z.string().trim().min(1).max(4_000),
  execution: z.discriminatedUnion('harness', [
    z.strictObject({ harness: z.literal('fixture') }),
    // Represent the requested native mode without accepting a readonly profile as authorization.
    z.strictObject({ harness: z.literal('claude'), executionProfile: executionProfileReferenceSchema }),
  ]),
});
export type GoalToolRunAdmission = z.infer<typeof goalToolRunAdmissionSchema>;
export const goalToolRunReferenceSchema = z.strictObject({ id: idSchema, version: z.literal(1) });
export type GoalToolRunReference = z.infer<typeof goalToolRunReferenceSchema>;
export const goalToolRunCallSchema = ownershipSchema.extend({ grant: goalToolRunReferenceSchema });
export const goalToolInputCallSchema = goalToolRunCallSchema.extend({ nodeId: idSchema, version: z.number().int().min(1).max(2_147_483_647) });
export const goalToolCommandCallSchema = goalToolRunCallSchema.extend({ command: goalCommandSchema });
export type GoalToolInputCall = z.infer<typeof goalToolInputCallSchema>;
export type GoalToolCommandCall = z.infer<typeof goalToolCommandCallSchema>;
export const goalToolRevokeSchema = z.strictObject({ reason: z.string().trim().min(1).max(1_000) });
export const goalToolAuditQuerySchema = z.strictObject({ after: z.coerce.number().int().min(0).default(0), limit: z.coerce.number().int().min(1).max(50).default(20) });
export interface GoalToolRun {
  id: string; version: 1; goalId: string; taskId: string; scope: GoalToolScope;
  mode: 'fixture' | 'claude'; usedCommands: number; createdAt: string;
  revokedAt: string | null; revocationReason: string | null;
}
export interface GoalToolRunAccepted { run: GoalToolRun; task: TaskSummary; replayed: boolean }
export interface GoalToolAudit {
  sequence: number; attemptId: string; ownerVersion: number;
  key: string; digest: string; kind: z.infer<typeof commandKind>; nodeId: string; createdAt: string;
  result: { inputVersion?: number; executionId?: string; taskId?: string; explanationVersion: number; changed: boolean };
}
export interface GoalToolAuditPage { run: GoalToolRun; calls: GoalToolAudit[]; nextCursor: number | null }
export interface GoalToolRunRevoked { run: GoalToolRun; changed: boolean; replayed: boolean }
/** Responses reuse O01 domain types. Authorization is always checked at the runner HTTP seam. */
export type GoalToolSnapshotResult = GoalSnapshot;
export type GoalToolInputResult = GoalDefinition;
export type GoalToolCommandResult = GoalCommandResult;

/** Host-only capability: methods close over runner authority; never serialized into SDK prompts. */
export interface GoalToolCapability {
  goalId: string; allowedNodeIds: readonly string[];
  allowedCommands: readonly GoalToolScope['allowedCommands'][number][]; port: GoalToolPort;
}
