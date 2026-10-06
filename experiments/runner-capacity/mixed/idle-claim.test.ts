import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import type { Socket } from 'node:net';
import { lstatSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { expect, test, vi } from 'vitest';
import { observeIdleJournal } from './idle-claim-observer.js';
import { IDLE_LIMITS, idleBudget, sampleIdleRoot, verifyIdleInputs } from './idle-claim-budget.js';

const state = vi.hoisted(() => ({ observer: null as ReturnType<typeof observeIdleJournal> | null }));
vi.mock('node:fs/promises', async importOriginal => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return { ...actual,
    open(...args: Parameters<typeof actual.open>) { return Reflect.apply(state.observer?.open ?? actual.open, actual, args); },
    rename(...args: Parameters<typeof actual.rename>) { return Reflect.apply(state.observer?.rename ?? actual.rename, actual, args); },
  };
});

test('one public idle runtime retains twelve definite empty claims through normal stop', async () => {
  // Nothing below runs through the default fake-only config. No implicit local fallback.
  const windowId = process.env.FLOW_S01_IDLE_WINDOW;
  const root = process.env.FLOW_S01_IDLE_ROOT;
  const started = Number(process.env.FLOW_S01_IDLE_STARTED_MS);
  if (windowId !== 's01-idle-claim-cost-once' || !root || !/\/flow-s01-idle-[A-Za-z0-9_-]+$/.test(root)
    || !Number.isSafeInteger(started) || !idleBudget(0, 0, 0, Date.now(), started).workAllowed) throw Error('ACTUAL_NOT_OPEN');
  const rootIdentity = lstatSync(root);
  if (!rootIdentity.isDirectory() || rootIdentity.isSymbolicLink()) throw Error('OWN_ROOT_IDENTITY');
  const worktree = process.cwd();
  const manifestPath = resolve(worktree, 'docs/evidence/s01/idle-claim-cost/fixed-input.json');
  const inputs = verifyIdleInputs(worktree, manifestPath, process.env.FLOW_S01_IDLE_INPUT_SHA256);
  if (inputs.manifestSha256 !== process.env.FLOW_S01_IDLE_INPUT_SHA256) throw Error('REVIEWED_INPUT_MISMATCH');
  const actual = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises');
  const workDirectory = join(root, 'work');
  mkdirSync(workDirectory, { mode: 0o700 }); // Exclusive new directory; existing state is never adopted.
  const monotonicStart = performance.now(), initialElapsed = Date.now() - started;
  const now = () => started + Math.ceil(initialElapsed + performance.now() - monotonicStart);
  const sampleTime = () => performance.now() - monotonicStart;
  const stop = new AbortController(), sockets = new Set<Socket>();
  const requests: { ordinal: number; receivedMs: number; finishedMs?: number; closedMs?: number; bytes: number; status?: number }[] = [];
  const faults = new Set<string>(), notices: string[] = [];
  let peakOwnBytes = 0, runtimeClosed = false, serverClosed = false, adapterStarts = 0;
  let normalStopAtMs: number | null = null, runtimeClosedAtMs: number | null = null;
  let runtime: Promise<void> | undefined, journalDirectory: string | undefined;
  let finalJournal: 'EMPTY' | 'UNKNOWN' = 'UNKNOWN', rootSample: ReturnType<typeof sampleIdleRoot> | undefined;
  let observer: ReturnType<typeof observeIdleJournal> | undefined, timer: ReturnType<typeof setTimeout> | undefined;
  const fault = (code: string) => { if (faults.size < 24) faults.add(code); stop.abort(); };
  const checkBudget = () => {
    try {
      rootSample = sampleIdleRoot(root); peakOwnBytes = Math.max(peakOwnBytes, rootSample.chargedBytes);
      const budget = idleBudget(inputs.inputBytes, peakOwnBytes, observer?.snapshot().writeInputBytes ?? 0, now(), started);
      if (!budget.workAllowed) fault('WORK_OR_BYTE_LIMIT');
      return budget;
    } catch { fault('OWN_INVENTORY_UNKNOWN'); return null; }
  };
  async function settle<T>(pending: Promise<T>, deadline: number): Promise<T> {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([pending, new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(Error('DEADLINE')), Math.max(0, deadline - now()));
      })]);
    } finally { if (timeout) clearTimeout(timeout); }
  }
  const server = createServer((request, response) => {
    if (request.method !== 'POST' || request.url !== '/api/runner/claim' || requests.length >= IDLE_LIMITS.maxClaims) {
      fault('UNEXPECTED_REQUEST'); response.writeHead(409).end(); return;
    }
    const row: typeof requests[number] = { ordinal: requests.length + 1, receivedMs: sampleTime(), bytes: 0 };
    requests.push(row); let body = '';
    request.on('error', () => fault('REQUEST_ERROR'));
    request.on('data', (chunk: Buffer) => {
      row.bytes += chunk.length;
      if (row.bytes > 1024) { fault('REQUEST_SIZE'); request.destroy(); return; }
      body += chunk.toString('utf8');
    });
    response.on('error', () => fault('RESPONSE_ERROR'));
    response.on('finish', () => { row.finishedMs = sampleTime(); row.status = response.statusCode; });
    response.on('close', () => { row.closedMs = sampleTime(); });
    request.on('end', () => {
      if (body !== '{}') { fault('REQUEST_BODY'); response.writeHead(400).end(); return; }
      checkBudget();
      if (row.ordinal === IDLE_LIMITS.maxClaims) { normalStopAtMs = sampleTime(); stop.abort(); }
      // Even after normal stop, finish this already-sent claim with one definite null ACK.
      response.writeHead(200, { 'content-type': 'application/json' }).end('{"assignment":null,"remainingLeaseMs":0}');
    });
  });
  server.requestTimeout = 1500; server.headersTimeout = 1500; server.keepAliveTimeout = 500;
  server.on('connection', socket => {
    if (sockets.size >= 4) { fault('SOCKET_LIMIT'); socket.destroy(); return; }
    sockets.add(socket); socket.once('close', () => sockets.delete(socket));
  });
  server.on('error', () => fault('SERVER_ERROR'));
  try {
    if (!checkBudget()?.workAllowed) throw Error('PREFLIGHT_BUDGET');
    await settle(new Promise<void>((resolveListen, reject) => {
      server.once('error', reject); server.listen(0, '127.0.0.1', () => { server.off('error', reject); resolveListen(); });
    }), started + IDLE_LIMITS.workMs);
    const address = server.address();
    if (!address || typeof address === 'string') throw Error('LISTEN_IDENTITY');
    const baseUrl = `http://127.0.0.1:${address.port}`;
    journalDirectory = join(workDirectory, createHash('sha256').update(baseUrl).digest('hex'));
    observer = observeIdleJournal(actual, journalDirectory, { now: sampleTime, onUnknown: () => fault('OBSERVER_UNKNOWN') });
    state.observer = observer;
    // This exact Lead-supplied closure has no SDK runtime import. Never import apps/runner/src/index.
    const { runRunner } = await import('../../../docs/evidence/s01/idle-claim-cost/source-snapshot/apps/runner/src/runtime.js');
    if (!checkBudget()?.workAllowed) throw Error('IMPORT_BUDGET');
    timer = setTimeout(() => fault('WORK_DEADLINE'), Math.max(0, started + IDLE_LIMITS.workMs - now()));
    runtime = runRunner({ baseUrl, token: 'synthetic-idle-token', workingDirectory: workDirectory, signal: stop.signal,
      maxConcurrentAttempts: 1, requestTimeoutMs: 1500,
      adapters: [{ name: 'fixture', async run() { adapterStarts++; throw Error('NO_ASSIGNMENT_EXPECTED'); } }],
      onNotice(notice) { if (notices.length < 16) notices.push(notice.type); else fault('NOTICE_LIMIT'); },
    }).then(() => { runtimeClosed = true; runtimeClosedAtMs = sampleTime(); }, () => { runtimeClosed = true; runtimeClosedAtMs = sampleTime(); fault('RUNTIME_REJECTED'); });
    await settle(runtime, started + IDLE_LIMITS.workMs + 1750);
  } catch { fault('RUN_NOT_COMPLETE'); }
  finally {
    if (timer) clearTimeout(timer);
    stop.abort();
    if (runtime && !runtimeClosed) try { await settle(runtime, started + IDLE_LIMITS.totalMs - 1500); } catch { fault('RUNTIME_CLOSE_UNKNOWN'); }
    try {
      const closed = new Promise<void>((resolveClose, reject) => server.close(error => {
        if (error && server.listening) reject(error); else { serverClosed = true; resolveClose(); }
      }));
      server.closeAllConnections();
      for (const socket of sockets) socket.destroy();
      await settle(closed, started + IDLE_LIMITS.totalMs - 1000);
    } catch { fault('SERVER_CLOSE_UNKNOWN'); }
    if (runtimeClosed && observer && journalDirectory) {
      try {
        const path = join(journalDirectory, 'admission.json'), stat = lstatSync(path);
        if (!stat.isFile() || stat.size > 65536) throw Error('JOURNAL_SIZE');
        const value = JSON.parse(readFileSync(path, 'utf8'));
        if (value.version === 1 && value.inFlight === null && Array.isArray(value.assignments) && value.assignments.length === 0) finalJournal = 'EMPTY';
      } catch { fault('JOURNAL_UNKNOWN'); }
    }
    observer?.restore(); state.observer = null;
    const snapshot = observer?.snapshot();
    const expectedPhases = Array.from({ length: 24 }, (_, index) => index % 2 ? 'accept-null' : 'begin');
    if (!snapshot || snapshot.unknown || snapshot.activeOperations || snapshot.openHandles || snapshot.pendingPhase || snapshot.renamedPhase
      || JSON.stringify(snapshot.commits.map(commit => commit.phase)) !== JSON.stringify(expectedPhases)) fault('INCOMPLETE_JOURNAL_TRACE');
    if (snapshot?.samples.some(sample => sample.succeeded === false && !(sample.operation === 'open-read' && sample.error === 'ENOENT'))
      || snapshot?.counts['open-read']?.issued !== 1 || snapshot?.counts['open-read']?.failed !== 1) fault('UNEXPECTED_FS_FAILURE');
    for (const operation of ['open-temp', 'writeFile', 'file-sync', 'close-file', 'rename', 'open-directory', 'directory-sync', 'close-directory'] as const) {
      const count = snapshot?.counts[operation];
      if (count?.issued !== 24 || count.succeeded !== 24 || count.failed !== 0) fault('API_COUNT_GATE');
    }
    if (requests.length !== 12 || requests.some(row => row.status !== 200 || row.finishedMs === undefined) || adapterStarts || notices.length || finalJournal !== 'EMPTY') fault('BEHAVIOR_GATE');
    if (normalStopAtMs === null || runtimeClosedAtMs === null || runtimeClosedAtMs < normalStopAtMs
      || (snapshot?.commits.at(-1)?.completedMs ?? -1) < normalStopAtMs) fault('NORMAL_DRAIN_GATE');
    try {
      const current = lstatSync(root);
      if (current.dev !== rootIdentity.dev || current.ino !== rootIdentity.ino || !current.isDirectory()) throw Error('ROOT_CHANGED');
      rootSample = sampleIdleRoot(root); peakOwnBytes = Math.max(peakOwnBytes, rootSample.chargedBytes);
    } catch { fault('FINAL_INVENTORY_UNKNOWN'); }
    const budget = idleBudget(inputs.inputBytes, peakOwnBytes, snapshot?.writeInputBytes ?? 0, now(), started);
    if (!budget.withinTotal) fault('FINAL_BUDGET');
    // Final worker exit, post-Vitest cache inventory/removal and complete external wall time require the outer receipt.
    // Keep this new root until that owner observes exit. Unknown journal state is never deleted here.
    const receipt = { windowId, fixedRef: '8d84d529a0756116bd0fc8bad969d61a6c26248e',
      internalBehaviorPassed: faults.size === 0 && runtimeClosed && serverClosed && sockets.size === 0,
      overallVerdict: 'PENDING_OUTER_RECEIPT', faults: [...faults], inputs,
      topology: { runtimeInstances: 1, configuredCapacity: 1, activeAttempts: 0, adapterStarts, processTopology: 'vitest parent plus one fork worker; external exit confirmation pending' },
      requests, notices, normalStopAtMs, runtimeClosedAtMs, observer: snapshot ?? null, finalJournal,
      resources: { runtimeClosed, serverClosed, openSockets: sockets.size, root, workDirectory, retainedUntilOuterExit: true },
      budget: { ...budget, peakOwnBytesSampled: peakOwnBytes, rootSample, inputBytes: inputs.inputBytes, rawReserve: IDLE_LIMITS.rawReserve,
        internalElapsedMs: now() - started, fullOuterElapsedMs: null, cachePeakBetweenSamples: 'UNKNOWN' } };
    const encoded = JSON.stringify(receipt, null, 2) + '\n';
    if (Buffer.byteLength(encoded) > 65536) throw Error('RECEIPT_SIZE');
    writeFileSync(join(root, 'receipt.json'), encoded, { flag: 'wx', mode: 0o600 });
    expect(receipt.internalBehaviorPassed).toBe(true);
  }
});
