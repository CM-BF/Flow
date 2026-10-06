import pg from 'pg';
import { productionModule } from './ab-input.js';
import { setTimeout as sleep } from 'node:timers/promises';
import { createHash } from 'node:crypto';
import { CONTRACT, deferred, type RunContract } from './contract.js';
import { StreamBytes } from './stream-bytes.js';
import { observePg } from './observe-pg.js';
import { childReporter, abortable, memoryObservation } from './channel.js';
import { boundedText } from '../http.js';
import { selectRunIdentity } from './run-identity.js';
import { requestErrorClass } from './request-error.js';
import type { HarnessAdapter } from '@flow/contracts';

type Registration = { runnerId: string; token: string; directory: string; slots: number };
type CaseInput = { kind: 'case'; caseId: string; baseUrl: string; taskIds: string[]; runners: Registration[] };
type Claim = { taskId: string; attemptId: string; ownerVersion: number; runnerId: string };
let contract: RunContract = CONTRACT;
let sourceDirectory: string | undefined;
let stoppedAtMs: number | null = null;
const shutdown = new AbortController();
const reporter = childReporter(() => shutdown.abort(), () => contract);
const send = reporter.send;
function stop() { stoppedAtMs ??= performance.now(); shutdown.abort(); }
process.once('SIGTERM', stop);
process.once('disconnect', stop);
let caseControl: AbortController | undefined;
let casePromise: Promise<void> | undefined;
let measure = deferred<number>();
let currentCase = '';
let windowTimer: ReturnType<typeof setTimeout> | undefined;
process.on('message', (message: { kind?: string }) => {
  if (message.kind === 'stop') stop();
  if (message.kind === 'stop-case') { stoppedAtMs ??= performance.now(); send({ kind: 'stop-case-received', caseId: currentCase, stoppedAtMs }); caseControl?.abort(); }
  if (message.kind === 'measure') {
    const beganMs = performance.now(); measure.resolve(beganMs);
    send({ kind: 'window-start', caseId: currentCase, beganMs });
    windowTimer = setTimeout(() => send({ kind: 'window-end', caseId: currentCase, beganMs, endedMs: performance.now() }), contract.caseMs);
  }
});
async function center(config: { databaseUrl: string; ownerToken: string }) {
  const streams = new StreamBytes(contract.ownedStreams);
  const observer = observePg(pg.Pool.prototype, event => send({ ...event }), undefined, client => streams.addPgClient(client));
  const sample = () => send({ kind: 'stream-bytes', ...streams.sample() });
  const sampleTimer = setInterval(sample, contract.observationMs);
  let app: Awaited<ReturnType<typeof import('../../../apps/server/src/index.js')['createServer']>> | undefined;
  try {
    // All createServer loading occurs after observation installation, in this owned process only.
    const { createServer } = await import(productionModule(sourceDirectory, 'apps/server/src/index.js')) as typeof import('../../../apps/server/src/index.js');
    app = await createServer({ databaseUrl: config.databaseUrl, ownerToken: config.ownerToken, leaseMs: contract.leaseMs });
    app.server.on('connection', socket => streams.add(socket));
    const baseUrl = await app.listen({ host: '127.0.0.1', port: 0 });
    send({ kind: 'ready', baseUrl });
    await abortable(new Promise<void>(() => {}), shutdown.signal).catch(() => {});
  } finally {
    clearInterval(sampleTimer);
    try { await app?.close(); }
    finally { sample(); send({ kind: 'center-settled', observationDropped: observer.dropped }); observer.restore(); }
  }
}
async function runCase(input: CaseInput) {
  const { runRunner } = await import(productionModule(sourceDirectory, 'apps/runner/src/runtime.js')) as typeof import('../../../apps/runner/src/runtime.js');
  const { createFixtureAdapter } = await import(productionModule(sourceDirectory, 'apps/runner/src/fixture.js')) as typeof import('../../../apps/runner/src/fixture.js');
  caseControl = new AbortController(); measure = deferred<number>(); currentCase = input.caseId;
  const signal = AbortSignal.any([shutdown.signal, caseControl.signal]); stoppedAtMs = null;
  const claims = new Map<string, Claim>(); const allowed = new Set(input.taskIds);
  const originalFetch = globalThis.fetch; let active = 0; let requestOrdinal = 0;
  const emissions = new Map<string, { ordinal: number; startedChildMs: number }>();
  globalThis.fetch = async (target, init) => {
    const url = new URL(typeof target === 'string' ? target : target instanceof URL ? target.href : target.url);
    if (url.origin !== input.baseUrl || !url.pathname.startsWith('/api/runner/')) throw new Error('mixed_unowned_destination');
    const start = performance.now(); const payload = typeof init?.body === 'string' ? init.body : '';
    const body = payload ? JSON.parse(payload) : {};
    const path = url.pathname;
    const ordinal = ++requestOrdinal; let status: number | null = null; let stage = 'fetch';
    const bound = body.attemptId ? [...claims.values()].find(value => value.attemptId === body.attemptId) : undefined;
    const headers = new Headers(init?.headers);
    const registration = input.runners.find(value => headers.get('authorization') === 'Bearer ' + value.token);
    const identity = { requestOrdinal: ordinal, operation: path.split('/').at(-1), taskId: bound?.taskId ?? null,
      attemptId: bound?.attemptId ?? null, runnerId: bound?.runnerId ?? registration?.runnerId ?? null,
      sentChildMs: start, ownerVersion: bound?.ownerVersion ?? null };
    if (contract.persistentSessions) send({ kind: 'runner-request-send', caseId: input.caseId, ...identity, stoppedAtMs });
    try {
      const response = await originalFetch(target, init); status = response.status; stage = 'body';
      const text = await boundedText(response, contract.responseBytes);
      stage = 'decode'; const parsed = text ? JSON.parse(text) : null; stage = 'identity';
      send({ kind: 'runner-http', caseId: input.caseId, path, elapsedMs: performance.now() - start,
        ...identity, status: response.status, settledChildMs: performance.now(), stoppedAtMs, transferBytes: Buffer.byteLength(payload) + Buffer.byteLength(text),
        ...(body.attemptId ? { attemptId: body.attemptId, ownerVersion: body.ownerVersion } : {}) });
      if (path.endsWith('/claim') && response.ok && parsed.assignment) {
        const assignment = parsed.assignment; const taskId = assignment.task.id;
        if (!allowed.has(taskId) || claims.has(taskId)) throw new Error('mixed_claim_identity_conflict');
        const claim: Claim = { taskId, attemptId: assignment.attempt.id, ownerVersion: assignment.attempt.ownerVersion, runnerId: assignment.attempt.runnerId };
        claims.set(taskId, claim); send({ kind: 'claim', caseId: input.caseId, ...claim, requestOrdinal: ordinal });
      }
      if (path.endsWith('/heartbeat') && response.ok) send({ kind: 'heartbeat', caseId: input.caseId,
        attemptId: body.attemptId, ownerVersion: body.ownerVersion, action: parsed.action });
      if (path.endsWith('/events') && response.ok) send({ kind: 'event-ack', caseId: input.caseId,
        attemptId: body.attemptId, ownerVersion: body.ownerVersion, acknowledgement: parsed,
        emissionOrdinal: emissions.get(String(body.attemptId))?.ordinal ?? null,
        events: body.events.map((event: Record<string, unknown>) => ({ id: event.id, sequence: event.sequence, type: event.type,
          outcome: event.outcome ?? null, ...(event.type === 'session' ? { nativeSessionId: event.nativeSessionId } : {}), digest: createHash('sha256').update(canonical(event)).digest('hex') })) });
      return new Response(text, { status: response.status, statusText: response.statusText, headers: response.headers });
    } catch (error) {
      send({ kind: 'runner-http-error', caseId: input.caseId, path, elapsedMs: performance.now() - start,
        ...identity, status, stage, errorClass: requestErrorClass(error), settledChildMs: performance.now(), stoppedAtMs,
        transferBytes: Buffer.byteLength(payload), aborted: signal.aborted, requestSignalAborted: init?.signal?.aborted ?? false }); throw error;
    }
  };
  const fixture = createFixtureAdapter();
  const adapter: HarnessAdapter = {
    name: 'fixture', version: fixture.version,
    async run(context) {
      const taskId = 'id' in context.task && typeof context.task.id === 'string' ? context.task.id : undefined;
      const identity = taskId ? claims.get(taskId) : undefined;
      if (!identity) throw new Error('mixed_missing_claim_identity');
      active++; send({ kind: 'adapter-enter', caseId: input.caseId, ...identity, active });
      try {
        await fixture.run(context);
        send({ kind: 'adapter-ready', caseId: input.caseId, ...identity });
        const waitingAtMs = performance.now();
        const began = await abortable(measure.promise, context.signal);
        send({ kind: 'barrier-released', caseId: input.caseId, ...identity, waitingAtMs, releasedAtMs: performance.now(), beganMs: began });
        let emissionOrdinal = 0;
        while (performance.now() < began + contract.caseMs
          && (!contract.persistentSessions || emissionOrdinal < contract.eventsPerSecond * contract.caseMs / 1000)) {
          context.signal.throwIfAborted();
          const started = performance.now();
          emissionOrdinal++; emissions.set(identity.attemptId, { ordinal: emissionOrdinal, startedChildMs: started });
          try {
            await context.emit({ type: 'message', text: 'm'.repeat(contract.messageBytes) });
            send({ kind: 'emit-ack', caseId: input.caseId, ...identity, emissionOrdinal, startedChildMs: started, elapsedMs: performance.now() - started });
          } finally { emissions.delete(identity.attemptId); }
          const next = Math.min(began + contract.caseMs, started + 1000 / contract.eventsPerSecond);
          await sleep(Math.max(0, next - performance.now()), undefined, { signal: context.signal });
        }
        while (contract.persistentSessions && performance.now() < began + contract.caseMs) {
          await sleep(Math.max(1, Math.ceil(began + contract.caseMs - performance.now())), undefined, { signal: context.signal });
        }
      } finally { active--; send({ kind: 'adapter-end', caseId: input.caseId, ...identity, active, interrupted: context.signal.aborted }); }
    },
  };
  try {
    const results = await Promise.allSettled(input.runners.map(registration => runRunner({ baseUrl: input.baseUrl, token: registration.token,
      workingDirectory: registration.directory, adapters: [adapter], signal,
      maxConcurrentAttempts: registration.slots, heartbeatIntervalMs: contract.heartbeatMs,
      pollIntervalMs: contract.pollMs, requestTimeoutMs: contract.requestMs,
      onNotice: notice => send({ kind: 'notice', caseId: input.caseId, notice }) }).catch(error => { caseControl?.abort(); throw error; })));
    if (results.some(result => result.status === 'rejected')) throw new Error('runtime_failed');
  } finally { clearTimeout(windowTimer); globalThis.fetch = originalFetch; send({ kind: 'case-runtime-settled', caseId: input.caseId, active }); }
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value !== null && typeof value === 'object') return '{' + Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => JSON.stringify(key) + ':' + canonical(item)).join(',') + '}';
  return JSON.stringify(value);
}
async function runner() {
  process.on('message', (value: CaseInput) => {
    if (value.kind !== 'case') return;
    if (casePromise) { send({ kind: 'failure', code: 'case_already_running' }); shutdown.abort(); return; }
    casePromise = runCase(value).catch(() => { send({ kind: 'failure', code: 'case_runtime_failed' }); shutdown.abort(); })
      .finally(() => { casePromise = undefined; });
  });
  send({ kind: 'ready' });
  await abortable(new Promise<void>(() => {}), shutdown.signal).catch(() => {});
  caseControl?.abort(); await casePromise;
}
process.once('message', async (config: { role: string; databaseUrl: string; ownerToken: string; runIdentity?: string; sourceDirectory?: string }) => {
  if (!['center', 'runner'].includes(config.role)) return;
  contract = selectRunIdentity(config.runIdentity).contract;
  sourceDirectory = config.sourceDirectory;
  const memoryTimer = contract.persistentSessions ? setInterval(() => send({ ...memoryObservation(), role: config.role }), contract.memoryIntervalMs) : undefined;
  try { if (config.role === 'center') await center(config); else await runner(); }
  catch { send({ kind: 'failure', code: 'child_failed' }); process.exitCode = 1; }
  finally {
    clearInterval(memoryTimer); if (contract.persistentSessions) send({ ...memoryObservation(), role: config.role });
    send({ kind: 'child-settled', dropped: reporter.dropped });
    const end = performance.now() + 500;
    while (reporter.pending && performance.now() < end) await sleep(5);
    reporter.close(); process.disconnect?.();
  }
});
