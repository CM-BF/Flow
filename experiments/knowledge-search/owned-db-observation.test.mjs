import { expect, test, vi } from 'vitest';
import { observeDatabase } from './owned-db-observation.mjs';
const expected = { database: 'flow_k01_query_' + 'a'.repeat(32), identity: { oid: '42', owner: 'synthetic', marker: '12345678-1234-1234-1234-123456789abc' } };
const url = 'postgres://synthetic:synthetic@127.0.0.1/postgres';
function fake({ rows = [{ name: expected.database, ...expected.identity, connections: 0 }], queryError, closeError, idleError } = {}) {
  let listener;
  const pool = { on: vi.fn((event, fn) => { expect(event).toBe('error'); listener = fn; }),
    query: vi.fn(async (sql, values) => { expect(sql).toMatch(/^SELECT d.datname/); expect(values).toEqual([expected.database]);
      if (idleError) listener(idleError); if (queryError) throw queryError; return { rows }; }),
    end: vi.fn(async () => { if (closeError) throw closeError; }) };
  const factory = vi.fn(options => { expect(options.max).toBe(1); expect(options.statement_timeout).toBe(1500); expect(options.query_timeout).toBe(1800); return pool; });
  return { pool, factory };
}
test.each([
  ['ZERO_CONNECTIONS_SNAPSHOT', [{ name: expected.database, ...expected.identity, connections: 0 }]],
  ['ACTIVE_CONNECTIONS_SNAPSHOT', [{ name: expected.database, ...expected.identity, connections: 2 }]],
  ['ABSENT_SNAPSHOT', []],
  ['IDENTITY_MISMATCH', [{ name: expected.database, ...expected.identity, oid: '43', connections: 0 }]],
])('classifies %s from exactly one query with closed admin', async (state, rows) => {
  const f = fake({ rows }); const result = await observeDatabase(f.factory, url, expected);
  expect(result.state).toBe(state); expect(result.closed).toBe(true);
  expect(f.pool.query).toHaveBeenCalledOnce(); expect(f.pool.end).toHaveBeenCalledOnce();
});
test('query and close errors both survive without exposing messages', async () => {
  const f = fake({ queryError: Object.assign(new Error('sensitive query message'), { code: 'QUERY_FAILED' }), closeError: Object.assign(new Error('sensitive close'), { code: 'END_FAILED' }) });
  const result = await observeDatabase(f.factory, url, expected);
  expect(result.state).toBe('UNKNOWN'); expect(result.closed).toBe(false);
  expect(result.firstError).toEqual({ code: 'QUERY_FAILED' }); expect(result.closeError).toEqual({ code: 'END_FAILED' });
  expect(JSON.stringify(result)).not.toContain('sensitive'); expect(f.pool.end).toHaveBeenCalledOnce();
});
test('an idle pool error cannot be hidden by a successful query and close', async () => {
  const f = fake({ idleError: Object.assign(new Error('hidden'), { code: 'POOL_ERROR' }) });
  const result = await observeDatabase(f.factory, url, expected);
  expect(result.state).toBe('UNKNOWN'); expect(result.closed).toBe(true); expect(result.firstError.code).toBe('POOL_ERROR');
});
test('unsafe configuration or missing identity never creates a pool', async () => {
  const f = fake();
  await expect(observeDatabase(f.factory, url + '?host=remote', expected)).rejects.toThrow('LOCAL_ADMIN_REQUIRED');
  await expect(observeDatabase(f.factory, url, {})).rejects.toThrow('IDENTITY_REQUIRED');
  expect(f.factory).not.toHaveBeenCalled();
});
