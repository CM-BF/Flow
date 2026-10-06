import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { Pool } from 'pg';
import type { PgBoss } from 'pg-boss';
import { afterAll, beforeAll, expect, it } from 'vitest';
import type { GoalToolCommandCall, GoalToolScope } from '../../../../packages/contracts/src/goal-tool-runs.js';
import { createServer } from '../index.js';
import { migrate, transaction } from '../database.js';
import { migrateWorkspace } from '../m2-workspace.js';
import { migrateProjects } from '../projects/index.js';
import { createProject, changeProject } from '../projects/commands.js';
import { migrateProtocolDispatch } from '../protocol-dispatch/index.js';
import { migrateGoals } from '../goals/index.js';
import { createGoal } from '../goals/commands.js';
import { migrateConversations } from '../conversations/index.js';
import { migratePlugins } from '../plugins/index.js';
import { migrateAssistantMessages } from '../assistant/index.js';
import { migrateExecutionProfiles } from '../execution-profiles/index.js';
import { migrateConversationQueue } from '../conversation-queue/index.js';
import { claim, registerRunner } from '../runners.js';
import { startScheduler } from '../scheduler.js';
import { migrateGoalToolRuns } from './index.js';
import { admit } from './store.js';
import { runnerCommand } from './runner.js';

const name = `flow_o04_upgrade_${randomUUID().replaceAll('-', '')}`;
const databaseUrl = `postgresql://flow:flow-local-only@127.0.0.1:55432/${name}`;
const admin = new Pool({ connectionString: 'postgresql://flow:flow-local-only@127.0.0.1:55432/postgres', max: 1 });
const facts: Record<string, unknown> = { database: name, modelCalls: 0 };
let created = false;
let pool: Pool;
let boss: PgBoss | undefined;
let app: Awaited<ReturnType<typeof createServer>> | undefined;
let url: string;

beforeAll(async () => {
  await admin.query(`CREATE DATABASE ${name}`); created = true;
  pool = new Pool({ connectionString: databaseUrl, max: 4, statement_timeout: 10_000 });
  // Build forward from an empty dedicated DB; never downgrade a 013 database.
  for (const migration of [migrate, migrateWorkspace, migrateProjects, migrateProtocolDispatch, migrateGoals,
    migrateConversations, migratePlugins, migrateAssistantMessages, migrateExecutionProfiles, migrateConversationQueue]) await migration(pool);
  await transaction(pool, async client => {
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended('flow-migrations',0))");
    await client.query(await readFile(new URL('../../../../packages/storage/migrations/012-goal-tool-runs.sql', import.meta.url), 'utf8'));
    await client.query('INSERT INTO flow.migrations(version) VALUES(12)');
  });
  boss = await startScheduler(databaseUrl, pool);
});
afterAll(async () => {
  try {
    await app?.close(); await boss?.stop(); await pool?.end();
    if (created) await admin.query(`DROP DATABASE ${name}`);
    facts.databaseRemoved = !(await admin.query('SELECT 1 FROM pg_database WHERE datname=$1', [name])).rowCount;
  } finally {
    await admin.end();
    if (process.env.FLOW_O04_MIGRATION_EVIDENCE) await writeFile(process.env.FLOW_O04_MIGRATION_EVIDENCE, JSON.stringify(facts, null, 2) + '\n');
  }
});

async function request(path: string, body?: unknown, token = 'upgrade-owner', key: string = randomUUID()) {
  const response = await fetch(url + path, { method: body === undefined ? 'GET' : 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', 'idempotency-key': key },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(5000) });
  return { status: response.status, body: await response.json() };
}
async function versions() { return (await pool.query('SELECT version,applied_at FROM flow.migrations ORDER BY version')).rows; }
async function stored(runId: string) {
  return { grant: (await pool.query('SELECT * FROM flow.goal_tool_runs WHERE id=$1', [runId])).rows[0],
    calls: (await pool.query('SELECT * FROM flow.goal_tool_calls WHERE run_id=$1 ORDER BY sequence', [runId])).rows };
}
async function fixtureAuthority() {
  const project = await createProject(pool, { workspaceId: 'personal', title: '012 fixture authority' }, 'project');
  const projectId = project.snapshot.project.id;
  const changed = await changeProject(pool, projectId, { expectedRevision: 1, reason: 'Known node', change: { kind: 'add-node', title: 'A', taskId: null, parent: null } }, 'node');
  const nodeId = changed.changedNodeId!;
  const goal = await createGoal(pool, { projectId, originalGoal: '旧授权升级🙂', constraints: 'No models', acceptance: 'Unchanged authority' }, 'goal');
  const scope: GoalToolScope = { readScope: 'whole-goal', allowedNodeIds: [nodeId], allowedCommands: ['define-input'], maxCommands: 1 };
  const accepted = await admit(pool, boss!, goal.goal.id, { scope, prompt: 'One fixture command', execution: { harness: 'fixture' } }, 'grant');
  const runner = await registerRunner(pool, { name: '012 fixture runner', harnesses: ['fixture'], capacity: 1 });
  let claimed: Awaited<ReturnType<typeof claim>> | undefined;
  await expect.poll(async () => { claimed = await claim(pool, runner.runnerId, 60_000); return claimed.assignment; }, { timeout: 5000, interval: 20 }).not.toBeNull();
  expect(claimed!.assignment!.task.id).toBe(accepted.task.id);
  const input: GoalToolCommandCall = { attemptId: claimed!.assignment!.attempt.id, ownerVersion: claimed!.assignment!.attempt.ownerVersion,
    grant: { id: accepted.run.id, version: 1 }, command: { kind: 'define-input', nodeId, expectedInputVersion: 0,
      input: { goal: 'Retained input', constraints: 'No external writes', acceptance: 'Exact version', verification: { kind: 'nonempty' } }, reason: 'Before upgrade' } };
  const result = await runnerCommand(pool, boss!, runner.runnerId, input, 'saved-command');
  expect(result).toMatchObject({ inputVersion: 1, changed: true, replayed: false });
  return { accepted, scope, runner, input, result, goalId: goal.goal.id };
}

it('upgrades populated 012 fixture authority to 013 without changing its audit, quota or revocation rules', async () => {
  const beforeVersions = await versions();
  expect(beforeVersions.map(row => row.version)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  const constraint = (await pool.query("SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid='flow.goal_tool_runs'::regclass AND conname='goal_tool_runs_mode_check'")).rows[0].definition;
  expect(constraint).toContain("'fixture'"); expect(constraint).not.toContain('claude');
  const fixture = await fixtureAuthority();
  const before = await stored(fixture.accepted.run.id);
  expect(before.grant).toMatchObject({ mode: 'fixture', scope: fixture.scope, used_commands: 1 });
  expect(before.calls).toHaveLength(1);
  expect(before.calls[0]).toMatchObject({ command_key: 'saved-command', attempt_id: fixture.input.attemptId, owner_version: 1, sequence: 1 });
  facts.before = { versions: beforeVersions, constraint, stored: before };

  await boss!.stop(); boss = undefined;
  await migrateGoalToolRuns(pool);
  const afterVersions = await versions();
  expect(afterVersions.slice(0, 12)).toEqual(beforeVersions); expect(afterVersions.map(row => row.version)).toEqual([...beforeVersions.map(row => row.version), 13]);
  expect(await stored(fixture.accepted.run.id)).toEqual(before);
  await migrateGoalToolRuns(pool);
  expect(await versions()).toEqual(afterVersions); expect(await stored(fixture.accepted.run.id)).toEqual(before);

  // Production startup runs the migrations again and serves the migrated records over HTTP.
  app = await createServer({ databaseUrl, ownerToken: 'upgrade-owner', leaseMs: 60_000 });
  url = await app.listen({ host: '127.0.0.1', port: 0 });
  expect(await versions()).toEqual(afterVersions);
  const view = await request(`/api/goal-tool-runs/${fixture.accepted.run.id}`);
  expect(view.status).toBe(200); expect(view.body).toEqual({ ...fixture.accepted.run, usedCommands: 1 });
  const replay = await request('/api/runner/goal-tools/command', fixture.input, fixture.runner.token, 'saved-command');
  expect(replay.status).toBe(200); expect(replay.body).toEqual({ ...fixture.result, replayed: true });
  const exhausted = await request('/api/runner/goal-tools/command', { ...fixture.input, command: { ...fixture.input.command, expectedInputVersion: 1 } }, fixture.runner.token, 'new-command');
  expect(exhausted.status).toBe(409); expect(exhausted.body.error.code).toBe('goal_tool_limit');
  const audit = await request(`/api/goal-tool-runs/${fixture.accepted.run.id}/calls`);
  expect(audit.status).toBe(200); expect(audit.body.calls).toHaveLength(1); expect(audit.body.calls[0].key).toBe('saved-command');
  expect(await stored(fixture.accepted.run.id)).toEqual(before);
  for (const sql of ["UPDATE flow.goal_tool_runs SET scope=jsonb_set(scope,'{maxCommands}','32') WHERE id=$1",
    'UPDATE flow.goal_tool_runs SET used_commands=0 WHERE id=$1', "UPDATE flow.goal_tool_runs SET mode='claude' WHERE id=$1"]) {
    await expect(pool.query(sql, [fixture.accepted.run.id])).rejects.toMatchObject({ code: '23514' });
  }
  await expect(pool.query('DELETE FROM flow.goal_tool_calls WHERE run_id=$1', [fixture.accepted.run.id])).rejects.toMatchObject({ code: '23514' });

  const revoked = await request(`/api/goal-tool-runs/${fixture.accepted.run.id}/revoke`, { reason: 'After upgrade' });
  expect(revoked.status).toBe(200); expect(revoked.body.changed).toBe(true);
  const second = await request(`/api/goal-tool-runs/${fixture.accepted.run.id}/revoke`, { reason: 'Must not replace' });
  expect(second.body).toMatchObject({ changed: false, run: { revocationReason: 'After upgrade' } });
  await expect(pool.query('UPDATE flow.goal_tool_runs SET revoked_at=NULL,revocation_reason=NULL WHERE id=$1', [fixture.accepted.run.id])).rejects.toMatchObject({ code: '23514' });
  const denied = await request('/api/runner/goal-tools/command', fixture.input, fixture.runner.token, 'saved-command');
  expect(denied.status).toBe(409); expect(denied.body.error.code).toBe('goal_tool_revoked');

  const nativeRunner = await request('/api/runners', { name: '013 native admission only', harnesses: ['claude'], capacity: 1 });
  expect(nativeRunner.status).toBe(200);
  const profile = await request('/api/runner/execution-profile', { configuration: { harness: 'claude', adapterVersion: 'claude-sdk-0.3.290-v2', model: 'synthetic-no-query', thinking: 'disabled', permissionMode: 'dontAsk', access: 'goal-tools', requireReadApproval: false, materialScopeDigest: '4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945', limits: { maxTurns: 1, maxBudgetUsd: 0.01, timeoutMs: 1000 } } }, nativeRunner.body.token);
  expect(profile.status).toBe(200);
  const native = await request(`/api/goals/${fixture.goalId}/tool-runs`, { scope: fixture.scope, prompt: 'Only admit, never run a model', execution: { harness: 'claude', executionProfile: profile.body.profile.reference } });
  expect(native.status).toBe(201); expect(native.body.run.mode).toBe('claude'); expect(native.body.task.status).toBe('queued');
  const finalFixture = await stored(fixture.accepted.run.id);
  expect(finalFixture.calls).toEqual(before.calls);
  expect(finalFixture.grant).toEqual({ ...before.grant, revoked_at: new Date(revoked.body.run.revokedAt), revocation_reason: 'After upgrade' });
  facts.after = { versions: afterVersions, oldGrant: finalFixture, audit: audit.body.calls, nativeGrant: native.body.run,
    replayStatus: replay.status, quotaStatus: exhausted.status, revokedReplayStatus: denied.status, repeatedMigrationUnchanged: true };
  facts.passed = true;
});
