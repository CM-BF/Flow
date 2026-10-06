import { z } from 'zod';
import { idSchema, verificationRuleSchema, type TaskSummary } from './tasks.js';
import { goalKnowledgeSelectionSchema, type GoalContextReference, type GoalExecutionContextReference } from './goal-context.js';
import { projectVersionSchema } from './projects.js';

const goalText = z.string().min(1).max(4_000).refine(value => value.trim().length > 0);
const constraints = z.string().max(2_000);
const acceptance = z.string().min(1).max(1_000).refine(value => value.trim().length > 0);
export const goalCreationSchema = z.strictObject({
  projectId: idSchema, originalGoal: goalText, constraints, acceptance,
});
export type GoalCreation = z.infer<typeof goalCreationSchema>;
export const goalInputSchema = z.strictObject({
  goal: goalText, constraints, acceptance, verification: verificationRuleSchema, knowledge: goalKnowledgeSelectionSchema.optional(),
});
export type GoalInput = z.infer<typeof goalInputSchema>;
export const goalArtifactBindingSchema = z.strictObject({
  nodeId: idSchema, executionId: idSchema, taskId: idSchema,
  artifactId: idSchema, artifactVersion: z.string().regex(/^[a-f0-9]{64}$/), detailId: idSchema,
});
export type GoalArtifactBinding = z.infer<typeof goalArtifactBindingSchema>;
export const goalCommandSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('define-input'), nodeId: idSchema,
    expectedInputVersion: z.number().int().min(0).max(2_147_483_646), input: goalInputSchema,
    reason: z.string().trim().min(1).max(1_000),
  }),
  z.strictObject({
    kind: z.literal('execute'), nodeId: idSchema, expectedInputVersion: projectVersionSchema,
    dependencies: z.array(goalArtifactBindingSchema).max(199),
    previousExecutionId: idSchema.nullable(), reason: z.string().trim().min(1).max(1_000),
    fixture: z.strictObject({
      scenario: z.enum(['success', 'decision', 'failure', 'verification-failure', 'slow', 'large']),
      delayMs: z.number().int().min(0).max(30_000).optional(),
    }),
  }),
  z.strictObject({
    kind: z.literal('accept-delivery'), nodeId: idSchema, executionId: idSchema,
    expectedCurrentExecutionId: idSchema.nullable(), reason: z.string().trim().min(1).max(1_000),
  }),
]);
export type GoalCommand = z.infer<typeof goalCommandSchema>;
export interface GoalView extends GoalCreation { id: string; createdAt: string }
export interface GoalDefinition {
  nodeId: string; version: number; input: GoalInput; context?: GoalContextReference; projectRevision: number; createdAt: string;
}
export interface GoalExecution {
  id: string; nodeId: string; task: TaskSummary; inputVersion: number; input: GoalInput;
  dependencies: GoalArtifactBinding[]; projectRevision: number; createdAt: string;
  inputCurrent: boolean;
  context?: GoalExecutionContextReference;
}
export interface GoalExplanation {
  version: number; kind: GoalCommand['kind'] | 'created'; text: string; createdAt: string;
  source: { projectRevision: number; nodeId?: string; inputVersion?: number; executionId?: string };
}
export interface GoalNodeView {
  nodeId: string; title: string; dependsOn: string[]; definition: Omit<GoalDefinition, 'input'> | null;
  execution: Omit<GoalExecution, 'input' | 'dependencies'> | null; accepted: GoalArtifactBinding | null;
  deliveryCurrent: boolean; dependenciesReady: boolean; reason: string;
  /** Absent on older centers; exact refs stay out of the whole-goal snapshot. */
  knowledgeCurrent?: boolean; knowledgeReferenceCount?: number;
}
export interface GoalSnapshot {
  goal: GoalView; projectRevision: number; nodes: GoalNodeView[]; explanations: GoalExplanation[];
}
export interface GoalCommandResult {
  goalId: string; nodeId: string | null; inputVersion?: number;
  executionId?: string; task?: TaskSummary; delivery?: GoalArtifactBinding;
  explanation: GoalExplanation; changed: boolean; replayed: boolean;
}
export interface GoalExecutionPage { executions: GoalExecution[]; nextCursor: string | null }
export interface CreatedGoal { goal: GoalView; replayed: boolean }

/** Trusted host binds credentials and goal scope; model arguments cannot widen it. */
export interface GoalToolPort {
  readGoal(goalId: string): Promise<GoalSnapshot>;
  readGoalInput(goalId: string, nodeId: string, version?: number): Promise<GoalDefinition>;
  commandGoal(goalId: string, command: GoalCommand, idempotencyKey: string): Promise<GoalCommandResult>;
}

export const goalInputQuerySchema = z.strictObject({ version: z.coerce.number().int().min(1).max(2_147_483_647).optional() });
export const goalHistoryQuerySchema = z.strictObject({ nodeId: idSchema, after: idSchema.optional(), limit: z.coerce.number().int().min(1).max(100).default(20) });
export const goalToolReadSchema = z.strictObject({ nodeId: idSchema.optional(), version: projectVersionSchema.optional() });
export const goalToolCommandSchema = z.strictObject({ command: goalCommandSchema, idempotencyKey: z.string().min(1).max(200) });
