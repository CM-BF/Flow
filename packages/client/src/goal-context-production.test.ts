import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { Pool } from 'pg';
import { afterAll, beforeAll, expect, it } from 'vitest';
import type { KnowledgeCitation } from '@flow/contracts';
import { createServer } from '../../../apps/server/src/index.js';
import { FlowClient } from './index.js';

const name = `flow_f01_goal_context_${randomUUID().replaceAll('-', '')}`;
const admin = new Pool({ connectionString: 'postgresql://flow:flow-local-only@127.0.0.1:55432/postgres', max: 1 });
const options = { databaseUrl: `postgresql://flow:flow-local-only@127.0.0.1:55432/${name}`, ownerToken: 'goal-context-owner', leaseMs: 60_000 };
const pool = new Pool({ connectionString: options.databaseUrl, max: 2 });
let app: Awaited<ReturnType<typeof createServer>> | undefined;
let client: FlowClient;
let created = false;
const facts: Record<string, unknown> = { database: name, startedAt: new Date().toISOString(), modelQueries: 0 };
async function start() {
  // Production defaults: no manual module registration, migration or disabled queue scan.
  app = await createServer(options);
  client = new FlowClient({ baseUrl: await app.listen({ host: '127.0.0.1', port: 0 }), token: options.ownerToken });
}
beforeAll(async () => {
  facts.before = (await admin.query('SELECT datname FROM pg_database WHERE datname=$1', [name])).rows;
  if ((facts.before as unknown[]).length) throw new Error('Refusing an existing database.');
  await admin.query(`CREATE DATABASE ${name}`); created = true; facts.created = true;
  await start();
});
afterAll(async () => {
  try {
    await app?.close(); await pool.end();
    facts.connectionsBeforeDrop = (await admin.query('SELECT pid FROM pg_stat_activity WHERE datname=$1', [name])).rows;
    if (created) await admin.query(`DROP DATABASE ${name}`);
    facts.remaining = (await admin.query('SELECT datname FROM pg_database WHERE datname=$1', [name])).rows;
    facts.endedAt = new Date().toISOString();
    await writeFile('docs/evidence/f01/goal-context-production-facts.json', JSON.stringify(facts, null, 2));
  } finally { await admin.end(); }
});

it('mounts 021 before real claim and preserves owner-only frozen goal context across restart and safe recovery', async () => {
  expect(app!.hasRoute({ method: 'GET', url: '/api/goals/:goalId/nodes/:nodeId/inputs/:version/context' })).toBe(true);
  const migrations = (await pool.query('SELECT version FROM flow.migrations ORDER BY version')).rows.map(row => row.version);
  expect(migrations).toEqual(expect.arrayContaining([6, 15, 18, 19, 20, 21])); facts.migrationsAtReady = migrations;
  const project = await client.createProject({ workspaceId: 'personal', title: 'Goal context production' }, randomUUID());
  const projectId = project.snapshot.project.id;
  const added = await client.changeProject(projectId, { expectedRevision: 1, reason: 'One scoped node', change: { kind: 'add-node', title: 'Draft', taskId: null, parent: null } }, randomUUID());
  const nodeId = added.changedNodeId!;
  const { goal } = await client.createGoal({ projectId, originalGoal: 'Use a fixed source', constraints: 'No model', acceptance: 'Explicit reference' }, randomUUID());
  const text = 'PRIVATE original 古😀\r\n';
  const source = await client.createKnowledgeSource(projectId, { expectedVersion: 0, title: 'Material', text }, randomUUID());
  const ref: KnowledgeCitation = { projectId, sourceId: source.source.id, version: 1, contentDigest: source.version.contentDigest, locator: { kind: 'utf8-bytes', start: 0, end: Buffer.byteLength(text) } };
  await client.commandGoal(goal.id, { kind: 'define-input', nodeId, expectedInputVersion: 0, input: { goal: 'Use this source', constraints: 'Keep exact bytes', acceptance: 'Verified', verification: { kind: 'nonempty' }, knowledge: [ref] }, reason: 'Freeze' }, randomUUID());
  const accepted = await client.commandGoal(goal.id, { kind: 'execute', nodeId, expectedInputVersion: 1, previousExecutionId: null, dependencies: [], reason: 'Explicit execution', fixture: { scenario: 'success', delayMs: 0 } }, randomUUID());
  const taskId = accepted.task!.id;
  const publicPrompt = (await client.show(taskId)).prompt;
  expect(publicPrompt).not.toContain('PRIVATE original');
  await client.publishKnowledgeVersion(projectId, source.source.id, { expectedVersion: 1, text: 'New current source v2' }, randomUUID());
  await app!.close(); app = undefined; await start();
  const detail = await client.goalContext(goal.id, nodeId, 1);
  expect(detail.sources[0]).toMatchObject({ text, currentVersion: 2, isCurrent: false });
  expect(JSON.stringify(await client.readGoal(goal.id))).not.toContain('PRIVATE original');
  await expect(client.goalContext(randomUUID(), nodeId, 1)).rejects.toMatchObject({ status: 404 });
  const registered = await client.registerRunner({ name: 'Claim without execution', harnesses: ['fixture'], capacity: 1 });
  let runner = new FlowClient({ baseUrl: app!.listeningOrigin, token: registered.token });
  await expect(runner.goalContext(goal.id, nodeId, 1)).rejects.toMatchObject({ status: 403 });
  let assignment: Awaited<ReturnType<FlowClient['claim']>>['assignment'];
  await expect.poll(async () => { assignment = (await runner.claim()).assignment; return assignment?.task.id; }, { timeout: 5000 }).toBe(taskId);
  expect(assignment!.task.prompt).toContain(JSON.stringify(text));
  expect(assignment!.task.prompt).not.toContain('New current source v2');
  expect((await client.show(taskId)).prompt).toBe(publicPrompt);
  const fence = { attemptId: assignment!.attempt.id, ownerVersion: assignment!.attempt.ownerVersion };
  // There is no adapter process. Revoke is a real API transition; no DB status edit.
  await client.revokeRunner(registered.runnerId);
  expect((await client.show(taskId)).status).toBe('uncertain');
  const evidence = { explanation: 'Only a private claim was read; no adapter or external action ran.', references: [] };
  const resolved = await client.resolveReconciliation(taskId, { ...fence, stoppedConfirmed: true, stopEvidence: evidence, sideEffects: 'none-confirmed', effectsEvidence: evidence, outcome: 'cancelled' }, randomUUID());
  const retryInput = { ...fence, resolutionId: resolved.audit.id, safety: { strategy: 'revised-work' as const, prompt: 'Inspect retained material only.', evidence } };
  const key = randomUUID(); const retry = await client.retryReconciledTask(taskId, retryInput, key);
  await app!.close(); app = undefined; await start();
  expect(await client.retryReconciledTask(taskId, retryInput, key)).toEqual({ ...retry, replayed: true });
  const recoveryRunner = await client.registerRunner({ name: 'Recovery claim without execution', harnesses: ['fixture'], capacity: 1 });
  runner = new FlowClient({ baseUrl: app!.listeningOrigin, token: recoveryRunner.token });
  await expect.poll(async () => { assignment = (await runner.claim()).assignment; return assignment?.task.id; }, { timeout: 5000 }).toBe(retry.task.id);
  expect(assignment!.task.prompt).toContain(JSON.stringify(text)); expect(assignment!.task.prompt).toContain(retryInput.safety.prompt);
  expect((await client.show(retry.task.id)).prompt).not.toContain('PRIVATE original');
  expect((await client.goalExecutions(goal.id, { nodeId })).executions).toHaveLength(1);
  await runner.report({ attemptId: assignment!.attempt.id, ownerVersion: assignment!.attempt.ownerVersion, events: [{ id: randomUUID(), sequence: 1, type: 'completed', outcome: 'cancelled' }] });
  facts.context = { goalId: goal.id, nodeId, taskId, retryTaskId: retry.task.id, contextDigest: detail.contextDigest, publicPromptRetained: true, privateFrozenVersion: 1, currentSourceVersion: 2, retryDidNotCreateGoalExecution: true };
});
