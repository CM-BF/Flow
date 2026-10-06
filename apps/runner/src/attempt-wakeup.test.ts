import { afterEach, expect, it, vi } from 'vitest';
import { getEventListeners } from 'node:events';
import { AttemptWakeup } from './attempt-wakeup.js';

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

function pendingAttempt() {
  let resolve!: () => void, reject!: (error: Error) => void;
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

it('documents 32 subscriptions per pending attempt in the fixed old wait expression', async () => {
  vi.useFakeTimers();
  const attempts = [new Promise<void>(() => undefined), new Promise<void>(() => undefined)];
  const subscriptions = attempts.map(attempt => vi.spyOn(attempt, 'then'));
  // Exact subscription-bearing part of the old wait; timer cancellation is immaterial here.
  for (let tick = 0; tick < 32; tick++) {
    const waiting = Promise.race([new Promise<void>(resolve => setTimeout(resolve, 5)), ...attempts]);
    await vi.advanceTimersByTimeAsync(5); await waiting;
  }
  expect(subscriptions.map(subscription => subscription.mock.calls.length)).toEqual([32, 32]);
});

it('keeps real Module subscriptions, timers and abort listeners bounded across 32 ticks', async () => {
  vi.useFakeTimers();
  const controller = new AbortController(), wakeup = new AttemptWakeup(controller.signal, 5);
  const attempts = [pendingAttempt(), pendingAttempt()];
  const subscriptions = attempts.map(attempt => vi.spyOn(attempt.promise, 'then'));
  try {
    attempts.forEach(attempt => wakeup.track(attempt.promise));
    for (let tick = 0; tick < 32; tick++) {
      const waiting = wakeup.wait();
      expect(vi.getTimerCount()).toBe(1);
      expect(getEventListeners(controller.signal, 'abort')).toHaveLength(1);
      await vi.advanceTimersByTimeAsync(5); await waiting;
      expect(vi.getTimerCount()).toBe(0);
      expect(getEventListeners(controller.signal, 'abort')).toHaveLength(0);
    }
    expect(subscriptions.map(subscription => subscription.mock.calls.length)).toEqual([1, 1]);
  } finally { wakeup.close(); attempts.forEach(attempt => attempt.resolve()); }
});

it.each(['resolve', 'reject'] as const)('wakes immediately when a tracked completion %ss', async outcome => {
  vi.useFakeTimers();
  const controller = new AbortController(), wakeup = new AttemptWakeup(controller.signal, 1000);
  const attempt = pendingAttempt(); wakeup.track(attempt.promise);
  try {
    const waiting = wakeup.wait();
    if (outcome === 'resolve') attempt.resolve(); else attempt.reject(new Error('Already handled by runtime'));
    await waiting;
    expect(vi.getTimerCount()).toBe(0);
    expect(getEventListeners(controller.signal, 'abort')).toHaveLength(0);
  } finally { wakeup.close(); }
});

it('coalesces completions before waiting into one pending notification', async () => {
  vi.useFakeTimers();
  const wakeup = new AttemptWakeup(new AbortController().signal, 5);
  try {
    wakeup.track(Promise.resolve()); wakeup.track(Promise.resolve()); await Promise.resolve();
    await wakeup.wait(); expect(vi.getTimerCount()).toBe(0);
    const waiting = wakeup.wait(); expect(vi.getTimerCount()).toBe(1);
    await vi.advanceTimersByTimeAsync(5); await waiting;
  } finally { wakeup.close(); }
});

it.each(['abort', 'close'] as const)('%s releases a waiting loop and ignores later completion', async action => {
  vi.useFakeTimers();
  const controller = new AbortController(), wakeup = new AttemptWakeup(controller.signal, 5);
  const attempt = pendingAttempt(); wakeup.track(attempt.promise);
  try {
    const waiting = wakeup.wait();
    if (action === 'abort') controller.abort(); else wakeup.close();
    await waiting; attempt.resolve(); await Promise.resolve();
    await wakeup.wait();
    expect(vi.getTimerCount()).toBe(0);
    expect(getEventListeners(controller.signal, 'abort')).toHaveLength(0);
  } finally { wakeup.close(); attempt.resolve(); }
});

it('does not allocate resources for an already aborted signal or after close', async () => {
  vi.useFakeTimers();
  const controller = new AbortController(); controller.abort();
  const wakeup = new AttemptWakeup(controller.signal, 5);
  await wakeup.wait(); wakeup.close(); wakeup.close(); await wakeup.wait();
  expect(vi.getTimerCount()).toBe(0);
  expect(getEventListeners(controller.signal, 'abort')).toHaveLength(0);
});

it('rejects a second waiter without replacing the first or allocating another timer', async () => {
  vi.useFakeTimers();
  const controller = new AbortController(), wakeup = new AttemptWakeup(controller.signal, 5);
  const waiting = wakeup.wait();
  try {
    expect(() => wakeup.wait()).toThrow('single waiting admission loop');
    expect(vi.getTimerCount()).toBe(1);
    expect(getEventListeners(controller.signal, 'abort')).toHaveLength(1);
  } finally { wakeup.close(); await waiting; }
});
