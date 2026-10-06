import { createServer } from 'node:http';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { expect, it } from 'vitest';
import type { EngineeringProfileConfiguration } from '../../contracts/src/engineering-profile.js';
import { FlowClient } from './index.js';

it('publishes and reads a bounded fixture engineering profile without reclassifying it as native capability', async () => {
  const configuration: EngineeringProfileConfiguration = {
    protocol: 'flow.engineering-profile.v1', harness: 'fixture', adapterVersion: 'engineering-1',
    purpose: 'engineering-fixture', recipe: 'calculator-v1',
    project: { id: 'project α', baseCommit: 'a'.repeat(40) },
    checker: { id: 'calculator-check', version: '1', baselineDigest: 'b'.repeat(64) },
    limits: { checkerTimeoutMs: 7000 },
  };
  const reference = { id: '00000000-0000-4000-8000-000000000001', runnerId: '00000000-0000-4000-8000-000000000002', configDigest: 'c'.repeat(64) };
  const profile = { reference, configuration, source: 'trusted-fixture-setup', availability: 'not-probed', createdAt: '2026-10-06T00:00:00.000Z' };
  const publication = { profile, replayed: true };
  const page = { protocol: 'flow.engineering-profile-catalog.v1', profiles: [profile], nextCursor: reference.id };
  const calls: { method: string; path: string; token: unknown; body: string }[] = [];
  const server = createServer(async (request, response) => {
    let body = ''; for await (const chunk of request) body += chunk;
    calls.push({ method: request.method!, path: request.url!, token: request.headers.authorization, body });
    const after = new URL(request.url!, 'http://127.0.0.1').searchParams.get('after');
    const conflict = after === 'conflict';
    response.writeHead(conflict ? 409 : 200, { 'content-type': 'application/json' });
    response.end(JSON.stringify(conflict ? { error: { code: 'profile_revoked', message: 'Revoked.' } }
      : after === 'wrong-purpose' ? { ...page, profiles: [{ ...profile, configuration: { ...configuration, purpose: 'native' } }] }
      : request.method === 'POST' ? publication : after ? { ...page, profiles: [], nextCursor: null } : page));
  }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const runner = new FlowClient({ baseUrl: url, token: 'synthetic-runner' });
  const owner = new FlowClient({ baseUrl: url, token: 'synthetic-owner' });
  try {
    expect(await runner.publishEngineeringProfile({ configuration })).toEqual(publication);
    expect(await owner.listEngineeringProfiles({ limit: 1 })).toEqual(page);
    expect(await owner.listEngineeringProfiles({ after: reference.id, limit: 1 })).toEqual({ ...page, profiles: [], nextCursor: null });
    await expect(owner.listEngineeringProfiles({ after: 'wrong-purpose' })).rejects.toThrow();
    await expect(owner.listEngineeringProfiles({ after: 'conflict' })).rejects.toMatchObject({ status: 409, code: 'profile_revoked' });
    await owner.listEngineeringProfiles({ after: 'a/b ?' });
    await expect(runner.publishEngineeringProfile({ configuration }, AbortSignal.abort())).rejects.toThrow();
    await expect(owner.listEngineeringProfiles({}, AbortSignal.abort())).rejects.toThrow();
    expect(calls).toEqual([
      { method: 'POST', path: '/api/runner/engineering-profile', token: 'Bearer synthetic-runner', body: JSON.stringify({ configuration }) },
      ...['?limit=1', `?after=${reference.id}&limit=1`, '?after=wrong-purpose', '?after=conflict', '?after=a%2Fb+%3F']
        .map(suffix => ({ method: 'GET', path: `/api/engineering-profiles${suffix}`, token: 'Bearer synthetic-owner', body: '' })),
    ]);
  } finally {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
