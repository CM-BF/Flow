import { createServer } from 'node:http';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { mkdtemp, writeFile, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { goalNativeExecutionSchema } from '@flow/contracts';
import { runCli } from './index.js';

it('sends strict bounded owner native admission with a stable key and preserves failures without retry', async () => {
  const temporary = await mkdtemp(join(tmpdir(), 'flow-native-cli-'));
  const file = join(temporary, 'input.json');
  const requests: { path: string; body: unknown; key: string }[] = [];
  const server = createServer(async (req, res) => {
    let body = ''; for await (const chunk of req) body += chunk;
    const input = JSON.parse(body); expect(goalNativeExecutionSchema.safeParse(input).success).toBe(true);
    expect(req.method).toBe('POST'); expect(req.headers.authorization).toBe('Bearer synthetic-owner');
    requests.push({ path: req.url!, body: input, key: String(req.headers['idempotency-key']) });
    res.writeHead(input.expectedInputVersion === 2 ? 409 : 201, { 'content-type': 'application/json' });
    res.end(JSON.stringify(input.expectedInputVersion === 2 ? { error: { code: 'input_version', message: 'Input changed.' } } : { executionId: 'exec-1', task: { id: 'task-1', status: 'queued' }, replayed: true }));
  }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const env = { FLOW_TOKEN: 'synthetic-owner', FLOW_URL: `http://127.0.0.1:${(server.address() as AddressInfo).port}` };
  const output: string[] = [], errors: string[] = [];
  const invoke = (args: string[], signal?: AbortSignal) => runCli(args, { out: s => output.push(s), err: s => errors.push(s) }, env, signal);
  const input = { nodeId: 'node-a', expectedInputVersion: 1, dependencies: [], previousExecutionId: null, reason: 'Use the fixed note 古😀', executionProfile: { id: randomUUID(), runnerId: randomUUID(), configDigest: 'a'.repeat(64) } };
  const args = ['goal', 'execute-native', 'goal/古', '--input', file, '--key', 'same-key'];
  try {
    await writeFile(file, JSON.stringify(input));
    expect(await invoke(args), errors.join()).toBe(0); expect(JSON.parse(output[0]!)).toMatchObject({ replayed: true, task: { status: 'queued' } });
    await writeFile(file, JSON.stringify({ ...input, expectedInputVersion: 2 }));
    expect(await invoke(args)).toBe(3); expect(errors.at(-1)).toBe('Input changed.');
    expect(await invoke(args, AbortSignal.abort())).toBe(4);
    expect(await invoke(args.slice(0, -2))).toBe(2);
    await writeFile(file, JSON.stringify({ ...input, prompt: 'Cannot bypass frozen input' }));
    expect(await invoke(args)).toBe(2);
    await writeFile(file, ' '.repeat(131_073)); expect(await invoke(args)).toBe(2);
    expect(requests).toEqual([
      { path: '/api/goals/goal%2F%E5%8F%A4/native-executions', body: input, key: 'same-key' },
      { path: '/api/goals/goal%2F%E5%8F%A4/native-executions', body: { ...input, expectedInputVersion: 2 }, key: 'same-key' },
    ]);
    expect(await invoke(['--help'])).toBe(0);
    expect(output.at(-1)).toContain('goal execute-native <goal-id> --input JSON-file --key stable-key');
    expect(await readFile(new URL('../README.md', import.meta.url), 'utf8')).toContain('goal execute-native');
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); await rm(temporary, { recursive: true, force: true }); }
});
