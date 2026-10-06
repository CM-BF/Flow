import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { expect, it } from 'vitest';
import { goalNativeExecutionSchema } from '../../contracts/src/goal-native-executions.js';
import { FlowClient } from './index.js';

it('preserves owner native-node admission, fixed profile and key, and never retries a conflict or abort', async () => {
  const received: { path: string; key: string | undefined; body: unknown }[] = [];
  const executionProfile = { id: randomUUID(), runnerId: randomUUID(), configDigest: 'a'.repeat(64) };
  const receipt = { replayed: true, executionProfile, execution: { id: 'execution-1', taskId: 'task-1', state: 'running' } };
  const server = createServer(async (request, response) => {
    expect(request.method).toBe('POST');
    expect(request.headers.authorization).toBe('Bearer owner-token');
    let raw = ''; for await (const chunk of request) raw += chunk;
    const body = JSON.parse(raw);
    expect(goalNativeExecutionSchema.safeParse(body).success).toBe(true);
    received.push({ path: request.url!, key: request.headers['idempotency-key'] as string | undefined, body });
    response.writeHead(body.expectedInputVersion === 9 ? 409 : 201, { 'content-type': 'application/json' });
    response.end(JSON.stringify(body.expectedInputVersion === 9 ? { error: { code: 'stale_input', message: 'Input changed.' } } : receipt));
  }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const client = new FlowClient({ baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, token: 'owner-token' });
  const input = { nodeId: 'node/汉字', expectedInputVersion: 2, previousExecutionId: 'previous-1', reason: '  保留原请求\n', executionProfile,
    dependencies: [{ nodeId: 'dependency-1', executionId: 'dependency-execution', taskId: 'dependency-task', artifactId: 'artifact-1', artifactVersion: 'b'.repeat(64), detailId: 'detail-1' }] };
  try {
    expect(await client.executeGoalNative('goal/计划', input, 'native-once')).toEqual(receipt);
    await expect(client.executeGoalNative('goal/计划', { ...input, expectedInputVersion: 9 }, 'failed-key')).rejects.toMatchObject({ status: 409, code: 'stale_input' });
    await expect(client.executeGoalNative('goal/计划', input, 'aborted-key', AbortSignal.abort())).rejects.toThrow();
    expect(received).toEqual([
      { path: '/api/goals/goal%2F%E8%AE%A1%E5%88%92/native-executions', key: 'native-once', body: input },
      { path: '/api/goals/goal%2F%E8%AE%A1%E5%88%92/native-executions', key: 'failed-key', body: { ...input, expectedInputVersion: 9 } },
    ]);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});
