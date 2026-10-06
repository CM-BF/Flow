import type { SDKControlGetContextUsageResponse } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { CONTEXT_LIMITS, contextIdentitySchema, contextObservationSchema, type ContextMeasurement, type ContextObservation } from '../../../../packages/contracts/src/context-transparency.js';
import { idSchema, referenceSchema } from '../../../../packages/contracts/src/tasks.js';

const hostSchema = z.strictObject({
  identity: contextIdentitySchema, observationId: idSchema, observedAt: z.iso.datetime(),
  evidenceRef: referenceSchema, requestDetail: z.literal('summary'),
});
export type ClaudeContextSummaryInput = z.infer<typeof hostSchema> & { response: SDKControlGetContextUsageResponse };
const tokens = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const categoryKinds = ['used', 'free', 'buffer', 'deferred'] as const;
const categorySchema = z.strictObject({ kind: z.enum(categoryKinds), tokens });
const unknown = (reason: 'not-observed' | 'identity-incomplete'): ContextMeasurement => ({ kind: 'unknown', value: null, reason });

function summarizeCategories(rows: SDKControlGetContextUsageResponse['categories']): ContextObservation['categories'] {
  if (!Array.isArray(rows) || rows.length > CONTEXT_LIMITS.categories) throw new Error('Claude context category budget exceeded or invalid.');
  const totals = new Map<typeof categoryKinds[number], number>();
  for (const row of rows) {
    const category = categorySchema.parse({ kind: row.kind, tokens: row.tokens });
    const sum = tokens.parse((totals.get(category.kind) ?? 0) + category.tokens);
    totals.set(category.kind, sum);
  }
  // Fixed kind IDs remain stable when SDK labels or row order change. These totals never
  // replace totalTokens: free, buffer and deferred are not current window consumption.
  return categoryKinds.flatMap(kind => totals.has(kind) ? [{ id: `claude-summary-${kind}`, kind, tokens: totals.get(kind)! }] : []);
}

/** Convert an already obtained 0.3.290 summary response, without SDK runtime imports or IO.
 * Only a session-bound attempt can describe the Query's already consumed context; pending
 * draft/queued inputs need a separate estimator. The authenticated host must bind the consumed
 * input/history cut, request provenance, frozen identity and receipt authority. No Query calls,
 * billing fallback, capacity inference, content extraction or compaction-event inference. */
export function mapClaudeContextSummary(input: ClaudeContextSummaryInput): ContextObservation {
  const host = hostSchema.parse({ identity: input.identity, observationId: input.observationId, observedAt: input.observedAt, evidenceRef: input.evidenceRef, requestDetail: input.requestDetail });
  if (host.identity.harness !== 'claude') throw new Error('Claude context requires a Claude host identity.');
  if (host.identity.subject.kind !== 'attempt' || !host.identity.subject.nativeSessionId) throw new Error('Claude summary requires an attempt with a native session; pending inputs are not measured.');
  const response = input.response;
  const model = contextIdentitySchema.shape.resolvedModel.unwrap().parse(response.model);
  if (host.identity.resolvedModel !== null && model !== host.identity.resolvedModel) throw new Error('Claude context model does not match the host resolved model.');
  const usedTokens = tokens.parse(response.totalTokens);
  const policyTokens = tokens.positive().parse(response.rawMaxTokens);
  const categories = summarizeCategories(response.categories);
  const estimate = (value: number): ContextMeasurement => ({
    kind: 'estimate', value, source: { name: 'claude-sdk-context', version: '0.3.290' },
    measurementMethod: 'sdk-summary-estimate', tokenBasis: 'claude-context-summary-0.3.290',
    coverage: 'full', evidenceRef: host.evidenceRef,
  });
  const modelConfirmed = host.identity.resolvedModel !== null;
  return contextObservationSchema.parse({
    id: host.observationId, identity: host.identity, observedAt: host.observedAt,
    modelCapacity: unknown('not-observed'),
    used: modelConfirmed ? estimate(usedTokens) : unknown('identity-incomplete'),
    compactionWindow: modelConfirmed ? estimate(policyTokens) : unknown('identity-incomplete'),
    categories: modelConfirmed ? categories : [], compression: { state: 'not-observed' },
  });
}
