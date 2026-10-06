import { z } from 'zod';
import { conversationContextSelectionSchema, CONVERSATION_CONTEXT_LIMITS } from '../../../../packages/contracts/src/conversation-context.js';
import { knowledgeCitationSchema } from '../../../../packages/contracts/src/knowledge.js';
import { CONTEXT_LIMITS, CONTEXT_PROTOCOL, contextIdentitySchema, contextObservationSchema, contextSnapshotSchema, type ContextMeasurement, type ContextSnapshot, type ContextUnknownReason } from '../../../../packages/contracts/src/context-transparency.js';

const frozenSourceSchema = z.strictObject({ citation: knowledgeCitationSchema, byteLength: z.number().int().nonnegative(), currentVersionAtFreeze: z.number().int().min(1).max(16), isCurrentAtFreeze: z.boolean() });
const inputSchema = z.strictObject({ identity: contextIdentitySchema, asOf: z.iso.datetime(), materials: z.array(frozenSourceSchema).max(CONTEXT_LIMITS.materials), observation: contextObservationSchema.nullable() }).superRefine((input, context) => {
  if (!conversationContextSelectionSchema.safeParse(input.materials.map(source => source.citation)).success) context.addIssue({ code: 'custom', message: 'Material references must be distinct exact citations.' });
  let bytes = 0;
  for (const source of input.materials) {
    bytes += source.byteLength;
    if (source.byteLength !== source.citation.locator.end - source.citation.locator.start || source.currentVersionAtFreeze < source.citation.version || source.isCurrentAtFreeze !== (source.currentVersionAtFreeze === source.citation.version)) context.addIssue({ code: 'custom', message: 'Frozen material metadata does not match its citation.' });
  }
  if (bytes > CONVERSATION_CONTEXT_LIMITS.rawBytes) context.addIssue({ code: 'custom', message: 'Selected materials exceed their existing byte budget.' });
});
export type ContextProjectionInput = z.infer<typeof inputSchema>;
const unknown = (reason: ContextUnknownReason): ContextMeasurement => ({ kind: 'unknown', value: null, reason });

function freshness(input: ContextProjectionInput): ContextSnapshot['freshness'] {
  const observation = input.observation;
  if (!observation) return { state: 'unknown', reason: 'not-observed' };
  if (JSON.stringify(observation.identity) !== JSON.stringify(input.identity)) return { state: 'stale', reason: 'identity-changed' };
  const identity = input.identity;
  if (!identity.resolvedModel || !identity.executionInputDigest || !identity.materialRevisionDigest || !identity.historyEpoch || (identity.subject.kind === 'attempt' && !identity.subject.nativeSessionId)) return { state: 'unknown', reason: 'identity-incomplete' };
  const age = Date.parse(input.asOf) - Date.parse(observation.observedAt);
  if (age < 0) return { state: 'stale', reason: 'future-observation' };
  if (age > CONTEXT_LIMITS.maxAgeMs) return { state: 'stale', reason: 'expired' };
  return { state: 'current', reason: null };
}

function projectWindow(limit: ContextMeasurement, used: ContextMeasurement): ContextSnapshot['windows']['modelHardLimit'] {
  const unavailable = (reason: ContextUnknownReason): ContextSnapshot['windows']['modelHardLimit'] => ({ limit, remaining: unknown(reason), overflow: { state: 'unknown', tokensOver: null, kind: 'unknown' } });
  if (limit.kind === 'unknown') return unavailable(limit.reason);
  if (used.kind === 'unknown') return unavailable(used.reason);
  if (limit.coverage !== 'full' || used.coverage !== 'full') return unavailable('partial');
  if (limit.tokenBasis !== used.tokenBasis) return unavailable('incompatible-token-basis');
  // Input observations reject derived readings, so both direct evidence references exist.
  const kind = limit.kind === 'provider' && used.kind === 'provider' ? 'provider' : 'estimate';
  const tokensOver = Math.max(0, used.value - limit.value);
  return {
    limit,
    remaining: { kind, value: Math.max(0, limit.value - used.value), source: { name: 'flow-projection', version: '1' }, measurementMethod: 'derived', coverage: 'full', tokenBasis: used.tokenBasis, evidenceRef: null,
      derivedFrom: [{ role: 'limit', value: limit.value, kind: limit.kind, evidenceRef: limit.evidenceRef! }, { role: 'used', value: used.value, kind: used.kind, evidenceRef: used.evidenceRef! }] },
    overflow: tokensOver ? { state: 'exceeded', tokensOver, kind } : { state: 'within', tokensOver: 0, kind },
  };
}

/** Pure, bounded metadata projection. The caller owns authenticated evidence and current identity.
 * No billing inputs, SDK calls, state mutation, text reads or persistence. Remaining is window
 * arithmetic, never a promise that an additional request fits after output/tool reserves. */
export function projectContextSnapshot(value: ContextProjectionInput): ContextSnapshot {
  const input = inputSchema.parse(value);
  const state = freshness(input);
  const sample = state.state === 'current' ? input.observation : null;
  const absent = unknown(state.reason ?? 'not-observed');
  const used = sample?.used ?? absent;
  return contextSnapshotSchema.parse({
    protocol: CONTEXT_PROTOCOL, identity: input.identity, asOf: input.asOf, observationId: input.observation?.id ?? null, observedAt: input.observation?.observedAt ?? null, freshness: state,
    used, windows: { modelHardLimit: projectWindow(sample?.modelCapacity ?? absent, used), compactionPolicy: projectWindow(sample?.compactionWindow ?? absent, used) },
    materials: input.materials.map(source => ({ citation: source.citation, byteLength: source.byteLength, role: input.identity.subject.kind === 'draft' ? 'selected' : 'included', tokens: unknown('not-measured') })),
    categories: sample?.categories ?? [], compression: sample?.compression ?? { state: 'not-observed' },
  });
}
