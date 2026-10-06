import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { expect, it } from 'vitest';
import { createServer } from '../../../apps/server/src/index.js';
import { FlowClient } from './index.js';

it('mounts bounded graph grants under the production role boundary and preserves admission across restart', async () => {
  const name = `flow_graph_mount_${randomUUID().replaceAll('-', '')}`;
  const admin = new Pool({ connectionString: 'postgresql://flow:flow-local-only@127.0.0.1:55432/postgres', max: 1 });
  const options = { databaseUrl: `postgresql://flow:flow-local-only@127.0.0.1:55432/${name}`, ownerToken: 'graph-mount-owner' };
  let app: Awaited<ReturnType<typeof createServer>> | undefined;
  let created = false;
  try {
    await admin.query(`CREATE DATABASE ${name}`); created = true;
    app = await createServer(options);
    expect(app.hasRoute({ method: 'POST', url: '/api/runner/goal-graph/grant' })).toBe(true);
    const url = await app.listen({ host: '127.0.0.1', port: 0 });
    const client = new FlowClient({ baseUrl: url, token: options.ownerToken });
    const project = await client.createProject({ workspaceId: 'personal', title: 'Bounded planner' }, 'project');
    const goal = await client.createGoal({ projectId: project.snapshot.project.id, originalGoal: 'Plan release notes', constraints: 'Do not execute', acceptance: 'Fixed graph' }, 'goal');
    const input = { prompt: 'Only plan', execution: { harness: 'fixture' as const }, scope: { baseRevision: 1, allowedExistingNodes: [], maxProposals: 1, maxApplications: 1, maxNewNodes: 3, maxNewEdges: 2 } };
    const accepted = await client.admitGoalGraphRun(goal.goal.id, input, 'admit');
    expect(accepted.run.mode).toBe('fixture');
    expect(await client.goalGraphRun(accepted.run.id)).toEqual(accepted.run);
    expect((await client.goalGraphRunCalls(accepted.run.id, { after: 0 })).calls).toEqual([]);
    await expect(client.goalGraphGrant({ attemptId: 'unowned', ownerVersion: 1 })).rejects.toMatchObject({ status: 403, code: 'wrong_role' });
    await expect(client.admitGoalGraphRun(goal.goal.id, { ...input, execution: { harness: 'claude' } }, 'native')).rejects.toMatchObject({ status: 409, code: 'native_graph_tools_unavailable' });
    await app.close(); app = await createServer(options);
    const reopened = new FlowClient({ baseUrl: await app.listen({ host: '127.0.0.1', port: 0 }), token: options.ownerToken });
    expect(await reopened.admitGoalGraphRun(goal.goal.id, input, 'admit')).toEqual({ ...accepted, replayed: true });
    expect((await reopened.revokeGoalGraphRun(accepted.run.id, { reason: 'Owner stop' }, 'revoke')).run.revokedAt).not.toBeNull();
  } finally {
    await app?.close();
    if (created) await admin.query(`DROP DATABASE ${name}`);
    await admin.end();
  }
});
