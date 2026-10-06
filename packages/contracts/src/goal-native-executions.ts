import { z } from 'zod';
import { executionProfileReferenceSchema, type ExecutionProfileReference } from './execution-profiles.js';
import { goalArtifactBindingSchema, type GoalCommandResult } from './goals.js';
import { projectVersionSchema } from './projects.js';
import { idSchema } from './tasks.js';

/** Owner-only admission; deliberately separate from fixture-only GoalCommand/GoalToolPort. */
export const goalNativeExecutionSchema = z.strictObject({
  nodeId: idSchema,
  expectedInputVersion: projectVersionSchema,
  dependencies: z.array(goalArtifactBindingSchema).max(199),
  previousExecutionId: idSchema.nullable(),
  reason: z.string().trim().min(1).max(1_000),
  executionProfile: executionProfileReferenceSchema,
});
export type GoalNativeExecution = z.infer<typeof goalNativeExecutionSchema>;
export interface GoalNativeExecutionResult extends GoalCommandResult {
  executionProfile: ExecutionProfileReference;
}
