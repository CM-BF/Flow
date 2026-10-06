import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { Pool } from 'pg';
import { PgBoss } from 'pg-boss';
import { afterAll, beforeAll, expect, it } from 'vitest';
import type { GoalGraphScope } from '../../../../packages/contracts/src/goal-graph-runs.js';
import type { GoalGraphProposalInput } from '../../../../packages/contracts/src/goal-graph-proposals.js';
import { createServer } from '../index.js';
import { migrateGoalGraphRuns, registerGoalGraphRunRoutes } from './index.js';

const name = `flow_o06_${randomUUID().replaceAll('-', '')}`;
const databaseUrl = `postgresql://flow:flow-local-only@127.0.0.1:55432/${name}`;
const admin = new Pool({ connectionString: 'postgresql://flow:flow-local-only@127.0.0.1:55432/postgres', max: 1 });
let created = false;
let pool: Pool;
let boss: PgBoss;
let app: Awaited<ReturnType<typeof createServer>> | undefined;
let url: string;
let dropAckKey: string | null = null;
const facts: unknown[] = [];
async function start(leaseMs = 60_000) {
  app = await createServer({ databaseUrl, ownerToken: 'o06-owner', leaseMs });
  await migrateGoalGraphRuns(pool);
  if (!app.hasRoute({ method: 'POST', url: '/api/runner/goal-graph/grant' })) registerGoalGraphRunRoutes(app, pool, boss);
  app.addHook('onSend', async (request, reply, payload) => {
    if (dropAckKey && request.headers['idempotency-key'] === dropAckKey && reply.statusCode === 200) { dropAckKey = null; reply.raw.socket?.destroy(); }
    return payload;
  });
  url = await app.listen({ host: '127.0.0.1', port: 0 });
}
async function stop() { await app?.close(); app = undefined; }
beforeAll(async () => {
  await admin.query(`CREATE DATABASE ${name}`); created = true;
  pool = new Pool({ connectionString: databaseUrl, max: 5, statement_timeout: 10_000 });
  boss = new PgBoss({ connectionString: databaseUrl }); await boss.start(); await start();
});
afterAll(async () => {
  try { await stop(); await boss?.stop(); await pool?.end(); if (created) await admin.query(`DROP DATABASE ${name}`);
    facts.push({ cleanup: { database: name, removed: !(await admin.query('SELECT 1 FROM pg_database WHERE datname=$1', [name])).rowCount } });
  } finally { await admin.end(); if (process.env.FLOW_O06_EVIDENCE_FILE) await writeFile(process.env.FLOW_O06_EVIDENCE_FILE, JSON.stringify({ modelCalls: 0, facts }, null, 2) + '\n'); }
});
async function request(path: string, body?: unknown, token = 'o06-owner', key: string = randomUUID()) {
  const response = await fetch(url + path, { method: body === undefined ? 'GET' : 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', 'idempotency-key': key }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(8000) });
  const text = await response.text(); return { status: response.status, body: JSON.parse(text), bytes: Buffer.byteLength(text, 'utf8') };
}
async function goal() {
  const project = (await request('/api/projects', { title: 'O06 bounded authority' })).body.snapshot.project;
  const created = await request('/api/goals', { projectId: project.id, originalGoal: '图授权🙂', constraints: 'No models', acceptance: 'Atomic and faithful' });
  expect(created.status).toBe(201); return { goalId: created.body.goal.id as string, projectId: project.id as string };
}
const scope: GoalGraphScope = { baseRevision: 1, allowedExistingNodes: [], maxProposals: 2, maxApplications: 1, maxNewNodes: 16, maxNewEdges: 128 };
const admission = () => ({ scope: { ...scope }, prompt: 'Propose a bounded graph', execution: { harness: 'fixture' } });
it('persists a dedicated fixture-only grant without giving runner tokens owner access', async () => {
  const context = await goal(); const path = `/api/goals/${context.goalId}/graph-runs`; const input = admission();
  const first = await request(path, input, 'o06-owner', 'admit'); expect(first.status).toBe(201);
  expect(first.body.run).toMatchObject({ ...context, version: 1, scope, mode: 'fixture', usedCommands: 0, usedProposals: 0, usedApplications: 0 });
  expect(first.body.run.goalDigest).toMatch(/^[a-f0-9]{64}$/);
  expect((await request(path, input, 'o06-owner', 'admit')).body).toEqual({ ...first.body, replayed: true });
  expect((await request(path, { ...input, execution: { harness: 'claude' } })).body.error.code).toBe('native_graph_tools_unavailable');
  const runner = (await request('/api/runners', { name: 'Graph fixture', harnesses: ['fixture'], capacity: 1 })).body;
  expect((await request(path, input, runner.token)).status).toBe(403);
  await stop(); await start();
  expect((await request(`/api/goal-graph-runs/${first.body.run.id}`)).body).toEqual(first.body.run);
  await request(`/api/tasks/${first.body.task.id}/cancel`, {});
  facts.push({ scenario: 'durable-admission', run: first.body.run });
});
async function claim(token: string) {
  let assignment: any;
  await expect.poll(async () => { const response = await request('/api/runner/claim', {}, token); expect(response.status).toBe(200); assignment = response.body.assignment; return assignment; }, { timeout: 5000, interval: 20 }).not.toBeNull();
  return { attemptId: assignment.attempt.id as string, ownerVersion: assignment.attempt.ownerVersion as number, taskId: assignment.task.id as string };
}
async function active(context?: Awaited<ReturnType<typeof goal>>, customScope = scope) {
  context ??= await goal();
  const admitted = await request(`/api/goals/${context.goalId}/graph-runs`, { ...admission(), scope: customScope }); expect(admitted.status).toBe(201);
  const runner = (await request('/api/runners', { name: 'Graph planner fixture', harnesses: ['fixture'], capacity: 1 })).body;
  const { taskId, ...ownership } = await claim(runner.token); expect(taskId).toBe(admitted.body.task.id);
  const grant = { id: admitted.body.run.id, version: 1 };
  return { ...context, ...runner, taskId, ownership, grant, call: { ...ownership, grant } };
}
const diamond: GoalGraphProposalInput = { expectedProjectRevision: 1, reason: 'Diamond 🙂', additions: [
  { key: 'A', title: 'Source', dependencies: [] }, { key: 'B', title: 'B', dependencies: [{ kind: 'proposed', key: 'A' }] },
  { key: 'C', title: 'C', dependencies: [{ kind: 'proposed', key: 'A' }] }, { key: 'D', title: 'Join', dependencies: [{ kind: 'proposed', key: 'B' }, { kind: 'proposed', key: 'C' }] },
] };
const call = (run: Awaited<ReturnType<typeof active>>, command: unknown, key: string = randomUUID()) => request('/api/runner/goal-graph/command', { ...run.call, command }, run.token, key);
const propose = (run: Awaited<ReturnType<typeof active>>, input = diamond, key: string = randomUUID()) => call(run, { kind: 'propose', proposal: input }, key);
const apply = (proposal: any) => ({ kind: 'apply', proposalId: proposal.id, proposalDigest: proposal.proposalDigest, expectedProjectRevision: proposal.baseRevision });
it('applies an authorized diamond with real actor and recovers lost ACK after restart despite its own revision change', async () => {
  const run = await active();
  const response = await propose(run, diamond, 'propose'); expect(response.status).toBe(200); const proposal = response.body.proposal;
  const actor = { kind: 'goal-graph-run', runId: run.grant.id, runnerId: run.runnerId, taskId: run.taskId, attemptId: run.ownership.attemptId, ownerVersion: 1 };
  expect(proposal.source).toEqual(actor); expect(proposal).not.toHaveProperty('input');
  expect((await request('/api/runner/goal-graph/proposal', { ...run.call, proposalId: proposal.id }, run.token)).body.input).toEqual(diamond);
  dropAckKey = 'apply-ack'; await expect(call(run, apply(proposal), 'apply-ack')).rejects.toThrow();
  const saved = await request(`/api/goal-graph-proposals/${proposal.id}`); expect(saved.body.state).toBe('applied');
  await stop(); await start();
  const replay = await call(run, apply(proposal), 'apply-ack'); expect(replay.status).toBe(200); expect(replay.body.replayed).toBe(true);
  expect(replay.body.receipt).toMatchObject({ actor, fromRevision: 1, toRevision: 8 });
  const current = (await request(`/api/projects/${run.projectId}`)).body;
  expect(current.graph).toMatchObject({ actor: 'goal-graph-run', actorSource: actor }); expect(current.graph.nodes).toHaveLength(4);
  const ids = replay.body.receipt.nodeIds; expect(current.graph.nodes.find((node: any) => node.id === ids.D).dependsOn.sort()).toEqual([ids.B, ids.C].sort());
  const oldBase = await request('/api/runner/goal-graph/read', run.call, run.token);
  expect(oldBase.body).toMatchObject({ baseRevision: 1, currentRevision: 8, stale: true, nodes: [], nextCursor: null });
  expect((await propose(run, diamond, 'propose')).body.replayed).toBe(true);
  expect((await propose(run, diamond, 'new-after-apply')).body.error.code).toBe('stale_project_revision');
  const page = (await request(`/api/goal-graph-runs/${run.grant.id}/calls?limit=1`)).body;
  expect(page.calls).toHaveLength(1); expect(page.nextCursor).toBe(1);
  const last = (await request(`/api/goal-graph-runs/${run.grant.id}/calls?after=1&limit=1`)).body;
  expect(last.calls[0]).toMatchObject({ runnerId: run.runnerId, attemptId: run.ownership.attemptId, ownerVersion: 1, kind: 'apply', appliedRevision: 8 });
  expect(last.nextCursor).toBeNull(); expect(last.run).toMatchObject({ usedCommands: 2, usedProposals: 1, usedApplications: 1 });
  facts.push({ scenario: 'diamond-ack-restart', receipt: replay.body.receipt, replayed: true, audit: [page.calls[0], last.calls[0]], read: oldBase.body });
});
it('pages immutable base nodes with exact versions and explicit staleness, rejecting cross-grant cursors', async () => {
  const context = await goal(); let revision = 1; const expected: { id: string; title: string; version: number }[] = [];
  for (const title of ['中文🙂', 'Beta', 'Gamma']) {
    const response = await request(`/api/projects/${context.projectId}/commands`, { expectedRevision: revision++, reason: 'Existing graph', change: { kind: 'add-node', title } });
    expect(response.status).toBe(200); expected.push({ id: response.body.changedNodeId, title, version: 1 });
  }
  const run = await active(context, { ...scope, baseRevision: 4 });
  const first = await request('/api/runner/goal-graph/read', { ...run.call, limit: 1 }, run.token); expect(first.status).toBe(200); expect(first.body.nextCursor).toBeTruthy();
  await request(`/api/projects/${run.projectId}/commands`, { expectedRevision: 4, reason: 'Later graph title', change: { kind: 'update-node', nodeId: expected[0]!.id, expectedNodeVersion: 1, title: 'Changed later' } });
  const rows = [...first.body.nodes]; let after = first.body.nextCursor; const bytes = [first.bytes];
  while (after) { const page = await request('/api/runner/goal-graph/read', { ...run.call, limit: 1, after }, run.token); expect(page.status).toBe(200); expect(page.body).toMatchObject({ baseRevision: 4, currentRevision: 5, stale: true }); rows.push(...page.body.nodes); after = page.body.nextCursor; bytes.push(page.bytes); }
  expect(rows.sort((a, b) => a.id.localeCompare(b.id))).toEqual(expected.sort((a, b) => a.id.localeCompare(b.id)));
  expect(Math.max(...bytes)).toBeLessThan(1000); expect(rows.every(row => Object.keys(row).sort().join(',') === 'id,title,version')).toBe(true);
  const other = await active(); expect((await request('/api/runner/goal-graph/read', { ...other.call, after: first.body.nextCursor }, other.token)).body.error.code).toBe('goal_graph_cursor');
  expect((await request('/api/runner/goal-graph/read', { ...run.call, limit: 51 }, run.token)).status).toBe(400);
  expect((await propose(run, { ...diamond, expectedProjectRevision: 4 })).body.error.code).toBe('stale_project_revision');
  facts.push({ scenario: 'immutable-pages', baseRevision: 4, currentRevision: 5, rows, bytes });
});
it('enforces grant identity, existing references, quotas and proposal binding without extending node grants', async () => {
  const run = await active(undefined, { ...scope, maxProposals: 1, maxNewNodes: 1, maxNewEdges: 0 });
  expect((await request('/api/runner/goal-graph/grant', run.ownership)).status).toBe(403);
  const otherRunner = (await request('/api/runners', { name: 'Wrong runner', harnesses: ['fixture'], capacity: 1 })).body;
  expect((await request('/api/runner/goal-graph/grant', run.ownership, otherRunner.token)).status).toBe(403);
  expect((await request('/api/runner/goal-graph/grant', { ...run.ownership, ownerVersion: 2 }, run.token)).body.error.code).toBe('stale_owner');
  expect((await request('/api/runner/goal-graph/read', { ...run.call, grant: { id: randomUUID(), version: 1 } }, run.token)).body.error.code).toBe('goal_graph_grant_mismatch');
  expect((await request('/api/runner/goal-tools/grant', run.ownership, run.token)).status).toBe(403);
  expect((await propose(run)).body.error.code).toBe('goal_graph_scope');
  const small = { ...diamond, additions: [diamond.additions[0]!] };
  const own = await propose(run, small, 'stable'); expect(own.status).toBe(200);
  expect((await propose(run, small, 'stable')).body.replayed).toBe(true);
  expect((await propose(run, { ...small, reason: 'different' }, 'stable')).body.error.code).toBe('idempotency_conflict');
  expect((await propose(run, small)).body.error.code).toBe('goal_graph_limit');
  const foreign = await active(); const foreignProposal = (await propose(foreign)).body.proposal;
  expect((await call(run, apply(foreignProposal))).status).toBe(403);
  const ownerProposal = (await request(`/api/goals/${run.goalId}/graph-proposals`, small)).body.proposal;
  expect((await call(run, apply(ownerProposal))).status).toBe(403);
  expect((await call(run, { ...apply(own.body.proposal), proposalDigest: '0'.repeat(64) })).body.error.code).toBe('proposal_mismatch');
  expect((await request(`/api/goal-graph-runs/${run.grant.id}/calls`, undefined, run.token)).status).toBe(403);
  expect((await request(`/api/goal-graph-runs/${run.grant.id}/calls?limit=51`)).status).toBe(400);
  const context = await goal(); const node = (await request(`/api/projects/${context.projectId}/commands`, { expectedRevision: 1, reason: 'Node grant only', change: { kind: 'add-node', title: 'Existing' } })).body.changedNodeId;
  const old = await request(`/api/goals/${context.goalId}/tool-runs`, { scope: { readScope: 'whole-goal', allowedNodeIds: [node], allowedCommands: ['define-input'], maxCommands: 1 }, prompt: 'Existing only', execution: { harness: 'fixture' } }); expect(old.status).toBe(201);
  const oldRunner = (await request('/api/runners', { name: 'Old authority', harnesses: ['fixture'], capacity: 1 })).body;
  const { taskId: _task, ...ownership } = await claim(oldRunner.token);
  expect((await request('/api/runner/goal-graph/grant', ownership, oldRunner.token)).body.error.code).toBe('goal_graph_forbidden');
  const refRun = await active(context, { ...scope, baseRevision: 2, allowedExistingNodes: [] });
  const dependent: GoalGraphProposalInput = { expectedProjectRevision: 2, reason: 'Scoped reference', additions: [{ key: 'N', title: 'Dependent', dependencies: [{ kind: 'existing', nodeId: node, expectedVersion: 1 }] }] };
  expect((await propose(refRun, dependent)).body.error.code).toBe('goal_graph_scope');
  const allowed = await active(context, { ...scope, baseRevision: 2, allowedExistingNodes: [{ nodeId: node, expectedVersion: 1 }] });
  const proposal = (await propose(allowed, dependent)).body.proposal; expect(proposal.source.runId).toBe(allowed.grant.id);
  expect((await call(allowed, apply(proposal))).status).toBe(200);
  facts.push({ scenario: 'scope-isolation', oldNodeGrant: old.body.run.id, graphGrant: allowed.grant.id, existingNode: node });
});
it('keeps graph commands and audits atomic through a mid-apply database failure and immutable history', async () => {
  const run = await active(); const proposal = (await propose(run)).body.proposal;
  await pool.query(`CREATE FUNCTION flow.o06_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.id='${run.projectId}' AND NEW.revision=3 THEN RAISE EXCEPTION 'O06 failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER o06_fail BEFORE UPDATE ON flow.projects FOR EACH ROW EXECUTE FUNCTION flow.o06_fail()`);
  try {
    expect((await call(run, apply(proposal), 'atomic')).status).toBe(500);
    expect((await request(`/api/projects/${run.projectId}`)).body.project.revision).toBe(1);
    expect((await request(`/api/goal-graph-runs/${run.grant.id}/calls`)).body).toMatchObject({ run: { usedCommands: 1, usedApplications: 0 }, calls: [expect.objectContaining({ kind: 'propose' })] });
    expect((await request(`/api/goal-graph-proposals/${proposal.id}`)).body.state).toBe('proposed');
    expect((await pool.query('SELECT revision FROM flow.project_revisions WHERE project_id=$1', [run.projectId])).rows).toEqual([{ revision: 1 }]);
  } finally { await pool.query('DROP TRIGGER o06_fail ON flow.projects; DROP FUNCTION flow.o06_fail()'); }
  const applied = await call(run, apply(proposal), 'atomic'); expect(applied.status).toBe(200);
  await expect(pool.query("UPDATE flow.goal_graph_runs SET scope=jsonb_set(scope,'{maxNewNodes}','16') WHERE id=$1", [run.grant.id])).resolves.toBeDefined(); // Exact same immutable scope is permitted.
  await expect(pool.query("UPDATE flow.goal_graph_runs SET scope=jsonb_set(scope,'{maxNewNodes}','15') WHERE id=$1", [run.grant.id])).rejects.toMatchObject({ code: '23514' });
  await expect(pool.query('DELETE FROM flow.goal_graph_calls WHERE run_id=$1', [run.grant.id])).rejects.toMatchObject({ code: '23514' });
  facts.push({ scenario: 'rollback', receipt: applied.body.receipt });
});
for (const action of ['revoke', 'cancel'] as const) it(`revalidates cached success against concurrent ${action} after locking the project`, async () => {
  const run = await active(); const proposal = (await propose(run)).body.proposal; const command = apply(proposal);
  expect((await call(run, command, 'cached-race')).status).toBe(200);
  const held = await pool.connect(); await held.query('BEGIN'); await held.query('SELECT id FROM flow.projects WHERE id=$1 FOR UPDATE', [run.projectId]);
  let pending: ReturnType<typeof call> | undefined;
  try {
    pending = call(run, command, 'cached-race');
    await expect.poll(async () => Number((await pool.query("SELECT count(*) FROM pg_stat_activity WHERE datname=$1 AND wait_event_type='Lock' AND query LIKE '%FROM flow.projects%FOR UPDATE%'", [name])).rows[0].count), { timeout: 2000, interval: 20 }).toBeGreaterThan(0);
    const response = action === 'revoke' ? await request(`/api/goal-graph-runs/${run.grant.id}/revoke`, { reason: 'No further authority' }) : await request(`/api/tasks/${run.taskId}/cancel`, {});
    expect(response.status).toBe(200);
  } finally { await held.query('ROLLBACK'); held.release(); }
  const response = await pending!; expect(response.status).toBe(409); expect(response.body.error.code).toBe(action === 'revoke' ? 'goal_graph_revoked' : 'goal_graph_inactive');
  expect((await request(`/api/goal-graph-runs/${run.grant.id}`)).body.usedCommands).toBe(2);
  facts.push({ scenario: `${action}-replay-race`, code: response.body.error.code });
});
it('serializes competing CAS applies and enforces proposal-only scope and current lease', async () => {
  const context = await goal(); const first = await active(context); const second = await active(context);
  const p1 = (await propose(first)).body.proposal; const p2 = (await propose(second)).body.proposal;
  const results = await Promise.all([call(first, apply(p1)), call(second, apply(p2))]); expect(results.map(result => result.status).sort()).toEqual([200, 409]);
  expect((await request(`/api/projects/${context.projectId}`)).body.graph.nodes).toHaveLength(4);
  const only = await active(undefined, { ...scope, maxApplications: 0 }); const proposal = (await propose(only)).body.proposal;
  expect((await call(only, apply(proposal))).status).toBe(403);
  await stop(); await start(200);
  const expiring = await active(); const recorded = await propose(expiring, diamond, 'expired'); expect(recorded.status).toBe(200);
  await new Promise(resolve => setTimeout(resolve, 260));
  expect((await propose(expiring, diamond, 'expired')).body.error.code).toBe('goal_graph_inactive');
  await stop(); await start();
  facts.push({ scenario: 'cas-lease', statuses: results.map(result => result.status), expiredReplay: 'rejected' });
});
