import { createServer } from 'node:http';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { expect, it } from 'vitest';
import { FlowClient } from './index.js';
import { ownershipSchema, goalGraphReadCallSchema, goalGraphDetailCallSchema, goalGraphCommandCallSchema } from '@flow/contracts';

it('preserves bounded graph authority, fixed versions, actor receipts and replay keys without retry or role fallback', async () => {
  const seen: { path: string; token: string | undefined; body: unknown; key: string | undefined }[] = [];
  const result = { replayed: true, baseRevision: 1, currentRevision: 8, stale: true, receipt: { actor: { kind: 'goal-graph-run', runnerId: 'actual-runner' } } };
  const server = createServer(async (request, response) => {
    let raw = ''; for await (const part of request) raw += part;
    const body = raw ? JSON.parse(raw) : null;
    seen.push({ path: request.url!, token: request.headers.authorization, body, key: request.headers['idempotency-key'] as string | undefined });
    const schema = ({ '/api/runner/goal-graph/grant': ownershipSchema, '/api/runner/goal-graph/read': goalGraphReadCallSchema, '/api/runner/goal-graph/proposal': goalGraphDetailCallSchema, '/api/runner/goal-graph/command': goalGraphCommandCallSchema } as const)[request.url as '/api/runner/goal-graph/grant'];
    const invalid = schema && !schema.safeParse(body).success;
    if (invalid) { response.writeHead(400, { 'content-type': 'application/json' }); response.end(JSON.stringify({ error: { code: 'invalid_request', message: 'Schema rejected.' } })); return; }
    const denied = body?.ownerVersion === 99;
    response.writeHead(denied ? 409 : 200, { 'content-type': 'application/json' });
    response.end(JSON.stringify(denied ? { error: { code: 'ownership_lost', message: 'Ownership lost.' } } : result));
  }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const owner = new FlowClient({ baseUrl, token: 'owner-only' });
  const runner = new FlowClient({ baseUrl, token: 'runner-only' });
  const ownership = { attemptId: 'attempt-1', ownerVersion: 4 };
  const input = { ...ownership, grant: { id: 'grant-1', version: 1 as const } };
  const proposal = { expectedProjectRevision: 1, reason: '  原文保留\n', additions: [{ key: 'draft', title: '中文🙂', dependencies: [{ kind: 'existing' as const, nodeId: 'node-A', expectedVersion: 3 }] }] };
  try {
    await owner.admitGoalGraphRun('goal/1', { prompt: 'Plan', execution: { harness: 'fixture' }, scope: { baseRevision: 1, allowedExistingNodes: [{ nodeId: 'node-A', expectedVersion: 3 }], maxProposals: 1, maxApplications: 1, maxNewNodes: 3, maxNewEdges: 2 } }, 'admit-once');
    await owner.goalGraphRun('grant/1');
    await owner.revokeGoalGraphRun('grant/1', { reason: 'stop' }, 'revoke-once');
    await owner.goalGraphRunCalls('grant/1', { after: 0, limit: 5 });
    await runner.goalGraphGrant(ownership);
    expect(await runner.goalGraphRead({ ...input, after: 'opaque+/=', limit: 5 })).toEqual(result);
    await runner.goalGraphDetail({ ...input, proposalId: 'proposal-1' });
    await runner.goalGraphCommand({ ...input, command: { kind: 'propose', proposal } }, 'stable-proposal');
    expect(await runner.goalGraphCommand({ ...input, command: { kind: 'apply', proposalId: 'proposal-1', expectedProjectRevision: 1, proposalDigest: 'a'.repeat(64) } }, 'stable-apply')).toEqual(result);
    await expect(runner.goalGraphGrant({ ...ownership, ownerVersion: 99 })).rejects.toMatchObject({ status: 409, code: 'ownership_lost' });
    expect(seen.map(r => r.path)).toEqual(['/api/goals/goal%2F1/graph-runs', '/api/goal-graph-runs/grant%2F1', '/api/goal-graph-runs/grant%2F1/revoke', '/api/goal-graph-runs/grant%2F1/calls?after=0&limit=5', '/api/runner/goal-graph/grant', '/api/runner/goal-graph/read', '/api/runner/goal-graph/proposal', '/api/runner/goal-graph/command', '/api/runner/goal-graph/command', '/api/runner/goal-graph/grant']);
    expect(seen.slice(0, 4).every(r => r.token === 'Bearer owner-only')).toBe(true);
    expect(seen.slice(4).every(r => r.token === 'Bearer runner-only')).toBe(true);
    expect(seen[5]?.body).toEqual({ ...input, after: 'opaque+/=', limit: 5 });
    expect(seen[7]).toMatchObject({ body: { ...input, command: { kind: 'propose', proposal } }, key: 'stable-proposal' });
    expect(seen[8]).toMatchObject({ key: 'stable-apply', body: { command: { expectedProjectRevision: 1, proposalDigest: 'a'.repeat(64) } } });
    await expect(runner.goalGraphRead({ ...input, limit: 5 }, AbortSignal.abort())).rejects.toThrow();
    expect(seen).toHaveLength(10);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});

it('lists goal-bound planning runs with opaque pagination and preserves errors and cancellation without retry', async () => {
  const seen: { method: string | undefined; path: string; token: string | undefined; bytes: number }[] = [];
  const page = { goalId: 'goal/中文', projectId: 'project-1', runs: [], nextCursor: 'next+/=' };
  const server = createServer(async (request, response) => {
    let bytes = 0; for await (const part of request) bytes += part.length;
    seen.push({ method: request.method, path: request.url!, token: request.headers.authorization, bytes });
    const denied = request.url?.includes('/denied/');
    response.writeHead(denied ? 403 : 200, { 'content-type': 'application/json' });
    response.end(JSON.stringify(denied ? { error: { code: 'wrong_role', message: 'Owner required.' } } : page));
  }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const client = new FlowClient({ baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, token: 'owner-only' });
  try {
    expect(await client.goalGraphRuns('goal/中文')).toEqual(page);
    expect(await client.goalGraphRuns('goal/中文', { after: 'opaque+/= 中文', limit: 20 })).toEqual(page);
    await expect(client.goalGraphRuns('denied')).rejects.toMatchObject({ status: 403, code: 'wrong_role' });
    await expect(client.goalGraphRuns('goal/中文', {}, AbortSignal.abort())).rejects.toThrow();
    expect(seen).toEqual([
      { method: 'GET', path: '/api/goals/goal%2F%E4%B8%AD%E6%96%87/graph-runs', token: 'Bearer owner-only', bytes: 0 },
      { method: 'GET', path: '/api/goals/goal%2F%E4%B8%AD%E6%96%87/graph-runs?after=opaque%2B%2F%3D+%E4%B8%AD%E6%96%87&limit=20', token: 'Bearer owner-only', bytes: 0 },
      { method: 'GET', path: '/api/goals/denied/graph-runs', token: 'Bearer owner-only', bytes: 0 },
    ]);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});
