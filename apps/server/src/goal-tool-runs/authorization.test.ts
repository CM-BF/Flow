import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { PgBoss } from 'pg-boss';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { createServer } from '../index.js';
import { migrateGoalToolRuns, registerGoalToolRunRoutes } from './index.js';

const name = `flow_o03_${randomUUID().replaceAll('-', '')}`;
const databaseUrl = `postgresql://flow:flow-local-only@127.0.0.1:55432/${name}`;
const admin = new Pool({ connectionString: 'postgresql://flow:flow-local-only@127.0.0.1:55432/postgres', max: 1 });
let created = false;
let pool: Pool;
let boss: PgBoss;
let app: Awaited<ReturnType<typeof createServer>> | undefined;
let url: string;
async function start(leaseMs = 5000) {
  app = await createServer({ databaseUrl, ownerToken: 'o03-owner', leaseMs });
  await migrateGoalToolRuns(pool);
  if (!app.hasRoute({ method: 'POST', url: '/api/runner/goal-tools/grant' })) registerGoalToolRunRoutes(app, pool, boss);
  url = await app.listen({ host: '127.0.0.1', port: 0 });
}
async function stop() { await app?.close(); app = undefined; }
beforeAll(async () => {
  await admin.query(`CREATE DATABASE ${name}`); created = true;
  pool = new Pool({ connectionString: databaseUrl, max: 5, application_name: name, statement_timeout: 10_000 });
  boss = new PgBoss({ connectionString: databaseUrl }); await boss.start(); await start();
});
afterAll(async () => { try { await stop(); await boss?.stop(); await pool?.end(); if (created) await admin.query(`DROP DATABASE ${name}`); } finally { await admin.end(); } });
async function request(path: string, body?: unknown, token = 'o03-owner', key: string = randomUUID()) {
  const response = await fetch(url + path, { method: body === undefined ? 'GET' : 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', 'idempotency-key': key }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(10_000) });
  return { status: response.status, body: await response.json() };
}
async function goal() {
  const project = (await request('/api/projects', { title: 'O03 scope' })).body.snapshot;
  const added = (await request(`/api/projects/${project.project.id}/commands`, { expectedRevision: project.project.revision, reason: 'Node', change: { kind: 'add-node', title: 'A' } })).body;
  const createdGoal = (await request('/api/goals', { projectId: project.project.id, originalGoal: 'Scoped planning', constraints: '0 models', acceptance: 'Current inputs' })).body;
  return { goalId: createdGoal.goal.id as string, nodeId: added.changedNodeId as string, projectId: project.project.id as string };
}
function admission(nodeId: string) { return { scope: { readScope: 'whole-goal', allowedNodeIds: [nodeId], allowedCommands: ['define-input'], maxCommands: 2 }, prompt: 'Prepare the permitted existing node only', execution: { harness: 'fixture' } }; }
it('accepts one durable fixture grant, rejects native readonly profiles and enforces owner role', async () => {
  const { goalId, nodeId } = await goal(); const input = admission(nodeId); const path = `/api/goals/${goalId}/tool-runs`;
  const nativeRunner = (await request('/api/runners', { name: 'Readonly configured Claude', harnesses: ['claude'], capacity: 1 })).body;
  const profile = await request('/api/runner/execution-profile', { configuration: { harness: 'claude', adapterVersion: 'claude-sdk-0.3.290-v2', model: 'synthetic-no-query', thinking: 'disabled', permissionMode: 'dontAsk', access: 'configured-readonly', requireReadApproval: false, materialScopeDigest: 'a'.repeat(64), limits: { maxTurns: 1, maxBudgetUsd: 0.1, timeoutMs: 1000 } } }, nativeRunner.token);
  expect(profile.status).toBe(200);
  const native = await request(path, { ...input, execution: { harness: 'claude', executionProfile: profile.body.profile.reference } });
  expect(native.status).toBe(409); expect(native.body.error.code).toBe('native_goal_tools_unavailable');
  const first = await request(path, input, 'o03-owner', 'create-run'); expect(first.status).toBe(201);
  expect(first.body.run).toMatchObject({ goalId, version: 1, usedCommands: 0, scope: input.scope, mode: 'fixture' });
  expect(first.body.run.taskId).toBe(first.body.task.id);
  expect((await request(path, input, 'o03-owner', 'create-run')).body).toEqual({ ...first.body, replayed: true });
  const runner = (await request('/api/runners', { name: 'O03', harnesses: ['fixture'], capacity: 1 })).body;
  expect((await request(path, input, runner.token)).status).toBe(403);
  expect((await request(path, { ...input, scope: { ...input.scope, allowedNodeIds: [randomUUID()] } })).status).toBe(404);
  await stop(); await start();
  expect((await request(`/api/goal-tool-runs/${first.body.run.id}`)).body).toEqual(first.body.run);
  await request(`/api/tasks/${first.body.task.id}/cancel`, {});
});
async function claimReady(token: string) {
  let claimed: Awaited<ReturnType<typeof request>> | undefined;
  await expect.poll(async () => { claimed = await request('/api/runner/claim', {}, token); expect(claimed.status).toBe(200); return claimed.body.assignment; }, { timeout: 5000, interval: 20 }).not.toBeNull();
  return claimed!;
}
async function active(maxCommands = 2, commands = ['define-input']) {
  const context = await goal(); const input = admission(context.nodeId); input.scope.maxCommands = maxCommands; input.scope.allowedCommands = commands;
  const response = await request(`/api/goals/${context.goalId}/tool-runs`, input); expect(response.status).toBe(201);
  const runner = (await request('/api/runners', { name: 'Planner fixture', harnesses: ['fixture'], capacity: 1 })).body;
  const claimed = await claimReady(runner.token); expect(claimed.body.assignment.task.id).toBe(response.body.task.id);
  const ownership = { attemptId: claimed.body.assignment.attempt.id, ownerVersion: claimed.body.assignment.attempt.ownerVersion };
  const grant = { id: response.body.run.id, version: 1 };
  return { ...context, ...runner, taskId: response.body.task.id as string, ownership, grant, call: { ...ownership, grant } };
}
function define(nodeId: string, expectedInputVersion = 0, goal = 'Bound input') {
  return { kind: 'define-input', nodeId, expectedInputVersion, input: { goal, constraints: 'No external writes', acceptance: 'Exact version', verification: { kind: 'nonempty' } }, reason: 'Explicit scope' };
}
const callCommand = (run: Awaited<ReturnType<typeof active>>, command: unknown, key: string = randomUUID()) => request('/api/runner/goal-tools/command', { ...run.call, command }, run.token, key);
it('enforces current runner/attempt/grant scope and preserves the whole-goal read policy', async () => {
  const run = await active();
  expect((await request('/api/runner/goal-tools/grant', run.ownership, run.token)).body.scope.readScope).toBe('whole-goal');
  expect((await request('/api/runner/goal-tools/grant', run.ownership)).status).toBe(403);
  const other = (await request('/api/runners', { name: 'Other', harnesses: ['fixture'], capacity: 1 })).body;
  expect((await request('/api/runner/goal-tools/grant', run.ownership, other.token)).status).toBe(403);
  expect((await request('/api/runner/goal-tools/grant', { ...run.ownership, ownerVersion: 2 }, run.token)).body.error.code).toBe('stale_owner');
  expect((await request('/api/runner/goal-tools/snapshot', { ...run.call, grant: { id: randomUUID(), version: 1 } }, run.token)).body.error.code).toBe('goal_tool_grant_mismatch');
  expect((await request(`/api/goals/${run.goalId}`, undefined, run.token)).status).toBe(403);
  expect((await callCommand(run, define(randomUUID()))).body.error.code).toBe('goal_tool_scope');
  const foreign = await goal();
  expect((await callCommand(run, define(foreign.nodeId))).status).toBe(403);
  const result = await callCommand(run, define(run.nodeId)); expect(result.status).toBe(200);
  const read = await request('/api/runner/goal-tools/input', { ...run.call, nodeId: run.nodeId, version: 1 }, run.token);
  expect(read.body.input.goal).toBe('Bound input');
  expect((await request('/api/runner/goal-tools/input', { ...run.call, nodeId: foreign.nodeId, version: 1 }, run.token)).status).toBe(403);
  const view = await request('/api/runner/goal-tools/snapshot', run.call, run.token); expect(view.status).toBe(200); expect(view.body.goal.id).toBe(run.goalId);
  expect((await callCommand(run, { kind: 'execute', nodeId: run.nodeId, expectedInputVersion: 1, dependencies: [], previousExecutionId: null, reason: 'Denied kind', fixture: { scenario: 'success' } })).status).toBe(403);
});
it('counts distinct admitted keys, keeps bounded audit and replays across restart without bypassing input conflicts', async () => {
  const run = await active(); const command = define(run.nodeId);
  const first = await callCommand(run, command, 'stable'); expect(first.status).toBe(200);
  await stop(); await start();
  const replay = await callCommand(run, command, 'stable'); expect(replay.status).toBe(200); expect(replay.body).toEqual({ ...first.body, replayed: true });
  expect((await callCommand(run, { ...command, reason: 'Changed' }, 'stable')).body.error.code).toBe('idempotency_conflict');
  expect((await callCommand(run, command, 'stale')).body.error.code).toBe('input_version');
  expect((await callCommand(run, define(run.nodeId, 1), 'no-op')).body.changed).toBe(false);
  expect((await callCommand(run, define(run.nodeId, 1, 'Changed'), 'too-many')).body.error.code).toBe('goal_tool_limit');
  expect((await callCommand(run, command, 'stable')).body.replayed).toBe(true);
  const page = await request(`/api/goal-tool-runs/${run.grant.id}/calls?limit=1`); expect(page.body.calls).toHaveLength(1); expect(page.body.nextCursor).toBe(1);
  expect(page.body.calls[0]).toMatchObject({ attemptId: run.ownership.attemptId, ownerVersion: 1, key: 'stable', kind: 'define-input', nodeId: run.nodeId, result: { inputVersion: 1, changed: true } });
  expect(page.body.calls[0].digest).toMatch(/^[a-f0-9]{64}$/);
  const last = await request(`/api/goal-tool-runs/${run.grant.id}/calls?limit=1&after=1`); expect(last.body.calls).toHaveLength(1); expect(last.body.nextCursor).toBeNull(); expect(last.body.run.usedCommands).toBe(2);
  expect((await request(`/api/goal-tool-runs/${run.grant.id}/calls?limit=51`)).status).toBe(400);
  expect((await request(`/api/goal-tool-runs/${run.grant.id}/calls`, undefined, run.token)).status).toBe(403);
});
it('revokes authority durably and rechecks authorization before returning cached commands', async () => {
  const run = await active(); const command = define(run.nodeId);
  expect((await callCommand(run, command, 'cached')).status).toBe(200);
  const path = `/api/goal-tool-runs/${run.grant.id}/revoke`;
  expect((await request(path, { reason: 'Stop delegated writes' }, run.token)).status).toBe(403);
  const revoked = await request(path, { reason: 'Stop delegated writes' }, 'o03-owner', 'revoke'); expect(revoked.body.changed).toBe(true);
  expect((await request(path, { reason: 'Stop delegated writes' }, 'o03-owner', 'revoke')).body.replayed).toBe(true);
  expect((await request(path, { reason: 'Different' }, 'o03-owner', 'revoke')).status).toBe(409);
  expect((await request(path, { reason: 'Second reason' })).body).toMatchObject({ changed: false, run: { revocationReason: 'Stop delegated writes' } });
  await stop(); await start();
  expect((await callCommand(run, command, 'cached')).body.error.code).toBe('goal_tool_revoked');
  expect((await request('/api/runner/goal-tools/snapshot', run.call, run.token)).status).toBe(409);
  const state = (await request(`/api/goal-tool-runs/${run.grant.id}`)).body; expect(state.usedCommands).toBe(1); expect(state.revokedAt).toBeTruthy();
  expect((await request(`/api/tasks/${run.taskId}`)).body.status).toBe('running'); // Revoke is not a claim that the runner stopped.
});
it('rejects expired, completed and revoked-runner ownership without reviving cached authority', async () => {
  await stop(); await start(150);
  const expired = await active();
  expect((await callCommand(expired, define(expired.nodeId), 'expired-key')).status).toBe(200);
  await new Promise(resolve => setTimeout(resolve, 220));
  expect((await request('/api/runner/goal-tools/grant', expired.ownership, expired.token)).body.error.code).toBe('goal_tool_inactive');
  expect((await callCommand(expired, define(expired.nodeId), 'expired-key')).body.error.code).toBe('goal_tool_inactive');
  await stop(); await start();
  const completed = await active();
  expect((await request('/api/runner/events', { ...completed.ownership, events: [{ id: randomUUID(), sequence: 1, type: 'completed', outcome: 'failed', error: 'Fixture stopped' }] }, completed.token)).status).toBe(200);
  expect((await request('/api/runner/goal-tools/grant', completed.ownership, completed.token)).body.error.code).toBe('goal_tool_inactive');
  const revoked = await active();
  expect((await request(`/api/runners/${revoked.runnerId}/revoke`, {})).status).toBe(200);
  expect((await request('/api/runner/goal-tools/grant', revoked.ownership, revoked.token)).status).toBe(401);
});
for (const action of ['revoke', 'cancel'] as const) it(`serializes an in-flight cached command against ${action} without granting a post-revocation replay`, async () => {
  const run = await active(); const command = define(run.nodeId);
  expect((await callCommand(run, command, 'cached-race')).status).toBe(200);
  const lock = await pool.connect();
  await lock.query('BEGIN'); await lock.query('SELECT id FROM flow.projects WHERE id=$1 FOR UPDATE', [run.projectId]);
  let pending: ReturnType<typeof callCommand> | undefined;
  try {
    pending = callCommand(run, command, 'cached-race');
    await expect.poll(async () => Number((await pool.query("SELECT count(*) FROM pg_stat_activity WHERE datname=$1 AND application_name=$1 AND wait_event_type='Lock' AND query LIKE '%FROM flow.projects%FOR UPDATE%'", [name])).rows[0].count), { timeout: 2000, interval: 20 }).toBeGreaterThan(0);
    const response = action === 'revoke' ? await request(`/api/goal-tool-runs/${run.grant.id}/revoke`, { reason: 'Race revoke' }) : await request(`/api/tasks/${run.taskId}/cancel`, {});
    expect(response.status).toBe(200);
  } finally { await lock.query('ROLLBACK'); lock.release(); }
  const replay = await pending!;
  expect(replay.status).toBe(409); expect(replay.body.error.code).toBe(action === 'revoke' ? 'goal_tool_revoked' : 'goal_tool_inactive');
  expect((await request(`/api/goal-tool-runs/${run.grant.id}`)).body.usedCommands).toBe(1);
});
it('rolls back failed application without consuming authority and protects immutable scope and audit history', async () => {
  const run = await active();
  expect((await callCommand(run, define(run.nodeId, 4), 'retryable')).body.error.code).toBe('input_version');
  expect((await request(`/api/goal-tool-runs/${run.grant.id}`)).body.usedCommands).toBe(0);
  expect((await callCommand(run, define(run.nodeId), 'retryable')).status).toBe(200);
  await expect(pool.query("UPDATE flow.goal_tool_runs SET scope=jsonb_set(scope,'{maxCommands}','32') WHERE id=$1", [run.grant.id])).rejects.toMatchObject({ code: '23514' });
  await expect(pool.query('DELETE FROM flow.goal_tool_calls WHERE run_id=$1', [run.grant.id])).rejects.toMatchObject({ code: '23514' });
  expect((await request(`/api/goal-tool-runs/${run.grant.id}`)).body.scope.maxCommands).toBe(2);
  expect((await request(`/api/goal-tool-runs/${run.grant.id}/calls`)).body.calls).toHaveLength(1);
});

it('applies execution in the same grant transaction and gives no delegated authority to its fixture child', async () => {
  const run = await active(2, ['define-input', 'execute']);
  expect((await callCommand(run, define(run.nodeId), 'define')).status).toBe(200);
  const command = { kind: 'execute', nodeId: run.nodeId, expectedInputVersion: 1, dependencies: [], previousExecutionId: null, reason: 'Fixture child only', fixture: { scenario: 'success' } };
  const executed = await callCommand(run, command, 'execute'); expect(executed.status).toBe(200);
  expect(executed.body.task.status).toBe('queued'); expect(executed.body.task.id).not.toBe(run.taskId);
  const replay = await callCommand(run, command, 'execute'); expect(replay.body.task.id).toBe(executed.body.task.id); expect(replay.body.replayed).toBe(true);
  const child = (await request('/api/runners', { name: 'Child fixture', harnesses: ['fixture'], capacity: 1 })).body;
  const claim = await claimReady(child.token); expect(claim.body.assignment.task.id).toBe(executed.body.task.id);
  const ownership = { attemptId: claim.body.assignment.attempt.id, ownerVersion: claim.body.assignment.attempt.ownerVersion };
  expect((await request('/api/runner/goal-tools/grant', ownership, child.token)).status).toBe(403);
  expect((await request('/api/runner/goal-tools/command', { ...ownership, grant: run.grant, command: define(run.nodeId, 1) }, child.token)).status).toBe(403);
  const audit = (await request(`/api/goal-tool-runs/${run.grant.id}/calls`)).body;
  expect(audit.run.usedCommands).toBe(2); expect(audit.calls[1].result).toMatchObject({ taskId: executed.body.task.id, executionId: executed.body.executionId });
});
