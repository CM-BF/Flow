import { createServer } from 'node:http';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { expect, it } from 'vitest';
import type { TaskUsageReadout, UsageQuantity } from '../../contracts/src/usage-readout.js';
import { FlowClient } from './index.js';

it('reads task usage without changing unknown quantities, source coverage or error semantics', async () => {
  const calls: string[] = [];
  const unknown: UsageQuantity = { value: null, knownSubtotal: 12, knownSamples: 1, unknownSamples: 1 };
  const overflow: UsageQuantity = { value: null, knownSubtotal: null, knownSamples: 2, unknownSamples: 0 };
  const breakdown = { uncachedInputTokens: unknown, cacheReadTokens: overflow, cacheWriteTokens: unknown, outputTokens: unknown, sdkEstimateUsd: unknown, providerActualUsd: unknown };
  const readout: TaskUsageReadout = { kind: 'task-usage-readout', version: 1, taskId: 'task/中文', legacy: { inputTokens: 12, outputTokens: null, costUsd: null, costKind: 'unknown', incomplete: true }, breakdown,
    coverage: { sampleLimit: 1000, samplesRead: 1000, authoritativeRead: 999, informationalRead: 1, hasMore: true, sourceLimit: 32, sourcesOmitted: 4 },
    sources: [{ source: 'claude-agent-sdk', model: 'observed-model', accounting: 'authoritative', samples: 2, producerVersion: null, inputMeaning: 'uncached', coverage: 'unverified', phaseAttribution: 'unavailable', reference: null, breakdown }],
    caveats: ['producer-version-unrecorded', 'bounded-prefix', 'sdk-estimate-not-billing'] };
  const server = createServer(async (request, response) => {
    expect(request.method).toBe('GET'); expect(request.headers.authorization).toBe('Bearer usage-test');
    expect(request.headers['idempotency-key']).toBeUndefined();
    const body: Buffer[] = []; for await (const chunk of request) body.push(Buffer.from(chunk)); expect(Buffer.concat(body).length).toBe(0);
    calls.push(request.url!); const status = /\/tasks\/(403|404|409)\//.exec(request.url!)?.[1];
    response.writeHead(status ? Number(status) : 200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    response.end(JSON.stringify(status ? { error: { code: 'usage_unavailable', message: 'Unavailable.' } } : readout));
  }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const client = new FlowClient({ baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, token: 'usage-test' });
  try {
    expect(await client.taskUsage('task/中文')).toEqual(readout);
    for (const status of [403, 404, 409]) await expect(client.taskUsage(String(status))).rejects.toMatchObject({ status, code: 'usage_unavailable' });
    await expect(client.taskUsage('task/中文', AbortSignal.abort())).rejects.toThrow();
    expect(calls).toEqual(['/api/tasks/task%2F%E4%B8%AD%E6%96%87/usage-readout', '/api/tasks/403/usage-readout', '/api/tasks/404/usage-readout', '/api/tasks/409/usage-readout']);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});
