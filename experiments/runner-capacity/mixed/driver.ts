import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, readdir, realpath, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir, loadavg } from 'node:os';
import { join, resolve, relative, dirname } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { Pool } from 'pg';
import { beforeDeadline } from './deadline.js';
import { StreamBytes } from './stream-bytes.js';
import { Budget, CONTRACT } from './contract.js';
import { selectRunIdentity, verifyRunSources } from './run-identity.js';
import { launch, transmit, type Observation } from './process.js';
import { stopProcess, type OwnedProcess } from '../processes.js';
import { boundedText } from '../http.js';
import { directoryBytes } from '../evidence.js';

import { validGate, completionAcks, validateWindow, validateFinal, type Row, type CaseResult } from './proof.js';
export async function runMixed(windowId: string, target: string, identity?: string) {
  const startedMs = performance.now();
  const run = selectRunIdentity(identity);
  const contract = { ...CONTRACT, base: run.base };
  assert(/^[a-zA-Z0-9-]{8,100}$/.test(windowId), 'A separately authorized window ID is required.');
  assert(/^[a-f0-9]{40}$/.test(target), 'Fixed reviewed source target is required.');
  const git = (...args: string[]) => execFileSync('git', args, { encoding: 'utf8' }).trim();
  assert.equal(git('rev-parse', 'HEAD'), target, 'Source HEAD differs from reviewed target.');
  assert.equal(git('status', '--porcelain', '--untracked-files=no'), '', 'Tracked source is dirty.');
  git('merge-base', '--is-ancestor', run.base, target);
  await verifyRunSources(run, path => readFile(path));
  const bindings = JSON.parse(await readFile(new URL('./runtime-dependencies.json', import.meta.url), 'utf8')) as { node: string; files: { path: string; bytes: number; sha256: string }[] };
  assert.equal(process.version, bindings.node, 'Runtime version differs from the frozen dependency binding.');
  for (const binding of bindings.files) { const bytes = await readFile(binding.path); assert.equal(bytes.length, binding.bytes); assert.equal(createHash('sha256').update(bytes).digest('hex'), binding.sha256); }
  assert.equal(await realpath(join(dirname(await realpath('node_modules/pg-boss')), 'pg')), await realpath('node_modules/pg'), 'Scheduler pg must share the observed Pool prototype.');
  const budget = new Budget(startedMs);
  const output = resolve(run.output);
  await mkdir(output); // One fixed directory reserves this stage. Existing/unknown runs cannot be retried.
  const databaseName = 'flow_s01_mixed_' + process.pid + '_' + randomUUID().replaceAll('-', '');
  budget.charge('preparation-evidence', await directoryBytes(resolve(run.preparation)));
  budget.charge('final-cli-receipt-reserve', 4096);
  const observations: Observation[] = []; const owned: OwnedProcess[] = []; const cases: CaseResult[] = [];
  const cleanup: Row[] = []; const errors: string[] = [];
  const halt = new AbortController(); let phase = 'setup';
  let admin: Pool | undefined, observer: Pool | undefined, center: OwnedProcess | undefined, runner: OwnedProcess | undefined;
  let baseUrl = '', workdir = '', creationRequested = false, creationAcknowledged = false; let observerLoop: Promise<void> | undefined;
  let observationStop = false; let observedCase: CaseResult | undefined; let latestRows: Row[] = []; let latestSnapshotStart = 0;
  const streams = new StreamBytes(8);
  const requests = new Set<Promise<unknown>>();
  const token = randomUUID(); const background = { node: process.version, dependencyBindings: bindings, loadStart: loadavg(), loadEnd: [] as number[] };
  function fail(code: string) { if (!errors.includes(code)) errors.push(code); halt.abort(); }
  function charge(kind: string, bytes: number) { try { budget.charge(kind, bytes); } catch { fail('total_byte_budget_exceeded'); } }
  function work() { if (halt.signal.aborted) throw new Error('mixed_stopped'); budget.work(); }
  function receive(value: Observation) {
    if (observations.length >= CONTRACT.maxRecords) { fail('observation_count_exceeded'); return; }
    observations.push({ ...value, phase });
    if (typeof value.transferBytes === 'number') charge('runner-http-bodies', value.transferBytes);
    if (value.kind === 'stream-bytes') { charge('center-node-streams', Number(value.delta)); if (value.complete !== true) fail('center_stream_accounting_unknown'); }
    if (value.kind === 'failure') fail('owned_child_failure');
    if (value.kind === 'child-settled' && value.dropped !== 0) fail('child_observations_dropped');
    if (value.kind === 'center-settled' && value.observationDropped !== 0) fail('pg_observations_dropped');
  }
  async function evidence(name: string, value: unknown) {
    const text = JSON.stringify(value, null, 2); budget.charge('evidence', Buffer.byteLength(text));
    if (performance.now() >= startedMs + 59_900) throw new Error('evidence_deadline');
    await writeFile(join(output, name), text, { flag: 'wx', mode: 0o600 });
  }
  async function query(pool: Pool, sql: string, parameters: unknown[] = [], cleanupQuery = false) {
    if (!cleanupQuery) work();
    const start = performance.now();
    charge('observer-sql-payload', Buffer.byteLength(sql) + Buffer.byteLength(JSON.stringify(parameters)));
    try {
      const result = await pool.query(sql, parameters);
      charge('observer-row-json', Buffer.byteLength(JSON.stringify(result.rows)));
      receive({ kind: 'driver-query', pid: process.pid, receivedMs: performance.now(), elapsedMs: performance.now() - start, phase, succeeded: true });
      return result;
    } catch (error) {
      streams.add(undefined);
      receive({ kind: 'driver-query', pid: process.pid, receivedMs: performance.now(), elapsedMs: performance.now() - start, phase, succeeded: false }); throw error;
    } finally {
      const measured = streams.sample(); charge('driver-pg-node-streams', measured.delta); if (!measured.complete) fail('driver_stream_accounting_unknown');
    }
  }
  function http(path: string, body?: unknown) {
    const pending = performHttp(path, body); requests.add(pending);
    void pending.then(() => requests.delete(pending), () => requests.delete(pending));
    return pending;
  }
  async function performHttp(path: string, body?: unknown) {
    work(); const start = performance.now(); const payload = body === undefined ? undefined : JSON.stringify(body);
    charge('owner-http-request', Buffer.byteLength(payload ?? ''));
    let status: number | null = null;
    try {
      const response = await fetch(baseUrl + path, { method: body === undefined ? 'GET' : 'POST',
        headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json', 'idempotency-key': randomUUID() }, body: payload,
        signal: AbortSignal.any([halt.signal, AbortSignal.timeout(CONTRACT.requestMs)]) });
      status = response.status; const text = await boundedText(response, CONTRACT.responseBytes);
      charge('owner-http-response', Buffer.byteLength(text)); assert(response.ok, 'owner_http_rejected');
      return JSON.parse(text);
    } finally { receive({ kind: 'owner-http', pid: process.pid, receivedMs: performance.now(), path, status, elapsedMs: performance.now() - start }); }
  }
  const records = (kind: string, id: string) => observations.filter(value => value.kind === kind && value.caseId === id);
  async function until(predicate: () => boolean, deadline: number, reason: string) {
    while (!predicate()) { work(); if (performance.now() >= deadline) throw new Error(reason); await sleep(10); }
  }
  const timer = setTimeout(() => fail('work_time_exhausted'), Math.max(1, budget.remainingWorkMs));
  try {
    const sources = await Promise.all((await readdir(resolve('experiments/runner-capacity/mixed'))).filter(name => /\.(ts|json|md)$/.test(name)).sort().map(async name => {
      const path = 'experiments/runner-capacity/mixed/' + name; const bytes = await readFile(path);
      return { path, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
    }));
    await evidence('reservation.json', { windowId, target, runIdentity: run.id, startedAt: new Date().toISOString(), databaseName, contract, sources, tasksCharged: CONTRACT.tasks, previousStageBudget: 'frozen-separate' });
    const configured = process.env.FLOW_S01_ADMIN_URL;
    assert(configured, 'FLOW_S01_ADMIN_URL is required and is never printed.');
    const url = new URL(configured);
    assert(['localhost', '127.0.0.1'].includes(url.hostname) && url.port === '55432', 'Unapproved PostgreSQL endpoint.');
    url.pathname = '/postgres'; url.searchParams.set('application_name', 'flow-s01-mixed-admin');
    const options = { max: 1, connectionTimeoutMillis: 1000, statement_timeout: 1000, query_timeout: 1500 };
    admin = new Pool({ ...options, connectionString: url.href }); admin.on('connect', client => streams.addPgClient(client)); admin.on('error', () => fail('admin_connection_failed'));
    creationRequested = true;
    await query(admin, 'CREATE DATABASE "' + databaseName + '"'); creationAcknowledged = true;
    url.pathname = '/' + databaseName; url.searchParams.set('application_name', 'flow-s01-mixed-center');
    const databaseUrl = url.href;
    url.searchParams.set('application_name', 'flow-s01-mixed-observer'); observer = new Pool({ ...options, connectionString: url.href }); observer.on('connect', client => streams.addPgClient(client)); observer.on('error', () => fail('observer_connection_failed'));
    workdir = await mkdtemp(join(tmpdir(), 'flow-s01-mixed-'));
    center = await launch({ role: 'center', databaseUrl, ownerToken: token }, owned, receive, charge, Math.min(12000, budget.remainingWorkMs));
    baseUrl = String(center.ready.baseUrl);
    assert(/^http:\/\/127\.0\.0\.1:\d+$/.test(baseUrl), 'Unexpected center endpoint.');
    runner = await launch({ role: 'runner' }, owned, receive, charge, Math.min(12000, budget.remainingWorkMs));
    const pgVersion = (await query(observer, 'SHOW server_version')).rows[0].server_version;
    await evidence('owned-resources.json', { databaseName, workdir, processes: owned.map(p => ({ role: p.role, pid: p.pid })), baseUrl, pgVersion });
    observerLoop = (async () => {
      while (!observationStop && !halt.signal.aborted) {
        const began = performance.now();
        if (observedCase) {
          const snapshotStart = performance.now();
          const rows = (await query(observer!, `SELECT t.id AS task_id,t.status,t.owner_version AS task_version,t.current_attempt_id,
            a.id AS attempt_id,a.runner_id,a.owner_version,a.completed_at,a.last_sequence,a.last_heartbeat_at,a.last_event_at,
            a.lease_expires_at>clock_timestamp() AS live FROM flow.tasks t LEFT JOIN flow.attempts a ON t.current_attempt_id=a.id
            WHERE t.id=ANY($1::text[]) ORDER BY t.id`, [observedCase.taskIds])).rows;
          latestRows = rows; latestSnapshotStart = snapshotStart;
          receive({ kind: 'attempt-snapshot', pid: process.pid, receivedMs: performance.now(), caseId: observedCase.id, rows });
        }
        const activity = (await query(observer!, `SELECT pid,application_name,state,wait_event_type,wait_event,
          pg_blocking_pids(pid) AS blockers FROM pg_stat_activity WHERE datname=$1 AND pid<>pg_backend_pid()`, [databaseName])).rows;
        receive({ kind: 'pg-activity', pid: process.pid, receivedMs: performance.now(), activity });
        await sleep(Math.max(1, CONTRACT.observationMs - (performance.now() - began)));
      }
    })().catch(() => { if (!observationStop) fail('observer_failed'); });
    for (const scenario of CONTRACT.cases) {
      work(); assert(budget.remainingWorkMs > 12000, 'Insufficient budget for next complete case.');
      const result: CaseResult = { id: scenario.id, taskIds: [], cancelled: [], gate: [], windowComplete: false, settledByDeadline: false };
      cases.push(result); phase = scenario.id + ':setup';
      const registrations = [];
      for (let index = 0; index < scenario.runners; index++) {
        const registration = await http('/api/runners', { name: 'S01 mixed ' + scenario.id + ' ' + index, harnesses: ['fixture'], capacity: scenario.slots });
        assert(typeof registration.runnerId === 'string' && typeof registration.token === 'string', 'Invalid runner registration.');
        registrations.push({ ...registration, directory: join(workdir, scenario.id, String(index)), slots: scenario.slots });
      }
      for (let index = 0; index < 16; index++) {
        budget.submit();
        const response = await http('/api/tasks', { title: 'S01 mixed ' + index, prompt: 'deterministic mixed fixture', harness: 'fixture',
          fixture: { scenario: 'success', delayMs: 0 }, verification: { kind: 'nonempty' } });
        assert(typeof response.task?.id === 'string' && !result.taskIds.includes(response.task.id), 'Invalid task acknowledgement.');
        result.taskIds.push(response.task.id);
      }
      result.cancelled = result.taskIds.slice(0, 4); latestRows = []; observedCase = result;
      await transmit(runner, { kind: 'case', caseId: result.id, baseUrl, taskIds: result.taskIds, runners: registrations }, charge);
      await until(() => records('adapter-end', result.id).length === 0 && latestSnapshotStart >= Math.max(...records('adapter-ready', result.id).map(value => value.receivedMs)) && validGate(result, latestRows, records('claim', result.id), records('adapter-ready', result.id), records('event-ack', result.id), records('heartbeat', result.id)),
        Math.min(startedMs + CONTRACT.workMs - 9000, performance.now() + 10000), 'actual_sixteen_gate_not_reached');
      result.gate = latestRows;
      phase = scenario.id + ':window';
      await transmit(runner, { kind: 'measure' }, charge);
      await until(() => records('window-start', result.id).length === 1, performance.now() + CONTRACT.requestMs, 'missing_window_start');
      const windowStart = records('window-start', result.id)[0]!.receivedMs;
      let readIndex = 0, nextRead = windowStart, skipped = 0; const reads = new Set<Promise<void>>();
      let cancelled = false; const cancellations: Promise<void>[] = [];
      while (!records('window-end', result.id).length) {
        work(); assert(performance.now() < windowStart + CONTRACT.caseMs + CONTRACT.requestMs, 'missing_window_end');
        const now = performance.now();
        if (!cancelled && now >= windowStart + CONTRACT.cancelMs) {
          cancelled = true;
          for (const taskId of result.cancelled) cancellations.push(http('/api/tasks/' + taskId + '/cancel', {}).then(response => {
            assert(response.id === taskId && response.status === 'cancel_requested', 'Cancellation was not accepted for the bound running task.');
            receive({ kind: 'cancel-accepted', pid: process.pid, receivedMs: performance.now(), caseId: result.id, taskId });
          }).catch(() => fail('cancel_http_failed')));
        }
        if (now >= nextRead) {
          nextRead = now + CONTRACT.readIntervalMs;
          if (reads.size >= CONTRACT.maxReads) skipped++;
          else {
            const index = readIndex++; const taskId = result.taskIds[index % result.taskIds.length]!;
            const path = '/api/tasks/' + taskId + (index % 2 ? '/events?after=0&limit=20' : '');
            const read = http(path).then(() => {}).catch(() => fail('light_read_failed')).finally(() => reads.delete(read)); reads.add(read);
          }
        }
        await sleep(5);
      }
      result.windowComplete = true;
      phase = scenario.id + ':settlement';
      const settlementDeadline = records('window-end', result.id)[0]!.receivedMs + CONTRACT.requestMs;
      await Promise.all(cancellations); await Promise.all(reads);
      await until(() => records('adapter-end', result.id).length === 16 && completionAcks(records('event-ack', result.id)).size === 16,
        settlementDeadline, 'completion_settlement_timeout');
      assert(performance.now() <= settlementDeadline, 'completion_settlement_timeout');
      result.settledByDeadline = true;
      receive({ kind: 'read-summary', pid: process.pid, receivedMs: performance.now(), caseId: result.id, issued: readIndex, skipped });
      validateWindow(result, observations);
      await transmit(runner, { kind: 'stop-case' }, charge);
      await until(() => records('case-runtime-settled', result.id).length === 1, performance.now() + CONTRACT.requestMs, 'runtime_shutdown_timeout');
      phase = scenario.id + ':verification';
      result.final = (await query(observer, 'SELECT t.id,t.status,t.verification_status,a.id AS attempt_id,a.runner_id,a.owner_version,a.completed_at,a.last_sequence FROM flow.tasks t JOIN flow.attempts a ON a.task_id=t.id WHERE t.id=ANY($1::text[]) ORDER BY t.id', [result.taskIds])).rows;
      result.events = (await query(observer, 'SELECT e.* FROM flow.runner_events e JOIN flow.attempts a ON a.id=e.attempt_id WHERE a.task_id=ANY($1::text[]) ORDER BY e.attempt_id,e.sequence', [result.taskIds])).rows;
      validateFinal(result, records('event-ack', result.id));
      const perRunner = new Map<string, number>(); for (const row of result.final) perRunner.set(row.runner_id, (perRunner.get(row.runner_id) ?? 0) + 1);
      assert.equal(perRunner.size, scenario.runners); assert([...perRunner.values()].every(count => count === scenario.slots), 'Runner topology differs from the fixed configuration.');
      const caseJournals = await journals(join(workdir, scenario.id));
      if (caseJournals.some(file => file.unresolved)) { await evidence(result.id + '-retained-journals.json', caseJournals); throw new Error('case_admission_or_outbox_retained'); }
      observedCase = undefined;
    }
  } catch (error) {
    const code = error instanceof Error && /^[a-z_]{3,80}$/.test(error.message) ? error.message : 'mixed_run_failed';
    fail(code); if (cases.length) cases.at(-1)!.failure = code;
  } finally {
    clearTimeout(timer); phase = 'cleanup'; observationStop = true; halt.abort();
    const childDeadline = Math.min(performance.now() + 6000, startedMs + 52_000);
    const stopped = await Promise.all(owned.map(async process => {
      const receipt = await beforeDeadline(childDeadline, () => stopProcess(process, childDeadline));
      if (receipt.state === 'settled') {
        cleanup.push(receipt.value);
        if (!receipt.value.exited || receipt.value.forced || receipt.value.exitCode !== 0) fail('abnormal_child_cleanup');
        return receipt.value.exited;
      }
      // This PID was recorded at fork; never signal an unowned process.
      process.child.kill('SIGKILL'); cleanup.push({ pid: process.pid, exited: false, retained: true, reason: receipt.reason });
      fail('child_cleanup_unknown'); return false;
    }));
    const allChildrenClosed = stopped.every(Boolean);
    const drained = await beforeDeadline(startedMs + 53_500, async () => { await Promise.allSettled([...requests]); await observerLoop; });
    if (drained.state !== 'settled') { cleanup.push({ observerOrHttpRetained: true, reason: drained.reason }); fail('observation_drain_unknown'); }
    const observerClosed = await beforeDeadline(startedMs + 54_000, async () => { await observer?.end(); });
    if (observerClosed.state !== 'settled') { streams.destroyOwned(); cleanup.push({ observerRetained: true }); fail('observer_close_unknown'); }
    if (creationRequested && admin) {
      if (!creationAcknowledged) cleanup.push({ databaseName, creationUnknown: true });
      if (!allChildrenClosed || observerClosed.state !== 'settled' || drained.state !== 'settled') {
        cleanup.push({ databaseName, retained: true, reason: 'owned_connections_not_confirmed_closed' }); fail('database_retained');
      } else {
        const exists = await beforeDeadline(startedMs + 55_500, () => query(admin!, 'SELECT 1 FROM pg_database WHERE datname=$1', [databaseName], true));
        if (exists.state !== 'settled') { cleanup.push({ databaseName, retained: true, creationUnknown: !creationAcknowledged }); fail('database_existence_unknown'); }
        else if (!exists.value.rowCount) cleanup.push({ databaseName, absentAtCheck: true, creationUnknown: !creationAcknowledged });
        else {
          const connections = await beforeDeadline(startedMs + 57_000, () => query(admin!, 'SELECT pid FROM pg_stat_activity WHERE datname=$1', [databaseName], true));
          if (connections.state !== 'settled' || connections.value.rows.length) {
            cleanup.push({ databaseName, retained: true, reason: 'database_connections_or_query_unknown' }); fail('database_connections_retained');
          } else {
            const dropped = await beforeDeadline(startedMs + 58_000, () => query(admin!, 'DROP DATABASE "' + databaseName + '"', [], true));
            cleanup.push({ databaseName, dropped: dropped.state === 'settled', retained: dropped.state !== 'settled' });
            if (dropped.state !== 'settled') fail('database_drop_unknown');
          }
        }
      }
    }
    const adminClosed = await beforeDeadline(startedMs + 58_500, async () => { await admin?.end(); });
    if (adminClosed.state !== 'settled') { streams.destroyOwned(); cleanup.push({ adminRetained: true }); fail('admin_close_unknown'); }
    const finalStreams = streams.sample(); charge('driver-pg-node-streams', finalStreams.delta); if (!finalStreams.complete) fail('driver_stream_accounting_unknown');
    if (workdir) {
      const archived = await beforeDeadline(startedMs + 59_000, async () => {
        const retained = await journals(workdir);
        if (performance.now() >= startedMs + 59_000) throw new Error('journal_archive_deadline');
        await evidence('journals.json', retained);
        if (performance.now() >= startedMs + 59_000) throw new Error('journal_removal_deadline');
        if (retained.some(file => file.unresolved) || !allChildrenClosed) { cleanup.push({ workdir, retained: true }); fail('admission_or_outbox_retained'); }
        else { await rm(workdir, { recursive: true }); cleanup.push({ workdir, removed: true }); }
      });
      if (archived.state !== 'settled') { cleanup.push({ workdir, retained: true }); fail('journal_cleanup_unknown'); }
    }
    background.loadEnd = loadavg();
    if (!observations.some(value => value.kind === 'stream-bytes' && Number(value.streams) > 0)) fail('center_stream_accounting_missing');
    if (!cases.every(value => value.settledByDeadline) || cases.length !== 2) fail('both_cases_not_completed');
    if (performance.now() - startedMs > CONTRACT.totalMs) fail('total_time_exceeded');
    const observationsWritten = await beforeDeadline(startedMs + 59_500, () => evidence('observations.json', observations));
    if (observationsWritten.state !== 'settled') fail('observation_evidence_unknown');
    const resultWritten = await beforeDeadline(startedMs + 59_900, () => evidence('result.json', { windowId, target, runIdentity: run.id, contract, cases, errors, cleanup, background,
      elapsedMs: performance.now() - startedMs, elapsedBasis: 'through result serialization; final CLI receipt includes final file write',
      byteAccountingComplete: finalStreams.complete && adminClosed.state === 'settled' && observerClosed.state === 'settled' && drained.state === 'settled' && observations.some(value => value.kind === 'center-settled') && !errors.some(code => code.includes('stream') || code.includes('child_cleanup')),
      measuredBytesBeforeResult: budget.usedBytes, byteCategoriesBeforeResult: budget.categories,
      byteBasis: 'self-owned center HTTP/PG and driver PG Node stream counters + conservative duplicate HTTP/SQL/row payloads + IPC + evidence',
      transportAttribution: 'Node stream bytes, not TCP/IP retransmits or interface packets; missing counter seam fails accounting', tasksSentOrUnknown: budget.tasks,
      success: errors.length === 0, providerCalls: 0 }));
    if (resultWritten.state !== 'settled') fail('result_evidence_unknown');
  }
  if (performance.now() - startedMs > CONTRACT.totalMs) fail('total_time_exceeded_after_evidence_write');
  return { output, success: errors.length === 0, errors, finalElapsedMs: performance.now() - startedMs, finalMeasuredBytes: budget.usedBytes };
}
async function journals(root: string): Promise<Row[]> {
  const found: Row[] = []; let files = 0;
  async function walk(directory: string) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      assert(!entry.isSymbolicLink(), 'Unexpected symlink in owned runner directory.');
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await walk(path);
      else {
        assert(++files <= 300, 'Runner file count exceeded.'); const size = (await stat(path)).size; assert(size <= 256 * 1024, 'Runner file size exceeded.');
        if (!entry.name.endsWith('.json') && !entry.name.endsWith('.tmp')) continue;
        const bytes = await readFile(path); const parsed = JSON.parse(bytes.toString('utf8'));
        const unresolved = entry.name !== 'admission.json' || parsed.inFlight !== null || !Array.isArray(parsed.assignments) || parsed.assignments.length !== 0;
        found.push({ path: relative(root, path), bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), unresolved, value: parsed });
      }
    }
  }
  await walk(root); return found;
}
