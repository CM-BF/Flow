import { randomUUID } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import { beforeAll, afterAll, it, expect } from 'vitest';
import { createServer } from '../index.js';
import { migrateRunnerMaintenance, registerRunnerMaintenanceRoutes } from './index.js';
const databaseUrl = 'postgresql://flow:flow-local-only@127.0.0.1:55432/flow_svc02';
const admin = new Pool({ connectionString: 'postgresql://flow:flow-local-only@127.0.0.1:55432/postgres', max: 1 });
const pool = new Pool({ connectionString: databaseUrl, max: 8, statement_timeout: 5000 });
let lock: PoolClient | undefined; let created = false;
let app: Awaited<ReturnType<typeof createServer>> | undefined; let url: string;
async function start() {
  app = await createServer({ databaseUrl, ownerToken: 'svc02-owner', leaseMs: 10_000 });
  if (!app.hasRoute({ method: 'GET', url: '/api/runners/:id/maintenance' })) {
    await migrateRunnerMaintenance(pool); registerRunnerMaintenanceRoutes(app, pool);
  }
  url = await app.listen({ host: '127.0.0.1', port: 0 });
}
async function stop() { app?.server.closeAllConnections(); await app?.close(); app = undefined; }
beforeAll(async () => {
  lock = await admin.connect();
  if (!(await lock.query("SELECT pg_try_advisory_lock(hashtextextended('flow_svc02_test',0)) AS ok")).rows[0].ok) throw new Error('SVC02 database busy');
  if ((await lock.query("SELECT 1 FROM pg_database WHERE datname='flow_svc02'")).rowCount) throw new Error('Existing SVC02 database retained');
  await lock.query('CREATE DATABASE flow_svc02'); created = true; await start();
});
afterAll(async () => {
  try { await stop(); } finally { await pool.end(); try { if (created) await lock?.query('DROP DATABASE flow_svc02'); } finally { lock?.release(); await admin.end(); } }
});
async function request(path: string, body?: unknown, token = 'svc02-owner', key = randomUUID()) {
  const response = await fetch(`${url}${path}`, { method: body === undefined ? 'GET' : 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', 'idempotency-key': key }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(5000) });
  return { status: response.status, body: await response.json() };
}
async function runner() { return (await request('/api/runners', { name: 'SVC02 fixture runner', harnesses: ['fixture'] })).body as { runnerId: string; token: string }; }
it('durably stops new claims, replays the same drain receipt, and resumes only explicitly', async () => {
  const identity = await runner(); const path = `/api/runners/${identity.runnerId}/maintenance`;
  const command = { version: 0, operationId: randomUUID(), reason: 'Planned local update' }; const key = randomUUID();
  const drain = await request(`${path}/drain`, command, undefined, key);
  expect(drain.status).toBe(200);
  expect(drain.body.state).toMatchObject({ state: 'draining', version: 1 });
  expect((await request(`${path}/drain`, command, undefined, key)).body).toEqual({ ...drain.body, replayed: true });
  const admission = await request('/api/tasks', { title: 'Retained queued work', harness: 'fixture', prompt: 'success' });
  expect(admission.status).toBe(202);
  await pool.query('UPDATE flow.tasks SET dispatch_ready=true WHERE id=$1', [admission.body.task.id]);
  expect((await request('/api/runner/claim', {}, identity.token)).body.assignment).toBeNull();
  await stop(); await start();
  expect((await request(path)).body).toMatchObject({ state: 'draining', version: 1, activeAttempts: 0, stopPermitted: false });
  expect((await request(`${path}/resume`, { ...command, version: 1 })).status).toBe(200);
  const claim = await request('/api/runner/claim', {}, identity.token);
  expect(claim.body.assignment.task.id).toBe(admission.body.task.id);
  await request('/api/runner/events', { attemptId: claim.body.assignment.attempt.id, ownerVersion: claim.body.assignment.attempt.ownerVersion, events: [{ id: randomUUID(), sequence: 1, type: 'completed', outcome: 'succeeded' }] }, identity.token);
});

import { commandRunnerMaintenance } from './store.js';
import { claim as legacyClaim } from './legacy-75a33.fixture.js';
async function submit(prompt: string, resumeSessionId?: string) {
  const value = await request('/api/tasks', { title: prompt, harness: 'fixture', prompt, ...(resumeSessionId ? { resumeSessionId } : {}) });
  expect(value.status).toBe(202);
  await pool.query('UPDATE flow.tasks SET dispatch_ready=true WHERE id=$1', [value.body.task.id]);
  return value.body.task.id as string;
}
async function complete(identity: { token: string }, assignment: { attempt: { id: string; ownerVersion: number } }, session?: string) {
  const events = [...(session ? [{ id: randomUUID(), sequence: 1, type: 'session', nativeSessionId: session, adapterVersion: '1', resources: [] }] : []), { id: randomUUID(), sequence: session ? 2 : 1, type: 'completed', outcome: 'succeeded' }];
  expect((await request('/api/runner/events', { attemptId: assignment.attempt.id, ownerVersion: assignment.attempt.ownerVersion, events }, identity.token)).status).toBe(200);
}
it('fences the exact legacy claim transaction and rolls back its already-written session reservation', async () => {
  const identity = await runner(); await submit('Seed session');
  const initial = (await legacyClaim(pool, identity.runnerId, 10_000)).assignment!;
  const session = randomUUID(); await complete(identity, initial, session);
  const taskId = await submit('Resume remains queued', session);
  const input = { version: 0, operationId: randomUUID(), reason: 'Old center bootstrap' };
  await commandRunnerMaintenance(pool, identity.runnerId, 'drain', input, randomUUID(), 'trusted-host');
  await expect(legacyClaim(pool, identity.runnerId, 10_000)).rejects.toMatchObject({ code: '55000' });
  const task = (await request(`/api/tasks/${taskId}`)).body;
  expect(task).toMatchObject({ id: taskId, status: 'queued' });
  expect((await pool.query('SELECT active_task_id FROM flow.sessions WHERE id=$1', [session])).rows).toEqual([{ active_task_id: null }]);
  expect((await pool.query('SELECT id FROM flow.attempts WHERE task_id=$1', [taskId])).rowCount).toBe(0);
  expect((await pool.query('SELECT owner_version,current_attempt_id FROM flow.tasks WHERE id=$1', [taskId])).rows).toEqual([{ owner_version: 0, current_attempt_id: null }]);
  await request(`/api/tasks/${taskId}/cancel`, {});
});
it('keeps heartbeats and final event retransmission working while draining, then denies HTTP release of maintenance', async () => {
  const identity = await runner(); await submit('Active completes during drain');
  const assignment = (await legacyClaim(pool, identity.runnerId, 10_000)).assignment!;
  const path = `/api/runners/${identity.runnerId}/maintenance`; const input = { version: 0, operationId: randomUUID(), reason: 'Controlled update' };
  await commandRunnerMaintenance(pool, identity.runnerId, 'drain', input, randomUUID(), 'trusted-host');
  await expect(commandRunnerMaintenance(pool, identity.runnerId, 'hold', { ...input, version: 1 }, randomUUID(), 'trusted-host')).rejects.toMatchObject({ code: 'maintenance_busy' });
  const ownership = { attemptId: assignment.attempt.id, ownerVersion: assignment.attempt.ownerVersion };
  expect((await request('/api/runner/heartbeat', ownership, identity.token)).body.action).toBe('continue');
  const batch = { ...ownership, events: [{ id: randomUUID(), sequence: 1, type: 'completed', outcome: 'succeeded' }] };
  expect((await request('/api/runner/events', batch, identity.token)).body).toMatchObject({ accepted: 1, lastSequence: 1 });
  expect((await request('/api/runner/events', batch, identity.token)).body).toMatchObject({ accepted: 0, lastSequence: 1 });
  expect((await commandRunnerMaintenance(pool, identity.runnerId, 'hold', { ...input, version: 1 }, randomUUID(), 'trusted-host')).state.state).toBe('maintenance');
  expect((await request(`${path}/resume`, { ...input, version: 2 })).status).toBe(409);
  expect((await request(path)).body).toMatchObject({ state: 'maintenance', activeAttempts: 0 });
  expect((await commandRunnerMaintenance(pool, identity.runnerId, 'resume', { ...input, version: 2 }, randomUUID(), 'trusted-host')).state.state).toBe('accepting');
});
it('does not treat an uncertain attempt or expired lease as safe to stop', async () => {
  const identity = await runner(); const taskId = await submit('Uncertain keeps occupancy');
  const assignment = (await legacyClaim(pool, identity.runnerId, 10_000)).assignment!;
  await pool.query("UPDATE flow.attempts SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE id=$1", [assignment.attempt.id]);
  await request('/api/runner/heartbeat', { attemptId: assignment.attempt.id, ownerVersion: assignment.attempt.ownerVersion }, identity.token);
  const input = { version: 0, operationId: randomUUID(), reason: 'Cannot assume stopped' };
  await commandRunnerMaintenance(pool, identity.runnerId, 'drain', input, randomUUID(), 'trusted-host');
  expect((await request(`/api/runners/${identity.runnerId}/maintenance`)).body).toMatchObject({ activeAttempts: 1, uncertainAttempts: 1 });
  await expect(commandRunnerMaintenance(pool, identity.runnerId, 'hold', { ...input, version: 1 }, randomUUID(), 'trusted-host')).rejects.toMatchObject({ code: 'maintenance_busy' });
  expect((await request(`/api/tasks/${taskId}`)).body.status).toBe('uncertain');
});
it('enforces roles, command identity, immutable audit and stale versions without consuming rejected keys', async () => {
  const identity = await runner(); const path = `/api/runners/${identity.runnerId}/maintenance`;
  const input = { version: 0, operationId: randomUUID(), reason: 'Audit contract' }; const key = randomUUID();
  expect((await request(`${path}/drain`, input, identity.token)).status).toBe(403);
  expect((await request(path, undefined, 'wrong')).status).toBe(401);
  expect((await request(`${path}/drain`, { ...input, unknown: true })).status).toBe(400);
  expect((await request(`${path}/drain`, input, undefined, key)).status).toBe(200);
  expect((await request(`${path}/drain`, { ...input, reason: 'different' }, undefined, key)).status).toBe(409);
  expect((await request(`${path}/resume`, input)).status).toBe(409);
  expect((await request(`${path}/resume`, { ...input, version: 1, operationId: randomUUID() })).status).toBe(409);
  const history = (await request(`${path}/history`)).body;
  expect(history.audits).toHaveLength(1); expect(history.audits[0].source).toBe('owner-http');
  await expect(pool.query('UPDATE flow.runner_maintenance_audit SET digest=$1 WHERE id=$2', ['changed', history.audits[0].id])).rejects.toMatchObject({ code: '55000' });
  expect((await request(`${path}/history?after=not-a-cursor`)).status).toBe(400);
});
it('serializes an in-flight legacy claim before drain and refuses hold until that real attempt finishes', async () => {
  const identity = await runner(); await submit('Old claim wins the lock first');
  const blocker = await pool.connect();
  const legacyPool = new Pool({ connectionString: databaseUrl, max: 1, application_name: 'svc02-legacy-race', statement_timeout: 5000 });
  try {
    await blocker.query('BEGIN'); await blocker.query('SELECT id FROM flow.runners WHERE id=$1 FOR UPDATE', [identity.runnerId]);
    const claiming = legacyClaim(legacyPool, identity.runnerId, 10_000);
    await expect.poll(async () => (await pool.query("SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname='flow_svc02' AND application_name='svc02-legacy-race' AND wait_event_type='Lock'")).rows[0].n).toBe(1);
    const input = { version: 0, operationId: randomUUID(), reason: 'Concurrent drain' };
    const draining = commandRunnerMaintenance(pool, identity.runnerId, 'drain', input, randomUUID(), 'trusted-host');
    await blocker.query('COMMIT');
    const assignment = (await claiming).assignment!; expect(assignment).toBeTruthy();
    expect((await draining).state.state).toBe('draining');
    await expect(commandRunnerMaintenance(pool, identity.runnerId, 'hold', { ...input, version: 1 }, randomUUID(), 'trusted-host')).rejects.toMatchObject({ code: 'maintenance_busy' });
    await complete(identity, assignment);
    expect((await commandRunnerMaintenance(pool, identity.runnerId, 'hold', { ...input, version: 1 }, randomUUID(), 'trusted-host')).state.state).toBe('maintenance');
  } finally { await blocker.query('ROLLBACK'); blocker.release(); await legacyPool.end(); }
});

it('lets drain commit first while the real legacy claim is queued on the same identity lock', async () => {
  const identity = await runner(); const taskId = await submit('Drain wins before old insert');
  const blocker = await pool.connect();
  const maintenancePool = new Pool({ connectionString: databaseUrl, max: 1, application_name: 'svc02-drain-first', statement_timeout: 5000 });
  try {
    await blocker.query('BEGIN'); await blocker.query('SELECT id FROM flow.runners WHERE id=$1 FOR UPDATE', [identity.runnerId]);
    const input = { version: 0, operationId: randomUUID(), reason: 'Drain first race' };
    const draining = commandRunnerMaintenance(maintenancePool, identity.runnerId, 'drain', input, randomUUID(), 'trusted-host');
    await expect.poll(async () => (await pool.query("SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname='flow_svc02' AND application_name='svc02-drain-first' AND wait_event_type='Lock'")).rows[0].n).toBe(1);
    const claiming = legacyClaim(pool, identity.runnerId, 10_000).then(value => ({ value }), error => ({ error }));
    await blocker.query('COMMIT');
    expect((await draining).state.state).toBe('draining');
    expect(await claiming).toMatchObject({ error: { code: '55000' } });
    expect((await request(`/api/tasks/${taskId}`)).body.status).toBe('queued');
    await request(`/api/tasks/${taskId}/cancel`, {});
  } finally { await blocker.query('ROLLBACK'); blocker.release(); await maintenancePool.end(); }
});
