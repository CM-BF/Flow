import { createServer as httpServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { Pool } from 'pg';
import { expect, it } from 'vitest';
import { goalDeliveryQuerySchema, type GoalDeliveryQuery } from '../../contracts/src/goal-delivery.js';
import { createServer } from '../../../apps/server/src/index.js';
import { FlowClient } from './index.js';

it('transports all bounded goal views with repeated identities, exact version, errors and cancellation', async () => {
  const requests: { goal: string; query: unknown }[] = [];
  let status = 200;
  const server = httpServer((req, res) => {
    expect(req.method).toBe('GET'); expect(req.headers.authorization).toBe('Bearer synthetic-goal-owner');
    expect(req.headers['idempotency-key']).toBeUndefined();
    const url = new URL(req.url!, 'http://localhost');
    const query: Record<string, unknown> = Object.fromEntries(url.searchParams);
    if (query.view === 'state') query.nodeIds = url.searchParams.getAll('nodeIds');
    const input = goalDeliveryQuerySchema.parse(query);
    requests.push({ goal: url.pathname, query: input });
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(JSON.stringify(status === 200 ? { view: input.view } : { error: { code: 'goal_read_unavailable', message: 'synthetic' } }));
  }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const client = new FlowClient({ baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, token: 'synthetic-goal-owner' });
  const views: GoalDeliveryQuery[] = [{ view: 'plan', after: 'cursor /?', limit: 3 }, { view: 'state', nodeIds: ['node/A', 'node B'] },
    { view: 'input', nodeId: 'node/A', version: 7 }, { view: 'goal' }, { view: 'decision', nodeId: 'n', taskId: 't', decisionId: 'd' }];
  try {
    for (const view of views) expect(await client.goalDelivery('goal /?', view)).toEqual({ view: view.view });
    expect(requests.map(r => r.query)).toEqual(views);
    expect(requests.every(r => r.goal === '/api/goals/goal%20%2F%3F/delivery')).toBe(true);
    for (status of [403, 404, 409]) await expect(client.goalDelivery('goal', { view: 'goal' })).rejects.toMatchObject({ status, code: 'goal_read_unavailable' });
    await expect(client.goalDelivery('goal', { view: 'goal' }, AbortSignal.abort())).rejects.toThrow();
    expect(requests).toHaveLength(8);
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
});

it('reads the actual owner-mounted goal plan and explicit input through FlowClient across restart', async () => {
  const database = `flow_f01_goal_read_${randomUUID().replaceAll('-', '')}`;
  const admin = new Pool({ connectionString: 'postgresql://flow:flow-local-only@127.0.0.1:55432/postgres', max: 1 });
  const databaseUrl = `postgresql://flow:flow-local-only@127.0.0.1:55432/${database}`;
  let app: Awaited<ReturnType<typeof createServer>> | undefined, created = false;
  const facts: Record<string, unknown> = { database, providerCalls: 0, startedAt: new Date().toISOString(), factoryOnly: true };
  async function start() {
    app = await createServer({ databaseUrl, ownerToken: 'synthetic-goal-owner' });
    return new FlowClient({ baseUrl: await app.listen({ host: '127.0.0.1', port: 0 }), token: 'synthetic-goal-owner' });
  }
  try {
    facts.before = (await admin.query('SELECT datname FROM pg_database WHERE datname=$1', [database])).rows;
    if ((facts.before as unknown[]).length) throw Error('Refuse pre-existing goal read database');
    await admin.query(`CREATE DATABASE ${database}`); created = true;
    let owner = await start();
    expect(app!.hasRoute({ method: 'GET', url: '/api/goals/:id/delivery' })).toBe(true);
    const { snapshot } = await owner.createProject({ workspaceId: 'personal', title: 'Public goal read' }, randomUUID());
    const changed = await owner.changeProject(snapshot.project.id, { expectedRevision: snapshot.project.revision, reason: 'One bounded step', change: { kind: 'add-node', title: 'Step A', taskId: null, parent: null } }, randomUUID());
    const nodeId = changed.changedNodeId!;
    const { goal } = await owner.createGoal({ projectId: snapshot.project.id, originalGoal: 'PRIVATE_GOAL_BODY', constraints: 'No provider', acceptance: 'Read exact metadata' }, randomUUID());
    await owner.commandGoal(goal.id, { kind: 'define-input', nodeId, expectedInputVersion: 0, reason: 'Freeze input', input: { goal: 'PRIVATE_INPUT_BODY', constraints: 'No model', acceptance: 'nonempty', verification: { kind: 'nonempty' } } }, randomUUID());
    const plan = await owner.goalDelivery(goal.id, { view: 'plan', limit: 1 });
    expect(plan).toMatchObject({ view: 'plan', totalNodes: 1, nextCursor: null, nodes: [{ id: nodeId, inputRef: { goalId: goal.id, nodeId, version: 1 } }] });
    expect(JSON.stringify(plan)).not.toMatch(/PRIVATE_GOAL_BODY|PRIVATE_INPUT_BODY/);
    expect(await owner.goalDelivery(goal.id, { view: 'state', nodeIds: [nodeId] })).toMatchObject({ view: 'state', nodes: [{ nodeId, execution: null, accepted: null, deliveryCurrent: false }] });
    const input = await owner.goalDelivery(goal.id, { view: 'input', nodeId, version: 1 });
    expect(input).toMatchObject({ definition: { input: { goal: 'PRIVATE_INPUT_BODY' } }, currentVersion: 1, stale: false });
    const runnerRegistration = await owner.registerRunner({ name: 'No execution peer', harnesses: ['fixture'], capacity: 1 });
    const runner = new FlowClient({ baseUrl: app!.listeningOrigin, token: runnerRegistration.token });
    await expect(runner.goalDelivery(goal.id, { view: 'goal' })).rejects.toMatchObject({ status: 403 });
    expect((await fetch(`${app!.listeningOrigin}/api/goals/${goal.id}/delivery?view=plan`)).status).toBe(401);
    await app!.close(); app = undefined; owner = await start();
    expect(await owner.goalDelivery(goal.id, { view: 'plan', limit: 1 })).toEqual(plan);
    expect(await owner.goalDelivery(goal.id, { view: 'input', nodeId, version: 1 })).toEqual(input);
    facts.goalId = goal.id; facts.restartStable = true;
  } finally {
    try {
      await app?.close();
      facts.connections = (await admin.query('SELECT pid FROM pg_stat_activity WHERE datname=$1', [database])).rows;
      if ((facts.connections as unknown[]).length) throw Error('Owned goal database still in use');
      if (created) await admin.query(`DROP DATABASE ${database}`);
      facts.remaining = (await admin.query('SELECT datname FROM pg_database WHERE datname=$1', [database])).rows;
    } finally {
      facts.created = created; facts.finishedAt = new Date().toISOString(); await admin.end();
      if (process.env.FLOW_F01_GOAL_READ_EVIDENCE) await writeFile(process.env.FLOW_F01_GOAL_READ_EVIDENCE, JSON.stringify(facts, null, 2));
    }
  }
});
