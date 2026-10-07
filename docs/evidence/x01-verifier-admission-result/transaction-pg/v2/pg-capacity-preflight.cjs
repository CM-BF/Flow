// Read-only capacity preflight, separately supervised; never imports the PG test caller.
const startedAt = new Date().toISOString();
const started = performance.now();
const report = { protocol: 'flow.var.pg-capacity-preflight.v1', startedAt, pid: process.pid,
  requiredAvailable: 33, adminClosed: false, poolClosed: false, failure: null };
let pool;
function fail(error) {
  if (report.failure === null) report.failure = { name: error?.name ?? 'Error', code: 'PG_CAPACITY_PREFLIGHT_FAILED' };
}
async function main() {
  try {
    const { Pool } = require('../../node_modules/pg');
    pool = new Pool({ connectionString: 'postgresql://flow:flow-local-only@127.0.0.1:55432/postgres',
      max: 1, connectionTimeoutMillis: 3000, query_timeout: 3500, statement_timeout: 3000,
      application_name: 'var-v2-capacity-preflight' });
    pool.on('error', fail);
    const result = await pool.query(
      'SELECT current_setting($1)::int AS maximum, (SELECT count(*)::int FROM pg_stat_activity) AS current',
      ['max_connections']);
    const row = result.rows[0];
    if (result.rows.length !== 1 || !Number.isSafeInteger(row?.maximum) || !Number.isSafeInteger(row?.current)
      || row.maximum < 1 || row.current < 0 || row.current > row.maximum) throw new Error('Invalid capacity result');
    report.maximum = row.maximum;
    report.current = row.current;
    report.available = row.maximum - row.current;
  } catch (error) {
    fail(error);
  } finally {
    if (pool) {
      try { await pool.end(); report.poolClosed = true; report.adminClosed = true; }
      catch (error) { fail(error); }
    }
  }
  report.endedAt = new Date().toISOString();
  report.elapsedMs = performance.now() - started;
  report.passed = report.failure === null && report.adminClosed && report.poolClosed
    && report.available >= report.requiredAvailable;
  process.stdout.write(JSON.stringify(report) + '\n');
  process.exitCode = report.passed ? 0 : 1;
}
void main();
