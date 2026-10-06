import type { SDKControlGetContextUsageResponse } from '@anthropic-ai/claude-agent-sdk';
import { describe, expect, it } from 'vitest';
import { CONTEXT_LIMITS } from '../../../../packages/contracts/src/context-transparency.js';
import { normalizeClaudeSummary } from './claude-summary-values.js';

const row = (kind: SDKControlGetContextUsageResponse['categories'][number]['kind'], tokens: number) => ({ kind, tokens, name: 'PRIVATE', color: 'PRIVATE' });
const response = (): SDKControlGetContextUsageResponse => ({
  model: 'resolved-model', totalTokens: 600, rawMaxTokens: 800, maxTokens: 700, percentage: 75,
  categories: [row('used', 600), row('free', 200), row('buffer', 50), row('deferred', 900)],
  gridRows: [], memoryFiles: [], mcpTools: [], agents: [], isAutoCompactEnabled: true,
  apiUsage: { input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
});
const normalize = (value = response()) => normalizeClaudeSummary(value, 'resolved-model');

describe('Claude summary values without host receipts or IO', () => {
  it('keeps zero, unclamped over-limit values and the safe integer boundary', () => {
    const value = response();
    for (const used of [0, 1000, Number.MAX_SAFE_INTEGER]) {
      value.totalTokens = used;
      expect(normalize(value)).toMatchObject({ resolvedModel: 'resolved-model', used, compactionWindow: 800 });
    }
    value.rawMaxTokens = Number.MAX_SAFE_INTEGER;
    expect(normalize(value).compactionWindow).toBe(Number.MAX_SAFE_INTEGER);
  });
  it('aggregates only explicit kinds in fixed order without making them usage', () => {
    const value = response();
    value.categories = [row('deferred', 9), { ...row('used', 7), name: 'Free', isDeferred: true }, row('used', 3), row('buffer', 0)];
    const categories = [{ kind: 'used', tokens: 10 }, { kind: 'buffer', tokens: 0 }, { kind: 'deferred', tokens: 9 }];
    expect(normalize(value)).toEqual({ resolvedModel: 'resolved-model', used: 600, compactionWindow: 800, categories });
    value.categories.reverse();
    expect(normalize(value).categories).toEqual(categories);
  });
  it('validates the complete allowlist before discarding values for an unknown host model', () => {
    expect(normalizeClaudeSummary(response(), null)).toEqual({ resolvedModel: null, used: null, compactionWindow: null, categories: [] });
    const invalid: Partial<SDKControlGetContextUsageResponse>[] = [
      { model: '' }, { totalTokens: NaN }, { rawMaxTokens: 0 },
      { categories: [row('used', -1)] }, { categories: [row('used', Number.MAX_SAFE_INTEGER), row('used', 1)] },
      { categories: Array.from({ length: CONTEXT_LIMITS.categories + 1 }, () => row('used', 1)) },
    ];
    for (const change of invalid) expect(() => normalizeClaudeSummary({ ...response(), ...change }, null)).toThrow();
    for (const field of ['model', 'totalTokens', 'rawMaxTokens', 'categories']) {
      const value = response(); Reflect.deleteProperty(value, field);
      expect(() => normalizeClaudeSummary(value, null)).toThrow();
    }
  });
  it('rejects model mismatches and malformed kinds without manufacturing a resolved identity', () => {
    expect(() => normalizeClaudeSummary(response(), 'requested-alias')).toThrow('Claude context model does not match the host resolved model.');
    const value = response();
    value.categories = [{ ...row('used', 1), kind: 'unknown' } as unknown as SDKControlGetContextUsageResponse['categories'][number]];
    expect(() => normalize(value)).toThrow();
    expect(() => normalizeClaudeSummary(value, null)).toThrow();
  });
  it('rejects invalid numbers for each reading instead of returning partial values', () => {
    for (const bad of [NaN, Infinity, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => normalize({ ...response(), totalTokens: bad })).toThrow();
      expect(() => normalize({ ...response(), rawMaxTokens: bad })).toThrow();
      expect(() => normalize({ ...response(), categories: [row('used', bad)] })).toThrow();
    }
    expect(() => normalize({ ...response(), rawMaxTokens: 0 })).toThrow();
  });
  it('enforces the input row budget and safe per-kind sums without truncation', () => {
    const value = response();
    value.categories = Array.from({ length: CONTEXT_LIMITS.categories }, () => row('used', 1));
    expect(normalize(value).categories).toEqual([{ kind: 'used', tokens: 32 }]);
    value.categories.push(row('used', 1));
    expect(() => normalize(value)).toThrow('category budget');
    value.categories = [row('used', Number.MAX_SAFE_INTEGER), row('used', 1)];
    expect(() => normalize(value)).toThrow();
    value.categories = [];
    expect(normalize(value).categories).toEqual([]);
  });
  it('reads no names, private metadata, billing or capacity substitutes and emits no fake references', () => {
    const value = response();
    const forbid = (target: object, keys: string[]) => keys.forEach(key => Object.defineProperty(target, key, { get() { throw new Error(`Forbidden read: ${key}`); } }));
    forbid(value, ['maxTokens', 'percentage', 'memoryFiles', 'mcpTools', 'agents', 'skills', 'gridRows', 'apiUsage', 'isAutoCompactEnabled']);
    value.categories.forEach(category => forbid(category, ['name', 'color', 'isDeferred']));
    const result = normalize(value);
    expect(Object.keys(result).sort()).toEqual(['categories', 'compactionWindow', 'resolvedModel', 'used']);
    expect(result.categories.every(category => Object.keys(category).sort().join(',') === 'kind,tokens')).toBe(true);
    expect(JSON.stringify(result)).not.toMatch(/PRIVATE|evidenceRef|modelCapacity|apiUsage/);
    expect(new TextEncoder().encode(JSON.stringify(result)).byteLength).toBeLessThan(512);
  });
  it('detaches normalized arrays and rows from caller mutations in either direction', () => {
    const value = response();
    const result = normalize(value);
    value.categories[0]!.tokens = 1;
    value.categories.reverse(); value.totalTokens = 1;
    expect(result.used).toBe(600);
    expect(result.categories[0]).toEqual({ kind: 'used', tokens: 600 });
    result.categories[0]!.tokens = 999;
    expect(value.categories.find(category => category.kind === 'used')!.tokens).toBe(1);
    expect(normalize().categories[0]!.tokens).toBe(600);
  });
});
