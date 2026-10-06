import { AsyncLocalStorage } from 'node:async_hooks';
import crypto from 'node:crypto';
import { syncBuiltinESMExports } from 'node:module';
import { Client } from 'pg';

export interface SqlCount { count: number; decodedRowsJsonUtf8Bytes: number; returnedRows: number; elapsedMs: number }
export interface RequestWork { sql: Record<string, SqlCount>; backgroundSql: Record<string, SqlCount>; hashes: { inputBytes: number; computeMs: number }[] }
const context = new AsyncLocalStorage<RequestWork>();
export function withinRequest(work: RequestWork, done: () => void) { context.run(work, done); }
export function installInstrumentation() {
  const originalQuery = Client.prototype.query;
  const originalHash = crypto.createHash;
  let active: RequestWork | undefined;
  // pg supports both callback and Promise forms; preserve the chosen form and result/error identity.
  (Client.prototype as any).query = function (...args: any[]) {
    const owner = context.getStore(); const window = active; const started = performance.now();
    const text = String(typeof args[0] === 'string' ? args[0] : args[0]?.text ?? '').replace(/\s+/g, ' ').trim();
    const record = (result: any) => {
      if (!window || !result) return;
      const group = owner === window ? window.sql : window.backgroundSql;
      const kind = /^(BEGIN|COMMIT|ROLLBACK)/i.test(text) ? 'transaction' : /^SELECT/i.test(text) ? 'select' : 'other';
      const key = `${kind}: ${text.slice(0, 240)}`;
      const rows = result.rows ?? [];
      const value = group[key] ??= { count: 0, decodedRowsJsonUtf8Bytes: 0, returnedRows: 0, elapsedMs: 0 };
      value.count += 1; value.returnedRows += rows.length;
      value.decodedRowsJsonUtf8Bytes += Buffer.byteLength(JSON.stringify(rows));
      value.elapsedMs += performance.now() - started;
    };
    if (typeof args.at(-1) === 'function') {
      const callback = args.pop();
      args.push((error: unknown, result: unknown) => { record(result); callback(error, result); });
      return (originalQuery as any).apply(this, args);
    }
    const pending = (originalQuery as any).apply(this, args);
    return pending?.then ? pending.then((result: unknown) => { record(result); return result; }) : pending;
  };
  crypto.createHash = ((...args: Parameters<typeof originalHash>) => {
    const hash = originalHash(...args); const owner = context.getStore();
    if (args[0] !== 'sha256' || !owner || owner !== active) return hash;
    const update = hash.update; const digest = hash.digest;
    let inputBytes = 0; let computeMs = 0;
    hash.update = function (this: crypto.Hash, data: any, encoding?: any) {
      inputBytes += typeof data === 'string' ? Buffer.byteLength(data, encoding) : data.byteLength;
      const started = performance.now(); const result = update.call(this, data, encoding); computeMs += performance.now() - started; return result;
    } as typeof update;
    hash.digest = function (this: crypto.Hash, ...digestArgs: any[]) {
      const started = performance.now(); const result = (digest as any).apply(this, digestArgs); computeMs += performance.now() - started;
      owner.hashes.push({ inputBytes, computeMs }); return result;
    } as typeof digest;
    return hash;
  }) as typeof originalHash;
  syncBuiltinESMExports();
  return {
    begin(): RequestWork { active = { sql: {}, backgroundSql: {}, hashes: [] }; return active; },
    end() { active = undefined; },
    restore() { active = undefined; Client.prototype.query = originalQuery; crypto.createHash = originalHash; syncBuiltinESMExports(); },
  };
}
