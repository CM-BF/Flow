import assert from 'node:assert/strict';
import { AsyncLocalStorage } from 'node:async_hooks';
import crypto from 'node:crypto';
import { syncBuiltinESMExports } from 'node:module';

// The deliberate dynamic boundary is pg's overloaded query API, not a product abstraction.
type Query = (...args: any[]) => any;
export interface SqlObservation {
  sql: string; kind: string; succeeded: boolean; errorCode: string | null;
  elapsedMs: number; returnedRows: number; decodedRowsJsonUtf8Bytes: number;
  prefixContentUtf8Bytes: number;
}
export interface HashObservation { kind: 'expected-prefix' | 'other'; inputUtf8Bytes: number; computeMs: number }
export interface RequestWork {
  sql: SqlObservation[]; backgroundSql: SqlObservation[];
  hashes: HashObservation[]; instrumentationErrors: string[];
}
const prefixSql = "SELECT COALESCE(string_agg(data->>'text','' ORDER BY revision),'') AS content FROM flow.assistant_stream_patches WHERE stream_id=$1";
function sqlKind(text: string) {
  if (text === prefixSql) return 'prefix-read';
  if (/^COMMIT\b/i.test(text)) return 'commit';
  if (/^ROLLBACK\b/i.test(text)) return 'rollback';
  if (/^BEGIN\b/i.test(text)) return 'begin';
  return /^SELECT\b/i.test(text) ? 'select' : 'other';
}

/** Installs once in the dedicated experiment process; restore in outermost finally. */
export function installObserver(target: { query: Query }) {
  const originalQuery = target.query; const originalHash = crypto.createHash;
  const context = new AsyncLocalStorage<RequestWork>();
  let active: RequestWork | undefined;
  const expectedPrefixes = new WeakMap<RequestWork, Buffer>();
  target.query = function (this: unknown, ...args: any[]) {
    const window = active; const owner = context.getStore(); const started = performance.now();
    if (!window) return originalQuery.apply(this, args);
    if (typeof args[0]?.submit === 'function') {
      window.instrumentationErrors.push('unsupported-custom-query-object');
      return originalQuery.apply(this, args);
    }
    const text = String(typeof args[0] === 'string' ? args[0] : args[0]?.text ?? '').replace(/\s+/g, ' ').trim();
    let recorded = false;
    const record = (error: unknown, result?: any) => {
      if (recorded) return;
      recorded = true;
      try {
        const rows = Array.isArray(result) ? result.flatMap(part => Array.isArray(part?.rows) ? part.rows : []) : Array.isArray(result?.rows) ? result.rows : [];
        const kind = sqlKind(text);
        (owner === window ? window.sql : window.backgroundSql).push({
          sql: text, kind, succeeded: !error,
          errorCode: error && typeof (error as { code?: unknown }).code === 'string' ? (error as { code: string }).code : null,
          elapsedMs: performance.now() - started, returnedRows: rows.length,
          decodedRowsJsonUtf8Bytes: Buffer.byteLength(JSON.stringify(rows)),
          prefixContentUtf8Bytes: kind === 'prefix-read' ? rows.reduce((bytes: number, row: { content?: unknown }) => bytes + (typeof row.content === 'string' ? Buffer.byteLength(row.content) : 0), 0) : 0,
        });
      } catch { window.instrumentationErrors.push('query-observation-failed'); }
    };
    const wrap = (callback: Query) => function (this: unknown, error: unknown, result: unknown) { record(error, result); return callback.call(this, error, result); };
    if (typeof args.at(-1) === 'function') args[args.length - 1] = wrap(args.at(-1));
    else if (typeof args[0]?.callback === 'function' && typeof args[0]?.submit !== 'function') args[0] = { ...args[0], callback: wrap(args[0].callback) };
    const callbackForm = typeof args.at(-1) === 'function' || typeof args[0]?.callback === 'function';
    try {
      const pending = originalQuery.apply(this, args);
      if (pending?.then) return pending.then((result: unknown) => { record(null, result); return result; }, (error: unknown) => { record(error); throw error; });
      if (!callbackForm) window.instrumentationErrors.push('unsupported-query-return-form');
      return pending;
    } catch (error) { record(error); throw error; }
  };
  crypto.createHash = ((...args: Parameters<typeof originalHash>) => {
    const hash = originalHash(...args); const owner = context.getStore();
    if (args[0] !== 'sha256' || !owner || owner !== active) return hash;
    const expected = expectedPrefixes.get(owner)!; const update = hash.update; const digest = hash.digest;
    let inputUtf8Bytes = 0; let computeMs = 0; let matches = true;
    hash.update = function (this: crypto.Hash, data: crypto.BinaryLike, encoding?: BufferEncoding) {
      const bytes = typeof data === 'string' ? Buffer.from(data, encoding) : Buffer.from(data.buffer, data.byteOffset, data.byteLength);
      matches = matches && inputUtf8Bytes + bytes.length <= expected.length && bytes.equals(expected.subarray(inputUtf8Bytes, inputUtf8Bytes + bytes.length));
      inputUtf8Bytes += bytes.length;
      const started = performance.now();
      try { return (update as Query).call(this, data, encoding); }
      finally { computeMs += performance.now() - started; }
    } as typeof update;
    hash.digest = function (this: crypto.Hash, ...digestArgs: any[]) {
      const started = performance.now(); const result = (digest as Query).apply(this, digestArgs);
      computeMs += performance.now() - started;
      owner.hashes.push({ kind: matches && inputUtf8Bytes === expected.length ? 'expected-prefix' : 'other', inputUtf8Bytes, computeMs });
      return result;
    } as typeof digest;
    return hash;
  }) as typeof originalHash;
  syncBuiltinESMExports();
  return {
    begin(expectedPrefix: string): RequestWork {
      assert(!active, 'Only one measured request may be active.');
      active = { sql: [], backgroundSql: [], hashes: [], instrumentationErrors: [] };
      expectedPrefixes.set(active, Buffer.from(expectedPrefix));
      return active;
    },
    within<T>(work: RequestWork, operation: () => T): T { return context.run(work, operation); },
    end(work: RequestWork) { assert(active === work, 'Measurement window identity changed.'); active = undefined; },
    restore() { active = undefined; target.query = originalQuery; crypto.createHash = originalHash; syncBuiltinESMExports(); context.disable(); },
  };
}
