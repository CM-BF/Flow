import type { SDKControlGetContextUsageResponse } from '@anthropic-ai/claude-agent-sdk';
import { CLAUDE_CONTEXT_SOURCE, contextObservationPayloadSchema, type ContextObservationPayload } from '../../../../packages/contracts/src/context-observation-event.js';
import { normalizeClaudeSummary } from './claude-summary-values.js';

export interface ClaudeSummaryReader {
  getContextUsage?(options: { detail: 'summary' }): Promise<SDKControlGetContextUsageResponse>;
}

type SummaryRead = { kind: 'available'; observation: ContextObservationPayload }
  | { kind: 'unavailable' } | { kind: 'unsettled' };

/** One explicit summary request, bounded to 1000 ms. The caller owns Query cleanup
 * and publication. Unsettled means a dispatched control may still be running. */
export async function readClaudeSummary(reader: ClaudeSummaryReader, input: {
  signal: AbortSignal; resolvedModel: string | null; nativeSessionId: string; observationId: string;
}): Promise<SummaryRead> {
  input.signal.throwIfAborted();
  if (!reader.getContextUsage) return { kind: 'unavailable' };
  let interrupt = () => {};
  const interrupted = new Promise<SummaryRead>(resolve => { interrupt = () => resolve({ kind: 'unsettled' }); });
  const timer = setTimeout(interrupt, 1000);
  input.signal.addEventListener('abort', interrupt, { once: true });
  const settled = (async (): Promise<SummaryRead> => {
    try {
      const response = await reader.getContextUsage!({ detail: 'summary' });
      // Validate even when the host model is unknown. The response model is used
      // only for validation; it must never upgrade the host's unknown identity.
      const values = normalizeClaudeSummary(response, input.resolvedModel ?? response.model);
      const parsed = contextObservationPayloadSchema.safeParse({
        source: CLAUDE_CONTEXT_SOURCE, observationId: input.observationId,
        observedAt: new Date().toISOString(), nativeSessionId: input.nativeSessionId, ...values,
      });
      if (!parsed.success) return { kind: 'unavailable' };
      const observation = input.resolvedModel === null
        ? { ...parsed.data, resolvedModel: null, used: null, compactionWindow: null, categories: [] }
        : parsed.data;
      return { kind: 'available', observation };
    } catch { return { kind: 'unavailable' }; }
  })();
  try { return await Promise.race([settled, interrupted]); }
  finally {
    clearTimeout(timer);
    input.signal.removeEventListener('abort', interrupt);
  }
}
