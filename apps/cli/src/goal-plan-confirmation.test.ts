import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { GOAL_PLAN_CONFIRMATION_MAX_BYTES, goalPlanConfirmationSchema } from '@flow/contracts';
import { runCli } from './index.js';

it('confirms a complete plan with bounded input and the original key without retry or implicit authority', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'flow-confirmation-cli-')), file = join(directory, 'input.json');
  const requests: { method: string; path: string; body: unknown; key: string | undefined; authorization: string | undefined }[] = [];
  let conflict = false;
  const receipt = { confirmation: { proposalId: 'proposal/古', progressionId: 'progression-1' }, progression: { state: 'active' }, alreadyConfirmed: true, replayed: true };
  const server = createServer(async (request, response) => {
    let text = ''; for await (const chunk of request) text += chunk;
    requests.push({ method: request.method!, path: request.url!, body: JSON.parse(text), key: request.headers['idempotency-key'] as string | undefined, authorization: request.headers.authorization });
    response.writeHead(conflict ? 409 : 200, { 'content-type': 'application/json' });
    response.end(JSON.stringify(conflict ? { error: { code: 'stale_project_revision', message: 'Refresh the graph.' } } : receipt));
  }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const env = { FLOW_URL: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, FLOW_TOKEN: 'synthetic-owner' };
  const output: string[] = [], errors: string[] = [];
  const invoke = (args: string[], signal?: AbortSignal) => runCli(args, { out: value => output.push(value), err: value => errors.push(value) }, env, signal);
  const input = { protocol: 'flow.goal-plan-confirmation.v1', proposalDigest: 'a'.repeat(64), expectedProjectRevision: 2,
    nodes: [{ key: 'A', executionProfile: { id: randomUUID(), runnerId: randomUUID(), configDigest: 'b'.repeat(64) }, externalDependencies: [] }],
    maxAdmissions: 1, intermediatePolicy: 'verified-artifact-within-this-authorization', expiresAt: '2026-10-07T00:00:00Z', reason: 'Owner confirms 固定😀 inputs' };
  const args = ['goal', 'plan', 'confirm-inputs', 'proposal/古', '--input', file, '--key', 'original-key'];
  try {
    expect(goalPlanConfirmationSchema.safeParse(input).success).toBe(true);
    await writeFile(file, JSON.stringify(input));
    expect(await invoke(args), errors.join()).toBe(0); expect(JSON.parse(output.at(-1)!)).toEqual(receipt);
    conflict = true; expect(await invoke(args)).toBe(3); expect(errors.at(-1)).toBe('Refresh the graph.');
    expect(await invoke(args, AbortSignal.abort())).toBe(4);
    expect(await invoke(args.slice(0, -2))).toBe(2);
    expect(await invoke(['goal', 'plan', 'unknown'])).toBe(2);
    await writeFile(file, JSON.stringify({ ...input, qualified: true })); expect(await invoke(args)).toBe(2);
    await writeFile(file, ' '.repeat(GOAL_PLAN_CONFIRMATION_MAX_BYTES + 1)); expect(await invoke(args)).toBe(2);
    expect(requests).toEqual(Array.from({ length: 2 }, () => ({ method: 'POST', path: '/api/goal-graph-proposals/proposal%2F%E5%8F%A4/confirm-inputs', body: input, key: 'original-key', authorization: 'Bearer synthetic-owner' })));
    expect(await invoke(['--help'])).toBe(0); expect(output.at(-1)).toContain('goal plan confirm-inputs');
    expect(await readFile(new URL('../README.md', import.meta.url), 'utf8')).toContain('goal plan confirm-inputs');
  } finally {
    server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve()));
    await rm(directory, { recursive: true });
  }
});
