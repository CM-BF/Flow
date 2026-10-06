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
function identity(file) {
  const stat = fs.lstatSync(file);
  return { ino: stat.ino, dev: stat.dev, directory: stat.isDirectory(), regular: stat.isFile(), symlink: stat.isSymbolicLink() };
}
function sameIdentity(file, expected) {
  const actual = identity(file);
  return !actual.symlink && actual.ino === expected.ino && actual.dev === expected.dev
    && actual.directory === expected.directory && actual.regular === expected.regular;
}
function safeClose(report) {
  return { reason: report.reason, child: report.child, exitCode: report.exitCode, signal: report.signal,
    remoteEffects: report.remoteEffects, ...(report.stderrCapture ? { stderrCapture: report.stderrCapture } : {}) };
}
// Fixed allowlist labels only; never return matched substrings, paths, stack, raw errors or inferred rule IDs.
function classify(bytes, expectedControlHash) {
  if (!bytes.length) return 'empty';
  if (hash(bytes) === expectedControlHash) return 'expected-control';
  if (bytes.includes(Buffer.from('Assertion')) || bytes.includes(Buffer.from('Check failed'))) {
    for (const name of ['uv_thread_create', 'uv_loop_init', 'uv_async_init']) {
      if (bytes.includes(Buffer.from(name))) return `startup-check-${name}`;
    }
  }
  if (bytes.includes(Buffer.from('Operation not permitted'))) return 'permission-denial-text';
  if (bytes.includes(Buffer.from('Library not loaded:'))) return 'loader-error-text';
  if (bytes.includes(Buffer.from('FATAL ERROR:'))) return 'node-fatal-error-text';
  return 'unknown';
}
function makePrivateSink(directory, number, owned, expectedControlHash) {
  const file = path.join(directory, `attempt-${number}.stderr`);
  const fd = fs.openSync(file, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY | fs.constants.O_NOFOLLOW, 0o600);
  const record = { file, fd, identity: null, flush: false, close: false, bytes: null, sha256: null,
    classification: 'unavailable', removed: false, retained: true };
  owned.push(record); // Register immediately, even if preparation fails before an attempt is recorded.
  record.identity = identity(file);
  if (!record.identity.regular || record.identity.symlink || (fs.fstatSync(fd).mode & 0o777) !== 0o600) throw safeError();
  return {
    record,
    option: { maxBytes: 65536, write(bytes) {
      let offset = 0;
      while (offset < bytes.byteLength) {
        const count = fs.writeSync(fd, bytes, offset, bytes.byteLength - offset);
        if (count <= 0) throw safeError();
        offset += count;
      }
    } },
    finish() { finalizeFile(record, expectedControlHash); return publicArtifact(record); },
  };
}
function finalizeFile(record, expectedControlHash) {
  if (record.fd !== null) {
    try { fs.fsyncSync(record.fd); record.flush = true; } catch { /* Safe flags only. */ }
    finally {
      try { fs.closeSync(record.fd); record.close = true; } catch { /* Close result remains unknown. */ }
      record.fd = null; // Never close a possibly reused fd twice after an unknown close outcome.
    }
  }
  if (!record.close || !record.identity) return;
  try {
    if (!sameIdentity(record.file, record.identity) || fs.lstatSync(record.file).size > 65536) return;
    const bytes = fs.readFileSync(record.file);
    record.bytes = bytes.length; record.sha256 = hash(bytes); record.classification = classify(bytes, expectedControlHash);
  } catch { /* No raw error or stderr enters any report. */ }
}
function publicArtifact(record) {
  const { fd, ...safe } = record;
  return safe;
}
function captureComplete(close, artifact) {
  const c = close?.stderrCapture;
  return close?.child === 'confirmed-exited' && c && c.streamEnded && c.childCloseObserved && !c.incomplete
    && !c.truncated && !c.observerFailed && artifact.flush && artifact.close && artifact.bytes === c.writtenBytes;
}
function cleanupPrivate(directory, rootIdentity, cwdRecord, owned) {
  const cleanup = { privateRootRemoved: false, retained: [] };
  if (!directory) return { privateRootRemoved: true, retained: [] };
  try {
    if (!rootIdentity || !sameIdentity(directory, rootIdentity)) throw safeError();
    const allowed = owned.map(item => path.basename(item.file));
    if (cwdRecord) allowed.push('control-cwd');
    if (fs.readdirSync(directory).some(name => !allowed.includes(name))) throw safeError();
    for (const item of owned) {
      if (!item.close || !item.identity || path.dirname(item.file) !== directory || !sameIdentity(item.file, item.identity)) throw safeError();
      fs.unlinkSync(item.file); item.removed = true; item.retained = false;
    }
    if (cwdRecord) {
      if (!sameIdentity(cwdRecord.directory, cwdRecord.identity)) throw safeError();
      fs.rmdirSync(cwdRecord.directory); // Empty own cwd only, never recursive unknown contents.
    }
    fs.rmdirSync(directory); cleanup.privateRootRemoved = true;
  } catch {
    cleanup.retained = owned.filter(item => !item.removed).map(item => item.file);
    cleanup.retained.push(directory);
  }
  return cleanup;
}

/** No retry or third-attempt hook. Later invocation cannot reuse the consumed wx batch or clock. */
export async function runDiagnosticBatch() {
  const inputFile = path.join(evidence, 'driver-input-v4.json');
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
  const result = { startedAt, attempts: [], thirdAttempt: 'NOT_RUN', factoryCalls: 0,
    realAppServerStarts: 0, authCalls: 0, providerCalls: 0 };
  const owned = [];
  let privateRoot; let rootIdentity; let cwdRecord;
  let active; let abort; let timer; let sink;
  function reserveAndSpawn(stage, options) {
    if (active || result.factoryCalls >= 2 || elapsed() > 45000 || 60000 - elapsed() < 15000) throw safeError();
    const number = result.factoryCalls + 1;
    sink = makePrivateSink(privateRoot, number, owned, input.controlStderrSha256);
    abort = new AbortController();
    const supplied = { ...options, signal: abort.signal, privateStderr: sink.option,
      limits: { ...options.limits, terminateMs: 500, killMs: 500 } };
    durableCreate(path.join(evidence, `attempt-${number}-reservation.json`), {
      at: new Date().toISOString(), elapsedMs: elapsed(), number, stage, hypothesis: stage === 'control'
        ? 'Known synchronous stderr tail survives immediate exit and drain' : 'New bounded private stderr classifies original-profile bootstrap failure',
      options: { ...supplied, signal: 'owned-8s-abort', privateStderr: { maxBytes: 65536, sink: 'host-private-file' } },
      inputSha256: hash(fs.readFileSync(inputFile)), privateFile: sink.record.file,
    });
    result.factoryCalls++; // Consumed before even a failed or unknown native spawn.
    timer = setTimeout(() => abort.abort(), Math.min(8000, 60000 - elapsed() - 2000));
    active = createCodexTransport(supplied); // The only child factory in this driver.
    return active;
  }
  async function finishAttempt(stage, observation) {
    let close = null;
    try { if (active) close = safeClose(await active.close()); }
    catch { /* Unknown close consumes the attempt and stops the batch. */ }
    clearTimeout(timer); active = undefined;
    const artifact = sink?.finish() ?? null;
    sink = undefined;
    const record = { stage, endedAt: new Date().toISOString(), elapsedMs: elapsed(), close, artifact, observation };
    result.attempts.push(record);
    durableCreate(path.join(evidence, `attempt-${result.attempts.length}-result.json`), record);
    return record;
  }
  try {
    privateRoot = fs.mkdtempSync('/private/tmp/flow-wpf02-private-');
    rootIdentity = identity(privateRoot); fs.chmodSync(privateRoot, 0o700);
    const controlCwd = path.join(privateRoot, 'control-cwd'); fs.mkdirSync(controlCwd, { mode: 0o700 });
    cwdRecord = { directory: controlCwd, identity: identity(controlCwd) };
    const control = reserveAndSpawn('control', {
      spawn: { executable: input.node, args: [path.join(root, 'experiments/codex-app-server-conformance/diagnostics/immediate-exit.mjs')],
        cwd: controlCwd, environment: { PATH: '/usr/bin:/bin', HOME: controlCwd, TMPDIR: controlCwd, LANG: 'C', LC_ALL: 'C', TZ: 'UTC' } },
      initialize: { clientInfo: { name: 'flow_diagnostic_control', title: null, version: '1' }, capabilities: null },
      limits: { initializeTimeoutMs: 3000, requestTimeoutMs: 1000, frameBytes: 4096 },
    });
    await control.ready.catch(() => {}); await control.closed;
    const first = await finishAttempt('control', { expectedExitCode: 7, expectedStderrSha256: input.controlStderrSha256 });
    if (!captureComplete(first.close, first.artifact) || first.close.exitCode !== 7 || first.artifact.sha256 !== input.controlStderrSha256) result.stopReason = 'capture-control-failed';
    else if (elapsed() > 45000) result.stopReason = 'budget-insufficient';
    else {
      let called = false;
      const canary = await runSyntheticCanary(options => {
        if (called || options.spawn.executable !== '/usr/bin/sandbox-exec') throw safeError();
        called = true;
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
  } catch { result.stopReason = 'safe-preparation-or-observation-failure'; }
  finally {
    if (active || sink) {
      abort?.abort();
      try { await finishAttempt('failed-attempt', { outcome: 'unknown' }); } catch { result.stopReason = 'private-finalization-unconfirmed'; }
    }
    clearTimeout(timer);
    for (const item of owned) finalizeFile(item, input.controlStderrSha256);
    const cleanup = cleanupPrivate(privateRoot, rootIdentity, cwdRecord, owned);
    result.privateCleanup = cleanup;
    result.privateArtifacts = owned.map(publicArtifact);
    const childCleanup = result.attempts.every(a => a.close?.child === 'confirmed-exited');
    const canaryCleanup = result.attempts.filter(a => a.stage === 'canary').every(a => a.observation.listenerClosed && a.observation.retainedRoots?.length === 0);
    result.cleanupComplete = cleanup.privateRootRemoved && owned.every(item => item.close && item.removed) && childCleanup && canaryCleanup;
    result.endedAt = new Date().toISOString(); result.elapsedMs = elapsed();
    result.elapsedBasis = 'before-result-persistence'; result.withinBudgetBeforePersistence = result.elapsedMs <= 60000;
    // Only hashes, allowlist classifications and cleanup facts survive the same batch finally.
    durableCreate(path.join(evidence, 'batch-result.json'), result);
    // The safe CLI return is the final outside-the-file completion evidence, avoiding recursive receipts.
    result.finalElapsedMs = elapsed(); result.withinBudget = result.finalElapsedMs <= 60000;
  }
  return result;
}
