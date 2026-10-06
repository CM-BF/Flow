import { spawn, execFile, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { promisify } from 'node:util';
import { mkdtemp, writeFile, rm, chmod } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID, createHash } from 'node:crypto';
import { Pool } from 'pg';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { FlowClient } from '@flow/client';
import { createServer } from '../../../server/src/index.js';
import { officialPeer } from './official-peer.js';

const databaseUrl = 'postgresql://flow:flow-local-only@127.0.0.1:55432/flow_p02';
const ownerToken = 'p02-process-owner';
let server: Awaited<ReturnType<typeof createServer>>;
let pool: Pool; let directory: string; let baseUrl: string; let client: FlowClient;
let peer: Awaited<ReturnType<typeof officialPeer>>;
const children: ChildProcess[] = [];
type ObservedRequest = { url: string; body: unknown };
let holdResponse: ((request: ObservedRequest) => boolean) | undefined;
let held: (() => void) | undefined; let release: (() => void) | undefined;
let rejectHeartbeats = false; let heartbeatRejections = 0; let heartbeatRequests = 0;
function holdNextResponse(predicate: (request: ObservedRequest) => boolean) {
  holdResponse = predicate;
  return new Promise<void>(resolve => { held = resolve; });
}
async function startCenter(port = 0, leaseMs = 15_000) {
  server = await createServer({ databaseUrl, ownerToken, leaseMs });
  server.addHook('preHandler', async (request, reply) => {
    if (request.url === '/api/runner/heartbeat') heartbeatRequests++;
    if (rejectHeartbeats && request.url === '/api/runner/heartbeat') {
      heartbeatRejections++; return reply.code(503).send({ error: 'lease-test-unavailable' });
    }
  });
  server.addHook('onSend', async request => {
    if (holdResponse?.(request)) {
      holdResponse = undefined;
      await new Promise<void>(resolve => { release = resolve; held?.(); });
    }
  });
  baseUrl = await server.listen({ port, host: '127.0.0.1' }); client = new FlowClient({ baseUrl, token: ownerToken });
}
async function stop(child: ChildProcess) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const exited = once(child, 'exit'); child.kill('SIGKILL'); await exited;
}
async function launch(token: string, entry = 'apps/runner/src/protocol-dispatch/test-process.ts') {
  const child = spawn(process.execPath, ['--import', 'tsx', entry], { cwd: process.cwd(), stdio: ['ignore', 'ignore', 'pipe'],
    env: { ...process.env, FLOW_URL: baseUrl, FLOW_RUNNER_TOKEN: token, FLOW_RUNNER_WORKDIR: join(directory, 'runner'), FLOW_A2A_ENDPOINTS_FILE: join(directory, 'endpoints.json') } });
  children.push(child); return child;
}
async function submit(endpointRef = 'peer') {
  const runner = await client.registerRunner({ name: 'P02 independent process', harnesses: ['a2a'], capacity: 1 });
  const task = await client.submit({ title: 'Remote checked work', prompt: 'Produce a remote artifact.', harness: 'a2a', protocol: { endpointRef } }, randomUUID());
  return { token: runner.token, id: task.task.id };
}
beforeEach(async () => {
  holdResponse = undefined; held = undefined; release = undefined;
  rejectHeartbeats = false; heartbeatRejections = 0; heartbeatRequests = 0;
  pool = new Pool({ connectionString: databaseUrl }); await pool.query('DROP SCHEMA IF EXISTS flow CASCADE; DROP SCHEMA IF EXISTS pgboss CASCADE');
  directory = await mkdtemp(join(tmpdir(), 'flow-p02-runtime-')); peer = await officialPeer();
  await writeFile(join(directory, 'endpoints.json'), JSON.stringify({ peer: { url: peer.url, allowLoopbackHttp: true, timeoutMs: 4000 } }), { mode: 0o600 });
  await startCenter();
});
afterEach(async () => { release?.(); peer?.release(); await Promise.all(children.splice(0).map(stop)); await server?.close(); await pool?.end(); await peer?.close(); await rm(directory, { recursive: true, force: true }); });

test('bound remote Task survives runner and center restart, then imports one version and independently verifies it', async () => {
  const { token, id } = await submit();
  const child = await launch(token);
  await expect.poll(async () => (await client.protocolState(id))?.intent.phase).toBe('bound');
  const bound = await client.protocolState(id); const attempt = (await client.show(id)).attempt!.id;
  await stop(child);
  const port = Number(new URL(baseUrl).port); await server.close(); await startCenter(port);
  await peer.finish('An independently checked remote artifact.');
  await launch(token);
  await expect.poll(async () => (await client.show(id)).status, { timeout: 7000 }).toBe('succeeded');
  const result = await client.show(id);
  expect(result.attempt!.id).toBe(attempt); expect(result.verificationStatus).toBe('passed');
  expect(peer.counts.sends).toBe(1); expect(peer.counts.gets).toBeGreaterThan(0);
  expect((await client.protocolState(id))?.intent.remoteTaskId).toBe(bound!.intent.remoteTaskId);
  const details = await Promise.all(result.entries.filter(item => item.kind === 'reference').map(item => client.detail(item.reference.id)));
  expect(details.filter(item => item.kind === 'artifact')).toHaveLength(1);
  expect(details.find(item => item.kind === 'artifact')?.content).toBe('An independently checked remote artifact.');
  expect(details.some(item => item.kind === 'verification' && JSON.parse(item.content).result === 'passed')).toBe(true);
  expect(result.usage.inputTokens).toBeNull(); expect(result.usage.costUsd).toBeNull();
});


test('a crash after the durable send permit but before its ACK does not dispatch or replay', async () => {
  const { token, id } = await submit();
  const blocked = holdNextResponse(request => request.url === '/api/runner/protocol/begin');
  const child = await launch(token);
  await blocked;
  expect((await client.protocolState(id))?.intent.phase).toBe('sending');
  await stop(child); release?.();
  await launch(token);
  await expect.poll(async () => (await client.show(id)).status).toBe('uncertain');
  expect((await client.protocolState(id))?.intent.reason).toBe('recovered-inflight-send');
  expect(peer.counts.sends).toBe(0);
});

test('a crash after remote acceptance but before its ACK preserves an uncertain outcome and never resends', async () => {
  const { token, id } = await submit();
  peer.holdSendAck();
  const child = await launch(token);
  await expect.poll(() => peer.taskId).toBeTruthy();
  await stop(child); peer.release();
  await launch(token);
  await expect.poll(async () => (await client.show(id)).status).toBe('uncertain');
  const state = await client.protocolState(id);
  expect(state?.intent.remoteTaskId).toBeNull();
  expect(state?.intent.reason).toBe('recovered-inflight-send');
  expect(peer.counts.sends).toBe(1);
});

test('a crash after binding commits but before its ACK recovers by GetTask without another SendMessage', async () => {
  const { token, id } = await submit();
  const blocked = holdNextResponse(request => request.url === '/api/runner/protocol/bind');
  const child = await launch(token);
  await blocked;
  const bound = await client.protocolState(id);
  expect(bound?.intent.phase).toBe('bound');
  await stop(child); release?.();
  await peer.finish('Result after a lost binding ACK.');
  await launch(token);
  await expect.poll(async () => (await client.show(id)).status).toBe('succeeded');
  expect((await client.protocolState(id))?.intent.remoteTaskId).toBe(bound!.intent.remoteTaskId);
  expect(peer.counts.sends).toBe(1); expect(peer.counts.gets).toBeGreaterThan(0);
});

test('cancel acceptance remains pending across restart until the remote Task actually stops', async () => {
  const { token, id } = await submit();
  const child = await launch(token);
  await expect.poll(async () => (await client.protocolState(id))?.intent.phase).toBe('bound');
  await client.cancel(id, randomUUID());
  await expect.poll(() => peer.counts.cancels).toBe(1);
  expect((await client.show(id)).status).toBe('cancel_requested');
  await stop(child);
  await launch(token);
  const previousGets = peer.counts.gets;
  await expect.poll(() => peer.counts.gets).toBeGreaterThan(previousGets);
  expect((await client.show(id)).status).toBe('cancel_requested');
  expect(peer.counts.cancels).toBe(1);
  await peer.finish(null, true);
  await expect.poll(async () => (await client.show(id)).status).toBe('cancelled');
  expect((await client.protocolState(id))?.artifacts).toHaveLength(0);
  expect(peer.counts.sends).toBe(1); expect(peer.counts.cancels).toBe(1);
});

test('replays a persisted artifact ACK gap without duplicating its version and completes independent verification', async () => {
  const { token, id } = await submit();
  const child = await launch(token);
  await expect.poll(async () => (await client.protocolState(id))?.intent.phase).toBe('bound');
  const blocked = holdNextResponse(request => request.url === '/api/runner/events' &&
    (request.body as { events?: { type: string }[] }).events?.some(event => event.type === 'artifact') === true);
  await peer.finish('Artifact persisted before its ACK.');
  await blocked;
  expect((await client.protocolState(id))?.artifacts).toHaveLength(1);
  expect((await client.protocolState(id))?.artifacts[0]?.verified).toBe(false);
  await stop(child); release?.();
  await launch(token);
  await expect.poll(async () => (await client.show(id)).status).toBe('succeeded');
  const result = await client.show(id);
  expect(result.verificationStatus).toBe('passed');
  expect((await client.protocolState(id))?.artifacts).toHaveLength(1);
  const details = await Promise.all(result.entries.filter(item => item.kind === 'reference').map(item => client.detail(item.reference.id)));
  expect(details.filter(item => item.kind === 'artifact')).toHaveLength(1);
  expect(details.filter(item => item.kind === 'verification')).toHaveLength(1);
  expect(peer.counts.sends).toBe(1);
});

test('remote execution success does not conceal an independently failed text verifier', async () => {
  const { token, id } = await submit();
  await launch(token);
  await expect.poll(async () => (await client.protocolState(id))?.intent.phase).toBe('bound');
  await peer.finish('');
  await expect.poll(async () => (await client.show(id)).status).toBe('succeeded');
  const result = await client.show(id);
  expect(result.verificationStatus).toBe('failed');
  expect((await client.protocolState(id))?.artifacts).toHaveLength(1);
  expect(result.usage.inputTokens).toBeNull(); expect(result.usage.costUsd).toBeNull();
});


test('heartbeat loss stops remote observation and an expired attempt cannot be revived or dispatched again', async () => {
  await server.close(); await startCenter(0, 400);
  const { token, id } = await submit();
  await launch(token);
  await expect.poll(async () => (await client.protocolState(id))?.intent.phase).toBe('bound');
  await expect.poll(() => peer.counts.gets).toBeGreaterThan(0);
  const attemptId = (await client.show(id)).attempt!.id;
  rejectHeartbeats = true;
  await expect.poll(() => heartbeatRejections).toBeGreaterThan(0);
  const readsAfterLeaseLoss = peer.counts.gets;
  await expect.poll(async () => (await client.show(id)).status).toBe('uncertain');
  expect(peer.counts.gets).toBe(readsAfterLeaseLoss);
  rejectHeartbeats = false;
  const runnerClient = new FlowClient({ baseUrl, token });
  expect((await runnerClient.protocolRecover()).assignments).toHaveLength(0);
  expect((await runnerClient.claim()).assignment).toBeNull();
  expect((await client.show(id)).attempt!.id).toBe(attemptId);
  expect(peer.counts.sends).toBe(1); expect(peer.counts.gets).toBe(readsAfterLeaseLoss);
});

test('a lost center dispatch ACK times out even while heartbeats remain healthy, without remote replay', async () => {
  const { token, id } = await submit();
  const blocked = holdNextResponse(request => request.url === '/api/runner/protocol/begin');
  const child = await launch(token);
  await blocked;
  await expect.poll(async () => (await client.show(id)).status, { timeout: 2500 }).toBe('uncertain');
  expect(child.exitCode).toBeNull(); expect(child.signalCode).toBeNull();
  expect(peer.counts.sends).toBe(0);
  expect((await client.protocolState(id))?.intent.reason).toBe('send-result-unknown');
});


test('production server, runner and CLI entry points dispatch and inspect one verified remote task', async () => {
  const port = Number(new URL(baseUrl).port);
  await server.close();
  await pool.query('DROP SCHEMA flow CASCADE; DROP SCHEMA pgboss CASCADE');
  const centerProcess = spawn(process.execPath, ['--import', 'tsx', 'apps/server/src/main.ts'], {
    cwd: process.cwd(), stdio: ['ignore', 'ignore', 'pipe'],
    env: { ...process.env, DATABASE_URL: databaseUrl, FLOW_TOKEN: ownerToken, FLOW_PORT: String(port), FLOW_HOST: '127.0.0.1' },
  });
  children.push(centerProcess);
  await expect.poll(async () => {
    try { return (await fetch(`${baseUrl}/api/health`)).ok; } catch { return false; }
  }, { timeout: 7000 }).toBe(true);
  const cli = async (args: string[]) => {
    const result = await promisify(execFile)(process.execPath, ['--import', 'tsx', 'apps/cli/src/main.ts', ...args, '--json'], {
      cwd: process.cwd(), timeout: 5000, maxBuffer: 128 * 1024,
      env: { ...process.env, FLOW_URL: baseUrl, FLOW_TOKEN: ownerToken },
    });
    return JSON.parse(result.stdout);
  };
  const registration = await cli(['runner', 'register', '--name', 'Production A2A runner', '--harness', 'a2a']);
  const submitted = await cli(['submit', '--prompt', 'Produce a checked result.', '--harness', 'a2a', '--endpoint', 'peer']);
  const id = submitted.task.id as string;
  const runnerProcess = await launch(registration.token as string, 'apps/runner/src/main.ts');
  await expect.poll(async () => (await client.protocolState(id))?.intent.phase, { timeout: 7000 }).toBe('bound');
  const binding = await cli(['protocol', id]);
  expect(binding.intent.remoteTaskId).toBe(peer.taskId);
  expect(binding.intent.endpointRef).toBe('peer');
  await peer.finish('Produced through real server, CLI and runner entry points.');
  await expect.poll(async () => (await client.show(id)).status, { timeout: 7000 }).toBe('succeeded');
  const result = await cli(['show', id]);
  expect(result.verificationStatus).toBe('passed');
  expect(result.usage.costUsd).toBeNull();
  expect(peer.counts.sends).toBe(1);
  const artifactEntry = result.entries.find((entry: { kind: string; reference?: { title: string } }) => entry.kind === 'reference' && entry.reference?.title === 'Remote result');
  expect((await client.detail(artifactEntry.reference.id)).content).toBe('Produced through real server, CLI and runner entry points.');
  const runnerExit = once(runnerProcess, 'exit'); runnerProcess.kill('SIGTERM');
  expect((await runnerExit)[0]).toBe(0);
  const centerExit = once(centerProcess, 'exit'); centerProcess.kill('SIGTERM');
  expect((await centerExit)[0]).toBe(0);
});


test('an unwritable attempt directory stops the production runner without leaked heartbeat timers or a remote send', async () => {
  const { token, id } = await submit();
  const claimant = new FlowClient({ baseUrl, token });
  await expect.poll(async () => (await claimant.claim()).assignment).toBeTruthy();
  const blocked = holdNextResponse(request => request.url === '/api/runner/protocol/recover');
  const child = await launch(token, 'apps/runner/src/main.ts');
  await blocked;
  expect((await client.show(id)).attempt).toBeTruthy();
  const stateRoot = join(directory, 'runner', createHash('sha256').update(baseUrl).digest('hex'));
  await chmod(stateRoot, 0o500);
  try {
    release?.();
    await expect.poll(() => child.exitCode, { timeout: 2500 }).toBe(1);
    expect(heartbeatRequests).toBe(0);
    expect(peer.counts.sends).toBe(0);
    expect(await client.protocolState(id)).toBeNull();
  } finally { await stop(child); await chmod(stateRoot, 0o700); }
});

test.each(['missing-ref', 'constructor', 'toString', 'bad-url'])('invalid local endpoint %s exits without dispatch or continuing heartbeats', async name => {
  const reference = name === 'bad-url' ? 'peer' : name;
  if (name === 'bad-url') await writeFile(join(directory, 'endpoints.json'), JSON.stringify({ peer: { url: 'not-a-url' } }));
  const { token, id } = await submit(reference);
  const child = await launch(token, 'apps/runner/src/main.ts');
  await expect.poll(() => child.exitCode, { timeout: 2500 }).toBe(1);
  expect(heartbeatRequests).toBe(0);
  expect(peer.counts.sends).toBe(0);
  expect(await client.protocolState(id)).toBeNull();
});
