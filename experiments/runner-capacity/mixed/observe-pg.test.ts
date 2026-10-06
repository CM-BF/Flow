import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { observePg, type PgObservation } from './observe-pg.js';

test('promise connect/query preserve promise identity, receiver, value and original rejection object', async () => {
  const events: PgObservation[] = []; let clock = 0;
  const error = new Error('private details must never be emitted');
  const success = Promise.resolve({ rows: [] }); const failure = Promise.reject(error); void failure.catch(() => {});
  const client = { processID: 7, query(this: unknown, sql: string) { expect(this).toBe(client); return sql === 'bad' ? failure : success; } };
  const acquisition = Promise.resolve(client);
  const prototype = { connect(this: unknown) { expect(this).toBe(pool); return acquisition; } };
  const pool = Object.assign(Object.create(prototype), { options: { max: 8, statement_timeout: 10000 }, totalCount: 1, idleCount: 0, waitingCount: 2 });
  const originalQuery = client.query; const originalConnect = prototype.connect;
  const observation = observePg(prototype, value => events.push(value), () => clock++);
  expect(pool.connect()).toBe(acquisition); await acquisition;
  expect(client.query('BEGIN')).toBe(success); await success;
  expect(client.query('SELECT * FROM flow.runners WHERE id=$1 FOR UPDATE')).toBe(success); await success;
  expect(client.query('COMMIT')).toBe(success); await success;
  expect(client.query('bad')).toBe(failure); await expect(failure).rejects.toBe(error);
  expect(events.filter(value => value.kind === 'transaction')).toHaveLength(1);
  expect(events.some(value => value.category === 'runner-row')).toBe(true);
  expect(events.at(-1)?.outcome).toBe('error'); expect(JSON.stringify(events)).not.toContain('private details');
  observation.restore(); expect(prototype.connect).toBe(originalConnect); expect(client.query).toBe(originalQuery);
});

test('callback connect and query forward this, callback receiver/arguments, release and exact return once', () => {
  const events: PgObservation[] = []; const result = {}; const callbackThis = {}; const release = () => {};
  const row = { rows: [] }; let queryCalls = 0; let callbacks = 0;
  const client = { processID: 8, query(this: unknown, _sql: string, callback: (...args: unknown[]) => unknown) {
    expect(this).toBe(client); queryCalls++; callback.call(callbackThis, null, row); return result;
  } };
  const prototype = { connect(this: unknown, callback: (...args: unknown[]) => unknown) { expect(this).toBe(pool); callback.call(callbackThis, null, client, release); return result; } };
  const pool = Object.create(prototype); const observe = observePg(prototype, value => events.push(value));
  const callback = function(this: unknown, error: unknown, acquired: unknown, done: unknown) {
    expect(this).toBe(callbackThis); expect(error).toBeNull(); expect(acquired).toBe(client); expect(done).toBe(release); callbacks++;
  };
  expect(pool.connect(callback)).toBe(result); const wrapped = client.query;
  pool.connect(callback); expect(client.query).toBe(wrapped);
  expect(client.query('BEGIN', function(this: unknown, error, value) { expect(this).toBe(callbackThis); expect(error).toBeNull(); expect(value).toBe(row); })).toBe(result);
  expect(callbacks).toBe(2); expect(queryCalls).toBe(1); expect(events.filter(value => value.kind === 'sql')).toHaveLength(1); observe.restore();
});

test('callback error and synchronous throw preserve object identity; observer failure never changes behavior', () => {
  const error = new Error('secret'); let callbacks = 0; const result = {};
  const prototype = { connect(callback?: (error: Error) => void) { if (!callback) throw error; callback(error); return result; } };
  const pool = Object.create(prototype); const observer = observePg(prototype, () => { throw new Error('broken observer'); });
  expect(pool.connect((value: Error) => { callbacks++; expect(value).toBe(error); })).toBe(result);
  expect(() => pool.connect()).toThrow(error); expect(callbacks).toBe(1); expect(observer.dropped).toBe(2); observer.restore();
});


test('classifies the fixed P04 shared fence query through the observed client without broadening nearby SQL', async () => {
  const source = readFileSync(new URL('../../../apps/server/src/runners.ts', import.meta.url), 'utf8');
  const sql = source.match(/'([^']+FOR SHARE)'/)?.[1];
  expect(sql).toBe('SELECT id,revoked FROM flow.runners WHERE id=$1 FOR SHARE');
  const events: PgObservation[] = [];
  const client = { processID: 9, query(_sql: string) { return Promise.resolve({ rows: [] }); } };
  const prototype = { connect() { return Promise.resolve(client); } };
  const pool = Object.create(prototype);
  const observer = observePg(prototype, event => events.push(event));
  try {
    await pool.connect();
    await client.query(sql!);
    await client.query('SELECT * FROM flow.runners WHERE id=$1 FOR SHARE');
    await client.query('SELECT * FROM flow.runners WHERE id=$1 FOR UPDATE');
    await client.query('SELECT id,revoked FROM flow.other WHERE id=$1 FOR SHARE');
    expect(events.filter(event => event.kind === 'sql').map(event => event.category))
      .toEqual(['runner-row-share', 'other', 'runner-row', 'other']);
    expect(JSON.stringify(events)).not.toContain('SELECT');
  } finally { observer.restore(); }
});
