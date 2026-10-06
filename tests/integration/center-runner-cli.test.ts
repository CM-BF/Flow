import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { createServer as createProxy, request as proxyRequest } from 'node:http';
import type { AddressInfo } from 'node:net';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { FlowClient } from '../../packages/client/src/index.js';
import { createServer } from '../../apps/server/src/index.js';

const databaseUrl = 'postgresql://flow:flow-local-only@127.0.0.1:55432/flow_i01';
const ownerToken = 'i01-isolated-owner';
let server: Awaited<ReturnType<typeof createServer>>;
let client: FlowClient;
let baseUrl: string;
let temporaryDirectory: string;
let runners: ChildProcess[] = [];

beforeEach(async () => {
  const pool = new Pool({ connectionString: databaseUrl });
  await pool.query('DROP SCHEMA IF EXISTS flow CASCADE; DROP SCHEMA IF EXISTS pgboss CASCADE;');
  await pool.end();
  temporaryDirectory = await mkdtemp(join(tmpdir(), 'flow-i01-'));
  server = await createServer({ databaseUrl, ownerToken, leaseMs: 2500 });
  baseUrl = await server.listen({ host: '127.0.0.1', port: 0 });
  client = new FlowClient({ baseUrl, token: ownerToken });
});

afterEach(async () => {
  await Promise.all(runners.map(stopRunner));
  runners = [];
  await server?.close();
  await rm(temporaryDirectory, { recursive: true, force: true });
});

async function stopRunner(process: ChildProcess) {
  if (process.exitCode !== null || process.signalCode !== null) return;
  const exited = once(process, 'exit');
  process.kill('SIGTERM');
  await exited;
}

async function startRunner(name: string) {
  const registration = await client.registerRunner({ name, harnesses: ['fixture'], capacity: 1 });
  const process = spawn(globalThis.process.execPath, ['--import', 'tsx', 'apps/runner/src/main.ts'], {
    cwd: globalThis.process.cwd(), stdio: ['ignore', 'ignore', 'pipe'],
    env: { ...globalThis.process.env, FLOW_URL: baseUrl, FLOW_RUNNER_TOKEN: registration.token, FLOW_RUNNER_WORKDIR: join(temporaryDirectory, name) },
  });
  runners.push(process);
  return { process, runnerId: registration.runnerId };
}

async function cli(args: string[]) {
  const process = spawn(globalThis.process.execPath, ['--import', 'tsx', 'apps/cli/src/main.ts', ...args], {
    cwd: globalThis.process.cwd(), stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...globalThis.process.env, FLOW_URL: baseUrl, FLOW_TOKEN: ownerToken },
  });
  let stdout = ''; let stderr = '';
  process.stdout.on('data', chunk => { stdout += chunk; });
  process.stderr.on('data', chunk => { stderr += chunk; });
  const [code] = await once(process, 'exit');
  return { code, stdout, stderr };
}

async function submit(scenario: 'success' | 'decision' | 'slow' | 'large' | 'verification-failure', delayMs = 10) {
  return (await client.submit({ title: `I01 ${scenario}`, prompt: 'Independent integration fixture', harness: 'fixture', fixture: { scenario, delayMs } }, randomUUID())).task.id;
}

it('recovers accepted work after center restart, answers through CLI and keeps one attempt across two runner processes', async () => {
  const input = { title: 'Durable decision', prompt: 'Continue after disconnect', harness: 'fixture' as const, fixture: { scenario: 'decision' as const, delayMs: 10 } };
  const accepted = await client.submit(input, 'lost-response');
  const port = Number(new URL(baseUrl).port);
  await server.close();
  server = await createServer({ databaseUrl, ownerToken, leaseMs: 2500 });
  await server.listen({ host: '127.0.0.1', port });
  const retry = await client.submit(input, 'lost-response');
  expect(retry.task.id).toBe(accepted.task.id);
  expect(retry.replayed).toBe(true);
  const a = await startRunner('a'); const b = await startRunner('b');
  const id = accepted.task.id;
  await expect.poll(async () => (await client.show(id)).status).toBe('waiting');
  const waiting = await client.show(id);
  expect([a.runnerId, b.runnerId]).toContain(waiting.attempt?.runnerId);
  const answer = await cli(['decision', id, 'approve', '--decision', waiting.pendingDecision!.id, '--key', 'approval', '--json']);
  expect(answer.code).toBe(0);
  const watched = await cli(['watch', id, '--timeout', '6000', '--json']);
  expect(watched.code).toBe(0);
  const delivered = await client.show(id);
  expect(delivered.attempt?.id).toBe(waiting.attempt?.id);
  expect(delivered.verificationStatus).toBe('passed');
  const details = await Promise.all(delivered.entries.filter(entry => entry.kind === 'reference').map(entry => client.detail(entry.reference.id)));
  expect(details.filter(detail => detail.kind === 'artifact')).toHaveLength(1);
  expect(details.some(detail => detail.kind === 'verification' && detail.content.includes('passed'))).toBe(true);
  expect((await client.list()).tasks).toHaveLength(1);
}, 15000);

it('CLI observation timeout leaves background work running and explicit cancellation reaches a separate terminal state', async () => {
  await startRunner('observer-independent');
  const id = await submit('slow', 1400);
  await expect.poll(async () => (await client.show(id)).status).toBe('running');
  const observed = await cli(['watch', id, '--timeout', '150', '--json']);
  expect(observed.code).toBe(124);
  expect((await client.show(id)).status).toBe('running');
  await expect.poll(async () => (await client.show(id)).status, { timeout: 5000 }).toBe('succeeded');
  const cancelledId = await submit('slow', 10000);
  await expect.poll(async () => (await client.show(cancelledId)).status).toBe('running');
  expect((await cli(['cancel', cancelledId, '--key', 'stop', '--json'])).code).toBe(0);
  const cancelled = await cli(['watch', cancelledId, '--timeout', '6000', '--json']);
  expect(cancelled.code).toBe(11);
  expect((await client.show(cancelledId)).status).toBe('cancelled');
}, 15000);

it('keeps large details folded and distinguishes verifier failure from execution failure', async () => {
  await startRunner('evidence');
  const id = await submit('large');
  await expect.poll(async () => (await client.show(id)).status, { timeout: 5000 }).toBe('succeeded');
  const snapshot = await client.show(id);
  expect(JSON.stringify(snapshot).length).toBeLessThan(12000);
  const reference = snapshot.entries.find(entry => entry.kind === 'reference' && entry.reference.title === 'Large fixture evidence');
  expect(reference?.kind).toBe('reference');
  if (reference?.kind !== 'reference') throw new Error('Missing folded evidence.');
  expect((await client.detail(reference.reference.id)).content).toHaveLength(262144);
  const rejected = await submit('verification-failure');
  const watched = await cli(['watch', rejected, '--timeout', '6000', '--json']);
  expect(watched.code).toBe(12);
  expect((await client.show(rejected)).status).toBe('succeeded');
  expect((await client.show(rejected)).verificationStatus).toBe('failed');
}, 15000);

it('marks an interrupted runner uncertain and never reassigns its task to another runner', async () => {
  const original = await startRunner('lost');
  const id = await submit('slow', 10000);
  await expect.poll(async () => (await client.show(id)).status).toBe('running');
  const attemptId = (await client.show(id)).attempt!.id;
  await stopRunner(original.process);
  await startRunner('replacement');
  await expect.poll(async () => (await client.show(id)).status, { timeout: 5000 }).toBe('uncertain');
  const state = await client.show(id);
  expect(state.attempt?.id).toBe(attemptId);
  expect(state.attempt?.runnerId).toBe(original.runnerId);
  expect((await cli(['watch', id, '--json'])).code).toBe(13);
}, 15000);


it('reconnects an actual CLI stream after a transport disconnect and observes the same durable result', async () => {
  await startRunner('reconnect');
  const id = await submit('decision');
  await expect.poll(async () => (await client.show(id)).status).toBe('waiting');
  const waiting = await client.show(id);
  let disconnected!: () => void;
  const firstConnection = new Promise<void>(resolve => { disconnected = resolve; });
  const streamPaths: string[] = [];
  const proxy = createProxy((request, response) => {
    const stream = request.url!.includes('/stream');
    if (stream) streamPaths.push(request.url!);
    const interrupt = stream && streamPaths.length === 1;
    const upstream = proxyRequest(`${baseUrl}${request.url}`, { headers: request.headers }, incoming => {
      response.writeHead(incoming.statusCode!, incoming.headers);
      incoming.on('data', chunk => {
        response.write(chunk);
        if (interrupt) { response.end(); incoming.destroy(); disconnected(); }
      });
      incoming.on('end', () => response.end());
      incoming.on('error', () => response.destroy());
    });
    response.on('close', () => upstream.destroy());
    upstream.on('error', () => response.destroy());
    upstream.end();
  }).listen(0, '127.0.0.1');
  await once(proxy, 'listening');
  try {
    const observer = cli(['watch', id, '--url', `http://127.0.0.1:${(proxy.address() as AddressInfo).port}`, '--json', '--timeout', '6000']);
    await firstConnection;
    await client.decide(id, { decisionId: waiting.pendingDecision!.id, answer: 'approve' }, 'reconnect-approval');
    const result = await observer;
    expect(result.code).toBe(0);
    expect(streamPaths.length).toBeGreaterThanOrEqual(2);
    expect(streamPaths[1]).toBe(`/api/tasks/${id}/stream?after=${waiting.watermark}`);
    const last = JSON.parse(result.stdout.trim().split('\n').at(-1)!);
    expect(last.task.id).toBe(id);
    expect(last.task.status).toBe('succeeded');
    expect(last.task.verificationStatus).toBe('passed');
    expect((await client.show(id)).attempt?.id).toBe(waiting.attempt?.id);
  } finally { await new Promise<void>(resolve => proxy.close(() => resolve())); }
}, 15000);
