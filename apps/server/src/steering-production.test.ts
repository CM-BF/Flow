import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createServer as createTcpServer } from 'node:net';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { Pool } from 'pg';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { createServer } from './index.js';
import { runRunner } from '../../runner/src/runtime.js';
import { createClaudeAdapter, type ClaudeQuery } from '../../runner/src/claude.js';

const database = `flow_steering_mount_${randomUUID().replaceAll('-', '')}`;
const admin = new Pool({ connectionString: 'postgresql://flow:flow-local-only@127.0.0.1:55432/postgres', max: 1 });
const databaseUrl = `postgresql://flow:flow-local-only@127.0.0.1:55432/${database}`;
const pool = new Pool({ connectionString: databaseUrl, max: 2 });
const ownerToken = 'steering-mount-test-owner';
const facts: Record<string, unknown> = { database, created: false };
let app: Awaited<ReturnType<typeof createServer>> | undefined;
let base = '';
beforeAll(async () => {
  facts.before = (await admin.query('SELECT datname FROM pg_database WHERE datname=$1', [database])).rows;
  expect(facts.before).toEqual([]);
  await admin.query(`CREATE DATABASE ${database}`); facts.created = true;
  app = await createServer({ databaseUrl, ownerToken, automaticQueueScan: false, leaseMs: 300_000 });
  base = await app.listen({ host: '127.0.0.1', port: 0 });
});
afterAll(async () => {
  try { await app?.close(); }
  finally {
    await pool.end();
    try {
      facts.connections = (await admin.query('SELECT pid FROM pg_stat_activity WHERE datname=$1', [database])).rows;
      if (facts.created) await admin.query(`DROP DATABASE ${database}`);
      facts.remaining = (await admin.query('SELECT datname FROM pg_database WHERE datname=$1', [database])).rows;
      console.log('STEERING_PRODUCTION_DATABASE_FACTS', JSON.stringify(facts));
    } finally { await admin.end(); }
  }
});
async function request(path: string, body?: unknown, token = ownerToken, expectedStatus = 200) {
  const response = await fetch(`${base}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', 'idempotency-key': randomUUID(), connection: 'close' },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(5000),
  });
  const value = await response.json();
  expect(response.status, JSON.stringify(value)).toBe(expectedStatus);
  return value;
}
it('mounts 024 and authenticated control routes but keeps default intake and conversation capability disabled', async () => {
  expect((await pool.query('SELECT version FROM flow.migrations WHERE version=24')).rows).toEqual([{ version: 24 }]);
  const conversation = await request('/api/conversations', { title: 'Default controls stay closed', harness: 'claude' }, ownerToken, 201);
  expect(conversation.capabilities.steer).toBe(false);
  expect((await request(`/api/conversations/${conversation.conversation.id}`)).capabilities.steer).toBe(false);
  const runner = await request('/api/runners', { name: 'Default control role check', harnesses: ['claude'], capacity: 1 });
  const taskId = randomUUID();
  const input = { attemptId: randomUUID(), ownerVersion: 1, expectedRevision: 0, text: 'Not accepted by default' };
  expect((await request(`/api/tasks/${taskId}/steering`, input, ownerToken, 409)).error.code).toBe('steering_unsupported');
  await request(`/api/tasks/${taskId}/steering`, input, 'invalid', 401);
  await request(`/api/tasks/${taskId}/steering`, input, runner.token, 403);
  await request(`/api/tasks/${taskId}/steering`, undefined, runner.token, 403);
  for (const path of ['mailbox', 'finalize', 'proposals/status', 'receipts']) {
    await request(`/api/runner/steering/${path}`, {}, ownerToken, 403);
    await request(`/api/runner/steering/${path}`, {}, 'invalid', 401);
    expect((await request(`/api/runner/steering/${path}`, {}, runner.token, 400)).error.code).toBe('steering_input');
  }
  expect((await pool.query('SELECT count(*)::int AS count FROM flow.steering_commands')).rows[0].count).toBe(0);
});
it('preserves a default string-query runner final through the production factory with 024 installed', async () => {
  const runner = await request('/api/runners', { name: 'Ordinary final after 024', harnesses: ['claude'], capacity: 1 });
  const task = (await request('/api/tasks', { title: 'Ordinary conversation response', prompt: 'Synthetic SDK only', harness: 'claude' }, ownerToken, 202)).task;
  await pool.query('UPDATE flow.tasks SET dispatch_ready=true WHERE id=$1', [task.id]);
  const directory = await mkdtemp(join(tmpdir(), 'flow-steering-mount-'));
  const stop = new AbortController(), sessionId = randomUUID();
  let calls = 0, closed = 0;
  type Message = ReturnType<ClaudeQuery> extends AsyncIterable<infer T> ? T : never;
  const query: ClaudeQuery = ({ prompt }) => Object.assign((async function* () {
    calls++; expect(prompt).toBe('Synthetic SDK only');
    yield { type: 'system', subtype: 'init', uuid: randomUUID(), session_id: sessionId, tools: [], plugins: [], skills: [], mcp_servers: [], model: 'synthetic', permissionMode: 'dontAsk', claude_code_version: 'injected' } as unknown as Message;
    yield { type: 'result', subtype: 'success', is_error: false, uuid: randomUUID(), session_id: sessionId, result: 'Ordinary final 你好🙂', modelUsage: { synthetic: { inputTokens: 1, outputTokens: 2, costUSD: 0.001 } }, permission_denials: [] } as unknown as Message;
  })(), { close() { closed++; } });
  const running = runRunner({ baseUrl: base, token: runner.token, workingDirectory: directory, signal: stop.signal, heartbeatIntervalMs: 50, pollIntervalMs: 20,
    adapters: [createClaudeAdapter({ materialFiles: [], query, timeoutMs: 6000 })] });
  try {
    const deadline = Date.now() + 8000;
    let snapshot = await request(`/api/tasks/${task.id}`);
    while (!['succeeded', 'failed', 'uncertain', 'cancelled'].includes(snapshot.status) && Date.now() < deadline) {
      await sleep(20); snapshot = await request(`/api/tasks/${task.id}`);
    }
    expect(snapshot).toMatchObject({ status: 'succeeded', verificationStatus: 'passed' });
    expect(calls).toBe(1); expect(closed).toBe(1);
    const messages = await request(`/api/tasks/${task.id}/assistant-messages`);
    expect(messages.messages).toHaveLength(1);
    expect((await pool.query('SELECT count(*)::int AS count FROM flow.steering_commands')).rows[0].count).toBe(0);
    expect((await request(`/api/tasks/${task.id}/steering`)).commands).toEqual([]);
  } finally { stop.abort(); await running; await rm(directory, { recursive: true, force: true }); }
});

it('passes only the explicit trusted startup configuration to steering intake', async () => {
  const task = (await request('/api/tasks', { title: 'Startup policy only', prompt: 'No runner is started for this task', harness: 'claude' }, ownerToken, 202)).task;
  for (const setting of [undefined, '0', '1', 'invalid-private-marker']) {
    const listener = createTcpServer();
    await new Promise<void>(resolve => listener.listen(0, '127.0.0.1', resolve));
    const address = listener.address();
    if (!address || typeof address === 'string') throw new Error('Expected a private test TCP port.');
    const port = address.port;
    await new Promise<void>((resolve, reject) => listener.close(error => error ? reject(error) : resolve()));
    const child = spawn(process.execPath, ['--import', 'tsx', 'apps/server/src/main.ts'], {
      cwd: process.cwd(), stdio: ['ignore', 'pipe', 'pipe'],
      env: { PATH: process.env.PATH, DATABASE_URL: databaseUrl, FLOW_TOKEN: ownerToken, FLOW_PORT: String(port), ...(setting === undefined ? {} : { FLOW_ACTIVE_STEERING: setting }) },
    });
    let output = '';
    child.stdout.on('data', chunk => { output = (output + String(chunk)).slice(-16_384); });
    child.stderr.on('data', chunk => { output = (output + String(chunk)).slice(-16_384); });
    const exited = new Promise<number | null>((resolve, reject) => { child.once('error', reject); child.once('exit', resolve); });
    try {
      if (setting === 'invalid-private-marker') {
        expect(await Promise.race([exited, sleep(5000).then(() => 'timeout')])).toBe(1);
        expect(output).toContain('FLOW_ACTIVE_STEERING must be absent, 0 or 1.');
        expect(output).not.toContain(setting);
        continue;
      }
      const deadline = Date.now() + 7000;
      let response: Response | undefined;
      while (Date.now() < deadline && child.exitCode === null) {
        try {
          response = await fetch(`http://127.0.0.1:${port}/api/tasks/${task.id}/steering/admission`, {
            headers: { authorization: `Bearer ${ownerToken}`, 'X-Flow-Active-Steering': '1', connection: 'close' }, signal: AbortSignal.timeout(1000),
          });
          break;
        } catch { await sleep(20); }
      }
      expect(response?.status, output).toBe(200);
      expect(await response!.json()).toMatchObject({ taskId: task.id, state: 'unavailable', reason: setting === '1' ? 'no-attempt' : 'disabled' });
      const post = await fetch(`http://127.0.0.1:${port}/api/tasks/${task.id}/steering`, {
        method: 'POST', headers: { authorization: `Bearer ${ownerToken}`, 'content-type': 'application/json', 'idempotency-key': randomUUID(), connection: 'close' },
        body: JSON.stringify({ attemptId: randomUUID(), ownerVersion: 1, expectedRevision: 0, text: 'Configuration does not authorize an attempt' }), signal: AbortSignal.timeout(2000),
      });
      expect(post.status).toBe(setting === '1' ? 404 : 409);
      expect((await post.json()).error.code).toBe(setting === '1' ? 'steering_attempt' : 'steering_unsupported');
    } finally {
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
      const stopped = await Promise.race([exited.then(() => true), sleep(5000).then(() => false)]);
      if (!stopped) { child.kill('SIGKILL'); await exited; }
      expect(stopped, 'Owned test center did not finish normal shutdown.').toBe(true);
    }
  }
  expect((await pool.query('SELECT count(*)::int AS count FROM flow.steering_commands')).rows[0].count).toBe(0);
}, 30_000);
