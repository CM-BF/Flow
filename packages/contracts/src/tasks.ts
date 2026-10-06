import { z } from 'zod';

export const PROTOCOL_VERSION = 1;
export const WORKSPACE_ID = 'personal';
export const MAX_PAGE_SIZE = 100;
export const MAX_DETAIL_BYTES = 1_048_576;
export const MAX_BATCH_BYTES = 2_097_152;
export const idSchema = z.string().min(1).max(128);
export const harnessSchema = z.enum(['fixture', 'claude']);
export const referenceSchema = z.strictObject({ id: idSchema, title: z.string().min(1).max(180) });
export const verificationRuleSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('nonempty') }),
  z.strictObject({ kind: z.literal('contains'), expected: z.string().min(1).max(500) }),
]);

export const taskSubmissionSchema = z.strictObject({
  title: z.string().trim().min(1).max(180),
  prompt: z.string().min(1).max(16_000),
  harness: harnessSchema,
  fixture: z.strictObject({
    scenario: z.enum(['success', 'decision', 'failure', 'verification-failure', 'slow', 'large']),
    delayMs: z.number().int().min(0).max(30_000).optional(),
    detailBytes: z.number().int().min(0).max(524_288).optional(),
  }).optional(),
  verification: verificationRuleSchema.optional(),
  resumeSessionId: idSchema.optional(),
});
export type TaskSubmission = z.infer<typeof taskSubmissionSchema>;
export type HarnessName = z.infer<typeof harnessSchema>;
export type Reference = z.infer<typeof referenceSchema>;
export type VerificationRule = z.infer<typeof verificationRuleSchema>;
export type TaskStatus = 'queued' | 'running' | 'waiting' | 'cancel_requested' | 'succeeded' | 'failed' | 'cancelled' | 'uncertain';
export type VerificationStatus = 'pending' | 'passed' | 'failed';
export const TERMINAL_STATUSES: readonly TaskStatus[] = ['succeeded', 'failed', 'cancelled'];

export interface TaskSummary {
  id: string;
  title: string;
  harness: HarnessName;
  status: TaskStatus;
  verificationStatus: VerificationStatus;
  createdAt: string;
  updatedAt: string;
}

export type TimelineEntry = {
  id: string;
  cursor: number;
  createdAt: string;
} & ({ kind: 'text'; text: string } | { kind: 'reference'; reference: Reference });

export interface DecisionRequest {
  id: string;
  prompt: string;
}

export interface UsageTotals {
  inputTokens: number | null;
  outputTokens: number | null;
  costUsd: number | null;
  costKind: 'sdk_estimate' | 'provider_actual' | 'mixed' | 'unknown';
  incomplete: boolean;
}

export interface AttemptView {
  id: string;
  runnerId: string;
  ownerVersion: number;
  leaseExpiresAt: string;
  nativeSessionId?: string;
}

export interface TaskSnapshot extends TaskSummary {
  prompt: string;
  entries: TimelineEntry[];
  watermark: number;
  hasMore: boolean;
  pendingDecision: DecisionRequest | null;
  attempt: AttemptView | null;
  usage: UsageTotals;
}

export interface EventPage {
  entries: TimelineEntry[];
  nextCursor: number;
  task: TaskSummary;
  pendingDecision: DecisionRequest | null;
  usage: UsageTotals;
  watermark: number;
  hasMore: boolean;
  reset?: boolean;
}

export interface Detail {
  id: string;
  title: string;
  kind: 'detail' | 'artifact' | 'verification' | 'usage' | 'session';
  content: string;
  mediaType: string;
  artifactVersion?: string;
}

export interface TaskList {
  tasks: TaskSummary[];
  nextCursor: string | null;
}

export const decisionSchema = z.strictObject({ decisionId: idSchema, answer: z.enum(['approve', 'reject']) });
export type DecisionAnswer = z.infer<typeof decisionSchema>;
export interface AcceptedTask { task: TaskSummary; replayed: boolean }
export interface ApiErrorBody { error: { code: string; message: string } }
