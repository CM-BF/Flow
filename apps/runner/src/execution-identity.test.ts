import { createServer } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { eventBatchSchema, type ClaimedTask, type HarnessContext, type Ownership, type EventBatch } from '@flow/contracts';
import { runRunner, type RunnerNotice } from './runtime.js';

const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => { for (const close of cleanup.splice(0).reverse()) await close(); });
async function eventually(predicate: () => boolean) {
  const deadline = Date.now() + 3000;
  while (!predicate()) { if (Date.now() > deadline) throw Error('Expected host identity observation did not arrive.'); await new Promise(resolve => setTimeout(resolve, 5)); }
}
async function host(count: number) {
  const assignments: ClaimedTask[] = Array.from({ length: count }, (_, index) => ({
    task: { id: `center-task-${index}`, title: 'Identity only', harness: 'fixture', prompt: `Prompt with unrelated task spoof-${index}` },
    attempt: { id: `center-attempt-${index}`, runnerId: 'center-runner', ownerVersion: index + 7, leaseExpiresAt: new Date(Date.now() + 60_000).toISOString() },
  }));
  let claimed = 0, release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; }), shutdown = new AbortController();
  const contexts: HarnessContext[] = [], heartbeats: Ownership[] = [], batches: EventBatch[] = [], notices: RunnerNotice[] = [], errors: unknown[] = [];
  const stopped = new Set<string>();
  const server = createServer(async (request, response) => {
    try {
      const chunks: Buffer[] = []; for await (const chunk of request) chunks.push(chunk as Buffer);
      const body = JSON.parse(Buffer.concat(chunks).toString() || '{}'); response.setHeader('content-type', 'application/json');
      if (request.headers.authorization !== 'Bearer synthetic-identity-runner') { response.writeHead(401).end('{}'); return; }
      if (request.url === '/api/runner/claim') { const assignment = assignments[claimed++] ?? null; response.end(JSON.stringify({ assignment, remainingLeaseMs: assignment ? 60_000 : 0 })); return; }
      if (request.url === '/api/runner/heartbeat') {
        heartbeats.push(body); const stop = stopped.has(body.attemptId);
        response.end(JSON.stringify({ action: stop ? 'stop' : 'continue', remainingLeaseMs: stop ? 0 : 60_000, leaseExpiresAt: new Date(Date.now() + 60_000).toISOString(), decision: null })); return;
      }
      if (request.url === '/api/runner/events') {
        const batch = eventBatchSchema.parse(body); batches.push(batch);
        response.end(JSON.stringify({ accepted: batch.events.length, lastSequence: batch.events.at(-1)!.sequence })); return;
      }
      response.writeHead(404).end('{}');
    } catch (error) { errors.push(error); response.writeHead(500).end('{}'); }
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); if (!address || typeof address === 'string') throw Error('Missing owned HTTP port.');
  const directory = await mkdtemp(join(tmpdir(), 'flow-eng01d-identity-'));
  cleanup.push(async () => { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); await rm(directory, { recursive: true }); });
  const run = runRunner({ baseUrl: `http://127.0.0.1:${address.port}`, token: 'synthetic-identity-runner', workingDirectory: directory, signal: shutdown.signal,
    maxConcurrentAttempts: count, pollIntervalMs: 5, heartbeatIntervalMs: 25, requestTimeoutMs: 500, onNotice: notice => notices.push(notice),
    adapters: [{ name: 'fixture', version: 'identity-test', async run(context) { contexts.push(context); await held; } }] });
  void run.catch(() => undefined);
  cleanup.push(async () => { release(); shutdown.abort(); await run; });
  return { assignments, contexts, heartbeats, batches, notices, errors, stopped, release, shutdown, run };
}

it('binds immutable real identities to two simultaneous attempts without changing outbox ownership', async () => {
  const api = await host(2); await eventually(() => api.contexts.length === 2);
  for (const assignment of api.assignments) {
    const context = api.contexts.find(context => context.executionIdentity?.attemptId === assignment.attempt.id)!;
    expect(context).toBeDefined();
    expect(context.executionIdentity).toEqual({ taskId: assignment.task.id, attemptId: assignment.attempt.id, runnerId: assignment.attempt.runnerId, ownerVersion: assignment.attempt.ownerVersion });
    expect(Object.isFrozen(context.executionIdentity)).toBe(true);
    expect(Reflect.set(context.executionIdentity!, 'ownerVersion', 999)).toBe(false);
    expect(Reflect.set(context, 'executionIdentity', { taskId: 'replacement' })).toBe(false);
    expect(Reflect.deleteProperty(context, 'executionIdentity')).toBe(false);
    await context.assertOwnership();
    expect(api.heartbeats).toContainEqual({ attemptId: assignment.attempt.id, ownerVersion: assignment.attempt.ownerVersion });
  }
  expect(api.contexts[0]!.executionIdentity).not.toBe(api.contexts[1]!.executionIdentity);
  api.release(); await eventually(() => api.batches.filter(batch => batch.events.some(event => event.type === 'completed')).length === 2);
  for (const assignment of api.assignments) {
    expect(api.batches.filter(batch => batch.attemptId === assignment.attempt.id)).toEqual([expect.objectContaining({ ownerVersion: assignment.attempt.ownerVersion, events: [expect.objectContaining({ type: 'completed', outcome: 'succeeded', sequence: 1 })] })]);
  }
  expect(api.errors).toEqual([]); api.shutdown.abort(); await api.run;
});

it('keeps identity as observation only when the original ownership port reports a lost lease', async () => {
  const api = await host(1); await eventually(() => api.contexts.length === 1);
  const context = api.contexts[0]!, identity = context.executionIdentity;
  expect(identity).toMatchObject({ attemptId: api.assignments[0]!.attempt.id, ownerVersion: 7 });
  api.stopped.add(identity!.attemptId);
  await expect(context.assertOwnership()).rejects.toMatchObject({ reason: 'lost' });
  expect(context.executionIdentity).toBe(identity); expect(context.executionIdentity).toMatchObject({ ownerVersion: 7 });
  api.release(); await eventually(() => api.notices.some(notice => notice.type === 'ownership-lost'));
  api.shutdown.abort(); await api.run; expect(api.batches).toEqual([]); expect(api.errors).toEqual([]);
});
