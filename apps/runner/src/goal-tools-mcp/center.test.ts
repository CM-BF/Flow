import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { FlowClient } from '@flow/client';
import { createServer } from '../../../server/src/index.js';
import { connectPeer, body } from './test-peer.js';

const databaseName = `flow_o02_${randomUUID().replaceAll('-', '')}`;
const admin = new Pool({ connectionString: 'postgresql://flow:flow-local-only@127.0.0.1:55432/postgres', max: 1 });
const databaseUrl = `postgresql://flow:flow-local-only@127.0.0.1:55432/${databaseName}`;
const ownerToken = 'o02-local-owner';
let created = false;
let app: Awaited<ReturnType<typeof createServer>> | undefined;
let api: FlowClient;
async function start() {
  app = await createServer({ databaseUrl, ownerToken });
  expect(app.hasRoute({ method: 'POST', url: '/api/goals' })).toBe(true);
  api = new FlowClient({ baseUrl: await app.listen({ host: '127.0.0.1', port: 0 }), token: ownerToken });
}
async function stop() { await app?.close(); app = undefined; }
beforeAll(async () => { await admin.query(`CREATE DATABASE ${databaseName}`); created = true; await start(); });
afterAll(async () => { try { await stop(); if (created) await admin.query(`DROP DATABASE ${databaseName}`); } finally { await admin.end(); } });
it('preserves durable command identity across real center restart, rejects changed/stale/foreign commands and reads exact versions', async () => {
  const project = await api.createProject({ workspaceId: 'personal', title: 'O02 protocol test' }, randomUUID());
  const added = await api.changeProject(project.snapshot.project.id, { expectedRevision: project.snapshot.project.revision, reason: 'MCP test node', change: { kind: 'add-node', title: 'A', taskId: null, parent: null } }, randomUUID());
  const nodeId = added.changedNodeId!;
  const goal = await api.createGoal({ projectId: project.snapshot.project.id, originalGoal: '原始目标🙂', constraints: '0 models', acceptance: 'Stable binding' }, randomUUID());
  const options = () => ({ goalId: goal.goal.id, allowedNodeIds: [nodeId], allowedCommands: ['define-input', 'execute'] as const, port: api });
  let peer = await connectPeer(options());
  const input = { goal: '中文🙂 exact\ninput', constraints: '0 tools', acceptance: 'Exact version', verification: { kind: 'nonempty' } };
  const command = { kind: 'define-input', nodeId, expectedInputVersion: 0, input, reason: 'Version one' };
  const call = (command: unknown, idempotencyKey: string) => peer.client.callTool({ name: 'goal_command', arguments: { command, idempotencyKey } });
  try {
    const first = await call(command, 'define-one'); expect(first.isError).not.toBe(true); expect(body(first)).toMatchObject({ changed: true, replayed: false, inputVersion: 1 });
    await peer.close(); await stop(); await start(); peer = await connectPeer(options());
    const replay = await call(command, 'define-one'); expect(replay.isError).not.toBe(true); expect(body(replay)).toEqual({ ...body(first), replayed: true });
    const changed = await call({ ...command, reason: 'Different intent' }, 'define-one');
    expect(changed.isError).toBe(true); expect(body(changed)).toEqual({ error: 'center_rejected', status: 409 });
    const stale = await call(command, 'define-another'); expect(stale.isError).toBe(true); expect(body(stale).status).toBe(409);
    const foreign = await call({ ...command, nodeId: randomUUID() }, 'foreign'); expect(body(foreign).error).toBe('scope_denied');
    const actual = await peer.client.callTool({ name: 'goal_read', arguments: { request: { view: 'input', nodeId, version: 1 } } });
    expect(body(actual).definition.input).toEqual(input);
    const execute = { kind: 'execute', nodeId, expectedInputVersion: 1, previousExecutionId: null, dependencies: [], fixture: { scenario: 'success' }, reason: 'Admit only; no runner' };
    const admitted = await call(execute, 'execution-one'); expect(admitted.isError).not.toBe(true); expect(body(admitted).task.status).toBe('queued');
    const repeated = await call(execute, 'execution-one'); expect(body(repeated).task.id).toBe(body(admitted).task.id); expect(body(repeated).replayed).toBe(true);
    const truth = await api.show(body(admitted).task.id); expect(truth.status).toBe('queued'); expect(JSON.parse(truth.prompt).input).toEqual(input);
    expect(JSON.stringify(admitted)).not.toContain('中文🙂 exact');
    // The authority commits, then the transport loses its ACK. Never create a new key.
    await peer.close();
    peer = await connectPeer({ ...options(), port: {
      readGoal: api.readGoal.bind(api), readGoalInput: api.readGoalInput.bind(api),
      async commandGoal(...args) { await api.commandGoal(...args); throw new Error('ACK lost, private token SECRET'); },
    } });
    const edit = { ...command, expectedInputVersion: 1, input: { ...input, goal: 'Version two' } };
    const lost = await call(edit, 'edit-with-lost-ack');
    expect(lost.isError).toBe(true); expect(body(lost).error).toBe('outcome_unknown'); expect(JSON.stringify(lost)).not.toContain('SECRET');
    await peer.close(); await stop(); await start(); peer = await connectPeer(options());
    const reconciled = await call(edit, 'edit-with-lost-ack');
    expect(body(reconciled)).toMatchObject({ inputVersion: 2, replayed: true });
    const historic = await peer.client.callTool({ name: 'goal_read', arguments: { request: { view: 'input', nodeId, version: 1 } } });
    expect(body(historic).definition.input).toEqual(input);
    const state = await api.readGoal(goal.goal.id);
    expect(state.nodes[0]!.definition!.version).toBe(2);
    expect(state.explanations.filter(value => value.kind === 'define-input')).toHaveLength(2);
  } finally { await peer.close(); }
});
