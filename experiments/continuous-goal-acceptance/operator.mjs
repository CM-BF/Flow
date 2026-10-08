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
import { BOUNDS, runPaths, measureRun, measureFinalRun, measurementFailure } from './operator-bounds.mjs';
import { recordQueryCount } from './query-policy.mjs';
import { startTotalDeadline } from './operator-watchdog.mjs';
import { stageSpec, stagePassed, assertNativeReady } from './stage-policy.mjs';
import { readPermitFile, validatePermit } from './permit.mjs';
import { nativeEnvironmentPolicy, prepareDriverEnvironment } from './native-environment.mjs';

function signalGroup(pgid, signal) {
  assert(Number.isSafeInteger(pgid) && pgid > 1);
  try { process.kill(-pgid, signal); return true; } catch (error) { if (error.code === 'ESRCH') return false; throw error; }
}
async function boundedRead(promise, ms) {
  let timer;
  try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(Object.assign(
    new Error('Operator observation deadline.'), { code: 'O16_OBSERVATION_DEADLINE', constraint: 'observationDeadline' })), ms); })]); }
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
    } catch (error) {
      report.observationFailure ??= measurementFailure(error);
      await stop('resource-observation-or-bound-unconfirmed');
    }
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

export function operationArguments(args) {
  if (args.length === 1 && args[0] === '--rehearse') return { phase: 'rehearse' };
  const [flag, run, file] = args, phase = flag?.slice(2);
  assert(args.length === 3 && flag === `--${phase}` && ['plan', 'confirm', 'renew', 'children', 'decide'].includes(phase));
  runPaths(run, phase); assert(typeof file === 'string' && file.length > 0);
  return { phase, run, file: resolve(file) };
}
export async function operate({ phase = 'rehearse', run: selectedRun, file } = {}) {
  const spec = stageSpec(phase);
  const rawPermit = ['plan', 'children'].includes(phase) ? await readPermitFile(file) : undefined;
  const identity = await sourceIdentity();
  if (rawPermit) {
    // The driver subsequently binds children to the actual persisted confirmation before reserving a slot.
    const permit = validatePermit(rawPermit, { identity, phase, confirmation: rawPermit.confirmation, environmentDigest: nativeEnvironmentPolicy.digest });
    assertNativeReady('native', permit, nativeEnvironmentPolicy.digest);
  }
  assert.equal(process.env.FLOW_O16_PG_WINDOW, 'approved-one-shot');
  const space = await statfs(ROOT); assert(space.bavail * space.bsize >= BOUNDS.startBytes);
  const run = selectedRun ?? `rehearsal-${randomUUID()}`, paths = runPaths(run, phase);
  if (phase === 'plan' || phase === 'rehearse' || phase === 'renew') {
    await mkdir(join(paths.operatorRoot, '..'), { recursive: true, mode: 0o700 });
    await mkdir(paths.operatorRoot, { mode: 0o700 }); // Existing namespace is never reused, including partial prior reservations.
    await assert.rejects(lstat(paths.evidence), { code: 'ENOENT' });
  } else {
    const info = await lstat(paths.operatorRoot); assert(info.isDirectory() && !info.isSymbolicLink());
  }
  if (phase !== 'rehearse') await mkdir(paths.operator, { mode: 0o700 });
  await writeRecord(join(paths.operator, 'reservation.json'), { kind: 'flow.o16.operator.v1', run, sourceDigest: identity.digest,
    base: identity.base, phase, startedAt: new Date().toISOString(), bounds: BOUNDS, outcome: 'unknown',
    nativeQueries: ['rehearse', 'confirm', 'renew', 'decide'].includes(phase) ? 0 : 'not-started' }, { exclusive: true });
  const watchdog = await startTotalDeadline({ directory: paths.operator, run, sourceDigest: identity.digest });
  await writeRecord(join(paths.operator, 'watchdog.json'), { pid: watchdog.pid, deadline: watchdog.deadline, state: 'armed' }, { exclusive: true });
  const handles = ['stdout.txt', 'stderr.txt'].map(name => openSync(join(paths.operator, name), 'wx', 0o600));
  let raw = 0, written = 0, outputFailed = false;
  const args = phase === 'rehearse'
    ? ['--import', 'tsx', '--test', '--test-concurrency=1', 'experiments/continuous-goal-acceptance/journey.test.mjs']
    : ['--import', 'tsx', 'experiments/continuous-goal-acceptance/driver.mjs', phase, run, file];
  const driverEnvironment = phase === 'rehearse' ? undefined : await prepareDriverEnvironment(paths.operator, run, phase);
  if (driverEnvironment) await writeRecord(join(paths.operator, 'driver-environment.json'), driverEnvironment, { exclusive: true });
  const child = spawn(process.execPath, args,
    { cwd: ROOT, detached: true, stdio: ['ignore', 'pipe', 'pipe'], env: driverEnvironment?.environment
      ?? { ...process.env, FLOW_O16_RUN: run, FLOW_O16_OPERATOR_PHASE: phase, TSX_DISABLE_CACHE: '1' } });
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
        try { resources = await readRecord(join(paths.evidence, 'resources.json')); }
        catch (error) { if (error.code !== 'ENOENT') throw Object.assign(error, { measurementStage: 'resources-record' }); }
        if (resources && resources.sourceDigest !== identity.digest) throw Object.assign(new Error('Resource source binding differs.'),
          { code: 'O16_RESOURCE_FACTS', measurementStage: 'resources-record', constraint: 'sourceDigest' });
        const groups = (resources?.workerProcesses ?? []).filter(row => row.state !== 'stopped').map(row => row.pgid);
        await watchdog.register(groups);
        let directory = resources?.directoryRemoved ? null : resources?.directory;
        if (directory && resources?.databaseDropped && resources.phase === 'before-owned-directory-remove') {
          const exists = await lstat(directory.path).then(() => true, error => { if (error.code === 'ENOENT') return false; throw error; });
          if (!exists) directory = undefined;
        }
        const metrics = await measureRun(run, directory);
        return { groups, metrics };
      } });
    await boundedRead(pipesClosed, 1000).catch(() => { outputFailed = true; });
  } finally { for (const fd of handles) { fsyncSync(fd); closeSync(fd); } }
  const final = await readRecord(join(paths.evidence, spec.file), 262_144).catch(() => null);
  const pause = spec.next ? await readRecord(join(paths.evidence, 'pause.json')).catch(() => null) : undefined;
  const measurement = await measureFinalRun(run, identity.digest), metrics = measurement.metrics;
  const passed = !outputFailed && result.outcome === 'processes-complete' && metrics && stagePassed(phase, final, pause);
  const success = phase === 'rehearse' ? 'rehearsal-passed' : spec.next ? 'stage-paused' : 'decision-settled';
  const summary = { run, phase, sourceDigest: identity.digest, outcome: passed ? success : 'unknown-retain', selected: 1,
    process: result, capturedRawBytes: raw, retainedRawBytes: written, finalMetrics: metrics,
    measurementFailure: measurement.failure,
    nativeQueryCalls: ['plan', 'children'].includes(phase) ? recordQueryCount(final ?? {}) : final?.nativeQueryCalls ?? 'unknown', pause: pause ?? null };
  const summaryBytes = Buffer.byteLength(JSON.stringify(summary, null, 2) + '\n');
  if (!metrics || metrics.rawBytes + summaryBytes > BOUNDS.rawBytes) summary.outcome = 'unknown-retain';
  await writeRecord(join(paths.operator, 'result.json'), summary);
  const finalMeasurement = await measureFinalRun(run, identity.digest);
  if (!finalMeasurement.metrics) {
    summary.outcome = 'unknown-retain'; summary.measurementFailure ??= finalMeasurement.failure;
    await writeRecord(join(paths.operator, 'result.json'), summary);
  }
  await watchdog.complete(); // No timer disarm: a later parent I/O stall remains covered until actual process exit.
  process.stdout.write(JSON.stringify({ run, outcome: summary.outcome, operator: paths.operator }) + '\n');
  if (summary.outcome !== success) process.exitCode = 1;
  return summary;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { await operate(operationArguments(process.argv.slice(2))); }
  catch { process.stderr.write('O16 operator refused or retained an unknown run; inspect its durable reservation.\n'); process.exitCode = 1; }
}
