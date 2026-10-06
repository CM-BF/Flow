import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { Pool } from 'pg';
import type { PgBoss } from 'pg-boss';
import { afterAll, beforeAll, expect, it } from 'vitest';
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
import { migrateGoalToolRuns } from '../goal-tool-runs/index.js';
import { admit } from '../goal-tool-runs/store.js';
import { runnerCommand } from '../goal-tool-runs/runner.js';
import { migrateGoalGraphProposals } from '../goal-graph-proposals/index.js';
import { createProposal, applyProposal } from '../goal-graph-proposals/store.js';
import { migrateGoalGraphRuns } from './index.js';
import { registerRunner } from '../runners.js';
import { startScheduler } from '../scheduler.js';
import type { GoalToolCommandCall } from '../../../../packages/contracts/src/goal-tool-runs.js';

const name = `flow_o06_upgrade_${randomUUID().replaceAll('-', '')}`;
const databaseUrl = `postgresql://flow:flow-local-only@127.0.0.1:55432/${name}`;
const admin = new Pool({ connectionString: 'postgresql://flow:flow-local-only@127.0.0.1:55432/postgres', max: 1 });
let created = false; let pool: Pool; let boss: PgBoss; let app: Awaited<ReturnType<typeof createServer>> | undefined;
const facts: Record<string, unknown> = { modelCalls: 0, database: name };
beforeAll(async () => {
  await admin.query(`CREATE DATABASE ${name}`); created = true;
  pool = new Pool({ connectionString: databaseUrl, max: 4, statement_timeout: 10_000 });
  // Build the real 014 state forward; never remove a production migration.
  for (const migration of [migrate, migrateWorkspace, migrateProjects, migrateProtocolDispatch, migrateGoals, migrateConversations,
    migratePlugins, migrateAssistantMessages, migrateExecutionProfiles, migrateConversationQueue, migrateGoalToolRuns, migrateGoalGraphProposals]) await migration(pool);
  boss = await startScheduler(databaseUrl, pool);
});
afterAll(async () => {
  try { await app?.close(); await boss?.stop(); await pool?.end(); if (created) await admin.query(`DROP DATABASE ${name}`);
    facts.databaseRemoved = !(await admin.query('SELECT 1 FROM pg_database WHERE datname=$1', [name])).rowCount;
  } finally { await admin.end(); if (process.env.FLOW_O06_UPGRADE_EVIDENCE) await writeFile(process.env.FLOW_O06_UPGRADE_EVIDENCE, JSON.stringify(facts, null, 2) + '\n'); }
});
async function records(runId: string, projectId: string, proposalId: string) {
  return { grant: (await pool.query('SELECT * FROM flow.goal_tool_runs WHERE id=$1', [runId])).rows,
    calls: (await pool.query('SELECT * FROM flow.goal_tool_calls WHERE run_id=$1 ORDER BY sequence', [runId])).rows,
    revisions: (await pool.query('SELECT * FROM flow.project_revisions WHERE project_id=$1 ORDER BY revision', [projectId])).rows,
    proposal: (await pool.query('SELECT * FROM flow.goal_graph_proposals WHERE id=$1', [proposalId])).rows,
    receipt: (await pool.query('SELECT * FROM flow.goal_graph_applications WHERE proposal_id=$1', [proposalId])).rows };
}
it('upgrades populated 014 grants, audit and owner graph history forward to 017 without rewriting any previous facts', async () => {
  const versions = (await pool.query('SELECT * FROM flow.migrations ORDER BY version')).rows;
  expect(versions.map(row => row.version)).toEqual(Array.from({ length: 14 }, (_, index) => index + 1));
  const project = await createProject(pool, { workspaceId: 'personal', title: 'Existing owner graph' }, 'project'); const projectId = project.snapshot.project.id;
  const node = await changeProject(pool, projectId, { expectedRevision: 1, reason: 'Existing', change: { kind: 'add-node', title: 'A', taskId: null, parent: null } }, 'node');
  const goal = await createGoal(pool, { projectId, originalGoal: 'Upgrade', constraints: 'No models', acceptance: 'Preserved' }, 'goal');
  const grant = await admit(pool, boss, goal.goal.id, { scope: { readScope: 'whole-goal', allowedNodeIds: [node.changedNodeId!], allowedCommands: ['define-input'], maxCommands: 1 }, prompt: 'Existing grant', execution: { harness: 'fixture' } }, 'grant');
  const runner = await registerRunner(pool, { name: 'Existing node runner', harnesses: ['fixture'], capacity: 1 });
  // A persisted pre-017 fixture attempt: current claim requires newer graph/context tables.
  // The actual node command below still exercises production authorization and mutation.
  const attemptId = randomUUID();
  await transaction(pool, async client => {
    await client.query("INSERT INTO flow.attempts(id,task_id,runner_id,owner_version,lease_expires_at) VALUES($1,$2,$3,1,clock_timestamp()+interval '60 seconds')", [attemptId, grant.task.id, runner.runnerId]);
    await client.query("UPDATE flow.tasks SET status='running',current_attempt_id=$2,owner_version=1 WHERE id=$1", [grant.task.id, attemptId]);
  });
  const input: GoalToolCommandCall = { attemptId, ownerVersion: 1, grant: { id: grant.run.id, version: 1 },
    command: { kind: 'define-input', nodeId: node.changedNodeId!, expectedInputVersion: 0, input: { goal: 'Retained', constraints: '', acceptance: 'Once', verification: { kind: 'nonempty' } }, reason: 'Before 017' } };
  const result = await runnerCommand(pool, boss, runner.runnerId, input, 'node-command'); expect(result.changed).toBe(true);
  const proposal = (await createProposal(pool, goal.goal.id, { expectedProjectRevision: 2, reason: 'Owner proposal', additions: [{ key: 'N', title: 'Owner addition', dependencies: [] }] }, 'proposal')).proposal;
  const receipt = await applyProposal(pool, proposal.id, { expectedProjectRevision: 2, proposalDigest: proposal.proposalDigest }, 'apply'); expect(receipt.receipt.actor).toEqual({ kind: 'owner' });
  const before = await records(grant.run.id, projectId, proposal.id); expect(before.calls).toHaveLength(1);
  await migrateGoalGraphRuns(pool); const after = (await pool.query('SELECT * FROM flow.migrations ORDER BY version')).rows;
  expect(after.filter(row => row.version <= 14)).toEqual(versions); expect(after.filter(row => row.version === 17)).toHaveLength(1);
  expect(after.filter(row => row.version > 17).map(row => row.version)).toEqual([19]);
  expect(await records(grant.run.id, projectId, proposal.id)).toEqual(before);
  await migrateGoalGraphRuns(pool); expect((await pool.query('SELECT * FROM flow.migrations ORDER BY version')).rows).toEqual(after);
  expect(await records(grant.run.id, projectId, proposal.id)).toEqual(before);
  app = await createServer({ databaseUrl, ownerToken: 'upgrade-owner', leaseMs: 60_000 }); const url = await app.listen({ host: '127.0.0.1', port: 0 });
  const response = await fetch(url + '/api/runner/goal-tools/command', { method: 'POST', headers: { authorization: `Bearer ${runner.token}`, 'content-type': 'application/json', 'idempotency-key': 'node-command' }, body: JSON.stringify(input) });
  expect(response.status).toBe(200); expect(await response.json()).toEqual({ ...result, replayed: true });
  const view = await fetch(url + `/api/projects/${projectId}`, { headers: { authorization: 'Bearer upgrade-owner' } });
  const snapshot = await view.json(); expect(snapshot.graph.actor).toBe('owner'); expect(snapshot.graph).not.toHaveProperty('actorSource');
  expect(await records(grant.run.id, projectId, proposal.id)).toEqual(before);
  await expect(pool.query("UPDATE flow.goal_tool_runs SET scope=jsonb_set(scope,'{maxCommands}','32') WHERE id=$1", [grant.run.id])).rejects.toMatchObject({ code: '23514' });
  await expect(pool.query('DELETE FROM flow.goal_graph_applications WHERE proposal_id=$1', [proposal.id])).rejects.toMatchObject({ code: '23514' });
  facts.before = { versions, records: before }; facts.after = { versions: after, recordsUnchanged: true, replayed: true, actor: snapshot.graph.actor };
});
