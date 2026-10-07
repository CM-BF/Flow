import { z } from 'zod';

export const CONTEXT_OBSERVATION_BYTES = 65_536;
export const CLAUDE_CONTEXT_SOURCE = {
  harness: 'claude', adapterVersion: 'claude-sdk-0.3.290-v2', name: 'claude-sdk-context', version: '0.3.290',
  requestDetail: 'summary', measurementMethod: 'sdk-summary-estimate', kind: 'estimate', tokenBasis: 'claude-context-summary-0.3.290',
} as const;
const identifier = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/);
const model = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,179}$/);
const tokens = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const category = z.strictObject({ kind: z.enum(['used', 'free', 'buffer', 'deferred']), tokens });
const source = z.strictObject({
  harness: z.literal(CLAUDE_CONTEXT_SOURCE.harness), adapterVersion: z.literal(CLAUDE_CONTEXT_SOURCE.adapterVersion),
  name: z.literal(CLAUDE_CONTEXT_SOURCE.name), version: z.literal(CLAUDE_CONTEXT_SOURCE.version),
  requestDetail: z.literal(CLAUDE_CONTEXT_SOURCE.requestDetail), measurementMethod: z.literal(CLAUDE_CONTEXT_SOURCE.measurementMethod),
  kind: z.literal(CLAUDE_CONTEXT_SOURCE.kind), tokenBasis: z.literal(CLAUDE_CONTEXT_SOURCE.tokenBasis),
});
/** Finite normalized values only. The authenticated host must bind this to its consumed attempt; parsing grants no authority. */
export const contextObservationPayloadSchema = z.strictObject({
  source, observationId: identifier, observedAt: z.iso.datetime(), nativeSessionId: identifier,
  resolvedModel: model.nullable(), used: tokens.nullable(), compactionWindow: tokens.positive().nullable(),
  categories: z.array(category).max(4),
}).superRefine((value, context) => {
  if (new Set(value.categories.map(item => item.kind)).size !== value.categories.length) context.addIssue({ code: 'custom', message: 'Category kinds must be unique.' });
  if (value.resolvedModel === null && (value.used !== null || value.compactionWindow !== null || value.categories.length)) context.addIssue({ code: 'custom', message: 'An unknown model cannot identify measured context.' });
  if (!Number.isSafeInteger(value.categories.filter(item => item.kind !== 'deferred').reduce((sum, item) => sum + item.tokens, 0))) context.addIssue({ code: 'custom', message: 'Category total exceeds its integer budget.' });
});
export type ContextObservationPayload = z.infer<typeof contextObservationPayloadSchema>;
export const contextObservationEventSchema = z.strictObject({
  id: identifier, sequence: z.number().int().min(1).max(2_147_483_647), type: z.literal('context-observation'), observation: contextObservationPayloadSchema,
}).refine(value => new TextEncoder().encode(JSON.stringify(value)).byteLength <= CONTEXT_OBSERVATION_BYTES, 'Context event exceeds its byte budget.');
export type ContextObservationEvent = z.infer<typeof contextObservationEventSchema>;
