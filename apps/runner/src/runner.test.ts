import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { afterEach, expect, it } from 'vitest';
import { eventBatchSchema, type ClaimedTask, type EventBatch, type RunnerEvent, type RunnerEventData, type TaskSubmission } from '@flow/contracts';
import { runRunner, type RunnerOptions, type RunnerNotice } from './index.js';

const cleanup: (() => Promise<unknown>)[] = [];
afterEach(async () => { for (const stop of cleanup.splice(0).reverse()) await stop(); });

async function center(task: Partial<TaskSubmission> = {}) {
  const events: RunnerEvent[] = [];
  const batches: EventBatch[] = [];
  const shutdown = new AbortController();
  let claimed = false;
  let action: 'continue' | 'cancel' | 'stop' = 'continue';
  let answer: 'approve' | 'reject' | null = null;
  let reportHook: ((batch: EventBatch, response: ServerResponse) => boolean) | undefined;
  let beforeReport: typeof reportHook;
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
      response.end(JSON.stringify({ assignment: claimed ? null : assignment })); claimed = true; return;
    }
    if (request.url === '/api/runner/heartbeat') {
      if (heartbeatHook?.(response)) return;
      const decision = events.findLast(event => event.type === 'decision');
      response.end(JSON.stringify({ action, leaseExpiresAt: new Date(Date.now() + 10_000).toISOString(), decision: answer && decision?.type === 'decision' ? { decisionId: decision.decisionId, answer } : null })); return;
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
    start() { const running = runRunner(options); void running.catch(() => undefined); cleanup.push(async () => { shutdown.abort(); await running; }); return running; },
    setAction(next: typeof action) { action = next; },
    setAnswer(next: typeof answer) { answer = next; },
    onReport(hook: typeof reportHook) { reportHook = hook; },
    beforeReport(hook: typeof reportHook) { beforeReport = hook; },
    onHeartbeat(hook: typeof heartbeatHook) { heartbeatHook = hook; },
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
  api.assignment.attempt.leaseExpiresAt = new Date(Date.now() + 100).toISOString();
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
