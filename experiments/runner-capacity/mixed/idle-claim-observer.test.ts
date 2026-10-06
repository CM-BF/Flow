import type * as Fs from 'node:fs/promises';
import type { FileHandle } from 'node:fs/promises';
import { expect, test } from 'vitest';
import { observeIdleJournal } from './idle-claim-observer.js';

const directory = '/owned/idle/journal';
function fake() {
  const calls: { name: string; receiver: unknown; args: unknown[] }[] = [];
  const promises: Promise<unknown>[] = [];
  const makeHandle = () => ({
    writeFile(this: unknown, ...args: unknown[]) { calls.push({ name: 'writeFile', receiver: this, args }); return Promise.resolve(); },
    sync(this: unknown, ...args: unknown[]) { calls.push({ name: 'sync', receiver: this, args }); return Promise.resolve(); },
    close(this: unknown, ...args: unknown[]) { calls.push({ name: 'close', receiver: this, args }); return Promise.resolve(); },
  } as unknown as FileHandle);
  const handles: FileHandle[] = [];
  const actual = {
    open(...args: unknown[]) { calls.push({ name: 'open', receiver: this, args }); const handle = makeHandle(); handles.push(handle); const pending = Promise.resolve(handle); promises.push(pending); return pending; },
    rename(...args: unknown[]) { calls.push({ name: 'rename', receiver: this, args }); const pending = Promise.resolve(); promises.push(pending); return pending; },
  } as Pick<typeof Fs, 'open' | 'rename'>;
  let ticks = 0, unknowns = 0;
  const observer = observeIdleJournal(actual, directory, { now: () => ++ticks, onUnknown: () => { unknowns++; } });
  return { actual, observer, calls, handles, promises, get unknowns() { return unknowns; } };
}
test('counts one real API sequence without conflating file and directory sync or retaining JSON', async () => {
  const f = fake();
  const value = JSON.stringify({ version: 1, inFlight: 'synthetic-intent', assignments: [] });
  const openPending = f.observer.open(`${directory}/admission.json.tmp`, 'wx', 0o600);
  expect(openPending).toBe(f.promises[0]);
  const handle = await openPending;
  await handle.writeFile(value); await handle.sync(); await handle.close();
  const renamePending = f.observer.rename(`${directory}/admission.json.tmp`, `${directory}/admission.json`);
  expect(renamePending).toBe(f.promises[1]); await renamePending;
  expect(f.calls.find(call => call.name === 'open')?.receiver).toBe(f.observer);
  expect(f.calls.find(call => call.name === 'rename')?.receiver).toBe(f.observer);
  const dir = await f.observer.open(directory, 'r'); await dir.sync(); await dir.close();
  const snapshot = f.observer.snapshot();
  expect(snapshot.samples.map(sample => sample.operation)).toEqual(['open-temp', 'writeFile', 'file-sync', 'close-file', 'rename', 'open-directory', 'directory-sync', 'close-directory']);
  expect(snapshot.samples.every(sample => sample.succeeded)).toBe(true);
  expect(snapshot.commits).toEqual([{ phase: 'begin', completedMs: expect.any(Number) }]);
  expect(snapshot).toMatchObject({ unknown: false, activeOperations: 0, openHandles: 0, writeInputBytes: Buffer.byteLength(value) });
  expect(f.calls.find(call => call.name === 'writeFile')).toEqual({ name: 'writeFile', receiver: handle, args: [value] });
  expect(JSON.stringify(snapshot)).not.toContain('synthetic-intent');
  f.observer.restore(); expect(f.unknowns).toBe(0);
});
test('unrelated paths keep their promise and handle untouched', async () => {
  const f = fake(); const original = Promise.resolve({} as FileHandle);
  f.actual.open = () => original;
  expect(f.observer.open('/another/admission.json.tmp', 'r')).toBe(original);
  expect(await original).toEqual({}); expect(f.observer.snapshot().samples).toEqual([]);
  f.observer.restore();
});
test('preserves the original rejected promise/error and does not report a failed rename as a durable commit', async () => {
  const f = fake(); const error = new Error('synthetic failure'); const original = Promise.reject(error);
  f.actual.rename = () => original;
  const pending = f.observer.rename(`${directory}/admission.json.tmp`, `${directory}/admission.json`);
  expect(pending).toBe(original); await expect(pending).rejects.toBe(error);
  expect(f.observer.snapshot()).toMatchObject({ activeOperations: 0, commits: [], samples: [{ operation: 'rename', succeeded: false, error: 'OTHER' }] });
  f.observer.restore();
});
test('bounds records and marks unknown without suppressing the original call or rejecting with an observer error', async () => {
  const f = fake(); let called = 0;
  const actual = { ...f.actual, rename: () => { called++; return Promise.resolve(); } };
  const observer = observeIdleJournal(actual, directory, { now: () => 1, maxSamples: 1, onUnknown() { throw Error('observer'); } });
  await observer.rename(`${directory}/admission.json.tmp`, `${directory}/admission.json`);
  await observer.rename(`${directory}/admission.json.tmp`, `${directory}/admission.json`);
  expect(called).toBe(2); expect(observer.snapshot()).toMatchObject({ unknown: true, activeOperations: 0 });
  expect(observer.snapshot().counts.rename).toEqual({ issued: 2, succeeded: 2, failed: 0 });
  expect(observer.snapshot().samples).toHaveLength(1); observer.restore();
});
test('keeps initial ENOENT and counts attempted write bytes even when the original write fails', async () => {
  const f = fake(), missing = Object.assign(new Error('missing'), { code: 'ENOENT' });
  const realOpen = f.actual.open;
  f.actual.open = ((...args: Parameters<typeof Fs.open>) => args[0] === `${directory}/admission.json`
    ? Promise.reject(missing) : Reflect.apply(realOpen, f.actual, args)) as typeof Fs.open;
  await expect(f.observer.open(`${directory}/admission.json`, 'r')).rejects.toBe(missing);
  expect(f.observer.snapshot()).toMatchObject({ unknown: false, counts: { 'open-read': { issued: 1, succeeded: 0, failed: 1 } } });
  const error = new Error('write failure'), failed = Promise.reject(error);
  // Install the fake original before observation wraps this owned handle.
  const handle = { writeFile: () => failed, sync: () => Promise.resolve(), close: () => Promise.resolve() } as unknown as FileHandle;
  f.actual.open = () => Promise.resolve(handle);
  const observed = await f.observer.open(`${directory}/admission.json.tmp`, 'wx');
  const value = '{"version":1,"inFlight":null,"assignments":[]}';
  expect(observed.writeFile(value)).toBe(failed); await expect(failed).rejects.toBe(error);
  await observed.close();
  expect(f.observer.snapshot()).toMatchObject({ writeInputBytes: Buffer.byteLength(value), counts: { writeFile: { issued: 1, succeeded: 0, failed: 1 } }, commits: [] });
  f.observer.restore();
});
test('restores original handle methods and records unclosed handles as unknown', async () => {
  const f = fake(); const handle = await f.observer.open(`${directory}/admission.json.tmp`, 'wx');
  const wrapped = handle.sync; f.observer.restore();
  expect(handle.sync).not.toBe(wrapped); expect(f.observer.snapshot()).toMatchObject({ unknown: true, openHandles: 1 });
  await handle.close(); expect(f.unknowns).toBe(1);
});
