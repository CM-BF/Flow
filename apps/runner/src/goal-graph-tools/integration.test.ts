import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Pool } from 'pg';
import { FlowClient } from '@flow/client';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { createServer } from '../../../server/src/index.js';
import { migrateConversationContext } from '../../../server/src/conversation-context/index.js';
import { createClaudeAdapter, type ClaudeQuery } from '../claude.js';
import { describeExecutionProfile, guardExecutionProfile } from '../execution-profiles.js';
import { runRunner } from '../runtime.js';
import { finalResult, graphPeer } from './test-peer.js';

const name = `flow_o07_http_${randomUUID().replaceAll('-', '')}`;
const databaseUrl = `postgresql://flow:flow-local-only@127.0.0.1:55432/${name}`;
const admin = new Pool({ connectionString: 'postgresql://flow:flow-local-only@127.0.0.1:55432/postgres', max: 1 });
let pool: Pool; let app: Awaited<ReturnType<typeof createServer>>; let url: string; let directory: string; let owner: FlowClient;
const wire: unknown[] = []; const facts: unknown[] = [];
const running: { stop: AbortController; promise: Promise<void> }[] = [];
let dropApplyAck = false;
beforeAll(async () => {
  await admin.query(`CREATE DATABASE ${name}`); directory = await mkdtemp(join(tmpdir(), 'flow-o07-http-')); pool = new Pool({ connectionString: databaseUrl });
  app = await createServer({ databaseUrl, ownerToken: 'o07-owner', automaticQueueScan: false, leaseMs: 60_000 });
  await migrateConversationContext(pool); // Local K02 dependency, not yet a main/production mount claim.
  expect(app.hasRoute({ method: 'POST', url: '/api/runner/goal-graph/grant' })).toBe(true);
  app.addHook('onSend', async (request, reply, payload) => {
    if (dropApplyAck && request.url === '/api/runner/goal-graph/command' && request.headers['idempotency-key'] === 'apply-stable' && reply.statusCode === 200) { dropApplyAck = false; reply.raw.destroy(); }
    return payload;
  });
  url = await app.listen({ host: '127.0.0.1', port: 0 }); owner = new FlowClient({ baseUrl: url, token: 'o07-owner' });
});
afterAll(async () => {
  try {
    for (const run of running) run.stop.abort(); await Promise.all(running.map(run => run.promise));
    await app?.close(); await pool?.end(); await admin.query(`DROP DATABASE ${name}`); await rm(directory, { recursive: true, force: true });
    facts.push({ cleanup: { database: name, removed: !(await admin.query('SELECT 1 FROM pg_database WHERE datname=$1', [name])).rowCount } });
  } finally {
    await admin.end();
    if (process.env.FLOW_O07_WIRE_FILE) await writeFile(process.env.FLOW_O07_WIRE_FILE, JSON.stringify({ boundary: 'Official MCP peer -> SDK in-process server -> public FlowClient -> HTTP/PostgreSQL; production adapter query transport injected, zero native query/model calls; same-process runner runtime, not child-process proof', wire, facts }, null, 2) + '\n');
  }
});
async function post(path: string, body: unknown) {
  const response = await fetch(url + path, { method: 'POST', headers: { authorization: 'Bearer o07-owner', 'content-type': 'application/json', 'idempotency-key': randomUUID() }, body: JSON.stringify(body), signal: AbortSignal.timeout(5000) });
  expect(response.status).toBeLessThan(300); return response.json();
}
async function get(path: string) {
  const response = await fetch(url + path, { headers: { authorization: 'Bearer o07-owner' }, signal: AbortSignal.timeout(5000) }); expect(response.status).toBe(200); return response.json();
}
async function call(peer: Client, request: Parameters<Client['callTool']>[0]) {
  const response = await peer.callTool(request); wire.push({ method: 'tools/call', request, response, requestBytes: Buffer.byteLength(JSON.stringify(request)), responseBytes: Buffer.byteLength(JSON.stringify(response)) }); return response;
}
function value(result: any) { return JSON.parse(result.content[0].text); }
const proposal = { expectedProjectRevision: 1, reason: '发布说明三步🙂', additions: [
  { key: 'A', title: '汇总变更', dependencies: [] }, { key: 'B', title: '草拟发布说明', dependencies: [{ kind: 'proposed', key: 'A' }] },
  { key: 'C', title: '检查完整性', dependencies: [{ kind: 'proposed', key: 'B' }] },
] };
async function planned(query: ClaudeQuery) {
  const project = (await post('/api/projects', { title: 'O07 synthetic graph' })).snapshot.project;
  const goal = (await post('/api/goals', { projectId: project.id, originalGoal: '为小版本发布准备三个步骤', constraints: '不得执行子任务或工程写入', acceptance: '至多三节点两边，忠实说明尚未执行' })).goal;
  const registration = await owner.registerRunner({ name: 'Graph-only injected SDK', harnesses: ['claude'], capacity: 1 });
  const options = { materialFiles: [], allowRead: false, goalGraphTools: true, model: 'synthetic-no-query', timeoutMs: 5000, query };
  const adapter = createClaudeAdapter(options); const configuration = describeExecutionProfile(options, adapter); const client = new FlowClient({ baseUrl: url, token: registration.token });
  const published = await client.publishExecutionProfile({ configuration });
  const accepted = await owner.admitGoalGraphRun(goal.id, { scope: { baseRevision: 1, allowedExistingNodes: [], maxProposals: 1, maxApplications: 1, maxNewNodes: 3, maxNewEdges: 2 }, prompt: '读取图，提出并应用计划；不要执行步骤。', execution: { harness: 'claude', executionProfile: published.profile.reference } }, randomUUID());
  const stop = new AbortController();
  const start = () => { const promise = runRunner({ baseUrl: url, token: registration.token, workingDirectory: join(directory, registration.runnerId), signal: stop.signal, adapters: [guardExecutionProfile(adapter, published.profile.reference, configuration)], pollIntervalMs: 20, heartbeatIntervalMs: 50 }); running.push({ stop, promise }); return promise; };
  return { accepted, projectId: project.id as string, goalId: goal.id as string, runnerId: registration.runnerId, start, stop };
}
it('executes read -> propose -> apply -> actual typed final through the production adapter and real HTTP/PG without executing children', async () => {
  let calls = 0; let closed = false; let receipt: any;
  const query: ClaudeQuery = ({ options }) => Object.assign((async function* () {
    calls++; const peer = await graphPeer(options!);
    try {
      const base = await call(peer, { name: 'graph_read', arguments: { request: { view: 'graph', limit: 3 } } }); expect(value(base)).toMatchObject({ baseRevision: 1, currentRevision: 1, stale: false, nodes: [] });
      const proposed = await call(peer, { name: 'graph_command', arguments: { command: { kind: 'propose', proposal }, idempotencyKey: 'propose-stable' } }); expect(proposed.isError).not.toBe(true);
      const saved = value(proposed).proposal; expect(saved).not.toHaveProperty('input');
      const detail = await call(peer, { name: 'graph_read', arguments: { request: { view: 'proposal', proposalId: saved.id } } }); expect(value(detail).input).toEqual(proposal);
      const command = { kind: 'apply', proposalId: saved.id, expectedProjectRevision: 1, proposalDigest: saved.proposalDigest };
      const applied = await call(peer, { name: 'graph_command', arguments: { command, idempotencyKey: 'apply-stable' } }); expect(applied.isError).not.toBe(true); receipt = value(applied).receipt;
      expect(value(await call(peer, { name: 'graph_command', arguments: { command, idempotencyKey: 'apply-stable' } })).replayed).toBe(true);
      expect(value(await call(peer, { name: 'graph_read', arguments: { request: { view: 'graph' } } }))).toMatchObject({ baseRevision: 1, currentRevision: 6, stale: true, nodes: [] });
    } finally { await peer.close(); }
    yield { type: 'assistant', message: { id: 'ignored', content: [{ type: 'thinking', thinking: 'DO_NOT_STORE' }] } } as any; yield finalResult();
  })(), { close() { closed = true; } });
  const run = await planned(query); const promise = run.start();
  await expect.poll(async () => (await owner.show(run.accepted.task.id)).status, { timeout: 6500, interval: 20 }).toBe('succeeded'); run.stop.abort(); await promise;
  expect(calls).toBe(1); expect(closed).toBe(true);
  const task = await owner.show(run.accepted.task.id); expect(task.verificationStatus).toBe('passed');
  expect((await pool.query('SELECT count(*)::int AS n FROM flow.tasks')).rows[0].n).toBe(1);
  const graph = await get(`/api/projects/${run.projectId}`); expect(graph.graph.nodes).toHaveLength(3); expect(graph.graph.nodes.every((node: any) => node.taskId === null)).toBe(true); expect(graph.graph.nodes.reduce((n: number, node: any) => n + node.dependsOn.length, 0)).toBe(2);
  const audit = await owner.goalGraphRunCalls(run.accepted.run.id); expect(audit.calls).toHaveLength(2); expect(audit.run.usedCommands).toBe(2);
  expect(receipt.actor).toMatchObject({ kind: 'goal-graph-run', runId: run.accepted.run.id, runnerId: run.runnerId, taskId: task.id, attemptId: task.attempt!.id, ownerVersion: 1 });
  const messages = await get(`/api/tasks/${task.id}/assistant-messages`); expect(messages.messages).toHaveLength(1);
  const message = await get(`/api/assistant-messages/${messages.messages[0].id}`); expect(message.content).toBe('计划已记录🙂，未执行子任务。'); expect(JSON.stringify(message)).not.toContain('DO_NOT_STORE');
  facts.push({ scenario: 'complete-graph-plan', taskId: task.id, attemptId: task.attempt!.id, receipt, audit, graph: graph.graph, final: message.content, nativeQueries: 0 });
});
it('recovers a lost apply ACK with its stable key and rejects cached replay after revoke', async () => {
  let run: Awaited<ReturnType<typeof planned>>;
  const query: ClaudeQuery = ({ options }) => Object.assign((async function* () {
    const peer = await graphPeer(options!);
    try {
      const saved = value(await call(peer, { name: 'graph_command', arguments: { command: { kind: 'propose', proposal }, idempotencyKey: 'proposal' } })).proposal;
      const command = { kind: 'apply', proposalId: saved.id, expectedProjectRevision: 1, proposalDigest: saved.proposalDigest }; dropApplyAck = true;
      const unknown = await call(peer, { name: 'graph_command', arguments: { command, idempotencyKey: 'apply-stable' } }); expect(unknown.isError).toBe(true); expect(value(unknown).error).toBe('outcome_unknown');
      const replay = await call(peer, { name: 'graph_command', arguments: { command, idempotencyKey: 'apply-stable' } }); expect(replay.isError).not.toBe(true); expect(value(replay).replayed).toBe(true);
      await owner.revokeGoalGraphRun(run.accepted.run.id, { reason: 'No further tools' }, randomUUID());
      const denied = await call(peer, { name: 'graph_command', arguments: { command, idempotencyKey: 'apply-stable' } }); expect(denied.isError).toBe(true); expect(value(denied)).toMatchObject({ error: 'center_rejected', status: 409 });
    } finally { await peer.close(); } yield finalResult('o07-reconciled');
  })(), { close() {} });
  run = await planned(query); const promise = run.start(); await expect.poll(async () => (await owner.show(run.accepted.task.id)).status, { timeout: 6500, interval: 20 }).toBe('succeeded'); run.stop.abort(); await promise;
  const audit = await owner.goalGraphRunCalls(run.accepted.run.id); expect(audit.calls).toHaveLength(2); expect(audit.run.usedApplications).toBe(1); expect(audit.run.revokedAt).not.toBeNull(); facts.push({ scenario: 'lost-ack-current-auth', audit });
});
it('cancels a live bridged query without accepting a late final or artifact', async () => {
  let ready!: () => void; const started = new Promise<void>(resolve => { ready = resolve; }); let closed = false;
  const query: ClaudeQuery = ({ options }) => Object.assign((async function* () {
    const peer = await graphPeer(options!);
    try { await call(peer, { name: 'graph_read', arguments: { request: { view: 'graph' } } }); ready(); await new Promise<void>(resolve => options!.abortController!.signal.addEventListener('abort', () => resolve(), { once: true })); }
    finally { await peer.close(); } yield finalResult();
  })(), { close() { closed = true; } });
  const run = await planned(query); const promise = run.start(); await started; await owner.cancel(run.accepted.task.id, randomUUID());
  await expect.poll(async () => (await owner.show(run.accepted.task.id)).status, { timeout: 6500, interval: 20 }).toBe('cancelled'); run.stop.abort(); await promise; expect(closed).toBe(true);
  expect((await get(`/api/tasks/${run.accepted.task.id}/assistant-messages`)).messages).toEqual([]);
  const task = await owner.show(run.accepted.task.id); expect(task.verificationStatus).toBe('pending');
  expect((await pool.query('SELECT count(*)::int AS n FROM flow.artifacts WHERE task_id=$1', [task.id])).rows[0].n).toBe(0); facts.push({ scenario: 'cancel-late-final', taskId: task.id, status: task.status, artifacts: 0 });
});
