import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { writeFileSync } from 'node:fs';
import { loadavg, platform, release } from 'node:os';
import { setTimeout as sleep } from 'node:timers/promises';
import { Pool } from 'pg';
import { FlowClient } from '../../packages/client/src/index.js';
import type { Ownership, RunnerEvent, TimelineEntry } from '../../packages/contracts/src/index.js';
import { createServer } from '../../apps/server/src/index.js';
import { distribution, instrumentQueries, type QueryCounts } from './measurements.js';

const DATABASE = 'flow_lab02';
const ADMIN_URL = 'postgresql://flow:flow-local-only@127.0.0.1:55432/postgres';
const DATABASE_URL = 'postgresql://flow:flow-local-only@127.0.0.1:55432/flow_lab02';
const OUTPUT = new URL('../../docs/evidence/lab02/results.json', import.meta.url);
const MAX_BYTES = 64 * 1024 * 1024;
const ORDER = [1, 16, 128, 128, 16, 1, 16, 1, 128];
const WINDOW_MS = 2000;
const started = performance.now();
const deadline = new AbortController();
const deadlineTimer = setTimeout(() => deadline.abort(new Error('75-second experiment deadline')), 75_000);
let payloadBytes = 0;
let server: Awaited<ReturnType<typeof createServer>> | undefined;
let createdDatabase = false;
let reservedOutput = false;
const queryMeter = instrumentQueries(DATABASE);
const admin = new Pool({ connectionString: ADMIN_URL, max: 1, connectionTimeoutMillis: 3000, statement_timeout: 5000 });
const activeGroups = new Set<ObserverGroup>();
const cleanupErrors: string[] = [];
const phases: Phase[] = [];
const evidence: Record<string, unknown> = {
  status: 'started', startedAt: new Date().toISOString(), modelQueries: 0,
  baseCommit: '6434fba78bba5097376555a66114462f5432ca25',
  sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  environment: { node: process.version, platform: platform(), release: release(), loadAverageStart: loadavg() },
  limits: { deadlineMs: 75000, totalBudgetMs: 120000, maxBytes: MAX_BYTES },
  design: { order: ORDER, windowMs: WINDOW_MS, sourceMessages: 64, sharedObservedTask: true,
    queryMetric: 'pg Client.query submissions in the flow_lab02 database, including center scheduler/heartbeat/control work; not completed SQL or server CPU time',
    poolWait: 'not measured', percentileMethod: 'nearest rank for heartbeat (24 samples/count); control uses three raw values/range only',
    bytesMetric: 'decoded SSE JSON plus update framing, excluding HTTP/TCP headers; separately measured total database size' },
  phases, cleanupErrors,
};

const hardStop = setTimeout(() => {
  evidence.status = 'failed';
  evidence.failure = '112-second hard deadline; resource cleanup not confirmed';
  evidence.elapsedMs = performance.now() - started;
  if (reservedOutput) writeFileSync(OUTPUT, JSON.stringify(evidence, null, 2) + '\n');
  process.exit(1);
}, 112000);

interface Phase {
  observers: number;
  round: number;
  warmupMs: number;
  windowMs: number;
  queries: QueryCounts;
  heartbeatMs: number[];
  cancelMs: number;
  verifiedObservers: number;
  watermark: number;
  entriesDigest: string;
}
interface ObserverGroup {
  entries: TimelineEntry[][];
  errors: Error[];
  settled: boolean[];
  ready: Promise<void>;
  close(): Promise<void>;
}

function startObservers(owner: FlowClient, taskId: string, count: number, expected: TimelineEntry[]): ObserverGroup {
  const stop = new AbortController();
  const signal = AbortSignal.any([stop.signal, deadline.signal]);
  const entries = Array.from({ length: count }, () => [] as TimelineEntry[]);
  const errors: Error[] = [];
  const settled = Array.from({ length: count }, () => false);
  const readyResolvers = Array.from({ length: count }, () => {
    let resolve!: () => void;
    let reject!: (reason: unknown) => void;
    const promise = new Promise<void>((ok, fail) => { resolve = ok; reject = fail; });
    return { promise, resolve, reject };
  });
  const loops = entries.map(async (received, index) => {
    let cursor = 0;
    try {
      for await (const page of owner.watch(taskId, 0, signal)) {
        payloadBytes += Buffer.byteLength(JSON.stringify(page)) + 22;
        assert(payloadBytes < MAX_BYTES, 'SSE payload exceeded data budget');
        assert.equal(page.reset, undefined);
        assert.equal(page.task.status, 'running');
        for (const entry of page.entries) {
          assert.equal(entry.cursor, cursor + 1, 'duplicate or missing timeline cursor');
          cursor = entry.cursor;
          received.push(entry);
        }
        assert.equal(page.watermark, expected.length);
        if (cursor === expected.length) {
          assert.deepEqual(received, expected);
          readyResolvers[index]!.resolve();
        }
      }
      if (!signal.aborted) throw new Error('SSE closed unexpectedly');
    } catch (error) {
      if (!signal.aborted) {
        errors.push(error instanceof Error ? error : new Error('Observer failed'));
        readyResolvers[index]!.reject(error);
      } else readyResolvers[index]!.reject(new Error('Observer stopped before readiness'));
    } finally { settled[index] = true; }
  });
  const group: ObserverGroup = {
    entries, errors, settled,
    ready: Promise.all(readyResolvers.map(item => item.promise)).then(() => undefined),
    async close() { stop.abort(); await Promise.all(loops); activeGroups.delete(group); },
  };
  // Attach rejection handling immediately; caller awaits the same promise below.
  void group.ready.catch(() => undefined);
  activeGroups.add(group);
  return group;
}

async function waitForAssignment(runner: FlowClient) {
  for (let i = 0; i < 40; i++) {
    deadline.signal.throwIfAborted();
    const result = await runner.claim(deadline.signal);
    if (result.assignment) return result.assignment;
    await sleep(100, undefined, { signal: deadline.signal });
  }
  throw new Error('Task was not dispatched in four seconds');
}

async function samplePhase(owner: FlowClient, runner: FlowClient, ownership: Ownership, taskId: string, expected: TimelineEntry[], count: number, index: number): Promise<Phase> {
  deadline.signal.throwIfAborted();
  const control = await owner.submit({ title: 'LAB02 queued control', prompt: 'No execution', harness: 'fixture' }, randomUUID());
  const warmupStart = performance.now();
  const group = startObservers(owner, taskId, count, expected);
  try {
    await group.ready;
    // Let the empty page following the final backlog page pass before counting.
    await sleep(300, undefined, { signal: deadline.signal });
    const warmupMs = performance.now() - warmupStart;
    assert.equal(group.errors.length, 0);
    assert(group.settled.every(value => !value), 'all observers must remain connected');
    const heartbeatMs: number[] = [];
    queryMeter.start();
    const windowStart = performance.now();
    const heartbeatLoop = (async () => {
      for (let sample = 0; sample < 8; sample++) {
        const due = windowStart + sample * 250;
        await sleep(Math.max(0, due - performance.now()), undefined, { signal: deadline.signal });
        const at = performance.now();
        const reply = await runner.heartbeat(ownership, deadline.signal);
        heartbeatMs.push(performance.now() - at);
        assert.equal(reply.action, 'continue');
      }
    })();
    const controlOperation = (async () => {
      await sleep(750, undefined, { signal: deadline.signal });
      const at = performance.now();
      const result = await owner.cancel(control.task.id, randomUUID());
      const elapsed = performance.now() - at;
      assert.equal(result.status, 'cancelled');
      return elapsed;
    })();
    const [cancelMs] = await Promise.all([controlOperation, heartbeatLoop]);
    await sleep(Math.max(0, WINDOW_MS - (performance.now() - windowStart)), undefined, { signal: deadline.signal });
    const windowMs = performance.now() - windowStart;
    const queries = queryMeter.stop();
    assert(queries.timelineReads > 0, 'instrumentation must see actual timeline reads');
    assert(queries.readOnlyTransactionStarts > 0, 'instrumentation must see actual read-only transactions');
    assert.equal(group.errors.length, 0);
    assert(group.settled.every(value => !value));
    for (const received of group.entries) assert.deepEqual(received, expected);
    return { observers: count, round: Math.floor(index / 3) + 1, warmupMs, windowMs, queries, heartbeatMs, cancelMs,
      verifiedObservers: count, watermark: expected.length, entriesDigest: digest(expected) };
  } finally {
    queryMeter.stop();
    await group.close();
  }
}

function digest(entries: TimelineEntry[]) {
  return createHash('sha256').update(JSON.stringify(entries)).digest('hex');
}
async function cleanupStep(name: string, run: () => Promise<unknown>) {
  let timer: NodeJS.Timeout | undefined;
  try {
    await Promise.race([run(), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${name} timed out`)), 8000); })]);
  } catch { cleanupErrors.push(name); }
  finally { clearTimeout(timer); }
}

try {
  await writeFile(OUTPUT, JSON.stringify(evidence, null, 2) + '\n', { flag: 'wx' });
  reservedOutput = true;
  const existing = await admin.query('SELECT 1 FROM pg_database WHERE datname=$1', [DATABASE]);
  assert.equal(existing.rowCount, 0, 'flow_lab02 already exists; refusing to reuse or erase it');
  await admin.query('CREATE DATABASE flow_lab02');
  createdDatabase = true;
  evidence.postgresVersion = (await admin.query('SHOW server_version')).rows[0]?.server_version;
  const ownerToken = randomUUID();
  server = await createServer({ databaseUrl: DATABASE_URL, ownerToken, leaseMs: 30000 });
  const baseUrl = await server.listen({ host: '127.0.0.1', port: 0 });
  evidence.port = Number(new URL(baseUrl).port);
  const owner = new FlowClient({ baseUrl, token: ownerToken });
  const registration = await owner.registerRunner({ name: 'LAB02 protocol-only runner', harnesses: ['fixture'], capacity: 1 });
  const runner = new FlowClient({ baseUrl, token: registration.token });
  const accepted = await owner.submit({ title: 'LAB02 fixed timeline', prompt: '64 deterministic messages; no model', harness: 'fixture' }, randomUUID());
  const assignment = await waitForAssignment(runner);
  assert.equal(assignment.task.id, accepted.task.id);
  const ownership = { attemptId: assignment.attempt.id, ownerVersion: assignment.attempt.ownerVersion };
  const events: RunnerEvent[] = Array.from({ length: 64 }, (_, index) => ({ type: 'message', id: `lab02-message-${index + 1}`, sequence: index + 1, text: `LAB02 message ${String(index + 1).padStart(2, '0')}: fixed shared content.` }));
  for (let offset = 0; offset < events.length; offset += 32) await runner.report({ ...ownership, events: events.slice(offset, offset + 32) }, deadline.signal);
  const baseline = await owner.show(accepted.task.id, deadline.signal);
  assert.equal(baseline.status, 'running');
  assert.equal(baseline.hasMore, false);
  assert.equal(baseline.entries.length, 64);
  evidence.taskId = accepted.task.id;
  evidence.entriesDigest = digest(baseline.entries);
  evidence.baselineWatermark = baseline.watermark;
  for (const [index, count] of ORDER.entries()) {
    const phase = await samplePhase(owner, runner, ownership, accepted.task.id, baseline.entries, count, index);
    phases.push(phase);
    console.log(JSON.stringify({ phase: index + 1, observers: count, readTransactionStarts: phase.queries.readOnlyTransactionStarts, heartbeatP95Ms: distribution(phase.heartbeatMs).p95 }));
    await sleep(100, undefined, { signal: deadline.signal });
  }
  const final = await owner.show(accepted.task.id, deadline.signal);
  assert.equal(final.status, 'running');
  assert.deepEqual(final.entries, baseline.entries);
  assert.equal(final.watermark, baseline.watermark);
  const page = await owner.events(accepted.task.id);
  assert.deepEqual(page.entries, baseline.entries);
  evidence.finalCorrectness = { status: final.status, watermark: final.watermark, entriesDigest: digest(final.entries), observersVerified: phases.reduce((sum, phase) => sum + phase.verifiedObservers, 0), assertions: 'SSE exact entry equality/order/no duplicate or missing cursor; all observers stayed open through measurement; final snapshot and event page equal initial baseline' };
  const size = Number((await admin.query('SELECT pg_database_size($1) AS bytes', [DATABASE])).rows[0]?.bytes);
  assert(size + payloadBytes < MAX_BYTES, 'database and SSE payload combined exceed 64 MiB');
  evidence.databaseBytes = size;
  evidence.summary = [1, 16, 128].map(count => {
    const selected = phases.filter(phase => phase.observers === count);
    return { observers: count, heartbeatMs: distribution(selected.flatMap(phase => phase.heartbeatMs)), cancelMs: { samples: selected.map(phase => phase.cancelMs), min: Math.min(...selected.map(phase => phase.cancelMs)), max: Math.max(...selected.map(phase => phase.cancelMs)) },
      readTransactionStartsPerSecond: distribution(selected.map(phase => phase.queries.readOnlyTransactionStarts / (phase.windowMs / 1000))),
      submittedQueriesPerSecond: distribution(selected.map(phase => phase.queries.total / (phase.windowMs / 1000))) };
  });
  evidence.status = 'passed';
} catch (error) {
  // Do not serialize arbitrary driver/HTTP error messages that might contain credentials.
  evidence.status = 'failed';
  evidence.failure = error instanceof assert.AssertionError ? error.message : error instanceof Error ? error.name : 'Unknown error';
  process.exitCode = 1;
} finally {
  deadline.abort();
  clearTimeout(deadlineTimer);
  queryMeter.stop();
  await cleanupStep('observers', async () => { await Promise.all([...activeGroups].map(group => group.close())); });
  if (server) await cleanupStep('server', () => server!.close());
  if (createdDatabase) await cleanupStep('database', () => admin.query('DROP DATABASE flow_lab02 WITH (FORCE)'));
  await cleanupStep('admin pool', () => admin.end());
  queryMeter.restore();
  evidence.cleanup = { createdDatabase, errors: cleanupErrors, databaseDropped: createdDatabase && !cleanupErrors.includes('database') };
  evidence.payloadBytes = payloadBytes;
  evidence.elapsedMs = performance.now() - started;
  evidence.finishedAt = new Date().toISOString();
  evidence.loadAverageEnd = loadavg();
  if (cleanupErrors.length) { evidence.status = 'failed'; process.exitCode = 1; }
  if (reservedOutput) await writeFile(OUTPUT, JSON.stringify(evidence, null, 2) + '\n');
  clearTimeout(hardStop);
  console.log(JSON.stringify({ status: evidence.status, elapsedMs: evidence.elapsedMs, payloadBytes, cleanupErrors }));
}
