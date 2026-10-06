import { createServer } from 'node:http';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { expect, it } from 'vitest';
import { FlowClient } from './index.js';

it('preserves raw knowledge, immutable citations and optimistic versions across seven public methods', async () => {
  const calls: { path: string; body: unknown; key?: string }[] = [];
  const receipt = { citation: { version: 1 }, text: '旧原文🙂', isCurrent: false, currentVersion: 2 };
  const server = createServer(async (request, response) => {
    expect(request.headers.authorization).toBe('Bearer knowledge-owner');
    let raw = ''; for await (const chunk of request) raw += chunk;
    const body = raw ? JSON.parse(raw) : null;
    calls.push({ path: request.url!, body, key: request.headers['idempotency-key'] as string | undefined });
    const conflict = body?.expectedVersion === 9;
    response.writeHead(conflict ? 409 : 200, { 'content-type': 'application/json' });
    response.end(JSON.stringify(conflict ? { error: { code: 'knowledge_version_conflict', message: 'Changed' } } : receipt));
  }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const client = new FlowClient({ baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, token: 'knowledge-owner' });
  try {
    const creation = { expectedVersion: 0 as const, title: ' 中文 ', text: '原文\n100%_foo🙂' };
    expect(await client.createKnowledgeSource('project/1', creation, 'create-once')).toEqual(receipt);
    await client.knowledgeSources('project/1', { after: 'source/2', limit: 3 });
    await client.knowledgeSource('project/1', 'source/1');
    const publication = { expectedVersion: 1, text: '新原文\n' };
    await client.publishKnowledgeVersion('project/1', 'source/1', publication, 'publish-once');
    await client.knowledgeVersion('project/1', 'source/1', 1);
    await client.searchKnowledge('project/1', { q: '中文 %_path/x', limit: 2 });
    const citation = { projectId: 'project/1', sourceId: 'source/1', version: 1, contentDigest: 'a'.repeat(64), locator: { kind: 'utf8-bytes' as const, start: 0, end: 10 } };
    expect(await client.resolveKnowledge('project/1', citation)).toEqual(receipt);
    await expect(client.publishKnowledgeVersion('project/1', 'source/1', { ...publication, expectedVersion: 9 }, 'same-key')).rejects.toMatchObject({ status: 409, code: 'knowledge_version_conflict' });
    expect(calls.map(c => c.path)).toEqual(['/api/projects/project%2F1/knowledge/sources','/api/projects/project%2F1/knowledge/sources?after=source%2F2&limit=3','/api/projects/project%2F1/knowledge/sources/source%2F1','/api/projects/project%2F1/knowledge/sources/source%2F1/versions','/api/projects/project%2F1/knowledge/sources/source%2F1/versions/1','/api/projects/project%2F1/knowledge/search?q=%E4%B8%AD%E6%96%87+%25_path%2Fx&limit=2','/api/projects/project%2F1/knowledge/resolve','/api/projects/project%2F1/knowledge/sources/source%2F1/versions']);
    expect(calls[0]).toMatchObject({ body: creation, key: 'create-once' });
    expect(calls[3]).toMatchObject({ body: publication, key: 'publish-once' });
    expect(calls[6]!.body).toEqual({ citation });
    await expect(client.knowledgeSource('project/1', 'source/1', AbortSignal.abort())).rejects.toThrow();
    expect(calls).toHaveLength(8);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});
