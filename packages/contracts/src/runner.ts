import { pluginArtifactSourceSchema } from './plugin-artifact.js';
import type { GoalGraphCapability, GoalGraphRunReference } from './goal-graph-runs.js';
import type { ConversationContextExecutionReference } from './conversation-context.js';
import type { GoalToolCapability, GoalToolRunReference } from './goal-tool-runs.js';
import { z } from 'zod';
import { steeringReceiptSchema, steeringResultSchema, steeringFinalizationMetadataSchema, type ActiveSteeringPort } from './active-steering.js';
import { assistantStreamDataSchema, assistantStreamMarkerSchema } from './assistant-stream.js';
import { claudeAssistantFinalDataSchema, codexAssistantFinalDataSchema } from './assistant.js';
import { contextObservationEventSchema } from './context-observation-event.js';
import { nativeActivityDataSchema } from './native-activity.js';
import { nativeActivityBodyEventSchema, type NativeActivityBodyPublisher } from './native-activity-body.js';
import { nativeEngineeringVerificationDataSchema } from './engineering-native.js';
import { engineeringVerificationDataSchema } from './engineering.js';
import { harnessSchema, idSchema, MAX_DETAIL_BYTES, MAX_BATCH_BYTES, type DecisionAnswer, type TaskSubmission, type AttemptView, type HarnessName } from './tasks.js';

export const registerRunnerSchema = z.strictObject({
  name: z.string().min(1).max(120),
  harnesses: z.array(harnessSchema).min(1).max(harnessSchema.options.length).refine(names => new Set(names).size === names.length, 'Harness names must be unique'),
  capacity: z.number().int().min(1).max(16).default(1),
});
export type RegisterRunner = z.input<typeof registerRunnerSchema>;
export interface RunnerRegistration { runnerId: string; token: string }
export const ownershipSchema = z.strictObject({ attemptId: idSchema, ownerVersion: z.number().int().positive() });
export type Ownership = z.infer<typeof ownershipSchema>;
/** task.prompt is the private execution input; public TaskSnapshot.prompt remains user-authored text. */
export interface ClaimedTask { conversationContext?: ConversationContextExecutionReference; attempt: AttemptView; task: TaskSubmission & { id: string }; goalToolRun?: GoalToolRunReference; goalGraphRun?: GoalGraphRunReference }
export interface ClaimResponse {
  assignment: ClaimedTask | null;
  /** Milliseconds granted at center lease creation, before response transport; 0 without an assignment.
   * Consumers must subtract elapsed time since BEFORE sending claim. Missing/invalid grants fail closed. */
  remainingLeaseMs: number;
}
export interface HeartbeatResponse {
  action: 'continue' | 'cancel' | 'stop';
  leaseExpiresAt: string;
  /** Milliseconds granted by this heartbeat before response transport; 0 for stop. */
  remainingLeaseMs: number;
  decision: DecisionAnswer | null;
}

const envelope = { id: idSchema, sequence: z.number().int().positive() };
const content = z.string().max(MAX_DETAIL_BYTES).refine(value => new TextEncoder().encode(value).byteLength <= MAX_DETAIL_BYTES, 'Content exceeds byte limit');
const title = z.string().min(1).max(180);
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const tokenCount = z.number().int().nonnegative().nullable();
export const runnerEventSchema = z.discriminatedUnion('type', [
  z.strictObject({ ...envelope, type: z.literal('steering-receipt'), receipt: steeringReceiptSchema }),
  z.strictObject({ ...envelope, type: z.literal('steering-result'), result: steeringResultSchema }),
  z.discriminatedUnion('source', [claudeAssistantFinalDataSchema.extend(envelope), codexAssistantFinalDataSchema.extend(envelope)]),
  assistantStreamDataSchema.safeExtend(envelope),
  assistantStreamMarkerSchema.extend(envelope),
  nativeActivityDataSchema.safeExtend(envelope),
  z.discriminatedUnion('action', [
    nativeActivityBodyEventSchema.options[0].extend(envelope),
    nativeActivityBodyEventSchema.options[1].extend(envelope),
    nativeActivityBodyEventSchema.options[2].extend(envelope),
  ]),
  contextObservationEventSchema,
  z.strictObject({ ...envelope, type: z.literal('message'), text: z.string().min(1).max(4000) }),
  z.strictObject({ ...envelope, type: z.literal('detail'), title, content, mediaType: z.string().max(120) }),
  z.strictObject({ ...envelope, type: z.literal('decision'), decisionId: idSchema, prompt: z.string().min(1).max(2000) }),
  z.strictObject({ ...envelope, type: z.literal('artifact'), artifactId: idSchema, title, version: digest, content, mediaType: z.string().max(120), pluginSource: pluginArtifactSourceSchema.optional() }),
  z.discriminatedUnion('verifierId', [
    z.strictObject({ ...envelope, type: z.literal('verification'), artifactId: idSchema, artifactVersion: digest, verifierId: z.literal('flow.text'), verifierVersion: z.literal('1'), inputDigest: digest, result: z.enum(['passed', 'failed']), evidence: z.string().min(1).max(4000) }),
    engineeringVerificationDataSchema.extend(envelope),
    nativeEngineeringVerificationDataSchema.extend(envelope),
  ]),
  z.strictObject({ ...envelope, type: z.literal('usage'), source: idSchema, scope: z.enum(['step', 'turn', 'session']), scopeId: idSchema, sampleId: idSchema, cumulative: z.boolean(), baseline: z.discriminatedUnion('kind', [z.strictObject({ kind: z.literal('new-session') }), z.strictObject({ kind: z.literal('sample'), sampleId: idSchema }), z.strictObject({ kind: z.literal('unknown') })]).optional(), accounting: z.enum(['authoritative', 'informational']), costKind: z.enum(['sdk_estimate', 'provider_actual', 'unknown']), model: z.string().max(180).optional(), inputTokens: tokenCount, outputTokens: tokenCount, cacheReadTokens: tokenCount.optional(), cacheWriteTokens: tokenCount.optional(), costUsd: z.number().nonnegative().nullable() }),
  z.strictObject({ ...envelope, type: z.literal('session'), nativeSessionId: idSchema, adapterVersion: idSchema, resources: z.array(z.string().max(200)).max(100).optional() }),
  z.strictObject({ ...envelope, type: z.literal('completed'), outcome: z.enum(['succeeded', 'failed', 'cancelled']), error: z.string().max(2000).optional() }),
]);
export type RunnerEvent = z.infer<typeof runnerEventSchema>;
type WithoutEnvelope<T> = T extends RunnerEvent ? Omit<T, 'id' | 'sequence'> : never;
export type RunnerEventData = WithoutEnvelope<RunnerEvent>;
export const eventBatchSchema = ownershipSchema.extend({ events: z.array(runnerEventSchema).min(1).max(50) }).refine(batch => new TextEncoder().encode(JSON.stringify(batch)).byteLength <= MAX_BATCH_BYTES, 'Batch exceeds byte limit');
export type EventBatch = z.infer<typeof eventBatchSchema>;
export const steeringFinalizationSchema = steeringFinalizationMetadataSchema.extend({ events: z.array(runnerEventSchema).length(3) })
  .refine(value => new TextEncoder().encode(JSON.stringify(value)).byteLength <= MAX_BATCH_BYTES, 'Final proposal exceeds byte limit');
export interface EventAcknowledgement { accepted: number; lastSequence: number }

/** Host-assigned facts only. Reading identity does not verify or extend ownership. */
export interface HarnessExecutionIdentity {
  readonly taskId: string;
  readonly attemptId: string;
  readonly ownerVersion: number;
  readonly runnerId: string;
}

export interface HarnessContext {
  /** Explicit compatible-center host opt-in; absent retains legacy prefixes. */
  activityBodies?: NativeActivityBodyPublisher;
  readonly executionIdentity?: HarnessExecutionIdentity;
  steering?: ActiveSteeringPort;
  task: TaskSubmission;
  goalTools?: GoalToolCapability;
  goalGraphTools?: GoalGraphCapability;
  workingDirectory: string;
  signal: AbortSignal;
  assertOwnership(): Promise<void>;
  waitForDecision(request: { id: string; prompt: string }): Promise<DecisionAnswer['answer']>;
  emit(event: RunnerEventData): Promise<void>;
}

export interface HarnessAdapter {
  name: HarnessName;
  version: string;
  run(context: HarnessContext): Promise<void>;
}
