import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

it('keeps completion subscriptions bounded over 32 polling ticks with two pending attempts', async () => {
  vi.useFakeTimers();
  const attempts = [new Promise<void>(() => undefined), new Promise<void>(() => undefined)];
  const subscriptions = attempts.map(attempt => vi.spyOn(attempt, 'then'));
  // Exact subscription-bearing part of the old wait; timer cancellation is immaterial here.
  for (let tick = 0; tick < 32; tick++) {
    const waiting = Promise.race([new Promise<void>(resolve => setTimeout(resolve, 5)), ...attempts]);
    await vi.advanceTimersByTimeAsync(5); await waiting;
  }
  expect(subscriptions.map(subscription => subscription.mock.calls.length)).toEqual([1, 1]);
});
