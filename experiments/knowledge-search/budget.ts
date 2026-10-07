import { lstatSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
export const LOCAL_LIMIT = 8 * 1024 * 1024;
export const RAW_LIMIT = 2 * 1024 * 1024;
export const WORK_RESERVE = 512 * 1024;
export const PARENT_RESERVE = 192 * 1024;
/** Counts only the new owned namespace and single run record; never scans historic KEEP. */
export function treeBytes(root: string): number {
  const info = lstatSync(root);
  if (!info.isDirectory() || info.isSymbolicLink()) throw new Error('BUDGET_IDENTITY');
  let bytes = 0, entries = 0;
  const walk = (path: string) => {
    for (const name of readdirSync(path)) {
      if (++entries > 10000) throw new Error('BUDGET_ENTRY_LIMIT');
      const child = join(path, name), entry = lstatSync(child);
      if (entry.isSymbolicLink()) throw new Error('BUDGET_IDENTITY');
      if (entry.isDirectory()) walk(child);
      else if (entry.isFile()) bytes += entry.size;
      else throw new Error('BUDGET_IDENTITY');
      if (bytes > LOCAL_LIMIT) throw new Error('LOCAL_STORAGE_LIMIT');
    }
  };
  walk(root); return bytes;
}
export function assertAggregate(baseBytes: number, retainedBytes: number, pendingBytes: number, reserve: number) {
  if (![baseBytes, retainedBytes, pendingBytes, reserve].every(n => Number.isSafeInteger(n) && n >= 0)) throw new Error('BUDGET_INPUT');
  if (retainedBytes + pendingBytes + reserve > RAW_LIMIT) throw new Error('RAW_STORAGE_LIMIT');
  if (baseBytes + retainedBytes + pendingBytes + reserve > LOCAL_LIMIT) throw new Error('LOCAL_STORAGE_LIMIT');
}
export class StorageBudget {
  constructor(readonly namespace: string, readonly record: string, readonly baseBytes: number,
    readonly pending: () => number) {}
  snapshot() { const retainedBytes = treeBytes(this.namespace) + treeBytes(this.record); return { baseBytes: this.baseBytes, retainedBytes, localBytes: this.baseBytes + retainedBytes }; }
  work() { const { retainedBytes } = this.snapshot(); assertAggregate(this.baseBytes, retainedBytes, this.pending(), WORK_RESERVE); }
  write(bytes: number) { const { retainedBytes } = this.snapshot(); assertAggregate(this.baseBytes, retainedBytes, bytes, PARENT_RESERVE); }
}
export function localAdminUrl(value: string): URL {
  const url = new URL(value);
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)
    || url.pathname !== '/postgres' || url.search !== '' || url.hash !== '') throw new Error('LOCAL_ADMIN_REQUIRED');
  return url;
}
