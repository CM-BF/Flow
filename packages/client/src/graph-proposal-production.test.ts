import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { expect, it } from 'vitest';
import { createServer } from '../../../apps/server/src/index.js';
import { FlowClient } from './index.js';

it('serves owner graph proposal commands through the production center and public client', async () => {
  const name = `flow_graph_client_${randomUUID().replaceAll('-', '')}`;
  const admin = new Pool({ connectionString: 'postgresql://flow:flow-local-only@127.0.0.1:55432/postgres', max: 1 });
  let app: Awaited<ReturnType<typeof createServer>> | undefined;
  let created = false;
  try {
    await admin.query(`CREATE DATABASE ${name}`); created = true;
    app = await createServer({ databaseUrl: `postgresql://flow:flow-local-only@127.0.0.1:55432/${name}`, ownerToken: 'graph-production-owner' });
    const url = await app.listen({ host: '127.0.0.1', port: 0 });
    const client = new FlowClient({ baseUrl: url, token: 'graph-production-owner' });
    const project = await client.createProject({ workspaceId: 'personal', title: 'Three-step proposal' }, 'project');
    const goal = await client.createGoal({ projectId: project.snapshot.project.id, originalGoal: '拆分发布说明', constraints: 'Do not execute', acceptance: 'Persistent graph' }, 'goal');
    const proposal = await client.createGoalGraphProposal(goal.goal.id, { expectedProjectRevision: 1, reason: 'Plan only', additions: [
      { key: 'draft', title: '起草', dependencies: [] },
      { key: 'check', title: '核对', dependencies: [{ kind: 'proposed', key: 'draft' }] },
      { key: 'deliver', title: '交付', dependencies: [{ kind: 'proposed', key: 'check' }] },
    ] }, 'proposal');
    expect((await client.goalGraphProposals(goal.goal.id)).proposals.map(item => item.id)).toEqual([proposal.proposal.id]);
    expect(await client.goalGraphProposal(proposal.proposal.id)).toEqual(proposal.proposal);
    const input = { expectedProjectRevision: 1, proposalDigest: proposal.proposal.proposalDigest };
    const applied = await client.applyGoalGraphProposal(proposal.proposal.id, input, 'apply');
    expect(applied.receipt.actor).toEqual({ kind: 'owner' });
    expect(Object.keys(applied.receipt.nodeIds).sort()).toEqual(['check', 'deliver', 'draft']);
    expect(await client.applyGoalGraphProposal(proposal.proposal.id, input, 'apply')).toEqual({ ...applied, replayed: true });
    const denied = new FlowClient({ baseUrl: url, token: 'wrong-owner' });
    await expect(denied.goalGraphProposal(proposal.proposal.id)).rejects.toMatchObject({ status: 401 });
  } finally {
    await app?.close();
    if (created) await admin.query(`DROP DATABASE ${name}`);
    await admin.end();
  }
});
