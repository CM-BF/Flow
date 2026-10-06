import { afterAll, beforeAll, expect, test } from 'vitest';
import { createHash, randomUUID } from 'node:crypto';
import { startKnowledgeFixture } from './fixture.js';

let f: Awaited<ReturnType<typeof startKnowledgeFixture>>;
beforeAll(async () => { f = await startKnowledgeFixture(process.env.FLOW_K01_RUN_LABEL ?? 'knowledge'); });
afterAll(async () => { await f?.close(); });
const sourcePath = (projectId: string) => `/api/projects/${projectId}/knowledge/sources`;
const hash = (text: string) => createHash('sha256').update(text).digest('hex');

test('owner creates exact text and resolves immutable UTF8 citation after restart', async () => {
  const projectId = await f.project(); const text = '原文\r\n\\path 😀'; const key = randomUUID();
  const accepted = await f.http(sourcePath(projectId), { expectedVersion: 0, title: 'Manual source', text }, { key });
  expect(accepted.status).toBe(201);
  expect(accepted.body.version.contentDigest).toBe(hash(text));
  const citation = { projectId, sourceId: accepted.body.source.id, version: 1, contentDigest: hash(text), locator: { kind: 'utf8-bytes', start: 0, end: Buffer.byteLength(text) } };
  await f.restart();
  const resolved = await f.http(`/api/projects/${projectId}/knowledge/resolve`, { citation });
  expect(resolved.status).toBe(200); expect(resolved.body).toEqual({ citation, text, isCurrent: true, currentVersion: 1 });
  expect((await f.http(sourcePath(projectId), { expectedVersion: 0, title: 'Manual source', text }, { key })).body).toEqual({ ...accepted.body, replayed: true });
});

test('search returns a bounded literal excerpt and resolves its full chunk', async () => {
  const projectId = await f.project();
  const text = 'z'.repeat(3990) + '中文连续句/path_v1.2.3\\item%_😀' + 'q'.repeat(1000);
  const created = await f.http(sourcePath(projectId), { expectedVersion: 0, title: 'Literal path', text });
  expect(created.status).toBe(201);
  const q = '中文连续句/path_v1.2.3\\item%_😀';
  const found = await f.http(`/api/projects/${projectId}/knowledge/search?q=${encodeURIComponent(q)}`);
  expect(found.status).toBe(200); expect(found.body.hits).toHaveLength(1);
  const hit = found.body.hits[0]; expect(hit.matchKind).toBe('literal'); expect(hit.excerpt.text).toContain(q);
  expect(Buffer.byteLength(hit.excerpt.text)).toBeLessThanOrEqual(512); expect(found.httpUtf8Bytes).toBeLessThanOrEqual(49152);
  const excerpt = await f.http(`/api/projects/${projectId}/knowledge/resolve`, { citation: { ...hit.citation, locator: hit.excerpt.locator } });
  expect(excerpt.body.text).toBe(hit.excerpt.text);
  const full = await f.http(`/api/projects/${projectId}/knowledge/resolve`, { citation: hit.citation });
  expect(full.body.text).toContain(q); expect(Buffer.byteLength(full.body.text)).toBeLessThanOrEqual(4096);
});
