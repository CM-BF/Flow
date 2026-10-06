import { z } from 'zod';
import { idSchema } from './tasks.js';

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
  taskId: string; attemptId: string | null; revision: number; sealed: boolean;
  /** False means unresolved delivery must be treated as unknown; it does not prove native work stopped. */
  attemptAvailable: boolean;
  commands: SteeringCommandReference[]; nextCursor: number | null;
}
export interface SteeringText { taskId: string; attemptId: string; commandId: string; text: string; bytes: number; digest: string }
export interface SteeringSeal { taskId: string; attemptId: string; revision: number; final: SteeringSealInput['final']; sealedAt: string }
export interface SteeringAudit {
  id: string; ordinal: number; taskId: string; attemptId: string; commandId: string | null;
  action: 'accepted' | SteeringReceiptInput['phase'] | 'sealed';
  /** Receipts are authenticated runner observations, never independent proof of model compliance. */
  actor: 'owner' | 'runner'; createdAt: string; data: Record<string, unknown>;
}
export interface SteeringAuditPage { entries: SteeringAudit[]; nextCursor: number | null }
