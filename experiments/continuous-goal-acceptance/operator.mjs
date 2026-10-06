import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { openSync, writeSync, closeSync, fsyncSync } from 'node:fs';
import { mkdir, lstat, statfs } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { readRecord, writeRecord } from './records.mjs';
import { sourceIdentity, ROOT } from './identity.mjs';
import { BOUNDS, runPaths, measureRun } from './operator-bounds.mjs';
import { startTotalDeadline } from './operator-watchdog.mjs';

function signalGroup(pgid, signal) {
  assert(Number.isSafeInteger(pgid) && pgid > 1);
  try { process.kill(-pgid, signal); return true; } catch (error) { if (error.code === 'ESRCH') return false; throw error; }
}
async function boundedRead(promise, ms) {
  let timer;
  try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Operator observation deadline.')), ms); })]); }
  finally { clearTimeout(timer); }
}
/** Operator wall clock, independent of node:test timeouts. Test-only callers may supply short bounds with owned stand-ins. */
export async function supervise({ child, sample, persist, markStop, outputFailure, bounds = BOUNDS }) {
  const started = performance.now(), groups = new Set(); if (Number.isSafeInteger(child.pid)) groups.add(child.pid);
  const report = { driverPid: child.pid ?? null, outcome: 'unknown', phase: 'work', samples: 0, ownedGroups: [], reason: null };
  let cleanupAt, killSent = false, cleanupKillTimer;
  child.once('error', () => { report.reason ??= 'driver-spawn-unconfirmed'; });
  function stop(reason) {
    report.reason ??= reason;
    if (cleanupAt !== undefined) return;
    cleanupAt = performance.now(); report.phase = 'cleanup';
    for (const pgid of groups) { try { signalGroup(pgid, 'SIGTERM'); } catch { report.signal = 'unknown'; } }
    report.stopCheckpoint = 'pending';
    void markStop(report.reason).then(() => { report.stopCheckpoint = 'durable'; }, () => { report.stopCheckpoint = 'unknown'; });
    cleanupKillTimer = setTimeout(() => {
      killSent = true;
      for (const pgid of groups) { try { signalGroup(pgid, 'SIGKILL'); } catch { report.signal = 'unknown'; } }
    }, Math.max(0, bounds.cleanupMs - 1000));
  }
  const watchdog = setTimeout(() => { void stop('work-deadline'); }, bounds.workMs);
  try {
  for (;;) {
    try {
      const value = await boundedRead(sample(), 250); report.samples++;
      for (const pgid of value.groups) { assert(Number.isSafeInteger(pgid) && pgid > 1); groups.add(pgid); }
      report.last = value.metrics;
    } catch { await stop('resource-observation-or-bound-unconfirmed'); }
    if (outputFailure()) await stop('raw-output-bound-or-write-failed');
    if (report.reason && cleanupAt === undefined) await stop(report.reason);
    if (cleanupAt === undefined && performance.now() - started >= bounds.workMs) await stop('work-deadline');
    const running = [...groups].filter(pgid => { try { return signalGroup(pgid, 0); } catch { report.signal = 'unknown'; return true; } });
    if (child.exitCode !== null || child.signalCode) {
      if (child.exitCode !== 0 && cleanupAt === undefined) await stop('driver-nonzero');
      if (!running.length) break;
      if (cleanupAt === undefined) await stop('driver-exit-with-live-group');
    }
    if (cleanupAt !== undefined) {
      for (const pgid of groups) { if (!killSent) { try { signalGroup(pgid, 'SIGTERM'); } catch { report.signal = 'unknown'; } } }
      if (!killSent && performance.now() - cleanupAt >= Math.max(0, bounds.cleanupMs - 1000)) {
        killSent = true; for (const pgid of running) { try { signalGroup(pgid, 'SIGKILL'); } catch { report.signal = 'unknown'; } }
      }
      if (performance.now() - cleanupAt >= bounds.cleanupMs) break;
    }
    await delay(50);
  }
  report.ownedGroups = [...groups].map(pgid => ({ pgid, state: signalGroup(pgid, 0) ? 'unknown' : 'stopped' }));
  report.exitCode = child.exitCode; report.signalCode = child.signalCode; report.elapsedMs = Math.ceil(performance.now() - started);
  report.outcome = !report.reason && child.exitCode === 0 && report.ownedGroups.every(row => row.state === 'stopped') ? 'processes-complete' : 'unknown-retain';
  await persist(report); return report;
  } finally { clearTimeout(watchdog); clearTimeout(cleanupKillTimer); }
}

export async function operate() {
  assert.equal(process.env.FLOW_O16_PG_WINDOW, 'approved-one-shot');
  const identity = await sourceIdentity(), space = await statfs(ROOT); assert(space.bavail * space.bsize >= BOUNDS.startBytes);
  const run = `rehearsal-${randomUUID()}`, paths = runPaths(run); await mkdir(paths.operator, { recursive: true, mode: 0o700 });
  await writeRecord(join(paths.operator, 'reservation.json'), { kind: 'flow.o16.operator.v1', run, sourceDigest: identity.digest,
    base: identity.base, startedAt: new Date().toISOString(), bounds: BOUNDS, outcome: 'unknown', provider: 0 }, { exclusive: true });
  const watchdog = await startTotalDeadline({ directory: paths.operator, run, sourceDigest: identity.digest });
  await writeRecord(join(paths.operator, 'watchdog.json'), { pid: watchdog.pid, deadline: watchdog.deadline, state: 'armed' }, { exclusive: true });
  const handles = ['stdout.txt', 'stderr.txt'].map(name => openSync(join(paths.operator, name), 'wx', 0o600));
  let raw = 0, written = 0, outputFailed = false;
  const child = spawn(process.execPath, ['--import', 'tsx', '--test', '--test-concurrency=1', 'experiments/continuous-goal-acceptance/journey.test.mjs'],
    { cwd: ROOT, detached: true, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, FLOW_O16_RUN: run, TSX_DISABLE_CACHE: '1' } });
  const capture = index => chunk => {
    raw += chunk.length; if (raw > BOUNDS.rawBytes) outputFailed = true;
    const piece = chunk.subarray(0, Math.max(0, BOUNDS.rawBytes - written));
    try { if (piece.length) { writeSync(handles[index], piece); written += piece.length; } } catch { outputFailed = true; }
  };
  child.stdout.on('data', capture(0)); child.stderr.on('data', capture(1));
  const stop = async reason => {
    try { await writeRecord(paths.stop, { reason, at: new Date().toISOString(), retainResources: true }, { exclusive: true }); }
    catch (error) { if (error.code !== 'EEXIST') throw error; }
  };
  let result;
  const registration = watchdog.register([child.pid]).then(() => writeRecord(join(paths.operator, 'driver.json'),
    { pid: child.pid, pgid: child.pid, state: 'unknown' }, { exclusive: true }));
  void registration.catch(() => { outputFailed = true; });
  const pipesClosed = new Promise(resolve => child.once('close', resolve));
  try {
    result = await supervise({ child, bounds: BOUNDS, outputFailure: () => outputFailed,
      markStop: stop, persist: report => writeRecord(join(paths.operator, 'supervision.json'), report), sample: async () => {
        await registration;
        let resources;
        try { resources = await readRecord(join(paths.evidence, 'resources.json')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
        if (resources) assert.equal(resources.sourceDigest, identity.digest);
        const groups = (resources?.workerProcesses ?? []).map(row => row.pgid);
        await watchdog.register(groups);
        let directory = resources?.directoryRemoved ? undefined : resources?.directory;
        if (directory && resources?.databaseDropped && resources.phase === 'before-owned-directory-remove') {
          const exists = await lstat(directory.path).then(() => true, error => { if (error.code === 'ENOENT') return false; throw error; });
          if (!exists) directory = undefined;
        }
        const metrics = await measureRun(run, directory);
        return { groups, metrics };
      } });
    await boundedRead(pipesClosed, 1000).catch(() => { outputFailed = true; });
  } finally { for (const fd of handles) { fsyncSync(fd); closeSync(fd); } }
  const final = await readRecord(join(paths.evidence, 'decision.json')).catch(() => null);
  const metrics = await measureRun(run).catch(() => null);
  const passed = !outputFailed && result.outcome === 'processes-complete' && metrics && final?.outcome === 'independently-accepted'
    && final.resources.databaseDropped === true && final.resources.directoryRemoved === true && final.resources.errors.length === 0;
  const summary = { run, sourceDigest: identity.digest, outcome: passed ? 'rehearsal-passed' : 'unknown-retain', selected: 1,
    process: result, capturedRawBytes: raw, retainedRawBytes: written, finalMetrics: metrics, nativeQueryCalls: 0 };
  const summaryBytes = Buffer.byteLength(JSON.stringify(summary, null, 2) + '\n');
  if (!metrics || metrics.rawBytes + summaryBytes > BOUNDS.rawBytes) summary.outcome = 'unknown-retain';
  await writeRecord(join(paths.operator, 'result.json'), summary);
  const finalMeasurement = await measureRun(run).catch(() => null);
  if (!finalMeasurement) { summary.outcome = 'unknown-retain'; await writeRecord(join(paths.operator, 'result.json'), summary); }
  await watchdog.complete(); // No timer disarm: a later parent I/O stall remains covered until actual process exit.
  process.stdout.write(JSON.stringify({ run, outcome: summary.outcome, operator: paths.operator }) + '\n');
  if (summary.outcome !== 'rehearsal-passed') process.exitCode = 1;
  return summary;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { assert.deepEqual(process.argv.slice(2), ['--rehearse']); await operate(); }
  catch { process.stderr.write('O16 operator refused or retained an unknown run; inspect its durable reservation.\n'); process.exitCode = 1; }
}
