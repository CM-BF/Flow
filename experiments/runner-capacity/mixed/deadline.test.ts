import { afterEach, expect, test, vi } from 'vitest';
import { beforeDeadline } from './deadline.js';
afterEach(() => vi.useRealTimers());
test('expired cleanup phase does not start another operation or label it successful', async () => {
  let calls = 0;
  expect(await beforeDeadline(10, async () => { calls++; }, () => 11)).toEqual({ state: 'unknown', reason: 'deadline-before-start' });
  expect(calls).toBe(0);
});
test('stalled cleanup returns unknown at its phase deadline; late completion does not rewrite it', async () => {
  vi.useFakeTimers(); let finish!: () => void;
  const result = beforeDeadline(100, () => new Promise<void>(resolve => { finish = resolve; }), () => 0);
  await vi.advanceTimersByTimeAsync(100);
  expect(await result).toEqual({ state: 'unknown', reason: 'deadline' }); finish();
  await Promise.resolve(); expect(await result).toEqual({ state: 'unknown', reason: 'deadline' });
});
test('a settled close and a failed operation are distinct without retaining error contents', async () => {
  expect(await beforeDeadline(100, async () => true, () => 0)).toEqual({ state: 'settled', value: true });
  expect(await beforeDeadline(100, async () => { throw new Error('secret'); }, () => 0)).toEqual({ state: 'unknown', reason: 'operation-failed' });
});
