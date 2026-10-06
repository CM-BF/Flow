import { randomUUID, createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Pool } from 'pg';
import type { ClaimedTask } from '../../../../packages/contracts/src/runner.js';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { createServer } from '../index.js';
import { registerGoalDeliveryRoutes } from './index.js';

const name = `flow_o11_${randomUUID().replaceAll('-', '')}`;
const url = `postgresql://flow:flow-local-only@127.0.0.1:55432/${name}`;
const admin = new Pool({ connectionString: 'postgresql://flow:flow-local-only@127.0.0.1:55432/postgres', max: 1 });
const token = 'o11-private-test-owner';
let app: Awaited<ReturnType<typeof createServer>>;
let pool: Pool;
let address: string;
let created = false;
async function save(file: string, data: unknown) {
  if (!process.env.FLOW_O11_EVIDENCE_DIR) return;
  await mkdir(process.env.FLOW_O11_EVIDENCE_DIR, { recursive: true });
  await writeFile(join(process.env.FLOW_O11_EVIDENCE_DIR, `${file}.json`), JSON.stringify(data, null, 2) + '\n');
}
async function start() {
  app = await createServer({ databaseUrl: url, ownerToken: token, leaseMs: 2000 });
  if (!app.hasRoute({ method: 'GET', url: '/api/goals/:id/delivery' })) registerGoalDeliveryRoutes(app, pool);
  address = await app.listen({ host: '127.0.0.1', port: 0 });
}
beforeAll(async () => {
  await admin.query(`CREATE DATABASE ${name}`); created = true;
  pool = new Pool({ connectionString: url, max: 2, statement_timeout: 5000 });
  await start();
});
afterAll(async () => {
  try { await app?.close(); } finally {
    await pool?.end();
    if (created) await admin.query(`DROP DATABASE ${name}`);
    const remaining = (await admin.query('SELECT datname FROM pg_database WHERE datname=$1', [name])).rows;
    await admin.end(); await save('cleanup', { database: name, remaining, serverClosed: true, at: new Date().toISOString() });
  }
});
async function http(path: string, body?: unknown, credential = token) {
  const response = await fetch(address + path, { method: body === undefined ? 'GET' : 'POST',
    headers: { authorization: `Bearer ${credential}`, 'content-type': 'application/json', 'idempotency-key': randomUUID() },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(5000) });
  const raw = await response.text();
  return { status: response.status, body: JSON.parse(raw), bytes: Buffer.byteLength(raw), raw, cache: response.headers.get('cache-control') };
}
const query = (goalId: string, params: Record<string, string | number | string[] | undefined>) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) for (const item of Array.isArray(value) ? value : [value]) search.append(key, String(item));
  }
  return `/api/goals/${goalId}/delivery?${search}`;
};
const read = (goalId: string, params: Record<string, string | number | string[] | undefined>) => http(query(goalId, params));
const command = (goalId: string, body: unknown) => http(`/api/goals/${goalId}/commands`, body);
const input = (goal = 'PRIVATE_INPUT_纸鸢😀'.repeat(70)) => ({ goal, constraints: 'No provider', acceptance: 'nonempty', verification: { kind: 'nonempty' } });
async function setup() {
  let snapshot = (await http('/api/projects', { title: 'O11 two nodes' })).body.snapshot;
  const nodes: string[] = [];
  for (const title of ['A', 'B']) {
    const added = await http(`/api/projects/${snapshot.project.id}/commands`, { expectedRevision: snapshot.project.revision, reason: 'Two independent nodes', change: { kind: 'add-node', title } });
    expect(added.status).toBe(200); snapshot = added.body.snapshot; nodes.push(added.body.changedNodeId);
  }
  const accepted = await http('/api/goals', { projectId: snapshot.project.id, originalGoal: 'PRIVATE_ORIGINAL_材料'.repeat(100), constraints: 'No provider', acceptance: 'verified delivery' });
  expect(accepted.status).toBe(201); const goalId = accepted.body.goal.id;
  for (const nodeId of nodes) expect((await command(goalId, { kind: 'define-input', nodeId, expectedInputVersion: 0, input: input(), reason: 'Actual input' })).status).toBe(200);
  return { goalId, nodes, projectId: snapshot.project.id, snapshot };
}
const execute = (goalId: string, nodeId: string, version = 1, dependencies: unknown[] = [], previousExecutionId: string | null = null) => command(goalId, { kind: 'execute', nodeId, expectedInputVersion: version, dependencies, previousExecutionId, reason: 'Public deterministic peer', fixture: { scenario: 'success', delayMs: 0 } });
const hash = (s: string) => createHash('sha256').update(s).digest('hex');
async function peer(taskId: string) {
  const runner = (await http('/api/runners', { name: 'O11 deterministic HTTP peer', harnesses: ['fixture'], capacity: 1 })).body;
  let assignment: ClaimedTask | null = null;
  for (let tries = 0; tries < 30 && !assignment; tries++) {
    const response = await http('/api/runner/claim', {}, runner.token); expect(response.status).toBe(200);
    assignment = response.body.assignment;
    if (!assignment) await new Promise(resolve => setTimeout(resolve, 50));
  }
  expect(assignment?.task.id).toBe(taskId);
  if (!assignment) throw new Error('The bounded peer claim did not receive work.');
  const owned = assignment;
  let sequence = 0;
  return { async emit(...events: Record<string, unknown>[]) {
    const result = await http('/api/runner/events', { attemptId: owned.attempt.id, ownerVersion: owned.attempt.ownerVersion, events: events.map(event => ({ ...event, id: randomUUID(), sequence: ++sequence })) }, runner.token);
    expect(result.status, result.raw).toBe(200); return result;
  }, assignment };
}
it('keeps input and plan page identity stable through unrelated live activity without repeating materials', async () => {
  const s = await setup(); const [a, b] = s.nodes as [string, string];
  const first = await read(s.goalId, { view: 'plan', limit: 1 }); expect(first.status).toBe(200);
  const material = await read(s.goalId, { view: 'input', nodeId: a, version: 1 }); expect(material.status).toBe(200);
  expect(material.body.definition.input).toEqual(input());
  const original = await read(s.goalId, { view: 'goal' }); expect(original.status).toBe(200);
  const run = await execute(s.goalId, b); expect(run.status).toBe(200); const worker = await peer(run.body.task.id);
  const oldReads = [], newReads = [], oldRefs = [];
  const decisionId = randomUUID();
  for (const event of [{ type: 'message', text: 'Step one' }, { type: 'decision', decisionId, prompt: 'PRIVATE_DECISION_正文' }]) {
    await worker.emit(event);
    const old = await http(`/api/goals/${s.goalId}`); oldReads.push(old);
    oldRefs.push(hash(JSON.stringify(old.body)));
    const state = await read(s.goalId, { view: 'state', nodeIds: [a, b] }); expect(state.status).toBe(200); newReads.push(state);
    expect(state.cache).toBe('no-store'); expect(state.raw).not.toMatch(/PRIVATE_INPUT|PRIVATE_ORIGINAL|PRIVATE_DECISION|prompt/);
    expect(state.body.nodes[0].inputRef).toEqual(material.body.reference);
    expect((await read(s.goalId, { view: 'plan', limit: 1 })).body.planRef).toBe(first.body.planRef);
    expect((await read(s.goalId, { view: 'plan', after: first.body.nextCursor, limit: 1 })).status).toBe(200);
  }
  expect(oldRefs[0]).not.toBe(oldRefs[1]);
  const waiting = newReads.at(-1)!.body.nodes[1].execution;
  expect(waiting.task.status).toBe('waiting'); expect(waiting.pendingDecision.decisionId).toBe(decisionId);
  expect((await read(s.goalId, { view: 'decision', nodeId: b, taskId: run.body.task.id, decisionId })).body).toMatchObject({ prompt: 'PRIVATE_DECISION_正文', pending: true, answer: null });
  expect((await http(`/api/tasks/${run.body.task.id}/decision`, { decisionId, answer: 'approve' })).status).toBe(200);
  await worker.emit({ type: 'completed', outcome: 'succeeded' });
  const done = await read(s.goalId, { view: 'state', nodeIds: [a, b] });
  expect(done.body.nodes[1]).toMatchObject({ deliveryCurrent: false, accepted: null, execution: { task: { status: 'succeeded', verificationStatus: 'pending' }, artifact: null } });
  expect((await read(s.goalId, { view: 'input', nodeId: a, version: 1 })).body).toEqual(material.body);
  await save('two-node-bytes', { at: new Date().toISOString(), scope: 'Two matched HTTP refreshes, UTF-8 uncompressed JSON; not tokens or total workload speed', refreshRequests: { legacy: oldReads.length, delivery: newReads.length }, bytes: { legacy: oldReads.map(r => r.bytes), delivery: newReads.map(r => r.bytes) }, originalGoalRepeated: { legacy: oldReads.map(r => r.raw.includes('PRIVATE_ORIGINAL')), delivery: newReads.map(r => r.raw.includes('PRIVATE_ORIGINAL')) }, inputMaterialInRefresh: { legacy: oldReads.map(r => r.raw.includes('PRIVATE_INPUT')), delivery: newReads.map(r => r.raw.includes('PRIVATE_INPUT')) }, fixedInputReads: 1, separateCorrectnessReread: 1, inputBytes: material.bytes, originalGoalBytes: original.bytes, planBytes: first.bytes, inputReferenceStable: true, planReferenceStable: true, oldSnapshotHashChanged: true });
});

async function finish(worker: Awaited<ReturnType<typeof peer>>, content: string) {
  const artifactId = randomUUID(); const version = hash(content);
  await worker.emit({ type: 'artifact', artifactId, title: 'Exact text output', version, content, mediaType: 'text/plain' },
    { type: 'verification', artifactId, artifactVersion: version, verifierId: 'flow.text', verifierVersion: '1', inputDigest: hash(JSON.stringify({ artifactVersion: version, rule: { kind: 'nonempty' } })), result: 'passed', evidence: 'Center rechecks exact content' },
    { type: 'completed', outcome: 'succeeded' });
}
async function accept(goalId: string, nodeId: string, executionId: string, previous: string | null = null) {
  return command(goalId, { kind: 'accept-delivery', nodeId, executionId, expectedCurrentExecutionId: previous, reason: 'Owner acceptance, not inferred semantic validation' });
}
it('rejects related plan changes while retaining exact historical inputs and rejecting obsolete writes', async () => {
  const s = await setup(); const a = s.nodes[0]!;
  const plan = (await read(s.goalId, { view: 'plan', limit: 1 })).body;
  const old = (await read(s.goalId, { view: 'input', nodeId: a, version: 1 })).body;
  const run = await execute(s.goalId, a); expect(run.status).toBe(200); const worker = await peer(run.body.task.id);
  expect((await command(s.goalId, { kind: 'define-input', nodeId: a, expectedInputVersion: 1, input: input('New actual input'), reason: 'Changed scope' })).status).toBe(200);
  const stale = await read(s.goalId, { view: 'plan', limit: 1, after: plan.nextCursor });
  expect(stale.status).toBe(409); expect(stale.body.error.code).toBe('stale_goal_plan');
  const historical = (await read(s.goalId, { view: 'input', nodeId: a, version: 1 })).body;
  expect(historical.definition).toEqual(old.definition); expect(historical).toMatchObject({ currentVersion: 2, stale: true });
  expect((await execute(s.goalId, a, 1, [], run.body.executionId)).status).toBe(409);
  await finish(worker, 'OLD_ARTIFACT_正文😀');
  const live = (await read(s.goalId, { view: 'state', nodeIds: [a] })).body.nodes[0];
  expect(live).toMatchObject({ reason: 'execution-stale', deliveryCurrent: false, execution: { inputCurrent: false, task: { verificationStatus: 'passed' } } });
  expect((await accept(s.goalId, a, run.body.executionId)).body.error.code).toBe('execution_obsolete');
  expect(live.execution.artifact.artifactVersion).toBe(hash('OLD_ARTIFACT_正文😀'));
  expect((await http(`/api/details/${live.execution.artifact.detailId}`)).body.content).toBe('OLD_ARTIFACT_正文😀');
  const currentProject = (await http(`/api/projects/${s.projectId}`)).body;
  const node = currentProject.graph.nodes.find((n: { id: string }) => n.id === a);
  expect((await http(`/api/projects/${s.projectId}/commands`, { expectedRevision: currentProject.project.revision, reason: 'Remove finished plan node', change: { kind: 'remove-node', nodeId: a, expectedNodeVersion: node.version } })).status).toBe(200);
  const removed = (await read(s.goalId, { view: 'input', nodeId: a, version: 1 })).body;
  expect(removed).toMatchObject({ currentVersion: null, stale: true }); expect(removed.definition).toEqual(old.definition);
});

it('tracks exact dependency delivery replacement and preserves state across a center restart', async () => {
  const s = await setup(); const [a, b] = s.nodes as [string, string];
  const graph = (await http(`/api/projects/${s.projectId}`)).body;
  expect((await http(`/api/projects/${s.projectId}/commands`, { expectedRevision: graph.project.revision, reason: 'B uses exact A delivery', change: { kind: 'set-dependencies', nodeId: b, expectedNodeVersion: 1, dependencies: [{ nodeId: a, expectedVersion: 1 }] } })).status).toBe(200);
  const first = await execute(s.goalId, a); const firstPeer = await peer(first.body.task.id); await finish(firstPeer, 'A version one');
  const accepted = await accept(s.goalId, a, first.body.executionId); expect(accepted.status).toBe(200);
  const bRun = await execute(s.goalId, b, 1, [accepted.body.delivery]); expect(bRun.status).toBe(200); const bPeer = await peer(bRun.body.task.id);
  expect((await command(s.goalId, { kind: 'define-input', nodeId: a, expectedInputVersion: 1, input: input('A revision two'), reason: 'Replace common dependency' })).status).toBe(200);
  expect((await read(s.goalId, { view: 'state', nodeIds: [b] })).body.nodes[0]).toMatchObject({ dependenciesReady: false, deliveryCurrent: false });
  const second = await execute(s.goalId, a, 2, [], first.body.executionId); expect(second.status).toBe(200);
  const secondPeer = await peer(second.body.task.id); await finish(secondPeer, 'A version two');
  expect((await accept(s.goalId, a, second.body.executionId, first.body.executionId)).status).toBe(200);
  await finish(bPeer, 'B using A version one');
  const before = await read(s.goalId, { view: 'state', nodeIds: [a, b] });
  expect(before.body.nodes[0]).toMatchObject({ deliveryCurrent: true, reason: 'accepted-current' });
  expect(before.body.nodes[1]).toMatchObject({ dependenciesReady: true, deliveryCurrent: false, reason: 'execution-stale', execution: { inputCurrent: false, dependencyCount: 1 } });
  expect((await accept(s.goalId, b, bRun.body.executionId)).body.error.code).toBe('execution_obsolete');
  await app.close(); await start();
  const after = await read(s.goalId, { view: 'state', nodeIds: [a, b] }); expect(after.body.nodes).toEqual(before.body.nodes);
});

it('marks referenced knowledge as stale without changing immutable input identity or copying source text', async () => {
  const s = await setup(); const a = s.nodes[0]!;
  const text = 'PRIVATE_KNOWLEDGE_中文😀';
  const source = await http(`/api/projects/${s.projectId}/knowledge/sources`, { expectedVersion: 0, title: 'Bound material', text }); expect(source.status).toBe(201);
  const citation = { projectId: s.projectId, sourceId: source.body.source.id, version: 1, contentDigest: source.body.version.contentDigest, locator: { kind: 'utf8-bytes', start: 0, end: Buffer.byteLength(text) } };
  expect((await command(s.goalId, { kind: 'define-input', nodeId: a, expectedInputVersion: 1, input: { ...input(), knowledge: [citation] }, reason: 'Freeze selected source' })).status).toBe(200);
  const reference = (await read(s.goalId, { view: 'state', nodeIds: [a] })).body.nodes[0].inputRef;
  expect((await http(`/api/projects/${s.projectId}/knowledge/sources/${source.body.source.id}/versions`, { expectedVersion: 1, text: 'Replacement source' })).status).toBe(201);
  const result = await read(s.goalId, { view: 'state', nodeIds: [a] });
  expect(result.body.nodes[0]).toMatchObject({ inputRef: reference, knowledgeCurrent: false, reason: 'knowledge-stale' }); expect(result.raw).not.toContain(text);
  expect((await execute(s.goalId, a, 2)).body.error.code).toBe('goal_knowledge_obsolete');
});

it('reports expired execution as uncertain and never infers a verified or accepted delivery', async () => {
  const s = await setup(); const a = s.nodes[0]!;
  const run = await execute(s.goalId, a); expect(run.status).toBe(200); await peer(run.body.task.id);
  let latest;
  for (let i = 0; i < 35; i++) {
    latest = await read(s.goalId, { view: 'state', nodeIds: [a] });
    if (latest.body.nodes[0].execution.task.status === 'uncertain') break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  expect(latest!.body.nodes[0]).toMatchObject({ reason: 'execution-uncertain', accepted: null, deliveryCurrent: false, execution: { artifact: null, task: { status: 'uncertain', verificationStatus: 'pending' } } });
  expect((await execute(s.goalId, a, 1, [], run.body.executionId)).body.error.code).toBe('execution_unsettled');
});

it('bounds owner reads and rejects malformed, duplicate, cross-goal references and wrong credentials', async () => {
  const s = await setup(); const other = await setup(); const a = s.nodes[0]!;
  const page = await read(s.goalId, { view: 'plan', limit: 1 });
  expect((await read(other.goalId, { view: 'plan', after: page.body.nextCursor })).status).toBe(400);
  for (const params of [{ view: 'plan', limit: 0 }, { view: 'plan', limit: 51 }, { view: 'plan', after: 'bad' }, { view: 'input', nodeId: a, version: 2147483648 }, { view: 'state', nodeIds: [a, a] }, { view: 'state', nodeIds: Array.from({ length: 51 }, () => randomUUID()) }]) expect((await read(s.goalId, params)).status).toBe(400);
  expect((await read(s.goalId, { view: 'state', nodeIds: [other.nodes[0]!] })).status).toBe(404);
  expect((await read(s.goalId, { view: 'input', nodeId: other.nodes[0]!, version: 1 })).status).toBe(404);
  expect((await read(s.goalId, { view: 'decision', nodeId: a, taskId: randomUUID(), decisionId: randomUUID() })).status).toBe(404);
  const runner = (await http('/api/runners', { name: 'Read denied', harnesses: ['fixture'], capacity: 1 })).body;
  expect((await http(query(s.goalId, { view: 'plan' }), undefined, runner.token)).status).toBe(403);
  expect((await http(query(s.goalId, { view: 'plan' }), undefined, '')).status).toBe(401);
});

it('reads the existing 200-node maximum in bounded pages without silently truncating the plan', async () => {
  let snapshot = (await http('/api/projects', { title: 'O11 maximum plan' })).body.snapshot;
  for (let i = 0; i < 200; i++) {
    const added = await http(`/api/projects/${snapshot.project.id}/commands`, { expectedRevision: snapshot.project.revision, reason: 'Bounded metadata fixture', change: { kind: 'add-node', title: `Node ${i}` } });
    expect(added.status).toBe(200); snapshot = added.body.snapshot;
  }
  const goal = (await http('/api/goals', { projectId: snapshot.project.id, originalGoal: 'Two hundred bounded nodes', constraints: 'No model', acceptance: 'Every node visible exactly once' })).body.goal;
  const all: string[] = []; const pages: number[] = []; const refs = new Set();
  let cursor: string | null = null;
  do {
    const page = await read(goal.id, { view: 'plan', limit: 50, ...(cursor ? { after: cursor } : {}) });
    expect(page.status).toBe(200); expect(page.body.totalNodes).toBe(200); expect(page.body.nodes).toHaveLength(50);
    all.push(...page.body.nodes.map((n: { id: string }) => n.id)); refs.add(page.body.planRef); pages.push(page.bytes); cursor = page.body.nextCursor;
  } while (cursor);
  expect(new Set(all).size).toBe(200); expect(refs.size).toBe(1);
  const selected = await read(goal.id, { view: 'state', nodeIds: all.slice(0, 50) }); expect(selected.body.nodes).toHaveLength(50);
  expect(selected.body.nodes.every((n: { reason: string }) => n.reason === 'input-undefined')).toBe(true);
  await save('bounds', { totalNodes: all.length, pageCount: pages.length, pageBytes: pages, selectedStateNodes: selected.body.nodes.length, selectedStateBytes: selected.bytes, allUnique: true, metadataLimit: 200 });
});
