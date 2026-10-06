import type { SDKControlGetContextUsageResponse } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { contextIdentitySchema, contextObservationSchema, type ContextMeasurement, type ContextObservation } from '../../../../packages/contracts/src/context-transparency.js';
import { idSchema, referenceSchema } from '../../../../packages/contracts/src/tasks.js';
import { normalizeClaudeSummary } from './claude-summary-values.js';

const hostSchema = z.strictObject({
  identity: contextIdentitySchema, observationId: idSchema, observedAt: z.iso.datetime(),
  evidenceRef: referenceSchema, requestDetail: z.literal('summary'),
});
export type ClaudeContextSummaryInput = z.infer<typeof hostSchema> & { response: SDKControlGetContextUsageResponse };
const unknown = (reason: 'not-observed' | 'identity-incomplete'): ContextMeasurement => ({ kind: 'unknown', value: null, reason });

/** Convert an already obtained 0.3.290 summary response, without SDK runtime imports or IO.
 * Only a session-bound attempt can describe the Query's already consumed context; pending
 * draft/queued inputs need a separate estimator. The authenticated host must bind the consumed
 * input/history cut, request provenance, frozen identity and receipt authority. No Query calls,
 * billing fallback, capacity inference, content extraction or compaction-event inference. */
export function mapClaudeContextSummary(input: ClaudeContextSummaryInput): ContextObservation {
  const host = hostSchema.parse({ identity: input.identity, observationId: input.observationId, observedAt: input.observedAt, evidenceRef: input.evidenceRef, requestDetail: input.requestDetail });
  if (host.identity.harness !== 'claude') throw new Error('Claude context requires a Claude host identity.');
  if (host.identity.subject.kind !== 'attempt' || !host.identity.subject.nativeSessionId) throw new Error('Claude summary requires an attempt with a native session; pending inputs are not measured.');
  const values = normalizeClaudeSummary(input.response, host.identity.resolvedModel);
  const estimate = (value: number): ContextMeasurement => ({
    kind: 'estimate', value, source: { name: 'claude-sdk-context', version: '0.3.290' },
    measurementMethod: 'sdk-summary-estimate', tokenBasis: 'claude-context-summary-0.3.290',
    coverage: 'full', evidenceRef: host.evidenceRef,
  });
  return contextObservationSchema.parse({
    id: host.observationId, identity: host.identity, observedAt: host.observedAt,
    modelCapacity: unknown('not-observed'),
    used: values.used === null ? unknown('identity-incomplete') : estimate(values.used),
    compactionWindow: values.compactionWindow === null ? unknown('identity-incomplete') : estimate(values.compactionWindow),
    categories: values.categories.map(category => ({ id: `claude-summary-${category.kind}`, ...category })),
    compression: { state: 'not-observed' },
  });
}
