import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { Pool } from 'pg';
import type { ClaimResponse } from '../../packages/contracts/src/runner.js';
import { boundedText } from './http.js';
import { startProcess, stopProcess, type Observation, type OwnedProcess } from './processes.js';

const label = process.argv[2];
assert(label && /^[a-z][a-z0-9-]{1,60}$/.test(label), 'A new evidence label is required.');
const windowId = process.env.FLOW_S01_WINDOW_ID;
assert(windowId, 'Protocol gate requires a coordinated window identifier.');
const root = resolve('docs/evidence/s01');
for (const entry of await readdir(root, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  try {
    const prior = JSON.parse(await readFile(join(root, entry.name, 'run-start.json'), 'utf8'));
    assert(prior.scenario !== 'protocol-gate', 'Protocol gate already started; reruns are not authorized.');
  } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
}
const output = join(root, label); await mkdir(output);
const startedAt = new Date().toISOString(); const start = performance.now();
const deadline = start + 20_000; const hardDeadline = start + 30_000;
const databaseName = 'flow_s01_gate_' + process.pid + '_' + randomUUID().replaceAll('-', '');
await writeFile(join(output, 'run-start.json'), JSON.stringify({ scenario: 'protocol-gate', windowId, startedAt, databaseName, maxTasks: 8, maxAttempts: 8 }), { flag: 'wx' });
const paths = ['experiments/runner-capacity/protocol-gate.ts','experiments/runner-capacity/processes.ts','experiments/runner-capacity/child.ts','experiments/runner-capacity/http.ts','experiments/runner-capacity/contract.json','apps/server/src/database.ts','apps/server/src/runners.ts','apps/server/src/events.ts','apps/server/src/index.ts'];
const hashes = () => Promise.all(paths.map(async path => ({ path, sha256: createHash('sha256').update(await readFile(path)).digest('hex') })));
const sourceFiles = await hashes(); const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const ownerToken = randomUUID(); const processes: OwnedProcess[] = [];
const observations: Observation[] = []; const samples: Record<string, unknown>[] = [];
const cleanup: unknown[] = []; const taskIds: string[] = []; const checks: string[] = [];
let admin: Pool | undefined; let observer: Pool | undefined; let created = false;
let baseUrl: string | undefined; let failure: string | null = null; let facts: unknown = null;
function workBudget() { if (performance.now() + 1500 > deadline) throw new Error('Gate work budget exhausted; cleanup reserved.'); }
async function query(pool: Pool, sql: string, values?: unknown[]) { workBudget(); return pool.query(sql, values); }
async function post(path: string, body: unknown, token = ownerToken) {
  workBudget(); const began = performance.now(); let status: number | null = null;
  try {
    const response = await fetch(baseUrl + path, { method: 'POST', body: JSON.stringify(body),
      headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json', 'idempotency-key': randomUUID() },
      signal: AbortSignal.timeout(Math.max(1, Math.floor(Math.min(1500, deadline - performance.now())))) });
    status = response.status; const bodyText = await boundedText(response);
    samples.push({ path, status, elapsedMs: performance.now() - began, bytes: Buffer.byteLength(bodyText) });
    assert(response.ok, 'Gate request failed: ' + status); return JSON.parse(bodyText);
  } catch (error) {
    samples.push({ path, status, elapsedMs: performance.now() - began, error: error instanceof Error ? error.name : 'UnknownError' });
    throw error;
  }
}
try {
  assert(process.env.FLOW_S01_ADMIN_URL, 'Local PostgreSQL URL required; never printed.');
  const adminUrl = new URL(process.env.FLOW_S01_ADMIN_URL);
  assert(['127.0.0.1', 'localhost'].includes(adminUrl.hostname) && adminUrl.port === '55432');
  adminUrl.pathname = '/postgres'; adminUrl.searchParams.set('application_name', 'flow-s01-gate-admin');
  admin = new Pool({ connectionString: adminUrl.href, max: 1, connectionTimeoutMillis: 1000, statement_timeout: 1000, query_timeout: 1500 });
  assert.equal((await query(admin, 'SELECT 1 FROM pg_database WHERE datname=$1', [databaseName])).rowCount, 0);
  await query(admin, 'CREATE DATABASE "' + databaseName + '"'); created = true;
  const centerUrl = new URL(adminUrl); centerUrl.pathname = '/' + databaseName; centerUrl.searchParams.set('application_name', 'flow-s01-gate-center');
  const observerUrl = new URL(centerUrl); observerUrl.searchParams.set('application_name', 'flow-s01-gate-observer');
  observer = new Pool({ connectionString: observerUrl.href, max: 1, connectionTimeoutMillis: 1000, statement_timeout: 1000, query_timeout: 1500 });
  const center = await startProcess({ role: 'center', databaseUrl: centerUrl.href, ownerToken }, value => observations.push(value), processes, deadline);
  baseUrl = String(center.ready.baseUrl);
  await writeFile(join(output, 'owned-process.json'), JSON.stringify({ pid: center.pid, databaseName, baseUrl }), { flag: 'wx' });
  const runner = await post('/api/runners', { name: 'S01 protocol-only gate', harnesses: ['fixture'], capacity: 2 });
  for (let i = 0; i < 8; i++) taskIds.push((await post('/api/tasks', { title: 'S01 protocol gate ' + i, prompt: 'Protocol-only; no adapter execution.', harness: 'fixture', fixture: { scenario: 'success', delayMs: 0 } })).task.id);
  while (Number((await query(observer, 'SELECT count(*) FROM flow.tasks WHERE dispatch_ready AND id=ANY($1::text[])', [taskIds])).rows[0].count) !== 8) await sleep(50);
  const replies = await Promise.all(Array.from({ length: 8 }, () => post('/api/runner/claim', {}, runner.token) as Promise<ClaimResponse>));
  const assignments = replies.flatMap(reply => reply.assignment ? [reply.assignment] : []);
  assert.equal(assignments.length, 2, 'Capacity-two claim race must grant exactly two ready tasks.');
  assert.equal(new Set(assignments.map(a => a.task.id)).size, 2); assert.equal(new Set(assignments.map(a => a.attempt.id)).size, 2);
  const active = (await query(observer, 'SELECT id,task_id,runner_id,owner_version FROM flow.attempts WHERE completed_at IS NULL')).rows;
  assert.equal(active.length, 2); assert.deepEqual(new Set(active.map(a => a.id)), new Set(assignments.map(a => a.attempt.id)));
  assert(active.every(a => a.runner_id === runner.runnerId));
  checks.push('Eight simultaneous protocol claims against capacity2 yield exactly two unique live attempts on distinct tasks.');
  for (const assignment of assignments) {
    const response = await post('/api/runner/events', { attemptId: assignment.attempt.id, ownerVersion: assignment.attempt.ownerVersion,
      events: [{ id: randomUUID(), sequence: 1, type: 'completed', outcome: 'cancelled' }] }, runner.token);
    assert.equal(response.accepted, 1); assert.equal(response.lastSequence, 1);
  }
  for (const taskId of taskIds) await post(`/api/tasks/${taskId}/cancel`, {});
  const final = (await query(observer, 'SELECT id,status FROM flow.tasks ORDER BY id')).rows;
  assert.equal(final.length, 8); assert(final.every(task => task.status === 'cancelled'));
  assert.equal(Number((await query(observer, 'SELECT count(*) FROM flow.attempts WHERE completed_at IS NULL')).rows[0].count), 0);
  assert.equal(Number((await query(observer, 'SELECT count(*) FROM flow.sessions')).rows[0].count), 0);
  checks.push('All eight tasks cancelled through public APIs, no live attempts or native sessions; no runner/adapter process was executed.');
  const databaseBytes = Number((await query(observer, 'SELECT pg_database_size(current_database()) AS bytes')).rows[0].bytes);
  assert(databaseBytes + Buffer.byteLength(JSON.stringify({ observations, samples })) < 64 * 1024 * 1024);
  facts = { tasks: 8, attempts: 2, protocolClaimRequests: 8, declaredCapacity: 2, actualRunnerProcesses: 0, adapterExecutions: 0, nativeSessions: 0, assignments: assignments.map(a => ({ taskId: a.task.id, attempt: a.attempt })), active, final, databaseBytes };
} catch (error) { failure = error instanceof Error ? error.message.replace(/postgres(?:ql)?:\/\/[^\s'"`]+/g, '<redacted-db-url>') : 'Unknown gate failure'; }
finally {
  for (const owned of processes) {
    try {
      const closed = await stopProcess(owned, hardDeadline - 4500); cleanup.push(closed);
      if (!closed.exited || closed.forced || closed.ipcFailed || closed.exitCode !== 0) failure ??= 'Gate center did not close normally.';
    } catch { failure ??= 'Gate center cleanup failed.'; cleanup.push({ pid: owned.pid, exited: false }); }
  }
  try { await observer?.end(); cleanup.push({ observerClosed: true }); } catch { failure ??= 'Gate observer cleanup failed.'; }
  try {
    if (created && admin) {
      assert.equal(Number((await admin.query('SELECT count(*) FROM pg_stat_activity WHERE datname=$1', [databaseName])).rows[0].count), 0);
      await admin.query('DROP DATABASE "' + databaseName + '"');
      const remaining = (await admin.query('SELECT datname FROM pg_database WHERE datname=$1', [databaseName])).rows;
      cleanup.push({ databaseName, remaining }); assert.equal(remaining.length, 0);
    }
  } catch { failure ??= 'Gate database cleanup unconfirmed.'; cleanup.push({ databaseName, dropConfirmed: false }); }
  finally { try { await admin?.end(); } catch { failure ??= 'Gate admin cleanup failed.'; } }
  const sourceFilesAfter = await hashes();
  if (JSON.stringify(sourceFiles) !== JSON.stringify(sourceFilesAfter)) failure ??= 'Gate source changed while running.';
  const elapsedMs = performance.now() - start;
  if (performance.now() > hardDeadline) failure ??= 'Gate budget exceeded including cleanup.';
  await writeFile(join(output, 'result.json'), JSON.stringify({ kind: 'protocol-capacity-gate-not-execution-capacity', scenario: { id: 'protocol-gate' }, windowId, head, sourceFiles, sourceFilesAfter,
    startedAt, endedAt: new Date().toISOString(), elapsedMs, modelCalls: 0, cloudCalls: 0, submittedTaskIds: taskIds, checks, failure, facts, cleanup, samples, observations }, null, 2), { flag: 'wx' });
  process.stdout.write(JSON.stringify({ label, passed: !failure, failure, elapsedMs }) + '\n'); process.exitCode = failure ? 1 : 0;
}
