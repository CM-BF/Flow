import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir, cpus, totalmem, loadavg, platform } from 'node:os';
import { setTimeout as sleep } from 'node:timers/promises';
import { Pool } from 'pg';
import { startProcess, stopProcess, type Observation, type OwnedProcess } from './processes.js';
import { boundedText } from './http.js';

const label = process.argv[2];
if (!label || !/^[a-z][a-z0-9-]{1,60}$/.test(label)) throw new Error('Provide a new bounded evidence label.');
const output = resolve('docs/evidence/s01', label);
await mkdir(output); // Existing evidence is never reused or overwritten.
const startedAt = new Date().toISOString();
const start = performance.now();
const hardBudgetMs = 30000;
const hardDeadline = start + hardBudgetMs;
const workDeadline = start + hardBudgetMs - 10000;
const sourcePaths = ['experiments/runner-capacity/child.ts','experiments/runner-capacity/processes.ts','experiments/runner-capacity/smoke.ts','experiments/runner-capacity/http.ts','experiments/runner-capacity/contract.json','experiments/runner-capacity/tsconfig.json','apps/server/src/index.ts','apps/server/src/runners.ts','apps/server/src/events.ts','apps/runner/src/runtime.ts','apps/runner/src/outbox.ts','apps/runner/src/fixture.ts'];
const sourceHashes = () => Promise.all(sourcePaths.map(async path => ({ path, sha256: createHash('sha256').update(await readFile(path)).digest('hex') })));
const sourceFiles = await sourceHashes();
const implementationHead = execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const observations: Observation[] = [];
const processes: OwnedProcess[] = [];
const cleanup: Record<string, unknown>[] = [];
const checks: string[] = [];
const samples: { path: string; elapsedMs: number; bytes: number; status: number }[] = [];
const taskIds: string[] = [];
const databaseName = 'flow_s01_' + process.pid + '_' + randomUUID().replaceAll('-', '');
let created = false;
let workdir: string | undefined;
let admin: Pool | undefined;
let observer: Pool | undefined;
let baseUrl: string | undefined;
let failure: string | null = null;
let observedBytes = 0;
let rawFacts: unknown = null;
let measuredDataBytes = 0;
const ownerToken = randomUUID();
function collect(record: Observation) {
  observedBytes += Buffer.byteLength(JSON.stringify(record));
  if (observedBytes > 4 * 1024 * 1024) { failure ??= 'Observation budget exceeded.'; return; }
  observations.push(record);
  if (record.kind === 'failure') failure ??= 'Owned child failed.';
}
function deadline() { if (failure) throw new Error(failure); if (performance.now() > workDeadline) throw new Error('Work budget exhausted; reserving cleanup time.'); }
async function workQuery(pool: Pool, sql: string, values?: unknown[]) {
  deadline();
  if (workDeadline - performance.now() < 1500) throw new Error('Insufficient work budget for bounded SQL; reserving cleanup.');
  return pool.query(sql, values);
}
async function request(path: string, body?: unknown) {
  deadline();
  const begin = performance.now();
  const response = await fetch(baseUrl + path, { method: body === undefined ? 'GET' : 'POST',
    headers: { authorization: 'Bearer ' + ownerToken, 'content-type': 'application/json', 'idempotency-key': randomUUID() },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(Math.max(1, Math.floor(Math.min(3000, workDeadline - performance.now())))) });
  const text = await boundedText(response);
  samples.push({ path, elapsedMs: performance.now() - begin, bytes: Buffer.byteLength(text), status: response.status });
  assert(response.ok, 'Owned center request failed: ' + response.status);
  return JSON.parse(text);
}
async function pendingFiles(directory: string): Promise<string[]> {
  const found: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) found.push(...await pendingFiles(path));
    else if (['pending-events.json', 'pending-events.json.tmp', 'uncertain-events.json'].includes(entry.name)) found.push(path);
  }
  return found;
}
async function directoryBytes(directory: string): Promise<number> {
  let bytes = 0;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    bytes += entry.isDirectory() ? await directoryBytes(path) : (await readFile(path)).byteLength;
  }
  return bytes;
}
async function stopOwned(owned: OwnedProcess, limit: number) {
  try {
    const closed = await stopProcess(owned, limit); cleanup.push(closed);
    if (!closed.exited || closed.forced || closed.ipcFailed || closed.exitCode !== 0) failure ??= 'Owned process required abnormal shutdown.';
  } catch { cleanup.push({ pid: owned.pid, closed: false }); failure ??= 'Owned process cleanup failed.'; }
}
try {
  const configured = process.env.FLOW_S01_ADMIN_URL;
  if (!configured) throw new Error('FLOW_S01_ADMIN_URL is required; it is never printed.');
  const adminUrl = new URL(configured);
  assert(['127.0.0.1', 'localhost'].includes(adminUrl.hostname) && adminUrl.port === '55432', 'Only the owned local test PostgreSQL endpoint is allowed.');
  adminUrl.pathname = '/postgres'; adminUrl.searchParams.set('application_name', 'flow-s01-admin');
  admin = new Pool({ connectionString: adminUrl.href, max: 1, connectionTimeoutMillis: 1000, statement_timeout: 1000, query_timeout: 1500 });
  assert.equal((await workQuery(admin, 'SELECT 1 FROM pg_database WHERE datname=$1', [databaseName])).rowCount, 0);
  await workQuery(admin, 'CREATE DATABASE "' + databaseName + '"'); created = true;
  const databaseUrl = new URL(adminUrl); databaseUrl.pathname = '/' + databaseName; databaseUrl.searchParams.set('application_name', 'flow-s01-center');
  observer = new Pool({ connectionString: databaseUrl.href, max: 1, application_name: 'flow-s01-observer', connectionTimeoutMillis: 1000, statement_timeout: 1000, query_timeout: 1500 });
  workdir = await mkdtemp(join(tmpdir(), 'flow-s01-'));
  const center = await startProcess({ role: 'center', databaseUrl: databaseUrl.href, ownerToken }, collect, processes, workDeadline);
  baseUrl = String(center.ready.baseUrl);
  // This low-cost functional smoke uses four conversation records, not the 128-record formal scenario.
  const conversationIds: string[] = [];
  for (let i = 0; i < 4; i++) conversationIds.push((await request('/api/conversations', { title: 'S01 smoke ' + i })).conversation.id);
  assert.deepEqual(new Set((await request('/api/conversations?limit=50')).conversations.map((c: { id: string }) => c.id)), new Set(conversationIds));
  checks.push('Four API-created persistent conversation identities match; zero model turns submitted.');
  for (let i = 0; i < 2; i++) {
    const registered = await request('/api/runners', { name: 'S01 owned process ' + i, harnesses: ['fixture'], capacity: 1 });
    await startProcess({ role: 'runner', baseUrl, token: registered.token, directory: join(workdir, String(i)), label: 'runner-' + i }, collect, processes, workDeadline);
  }
  for (let i = 0; i < 4; i++) taskIds.push((await request('/api/tasks', { title: 'S01 smoke task ' + i, prompt: 'S01 deterministic task ' + i, harness: 'fixture', fixture: { scenario: 'success', delayMs: 200 }, verification: { kind: 'nonempty' } })).task.id);
  let finished = false;
  while (!finished) {
    deadline();
    const rows = (await workQuery(observer, 'SELECT id,status,verification_status FROM flow.tasks WHERE id=ANY($1::text[])', [taskIds])).rows;
    assert(!rows.some(row => ['failed', 'cancelled', 'uncertain'].includes(row.status)), 'Normal smoke task did not succeed.');
    finished = rows.length === 4 && rows.every(row => row.status === 'succeeded' && row.verification_status === 'passed');
    // A single awaited request then awaited delay: no setInterval backlog or overlapping read loop.
    await request('/api/tasks/' + taskIds[0]);
    if (!finished) await sleep(100);
  }
  checks.push('Four real runtime/outbox tasks completed and verified.');
  const saved = (await workQuery(observer, 'SELECT r.attempt_id,r.sequence,r.event_id,r.digest FROM flow.runner_events r JOIN flow.attempts a ON a.id=r.attempt_id WHERE a.task_id=ANY($1::text[]) ORDER BY r.attempt_id,r.sequence', [taskIds])).rows;
  const finalSequences = new Map<string, number>();
  for (const row of saved) finalSequences.set(row.attempt_id, Math.max(finalSequences.get(row.attempt_id) ?? 0, row.sequence));
  while (![...finalSequences].every(([attempt, sequence]) => observations.some(o => o.kind === 'report-response' && o.attemptId === attempt && o.status === 200 && Number((o.response as { lastSequence: number }).lastSequence) >= sequence)) || (await pendingFiles(workdir)).length) {
    deadline(); await sleep(20);
  }
  // Stop only after terminal ACK and outbox drain. Child close flushes ordered IPC.
  await Promise.all(processes.filter(p => p.role === 'runner').map(p => stopOwned(p, Math.min(workDeadline, performance.now() + 4000))));
  deadline();
  assert.equal((await pendingFiles(workdir)).length, 0, 'Outbox remains after runner shutdown.');
  checks.push('All terminal ACKs received; ordered IPC flushed and pending outboxes empty after runner exit.');
  const expected = new Map<string, Record<string, unknown>>();
  for (const message of observations.filter(o => o.kind === 'report-start')) for (const event of message.events as Record<string, unknown>[]) {
    const key = String(message.attemptId) + ':' + String(event.id);
    const entry = { attempt_id: message.attemptId, sequence: event.sequence, event_id: event.id, digest: event.digest };
    if (expected.has(key)) assert.deepEqual(expected.get(key), entry, 'Repeated event changed content.');
    expected.set(key, entry);
  }
  assert.equal(saved.length, expected.size); assert.equal(saved.length, 24);
  for (const row of saved) assert.deepEqual(row, expected.get(row.attempt_id + ':' + row.event_id));
  const counts = (await workQuery(observer, 'SELECT runner_id,count(*)::int AS attempts,count(*) FILTER (WHERE completed_at IS NULL)::int AS unfinished FROM flow.attempts GROUP BY runner_id')).rows;
  assert(counts.every(row => row.unfinished === 0));
  const attemptRows = (await workQuery(observer, `SELECT a.id,a.task_id,a.runner_id,a.completed_at,
    EXTRACT(EPOCH FROM a.completed_at)*1000 AS completed_epoch_ms,
    EXTRACT(EPOCH FROM t.created_at)*1000 AS task_created_epoch_ms
    FROM flow.attempts a JOIN flow.tasks t ON t.id=a.task_id`)).rows;
  assert.equal(attemptRows.length, 4);
  const grants = new Map<string, Observation>();
  for (const grant of observations.filter(o => o.kind === 'claim-grant')) {
    assert(!grants.has(String(grant.attemptId)), 'Duplicate initial claim identity.');
    grants.set(String(grant.attemptId), grant);
  }
  const attempts = attemptRows.map(row => {
    const grant = grants.get(row.id); assert(grant, 'Missing initial lease observation.');
    assert.equal(grant.taskId, row.task_id); assert.equal(grant.runnerId, row.runner_id);
    assert.equal(grant.remainingLeaseMs, 10000);
    const claimedAtLowerMs = Date.parse(String(grant.initialLeaseExpiresAt)) - Number(grant.remainingLeaseMs);
    assert(Number.isFinite(claimedAtLowerMs));
    return { ...row, claimedAtLowerMs, claimedAtUpperMs: claimedAtLowerMs + 1,
      queueWaitDerivedMs: claimedAtLowerMs - Number(row.task_created_epoch_ms) };
  });
  for (const runnerId of new Set(attempts.map(a => a.runner_id))) {
    const ordered = attempts.filter(a => a.runner_id === runnerId).sort((a, b) => a.claimedAtLowerMs - b.claimedAtLowerMs);
    for (let i = 1; i < ordered.length; i++) assert(ordered[i]!.claimedAtLowerMs >= Number(ordered[i - 1]!.completed_epoch_ms), 'Attempt overlap or insufficient initial-lease timestamp precision.');
  }
  checks.push('24 exact events match; four initial claim identities match DB, no unfinished attempts or overlap at the conservative timestamp bounds.');
  const nativeSessions = Number((await workQuery(observer, 'SELECT count(*) AS count FROM flow.sessions')).rows[0].count);
  assert.equal(nativeSessions, 4);
  const tools = observations.filter(o => o.kind === 'tool-end'); assert.equal(tools.length, 4);
  const toolDigest = createHash('sha256').update(Buffer.alloc(65536, 83)).digest('hex');
  for (const taskId of taskIds) {
    assert.equal(observations.filter(o => o.kind === 'tool-start' && o.taskId === taskId).length, 1);
    const completed = tools.filter(o => o.taskId === taskId); assert.equal(completed.length, 1);
    assert.equal(completed[0]!.bytes, 65536); assert.equal(completed[0]!.digest, toolDigest);
  }
  const databaseBytes = Number((await workQuery(observer, 'SELECT pg_database_size(current_database()) AS bytes')).rows[0].bytes);
  const temporaryBytes = await directoryBytes(workdir);
  measuredDataBytes = databaseBytes + temporaryBytes + await directoryBytes(resolve('docs/evidence/s01'));
  assert(measuredDataBytes + observedBytes < 67108864, 'Measured data exceeds the storage budget.');
  rawFacts = { conversations: 4, conversationTurns: 0, nativeSessions, tasks: 4, runnerProcesses: 2, registeredCapacityPerRunner: 1, counts, attempts, eventCount: saved.length, toolOperations: tools.length, databaseBytes, temporaryBytes,
    attemptTimeMethod: 'Initial claim lease expiry minus its configured lease duration; no persisted attempt creation timestamp. Claim serialization is millisecond precision; queue differences against millisecond task timestamps are approximate (conservative 2ms quantization allowance).' };
} catch (error) { failure = error instanceof Error ? error.message.replace(/postgres(?:ql)?:\/\/[^\s'"`]+/g, '<redacted-db-url>') : 'Unknown smoke failure'; }
finally {
  const cleanupStartedAtMs = performance.now();
  const stillRunning = (owned: OwnedProcess) => owned.child.exitCode === null && owned.child.signalCode === null;
  await Promise.all(processes.filter(p => p.role === 'runner' && stillRunning(p)).map(p => stopOwned(p, hardDeadline - 6000)));
  for (const owned of processes.filter(p => p.role === 'center')) await stopOwned(owned, hardDeadline - 4500);
  try { await observer?.end(); cleanup.push({ observerClosed: true }); } catch { failure ??= 'Observer pool cleanup failed.'; }
  try {
    if (created && admin) {
      const connections = Number((await admin.query('SELECT count(*) AS count FROM pg_stat_activity WHERE datname=$1', [databaseName])).rows[0].count);
      assert.equal(connections, 0, 'Owned database still has connections; refusing forced cleanup.');
      await admin.query('DROP DATABASE "' + databaseName + '"');
      const remaining = (await admin.query('SELECT datname FROM pg_database WHERE datname=$1', [databaseName])).rows;
      cleanup.push({ databaseName, remaining }); assert.equal(remaining.length, 0);
    }
  } catch { failure ??= 'Owned database cleanup unconfirmed.'; cleanup.push({ databaseName, dropConfirmed: false }); }
  finally { try { await admin?.end(); } catch { failure ??= 'Admin pool cleanup failed.'; } }
  if (workdir) {
    try {
      const pending = await pendingFiles(workdir);
      cleanup.push({ pendingOutboxFiles: pending.map(p => p.slice(workdir!.length + 1)) });
      if (pending.length) failure ??= 'Pending outbox remained at cleanup.';
      assert(!processes.some(stillRunning), 'Owned child is still alive; retain its working directory.');
      await rm(workdir, { recursive: true }); cleanup.push({ temporaryFilesRemoved: true });
    } catch { failure ??= 'Owned temporary files cleanup failed.'; }
  }
  const elapsedMs = performance.now() - start;
  if (elapsedMs > hardBudgetMs) failure ??= 'Total smoke budget exceeded, including cleanup.';
  const sourceFilesAfter = await sourceHashes();
  if (JSON.stringify(sourceFilesAfter) !== JSON.stringify(sourceFiles)) failure ??= 'Source changed during the smoke.';
  const record = { kind: 'functional-smoke-not-capacity-measurement', startedAt, endedAt: new Date().toISOString(), head: implementationHead, sourceFiles, sourceFilesAfter,
    environment: { node: process.version, platform: platform(), cpu: cpus()[0]?.model, logicalCpus: cpus().length, memoryBytes: totalmem(), loadavg: loadavg() },
    modelCalls: 0, cloudCalls: 0, submittedTaskIds: taskIds, checks, failure, elapsedMs, cleanupMs: performance.now() - cleanupStartedAtMs, measuredDataBytes, rawFacts, cleanup, samples, observations };
  let encoded = JSON.stringify(record, null, 2);
  if (measuredDataBytes + Buffer.byteLength(encoded) > 67108864) {
    failure ??= 'Data plus final evidence exceeds the storage budget.';
    record.failure = failure; encoded = JSON.stringify(record, null, 2);
  }
  await writeFile(join(output, 'result.json'), encoded, { flag: 'wx' });
  process.stdout.write(JSON.stringify({ label, passed: !failure, checks: checks.length, elapsedMs, failure }) + '\n');
  process.exitCode = failure ? 1 : 0;
}
