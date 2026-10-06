import { createServer } from 'node:http';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { expect, it } from 'vitest';
import { FlowClient } from './index.js';

it('reads activity metadata and explicit detail with encoded IDs, pagination and owner/abort errors unchanged', async () => {
  const requests: string[] = [];
  const page = { activities: [{ id: 'activity/1', detail: { id: 'detail/1', title: 'Tool input' } }], nextCursor: 'activity/1' };
  const detail = { id: 'activity/1', body: { content: ' 中文😀\r\n ', truncated: false } };
  const server = createServer((request, response) => {
    expect(request.method).toBe('GET'); expect(request.headers.authorization).toBe('Bearer activity-owner');
    requests.push(request.url!);
    const denied = request.url!.includes('denied');
    response.writeHead(denied ? 403 : 200, { 'content-type': 'application/json' });
    response.end(JSON.stringify(denied ? { error: { code: 'wrong_role', message: 'Owner required.' } } : request.url!.startsWith('/api/tasks/') ? page : detail));
  }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const client = new FlowClient({ baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, token: 'activity-owner' });
  try {
    expect(await client.nativeActivities('task/1', { after: 'activity/0', limit: 1 })).toEqual(page);
    expect(await client.nativeActivity('activity/1')).toEqual(detail);
    await expect(client.nativeActivity('denied')).rejects.toMatchObject({ status: 403, code: 'wrong_role' });
    await expect(client.nativeActivities('task/1', {}, AbortSignal.abort())).rejects.toThrow();
    expect(requests).toEqual(['/api/tasks/task%2F1/native-activities?after=activity%2F0&limit=1', '/api/native-activities/activity%2F1', '/api/native-activities/denied']);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});
