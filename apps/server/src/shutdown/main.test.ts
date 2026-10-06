import { spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { createServer as createTcpServer, connect, type Socket } from 'node:net';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';
import { Pool } from 'pg';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { createServer } from '../index.js';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const database = `flow_r04_${randomUUID().replaceAll('-', '')}`;
const admin = new Pool({ connectionString: 'postgresql://flow:flow-local-only@127.0.0.1:55432/postgres', max: 1 });
const databaseUrl = `postgresql://flow:flow-local-only@127.0.0.1:55432/${database}`;
const ownerToken = `r04-${randomUUID()}`;
const children = new Set<ChildProcess>();
const sockets = new Set<Socket>();
let created = false;
interface RunningCenter { child: ChildProcess; url: string; output: () => string; exited: Promise<{ code: number | null; signal: NodeJS.Signals | null }> }

beforeAll(async () => { await admin.query(`CREATE DATABASE ${database}`); created = true; });
afterAll(async () => {
  for (const socket of sockets) socket.destroy();
  for (const child of children) child.kill('SIGKILL');
  await Promise.all([...children].map(child => once(child, 'exit')));
  try { if (created) await admin.query(`DROP DATABASE ${database}`); }
  finally { await admin.end(); }
});
async function freePort() {
  const server = createTcpServer(); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const address = server.address(); if (!address || typeof address === 'string') throw Error('No TCP port.');
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  return address.port;
}
async function start(): Promise<RunningCenter> {
  const port = await freePort();
  const child = spawn(process.execPath, ['--import', 'tsx', 'apps/server/src/main.ts'], {
    cwd: root, env: { ...process.env, DATABASE_URL: databaseUrl, FLOW_TOKEN: ownerToken, FLOW_HOST: '127.0.0.1', FLOW_PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  children.add(child);
  let output = '';
  child.stdout!.on('data', chunk => { output += chunk; }); child.stderr!.on('data', chunk => { output += chunk; });
  const exited = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>(resolve => child.once('exit', (code, signal) => { children.delete(child); resolve({ code, signal }); }));
  const url = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 300; i++) {
    if (child.exitCode !== null) throw Error(`Center exited before ready: ${output}`);
    if (await fetch(`${url}/api/health`, { signal: AbortSignal.timeout(200) }).then(r => r.ok).catch(() => false)) return { child, url, output: () => output, exited };
    await sleep(20);
  }
  throw Error(`Center readiness timed out: ${output}`);
}
async function stop(center: RunningCenter, signal: NodeJS.Signals, bound = 3500) {
  const start = performance.now(); center.child.kill(signal);
  let timer: NodeJS.Timeout;
  const result = await Promise.race([center.exited, new Promise<'timeout'>(resolve => { timer = setTimeout(() => resolve('timeout'), bound); })]);
  clearTimeout(timer!);
  console.log(JSON.stringify({ case: signal, elapsedMs: Math.round(performance.now() - start), result, output: center.output() }));
  return result;
}
async function request(center: RunningCenter, path: string, body?: unknown, key = randomUUID(), token = ownerToken) {
  const response = await fetch(`${center.url}${path}`, { method: body === undefined ? 'GET' : 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', 'idempotency-key': key }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(5000) });
  const json = await response.json(); expect(response.ok, JSON.stringify(json)).toBe(true); return json;
}
async function unfinishedClaim(center: RunningCenter, token: string) {
  const socket = connect(Number(new URL(center.url).port), '127.0.0.1'); sockets.add(socket);
  socket.on('error', () => undefined); socket.on('close', () => sockets.delete(socket));
  await once(socket, 'connect');
  // Request body has not completed: no command can be admitted; the client leaves a live HTTP socket.
  socket.write(`POST /api/runner/claim HTTP/1.1\r\nHost: 127.0.0.1\r\nAuthorization: Bearer ${token}\r\nContent-Type: application/json\r\nContent-Length: 2\r\n\r\n{`);
  await sleep(50);
  return socket;
}

it('bounds real main SIGTERM with an unfinished claim connection and no active database query', async () => {
  const center = await start();
  const runner = await request(center, '/api/runners', { name: 'shutdown-only', harnesses: ['fixture'], capacity: 1 });
  const socket = await unfinishedClaim(center, runner.token);
  const activity = await admin.query("SELECT state,wait_event_type,wait_event FROM pg_stat_activity WHERE datname=$1 AND state<>'idle'", [database]);
  console.log(JSON.stringify({ databaseActiveBeforeSignal: activity.rows, socketDestroyed: socket.destroyed }));
  expect(activity.rows).toEqual([]);
  expect(await stop(center, 'SIGTERM')).toEqual({ code: 0, signal: null });
});

it('lets normal SIGINT exit without exhausting the drain deadline and preserves accepted commands on restart', async () => {
  const center = await start(); const key = randomUUID();
  const input = { title: 'Persist across clean stop', prompt: 'No runner or model', harness: 'fixture' };
  const accepted = await request(center, '/api/tasks', input, key);
  expect(await stop(center, 'SIGINT')).toEqual({ code: 0, signal: null });
  expect(center.output()).not.toContain('deadline');
  const restarted = await start();
  expect((await request(restarted, `/api/tasks/${accepted.task.id}`)).status).toBe('queued');
  expect(await request(restarted, '/api/tasks', input, key)).toMatchObject({ task: { id: accepted.task.id }, replayed: true });
  expect(await stop(restarted, 'SIGTERM')).toEqual({ code: 0, signal: null });
});

it('ends a live SSE observer and handles repeated signals without killing the process', async () => {
  const center = await start();
  const accepted = await request(center, '/api/tasks', { title: 'SSE observer', prompt: 'No execution', harness: 'fixture' });
  const response = await fetch(`${center.url}/api/tasks/${accepted.task.id}/stream`, { headers: { authorization: `Bearer ${ownerToken}` } });
  expect(response.status).toBe(200);
  const reader = response.body!.getReader(); expect((await reader.read()).done).toBe(false);
  const runner = await request(center, '/api/runners', { name: 'SSE stop', harnesses: ['fixture'] });
  await unfinishedClaim(center, runner.token);
  const stopping = stop(center, 'SIGTERM');
  await sleep(100); center.child.kill('SIGTERM'); center.child.kill('SIGINT');
  expect(await stopping).toEqual({ code: 0, signal: null });
  expect((await reader.read()).done).toBe(true);
  expect(center.output().match(/HTTP drain deadline/g)).toHaveLength(1);
  expect(await fetch(`${center.url}/api/health`).then(() => true).catch(() => false)).toBe(false);
});

it('closes after actual claim client aborts without treating the socket as transaction cancellation', async () => {
  const center = await start();
  const runner = await request(center, '/api/runners', { name: 'aborted claims', harnesses: ['fixture'] });
  const blocker = new Pool({ connectionString: databaseUrl, max: 1 });
  const client = await blocker.connect();
  try {
    await client.query('BEGIN'); await client.query('SELECT id FROM flow.runners WHERE id=$1 FOR UPDATE', [runner.runnerId]);
    const abort = new AbortController();
    const response = fetch(`${center.url}/api/runner/claim`, { method: 'POST', headers: { authorization: `Bearer ${runner.token}`, 'content-type': 'application/json' }, body: '{}', signal: abort.signal }).catch(() => null);
    await waitForDatabaseWait('Lock'); abort.abort(); expect(await response).toBe(null);
    const stopping = stop(center, 'SIGINT');
    await sleep(100);
    expect(children.has(center.child)).toBe(true);
    await client.query('ROLLBACK');
    expect(await stopping).toEqual({ code: 0, signal: null });
  } finally { await client.query('ROLLBACK'); client.release(); await blocker.end(); }
});

async function waitForDatabaseWait(type: string) {
  for (let i = 0; i < 100; i++) {
    const activity = await admin.query('SELECT 1 FROM pg_stat_activity WHERE datname=$1 AND wait_event_type=$2', [database, type]);
    if (activity.rowCount) return;
    await sleep(20);
  }
  throw Error(`No expected database wait: ${type}`);
}

it('recovers a command after shutdown loses its ACK while the owned transaction finishes', async () => {
  const center = await start(); const key = randomUUID();
  const input = { title: 'Lost ACK across stop', prompt: 'No execution', harness: 'fixture' };
  const blocker = new Pool({ connectionString: databaseUrl, max: 1 }); const lock = await blocker.connect();
  let lostAcknowledgement: Promise<Response | null> | undefined;
  try {
    await lock.query('SELECT pg_advisory_lock(hashtextextended($1,0))', [JSON.stringify(['submit', key])]);
    lostAcknowledgement = fetch(`${center.url}/api/tasks`, { method: 'POST', headers: { authorization: `Bearer ${ownerToken}`, 'content-type': 'application/json', 'idempotency-key': key }, body: JSON.stringify(input) }).catch(() => null);
    await waitForDatabaseWait('Lock');
    const stopping = stop(center, 'SIGTERM', 5000);
    await sleep(1200);
    expect(await lostAcknowledgement).toBe(null);
    expect(children.has(center.child)).toBe(true); // Closing HTTP must not masquerade as completed DB cleanup.
    await lock.query('SELECT pg_advisory_unlock_all()');
    expect(await stopping).toEqual({ code: 0, signal: null });
  } finally { await lock.query('SELECT pg_advisory_unlock_all()'); lock.release(); await blocker.end(); }
  const restarted = await start();
  const replayed = await request(restarted, '/api/tasks', input, key);
  expect(replayed.replayed).toBe(true);
  expect((await request(restarted, `/api/tasks/${replayed.task.id}`)).status).toBe('queued');
  expect((await request(restarted, '/api/tasks', input, key)).task.id).toBe(replayed.task.id);
  expect(await stop(restarted, 'SIGTERM')).toEqual({ code: 0, signal: null });
});

it('rejects new TCP and pipelined commands during drain', async () => {
  const center = await start();
  const runner = await request(center, '/api/runners', { name: 'closing admission', harnesses: ['fixture'] });
  const socket = await unfinishedClaim(center, runner.token);
  let received = ''; socket.on('data', data => { received += data.toString(); });
  const stopping = stop(center, 'SIGTERM'); await sleep(100);
  expect(await fetch(`${center.url}/api/health`).then(() => true).catch(() => false)).toBe(false);
  const title = `after-close-${randomUUID()}`;
  const body = JSON.stringify({ title, prompt: 'Must not be admitted', harness: 'fixture' });
  socket.write(`}POST /api/tasks HTTP/1.1\r\nHost: 127.0.0.1\r\nAuthorization: Bearer ${ownerToken}\r\nIdempotency-Key: ${randomUUID()}\r\nContent-Type: application/json\r\nContent-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`);
  expect(await stopping).toEqual({ code: 0, signal: null });
  expect(received).not.toContain('202 Accepted');
  console.log(JSON.stringify({ duringDrain: received.includes('503') ? '503' : 'connection-closed-without-ack' }));
  const restarted = await start();
  expect((await request(restarted, '/api/tasks?limit=100')).tasks.some((task: { title: string }) => task.title === title)).toBe(false);
  expect(await stop(restarted, 'SIGTERM')).toEqual({ code: 0, signal: null });
});

it('supports createServer inject-only close and idempotent repeated close without a listening socket', async () => {
  const app = await createServer({ databaseUrl, ownerToken, shutdownGraceMs: 50 });
  try { expect((await app.inject({ method: 'GET', url: '/api/health' })).statusCode).toBe(200); }
  finally { await app.close(); await app.close(); }
});

it('allows an in-flight command to finish normally within grace without losing its ACK', async () => {
  const center = await start(); const key = randomUUID();
  const input = { title: 'Drained command', prompt: 'No execution', harness: 'fixture' };
  const blocker = new Pool({ connectionString: databaseUrl, max: 1 }); const lock = await blocker.connect();
  try {
    await lock.query('SELECT pg_advisory_lock(hashtextextended($1,0))', [JSON.stringify(['submit', key])]);
    const pending = request(center, '/api/tasks', input, key);
    await waitForDatabaseWait('Lock');
    const stopping = stop(center, 'SIGINT'); await sleep(100);
    await lock.query('SELECT pg_advisory_unlock_all()');
    expect((await pending).replayed).toBe(false);
    expect(await stopping).toEqual({ code: 0, signal: null });
    expect(center.output()).not.toContain('deadline');
  } finally { await lock.query('SELECT pg_advisory_unlock_all()'); lock.release(); await blocker.end(); }
});

it('exits nonzero at the final production deadline when scheduler SQL cannot finish', async () => {
  const center = await start();
  const blocker = new Pool({ connectionString: databaseUrl, max: 1 }); const lock = await blocker.connect();
  try {
    await lock.query('BEGIN');
    await lock.query('LOCK TABLE pgboss.job IN ACCESS EXCLUSIVE MODE');
    await waitForDatabaseWait('Lock');
    expect(await stop(center, 'SIGTERM', 23_000)).toEqual({ code: 1, signal: null });
    expect(center.output()).toContain('cleanup deadline exceeded; forced process exit');
    expect(center.output()).toContain('unacknowledged outcomes unknown');
    expect(center.output()).not.toContain('postgresql://');
  } finally { await lock.query('ROLLBACK'); lock.release(); await blocker.end(); }
});
