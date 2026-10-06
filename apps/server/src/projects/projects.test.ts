import { randomUUID } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { createServer } from '../index.js';
import { migrateProjects, registerProjectRoutes } from './index.js';
import type { ProjectNode, ProjectSnapshot } from '../../../../packages/contracts/src/projects.js';

const databaseUrl = 'postgresql://flow:flow-local-only@127.0.0.1:55432/flow_g01';
const admin = new Pool({ connectionString: 'postgresql://flow:flow-local-only@127.0.0.1:55432/postgres', max: 1, connectionTimeoutMillis: 5000 });
const ownerToken = 'g01-local-owner';
let databaseLock: PoolClient | undefined;
let createdDatabase = false;
let pool: Pool;
let server: Awaited<ReturnType<typeof createServer>> | undefined;
let baseUrl: string;

async function request(path: string, body?: unknown, options: { token?: string; key?: string } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { authorization: `Bearer ${options.token ?? ownerToken}`, 'content-type': 'application/json', 'idempotency-key': options.key ?? randomUUID() },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(10_000),
  });
  return { status: response.status, body: await response.json() };
}
async function startServer() {
  server = await createServer({ databaseUrl, ownerToken });
  if (!server.hasRoute({ method: 'GET', url: '/api/projects' })) {
    await migrateProjects(pool);
    registerProjectRoutes(server, pool);
  }
  baseUrl = await server.listen({ host: '127.0.0.1', port: 0 });
}
beforeAll(async () => {
  databaseLock = await admin.connect();
  const locked = await databaseLock.query("SELECT pg_try_advisory_lock(hashtextextended('flow_g01_test_exclusive',0)) AS locked");
  if (!locked.rows[0]?.locked) throw new Error('Another G01 test run owns flow_g01.');
  if ((await databaseLock.query("SELECT 1 FROM pg_database WHERE datname='flow_g01'")).rowCount) throw new Error('flow_g01 already exists; preserve it until its owner confirms cleanup.');
  await databaseLock.query('CREATE DATABASE flow_g01'); createdDatabase = true;
  pool = new Pool({ connectionString: databaseUrl, max: 8, connectionTimeoutMillis: 5000, statement_timeout: 5000 });
  await startServer();
});
afterAll(async () => {
  try { await server?.close(); }
  finally {
    await pool?.end();
    try { if (createdDatabase) await databaseLock?.query('DROP DATABASE flow_g01'); }
    finally { databaseLock?.release(); await admin.end(); }
  }
});

it('persists personal workspace and a queryable empty project without submitting execution tasks', async () => {
  const workspace = await request('/api/workspaces');
  expect(workspace.status).toBe(200);
  expect(workspace.body.workspaces).toEqual([{ id: 'personal', title: 'Personal', createdAt: expect.any(String) }]);
  const accepted = await request('/api/projects', { title: 'Independent plan' });
  expect(accepted.status).toBe(201);
  expect(accepted.body.snapshot).toMatchObject({ project: { workspaceId: 'personal', title: 'Independent plan', revision: 1 }, graph: { revision: 1, nodes: [] }, tasks: [] });
  const read = await request(`/api/projects/${accepted.body.snapshot.project.id}`);
  expect(read.body).toEqual(accepted.body.snapshot);
  expect((await request('/api/tasks')).body.tasks).toEqual([]);
});

async function newProject(title = 'Project fixture'): Promise<ProjectSnapshot> {
  const accepted = await request('/api/projects', { title });
  expect(accepted.status).toBe(201);
  return accepted.body.snapshot;
}
async function change(snapshot: ProjectSnapshot, operation: unknown, key = randomUUID()) {
  return request(`/api/projects/${snapshot.project.id}/commands`, { expectedRevision: snapshot.project.revision, reason: 'Explicit owner plan change', change: operation }, { key });
}

it('adds an unbound versioned node, retains old graph and replays one durable command result', async () => {
  const original = await newProject();
  const key = randomUUID();
  const input = { kind: 'add-node', title: 'Plan before execution' };
  const accepted = await change(original, input, key);
  expect(accepted.status).toBe(200);
  const snapshot: ProjectSnapshot = accepted.body.snapshot;
  expect(snapshot.project.revision).toBe(2);
  expect(snapshot.graph.nodes).toEqual([{ id: accepted.body.changedNodeId, title: 'Plan before execution', taskId: null, parentId: null, version: 1, dependsOn: [] }]);
  expect(snapshot.tasks).toEqual([]);
  const replay = await change(original, input, key);
  expect(replay.body).toEqual({ ...accepted.body, replayed: true });
  expect((await change(original, { ...input, title: 'Changed input' }, key)).status).toBe(409);
  expect((await request(`/api/projects/${snapshot.project.id}?revision=1`)).body.graph.nodes).toEqual([]);
});

async function addNode(snapshot: ProjectSnapshot, title: string, parent?: ProjectNode) {
  const response = await change(snapshot, { kind: 'add-node', title, parent: parent ? { nodeId: parent.id, expectedVersion: parent.version } : null });
  expect(response.status).toBe(200);
  const next: ProjectSnapshot = response.body.snapshot;
  return { snapshot: next, node: next.graph.nodes.find(node => node.id === response.body.changedNodeId)! };
}

it('serializes opposite dependency proposals per project while another project keeps progressing', async () => {
  const a = await addNode(await newProject(), 'A');
  const b = await addNode(a.snapshot, 'B');
  const other = await newProject('Unrelated project');
  const blocker = await pool.connect();
  let proposals: Promise<Awaited<ReturnType<typeof request>>>[] = [];
  try {
    await blocker.query('BEGIN');
    await blocker.query('SELECT id FROM flow.projects WHERE id=$1 FOR UPDATE', [b.snapshot.project.id]);
    proposals = [change(b.snapshot, { kind: 'set-dependencies', nodeId: a.node.id, expectedNodeVersion: 1, dependencies: [{ nodeId: b.node.id, expectedVersion: 1 }] }),
      change(b.snapshot, { kind: 'set-dependencies', nodeId: b.node.id, expectedNodeVersion: 1, dependencies: [{ nodeId: a.node.id, expectedVersion: 1 }] })];
    await expect.poll(async () => Number((await databaseLock!.query("SELECT count(*) FROM pg_stat_activity WHERE datname='flow_g01' AND wait_event_type='Lock'")).rows[0].count)).toBeGreaterThanOrEqual(2);
    expect((await addNode(other, 'Unrelated progress')).snapshot.project.revision).toBe(2);
    await blocker.query('COMMIT');
    const responses = await Promise.all(proposals);
    expect(responses.map(response => response.status).sort()).toEqual([200, 409]);
    const winner: ProjectSnapshot = responses.find(response => response.status === 200)!.body.snapshot;
    expect(winner.project.revision).toBe(b.snapshot.project.revision + 1);
    const dependent = winner.graph.nodes.find(node => node.dependsOn.length === 1)!;
    const prerequisite = winner.graph.nodes.find(node => node.id === dependent.dependsOn[0])!;
    const cycle = await change(winner, { kind: 'set-dependencies', nodeId: prerequisite.id, expectedNodeVersion: prerequisite.version, dependencies: [{ nodeId: dependent.id, expectedVersion: dependent.version }] });
    expect(cycle.status).toBe(409); expect(cycle.body.error.code).toBe('dependency_cycle');
    expect((await request(`/api/projects/${winner.project.id}`)).body.graph).toEqual(winner.graph);
  } finally { await blocker.query('ROLLBACK'); blocker.release(); await Promise.allSettled(proposals); }
});

it('fences project, node and parent versions and refuses tree cycles or silently truncated references', async () => {
  const parent = await addNode(await newProject(), 'Parent');
  const child = await addNode(parent.snapshot, 'Child', parent.node);
  const revised = await change(child.snapshot, { kind: 'update-node', nodeId: parent.node.id, expectedNodeVersion: 1, title: 'Revised parent' });
  expect(revised.status).toBe(200);
  let current: ProjectSnapshot = revised.body.snapshot;
  expect(current.graph.nodes.find(node => node.id === parent.node.id)?.version).toBe(2);
  expect((await change(child.snapshot, { kind: 'update-node', nodeId: child.node.id, expectedNodeVersion: 1, title: 'Stale project' })).body.error.code).toBe('stale_project_revision');
  expect((await change(current, { kind: 'add-node', title: 'Stale parent', parent: { nodeId: parent.node.id, expectedVersion: 1 } })).body.error.code).toBe('stale_parent_version');
  expect((await change(current, { kind: 'update-node', nodeId: child.node.id, expectedNodeVersion: 99, title: 'Stale child' })).body.error.code).toBe('stale_node_version');
  expect((await change(current, { kind: 'set-dependencies', nodeId: child.node.id, expectedNodeVersion: 1, dependencies: [{ nodeId: parent.node.id, expectedVersion: 1 }] })).body.error.code).toBe('stale_dependency_version');
  expect((await change(current, { kind: 'reparent-node', nodeId: parent.node.id, expectedNodeVersion: 2, parent: { nodeId: child.node.id, expectedVersion: 1 } })).body.error.code).toBe('parent_cycle');
  expect((await change(current, { kind: 'remove-node', nodeId: parent.node.id, expectedNodeVersion: 2 })).body.error.code).toBe('node_referenced');
  current = (await change(current, { kind: 'set-dependencies', nodeId: parent.node.id, expectedNodeVersion: 2, dependencies: [{ nodeId: child.node.id, expectedVersion: 1 }] })).body.snapshot;
  expect((await change(current, { kind: 'remove-node', nodeId: child.node.id, expectedNodeVersion: 1 })).body.error.code).toBe('node_referenced');
  current = (await change(current, { kind: 'set-dependencies', nodeId: parent.node.id, expectedNodeVersion: 3, dependencies: [] })).body.snapshot;
  current = (await change(current, { kind: 'remove-node', nodeId: child.node.id, expectedNodeVersion: 1 })).body.snapshot;
  current = (await change(current, { kind: 'remove-node', nodeId: parent.node.id, expectedNodeVersion: 4 })).body.snapshot;
  expect(current.graph.nodes).toEqual([]);
  expect((await request(`/api/projects/${current.project.id}?revision=3`)).body.graph.nodes).toHaveLength(2);
});

it('binds an existing task once, reads authoritative live state and preserves graph history across restart', async () => {
  const plan = await addNode(await newProject(), 'Planned work');
  const task = (await request('/api/tasks', { title: 'Execution identity', prompt: 'No model will execute', harness: 'fixture' })).body.task;
  const key = randomUUID();
  const input = { kind: 'bind-task', nodeId: plan.node.id, expectedNodeVersion: 1, taskId: task.id };
  const bound = await change(plan.snapshot, input, key);
  expect(bound.status).toBe(200);
  expect(bound.body.snapshot.tasks).toEqual([task]);
  expect(bound.body.snapshot.graph.nodes[0]).toMatchObject({ taskId: task.id, version: 2 });
  const other = await newProject();
  expect((await change(other, { kind: 'add-node', title: 'Duplicate task', taskId: task.id })).body.error.code).toBe('task_already_bound');
  expect((await change(bound.body.snapshot, { ...input, expectedNodeVersion: 2 })).body.error.code).toBe('node_already_bound');
  await request(`/api/tasks/${task.id}/cancel`, {});
  const latest = (await request(`/api/projects/${plan.snapshot.project.id}`)).body;
  expect(latest.project.revision).toBe(3); expect(latest.tasks[0].status).toBe('cancelled');
  expect(latest.graph).toEqual(bound.body.snapshot.graph);
  expect((await change(plan.snapshot, input, key)).body).toEqual({ ...bound.body, replayed: true });
  await server!.close(); server = undefined; await startServer();
  expect((await request(`/api/projects/${plan.snapshot.project.id}`)).body).toEqual(latest);
  expect((await request(`/api/projects/${plan.snapshot.project.id}?revision=2`)).body.graph.nodes[0].taskId).toBeNull();
});

it('lists durable projects with a bounded cursor and inherits owner-only HTTP authorization', async () => {
  const project = await newProject('Discoverable after restart');
  const ids: string[] = [];
  let after = '';
  do {
    const page = await request(`/api/projects?limit=2${after ? `&after=${after}` : ''}`);
    expect(page.status).toBe(200); expect(page.body.projects.length).toBeLessThanOrEqual(2);
    ids.push(...page.body.projects.map((item: { id: string }) => item.id));
    after = page.body.nextCursor ?? '';
  } while (after);
  expect(new Set(ids).size).toBe(ids.length); expect(ids).toContain(project.project.id);
  expect((await request('/api/projects?limit=0')).status).toBe(400);
  expect((await request('/api/projects?workspaceId=other')).status).toBe(404);
  expect((await request('/api/workspaces', undefined, { token: '' })).status).toBe(401);
  const runner = (await request('/api/runners', { name: 'Read role check', harnesses: ['fixture'], capacity: 1 })).body;
  expect((await request(`/api/projects/${project.project.id}`, undefined, { token: runner.token })).status).toBe(403);
  expect((await request('/api/projects', { title: 'No idempotency' }, { key: '' })).status).toBe(400);
  expect((await request('/api/projects', { title: 'Unsupported workspace', workspaceId: 'other' })).status).toBe(400);
  expect((await request(`/api/projects/${project.project.id}?revision=999`)).status).toBe(404);
  expect((await request(`/api/projects/${project.project.id}?revision=-1`)).status).toBe(400);
});

it('rejects cross-project references, duplicate edges and missing execution identities atomically', async () => {
  const local = await addNode(await newProject(), 'Local');
  const foreign = await addNode(await newProject(), 'Foreign');
  const foreignReference = { nodeId: foreign.node.id, expectedVersion: 1 };
  const ownReference = { nodeId: local.node.id, expectedVersion: 1 };
  const cases = [
    [{ kind: 'add-node', title: 'Foreign child', parent: foreignReference }, 'parent_not_found'],
    [{ kind: 'reparent-node', nodeId: local.node.id, expectedNodeVersion: 1, parent: ownReference }, 'parent_cycle'],
    [{ kind: 'set-dependencies', nodeId: local.node.id, expectedNodeVersion: 1, dependencies: [foreignReference] }, 'dependency_not_found'],
    [{ kind: 'set-dependencies', nodeId: local.node.id, expectedNodeVersion: 1, dependencies: [ownReference] }, 'dependency_cycle'],
    [{ kind: 'set-dependencies', nodeId: local.node.id, expectedNodeVersion: 1, dependencies: [ownReference, ownReference] }, 'duplicate_dependency'],
    [{ kind: 'bind-task', nodeId: local.node.id, expectedNodeVersion: 1, taskId: randomUUID() }, 'task_not_found'],
  ] as const;
  for (const [input, code] of cases) {
    const rejected = await change(local.snapshot, input);
    expect(rejected.status).toBe(code === 'task_not_found' ? 404 : 409);
    expect(rejected.body.error.code).toBe(code);
    expect((await request(`/api/projects/${local.snapshot.project.id}`)).body).toEqual(local.snapshot);
  }
});

it('allows only one simultaneous cross-project binding and releases a removed leaf without cancelling its task', async () => {
  const left = await addNode(await newProject(), 'Left');
  const right = await addNode(await newProject(), 'Right');
  const task = (await request('/api/tasks', { title: 'One execution identity', prompt: 'No execution requested', harness: 'fixture' })).body.task;
  const blocker = await pool.connect();
  let proposals: Promise<Awaited<ReturnType<typeof request>>>[] = [];
  try {
    await blocker.query('BEGIN');
    await blocker.query('SELECT id FROM flow.tasks WHERE id=$1 FOR UPDATE', [task.id]);
    proposals = [left, right].map(plan => change(plan.snapshot, { kind: 'bind-task', nodeId: plan.node.id, expectedNodeVersion: 1, taskId: task.id }));
    await expect.poll(async () => Number((await databaseLock!.query("SELECT count(*) FROM pg_stat_activity WHERE datname='flow_g01' AND wait_event_type='Lock'")).rows[0].count)).toBeGreaterThanOrEqual(2);
    await blocker.query('COMMIT');
    const results = await Promise.all(proposals);
    expect(results.map(result => result.status).sort()).toEqual([200, 409]);
    const winner: ProjectSnapshot = results.find(result => result.status === 200)!.body.snapshot;
    const loser = winner.project.id === left.snapshot.project.id ? right : left;
    expect(results.find(result => result.status === 409)!.body.error.code).toBe('task_already_bound');
    expect((await request(`/api/projects/${loser.snapshot.project.id}`)).body).toEqual(loser.snapshot);
    expect((await change(winner, { kind: 'remove-node', nodeId: winner.graph.nodes[0]!.id, expectedNodeVersion: 2 })).status).toBe(200);
    const rebound = await change(loser.snapshot, { kind: 'bind-task', nodeId: loser.node.id, expectedNodeVersion: 1, taskId: task.id });
    expect(rebound.status).toBe(200); expect(rebound.body.snapshot.tasks[0].status).toBe('queued');
    expect((await request(`/api/projects/${winner.project.id}?revision=3`)).body.graph.nodes[0].taskId).toBe(task.id);
  } finally { await blocker.query('ROLLBACK'); blocker.release(); await Promise.allSettled(proposals); }
});

it('keeps committed revisions immutable at the migration boundary and repeats migration safely', async () => {
  const plan = await addNode(await newProject(), 'Immutable history');
  for (const sql of [
    'UPDATE flow.project_revisions SET reason=reason WHERE project_id=$1',
    'DELETE FROM flow.project_revisions WHERE project_id=$1',
  ]) await expect(pool.query(sql, [plan.snapshot.project.id])).rejects.toMatchObject({ code: '23514' });
  await expect(pool.query('TRUNCATE flow.project_revisions CASCADE')).rejects.toMatchObject({ code: '23514' });
  await migrateProjects(pool);
  expect((await request(`/api/projects/${plan.snapshot.project.id}`)).body).toEqual(plan.snapshot);
  expect((await pool.query('SELECT count(*) FROM flow.migrations WHERE version=4')).rows[0].count).toBe('1');
});

it('enforces node and edge bounds before advancing the graph revision', async () => {
  let current = await newProject('Bounded graph');
  for (let index = 0; index < 200; index += 1) current = (await addNode(current, `Node ${index}`)).snapshot;
  expect((await change(current, { kind: 'add-node', title: 'Excess node' })).body.error.code).toBe('project_limit');
  for (let index = 1; index <= 63; index += 1) {
    const node = current.graph.nodes[index]!;
    const dependencies = current.graph.nodes.slice(0, index === 63 ? 47 : index).map(target => ({ nodeId: target.id, expectedVersion: target.version }));
    const accepted = await change(current, { kind: 'set-dependencies', nodeId: node.id, expectedNodeVersion: node.version, dependencies });
    expect(accepted.status).toBe(200); current = accepted.body.snapshot;
  }
  expect(current.graph.nodes.reduce((count, node) => count + node.dependsOn.length, 0)).toBe(2000);
  const excess = await change(current, { kind: 'set-dependencies', nodeId: current.graph.nodes[64]!.id, expectedNodeVersion: 1, dependencies: [{ nodeId: current.graph.nodes[0]!.id, expectedVersion: 1 }] });
  expect(excess.status).toBe(409); expect(excess.body.error.code).toBe('project_limit');
  expect((await request(`/api/projects/${current.project.id}`)).body).toEqual(current);
}, 30_000);
