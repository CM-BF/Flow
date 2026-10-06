import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { Pool } from 'pg';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { createServer } from '../index.js';
import { migrateGoalGraphProposals, registerGoalGraphProposalRoutes } from './index.js';

const name = `flow_o05_${randomUUID().replaceAll('-', '')}`;
const databaseUrl = `postgresql://flow:flow-local-only@127.0.0.1:55432/${name}`;
const admin = new Pool({ connectionString: 'postgresql://flow:flow-local-only@127.0.0.1:55432/postgres', max: 1 });
let created = false;
let pool: Pool;
let app: Awaited<ReturnType<typeof createServer>> | undefined;
let url: string;
let dropAckKey: string | null = null;
const facts: unknown[] = [];
async function start() {
  app = await createServer({ databaseUrl, ownerToken: 'o05-owner', leaseMs: 60_000 });
  await migrateGoalGraphProposals(pool);
  if (!app.hasRoute({ method: 'GET', url: '/api/goal-graph-proposals/:id' })) registerGoalGraphProposalRoutes(app, pool);
  app.addHook('onSend', async (request, reply, payload) => {
    if (dropAckKey && request.headers['idempotency-key'] === dropAckKey && reply.statusCode === 200) {
      dropAckKey = null; reply.raw.socket?.destroy();
    }
    return payload;
  });
  url = await app.listen({ host: '127.0.0.1', port: 0 });
}
beforeAll(async () => {
  await admin.query(`CREATE DATABASE ${name}`); created = true;
  pool = new Pool({ connectionString: databaseUrl, max: 4, statement_timeout: 10_000 });
  await start();
});
afterAll(async () => {
  try {
    await app?.close(); await pool?.end(); if (created) await admin.query(`DROP DATABASE ${name}`);
    facts.push({ cleanup: { database: name, removed: !(await admin.query('SELECT 1 FROM pg_database WHERE datname=$1', [name])).rowCount } });
  } finally {
    await admin.end();
    if (process.env.FLOW_O05_EVIDENCE_FILE) await writeFile(process.env.FLOW_O05_EVIDENCE_FILE, JSON.stringify({ modelCalls: 0, facts }, null, 2) + '\n');
  }
});
async function request(path: string, body?: unknown, key: string = randomUUID(), token = 'o05-owner') {
  const response = await fetch(url + path, { method: body === undefined ? 'GET' : 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', 'idempotency-key': key },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(5000) });
  const text = await response.text();
  return { status: response.status, body: JSON.parse(text), bytes: Buffer.byteLength(text, 'utf8') };
}
async function goal() {
  const project = await request('/api/projects', { title: 'O05 scoped graph' }); expect(project.status).toBe(201);
  const projectId = project.body.snapshot.project.id as string;
  const createdGoal = await request('/api/goals', { projectId, originalGoal: '版本化目标🙂', constraints: 'No models or execution', acceptance: 'Atomic graph' });
  expect(createdGoal.status).toBe(201);
  return { projectId, goalId: createdGoal.body.goal.id as string };
}
const diamond = { expectedProjectRevision: 1, reason: 'Bounded diamond proposal', additions: [
  { key: 'A', title: 'Source', dependencies: [] },
  { key: 'B', title: 'Branch B', dependencies: [{ kind: 'proposed', key: 'A' }] },
  { key: 'C', title: 'Branch C', dependencies: [{ kind: 'proposed', key: 'A' }] },
  { key: 'D', title: 'Join', dependencies: [{ kind: 'proposed', key: 'B' }, { kind: 'proposed', key: 'C' }] },
] };
it('persists a bounded diamond proposal and applies it once with real owner provenance and stable node mapping', async () => {
  const context = await goal(); const path = `/api/goals/${context.goalId}/graph-proposals`;
  const createdProposal = await request(path, diamond, 'proposal'); expect(createdProposal.status).toBe(201);
  const proposal = createdProposal.body.proposal;
  expect(proposal).toMatchObject({ goalId: context.goalId, projectId: context.projectId, baseRevision: 1,
    source: { kind: 'owner-submission' }, nodeCount: 4, edgeCount: 4, state: 'proposed', appliedRevision: null, input: diamond });
  const page = await request(path); expect(page.body.proposals).toHaveLength(1); expect(page.body.proposals[0]).not.toHaveProperty('input');
  await app!.close(); app = undefined; await start();
  expect((await request(`/api/goal-graph-proposals/${proposal.id}`)).body).toEqual(proposal);
  const input = { expectedProjectRevision: 1, proposalDigest: proposal.proposalDigest };
  const applied = await request(`/api/goal-graph-proposals/${proposal.id}/apply`, input, 'apply');
  expect(applied.status).toBe(200); expect(applied.body).toMatchObject({ alreadyApplied: false, replayed: false,
    receipt: { proposalId: proposal.id, goalId: context.goalId, projectId: context.projectId, fromRevision: 1, toRevision: 8, actor: { kind: 'owner' } } });
  const { nodeIds } = applied.body.receipt;
  const current = (await request(`/api/projects/${context.projectId}`)).body;
  expect(current.project.revision).toBe(8); expect(current.graph.nodes).toHaveLength(4);
  expect(current.graph.nodes.find((node: any) => node.id === nodeIds.D).dependsOn.sort()).toEqual([nodeIds.B, nodeIds.C].sort());
  expect(current.graph.nodes.every((node: any) => node.taskId === null && node.parentId === null)).toBe(true);
  expect((await request(`/api/goal-graph-proposals/${proposal.id}/apply`, input, 'apply')).body).toEqual({ ...applied.body, replayed: true });
  expect((await request(`/api/goal-graph-proposals/${proposal.id}/apply`, input, 'different-apply-key')).body).toEqual({ receipt: applied.body.receipt, alreadyApplied: true, replayed: false });
  expect((await request(`/api/projects/${context.projectId}`)).body.project.revision).toBe(8);
  facts.push({ scenario: 'restart-diamond', proposal, receipt: applied.body.receipt, graph: current.graph });
});

it('rejects duplicate, missing, cyclic, stale, foreign and over-limit references without persisting proposals', async () => {
  const context = await goal(); const path = `/api/goals/${context.goalId}/graph-proposals`;
  const foreign = await goal();
  const foreignNode = (await request(`/api/projects/${foreign.projectId}/commands`, { expectedRevision: 1, reason: 'Foreign', change: { kind: 'add-node', title: 'Elsewhere' } })).body.changedNodeId;
  const cases = [
    { ...diamond, additions: [diamond.additions[0], diamond.additions[0]] },
    { ...diamond, additions: [{ key: 'A', title: 'Missing', dependencies: [{ kind: 'proposed', key: 'missing' }] }] },
    { ...diamond, additions: [{ key: 'A', title: 'A', dependencies: [{ kind: 'proposed', key: 'B' }] }, { key: 'B', title: 'B', dependencies: [{ kind: 'proposed', key: 'A' }] }] },
    { ...diamond, additions: [{ key: 'A', title: 'Foreign', dependencies: [{ kind: 'existing', nodeId: foreignNode, expectedVersion: 1 }] }] },
    { ...diamond, expectedProjectRevision: 2 },
    { ...diamond, additions: Array.from({ length: 17 }, (_, n) => ({ key: `N${n}`, title: 'Too many', dependencies: [] })) },
    { ...diamond, additions: [{ key: 'A', title: 'Too many edges', dependencies: Array.from({ length: 129 }, () => ({ kind: 'existing', nodeId: foreignNode, expectedVersion: 1 })) }] },
    { ...diamond, source: { kind: 'runner', attemptId: randomUUID() } },
  ];
  const results = [];
  for (const input of cases) {
    const response = await request(path, input); expect([400, 409]).toContain(response.status); results.push(response.body.error.code);
  }
  const large = await request(path, { ...diamond, reason: 'X'.repeat(70_000) }); expect(large.status).toBe(413);
  expect((await request(path)).body.proposals).toEqual([]);
  expect((await request(`/api/projects/${context.projectId}`)).body.project.revision).toBe(1);
  facts.push({ scenario: 'invalid-proposals', codes: results, oversizedStatus: large.status });
});

it('keeps proposal lists bounded and text-free and rejects changed idempotency payloads', async () => {
  const context = await goal(); const path = `/api/goals/${context.goalId}/graph-proposals`;
  const input = { ...diamond, reason: '私密正文🙂'.repeat(400) };
  const first = await request(path, input, 'same-create'); expect(first.status).toBe(201);
  expect((await request(path, input, 'same-create')).body).toEqual({ ...first.body, replayed: true });
  expect((await request(path, { ...input, reason: 'Different' }, 'same-create')).status).toBe(409);
  await request(path, diamond, 'second-proposal'); await request(path, diamond, 'third-proposal');
  const ids: string[] = []; let after: string | null = null;
  do {
    const page = await request(`${path}?limit=1${after ? `&after=${after}` : ''}`);
    expect(page.status).toBe(200); expect(page.body.proposals).toHaveLength(1); expect(page.bytes).toBeLessThan(1000);
    expect(JSON.stringify(page.body)).not.toContain('私密正文'); expect(page.body.proposals[0]).not.toHaveProperty('input');
    ids.push(page.body.proposals[0].id); after = page.body.nextCursor;
  } while (after);
  expect(new Set(ids).size).toBe(3);
  expect((await request(path + '?limit=51')).status).toBe(400);
  const full = await request(`/api/goal-graph-proposals/${first.body.proposal.id}`);
  expect(full.body.input.reason).toBe(input.reason); expect(full.bytes).toBeGreaterThan(6000);
  facts.push({ scenario: 'bounded-read', detailBytes: full.bytes, pageCount: ids.length, maxPageBytesAsserted: 1000 });
});

it('serializes competing proposals at their saved revision and never silently rebases', async () => {
  const context = await goal(); const path = `/api/goals/${context.goalId}/graph-proposals`;
  const proposals = await Promise.all(['one', 'two'].map(key => request(path, diamond, key)));
  const results = await Promise.all(proposals.map(({ body }) => request(`/api/goal-graph-proposals/${body.proposal.id}/apply`, { expectedProjectRevision: 1, proposalDigest: body.proposal.proposalDigest })));
  expect(results.map(result => result.status).sort()).toEqual([200, 409]);
  expect(results.find(result => result.status === 409)!.body.error.code).toBe('stale_project_revision');
  const current = (await request(`/api/projects/${context.projectId}`)).body;
  expect(current.graph.nodes).toHaveLength(4); expect(current.project.revision).toBe(8);
  const won = results.find(result => result.status === 200)!.body.receipt;
  expect((await request(`/api/goal-graph-proposals/${won.proposalId}/apply`, { expectedProjectRevision: 1, proposalDigest: '0'.repeat(64) })).status).toBe(409);
  facts.push({ scenario: 'concurrent-proposals', statuses: results.map(result => result.status), winningReceipt: won });
});

it('rolls back every intermediate revision on a database failure and reconciles a committed lost ACK', async () => {
  const context = await goal();
  const proposal = (await request(`/api/goals/${context.goalId}/graph-proposals`, diamond)).body.proposal;
  const path = `/api/goal-graph-proposals/${proposal.id}/apply`;
  const input = { expectedProjectRevision: 1, proposalDigest: proposal.proposalDigest };
  await pool.query(`CREATE FUNCTION flow.o05_fail_revision() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
    IF NEW.id='${context.projectId}' AND NEW.revision=3 THEN RAISE EXCEPTION 'O05 injected transaction failure'; END IF; RETURN NEW; END $$;
    CREATE TRIGGER o05_fail_revision BEFORE UPDATE ON flow.projects FOR EACH ROW EXECUTE FUNCTION flow.o05_fail_revision()`);
  try {
    expect((await request(path, input, 'recoverable')).status).toBe(500);
    const current = (await request(`/api/projects/${context.projectId}`)).body;
    expect(current.project.revision).toBe(1); expect(current.graph.nodes).toEqual([]);
    expect((await pool.query('SELECT revision FROM flow.project_revisions WHERE project_id=$1', [context.projectId])).rows).toEqual([{ revision: 1 }]);
    expect((await request(`/api/goal-graph-proposals/${proposal.id}`)).body.state).toBe('proposed');
  } finally { await pool.query('DROP TRIGGER o05_fail_revision ON flow.projects; DROP FUNCTION flow.o05_fail_revision()'); }
  dropAckKey = 'recoverable';
  await expect(request(path, input, 'recoverable')).rejects.toThrow();
  const known = await request(`/api/goal-graph-proposals/${proposal.id}`); expect(known.body.state).toBe('applied');
  await app!.close(); app = undefined; await start();
  const replay = await request(path, input, 'recoverable'); expect(replay.status).toBe(200); expect(replay.body.replayed).toBe(true);
  expect(replay.body.receipt.toRevision).toBe(8);
  expect((await request(`/api/projects/${context.projectId}`)).body.graph.nodes).toHaveLength(4);
  await expect(pool.query("UPDATE flow.goal_graph_proposals SET source='owner-submission' WHERE id=$1", [proposal.id])).rejects.toMatchObject({ code: '23514' });
  await expect(pool.query('DELETE FROM flow.goal_graph_applications WHERE proposal_id=$1', [proposal.id])).rejects.toMatchObject({ code: '23514' });
  facts.push({ scenario: 'rollback-lost-ack', receipt: replay.body.receipt, replayed: replay.body.replayed });
});

it('binds existing references and original goal identity and keeps old runner grants away from new nodes', async () => {
  const context = await goal();
  const existing = (await request(`/api/projects/${context.projectId}/commands`, { expectedRevision: 1, reason: 'Existing', change: { kind: 'add-node', title: 'Existing' } })).body.changedNodeId;
  const grant = await request(`/api/goals/${context.goalId}/tool-runs`, { scope: { readScope: 'whole-goal', allowedNodeIds: [existing], allowedCommands: ['define-input'], maxCommands: 1 }, prompt: 'Existing node only', execution: { harness: 'fixture' } });
  expect(grant.status).toBe(201);
  const runner = (await request('/api/runners', { name: 'Old node grant', harnesses: ['fixture'], capacity: 1 })).body;
  let assignment: any;
  await expect.poll(async () => { assignment = (await request('/api/runner/claim', {}, randomUUID(), runner.token)).body.assignment; return assignment; }, { timeout: 5000, interval: 20 }).not.toBeNull();
  expect(assignment.task.id).toBe(grant.body.task.id);
  const input = { expectedProjectRevision: 2, reason: 'Only new dependent', additions: [{ key: 'N', title: 'New dependent', dependencies: [{ kind: 'existing', nodeId: existing, expectedVersion: 1 }] }] };
  const path = `/api/goals/${context.goalId}/graph-proposals`;
  expect((await request(path, { ...input, additions: [{ ...input.additions[0], dependencies: [{ kind: 'existing', nodeId: existing, expectedVersion: 9 }] }] })).status).toBe(409);
  expect((await request(path, input, randomUUID(), runner.token)).status).toBe(403);
  const proposal = (await request(path, input)).body.proposal;
  const apply = `/api/goal-graph-proposals/${proposal.id}/apply`;
  const applyInput = { expectedProjectRevision: 2, proposalDigest: proposal.proposalDigest };
  expect((await request(apply, applyInput, randomUUID(), runner.token)).status).toBe(403);
  // Fault injection models a future changed original goal; the saved digest must prevent application.
  const original = (await pool.query('SELECT original FROM flow.goals WHERE id=$1', [context.goalId])).rows[0].original;
  await pool.query("UPDATE flow.goals SET original=jsonb_set(original,'{originalGoal}','\"Changed\"') WHERE id=$1", [context.goalId]);
  try { expect((await request(apply, applyInput)).body.error.code).toBe('proposal_goal_changed'); }
  finally { await pool.query('UPDATE flow.goals SET original=$2 WHERE id=$1', [context.goalId, original]); }
  const applied = await request(apply, applyInput); expect(applied.status).toBe(200);
  const newNode = applied.body.receipt.nodeIds.N;
  const current = (await request(`/api/projects/${context.projectId}`)).body;
  expect(current.graph.nodes.find((node: any) => node.id === newNode).dependsOn).toEqual([existing]);
  expect(current.graph.nodes.find((node: any) => node.id === existing).version).toBe(1);
  const denied = await request('/api/runner/goal-tools/command', { attemptId: assignment.attempt.id, ownerVersion: assignment.attempt.ownerVersion,
    grant: { id: grant.body.run.id, version: 1 }, command: { kind: 'define-input', nodeId: newNode, expectedInputVersion: 0,
      input: { goal: 'Out of scope', constraints: '', acceptance: 'Denied', verification: { kind: 'nonempty' } }, reason: 'Must not inherit graph authority' } }, 'deny-new-node', runner.token);
  expect(denied.status).toBe(403); expect(denied.body.error.code).toBe('goal_tool_scope');
  expect((await request(`/api/goal-tool-runs/${grant.body.run.id}`)).body).toMatchObject({ usedCommands: 0, scope: { allowedNodeIds: [existing] } });
  facts.push({ scenario: 'legacy-grant-isolation', newNode, existing, runnerWriteStatus: denied.status, receipt: applied.body.receipt });
});
