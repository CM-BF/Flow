import { createServer as createHttpServer, type ServerResponse } from 'node:http';
import { mkdtemp, mkdir, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { afterEach, expect, it } from 'vitest';
import type { ClaimedTask, EventBatch, HarnessAdapter, HarnessContext } from '@flow/contracts';
import { FlowClient } from '@flow/client';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { createServer as createFlowServer } from '../../server/src/index.js';
import { commandRunnerMaintenance } from '../../server/src/runner-maintenance/store.js';
import { runRunner, type RunnerOptions, type RunnerNotice } from './runtime.js';
import { textDigest } from './verifier.js';
import { EventStorageError } from './outbox.js';

const cleanup: (() => Promise<unknown>)[] = [];
afterEach(async () => { const results = await Promise.allSettled(cleanup.splice(0).reverse().map(stop => stop())); for (const result of results) if (result.status === 'rejected') throw result.reason; });
async function eventually(condition: () => boolean | Promise<boolean>) {
  const until = Date.now() + 4000;
  while (!await condition()) { if (Date.now() > until) throw new Error('Expected bounded runner behavior did not occur.'); await sleep(5); }
}
function held(context: HarnessContext): Promise<void> {
  return new Promise(resolve => { if (context.signal.aborted) resolve(); else context.signal.addEventListener('abort', () => resolve(), { once: true }); });
}
async function peer(total = 8, capacity = 16) {
  const workingDirectory = await mkdtemp(join(tmpdir(), 'flow-runtime-pool-'));
  const batches: EventBatch[] = [], notices: RunnerNotice[] = [];
  const running = new Set<string>(), outcomes = new Map<string, string>();
  const executions: Promise<void>[] = [], shutdowns: AbortController[] = [];
  let claims = 0, assigned = 0, peak = 0;
  let claimHook: ((index: number, response: ServerResponse) => boolean) | undefined;
  let heartbeatHook: ((attemptId: string, response: ServerResponse) => boolean) | undefined;
  let reportHook: ((batch: EventBatch, response: ServerResponse) => boolean) | undefined;
  const server = createHttpServer(async (request, response) => {
    const parts: Buffer[] = []; for await (const part of request) parts.push(part as Buffer);
    const body = JSON.parse(Buffer.concat(parts).toString() || '{}'); response.setHeader('content-type', 'application/json');
    if (request.url === '/api/runner/claim') {
      claims++; if (claimHook?.(claims, response)) return;
      let assignment: ClaimedTask | null = null;
      if (assigned < total && running.size < capacity) {
        assigned++; const id = `attempt-${assigned}`; running.add(id); peak = Math.max(peak, running.size);
        assignment = { attempt: { id, runnerId: 'runner-test', ownerVersion: 1, leaseExpiresAt: new Date(Date.now() + 10000).toISOString() },
          task: { id: `task-${assigned}`, title: 'Deterministic no-model attempt', prompt: String(assigned), harness: 'fixture' } };
      }
      response.end(JSON.stringify({ assignment, remainingLeaseMs: assignment ? 10000 : 0 })); return;
    }
    if (request.url === '/api/runner/heartbeat') {
      if (heartbeatHook?.(body.attemptId, response)) return;
      response.end(JSON.stringify({ action: 'continue', remainingLeaseMs: 10000, decision: null })); return;
    }
    if (request.url === '/api/runner/events') {
      const batch = body as EventBatch; batches.push(batch);
      if (reportHook?.(batch, response)) return;
      for (const event of batch.events) if (event.type === 'completed') { running.delete(batch.attemptId); outcomes.set(batch.attemptId, event.outcome); }
      response.end(JSON.stringify({ accepted: batch.events.length, lastSequence: batch.events.at(-1)!.sequence })); return;
    }
    response.writeHead(404).end('{}');
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('Missing bound port.');
  const baseUrl = `http://127.0.0.1:${address.port}`;
  cleanup.push(async () => { for (const shutdown of shutdowns) shutdown.abort(); await Promise.allSettled(executions); server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); await rm(workingDirectory, { recursive: true, force: true }); });
  return {
    batches, notices, outcomes, workingDirectory, baseUrl, running,
    get claims() { return claims; }, get assigned() { return assigned; }, get peak() { return peak; },
    claim(hook: typeof claimHook) { claimHook = hook; }, heartbeat(hook: typeof heartbeatHook) { heartbeatHook = hook; }, report(hook: typeof reportHook) { reportHook = hook; },
    start(adapter: HarnessAdapter, extra: Partial<RunnerOptions> = {}) {
      const shutdown = new AbortController(); shutdowns.push(shutdown);
      const promise = runRunner({ baseUrl, token: 'test-token', workingDirectory, signal: shutdown.signal, adapters: [adapter], pollIntervalMs: 5,
        heartbeatIntervalMs: 25, requestTimeoutMs: 100, onNotice: notice => notices.push(notice), ...extra });
      executions.push(promise); void promise.catch(() => undefined); return { shutdown, promise };
    },
  };
}
function adapter(run: HarnessAdapter['run']): HarnessAdapter { return { name: 'fixture', version: '1', run }; }

it('defaults to one slot and explicitly overlaps four attempts without exceeding the local limit', async () => {
  const serial = await peer(); const release = Promise.withResolvers<void>(); let active = 0, peak = 0;
  const run = async (context: HarnessContext) => { active++; peak = Math.max(peak, active); try { await Promise.race([release.promise, held(context)]); } finally { active--; } };
  const first = serial.start(adapter(run)); await eventually(() => active === 1); await sleep(50); expect(serial.assigned).toBe(1); first.shutdown.abort(); await first.promise;
  const parallel = await peer(); const second = parallel.start(adapter(run), { maxConcurrentAttempts: 4 });
  await eventually(() => active === 4); await sleep(50); expect(parallel.assigned).toBe(4); expect(peak).toBe(4);
  second.shutdown.abort(); await second.promise; expect(active).toBe(0);
});

it('honors a lower center capacity and isolates one adapter failure from other slots', async () => {
  const api = await peer(4, 2); const release = Promise.withResolvers<void>(); let started = 0, survivors = 0;
  api.start(adapter(async context => { started++; if (context.task.prompt === '1') throw new Error('Only this adapter failed.'); survivors++; try { await Promise.race([release.promise, held(context)]); } finally { survivors--; } }), { maxConcurrentAttempts: 4 });
  try { await eventually(() => api.outcomes.get('attempt-1') === 'failed' && survivors === 2); } catch (error) { throw new Error(JSON.stringify({ assigned: api.assigned, claims: api.claims, outcomes: [...api.outcomes], survivors, notices: api.notices }), { cause: error }); }
  expect(started).toBe(3); expect(api.peak).toBe(2); release.resolve(); await eventually(() => api.outcomes.size === 4);
});

it('cancels only the requested slot while the other attempt continues', async () => {
  const api = await peer(2); let entered = 0;
  api.heartbeat((id, response) => { if (entered === 2 && id === 'attempt-1') { response.end(JSON.stringify({ action: 'cancel' })); return true; } return false; });
  const running = api.start(adapter(async context => { entered++; await held(context); context.signal.throwIfAborted(); }), { maxConcurrentAttempts: 2 });
  await eventually(() => api.outcomes.get('attempt-1') === 'cancelled'); expect(api.outcomes.has('attempt-2')).toBe(false);
  running.shutdown.abort(); await running.promise;
});

it('awaits every started adapter on host abort and on swallowed heartbeat authentication rejection', async () => {
  for (const auth of [false, true]) {
    const api = await peer(4); let entered = 0, settled = 0;
    api.heartbeat((_id, response) => { if (auth && entered === 4) { response.writeHead(403).end(JSON.stringify({ error: { code: 'revoked', message: 'Runner revoked.' } })); return true; } return false; });
    const running = api.start(adapter(async context => { entered++; try { await held(context); } finally { await sleep(20); settled++; } }), { maxConcurrentAttempts: 4 });
    await eventually(() => entered === 4);
    if (auth) await expect(running.promise).rejects.toMatchObject({ status: 403, code: 'revoked' });
    else { running.shutdown.abort(); await running.promise; }
    expect(settled).toBe(4); expect(api.assigned).toBe(4);
  }
});

it('stops every slot on event storage failure even if the adapter catches the rejected emit', async () => {
  const api = await peer(2); let entered = 0, settled = 0;
  const running = api.start(adapter(async context => {
    entered++; await eventually(() => entered === 2);
    try {
      if (context.task.prompt === '1') { await mkdir(join(context.workingDirectory, 'pending-events.json.tmp')); await context.emit({ type: 'message', text: 'storage guard' }).catch(() => undefined); }
      await held(context);
    } finally { settled++; }
  }), { maxConcurrentAttempts: 2 });
  await expect(running.promise).rejects.toBeInstanceOf(EventStorageError); expect(settled).toBe(2);
});

it('persists an unknown claim, lets a known slot finish, and refuses another claim after restart', async () => {
  const api = await peer(); const release = Promise.withResolvers<void>(); let entered = 0;
  api.claim((index, response) => { if (index === 2) { response.destroy(); return true; } return false; });
  const first = api.start(adapter(async context => { entered++; await Promise.race([release.promise, held(context)]); }), { maxConcurrentAttempts: 4 });
  await eventually(() => api.claims === 2); release.resolve(); await eventually(() => api.outcomes.size === 1);
  await sleep(50); expect(api.claims).toBe(2); first.shutdown.abort(); await first.promise;
  const restarted = api.start(adapter(async () => { entered++; })); await sleep(80);
  expect(api.claims).toBe(2); expect(entered).toBe(1); restarted.shutdown.abort(); await restarted.promise;
});

it('does not send a claim when its durable intent cannot be saved', async () => {
  const api = await peer(); const directory = join(api.workingDirectory, textDigest(api.baseUrl));
  await mkdir(join(directory, 'admission.json.tmp'), { recursive: true });
  await expect(api.start(adapter(async () => undefined)).promise).rejects.toBeInstanceOf(EventStorageError); expect(api.claims).toBe(0);
});

it('never replays an active outbox while another slot is being admitted', async () => {
  const api = await peer(2); const reported = Promise.withResolvers<void>(); let firstResponse: ServerResponse | undefined;
  api.report((batch, response) => { if (batch.attemptId === 'attempt-1' && batch.events[0]?.type === 'message') { firstResponse = response; reported.resolve(); return true; } return false; });
  const running = api.start(adapter(async context => { if (context.task.prompt === '1') await context.emit({ type: 'message', text: 'held ACK' }); await held(context); }), { maxConcurrentAttempts: 2, requestTimeoutMs: 1000 });
  await reported.promise; await eventually(() => api.assigned === 2); await sleep(50);
  expect(api.batches.filter(batch => batch.attemptId === 'attempt-1')).toHaveLength(1);
  firstResponse!.end(JSON.stringify({ accepted: 1, lastSequence: 1 })); running.shutdown.abort(); await running.promise;
});

it.each([0, 17, 1.5, NaN])('rejects an invalid local slot limit %s before admission', async limit => {
  const api = await peer(); await expect(api.start(adapter(async () => undefined), { maxConcurrentAttempts: limit }).promise).rejects.toThrow('one through sixteen'); expect(api.claims).toBe(0);
});

async function realCenter(capacity: number) {
  const name = `flow_s01p01_${randomUUID().replaceAll('-', '')}`;
  const adminUrl = 'postgresql://flow:flow-local-only@127.0.0.1:55432/postgres';
  const database = new URL(adminUrl); database.pathname = `/${name}`;
  const admin = new Pool({ connectionString: adminUrl, max: 1 });
  const pool = new Pool({ connectionString: database.href, max: 2, statement_timeout: 5000 });
  let created = false, app: Awaited<ReturnType<typeof createFlowServer>> | undefined;
  const workingDirectory = await mkdtemp(join(tmpdir(), 'flow-real-pool-'));
  const processes: { shutdown: AbortController; promise: Promise<void> }[] = [];
  cleanup.push(async () => {
    for (const process of processes) process.shutdown.abort();
    await Promise.allSettled(processes.map(process => process.promise));
    try { await app?.close(); }
    finally {
      try { await pool.end(); }
      finally {
        try {
          if (created) {
            await eventually(async () => (await admin.query('SELECT 1 FROM pg_stat_activity WHERE datname=$1', [name])).rowCount === 0);
            await admin.query(`DROP DATABASE ${name}`);
            const remaining = (await admin.query('SELECT datname FROM pg_database WHERE datname=$1', [name])).rows;
            console.log(JSON.stringify({ cleanup: 's01p01-own-database', name, remaining })); expect(remaining).toEqual([]);
          }
        } finally { await admin.end(); await rm(workingDirectory, { recursive: true, force: true }); }
      }
    }
  });
  if ((await admin.query('SELECT 1 FROM pg_database WHERE datname=$1', [name])).rowCount) throw new Error('Refusing existing test database.');
  await admin.query(`CREATE DATABASE ${name}`); created = true;
  app = await createFlowServer({ databaseUrl: database.href, ownerToken: 'test-owner', leaseMs: 300000, automaticQueueScan: false });
  const baseUrl = await app.listen({ host: '127.0.0.1', port: 0 });
  const owner = new FlowClient({ baseUrl, token: 'test-owner' });
  const identity = await owner.registerRunner({ name: 'bounded functional runner', harnesses: ['fixture'], capacity });
  const runner = new FlowClient({ baseUrl, token: identity.token });
  return {
    owner, runner, pool, identity,
    async submit(prompt: string, resumeSessionId?: string) {
      const result = await owner.submit({ title: prompt, prompt, harness: 'fixture', ...(resumeSessionId ? { resumeSessionId } : {}) }, randomUUID());
      await pool.query('UPDATE flow.tasks SET dispatch_ready=true WHERE id=$1', [result.task.id]);
      return result.task.id;
    },
    start(implementation: HarnessAdapter, maxConcurrentAttempts = 4) {
      const shutdown = new AbortController();
      const promise = runRunner({ baseUrl, token: identity.token, workingDirectory, signal: shutdown.signal, adapters: [implementation], maxConcurrentAttempts,
        pollIntervalMs: 10, heartbeatIntervalMs: 40, requestTimeoutMs: 1500 });
      void promise.catch(() => undefined); const process = { shutdown, promise }; processes.push(process); return process;
    },
  };
}

it.each([1, 4])('real PG/HTTP enforces registered capacity %s with a local four-slot pool', async capacity => {
  const api = await realCenter(capacity); const ids: string[] = [];
  for (let i = 0; i < capacity + 1; i++) ids.push(await api.submit(`capacity-${i}`));
  let active = 0, peak = 0; const release = Promise.withResolvers<void>();
  const execution = api.start(adapter(async context => {
    active++; peak = Math.max(peak, active);
    try { await Promise.race([release.promise, held(context)]); context.signal.throwIfAborted(); await context.assertOwnership(); }
    finally { active--; }
  }));
  await eventually(() => active === capacity); await sleep(75);
  expect((await api.pool.query('SELECT count(*)::int AS n FROM flow.attempts WHERE completed_at IS NULL')).rows[0].n).toBe(capacity);
  expect((await api.pool.query("SELECT count(*)::int AS n FROM flow.tasks WHERE status='queued'")).rows[0].n).toBe(1);
  release.resolve(); await eventually(async () => (await api.pool.query("SELECT count(*)::int AS n FROM flow.tasks WHERE status='succeeded'")).rows[0].n === ids.length);
  execution.shutdown.abort(); await execution.promise; expect(peak).toBe(capacity); expect(active).toBe(0);
});

it('real PG/HTTP preserves native-session exclusion across overlapping local slots', async () => {
  const api = await realCenter(4); const session = randomUUID(); await api.submit('seed');
  const seed = (await api.runner.claim()).assignment!;
  await api.runner.report({ attemptId: seed.attempt.id, ownerVersion: seed.attempt.ownerVersion, events: [
    { id: randomUUID(), sequence: 1, type: 'session', nativeSessionId: session, adapterVersion: 'test-1' },
    { id: randomUUID(), sequence: 2, type: 'completed', outcome: 'succeeded' },
  ] });
  await api.submit('same-session-a', session); await api.submit('same-session-b', session);
  let active = 0, peak = 0, entered = 0; const release = Promise.withResolvers<void>();
  const execution = api.start(adapter(async context => {
    expect(context.task.resumeSessionId).toBe(session); entered++; active++; peak = Math.max(peak, active);
    try { await Promise.race([release.promise, held(context)]); context.signal.throwIfAborted(); }
    finally { active--; }
  }));
  await eventually(() => active === 1); await sleep(100); expect(entered).toBe(1);
  expect((await api.pool.query('SELECT count(*)::int AS n FROM flow.attempts WHERE completed_at IS NULL')).rows[0].n).toBe(1);
  release.resolve(); await eventually(async () => (await api.pool.query("SELECT count(*)::int AS n FROM flow.tasks WHERE status='succeeded'")).rows[0].n === 3);
  execution.shutdown.abort(); await execution.promise; expect(entered).toBe(2); expect(peak).toBe(1);
});

it('real PG/HTTP keeps draining and uncertain occupancy authoritative while other slots settle', async () => {
  const api = await realCenter(2); const first = await api.submit('expires'); const second = await api.submit('finishes'); const queued = await api.submit('retained queued');
  let entered = 0; const finish = Promise.withResolvers<void>();
  const execution = api.start(adapter(async context => {
    entered++; if (context.task.prompt === 'expires') await held(context);
    else await Promise.race([finish.promise, held(context)]);
    context.signal.throwIfAborted();
  }));
  await eventually(() => entered === 2);
  const command = { version: 0, operationId: randomUUID(), reason: 'Owned functional drain boundary' };
  await api.owner.drainRunner(api.identity.runnerId, command, randomUUID());
  await api.pool.query("UPDATE flow.attempts SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE task_id=$1", [first]);
  await eventually(async () => (await api.owner.show(first)).status === 'uncertain');
  finish.resolve(); await eventually(async () => (await api.owner.show(second)).status === 'succeeded');
  const state = await api.owner.runnerMaintenance(api.identity.runnerId);
  expect(state).toMatchObject({ state: 'draining', activeAttempts: 1, uncertainAttempts: 1, stopPermitted: false });
  await expect(commandRunnerMaintenance(api.pool, api.identity.runnerId, 'hold', { ...command, version: state.version }, randomUUID(), 'trusted-host')).rejects.toMatchObject({ code: 'maintenance_busy' });
  expect((await api.owner.show(queued)).status).toBe('queued'); expect((await api.runner.claim()).assignment).toBeNull();
  execution.shutdown.abort(); await execution.promise;
  let restarted = 0; const retry = api.start(adapter(async () => { restarted++; })); await sleep(80); retry.shutdown.abort(); await retry.promise;
  expect(restarted).toBe(0); expect((await api.owner.runnerMaintenance(api.identity.runnerId)).activeAttempts).toBe(1);
});
