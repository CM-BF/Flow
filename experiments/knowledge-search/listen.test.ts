import { afterEach, expect, test, vi } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DiagnosticProgress, timedQuery } from './diagnostic.js';
import { ListenLifecycle, StartupLifecycle } from './owned-database.js';
test('cancelling an unsettled listen never declares it settled', async () => {
  const owner = new ListenLifecycle();
  let finish!: (value: string) => void;
  const pending = owner.start(() => new Promise<string>(resolve => { finish = resolve; }));
  await Promise.resolve(); owner.cancel();
  expect(owner.controller.signal.aborted).toBe(true); expect(owner.settled).toBe(false);
  finish('synthetic-address'); expect(await pending).toBe('synthetic-address'); expect(owner.settled).toBe(true);
});
test('abort before delayed listen is observable and does not fabricate a binding', async () => {
  const owner = new ListenLifecycle(); let bound = false;
  const pending = owner.start(async signal => { if (signal.aborted) throw new Error('ABORTED_BEFORE_BIND'); bound = true; return 'synthetic'; });
  owner.cancel(); await expect(pending).rejects.toThrow('ABORTED_BEFORE_BIND');
  expect(bound).toBe(false); expect(owner.settled).toBe(true);
});
test('listen rejection settles explicitly and a second listen is rejected', async () => {
  const owner = new ListenLifecycle();
  await expect(owner.start(async () => { throw new Error('SYNTHETIC_LISTEN_FAILURE'); })).rejects.toThrow('SYNTHETIC_LISTEN_FAILURE');
  expect(owner.settled).toBe(true); expect(() => owner.start(async () => 'second')).toThrow('LISTEN_ALREADY_ATTEMPTED');
});

afterEach(() => vi.useRealTimers());
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function waitUntil(until: number) {
  return async <T>(pending: Promise<T>): Promise<T> => {
    const remaining = until - Date.now();
    if (remaining <= 0) throw new Error('SYNTHETIC_DEADLINE');
    let timer: ReturnType<typeof setTimeout> | undefined;
    try { return await Promise.race([pending, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('SYNTHETIC_DEADLINE')), remaining); })]); }
    finally { clearTimeout(timer); }
  };
}
test('work timeout on a pending import never starts its later factory and cleanup cannot call it settled', async () => {
  vi.useFakeTimers(); vi.setSystemTime(0);
  const owner = new StartupLifecycle<string>(); const loaded = deferred<() => Promise<string>>();
  let starts = 0;
  const work = owner.start(() => loaded.promise, waitUntil(70), () => {});
  const rejected = expect(work).rejects.toThrow('SYNTHETIC_DEADLINE');
  await vi.advanceTimersByTimeAsync(70); await rejected;
  expect(owner.loadSettled).toBe(false); expect(owner.attempted).toBe(false);
  const cleanup = owner.settle(waitUntil(110));
  await vi.advanceTimersByTimeAsync(40);
  expect(await cleanup).toHaveLength(1); expect(owner.loadSettled).toBe(false);
  loaded.resolve(async () => { starts++; return 'resource'; }); await Promise.resolve(); await Promise.resolve();
  expect(starts).toBe(0); expect(owner.value).toBeUndefined(); expect(owner.closing).toBe(true);
});
test('pending factory is joined through the cleanup deadline and its resource becomes available to close', async () => {
  vi.useFakeTimers(); vi.setSystemTime(0);
  const owner = new StartupLifecycle<{ close: () => void }>(); const resource = deferred<{ close: () => void }>();
  const work = owner.start(async () => () => resource.promise, waitUntil(70), () => {});
  const rejected = expect(work).rejects.toThrow('SYNTHETIC_DEADLINE');
  await vi.advanceTimersByTimeAsync(70); await rejected;
  expect(owner.loadSettled).toBe(true); expect(owner.settled).toBe(false);
  const cleanup = owner.settle(waitUntil(110)); const close = vi.fn();
  resource.resolve({ close });
  expect(await cleanup).toEqual([]); expect(owner.settled).toBe(true); owner.value!.close(); expect(close).toHaveBeenCalledOnce();
});
test('an unresolved factory at cleanup expiry remains unknown without a fabricated resource', async () => {
  vi.useFakeTimers(); vi.setSystemTime(0);
  const owner = new StartupLifecycle<string>(); const resource = deferred<string>();
  const work = owner.start(async () => () => resource.promise, waitUntil(70), () => {});
  const rejected = expect(work).rejects.toThrow('SYNTHETIC_DEADLINE'); await vi.advanceTimersByTimeAsync(70); await rejected;
  const cleanup = owner.settle(waitUntil(110)); await vi.advanceTimersByTimeAsync(40);
  expect(await cleanup).toHaveLength(1); expect(owner.settled).toBe(false); expect(owner.value).toBeUndefined();
});
test('expiry after import does not authorize a factory and original import rejection stays intact', async () => {
  const owner = new StartupLifecycle<string>(); let guards = 0; const create = vi.fn(async () => 'resource');
  await expect(owner.start(async () => create, async pending => pending, () => { if (++guards === 2) throw new Error('EXPIRED_AFTER_IMPORT'); })).rejects.toThrow('EXPIRED_AFTER_IMPORT');
  expect(create).not.toHaveBeenCalled(); expect(owner.attempted).toBe(false);
  const other = new StartupLifecycle<string>(); const failure = new Error('IMPORT_FAILURE');
  await expect(other.start(async () => { throw failure; }, async pending => pending, () => {})).rejects.toBe(failure);
  expect(other.loadSettled).toBe(true); expect(other.attempted).toBe(false);
});
test('progress keeps completed results and only the first error without rewriting the earlier bytes', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'k01-progress-'));
  try {
    const path = join(directory, 'progress.jsonl'); const progress = new DiagnosticProgress(path);
    await progress.record('gold-completed', { label: '中文', hits: 1 });
    const prefix = await readFile(path);
    await progress.failure({ code: 'ORIGINAL_WORK_FAILURE' });
    await progress.failure({ code: 'LATER_CLEANUP_FAILURE' });
    await progress.record('cleanup-result', { absent: false });
    const data = await readFile(path); expect(data.subarray(0, prefix.length)).toEqual(prefix);
    const records = data.toString().trim().split('\n').map(line => JSON.parse(line));
    expect(records.map(row => row.phase)).toEqual(['gold-completed', 'first-failure', 'cleanup-result']);
    expect(records[1].value.code).toBe('ORIGINAL_WORK_FAILURE'); expect(progress.firstFailure).toEqual({ code: 'ORIGINAL_WORK_FAILURE' });
    await expect(progress.record('too-large', 'x'.repeat(96 * 1024))).rejects.toThrow('PROGRESS_LIMIT');
    expect(await readFile(path)).toEqual(data);
  } finally { await rm(directory, { recursive: true }); }
});
test('query round-trip timing excludes guard scans and separately retains end-to-end overhead', async () => {
  let now = 0;
  const result = await timedQuery(() => { now += 7; }, async () => { now += 3; return { rows: ['a'] }; }, () => now);
  expect(result).toEqual({ value: { rows: ['a'] }, observerBeforeQueryMs: 7, clientSqlRoundTripMs: 3, clientEndToEndMs: 10 });
  const query = vi.fn(async () => 'should not run');
  await expect(timedQuery(() => { throw new Error('BUDGET_REJECTED'); }, query, () => now)).rejects.toThrow('BUDGET_REJECTED');
  expect(query).not.toHaveBeenCalled();
  const original = new Error('SQL_FAILED');
  await expect(timedQuery(() => {}, async () => { throw original; }, () => now)).rejects.toBe(original);
});
