import { randomUUID, createHash } from 'node:crypto';
import { Pool } from 'pg';
import { PgBoss } from 'pg-boss';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { createServer } from '../index.js';
import { migrateGoalToolRuns, registerGoalToolRunRoutes } from './index.js';

const name = `flow_o04_${randomUUID().replaceAll('-', '')}`;
const databaseUrl = `postgresql://flow:flow-local-only@127.0.0.1:55432/${name}`;
const admin = new Pool({ connectionString: 'postgresql://flow:flow-local-only@127.0.0.1:55432/postgres', max: 1 });
let pool: Pool; let boss: PgBoss; let app: Awaited<ReturnType<typeof createServer>>; let url: string;
beforeAll(async () => {
  await admin.query(`CREATE DATABASE ${name}`);
  pool = new Pool({ connectionString: databaseUrl }); boss = new PgBoss({ connectionString: databaseUrl }); await boss.start();
  app = await createServer({ databaseUrl, ownerToken: 'o04-owner' });
  await migrateGoalToolRuns(pool);
  if (!app.hasRoute({ method: 'POST', url: '/api/runner/goal-tools/grant' })) registerGoalToolRunRoutes(app, pool, boss);
  url = await app.listen({ host: '127.0.0.1', port: 0 });
});
afterAll(async () => { try { await app?.close(); await boss?.stop(); await pool?.end(); await admin.query(`DROP DATABASE ${name}`); } finally { await admin.end(); } });
async function request(path: string, body?: unknown, token = 'o04-owner', key = randomUUID() as string) {
  const response = await fetch(url + path, { method: body === undefined ? 'GET' : 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', 'idempotency-key': key }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(5000) });
  return { status: response.status, body: await response.json() };
}
async function goal() {
  const project = (await request('/api/projects', { title: 'O04' })).body.snapshot;
  const node = (await request(`/api/projects/${project.project.id}/commands`, { expectedRevision: project.project.revision, reason: 'Node', change: { kind: 'add-node', title: 'A' } })).body.changedNodeId;
  const value = (await request('/api/goals', { projectId: project.project.id, originalGoal: '中文目标🙂', constraints: 'Only granted tools', acceptance: 'Versioned result' })).body;
  return { goalId: value.goal.id, nodeId: node };
}
const config = { harness: 'claude', adapterVersion: 'claude-sdk-0.3.290-v2', model: 'synthetic-no-query', thinking: 'disabled', permissionMode: 'dontAsk', access: 'goal-tools', requireReadApproval: false, materialScopeDigest: createHash('sha256').update('[]').digest('hex'), limits: { maxTurns: 4, maxBudgetUsd: 0.01, timeoutMs: 5000 } };
it('admits only explicit native goal profiles and refuses ordinary submit/conversation authority', async () => {
  const runner = (await request('/api/runners', { name: 'Scoped native planner', harnesses: ['claude'], capacity: 1 })).body;
  const published = await request('/api/runner/execution-profile', { configuration: config }, runner.token);
  expect(published.status).toBe(200);
  const profile = published.body.profile.reference;
  expect((await request('/api/tasks', { title: 'Ordinary', prompt: 'No grant', harness: 'claude', executionProfile: profile })).status).toBe(409);
  expect((await request('/api/tasks', { title: 'Forged purpose', prompt: 'No grant', harness: 'claude', executionProfile: profile, purpose: 'goal-tools' })).status).toBe(400);
  expect((await request('/api/conversations', { title: 'Ordinary conversation', harness: 'claude', executionProfile: profile, requested: { model: 'runner-default', thinking: 'disabled', tools: 'configured-readonly' } })).status).toBe(409);
  const { goalId, nodeId } = await goal();
  const admitted = await request(`/api/goals/${goalId}/tool-runs`, { scope: { readScope: 'whole-goal', allowedNodeIds: [nodeId], allowedCommands: ['define-input'], maxCommands: 2 }, prompt: 'Plan only this node', execution: { harness: 'claude', executionProfile: profile } });
  expect(admitted.status).toBe(201); expect(admitted.body.run.mode).toBe('claude');
  let assignment: any;
  await expect.poll(async () => { assignment = (await request('/api/runner/claim', {}, runner.token)).body.assignment; return assignment; }, { timeout: 5000, interval: 20 }).not.toBeNull();
  expect(assignment.task.id).toBe(admitted.body.task.id); expect(assignment.goalToolRun).toEqual({ id: admitted.body.run.id, version: 1 });
  const grant = await request('/api/runner/goal-tools/grant', { attemptId: assignment.attempt.id, ownerVersion: assignment.attempt.ownerVersion }, runner.token);
  expect(grant.status).toBe(200); expect(grant.body.goalId).toBe(goalId);
});
