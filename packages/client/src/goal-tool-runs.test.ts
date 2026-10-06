import { createServer } from 'node:http';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { expect, it } from 'vitest';
import { FlowClient } from './index.js';

it('keeps host ownership and immutable grant identity on every runner request, without retries or role fallback', async () => {
  const seen: { path: string; token: string | undefined; body: unknown; key: string | undefined }[] = [];
  const server = createServer(async (request, response) => {
    let raw = ''; for await (const part of request) raw += part;
    const body = raw ? JSON.parse(raw) : null;
    seen.push({ path: request.url!, token: request.headers.authorization, body, key: request.headers['idempotency-key'] as string | undefined });
    const denied = body?.ownerVersion === 99;
    response.writeHead(denied ? 409 : 200, { 'content-type': 'application/json' });
    response.end(JSON.stringify(denied ? { error: { code: 'ownership_lost', message: 'Ownership lost.' } } : { replayed: true }));
  }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const owner = new FlowClient({ baseUrl, token: 'owner-only' });
  const runner = new FlowClient({ baseUrl, token: 'runner-only' });
  const ownership = { taskId: 'task-1', attemptId: 'attempt-1', ownerVersion: 4 };
  const input = { ...ownership, grant: { id: 'grant-1', version: 1 as const } };
  const command = { kind: 'define-input' as const, nodeId: 'node-1', expectedInputVersion: 0, reason: 'fixed input', input: { goal: 'read', constraints: 'fixed', acceptance: 'done', verification: { kind: 'contains' as const, expected: 'done' } } };
  try {
    await owner.admitGoalToolRun('goal/1', { prompt: 'Plan', execution: { harness: 'fixture' }, scope: { readScope: 'whole-goal', allowedNodeIds: ['node-1'], allowedCommands: ['define-input'], maxCommands: 1 } }, 'admit-once');
    await owner.goalToolRun('grant/1');
    await owner.revokeGoalToolRun('grant/1', { reason: 'stop' }, 'revoke-once');
    await owner.goalToolRunCalls('grant/1', { after: 0, limit: 5 });
    await runner.goalToolGrant(ownership);
    await runner.goalToolSnapshot(input);
    await runner.goalToolInput({ ...input, nodeId: 'node-1', version: 7 });
    await runner.goalToolCommand({ ...input, command }, 'stable-command');
    await expect(runner.goalToolGrant({ ...ownership, ownerVersion: 99 })).rejects.toMatchObject({ status: 409, code: 'ownership_lost' });
    expect(seen.map(r => r.path)).toEqual(['/api/goals/goal%2F1/tool-runs', '/api/goal-tool-runs/grant%2F1', '/api/goal-tool-runs/grant%2F1/revoke', '/api/goal-tool-runs/grant%2F1/calls?after=0&limit=5', '/api/runner/goal-tools/grant', '/api/runner/goal-tools/snapshot', '/api/runner/goal-tools/input', '/api/runner/goal-tools/command', '/api/runner/goal-tools/grant']);
    expect(seen.slice(0, 4).every(r => r.token === 'Bearer owner-only')).toBe(true);
    expect(seen.slice(4).every(r => r.token === 'Bearer runner-only')).toBe(true);
    expect(seen[6]?.body).toEqual({ ...input, nodeId: 'node-1', version: 7 });
    expect(seen[7]).toMatchObject({ body: { ...input, command }, key: 'stable-command' });
    await expect(runner.goalToolSnapshot(input, AbortSignal.abort())).rejects.toThrow();
    expect(seen).toHaveLength(9);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});
