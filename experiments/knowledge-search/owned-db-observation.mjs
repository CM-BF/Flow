import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';

const identityQuery = "SELECT d.datname AS name,d.oid::text AS oid,pg_get_userbyid(d.datdba) AS owner,shobj_description(d.oid,'pg_database') AS marker,(SELECT count(*)::int FROM pg_stat_activity a WHERE a.datid=d.oid) AS connections FROM pg_database d WHERE d.datname=$1";
const errorCode = error => typeof error?.code === 'string' && /^[A-Z0-9_]{1,64}$/.test(error.code) ? error.code : 'OBSERVATION_ERROR';
export function validateAdmin(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error('LOCAL_ADMIN_REQUIRED'); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    || url.pathname !== '/postgres' || url.search || value.includes('#')) throw new Error('LOCAL_ADMIN_REQUIRED');
}
export function validateExpected(expected) {
  if (!/^flow_k01_query_[0-9a-f]{32}$/.test(expected?.database ?? '') || !/^[1-9][0-9]*$/.test(expected?.identity?.oid ?? '')
    || typeof expected.identity.owner !== 'string' || expected.identity.owner.length < 1 || expected.identity.owner.length > 63
    || !/^[0-9a-f-]{36}$/.test(expected.identity.marker ?? '')) throw new Error('IDENTITY_REQUIRED');
}
/** Exactly one read-only query. End failure is separate from the first query/pool error. */
export async function observeDatabase(createPool, adminUrl, expected) {
  validateAdmin(adminUrl); validateExpected(expected);
  const startedAt = new Date().toISOString(), start = performance.now();
  let pool, rows = null, firstError = null, closeError = null, closed = false;
  const fail = error => { firstError ??= { code: errorCode(error) }; };
  try {
    pool = createPool({ connectionString: adminUrl, max: 1, connectionTimeoutMillis: 1000, statement_timeout: 1500,
      lock_timeout: 500, query_timeout: 1800, application_name: 'k01-query-recovery-readonly' });
    pool.on('error', fail);
    rows = (await pool.query(identityQuery, [expected.database])).rows;
  } catch (error) { fail(error); }
  finally {
    if (pool) try { await pool.end(); closed = true; } catch (error) { closeError = { code: errorCode(error) }; }
  }
  const row = rows?.[0];
  const identityMatched = rows?.length === 1 && row.name === expected.database && row.oid === expected.identity.oid
    && row.owner === expected.identity.owner && row.marker === expected.identity.marker;
  let state = 'UNKNOWN';
  if (closed && !firstError && !closeError && Array.isArray(rows)) {
    if (rows.length === 0) state = 'ABSENT_SNAPSHOT';
    else if (!identityMatched) state = 'IDENTITY_MISMATCH';
    else if (Number.isSafeInteger(row.connections) && row.connections >= 0) state = row.connections === 0 ? 'ZERO_CONNECTIONS_SNAPSHOT' : 'ACTIVE_CONNECTIONS_SNAPSHOT';
  }
  return { startedAt, endedAt: new Date().toISOString(), elapsedMs: performance.now() - start,
    rows, identityMatched, closed, state, firstError, closeError };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const admin = process.env.FLOW_K01_QUERY_ADMIN_URL;
    const expected = JSON.parse(process.env.K01_EXPECTED_IDENTITY ?? 'null');
    validateAdmin(admin); validateExpected(expected);
    const { default: pg } = await import('pg');
    const result = await observeDatabase(options => new pg.Pool(options), admin, expected);
    console.log(JSON.stringify(result));
    if (!['ZERO_CONNECTIONS_SNAPSHOT', 'ABSENT_SNAPSHOT'].includes(result.state)) process.exitCode = 1;
  } catch { console.log(JSON.stringify({ state: 'UNKNOWN', closed: false, firstError: { code: 'OBSERVATION_INPUT_OR_IMPORT' } })); process.exitCode = 1; }
}
