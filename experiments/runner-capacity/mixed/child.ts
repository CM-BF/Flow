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
import { createClaimObservation } from './claim-observation.js';
import { centerDelivery, deliveryInput, DELIVERY_ENVELOPE_BYTES, type DeliveryInput } from './pg-delivery-bridge.js';
import type { HarnessAdapter } from '@flow/contracts';

type Registration = { runnerId: string; token: string; directory: string; slots: number };
type CaseInput = { kind: 'case'; caseId: string; baseUrl: string; taskIds: string[]; runners: Registration[] };
let contract: RunContract = CONTRACT;
let sourceDirectory: string | undefined;
let pgDelivery: DeliveryInput | undefined;
let delivery: ReturnType<typeof centerDelivery> | undefined;
let stoppedAtMs: number | null = null;
const shutdown = new AbortController();
const deliveryAbort = new AbortController();
let deliveryDeadline: number | undefined;
const reporter = childReporter(() => shutdown.abort(), () => contract, () => pgDelivery ? DELIVERY_ENVELOPE_BYTES : contract.responseBytes);
const send = reporter.send;
function stop() { stoppedAtMs ??= performance.now(); shutdown.abort(); }
process.once('SIGTERM', () => { deliveryAbort.abort(); stop(); });
process.once('disconnect', () => { deliveryAbort.abort(); stop(); });
let caseControl: AbortController | undefined;
let casePromise: Promise<void> | undefined;
let measure = deferred<number>();
let currentCase = '';
let windowTimer: ReturnType<typeof setTimeout> | undefined;
let boundarySnapshot = (): Record<string, unknown> => ({});
process.on('message', (message: { kind?: string; epoch?: unknown; phase?: unknown }) => {
  if (message.kind === 'pg-phase') {
    if (contract.queueProbe) send({ kind: 'center-boundary', epoch: message.epoch, requestedPhase: message.phase, ...boundarySnapshot() });
    delivery?.phase(message.epoch, message.phase);
  }
  if (message.kind === 'stop') stop();
  if (message.kind === 'stop-case') { stoppedAtMs ??= performance.now(); send({ kind: 'stop-case-received', caseId: currentCase, stoppedAtMs }); caseControl?.abort(); }
  if (message.kind === 'measure') {
    if (pgDelivery && message.epoch !== pgDelivery.epoch) { send({ kind: 'failure', code: 'pg_epoch_unknown' }); process.exitCode = 1; stop(); return; }
    const epoch = pgDelivery ? { epoch: pgDelivery.epoch } : {};
    const beganMs = performance.now(); measure.resolve(beganMs);
    send({ kind: 'window-start', caseId: currentCase, beganMs, ...epoch, ...(contract.queueProbe ? { boundary: boundarySnapshot() } : {}) });
    windowTimer = setTimeout(() => send({ kind: 'window-end', caseId: currentCase, beganMs, endedMs: performance.now(), ...epoch, ...(contract.queueProbe ? { boundary: boundarySnapshot() } : {}) }), contract.caseMs);
  }
});
async function center(config: { databaseUrl: string; ownerToken: string }) {
  const streams = new StreamBytes(contract.ownedStreams);
  delivery = pgDelivery ? centerDelivery(pgDelivery, send, () => { process.exitCode = 1; shutdown.abort(); }) : undefined;
  const observer = observePg(pg.Pool.prototype, event => delivery ? delivery.record(event) : send({ ...event }), undefined, client => streams.addPgClient(client), Boolean(contract.queueProbe));
  boundarySnapshot = () => observer.boundary();
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
    finally {
      sample(); send({ kind: 'center-settled', observationDropped: observer.dropped }); observer.restore();
      if (delivery) {
        // The existing 500ms IPC drain allowance now covers flush plus final callbacks.
        deliveryDeadline = performance.now() + 500;
        await delivery.finishAsync(message => reporter.sendAsync(message, { deadlineMs: deliveryDeadline!, signal: deliveryAbort.signal }));
      }
    }
  }
}
async function runCase(input: CaseInput) {
  const { runRunner } = await import(productionModule(sourceDirectory, 'apps/runner/src/runtime.js')) as typeof import('../../../apps/runner/src/runtime.js');
  const { createFixtureAdapter } = await import(productionModule(sourceDirectory, 'apps/runner/src/fixture.js')) as typeof import('../../../apps/runner/src/fixture.js');
  caseControl = new AbortController(); measure = deferred<number>(); currentCase = input.caseId;
  const signal = AbortSignal.any([shutdown.signal, caseControl.signal]); stoppedAtMs = null;
  const claimObservation = createClaimObservation(input.taskIds); const claims = claimObservation.claims;
  let claimCodec: Promise<{ decodeRunnerClaimResponse(value: unknown, request: unknown, operation: 'claim' | 'status'): unknown }> | undefined;
  const originalFetch = globalThis.fetch; let active = 0; let requestOrdinal = 0; let requestsSettled = 0;
  let inFlight = 0;
  const emissions = new Map<string, { ordinal: number; startedChildMs: number }>();
  boundarySnapshot = () => ({ requestsStarted: requestOrdinal, requestsSettled, inFlight, activeAdapters: active, pendingEmits: emissions.size });
  globalThis.fetch = async (target, init) => {
    const url = new URL(typeof target === 'string' ? target : target instanceof URL ? target.href : target.url);
    if (url.origin !== input.baseUrl || !url.pathname.startsWith('/api/runner/')) throw new Error('mixed_unowned_destination');
    const start = performance.now(); const payload = typeof init?.body === 'string' ? init.body : '';
    const body = payload ? JSON.parse(payload) : {};
    const path = url.pathname;
    const ordinal = ++requestOrdinal;
    if (contract.queueProbe && ordinal > contract.queueProbe.runnerHttpLimit) throw new Error('queue_runner_http_limit');
    let status: number | null = null; let stage = 'fetch';
    const bound = body.attemptId ? [...claims.values()].find(value => value.attemptId === body.attemptId) : undefined;
    const headers = new Headers(init?.headers);
    const registration = input.runners.find(value => headers.get('authorization') === 'Bearer ' + value.token);
    const identity = { requestOrdinal: ordinal, operation: path.split('/').at(-1), taskId: bound?.taskId ?? null,
      attemptId: bound?.attemptId ?? null, runnerId: bound?.runnerId ?? registration?.runnerId ?? null,
      sentChildMs: start, ownerVersion: bound?.ownerVersion ?? null };
    if (contract.persistentSessions) send({ kind: 'runner-request-send', caseId: input.caseId, ...identity, stoppedAtMs });
    inFlight++;
    try {
      const response = await originalFetch(target, init); status = response.status; stage = 'body';
      const text = await boundedText(response, contract.responseBytes);
      stage = 'decode'; const parsed = text ? JSON.parse(text) : null; stage = 'identity';
      send({ kind: 'runner-http', caseId: input.caseId, path, elapsedMs: performance.now() - start,
        ...identity, status: response.status, settledChildMs: performance.now(), stoppedAtMs, transferBytes: Buffer.byteLength(payload) + Buffer.byteLength(text),
        ...(body.attemptId ? { attemptId: body.attemptId, ownerVersion: body.ownerVersion } : {}) });
      if (response.ok) {
        const v2Claim = path === '/api/runner/claim-opportunity' || path === '/api/runner/claim-opportunity/status';
        let acknowledged = parsed;
        if (v2Claim) {
          // Load the SAME fixed production DTO decoder. Old v1/A-B snapshots never load this module.
          claimCodec ??= import(productionModule(sourceDirectory, 'packages/contracts/src/runner-claim.js'));
          acknowledged = (await claimCodec).decodeRunnerClaimResponse(parsed, body, path.endsWith('/status') ? 'status' : 'claim');
        }
        const observed = claimObservation.observe(path, body, acknowledged, registration?.runnerId);
        if (observed) send({ kind: observed.replay ? 'claim-replay' : 'claim', caseId: input.caseId, ...observed.claim,
          requestOrdinal: ordinal, ...(observed.requestId ? { requestId: observed.requestId } : {}) });
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
    } finally { requestsSettled++; inFlight--; }
  };
  const fixture = createFixtureAdapter();
  const adapter: HarnessAdapter = {
    name: 'fixture', version: fixture.version,
    async run(context) {
      const taskId = 'id' in context.task && typeof context.task.id === 'string' ? context.task.id : undefined;
      const identity = taskId ? claims.get(taskId) : undefined;
      if (!identity) throw new Error('mixed_missing_claim_identity');
      const cancelled = () => send({ kind: 'control-abort', caseId: input.caseId, ...identity, observedChildMs: performance.now() });
      if (contract.queueProbe) context.signal.addEventListener('abort', cancelled, { once: true });
      active++; send({ kind: 'adapter-enter', caseId: input.caseId, ...identity, active });
      try {
        await fixture.run(context);
        send({ kind: 'adapter-ready', caseId: input.caseId, ...identity });
        const waitingAtMs = performance.now();
        const began = await abortable(measure.promise, context.signal);
        send({ kind: 'barrier-released', caseId: input.caseId, ...identity, waitingAtMs, releasedAtMs: performance.now(), beganMs: began });
        let emissionOrdinal = 0;
        const activityMs = contract.caseMs + (contract.queueProbe?.emitTailMs ?? 0);
        while (performance.now() < began + activityMs
          && (!contract.persistentSessions || emissionOrdinal < contract.eventsPerSecond * activityMs / 1000)) {
          context.signal.throwIfAborted();
          const started = performance.now();
          emissionOrdinal++; emissions.set(identity.attemptId, { ordinal: emissionOrdinal, startedChildMs: started });
          try {
            if (contract.queueProbe) send({ kind: 'emit-start', caseId: input.caseId, ...identity, emissionOrdinal, startedChildMs: started });
            await context.emit({ type: 'message', text: 'm'.repeat(contract.messageBytes) });
            send({ kind: 'emit-ack', caseId: input.caseId, ...identity, emissionOrdinal, startedChildMs: started, elapsedMs: performance.now() - started });
          } finally { emissions.delete(identity.attemptId); }
          const next = Math.min(began + activityMs, started + 1000 / contract.eventsPerSecond);
          await sleep(Math.max(0, next - performance.now()), undefined, { signal: context.signal });
        }
        while (contract.persistentSessions && performance.now() < began + activityMs) {
          await sleep(Math.max(1, Math.ceil(began + activityMs - performance.now())), undefined, { signal: context.signal });
        }
      } finally { if (contract.queueProbe) context.signal.removeEventListener('abort', cancelled); active--; send({ kind: 'adapter-end', caseId: input.caseId, ...identity, active, interrupted: context.signal.aborted }); }
    },
  };
  try {
    const results = await Promise.allSettled(input.runners.map(registration => runRunner({ baseUrl: input.baseUrl, token: registration.token,
      workingDirectory: registration.directory, adapters: [adapter], signal,
      maxConcurrentAttempts: registration.slots, heartbeatIntervalMs: contract.heartbeatMs,
      pollIntervalMs: contract.pollMs, requestTimeoutMs: contract.requestMs,
      onNotice: notice => send({ kind: 'notice', caseId: input.caseId, notice }) }).catch(error => { caseControl?.abort(); throw error; })));
    if (results.some(result => result.status === 'rejected')) throw new Error('runtime_failed');
  } finally { clearTimeout(windowTimer); globalThis.fetch = originalFetch; boundarySnapshot = () => ({}); send({ kind: 'case-runtime-settled', caseId: input.caseId, active }); }
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
process.once('message', async (config: { role: string; databaseUrl: string; ownerToken: string; runIdentity?: string; sourceDirectory?: string; pgDelivery?: DeliveryInput }) => {
  if (!['center', 'runner'].includes(config.role)) return;
  contract = selectRunIdentity(config.runIdentity).contract;
  sourceDirectory = config.sourceDirectory;
  pgDelivery = config.pgDelivery ? deliveryInput(config.pgDelivery) : undefined;
  const memoryTimer = contract.persistentSessions ? setInterval(() => send({ ...memoryObservation(), role: config.role }), contract.memoryIntervalMs) : undefined;
  try { if (config.role === 'center') await center(config); else await runner(); }
  catch { send({ kind: 'failure', code: 'child_failed' }); process.exitCode = 1; }
  finally {
    clearInterval(memoryTimer); if (contract.persistentSessions) send({ ...memoryObservation(), role: config.role });
    send({ kind: 'child-settled', dropped: reporter.dropped, firstFailure: reporter.firstFailure });
    const end = deliveryDeadline ?? performance.now() + 500;
    if (pgDelivery) {
      if (!await reporter.drain({ deadlineMs: end, signal: deliveryAbort.signal })) process.exitCode = 1;
    } else while (reporter.pending && performance.now() < end) await sleep(5);
    if (pgDelivery && (reporter.pending !== 0 || reporter.dropped !== 0)) process.exitCode = 1;
    reporter.close(); process.disconnect?.();
  }
});
