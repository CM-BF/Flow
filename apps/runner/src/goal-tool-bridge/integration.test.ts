import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Pool } from 'pg';
import { PgBoss } from 'pg-boss';
import { FlowClient } from '@flow/client';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { createServer } from '../../../server/src/index.js';
import { migrateGoalToolRuns, registerGoalToolRunRoutes } from '../../../server/src/goal-tool-runs/index.js';
import { createClaudeAdapter, type ClaudeQuery } from '../claude.js';
import { describeExecutionProfile, guardExecutionProfile } from '../execution-profiles.js';
import { runRunner } from '../runtime.js';
import { finalResult, mcpPeer } from './test-peer.js';

const name = `flow_o04_${randomUUID().replaceAll('-', '')}`;
const databaseUrl = `postgresql://flow:flow-local-only@127.0.0.1:55432/${name}`;
const admin = new Pool({ connectionString: 'postgresql://flow:flow-local-only@127.0.0.1:55432/postgres', max: 1 });
let pool: Pool; let boss: PgBoss; let app: Awaited<ReturnType<typeof createServer>>; let url: string; let directory: string; let owner: FlowClient;
const wire: unknown[] = [];
async function call(peer: Client, request: Parameters<Client['callTool']>[0]) {
  const response = await peer.callTool(request); wire.push({ method: 'tools/call', request, response }); return response;
}
let dropCommandAck = false;
const running: { stop: AbortController; promise: Promise<void> }[] = [];
beforeAll(async () => {
  await admin.query(`CREATE DATABASE ${name}`); directory = await mkdtemp(join(tmpdir(), 'flow-o04-http-'));
  pool = new Pool({ connectionString: databaseUrl }); boss = new PgBoss({ connectionString: databaseUrl }); await boss.start();
  app = await createServer({ databaseUrl, ownerToken: 'o04-owner' }); await migrateGoalToolRuns(pool);
  if (!app.hasRoute({ method: 'POST', url: '/api/runner/goal-tools/grant' })) registerGoalToolRunRoutes(app, pool, boss);
  app.addHook('onSend', async (request, reply, payload) => {
    if (dropCommandAck && request.url === '/api/runner/goal-tools/command' && request.headers['idempotency-key'] === 'lost-ack') { dropCommandAck = false; reply.raw.destroy(); }
    return payload;
  });
  url = await app.listen({ host: '127.0.0.1', port: 0 }); owner = new FlowClient({ baseUrl: url, token: 'o04-owner' });
});
afterAll(async () => {
  try { for (const run of running) run.stop.abort(); await Promise.all(running.map(run => run.promise));
    if (process.env.FLOW_O04_EVIDENCE_FILE) await writeFile(process.env.FLOW_O04_EVIDENCE_FILE, JSON.stringify({ boundary: 'Official MCP client tool requests/responses; query transport injected, no model', wire }, null, 2) + '\n');
    await app?.close(); await boss?.stop(); await pool?.end(); await admin.query(`DROP DATABASE ${name}`); await rm(directory, { recursive: true, force: true }); }
  finally { await admin.end(); }
});
async function get(path: string) {
  const response = await fetch(url + path, { headers: { authorization: 'Bearer o04-owner' }, signal: AbortSignal.timeout(5000) });
  expect(response.status).toBe(200); return response.json();
}
async function post(path: string, body: unknown) {
  const response = await fetch(url + path, { method: 'POST', headers: { authorization: 'Bearer o04-owner', 'content-type': 'application/json', 'idempotency-key': randomUUID() }, body: JSON.stringify(body) });
  expect(response.status).toBeLessThan(300); return response.json();
}
async function planned(query: ClaudeQuery) {
  const project = (await post('/api/projects', { title: 'O04 integration' })).snapshot;
  const added = await post(`/api/projects/${project.project.id}/commands`, { expectedRevision: 1, reason: 'Permitted node', change: { kind: 'add-node', title: 'A' } });
  const goal = await post('/api/goals', { projectId: project.project.id, originalGoal: '规划输入🙂', constraints: 'Granted tools only', acceptance: 'Versioned result' });
  const registration = await owner.registerRunner({ name: 'Native goal fixture peer', harnesses: ['claude'], capacity: 1 });
  const options = { materialFiles: [], allowRead: false, goalTools: true, model: 'synthetic-no-query', timeoutMs: 5000, query };
  const adapter = createClaudeAdapter(options); const configuration = describeExecutionProfile(options, adapter);
  const client = new FlowClient({ baseUrl: url, token: registration.token });
  const published = await client.publishExecutionProfile({ configuration });
  const accepted = await owner.admitGoalToolRun(goal.goal.id, { scope: { readScope: 'whole-goal', allowedNodeIds: [added.changedNodeId], allowedCommands: ['define-input', 'execute'], maxCommands: 3 }, prompt: 'Use only the permitted goal tools', execution: { harness: 'claude', executionProfile: published.profile.reference } }, randomUUID());
  const stop = new AbortController();
  const start = () => {
    const promise = runRunner({ baseUrl: url, token: registration.token, workingDirectory: join(directory, registration.runnerId), signal: stop.signal, adapters: [guardExecutionProfile(adapter, published.profile.reference, configuration)], pollIntervalMs: 20, heartbeatIntervalMs: 50 });
    running.push({ stop, promise }); return promise;
  };
  return { accepted, nodeId: added.changedNodeId as string, goalId: goal.goal.id as string, start, stop };
}
function value(result: any) { return JSON.parse(result.content[0].text); }
it('runs real runner -> SDK MCP -> HTTP/PG commands and persists only the actual final result', async () => {
  let nodeId = ''; let queryCalls = 0; let closed = false; let childId = '';
  const query: ClaudeQuery = ({ options }) => Object.assign((async function* () {
    queryCalls++; expect(options!.env).not.toHaveProperty('FLOW_RUNNER_TOKEN'); expect(options!.env).not.toHaveProperty('FLOW_TOKEN');
    const peer = await mcpPeer(options!);
    try {
      const overview = value(await call(peer, { name: 'goal_read', arguments: { request: { view: 'overview' } } }));
      expect(overview.nodes[0].nodeId).toBe(nodeId);
      const command = { kind: 'define-input', nodeId, expectedInputVersion: 0, input: { goal: '确定性输入🙂', constraints: 'No model', acceptance: 'Nonempty', verification: { kind: 'nonempty' } }, reason: 'Scoped native tool' };
      const first = await call(peer, { name: 'goal_command', arguments: { command, idempotencyKey: 'define-stable' } });
      expect(first.isError).not.toBe(true); expect(value(first).inputVersion).toBe(1);
      expect(value(await call(peer, { name: 'goal_command', arguments: { command, idempotencyKey: 'define-stable' } })).replayed).toBe(true);
      expect((await call(peer, { name: 'goal_command', arguments: { command: { ...command, nodeId: randomUUID() }, idempotencyKey: 'denied' } })).isError).toBe(true);
      const detail = await call(peer, { name: 'goal_read', arguments: { request: { view: 'input', nodeId, version: 1 } } }); expect(value(detail).definition.input.goal).toBe('确定性输入🙂');
      const executed = await call(peer, { name: 'goal_command', arguments: { command: { kind: 'execute', nodeId, expectedInputVersion: 1, dependencies: [], previousExecutionId: null, fixture: { scenario: 'success' }, reason: 'Fixture execution' }, idempotencyKey: 'execute-stable' } });
      expect(executed.isError).not.toBe(true); childId = value(executed).task.id; expect(value(executed).task.status).toBe('queued');
      expect(value(await call(peer, { name: 'goal_command', arguments: { command: { ...command, reason: 'Changed intent' }, idempotencyKey: 'define-stable' } })).error).toBe('center_rejected');
    } finally { await peer.close(); }
    yield { type: 'assistant', message: { id: 'ignored', content: [{ type: 'thinking', thinking: 'DO_NOT_PERSIST' }] } } as any;
    yield finalResult();
  })(), { close() { closed = true; } });
  const run = await planned(query); nodeId = run.nodeId; const promise = run.start();
  await expect.poll(async () => (await owner.show(run.accepted.task.id)).status, { timeout: 6000, interval: 20 }).toBe('succeeded');
  run.stop.abort(); await promise;
  expect(queryCalls).toBe(1); expect(closed).toBe(true);
  const task = await owner.show(run.accepted.task.id); expect(task.verificationStatus).toBe('passed');
  const audit = await owner.goalToolRunCalls(run.accepted.run.id); expect(audit.run.usedCommands).toBe(2); expect(audit.calls[1]!.result.taskId).toBe(childId);
  const messages = await get(`/api/tasks/${run.accepted.task.id}/assistant-messages`); expect(messages.messages).toHaveLength(1);
  const message = await get(`/api/assistant-messages/${messages.messages[0]!.id}`); expect(message.content).toBe('中文目标已记录🙂，子任务仍待执行。'); expect(JSON.stringify(message)).not.toContain('DO_NOT_PERSIST');
  expect((await owner.show(childId)).status).toBe('queued');
});
it('cancels an active bridged query and records no final/artifact from its late synthetic result', async () => {
  let ready!: () => void; const started = new Promise<void>(resolve => { ready = resolve; }); let closed = false;
  const query: ClaudeQuery = ({ options }) => Object.assign((async function* () {
    const peer = await mcpPeer(options!);
    try { await call(peer, { name: 'goal_read', arguments: { request: { view: 'overview' } } }); ready(); await new Promise<void>(resolve => options!.abortController!.signal.addEventListener('abort', () => resolve(), { once: true })); }
    finally { await peer.close(); }
    yield finalResult();
  })(), { close() { closed = true; } });
  const run = await planned(query); const promise = run.start(); await started; await owner.cancel(run.accepted.task.id, randomUUID());
  await expect.poll(async () => (await owner.show(run.accepted.task.id)).status, { timeout: 6000, interval: 20 }).toBe('cancelled');
  run.stop.abort(); await promise; expect(closed).toBe(true);
  expect((await get(`/api/tasks/${run.accepted.task.id}/assistant-messages`)).messages).toEqual([]);
  const task = await owner.show(run.accepted.task.id); expect(task.verificationStatus).toBe('pending'); expect(task.entries.some(entry => entry.kind === 'reference' && entry.reference.title === 'Claude result')).toBe(false);
});

it('reconciles a lost HTTP command ACK with the same key and rejects that replay after revoke', async () => {
  let run: Awaited<ReturnType<typeof planned>>;
  const query: ClaudeQuery = ({ options }) => Object.assign((async function* () {
    const peer = await mcpPeer(options!);
    try {
      const command = { kind: 'define-input', nodeId: run.nodeId, expectedInputVersion: 0, input: { goal: 'Lost ACK input', constraints: '', acceptance: 'No duplicate', verification: { kind: 'nonempty' } }, reason: 'Same intent' };
      dropCommandAck = true;
      const unknown = await call(peer, { name: 'goal_command', arguments: { command, idempotencyKey: 'lost-ack' } });
      expect(unknown.isError).toBe(true); expect(value(unknown).error).toBe('outcome_unknown');
      const replay = await call(peer, { name: 'goal_command', arguments: { command, idempotencyKey: 'lost-ack' } });
      expect(replay.isError).not.toBe(true); expect(value(replay).replayed).toBe(true);
      await owner.revokeGoalToolRun(run.accepted.run.id, { reason: 'Revoke live tools' }, randomUUID());
      const denied = await call(peer, { name: 'goal_command', arguments: { command, idempotencyKey: 'lost-ack' } });
      expect(denied.isError).toBe(true); expect(value(denied)).toMatchObject({ error: 'center_rejected', status: 409 });
    } finally { await peer.close(); }
    yield finalResult('o04-native-reconciled');
  })(), { close() {} });
  run = await planned(query); const promise = run.start();
  await expect.poll(async () => (await owner.show(run.accepted.task.id)).status, { timeout: 6000, interval: 20 }).toBe('succeeded');
  run.stop.abort(); await promise;
  const audit = await owner.goalToolRunCalls(run.accepted.run.id); expect(audit.calls).toHaveLength(1); expect(audit.run.usedCommands).toBe(1); expect(audit.run.revokedAt).not.toBeNull();
});
