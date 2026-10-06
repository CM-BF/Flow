import { randomUUID } from 'node:crypto';
import { request as httpRequest } from 'node:http';
import { Pool } from 'pg';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { createServer } from '../index.js';
import type { ExecutionProfileConfiguration } from '../../../../packages/contracts/src/execution-profiles.js';

const database = `flow_chat09_${randomUUID().replaceAll('-', '')}`;
const admin = new Pool({ connectionString: 'postgresql://flow:flow-local-only@127.0.0.1:55432/postgres', max: 1 });
const databaseUrl = `postgresql://flow:flow-local-only@127.0.0.1:55432/${database}`;
let pool: Pool, app: Awaited<ReturnType<typeof createServer>>, base: string;
let created = false;
async function start(enabled = true) {
  app = await createServer({ databaseUrl, ownerToken: 'chat09-owner', leaseMs: 60_000, activeSteering: enabled });
  base = await app.listen({ host: '127.0.0.1', port: 0 });
}
beforeAll(async () => {
  await admin.query(`CREATE DATABASE ${database}`); created = true;
  pool = new Pool({ connectionString: databaseUrl, max: 4, statement_timeout: 5000 }); await start();
});
afterAll(async () => {
  try { await app?.close(); } finally { await pool?.end(); try { if (created) await admin.query(`DROP DATABASE ${database}`); } finally { await admin.end(); } }
});
async function request(path: string, body?: unknown, options: { token?: string; key?: string; headers?: Record<string, string> } = {}) {
  const response = await fetch(`${base}${path}`, { method: body === undefined ? 'GET' : 'POST', signal: AbortSignal.timeout(5000),
    headers: { authorization: `Bearer ${options.token ?? 'chat09-owner'}`, 'content-type': 'application/json', 'idempotency-key': options.key ?? randomUUID(), ...options.headers },
    body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: response.status, body: await response.json(), headers: response.headers };
}
function configuration(enabled: boolean): ExecutionProfileConfiguration {
  return { harness: 'claude', adapterVersion: 'claude-sdk-0.3.290-v2', model: 'synthetic', thinking: 'disabled', permissionMode: 'dontAsk', access: 'none',
    requireReadApproval: false, materialScopeDigest: '0'.repeat(64), limits: { maxTurns: 2, maxBudgetUsd: 0.2, timeoutMs: 3000 },
    ...(enabled ? { activeSteering: { protocol: 'flow.active-steering.v1' as const } } : {}) };
}
async function runner(enabled: boolean) {
  const registered = await request('/api/runners', { name: 'CHAT09 synthetic', harnesses: ['claude'], capacity: 1 });
  const value = registered.body;
  const publication = await request('/api/runner/execution-profile', { configuration: configuration(enabled) }, { token: value.token });
  expect(publication.status).toBe(200);
  return { ...value, profile: publication.body.profile };
}
async function attempt(enabled: boolean, pinned = true) {
  const r = await runner(enabled);
  const submitted = await request('/api/tasks', { title: 'CHAT09', harness: 'claude', prompt: 'Zero provider', ...(pinned ? { executionProfile: r.profile.reference } : {}) });
  expect(submitted.status).toBe(202);
  const taskId = submitted.body.task.id;
  await pool.query('UPDATE flow.tasks SET dispatch_ready=true WHERE id=$1', [taskId]);
  const claimed = await request('/api/runner/claim', {}, { token: r.token });
  expect(claimed.body.assignment.task.id).toBe(taskId);
  const ownership = { attemptId: claimed.body.assignment.attempt.id, ownerVersion: claimed.body.assignment.attempt.ownerVersion };
  const nativeSessionId = randomUUID();
  expect((await request('/api/runner/events', { ...ownership, events: [{ id: randomUUID(), sequence: 1, type: 'session', nativeSessionId, adapterVersion: 'claude-sdk-0.3.290-v2' }] }, { token: r.token })).status).toBe(200);
  return { ...r, taskId, ownership, nativeSessionId };
}
it('refuses a currently owned string-mode profile before recording any command or idempotency receipt', async () => {
  const a = await attempt(false);
  const rejected = await request(`/api/tasks/${a.taskId}/steering`, { ...a.ownership, expectedRevision: 0, text: 'New instruction' });
  expect(rejected.status).toBe(409); expect(rejected.body.error.code).toBe('steering_profile_unsupported');
  expect((await request(`/api/tasks/${a.taskId}/steering`)).body.commands).toEqual([]);
  expect((await pool.query('SELECT count(*)::int n FROM flow.commands WHERE operation=$1', [`steering.accept:${a.taskId}`])).rows[0].n).toBe(0);
  expect((await pool.query('SELECT count(*)::int n FROM flow.steering_attempts WHERE attempt_id=$1', [a.ownership.attemptId])).rows[0].n).toBe(0);
});

it('keeps old readers on compatible profiles and opts into all profiles with one exact header across pages', async () => {
  await runner(false); await runner(true); await runner(false); await runner(true);
  const header = { 'X-Flow-Execution-Profile': 'steering-v1' };
  const legacy = await request('/api/execution-profiles');
  expect(legacy.headers.get('cache-control')).toBe('no-store');
  expect(legacy.body.profiles.every((p: any) => !p.configuration.activeSteering)).toBe(true);
  const all = await request('/api/execution-profiles', undefined, { headers: header });
  expect(all.body.profiles.length).toBeGreaterThan(legacy.body.profiles.length);
  expect(all.body.profiles.every((p: any) => p.controls.steer === false && p.availability === 'not-probed')).toBe(true);
  for (const value of ['future', 'steering-v1, steering-v1', 'Steering-v1']) {
    expect((await request('/api/execution-profiles', undefined, { headers: { 'X-Flow-Execution-Profile': value } })).body).toEqual(legacy.body);
  }
  const duplicate = await new Promise<any>((resolve, reject) => {
    const req = httpRequest(`${base}/api/execution-profiles`, { headers: { authorization: 'Bearer chat09-owner', 'X-Flow-Execution-Profile': ['steering-v1', 'steering-v1'] } }, res => {
      let data = ''; res.setEncoding('utf8').on('data', part => data += part).on('end', () => resolve(JSON.parse(data)));
    }); req.on('error', reject); req.setTimeout(5000, () => req.destroy(new Error('HTTP timeout'))); req.end();
  });
  expect(duplicate).toEqual(legacy.body);
  for (const headers of [undefined, header]) {
    const ids: string[] = []; let after: string | null = null;
    do {
      const page = await request(`/api/execution-profiles?limit=1${after ? `&after=${after}` : ''}`, undefined, { headers });
      expect(page.body.profiles).toHaveLength(1); ids.push(page.body.profiles[0].reference.id); after = page.body.nextCursor;
    } while (after);
    expect(ids).toEqual((headers ? all : legacy).body.profiles.map((p: any) => p.reference.id));
  }
  expect((await request('/api/execution-profiles', undefined, { token: 'invalid', headers: header })).status).toBe(401);
});
it('refuses unpinned work even on a configured streaming runner and preserves old claim routing', async () => {
  const a = await attempt(true, false);
  expect((await request(`/api/tasks/${a.taskId}/steering`, { ...a.ownership, expectedRevision: 0, text: 'Not pinned' })).body.error.code).toBe('steering_profile_unsupported');
  const r = await runner(true), wrong = await runner(false);
  const accepted = await request('/api/tasks', { title: 'Pinned', harness: 'claude', prompt: 'No model', executionProfile: r.profile.reference });
  await pool.query('UPDATE flow.tasks SET dispatch_ready=true WHERE id=$1', [accepted.body.task.id]);
  expect((await request('/api/runner/claim', {}, { token: wrong.token })).body.assignment).toBeNull();
  const claimed = await request('/api/runner/claim', {}, { token: r.token });
  expect(claimed.body.assignment.task.executionProfile).toEqual(r.profile.reference);
});
it('accepts and replays a recognized current profile, but rechecks revocation before replay', async () => {
  const a = await attempt(true), key = randomUUID();
  const input = { ...a.ownership, expectedRevision: 0, text: 'New direction' };
  const first = await request(`/api/tasks/${a.taskId}/steering`, input, { key });
  expect(first.status).toBe(202);
  expect((await request(`/api/tasks/${a.taskId}/steering`, input, { key })).body).toEqual({ ...first.body, replayed: true });
  expect((await request(`/api/tasks/${a.taskId}/steering`, { ...input, ownerVersion: 999 }, { key })).status).toBe(409);
  await request(`/api/runners/${a.runnerId}/revoke`, {});
  expect((await request(`/api/tasks/${a.taskId}/steering`, input, { key })).status).toBe(401);
  expect((await request(`/api/tasks/${a.taskId}/steering`)).body.commands).toHaveLength(1);
});
it('checks the current task pin before replay and rejects wrong runner, profile or digest without new durable facts', async () => {
  const a = await attempt(true), b = await runner(true), key = randomUUID();
  const input = { ...a.ownership, expectedRevision: 0, text: 'Only here' };
  expect((await request(`/api/tasks/${a.taskId}/steering`, input, { key })).status).toBe(202);
  // Fault injection models stale/corrupt assignment input; the profile itself remains immutable.
  for (const pin of [b.profile.reference, { ...a.profile.reference, configDigest: 'f'.repeat(64) }, { ...a.profile.reference, id: randomUUID() }]) {
    await pool.query("UPDATE flow.tasks SET submission=jsonb_set(submission,'{executionProfile}',$2) WHERE id=$1", [a.taskId, JSON.stringify(pin)]);
    expect((await request(`/api/tasks/${a.taskId}/steering`, input, { key })).status).toBe(409);
  }
  await pool.query("UPDATE flow.tasks SET submission=jsonb_set(submission,'{executionProfile}',$2) WHERE id=$1", [a.taskId, JSON.stringify(a.profile.reference)]);
  expect((await request(`/api/tasks/${a.taskId}/steering`, input, { key })).body.replayed).toBe(true);
  expect((await request(`/api/tasks/${a.taskId}/steering`)).body.commands).toHaveLength(1);
});
it('rejects unknown declarations and configuration mutation, then preserves profiles and command receipts across restart', async () => {
  const a = await attempt(true), key = randomUUID();
  const input = { ...a.ownership, expectedRevision: 0, text: 'Restart persists' };
  const accepted = await request(`/api/tasks/${a.taskId}/steering`, input, { key });
  expect(accepted.status).toBe(202);
  expect((await request('/api/runner/execution-profile', { configuration: { ...configuration(true), activeSteering: { protocol: 'future' } } }, { token: a.token })).status).toBe(400);
  expect((await request('/api/runner/execution-profile', { configuration: configuration(false) }, { token: a.token })).status).toBe(409);
  await app.close(); await start();
  expect((await request('/api/runner/execution-profile', { configuration: configuration(true) }, { token: a.token })).body).toEqual({ profile: a.profile, replayed: true });
  expect((await request(`/api/tasks/${a.taskId}/steering`, input, { key })).body).toEqual({ ...accepted.body, replayed: true });
  await app.close(); await start(false);
  expect((await request(`/api/tasks/${a.taskId}/steering`, input, { key })).body.error.code).toBe('steering_unsupported');
  expect((await request(`/api/tasks/${a.taskId}/steering`)).body.commands).toHaveLength(1);
  await app.close(); await start();
});

it('runs legacy unpinned work through string input even when the same runner publishes steering capability', async () => {
  const { mkdtemp, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os'); const { join } = await import('node:path');
  const { createClaudeAdapter } = await import('../../../runner/src/claude.js');
  const { describeExecutionProfile, guardExecutionProfile } = await import('../../../runner/src/execution-profiles.js');
  const { runRunner } = await import('../../../runner/src/runtime.js');
  const directory = await mkdtemp(join(tmpdir(), 'flow-chat09-legacy-')), stop = new AbortController();
  const nativeSessionId = randomUUID(); let queryCalls = 0;
  type Query = NonNullable<Parameters<typeof createClaudeAdapter>[0]['query']>;
  type Message = ReturnType<Query> extends AsyncIterable<infer M> ? M : never;
  const query: Query = ({ prompt }) => Object.assign((async function* () {
    queryCalls++; expect(prompt).toBe('Legacy input');
    yield { type: 'system', subtype: 'init', uuid: randomUUID(), session_id: nativeSessionId, model: 'synthetic', permissionMode: 'dontAsk', tools: [], plugins: [], skills: [], mcp_servers: [], claude_code_version: 'injected' } as unknown as Message;
    yield { type: 'result', subtype: 'success', uuid: randomUUID(), session_id: nativeSessionId, result: 'Legacy answer', is_error: false, modelUsage: {}, permission_denials: [] } as unknown as Message;
  })(), { close() {} });
  const options = { materialFiles: [], model: 'synthetic', timeoutMs: 5000, query };
  const adapter = createClaudeAdapter(options), config = describeExecutionProfile(options, adapter, true);
  const r = (await request('/api/runners', { name: 'Legacy mode proof', harnesses: ['claude'], capacity: 1 })).body;
  const publication = await request('/api/runner/execution-profile', { configuration: config }, { token: r.token }); expect(publication.status).toBe(200);
  const submitted = await request('/api/tasks', { title: 'Legacy despite new runner', harness: 'claude', prompt: 'Legacy input' });
  const taskId = submitted.body.task.id;
  await pool.query('UPDATE flow.tasks SET dispatch_ready=true WHERE id=$1', [taskId]);
  const running = runRunner({ baseUrl: base, token: r.token, workingDirectory: directory, signal: stop.signal, activeSteering: true, heartbeatIntervalMs: 50, pollIntervalMs: 20,
    adapters: [guardExecutionProfile(adapter, publication.body.profile.reference, config)] });
  try {
    await expect.poll(async () => (await request(`/api/tasks/${taskId}`)).body.status, { timeout: 8000, interval: 20 }).toBe('succeeded');
    expect(queryCalls).toBe(1);
    expect((await request(`/api/tasks/${taskId}/assistant-messages`)).body.messages).toHaveLength(1);
    expect((await pool.query('SELECT 1 FROM flow.steering_attempts WHERE task_id=$1', [taskId])).rowCount).toBe(0);
  } finally { stop.abort(); await running; await rm(directory, { recursive: true, force: true }); }
});
