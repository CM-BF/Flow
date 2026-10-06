import { randomUUID, createHash } from 'node:crypto';
import { Pool } from 'pg';
import { PgBoss } from 'pg-boss';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { createServer } from '../index.js';
import { migrateGoalGraphRuns, registerGoalGraphRunRoutes } from './index.js';

const name = `flow_o07_native_${randomUUID().replaceAll('-', '')}`;
const databaseUrl = `postgresql://flow:flow-local-only@127.0.0.1:55432/${name}`;
const admin = new Pool({ connectionString: 'postgresql://flow:flow-local-only@127.0.0.1:55432/postgres', max: 1 });
let pool: Pool; let boss: PgBoss; let app: Awaited<ReturnType<typeof createServer>>; let url: string;
beforeAll(async () => {
  await admin.query(`CREATE DATABASE ${name}`); pool = new Pool({ connectionString: databaseUrl });
  boss = new PgBoss({ connectionString: databaseUrl }); await boss.start();
  app = await createServer({ databaseUrl, ownerToken: 'o07-owner' }); await migrateGoalGraphRuns(pool);
  if (!app.hasRoute({ method: 'POST', url: '/api/runner/goal-graph/grant' })) registerGoalGraphRunRoutes(app, pool, boss);
  url = await app.listen({ host: '127.0.0.1', port: 0 });
});
afterAll(async () => { try { await app?.close(); await boss?.stop(); await pool?.end(); await admin.query(`DROP DATABASE ${name}`); } finally { await admin.end(); } });
async function request(path: string, body?: unknown, token = 'o07-owner', key: string = randomUUID()) {
  const response = await fetch(url + path, { method: body === undefined ? 'GET' : 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', 'idempotency-key': key }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(5000) });
  return { status: response.status, body: await response.json() };
}
const scope = { baseRevision: 1, allowedExistingNodes: [], maxProposals: 1, maxApplications: 1, maxNewNodes: 3, maxNewEdges: 2 };
async function goal() {
  const project = (await request('/api/projects', { title: 'O07 graph' })).body.snapshot.project;
  const original = { projectId: project.id, originalGoal: '发布说明三步骤🙂', constraints: '不执行子任务', acceptance: '至多三个节点与两条边' };
  const result = await request('/api/goals', original); expect(result.status).toBe(201);
  return { id: result.body.goal.id, original };
}
const configuration = (access: string) => ({ harness: 'claude', adapterVersion: 'claude-sdk-0.3.290-v2', model: 'synthetic-no-query', thinking: 'disabled', permissionMode: 'dontAsk', access, requireReadApproval: false, materialScopeDigest: createHash('sha256').update('[]').digest('hex'), limits: { maxTurns: 4, maxBudgetUsd: 0.01, timeoutMs: 5000 } });
async function profile(access: string) {
  const runner = (await request('/api/runners', { name: access, harnesses: ['claude'], capacity: 1 })).body;
  const response = await request('/api/runner/execution-profile', { configuration: configuration(access) }, runner.token);
  expect(response.status).toBe(200); return response.body.profile.reference;
}
it('admits a dedicated graph profile with the original goal and rejects ordinary or node-grant authority', async () => {
  const selected = await profile('goal-graph-tools'); const context = await goal();
  const input = { scope, prompt: '请提出计划并应用，尚未执行。', execution: { harness: 'claude', executionProfile: selected } };
  const admitted = await request(`/api/goals/${context.id}/graph-runs`, input, 'o07-owner', 'native');
  expect(admitted.status).toBe(201); expect(admitted.body.run.mode).toBe('claude');
  const submission = (await pool.query('SELECT submission FROM flow.tasks WHERE id=$1', [admitted.body.task.id])).rows[0].submission;
  expect(submission.executionProfile).toEqual(selected);
  const stored = submission.prompt;
  for (const value of [context.original.originalGoal, context.original.constraints, context.original.acceptance, input.prompt]) expect(stored).toContain(value);
  expect((await request(`/api/goals/${context.id}/graph-runs`, input, 'o07-owner', 'native')).body.replayed).toBe(true);
  expect((await request('/api/tasks', { title: 'Ordinary', prompt: 'No grant', harness: 'claude', executionProfile: selected })).status).toBe(409);
  expect((await request('/api/tasks', { title: 'Forged', prompt: 'No grant', harness: 'claude', executionProfile: selected, purpose: 'goal-graph-tools' })).status).toBe(400);
  expect((await request('/api/conversations', { title: 'Ordinary', harness: 'claude', executionProfile: selected, requested: { model: 'runner-default', thinking: 'disabled', tools: 'configured-readonly' } })).status).toBe(409);
  const node = (await request(`/api/projects/${context.original.projectId}/commands`, { expectedRevision: 1, reason: 'Node-only comparison', change: { kind: 'add-node', title: 'A' } })).body.changedNodeId;
  expect((await request(`/api/goals/${context.id}/tool-runs`, { scope: { readScope: 'whole-goal', allowedNodeIds: [node], allowedCommands: ['define-input'], maxCommands: 1 }, prompt: 'No graph authority', execution: input.execution })).status).toBe(409);
});
it('fails closed for absent, node-only and ordinary profiles without creating graph runs', async () => {
  const context = await goal(); const baseline = (await pool.query('SELECT count(*)::int AS n FROM flow.goal_graph_runs')).rows[0].n;
  for (const execution of [{ harness: 'claude' }, { harness: 'claude', executionProfile: await profile('goal-tools') }, { harness: 'claude', executionProfile: await profile('none') }]) {
    expect((await request(`/api/goals/${context.id}/graph-runs`, { scope, prompt: 'No authority', execution })).status).toBe(409);
  }
  expect((await pool.query('SELECT count(*)::int AS n FROM flow.goal_graph_runs')).rows[0].n).toBe(baseline);
});
