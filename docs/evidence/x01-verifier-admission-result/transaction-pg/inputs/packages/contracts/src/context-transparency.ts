import { z } from 'zod';
import { idSchema, referenceSchema } from './tasks.js';
import { executionProfileReferenceSchema } from './execution-profiles.js';
import { knowledgeCitationSchema } from './knowledge.js';
import { harnessSchema } from './harnesses.js';

export const CONTEXT_PROTOCOL = 'flow.context.v1';
export const CONTEXT_LIMITS = { responseBytes: 65_536, materials: 4, categories: 32, maxAgeMs: 30_000 } as const;
const tokens = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const identifier = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,179}$/);
const digest = z.string().regex(/^[a-f0-9]{64}$/);
export const contextUnknownReasonSchema = z.enum(['not-observed', 'not-measured', 'identity-changed', 'identity-incomplete', 'expired', 'future-observation', 'partial', 'incompatible-token-basis']);
export type ContextUnknownReason = z.infer<typeof contextUnknownReasonSchema>;

export const contextIdentitySchema = z.strictObject({
  subject: z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('draft'), draftId: idSchema, settingsRevision: idSchema }),
    z.strictObject({ kind: z.literal('queued'), queueItemId: idSchema, settingsRevision: idSchema }),
    z.strictObject({ kind: z.literal('attempt'), taskId: idSchema, attemptId: idSchema, ownerVersion: z.number().int().positive(), nativeSessionId: idSchema.nullable() }),
  ]),
  harness: harnessSchema, requestedModel: identifier, resolvedModel: identifier.nullable(), profile: executionProfileReferenceSchema.nullable(),
  executionInputDigest: digest.nullable(), materialRevisionDigest: digest.nullable(), historyEpoch: idSchema.nullable(),
});
export type ContextIdentity = z.infer<typeof contextIdentitySchema>;

const operand = z.strictObject({ role: z.enum(['limit', 'used']), value: tokens, kind: z.enum(['provider', 'estimate']), evidenceRef: referenceSchema });
const knownMeasurement = z.strictObject({
  kind: z.enum(['provider', 'estimate']), value: tokens,
  source: z.strictObject({ name: z.enum(['provider-capability', 'provider-window', 'claude-sdk-context', 'flow-estimator', 'flow-projection']), version: identifier }),
  measurementMethod: z.enum(['provider-report', 'sdk-summary-estimate', 'host-estimate', 'derived']),
  tokenBasis: identifier, coverage: z.enum(['full', 'partial']), evidenceRef: referenceSchema.nullable(),
  derivedFrom: z.tuple([operand, operand]).optional(),
}).superRefine((value, context) => {
  const source = value.source.name;
  const valid = value.measurementMethod === 'provider-report' ? value.kind === 'provider' && ['provider-capability', 'provider-window'].includes(source)
    : value.measurementMethod === 'sdk-summary-estimate' ? value.kind === 'estimate' && source === 'claude-sdk-context'
    : value.measurementMethod === 'host-estimate' ? value.kind === 'estimate' && source === 'flow-estimator'
    : source === 'flow-projection';
  if (!valid) context.addIssue({ code: 'custom', message: 'The source and measurement method do not support this accuracy claim.' });
  if (value.measurementMethod === 'derived') {
    if (value.evidenceRef !== null || !value.derivedFrom || value.derivedFrom[0].role !== 'limit' || value.derivedFrom[1].role !== 'used') context.addIssue({ code: 'custom', message: 'Derived remaining requires its limit and used evidence, not a direct provider receipt.' });
    else {
      if (value.value !== Math.max(0, value.derivedFrom[0].value - value.derivedFrom[1].value)) context.addIssue({ code: 'custom', message: 'Derived remaining does not match its operands.' });
      const kind = value.derivedFrom.every(item => item.kind === 'provider') ? 'provider' : 'estimate';
      if (value.kind !== kind) context.addIssue({ code: 'custom', message: 'Derivation cannot upgrade an estimate to a provider measurement.' });
    }
  } else if (!value.evidenceRef || value.derivedFrom) context.addIssue({ code: 'custom', message: 'A direct reading requires its own evidence.' });
});
export const contextMeasurementSchema = z.union([knownMeasurement, z.strictObject({ kind: z.literal('unknown'), value: z.null(), reason: contextUnknownReasonSchema })]);
export type ContextMeasurement = z.infer<typeof contextMeasurementSchema>;

const categorySchema = z.strictObject({ id: identifier, kind: z.enum(['used', 'free', 'buffer', 'deferred']), tokens });
export const contextCompressionSchema = z.discriminatedUnion('state', [
  z.strictObject({ state: z.enum(['not-observed', 'unsupported']) }),
  z.strictObject({ state: z.literal('observed'), id: idSchema, summaryRef: referenceSchema.nullable(), coveredSources: z.array(knowledgeCitationSchema).max(CONTEXT_LIMITS.materials) }),
]);
/** Normalized evidence from an authenticated host; this schema does not grant reporting authority.
 * SDK collection, ownership checks, durable order and source adapters belong to the host/center. */
export const contextObservationSchema = z.strictObject({
  id: idSchema, identity: contextIdentitySchema, observedAt: z.iso.datetime(),
  modelCapacity: contextMeasurementSchema, compactionWindow: contextMeasurementSchema, used: contextMeasurementSchema,
  categories: z.array(categorySchema).max(CONTEXT_LIMITS.categories), compression: contextCompressionSchema,
}).superRefine((value, context) => {
  for (const key of ['modelCapacity', 'compactionWindow', 'used'] as const) {
    const measurement = value[key];
    if (measurement.kind !== 'unknown' && (measurement.measurementMethod === 'derived' || (key !== 'used' && measurement.value === 0))) context.addIssue({ code: 'custom', message: 'Observation inputs must be direct readings with positive known window limits.' });
  }
  if (value.modelCapacity.kind !== 'unknown' && value.modelCapacity.source.name === 'claude-sdk-context') context.addIssue({ code: 'custom', message: 'The SDK context report measures the autocompact window, not an independently attested model hard limit.' });
});
export type ContextObservation = z.infer<typeof contextObservationSchema>;

const overflowSchema = z.discriminatedUnion('state', [
  z.strictObject({ state: z.literal('unknown'), tokensOver: z.null(), kind: z.literal('unknown') }),
  z.strictObject({ state: z.literal('within'), tokensOver: z.literal(0), kind: z.enum(['provider', 'estimate']) }),
  z.strictObject({ state: z.literal('exceeded'), tokensOver: tokens.positive(), kind: z.enum(['provider', 'estimate']) }),
]);
const windowSchema = z.strictObject({ limit: contextMeasurementSchema, remaining: contextMeasurementSchema, overflow: overflowSchema });
const materialSchema = z.strictObject({ citation: knowledgeCitationSchema, byteLength: tokens, role: z.enum(['selected', 'included']), tokens: contextMeasurementSchema });
export const contextSnapshotSchema = z.strictObject({
  protocol: z.literal(CONTEXT_PROTOCOL), identity: contextIdentitySchema, asOf: z.iso.datetime(), observationId: idSchema.nullable(), observedAt: z.iso.datetime().nullable(),
  freshness: z.strictObject({ state: z.enum(['current', 'stale', 'unknown']), reason: contextUnknownReasonSchema.nullable() }),
  used: contextMeasurementSchema, windows: z.strictObject({ modelHardLimit: windowSchema, compactionPolicy: windowSchema }),
  materials: z.array(materialSchema).max(CONTEXT_LIMITS.materials), categories: z.array(categorySchema).max(CONTEXT_LIMITS.categories), compression: contextCompressionSchema,
}).refine(value => new TextEncoder().encode(JSON.stringify(value)).byteLength <= CONTEXT_LIMITS.responseBytes, 'Context snapshot exceeds its byte budget');
export type ContextSnapshot = z.infer<typeof contextSnapshotSchema>;
