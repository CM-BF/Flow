// Source-review candidate. Importing this module creates no file, listener or child.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { createCodexTransport } from '../../../apps/runner/src/codex/index.ts';
import { runSyntheticCanary } from '../isolation/compose-canary.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const evidence = path.join(root, 'docs/evidence/wpf-mature-02/diagnostics');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const safeError = () => Error('Diagnostic preparation or persistence failed');
function durableCreate(file, value) {
  const fd = fs.openSync(file, 'wx', 0o600);
  try { fs.writeFileSync(fd, `${JSON.stringify(value, null, 2)}\n`); fs.fsyncSync(fd); }
  finally { fs.closeSync(fd); }
}
function safeClose(report) {
  return { reason: report.reason, child: report.child, exitCode: report.exitCode, signal: report.signal,
    remoteEffects: report.remoteEffects, ...(report.stderrCapture ? { stderrCapture: report.stderrCapture } : {}) };
}
function makePrivateSink(directory, number) {
  const file = path.join(directory, `attempt-${number}.stderr`);
  const fd = fs.openSync(file, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY | fs.constants.O_NOFOLLOW, 0o600);
  const original = fs.fstatSync(fd);
  if (!original.isFile() || (original.mode & 0o777) !== 0o600) { fs.closeSync(fd); throw safeError(); }
  let closed = false;
  return {
    file,
    option: { maxBytes: 65536, write(bytes) {
      let offset = 0;
      while (offset < bytes.byteLength) {
        const count = fs.writeSync(fd, bytes, offset, bytes.byteLength - offset);
        if (count <= 0) throw safeError();
        offset += count;
      }
    } },
    finish() {
      if (closed) throw safeError();
      closed = true;
      let flush = false; let close = false;
      try { fs.fsyncSync(fd); flush = true; } catch { /* No raw IO error escapes. */ }
      finally { try { fs.closeSync(fd); close = true; } catch { /* Record separately. */ } }
      let digest = null; let bytes = null;
      try {
        const stat = fs.lstatSync(file);
        if (!stat.isFile() || stat.isSymbolicLink() || stat.ino !== original.ino || stat.dev !== original.dev || stat.size > 65536) throw safeError();
        const buffer = fs.readFileSync(file); digest = hash(buffer); bytes = buffer.length;
      } catch { /* Unavailable evidence is never inferred complete. */ }
      return { file, identity: { ino: original.ino, dev: original.dev }, flush, close, bytes, sha256: digest, retained: true };
    },
  };
}
function captureComplete(close, artifact) {
  const c = close?.stderrCapture;
  return close?.child === 'confirmed-exited' && c && c.streamEnded && c.childCloseObserved && !c.incomplete
    && !c.truncated && !c.observerFailed && artifact.flush && artifact.close && artifact.bytes === c.writtenBytes;
}

/** No retry or general third-attempt hook. A later invocation cannot reuse the consumed wx batch. */
export async function runDiagnosticBatch() {
  const inputFile = path.join(evidence, 'driver-input.json');
  const input = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
  if (input.maxChildren !== 3 || input.totalMs !== 60000 || input.thirdAttempt !== 'NOT_RUN') throw safeError();
  for (const [relative, expected] of Object.entries(input.files)) {
    if (hash(fs.readFileSync(path.join(root, relative))) !== expected) throw safeError();
  }
  for (const [file, expected] of Object.entries(input.externalInputs)) {
    if (hash(fs.readFileSync(file)) !== expected) throw safeError();
  }
  if (hash(fs.readFileSync(process.execPath)) !== input.nodeSha256 || fs.realpathSync(process.execPath) !== input.node) throw safeError();
  const startedAt = new Date().toISOString(); const start = performance.now();
  const elapsed = () => performance.now() - start;
  durableCreate(path.join(evidence, 'batch-reservation.json'), { startedAt, maxChildren: 3, totalMs: 60000,
    inputSha256: hash(fs.readFileSync(inputFile)), meaning: 'Consumed batch; unknown/failure never permits a fresh clock or automatic retry' });
  const privateRoot = fs.realpathSync(fs.mkdtempSync('/private/tmp/flow-wpf02-private-'));
  fs.chmodSync(privateRoot, 0o700);
  const privateIdentity = fs.lstatSync(privateRoot);
  const result = { startedAt, attempts: [], thirdAttempt: 'NOT_RUN', factoryCalls: 0,
    privateRoot, privateIdentity: { ino: privateIdentity.ino, dev: privateIdentity.dev },
    privateEvidence: 'retained-private-for-bounded-review', realAppServerStarts: 0, authCalls: 0, providerCalls: 0 };
  let active;
  let abort;
  let timer;
  let sink;
  let controlCwd;
  function reserveAndSpawn(stage, options) {
    if (active || result.factoryCalls >= 2 || elapsed() > 45000 || 60000 - elapsed() < 15000) throw safeError();
    const number = result.factoryCalls + 1;
    sink = makePrivateSink(privateRoot, number);
    abort = new AbortController();
    const supplied = { ...options, signal: abort.signal, privateStderr: sink.option,
      limits: { ...options.limits, terminateMs: 500, killMs: 500 } };
    // Durable reservation precedes even a failed/unknown spawn. The callback itself is not serialized.
    durableCreate(path.join(evidence, `attempt-${number}-reservation.json`), {
      at: new Date().toISOString(), elapsedMs: elapsed(), number, stage, hypothesis: stage === 'control'
        ? 'Known synchronous stderr tail survives immediate exit and drain' : 'New bounded private stderr reveals original-profile bootstrap failure',
      options: { ...supplied, signal: 'owned-8s-abort', privateStderr: { maxBytes: 65536, sink: 'host-private-file' } },
      inputSha256: hash(fs.readFileSync(inputFile)), privateFile: sink.file,
    });
    result.factoryCalls++;
    timer = setTimeout(() => abort.abort(), Math.min(8000, 60000 - elapsed() - 2000));
    active = createCodexTransport(supplied); // The only child factory in this driver.
    return active;
  }
  async function finishAttempt(stage, observation) {
    let close = null;
    try { if (active) close = safeClose(await active.close()); }
    catch { /* Unknown close consumes the attempt and stops the batch. */ }
    clearTimeout(timer); active = undefined;
    const artifact = sink?.finish() ?? { flush: false, close: false, bytes: null, sha256: null };
    sink = undefined;
    const record = { stage, endedAt: new Date().toISOString(), elapsedMs: elapsed(), close, artifact, observation };
    result.attempts.push(record);
    durableCreate(path.join(evidence, `attempt-${result.attempts.length}-result.json`), record);
    return record;
  }
  try {
    controlCwd = path.join(privateRoot, 'control-cwd'); fs.mkdirSync(controlCwd, { mode: 0o700 });
    const control = reserveAndSpawn('control', {
      spawn: { executable: input.node, args: [path.join(root, 'experiments/codex-app-server-conformance/diagnostics/immediate-exit.mjs')],
        cwd: controlCwd, environment: { PATH: '/usr/bin:/bin', HOME: controlCwd, TMPDIR: controlCwd, LANG: 'C', LC_ALL: 'C', TZ: 'UTC' } },
      initialize: { clientInfo: { name: 'flow_diagnostic_control', title: null, version: '1' }, capabilities: null },
      limits: { initializeTimeoutMs: 3000, requestTimeoutMs: 1000, frameBytes: 4096 },
    });
    await control.ready.catch(() => {}); await control.closed;
    const first = await finishAttempt('control', { expectedExitCode: 7, expectedStderrSha256: input.controlStderrSha256 });
    fs.rmdirSync(controlCwd); controlCwd = undefined;
    if (!captureComplete(first.close, first.artifact) || first.close.exitCode !== 7 || first.artifact.sha256 !== input.controlStderrSha256) {
      result.stopReason = 'capture-control-failed';
    } else if (elapsed() > 45000) result.stopReason = 'budget-insufficient';
    else {
      let called = false;
      const canary = await runSyntheticCanary(options => {
        if (called || options.spawn.executable !== '/usr/bin/sandbox-exec') throw safeError();
        called = true;
        // Preserve the reviewed profile/config/peer bytes before old composition cleanup.
        const controlDirectory = path.join(path.dirname(options.spawn.cwd), 'control');
        const copied = {};
        for (const name of ['default-deny.sb', 'canary-preload.mjs', 'peer.mjs', 'config.json']) copied[name] = hash(fs.readFileSync(path.join(controlDirectory, name)));
        durableCreate(path.join(evidence, 'canary-input.json'), { at: new Date().toISOString(), copied,
          config: JSON.parse(fs.readFileSync(path.join(controlDirectory, 'config.json'), 'utf8')) });
        return reserveAndSpawn('canary', options);
      }, { r06Target: input.r06OriginalTarget, peerBytes: fs.readFileSync(path.join(root, 'apps/runner/src/codex/fixtures/peer.mjs')) });
      const second = await finishAttempt('canary', canary);
      result.stopReason = captureComplete(second.close, second.artifact) && canary.listenerClosed && canary.retainedRoots.length === 0
        ? 'diagnostic-evidence-ready-third-not-run' : 'observation-or-cleanup-incomplete';
    }
  } catch {
    result.stopReason = 'safe-preparation-or-observation-failure';
  } finally {
    if (active || sink) {
      abort?.abort();
      try { await finishAttempt('failed-attempt', { outcome: 'unknown' }); } catch { result.stopReason = 'private-finalization-unconfirmed'; }
    }
    clearTimeout(timer);
    result.controlDirectoryCleanup = true;
    if (controlCwd) {
      try { fs.rmdirSync(controlCwd); } catch { result.controlDirectoryCleanup = false; }
    }
    result.endedAt = new Date().toISOString(); result.elapsedMs = elapsed(); result.withinBudget = result.elapsedMs <= 60000;
    // Raw private stderr is deliberately retained, mode0600 under this one recorded mode0700 root.
    // After bounded owner inspection, cleanup must verify the recorded root inode/dev and only its files.
    durableCreate(path.join(evidence, 'batch-result.json'), result);
  }
  return result;
}


/** Owner invokes only after bounded private inspection. No top-level cleanup or path discovery. */
export function cleanupPrivateEvidence(result) {
  const directory = result.privateRoot;
  if (typeof directory !== 'string' || !/^\/private\/tmp\/flow-wpf02-private-[A-Za-z0-9]+$/.test(directory)) throw safeError();
  const stat = fs.lstatSync(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink() || stat.ino !== result.privateIdentity.ino || stat.dev !== result.privateIdentity.dev) throw safeError();
  const files = result.attempts.map(attempt => attempt.artifact);
  const expected = files.map(file => path.basename(file.file));
  const names = fs.readdirSync(directory);
  if (names.length !== expected.length || names.some(name => !expected.includes(name) || !/^attempt-[12]\.stderr$/.test(name))) throw safeError();
  for (const file of files) {
    if (path.dirname(file.file) !== directory) throw safeError();
    const item = fs.lstatSync(file.file);
    if (!item.isFile() || item.isSymbolicLink() || item.ino !== file.identity.ino || item.dev !== file.identity.dev || item.size > 65536) throw safeError();
  }
  for (const file of files) fs.unlinkSync(file.file);
  fs.rmdirSync(directory);
  return { privateEvidenceRemoved: true };
}
