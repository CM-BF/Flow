import { open, lstat, realpath } from 'node:fs/promises';
import { constants } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { inspectOwnedProcess, ownsListener } from '../../../../tools/personal-preview/process.mjs';
import { readWebRelease, findWebCompatibility } from '../../../../tools/personal-preview/web-release.mjs';
import { verifyWebArtifact } from '../../../../tools/personal-preview/web-artifact.mjs';

export const root = '/Users/citrine/.flow-personal';
export const repository = '/Users/citrine/Projects/AgentHarness/Flow';
export const target = 'af51c621696230fbced12227670f014ca73bd8a1';
export const sha = b => createHash('sha256').update(b).digest('hex');
const execute = promisify(execFile);
export async function bounded(path, max = 65536) {
  const f = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const st = await f.stat();
    if (!st.isFile() || st.uid !== process.getuid() || st.size > max) throw Error('FILE_IDENTITY');
    const bytes = Buffer.alloc(max + 1); let n = 0;
    while (n < bytes.length) { const r = await f.read(bytes, n, bytes.length - n, null); if (!r.bytesRead) break; n += r.bytesRead; }
    if (n > max) throw Error('FILE_BOUND');
    return { bytes: bytes.subarray(0, n), stat: st };
  } finally { await f.close(); }
}
export async function durable(path, value) {
  const f = await open(path, 'wx', 0o600);
  try { await f.writeFile(JSON.stringify(value, null, 2) + '\n'); await f.sync(); } finally { await f.close(); }
  const parent = await open(new URL('.', `file://${path}`), 'r');
  try { await parent.sync(); } finally { await parent.close(); }
}
export async function source() {
  const opts = { timeout: 2000, maxBuffer: 1024 * 1024 };
  const head = (await execute('git', ['-C', repository, 'rev-parse', 'HEAD'], opts)).stdout.trim();
  const dirty = (await execute('git', ['-C', repository, 'status', '--porcelain'], opts)).stdout.length !== 0;
  return { head, dirty };
}
// The default remains the historical reader; callers may bind a newer read-only decoder.
export function readRetainedCompatibility(input, reader = findWebCompatibility) {
  if (typeof reader !== 'function') throw Error('COMPATIBILITY_READER_REQUIRED');
  return reader(input);
}
export async function snapshot({ findCompatibility } = {}) {
  const st = await lstat(root);
  if (!st.isDirectory() || st.isSymbolicLink() || (st.mode & 0o777) !== 0o700 || st.uid !== process.getuid() || await realpath(root) !== root) throw Error('ROOT_IDENTITY');
  const facts = { at: new Date().toISOString(), rootIdentity: { dev: st.dev, ino: st.ino }, files: {}, processes: {}, source: await source(), httpRequests: 0 };
  const values = {};
  for (const name of ['config.json', 'claude.json', 'state.json', 'maintenance.json', 'web-release.json']) {
    const { bytes, stat } = await bounded(join(root, name));
    if ((stat.mode & 0o777) !== 0o600) throw Error('PRIVATE_MODE');
    values[name] = JSON.parse(bytes); facts.files[name] = { bytes: bytes.length, sha256: sha(bytes) };
  }
  const config = values['config.json'], state = values['state.json'];
  if (config.directory !== root || config.repository !== repository || !config.runner || !/^flow_preview_[a-f0-9]{24}$/.test(config.databaseName)) throw Error('CONFIG_IDENTITY');
  const url = new URL(config.databaseUrl);
  if (url.hostname !== '127.0.0.1' || url.pathname !== '/' + config.databaseName) throw Error('LOCAL_DATABASE');
  facts.identity = { installationId: config.installationId, databaseName: config.databaseName, runnerId: config.runner.runnerId, centerPort: config.centerPort, webPort: config.webPort };
  facts.runtimeSource = state.source;
  const rest = structuredClone(state); delete rest.processes.center;
  facts.stateExceptCenterSha256 = sha(JSON.stringify(rest));
  facts.lock = await lstat(join(root, 'operation.lock')).then(() => 'present', e => e.code === 'ENOENT' ? 'absent' : 'unknown');
  for (const role of ['center', 'runner', 'web']) {
    const r = state.processes[role];
    facts.processes[role] = { pid: r.pid, group: r.group, identity: await inspectOwnedProcess(r), recordSha256: sha(JSON.stringify(r)) };
  }
  const exit = JSON.parse((await bounded(join(root, 'center-exit.json'))).bytes);
  facts.oldCenterExit = { at: exit.at, code: exit.code, signal: exit.signal, nonceMatches: exit.nonce === state.processes.center.nonce };
  facts.listeners = { center: await ownsListener(state.processes.center, config.centerPort), web: await ownsListener(state.processes.web, config.webPort) };
  try {
    const r = await execute('lsof', ['-nP', `-iTCP:${config.centerPort}`, '-sTCP:LISTEN', '-t'], { timeout: 1500, maxBuffer: 65536 });
    facts.centerPortAbsent = r.stdout.trim().length === 0;
  } catch (e) { facts.centerPortAbsent = e.code === 1 && !e.stdout && !e.stderr; }
  const release = await readWebRelease(root); facts.release = release; facts.retained = [];
  for (const artifact of release.artifacts) {
    const verified = await verifyWebArtifact({ directory: root, artifact });
    const compatibilityId = await readRetainedCompatibility({ directory: root, artifact, backendHead: target }, findCompatibility);
    facts.retained.push({ artifact, totalBytes: verified.manifest.totalBytes, files: verified.manifest.files, compatibilityId });
  }
  const require = createRequire(new URL('../../../../package.json', import.meta.url));
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: config.databaseUrl, max: 1, connectionTimeoutMillis: 1500, statement_timeout: 3000, query_timeout: 4000, application_name: 'svc05h-center-recovery-readonly' });
  try {
    const c = await pool.connect();
    try {
      await c.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      const rows = async (sql, params) => (await c.query(sql, params)).rows;
      const marker = await rows('SELECT installation_id,directory FROM public.flow_preview_owner');
      if (marker.length !== 1 || marker[0].installation_id !== config.installationId || marker[0].directory !== root) throw Error('MARKER');
      facts.database = { markerMatched: true, runnerIdentityMatched: (await rows('SELECT id FROM flow.runners WHERE id=$1 AND token_hash=$2 AND NOT revoked', [config.runner.runnerId, sha(config.runner.token)])).length === 1,
        runner: await rows('SELECT id,maintenance_state,maintenance_version,maintenance_operation_id,maintenance_updated_at FROM flow.runners WHERE id=$1', [config.runner.runnerId]),
        tasks: await rows('SELECT id,status,current_attempt_id FROM flow.tasks ORDER BY id LIMIT 1001'),
        unfinished: await rows('SELECT id,task_id,runner_id FROM flow.attempts WHERE completed_at IS NULL ORDER BY id LIMIT 1001'),
        uncertain: await rows("SELECT id FROM flow.tasks WHERE status='uncertain' ORDER BY id LIMIT 1001"),
        queue: await rows('SELECT state,count(*)::int AS count FROM flow.conversation_queue GROUP BY state ORDER BY state'),
        migrations: await rows('SELECT version,applied_at FROM flow.migrations ORDER BY version'), tables: [] };
      for (const name of ['tasks', 'unfinished', 'uncertain']) if (facts.database[name].length > 1000) throw Error('ROW_BOUND');
      const tables = await rows("SELECT tablename FROM pg_tables WHERE schemaname='flow' ORDER BY tablename LIMIT 101");
      if (tables.length > 100) throw Error('TABLE_BOUND');
      for (const { tablename: name } of tables) {
        if (!/^[a-z_]+$/.test(name)) throw Error('TABLE_NAME');
        // Server-side row hashes only; user text and token hashes never leave PostgreSQL.
        const projection = name === 'conversations' ? "(to_jsonb(t)-'queue_checked_at')" : 'to_jsonb(t)';
        const [digest] = await rows(`SELECT count(*)::int AS count, md5(coalesce(string_agg(raw,'' ORDER BY raw),'')) AS raw_digest, md5(coalesce(string_agg(protected,'' ORDER BY protected),'')) AS protected_digest FROM (SELECT md5(to_jsonb(t)::text) raw, md5(${projection}::text) protected FROM flow."${name}" t LIMIT 10001) x`);
        if (digest.count > 10000) throw Error('TABLE_ROW_BOUND');
        facts.database.tables.push({ name, omitted: name === 'conversations' ? ['queue_checked_at'] : [], ...digest });
      }
      await c.query('COMMIT');
    } finally { c.release(); }
  } finally { await pool.end(); }
  return facts;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const output = process.argv[2];
  if (!output) throw Error('OUTPUT_REQUIRED');
  let report;
  try { report = { outcome: 'observed', facts: await snapshot() }; }
  catch (e) { report = { outcome: 'unknown', code: /^[A-Z0-9_]+$/.test(e.code ?? e.message) ? e.code ?? e.message : 'OBSERVATION_UNKNOWN' }; process.exitCode = 1; }
  await durable(output, report); console.log(JSON.stringify({ outcome: report.outcome, code: report.code, output }));
}
