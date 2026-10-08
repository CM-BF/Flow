import { z } from 'zod';
import { idSchema } from './tasks.js';
import { knowledgeCitationSchema } from './knowledge.js';
import { contextObservationSchema, CONTEXT_LIMITS } from './context-transparency.js';

export const CONTEXT_HISTORY_PROTOCOL = 'flow.context-history.v1';
export const CONTEXT_DETAIL_TITLE = 'Claude context summary';
export const contextHistoryMaterialsSchema = z.discriminatedUnion('state', [
  z.strictObject({ state: z.literal('unknown'), reason: z.literal('metadata-unavailable') }),
  z.strictObject({ state: z.literal('known'), sources: z.array(z.strictObject({ citation: knowledgeCitationSchema,
    byteLength: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER), tokens: z.null(),
  }).refine(value => value.byteLength === value.citation.locator.end - value.citation.locator.start, 'Exact bytes must match the citation locator.')).min(1).max(CONTEXT_LIMITS.materials) }),
]);
export type ContextHistoryMaterials = z.infer<typeof contextHistoryMaterialsSchema>;
export const contextHistorySampleSchema = z.strictObject({
  eventSequence: z.number().int().min(1).max(2_147_483_647), receivedAt: z.iso.datetime(),
  detailRef: z.strictObject({ id: idSchema, title: z.literal(CONTEXT_DETAIL_TITLE) }),
  observation: contextObservationSchema, materials: contextHistoryMaterialsSchema,
}).superRefine((value, context) => {
  const observation = value.observation;
  if (observation.identity.subject.kind !== 'attempt' || !observation.identity.subject.nativeSessionId || observation.identity.harness !== 'claude' || !observation.identity.profile || observation.modelCapacity.kind !== 'unknown' || observation.compression.state !== 'not-observed') context.addIssue({ code: 'custom', message: 'Historical SDK samples require a bound Claude attempt without invented capacity or compression.' });
  for (const reading of [observation.used, observation.compactionWindow]) {
    if (reading.kind !== 'unknown' && (reading.kind !== 'estimate' || reading.source.name !== 'claude-sdk-context' || reading.source.version !== '0.3.290' || reading.measurementMethod !== 'sdk-summary-estimate' || reading.tokenBasis !== 'claude-context-summary-0.3.290' || reading.evidenceRef?.id !== value.detailRef.id || reading.evidenceRef.title !== CONTEXT_DETAIL_TITLE || reading.evidenceRef.activity || reading.evidenceRef.stream)) context.addIssue({ code: 'custom', message: 'SDK history must retain its estimate source and exact metadata reference.' });
  }
});
export type ContextHistorySample = z.infer<typeof contextHistorySampleSchema>;
const unknown = z.strictObject({ kind: z.literal('unknown'), value: z.null(), reason: z.literal('history-only') });
export const contextHistoryResponseSchema = z.strictObject({
  protocol: z.literal(CONTEXT_HISTORY_PROTOCOL), taskId: idSchema, attemptId: idSchema.nullable(),
  latest: contextHistorySampleSchema.nullable(), current: unknown, remaining: unknown,
}).superRefine((value, context) => {
  const subject = value.latest?.observation.identity.subject;
  if (subject && (subject.kind !== 'attempt' || subject.taskId !== value.taskId || subject.attemptId !== value.attemptId)) context.addIssue({ code: 'custom', message: 'History identity must match the selected task and attempt.' });
  if (new TextEncoder().encode(JSON.stringify(value)).byteLength > CONTEXT_LIMITS.responseBytes) context.addIssue({ code: 'custom', message: 'History exceeds its response byte budget.' });
});
export type ContextHistoryResponse = z.infer<typeof contextHistoryResponseSchema>;
