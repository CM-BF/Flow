import { EventEmitter } from 'node:events';
import type { Pool, PoolClient } from 'pg';
import { expect, test, vi } from 'vitest';
import { transaction } from './source/apps/server/src/database.js';
import { observingPool, type QueryObservation } from './observing-pool.js';

type CheckoutCallback = Parameters<Pool['connect']>[0];
class Borrowed extends EventEmitter {
  calls: string[] = [];
  releases: unknown[] = [];
  failure?: Error;
  async query(text: string) {
    expect(this).toBeInstanceOf(Borrowed);
    this.calls.push(text);
    if (text === 'SELECT value' && this.failure) throw this.failure;
    return { rows: text === 'SELECT value' ? [{ value: '中🙂' }] : [], rowCount: text === 'SELECT value' ? 1 : 0 };
  }
  release(discard?: unknown) {
    expect(this).toBeInstanceOf(Borrowed);
    this.releases.push(discard);
    this.emit('released');
  }
}
function fixture() {
  const client = new Borrowed(), records: QueryObservation[] = [];
  const done = vi.fn();
  const state = { checkoutError: undefined as Error | undefined, afterCheckout: () => {}, callbackCalls: 0, promiseCalls: 0 };
  const pool = {
    connect(callback?: CheckoutCallback) {
      expect(this).toBe(pool);
      if (callback) {
        state.callbackCalls++;
        callback(state.checkoutError, state.checkoutError ? undefined : client as unknown as PoolClient, done);
        state.afterCheckout();
        return;
      }
      state.promiseCalls++;
      return state.checkoutError ? Promise.reject(state.checkoutError) : Promise.resolve(client as unknown as PoolClient);
    },
  };
  const guard = vi.fn();
  return { client, records, done, state, guard, observed: observingPool(pool as unknown as Pool, guard, records) };
}
// Explicit microtasks keep a broken checkout from hanging this regression until a timeout.
async function settled<T>(promise: Promise<T>): Promise<T> {
  let finished = false;
  void promise.then(() => { finished = true; }, () => { finished = true; });
  for (let i = 0; i < 32 && !finished; i++) await Promise.resolve();
  expect(finished, 'production transaction must receive the checkout callback').toBe(true);
  return promise;
}

test('real production transaction completes callback checkout, observes queries and releases once', async () => {
  const f = fixture(); let listenersAtRelease = -1;
  f.client.on('released', () => { listenersAtRelease = f.client.listenerCount('error'); });
  const result = await settled(transaction(f.observed, async client => {
    expect(f.client.listenerCount('error')).toBe(1);
    return (await client.query('SELECT value')).rows;
  }, true));
  expect(result).toEqual([{ value: '中🙂' }]);
  expect(f.state.callbackCalls).toBe(1); expect(f.state.promiseCalls).toBe(0);
  expect(f.client.calls).toEqual(['BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY', 'SELECT value', 'COMMIT']);
  expect(f.records.map(row => row.text)).toEqual(f.client.calls);
  expect(f.records[1]?.decodedJsonBytes).toBe(Buffer.byteLength(JSON.stringify(result)));
  expect(f.guard).toHaveBeenCalledTimes(3); expect(f.client.releases).toEqual([false]);
  expect(listenersAtRelease).toBe(1); expect(f.client.listenerCount('error')).toBe(0);
});
test('callback checkout error reaches production transaction unchanged with no query or release', async () => {
  const f = fixture(), error = new Error('CHECKOUT_FAILURE'); f.state.checkoutError = error;
  await expect(settled(transaction(f.observed, async () => 'unreachable'))).rejects.toBe(error);
  expect(f.client.calls).toEqual([]); expect(f.client.releases).toEqual([]); expect(f.records).toEqual([]);
});
test('query failure preserves the original error, rolls back and releases exactly once', async () => {
  const f = fixture(), error = new Error('QUERY_FAILURE'); f.client.failure = error;
  await expect(settled(transaction(f.observed, client => client.query('SELECT value')))).rejects.toBe(error);
  expect(f.client.calls).toEqual(['BEGIN', 'SELECT value', 'ROLLBACK']);
  expect(f.records[1]?.error).toBe('QUERY_FAILED'); expect(f.client.releases).toEqual([false]);
  expect(f.client.listenerCount('error')).toBe(0);
});
test('a borrowed connection error immediately after checkout is owned before the next microtask', async () => {
  const f = fixture(), error = new Error('BORROWED_FAILURE');
  f.state.afterCheckout = () => { expect(f.client.listenerCount('error')).toBe(1); f.client.emit('error', error); };
  await expect(settled(transaction(f.observed, async () => 'unreachable'))).rejects.toBe(error);
  expect(f.client.calls).toEqual([]); expect(f.client.releases).toEqual([true]);
  expect(f.client.listenerCount('error')).toBe(0);
});
test('Promise checkout still returns an observed client with bound query and release methods', async () => {
  const f = fixture(), client = await f.observed.connect();
  await client.query('SELECT value'); client.release();
  expect(f.state.promiseCalls).toBe(1); expect(f.state.callbackCalls).toBe(0);
  expect(f.records.map(row => row.text)).toEqual(['SELECT value']); expect(f.client.releases).toEqual([undefined]);
});
test('callback third release function and checkout return remain the original values', () => {
  const f = fixture(); let seen = false;
  const result = f.observed.connect((error, client, release) => {
    expect(error).toBeUndefined(); expect(client).toBeDefined(); expect(release).toBe(f.done);
    release(true); seen = true;
  });
  expect(seen).toBe(true); expect(result).toBeUndefined(); expect(f.done).toHaveBeenCalledExactlyOnceWith(true);
});
test('Promise checkout error stays the original rejection and never invents a borrower', async () => {
  const f = fixture(), error = new Error('PROMISE_CHECKOUT_FAILURE'); f.state.checkoutError = error;
  await expect(f.observed.connect()).rejects.toBe(error);
  expect(f.client.calls).toEqual([]); expect(f.client.releases).toEqual([]);
});
