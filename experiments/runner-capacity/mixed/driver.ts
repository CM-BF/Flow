import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, readdir, realpath, rm, stat, writeFile, open, lstat } from 'node:fs/promises';
import { tmpdir, loadavg } from 'node:os';
import { join, resolve, relative, dirname } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { Pool } from 'pg';
import { beforeDeadline } from './deadline.js';
import { StreamBytes } from './stream-bytes.js';
import { ObservationArchive } from './observation-archive.js';
import { memoryObservation } from './channel.js';
import { deliveryInput, deliveryReceipt, DELIVERY_BASELINE, type DeliveryInput } from './pg-delivery-bridge.js';
import { Budget, type BudgetObserver } from './contract.js';
import { QUEUE_PROBE, BUFFERED_QUEUE, BUFFERED_IDENTITY, isQueueIdentity } from './queue-probe.js';
import { createCompletedChat, chatReadPath, validateChatRead, type ChatProbe } from './queue-chat.js';
import { resolvedQueueJournal } from './queue-journal.js';
import { validateQueueCancellation } from './queue-proof.js';
import { COMPARISON } from './ab-budget.js';
import { selectRunIdentity, verifyRunSources } from './run-identity.js';
import { launch, transmit, type Observation } from './process.js';
import { stopProcess, type OwnedProcess } from '../processes.js';
import { boundedText } from '../http.js';
import { directoryBytes } from '../evidence.js';

import { validGate, completionAcks, validateWindow, validateFinal, validatePersistentSessions, validateWindowSamples, type Row, type CaseResult } from './proof.js';
export async function runMixed(windowId: string, target: string, identity?: string, comparison?: { sourceDirectory: string; accounting: BudgetObserver; startedMs: number; deadlineMs: number }, observationDelivery?: DeliveryInput) {
  const startedMs = comparison?.startedMs ?? performance.now();
  const deadlineAt = (offset: number) => Math.min(startedMs + offset, comparison?.deadlineMs ?? Infinity);
  const run = selectRunIdentity(identity);
  const contract = { ...run.contract, base: run.base };
  const delivery = observationDelivery ? deliveryInput(observationDelivery) : undefined;
  // New production recipe/output ownership is a separate preparation gate; old A/B cannot opt into this path.
  if (delivery) { assert.equal(run.base, DELIVERY_BASELINE, 'Delivery requires the fixed current-production recipe.'); assert.equal(contract.cases.length, 1); }
  assert(/^[a-zA-Z0-9-]{8,100}$/.test(windowId), 'A separately authorized window ID is required.');
  const probing = isQueueIdentity(run.id);
  if (probing) assert(delivery && comparison?.sourceDirectory, 'queue_fixed_source_delivery_required');
  if (run.id === BUFFERED_IDENTITY) assert.equal(delivery?.mode, 'buffered', 'queue_single_requires_buffered');
  const comparing = probing || run.id === 'event-state-A-v1' || run.id === 'event-state-B-v1';
  assert.equal(Boolean(comparison), comparing, 'Comparison inputs require the fixed outer entry.');
  if (contract.persistentSessions) assert.equal(windowId, probing ? (run.id === BUFFERED_IDENTITY ? BUFFERED_QUEUE.windowId : QUEUE_PROBE.windowId) : comparing ? COMPARISON.windowId : 's01-128-after-light-reads-once', 'Unexpected128 window identity.');
  assert(/^[a-f0-9]{40}$/.test(target), 'Fixed reviewed source target is required.');
  const git = (...args: string[]) => execFileSync('git', args, { encoding: 'utf8', ...(comparison ? { timeout: Math.max(1, Math.min(5000, comparison.deadlineMs - performance.now())), maxBuffer: 1024 * 1024 } : {}) }).trim();
  assert.equal(git('rev-parse', 'HEAD'), target, 'Source HEAD differs from reviewed target.');
  assert.equal(git('status', '--porcelain', '--untracked-files=no'), '', 'Tracked source is dirty.');
  if (!comparing) git('merge-base', '--is-ancestor', run.base, target);
  await verifyRunSources(run, path => readFile(comparison ? join(comparison.sourceDirectory, path) : path));
  const bindings = JSON.parse(await readFile(new URL('./runtime-dependencies.json', import.meta.url), 'utf8')) as { node: string; files: { path: string; bytes: number; sha256: string }[] };
  assert.equal(process.version, bindings.node, 'Runtime version differs from the frozen dependency binding.');
  for (const binding of bindings.files) { const bytes = await readFile(binding.path); assert.equal(bytes.length, binding.bytes); assert.equal(createHash('sha256').update(bytes).digest('hex'), binding.sha256); }
  assert.equal(await realpath(join(dirname(await realpath('node_modules/pg-boss')), 'pg')), await realpath('node_modules/pg'), 'Scheduler pg must share the observed Pool prototype.');
  const budget = new Budget(startedMs, performance.now.bind(performance), contract, comparison?.accounting);
  const output = resolve(run.output);
  await mkdir(output); // One fixed directory reserves this stage. Existing/unknown runs cannot be retried.
  const databaseName = 'flow_s01_mixed_' + process.pid + '_' + randomUUID().replaceAll('-', '');
  budget.charge('preparation-evidence', await directoryBytes(resolve(run.preparation)));
  budget.charge('final-cli-receipt-reserve', contract.finalCliBytes);
  budget.charge('post-run-archive-reserve', contract.archiveReserveBytes);
  if (contract.persistentSessions) budget.charge('required-source-inputs', run.requiredSources.reduce((n, source) => n + source.bytes, 0) + bindings.files.reduce((n, source) => n + source.bytes, 0));
  const archive = new ObservationArchive(contract, bytes => budget.charge('observation-evidence-reserved', bytes));
  const observations = archive.records; const owned: OwnedProcess[] = []; const cases: CaseResult[] = [];
  const cleanup: Row[] = []; const errors: string[] = [];
  const halt = new AbortController(); let phase = 'setup';
  let admin: Pool | undefined, observer: Pool | undefined, center: OwnedProcess | undefined, runner: OwnedProcess | undefined;
  let databaseFinal: Row | undefined;
  let resourcesClosed = false;
  const databaseMarker = randomUUID(); let databaseIdentity: { oid: number; marker: string } | undefined;
  let workdirIdentity: { dev: number; ino: number } | undefined;
  let baseUrl = '', workdir = '', creationRequested = false, creationAcknowledged = false; let observerLoop: Promise<void> | undefined;
  let observationStop = false; let observedCase: CaseResult | undefined; let latestRows: Row[] = []; let latestSnapshotStart = 0;
  const streams = new StreamBytes(8);
  const requests = new Set<Promise<unknown>>();
  const queueRunnerIds = new Set<string>(); let queueVerified = false;
  const token = randomUUID(); const background = { node: process.version, dependencyBindings: bindings, loadStart: loadavg(), loadEnd: [] as number[] };
  function fail(code: string) { if (!errors.includes(code)) errors.push(code); halt.abort(); }
  function charge(kind: string, bytes: number) { try { budget.charge(kind, bytes); } catch { fail('total_byte_budget_exceeded'); } }
  const pgReceipt = delivery ? deliveryReceipt(delivery, () => fail('pg_delivery_unknown')) : undefined;
  function work() { if (halt.signal.aborted) throw new Error('mixed_stopped'); budget.work(); }
  function receive(value: Observation) {
    if (pgReceipt && ['pg-observation', 'pg-observation-chunk', 'pg-delivery-summary'].includes(value.kind)) {
      if (value.pid !== owned.find(child => child.role === 'center')?.pid) fail('pg_delivery_unowned_source');
      else pgReceipt.accept(value);
    }
    try { archive.append({ ...value, phase }); } catch { fail('observation_reservation_or_bound_exceeded'); return; }
    if (typeof value.transferBytes === 'number') charge('runner-http-bodies', value.transferBytes);
    if (value.kind === 'stream-bytes') { charge('center-node-streams', Number(value.delta)); if (value.complete !== true) fail('center_stream_accounting_unknown'); }
    if (value.kind === 'failure') fail('owned_child_failure');
    if (value.kind === 'child-settled' && value.dropped !== 0) fail('child_observations_dropped');
    if (value.kind === 'center-settled' && value.observationDropped !== 0) fail('pg_observations_dropped');
  }
  async function evidence(name: string, value: unknown, prepaidBytes?: number) {
    const text = prepaidBytes === undefined ? JSON.stringify(value, null, 2) : JSON.stringify(value);
    if (prepaidBytes === undefined) budget.charge('evidence', Buffer.byteLength(text));
    else assert.equal(Buffer.byteLength(text), prepaidBytes, 'observation_reservation_mismatch');
    if (performance.now() >= deadlineAt(contract.cleanup.result)) throw new Error('evidence_deadline');
    if (probing) {
      const file = await open(join(output, name), 'wx', 0o600);
      try { await file.writeFile(text); await file.sync(); } finally { await file.close(); }
      const directory = await open(output, 'r'); try { await directory.sync(); } finally { await directory.close(); }
    } else await writeFile(join(output, name), text, { flag: 'wx', mode: 0o600 });
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
  let ownerRequests = 0;
  function http(path: string, body?: unknown, options?: { token?: string; key?: string }) {
    const pending = performHttp(path, body, options); requests.add(pending);
    void pending.then(() => requests.delete(pending), () => requests.delete(pending));
    return pending;
  }
  async function performHttp(path: string, body?: unknown, options?: { token?: string; key?: string }) {
    work(); if (probing && ++ownerRequests > contract.queueProbe!.ownerHttpLimit) throw new Error('queue_owner_http_limit'); const start = performance.now(); const payload = body === undefined ? undefined : JSON.stringify(body);
    charge('owner-http-request', Buffer.byteLength(payload ?? ''));
    let status: number | null = null;
    try {
      const response = await fetch(baseUrl + path, { method: body === undefined ? 'GET' : 'POST',
        headers: { authorization: 'Bearer ' + (options?.token ?? token), 'content-type': 'application/json', 'idempotency-key': options?.key ?? randomUUID() }, body: payload,
        signal: AbortSignal.any([halt.signal, AbortSignal.timeout(contract.requestMs)]) });
      status = response.status; const text = await boundedText(response, contract.responseBytes);
      charge('owner-http-response', Buffer.byteLength(text)); assert(response.ok, 'owner_http_rejected');
      return JSON.parse(text);
    } finally { receive({ kind: 'owner-http', pid: process.pid, receivedMs: performance.now(), path, status, ...(probing ? { sentDriverMs: start } : {}), elapsedMs: performance.now() - start }); }
  }
  const records = (kind: string, id: string) => observations.filter(value => value.kind === kind && value.caseId === id);
  async function until(predicate: () => boolean, deadline: number, reason: string) {
    while (!predicate()) { work(); if (performance.now() >= deadline) throw new Error(reason); await sleep(10); }
  }
  const memoryTimer = contract.persistentSessions ? setInterval(() => receive({ ...memoryObservation(), role: 'driver', pid: process.pid, receivedMs: performance.now() }), contract.memoryIntervalMs) : undefined;
  const timer = setTimeout(() => fail('work_time_exhausted'), Math.max(1, budget.remainingWorkMs), contract);
  try {
    const sources = await Promise.all((await readdir(resolve('experiments/runner-capacity/mixed'))).filter(name => /\.(ts|json|md)$/.test(name)).sort().map(async name => {
      const path = 'experiments/runner-capacity/mixed/' + name; const bytes = await readFile(path);
      return { path, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
    }));
    if (contract.persistentSessions) budget.charge('fixed-experiment-inputs', sources.reduce((n, source) => n + source.bytes, 0));
    await evidence('reservation.json', { windowId, target, runIdentity: run.id, startedAt: new Date().toISOString(), databaseName, contract, sources, tasksCharged: contract.tasks, previousStageBudget: 'frozen-separate' });
    const configured = process.env.FLOW_S01_ADMIN_URL;
    assert(configured, 'FLOW_S01_ADMIN_URL is required and is never printed.');
    const url = new URL(configured);
    assert(['localhost', '127.0.0.1'].includes(url.hostname) && url.port === '55432', 'Unapproved PostgreSQL endpoint.');
    url.pathname = '/postgres'; url.searchParams.set('application_name', 'flow-s01-mixed-admin');
    const options = { max: 1, connectionTimeoutMillis: 1000, statement_timeout: 1000, query_timeout: 1500 };
    admin = new Pool({ ...options, connectionString: url.href }); admin.on('connect', client => streams.addPgClient(client)); admin.on('error', () => fail('admin_connection_failed'));
    if (probing) await evidence('create-request.json', { windowId, target, databaseName, marker: databaseMarker, requestedAt: new Date().toISOString() });
    creationRequested = true;
    await query(admin, 'CREATE DATABASE "' + databaseName + '"'); creationAcknowledged = true;
    if (probing) {
      await query(admin, 'COMMENT ON DATABASE \"' + databaseName + '\" IS \'' + databaseMarker + '\'');
      const identity = (await query(admin, `SELECT oid::int AS oid,shobj_description(oid,'pg_database') AS marker FROM pg_database WHERE datname=$1`, [databaseName])).rows[0];
      assert(identity && Number.isSafeInteger(identity.oid) && identity.marker === databaseMarker, 'queue_database_identity_unknown');
      databaseIdentity = { oid: identity.oid, marker: identity.marker };
      await evidence('database-identity.json', { windowId, target, databaseName, ...databaseIdentity, createAcknowledged: true });
    }
    url.pathname = '/' + databaseName; url.searchParams.set('application_name', 'flow-s01-mixed-center');
    const databaseUrl = url.href;
    url.searchParams.set('application_name', 'flow-s01-mixed-observer'); observer = new Pool({ ...options, connectionString: url.href }); observer.on('connect', client => streams.addPgClient(client)); observer.on('error', () => fail('observer_connection_failed'));
    workdir = await mkdtemp(join(tmpdir(), 'flow-s01-mixed-'));
    if (probing) { const identity = await lstat(workdir); assert(identity.isDirectory() && !identity.isSymbolicLink()); workdirIdentity = { dev: identity.dev, ino: identity.ino }; await evidence('runner-directory.json', { workdir, ...workdirIdentity }); }
    const checkpoint = probing ? async (child: OwnedProcess) => {
      const saved = await beforeDeadline(Math.min(startedMs + contract.workMs, performance.now() + contract.requestMs), () => evidence(child.role + '-spawn.json', { windowId, target, pid: child.pid, role: child.role, driverPid: process.pid, spawnObservedAt: new Date().toISOString(), processGroup: 'inherits outer supervised group' }));
      assert.equal(saved.state, 'settled', 'queue_child_checkpoint_unknown');
    } : undefined;
    center = await launch({ role: 'center', databaseUrl, ownerToken: token, runIdentity: run.id, sourceDirectory: comparison?.sourceDirectory, ...(delivery ? { pgDelivery: delivery } : {}) }, owned, receive, charge, Math.min(12000, budget.remainingWorkMs), contract, checkpoint);
    baseUrl = String(center.ready.baseUrl);
    assert(/^http:\/\/127\.0\.0\.1:\d+$/.test(baseUrl), 'Unexpected center endpoint.');
    runner = await launch({ role: 'runner', runIdentity: run.id, sourceDirectory: comparison?.sourceDirectory, ...(delivery ? { pgDelivery: delivery } : {}) }, owned, receive, charge, Math.min(12000, budget.remainingWorkMs), contract, checkpoint);
    const pgVersion = (await query(observer, 'SHOW server_version')).rows[0].server_version;
    await evidence('owned-resources.json', { databaseName, workdir, processes: owned.map(p => ({ role: p.role, pid: p.pid })), baseUrl, pgVersion });
    let chat: ChatProbe | undefined;
    if (probing) {
      chat = await createCompletedChat(http, () => budget.submit(), comparison!.sourceDirectory, Math.min(startedMs + contract.workMs, performance.now() + 45000), work);
      await evidence('chat-fixture.json', { ...chat, providerCalls: 0, basis: 'public protocol synthetic completion, not SDK/native' });
    }
    observerLoop = (async () => {
      while (!observationStop && !halt.signal.aborted) {
        const began = performance.now();
        if (observedCase) {
          const snapshotStart = performance.now();
          const rows = (await query(observer!, `SELECT t.id AS task_id,t.status,t.owner_version AS task_version,t.current_attempt_id,
            a.id AS attempt_id,a.runner_id,a.owner_version,a.completed_at,a.last_sequence,a.last_heartbeat_at,a.last_event_at,
            a.lease_expires_at>clock_timestamp() AS live,a.lease_expires_at,clock_timestamp() AS observed_at,a.native_session_id,s.id AS session_id,s.runner_id AS session_runner_id,
            s.harness AS session_harness,s.active_task_id AS session_task_id FROM flow.tasks t LEFT JOIN flow.attempts a ON t.current_attempt_id=a.id
            LEFT JOIN flow.sessions s ON s.id=a.native_session_id AND s.harness='fixture'
            WHERE t.id=ANY($1::text[]) ORDER BY t.id`, [observedCase.taskIds])).rows;
          latestRows = rows; latestSnapshotStart = snapshotStart;
          receive({ kind: 'attempt-snapshot', pid: process.pid, receivedMs: performance.now(), caseId: observedCase.id, queryStartedMs: snapshotStart, queryEndedMs: performance.now(), rows });
        }
        const activity = (await query(observer!, `SELECT pid,application_name,state,wait_event_type,wait_event,
          pg_blocking_pids(pid) AS blockers FROM pg_stat_activity WHERE datname=$1 AND pid<>pg_backend_pid()`, [databaseName])).rows;
        receive({ kind: 'pg-activity', pid: process.pid, receivedMs: performance.now(), activity });
        await sleep(Math.max(1, contract.observationMs - (performance.now() - began)));
      }
    })().catch(() => { if (!observationStop) fail('observer_failed'); });
    for (const scenario of contract.cases) {
      work(); assert(budget.remainingWorkMs > contract.minimumCaseBudgetMs, 'Insufficient budget for next complete case.');
      const result: CaseResult = { id: scenario.id, taskIds: [], cancelled: [], gate: [], windowComplete: false, settledByDeadline: false };
      cases.push(result); phase = scenario.id + ':setup';
      const registrations = [];
      for (let index = 0; index < scenario.runners; index++) {
        const registration = await http('/api/runners', { name: 'S01 mixed ' + scenario.id + ' ' + index, harnesses: ['fixture'], capacity: scenario.slots });
        assert(typeof registration.runnerId === 'string' && typeof registration.token === 'string', 'Invalid runner registration.');
        if (probing) queueRunnerIds.add(registration.runnerId);
        registrations.push({ ...registration, directory: join(workdir, scenario.id, String(index)), slots: scenario.slots });
      }
      for (let index = 0; index < scenario.runners * scenario.slots; index++) {
        budget.submit();
        const response = await http('/api/tasks', { title: 'S01 mixed ' + index, prompt: 'deterministic mixed fixture', harness: 'fixture',
          fixture: { scenario: 'success', delayMs: 0 }, verification: { kind: 'nonempty' } });
        assert(typeof response.task?.id === 'string' && !result.taskIds.includes(response.task.id), 'Invalid task acknowledgement.');
        result.taskIds.push(response.task.id);
      }
      result.cancelled = result.taskIds.slice(0, contract.cancelCount); latestRows = []; observedCase = result;
      await transmit(runner, { kind: 'case', caseId: result.id, baseUrl, taskIds: result.taskIds, runners: registrations }, charge, contract);
      await until(() => records('adapter-end', result.id).length === 0 && latestSnapshotStart >= Math.max(...records('adapter-ready', result.id).map(value => value.receivedMs)) && validGate(result, latestRows, records('claim', result.id), records('adapter-ready', result.id), records('event-ack', result.id), records('heartbeat', result.id), contract),
        Math.min(startedMs + contract.workMs - contract.caseMs - contract.settlementMs - contract.requestMs, performance.now() + contract.gateMs), 'actual_attempt_gate_not_reached');
      result.gate = latestRows;
      phase = scenario.id + ':window';
      result.measureSentMs = performance.now();
      if (delivery) {
        await transmit(center, { kind: 'pg-phase', epoch: delivery.epoch, phase: 'measure' }, charge, contract);
        await until(() => observations.some(value => value.kind === 'pg-phase-ack' && value.epoch === delivery.epoch && value.deliveryPhase === 'measure'), performance.now() + contract.requestMs, 'pg_phase_unknown');
      }
      await transmit(runner, { kind: 'measure', ...(delivery ? { epoch: delivery.epoch } : {}) }, charge, contract);
      await until(() => records('window-start', result.id).length === 1 && (!delivery || records('window-start', result.id)[0]?.epoch === delivery.epoch), performance.now() + contract.requestMs, 'missing_window_start');
      const windowStart = records('window-start', result.id)[0]!.receivedMs;
      let readIndex = 0, nextRead = windowStart, skipped = 0; const reads = new Set<Promise<void>>();
      let cancelled = false; const cancellations: Promise<void>[] = [];
      while (!records('window-end', result.id).length) {
        work(); assert(performance.now() < windowStart + contract.caseMs + contract.requestMs, 'missing_window_end');
        const now = performance.now();
        if (!probing && result.cancelled.length && !cancelled && now >= windowStart + contract.cancelMs) {
          cancelled = true;
          for (const taskId of result.cancelled) cancellations.push(http('/api/tasks/' + taskId + '/cancel', {}).then(response => {
            assert(response.id === taskId && response.status === 'cancel_requested', 'Cancellation was not accepted for the bound running task.');
            receive({ kind: 'cancel-accepted', pid: process.pid, receivedMs: performance.now(), caseId: result.id, taskId });
          }).catch(() => fail('cancel_http_failed')));
        }
        if (now >= nextRead) {
          nextRead = now + contract.readIntervalMs;
          if (reads.size >= contract.maxReads) skipped++;
          else if (probing && readIndex >= contract.queueProbe!.lightReadLimit) throw new Error('queue_light_read_limit');
          else {
            const index = readIndex++; const taskId = result.taskIds[index % result.taskIds.length]!;
            const path = chat ? chatReadPath(chat, index) : '/api/tasks/' + taskId + (index % 2 ? '/events?after=0&limit=20' : '');
            const sentDriverMs = performance.now();
            const read = http(path).then(response => {
              if (chat) validateChatRead(chat, response, index % 2 === 1);
              if (probing) receive({ kind: 'light-read-result', pid: process.pid, receivedMs: performance.now(), caseId: result.id, index, sentDriverMs, succeeded: true });
            }).catch(() => { if (probing) receive({ kind: 'light-read-result', pid: process.pid, receivedMs: performance.now(), caseId: result.id, index, sentDriverMs, succeeded: false }); fail('light_read_failed'); }).finally(() => reads.delete(read)); reads.add(read);
          }
        }
        await sleep(5);
      }
      if (delivery && records('window-end', result.id)[0]?.epoch !== delivery.epoch) throw new Error('runner_epoch_unknown');
      result.windowComplete = true;
      const readsAtWindowEnd = reads.size;
      if (probing) receive({ kind: 'driver-boundary', pid: process.pid, receivedMs: performance.now(), caseId: result.id, boundary: 'window-end', lightReadsInFlight: readsAtWindowEnd, ownerRequestsInFlight: requests.size });
      if (delivery) {
        await transmit(center, { kind: 'pg-phase', epoch: delivery.epoch, phase: 'after' }, charge, contract);
        await until(() => observations.some(value => value.kind === 'pg-phase-ack' && value.epoch === delivery.epoch && value.deliveryPhase === 'after'), performance.now() + contract.requestMs, 'pg_phase_unknown');
      }
      if (probing) {
        // Fresh server fence immediately before the four commands; no already-completed target counts as cancellation.
        const rows: Row[] = (await query(observer, `SELECT t.id,t.status,t.current_attempt_id,t.owner_version AS task_version,
          a.id AS attempt_id,a.runner_id,a.owner_version,a.completed_at,a.lease_expires_at>clock_timestamp() AS live
          FROM flow.tasks t JOIN flow.attempts a ON a.id=t.current_attempt_id WHERE t.id=ANY($1::text[])`, [result.cancelled])).rows;
        assert.equal(rows.length, 4, 'queue_cancel_targets_missing');
        for (const row of rows) {
          const original = result.gate.find(item => item.task_id === row.id);
          assert(original && row.status === 'running' && row.completed_at === null && row.live && row.task_version === row.owner_version &&
            row.attempt_id === original.attempt_id && row.owner_version === original.owner_version && row.runner_id === original.runner_id, 'queue_cancel_target_not_active');
        }
        receive({ kind: 'cancel-fence', pid: process.pid, receivedMs: performance.now(), caseId: result.id, rows });
        for (const taskId of result.cancelled) {
          const sentDriverMs = performance.now(); const key = randomUUID();
          receive({ kind: 'cancel-send', pid: process.pid, receivedMs: sentDriverMs, caseId: result.id, taskId, key });
          cancellations.push(http('/api/tasks/' + taskId + '/cancel', {}, { key }).then(response => {
            assert(response.id === taskId && response.status === 'cancel_requested', 'queue_cancel_not_accepted');
            receive({ kind: 'cancel-accepted', pid: process.pid, receivedMs: performance.now(), caseId: result.id, taskId, sentDriverMs });
          }).catch(() => fail('cancel_http_failed')));
        }
      }
      phase = scenario.id + ':settlement';
      const settlementDeadline = records('window-end', result.id)[0]!.receivedMs + contract.settlementMs + (contract.queueProbe?.activityTailMs ?? 0);
      await Promise.all(cancellations); await Promise.all(reads);
      await until(() => records('adapter-end', result.id).length === result.taskIds.length && completionAcks(records('event-ack', result.id)).size === result.taskIds.length,
        settlementDeadline, 'completion_settlement_timeout');
      assert(performance.now() <= settlementDeadline, 'completion_settlement_timeout');
      result.settledByDeadline = true;
      receive({ kind: 'read-summary', pid: process.pid, receivedMs: performance.now(), caseId: result.id, issued: readIndex, skipped });
      validateWindow(result, observations, contract);
      validateWindowSamples(result, observations, contract);
      await transmit(runner, { kind: 'stop-case' }, charge, contract);
      await until(() => records('case-runtime-settled', result.id).length === 1, performance.now() + contract.settlementMs, 'runtime_shutdown_timeout');
      phase = scenario.id + ':verification';
      result.final = (await query(observer, 'SELECT t.id,t.status,t.verification_status,a.id AS attempt_id,a.runner_id,a.owner_version,a.completed_at,a.last_sequence,a.native_session_id FROM flow.tasks t JOIN flow.attempts a ON a.task_id=t.id WHERE t.id=ANY($1::text[]) ORDER BY t.id', [result.taskIds])).rows;
      result.events = (await query(observer, 'SELECT e.* FROM flow.runner_events e JOIN flow.attempts a ON a.id=e.attempt_id WHERE a.task_id=ANY($1::text[]) ORDER BY e.attempt_id,e.sequence', [result.taskIds])).rows;
      validateFinal(result, records('event-ack', result.id));
      if (probing) {
        receive({ kind: 'final-state-observed', pid: process.pid, receivedMs: performance.now(), caseId: result.id, rows: result.final });
        result.queueCancellation = validateQueueCancellation(result, observations);
        const boundaries = observations.filter(row => row.kind === 'center-boundary' && row.epoch === delivery!.epoch);
        assert.equal(boundaries.length, 2, 'queue_center_boundary_missing');
        assert.deepEqual(boundaries.map(row => row.requestedPhase), ['measure', 'after']);
        assert(boundaries.every(row => row.known === true && Number.isSafeInteger(row.acquisitionsInFlight) && Number.isSafeInteger(row.queriesInFlight)), 'queue_center_boundary_unknown');
        result.queueCenterBoundaries = boundaries;
        assert.equal(records('light-read-result', result.id).length, readIndex, 'queue_light_read_unknown');
        result.queueReads = { issued: readIndex, settled: records('light-read-result', result.id).length, skipped, inFlightAtWindowEnd: readsAtWindowEnd, boundaryBasis: 'driver receipt, not synchronized runner epoch' };
      }
      if (contract.persistentSessions) {
        result.sessions = (await query(observer, 'SELECT id,harness,runner_id,active_task_id FROM flow.sessions ORDER BY id')).rows;
        result.totals = (await query(observer, 'SELECT (SELECT count(*) FROM flow.tasks) AS tasks,(SELECT count(*) FROM flow.attempts) AS attempts,(SELECT count(*) FROM flow.sessions) AS sessions')).rows[0];
        validatePersistentSessions(result, records('event-ack', result.id), contract);
      }
      const perRunner = new Map<string, number>(); for (const row of result.final) perRunner.set(row.runner_id, (perRunner.get(row.runner_id) ?? 0) + 1);
      assert.equal(perRunner.size, scenario.runners); assert([...perRunner.values()].every(count => count === scenario.slots), 'Runner topology differs from the fixed configuration.');
      const caseJournals = await journals(join(workdir, scenario.id), contract.journalFiles, probing ? queueRunnerIds : undefined);
      if (contract.persistentSessions) assert.equal(caseJournals.length, scenario.runners, 'unexpected_journal_count');
      if (caseJournals.some(file => file.unresolved)) { await evidence(result.id + '-retained-journals.json', caseJournals); throw new Error('case_admission_or_outbox_retained'); }
      if (probing) queueVerified = true;
      observedCase = undefined;
    }
  } catch (error) {
    const code = error instanceof Error && /^[a-z_]{3,80}$/.test(error.message) ? error.message : 'mixed_run_failed';
    fail(code); if (cases.length) cases.at(-1)!.failure = code;
  } finally {
    clearTimeout(timer); clearInterval(memoryTimer); phase = 'cleanup'; observationStop = true; halt.abort();
    const childDeadline = Math.min(performance.now() + (contract.persistentSessions ? 12000 : 6000), deadlineAt(contract.cleanup.child));
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
    if (pgReceipt && !pgReceipt.complete()) fail('pg_delivery_unknown');
    const drained = await beforeDeadline(deadlineAt(contract.cleanup.drain), async () => {
      await Promise.allSettled([...requests]); await observerLoop;
      if (contract.persistentSessions && allChildrenClosed && observer) {
        databaseFinal = (await query(observer, `SELECT jsonb_build_object(
          'totals', jsonb_build_object('tasks',(SELECT count(*) FROM flow.tasks),'attempts',(SELECT count(*) FROM flow.attempts),'sessions',(SELECT count(*) FROM flow.sessions)),
          'attempts',(SELECT coalesce(jsonb_agg(x),'[]') FROM (SELECT id,task_id,runner_id,owner_version,native_session_id,completed_at,last_sequence,lease_expires_at FROM flow.attempts ORDER BY id LIMIT 129) x),
          'sessions',(SELECT coalesce(jsonb_agg(x),'[]') FROM (SELECT id,harness,runner_id,active_task_id FROM flow.sessions ORDER BY id LIMIT 129) x)) AS snapshot`, [], true)).rows[0]?.snapshot;
        if (!databaseFinal || Number(databaseFinal.totals.tasks) !== contract.tasks || Number(databaseFinal.totals.attempts) !== contract.tasks
          || Number(databaseFinal.totals.sessions) !== contract.tasks) fail('final_database_totals_not_exact');
      }
    });
    if (drained.state !== 'settled') { cleanup.push({ observerOrHttpRetained: true, reason: drained.reason }); fail('observation_drain_unknown'); }
    const observerClosed = await beforeDeadline(deadlineAt(contract.cleanup.observer), async () => { await observer?.end(); });
    if (observerClosed.state !== 'settled') { streams.destroyOwned(); cleanup.push({ observerRetained: true }); fail('observer_close_unknown'); }
    if (creationRequested && admin) {
      if (!creationAcknowledged) cleanup.push({ databaseName, creationUnknown: true });
      if (probing && (!creationAcknowledged || !databaseIdentity) || !allChildrenClosed || observerClosed.state !== 'settled' || drained.state !== 'settled') {
        cleanup.push({ databaseName, retained: true, reason: 'owned_connections_not_confirmed_closed' }); fail('database_retained');
      } else {
        const exists = await beforeDeadline(deadlineAt(contract.cleanup.exists), () => query(admin!, probing ? `SELECT oid::int AS oid,shobj_description(oid,'pg_database') AS marker FROM pg_database WHERE datname=$1` : 'SELECT 1 FROM pg_database WHERE datname=$1', [databaseName], true));
        if (exists.state !== 'settled') { cleanup.push({ databaseName, retained: true, creationUnknown: !creationAcknowledged }); fail('database_existence_unknown'); }
        else if (!exists.value.rowCount) cleanup.push({ databaseName, absentAtCheck: true, creationUnknown: !creationAcknowledged });
        else if (probing && (exists.value.rows[0]?.oid !== databaseIdentity?.oid || exists.value.rows[0]?.marker !== databaseIdentity?.marker)) { cleanup.push({ databaseName, retained: true, reason: 'database_identity_changed' }); fail('database_identity_unknown'); }
        else {
          const connections = await beforeDeadline(deadlineAt(contract.cleanup.connections), () => query(admin!, 'SELECT pid FROM pg_stat_activity WHERE datname=$1', [databaseName], true));
          if (connections.state !== 'settled' || connections.value.rows.length) {
            cleanup.push({ databaseName, retained: true, reason: 'database_connections_or_query_unknown' }); fail('database_connections_retained');
          } else {
            const dropped = await beforeDeadline(deadlineAt(contract.cleanup.drop), () => query(admin!, 'DROP DATABASE "' + databaseName + '"', [], true));
            cleanup.push({ databaseName, dropped: dropped.state === 'settled', retained: dropped.state !== 'settled' });
            if (dropped.state !== 'settled') fail('database_drop_unknown');
            else if (contract.persistentSessions) {
              const absent = await beforeDeadline(deadlineAt(contract.cleanup.absent), () => query(admin!, 'SELECT 1 FROM pg_database WHERE datname=$1', [databaseName], true));
              const confirmed = absent.state === 'settled' && absent.value.rowCount === 0;
              cleanup.push({ databaseName, absentConfirmed: confirmed }); if (!confirmed) fail('database_absence_unknown');
            }
          }
        }
      }
    }
    const adminClosed = await beforeDeadline(deadlineAt(contract.cleanup.admin), async () => { await admin?.end(); });
    if (adminClosed.state !== 'settled') { streams.destroyOwned(); cleanup.push({ adminRetained: true }); fail('admin_close_unknown'); }
    const finalStreams = streams.sample(); charge('driver-pg-node-streams', finalStreams.delta); if (!finalStreams.complete) fail('driver_stream_accounting_unknown');
    if (workdir) {
      const archived = await beforeDeadline(deadlineAt(contract.cleanup.journal), async () => {
        const retained = await journals(workdir, contract.journalFiles, probing && queueVerified ? queueRunnerIds : undefined);
        if (performance.now() >= deadlineAt(contract.cleanup.journal)) throw new Error('journal_archive_deadline');
        await evidence('journals.json', retained);
        if (performance.now() >= deadlineAt(contract.cleanup.journal)) throw new Error('journal_removal_deadline');
        if (retained.some(file => file.unresolved) || !allChildrenClosed) { cleanup.push({ workdir, retained: true }); fail('admission_or_outbox_retained'); }
        else {
          if (probing) { const current = await lstat(workdir); assert(workdirIdentity && current.isDirectory() && !current.isSymbolicLink() && current.dev === workdirIdentity.dev && current.ino === workdirIdentity.ino, 'queue_directory_identity_unknown'); }
          await rm(workdir, { recursive: true });
          if (probing) { let absent = false; try { await lstat(workdir); } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') absent = true; else throw error; } assert(absent, 'queue_directory_absence_unknown'); }
          cleanup.push({ workdir, ...(probing ? workdirIdentity : {}), removed: true });
        }
      });
      if (archived.state !== 'settled') { cleanup.push({ workdir, retained: true }); fail('journal_cleanup_unknown'); }
    }
    background.loadEnd = loadavg();
    if (contract.persistentSessions) for (const role of ['driver', 'center', 'runner']) {
      if (!observations.some(value => value.kind === 'memory' && value.role === role && Number(value.rss) > 0)) fail('process_memory_observation_missing');
    }
    if (!observations.some(value => value.kind === 'stream-bytes' && Number(value.streams) > 0)) fail('center_stream_accounting_missing');
    if (!cases.every(value => value.settledByDeadline) || cases.length !== contract.cases.length) fail('configured_cases_not_completed');
    if (performance.now() > deadlineAt(contract.totalMs)) fail('total_time_exceeded');
    const observationsWritten = await beforeDeadline(deadlineAt(contract.cleanup.observations), () => evidence('observations.json', observations, archive.prepaidBytes));
    if (observationsWritten.state !== 'settled') fail('observation_evidence_unknown');
    const resultWritten = await beforeDeadline(deadlineAt(contract.cleanup.result), () => evidence('result.json', { windowId, target, runIdentity: run.id, contract, cases, databaseFinal, errors, cleanup, background,
      elapsedMs: performance.now() - startedMs, elapsedBasis: 'through result serialization; final CLI receipt includes final file write',
      byteAccountingComplete: finalStreams.complete && adminClosed.state === 'settled' && observerClosed.state === 'settled' && drained.state === 'settled' && observations.some(value => value.kind === 'center-settled') && !errors.some(code => code.includes('stream') || code.includes('child_cleanup') || code.includes('observation')),
      measuredBytesBeforeResult: budget.usedBytes, byteCategoriesBeforeResult: budget.categories,
      byteBasis: 'self-owned center HTTP/PG and driver PG Node stream counters + conservative duplicate HTTP/SQL/row payloads + IPC + evidence',
      transportAttribution: 'Node stream bytes, not TCP/IP retransmits or interface packets; missing counter seam fails accounting', tasksSentOrUnknown: budget.tasks,
      success: errors.length === 0, providerCalls: 0 }));
    if (resultWritten.state !== 'settled') fail('result_evidence_unknown');
  }
  resourcesClosed = owned.length === 2 && cleanup.filter(row => typeof row.pid === 'number').length === 2
    && cleanup.filter(row => typeof row.pid === 'number').every(row => row.exited === true)
    && cleanup.some(row => row.databaseName === databaseName && row.absentConfirmed === true)
    && cleanup.some(row => row.workdir === workdir && row.removed === true)
    && !cleanup.some(row => row.retained || row.observerRetained || row.adminRetained || row.observerOrHttpRetained);
  if (performance.now() > deadlineAt(contract.totalMs)) fail('total_time_exceeded_after_evidence_write');
  return { output, success: errors.length === 0, errors, resourcesClosed, tasksSentOrUnknown: budget.tasks, finalElapsedMs: performance.now() - startedMs, finalMeasuredBytes: budget.usedBytes };
}
async function journals(root: string, maxFiles = 300, queueRunnerIds?: ReadonlySet<string>): Promise<Row[]> {
  const found: Row[] = []; let files = 0;
  async function walk(directory: string) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      assert(!entry.isSymbolicLink(), 'Unexpected symlink in owned runner directory.');
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await walk(path);
      else {
        assert(++files <= maxFiles, 'Runner file count exceeded.'); const size = (await stat(path)).size; assert(size <= 256 * 1024, 'Runner file size exceeded.');
        if (!entry.name.endsWith('.json') && !entry.name.endsWith('.tmp')) continue;
        const bytes = await readFile(path); const parsed = JSON.parse(bytes.toString('utf8'));
        const unresolved = entry.name !== 'admission.json' || (queueRunnerIds ? !resolvedQueueJournal(parsed, queueRunnerIds) : parsed.inFlight !== null || !Array.isArray(parsed.assignments) || parsed.assignments.length !== 0);
        found.push({ path: relative(root, path), bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), unresolved, value: parsed });
      }
    }
  }
  await walk(root); return found;
}
