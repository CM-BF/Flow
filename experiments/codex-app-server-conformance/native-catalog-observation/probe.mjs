import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { normalizeModelPage } from '../catalog.mjs';
import { retainPrivateText } from '../node-failure-text/private-text.mjs';
import { recordNotification } from './notifications.mjs';

export const bounds = Object.freeze({ totalMs: 45000, stopMs: 35000, latestSpawnMs: 10000,
  archiveBytes: 131072, preparedBytes: 262144, totalBytes: 1048576, ownBytes: 8388608,
  stderrBytes: 8192, pageBytes: 131072, notifications: 8, entries: 512, depth: 8 });
const json = value => `${JSON.stringify(value)}\n`;
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const identity = stat => ({ dev: stat.dev, ino: stat.ino });
const same = (stat, expected) => expected && stat.dev === expected.dev && stat.ino === expected.ino;
const transportCodes = new Set(['INVALID_OPTIONS', 'NOT_READY', 'CLOSED', 'ABORTED', 'TIMEOUT', 'LIMIT',
  'PROTOCOL', 'DISCONNECTED', 'SPAWN_FAILED', 'WRITE_FAILED', 'REMOTE_ERROR', 'CONCURRENT_RECEIVE']);

// Counts only current files in these two owned roots, never follows a symlink or enumerates elsewhere.
export function inspectOwnedRoots(roots, io = fs) {
  const report = { complete: true, entries: 0, symlinks: 0, logicalBytes: 0, allocatedBytes: 0, withinLimit: false };
  const visit = (file, depth) => {
    if (depth > bounds.depth || ++report.entries > bounds.entries) throw Error('Inventory bound');
    const stat = io.lstatSync(file);
    if (!stat.isSymbolicLink() && !stat.isDirectory() && !stat.isFile()) throw Error('Unknown owned entry');
    if (stat.isSymbolicLink()) report.symlinks++;
    if (!Number.isSafeInteger(stat.size) || !Number.isSafeInteger(stat.blocks) || stat.size < 0 || stat.blocks < 0) throw Error('Unknown size');
    report.logicalBytes += stat.size; report.allocatedBytes += stat.blocks * 512;
    if (report.logicalBytes > bounds.ownBytes || report.allocatedBytes > bounds.ownBytes) throw Error('Owned byte limit');
    if (stat.isDirectory()) {
      const before = io.lstatSync(file);
      if (!before.isDirectory() || before.isSymbolicLink() || !same(before, identity(stat))) throw Error('Directory changed');
      let directory;
      try {
        directory = io.opendirSync(file, { bufferSize: 1, recursive: false });
        const after = io.lstatSync(file);
        if (!after.isDirectory() || after.isSymbolicLink() || !same(after, identity(stat))) throw Error('Directory changed');
        for (;;) {
          if (report.entries >= bounds.entries) throw Error('Inventory entry bound');
          const entry = directory.readSync(); if (entry === null) break;
          visit(path.join(file, entry.name), depth + 1);
        }
      } finally { directory?.closeSync(); }
      const finished = io.lstatSync(file);
      if (!finished.isDirectory() || finished.isSymbolicLink() || !same(finished, identity(stat))) throw Error('Directory changed');
    }
  };
  try {
    for (const root of roots) {
      const stat = io.lstatSync(root.path);
      if (!stat.isDirectory() || !same(stat, root.identity)) throw Error('Unconfirmed root');
      visit(root.path, 0);
    }
    report.withinLimit = true;
  } catch { report.complete = false; }
  return report;
}

export function nativeOptions({ allowRoot, denyRoot, native, sink }) {
  const state = name => path.join(allowRoot, 'state', name);
  return {
    spawn: { executable: '/usr/bin/sandbox-exec', args: ['-D', `ALLOW_ROOT=${allowRoot}`, '-D', `DENY_ROOT=${denyRoot}`,
      '-f', path.join(allowRoot, 'control', 'candidate.sb'), native, 'app-server', '--listen', 'stdio://'],
    cwd: state('cwd'), environment: { PATH: '/usr/bin:/bin', HOME: state('home'), CODEX_HOME: state('codex'),
      TMPDIR: state('tmp'), LANG: 'C', LC_ALL: 'C', TZ: 'UTC' } },
    initialize: { clientInfo: { name: 'flow_native_catalog_probe', title: null, version: '1' }, capabilities: null },
    limits: { frameBytes: 131072, inboundBytes: 262144, outboundBytes: 262144, inboundFrames: 8, outboundFrames: 8,
      pendingRequests: 1, serverRequests: 1, initializeTimeoutMs: 10000, requestTimeoutMs: 10000, terminateMs: 1000, killMs: 1000 },
    privateStderr: { maxBytes: bounds.stderrBytes, write: sink },
  };
}

/** R06 is injected and remains the sole process/stdio owner. No factory call occurs on import. */
export async function runNativeCatalogProbe({ factory, native, policyBytes, evidenceDirectory, preparedBytes, initialReceiptBytes = 0 },
  { io = fs, now = () => performance.now(), rootBase = '/private/tmp', observeNotification = recordNotification } = {}) {
  const roots = [], descriptors = [], chunks = [];
  const output = { preparedBytes, policyDiskBytes: 0, stderrCapturedBytes: 0, stderrDiskBytes: 0,
    catalogDiskBytes: 0, receiptBytes: initialReceiptBytes, stdoutWireBytes: null };
  const result = { targetCalls: 0, modelListCalls: 0, status: 'FAILED_OR_UNKNOWN', failure: null,
    targetPid: null, targetStarted: 'unknown', ready: false, catalogComplete: false, catalog: null, partial: null, notificationCount: 0, notificationValueBytes: 0,
    notificationSummaries: [], notificationSummaryLimit: false, notificationOverflow: false,
    serverRequestObserved: false, close: null, closeKind: 'controlled-close', wholeWriterSettlement: 'unknown',
    processCleanupComplete: false, rootCleanupComplete: false, retainedRootsComplete: true, retainedRoots: [],
    roots, descriptors, inventories: [], callerRequests: { turn: 0, auth: 0, login: 0, modelInference: 0 },
    nativeNetworkAttempts: 'unknown', billingEffects: 'unknown', monitoring: { intervalMs: 250, activeChecks: 'top-root-identities-only',
      fullInventory: 'before-factory-and-after-confirmed-close', hardQuota: false, unobservedPeak: 'unknown' },
    retainedDiagnosticArtifact: null, diagnosticComplete: false, outputAccountingComplete: false,
    withinBudget: false, resultPersisted: false, output };
  let transport, receiveLoop, monitor, deadline, stopping, controlIdentity, inventoryFailed = false, originalStderrSaved = false;
  const fail = code => { result.failure ??= code; };
  const knownBytes = () => Object.entries(output).reduce((n, [k, v]) => k === 'stdoutWireBytes' ? n : n + v, 0);
  const budgetFits = () => knownBytes() + bounds.archiveBytes + 32768 + 8192 <= bounds.totalBytes;
  function writeFile(file, bytes, category) {
    if (!Buffer.isBuffer(bytes)) bytes = Buffer.from(bytes);
    if (knownBytes() + bytes.length + bounds.archiveBytes + 32768 + 8192 > bounds.totalBytes) throw Error('Evidence bound');
    const record = { file, owned: false, identity: null, bytes: 0, closed: true, flushed: false };
    descriptors.push(record); let fd;
    try {
      fd = io.openSync(file, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY | fs.constants.O_NOFOLLOW, 0o600);
      record.owned = true; record.closed = false;
      const stat = io.fstatSync(fd); record.identity = identity(stat);
      if (fd < 3 || !stat.isFile() || (stat.mode & 0o777) !== 0o600) throw Error('Evidence identity');
      while (record.bytes < bytes.length) {
        const n = io.writeSync(fd, bytes, record.bytes, bytes.length - record.bytes);
        if (!Number.isSafeInteger(n) || n < 1 || n > bytes.length - record.bytes) throw Error('Evidence write');
        record.bytes += n; output[category] += n;
      }
      io.fsyncSync(fd); record.flushed = true;
    } finally { if (fd !== undefined) try { io.closeSync(fd); record.closed = true; } catch { /* Do not close a possibly reused fd twice. */ } }
    if (!record.closed || !record.flushed) throw Error('Evidence close');
    return record;
  }
  function makeRoot(kind) {
    const created = io.mkdtempSync(path.join(rootBase, `flow-native-catalog-${kind}-`));
    const root = { path: created, identity: null, prepared: false, removed: false }; roots.push(root);
    const stat = io.lstatSync(created);
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw Error('Root identity');
    root.identity = identity(stat);
    if (io.realpathSync(created) !== created) throw Error('Root alias');
    io.chmodSync(created, 0o700); root.prepared = true; return root;
  }
  function inspect() {
    const value = inspectOwnedRoots(roots, io);
    // Fixed sampled maxima plus last observation keep the receipt independent of tick count.
    const previous = result.inventories[0];
    result.inventories[0] = { ...value, maxSampledLogicalBytes: Math.max(previous?.maxSampledLogicalBytes ?? 0, value.logicalBytes),
      maxSampledAllocatedBytes: Math.max(previous?.maxSampledAllocatedBytes ?? 0, value.allocatedBytes) };
    if (!value.complete || !value.withinLimit) inventoryFailed = true;
    return value.complete && value.withinLimit;
  }
  function activeRootsUnchanged() {
    try {
      return roots.every(root => {
        const stat = io.lstatSync(root.path);
        return stat.isDirectory() && !stat.isSymbolicLink() && same(stat, root.identity);
      });
    } catch { return false; }
  }
  function stop(code) {
    if (code) fail(code);
    if (transport && !stopping) {
      try { stopping = Promise.resolve(transport.close()); }
      catch { stopping = Promise.resolve(null); fail('CLOSE_UNKNOWN'); }
    }
    return stopping;
  }
  try {
    if (!Number.isSafeInteger(preparedBytes) || preparedBytes < 0 || preparedBytes > bounds.preparedBytes
      || !Buffer.isBuffer(policyBytes) || policyBytes.length > 32768 || now() >= bounds.latestSpawnMs) throw Error('Preparation bound');
    const allow = makeRoot('allow'), deny = makeRoot('deny');
    for (const rel of ['control', 'state', 'state/home', 'state/codex', 'state/tmp', 'state/cwd']) io.mkdirSync(path.join(allow.path, rel), { mode: 0o700 });
    const controlStat = io.lstatSync(path.join(allow.path, 'control'));
    if (!controlStat.isDirectory() || controlStat.isSymbolicLink()) throw Error('Control identity');
    controlIdentity = identity(controlStat);
    writeFile(path.join(allow.path, 'control', 'candidate.sb'), policyBytes, 'policyDiskBytes');
    if (!inspect() || now() >= bounds.latestSpawnMs) throw Error('Preparation inventory');
    writeFile(path.join(evidenceDirectory, 'target-reservation.json'), json({ target: 1, maxTargets: 1, kind: 'native-app-server', consumed: true }), 'receiptBytes');
    const sink = chunk => {
      if (output.stderrCapturedBytes + chunk.length > bounds.stderrBytes) { stop('STDERR_LIMIT'); throw Error('Stderr bound'); }
      chunks.push(Buffer.from(chunk)); output.stderrCapturedBytes += chunk.length;
    };
    result.targetCalls = 1;
    transport = factory(nativeOptions({ allowRoot: allow.path, denyRoot: deny.path, native, sink }));
    result.targetPid = transport.snapshot().pid;
    if (Number.isInteger(result.targetPid) && result.targetPid > 0) result.targetStarted = 'observed-pid';
    deadline = setTimeout(() => stop('WINDOW_DEADLINE'), Math.max(1, bounds.stopMs - now()));
    monitor = setInterval(() => {
      if (!activeRootsUnchanged()) { inventoryFailed = true; stop('ROOT_IDENTITY_UNKNOWN'); }
      if (transport.snapshot().stderrBytes > bounds.stderrBytes) stop('STDERR_LIMIT');
    }, 250);
    receiveLoop = (async () => {
      for (;;) {
        const message = await transport.receive(); if (message === null) return;
        if (message.kind === 'server-request') { result.serverRequestObserved = true; stop('SERVER_REQUEST'); return; }
        if (!observeNotification(result, message)) {
          stop('NOTIFICATION_UNKNOWN_OR_LIMIT'); return;
        }
      }
    })().catch(() => { stop('RECEIVE_UNKNOWN'); });
    await transport.ready; result.ready = true;
    if (result.failure || !activeRootsUnchanged() || now() >= bounds.stopMs - 10000) throw Error('Ready gate');
    result.modelListCalls = 1;
    const page = await transport.request('model/list', { cursor: null, limit: 20, includeHidden: false }, { timeoutMs: 10000 });
    const bytes = Buffer.from(json(page));
    if (bytes.length > bounds.pageBytes || !Array.isArray(page?.data) || page.data.length > 20) throw Error('Page bound');
    const normalized = normalizeModelPage(page);
    if (result.failure || !activeRootsUnchanged()) throw Error('Catalog gate');
    // Only validated catalog fields survive. Notification/remote-error bodies and ready strings do not.
    const normalizedBytes = Buffer.from(json(normalized));
    if (normalizedBytes.length > bounds.pageBytes) throw Error('Normalized page bound');
    writeFile(path.join(evidenceDirectory, 'catalog.json'), normalizedBytes, 'catalogDiskBytes');
    result.catalog = { models: normalized.models.length, bytes: normalizedBytes.length, sha256: sha(normalizedBytes),
      accountAvailability: 'unknown', actualModel: 'unknown', actualReasoning: 'unknown', actualServiceTier: 'unknown' };
    result.partial = normalized.nextCursor !== null; result.catalogComplete = true;
  } catch (error) { fail(transportCodes.has(error?.code) ? `R06_${error.code}` : 'PREPARATION_OR_CATALOG_UNKNOWN'); }
  finally {
    clearInterval(monitor); clearTimeout(deadline);
    try { await stop(); result.close = stopping ? await stopping : null; } catch { fail('CLOSE_UNKNOWN'); }
    if (receiveLoop) await receiveLoop;
    const report = result.close?.stderrCapture;
    result.processCleanupComplete = result.targetCalls === 0 || result.close?.child === 'confirmed-exited'
      && report?.childCloseObserved === true && report?.streamEnded === true;
    const stderr = Buffer.concat(chunks);
    const inputComplete = result.targetCalls === 0 || Boolean(report && !report.incomplete && !report.truncated
      && !report.observerFailed && report.streamEnded && report.childCloseObserved
      && report.writtenBytes === stderr.length && report.observedBytes === stderr.length);
    // Count links without following them; separately confirm the fixed write-parent identity.
    const closedTreeConfirmed = result.processCleanupComplete && inspect();
    let controlConfirmed = false;
    if (closedTreeConfirmed && roots[0]?.prepared) {
      try {
        const stat = io.lstatSync(path.join(roots[0].path, 'control'));
        controlConfirmed = stat.isDirectory() && !stat.isSymbolicLink() && same(stat, controlIdentity);
      } catch { /* Keep the original roots and independent diagnostic copy. */ }
      if (!controlConfirmed) { inventoryFailed = true; fail('CONTROL_IDENTITY_UNKNOWN'); }
    }
    // Keep a root-local original before a private archival copy, so copy failure cannot discard the only complete bytes.
    if (closedTreeConfirmed && controlConfirmed && activeRootsUnchanged()) {
      try { writeFile(path.join(roots[0].path, 'control', 'stderr.raw'), stderr, 'stderrDiskBytes'); originalStderrSaved = true; }
      catch { fail('STDERR_ORIGINAL_PERSIST_UNKNOWN'); }
    }
    result.retainedDiagnosticArtifact = retainPrivateText(path.join(evidenceDirectory, 'private-stderr.raw'), stderr, inputComplete, {
      reserveDisk: n => { if (!budgetFits() || knownBytes() + n + bounds.archiveBytes + 32768 + 8192 > bounds.totalBytes) throw Error('Private byte bound'); },
      disk: n => { output.stderrDiskBytes += n; },
    }, io);
    result.diagnosticComplete = result.retainedDiagnosticArtifact.complete;
    const archivalCopySaved = result.retainedDiagnosticArtifact.closed && result.retainedDiagnosticArtifact.flushed
      && result.retainedDiagnosticArtifact.identityConfirmed && result.retainedDiagnosticArtifact.bytes === stderr.length;
    const inventoryComplete = result.processCleanupComplete ? inspect() : false;
    result.finalInventory = result.processCleanupComplete ? 'observed-after-close' : 'not-observed-active-or-unknown';
    const descriptorsClosed = descriptors.every(record => record.closed) && result.retainedDiagnosticArtifact.closed;
    if (result.processCleanupComplete && descriptorsClosed && !inventoryFailed && inventoryComplete && archivalCopySaved) {
      for (const root of roots) {
        try {
          const stat = io.lstatSync(root.path);
          if (!root.prepared || !stat.isDirectory() || stat.isSymbolicLink() || !same(stat, root.identity)) throw Error('Root changed');
          io.rmSync(root.path, { recursive: true, force: false });
          try { io.lstatSync(root.path); } catch (error) { if (error?.code === 'ENOENT') root.removed = true; }
        } catch { /* Preserve exact identities rather than deleting an unconfirmed root. */ }
      }
    }
    result.retainedRoots = roots.filter(root => !root.removed).map(root => ({ path: root.path, identity: root.identity,
      originalStderrSaved: root === roots[0] && originalStderrSaved }));
    result.rootCleanupComplete = roots.every(root => root.removed);
    result.outputAccountingComplete = !inventoryFailed && inventoryComplete && descriptorsClosed && inputComplete;
    result.withinBudget = result.outputAccountingComplete && budgetFits() && now() <= bounds.totalMs;
    if (result.close && result.close.reason !== 'CLOSED') fail(`R06_${result.close.reason}`);
    if (transport?.snapshot().ignoredResponses !== 0 && result.targetCalls !== 0) fail('IGNORED_RESPONSE');
    result.status = !result.failure && result.catalogComplete && result.processCleanupComplete && result.rootCleanupComplete
      && result.diagnosticComplete && result.withinBudget ? 'CATALOG_OBSERVED' : 'FAILED_OR_UNKNOWN';
    result.elapsedBeforePersistenceMs = now(); result.elapsedBasis = 'before-result-persistence';
    result.resultPersisted = true;
    try { writeFile(path.join(evidenceDirectory, 'result.json'), json(result), 'receiptBytes'); }
    catch { result.resultPersisted = false; result.outputAccountingComplete = false; result.withinBudget = false; result.status = 'FAILED_OR_UNKNOWN'; }
  }
  result.finalElapsedMs = now(); result.finalElapsedBasis = 'after-result-persistence-before-cli';
  result.withinBudget &&= budgetFits() && result.finalElapsedMs <= bounds.totalMs;
  if (!result.withinBudget) result.status = 'FAILED_OR_UNKNOWN';
  return result;
}
