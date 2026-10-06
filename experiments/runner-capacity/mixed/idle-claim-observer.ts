import type * as Fs from 'node:fs/promises';
import type { FileHandle } from 'node:fs/promises';
import { join } from 'node:path';

type Phase = 'begin' | 'accept-null';
type Operation = 'open-read' | 'open-temp' | 'open-directory' | 'writeFile' | 'file-sync'
  | 'directory-sync' | 'rename' | 'close-file' | 'close-directory';
interface Sample {
  operation: Operation; startedMs: number; endedMs?: number; succeeded?: boolean;
  phase?: Phase; bytes?: number; error?: 'ENOENT' | 'OTHER';
}
interface Options { now: () => number; onUnknown: () => void; maxSamples?: number; maxHandles?: number }
type Methods = Pick<typeof Fs, 'open' | 'rename'>;

/** Counts API settlement, never physical writes. Only one exact private journal is observed. */
export function observeIdleJournal(actual: Methods, directory: string, options: Options) {
  const temporary = join(directory, 'admission.json.tmp'), journal = join(directory, 'admission.json');
  const samples: Sample[] = [], commits: { phase: Phase; completedMs: number }[] = [];
  const counts: Partial<Record<Operation, { issued: number; succeeded: number; failed: number }>> = {};
  const handles = new Map<FileHandle, { directory: boolean; closed: boolean; originals: Map<string, PropertyDescriptor | undefined> }>();
  let unknown = false, restored = false, pendingPhase: Phase | undefined, renamedPhase: Phase | undefined;
  let activeOperations = 0, writeInputBytes = 0;
  const markUnknown = () => {
    if (unknown) return;
    unknown = true;
    try { options.onUnknown(); } catch { /* The observer must not replace the original operation result. */ }
  };
  const timestamp = () => {
    try { const value = options.now(); if (Number.isFinite(value) && value >= 0) return value; } catch { /* Unknown clock. */ }
    markUnknown(); return 0;
  };
  function observe<T>(operation: Operation, invoke: () => Promise<T>, after?: (value: T, sample: Sample) => void, inputBytes?: number): Promise<T> {
    const count = counts[operation] ??= { issued: 0, succeeded: 0, failed: 0 };
    count.issued++;
    let sample: Sample | undefined;
    if (samples.length < (options.maxSamples ?? 256)) { sample = { operation, startedMs: timestamp() }; samples.push(sample); }
    else markUnknown();
    if (inputBytes !== undefined) { writeInputBytes += inputBytes; if (sample) sample.bytes = inputBytes; }
    activeOperations++;
    const finish = (succeeded: boolean, value: unknown) => {
      activeOperations--;
      if (succeeded) count.succeeded++; else count.failed++;
      if (sample) {
        sample.endedMs = timestamp(); sample.succeeded = succeeded;
        if (!succeeded) sample.error = value instanceof Error && 'code' in value && value.code === 'ENOENT' ? 'ENOENT' : 'OTHER';
      }
      if (succeeded && after && sample) try { after(value as T, sample); } catch { markUnknown(); }
    };
    let pending: Promise<T>;
    try { pending = invoke(); } catch (error) { finish(false, error); throw error; }
    // Return the original promise. This registered handler runs before the caller's await continuation.
    void pending.then(value => finish(true, value), error => finish(false, error));
    return pending;
  }
  function patch(handle: FileHandle, isDirectory: boolean) {
    if (handles.has(handle)) return;
    if (handles.size >= (options.maxHandles ?? 64) || restored) { markUnknown(); return; }
    const record = { directory: isDirectory, closed: false, originals: new Map<string, PropertyDescriptor | undefined>() };
    handles.set(handle, record);
    function replace(name: 'writeFile' | 'sync' | 'close', operation: Operation, after?: (args: unknown[], sample: Sample) => void) {
      record.originals.set(name, Object.getOwnPropertyDescriptor(handle, name));
      const original = handle[name];
      Object.defineProperty(handle, name, { configurable: true, writable: true, value: function(this: FileHandle, ...args: unknown[]) {
        const bytes = name === 'writeFile' && typeof args[0] === 'string' ? Buffer.byteLength(args[0]) : undefined;
        if (name === 'writeFile' && bytes === undefined) markUnknown();
        return observe(operation, () => Reflect.apply(original, this, args) as Promise<unknown>, (_, sample) => after?.(args, sample), bytes);
      } });
    }
    if (!isDirectory) replace('writeFile', 'writeFile', (args, sample) => {
      const value = args[0];
      if (typeof value !== 'string' || Buffer.byteLength(value) > 65536) { markUnknown(); return; }
      const snapshot: unknown = JSON.parse(value);
      if (typeof snapshot !== 'object' || snapshot === null || !('version' in snapshot) || snapshot.version !== 1
        || !('assignments' in snapshot) || !Array.isArray(snapshot.assignments) || snapshot.assignments.length !== 0
        || !('inFlight' in snapshot) || !(snapshot.inFlight === null || typeof snapshot.inFlight === 'string')) { markUnknown(); return; }
      if (pendingPhase || renamedPhase) markUnknown();
      pendingPhase = snapshot.inFlight === null ? 'accept-null' : 'begin';
      sample.phase = pendingPhase;
    });
    replace('sync', isDirectory ? 'directory-sync' : 'file-sync', (_, sample) => {
      sample.phase = isDirectory ? renamedPhase : pendingPhase;
      if (isDirectory) {
        if (!renamedPhase || sample.endedMs === undefined || commits.length >= 24) markUnknown();
        else commits.push({ phase: renamedPhase, completedMs: sample.endedMs });
        renamedPhase = undefined;
      }
    });
    replace('close', isDirectory ? 'close-directory' : 'close-file', () => { record.closed = true; });
  }
  const open: typeof Fs.open = function(this: unknown, ...args) {
    const file = args[0];
    if (file !== temporary && file !== journal && file !== directory) return Reflect.apply(actual.open, this, args) as ReturnType<typeof Fs.open>;
    const operation = file === directory ? 'open-directory' : file === temporary ? 'open-temp' : 'open-read';
    return observe(operation, () => Reflect.apply(actual.open, this, args) as ReturnType<typeof Fs.open>, handle => patch(handle, file === directory));
  };
  const rename: typeof Fs.rename = function(this: unknown, ...args) {
    if (args[0] !== temporary || args[1] !== journal) return Reflect.apply(actual.rename, this, args) as ReturnType<typeof Fs.rename>;
    return observe('rename', () => Reflect.apply(actual.rename, this, args) as ReturnType<typeof Fs.rename>, (_, sample) => {
      if (!pendingPhase || renamedPhase) markUnknown();
      renamedPhase = pendingPhase; pendingPhase = undefined; sample.phase = renamedPhase;
    });
  };
  return {
    open, rename,
    snapshot() {
      return { unknown, activeOperations, writeInputBytes, counts: structuredClone(counts), openHandles: [...handles.values()].filter(handle => !handle.closed).length,
        samples: samples.map(sample => ({ ...sample })), commits: commits.map(commit => ({ ...commit })),
        pendingPhase: pendingPhase ?? null, renamedPhase: renamedPhase ?? null };
    },
    restore() {
      restored = true;
      if (activeOperations || [...handles.values()].some(handle => !handle.closed)) markUnknown();
      for (const [handle, record] of handles) for (const [name, descriptor] of record.originals) {
        try { if (descriptor) Object.defineProperty(handle, name, descriptor); else Reflect.deleteProperty(handle, name); }
        catch { markUnknown(); }
      }
    },
  };
}
