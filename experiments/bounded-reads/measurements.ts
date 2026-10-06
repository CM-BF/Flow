import assert from 'node:assert/strict';
import { Client } from 'pg';

export function distribution(samples: number[]) {
  assert(samples.length > 0, 'Cannot summarize zero samples');
  const sorted = [...samples].sort((left, right) => left - right);
  const rank = (quantile: number) => sorted[Math.ceil(quantile * sorted.length) - 1]!;
  return { n: samples.length, min: sorted[0]!, p50: rank(0.5), p95: rank(0.95), p99: rank(0.99), max: sorted.at(-1)! };
}

/** Captures submitted SQL only; elapsed HTTP includes pool/SQL/serialization/network. */
export function captureProjectionQueries() {
  const original = Client.prototype.query;
  const queries = new Map<string, { text: string; values: unknown[] }>();
  Client.prototype.query = function (this: Client, ...args: unknown[]) {
    const sql = typeof args[0] === 'string' ? args[0] : '';
    if (sql.startsWith('INSERT INTO flow.workspace_feed')) queries.set(sql, { text: sql, values: args[1] as unknown[] });
    return Reflect.apply(original, this, args);
  } as typeof original;
  return { queries, restore() { Client.prototype.query = original; } };
}
