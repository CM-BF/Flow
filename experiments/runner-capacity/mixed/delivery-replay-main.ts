import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { constants, closeSync, fstatSync, openSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setImmediate as immediate, setTimeout as sleep } from 'node:timers/promises';
import { CONTRACT } from './contract.js';
import { abortable, childReporter, type RecordValue } from './channel.js';
import { centerDelivery, DELIVERY_ENVELOPE_BYTES, type DeliveryInput } from './pg-delivery-bridge.js';
import { decodeReplayTrace, encodedBytes, feedReplay, replayReceiver, type ReplayTrace } from './delivery-replay.js';

const FILE = fileURLToPath(import.meta.url);
const TRANSPORT = Object.freeze({ ...CONTRACT, softBytes: 4 * 1024 * 1024, totalBytes: 4 * 1024 * 1024,
  responseBytes: DELIVERY_ENVELOPE_BYTES, ipcPendingBytes: 1024 * 1024 });
const faultCode = (error: unknown) => error instanceof Error ? error.message.split('\n')[0]?.slice(0, 160) ?? 'unknown' : 'unknown';
export function loadTrace(path: string, hash: string) {
  const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try { const st = fstatSync(fd); assert(st.isFile() && st.size <= 2 * 1024 * 1024, 'trace_file'); return decodeReplayTrace(readFileSync(fd), hash); }
  finally { closeSync(fd); }
}
async function drain(reporter: ReturnType<typeof childReporter>, signal: AbortSignal) {
  while (reporter.pending) { signal.throwIfAborted(); await sleep(1, undefined, { signal }); }
  signal.throwIfAborted(); assert.equal(reporter.dropped, 0, 'reporter_dropped');
}

/** No PG/product imports or provider. External OPS14 remains the sole OS-group supervisor. */
async function worker(mode: DeliveryInput['mode'], path: string, hash: string) {
  assert(process.send && process.connected, 'worker_requires_owned_ipc');
  const lifetime = new AbortController(); const signal = AbortSignal.any([lifetime.signal, AbortSignal.timeout(15000)]);
  const stop = () => lifetime.abort(new Error('worker_cancelled'));
  process.once('disconnect', stop); process.once('SIGTERM', stop);
  const reporter = childReporter(stop, () => TRANSPORT, () => DELIVERY_ENVELOPE_BYTES);
  let startListener: ((value: RecordValue) => void) | undefined;
  try {
    const trace = loadTrace(path, hash);
    const start = new Promise<void>(accept => {
      startListener = value => { if (value.kind === 'replay-start' && value.epoch === trace.epoch) accept(); else stop(); };
      process.once('message', startListener);
    });
    assert(reporter.send({ kind: 'replay-ready', mode, epoch: trace.epoch, traceSha: hash }), 'ready_send');
    await abortable(start, signal);
    process.on('message', stop); // Any later control request terminates this one finite replay.
    const started = performance.now(); const cpu = process.cpuUsage();
    const delivery = centerDelivery({ mode, epoch: trace.epoch }, reporter.send, stop);
    delivery.phase(trace.epoch, 'measure');
    const feed = await feedReplay(trace, delivery.record,
      async () => { await immediate(undefined, { signal }); await sleep(1, undefined, { signal }); },
      performance.now.bind(performance), () => signal.throwIfAborted());
    const beforeFinish = performance.now(); const summary = delivery.finish(); const finished = performance.now();
    assert(summary.known, 'delivery_unknown');
    await drain(reporter, signal); const drained = performance.now();
    const metrics = { ...feed, finishSynchronousMs: finished - beforeFinish, finishToCallbacksDrainedMs: drained - finished,
      workerStartToFirstDrainMs: drained - started, cpuMicroseconds: process.cpuUsage(cpu),
      reporterAtFirstDrain: { pending: reporter.pending, dropped: reporter.dropped, jsonEnvelopeBytes: reporter.total } };
    assert(reporter.send({ kind: 'replay-result', epoch: trace.epoch, mode, metrics }), 'result_send');
    await drain(reporter, signal); // Also drain the result message; parent independently verifies receipt/close.
  } catch (error) { process.exitCode = 1; process.stderr.write(JSON.stringify({ failure: faultCode(error) }) + '\n'); }
  finally {
    if (startListener) process.removeListener('message', startListener);
    process.removeListener('message', stop); process.removeListener('disconnect', stop); process.removeListener('SIGTERM', stop);
    reporter.close(); if (process.connected) process.disconnect();
  }
}

function workerEnvironment() {
  // Only this explicitly supplied owned scratch path is inherited. No admin URL, OPEN, hooks, proxy or HOME.
  const tmp = process.env.TMPDIR;
  assert(tmp && tmp.startsWith('/') && !tmp.includes('\0'), 'owned_tmp_required');
  return { PATH: '/usr/bin:/bin', LANG: 'C', LC_ALL: 'C', TZ: 'UTC', TMPDIR: tmp, TMP: tmp, TEMP: tmp,
    NODE_DISABLE_COMPILE_CACHE: '1' };
}

export async function arm(mode: DeliveryInput['mode'], path: string, hash: string, trace: ReplayTrace, workerFile = FILE) {
  const started = performance.now(); const receipt = replayReceiver(trace, mode);
  const child = fork(workerFile, ['--worker', mode, path, hash], { execPath: process.execPath, execArgv: [],
    env: workerEnvironment(), stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
  let failure: string | null = null; let readySeen = false; let result: RecordValue | null = null;
  let firstMessageMs: number | null = null; let summaryMs: number | null = null; let resultMs: number | null = null;
  let allEnvelopeBytes = 0; let stdoutBytes = 0; let stderrBytes = 0; let stdoutEOF = false; let stderrEOF = false;
  const stderr: Buffer[] = [];
  let controlBytes = 0; let controlMessages = 0; let controlPendingBytes = 0; let controlDropped = 0;
  let startSentMs: number | null = null; let closeFact: { code: number | null; signal: NodeJS.Signals | null } | null = null;
  const sendControl = (value: RecordValue) => {
    const bytes = encodedBytes(value); controlBytes += bytes; controlMessages++;
    if (!child.connected || bytes > DELIVERY_ENVELOPE_BYTES || controlBytes + allEnvelopeBytes > 2 * 1024 * 1024 || controlPendingBytes + bytes > 1024 * 1024) {
      controlDropped++; failure ??= 'control_limit_or_disconnected'; return;
    }
    controlPendingBytes += bytes;
    try { child.send(value, error => { controlPendingBytes -= bytes; if (error) { controlDropped++; failure ??= 'control_callback_unknown'; } }); }
    catch { controlPendingBytes -= bytes; controlDropped++; failure ??= 'control_send_unknown'; }
  };
  const stop = (code: string) => {
    if (failure) return; failure = code;
    sendControl({ kind: 'stop' }); // OPS14 remains the sole OS signal owner.
  };
  child.stdout!.on('data', (chunk: Buffer) => { stdoutBytes += chunk.length; stop('unexpected_worker_stdout'); });
  child.stderr!.on('data', (chunk: Buffer) => { stderrBytes += chunk.length;
    if (stderrBytes <= 4096) stderr.push(Buffer.from(chunk)); else stop('worker_stderr_limit'); });
  child.stdout!.once('end', () => { stdoutEOF = true; }); child.stderr!.once('end', () => { stderrEOF = true; });
  const closed = new Promise<void>(accept => child.once('close', (code, signal) => { closeFact = { code, signal }; accept(); }));
  child.once('error', () => stop('worker_spawn_error'));
  child.on('message', (value: RecordValue) => {
    try {
      const now = performance.now(); firstMessageMs ??= now;
      const bytes = encodedBytes(value); allEnvelopeBytes += bytes;
      assert(bytes <= DELIVERY_ENVELOPE_BYTES && allEnvelopeBytes + controlBytes <= 2 * 1024 * 1024 && value.pid === child.pid, 'worker_envelope');
      assert(typeof value.childMs === 'number' && Number.isFinite(value.childMs) && value.childMs >= 0, 'worker_clock');
      assert(!result, 'message_after_result');
      if (value.kind === 'replay-ready') {
        assert(!readySeen && value.mode === mode && value.epoch === trace.epoch && value.traceSha === hash, 'worker_ready');
        readySeen = true; startSentMs = performance.now();
        sendControl({ kind: 'replay-start', epoch: trace.epoch }); return;
      }
      assert(readySeen, 'message_before_ready');
      if (value.kind === 'replay-result') {
        assert(summaryMs !== null && value.mode === mode && value.epoch === trace.epoch, 'result_before_summary');
        const metrics = value.metrics as Record<string, unknown>;
        const drained = metrics?.reporterAtFirstDrain as Record<string, unknown>;
        assert(drained?.pending === 0 && drained.dropped === 0, 'worker_not_drained');
        for (const key of ['recordPhaseWallMs', 'synchronousRecordMs', 'observedWaitMs', 'finishSynchronousMs', 'finishToCallbacksDrainedMs', 'workerStartToFirstDrainMs']) {
          assert(typeof metrics[key] === 'number' && Number.isFinite(metrics[key]) && metrics[key] >= 0, 'worker_metric_unknown');
        }
        const cpu = metrics.cpuMicroseconds as Record<string, unknown>;
        assert(cpu && [cpu.user, cpu.system, drained.jsonEnvelopeBytes].every(n => Number.isSafeInteger(n) && Number(n) >= 0), 'worker_counter_unknown');
        assert(metrics.batches === 64 && Number(metrics.synchronousRecordMs) <= Number(metrics.recordPhaseWallMs) &&
          Number(metrics.observedWaitMs) <= Number(metrics.recordPhaseWallMs), 'worker_timing_or_batches');
        result = value; resultMs = now; return;
      }
      receipt.accept(value);
      if (value.kind === 'pg-delivery-summary') summaryMs = now;
    } catch (error) { stop(faultCode(error)); }
  });
  const timer = setTimeout(() => stop('arm_deadline'), 15000);
  try { await abortable(closed, AbortSignal.timeout(20000)); }
  catch { stop('worker_close_unknown'); }
  finally { clearTimeout(timer); }
  const end = performance.now(); const received = receipt.complete();
  const closedState = closeFact as { code: number | null; signal: NodeJS.Signals | null } | null;
  if (!received.known) failure ??= received.fault;
  if (controlPendingBytes || controlDropped) failure ??= 'control_not_drained';
  if (!result || !closedState || closedState.code !== 0 || closedState.signal !== null || !stdoutEOF || !stderrEOF || stderrBytes) failure ??= 'worker_completion_unknown';
  return { mode, pid: child.pid ?? null, failure, success: failure === null, exit: closedState, stdoutEOF, stderrEOF, stdoutBytes, stderrBytes,
    stderrPrefix: Buffer.concat(stderr).toString('utf8'), stderrComplete: stderrBytes <= 4096,
    parentStartToClosedMs: end - started, startSentOffsetMs: startSentMs === null ? null : startSentMs - started,
    parentStartCommandToClosedMs: startSentMs === null ? null : end - startSentMs,
    receiveFirstToSummaryMs: firstMessageMs === null || summaryMs === null ? null : summaryMs - firstMessageMs,
    resultReceivedOffsetMs: resultMs === null ? null : resultMs - started, jsonEnvelopeBytes: allEnvelopeBytes + controlBytes,
    parentControl: { jsonBytes: controlBytes, messages: controlMessages, pendingBytes: controlPendingBytes, dropped: controlDropped }, receipt: received, worker: result };
}

async function coordinator(path: string, hash: string) {
  assert(FILE.endsWith('.js'), 'precompiled_js_required');
  assert.equal(process.env.FLOW_S01_REPLAY_OPEN, 's01-observer-delivery-replay-once', 'explicit_future_open_required');
  const started = performance.now(); const trace = loadTrace(path, hash); const arms = [];
  arms.push(await arm('per-query', path, hash, trace));
  if (arms[0]!.success && performance.now() - started < 25000) arms.push(await arm('buffered', path, hash, trace));
  const result = { window: 's01-observer-delivery-replay-once', traceSha: hash, inputRows: trace.rows.length, arms,
    success: arms.length === 2 && arms.every(value => value.success) && performance.now() - started < 50000,
    beforeOutputMs: performance.now() - started, providerCalls: 0, pgConnections: 0 };
  const text = JSON.stringify(result) + '\n'; assert(Buffer.byteLength(text) <= 32768, 'result_limit');
  await new Promise<void>((accept, reject) => process.stdout.write(text, error => error ? reject(error) : accept()));
  if (!result.success || performance.now() - started >= 50000) process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === FILE) {
  const [role, a, b, c] = process.argv.slice(2);
  const operation = role === '--worker' && (a === 'per-query' || a === 'buffered') && b && c ? worker(a, b, c)
    : role === '--authorized-replay-once' && a && b ? coordinator(a, b) : Promise.reject(new Error('fixed_replay_arguments_required'));
  void operation.catch(error => { process.stderr.write(JSON.stringify({ failure: faultCode(error) }) + '\n'); process.exitCode = 1; });
}
