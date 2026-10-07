import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readPreservedQueueEvidence } from './host-fence.mjs';
import { preservedQueueProtocol } from './retire.mjs';

const digest = text => createHash('md5').update(text).digest('hex');
function fixture() {
  const queuedTasks = [{ id: 'c8a0e95d-d84a-4e96-aef7-3384fbbe5291', status: 'queued', current_attempt_id: null }];
  const schema = [['attempts', ['id', 'task_id', 'runner_id', 'owner_version', 'completed_at']],
    ['tasks', ['id', 'status', 'current_attempt_id']], ['conversation_queue', ['id', 'state']]];
  const rows = schema.map((_, index) => [{ h: digest('synthetic complete row ' + index) }]);
  const contract = { protocol: preservedQueueProtocol, baselineSha256: 'a'.repeat(64), queuedTasks,
    tables: schema.map(([name, columns], index) => ({ name, columns, count: rows[index].length, digest: digest(rows[index].map(row => row.h).sort().join('')) })) };
  const queries = [];
  const client = { query: async sql => {
    queries.push(sql);
    const index = schema.findIndex(([name]) => sql.includes('flow."' + name + '"'));
    if (index !== -1) return { rows: rows[index] };
    assert.equal(sql, "SELECT id,status,current_attempt_id FROM flow.tasks WHERE status NOT IN ('succeeded','failed','cancelled') ORDER BY id LIMIT 10001");
    return { rows: queuedTasks };
  } };
  return { client, contract, rows, queuedTasks, queries };
}
test('actual SQL producer projects all attempts including completed and all task/queue rows', async () => {
  const f = fixture(), evidence = await readPreservedQueueEvidence(f.client, f.contract);
  assert.equal(f.queries.length, 4);
  for (const [index, table] of f.contract.tables.entries()) {
    assert.equal(f.queries[index], `SELECT md5(to_jsonb(x)::text) AS h FROM (SELECT ${table.columns.map(column => '"' + column + '"').join(',')} FROM flow."${table.name}" LIMIT 10001) x`);
    assert.ok(!f.queries[index].includes('WHERE'));
    assert.deepEqual(evidence.tables[index].rowHashes, f.rows[index].map(row => row.h));
  }
  assert.deepEqual(evidence.queuedTasks, f.contract.queuedTasks);
});
test('actual SQL producer rejects added completed, deleted or replaced same-count history', async () => {
  for (const mode of ['added', 'deleted', 'replaced']) {
    const f = fixture();
    if (mode === 'added') f.rows[0].push({ h: digest('new completed attempt') });
    if (mode === 'deleted') f.rows[0].pop();
    if (mode === 'replaced') f.rows[0][0].h = digest('other completed attempt');
    await assert.rejects(readPreservedQueueEvidence(f.client, f.contract), { code: 'PRESERVED_QUEUE_CHANGED' });
  }
});
test('actual SQL producer rejects changed queued tuple and missing evidence', async () => {
  const f = fixture(); f.contract = structuredClone(f.contract); f.queuedTasks[0].current_attempt_id = 'someone dispatched';
  await assert.rejects(readPreservedQueueEvidence(f.client, f.contract), { code: 'PRESERVED_QUEUE_CHANGED' });
  const missing = fixture(); missing.rows[1][0] = {};
  await assert.rejects(readPreservedQueueEvidence(missing.client, missing.contract), { code: 'PRESERVED_QUEUE_CHANGED' });
});
test('actual SQL producer rejects unsupported protocol or partial columns before querying', async () => {
  for (const change of [contract => contract.protocol = 'allow-counts', contract => contract.tables[0].columns = ['id']]) {
    const f = fixture(); change(f.contract);
    await assert.rejects(readPreservedQueueEvidence(f.client, f.contract), { code: 'PRESERVED_QUEUE_CONTRACT' });
    assert.equal(f.queries.length, 0);
  }
});
test('actual SQL producer stops at the bounded full-table sentinel', async () => {
  const f = fixture(); f.rows[0] = Array.from({ length: 10001 }, () => ({ h: digest('row') }));
  await assert.rejects(readPreservedQueueEvidence(f.client, f.contract), { code: 'HISTORY_BOUND' });
  assert.equal(f.queries.length, 1);
});
