import { expect, it } from 'vitest';
import { observedIntervals, peak, quantiles } from './statistics.js';

it('reports nearest-rank quantiles including tiny samples and refuses invalid measurements', () => {
  expect(quantiles([9, 1, 5, 3])).toEqual({ n: 4, p50: 3, p95: 9, p99: 9, method: 'nearest-rank' });
  expect(quantiles(Array.from({ length: 16 }, (_, i) => i + 1))).toMatchObject({ n: 16, p50: 8, p95: 16, p99: 16 });
  expect(quantiles([])).toMatchObject({ n: 0, p50: null, p95: null, p99: null });
  expect(() => quantiles([1, NaN])).toThrow();
});

it('uses half-open intervals, ignores empty intervals, and counts independent overlap', () => {
  expect(peak([{ start: 0, end: 2 }, { start: 2, end: 3 }, { start: 1, end: 1 }])).toBe(1);
  expect(peak([{ start: 0, end: 5 }, { start: 1, end: 3 }, { start: 2, end: 4 }])).toBe(3);
  expect(() => peak([{ start: 3, end: 2 }])).toThrow();
});

it('keeps child duration separate from parent IPC intervals and rejects missing pairs', () => {
  const observations = [
    { kind: 'tool-start', pid: 10, receivedAtMs: 100, monotonicMs: 5, taskId: 'a' },
    { kind: 'tool-end', pid: 10, receivedAtMs: 109, monotonicMs: 8, taskId: 'a' },
  ];
  expect(observedIntervals(observations, 'tool', ['a'])).toEqual([{ taskId: 'a', pid: 10, start: 100, end: 109, childDurationMs: 3 }]);
  expect(() => observedIntervals(observations.slice(0, 1), 'tool', ['a'])).toThrow();
});
