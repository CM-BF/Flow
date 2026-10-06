import type { SDKControlGetContextUsageResponse } from '@anthropic-ai/claude-agent-sdk';
import { afterEach, expect, it, vi } from 'vitest';
import { contextObservationPayloadSchema } from '../../../../packages/contracts/src/context-observation-event.js';
import { readClaudeSummary } from './claude-summary-read.js';

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
const response = (): SDKControlGetContextUsageResponse => ({
  totalTokens: 120, rawMaxTokens: 1000, maxTokens: 900, percentage: 12, model: 'resolved-model',
  categories: [{ kind: 'used', tokens: 120, name: 'PRIVATE', color: 'PRIVATE' }],
  gridRows: [], memoryFiles: [], mcpTools: [], agents: [], isAutoCompactEnabled: true, apiUsage: null,
});
function input(controller = new AbortController()) {
  return { signal: controller.signal, resolvedModel: 'resolved-model' as string | null,
    nativeSessionId: 'session-1', observationId: 'observation-1' };
}

it('requests only summary with receiver binding and publishes only allowlisted detached values', async () => {
  const raw = response();
  for (const key of ['memoryFiles', 'mcpTools', 'agents', 'gridRows', 'maxTokens', 'percentage']) {
    Object.defineProperty(raw, key, { get() { throw new Error('Private field read'); } });
  }
  const reader = { getContextUsage: vi.fn(async function (this: unknown, options: unknown) {
    expect(this).toBe(reader); expect(options).toEqual({ detail: 'summary' }); return raw;
  }) };
  const result = await readClaudeSummary(reader, input());
  expect(reader.getContextUsage).toHaveBeenCalledTimes(1);
  expect(result.kind).toBe('available');
  if (result.kind !== 'available') throw new Error('Expected observation');
  expect(contextObservationPayloadSchema.safeParse(result.observation).success).toBe(true);
  raw.categories[0]!.tokens = 999;
  expect(result.observation.categories).toEqual([{ kind: 'used', tokens: 120 }]);
  expect(JSON.stringify(result)).not.toMatch(/PRIVATE|memoryFiles|hardCapacity|evidenceRef/);
});

it.each([0, 1200])('preserves consumption %i without clamping to the policy window', async used => {
  const raw = response(); raw.totalTokens = used;
  expect(await readClaudeSummary({ async getContextUsage() { return raw; } }, input()))
    .toMatchObject({ kind: 'available', observation: { used, compactionWindow: 1000 } });
});

it.each(['wrong-model', 'negative', 'rows', 'kind-overflow', 'cross-kind-overflow'] as const)('rejects %s before publication', async failure => {
  const raw = response();
  if (failure === 'wrong-model') raw.model = 'other';
  if (failure === 'negative') raw.totalTokens = -1;
  if (failure === 'rows') raw.categories = Array.from({ length: 33 }, () => raw.categories[0]!);
  if (failure === 'kind-overflow') raw.categories = [
    { kind: 'used', tokens: Number.MAX_SAFE_INTEGER, name: '', color: '' },
    { kind: 'used', tokens: 1, name: '', color: '' },
  ];
  if (failure === 'cross-kind-overflow') raw.categories = [
    { kind: 'used', tokens: Number.MAX_SAFE_INTEGER, name: '', color: '' },
    { kind: 'free', tokens: 1, name: '', color: '' },
  ];
  expect(await readClaudeSummary({ async getContextUsage() { return raw; } }, input())).toEqual({ kind: 'unavailable' });
});

it('excludes deferred values from the public category sum', async () => {
  const raw = response(); raw.categories.push({ kind: 'deferred', tokens: Number.MAX_SAFE_INTEGER, name: '', color: '' });
  expect(await readClaudeSummary({ async getContextUsage() { return raw; } }, input())).toMatchObject({ kind: 'available' });
});

it('keeps unknown host identity unknown despite a valid SDK model', async () => {
  expect(await readClaudeSummary({ async getContextUsage() { return response(); } }, { ...input(), resolvedModel: null }))
    .toMatchObject({ kind: 'available', observation: { resolvedModel: null, used: null, compactionWindow: null, categories: [] } });
});

it.each(['negative', 'cross-kind-overflow'] as const)('still rejects %s when the host model is unknown', async failure => {
  const raw = response();
  if (failure === 'negative') raw.totalTokens = -1;
  else raw.categories.push({ kind: 'free', tokens: Number.MAX_SAFE_INTEGER, name: '', color: '' });
  expect(await readClaudeSummary({ async getContextUsage() { return raw; } }, { ...input(), resolvedModel: null }))
    .toEqual({ kind: 'unavailable' });
});

it.each(['missing', 'throw', 'reject'] as const)('classifies a definite %s as unavailable without raw errors', async failure => {
  const reader = failure === 'missing' ? {} : { getContextUsage() {
    if (failure === 'throw') throw new Error('PRIVATE');
    return Promise.reject(new Error('PRIVATE'));
  } };
  expect(await readClaudeSummary(reader, input())).toEqual({ kind: 'unavailable' });
});

it('does not dispatch a pre-aborted control', async () => {
  const controller = new AbortController(); const reason = new Error('Cancelled'); controller.abort(reason);
  const getContextUsage = vi.fn(async () => response());
  await expect(readClaudeSummary({ getContextUsage }, input(controller))).rejects.toBe(reason);
  expect(getContextUsage).not.toHaveBeenCalled();
});

it.each(['deadline', 'abort'] as const)('reports a dispatched pending %s as unsettled and observes late rejection', async cause => {
  vi.useFakeTimers();
  const controller = new AbortController(); let reject!: (error: Error) => void;
  const remove = vi.spyOn(controller.signal, 'removeEventListener');
  const getContextUsage = vi.fn(() => new Promise<SDKControlGetContextUsageResponse>((_resolve, fail) => { reject = fail; }));
  const reading = readClaudeSummary({ getContextUsage }, input(controller));
  if (cause === 'deadline') { await vi.advanceTimersByTimeAsync(999); expect(vi.getTimerCount()).toBe(1); await vi.advanceTimersByTimeAsync(1); }
  else controller.abort();
  expect(await reading).toEqual({ kind: 'unsettled' });
  expect(getContextUsage).toHaveBeenCalledTimes(1); expect(vi.getTimerCount()).toBe(0);
  expect(remove).toHaveBeenCalledWith('abort', expect.any(Function));
  reject(new Error('PRIVATE late rejection')); await Promise.resolve(); await Promise.resolve();
});

it('cleans up the deadline and abort listener after a successful read', async () => {
  vi.useFakeTimers(); const controller = new AbortController();
  const remove = vi.spyOn(controller.signal, 'removeEventListener');
  expect(await readClaudeSummary({ async getContextUsage() { return response(); } }, input(controller))).toMatchObject({ kind: 'available' });
  expect(vi.getTimerCount()).toBe(0); expect(remove).toHaveBeenCalledWith('abort', expect.any(Function));
  controller.abort();
});
