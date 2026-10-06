import type { SDKControlGetContextUsageResponse } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { CONTEXT_LIMITS, contextIdentitySchema } from '../../../../packages/contracts/src/context-transparency.js';

const tokens = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const categoryKinds = ['used', 'free', 'buffer', 'deferred'] as const;
const categorySchema = z.strictObject({ kind: z.enum(categoryKinds), tokens });
type Category = z.infer<typeof categorySchema>;

export type ClaudeSummaryValues = {
  resolvedModel: string; used: number; compactionWindow: number; categories: Category[];
} | {
  resolvedModel: null; used: null; compactionWindow: null; categories: [];
};

/** Normalize an already obtained SDK 0.3.290 summary using the host's resolved model,
 * never its requested alias. Validate even when that identity is unknown. Only allowlisted
 * values are read; at most 32 input categories become four detached kind totals. This pure
 * function does not bind identity, receipts or provenance, or infer a model hard limit. */
export function normalizeClaudeSummary(response: SDKControlGetContextUsageResponse, expectedResolvedModel: string | null): ClaudeSummaryValues {
  const model = contextIdentitySchema.shape.resolvedModel.unwrap().parse(response.model);
  if (expectedResolvedModel !== null && model !== expectedResolvedModel) throw new Error('Claude context model does not match the host resolved model.');
  const used = tokens.parse(response.totalTokens);
  const compactionWindow = tokens.positive().parse(response.rawMaxTokens);
  const categories = summarizeCategories(response.categories);
  return expectedResolvedModel === null
    ? { resolvedModel: null, used: null, compactionWindow: null, categories: [] }
    : { resolvedModel: model, used, compactionWindow, categories };
}

function summarizeCategories(rows: SDKControlGetContextUsageResponse['categories']): Category[] {
  if (!Array.isArray(rows) || rows.length > CONTEXT_LIMITS.categories) throw new Error('Claude context category budget exceeded or invalid.');
  const totals = new Map<Category['kind'], number>();
  for (const row of rows) {
    const category = categorySchema.parse({ kind: row.kind, tokens: row.tokens });
    const sum = tokens.parse((totals.get(category.kind) ?? 0) + category.tokens);
    totals.set(category.kind, sum);
  }
  // Kind totals never replace totalTokens: free, buffer and deferred are not consumption.
  return categoryKinds.flatMap(kind => totals.has(kind) ? [{ kind, tokens: totals.get(kind)! }] : []);
}
