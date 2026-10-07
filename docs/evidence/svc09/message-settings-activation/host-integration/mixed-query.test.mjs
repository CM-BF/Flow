import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { readMixedTaskRows } from './mixed-runner.mjs';
import { failure } from './host-records.mjs';

test('generated task IDs cross the actual final-query port with the fixed text schema', async () => {
  const schema = await readFile(new URL('../../../../../apps/server/src/database.ts', import.meta.url));
  assert.equal(createHash('sha256').update(schema).digest('hex'), process.env.FLOW_SVC09A_DATABASE_SOURCE_SHA);
  assert.match(schema.toString(), /CREATE TABLE IF NOT EXISTS flow\.tasks \(\s*id text PRIMARY KEY/);
  const taskIds = [randomUUID(), randomUUID()], rows = taskIds.map(id => ({ id }));
  let calls = 0;
  const observed = await readMixedTaskRows({ async query(sql, values) {
    calls++; assert.match(sql, /WHERE t\.id=ANY\(\$1::text\[\]\)/);
    assert.doesNotMatch(sql, /uuid\[\]/); assert.deepEqual(values, [taskIds]);
    return { rows };
  } }, taskIds);
  assert.equal(calls, 1); assert.equal(observed, rows);
});

test('original PG SQLSTATE is retained with its operation without private error text', async () => {
  const original = Object.assign(new Error('postgres://private-credential/private-body'), { name: 'error', code: '42883', detail: 'private detail' });
  await assert.rejects(readMixedTaskRows({ query: async () => { throw original; } }, [randomUUID(), randomUUID()]), error => {
    assert.equal(error.cause, original);
    const fact = failure(error, 'host-consumer');
    assert.deepEqual(fact, { phase: 'mixed-final-task-query', sourcePhase: 'host-consumer', name: 'Error', code: 'MIXED_TASK_QUERY_FAILED', sqlState: '42883' });
    assert.doesNotMatch(JSON.stringify(fact), /private|postgres|detail/); return true;
  });
});

test('missing or malformed SQLSTATE stays unknown and never becomes an invented database cause', async () => {
  for (const code of [undefined, null, 42883, 'token=private', '42883\n']) {
    await assert.rejects(readMixedTaskRows({ query: async () => { throw { code, message: 'private' }; } }, [randomUUID()]), error => {
      const fact = failure(error, 'host-consumer'); assert.equal(fact.sqlState, null);
      assert.equal(fact.phase, 'mixed-final-task-query'); assert.doesNotMatch(JSON.stringify(fact), /private/); return true;
    });
  }
});

test('ordinary primary and cleanup diagnostics remain separate with their original phases', () => {
  const primary = failure(Object.assign(new Error('private'), { code: 'PRIMARY_FAILURE' }), 'work');
  const cleanup = failure({ name: 'private name', code: 'secret=value' }, 'cleanup');
  assert.deepEqual(primary, { phase: 'work', name: 'Error', code: 'PRIMARY_FAILURE' });
  assert.deepEqual(cleanup, { phase: 'cleanup', name: 'UnknownError', code: null });
});
