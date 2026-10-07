/** Fixed af51 release observer, adapted from reviewed SVC05/live/facts; never mutates services or DB. */
import { lstat } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { bounded, durable, sha } from '../center-recovery/facts.mjs';
import { runnerFiles } from './runner-files.mjs';

export const repository = '/Users/citrine/Projects/AgentHarness/Flow';
export const directory = '/Users/citrine/.flow-personal';
export const target = 'af51c621696230fbced12227670f014ca73bd8a1';
const execute = promisify(execFile);
const maintenanceColumns = ['maintenance_state', 'maintenance_version', 'maintenance_operation_id', 'maintenance_updated_at'];
const safeName = value => { if (!/^[a-z_]+$/.test(value)) throw Error('IDENTIFIER'); return '"' + value + '"'; };
const rootRequire = createRequire(join(repository, 'package.json'));
const tool = name => import(pathToFileURL(join(repository, 'tools/personal-preview', name)).href);


async function databaseFacts(config) {
  const { Pool } = rootRequire('pg');
  const pool = new Pool({ connectionString: config.databaseUrl, max: 1, connectionTimeoutMillis: 1500,
    statement_timeout: 3000, query_timeout: 4000, application_name: 'svc05h-release-readonly' });
  try {
    const c = await pool.connect();
    try {
      await c.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      const rows = async (sql, args) => (await c.query(sql, args)).rows;
      const marker = await rows('SELECT installation_id,directory FROM public.flow_preview_owner');
      if (marker.length !== 1 || marker[0].installation_id !== config.installationId || marker[0].directory !== directory) throw Error('MARKER');
      const db = { markerMatched: true, runnerId: config.runner.runnerId, identityMatched: (await rows(
        'SELECT id FROM flow.runners WHERE id=$1 AND token_hash=$2 AND NOT revoked', [config.runner.runnerId, sha(config.runner.token)])).length === 1,
        runners: await rows('SELECT id,harnesses,capacity,revoked,maintenance_state,maintenance_version,maintenance_operation_id,maintenance_updated_at FROM flow.runners ORDER BY id LIMIT 1001'),
        unfinished: await rows('SELECT id,task_id,runner_id FROM flow.attempts WHERE completed_at IS NULL ORDER BY id LIMIT 1001'),
        uncertain: await rows("SELECT id FROM flow.tasks WHERE status='uncertain' ORDER BY id LIMIT 1001"),
        pendingTasks: await rows("SELECT id,status FROM flow.tasks WHERE status NOT IN ('succeeded','failed','cancelled') ORDER BY id LIMIT 1001"),
        queue: await rows('SELECT state,count(*)::int AS count FROM flow.conversation_queue GROUP BY state ORDER BY state'),
        migrations: await rows('SELECT version,applied_at FROM flow.migrations ORDER BY version'), tables: {} };
      for (const key of ['runners', 'unfinished', 'uncertain', 'pendingTasks']) if (db[key].length > 1000) throw Error('ROW_BOUND');
      const tables = await rows("SELECT tablename FROM pg_tables WHERE schemaname='flow' ORDER BY tablename LIMIT 101");
      if (tables.length > 100) throw Error('TABLE_BOUND');
      let totalRows = 0;
      for (const { tablename: name } of tables) {
        const columns = (await rows("SELECT column_name FROM information_schema.columns WHERE table_schema='flow' AND table_name=$1 ORDER BY ordinal_position", [name])).map(r => r.column_name);
        const omitted = name === 'conversations' ? ['queue_checked_at'] : name === 'runners' ? maintenanceColumns : [];
        if (omitted.some(key => !columns.includes(key))) throw Error('EXPECTED_COLUMN_MISSING');
        const table = 'flow.' + safeName(name);
        // Raw and projected hashes come from the same RR snapshot. Other runners lose no columns.
        const projection = name === 'runners' ? 'CASE WHEN t.id=$1 THEN to_jsonb(t)-$2::text[] ELSE to_jsonb(t) END'
          : name === 'conversations' ? 'to_jsonb(t)-$1::text[]' : 'to_jsonb(t)';
        const args = name === 'runners' ? [config.runner.runnerId, omitted] : name === 'conversations' ? [omitted] : [];
        const hashes = await rows(`SELECT md5(to_jsonb(t)::text) AS raw,md5((${projection})::text) AS protected FROM ${table} t LIMIT 10001`, args);
        totalRows += hashes.length;
        if (hashes.length > 10000 || totalRows > 20000) throw Error('TABLE_ROW_BOUND');
        db.tables[name] = { columns, omitted, omittedRunnerId: name === 'runners' ? config.runner.runnerId : null,
          count: hashes.length, raw: hashes.map(r => r.raw).sort(), protected: hashes.map(r => r.protected).sort() };
      }
      db.audit = await rows(`SELECT ordinal,id,request_id,md5(to_jsonb(a)::text) AS row_digest,
        result->'audit' AS audit FROM flow.runner_maintenance_audit a WHERE runner_id=$1 ORDER BY ordinal LIMIT 1001`, [config.runner.runnerId]);
      if (db.audit.length > 1000) throw Error('AUDIT_BOUND');
      await c.query('COMMIT'); return db;
    } finally { c.release(); }
  } finally { await pool.end(); }
}

export async function observe() {
  return observeHost(runnerFiles);
}
/** Private procedural seam: the ordinary entry above always uses the original strict idle sampler. */
export async function observeHost(sampleNative) {
  const source = { head: (await execute('git', ['-C', repository, 'rev-parse', 'HEAD'], { timeout: 2000 })).stdout.trim(),
    dirty: Boolean((await execute('git', ['-C', repository, 'status', '--porcelain'], { timeout: 2000 })).stdout) };
  if (source.head !== target || source.dirty) throw Error('FIXED_AF51_CHECKOUT_REQUIRED');
  const host = await tool('preview.mjs'), processes = await tool('process.mjs'), releaseTool = await tool('web-release.mjs');
  const config = await host.loadPreviewConfiguration(directory); await host.assertPreviewMarker(config);
  const rootInfo = await lstat(directory);
  const result = { rootIdentity: { dev: rootInfo.dev, ino: rootInfo.ino }, at: new Date().toISOString(), source, target, files: {}, processes: {}, reports: [], dependencies: [], httpRequests: 0 };
  for (const name of ['config.json', 'claude.json', 'state.json', 'maintenance.json', 'web-release.json']) {
    const { bytes, stat } = await bounded(join(directory, name));
    if ((stat.mode & 0o777) !== 0o600) throw Error('PRIVATE_MODE');
    result.files[name] = { bytes: bytes.length, sha256: sha(bytes) };
  }
  result.identity = { installationId: config.installationId, databaseName: config.databaseName,
    runnerId: config.runner.runnerId, centerPort: config.centerPort, webPort: config.webPort };
  const state = await host.readPreviewJson(join(directory, 'state.json'));
  result.runtimeSource = state.source; const invariantState = structuredClone(state);
  for (const key of ['processes', 'source', 'startedAt', 'lastError', 'webArtifact', 'webReleaseOperation']) delete invariantState[key];
  result.invariantStateSha256 = sha(JSON.stringify(invariantState)); result.lastError = state.lastError;
  result.webArtifact = state.webArtifact; result.webReleaseOperation = state.webReleaseOperation ?? null;
  result.operation = await host.readPreviewJson(join(directory, 'maintenance.json'));
  result.native = await sampleNative(join(directory, 'runner'), `http://127.0.0.1:${config.centerPort}`);
  result.lock = await lstat(join(directory, 'operation.lock')).then(() => 'present', e => e.code === 'ENOENT' ? 'absent' : 'unknown');
  for (const role of ['center', 'runner', 'web']) {
    const r = state.processes[role]; result.processes[role] = { pid: r.pid, group: r.group, recordSha256: sha(JSON.stringify(r)), identity: await processes.inspectOwnedProcess(r) };
  }
  result.listeners = { center: await processes.ownsListener(state.processes.center, config.centerPort), web: await processes.ownsListener(state.processes.web, config.webPort) };
  const ps = (await execute('ps', ['-ax', '-o', 'pid=', '-o', 'ppid=', '-o', 'pgid=', '-o', 'command='], { timeout: 2000, maxBuffer: 1024 * 1024 })).stdout;
  result.runnerEntrypoints = ps.split('\n').flatMap(line => {
    const m = /^\s*(\d+)\s+(\d+)\s+(\d+)\s+(.*)$/.exec(line);
    return m && m[4].includes('apps/runner/src/main.ts') && !m[4].includes('ps -ax')
      ? [{ pid: +m[1], parent: +m[2], group: +m[3], owned: +m[3] === state.processes.runner.group }] : [];
  });
  result.release = await releaseTool.readWebRelease(directory);
  const { verifyWebArtifact } = await tool('web-artifact.mjs');
  for (const artifact of result.release.artifacts) {
    const { manifest } = await verifyWebArtifact({ directory, artifact });
    let compatibilityId;
    try { compatibilityId = await releaseTool.findWebCompatibility({ directory, artifact, backendHead: target }); }
    catch (e) { if (e.code !== 'WEB_COMPATIBILITY_COMBINATION_UNKNOWN') throw e; compatibilityId = null; }
    result.reports.push({ artifact, compatibilityId, files: manifest.files, totalBytes: manifest.totalBytes });
  }
  const candidate = JSON.parse((await bounded(new URL('./proposal.json', import.meta.url).pathname)).bytes).webPublishRequestCandidate;
  const candidatePath = join(directory, 'web-artifacts', candidate.artifact.artifactId);
  const exists = await lstat(candidatePath).then(() => true, e => e.code === 'ENOENT' ? false : Promise.reject(e));
  result.candidate = { present: exists, compatibilityId: null };
  if (exists) {
    await verifyWebArtifact({ directory, artifact: candidate.artifact });
    result.candidate.compatibilityId = (await releaseTool.verifyWebCompatibility({ directory, artifact: candidate.artifact,
      backendHead: target, compatibilityId: candidate.compatibilityId })) && candidate.compatibilityId;
  }
  // Static artifact serving needs Vite, not a fresh React/CSS build. Include root loader explicitly.
  const entries = [['root', 'tsx', '4.23.15'], ['root', 'pg', '8.23.1'], ['web', 'vite', '8.3.2']];
  for (const role of ['server', 'runner']) {
    const manifest = JSON.parse((await bounded(join(repository, 'apps', role, 'package.json'))).bytes);
    for (const [name, version] of Object.entries(manifest.dependencies ?? {})) entries.push([role, name, version]);
  }
  for (const [role, name, version] of entries) {
    const require = createRequire(join(repository, ...(role === 'root' ? [] : ['apps', role]), 'package.json'));
    const entry = require.resolve(name), bytes = (await bounded(entry, 8 * 1024 * 1024)).bytes;
    if (!entry.startsWith(repository + '/node_modules/.pnpm/') && !(name.startsWith('@flow/') && entry.startsWith(repository + '/packages/'))) throw Error('DEPENDENCY_OUTSIDE_FIXED_REPOSITORY');
    let folder = dirname(entry), actualVersion;
    for (let depth = 0; depth < 8 && folder.startsWith(repository + '/'); depth++, folder = dirname(folder)) {
      try { const manifest = JSON.parse((await bounded(join(folder, 'package.json'))).bytes); if (manifest.name === name) { actualVersion = manifest.version; break; } }
      catch (e) { if (e.code !== 'ENOENT') throw e; }
    }
    if (!actualVersion || version !== 'workspace:*' && actualVersion !== version) throw Error('DEPENDENCY_VERSION');
    result.dependencies.push({ role, name, expectedVersion: version, actualVersion, entry, bytes: bytes.length, sha256: sha(bytes) });
  }
  result.database = await databaseFacts(config);
  result.scope = 'One read-only RR database snapshot, bounded process/filesystem facts; no HTTP/provider or service commands.';
  return result;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 3 || !process.argv[2].endsWith('.json')) throw Error('ONE_EXCLUSIVE_OUTPUT_REQUIRED');
  let value;
  try { value = { outcome: 'observed', facts: await observe() }; }
  catch (e) { value = { outcome: 'unknown', code: /^[A-Z0-9_]+$/.test(e.code ?? e.message) ? e.code ?? e.message : 'OBSERVATION_UNKNOWN', ...(e.runnerObservation ? { runnerObservation: e.runnerObservation } : {}) }; process.exitCode = 1; }
  if (Buffer.byteLength(JSON.stringify(value)) > 4 * 1024 * 1024) throw Error('REPORT_BOUND');
  await durable(process.argv[2], value); console.log(JSON.stringify({ outcome: value.outcome, code: value.code, output: process.argv[2] }));
}
