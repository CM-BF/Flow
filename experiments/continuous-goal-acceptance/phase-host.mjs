import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { stopWorker } from '../native-graph-acceptance/driver.mjs';
import { readRecord, writeRecord } from './records.mjs';
import { bindChildAssignment } from './assignment.mjs';
import { PHASE_LIMITS } from './permit.mjs';
import { assertNativeReady, failureFact } from './stage-policy.mjs';
export const experimentStop = new AbortController();
import { GRAPH_TOOLS } from './config.mjs';
import { nativeEnvironmentPolicy } from './native-environment.mjs';

/** One owned runtime per phase, no command dispatch loop; polling only observes public center facts. */
export async function runPhase(center, state, phase, { source, permit, report, done }) {
  assertNativeReady(state.mode, permit, nativeEnvironmentPolicy.digest);
  const directory = join(center.root, phase), configFile = join(directory, 'worker.json'), reportFile = join(directory, 'report.json');
  await mkdir(directory, { mode: 0o700 });
  const runner = state.runners[phase];
  const nativeEnvironment = state.mode === 'native' ? await nativeEnvironmentPolicy.prepare(directory, source) : undefined;
  await writeRecord(configFile, { mode: state.mode, phase, sourceDigest: source.digest, baseUrl: center.origin,
    runnerToken: runner.token, profile: runner.profile, workingDirectory: join(directory, 'runtime'), reportFile,
    materialFile: state.materialFile, citation: state.citation, admitted: state.admitted, expected: state.expected,
    confirmation: state.confirmationBinding, ...(state.executionAuthorizationBinding ? { executionAuthorization: state.executionAuthorizationBinding } : {}),
    ...(permit ? { permit, nativeEnvironment } : {}) }, { exclusive: true });
  const home = join(directory, 'home'); await mkdir(home, { mode: 0o700 });
  const env = nativeEnvironment ? nativeEnvironmentPolicy.environment(nativeEnvironment) : { PATH: process.env.PATH, HOME: home, TMPDIR: directory, LANG: 'C.UTF-8' };
  if (nativeEnvironment) { await nativeEnvironmentPolicy.verify(nativeEnvironment, source); report.nativeEnvironment = nativeEnvironment; report.writePolicy = nativeEnvironmentPolicy.recipe.writePolicy; }
  await center.beforeWorker();
  const child = spawn(process.execPath, ['--import', 'tsx', fileURLToPath(new URL('./worker.mjs', import.meta.url)), configFile],
    { detached: true, stdio: ['ignore', 'ignore', 'ignore', 'ipc'], env: { ...env, TSX_DISABLE_CACHE: '1', NODE_DISABLE_COMPILE_CACHE: '1' } });
  report.workerPid = child.pid; report.workerStopped = false;
  let failure, requests = 0; const pending = new Set();
  child.once('error', () => { failure = new Error('Worker startup unconfirmed.'); });
  child.on('message', message => {
    const work = (async () => {
      assert(phase === 'children' && ++requests <= 2 && Buffer.byteLength(JSON.stringify(message)) <= 4096
        && message?.kind === 'observe-assignment' && /^[a-f0-9-]{36}$/.test(message.id));
      const [progression, delivery] = await Promise.all([center.client.goalProgression(state.goalId, state.expected.progressionId, AbortSignal.timeout(4000)),
        center.client.goalDelivery(state.goalId, { view: 'state', nodeIds: state.expected.nodes.map(n => n.nodeId) }, AbortSignal.timeout(4000))]);
      const current = { progression, delivery };
      bindChildAssignment(state.expected, current, message.assignment, runner.profile.reference);
      assert(Buffer.byteLength(JSON.stringify(current)) <= 64_000);
      if (child.connected) child.send({ kind: 'bound-observation', id: message.id, current });
    })().catch(() => { failure = new Error('Current assignment observation unconfirmed.'); });
    pending.add(work); void work.finally(() => pending.delete(work));
  });
  const deadline = performance.now() + (state.mode === 'native' ? PHASE_LIMITS[phase].timeoutMs * PHASE_LIMITS[phase].queries + 10000 : 24000);
  let primaryError;
  try {
    await center.trackWorker(child.pid); let sampledAt = -Infinity;
    for (;;) {
      experimentStop.signal.throwIfAborted();
      if (performance.now() - sampledAt >= 500) {
        const current = await center.measureResources(); sampledAt = performance.now();
        report.resourceSamples = (report.resourceSamples ?? 0) + 1;
        report.minimumFreeBytes = Math.min(report.minimumFreeBytes ?? Infinity, current.freeBytes);
        report.peakOwnedBytes = Math.max(report.peakOwnedBytes ?? 0, current.runtimeBytes);
      }
      if (failure) throw failure;
      assert(child.exitCode === null && !child.signalCode, 'Worker exited before public completion.');
      assert(performance.now() < deadline, 'Phase observation deadline reached.');
      const value = await done(); if (value) { report.publicCompletion = value; break; }
      await delay(40);
    }
  } catch (error) { primaryError = error; report.primaryFailure = failureFact(error); }
  finally {
    try { await stopWorker(child, report); report.workerStopped = true; }
    catch (error) { report.cleanupFailure = failureFact(error); primaryError ??= error; }
    finally {
      await Promise.allSettled(pending);
      try { report.worker = await readRecord(reportFile, 262_144); } catch { report.workerReport = 'missing-or-invalid'; }
    }
  }
  if (primaryError) throw primaryError;
  assert(report.worker?.outcome === 'runtime-returned' && !report.worker.failure);
  assert.equal(report.worker.nativeQueryCalls, state.mode === 'native' ? PHASE_LIMITS[phase].queries : 0);
  assert.equal(report.worker.queries.length, PHASE_LIMITS[phase].queries);
  assert(report.worker.queries.every(row => row.closed && !row.failure && row.observation && !row.observation.failure));
  assert(report.worker.queries.every(row => row.hostToolDecisions?.length >= (phase === 'plan' ? 2 : 1)
    && row.hostToolDecisions.every(item => item.decision === 'allowed' && (phase === 'plan'
      ? GRAPH_TOOLS.includes(item.toolName) && item.source === 'sdk' && item.server === 'flow-graph' : item.toolName === 'Read'))));
  return report;
}
