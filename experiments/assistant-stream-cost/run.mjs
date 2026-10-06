import assert from 'node:assert/strict';
import { fork, execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { randomUUID, createHash } from 'node:crypto';
import { readFile, writeFile, readdir, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

// Explicit authorization is evidence of the coordinated window, never an automatic permission request.
assert(process.versions.node.startsWith('24.'));
const authorizationPath = process.argv[2];
assert(authorizationPath?.startsWith('docs/evidence/chat06p01/'), 'Supply the recorded authorized window inside this feature evidence directory.');
const authorization = JSON.parse(await readFile(authorizationPath, 'utf8'));
assert(authorization.taskId === 'CHAT06P01' && authorization.tasks === 3 && authorization.patches === 84 && authorization.maxDurationMs === 30000 && typeof authorization.windowId === 'string');
const notBefore = Date.parse(authorization.notBefore), notAfter = Date.parse(authorization.notAfter);
assert(Number.isFinite(notBefore) && Number.isFinite(notAfter) && Date.now() >= notBefore && Date.now() + 30000 <= notAfter, 'A full coordinated 30-second window must remain.');
const startedAt = new Date().toISOString(), started = performance.now(), hardDeadline = started + 30000;
const base = 'fa9a8288341d4f2bd8160e03fe9173dafa2de1a6';
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
assert.equal(git('status', '--porcelain'), '', 'Commit a clean reviewed source before running.');
assert.equal(git('diff', base, '--', 'apps', 'packages', 'pnpm-lock.yaml'), '', 'Product baseline changed.');
const repository = dirname(resolve(git('rev-parse', '--git-common-dir')));
const dependency = createRequire(resolve(repository, 'package.json'));
const { Pool } = dependency('pg');
const evidence = 'docs/evidence/chat06p01';
const directory = 'experiments/assistant-stream-cost';
const sourcePaths = [...(await readdir(directory)).filter(name => /\.(ts|mjs|json)$/.test(name)).map(name => `${directory}/${name}`), ...JSON.parse(await readFile(`${evidence}/source-map.json`, 'utf8')).sources.map(source => source.path)];
const hashes = async () => Promise.all([...new Set(sourcePaths)].sort().map(async path => ({ path, sha256: createHash('sha256').update(await readFile(path)).digest('hex') })));
const before = await hashes();
const databaseName = `flow_chat06p01_${process.pid}_${randomUUID().replaceAll('-', '')}`;
const startRecord = { startedAt, sourceCommit: git('rev-parse', 'HEAD'), base, databaseName, windowId: authorization.windowId, reservedTasks: 3, reservedAttempts: 3, maxPatches: 84, maxDurationMs: 30000, sourceFiles: before };
// One matrix only, even if the caller changes authorization or label. A failure needs a new reviewed plan.
await writeFile(`${evidence}/run-start.json`, JSON.stringify(startRecord, null, 2) + '\n', { flag: 'wx' });
const adminUrl = process.env.FLOW_CHAT06P01_ADMIN ?? 'postgresql://flow:flow-local-only@127.0.0.1:55432/postgres';
const databaseUrl = new URL(adminUrl);
assert(['127.0.0.1', 'localhost', '[::1]'].includes(databaseUrl.hostname), 'Only the authorized local development PG is allowed');
databaseUrl.pathname = `/${databaseName}`;
const admin = new Pool({ connectionString: adminUrl, max: 1, application_name: 'chat06p01-owned-admin', connectionTimeoutMillis: 1000, statement_timeout: 1000, query_timeout: 1500 });
const result = { ...startRecord, failure: null, worker: null, progress: [], cleanup: {}, stderrBytes: 0, sourceFilesAfter: [], elapsedMs: 0 };
let created = false, createRequested = false, child, exited, workTimer;
admin.on('error', error => { result.failure ??= `admin idle error ${error.name}`; });
function boundedQuery(text, values) { assert(performance.now() + 1600 < hardDeadline, 'Insufficient cleanup SQL budget'); return admin.query(text, values); }
async function directoryBytes(path) {
  let bytes = 0;
  for (const entry of await readdir(path, { withFileTypes: true })) {
    assert(!entry.isSymbolicLink(), 'Refuse evidence symlinks');
    const file = resolve(path, entry.name); bytes += entry.isDirectory() ? await directoryBytes(file) : (await stat(file)).size;
  }
  return bytes;
}
async function untilExit(milliseconds) { if (!child || child.exitCode !== null || child.signalCode !== null) return true; return Promise.race([exited.then(() => true), delay(Math.max(0, milliseconds), undefined, { ref: false }).then(() => false)]); }
try {
  assert(await directoryBytes(evidence) < 64 * 1024 * 1024);
  assert.equal((await boundedQuery('SELECT 1 FROM pg_database WHERE datname=$1', [databaseName])).rowCount, 0, 'Refuse an existing database');
  createRequested = true;
  await boundedQuery(`CREATE DATABASE "${databaseName}"`); created = true;
  assert(performance.now() < started + 5000, 'Setup used the available start budget');
  child = fork(resolve(directory, 'worker.ts'), [], { execPath: process.execPath, execArgv: ['--import', resolve(repository, 'node_modules/tsx/dist/loader.mjs')], env: { PATH: process.env.PATH, TSX_TSCONFIG_PATH: resolve(directory, 'runtime.tsconfig.json') }, stdio: ['ignore', 'ignore', 'pipe', 'ipc'] });
  result.cleanup.ownedPid = child.pid;
  exited = new Promise(resolveExit => child.once('exit', (code, signal) => { result.cleanup.childExit = { code, signal }; resolveExit(); }));
  child.stderr.on('data', bytes => { result.stderrBytes += bytes.length; }); // Do not retain pg client objects or secrets.
  const completed = new Promise((resolveDone, reject) => {
    child.on('message', message => {
      if (message?.kind === 'result') { result.worker = message.result; resolveDone(); }
      else if (['sample', 'task', 'claim'].includes(message?.kind)) {
        if (result.progress.length >= 90) { result.failure ??= 'IPC checkpoint cap exceeded'; child.send({ kind: 'stop' }, () => {}); }
        else result.progress.push(message);
      }
    });
    child.once('error', reject); child.once('exit', () => { if (!result.worker) reject(new Error('Worker exited without a result')); });
  });
  child.send({ kind: 'run', databaseUrl: databaseUrl.toString(), workDeadlineEpochMs: Date.now() + Math.max(0, started + 20000 - performance.now()) });
  const expired = new Promise((_, reject) => { workTimer = setTimeout(() => { child.send({ kind: 'stop' }, () => {}); reject(new Error('20-second work budget exceeded')); }, Math.max(0, started + 20000 - performance.now())); });
  await Promise.race([completed, expired]);
  assert.equal(result.worker.failure, null, 'Worker matrix failed');
  assert.deepEqual(result.worker.counts, { tasks: 3, attempts: 3, sessions: 3 });
} catch (error) { result.failure = error instanceof Error ? error.message.replace(/postgres(?:ql)?:\/\/[^\s]+/g, '<redacted>') : 'unknown supervisor failure'; }
finally {
  clearTimeout(workTimer);
  if (child) {
    if (child.connected) child.send({ kind: 'stop' }, () => {});
    if (!await untilExit(Math.min(3500, started + 24000 - performance.now()))) { result.cleanup.forced = true; result.failure ??= 'Worker required forced cleanup'; child.kill('SIGTERM'); }
    if (!await untilExit(Math.min(1000, started + 25000 - performance.now()))) child.kill('SIGKILL');
    if (!await untilExit(Math.min(1000, started + 26000 - performance.now()))) result.failure ??= 'Owned child did not exit';
    if (result.cleanup.childExit?.code !== 0) result.failure ??= 'Worker exit was not clean';
  }
  try {
    if (createRequested && !created) created = Boolean((await boundedQuery('SELECT 1 FROM pg_database WHERE datname=$1', [databaseName])).rowCount);
    if (created) {
      result.cleanup.databaseBytesBeforeDrop = Number((await boundedQuery('SELECT pg_database_size($1)::float8 AS bytes', [databaseName])).rows[0].bytes);
      let connections = [];
      do {
        connections = (await boundedQuery('SELECT pid,state,application_name FROM pg_stat_activity WHERE datname=$1', [databaseName])).rows;
        if (!connections.length) break;
        await delay(50);
      } while (performance.now() + 3200 < hardDeadline);
      result.cleanup.connectionsBeforeDrop = connections;
      assert.equal(connections.length, 0, 'Owned database still has connections; no forced backend termination');
      await boundedQuery(`DROP DATABASE "${databaseName}"`);
      result.cleanup.remaining = (await boundedQuery('SELECT datname FROM pg_database WHERE datname=$1', [databaseName])).rows;
      assert.deepEqual(result.cleanup.remaining, []);
    }
  } catch (error) { result.failure ??= error instanceof Error ? error.message : 'database cleanup failed'; }
  finally { await admin.end(); result.cleanup.adminClosed = true; }
  result.sourceFilesAfter = await hashes();
  if (JSON.stringify(before) !== JSON.stringify(result.sourceFilesAfter)) result.failure ??= 'Source bytes changed';
  result.elapsedMs = performance.now() - started;
  result.finishedAt = new Date().toISOString();
  result.evidenceBytesBeforeResult = await directoryBytes(evidence);
  result.databaseBytes = result.cleanup.databaseBytesBeforeDrop ?? result.worker?.storage?.database_bytes ?? null;
  result.encodedResultBytes = 0;
  for (let i = 0; i < 3; i++) result.encodedResultBytes = Buffer.byteLength(JSON.stringify(result, null, 2) + '\n');
  if (result.databaseBytes === null || result.databaseBytes + result.evidenceBytesBeforeResult + result.encodedResultBytes > 64 * 1024 * 1024) result.failure ??= 'Storage budget unknown or exceeded';
  if (result.elapsedMs > 30000) result.failure ??= 'Total deadline exceeded';
  for (let i = 0; i < 3; i++) result.encodedResultBytes = Buffer.byteLength(JSON.stringify(result, null, 2) + '\n');
  await writeFile(`${evidence}/result.json`, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
}
process.stdout.write(JSON.stringify({ failure: result.failure, elapsedMs: result.elapsedMs, cleanup: result.cleanup }) + '\n');
process.exitCode = result.failure ? 1 : 0;
