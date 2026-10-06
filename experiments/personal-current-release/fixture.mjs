import assert from 'node:assert/strict';
import { mkdtemp, open, lstat, rm, realpath, statfs, readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { BACKEND, BACKEND_ROOT, sha } from './inventory.mjs';
import { previewHost } from './transport.mjs';
const ADMIN = 'postgresql://flow:flow-local-only@127.0.0.1:55432/postgres';
const load = path => import(pathToFileURL(join(BACKEND_ROOT, path)).href);
const pg = () => createRequire(join(BACKEND_ROOT, 'package.json'))('pg');
export const cleanError = (error, secrets = []) => [ADMIN, ...secrets].filter(Boolean).reduce((text, secret) => text.replaceAll(secret, '[redacted]'), String(error?.stack ?? error)).slice(0, 4096);
export async function save(path, value) {
  const bytes = JSON.stringify(value, null, 2) + '\n'; assert.ok(Buffer.byteLength(bytes) <= 3 * 1024 * 1024, 'Evidence file bound');
  const file = await open(path, 'wx', 0o600);
  try { await file.writeFile(bytes); await file.sync(); } finally { await file.close(); }
  const folder = await open(dirname(path), 'r'); try { await folder.sync(); } finally { await folder.close(); }
}
export async function freeBytes(path) { const value = await statfs(path); return value.bavail * value.bsize; }
export async function diskBytes(path, maxFiles = 10000) {
  let bytes = 0, files = 0;
  async function visit(directory) {
    for (const name of await readdir(directory)) {
      const p = join(directory, name), st = await lstat(p); if (++files > maxFiles) throw Error('Observed file-count limit');
      // Chrome creates socket/lock symlinks; never follow them.
      if (st.isDirectory() && !st.isSymbolicLink()) await visit(p); else bytes += st.size;
    }
  }
  await visit(path); return { bytes, files };
}
export async function allocateResources() {
  const parent = await realpath(await mkdtemp(join(tmpdir(), 'flow-svc05r01-'))), st = await lstat(parent);
  const databaseName = 'flow_svc05r01_' + randomUUID().replaceAll('-', '').slice(0, 20);
  const value = { parent, identity: { dev: st.dev, ino: st.ino }, databaseName, marker: randomUUID(), created: false, markerWritten: false, createAttempted: false };
  return value;
}
export function databaseUrl(owned) { assert.match(owned.databaseName, /^flow_svc05r01_[a-f0-9]{20}$/); const url = new URL(ADMIN); url.pathname = '/' + owned.databaseName; return url.href; }
function poolOptions(url) { return { connectionString: url, max: 1, connectionTimeoutMillis: 1500, statement_timeout: 3000, query_timeout: 4000, application_name: 'svc05r01-isolated-compatibility' }; }
export async function initializeDatabase(owned, evidence) {
  const { Pool } = pg(); const admin = new Pool(poolOptions(ADMIN));
  try {
    assert.deepEqual((await admin.query('SELECT datname FROM pg_database WHERE datname=$1', [owned.databaseName])).rows, []);
    owned.createAttempted = true; await save(join(evidence, 'database-create-attempt.json'), { ...owned, at: new Date().toISOString() });
    await admin.query(`CREATE DATABASE "${owned.databaseName}"`); owned.created = true;
  } finally { await admin.end(); }
  const own = new Pool(poolOptions(databaseUrl(owned)));
  try { await own.query('CREATE TABLE public.svc05r01_owner(id uuid PRIMARY KEY,backend text NOT NULL)'); await own.query('INSERT INTO public.svc05r01_owner VALUES($1,$2)', [owned.marker, BACKEND]); owned.markerWritten = true; }
  finally { await own.end(); }
  await save(join(evidence, 'database-created.json'), { ...owned, at: new Date().toISOString() });
}
/** One af51 factory/runtime; old migrations/install/build/history experiments are not part of this journey. */
export async function createFixture(owned, token, signal, report) {
  const secrets = [token, databaseUrl(owned)]; let app, running, runnerStop, runnerError, activePreview;
  const request = async (path, body, auth = token, headers = {}) => {
    signal.throwIfAborted();
    const response = await fetch(report.centerUrl + path, { method: body === undefined ? 'GET' : 'POST', headers: { authorization: `Bearer ${auth}`, 'content-type': 'application/json', ...(body === undefined ? {} : { 'idempotency-key': randomUUID() }), ...headers }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]) });
    assert.ok(response.ok, `Public request rejected: ${response.status}`); return response.json();
  };
  const close = async () => {
    const errors = [];
    try { await activePreview?.close(); activePreview = undefined; } catch (e) { errors.push(cleanError(e, secrets)); }
    if (runnerStop) runnerStop.abort();
    try { await running; if (runnerError) throw runnerError; report.runnerStopped = true; } catch (e) { errors.push(cleanError(e, secrets)); }
    try {
      // Only after the real runtime promise settles, close this fixture's residual claim sockets.
      if (app && report.runnerStopped) { app.server.closeAllConnections(); await app.close(); report.centerClosed = true; }
      else if (app) errors.push('Runtime settlement unknown; center retained for owned supervisor cleanup');
    } catch (e) { errors.push(cleanError(e, secrets)); }
    report.closeErrors = errors; assert.deepEqual(errors, []);
  };
  try {
    signal.throwIfAborted(); const { createServer } = await load('apps/server/src/index.ts');
    app = await createServer({ databaseUrl: databaseUrl(owned), ownerToken: token });
    report.centerUrl = await app.listen({ host: '127.0.0.1', port: 0 }); report.centerPort = app.server.address().port;
    const runner = await request('/api/runners', { name: 'SVC05R01 deterministic compatibility adapter', harnesses: ['claude'], capacity: 1 }); secrets.push(runner.token);
    report.runnerId = runner.runnerId;
    const configuration = { harness: 'claude', adapterVersion: 'claude-sdk-0.3.290-v2', model: 'svc05-synthetic', thinking: 'disabled', permissionMode: 'dontAsk', access: 'none', requireReadApproval: false, materialScopeDigest: sha('[]'), limits: { maxTurns: 2, maxBudgetUsd: 0.2, timeoutMs: 30000 } };
    const { profile } = await request('/api/runner/execution-profile', { configuration }, runner.token);
    const { runRunner } = await load('apps/runner/src/runtime.ts'), { guardExecutionProfile } = await load('apps/runner/src/execution-profiles.ts'), { verifyText } = await load('apps/runner/src/verifier.ts');
    const adapter = { name: 'claude', version: configuration.adapterVersion, async run(context) {
      const nativeSessionId = context.task.nativeSessionId ?? randomUUID(), sourceMessageId = randomUUID(), artifactId = randomUUID(), content = 'SVC05 synthetic reply: ' + context.task.prompt;
      await context.emit({ type: 'session', nativeSessionId, adapterVersion: configuration.adapterVersion, resources: ['SVC05R01 deterministic; zero SDK/provider'] });
      await context.assertOwnership();
      await context.emit({ type: 'assistant-final', messageId: sha(JSON.stringify([nativeSessionId, sourceMessageId])), nativeSessionId, source: 'claude.sdk.result', sourceMessageId, content, settings: { requested: { model: configuration.model, permissionMode: 'dontAsk', thinking: 'disabled' }, effective: { model: null, permissionMode: null, tools: null, thinking: 'unknown' } } });
      await context.emit({ type: 'artifact', artifactId, title: 'SVC05 synthetic output', version: sha(content), content, mediaType: 'text/plain' }); await context.emit(verifyText(artifactId, content, context.task.verification));
    } };
    runnerStop = new AbortController();
    running = runRunner({ baseUrl: report.centerUrl, token: runner.token, workingDirectory: join(owned.parent, 'runner'), signal: runnerStop.signal, pollIntervalMs: 50, heartbeatIntervalMs: 500, adapters: [guardExecutionProfile(adapter, profile.reference, configuration)] }).catch(error => { if (!runnerStop.signal.aborted) runnerError = error; });
    const { releaseAsset } = await load('tools/personal-preview/web-release.mjs');
    return { profile, token, request, redact: e => cleanError(e, secrets), close,
      async openPreview(entry) { assert.equal(activePreview, undefined); activePreview = await previewHost(entry, new URL(report.centerUrl).port, releaseAsset, signal); return activePreview; },
      async closePreview() { const old = activePreview; if (old) { await old.close(); activePreview = undefined; } },
    };
  } catch (e) { report.failure = cleanError(e, secrets); await close(); throw e; }
}
/** Acknowledged local close is not a remote-PG barrier. Preserve each bounded observation and every error. */
async function observeConnections(admin, databaseName) {
  const observations = [], started = performance.now(), deadline = started + 3000;
  do {
    const remaining = Math.floor(deadline - performance.now());
    if (remaining <= 0) return { outcome: 'unknown', observations, reason: 'deadline' };
    let timeout;
    try {
      const query = admin.query({ text: 'SELECT pid,state,application_name FROM pg_stat_activity WHERE datname=$1 ORDER BY pid LIMIT 33', values: [databaseName], query_timeout: remaining });
      // Pool acquisition is also inside this observation deadline. A late query never authorizes DROP.
      const result = await Promise.race([query, new Promise((_, reject) => { timeout = setTimeout(() => { const e = Error('Observation deadline'); e.code = 'OBSERVATION_TIMEOUT'; reject(e); }, remaining); })]);
      const rows = result.rows, elapsedMs = performance.now() - started;
      observations.push({ at: new Date().toISOString(), elapsedMs, rows });
      if (performance.now() >= deadline) return { outcome: 'unknown', observations, reason: 'late-response' };
      if (!rows.length) return { outcome: 'zero', observations };
      if (rows.length > 32) return { outcome: 'unknown', observations, reason: 'connection-bound' };
    } catch (e) { observations.push({ at: new Date().toISOString(), elapsedMs: performance.now() - started, errorCode: typeof e.code === 'string' ? e.code : 'UNKNOWN' }); return { outcome: 'unknown', observations }; }
    finally { clearTimeout(timeout); }
    await new Promise(resolve => setTimeout(resolve, Math.max(0, Math.min(50, deadline - performance.now()))));
  } while (performance.now() < deadline);
  return { outcome: 'unknown', observations, reason: 'deadline' };
}
/** Called only after a durable result checkpoint and whole owned child groups are absent. */
export async function cleanupResources(owned, evidence, groupsAbsent) {
  const result = { databaseName: owned.databaseName, marker: owned.marker, groupsAbsent, removedDatabase: false, removedTemp: false, errors: [] };
  if (!groupsAbsent) { result.errors.push('Owned process group unknown; retain DB/tmp'); return result; }
  const { Pool } = pg(); const admin = new Pool(poolOptions(ADMIN)); let own;
  try {
    assert.ok(owned.created && owned.markerWritten, 'Database ownership incomplete');
    own = new Pool(poolOptions(databaseUrl(owned)));
    assert.deepEqual((await own.query('SELECT id,backend FROM public.svc05r01_owner')).rows, [{ id: owned.marker, backend: BACKEND }]);
    await own.end(); own = undefined;
    result.connections = await observeConnections(admin, owned.databaseName);
    const info = await lstat(owned.parent); result.directoryMatched = info.isDirectory() && !info.isSymbolicLink() && info.dev === owned.identity.dev && info.ino === owned.identity.ino;
    assert.equal(result.connections.outcome, 'zero'); assert.equal(result.directoryMatched, true);
    await save(join(evidence, 'cleanup-decision.json'), { ...result, phase: 'before-normal-drop-and-removal' });
    await admin.query(`DROP DATABASE "${owned.databaseName}"`); result.removedDatabase = true;
    result.remaining = (await admin.query('SELECT datname FROM pg_database WHERE datname=$1', [owned.databaseName])).rows; assert.deepEqual(result.remaining, []);
    // Recheck inode immediately before recursively removing only this run's private root.
    const again = await lstat(owned.parent); assert.equal(again.dev, owned.identity.dev); assert.equal(again.ino, owned.identity.ino); assert.ok(again.isDirectory() && !again.isSymbolicLink());
    await rm(owned.parent, { recursive: true }); result.removedTemp = true;
  } catch (e) { result.errors.push(cleanError(e, [databaseUrl(owned)])); }
  finally { await own?.end().catch(() => {}); await admin.end(); }
  return result;
}
