import { createHash, randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Pool, type PoolClient } from 'pg';
import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from 'vitest';
import type { ClaimedTask } from '@flow/contracts';
import { createServer } from './index.js';

const databaseUrl = 'postgresql://flow:flow-local-only@127.0.0.1:55432/flow_c02';
const admin = new Pool({ connectionString: 'postgresql://flow:flow-local-only@127.0.0.1:55432/postgres', max: 1 });
const ownerToken = 'c02-local-owner';
let server: Awaited<ReturnType<typeof createServer>> | undefined;
let baseUrl: string;
let createdDatabase = false;
let databaseLock: PoolClient;
const taskInput = { title: 'C02 original task', prompt: 'Deterministic protocol fixture; no model', harness: 'fixture' };

async function request(path: string, payload?: unknown, token = ownerToken, key: string = randomUUID()) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: payload === undefined ? 'GET' : 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', 'idempotency-key': key },
    body: payload === undefined ? undefined : JSON.stringify(payload), signal: AbortSignal.timeout(5000),
  });
  return { status: response.status, body: await response.json() };
}
async function startServer() {
  server = await createServer({ databaseUrl, ownerToken, leaseMs: 800 });
  baseUrl = await server.listen({ host: '127.0.0.1', port: 0 });
}
async function claim(token: string): Promise<ClaimedTask> {
  let found: ClaimedTask | undefined;
  await expect.poll(async () => {
    found = (await request('/api/runner/claim', {}, token)).body.assignment;
    return found;
  }).toBeTruthy();
  return found!;
}
async function uncertainTask(resume = false, prompt = taskInput.prompt) {
  const runner = (await request('/api/runners', { name: 'C02 runner', harnesses: ['fixture'], capacity: 1 })).body;
  if (resume) {
    await request('/api/tasks', taskInput);
    const seed = await claim(runner.token);
    expect((await request('/api/runner/events', { attemptId: seed.attempt.id, ownerVersion: seed.attempt.ownerVersion, events: [
      { type: 'session', sequence: 1, id: 'seed-session', nativeSessionId: 'c02-session', adapterVersion: 'fixture/1' },
      { type: 'completed', sequence: 2, id: 'seed-done', outcome: 'succeeded' },
    ] }, runner.token)).status).toBe(200);
  }
  const task = (await request('/api/tasks', { ...taskInput, prompt, ...(resume ? { resumeSessionId: 'c02-session' } : {}) })).body.task;
  const assignment = await claim(runner.token);
  const ownership = { attemptId: assignment.attempt.id, ownerVersion: assignment.attempt.ownerVersion };
  const content = 'Retained pre-disconnect artifact';
  const version = createHash('sha256').update(content).digest('hex');
  const report = await request('/api/runner/events', { ...ownership, events: [
    { type: 'session', sequence: 1, id: 'session-record', nativeSessionId: 'c02-session', adapterVersion: 'fixture/1' },
    { type: 'artifact', sequence: 2, id: 'artifact-event', artifactId: 'output', title: 'Before interruption', content, version, mediaType: 'text/plain' },
  ] }, runner.token);
  expect(report.status).toBe(200);
  expect((await request('/api/runner/heartbeat', ownership, runner.token)).body.action).toBe('continue');
  await expect.poll(async () => (await request(`/api/tasks/${task.id}`)).body.status, { timeout: 4000 }).toBe('uncertain');
  return { runner, task, ownership, version };
}

beforeAll(async () => {
  databaseLock = await admin.connect();
  const locked = await databaseLock.query("SELECT pg_try_advisory_lock(hashtextextended('flow_c02_test_exclusive',0)) AS locked");
  if (!locked.rows[0]?.locked) throw new Error('Another C02 test run owns flow_c02');
  const exists = await databaseLock.query("SELECT 1 FROM pg_database WHERE datname='flow_c02'");
  if (!exists.rowCount) { await databaseLock.query('CREATE DATABASE flow_c02'); createdDatabase = true; }
});
beforeEach(async () => {
  const pool = new Pool({ connectionString: databaseUrl });
  try { await pool.query('DROP SCHEMA IF EXISTS flow CASCADE; DROP SCHEMA IF EXISTS pgboss CASCADE'); }
  finally { await pool.end(); }
  await startServer();
});
afterEach(async () => { await server?.close(); server = undefined; });
afterAll(async () => {
  try { if (createdDatabase) await databaseLock.query('DROP DATABASE flow_c02 WITH (FORCE)'); }
  finally { databaseLock?.release(); await admin.end(); }
});

it('shows durable uncertain ownership and retained evidence without interpreting lease expiry as a stop', async () => {
  const { task, ownership, version } = await uncertainTask();
  const response = await request(`/api/tasks/${task.id}/reconciliation`);
  expect(response.status).toBe(200);
  expect(response.body.task).toMatchObject({ id: task.id, status: 'uncertain' });
  expect(response.body.attempt).toMatchObject({ id: ownership.attemptId, ownerVersion: ownership.ownerVersion });
  expect(response.body.lastSequence).toBe(2);
  expect(response.body.lastHeartbeatAt).toEqual(expect.any(String));
  expect(response.body.lastEventAt).toEqual(expect.any(String));
  const artifact = response.body.evidence.find((item: { title: string }) => item.title === 'Before interruption');
  expect((await request(`/api/details/${artifact.id}`)).body.artifactVersion).toBe(version);
  expect(response.body.audit).toEqual([]);
});

it('restricts reconciliation to the owner and reports unknown clocks before any heartbeat or event', async () => {
  const runner = (await request('/api/runners', { name: 'C02 runner', harnesses: ['fixture'], capacity: 1 })).body;
  const task = (await request('/api/tasks', taskInput)).body.task;
  await claim(runner.token);
  const path = `/api/tasks/${task.id}/reconciliation`;
  expect((await request(path, undefined, '')).status).toBe(401);
  expect((await request(path, undefined, runner.token)).status).toBe(403);
  expect((await request(path)).body).toMatchObject({ lastHeartbeatAt: null, lastEventAt: null, lastSequence: 0 });
});

it('preserves v1 evidence during migration and leaves historical heartbeat/event clocks unknown', async () => {
  const { task, version } = await uncertainTask();
  await server!.close(); server = undefined;
  const pool = new Pool({ connectionString: databaseUrl });
  try {
    // Roll this isolated fixture schema back to exactly the missing v2 additions.
    await pool.query(`DROP TABLE flow.reconciliation_retries, flow.reconciliation_audit;
      DROP FUNCTION flow.prevent_audit_mutation();
      ALTER TABLE flow.attempts DROP COLUMN last_heartbeat_at, DROP COLUMN last_event_at;
      DELETE FROM flow.migrations WHERE version=2`);
  } finally { await pool.end(); }
  await startServer();
  const recovered = (await request(`/api/tasks/${task.id}/reconciliation`)).body;
  expect(recovered.task.status).toBe('uncertain');
  expect(recovered).toMatchObject({ lastHeartbeatAt: null, lastEventAt: null, lastSequence: 2 });
  const artifact = recovered.evidence.find((item: { title: string }) => item.title === 'Before interruption');
  expect((await request(`/api/details/${artifact.id}`)).body.artifactVersion).toBe(version);
  await server!.close(); server = undefined;
  await startServer();
  expect((await request(`/api/tasks/${task.id}/reconciliation`)).body).toEqual(recovered);
});

it('records an immutable observation exactly once while preserving uncertain capacity and session occupancy', async () => {
  const { task, ownership, runner } = await uncertainTask();
  const input = { ...ownership, evidence: { explanation: 'Host process state is still unknown.', references: [] } };
  const path = `/api/tasks/${task.id}/reconciliation/observations`;
  const key = 'same-observation';
  const [first, second] = await Promise.all([request(path, input, ownerToken, key), request(path, input, ownerToken, key)]);
  expect(first.status).toBe(200);
  expect(second.status).toBe(200);
  expect(first.body.audit.id).toBe(second.body.audit.id);
  expect([first.body.replayed, second.body.replayed].sort()).toEqual([false, true]);
  expect(first.body.audit).toMatchObject({ actor: 'owner', action: 'observation', before: { status: 'uncertain' }, after: { status: 'uncertain' } });
  const altered = { ...input, evidence: { explanation: 'Changed evidence', references: [] } };
  expect((await request(path, altered, ownerToken, key)).status).toBe(409);
  const view = (await request(`/api/tasks/${task.id}/reconciliation`)).body;
  expect(view.audit).toHaveLength(1);
  expect(view.task.status).toBe('uncertain');
  expect(view.completedAt).toBeNull();
  await request('/api/tasks', { ...taskInput, resumeSessionId: 'c02-session' });
  expect((await request('/api/runner/claim', {}, runner.token)).body.assignment).toBeNull();
  await server!.close(); server = undefined;
  await startServer();
  expect((await request(`/api/tasks/${task.id}/reconciliation`)).body.audit).toEqual(view.audit);
});

function stopped(ownership: { attemptId: string; ownerVersion: number }) {
  return { ...ownership, stoppedConfirmed: true,
    stopEvidence: { explanation: 'Operator inspected the original host and confirmed the process and tools exited.', references: [] },
    sideEffects: 'reviewed', effectsEvidence: { explanation: 'Operator inspected the target and retained artifact; effects are accounted for.', references: [] },
    outcome: 'cancelled' };
}

it('resolves confirmed stopped work atomically, retains history and rejects every late original owner report', async () => {
  const { task, runner, ownership } = await uncertainTask();
  const before = (await request(`/api/tasks/${task.id}`)).body;
  const queued = (await request('/api/tasks', { ...taskInput, resumeSessionId: 'c02-session' })).body.task;
  expect((await request('/api/runner/claim', {}, runner.token)).body.assignment).toBeNull();
  const path = `/api/tasks/${task.id}/reconciliation/resolve`;
  const input = stopped(ownership);
  const first = await request(path, input, ownerToken, 'resolve-once');
  expect(first.status).toBe(200);
  expect(first.body.task).toMatchObject({ id: task.id, status: 'cancelled', verificationStatus: 'pending' });
  expect(first.body.audit).toMatchObject({ actor: 'owner', action: 'resolution', before: { status: 'uncertain', ownerVersion: ownership.ownerVersion }, after: { status: 'cancelled', ownerVersion: ownership.ownerVersion + 1 } });
  const replay = await request(path, input, ownerToken, 'resolve-once');
  expect(replay.body).toEqual({ ...first.body, replayed: true });
  expect((await request(path, { ...input, outcome: 'failed' }, ownerToken, 'resolve-once')).status).toBe(409);
  const recovered = (await request(`/api/tasks/${task.id}/reconciliation`)).body;
  expect(recovered).toMatchObject({ reservationHeld: false, currentOwnerVersion: ownership.ownerVersion + 1, completedAt: expect.any(String) });
  const duplicate = { type: 'session', sequence: 1, id: 'session-record', nativeSessionId: 'c02-session', adapterVersion: 'fixture/1' };
  const late = { type: 'message', sequence: 3, id: 'late-message', text: 'Must not land' };
  for (const event of [duplicate, late]) expect((await request('/api/runner/events', { ...ownership, events: [event] }, runner.token)).status).toBe(409);
  expect((await request('/api/runner/heartbeat', ownership, runner.token)).status).toBe(409);
  const next = await claim(runner.token);
  expect(next.task.id).toBe(queued.id);
  expect(next.attempt.id).not.toBe(ownership.attemptId);
  const after = (await request(`/api/tasks/${task.id}`)).body;
  expect(after.entries.slice(0, before.entries.length)).toEqual(before.entries);
  expect(after.status).toBe('cancelled');
});

it('rejects unconfirmed stop, unknown effects, stale ownership and runner-authored operator evidence', async () => {
  const { task, ownership, runner } = await uncertainTask();
  const path = `/api/tasks/${task.id}/reconciliation/resolve`;
  const input = stopped(ownership);
  expect((await request(path, input, runner.token)).status).toBe(403);
  expect((await request(path, input, '')).status).toBe(401);
  for (const change of [
    { stoppedConfirmed: false }, { sideEffects: 'unknown' }, { outcome: 'succeeded' },
    { stopEvidence: { explanation: ' ', references: [] } },
    { effectsEvidence: { explanation: '', references: [] } }, { actor: 'impersonated-owner' },
  ]) expect((await request(path, { ...input, ...change })).status).toBe(400);
  for (const change of [{ ownerVersion: ownership.ownerVersion + 1 }, { attemptId: 'old-attempt' }]) {
    expect((await request(path, { ...input, ...change })).status).toBe(409);
    expect((await request(`/api/tasks/${task.id}/reconciliation/observations`, { ...ownership, ...change, evidence: { explanation: 'check' } })).status).toBe(409);
  }
  const current = (await request(`/api/tasks/${task.id}/reconciliation`)).body;
  expect(current).toMatchObject({ task: { status: 'uncertain' }, reservationHeld: true, completedAt: null, audit: [] });
});

it('refuses reconciliation of running work even when an operator supplies a stop assertion', async () => {
  const runner = (await request('/api/runners', { name: 'Running runner', harnesses: ['fixture'], capacity: 1 })).body;
  const task = (await request('/api/tasks', taskInput)).body.task;
  const assignment = await claim(runner.token);
  const input = { attemptId: assignment.attempt.id, ownerVersion: assignment.attempt.ownerVersion };
  expect((await request(`/api/tasks/${task.id}/reconciliation/resolve`, stopped(input))).status).toBe(409);
  expect((await request(`/api/tasks/${task.id}/reconciliation/observations`, { ...input, evidence: { explanation: 'still running' } })).status).toBe(409);
  expect((await request(`/api/tasks/${task.id}`)).body.status).toBe('running');
});

it('requires explicit retry after a resolution, creates one new task with provenance and preserves original history', async () => {
  const { task, ownership, runner } = await uncertainTask(true);
  const path = `/api/tasks/${task.id}/reconciliation/retry`;
  expect((await request(path, { ...ownership, resolutionId: 'not-resolved', safety: { strategy: 'revised-work', prompt: 'Only verify retained results', evidence: { explanation: 'Only verification remains' } } })).status).toBe(409);
  const resolution = await request(`/api/tasks/${task.id}/reconciliation/resolve`, { ...stopped(ownership), outcome: 'failed' });
  expect(resolution.status).toBe(200);
  const original = (await request(`/api/tasks/${task.id}`)).body;
  expect((await request('/api/runner/claim', {}, runner.token)).body.assignment).toBeNull();
  const input = { ...ownership, resolutionId: resolution.body.audit.id, safety: { strategy: 'revised-work', prompt: 'Only verify retained results; do not recreate them.', evidence: { explanation: 'The existing artifact is retained; only verification remains.', references: [] } } };
  const [one, two] = await Promise.all([request(path, input, ownerToken, 'explicit-retry'), request(path, input, ownerToken, 'explicit-retry')]);
  expect(one.status).toBe(200);
  expect(two.status).toBe(200);
  expect((await request(path, input, ownerToken, 'different-key')).status).toBe(409);
  expect((await request(path, input, runner.token)).status).toBe(403);
  expect(one.body.task.id).not.toBe(task.id);
  expect(one.body.task.id).toBe(two.body.task.id);
  expect([one.body.replayed, two.body.replayed].sort()).toEqual([false, true]);
  expect(one.body.provenance).toMatchObject({ taskId: task.id, attemptId: ownership.attemptId, resolutionId: resolution.body.audit.id, auditId: one.body.audit.id });
  expect((await request(path, { ...input, ownerVersion: ownership.ownerVersion + 1 }, ownerToken, 'explicit-retry')).status).toBe(409);
  const next = await claim(runner.token);
  expect(next.task.id).toBe(one.body.task.id);
  expect(next.attempt.id).not.toBe(ownership.attemptId);
  expect(next.task).not.toHaveProperty('resumeSessionId');
  expect((await request(`/api/tasks/${task.id}`)).body).toEqual(original);
  const recovered = (await request(`/api/tasks/${one.body.task.id}/reconciliation`)).body;
  expect(recovered.provenance).toEqual(one.body.provenance);
  await server!.close(); server = undefined;
  await startServer();
  expect((await request(`/api/tasks/${one.body.task.id}/reconciliation`)).body.provenance).toEqual(one.body.provenance);
  expect((await request(`/api/tasks/${task.id}/reconciliation`)).body.audit.map((entry: { action: string }) => entry.action)).toEqual(['resolution', 'retry']);
});

it('does not blindly repeat a successful external write whose completion acknowledgement was lost', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'flow-c02-effects-'));
  try {
    const ledger = join(directory, 'invoice.txt');
    const originalPrompt = 'Append invoice C02 once to the external ledger.';
    const { task, ownership, runner } = await uncertainTask(false, originalPrompt);
    // Independent external target: its write succeeded, while no completion reached the center.
    await writeFile(ledger, 'invoice C02 posted\n');
    const resolution = (await request(`/api/tasks/${task.id}/reconciliation/resolve`, {
      ...stopped(ownership), effectsEvidence: { explanation: 'Invoice C02 is already posted in the external ledger; the acknowledgement was lost.', references: [] },
    })).body;
    const path = `/api/tasks/${task.id}/reconciliation/retry`;
    const fence = { ...ownership, resolutionId: resolution.audit.id };
    expect((await request(path, fence)).status).toBe(400);
    expect((await request(path, { ...fence, safety: { strategy: 'no-side-effects', evidence: { explanation: 'Retry it' } } })).status).toBe(409);
    expect((await request(path, { ...fence, safety: { strategy: 'revised-work', prompt: ` ${originalPrompt} `, evidence: { explanation: 'Repeat' } } })).status).toBe(409);
    expect((await request('/api/runner/claim', {}, runner.token)).body.assignment).toBeNull();
    const next = await request(path, { ...fence, safety: { strategy: 'revised-work', prompt: 'Verify invoice C02 is present; do not append or recreate the invoice.', evidence: { explanation: 'Only verification remains because the ledger confirms the original write.', references: [] } } });
    expect(next.status).toBe(200);
    const assignment = await claim(runner.token);
    expect(assignment.task.prompt).toContain('do not append or recreate');
    expect(assignment.task.prompt).toContain('Invoice C02 is already posted');
    expect(assignment.task.prompt).toContain('owner assertion');
    for (const id of [task.id, ownership.attemptId, resolution.audit.id, next.body.audit.id]) expect(assignment.task.prompt).toContain(id);
    expect(await readFile(ledger, 'utf8')).toBe('invoice C02 posted\n');
  } finally { await rm(directory, { recursive: true, force: true }); }
});

it('allows original work only after none-confirmed safety evidence and rejects oversized context without partial retries', async () => {
  const { task, ownership, runner } = await uncertainTask();
  const resolution = (await request(`/api/tasks/${task.id}/reconciliation/resolve`, { ...stopped(ownership), sideEffects: 'none-confirmed' })).body;
  const path = `/api/tasks/${task.id}/reconciliation/retry`;
  const fence = { ...ownership, resolutionId: resolution.audit.id };
  const oversized = await request(path, { ...fence, safety: { strategy: 'revised-work', prompt: 'a'.repeat(16000), evidence: { explanation: 'This must not be silently truncated.' } } });
  expect(oversized).toMatchObject({ status: 400, body: { error: { code: 'recovery_context_too_large' } } });
  expect((await request(`/api/tasks/${task.id}/reconciliation`)).body.audit).toHaveLength(1);
  expect((await request('/api/runner/claim', {}, runner.token)).body.assignment).toBeNull();
  const retry = await request(path, { ...fence, safety: { strategy: 'no-side-effects', evidence: { explanation: 'The original host and target confirm there are no external effects.', references: [] } } });
  expect(retry.status).toBe(200);
  const assignment = await claim(runner.token);
  expect(assignment.task.prompt).toContain(taskInput.prompt);
  expect(assignment.task.prompt).toContain('no-side-effects');
  expect(assignment.task.prompt).toContain('no external effects');
  const storage = new Pool({ connectionString: databaseUrl });
  try {
    await expect(storage.query('UPDATE flow.reconciliation_retries SET source_task_id=source_task_id')).rejects.toMatchObject({ code: '55000' });
    await expect(storage.query('DELETE FROM flow.reconciliation_retries')).rejects.toMatchObject({ code: '55000' });
  } finally { await storage.end(); }
  expect((await request(`/api/tasks/${retry.body.task.id}/reconciliation`)).body.provenance).toEqual(retry.body.provenance);
});

it('paginates immutable audit history and rejects storage mutation without losing earlier observations', async () => {
  const { task, ownership } = await uncertainTask();
  const ids: string[] = [];
  for (let index = 0; index < 101; index++) {
    const response = await request(`/api/tasks/${task.id}/reconciliation/observations`, { ...ownership, evidence: { explanation: `Independent check ${index}`, references: [] } });
    expect(response.status).toBe(200);
    ids.push(response.body.audit.id);
  }
  const path = `/api/tasks/${task.id}/reconciliation`;
  const first = (await request(path)).body;
  expect(first.audit).toHaveLength(100);
  expect(first.hasMore).toBe(true);
  const second = (await request(`${path}?after=${first.nextCursor}`)).body;
  expect(second.audit).toHaveLength(1);
  expect(second).toMatchObject({ hasMore: false, nextCursor: null });
  expect([...first.audit, ...second.audit].map(row => row.id)).toEqual(ids);
  expect((await request(`${path}?after=-1`)).status).toBe(400);
  const storage = new Pool({ connectionString: databaseUrl });
  try {
    // The migration's database Interface promises append-only audit storage.
    for (const sql of ['UPDATE flow.reconciliation_audit SET actor=actor', 'DELETE FROM flow.reconciliation_audit', 'TRUNCATE flow.reconciliation_audit CASCADE']) {
      await expect(storage.query(sql)).rejects.toMatchObject({ code: '55000' });
    }
  } finally { await storage.end(); }
  expect((await request(path)).body.audit).toEqual(first.audit);
});

it('serializes conflicting resolutions and can release a revoked runner without trusting its credentials', async () => {
  const { task, ownership, runner } = await uncertainTask();
  expect((await request(`/api/runners/${runner.runnerId}/revoke`, {})).status).toBe(200);
  const path = `/api/tasks/${task.id}/reconciliation/resolve`;
  const outcomes = await Promise.all([
    request(path, stopped(ownership), ownerToken, 'cancel-resolution'),
    request(path, { ...stopped(ownership), outcome: 'failed' }, ownerToken, 'failure-resolution'),
  ]);
  expect(outcomes.map(item => item.status).sort()).toEqual([200, 409]);
  const view = (await request(`/api/tasks/${task.id}/reconciliation`)).body;
  expect(view.audit).toHaveLength(1);
  expect(view.reservationHeld).toBe(false);
  expect((await request('/api/runner/events', { ...ownership, events: [{ type: 'message', id: 'late', sequence: 3, text: 'late' }] }, runner.token)).status).toBe(401);
});
