// Read-only operator evidence: compare the same old columns across additive migrations.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { lstat, realpath } from 'node:fs/promises';
import { dirname, isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bounded, durable } from '/Users/citrine/Projects/AgentHarness/Flow-worktrees/personal-history-compatibility/docs/evidence/svc05-history-compatibility/center-recovery-af51/facts.mjs';

const repository = '/Users/citrine/Projects/AgentHarness/Flow';
const require = createRequire(join(repository, 'package.json'));
const { Pool } = require('pg'); // Same published CommonJS entry contract as facts.mjs.
const identifier = /^[a-z_][a-z0-9_]*$/;
const maximumTables = 100;
export const omittedColumns = Object.freeze({ conversations: ['queue_checked_at'],
  runners: ['maintenance_state', 'maintenance_version', 'maintenance_operation_id', 'maintenance_updated_at'] });
const appendOnlyTables = new Set(['migrations', 'runner_maintenance_audit']);

export function projectionQuery(name, columns) {
  assert.ok(identifier.test(name) && Array.isArray(columns) && columns.length > 0 && columns.length < 100);
  assert.ok(columns.every(column => identifier.test(column)) && new Set(columns).size === columns.length);
  const rowHashes = appendOnlyTables.has(name) ? ", coalesce(array_agg(h ORDER BY h),ARRAY[]::text[]) AS row_hashes" : '';
  return `SELECT count(*)::int AS count, md5(coalesce(string_agg(h,'' ORDER BY h),'')) AS digest${rowHashes} FROM (SELECT md5(to_jsonb(x)::text) AS h FROM (SELECT ${columns.map(column => '"' + column + '"').join(',')} FROM flow."${name}" LIMIT 10001) x) y`;
}

async function capture(pool, baseline) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const tableRows = baseline?.tables ?? (await client.query("SELECT tablename AS name FROM pg_tables WHERE schemaname='flow' ORDER BY tablename LIMIT 101")).rows;
    assert.ok(tableRows.length > 0 && tableRows.length <= maximumTables);
    assert.equal(new Set(tableRows.map(table => table.name)).size, tableRows.length);
    const tables = [];
    for (const table of tableRows) {
      assert.ok(identifier.test(table.name));
      const columns = baseline ? table.columns : (await client.query("SELECT column_name FROM information_schema.columns WHERE table_schema='flow' AND table_name=$1 ORDER BY ordinal_position", [table.name])).rows
        .map(column => column.column_name).filter(column => !(omittedColumns[table.name] ?? []).includes(column));
      const digest = (await client.query(projectionQuery(table.name, columns))).rows[0];
      assert.ok(Number.isSafeInteger(digest.count) && digest.count <= 10000 && /^[a-f0-9]{32}$/.test(digest.digest));
      tables.push({ name: table.name, columns, ...digest });
    }
    await client.query('COMMIT');
    return tables;
  } finally { client.release(); }
}

async function exclusiveOutput(output) {
  assert.ok(isAbsolute(output));
  const parent = dirname(output), info = await lstat(parent);
  assert.ok(info.isDirectory() && !info.isSymbolicLink() && info.uid === process.getuid() && (info.mode & 0o777) === 0o700 && await realpath(parent) === parent);
  await lstat(output).then(() => { throw Error('OUTPUT_ALREADY_EXISTS'); }, error => { if (error.code !== 'ENOENT') throw error; });
}

export async function snapshot(output, baselinePath) {
  // Reject missing/existing output before loading private configuration or connecting.
  await exclusiveOutput(output);
  let baseline = null;
  if (baselinePath) {
    assert.equal(dirname(baselinePath), dirname(output));
    const before = await lstat(baselinePath);
    assert.ok(before.isFile() && !before.isSymbolicLink() && before.uid === process.getuid() && before.nlink === 1 && (before.mode & 0o777) === 0o600);
    const opened = await bounded(baselinePath, 131072), after = await lstat(baselinePath);
    for (const key of ['dev', 'ino', 'uid', 'nlink', 'size', 'mode', 'mtimeMs', 'ctimeMs']) {
      assert.equal(opened.stat[key], before[key]); assert.equal(after[key], before[key]);
    }
    baseline = JSON.parse(opened.bytes);
  }
  if (baseline) assert.equal(baseline.format, 1);
  const { loadPreviewConfiguration, assertPreviewMarker } = await import('/Users/citrine/Projects/AgentHarness/Flow/tools/personal-preview/preview.mjs');
  const config = await loadPreviewConfiguration('/Users/citrine/.flow-personal');
  await assertPreviewMarker(config);
  const identity = { installationId: config.installationId, databaseName: config.databaseName, directory: config.directory };
  if (baseline) assert.deepEqual(baseline.identity, identity);
  const pool = new Pool({ connectionString: config.databaseUrl, max: 1, connectionTimeoutMillis: 1500, statement_timeout: 3000, query_timeout: 4000, application_name: 'svc06-personal-history-readonly' });
  let tables, primary;
  try { tables = await capture(pool, baseline); } catch (error) { primary = error; }
  try { await pool.end(); } catch (error) { primary ??= error; }
  if (primary) throw primary;
  const result = { format: 1, at: new Date().toISOString(), identity, omittedColumns, tables };
  assert.ok(Buffer.byteLength(JSON.stringify(result)) <= 131072);
  await durable(output, result);
  return { outcome: 'observed', tableCount: tables.length, output };
}

export async function checkRuntimeOnly() {
  assert.equal(typeof Pool, 'function');
  const pool = new Pool({ max: 1 }); // Construction is lazy; never connect or query.
  assert.equal(pool.totalCount, 0); assert.equal(pool.idleCount, 0); assert.equal(pool.waitingCount, 0);
  await pool.end();
  assert.match(projectionQuery('conversations', ['id', 'created_at']), /SELECT "id","created_at" FROM flow\."conversations" LIMIT 10001/);
  assert.throws(() => projectionQuery('tasks;DROP', ['id']));
  assert.throws(() => projectionQuery('tasks', ['id', 'id']));
  return { outcome: 'runtime-and-query-construction-available', pgEntry: require.resolve('pg'), databaseConnections: 0, personalReads: 0, personalWrites: 0 };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    const result = args.length === 1 && args[0] === '--check-runtime-only' ? await checkRuntimeOnly()
      : args[0] === '--snapshot' && (args.length === 2 || args.length === 4 && args[2] === '--columns-from') ? await snapshot(args[1], args[3])
        : (() => { throw Error('EXACT_INVOCATION_REQUIRED'); })();
    console.log(JSON.stringify(result));
  } catch (error) {
    console.error(JSON.stringify({ outcome: 'unknown', code: /^[A-Z_]+$/.test(error.code ?? error.message) ? error.code ?? error.message : 'HISTORY_OBSERVATION_FAILED' }));
    process.exitCode = 1;
  }
}
