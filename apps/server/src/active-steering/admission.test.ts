import { randomUUID } from 'node:crypto';
import Fastify from 'fastify';
import { Pool } from 'pg';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { describeExecutionProfile } from '../../../runner/src/execution-profiles.js';
import { createServer } from '../index.js';
import { HttpError, migrate, sha256 } from '../database.js';
import { sealForFinal, registerActiveSteeringRoutes } from './index.js';

const database = `flow_chat10_${randomUUID().replaceAll('-', '')}`;
const admin = new Pool({ connectionString: 'postgresql://flow:flow-local-only@127.0.0.1:55432/postgres', max: 1 });
const databaseUrl = `postgresql://flow:flow-local-only@127.0.0.1:55432/${database}`;
const pool = new Pool({ connectionString: databaseUrl, max: 5 });
let app: Awaited<ReturnType<typeof createServer>>, base = '', created = false;
beforeAll(async () => {
  await admin.query(`CREATE DATABASE ${database}`); created = true;
  app = await createServer({ databaseUrl, ownerToken: 'chat10-owner', automaticQueueScan: false, leaseMs: 300_000, activeSteering: true });
  base = await app.listen({ host: '127.0.0.1', port: 0 });
});
afterAll(async () => {
  try { if (app) { app.server.closeAllConnections(); await app.close(); } }
  finally { await pool.end(); try { if (created) await admin.query(`DROP DATABASE ${database}`); } finally { await admin.end(); } }
});
async function request(path: string, body?: unknown, token = 'chat10-owner', status = 200, key = randomUUID()) {
  const response = await fetch(`${base}${path}`, { method: body === undefined ? 'GET' : 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', 'idempotency-key': key },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(5000) });
  const value = await response.json(); expect(response.status, JSON.stringify(value)).toBe(status);
  if (path.includes('/steering/admission') && response.ok) expect(response.headers.get('cache-control')).toBe('no-store');
  return value;
}
async function attempt(steering = true) {
  const runner = await request('/api/runners', { name: 'Admission-only synthetic runner', harnesses: ['claude'], capacity: 1 });
  const configuration = describeExecutionProfile({ materialFiles: [] }, { name: 'claude', version: 'claude-sdk-0.3.290-v2', async run() {} }, steering);
  const profile = (await request('/api/runner/execution-profile', { configuration }, runner.token)).profile;
  const task = (await request('/api/tasks', { executionProfile: profile.reference, title: 'Admission', prompt: 'No provider', harness: 'claude' }, undefined, 202)).task;
  await pool.query('UPDATE flow.tasks SET dispatch_ready=true WHERE id=$1', [task.id]);
  const claim = await request('/api/runner/claim', {}, runner.token);
  expect(claim.assignment.task.id).toBe(task.id);
  const ownership = { attemptId: claim.assignment.attempt.id, ownerVersion: claim.assignment.attempt.ownerVersion };
  const session = randomUUID();
  await request('/api/runner/events', { ...ownership, events: [{ id: randomUUID(), sequence: 1, type: 'session', nativeSessionId: session, adapterVersion: 'claude-sdk-0.3.290-v2' }] }, runner.token);
  return { ...runner, taskId: task.id as string, ownership, session, profile };
}
const path = (taskId: string) => `/api/tasks/${taskId}/steering/admission`;
async function counts() {
  return (await pool.query(`SELECT (SELECT count(*)::int FROM flow.steering_attempts) controls,
    (SELECT count(*)::int FROM flow.steering_commands) commands, (SELECT count(*)::int FROM flow.steering_audit) audits,
    (SELECT count(*)::int FROM flow.commands) receipts`)).rows[0];
}
it('returns current readiness over real owner HTTP without creating control, command, audit or receipt', async () => {
  const a = await attempt(), before = await counts();
  for (let i = 0; i < 2; i++) expect(await request(path(a.taskId))).toEqual({ taskId: a.taskId, ...a.ownership, revision: 0, state: 'ready', reason: 'ready' });
  expect(await counts()).toEqual(before);
});
it('authenticates the owner and rejects unknown or cross-task attempt identities', async () => {
  const a = await attempt(), b = await attempt();
  await request(path(a.taskId), undefined, 'invalid', 401);
  await request(path(a.taskId), undefined, a.token, 403);
  await request(`${path(a.taskId)}?attemptId=${b.ownership.attemptId}`, undefined, undefined, 404);
  await request(`${path(a.taskId)}?attemptId=${randomUUID()}`, undefined, undefined, 404);
  await request(`${path(a.taskId)}?unexpected=1`, undefined, undefined, 400);
});
it('reports no attempt and explicit historical attempts without changing old attemptAvailable semantics', async () => {
  const task = (await request('/api/tasks', { title: 'Unclaimed', prompt: 'No runner', harness: 'fixture' }, undefined, 202)).task;
  expect(await request(path(task.id))).toMatchObject({ state: 'unavailable', reason: 'no-attempt', attemptId: null, ownerVersion: null, revision: null });
  const a = await attempt();
  await pool.query('UPDATE flow.tasks SET current_attempt_id=NULL WHERE id=$1', [a.taskId]);
  expect(await request(`${path(a.taskId)}?attemptId=${a.ownership.attemptId}`)).toMatchObject({ reason: 'not-current', ...a.ownership });
});
it.each(['stale-owner', 'decision-pending', 'not-running', 'lease-expired', 'runner-revoked', 'session-unavailable'] as const)('reports %s and POST rechecks current authority', async reason => {
  const a = await attempt();
  if (reason === 'stale-owner') await pool.query('UPDATE flow.tasks SET owner_version=owner_version+1 WHERE id=$1', [a.taskId]);
  if (reason === 'decision-pending') await pool.query("UPDATE flow.tasks SET pending_decision='{}'::jsonb WHERE id=$1", [a.taskId]);
  if (reason === 'not-running') await pool.query('UPDATE flow.attempts SET completed_at=clock_timestamp() WHERE id=$1', [a.ownership.attemptId]);
  if (reason === 'lease-expired') await pool.query("UPDATE flow.attempts SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE id=$1", [a.ownership.attemptId]);
  if (reason === 'runner-revoked') await pool.query('UPDATE flow.runners SET revoked=true WHERE id=$1', [a.runnerId]);
  if (reason === 'session-unavailable') await pool.query('UPDATE flow.sessions SET active_task_id=NULL WHERE id=$1', [a.session]);
  expect(await request(path(a.taskId))).toMatchObject({ state: 'unavailable', reason });
  await request(`/api/tasks/${a.taskId}/steering`, { ...a.ownership, expectedRevision: 0, text: 'Too late' }, undefined, reason === 'runner-revoked' ? 401 : 409);
});
it('rejects absent, legacy, unknown and unavailable profile pins while preserving old state availability', async () => {
  const legacy = await attempt(false);
  expect(await request(path(legacy.taskId))).toMatchObject({ reason: 'profile-unsupported' });
  expect((await request(`/api/tasks/${legacy.taskId}/steering`)).attemptAvailable).toBe(true);
  const absent = await attempt();
  await pool.query("UPDATE flow.tasks SET submission=submission-'executionProfile' WHERE id=$1", [absent.taskId]);
  expect(await request(path(absent.taskId))).toMatchObject({ reason: 'profile-unsupported' });
  const stale = await attempt();
  await pool.query("UPDATE flow.tasks SET submission=jsonb_set(submission,'{executionProfile,configDigest}',to_jsonb($2::text)) WHERE id=$1", [stale.taskId, '0'.repeat(64)]);
  expect(await request(path(stale.taskId))).toMatchObject({ reason: 'profile-unavailable' });
  // Fault injection changes the immutable table only in this owned database.
  const unknown = await attempt();
  await pool.query('ALTER TABLE flow.execution_profiles DISABLE TRIGGER USER');
  try {
    await pool.query("UPDATE flow.execution_profiles SET configuration=jsonb_set(configuration,'{activeSteering,protocol}','\"future\"') WHERE id=$1", [unknown.profile.reference.id]);
  } finally { await pool.query('ALTER TABLE flow.execution_profiles ENABLE TRIGGER USER'); }
  expect(await request(path(unknown.taskId))).toMatchObject({ reason: 'profile-unsupported' });
});
it('distinguishes pending and unknown, allows same-key replay, and becomes ready after explicit rejection', async () => {
  const a = await attempt(), input = { ...a.ownership, expectedRevision: 0, text: 'Synthetic instruction' }, key = randomUUID();
  const first = await request(`/api/tasks/${a.taskId}/steering`, input, undefined, 202, key);
  expect(await request(path(a.taskId))).toMatchObject({ reason: 'pending', revision: 1 });
  expect(await request(`/api/tasks/${a.taskId}/steering`, input, undefined, 202, key)).toEqual({ ...first, replayed: true });
  const receipt = { ...a.ownership, commandId: first.command.id, nativeSessionId: a.session, userMessageUuid: first.command.userMessageUuid, receiptId: randomUUID(), expectedReceiptRevision: 0 };
  await request('/api/runner/steering/receipts', { ...receipt, phase: 'rejected', reason: 'Synthetic consumer did not submit input.' }, a.token);
  expect(await request(path(a.taskId))).toMatchObject({ reason: 'ready', revision: 1 });
  const next = await request(`/api/tasks/${a.taskId}/steering`, { ...input, expectedRevision: 1 }, undefined, 202);
  await request('/api/runner/steering/receipts', { ...receipt, commandId: next.command.id, userMessageUuid: next.command.userMessageUuid, receiptId: randomUUID(), phase: 'unknown', reason: 'Consumption unavailable.' }, a.token);
  expect(await request(path(a.taskId))).toMatchObject({ reason: 'unknown-pending', revision: 2 });
});
it('treats readiness as a snapshot: a command winning later causes a stale POST to reject', async () => {
  const a = await attempt(), ready = await request(path(a.taskId));
  await request(`/api/tasks/${a.taskId}/steering`, { ...a.ownership, expectedRevision: ready.revision, text: 'Winner' }, undefined, 202);
  await request(`/api/tasks/${a.taskId}/steering`, { ...a.ownership, expectedRevision: ready.revision, text: 'Stale request' }, undefined, 409);
  expect(await request(path(a.taskId))).toMatchObject({ reason: 'pending' });
});
it('does not block a seal lock and a later committed seal rejects a previously ready command', async () => {
  const a = await attempt(), ready = await request(path(a.taskId)), client = await pool.connect();
  try {
    await client.query('BEGIN');
    await sealForFinal(client, a.runnerId, { ...a.ownership, expectedRevision: 0, final: { nativeSessionId: a.session, sourceMessageId: randomUUID(), contentDigest: sha256('Synthetic final') } });
    // The read-only snapshot sees the prior committed state; it cannot wait on row locks or reserve it.
    expect(await request(path(a.taskId))).toMatchObject({ reason: 'ready' });
    await client.query('COMMIT');
  } finally { await client.query('ROLLBACK'); client.release(); }
  await request(`/api/tasks/${a.taskId}/steering`, { ...a.ownership, expectedRevision: ready.revision, text: 'Too late' }, undefined, 409);
  expect(await request(path(a.taskId))).toMatchObject({ reason: 'sealed' });
});
it('reports a canonical final and the command quota without exposing input or reply text', async () => {
  const a = await attempt(), text = 'Synthetic final body', sourceMessageId = randomUUID();
  await request('/api/runner/events', { ...a.ownership, events: [{ id: randomUUID(), sequence: 2, type: 'assistant-final',
    messageId: sha256(JSON.stringify([a.session, sourceMessageId])), nativeSessionId: a.session, source: 'claude.sdk.result', sourceMessageId, content: text,
    settings: { requested: { model: 'synthetic', permissionMode: 'dontAsk', thinking: 'disabled' }, effective: { model: 'synthetic', tools: [], permissionMode: 'dontAsk', thinking: 'unknown' } } }] }, a.token);
  const result = await request(path(a.taskId)); expect(result.reason).toBe('final-exists'); expect(JSON.stringify(result)).not.toContain(text);
  const b = await attempt();
  await pool.query('INSERT INTO flow.steering_attempts(attempt_id,task_id,revision) VALUES($1,$2,64)', [b.ownership.attemptId, b.taskId]);
  expect(await request(path(b.taskId))).toMatchObject({ reason: 'limit-reached', revision: 64 });
});
it('keeps default-off safe before 024 exists and enabled-but-uninstalled explicitly unavailable', async () => {
  const name = `flow_chat10_old_${randomUUID().replaceAll('-', '')}`;
  await admin.query(`CREATE DATABASE ${name}`);
  const old = new Pool({ connectionString: databaseUrl.replace(database, name), max: 1 });
  const apps: ReturnType<typeof Fastify>[] = [];
  try {
    await migrate(old);
    const id = randomUUID();
    await old.query('INSERT INTO flow.tasks(id,submission) VALUES($1,$2)', [id, { title: 'Old schema task', prompt: 'Synthetic only', harness: 'claude' }]);
    expect((await old.query('SELECT 1 FROM flow.migrations WHERE version=24')).rowCount).toBe(0);
    expect((await old.query("SELECT to_regclass('flow.steering_attempts') value")).rows[0].value).toBeNull();
    for (const acceptCommands of [undefined, true]) {
      const api = Fastify(); apps.push(api);
      api.setErrorHandler((error, _request, reply) => error instanceof HttpError ? reply.code(error.status).send({ error: error.code }) : reply.send(error));
      // This module-only old-schema composition has no public exposure beyond this dynamic loopback port.
      registerActiveSteeringRoutes(api, old, acceptCommands === undefined ? undefined : { acceptCommands });
      const address = await api.listen({ host: '127.0.0.1', port: 0 });
      const response = await fetch(`${address}${path(id)}`, { signal: AbortSignal.timeout(5000) });
      expect(response.status).toBe(200); expect(response.headers.get('cache-control')).toBe('no-store');
      expect(await response.json()).toMatchObject({ state: 'unavailable', reason: acceptCommands ? 'not-installed' : 'disabled', revision: null });
    }
    expect((await old.query("SELECT to_regclass('flow.steering_attempts') value")).rows[0].value).toBeNull();
    expect((await old.query('SELECT count(*)::int n FROM flow.commands')).rows[0].n).toBe(0);
  } finally {
    for (const api of apps) { api.server.closeAllConnections(); await api.close(); }
    await old.end(); await admin.query(`DROP DATABASE ${name}`);
  }
});
it('keeps the real server factory disabled by default despite an otherwise ready profile and request headers', async () => {
  const a = await attempt();
  const disabled = await createServer({ databaseUrl, ownerToken: 'chat10-owner', automaticQueueScan: false, leaseMs: 300_000 });
  try {
    const address = await disabled.listen({ host: '127.0.0.1', port: 0 });
    const response = await fetch(`${address}${path(a.taskId)}`, {
      headers: { authorization: 'Bearer chat10-owner', 'x-flow-active-steering': '1', 'x-flow-execution-profile': 'steering-v1' }, signal: AbortSignal.timeout(5000),
    });
    expect(response.status).toBe(200); expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toMatchObject({ ...a.ownership, revision: null, state: 'unavailable', reason: 'disabled' });
    const rejected = await fetch(`${address}/api/tasks/${a.taskId}/steering`, { method: 'POST',
      headers: { authorization: 'Bearer chat10-owner', 'content-type': 'application/json', 'idempotency-key': randomUUID(), 'x-flow-active-steering': '1' },
      body: JSON.stringify({ ...a.ownership, expectedRevision: 0, text: 'Cannot opt in remotely' }), signal: AbortSignal.timeout(5000) });
    expect(rejected.status).toBe(409); expect((await rejected.json()).error.code).toBe('steering_unsupported');
  } finally { disabled.server.closeAllConnections(); await disabled.close(); }
});
it('reports incomplete installation instead of reading an absent relation, then recovers after restoration', async () => {
  const a = await attempt();
  await pool.query('ALTER TABLE flow.steering_commands RENAME TO chat10_hidden_commands');
  try { expect(await request(path(a.taskId))).toMatchObject({ reason: 'not-installed', revision: null }); }
  finally { await pool.query('ALTER TABLE flow.chat10_hidden_commands RENAME TO steering_commands'); }
  expect(await request(path(a.taskId))).toMatchObject({ reason: 'ready', revision: 0 });
});
