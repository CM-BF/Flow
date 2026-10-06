import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { expect, it } from 'vitest';
import { goalProgressionAuthorizationSchema, goalProgressionRevocationSchema } from '../../contracts/src/goal-progression.js';
import { FlowClient } from './index.js';

it('preserves finite owner authorization and immutable receipts without retrying refusal or abort', async () => {
  const received: { path: string; method: string; key?: string; body: unknown }[] = [];
  const authorization = goalProgressionAuthorizationSchema.parse({
    protocol: 'flow.goal-progression.v1', projectRevision: 3,
    nodes: [{ nodeId: randomUUID(), nodeVersion: 1, inputVersion: 2, previousExecutionId: null,
      executionProfile: { id: randomUUID(), runnerId: randomUUID(), configDigest: 'a'.repeat(64) }, externalDependencies: [] }],
    maxAdmissions: 1, intermediatePolicy: 'verified-artifact-within-this-authorization',
    expiresAt: '2026-10-07T00:00:00.000Z', reason: 'Authorize only this frozen input.',
  });
  const snapshot = { id: 'progression', state: 'active', acceptance: 'separate-owner-decision', admissions: 0 };
  const receipt = { progression: snapshot, replayed: true };
  const server = createServer(async (request, response) => {
    expect(request.headers.authorization).toBe('Bearer owner');
    let raw = ''; for await (const chunk of request) raw += chunk;
    const body: unknown = raw ? JSON.parse(raw) : null;
    received.push({ path: request.url!, method: request.method!, key: request.headers['idempotency-key'] as string | undefined, body });
    if (request.method === 'POST') expect((request.url!.endsWith('/revoke') ? goalProgressionRevocationSchema : goalProgressionAuthorizationSchema).safeParse(body).success).toBe(true);
    const conflict = request.headers['idempotency-key'] === 'stale';
    response.writeHead(conflict ? 409 : request.method === 'POST' ? 201 : 200, { 'content-type': 'application/json' });
    response.end(JSON.stringify(conflict ? { error: { code: 'progression_input_changed', message: 'Input changed.' } } : request.method === 'POST' ? receipt : snapshot));
  }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const client = new FlowClient({ baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, token: 'owner' });
  try {
    expect(await client.authorizeGoalProgression('goal/目标', authorization, 'fixed-key')).toEqual(receipt);
    expect(await client.goalProgression('goal/目标', 'run/甲')).toEqual(snapshot);
    expect(await client.revokeGoalProgression('goal/目标', 'run/甲', { reason: ' stop new admissions\n' }, 'revoke-key')).toEqual(receipt);
    await expect(client.authorizeGoalProgression('goal/目标', authorization, 'stale')).rejects.toMatchObject({ status: 409, code: 'progression_input_changed' });
    await expect(client.goalProgression('goal/目标', 'run/甲', AbortSignal.abort())).rejects.toThrow();
    const prefix = '/api/goals/goal%2F%E7%9B%AE%E6%A0%87/progressions';
    expect(received).toEqual([
      { path: prefix, method: 'POST', key: 'fixed-key', body: authorization },
      { path: prefix + '/run%2F%E7%94%B2', method: 'GET', key: undefined, body: null },
      { path: prefix + '/run%2F%E7%94%B2/revoke', method: 'POST', key: 'revoke-key', body: { reason: ' stop new admissions\n' } },
      { path: prefix, method: 'POST', key: 'stale', body: authorization },
    ]);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});
