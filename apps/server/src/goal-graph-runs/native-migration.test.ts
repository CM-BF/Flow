import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { Pool } from 'pg';
import type { PgBoss } from 'pg-boss';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { createServer } from '../index.js';
import { migrate, transaction } from '../database.js';
import { migrateWorkspace } from '../m2-workspace.js';
import { migrateProjects } from '../projects/index.js';
import { createProject } from '../projects/commands.js';
import { migrateProtocolDispatch } from '../protocol-dispatch/index.js';
import { migrateGoals } from '../goals/index.js';
import { createGoal } from '../goals/commands.js';
import { migrateConversations } from '../conversations/index.js';
import { migratePlugins } from '../plugins/index.js';
import { migrateAssistantMessages } from '../assistant/index.js';
import { migrateExecutionProfiles } from '../execution-profiles/index.js';
import { migrateConversationQueue } from '../conversation-queue/index.js';
import { migrateGoalToolRuns } from '../goal-tool-runs/index.js';
import { migrateGoalGraphProposals } from '../goal-graph-proposals/index.js';
import { migrateKnowledge } from '../knowledge/index.js';
import { migrateRunnerMaintenance } from '../runner-maintenance/index.js';
import { claim, registerRunner } from '../runners.js';
import { startScheduler } from '../scheduler.js';
import { migrateGoalGraphRuns, registerGoalGraphRunRoutes } from './index.js';
import { admit } from './store.js';
import { runnerCommand } from './runner.js';

const name = `flow_o07_upgrade_${randomUUID().replaceAll('-', '')}`;
const databaseUrl = `postgresql://flow:flow-local-only@127.0.0.1:55432/${name}`;
const admin = new Pool({ connectionString: 'postgresql://flow:flow-local-only@127.0.0.1:55432/postgres', max: 1 });
let pool: Pool; let boss: PgBoss; let app: Awaited<ReturnType<typeof createServer>> | undefined; let url: string;
const facts: Record<string, unknown> = { modelCalls: 0, database: name };
beforeAll(async () => {
  await admin.query(`CREATE DATABASE ${name}`); pool = new Pool({ connectionString: databaseUrl, max: 4, statement_timeout: 10_000 });
  // Construct a real 017 database forward; never roll back a current schema.
  for (const migration of [migrate, migrateWorkspace, migrateProjects, migrateProtocolDispatch, migrateGoals, migrateConversations,
    migratePlugins, migrateAssistantMessages, migrateExecutionProfiles, migrateConversationQueue, migrateGoalToolRuns, migrateGoalGraphProposals,
    migrateKnowledge, migrateRunnerMaintenance]) await migration(pool);
  await transaction(pool, async client => {
    await client.query(await readFile(new URL('../../../../packages/storage/migrations/017-goal-graph-runs.sql', import.meta.url), 'utf8'));
    await client.query('INSERT INTO flow.migrations(version) VALUES(17)');
  });
  boss = await startScheduler(databaseUrl, pool);
});
afterAll(async () => {
  try { await app?.close(); await boss?.stop(); await pool?.end(); await admin.query(`DROP DATABASE ${name}`);
    facts.databaseRemoved = !(await admin.query('SELECT 1 FROM pg_database WHERE datname=$1', [name])).rowCount;
  } finally { await admin.end(); if (process.env.FLOW_O07_UPGRADE_EVIDENCE) await writeFile(process.env.FLOW_O07_UPGRADE_EVIDENCE, JSON.stringify(facts, null, 2) + '\n'); }
});
const versions = async () => (await pool.query('SELECT * FROM flow.migrations ORDER BY version')).rows;
async function records(runId: string) {
  return { grant: (await pool.query('SELECT * FROM flow.goal_graph_runs WHERE id=$1', [runId])).rows[0],
    calls: (await pool.query('SELECT * FROM flow.goal_graph_calls WHERE run_id=$1 ORDER BY sequence', [runId])).rows };
}
async function request(path: string, body?: unknown, token = 'o07-upgrade-owner', key: string = randomUUID()) {
  const response = await fetch(url + path, { method: body === undefined ? 'GET' : 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', 'idempotency-key': key }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(5000) });
  return { status: response.status, body: await response.json() };
}
it('preserves populated 017 graph authority and audit across 019, repeated migration and native admission', async () => {
  const beforeVersions = await versions(); expect(beforeVersions.map(row => row.version)).toEqual(Array.from({ length: 17 }, (_, index) => index + 1));
  const constraint = (await pool.query("SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid='flow.goal_graph_runs'::regclass AND conname='goal_graph_runs_mode_check'")).rows[0].definition;
  expect(constraint).not.toContain('claude');
  const project = (await createProject(pool, { workspaceId: 'personal', title: '017 graph' }, 'project')).snapshot.project;
  const goal = (await createGoal(pool, { projectId: project.id, originalGoal: '升级🙂', constraints: 'No models', acceptance: 'History retained' }, 'goal')).goal;
  const scope = { baseRevision: 1, allowedExistingNodes: [], maxProposals: 1, maxApplications: 1, maxNewNodes: 3, maxNewEdges: 2 };
  const admitted = await admit(pool, boss, goal.id, { scope, prompt: 'Fixture authority', execution: { harness: 'fixture' } }, 'admit');
  const runner = await registerRunner(pool, { name: '017 fixture', harnesses: ['fixture'], capacity: 1 });
  let assignment: Awaited<ReturnType<typeof claim>>['assignment'];
  await expect.poll(async () => { assignment = (await claim(pool, runner.runnerId, 60_000)).assignment; return assignment; }, { timeout: 5000, interval: 20 }).not.toBeNull();
  const call = { attemptId: assignment!.attempt.id, ownerVersion: assignment!.attempt.ownerVersion, grant: { id: admitted.run.id, version: 1 as const }, command: { kind: 'propose' as const, proposal: { expectedProjectRevision: 1, reason: 'Before upgrade', additions: [{ key: 'A', title: 'Retain', dependencies: [] }] } } };
  const proposed = await runnerCommand(pool, runner.runnerId, call, 'saved');
  const before = await records(admitted.run.id); expect(before.grant.used_commands).toBe(1); expect(before.calls).toHaveLength(1);
  await migrateGoalGraphRuns(pool);
  const afterVersions = await versions(); expect(afterVersions.filter(row => row.version <= 17)).toEqual(beforeVersions); expect(afterVersions.at(-1).version).toBe(19);
  expect(await records(admitted.run.id)).toEqual(before);
  await migrateGoalGraphRuns(pool); expect(await versions()).toEqual(afterVersions); expect(await records(admitted.run.id)).toEqual(before);
  app = await createServer({ databaseUrl, ownerToken: 'o07-upgrade-owner', leaseMs: 60_000 });
  if (!app.hasRoute({ method: 'POST', url: '/api/runner/goal-graph/grant' })) registerGoalGraphRunRoutes(app, pool, boss);
  url = await app.listen({ host: '127.0.0.1', port: 0 });
  const replay = await request('/api/runner/goal-graph/command', call, runner.token, 'saved'); expect(replay.status).toBe(200); expect(replay.body).toEqual({ ...proposed, replayed: true });
  const quota = await request('/api/runner/goal-graph/command', call, runner.token, 'new'); expect(quota.status).toBe(409);
  expect(await records(admitted.run.id)).toEqual(before);
  for (const sql of ["UPDATE flow.goal_graph_runs SET mode='claude' WHERE id=$1", 'UPDATE flow.goal_graph_runs SET used_commands=0 WHERE id=$1', "UPDATE flow.goal_graph_runs SET scope=jsonb_set(scope,'{maxProposals}','2') WHERE id=$1", 'DELETE FROM flow.goal_graph_calls WHERE run_id=$1']) await expect(pool.query(sql, [admitted.run.id])).rejects.toMatchObject({ code: '23514' });
  const revoked = await request(`/api/goal-graph-runs/${admitted.run.id}/revoke`, { reason: 'After migration' }); expect(revoked.body.changed).toBe(true);
  expect((await request('/api/runner/goal-graph/command', call, runner.token, 'saved')).body.error.code).toBe('goal_graph_revoked');
  await expect(pool.query('UPDATE flow.goal_graph_runs SET revoked_at=NULL,revocation_reason=NULL WHERE id=$1', [admitted.run.id])).rejects.toMatchObject({ code: '23514' });
  const nativeRunner = (await request('/api/runners', { name: '019 admission only', harnesses: ['claude'], capacity: 1 })).body;
  const profile = await request('/api/runner/execution-profile', { configuration: { harness: 'claude', adapterVersion: 'claude-sdk-0.3.290-v2', model: 'synthetic-no-query', thinking: 'disabled', permissionMode: 'dontAsk', access: 'goal-graph-tools', requireReadApproval: false, materialScopeDigest: '4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945', limits: { maxTurns: 1, maxBudgetUsd: 0.01, timeoutMs: 1000 } } }, nativeRunner.token);
  expect(profile.status).toBe(200);
  const native = await request(`/api/goals/${goal.id}/graph-runs`, { scope, prompt: 'Do not execute', execution: { harness: 'claude', executionProfile: profile.body.profile.reference } });
  expect(native.status).toBe(201); expect(native.body.run.mode).toBe('claude'); expect(native.body.task.status).toBe('queued');
  expect((await records(admitted.run.id)).calls).toEqual(before.calls);
  facts.before = { versions: beforeVersions, constraint, records: before }; facts.after = { versions: afterVersions, replayed: true, quotaStatus: quota.status, native: native.body.run, repeatedMigrationUnchanged: true }; facts.passed = true;
});
