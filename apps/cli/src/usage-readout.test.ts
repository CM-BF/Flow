import { createServer } from 'node:http';
import { expect, it } from 'vitest';
import { runCli } from './index.js';

it('reads the common usage endpoint unchanged, with no mutation or retry', async () => {
  const calls: Array<{ path: string | undefined; method: string | undefined; token: string | undefined }> = [];
  const sample = { kind: 'task-usage-readout', version: 1, taskId: 'task /费用', legacy: { inputTokens: 4 },
    breakdown: { cacheReadTokens: { value: null, knownSubtotal: 1769, knownSamples: 1, unknownSamples: 1 } },
    coverage: { hasMore: true }, caveats: ['sdk-estimate-not-billing', 'bounded-prefix'] };
  let status = 200;
  const server = createServer((request, response) => {
    calls.push({ path: request.url, method: request.method, token: request.headers.authorization });
    response.writeHead(status, { 'content-type': 'application/json' });
    response.end(JSON.stringify(status === 200 ? sample : { error: { code: 'usage_unavailable', message: 'Read unavailable' } }));
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('Expected loopback');
  const out: string[] = [], err: string[] = [], io = { out: (s: string) => out.push(s), err: (s: string) => err.push(s) };
  const env = { FLOW_URL: `http://127.0.0.1:${address.port}`, FLOW_TOKEN: 'synthetic-usage-owner' };
  try {
    expect(await runCli(['usage', sample.taskId], io, env)).toBe(0);
    expect(JSON.parse(out[0]!)).toEqual(sample);
    expect(calls).toEqual([{ path: '/api/tasks/task%20%2F%E8%B4%B9%E7%94%A8/usage-readout', method: 'GET', token: 'Bearer synthetic-usage-owner' }]);
    status = 403; expect(await runCli(['usage', sample.taskId], io, env)).toBe(4); expect(calls).toHaveLength(2);
    status = 409; expect(await runCli(['usage', sample.taskId], io, env)).toBe(3); expect(calls).toHaveLength(3);
    expect(await runCli(['usage', sample.taskId], io, env, AbortSignal.abort())).toBe(4); expect(calls).toHaveLength(3);
    expect(await runCli(['usage'], io, env)).toBe(2); expect(calls).toHaveLength(3);
    expect(await runCli(['--help'], io, {})).toBe(0); expect(out.at(-1)).toContain('usage <task-id>'); expect(calls).toHaveLength(3);
    expect(out.join('\n') + err.join('\n')).not.toContain(env.FLOW_TOKEN);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});
