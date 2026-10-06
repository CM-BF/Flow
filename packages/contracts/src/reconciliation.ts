import { z } from 'zod';
import { idSchema, referenceSchema, type AcceptedTask, type AttemptView, type Reference, type TaskStatus, type TaskSummary } from './tasks.js';

const fence = { attemptId: idSchema, ownerVersion: z.number().int().positive() };
export const operatorEvidenceSchema = z.strictObject({
  explanation: z.string().trim().min(1).max(4_000),
  references: z.array(referenceSchema).max(32).default([]),
});
export const reconciliationObservationSchema = z.strictObject({ ...fence, evidence: operatorEvidenceSchema });
export const reconciliationResolutionSchema = z.strictObject({
  ...fence,
  stoppedConfirmed: z.literal(true),
  stopEvidence: operatorEvidenceSchema,
  sideEffects: z.enum(['none-confirmed', 'reviewed']),
  effectsEvidence: operatorEvidenceSchema,
  outcome: z.enum(['failed', 'cancelled']),
});
export const reconciliationRetrySchema = z.strictObject({
  ...fence,
  resolutionId: idSchema,
  safety: z.discriminatedUnion('strategy', [
    z.strictObject({ strategy: z.literal('no-side-effects'), evidence: operatorEvidenceSchema }),
    z.strictObject({ strategy: z.literal('revised-work'), prompt: z.string().trim().min(1).max(16_000), evidence: operatorEvidenceSchema }),
  ]),
});

export type OperatorEvidence = z.infer<typeof operatorEvidenceSchema>;
export type ReconciliationObservation = z.infer<typeof reconciliationObservationSchema>;
export type ReconciliationResolution = z.infer<typeof reconciliationResolutionSchema>;
export type ReconciliationRetry = z.infer<typeof reconciliationRetrySchema>;

export interface ReconciliationState {
  status: TaskStatus;
  ownerVersion: number;
  retryTaskId?: string;
}

type AuditAction =
  | { action: 'observation'; request: ReconciliationObservation }
  | { action: 'resolution'; request: ReconciliationResolution }
  | { action: 'retry'; request: ReconciliationRetry };

export type ReconciliationAudit = AuditAction & {
  id: string;
  cursor: number;
  taskId: string;
  attemptId: string;
  actor: 'owner';
  createdAt: string;
  before: ReconciliationState;
  after: ReconciliationState;
};

export interface RetryProvenance {
  taskId: string;
  attemptId: string;
  resolutionId: string;
  auditId: string;
}

export interface ReconciliationView {
  task: TaskSummary;
  currentOwnerVersion: number;
  reservationHeld: boolean;
  attempt: AttemptView | null;
  lastSequence: number | null;
  lastHeartbeatAt: string | null;
  lastEventAt: string | null;
  completedAt: string | null;
  evidence: Reference[];
  evidenceHasMore: boolean;
  audit: ReconciliationAudit[];
  hasMore: boolean;
  nextCursor: number | null;
  provenance: RetryProvenance | null;
}

export interface ReconciliationResult {
  task: TaskSummary;
  audit: ReconciliationAudit;
  replayed: boolean;
}

export interface ReconciliationRetryResult extends AcceptedTask {
  audit: ReconciliationAudit;
  provenance: RetryProvenance;
}
