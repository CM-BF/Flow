import { EventEmitter } from 'node:events';
import type { Pool, PoolClient } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { HttpError, transaction } from './database.js';

type Checkout = (error: Error | undefined, client: PoolClient | undefined, release: () => void) => void;

class FakeClient extends EventEmitter {
  readonly statements: string[] = [];
  readonly releases: boolean[] = [];
  execute: (statement: string) => Promise<unknown> = async () => ({ rows: [] });
  onRelease: (destroy: boolean) => void = () => undefined;

  query(statement: string): Promise<unknown> {
    this.statements.push(statement);
    return this.execute(statement);
  }
  release(destroy = false): void {
    this.releases.push(destroy);
    this.onRelease(destroy);
  }
  asClient(): PoolClient { return this as unknown as PoolClient; }
}

class FakePool {
  readonly idleError = vi.fn();
  acquireError: Error | undefined;
  afterCheckout: () => void = () => undefined;
  handoff: (() => void) | undefined;

  constructor(readonly client = new FakeClient()) {
    client.on('error', this.idleError);
    client.onRelease = () => {
      client.on('error', this.idleError);
      const next = this.handoff;
      this.handoff = undefined;
      next?.();
    };
  }

  // Both forms let the same public tests exercise the old promise checkout.
  connect(callback?: Checkout): Promise<PoolClient> | void {
    if (this.acquireError) {
      if (callback) callback(this.acquireError, undefined, () => undefined);
      else return Promise.reject(this.acquireError);
      return;
    }
    this.client.removeListener('error', this.idleError);
    if (callback) callback(undefined, this.client.asClient(), () => this.client.release());
    const result = callback ? undefined : Promise.resolve(this.client.asClient());
    this.afterCheckout();
    return result;
  }
  asPool(): Pool { return this as unknown as Pool; }
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function observe<T>(promise: Promise<T>) {
  return promise.then(value => ({ ok: true as const, value }), error => ({ ok: false as const, error }));
}

describe('public transaction connection lifetime', () => {
  it.each([false, true])('preserves result and healthy transaction mode readOnly=%s', async readOnly => {
    const pool = new FakePool();
    const value = { committed: true };
    const run = vi.fn(async (client: PoolClient) => {
      expect(client).toBe(pool.client);
      await client.query('BUSINESS');
      return value;
    });
    expect(await transaction(pool.asPool(), run, readOnly)).toBe(value);
    expect(run).toHaveBeenCalledTimes(1);
    expect(pool.client.statements).toEqual([readOnly ? 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY' : 'BEGIN', 'BUSINESS', 'COMMIT']);
    expect(pool.client.releases).toEqual([false]);
    expect(pool.client.listeners('error')).toEqual([pool.idleError]);
  });

  it('preserves acquisition failure without invoking work or releasing a missing client', async () => {
    const pool = new FakePool();
    const failure = new Error('acquisition failed');
    pool.acquireError = failure;
    const run = vi.fn();
    await expect(transaction(pool.asPool(), run)).rejects.toBe(failure);
    expect(run).not.toHaveBeenCalled();
    expect(pool.client.releases).toEqual([]);
    expect(pool.client.statements).toEqual([]);
  });

  it('covers fatal error immediately after checkout callback before its promise continuation', async () => {
    const pool = new FakePool();
    const failure = new Error('checkout connection lost');
    pool.afterCheckout = () => pool.client.emit('error', failure);
    const run = vi.fn();
    await expect(transaction(pool.asPool(), run)).rejects.toBe(failure);
    expect(run).not.toHaveBeenCalled();
    expect(pool.client.statements).toEqual([]);
    expect(pool.client.releases).toEqual([true]);
    expect(pool.client.listeners('error')).toEqual([pool.idleError]);
  });

  it('retains a failed borrowed client until pending work settles and never runs it twice', async () => {
    const pool = new FakePool();
    const entered = deferred<void>(), finished = deferred<string>();
    const firstFailure = new Error('idle borrowed disconnect');
    const run = vi.fn(async () => { entered.resolve(); return finished.promise; });
    const outcome = observe(transaction(pool.asPool(), run));
    await entered.promise;
    expect(() => pool.client.emit('error', firstFailure)).not.toThrow();
    expect(() => pool.client.emit('error', new Error('later disconnect'))).not.toThrow();
    expect(pool.client.releases).toEqual([]);
    finished.resolve('late callback result');
    expect(await outcome).toEqual({ ok: false, error: firstFailure });
    expect(run).toHaveBeenCalledTimes(1);
    expect(pool.client.statements).toEqual(['BEGIN']);
    expect(pool.client.releases).toEqual([true]);
  });

  it('preserves fatal active-query failure and allows a later independent healthy transaction', async () => {
    const pool = new FakePool();
    const failure = new Error('query connection lost');
    pool.client.execute = async statement => {
      if (statement === 'BUSINESS') {
        pool.client.emit('error', failure);
        throw failure;
      }
      return { rows: [] };
    };
    const run = vi.fn(async client => { await client.query('BUSINESS'); });
    await expect(transaction(pool.asPool(), run)).rejects.toBe(failure);
    expect(run).toHaveBeenCalledTimes(1);
    expect(pool.client.statements).toEqual(['BEGIN', 'BUSINESS']);
    expect(pool.client.releases).toEqual([true]);
    const recovered = new FakePool();
    expect(await transaction(recovered.asPool(), async () => 'healthy')).toBe('healthy');
    expect(recovered.client.releases).toEqual([false]);
  });

  it.each([false, true])('retains unknown COMMIT failure when rollback also fails=%s', async rollbackFails => {
    const pool = new FakePool();
    const failure = new Error('COMMIT acknowledgement lost');
    let applied = false;
    pool.client.execute = async statement => {
      if (statement === 'COMMIT') { applied = true; throw failure; }
      if (statement === 'ROLLBACK' && rollbackFails) throw new Error('rollback also failed');
      return { rows: [] };
    };
    const run = vi.fn(async () => 'result');
    await expect(transaction(pool.asPool(), run)).rejects.toBe(failure);
    expect(applied).toBe(true); // Cleanup cannot establish whether COMMIT took effect.
    expect(run).toHaveBeenCalledTimes(1);
    expect(pool.client.statements).toEqual(['BEGIN', 'COMMIT', 'ROLLBACK']);
    expect(pool.client.releases).toEqual([true]);
  });

  it('keeps an acknowledged COMMIT result when an error arrives before the await resumes', async () => {
    const pool = new FakePool();
    pool.client.execute = statement => {
      const result = Promise.resolve({ rows: [] });
      if (statement === 'COMMIT') pool.client.emit('error', new Error('disconnected after ACK'));
      return result;
    };
    expect(await transaction(pool.asPool(), async () => 'acknowledged')).toBe('acknowledged');
    expect(pool.client.statements).toEqual(['BEGIN', 'COMMIT']);
    expect(pool.client.releases).toEqual([true]);
  });

  it('preserves HttpError and reuses a healthy client after rollback', async () => {
    const pool = new FakePool();
    const failure = new HttpError(409, 'conflict', 'Expected conflict');
    await expect(transaction(pool.asPool(), async () => { throw failure; })).rejects.toBe(failure);
    expect(pool.client.statements).toEqual(['BEGIN', 'ROLLBACK']);
    expect(pool.client.releases).toEqual([false]);
    expect(await transaction(pool.asPool(), async () => 'next')).toBe('next');
    expect(pool.client.releases).toEqual([false, false]);
    expect(pool.client.listeners('error')).toEqual([pool.idleError]);
  });

  it.each([undefined, null])('retains a non-Error work failure %s despite rollback and release errors', async failure => {
    const pool = new FakePool();
    pool.client.execute = async statement => {
      if (statement === 'ROLLBACK') throw new Error('rollback failure');
      return { rows: [] };
    };
    pool.client.onRelease = () => { throw new Error('release failure'); };
    expect(await observe(transaction(pool.asPool(), async () => { throw failure; }))).toEqual({ ok: false, error: failure });
    expect(pool.client.releases).toEqual([true]);
    expect(pool.client.listeners('error')).toEqual([]);
  });

  it('keeps the business failure when connection error occurs during rollback', async () => {
    const pool = new FakePool();
    const failure = new HttpError(409, 'conflict', 'Business rejected');
    pool.client.execute = async statement => {
      if (statement === 'ROLLBACK') {
        const cleanupFailure = new Error('disconnect during rollback');
        pool.client.emit('error', cleanupFailure);
        throw cleanupFailure;
      }
      return { rows: [] };
    };
    await expect(transaction(pool.asPool(), async () => { throw failure; })).rejects.toBe(failure);
    expect(pool.client.releases).toEqual([true]);
  });

  it('handles BEGIN rejection without running work and keeps its failure if rollback rejects', async () => {
    const pool = new FakePool();
    const failure = new Error('BEGIN failed');
    pool.client.execute = async statement => { throw statement === 'BEGIN' ? failure : new Error('cleanup failed'); };
    const run = vi.fn();
    await expect(transaction(pool.asPool(), run)).rejects.toBe(failure);
    expect(run).not.toHaveBeenCalled();
    expect(pool.client.releases).toEqual([true]);
  });

  it('leaves the next borrower protected during synchronous release handoff', async () => {
    const pool = new FakePool();
    const failure = new Error('next borrower disconnected');
    const nextRun = vi.fn(async () => 'must not run');
    let nextOutcome: ReturnType<typeof observe<string>> | undefined;
    pool.handoff = () => {
      pool.afterCheckout = () => pool.client.emit('error', failure);
      nextOutcome = observe(transaction(pool.asPool(), nextRun));
    };
    expect(await transaction(pool.asPool(), async () => 'first ACK')).toBe('first ACK');
    expect(await nextOutcome).toEqual({ ok: false, error: failure });
    expect(nextRun).not.toHaveBeenCalled();
    expect(pool.client.releases).toEqual([false, true]);
    expect(pool.client.listeners('error')).toEqual([pool.idleError]);
  });
});
