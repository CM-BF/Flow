import { performance } from 'node:perf_hooks';
import type { Pool, PoolClient, QueryResult } from 'pg';
import { timedQuery } from './diagnostic.js';

export type QueryObservation = {
  text: string; values: unknown[]; clientEndToEndMs: number;
  clientSqlRoundTripMs?: number; observerBeforeQueryMs?: number;
  rows: number; decodedJsonBytes: number; error?: string;
};
type CheckoutCallback = Parameters<Pool['connect']>[0];

/** Observe this diagnostic's promise query calls without changing either pg checkout contract. */
export function observingPool(pool: Pool, guard: () => void, records: QueryObservation[]): Pool {
  function observeClient(client: PoolClient): PoolClient {
    return new Proxy(client, { get(target, property) {
      if (property === 'query') return async (text: string, values: unknown[] = []) => {
        const at = performance.now();
        try {
          const { value: result, ...timing } = await timedQuery(guard, () => target.query(text, values) as Promise<QueryResult>);
          records.push({ text, values, ...timing, rows: result.rowCount ?? 0, decodedJsonBytes: Buffer.byteLength(JSON.stringify(result.rows)) });
          return result;
        } catch (error) {
          records.push({ text, values, clientEndToEndMs: performance.now() - at, rows: 0, decodedJsonBytes: 0, error: 'QUERY_FAILED' });
          throw error;
        }
      };
      const value = Reflect.get(target, property);
      return typeof value === 'function' ? value.bind(target) : value;
    } });
  }
  return new Proxy(pool, { get(target, property) {
    if (property === 'connect') return (callback?: CheckoutCallback) => {
      // pg's callback borrower installs its error listener synchronously during checkout.
      if (callback) return target.connect((error, client, release) => callback(error, client ? observeClient(client) : client, release));
      return target.connect().then(observeClient);
    };
    const value = Reflect.get(target, property);
    return typeof value === 'function' ? value.bind(target) : value;
  } });
}
