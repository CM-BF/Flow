import assert from 'node:assert/strict';
import type { Observation } from './processes.js';

export function quantiles(values: number[]) {
  assert(values.every(Number.isFinite), 'Non-finite sample cannot be discarded.');
  const ordered = [...values].sort((a, b) => a - b);
  const rank = (p: number) => ordered.length ? ordered[Math.ceil(p * ordered.length) - 1]! : null;
  return { n: ordered.length, p50: rank(0.5), p95: rank(0.95), p99: rank(0.99), method: 'nearest-rank' };
}

export function peak(intervals: { start: number; end: number }[]) {
  assert(intervals.every(i => Number.isFinite(i.start) && Number.isFinite(i.end) && i.end >= i.start));
  const edges = intervals.filter(i => i.end > i.start).flatMap(i => [{ time: i.start, delta: 1 }, { time: i.end, delta: -1 }]);
  edges.sort((a, b) => a.time - b.time || a.delta - b.delta);
  let active = 0; let maximum = 0;
  for (const edge of edges) { active += edge.delta; maximum = Math.max(maximum, active); }
  return maximum;
}

export function observedIntervals(observations: Observation[], kind: 'adapter' | 'tool' | 'wait', taskIds: string[]) {
  return taskIds.map(taskId => {
    const starts = observations.filter(o => o.kind === kind + '-start' && o.taskId === taskId);
    const ends = observations.filter(o => o.kind === kind + '-end' && o.taskId === taskId);
    assert.equal(starts.length, 1); assert.equal(ends.length, 1);
    const start = starts[0]!; const end = ends[0]!; assert.equal(start.pid, end.pid);
    return { taskId, pid: start.pid, start: start.receivedAtMs, end: end.receivedAtMs,
      childDurationMs: Number(end.monotonicMs) - Number(start.monotonicMs) };
  });
}
