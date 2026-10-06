import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir, cpus, totalmem, loadavg, platform } from 'node:os';
import { setTimeout as sleep } from 'node:timers/promises';
import { Pool } from 'pg';
import { startProcess, stopProcess, type Observation, type OwnedProcess } from './processes.js';
import { boundedText } from './http.js';
import { observedIntervals, peak, quantiles } from './statistics.js';
import { directoryBytes, reserveRun } from './evidence.js';
import { resolveScenario } from './scenarios.js';

export async function runScenario(label: string | undefined, scenarioId: string, windowId: string | undefined) {
const scenario = resolveScenario(scenarioId, windowId);
if (!label || !/^[a-z][a-z0-9-]{1,60}$/.test(label)) throw new Error('Provide a new bounded evidence label.');
const startedAt = new Date().toISOString(); const start = performance.now();
const databaseName = 'flow_s01_' + process.pid + '_' + randomUUID().replaceAll('-', '');
const { output, reservation } = await reserveRun(resolve('docs/evidence/s01'), { label, scenario: scenario.id, windowId: scenario.windowId!, databaseName, tasks: scenario.tasks, attempts: scenario.tasks, requireGate: true });
const hardBudgetMs = 30000;
const hardDeadline = start + hardBudgetMs;
const workDeadline = start + hardBudgetMs - 10000;
const sourcePaths = ['experiments/runner-capacity/child.ts','experiments/runner-capacity/processes.ts','experiments/runner-capacity/smoke.ts','experiments/runner-capacity/scenario.ts','experiments/runner-capacity/formal.ts','experiments/runner-capacity/declared-four.ts','experiments/runner-capacity/scenarios.ts','experiments/runner-capacity/statistics.ts','experiments/runner-capacity/evidence.ts','experiments/runner-capacity/http.ts','experiments/runner-capacity/contract.json','experiments/runner-capacity/tsconfig.json','apps/server/src/index.ts','apps/server/src/runners.ts','apps/server/src/events.ts','apps/runner/src/runtime.ts','apps/runner/src/outbox.ts','apps/runner/src/fixture.ts'];
const sourceHashes = () => Promise.all(sourcePaths.map(async path => ({ path, sha256: createHash('sha256').update(await readFile(path)).digest('hex') })));
const sourceFiles = await sourceHashes();
const implementationHead = execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const observations: Observation[] = [];
const processes: OwnedProcess[] = [];
const cleanup: Record<string, unknown>[] = [];
const checks: string[] = [];
type ReadSample = { path: string; endpoint: string; phase: string; elapsedMs: number; bytes: number; status: number | null; first: boolean; observedRunningTasks: number | null; error?: string };
const samples: ReadSample[] = [];
const querySamples: { phase: string; elapsedMs: number; succeeded: boolean }[] = [];
const databaseSamples: Record<string, unknown>[] = [];
let phase = 'setup';
let observedRunningTasks: number | null = null;
const firstEndpoints = new Set<string>();
const eventCursors = new Map<string, number>();
let workspaceCursor = 0;
const timelineEntries = new Map<string, Map<number, unknown>>();
const workspaceEntries = new Map<number, unknown>();
const dispatchObservations = new Map<string, { lastFalseQuery?: { start: number; end: number }; firstTrueQuery?: { start: number; end: number } }>();
const taskIds: string[] = [];
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
  const start = performance.now(); let succeeded = false;
  try { const result = await pool.query(sql, values); succeeded = true; return result; }
  finally { querySamples.push({ phase, elapsedMs: performance.now() - start, succeeded }); }
}
async function request(path: string, body?: unknown) {
  deadline();
  const begin = performance.now();
  const endpoint = path.split('?')[0]!.replace(/\/api\/tasks\/[^/]+/, '/api/tasks/:taskId');
  const key = phase + ':' + endpoint; const first = !firstEndpoints.has(key); firstEndpoints.add(key);
  let status: number | null = null; let bytes = 0;
  try {
  const response = await fetch(baseUrl + path, { method: body === undefined ? 'GET' : 'POST',
    headers: { authorization: 'Bearer ' + ownerToken, 'content-type': 'application/json', 'idempotency-key': randomUUID() },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(Math.max(1, Math.floor(Math.min(3000, workDeadline - performance.now())))) });
  const text = await boundedText(response);
  status = response.status; bytes = Buffer.byteLength(text);
  assert(response.ok, 'Owned center request failed: ' + response.status);
  const result = JSON.parse(text);
  samples.push({ path, endpoint, phase, elapsedMs: performance.now() - begin, bytes, status, first, observedRunningTasks });
  return result;
  } catch (error) {
    samples.push({ path, endpoint, phase, elapsedMs: performance.now() - begin, bytes, status, first, observedRunningTasks, error: error instanceof Error ? error.name : 'UnknownError' });
    throw error;
  }
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
async function stopOwned(owned: OwnedProcess, limit: number) {
  try {
    const closed = await stopProcess(owned, limit); cleanup.push(closed);
    if (!closed.exited || closed.forced || closed.ipcFailed || closed.exitCode !== 0) failure ??= 'Owned process required abnormal shutdown.';
  } catch { cleanup.push({ pid: owned.pid, closed: false }); failure ??= 'Owned process cleanup failed.'; }
}
function captureTaskPage(taskId: string, page: { reset?: boolean; nextCursor: number; entries: { cursor: number }[] }) {
  assert(!page.reset, 'Task event cursor reset.');
  const entries = timelineEntries.get(taskId) ?? new Map<number, unknown>();
  for (const entry of page.entries) { assert(!entries.has(entry.cursor), 'Duplicate timeline cursor.'); entries.set(entry.cursor, entry); }
  timelineEntries.set(taskId, entries); eventCursors.set(taskId, page.nextCursor);
}
function captureWorkspacePage(page: { nextCursor: number; entries: { cursor: number }[] }) {
  for (const entry of page.entries) { assert(!workspaceEntries.has(entry.cursor), 'Duplicate workspace ordinal.'); workspaceEntries.set(entry.cursor, entry); }
  workspaceCursor = page.nextCursor;
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
  const observerUrl = new URL(databaseUrl); observerUrl.searchParams.set('application_name', 'flow-s01-observer');
  observer = new Pool({ connectionString: observerUrl.href, max: 1, connectionTimeoutMillis: 1000, statement_timeout: 1000, query_timeout: 1500 });
  workdir = await mkdtemp(join(tmpdir(), 'flow-s01-'));
  const center = await startProcess({ role: 'center', databaseUrl: databaseUrl.href, ownerToken }, collect, processes, workDeadline);
  baseUrl = String(center.ready.baseUrl);
  await writeFile(join(output, 'owned-center.json'), JSON.stringify({ databaseName, pid: center.pid, baseUrl }), { flag: 'wx' });
  const postgresVersion = (await workQuery(observer, 'SHOW server_version')).rows[0].server_version;
  const conversationIds: string[] = [];
  for (let i = 0; i < scenario.conversations; i++) conversationIds.push((await request('/api/conversations', { title: 'S01 ' + scenario.id + ' ' + i })).conversation.id);
  const listed: string[] = []; const pageSizes: number[] = []; let after: string | null = null;
  do {
    const page = await request('/api/conversations?limit=50' + (after ? '&after=' + encodeURIComponent(after) : ''));
    pageSizes.push(page.conversations.length); listed.push(...page.conversations.map((c: { id: string }) => c.id));
    assert(listed.length <= scenario.conversations, 'Conversation pagination duplicated or exceeded the count.');
    after = page.nextCursor;
  } while (after);
  assert.equal(listed.length, scenario.conversations); assert.deepEqual(new Set(listed), new Set(conversationIds));
  const background = (await workQuery(observer, 'SELECT (SELECT count(*)::int FROM flow.conversations) AS conversations,(SELECT count(*)::int FROM flow.conversation_turns) AS turns')).rows[0];
  assert.equal(background.conversations, scenario.conversations); assert.equal(background.turns, 0);
  checks.push(`${scenario.conversations} API-created persistent conversation identities match all pages and DB; zero model turns.`);
  const runners: { runnerId: string; token: string; label: string; directory: string }[] = [];
  for (let i = 0; i < scenario.runners; i++) {
    const registered = await request('/api/runners', { name: 'S01 owned process ' + i, harnesses: ['fixture'], capacity: scenario.capacityPerRunner });
    runners.push({ runnerId: registered.runnerId, token: registered.token, directory: join(workdir, String(i)), label: 'runner-' + i });
  }
  const registeredRunners = (await workQuery(observer, 'SELECT id,capacity FROM flow.runners ORDER BY id')).rows;
  assert.deepEqual(new Set(registeredRunners.map(row => row.id)), new Set(runners.map(runner => runner.runnerId)));
  assert(registeredRunners.every(row => row.capacity === scenario.capacityPerRunner), 'Registered capacity differs from selected scenario.');
  for (let i = 0; i < scenario.tasks; i++) taskIds.push((await request('/api/tasks', { title: 'S01 task ' + i, prompt: 'S01 deterministic task ' + i, harness: 'fixture', fixture: { scenario: 'success', delayMs: 0 }, verification: { kind: 'nonempty' } })).task.id);
  // All tasks are admitted before any runner starts claiming; ready children wait at an IPC gate.
  const ownedRunners = await Promise.all(runners.map(runner => startProcess({ role: 'runner', baseUrl, ...runner, deferStart: true, measuredDelayMs: 200 }, collect, processes, workDeadline)));
  const windowStartedAtMs = performance.now(); phase = 'load';
  await Promise.all(ownedRunners.map(owned => new Promise<void>((resolve, reject) => owned.child.send({ kind: 'start' }, error => error ? reject(error) : resolve()))));
  let finished = false;
  let readIndex = 0;
  while (!finished) {
    deadline();
    const queryStart = performance.now();
    const rows = (await workQuery(observer, 'SELECT id,status,verification_status,dispatch_ready FROM flow.tasks WHERE id=ANY($1::text[])', [taskIds])).rows;
    const queryEnd = performance.now();
    for (const row of rows) {
      const observed = dispatchObservations.get(row.id) ?? {};
      if (row.dispatch_ready) observed.firstTrueQuery ??= { start: queryStart, end: queryEnd };
      else observed.lastFalseQuery = { start: queryStart, end: queryEnd };
      dispatchObservations.set(row.id, observed);
    }
    const connections = (await workQuery(observer, 'SELECT pid,application_name,state,wait_event_type,wait_event FROM pg_stat_activity WHERE datname=current_database() ORDER BY pid')).rows;
    databaseSamples.push({ receivedAtMs: performance.now(), connections, taskStates: rows });
    assert(!rows.some(row => ['failed', 'cancelled', 'uncertain'].includes(row.status)), 'Fixture task did not succeed.');
    finished = rows.length === scenario.tasks && rows.every(row => row.status === 'succeeded' && row.verification_status === 'passed');
    if (finished) break;
    observedRunningTasks = rows.filter(row => row.status === 'running').length;
    const taskId = taskIds[Math.floor(readIndex / 4) % taskIds.length]!;
    switch (readIndex++ % 4) {
      case 0: await request('/api/tasks/' + taskId); break;
      case 1: {
        const page = await request(`/api/tasks/${taskId}/events?after=${eventCursors.get(taskId) ?? 0}&limit=100`);
        captureTaskPage(taskId, page); break;
      }
      case 2: {
        const page = await request(`/api/workspace?after=${workspaceCursor}&limit=100`);
        captureWorkspacePage(page); break;
      }
      case 3: await request('/api/conversations?limit=50'); break;
    }
    if (!finished) await sleep(100);
  }
  const windowEndedAtMs = performance.now(); phase = 'verification'; observedRunningTasks = null;
  checks.push(`${scenario.tasks} real runtime/outbox tasks completed and verified.`);
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
  assert.equal(saved.length, expected.size); assert.equal(saved.length, scenario.tasks * 6);
  for (const row of saved) assert.deepEqual(row, expected.get(row.attempt_id + ':' + row.event_id));
  const counts = (await workQuery(observer, 'SELECT runner_id,count(*)::int AS attempts,count(*) FILTER (WHERE completed_at IS NULL)::int AS unfinished FROM flow.attempts GROUP BY runner_id')).rows;
  assert(counts.every(row => row.unfinished === 0));
  const attemptRows = (await workQuery(observer, `SELECT a.id,a.task_id,a.runner_id,a.completed_at,
    EXTRACT(EPOCH FROM a.completed_at)*1000 AS completed_epoch_ms,
    EXTRACT(EPOCH FROM t.created_at)*1000 AS task_created_epoch_ms
    FROM flow.attempts a JOIN flow.tasks t ON t.id=a.task_id`)).rows;
  assert.equal(attemptRows.length, scenario.tasks);
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
  const perRunnerPeaks = registeredRunners.map(runner => {
    const owned = attempts.filter(attempt => attempt.runner_id === runner.id);
    const lower = peak(owned.map(a => ({ start: a.claimedAtUpperMs, end: Number(a.completed_epoch_ms) })));
    const upper = peak(owned.map(a => ({ start: a.claimedAtLowerMs, end: Number(a.completed_epoch_ms) })));
    assert(upper <= runner.capacity, 'Conservative attempt peak exceeds registered capacity.');
    return { runnerId: runner.id, declaredCapacity: runner.capacity, attempts: owned.length, lower, upper };
  });
  assert(attempts.every(attempt => registeredRunners.some(runner => runner.id === attempt.runner_id)), 'Attempt belongs to an unregistered runner.');
  checks.push(`${scenario.tasks * 6} exact events match; initial claims match DB, no unfinished attempts, per-runner peaks within registered capacity.`);
  const nativeSessions = Number((await workQuery(observer, 'SELECT count(*) AS count FROM flow.sessions')).rows[0].count);
  assert.equal(nativeSessions, scenario.tasks);
  const timelineRows = (await workQuery(observer, 'SELECT task_id,cursor,entry FROM flow.timeline ORDER BY task_id,cursor')).rows;
  assert.equal(timelineRows.length, scenario.tasks * 5);
  for (const taskId of taskIds) {
    let more = true;
    while (more) {
      const page = await request(`/api/tasks/${taskId}/events?after=${eventCursors.get(taskId) ?? 0}&limit=100`);
      captureTaskPage(taskId, page); more = page.hasMore;
    }
    assert.equal(timelineEntries.get(taskId)!.size, 5);
    for (const row of timelineRows.filter(r => r.task_id === taskId)) assert.deepEqual(timelineEntries.get(taskId)!.get(row.cursor), row.entry);
  }
  let workspacePending = true;
  while (workspacePending) {
    const page = await request(`/api/workspace?after=${workspaceCursor}&limit=100`);
    captureWorkspacePage(page); workspacePending = page.hasMore || page.projectionPending;
  }
  const workspaceRows = (await workQuery(observer, 'SELECT ordinal,task_id,task_cursor,entry FROM flow.workspace_feed ORDER BY ordinal')).rows;
  assert.equal(workspaceRows.length, scenario.tasks * 6); assert.equal(workspaceEntries.size, workspaceRows.length);
  for (const row of workspaceRows) {
    const entry = workspaceEntries.get(Number(row.ordinal)) as { task: { id: string }; entry: unknown };
    assert.equal(entry.task.id, row.task_id); assert.deepEqual(entry.entry, row.entry);
  }
  const artifacts = (await workQuery(observer, 'SELECT a.task_id,a.version,a.detail_id,d.content FROM flow.artifacts a JOIN flow.details d ON d.id=a.detail_id')).rows;
  assert.equal(artifacts.length, scenario.tasks);
  for (const artifact of artifacts) {
    const i = taskIds.indexOf(artifact.task_id); assert(i >= 0);
    const expected = `Flow fixture result\nS01 deterministic task ${i}\n`;
    assert.equal(artifact.content, expected); assert.equal(artifact.version, createHash('sha256').update(expected).digest('hex'));
    const detail = await request(`/api/details/${artifact.detail_id}`);
    assert.equal(detail.content, expected);
  }
  const tools = observations.filter(o => o.kind === 'tool-end'); assert.equal(tools.length, scenario.tasks);
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
  const adapterIntervals = observedIntervals(observations, 'adapter', taskIds);
  const toolIntervals = observedIntervals(observations, 'tool', taskIds);
  const waitIntervals = observedIntervals(observations, 'wait', taskIds);
  const attemptPeakLower = peak(attempts.map(a => ({ start: a.claimedAtUpperMs, end: Number(a.completed_epoch_ms) })));
  const attemptPeakUpper = peak(attempts.map(a => ({ start: a.claimedAtLowerMs, end: Number(a.completed_epoch_ms) })));
  const readStatistics = ['/api/tasks/:taskId', '/api/tasks/:taskId/events', '/api/workspace', '/api/conversations'].map(endpoint => ({ endpoint,
    groups: [true, false].map(first => { const selected = samples.filter(s => s.phase === 'load' && s.endpoint === endpoint && s.first === first);
      return { first, successes: quantiles(selected.filter(s => !s.error).map(s => s.elapsedMs)), failures: selected.filter(s => s.error), bytes: quantiles(selected.map(s => s.bytes)),
        activeObserved: quantiles(selected.filter(s => !s.error && (s.observedRunningTasks ?? 0) > 0).map(s => s.elapsedMs)),
        queueOnlyObserved: quantiles(selected.filter(s => !s.error && s.observedRunningTasks === 0).map(s => s.elapsedMs)) }; }) }));
  rawFacts = { conversations: scenario.conversations, conversationTurns: 0, nativeSessions, tasks: scenario.tasks, runnerProcesses: scenario.runners, registeredCapacityPerRunner: scenario.capacityPerRunner, registeredRunners, perRunnerPeaks, counts, attempts, eventCount: saved.length, toolOperations: tools.length, databaseBytes, temporaryBytes,
    pageSizes, postgresVersion, timelineCount: timelineRows.length, workspaceCount: workspaceRows.length, windowStartedAtMs, windowEndedAtMs, dispatchObservations: Object.fromEntries(dispatchObservations),
    attemptPeakLower, attemptPeakUpper, achievedFourConcurrentAttempts: attemptPeakLower >= 4,
    adapterPeakObserved: peak(adapterIntervals), toolPeakObserved: peak(toolIntervals), adapterIntervals, toolIntervals, waitIntervals,
    artificialWait: { configuredMsPerAttempt: 200, measured: quantiles(waitIntervals.map(i => i.childDurationMs)) },
    queueWaitDerived: quantiles(attempts.map(a => a.queueWaitDerivedMs)), readStatistics,
    eventEmitAck: quantiles(observations.filter(o => o.kind === 'emit-ack').map(o => Number(o.elapsedMs))),
    eventHttpAck: quantiles(observations.filter(o => o.kind === 'http' && o.path === '/api/runner/events').map(o => Number(o.elapsedMs))),
    connectionMethod: 'TCP/HTTP/SSE are distinct sampled observations. PG observer URL has its own application_name; center and scheduler share one name and are reported combined. Configured max8/max3 are not observed pool usage. Pool acquisition wait is not measured.',
    attemptTimeMethod: 'Initial claim lease expiry minus its configured lease duration; no persisted attempt creation timestamp. Claim serialization is millisecond precision; queue differences against millisecond task timestamps are approximate (conservative 2ms quantization allowance).' };
} catch (error) { failure = error instanceof Error ? error.message.replace(/postgres(?:ql)?:\/\/[^\s'"`]+/g, '<redacted-db-url>') : 'Unknown scenario failure'; }
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
  const record = { kind: scenario.formal ? 'bounded-local-capacity-window' : 'functional-smoke-not-capacity-measurement', scenario, reservation, startedAt, endedAt: new Date().toISOString(), head: implementationHead, sourceFiles, sourceFilesAfter,
    environment: { node: process.version, platform: platform(), cpu: cpus()[0]?.model, logicalCpus: cpus().length, memoryBytes: totalmem(), loadavg: loadavg() },
    modelCalls: 0, cloudCalls: 0, submittedTaskIds: taskIds, checks, failure, elapsedMs, cleanupMs: performance.now() - cleanupStartedAtMs, measuredDataBytes, rawFacts, cleanup, samples, querySamples, databaseSamples, observations };
  let encoded = JSON.stringify(record, null, 2);
  if (measuredDataBytes + Buffer.byteLength(encoded) > 67108864) {
    failure ??= 'Data plus final evidence exceeds the storage budget.';
    record.failure = failure; encoded = JSON.stringify(record, null, 2);
  }
  await writeFile(join(output, 'result.json'), encoded, { flag: 'wx' });
  process.stdout.write(JSON.stringify({ label, passed: !failure, checks: checks.length, elapsedMs, failure }) + '\n');
  process.exitCode = failure ? 1 : 0;
}

}
