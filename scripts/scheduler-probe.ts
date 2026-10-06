import { PgBoss } from 'pg-boss';
import pg from 'pg';
import assert from 'node:assert/strict';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('Set DATABASE_URL to an isolated probe database.');
const schema = `probe_${Date.now()}`;
const pool = new pg.Pool({ connectionString: databaseUrl });
const errors: string[] = [];
const makeBoss = () => {
  const boss = new PgBoss({ connectionString: databaseUrl, schema, supervise: false, schedule: false });
  boss.on('error', error => errors.push(error.message));
  return boss;
};
let boss = makeBoss();
try {
  await boss.start();
  await boss.createQueue('wake', { retryLimit: 1, retryDelay: 1 });
  const transaction = await pool.connect();
  try {
    await transaction.query('BEGIN');
    await boss.send('wake', { taskId: 'rolled-back' }, { db: { executeSql: (text, values) => transaction.query(text, values) } });
    await transaction.query('ROLLBACK');
  } finally {
    transaction.release();
  }
  assert.equal((await boss.fetch('wake')).length, 0, 'Rolled-back transaction must not publish a job');
  const jobId = await boss.send('wake', { taskId: 'durable' });
  assert.ok(jobId);
  await boss.stop();
  boss = makeBoss();
  await boss.start();
  const [first] = await boss.fetch<{ taskId: string }>('wake');
  assert.equal(first?.data.taskId, 'durable', 'Committed job survives queue process restart');
  assert.ok(first);
  await boss.fail('wake', first.id, { message: 'simulated worker failure' });
  await new Promise(resolve => setTimeout(resolve, 1200));
  const [retried] = await boss.fetch<{ taskId: string }>('wake');
  assert.equal(retried?.id, first.id, 'Retry preserves stable job identity');
  assert.ok(retried);
  await boss.complete('wake', retried.id);
  assert.equal((await boss.fetch('wake')).length, 0);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ result: 'passed', pgBoss: '12.37.0', node: process.version, scenarios: ['transaction rollback', 'durable queue process restart', 'retry with stable job id', 'completion'], schema }, null, 2));
} finally {
  await boss.stop();
  await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  await pool.end();
}
