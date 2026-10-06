import { randomUUID } from 'node:crypto';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool, type PoolClient } from 'pg';
import { PgBoss } from 'pg-boss';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { createServer } from '../index.js';
import { migrateGoals, registerGoalRoutes } from './index.js';
import type { ProjectSnapshot } from '../../../../packages/contracts/src/projects.js';

const databaseUrl = 'postgresql://flow:flow-local-only@127.0.0.1:55432/flow_o01';
const admin = new Pool({ connectionString: 'postgresql://flow:flow-local-only@127.0.0.1:55432/postgres', max: 1 });
const ownerToken = 'o01-local-owner';
let lock: PoolClient | undefined;
let created = false;
let pool: Pool;
let boss: PgBoss | undefined;
let server: Awaited<ReturnType<typeof createServer>> | undefined;
let baseUrl: string;
let runnerDirectory: string | undefined;
const runners: ChildProcess[] = [];
const runnerDiagnostics: string[] = [];
async function evidence(name: string, value: unknown) {
  const directory = process.env.FLOW_O01_EVIDENCE_DIR;
  if (!directory) return;
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, `${name}.json`), JSON.stringify({ at: new Date().toISOString(), ...value as object }, null, 2) + '\n', { flag: 'wx' });
}

async function request(path: string, body?: unknown, options: { key?: string; token?: string } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { authorization: `Bearer ${options.token ?? ownerToken}`, 'content-type': 'application/json', 'idempotency-key': options.key ?? randomUUID() },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(10_000),
  });
  return { status: response.status, body: await response.json() };
}
async function startServer() {
  server = await createServer({ databaseUrl, ownerToken, leaseMs: 3000 });
  if (!server.hasRoute({ method: 'POST', url: '/api/goals' })) {
    await migrateGoals(pool);
    boss = new PgBoss({ connectionString: databaseUrl }); await boss.start();
    registerGoalRoutes(server, pool, boss);
  }
  baseUrl = await server.listen({ host: '127.0.0.1', port: 0 });
}
async function stopServer() {
  await server?.close(); server = undefined;
  await boss?.stop(); boss = undefined;
}
beforeAll(async () => {
  lock = await admin.connect();
  if (!(await lock.query("SELECT pg_try_advisory_lock(hashtextextended('flow_o01_test_exclusive',0)) AS locked")).rows[0]?.locked) throw new Error('flow_o01 is in use.');
  if ((await lock.query("SELECT 1 FROM pg_database WHERE datname='flow_o01'")).rowCount) throw new Error('Existing flow_o01 must be preserved.');
  await lock.query('CREATE DATABASE flow_o01'); created = true;
  pool = new Pool({ connectionString: databaseUrl, max: 8, statement_timeout: 5000 });
  await startServer();
});
afterAll(async () => {
  try { await stopRunners(); await stopServer(); } finally {
    await pool?.end();
    if (runnerDirectory) await rm(runnerDirectory, { recursive: true, force: true });
    try { if (created) await lock?.query('DROP DATABASE flow_o01'); }
    finally { lock?.release(); await admin.end(); }
  }
});
async function project(title = 'Goal test'): Promise<ProjectSnapshot> {
  const result = await request('/api/projects', { title }); expect(result.status).toBe(201); return result.body.snapshot;
}
async function add(snapshot: ProjectSnapshot, title: string) {
  const result = await request(`/api/projects/${snapshot.project.id}/commands`, { expectedRevision: snapshot.project.revision, reason: 'Fixture plan', change: { kind: 'add-node', title } });
  expect(result.status).toBe(200); return { snapshot: result.body.snapshot as ProjectSnapshot, nodeId: result.body.changedNodeId as string };
}
const original = { originalGoal: 'Deliver a verified diamond', constraints: 'No models or external writes', acceptance: 'Every accepted result uses current inputs' };
const input = (goal: string) => ({ goal, constraints: 'Deterministic execution only', acceptance: 'Nonempty fixture artifact', verification: { kind: 'nonempty' } });
async function command(goalId: string, body: unknown, key?: string) { return request(`/api/goals/${goalId}/commands`, body, { key }); }

it('admits one durable goal, enforces owner role and preserves original request across restart', async () => {
  const plan = await project(); const key = randomUUID(); const body = { projectId: plan.project.id, ...original, originalGoal: '  Exact original goal\n' };
  const result = await request('/api/goals', body, { key }); expect(result.status).toBe(201);
  expect(result.body.goal).toMatchObject(body);
  expect((await request('/api/goals', body, { key })).body).toEqual({ ...result.body, replayed: true });
  expect((await request('/api/goals', { ...body, originalGoal: 'Changed' }, { key })).status).toBe(409);
  const id = result.body.goal.id;
  const before = await request(`/api/goals/${id}`); expect(before.status).toBe(200);
  expect(before.body.explanations).toHaveLength(1);
  await stopServer(); await startServer();
  expect((await request(`/api/goals/${id}`)).body).toEqual(before.body);
  const runner = (await request('/api/runners', { name: 'Scope check', harnesses: ['fixture'], capacity: 1 })).body;
  expect((await request(`/api/goals/${id}`, undefined, { token: runner.token })).status).toBe(403);
  expect((await request(`/api/goals/${id}`, undefined, { token: '' })).status).toBe(401);
});

it('rejects stale/foreign inputs and accepts execution atomically with immutable actual prompt', async () => {
  const plan = await add(await project(), 'A');
  const foreign = await add(await project('Foreign'), 'X');
  const goalId = (await request('/api/goals', { projectId: plan.snapshot.project.id, ...original })).body.goal.id;
  const define = { kind: 'define-input', nodeId: plan.nodeId, expectedInputVersion: 0, input: input('Build A version one'), reason: 'Initial actual input' };
  expect((await command(goalId, { ...define, nodeId: foreign.nodeId })).status).toBe(404);
  const defined = await command(goalId, define); expect(defined.status).toBe(200); expect(defined.body.inputVersion).toBe(1);
  expect((await command(goalId, define)).status).toBe(409);
  const noChange = await command(goalId, { ...define, expectedInputVersion: 1 }); expect(noChange.body.changed).toBe(false);
  const execution = { kind: 'execute', nodeId: plan.nodeId, expectedInputVersion: 1, dependencies: [], previousExecutionId: null, reason: 'Explicit authorization', fixture: { scenario: 'success', delayMs: 0 } };
  expect((await command(goalId, { ...execution, expectedInputVersion: 2 })).status).toBe(409);
  const key = randomUUID(); const accepted = await command(goalId, execution, key); expect(accepted.status).toBe(200);
  expect((await command(goalId, execution, key)).body).toEqual({ ...accepted.body, replayed: true });
  expect((await command(goalId, execution)).status).toBe(409);
  const task = (await request(`/api/tasks/${accepted.body.task.id}`)).body;
  const actual = JSON.parse(task.prompt); expect(actual.goal).toEqual(original); expect(actual.input).toEqual(define.input); expect(actual.dependencies).toEqual([]);
  expect(task.harness).toBe('fixture');
  const view = (await request(`/api/goals/${goalId}`)).body;
  expect(view.nodes[0].execution).toMatchObject({ id: accepted.body.executionId, inputVersion: 1, inputCurrent: true });
  expect((await request(`/api/goals/${goalId}/executions?nodeId=${plan.nodeId}&limit=1`)).body.executions).toHaveLength(1);
  expect((await request(`/api/goals/${goalId}/executions?nodeId=${plan.nodeId}&limit=0`)).status).toBe(400);
  await request(`/api/tasks/${task.id}/cancel`, {});
});

async function startRunners() {
  runnerDirectory ??= await mkdtemp(join(tmpdir(), 'flow-o01-runners-'));
  for (let index = 0; index < 2; index++) {
    const registered = (await request('/api/runners', { name: `O01 actual fixture ${index}`, harnesses: ['fixture'], capacity: 1 })).body;
    const child = spawn(process.execPath, ['--import', 'tsx', fileURLToPath(new URL('../../../runner/src/main.ts', import.meta.url))], {
      cwd: fileURLToPath(new URL('../../../../', import.meta.url)),
      env: { PATH: process.env.PATH, FLOW_URL: baseUrl, FLOW_RUNNER_TOKEN: registered.token, FLOW_RUNNER_WORKDIR: join(runnerDirectory, String(index)) },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout!.on('data', data => runnerDiagnostics.push(String(data)));
    child.stderr!.on('data', data => runnerDiagnostics.push(String(data)));
    runners.push(child);
  }
}
async function stopRunners() {
  for (const runner of runners.splice(0)) {
    if (runner.exitCode !== null || runner.signalCode !== null) continue;
    const exited = new Promise<void>(resolve => runner.once('exit', () => resolve()));
    runner.kill('SIGTERM');
    const timeout = setTimeout(() => runner.kill('SIGKILL'), 3000);
    await exited; clearTimeout(timeout);
  }
}
async function waitTask(id: string, status: string) {
  await expect.poll(async () => (await request(`/api/tasks/${id}`)).body.status, { timeout: 12_000, interval: 50 }).toBe(status);
  return (await request(`/api/tasks/${id}`)).body;
}
async function defineGoalNode(goalId: string, nodeId: string, goal: string, version = 0) {
  const result = await command(goalId, { kind: 'define-input', nodeId, expectedInputVersion: version, input: input(goal), reason: 'Explicit actual input edit' });
  expect(result.status).toBe(200); return result.body;
}
async function executeNode(goalId: string, nodeId: string, options: { version?: number; dependencies?: unknown[]; previous?: string; scenario?: string } = {}) {
  const result = await command(goalId, { kind: 'execute', nodeId, expectedInputVersion: options.version ?? 1, dependencies: options.dependencies ?? [], previousExecutionId: options.previous ?? null, reason: 'Explicit deterministic authorization', fixture: { scenario: options.scenario ?? 'success', delayMs: 0 } });
  expect(result.status, JSON.stringify(result.body)).toBe(200); return result.body;
}
async function accept(goalId: string, nodeId: string, executionId: string, previous: string | null = null) {
  return command(goalId, { kind: 'accept-delivery', nodeId, executionId, expectedCurrentExecutionId: previous, reason: 'Accept designated verifier evidence' });
}
async function depend(snapshot: ProjectSnapshot, nodeId: string, dependencyId: string): Promise<ProjectSnapshot> {
  const node = snapshot.graph.nodes.find(node => node.id === nodeId)!;
  const dependency = snapshot.graph.nodes.find(node => node.id === dependencyId)!;
  const result = await request(`/api/projects/${snapshot.project.id}/commands`, { expectedRevision: snapshot.project.revision, reason: 'Diamond dependency', change: { kind: 'set-dependencies', nodeId, expectedNodeVersion: node.version, dependencies: [{ nodeId: dependencyId, expectedVersion: dependency.version }] } });
  expect(result.status).toBe(200); return result.body.snapshot;
}

it('runs the diamond through independent fixture processes and invalidates only changed actual dependencies', async () => {
  const a = await add(await project('Actual diamond'), 'A');
  const b = await add(a.snapshot, 'B'); const c = await add(b.snapshot, 'C');
  let graph = await depend(await depend(c.snapshot, b.nodeId, a.nodeId), c.nodeId, a.nodeId);
  const goalId = (await request('/api/goals', { projectId: graph.project.id, ...original })).body.goal.id;
  for (const [id, title] of [[a.nodeId, 'A'], [b.nodeId, 'B'], [c.nodeId, 'C']]) await defineGoalNode(goalId, id!, `${title} actual version one`);
  const early = await command(goalId, { kind: 'execute', nodeId: b.nodeId, expectedInputVersion: 1, dependencies: [], previousExecutionId: null, reason: 'Missing dependency must reject', fixture: { scenario: 'success' } });
  expect(early.body.error.code).toBe('dependency_version');
  await startRunners();
  const firstA = await executeNode(goalId, a.nodeId); await waitTask(firstA.task.id, 'succeeded');
  const acceptedA = await accept(goalId, a.nodeId, firstA.executionId); expect(acceptedA.status).toBe(200);
  const dependencies = [acceptedA.body.delivery];
  const firstB = await executeNode(goalId, b.nodeId, { dependencies, scenario: 'decision' });
  const firstC = await executeNode(goalId, c.nodeId, { dependencies });
  const waitingB = await waitTask(firstB.task.id, 'waiting'); await waitTask(firstC.task.id, 'succeeded');
  expect((await accept(goalId, c.nodeId, firstC.executionId)).status).toBe(200);
  const changedB = { ...input('B actual goal version two'), constraints: 'A revised B constraint', acceptance: 'A revised B acceptance', verification: { kind: 'contains', expected: 'version two' } };
  expect((await command(goalId, { kind: 'define-input', nodeId: b.nodeId, expectedInputVersion: 1, input: changedB, reason: 'All actual B fields changed' })).status).toBe(200);
  const answer = await request(`/api/tasks/${firstB.task.id}/decision`, { decisionId: waitingB.pendingDecision.id, answer: 'approve' }); expect(answer.status).toBe(200);
  await waitTask(firstB.task.id, 'succeeded');
  expect((await accept(goalId, b.nodeId, firstB.executionId)).body.error.code).toBe('execution_obsolete');
  const secondB = await executeNode(goalId, b.nodeId, { version: 2, dependencies, previous: firstB.executionId });
  await waitTask(secondB.task.id, 'succeeded'); expect((await accept(goalId, b.nodeId, secondB.executionId)).status).toBe(200);
  graph = (await add(graph, 'Unrelated D')).snapshot;
  let view = (await request(`/api/goals/${goalId}`)).body;
  expect(view.projectRevision).toBe(graph.project.revision);
  expect(view.nodes.find((node: { nodeId: string }) => node.nodeId === b.nodeId).deliveryCurrent).toBe(true);
  expect(view.nodes.find((node: { nodeId: string }) => node.nodeId === c.nodeId).deliveryCurrent).toBe(true);
  const actualB = JSON.parse((await request(`/api/tasks/${secondB.task.id}`)).body.prompt);
  expect(actualB.input).toEqual(changedB); expect(actualB.dependencies[0]).toMatchObject(acceptedA.body.delivery);
  expect(actualB.dependencies[0].content).toContain('A actual version one');
  await defineGoalNode(goalId, a.nodeId, 'A actual version two changes common artifact', 1);
  const secondA = await executeNode(goalId, a.nodeId, { version: 2, previous: firstA.executionId }); await waitTask(secondA.task.id, 'succeeded');
  const replaced = await accept(goalId, a.nodeId, secondA.executionId, firstA.executionId); expect(replaced.status).toBe(200);
  expect(replaced.body.delivery.artifactVersion).not.toBe(acceptedA.body.delivery.artifactVersion);
  view = (await request(`/api/goals/${goalId}`)).body;
  for (const id of [b.nodeId, c.nodeId]) expect(view.nodes.find((node: { nodeId: string }) => node.nodeId === id)).toMatchObject({ deliveryCurrent: false, dependenciesReady: true });
  expect((await accept(goalId, c.nodeId, firstC.executionId, firstC.executionId)).body.error.code).toBe('execution_obsolete');
  const oldArtifact = await request(`/api/details/${acceptedA.body.delivery.detailId}`); expect(oldArtifact.body.content).toContain('A actual version one');
  const history = (await request(`/api/goals/${goalId}/executions?nodeId=${b.nodeId}&limit=1`)).body;
  expect(history.executions).toHaveLength(1); expect(history.nextCursor).toBeTruthy();
  expect((await request(`/api/goals/${goalId}/executions?nodeId=${b.nodeId}&limit=1&after=${history.nextCursor}`)).body.executions).toHaveLength(1);
  expect((await request(`/api/goals/${goalId}/inputs/${b.nodeId}?version=1`)).body.input.goal).toBe('B actual version one');
  expect(view.nodes.every((node: { definition?: object; execution?: object }) => !node.definition || !('input' in node.definition))).toBe(true);
  expect(view.nodes.every((node: { execution?: object }) => !node.execution || !('input' in node.execution) && !('dependencies' in node.execution))).toBe(true);
  const unchanged = await request(`/api/goals/${goalId}`); expect(unchanged.body).toEqual(view);
  expect(runners.every(runner => runner.exitCode === null)).toBe(true);
  await evidence('diamond', { outcome: 'passed', goalId, runnerPids: runners.map(runner => runner.pid), testPid: process.pid,
    acceptedA: acceptedA.body.delivery, replacementA: replaced.body.delivery, firstB: firstB.executionId, secondB: secondB.executionId,
    actualSecondBPrompt: actualB, oldAStillReadable: oldArtifact.body, finalProjection: view, modelCalls: 0 });
});

it('preserves failed evidence, rejects failed verification, and requires explicit predecessor for retry', async () => {
  const planned = await add(await project('Failure recovery'), 'Failure');
  const goalId = (await request('/api/goals', { projectId: planned.snapshot.project.id, ...original })).body.goal.id;
  await defineGoalNode(goalId, planned.nodeId, 'Failure can be retried explicitly');
  const failed = await executeNode(goalId, planned.nodeId, { scenario: 'failure' }); await waitTask(failed.task.id, 'failed');
  expect((await accept(goalId, planned.nodeId, failed.executionId)).body.error.code).toBe('delivery_unverified');
  const badVerification = await executeNode(goalId, planned.nodeId, { previous: failed.executionId, scenario: 'verification-failure' });
  await waitTask(badVerification.task.id, 'succeeded');
  expect((await accept(goalId, planned.nodeId, badVerification.executionId)).body.error.code).toBe('delivery_unverified');
  const recovered = await executeNode(goalId, planned.nodeId, { previous: badVerification.executionId }); await waitTask(recovered.task.id, 'succeeded');
  expect((await accept(goalId, planned.nodeId, recovered.executionId)).status).toBe(200);
  const history = (await request(`/api/goals/${goalId}/executions?nodeId=${planned.nodeId}`)).body;
  expect(history.executions).toHaveLength(3);
  expect(history.executions.find((execution: { id: string }) => execution.id === failed.executionId).task.status).toBe('failed');
});

it('serializes concurrent authorization, keeps one task and refuses unsettled execution after center restart', async () => {
  await stopRunners();
  const planned = await add(await project('Concurrent admission'), 'A');
  const goalId = (await request('/api/goals', { projectId: planned.snapshot.project.id, ...original })).body.goal.id;
  await defineGoalNode(goalId, planned.nodeId, 'Exactly one authorization');
  const operation = { kind: 'execute', nodeId: planned.nodeId, expectedInputVersion: 1, dependencies: [], previousExecutionId: null, reason: 'Concurrent explicit authorization', fixture: { scenario: 'success', delayMs: 0 } };
  const responses = await Promise.all([command(goalId, operation), command(goalId, operation)]);
  expect(responses.map(result => result.status).sort()).toEqual([200, 409]);
  const execution = responses.find(result => result.status === 200)!.body;
  const registered = (await request('/api/runners', { name: 'Deliberately lost fixture owner', harnesses: ['fixture'], capacity: 1 })).body;
  let assignment: { task: { id: string } } | undefined;
  await expect.poll(async () => {
    const claimed = await request('/api/runner/claim', {}, { token: registered.token });
    assignment ??= claimed.body.assignment;
    return assignment?.task.id;
  }).toBe(execution.task.id);
  await waitTask(execution.task.id, 'uncertain');
  await stopServer(); await startServer();
  expect((await request(`/api/tasks/${execution.task.id}`)).body.status).toBe('uncertain');
  const rejected = await command(goalId, { ...operation, previousExecutionId: execution.executionId });
  expect(rejected.body.error.code).toBe('execution_unsettled');
  expect((await request('/api/runner/claim', {}, { token: registered.token })).body.assignment).toBeNull();
  expect((await request(`/api/goals/${goalId}/executions?nodeId=${planned.nodeId}`)).body.executions).toHaveLength(1);
  await evidence('uncertain', { outcome: 'passed', goalId, authorizationStatuses: responses.map(response => response.status), executionId: execution.executionId,
    afterRestart: (await request(`/api/tasks/${execution.task.id}`)).body, rejectedNewAuthorization: rejected, modelCalls: 0 });
});

it('keeps maximum inputs out of light reads and preserves immutable history with bounded execution queries', async () => {
  const planned = await add(await project('Bounded actual input'), 'Maximum input');
  const raw = { originalGoal: 'g'.repeat(4000), constraints: 'c'.repeat(2000), acceptance: 'a'.repeat(1000) };
  const goalId = (await request('/api/goals', { projectId: planned.snapshot.project.id, ...raw })).body.goal.id;
  const actual = { goal: 'x'.repeat(4000), constraints: 'y'.repeat(2000), acceptance: 'z'.repeat(1000), verification: { kind: 'nonempty' } };
  expect((await command(goalId, { kind: 'define-input', nodeId: planned.nodeId, expectedInputVersion: 0, input: actual, reason: 'Maximum input fields' })).status).toBe(200);
  const before = (await request(`/api/goals/${goalId}`)).body;
  expect(JSON.stringify(before)).not.toContain('x'.repeat(100));
  expect(Buffer.byteLength(JSON.stringify(before))).toBeLessThan(9500);
  expect((await request(`/api/goals/${goalId}/inputs/${planned.nodeId}`)).body.input).toEqual(actual);
  const query = await request(`/api/goals/${goalId}/executions?nodeId=${planned.nodeId}&limit=101`); expect(query.status).toBe(400);
  const oversized = await command(goalId, { kind: 'define-input', nodeId: planned.nodeId, expectedInputVersion: 1, input: { ...actual, goal: 'x'.repeat(4001) }, reason: 'Reject overflow' }); expect(oversized.status).toBe(400);
  expect((await request(`/api/goals/${goalId}`)).body).toEqual(before);
  const expanding = { ...actual, goal: '\n'.repeat(3999) + 'x', constraints: '\n'.repeat(2000), acceptance: '\n'.repeat(999) + 'z' };
  expect((await command(goalId, { kind: 'define-input', nodeId: planned.nodeId, expectedInputVersion: 1, input: expanding, reason: 'Valid fields but oversized serialized context' })).status).toBe(200);
  const tooLarge = await command(goalId, { kind: 'execute', nodeId: planned.nodeId, expectedInputVersion: 2, dependencies: [], previousExecutionId: null, reason: 'Must reject without truncation', fixture: { scenario: 'success' } });
  expect(tooLarge.body.error.code).toBe('input_too_large');
  expect((await request(`/api/goals/${goalId}/executions?nodeId=${planned.nodeId}`)).body.executions).toEqual([]);
  const after = (await request(`/api/goals/${goalId}`)).body;
  await evidence('bounded-read', { outcome: 'passed', originalAsciiCharacters: 7000, nodeInputAsciiCharacters: 7000,
    snapshotBytes: Buffer.byteLength(JSON.stringify(before)), inputDetailBytes: Buffer.byteLength(JSON.stringify(actual)),
    snapshot: before, oversizedSerializedContext: tooLarge, noExecutionAccepted: true, modelCalls: 0 });
  for (const table of ['goal_inputs', 'goal_executions', 'goal_explanations', 'goal_acceptances']) {
    await expect(pool.query(`DELETE FROM flow.${table} WHERE goal_id=$1`, [goalId])).rejects.toMatchObject({ code: '23514' });
  }
  await migrateGoals(pool);
  expect((await request(`/api/goals/${goalId}`)).body).toEqual(after);
});

it('rolls back task, wake and execution binding together and retries the same command after a storage failure', async () => {
  const planned = await add(await project('Atomic acceptance rollback'), 'Rollback');
  const goalId = (await request('/api/goals', { projectId: planned.snapshot.project.id, ...original })).body.goal.id;
  await defineGoalNode(goalId, planned.nodeId, 'Atomic task and execution');
  const operation = { kind: 'execute', nodeId: planned.nodeId, expectedInputVersion: 1, dependencies: [], previousExecutionId: null, reason: 'Retry exactly after failed transaction', fixture: { scenario: 'success', delayMs: 0 } };
  const key = randomUUID();
  const before = (await request('/api/tasks?limit=100')).body.tasks.map((task: { id: string }) => task.id).sort();
  await pool.query(`CREATE FUNCTION flow.o01_test_fail_execution() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Injected storage failure'; END $$;
    CREATE TRIGGER o01_test_fail BEFORE INSERT ON flow.goal_executions FOR EACH ROW EXECUTE FUNCTION flow.o01_test_fail_execution()`);
  try {
    expect((await command(goalId, operation, key)).status).toBe(500);
    expect((await request('/api/tasks?limit=100')).body.tasks.map((task: { id: string }) => task.id).sort()).toEqual(before);
    expect((await request(`/api/goals/${goalId}/executions?nodeId=${planned.nodeId}`)).body.executions).toEqual([]);
    expect((await request(`/api/goals/${goalId}`)).body.explanations).toHaveLength(2);
  } finally { await pool.query('DROP TRIGGER o01_test_fail ON flow.goal_executions; DROP FUNCTION flow.o01_test_fail_execution()'); }
  const retried = await command(goalId, operation, key); expect(retried.status).toBe(200); expect(retried.body.replayed).toBe(false);
  expect((await command(goalId, operation, key)).body).toEqual({ ...retried.body, replayed: true });
  await request(`/api/tasks/${retried.body.task.id}/cancel`, {});
});

it('preserves ordinary submit idempotency and resume validation through the shared admission extraction', async () => {
  const key = randomUUID(); const task = { title: 'Existing submit', prompt: 'No model', harness: 'fixture' };
  const submitted = await request('/api/tasks', task, { key }); expect(submitted.status).toBe(202);
  expect((await request('/api/tasks', task, { key })).body).toEqual({ ...submitted.body, replayed: true });
  expect((await request('/api/tasks', { ...task, prompt: 'Different' }, { key })).status).toBe(409);
  expect((await request('/api/tasks', { ...task, resumeSessionId: 'not-recorded' })).body.error.code).toBe('unknown_session');
  await request(`/api/tasks/${submitted.body.task.id}/cancel`, {});
});

it('returns faithful existing provenance for no-op input and delivery commands after another node changes', async () => {
  if (!runners.length) await startRunners();
  const a = await add(await project('Faithful no-op provenance'), 'A'); const b = await add(a.snapshot, 'B');
  const goalId = (await request('/api/goals', { projectId: b.snapshot.project.id, ...original })).body.goal.id;
  const definedA = await defineGoalNode(goalId, a.nodeId, 'A unchanged actual input');
  const executionA = await executeNode(goalId, a.nodeId); await waitTask(executionA.task.id, 'succeeded');
  const acceptedA = await accept(goalId, a.nodeId, executionA.executionId); expect(acceptedA.status).toBe(200);
  await defineGoalNode(goalId, b.nodeId, 'B inserts an unrelated last explanation');
  const before = (await request(`/api/goals/${goalId}`)).body;
  expect(before.explanations.at(-1).source.nodeId).toBe(b.nodeId);
  const noopInput = await command(goalId, { kind: 'define-input', nodeId: a.nodeId, expectedInputVersion: 1, input: input('A unchanged actual input'), reason: 'No change' });
  const noopDelivery = await accept(goalId, a.nodeId, executionA.executionId, executionA.executionId);
  expect([noopInput.status, noopDelivery.status]).toEqual([200, 200]);
  expect([noopInput.body.explanation, noopDelivery.body.explanation]).toEqual([definedA.explanation, acceptedA.body.explanation]);
  expect([noopInput.body.changed, noopDelivery.body.changed]).toEqual([false, false]);
  expect((await request(`/api/goals/${goalId}`)).body).toEqual(before);
  await evidence('noop-provenance', { outcome: 'passed', lastOtherNodeExplanation: before.explanations.at(-1), noopInput: noopInput.body, noopDelivery: noopDelivery.body, explanationCountUnchanged: before.explanations.length });
});
