import { z } from 'zod';
import { idSchema } from './tasks.js';
import type { RunnerEvent, RunnerEventData } from './runner.js';

export const MAX_STEERING_TEXT_BYTES = 16_384;
const revision = z.number().int().min(0).max(2_147_483_647);
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const ownership = { attemptId: idSchema, ownerVersion: z.number().int().positive() };
const text = z.string().max(MAX_STEERING_TEXT_BYTES).refine(value => value.trim().length > 0
  && !value.includes('\0') && [...value].every(character => { const code = character.codePointAt(0)!; return code < 0xd800 || code > 0xdfff; })
  && new TextEncoder().encode(value).byteLength <= MAX_STEERING_TEXT_BYTES, 'Steering text must be bounded nonempty UTF-8.');
export const steeringCommandSchema = z.strictObject({ ...ownership, expectedRevision: revision, text });
export type SteeringCommandInput = z.infer<typeof steeringCommandSchema>;

const receipt = { ...ownership, commandId: idSchema, nativeSessionId: idSchema, userMessageUuid: z.uuid(), receiptId: idSchema, expectedReceiptRevision: revision };
export const steeringReceiptSchema = z.discriminatedUnion('phase', [
  z.strictObject({ ...receipt, phase: z.literal('received') }),
  z.strictObject({ ...receipt, phase: z.literal('observed-consumed'), sourceMessageId: idSchema,
    sourceType: z.enum(['assistant', 'stream_event', 'result']), parentToolUseId: z.null(), consumedUserMessageUuids: z.array(z.uuid()).min(1).max(64) })
    .refine(value => value.consumedUserMessageUuids.includes(value.userMessageUuid), 'The receipt must include this command UUID.'),
  z.strictObject({ ...receipt, phase: z.enum(['rejected', 'unknown']), reason: z.string().trim().min(1).max(1000) }),
]);
export type SteeringReceiptInput = z.infer<typeof steeringReceiptSchema>;
export const steeringSealSchema = z.strictObject({ ...ownership, expectedRevision: revision,
  final: z.strictObject({ nativeSessionId: idSchema, sourceMessageId: idSchema, contentDigest: digest }) });
export type SteeringSealInput = z.infer<typeof steeringSealSchema>;

export type SteeringStatus = 'accepted' | 'received' | 'observed-consumed' | 'rejected' | 'unknown';
export interface SteeringCommandReference {
  id: string; taskId: string; attemptId: string; ownerVersion: number; nativeSessionId: string;
  revision: number; userMessageUuid: string; status: SteeringStatus; receiptRevision: number;
  /** Metadata only; the task+command-bound owner text endpoint returns the original input. */
  input: { bytes: number; digest: string };
  createdAt: string; updatedAt: string;
}
export interface SteeringCommandResult { command: SteeringCommandReference; replayed: boolean }
export interface SteeringState {
  /** Admission CAS only: receipt changes do not increment revision. Read current state or audit for updates. */
  taskId: string; attemptId: string | null; revision: number; sealed: boolean;
  /** False means unresolved delivery must be treated as unknown; it does not prove native work stopped. */
  attemptAvailable: boolean;
  commands: SteeringCommandReference[]; nextCursor: number | null;
}
export interface SteeringText { taskId: string; attemptId: string; commandId: string; text: string; bytes: number; digest: string }
export interface SteeringSeal { taskId: string; attemptId: string; revision: number; final: SteeringSealInput['final']; sealedAt: string }
export interface SteeringAudit {
  id: string; ordinal: number; taskId: string; attemptId: string; commandId: string | null;
  action: 'accepted' | SteeringReceiptInput['phase'] | 'sealed' | 'result-observed';
  /** Receipts are authenticated runner observations, never independent proof of model compliance. */
  actor: 'owner' | 'runner'; createdAt: string; data: Record<string, unknown>;
}
export interface SteeringAuditPage { entries: SteeringAudit[]; nextCursor: number | null }

export const steeringPageSchema = z.strictObject({ after: z.coerce.number().int().min(0).max(Number.MAX_SAFE_INTEGER).default(0), limit: z.coerce.number().int().min(1).max(100).default(100) });
export const steeringStateQuerySchema = steeringPageSchema.extend({ attemptId: idSchema.optional() });

export const steeringAdmissionQuerySchema = z.strictObject({ attemptId: idSchema.optional() });
export type SteeringAdmissionUnavailableReason =
  | 'disabled' | 'not-installed' | 'no-attempt' | 'not-current' | 'stale-owner'
  | 'not-running' | 'decision-pending' | 'lease-expired' | 'runner-revoked'
  | 'session-unavailable' | 'profile-unsupported' | 'profile-unavailable'
  | 'final-exists' | 'sealed' | 'pending' | 'unknown-pending' | 'limit-reached';
/** A task-bound read snapshot, not a reservation or proof of native/model availability.
 * POST still rechecks current authority, profile, CAS and final/pending state under locks.
 * Missing control state has revision 0; disabled/uninstalled storage reports null. */
export type SteeringAdmission =
  | { taskId: string; attemptId: string; ownerVersion: number; revision: number; state: 'ready'; reason: 'ready' }
  | { taskId: string; attemptId: string | null; ownerVersion: number | null; revision: number | null;
      state: 'unavailable'; reason: SteeringAdmissionUnavailableReason };

// CHAT08: all transport methods are runner-authenticated and remain opt-in at the host.
export const MAX_STEERING_COMMANDS_PER_ATTEMPT = 64;
/** Host evidence bound, not the SDK maxTurns meaning or a renewed query budget. */
export const MAX_STEERING_RESULTS_PER_ATTEMPT = 65;
export const steeringMailboxSchema = z.strictObject(ownership);
export interface SteeringMailbox {
  revision: number;
  sealed: boolean;
  commands: SteeringCommandReference[];
  delivery: { commandId: string; text: string } | null;
}
export const steeringResultSchema = z.strictObject({
  nativeSessionId: idSchema, sourceMessageId: idSchema,
  consumedUserMessageUuids: z.array(z.uuid()).max(64),
  queuedTurnCount: z.number().int().min(0).max(1000000).nullable(),
  outcome: z.enum(['success', 'error']), contentDigest: digest,
});
export type SteeringResultObservation = z.infer<typeof steeringResultSchema>;
export const steeringFinalizationMetadataSchema = z.strictObject({
  ...ownership, proposalId: idSchema, expectedRevision: revision,
  afterSequence: revision, nativeSessionId: idSchema, resultId: idSchema,
});
export interface SteeringFinalizationInput extends z.infer<typeof steeringFinalizationMetadataSchema> { events: RunnerEvent[] }
export type SteeringFinalizationResult =
  | { state: 'committed'; proposalId: string; lastSequence: number; replayed: boolean }
  | { state: 'not-committed'; proposalId: string; lastSequence: number; controlRevision: number;
      reason: 'control-changed' | 'pending-command' | 'result-not-current' | 'uncovered-command' | 'sdk-pending' | 'sequence-changed' };
export const steeringProposalLookupSchema = z.strictObject({ ...ownership, proposalId: idSchema });
export type SteeringProposalLookup = z.infer<typeof steeringProposalLookupSchema>;
export type SteeringProposalStatus = Extract<SteeringFinalizationResult, { state: 'committed' }> | { state: 'absent'; proposalId: string };
/** Runtime owns authorization, deadlines, durable envelopes and sequence allocation. */
export interface ActiveSteeringPort {
  mailbox(): Promise<SteeringMailbox>;
  finalize(input: { expectedRevision: number; nativeSessionId: string; resultId: string; events: RunnerEventData[] }): Promise<SteeringFinalizationResult>;
}
