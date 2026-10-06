import { createServer, type ServerResponse } from 'node:http';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { afterEach, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
import { createServer as createFlowServer } from '../../server/src/index.js';
import { EventStorageError } from './outbox.js';
import type { HarnessAdapter } from '@flow/contracts';
import { runRunner, type RunnerNotice, type RunnerOptions } from './runtime.js';
import { textDigest } from './verifier.js';

const cleanup: (() => Promise<unknown>)[] = [];
afterEach(async () => { try { for (const stop of cleanup.splice(0).reverse()) await stop(); } finally { vi.restoreAllMocks(); } });
interface PeerOptions { skewMs?: number; claimMs?: number; claimDelayMs?: number; heartbeatMs?: number; heartbeatDelayMs?: number; hangHeartbeat?: boolean }
async function peer(config: PeerOptions = {}) {
  const notices: RunnerNotice[] = []; const events: unknown[] = [];
  const shutdown = new AbortController();
  let claims = 0; let heartbeats = 0; let starts = 0; let claimResponded = false;
  let heartbeatStarted = 0; let interrupted = 0;
  let claimGrant: unknown = config.claimMs ?? 1000; let heartbeatGrant: unknown = config.heartbeatMs ?? 1000;
  const timeouts = new Set<ReturnType<typeof setTimeout>>();
  function respond(response: ServerResponse, body: unknown, delay = 0) {
    const timer = setTimeout(() => { timeouts.delete(timer); response.end(JSON.stringify(body)); }, delay); timeouts.add(timer);
  }
  const server = createServer(async (request, response) => {
    const parts: Buffer[] = []; for await (const part of request) parts.push(part as Buffer);
    const body = JSON.parse(Buffer.concat(parts).toString() || '{}');
    response.setHeader('content-type', 'application/json');
    if (request.url === '/api/runner/claim') {
      const first = claims++ === 0;
      const assignment = first ? { attempt: { id: 'lease-attempt', runnerId: 'lease-runner', ownerVersion: 1, leaseExpiresAt: new Date(Date.now() + (config.skewMs ?? 0) + (config.claimMs ?? 1000)).toISOString() },
        task: { id: 'lease-task', title: 'Lease test', prompt: 'No models', harness: 'fixture', fixture: { scenario: 'success', delayMs: 0 } } } : null;
      respond(response, { assignment, remainingLeaseMs: first ? claimGrant : 0 }, first ? config.claimDelayMs : 0);
      if (first) response.once('finish', () => { claimResponded = true; });
      return;
    }
    if (request.url === '/api/runner/heartbeat') {
      heartbeats++; heartbeatStarted ||= performance.now();
      if (!config.hangHeartbeat) respond(response, { action: 'continue', remainingLeaseMs: heartbeatGrant,
        leaseExpiresAt: new Date(Date.now() + (config.skewMs ?? 0) + (config.heartbeatMs ?? 1000)).toISOString(), decision: null }, config.heartbeatDelayMs);
      return;
    }
    if (request.url === '/api/runner/events') {
      events.push(...body.events); respond(response, { accepted: body.events.length, lastSequence: body.events.at(-1).sequence }); return;
    }
    response.writeHead(404).end('{}');
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); if (!address || typeof address === 'string') throw Error('No HTTP port');
  const workingDirectory = await mkdtemp(join(tmpdir(), 'flow-r03-'));
  cleanup.push(() => rm(workingDirectory, { recursive: true, force: true }));
  cleanup.push(async () => { for (const timer of timeouts) clearTimeout(timer); server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); });
  const options: RunnerOptions = { baseUrl: `http://127.0.0.1:${address.port}`, token: 'r03-test-token', workingDirectory, signal: shutdown.signal,
    pollIntervalMs: 10, heartbeatIntervalMs: 1000, requestTimeoutMs: 1000,
    onNotice(notice) { notices.push(notice); if (notice.type === 'ownership-lost') interrupted = performance.now(); },
    adapters: [{ name: 'fixture', version: '1', async run() { starts++; } }],
  };
  return { options, notices, events, shutdown,
    setClaimGrant(value: unknown) { claimGrant = value; },
    setHeartbeatGrant(value: unknown) { heartbeatGrant = value; },
    get claims() { return claims; }, get heartbeats() { return heartbeats; }, get starts() { return starts; },
    get claimResponded() { return claimResponded; }, get heartbeatStarted() { return heartbeatStarted; }, get interrupted() { return interrupted; },
    start(adapter?: HarnessAdapter) {
      if (adapter) options.adapters = [adapter];
      const running = runRunner(options); void running.catch(() => undefined);
      cleanup.push(async () => { shutdown.abort(); await running.catch(() => undefined); }); return running;
    },
  };
}

it.each([-300_000, 300_000])('runs a valid grant despite center wall-clock skew of %i ms', async skewMs => {
  const api = await peer({ skewMs }); api.start();
  await expect.poll(() => api.starts, { timeout: 500, interval: 10 }).toBe(1);
  await expect.poll(() => api.events.length, { timeout: 500, interval: 10 }).toBe(1);
  expect(api.notices.some(notice => notice.type === 'ownership-lost')).toBe(false);
});

it('counts delayed claim delivery against the initial lease before any heartbeat or adapter execution', async () => {
  const api = await peer({ skewMs: 300_000, claimMs: 40, claimDelayMs: 120 }); api.start();
  await expect.poll(() => api.claimResponded, { timeout: 500, interval: 10 }).toBe(true);
  await sleep(40);
  expect(api.starts).toBe(0); expect(api.heartbeats).toBe(0);
  expect(api.notices.filter(notice => notice.type === 'ownership-lost')).toHaveLength(1);
});

it('expires a hanging heartbeat by the relative initial grant with a fast center wall clock', async () => {
  const api = await peer({ skewMs: 300_000, claimMs: 80, hangHeartbeat: true }); api.start();
  await expect.poll(() => api.notices.some(notice => notice.type === 'ownership-lost'), { timeout: 350, interval: 10 }).toBe(true);
  expect(api.starts).toBe(0); expect(api.heartbeats).toBe(1);
});

function ignoreHeartbeatAbort() {
  const realFetch = globalThis.fetch;
  vi.spyOn(globalThis, 'fetch').mockImplementation((url, init) => realFetch(url, String(url).endsWith('/api/runner/heartbeat') ? { ...init, signal: undefined } : init));
}
it('never revives an expired local lease when a delayed continue response ignores request cancellation', async () => {
  ignoreHeartbeatAbort();
  const api = await peer({ skewMs: 300_000, claimMs: 70, heartbeatMs: 1000, heartbeatDelayMs: 170 }); api.start();
  await expect.poll(() => api.notices.some(notice => notice.type === 'ownership-lost'), { timeout: 300, interval: 10 }).toBe(true);
  await sleep(200);
  expect(api.starts).toBe(0); expect(api.heartbeats).toBe(1); expect(api.events).toEqual([]);
  expect(api.notices.filter(notice => notice.type === 'ownership-lost')).toHaveLength(1);
});
it('deducts heartbeat round trip from the renewed grant instead of granting a new duration on receipt', async () => {
  const api = await peer({ skewMs: 300_000, claimMs: 1000, heartbeatMs: 90, heartbeatDelayMs: 60 });
  let started = 0;
  api.start({ name: 'fixture', version: '1', async run(context) {
    started++;
    await new Promise<void>(resolve => context.signal.addEventListener('abort', () => resolve(), { once: true }));
  } });
  await expect.poll(() => api.interrupted > 0, { timeout: 300, interval: 10 }).toBe(true);
  expect(started).toBe(1); expect(api.interrupted - api.heartbeatStarted).toBeLessThan(135);
  expect(api.events).toEqual([]);
});
it('checks the monotonic deadline synchronously even when a busy event loop has delayed the expiry timer', async () => {
  const api = await peer({ skewMs: 300_000, claimMs: 1000, heartbeatMs: 50 });
  const realFetch = globalThis.fetch; let attemptedHeartbeats = 0;
  vi.spyOn(globalThis, 'fetch').mockImplementation((url, init) => { if (String(url).endsWith('/api/runner/heartbeat')) attemptedHeartbeats++; return realFetch(url, init); });
  let rejected = false;
  api.start({ name: 'fixture', version: '1', async run(context) {
    const end = performance.now() + 100; while (performance.now() < end) { /* Inject one event-loop stall. */ }
    try { await context.assertOwnership(); } catch { rejected = true; }
  } });
  await expect.poll(() => rejected, { timeout: 400, interval: 10 }).toBe(true);
  expect(attemptedHeartbeats).toBe(1); expect(api.events).toEqual([]);
});
it('keeps shutdown final when an in-flight heartbeat returns after controller closure', async () => {
  ignoreHeartbeatAbort();
  const api = await peer({ heartbeatDelayMs: 150 }); const running = api.start();
  await expect.poll(() => api.heartbeats, { timeout: 300, interval: 10 }).toBe(1);
  api.shutdown.abort(); await running; await sleep(60);
  expect(api.starts).toBe(0); expect(api.events).toEqual([]); expect(api.heartbeats).toBe(1);
});
it.each([undefined, null, 0, -1, 1.5, 300_001])('fails closed for invalid or missing claim duration %s', async grant => {
  const api = await peer(); api.setClaimGrant(grant); api.start();
  await expect.poll(() => api.notices.some(notice => notice.type === 'ownership-lost'), { timeout: 300, interval: 10 }).toBe(true);
  expect(api.starts).toBe(0); expect(api.heartbeats).toBe(0);
});
it.each([undefined, null, 0, -1, 1.5, 300_001])('fails closed for invalid or missing heartbeat duration %s', async grant => {
  const api = await peer(); api.setHeartbeatGrant(grant); api.start();
  await expect.poll(() => api.notices.some(notice => notice.type === 'ownership-lost'), { timeout: 300, interval: 10 }).toBe(true);
  expect(api.starts).toBe(0); expect(api.heartbeats).toBe(1);
});

it('stops rather than retrying claim after an attempt directory cannot be prepared', async () => {
  const api = await peer();
  const root = join(api.options.workingDirectory, textDigest(api.options.baseUrl));
  await mkdir(root); await writeFile(join(root, textDigest('lease-attempt')), 'This file prevents an attempt directory');
  const running = api.start();
  await expect(Promise.race([running, sleep(350).then(() => { throw new Error('Runner did not stop on local storage failure.'); })])).rejects.toBeInstanceOf(EventStorageError);
  const claims = api.claims; await sleep(60);
  expect(api.claims).toBe(claims); expect(api.heartbeats).toBe(0); expect(api.starts).toBe(0);
});
it('closes heartbeat timers on event storage failure before any report is sent', async () => {
  const api = await peer(); api.options.heartbeatIntervalMs = 20;
  const running = api.start({ name: 'fixture', version: '1', async run(context) {
    await mkdir(join(context.workingDirectory, 'pending-events.json.tmp'));
    await context.emit({ type: 'message', text: 'The disk write must fail before transport' });
  } });
  await expect(running).rejects.toBeInstanceOf(EventStorageError);
  const heartbeats = api.heartbeats; await sleep(80);
  expect(api.heartbeats).toBe(heartbeats); expect(api.events).toEqual([]);
});

it('publishes grant durations from a real center and refuses expired ownership rather than renewing it', async () => {
  const admin = new Pool({ connectionString: 'postgresql://flow:flow-local-only@127.0.0.1:55432/postgres', max: 1 });
  const lock = await admin.connect(); let created = false; let server: Awaited<ReturnType<typeof createFlowServer>> | undefined;
  try {
    expect((await lock.query("SELECT pg_try_advisory_lock(hashtextextended('flow_r03_exclusive',0)) AS locked")).rows[0].locked).toBe(true);
    if ((await lock.query("SELECT 1 FROM pg_database WHERE datname='flow_r03'")).rowCount) throw Error('Existing flow_r03 must be preserved.');
    await lock.query('CREATE DATABASE flow_r03'); created = true;
    server = await createFlowServer({ databaseUrl: 'postgresql://flow:flow-local-only@127.0.0.1:55432/flow_r03', ownerToken: 'r03-owner', leaseMs: 120 });
    const base = await server.listen({ host: '127.0.0.1', port: 0 });
    async function request(path: string, token: string, body?: unknown) {
      const response = await fetch(`${base}${path}`, { method: body === undefined ? 'GET' : 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', 'idempotency-key': path }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(5000) });
      expect(response.ok).toBe(true); return response.json();
    }
    const runner = await request('/api/runners', 'r03-owner', { name: 'Real lease peer', harnesses: ['fixture'], capacity: 1 });
    expect(await request('/api/runner/claim', runner.token, {})).toEqual({ assignment: null, remainingLeaseMs: 0 });
    const task = await request('/api/tasks', 'r03-owner', { title: 'Lease authority', prompt: 'No model executes', harness: 'fixture' });
    let claimed: { assignment?: { attempt: { id: string; ownerVersion: number } }; remainingLeaseMs: number };
    await expect.poll(async () => { claimed = await request('/api/runner/claim', runner.token, {}); return Boolean(claimed.assignment); }, { interval: 20, timeout: 2000 }).toBe(true);
    expect(claimed!.remainingLeaseMs).toBe(120);
    const ownership = { attemptId: claimed!.assignment!.attempt.id, ownerVersion: claimed!.assignment!.attempt.ownerVersion };
    expect(await request('/api/runner/heartbeat', runner.token, ownership)).toMatchObject({ action: 'continue', remainingLeaseMs: 120 });
    await sleep(180);
    expect(await request('/api/runner/heartbeat', runner.token, ownership)).toMatchObject({ action: 'stop', remainingLeaseMs: 0 });
    expect((await request(`/api/tasks/${task.task.id}`, 'r03-owner')).status).toBe('uncertain');
    expect(await request('/api/runner/claim', runner.token, {})).toEqual({ assignment: null, remainingLeaseMs: 0 });
  } finally {
    try { await server?.close(); } finally {
      try { if (created) await lock.query('DROP DATABASE flow_r03'); } finally { lock.release(); await admin.end(); }
    }
  }
});
