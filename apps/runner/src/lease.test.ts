import { createServer, type ServerResponse } from 'node:http';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { afterEach, expect, it } from 'vitest';
import type { HarnessAdapter } from '@flow/contracts';
import { runRunner, type RunnerNotice, type RunnerOptions } from './runtime.js';
import { textDigest } from './verifier.js';

const cleanup: (() => Promise<unknown>)[] = [];
afterEach(async () => { for (const stop of cleanup.splice(0).reverse()) await stop(); });
interface PeerOptions { skewMs?: number; claimMs?: number; claimDelayMs?: number; heartbeatMs?: number; heartbeatDelayMs?: number; hangHeartbeat?: boolean }
async function peer(config: PeerOptions = {}) {
  const notices: RunnerNotice[] = []; const events: unknown[] = [];
  const shutdown = new AbortController();
  let claims = 0; let heartbeats = 0; let starts = 0; let claimResponded = false;
  let heartbeatStarted = 0; let interrupted = 0;
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
      respond(response, { assignment, remainingLeaseMs: first ? config.claimMs ?? 1000 : 0 }, first ? config.claimDelayMs : 0);
      if (first) response.once('finish', () => { claimResponded = true; });
      return;
    }
    if (request.url === '/api/runner/heartbeat') {
      heartbeats++; heartbeatStarted ||= performance.now();
      if (!config.hangHeartbeat) respond(response, { action: 'continue', remainingLeaseMs: config.heartbeatMs ?? 1000,
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
