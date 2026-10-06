import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { createServer } from '../index.js';
import { migrateProtocolDispatch, registerProtocolDispatch } from './index.js';

const databaseUrl = 'postgresql://flow:flow-local-only@127.0.0.1:55432/flow_p02';
const ownerToken = 'p02-owner-fixture';
let pool: Pool;
let server: Awaited<ReturnType<typeof createServer>>;
let baseUrl: string;
async function start() {
  server = await createServer({ databaseUrl, ownerToken, leaseMs: 15_000 });
  await migrateProtocolDispatch(pool);
  if (!server.hasRoute({ method: 'POST', url: '/api/runner/protocol/prepare' })) registerProtocolDispatch(server, pool);
  baseUrl = await server.listen({ host: '127.0.0.1', port: 0 });
}
async function request(path: string, body?: object, token = ownerToken) {
  const response = await fetch(baseUrl + path, { method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'Idempotency-Key': randomUUID() }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: response.status, body: await response.json() as any };
}
async function assignment() {
  const registration = await request('/api/runners', { name: 'A2A runner', harnesses: ['a2a'] });
  expect(registration.status).toBe(200);
  const submitted = await request('/api/tasks', { title: 'Remote work', prompt: 'Produce an artifact.', harness: 'a2a', protocol: { endpointRef: 'peer' } });
  expect(submitted.status).toBe(202);
  let claimed: any;
  await expect.poll(async () => { claimed = (await request('/api/runner/claim', {}, registration.body.token)).body.assignment; return claimed; }).toBeTruthy();
  return { token: registration.body.token as string, taskId: submitted.body.task.id as string, fence: { attemptId: claimed.attempt.id as string, ownerVersion: claimed.attempt.ownerVersion as number } };
}
beforeEach(async () => { pool = new Pool({ connectionString: databaseUrl }); await pool.query('DROP SCHEMA IF EXISTS flow CASCADE; DROP SCHEMA IF EXISTS pgboss CASCADE'); await start(); });
afterEach(async () => { await server?.close(); await pool?.end(); });

test('one durable dispatch permit and binding survive center restart without another send permission', async () => {
  const { token, taskId, fence } = await assignment();
  const prepared = await request('/api/runner/protocol/prepare', { ...fence, endpointDigest: 'a'.repeat(64) }, token);
  expect(prepared.status).toBe(200); expect(prepared.body.intent.phase).toBe('prepared');
  expect((await request('/api/runner/protocol/prepare', { ...fence, endpointDigest: 'b'.repeat(64) }, token)).status).toBe(409);
  const command = { ...fence, commandId: prepared.body.intent.commandId };
  const race = await Promise.all([request('/api/runner/protocol/begin', command, token), request('/api/runner/protocol/begin', command, token)]);
  expect(race.filter(result => result.body.maySend)).toHaveLength(1);
  expect(race.every(result => result.status === 200)).toBe(true);
  const bound = await request('/api/runner/protocol/bind', { ...command, remoteTaskId: 'remote-task-1' }, token);
  expect(bound.body.intent.phase).toBe('bound');
  await server.close(); await start();
  const recovered = await request('/api/runner/protocol/recover', {}, token);
  expect(recovered.body.assignments[0].assignment.task.id).toBe(taskId);
  expect(recovered.body.assignments[0].assignment.attempt.ownerVersion).toBe(fence.ownerVersion);
  expect(recovered.body.assignments[0].remainingLeaseMs).toBeGreaterThan(0);
  expect((await request('/api/runner/protocol/begin', command, token)).body.maySend).toBe(false);
  expect((await request(`/api/tasks/${taskId}/protocol`)).body.intent.remoteTaskId).toBe('remote-task-1');
  expect((await request('/api/runner/protocol/bind', { ...command, remoteTaskId: 'different' }, token)).status).toBe(409);
});

test('recovery of a sending intent without remote ID becomes uncertain and never grants another send', async () => {
  const { token, taskId, fence } = await assignment();
  const state = (await request('/api/runner/protocol/prepare', { ...fence, endpointDigest: 'a'.repeat(64) }, token)).body;
  const command = { ...fence, commandId: state.intent.commandId };
  expect((await request('/api/runner/protocol/begin', command, token)).body.maySend).toBe(true);
  await server.close(); await start();
  expect((await request('/api/runner/protocol/recover', {}, token)).body.assignments).toEqual([]);
  const saved = (await request(`/api/tasks/${taskId}/protocol`)).body;
  expect(saved.intent.phase).toBe('uncertain'); expect(saved.intent.reason).toBe('recovered-inflight-send');
  expect(saved.taskStatus).toBe('uncertain');
  expect((await request('/api/runner/protocol/begin', command, token)).status).toBe(409);
  expect((await request('/api/runner/heartbeat', fence, token)).body.action).toBe('stop');
  expect((await request('/api/runner/claim', {}, token)).body.assignment).toBeNull();
});

test('binding and cancellation remain fenced; expiry cannot be revived by recovery', async () => {
  const { token, taskId, fence } = await assignment();
  const prepared = (await request('/api/runner/protocol/prepare', { ...fence, endpointDigest: 'a'.repeat(64) }, token)).body;
  const command = { ...fence, commandId: prepared.intent.commandId };
  expect((await request('/api/runner/protocol/begin', { ...command, ownerVersion: fence.ownerVersion + 1 }, token)).status).toBe(409);
  expect((await request('/api/runner/protocol/begin', command)).status).toBe(403);
  await request('/api/runner/protocol/begin', command, token);
  await request('/api/runner/protocol/bind', { ...command, remoteTaskId: 'remote-cancel' }, token);
  await request(`/api/tasks/${taskId}/cancel`, {});
  expect((await request('/api/runner/protocol/cancel-start', command, token)).body.maySend).toBe(true);
  expect((await request('/api/runner/protocol/cancel-start', command, token)).body.maySend).toBe(false);
  expect((await request(`/api/tasks/${taskId}`)).body.status).toBe('cancel_requested');
  // Fault injection advances only this fixture's lease, then observations use public HTTP.
  await pool.query("UPDATE flow.attempts SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE id=$1", [fence.attemptId]);
  expect((await request('/api/runner/protocol/recover', {}, token)).body.assignments).toEqual([]);
  expect((await request('/api/runner/protocol/prepare', { ...fence, endpointDigest: 'a'.repeat(64) }, token)).status).toBe(409);
  expect((await request('/api/runner/heartbeat', fence, token)).body.action).toBe('stop');
});
