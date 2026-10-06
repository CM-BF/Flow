import type { SDKControlGetContextUsageResponse } from '@anthropic-ai/claude-agent-sdk';
import { describe, expect, it } from 'vitest';
import { CONTEXT_LIMITS, type ContextIdentity } from '../../../../packages/contracts/src/context-transparency.js';
import { projectContextSnapshot } from '../../../server/src/context-transparency/projection.js';
import { mapClaudeContextSummary, type ClaudeContextSummaryInput } from './claude-summary.js';

const time = '2026-10-06T09:20:00.000Z';
const digest = 'a'.repeat(64);
const identity = (): ContextIdentity => ({
  subject: { kind: 'attempt', taskId: 'task-1', attemptId: 'attempt-1', ownerVersion: 1, nativeSessionId: 'native-1' }, harness: 'claude',
  requestedModel: 'alias', resolvedModel: 'model-v1', profile: null,
  executionInputDigest: digest, materialRevisionDigest: digest, historyEpoch: 'epoch-1',
});
const row = (kind: SDKControlGetContextUsageResponse['categories'][number]['kind'], tokens: number) => ({ kind, tokens, name: 'PRIVATE TOOL NAME', color: 'PRIVATE COLOR' });
// Synthetic public SDK response shape. Creating this object never loads or runs the SDK.
const response = (): SDKControlGetContextUsageResponse => ({
  categories: [row('used', 600), row('free', 200), row('buffer', 50), row('deferred', 900)],
  totalTokens: 600, maxTokens: 700, rawMaxTokens: 800, percentage: 75, gridRows: [], model: 'model-v1',
  memoryFiles: [{ path: '/private/material', type: 'project', tokens: 12 }],
  mcpTools: [{ name: 'PRIVATE TOOL', serverName: 'PRIVATE SERVER', tokens: 50 }],
  agents: [{ agentType: 'PRIVATE AGENT', source: 'PRIVATE SOURCE', tokens: 20 }],
  skills: { totalSkills: 1, includedSkills: 1, tokens: 20, skillFrontmatter: [{ name: 'PRIVATE SKILL', source: 'PRIVATE SOURCE', tokens: 20 }] },
  isAutoCompactEnabled: true, apiUsage: { input_tokens: 9000, output_tokens: 7000, cache_creation_input_tokens: 1000, cache_read_input_tokens: 2000 },
});
const input = (): ClaudeContextSummaryInput => ({ identity: identity(), observationId: 'summary-1', observedAt: time, evidenceRef: { id: 'receipt-1', title: 'SDK summary receipt' }, requestDetail: 'summary', response: response() });
const project = (value = input(), current = value.identity, asOf = time) => projectContextSnapshot({ identity: current, asOf, materials: [], observation: mapClaudeContextSummary(value) });

describe('Claude summary response through the public context projection', () => {
  it('keeps SDK estimates, hard capacity unknown and policy remaining derived from two receipts', () => {
    const result = project();
    expect(result.used).toMatchObject({ kind: 'estimate', value: 600, measurementMethod: 'sdk-summary-estimate', source: { name: 'claude-sdk-context', version: '0.3.290' }, coverage: 'full' });
    expect(result.windows.modelHardLimit.limit.value).toBeNull();
    expect(result.windows.modelHardLimit.remaining.value).toBeNull();
    expect(result.windows.modelHardLimit.overflow.state).toBe('unknown');
    expect(result.windows.compactionPolicy.limit.value).toBe(800);
    expect(result.windows.compactionPolicy.remaining).toMatchObject({ kind: 'estimate', value: 200, measurementMethod: 'derived', derivedFrom: [
      { role: 'limit', value: 800, evidenceRef: { id: 'receipt-1' } }, { role: 'used', value: 600, evidenceRef: { id: 'receipt-1' } },
    ] });
    expect(result.identity.requestedModel).toBe('alias');
    expect(result.compression.state).toBe('not-observed');
  });
  it('preserves zero and unclamped over-limit usage without declaring hard-limit safety', () => {
    const value = input(); value.response.totalTokens = 0;
    expect(project(value).used.value).toBe(0);
    expect(project(value).windows.compactionPolicy.remaining.value).toBe(800);
    value.response.totalTokens = 1000;
    const result = project(value);
    expect(result.used.value).toBe(1000);
    expect(result.windows.compactionPolicy.overflow).toEqual({ state: 'exceeded', tokensOver: 200, kind: 'estimate' });
    expect(result.windows.compactionPolicy.remaining.value).toBe(0);
    expect(result.windows.modelHardLimit.overflow.state).toBe('unknown');
  });
  it('groups by explicit kind into stable IDs without using English labels or deferred flags', () => {
    const value = input(); value.response.categories.push({ ...row('used', 10), name: 'Free', isDeferred: true });
    const sample = mapClaudeContextSummary(value);
    expect(sample.categories).toEqual([
      { id: 'claude-summary-used', kind: 'used', tokens: 610 }, { id: 'claude-summary-free', kind: 'free', tokens: 200 },
      { id: 'claude-summary-buffer', kind: 'buffer', tokens: 50 }, { id: 'claude-summary-deferred', kind: 'deferred', tokens: 900 },
    ]);
    value.response.categories.reverse();
    expect(mapClaudeContextSummary(value).categories).toEqual(sample.categories);
    expect(project(value).used.value).toBe(600);
  });
  it('leaves an unresolved host model unknown and never fills it from the raw response', () => {
    const value = input(); value.identity.resolvedModel = null;
    const result = project(value);
    expect(result.identity.resolvedModel).toBeNull();
    expect(result.freshness).toEqual({ state: 'unknown', reason: 'identity-incomplete' });
    expect(result.used.value).toBeNull();
    expect(result.windows.compactionPolicy.remaining.value).toBeNull();
    expect(result.categories).toEqual([]);
  });
  it('rejects a mismatched model or harness without changing the host identity', () => {
    const value = input(); value.response.model = 'model-v2';
    expect(() => mapClaudeContextSummary(value)).toThrow('resolved model');
    expect(value.identity.resolvedModel).toBe('model-v1');
    value.identity.harness = 'fixture';
    expect(() => mapClaudeContextSummary(value)).toThrow('Claude host identity');
  });
  it.each(['requestedModel', 'resolvedModel', 'executionInputDigest', 'materialRevisionDigest', 'historyEpoch', 'subject'] as const)('invalidates changed %s in the public consumer', field => {
    const value = input(); const current = identity();
    if (field === 'subject') current.subject = { kind: 'attempt', taskId: 'task-1', attemptId: 'attempt-1', ownerVersion: 2, nativeSessionId: 'native-1' };
    else current[field] = field.includes('Digest') ? 'b'.repeat(64) : 'changed';
    const result = project(value, current);
    expect(result.freshness.reason).toBe('identity-changed');
    expect(result.used.value).toBeNull();
    expect(result.windows.compactionPolicy.overflow.state).toBe('unknown');
  });
  it.each(['draft', 'queued', 'missing-session'] as const)('rejects %s rather than treating a previous Query summary as pending input coverage', subject => {
    const value = input();
    if (subject === 'draft') value.identity.subject = { kind: 'draft', draftId: 'draft-1', settingsRevision: 'settings-1' };
    else if (subject === 'queued') value.identity.subject = { kind: 'queued', queueItemId: 'queue-1', settingsRevision: 'settings-1' };
    else value.identity.subject = { kind: 'attempt', taskId: 'task-1', attemptId: 'attempt-1', ownerVersion: 1, nativeSessionId: null };
    expect(() => project(value)).toThrow('attempt with a native session');
  });
  it('detaches the attempt identity and evidence from mutable host inputs', () => {
    const value = input();
    const sample = mapClaudeContextSummary(value);
    value.identity.subject = { kind: 'attempt', taskId: 'task-1', attemptId: 'attempt-1', ownerVersion: 2, nativeSessionId: 'native-2' };
    value.evidenceRef.title = 'changed';
    expect(sample.identity.subject).toEqual({ kind: 'attempt', taskId: 'task-1', attemptId: 'attempt-1', ownerVersion: 1, nativeSessionId: 'native-1' });
    expect(sample.used).toMatchObject({ evidenceRef: { title: 'SDK summary receipt' } });
    expect(projectContextSnapshot({ identity: value.identity, asOf: time, materials: [], observation: sample }).freshness.reason).toBe('identity-changed');
  });
  it('expires old or future observations instead of showing a safe remainder', () => {
    for (const [asOf, reason] of [['2026-10-06T09:20:31.000Z', 'expired'], ['2026-10-06T09:19:59.000Z', 'future-observation']]) {
      const result = project(input(), identity(), asOf);
      expect(result.freshness.reason).toBe(reason);
      expect(result.windows.compactionPolicy.remaining.value).toBeNull();
      expect(result.categories).toEqual([]);
    }
  });
  it('does not access names, paths, billing, grid, reserves or other non-allowlisted fields', () => {
    const value = input();
    const forbid = (target: object, keys: string[]) => keys.forEach(key => Object.defineProperty(target, key, { get() { throw new Error(`Forbidden read: ${key}`); } }));
    forbid(value.response, ['memoryFiles', 'mcpTools', 'agents', 'skills', 'gridRows', 'apiUsage', 'maxTokens', 'percentage', 'isAutoCompactEnabled', 'autoCompactThreshold', 'messageBreakdown', 'systemTools', 'systemPromptSections', 'deferredBuiltinTools', 'slashCommands']);
    value.response.categories.forEach(category => forbid(category, ['name', 'color', 'isDeferred']));
    const result = project(value);
    expect(result.used.value).toBe(600);
    expect(JSON.stringify(result)).not.toMatch(/PRIVATE|private\/material|apiUsage|input_tokens/);
    expect(new TextEncoder().encode(JSON.stringify(result)).byteLength).toBeLessThan(CONTEXT_LIMITS.responseBytes);
  });
  it.each([NaN, Infinity, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])('rejects invalid used tokens %s instead of partial success', bad => {
    const value = input(); value.response.totalTokens = bad;
    expect(() => mapClaudeContextSummary(value)).toThrow();
    value.response.totalTokens = 1; value.response.rawMaxTokens = bad;
    expect(() => mapClaudeContextSummary(value)).toThrow();
    value.response.rawMaxTokens = 800; value.response.categories = [row('used', bad)];
    expect(() => mapClaudeContextSummary(value)).toThrow();
  });
  it('rejects a zero policy window, overflow in kind totals and excess input rows without truncation', () => {
    const value = input(); value.response.rawMaxTokens = 0;
    expect(() => mapClaudeContextSummary(value)).toThrow();
    value.response.rawMaxTokens = 800; value.response.categories = [row('used', Number.MAX_SAFE_INTEGER), row('used', 1)];
    expect(() => mapClaudeContextSummary(value)).toThrow();
    value.response.categories = Array.from({ length: CONTEXT_LIMITS.categories }, () => row('used', 1));
    expect(mapClaudeContextSummary(value).categories).toEqual([{ id: 'claude-summary-used', kind: 'used', tokens: 32 }]);
    value.response.categories.push(row('used', 1));
    expect(() => mapClaudeContextSummary(value)).toThrow('category budget');
  });
  it('rejects missing or snake_case readings rather than manufacturing a full estimate', () => {
    for (const field of ['model', 'totalTokens', 'rawMaxTokens', 'categories']) {
      const value = input(); Reflect.deleteProperty(value.response, field);
      expect(() => mapClaudeContextSummary(value)).toThrow();
    }
    const value = input();
    value.response = { model: 'model-v1', total_tokens: 600, raw_max_tokens: 800, categories: [] } as unknown as SDKControlGetContextUsageResponse;
    expect(() => mapClaudeContextSummary(value)).toThrow();
  });
  it('accepts the safe integer boundary without dropping usage or inventing category contributions', () => {
    const value = input(); value.response.totalTokens = Number.MAX_SAFE_INTEGER;
    value.response.rawMaxTokens = Number.MAX_SAFE_INTEGER; value.response.categories = [];
    const result = project(value);
    expect(result.used.value).toBe(Number.MAX_SAFE_INTEGER);
    expect(result.windows.compactionPolicy.remaining.value).toBe(0);
    expect(result.windows.compactionPolicy.overflow).toEqual({ state: 'within', tokensOver: 0, kind: 'estimate' });
    expect(result.categories).toEqual([]);
  });
  it('rejects full or missing detail, invalid category kind and malformed host metadata', () => {
    for (const bad of ['full', undefined]) expect(() => mapClaudeContextSummary({ ...input(), requestDetail: bad } as unknown as ClaudeContextSummaryInput)).toThrow();
    const value = input(); value.response.categories = [{ ...row('used', 1), kind: 'unknown' } as unknown as SDKControlGetContextUsageResponse['categories'][number]];
    expect(() => mapClaudeContextSummary(value)).toThrow();
    for (const change of [{ observationId: 'x'.repeat(129) }, { observedAt: 'yesterday' }, { evidenceRef: { id: 'receipt', title: 'x'.repeat(181) } }]) {
      expect(() => mapClaudeContextSummary({ ...input(), ...change })).toThrow();
    }
  });
});
