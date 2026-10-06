import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Pool } from 'pg';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { FlowClient } from '../../../packages/client/src/index.js';
import { createServer } from './index.js';
import { createClaudeAdapter, type ClaudeQuery } from '../../runner/src/claude.js';
import { describeExecutionProfile, guardExecutionProfile, publishExecutionProfile } from '../../runner/src/execution-profiles.js';
import { runRunner } from '../../runner/src/runtime.js';

const database = `flow_native_mount_${randomUUID().replaceAll('-', '')}`;
const admin = new Pool({ connectionString: 'postgresql://flow:flow-local-only@127.0.0.1:55432/postgres', max: 1 });
const databaseUrl = `postgresql://flow:flow-local-only@127.0.0.1:55432/${database}`;
const pool = new Pool({ connectionString: databaseUrl, max: 2 });
const ownerToken = randomUUID();
const facts: Record<string, unknown> = { database, created: false };
let app: Awaited<ReturnType<typeof createServer>> | undefined;
let baseUrl = '';
let client: FlowClient;
beforeAll(async () => {
  facts.before = (await admin.query('SELECT datname FROM pg_database WHERE datname=$1', [database])).rows;
  expect(facts.before).toEqual([]);
  await admin.query(`CREATE DATABASE ${database}`); facts.created = true;
  app = await createServer({ databaseUrl, ownerToken, leaseMs: 300_000 });
  baseUrl = await app.listen({ host: '127.0.0.1', port: 0 });
  client = new FlowClient({ baseUrl, token: ownerToken });
});
afterAll(async () => {
  try { await app?.close(); }
  finally {
    await pool.end();
    try {
      facts.connections = (await admin.query('SELECT pid FROM pg_stat_activity WHERE datname=$1', [database])).rows;
      if (facts.created) await admin.query(`DROP DATABASE ${database}`);
      facts.remaining = (await admin.query('SELECT datname FROM pg_database WHERE datname=$1', [database])).rows;
      console.log('NATIVE_GOAL_PRODUCTION_DATABASE_FACTS', JSON.stringify(facts));
    } finally { await admin.end(); }
  }
});
async function request(path: string, body?: unknown, token: string = ownerToken, expectedStatus = 200) {
  const response = await fetch(baseUrl + path, {
    method: body === undefined ? 'GET' : 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', 'idempotency-key': randomUUID(), connection: 'close' },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(5000),
  });
  const value = await response.json(); expect(response.status, JSON.stringify(value)).toBe(expectedStatus); return value;
}
it('mounts owner native admission behind existing authentication without enabling active steering', async () => {
  expect(app!.hasRoute({ method: 'POST', url: '/api/goals/:id/native-executions' })).toBe(true);
  const runner = await request('/api/runners', { name: 'Native mount role check', harnesses: ['claude'], capacity: 1 });
  const path = `/api/goals/${randomUUID()}/native-executions`;
  await request(path, {}, 'invalid', 401);
  await request(path, {}, runner.token, 403);
  expect((await request(path, {}, ownerToken, 400)).error.code).toBe('invalid_native_goal_execution');
  const conversation = await request('/api/conversations', { harness: 'claude', title: 'Capabilities stay conservative' }, ownerToken, 201);
  expect(conversation.capabilities.steer).toBe(false);
  expect((await pool.query('SELECT version FROM flow.migrations WHERE version=24')).rows).toEqual([{ version: 24 }]);
});
it('connects the public client to the real factory and runs one pinned text child with the existing verifier', async () => {
  const project = (await request('/api/projects', { title: 'Production admission integration' }, ownerToken, 201)).snapshot.project;
  const node = await request(`/api/projects/${project.id}/commands`, { expectedRevision: project.revision, reason: 'Owner creates child', change: { kind: 'add-node', title: 'Text child' } });
  const goal = (await request('/api/goals', { projectId: project.id, originalGoal: 'Write one short synthetic note', constraints: 'No engineering writes', acceptance: 'Owner must review' }, ownerToken, 201)).goal;
  await request(`/api/goals/${goal.id}/commands`, { kind: 'define-input', nodeId: node.changedNodeId, expectedInputVersion: 0, reason: 'Fixed input', input: { goal: 'Draft a bounded note', constraints: 'Text only', acceptance: 'Owner reviews meaning', verification: { kind: 'nonempty' } } });
  const runner = await request('/api/runners', { name: 'Pinned synthetic child', harnesses: ['claude'], capacity: 1 });
  const directory = await mkdtemp(join(tmpdir(), 'flow-native-mount-'));
  const material = join(directory, 'synthetic.txt'); await writeFile(material, 'Synthetic release fact', { mode: 0o600 });
  const stop = new AbortController(); const session = randomUUID(); const text = '集成后的子任务答复 古😀';
  let calls = 0, closed = 0; let running: Promise<void> | undefined;
  type Message = ReturnType<ClaudeQuery> extends AsyncIterable<infer T> ? T : never;
  const query: ClaudeQuery = ({ prompt, options }) => Object.assign((async function* () {
    calls++; expect(typeof prompt).toBe('string'); expect(prompt).toContain('Draft a bounded note');
    expect(options!.model).toBe('synthetic-mount'); expect(options!.tools).toEqual(['Read']); expect(options!.mcpServers).toEqual({});
    yield { type: 'system', subtype: 'init', uuid: randomUUID(), session_id: session, tools: ['Read'], plugins: [], skills: [], mcp_servers: [], model: 'synthetic-mount', permissionMode: 'dontAsk', claude_code_version: 'injected' } as unknown as Message;
    yield { type: 'result', subtype: 'success', is_error: false, uuid: randomUUID(), session_id: session, result: text, modelUsage: {}, permission_denials: [] } as unknown as Message;
  })(), { close() { closed++; } });
  try {
    const options = { materialFiles: [material], allowRead: true, requireReadApproval: false, model: 'synthetic-mount', query, timeoutMs: 6000, maxTurns: 2, maxBudgetUsd: 0.1 };
    const adapter = createClaudeAdapter(options); const configuration = describeExecutionProfile(options, adapter);
    const pin = await publishExecutionProfile({ baseUrl, token: runner.token, configuration });
    const input = { nodeId: node.changedNodeId, expectedInputVersion: 1, dependencies: [], previousExecutionId: null, reason: 'Owner authorizes exactly this profile', executionProfile: pin };
    const key = randomUUID(); const receipt = await client.executeGoalNative(goal.id, input, key);
    expect(receipt.task).toMatchObject({ harness: 'claude' }); expect(receipt.executionProfile).toEqual(pin);
    expect((await pool.query('SELECT submission FROM flow.tasks WHERE id=$1', [receipt.task!.id])).rows[0].submission.executionProfile).toEqual(pin);
    expect((await client.executeGoalNative(goal.id, input, key)).replayed).toBe(true);
    running = runRunner({ baseUrl, token: runner.token, workingDirectory: directory, signal: stop.signal, pollIntervalMs: 20,
      adapters: [guardExecutionProfile(adapter, pin, configuration)] });
    await expect.poll(async () => (await request(`/api/tasks/${receipt.task!.id}`)).status, { timeout: 8000, interval: 20 }).toBe('succeeded');
    const snapshot = await request(`/api/tasks/${receipt.task!.id}`);
    expect(snapshot.verificationStatus).toBe('passed'); expect(calls).toBe(1); expect(closed).toBe(1);
    const messages = (await request(`/api/tasks/${receipt.task!.id}/assistant-messages`)).messages;
    expect(messages).toHaveLength(1);
    expect((await request(`/api/assistant-messages/${messages[0].id}`)).content).toBe(text);
    const goalSnapshot = await request(`/api/goals/${goal.id}`);
    expect(goalSnapshot.nodes[0].accepted).toBeNull(); expect(goalSnapshot.nodes[0].deliveryCurrent).toBe(false);
    expect((await request(`/api/goals/${goal.id}/executions?nodeId=${node.changedNodeId}`)).executions).toHaveLength(1);
    expect((await pool.query('SELECT count(*)::int AS count FROM flow.steering_commands')).rows[0].count).toBe(0);
  } finally { stop.abort(); await running; await rm(directory, { recursive: true, force: true }); }
});
