import { createServer } from 'node:http';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { expect, it } from 'vitest';
import { FlowClient } from './index.js';

it('preserves proposal scope, revision, digest, admission identity and bounded query without retrying conflict', async () => {
  const requests: { path: string; method: string; key?: string; body: unknown }[] = [];
  const receipt = { receipt: { proposalId: 'proposal/1', nodeIds: { first: 'real-node' }, actor: { kind: 'owner' } }, replayed: true, alreadyApplied: true };
  const server = createServer(async (request, response) => {
    expect(request.headers.authorization).toBe('Bearer graph-owner');
    let raw = ''; for await (const chunk of request) raw += chunk;
    const body = raw ? JSON.parse(raw) : null;
    requests.push({ path: request.url!, method: request.method!, key: request.headers['idempotency-key'] as string | undefined, body });
    const conflict = body?.expectedProjectRevision === 0;
    response.writeHead(conflict ? 409 : 200, { 'content-type': 'application/json' });
    response.end(JSON.stringify(conflict ? { error: { code: 'stale_project_revision', message: 'Revision has changed.' } } : receipt));
  }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const client = new FlowClient({ baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, token: 'graph-owner' });
  try {
    const input = { expectedProjectRevision: 7, reason: '  原文保留\n', additions: [{ key: 'first', title: '拆分目标', dependencies: [{ kind: 'existing' as const, nodeId: 'node-A', expectedVersion: 3 }] }] };
    expect(await client.createGoalGraphProposal('goal/1', input, 'proposal-once')).toEqual(receipt);
    await client.goalGraphProposals('goal/1', { after: 'cursor/1', limit: 5 });
    await client.goalGraphProposal('proposal/1');
    const apply = { expectedProjectRevision: 7, proposalDigest: 'a'.repeat(64) };
    expect(await client.applyGoalGraphProposal('proposal/1', apply, 'apply-once')).toEqual(receipt);
    await expect(client.applyGoalGraphProposal('proposal/1', { ...apply, expectedProjectRevision: 0 }, 'same-failed-key')).rejects.toMatchObject({ status: 409, code: 'stale_project_revision' });
    expect(requests.map(r => r.path)).toEqual(['/api/goals/goal%2F1/graph-proposals', '/api/goals/goal%2F1/graph-proposals?after=cursor%2F1&limit=5', '/api/goal-graph-proposals/proposal%2F1', '/api/goal-graph-proposals/proposal%2F1/apply', '/api/goal-graph-proposals/proposal%2F1/apply']);
    expect(requests[0]).toMatchObject({ method: 'POST', key: 'proposal-once', body: input });
    expect(requests[3]).toMatchObject({ method: 'POST', key: 'apply-once', body: apply });
    await expect(client.goalGraphProposal('proposal/1', AbortSignal.abort())).rejects.toThrow();
    expect(requests).toHaveLength(5);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});
