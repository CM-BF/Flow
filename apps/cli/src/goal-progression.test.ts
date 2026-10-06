import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { mkdtemp, writeFile, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { goalProgressionAuthorizationSchema, goalProgressionRevocationSchema, GOAL_PROGRESSION_MAX_BYTES } from '@flow/contracts';
import { runCli } from './index.js';

it('uses the owner progression contract and original key for authorize/read/revoke without automatic retry', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'flow-progression-cli-')), file = join(directory, 'input.json');
  const requests: { method: string; path: string; body: unknown; key: string | undefined }[] = [];
  let conflict = false;
  const server = createServer(async (req, res) => {
    let text = ''; for await (const chunk of req) text += chunk;
    const body = text ? JSON.parse(text) : null;
    expect(req.headers.authorization).toBe('Bearer synthetic-owner');
    if (req.method === 'POST') expect((req.url!.endsWith('/revoke') ? goalProgressionRevocationSchema : goalProgressionAuthorizationSchema).safeParse(body).success).toBe(true);
    requests.push({ method: req.method!, path: req.url!, body, key: req.headers['idempotency-key'] as string | undefined });
    res.writeHead(conflict ? 409 : 200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(conflict ? { error: { code: 'input_version', message: 'Input changed.' } } : { progression: { id: 'p-1', state: 'active' }, replayed: true }));
  }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const env = { FLOW_URL: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, FLOW_TOKEN: 'synthetic-owner' };
  const output: string[] = [], errors: string[] = [];
  const invoke = (args: string[], signal?: AbortSignal) => runCli(args, { out: s => output.push(s), err: s => errors.push(s) }, env, signal);
  const input = { protocol: 'flow.goal-progression.v1', projectRevision: 3,
    nodes: [{ nodeId: 'node-a', nodeVersion: 1, inputVersion: 2, previousExecutionId: null,
      executionProfile: { id: randomUUID(), runnerId: randomUUID(), configDigest: 'a'.repeat(64) }, externalDependencies: [] }],
    maxAdmissions: 1, intermediatePolicy: 'verified-artifact-within-this-authorization', expiresAt: '2026-10-07T00:00:00Z', reason: 'Owner authorizes 固定😀 input' };
  const args = ['goal', 'authorize-progress', 'goal/古', '--input', file, '--key', 'same-key'];
  try {
    await writeFile(file, JSON.stringify(input));
    expect(await invoke(args), errors.join()).toBe(0);
    expect(JSON.parse(output.at(-1)!)).toMatchObject({ replayed: true });
    expect(await invoke(['goal', 'progression', 'goal/古', 'progress/古'])).toBe(0);
    const reason = { reason: 'Stop later admissions; do not cancel running tasks.' };
    await writeFile(file, JSON.stringify(reason));
    const revoke = ['goal', 'revoke-progress', 'goal/古', 'progress/古', '--input', file, '--key', 'revoke-key'];
    expect(await invoke(revoke)).toBe(0);
    conflict = true; expect(await invoke(revoke)).toBe(3); expect(errors.at(-1)).toBe('Input changed.');
    expect(await invoke(revoke, AbortSignal.abort())).toBe(4);
    expect(await invoke(revoke.slice(0, -2))).toBe(2);
    await writeFile(file, JSON.stringify({ ...reason, cancel: true })); expect(await invoke(revoke)).toBe(2);
    await writeFile(file, ' '.repeat(GOAL_PROGRESSION_MAX_BYTES + 1)); expect(await invoke(args)).toBe(2);
    expect(requests).toEqual([
      { method: 'POST', path: '/api/goals/goal%2F%E5%8F%A4/progressions', body: input, key: 'same-key' },
      { method: 'GET', path: '/api/goals/goal%2F%E5%8F%A4/progressions/progress%2F%E5%8F%A4', body: null, key: undefined },
      ...Array.from({ length: 2 }, () => ({ method: 'POST', path: '/api/goals/goal%2F%E5%8F%A4/progressions/progress%2F%E5%8F%A4/revoke', body: reason, key: 'revoke-key' })),
    ]);
    expect(await invoke(['--help'])).toBe(0); expect(output.at(-1)).toContain('goal authorize-progress');
    expect(await readFile(new URL('../README.md', import.meta.url), 'utf8')).toContain('goal authorize-progress');
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); await rm(directory, { recursive: true }); }
});
