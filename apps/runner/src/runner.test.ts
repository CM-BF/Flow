import { textDigest, verifyText } from './verifier.js';
import type { SteeringFinalizationInput } from '../../../packages/contracts/src/active-steering.js';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { afterEach, expect, it } from 'vitest';
import { eventBatchSchema, type ClaimedTask, type EventBatch, type RunnerEvent, type RunnerEventData, type TaskSubmission } from '@flow/contracts';
import { createClaudeAdapter, runRunner, type RunnerOptions, type RunnerNotice } from './index.js';
import { NativeExecutionError } from './native-harness/settlement.js';

const cleanup: (() => Promise<unknown>)[] = [];
afterEach(async () => { for (const stop of cleanup.splice(0).reverse()) await stop(); });

async function center(task: Partial<TaskSubmission> = {}) {
  const events: RunnerEvent[] = [];
  const batches: EventBatch[] = [];
  const shutdown = new AbortController();
  let claimed = false;
  let claims = 0;
  const queuedAssignments: ClaimedTask[] = [];
  let claimLeaseMs = 10_000;
  let action: 'continue' | 'cancel' | 'stop' = 'continue';
  let answer: 'approve' | 'reject' | null = null;
  let reportHook: ((batch: EventBatch, response: ServerResponse) => boolean) | undefined;
  let beforeReport: typeof reportHook;
  let steeringHook: ((path: string, body: any, response: ServerResponse) => boolean) | undefined;
  let heartbeatHook: ((response: ServerResponse) => boolean) | undefined;
  const assignment: ClaimedTask = {
    attempt: { id: 'attempt-1', runnerId: 'runner-1', ownerVersion: 1, leaseExpiresAt: new Date(Date.now() + 10_000).toISOString() },
    task: { id: 'task-1', title: 'Test fixture', prompt: 'Prepare a verified result.', harness: 'fixture', fixture: { scenario: 'success', delayMs: 0 }, ...task },
  };
  const server = createServer(async (request: IncomingMessage, response: ServerResponse) => {
    const parts: Buffer[] = [];
    for await (const part of request) parts.push(part as Buffer);
    const body = JSON.parse(Buffer.concat(parts).toString() || '{}');
    response.setHeader('Content-Type', 'application/json');
    if (request.headers.authorization !== 'Bearer test-runner-token') {
      response.writeHead(401).end(JSON.stringify({ error: { code: 'unauthorized', message: 'Unknown runner.' } })); return;
    }
    if (request.url === '/api/runner/claim') {
      claims++;
      const next = claimed ? queuedAssignments.shift() ?? null : assignment;
      response.end(JSON.stringify({ assignment: next, remainingLeaseMs: next ? claimLeaseMs : 0 })); claimed = true; return;
    }
    if (request.url === '/api/runner/heartbeat') {
      if (heartbeatHook?.(response)) return;
      const decision = events.findLast(event => event.type === 'decision');
      response.end(JSON.stringify({ action, remainingLeaseMs: action === 'stop' ? 0 : 10_000, leaseExpiresAt: new Date(Date.now() + 10_000).toISOString(), decision: answer && decision?.type === 'decision' ? { decisionId: decision.decisionId, answer } : null })); return;
    }
    if (request.url === '/api/runner/events') {
      const batch = eventBatchSchema.parse(body);
      batches.push(batch);
      if (beforeReport?.(batch, response)) return;
      let accepted = 0;
      for (const event of batch.events) {
        const saved = events.find(saved => saved.id === event.id || saved.sequence === event.sequence);
        if (saved) expect(saved).toEqual(event);
        else { expect(event.sequence).toBe(events.length + 1); events.push(event); accepted += 1; }
      }
      if (reportHook?.(batch, response)) return;
      response.end(JSON.stringify({ accepted, lastSequence: events.length })); return;
    }
    if (request.url?.startsWith('/api/runner/steering/') && steeringHook?.(request.url, body, response)) return;
    response.writeHead(404).end('{}');
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No test port.');
  const workingDirectory = await mkdtemp(join(tmpdir(), 'flow-runner-test-'));
  cleanup.push(() => rm(workingDirectory, { recursive: true, force: true }));
  cleanup.push(async () => { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); });
  const options: RunnerOptions = { baseUrl: `http://127.0.0.1:${address.port}`, token: 'test-runner-token', workingDirectory, signal: shutdown.signal, pollIntervalMs: 10, heartbeatIntervalMs: 25, requestTimeoutMs: 100 };
  return {
    events, batches, assignment, options, shutdown,
    get claims() { return claims; },
    queueAssignment(next: ClaimedTask) { queuedAssignments.push(next); },
    start() { const running = runRunner(options); void running.catch(() => undefined); cleanup.push(async () => { shutdown.abort(); await running; }); return running; },
    setClaimLease(milliseconds: number) { claimLeaseMs = milliseconds; },
    setAction(next: typeof action) { action = next; },
    setAnswer(next: typeof answer) { answer = next; },
    onReport(hook: typeof reportHook) { reportHook = hook; },
    beforeReport(hook: typeof reportHook) { beforeReport = hook; },
    onHeartbeat(hook: typeof heartbeatHook) { heartbeatHook = hook; },
    onSteering(hook: typeof steeringHook) { steeringHook = hook; },
  };
}

async function eventually(condition: () => boolean | Promise<boolean>) {
  const deadline = Date.now() + 3000;
  while (!await condition()) {
    if (Date.now() > deadline) throw new Error('Expected runner behavior did not occur.');
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}

it('runs a claimed fixture to a fixed artifact, verification and one completion', async () => {
  const api = await center();
  api.start();
  await eventually(() => api.events.some(event => event.type === 'completed'));
  expect(api.events.filter(event => event.type === 'completed')).toEqual([expect.objectContaining({ outcome: 'succeeded' })]);
  expect(api.events).toContainEqual(expect.objectContaining({ type: 'artifact', content: 'Flow fixture result\nPrepare a verified result.\n' }));
  expect(api.events).toContainEqual(expect.objectContaining({ type: 'artifact', version: 'a79984dda8246f946929a3a7dfafe82797b3c1403d184e7e2fd2636ff71527c5' }));
  expect(api.events).toContainEqual(expect.objectContaining({ type: 'verification', inputDigest: '96972a7b022d3ef38961611a8974f3cc7e8b3a3cab4765110b38568a5419745e' }));
  expect(api.events).toContainEqual(expect.objectContaining({ type: 'verification', verifierId: 'flow.text', verifierVersion: '1', result: 'passed' }));
  expect(api.events).toContainEqual(expect.objectContaining({ type: 'usage', accounting: 'authoritative', baseline: { kind: 'new-session' }, cumulative: true }));
});

it('keeps a durable decision pending until a heartbeat delivers approval', async () => {
  const api = await center({ fixture: { scenario: 'decision', delayMs: 0 } });
  api.start();
  await eventually(() => api.events.some(event => event.type === 'decision'));
  expect(api.events.some(event => event.type === 'artifact')).toBe(false);
  api.setAnswer('approve');
  await eventually(() => api.events.some(event => event.type === 'completed'));
  expect(api.events.filter(event => event.type === 'decision')).toHaveLength(1);
  expect(api.events.at(-1)).toMatchObject({ type: 'completed', outcome: 'succeeded' });
});

it('acknowledges cancellation only after a slow adapter exits without publishing', async () => {
  const api = await center({ fixture: { scenario: 'slow', delayMs: 1000 } });
  api.start();
  await eventually(() => api.events.some(event => event.type === 'message'));
  api.setAction('cancel');
  await eventually(() => api.events.some(event => event.type === 'completed'));
  expect(api.events.at(-1)).toMatchObject({ type: 'completed', outcome: 'cancelled' });
  expect(api.events.some(event => event.type === 'artifact')).toBe(false);
});

it('interrupts on lost heartbeats without pretending cancellation or completion', async () => {
  const api = await center({ fixture: { scenario: 'slow', delayMs: 1000 } });
  const notices: RunnerNotice[] = [];
  api.options.onNotice = notice => notices.push(notice);
  api.start();
  await eventually(() => api.events.some(event => event.type === 'message'));
  api.onHeartbeat(response => { response.destroy(); return true; });
  await eventually(() => notices.some(notice => notice.type === 'ownership-lost'));
  api.shutdown.abort();
  expect(api.events.some(event => event.type === 'artifact' || event.type === 'completed')).toBe(false);
});

it('replays the identical final event when its successful acknowledgement is lost', async () => {
  const api = await center();
  let lost = false;
  api.onReport((batch, response) => {
    if (!lost && batch.events.some(event => event.type === 'completed')) {
      lost = true; response.destroy(); return true;
    }
    return false;
  });
  api.start();
  await eventually(() => api.batches.filter(batch => batch.events.some(event => event.type === 'completed')).length === 2);
  const finalBatches = api.batches.filter(batch => batch.events.some(event => event.type === 'completed'));
  expect(finalBatches[0]).toEqual(finalBatches[1]);
  expect(api.events.filter(event => event.type === 'completed')).toHaveLength(1);
});

it('retains a failed verification separately from successful execution', async () => {
  const api = await center({ fixture: { scenario: 'verification-failure', delayMs: 0 } });
  api.start();
  await eventually(() => api.events.some(event => event.type === 'completed'));
  expect(api.events).toContainEqual(expect.objectContaining({ type: 'artifact', content: '' }));
  expect(api.events).toContainEqual(expect.objectContaining({ type: 'verification', result: 'failed' }));
  expect(api.events.at(-1)).toMatchObject({ outcome: 'succeeded' });
});

it('reports fixture execution failure once without manufacturing an artifact', async () => {
  const api = await center({ fixture: { scenario: 'failure', delayMs: 0 } });
  api.start();
  await eventually(() => api.events.some(event => event.type === 'completed'));
  expect(api.events.at(-1)).toMatchObject({ outcome: 'failed' });
  expect(api.events.some(event => event.type === 'artifact')).toBe(false);
});

it.each([
  ['ordinary', new Error('Ordinary adapter failure')],
  ['settled native', new NativeExecutionError('settled')],
  ['untrusted shape', Object.assign(new Error('Remote payload'), { settlement: 'unknown' })],
] as const)('keeps %s failures on the normal terminal path', async (_label, error) => {
  const api = await center();
  api.options.adapters = [{ name: 'fixture', version: '1', async run() { throw error; } }];
  api.start();
  await eventually(() => api.events.some(event => event.type === 'completed'));
  expect(api.events).toEqual([expect.objectContaining({ type: 'completed', outcome: 'failed' })]);
  await eventually(async () => (await admission(api)).assignments.length === 0);
});

async function admission(api: Awaited<ReturnType<typeof center>>) {
  return JSON.parse(await readFile(join(api.options.workingDirectory, textDigest(api.options.baseUrl), 'admission.json'), 'utf8'));
}

it('retains unknown native execution after local cleanup and across host restart', async () => {
  const api = await center();
  const notices: RunnerNotice[] = [];
  let executions = 0, locallyClosed = false;
  api.options.onNotice = notice => notices.push(notice);
  api.options.adapters = [{ name: 'fixture', version: '1', async run(context) {
    executions++;
    await context.emit({ type: 'message', text: 'External request dispatched.' });
    locallyClosed = true; // Local resource release does not establish a native terminal result.
    throw new NativeExecutionError('unknown');
  } }];
  const first = api.start();
  await eventually(() => notices.some(notice => notice.type === 'admission-blocked'));
  expect(locallyClosed).toBe(true);
  expect(api.events.map(event => event.type)).toEqual(['message']);
  expect((await admission(api)).assignments).toEqual([{ attemptId: 'attempt-1', taskId: 'task-1', runnerId: 'runner-1', ownerVersion: 1 }]);
  expect(api.claims).toBe(1);
  api.shutdown.abort(); await first;
  const restart = new AbortController(), restartedNotices: RunnerNotice[] = [];
  const resumed = runRunner({ ...api.options, signal: restart.signal, onNotice: notice => restartedNotices.push(notice) });
  cleanup.push(async () => { restart.abort(); await resumed; });
  await eventually(() => restartedNotices.some(notice => notice.type === 'admission-blocked'));
  expect(executions).toBe(1); expect(api.claims).toBe(1);
  expect(api.events.some(event => event.type === 'completed')).toBe(false);
});

it('keeps native settlement unknown when cancellation arrived before local cleanup', async () => {
  const api = await center(), notices: RunnerNotice[] = [];
  let entered = false;
  api.options.onNotice = notice => notices.push(notice);
  api.options.adapters = [{ name: 'fixture', version: '1', async run(context) {
    entered = true;
    await new Promise<void>(resolve => context.signal.addEventListener('abort', () => resolve(), { once: true }));
    throw new NativeExecutionError('unknown');
  } }];
  api.start(); await eventually(() => entered); api.setAction('cancel');
  await eventually(() => notices.some(notice => notice.type === 'admission-blocked'));
  expect(api.events).toEqual([]);
  expect((await admission(api)).assignments).toHaveLength(1);
  expect(api.claims).toBe(1);
});

it('lets an already running slot settle while unknown native execution blocks replacement work', async () => {
  const api = await center({ prompt: '1' }), notices: RunnerNotice[] = [];
  for (const id of ['2', '3']) api.queueAssignment({
    ...api.assignment, attempt: { ...api.assignment.attempt, id: `attempt-${id}` },
    task: { ...api.assignment.task, id: `task-${id}`, prompt: id },
  });
  let entered = 0, survivorAborted = false;
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  api.options.maxConcurrentAttempts = 2;
  api.options.onNotice = notice => notices.push(notice);
  api.options.adapters = [{ name: 'fixture', version: '1', async run(context) {
    entered++;
    await eventually(() => entered === 2);
    if (context.task.prompt === '1') throw new NativeExecutionError('unknown');
    await Promise.race([held, new Promise<void>(resolve => context.signal.addEventListener('abort', () => resolve(), { once: true }))]);
    survivorAborted = context.signal.aborted;
  } }];
  api.start();
  await eventually(() => notices.some(notice => notice.type === 'recovery-waiting'));
  expect(api.events).toEqual([]); expect(api.claims).toBe(2);
  release();
  await eventually(() => notices.some(notice => notice.type === 'admission-blocked'));
  expect(survivorAborted).toBe(false); expect(entered).toBe(2); expect(api.claims).toBe(2);
  expect(api.batches.filter(batch => batch.events.some(event => event.type === 'completed')).map(batch => batch.attemptId)).toEqual(['attempt-2']);
  expect(api.events).toEqual([expect.objectContaining({ type: 'completed', outcome: 'succeeded' })]);
  expect((await admission(api)).assignments.map((entry: { attemptId: string }) => entry.attemptId)).toEqual(['attempt-1']);
});

it('uploads large evidence separately from bounded timeline text', async () => {
  const api = await center({ fixture: { scenario: 'large', delayMs: 0, detailBytes: 524_288 } });
  api.start();
  await eventually(() => api.events.some(event => event.type === 'completed'));
  const detail = api.events.find(event => event.type === 'detail');
  expect(detail?.type === 'detail' && Buffer.byteLength(detail.content)).toBe(524_288);
  expect(api.batches.every(batch => Buffer.byteLength(JSON.stringify(batch)) <= 2_097_152)).toBe(true);
  expect(api.events.filter(event => event.type === 'message').every(event => event.text.length <= 4000)).toBe(true);
});

it('expires the local lease while a heartbeat request is still hanging', async () => {
  const api = await center();
  const notices: RunnerNotice[] = [];
  api.options.onNotice = notice => notices.push(notice);
  api.options.requestTimeoutMs = 15_000;
  api.setClaimLease(100);
  api.onHeartbeat(() => true);
  const running = api.start();
  await eventually(() => notices.some(notice => notice.type === 'ownership-lost'));
  api.shutdown.abort();
  await running;
  expect(api.events.some(event => event.type === 'artifact' || event.type === 'completed')).toBe(false);
});

it.each(['reject', 'cancel'] as const)('resolves a pending decision with %s without publishing', async action => {
  const api = await center({ fixture: { scenario: 'decision', delayMs: 0 } });
  api.start();
  await eventually(() => api.events.some(event => event.type === 'decision'));
  if (action === 'reject') api.setAnswer('reject'); else api.setAction('cancel');
  await eventually(() => api.events.some(event => event.type === 'completed'));
  expect(api.events.at(-1)).toMatchObject({ outcome: action === 'reject' ? 'failed' : 'cancelled' });
  expect(api.events.some(event => event.type === 'artifact')).toBe(false);
});

it('stops its process loop without turning shutdown into user cancellation', async () => {
  const api = await center({ fixture: { scenario: 'slow', delayMs: 1000 } });
  const running = api.start();
  await eventually(() => api.events.some(event => event.type === 'message'));
  api.shutdown.abort();
  await running;
  expect(api.events.some(event => event.type === 'completed' || event.type === 'artifact')).toBe(false);
});

it('recovers a persisted final event after restarting the runtime', async () => {
  const api = await center();
  let lost = false;
  api.onReport((batch, response) => {
    if (!lost && batch.events.some(event => event.type === 'completed')) {
      lost = true; response.destroy(); api.shutdown.abort(); return true;
    }
    return false;
  });
  await api.start();
  const restart = new AbortController();
  const resumed = runRunner({ ...api.options, signal: restart.signal });
  cleanup.push(async () => { restart.abort(); await resumed; });
  await eventually(() => api.batches.filter(batch => batch.events.some(event => event.type === 'completed')).length === 2);
  expect(api.events.filter(event => event.type === 'session')).toHaveLength(1);
  const finals = api.batches.filter(batch => batch.events.some(event => event.type === 'completed'));
  expect(finals[0]).toEqual(finals[1]);
});

it('marks resumed fixture usage with an unknown baseline rather than charging history again', async () => {
  const api = await center({ resumeSessionId: 'existing-fixture-session' });
  api.start();
  await eventually(() => api.events.some(event => event.type === 'completed'));
  expect(api.events).toContainEqual(expect.objectContaining({ type: 'usage', scopeId: 'existing-fixture-session', baseline: { kind: 'unknown' }, costUsd: null }));
});

it('retains rejected events for reconciliation without starting the adapter again', async () => {
  const api = await center();
  const notices: RunnerNotice[] = [];
  api.options.onNotice = notice => notices.push(notice);
  api.beforeReport((_batch, response) => { response.writeHead(409).end(JSON.stringify({ error: { code: 'stale_owner', message: 'Expired attempt.' } })); return true; });
  api.start();
  await eventually(() => notices.some(notice => notice.type === 'events-retained'));
  const saved = await readdir(api.options.workingDirectory, { recursive: true });
  const retained = saved.filter(name => name.endsWith('uncertain-events.json'));
  expect(retained).toHaveLength(1);
  const content = await readFile(join(api.options.workingDirectory, retained[0]!), 'utf8');
  expect(eventBatchSchema.parse(JSON.parse(content))).toEqual(api.batches[0]);
  expect(content).not.toContain('test-runner-token');
  expect(api.events).toHaveLength(0);
});

it('preserves cumulative sample IDs and baselines independently of delivery event IDs', async () => {
  const api = await center();
  api.options.adapters = [{ name: 'fixture', version: '1', async run(context) {
    const sample: RunnerEventData = { type: 'usage', source: 'fixture', scope: 'session', scopeId: 'fixture-session', model: 'deterministic', accounting: 'authoritative', costKind: 'unknown', costUsd: null, cumulative: true, sampleId: 'sample-1', baseline: { kind: 'new-session' }, inputTokens: 2, outputTokens: 3 };
    await context.emit(sample);
    const later: RunnerEventData = { ...sample, sampleId: 'sample-2', baseline: { kind: 'sample', sampleId: 'sample-1' }, inputTokens: 5, outputTokens: 8 };
    await context.emit(later);
    await context.emit(later);
  } }];
  api.start();
  await eventually(() => api.events.some(event => event.type === 'completed'));
  const samples = api.events.filter(event => event.type === 'usage');
  expect(samples.map(sample => [sample.sampleId, sample.baseline, sample.inputTokens])).toEqual([
    ['sample-1', { kind: 'new-session' }, 2], ['sample-2', { kind: 'sample', sampleId: 'sample-1' }, 5], ['sample-2', { kind: 'sample', sampleId: 'sample-1' }, 5],
  ]);
  expect(new Set(samples.map(sample => sample.id)).size).toBe(3);
});

it('bounds unacknowledged concurrent output and every serialized HTTP batch', async () => {
  const api = await center();
  api.options.adapters = [{ name: 'fixture', version: '1', async run(context) {
    const detail: RunnerEventData = { type: 'detail', title: 'Bounded evidence', content: 'x'.repeat(1_048_576), mediaType: 'text/plain' };
    const first = context.emit(detail);
    try { await context.emit(detail); } finally { await first; }
  } }];
  api.start();
  await eventually(() => api.events.some(event => event.type === 'completed'));
  expect(api.events.at(-1)).toMatchObject({ outcome: 'failed' });
  expect(api.events.filter(event => event.type === 'detail')).toHaveLength(1);
  expect(api.batches.every(batch => Buffer.byteLength(JSON.stringify(batch)) <= 2_097_152)).toBe(true);
});

it('starts from environment configuration and stops cleanly on SIGTERM', async () => {
  const api = await center({ fixture: { scenario: 'slow', delayMs: 5000 } });
  const child = spawn(process.execPath, ['--import', 'tsx', fileURLToPath(new URL('./main.ts', import.meta.url))], {
    cwd: fileURLToPath(new URL('../../../', import.meta.url)),
    env: { ...process.env, FLOW_URL: api.options.baseUrl, FLOW_RUNNER_TOKEN: api.options.token, FLOW_RUNNER_WORKDIR: api.options.workingDirectory },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stderr = '';
  child.stderr.setEncoding('utf8').on('data', text => { stderr += text; });
  const exited = new Promise<number | null>(resolve => child.on('exit', resolve));
  cleanup.push(async () => { if (child.exitCode === null) child.kill('SIGKILL'); await exited; });
  await eventually(() => api.events.some(event => event.type === 'message'));
  child.kill('SIGTERM');
  expect(await exited).toBe(0);
  expect(stderr).not.toContain('test-runner-token');
  expect(api.events.some(event => event.type === 'artifact' || event.type === 'completed')).toBe(false);
});

it('reuses a repeated decision request without emitting a second pending decision', async () => {
  const api = await center();
  api.options.adapters = [{ name: 'fixture', version: '1', async run(context) {
    const request = { id: 'same-decision', prompt: 'Continue?' };
    const answers = await Promise.all([context.waitForDecision(request), context.waitForDecision(request)]);
    if (answers.some(answer => answer !== 'approve')) throw new Error('Decision was rejected.');
  } }];
  api.start();
  await eventually(() => api.events.some(event => event.type === 'decision'));
  api.setAnswer('approve');
  await eventually(() => api.events.some(event => event.type === 'completed'));
  expect(api.events.filter(event => event.type === 'decision')).toHaveLength(1);
});


it('persists every concurrent event before sending that exact event to the center', async () => {
  const api = await center();
  let directory = '';
  const durabilityChecks: Promise<void>[] = [];
  api.options.adapters = [{ name: 'fixture', version: '1', async run(context) {
    directory = context.workingDirectory;
    const first = context.emit({ type: 'detail', title: 'First', content: 'x'.repeat(1_048_576), mediaType: 'text/plain' });
    await Promise.resolve();
    const second = context.emit({ type: 'message', text: 'Concurrent second event' });
    await Promise.all([first, second]);
  } }];
  api.onReport((batch, response) => {
    durabilityChecks.push((async () => {
      const saved = JSON.parse(await readFile(join(directory, 'pending-events.json'), 'utf8')) as EventBatch;
      response.end(JSON.stringify({ accepted: batch.events.length, lastSequence: api.events.length }));
      expect(saved).toEqual(batch);
    })());
    void durabilityChecks.at(-1)!.catch(() => undefined);
    return true;
  });
  api.start();
  await eventually(() => api.events.some(event => event.type === 'completed'));
  await Promise.all(durabilityChecks);
});

it('recovers an old durable prefix when the center already acknowledged later events', async () => {
  const api = await center();
  let directory = '';
  api.options.adapters = [{ name: 'fixture', version: '1', async run(context) {
    directory = context.workingDirectory;
    await context.emit({ type: 'message', text: 'Saved prefix' });
    await context.emit({ type: 'message', text: 'Later durable event' });
  } }];
  const running = api.start();
  await eventually(() => api.events.some(event => event.type === 'completed'));
  api.shutdown.abort();
  await running;
  const oldPrefix = { ...api.batches[0]!, events: [api.events[0]!] };
  await writeFile(join(directory, 'pending-events.json'), JSON.stringify(oldPrefix));
  const before = api.batches.length;
  const restart = new AbortController();
  const resumed = runRunner({ ...api.options, signal: restart.signal });
  cleanup.push(async () => { restart.abort(); await resumed; });
  await eventually(async () => !(await readdir(directory)).includes('pending-events.json'));
  expect(api.batches.length).toBe(before + 1);
  expect(api.batches.at(-1)).toEqual(oldPrefix);
  expect(api.events.map(event => event.sequence)).toEqual([1, 2, 3]);
});


it.each([
  { accepted: 1, lastSequence: 0 },
  { accepted: 1, lastSequence: 1.5 },
  { accepted: 2, lastSequence: 1 },
])('retains unacknowledged events when the center sends invalid confirmation %j', async acknowledgement => {
  const api = await center();
  let directory = '';
  api.options.adapters = [{ name: 'fixture', version: '1', async run(context) {
    directory = context.workingDirectory;
    await context.emit({ type: 'message', text: 'Must remain durable' });
  } }];
  api.onReport((_batch, response) => {
    response.end(JSON.stringify(acknowledgement));
    return true;
  });
  api.options.onNotice = notice => { if (notice.type === 'connection-lost') api.shutdown.abort(); };
  await api.start();
  const saved = JSON.parse(await readFile(join(directory, 'pending-events.json'), 'utf8'));
  expect(saved).toEqual(api.batches[0]);
});


it('executes an injected Claude adapter through the same runner ownership and HTTP event boundary', async () => {
  const api = await center({ harness: 'claude', verification: { kind: 'contains', expected: 'native-seam-result' } });
  api.options.adapters = [createClaudeAdapter({ materialFiles: [], query: () => Object.assign((async function* () {
    yield { type: 'result', subtype: 'success', is_error: false, session_id: 'native-seam', uuid: 'native-result-1', result: 'native-seam-result', modelUsage: {}, permission_denials: [] } as unknown as import('@anthropic-ai/claude-agent-sdk').SDKMessage;
  })(), { close() {} }) })];
  api.start();
  await eventually(() => api.events.some(event => event.type === 'completed'));
  expect(api.events).toContainEqual(expect.objectContaining({ type: 'session', nativeSessionId: 'native-seam' }));
  expect(api.events).toContainEqual(expect.objectContaining({ type: 'artifact', content: 'native-seam-result' }));
  expect(api.events).toContainEqual(expect.objectContaining({ type: 'verification', result: 'passed' }));
  expect(api.events.filter(event => event.type === 'completed')).toEqual([expect.objectContaining({ outcome: 'succeeded' })]);
});
function conditionalEvents(): RunnerEventData[] {
  const content = 'Runtime conditional final', artifactId = 'artifact-conditional';
  return [{ type: 'artifact', artifactId, title: 'Final', version: textDigest(content), content, mediaType: 'text/plain' }, verifyText(artifactId, content),
    { type: 'assistant-final', nativeSessionId: 'session-conditional', source: 'claude.sdk.result', sourceMessageId: 'result-conditional', messageId: textDigest(JSON.stringify(['session-conditional', 'result-conditional'])), content,
      settings: { requested: { model: 'synthetic', thinking: 'disabled', permissionMode: 'dontAsk' }, effective: { model: null, thinking: 'unknown', permissionMode: null, tools: null } } }];
}
it('continues heartbeats while the final event sequence is frozen and completes only after confirmation', async () => {
  const api = await center({ harness: 'claude' }); let duringProposal = false, heartbeats = 0;
  api.options.activeSteering = true; api.options.requestTimeoutMs = 1000;
  api.options.adapters = [{ name: 'claude', version: 'synthetic', async run(context) {
    await context.emit({ type: 'session', nativeSessionId: 'session-conditional', adapterVersion: 'synthetic' });
    await context.steering!.finalize({ expectedRevision: 0, nativeSessionId: 'session-conditional', resultId: 'result-conditional', events: conditionalEvents() });
  } }];
  api.onHeartbeat(() => { if (duringProposal) heartbeats++; return false; });
  api.onSteering((path, input: SteeringFinalizationInput, response) => {
    if (path !== '/api/runner/steering/finalize') return false;
    duringProposal = true;
    setTimeout(() => { api.events.push(...input.events); duringProposal = false; response.end(JSON.stringify({ state: 'committed', proposalId: input.proposalId, lastSequence: 4, replayed: false })); }, 150);
    return true;
  });
  api.start(); await eventually(() => api.events.some(event => event.type === 'completed'));
  expect(heartbeats).toBeGreaterThanOrEqual(2); expect(api.events.at(-1)).toMatchObject({ type: 'completed', sequence: 5, outcome: 'succeeded' });
});
it('retains an uncertain final across runner restart without replaying the native query or inventing completion', async () => {
  const api = await center({ harness: 'claude' }); let directory = '', nativeRuns = 0, proposal: SteeringFinalizationInput | undefined, confirmed = false;
  api.options.activeSteering = true;
  api.options.adapters = [{ name: 'claude', version: 'synthetic', async run(context) {
    nativeRuns++; directory = context.workingDirectory;
    await context.emit({ type: 'session', nativeSessionId: 'session-conditional', adapterVersion: 'synthetic' });
    await context.steering!.finalize({ expectedRevision: 0, nativeSessionId: 'session-conditional', resultId: 'result-conditional', events: conditionalEvents() });
  } }];
  api.onSteering((path, input, response) => {
    if (path.endsWith('/finalize')) { proposal = input; response.destroy(); return true; }
    if (path.endsWith('/status')) { response.end(JSON.stringify(confirmed ? { state: 'committed', proposalId: input.proposalId, lastSequence: 4, replayed: true } : { state: 'absent', proposalId: input.proposalId })); return true; }
    return false;
  });
  api.options.onNotice = notice => { if (notice.type === 'ownership-lost') api.shutdown.abort(); };
  await api.start();
  expect(JSON.parse(await readFile(join(directory, 'pending-final-proposal.json'), 'utf8'))).toEqual(proposal);
  expect(api.events.some(event => event.type === 'completed')).toBe(false);
  confirmed = true;
  const stop = new AbortController(), notices: RunnerNotice[] = [];
  const resumed = runRunner({ ...api.options, signal: stop.signal, onNotice: notice => notices.push(notice) });
  cleanup.push(async () => { stop.abort(); await resumed; });
  await eventually(async () => (await readdir(directory)).includes('confirmed-final-proposal.json'));
  expect(nativeRuns).toBe(1); expect(api.events.some(event => event.type === 'completed')).toBe(false);
  expect(notices).toContainEqual({ type: 'events-retained', attemptId: 'attempt-1' });
});
