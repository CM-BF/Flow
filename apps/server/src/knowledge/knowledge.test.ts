import { afterAll, beforeAll, expect, test } from 'vitest';
import { createHash, randomUUID } from 'node:crypto';
import type { KnowledgeAccepted } from '../../../../packages/contracts/src/knowledge.js';
import { writeFile } from 'node:fs/promises';
import { startKnowledgeFixture } from './fixture.js';

let f: Awaited<ReturnType<typeof startKnowledgeFixture>>;
beforeAll(async () => { f = await startKnowledgeFixture(process.env.FLOW_K01_RUN_LABEL ?? 'knowledge'); });
const lexicalEvidence: unknown[] = [];
afterAll(async () => { try { if (lexicalEvidence.length) await writeFile('docs/evidence/k01/' + (process.env.FLOW_K01_RUN_LABEL ?? 'knowledge') + '-samples.json', JSON.stringify(lexicalEvidence, null, 2)); } finally { await f?.close(); } });
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

async function create(projectId: string, text: string, title = 'Manual source') {
  const response = await f.http(sourcePath(projectId), { expectedVersion: 0, title, text }); expect(response.status).toBe(201); return response.body;
}
async function search(projectId: string, query: string, limit = 20) { return f.http(`/api/projects/${projectId}/knowledge/search?q=${encodeURIComponent(query)}&limit=${limit}`); }
const citationFor = (accepted: KnowledgeAccepted, start: number, end: number) => ({ projectId: accepted.source.projectId, sourceId: accepted.source.id, version: accepted.version.version, contentDigest: accepted.version.contentDigest, locator: { kind: 'utf8-bytes', start, end } });

test('dropped ACK body replays original receipt after a newer version and same digest remains a new version', async () => {
  const p = await f.project(); const key = randomUUID(); const input = { expectedVersion: 0, title: 'Dropped response', text: 'same raw text' };
  expect(await f.discardReply(sourcePath(p), input, key)).toBe(201);
  const replay = await f.http(sourcePath(p), input, { key }); expect(replay.body.replayed).toBe(true);
  const a = replay.body; const newer = await f.http(`${sourcePath(p)}/${a.source.id}/versions`, { expectedVersion: 1, text: input.text });
  expect(newer.status).toBe(201); expect(newer.body.version.version).toBe(2); expect(newer.body.version.contentDigest).toBe(a.version.contentDigest);
  expect((await f.http(sourcePath(p), input, { key })).body).toEqual(a);
  expect((await f.http(`${sourcePath(p)}/${a.source.id}`)).body.source.currentVersion).toBe(2);
  const old = await f.http(`/api/projects/${p}/knowledge/resolve`, { citation: citationFor(a, 0, 13) });
  expect(old.body).toMatchObject({ text: 'same raw text', isCurrent: false, currentVersion: 2 });
  expect((await f.http(`${sourcePath(p)}/${a.source.id}/versions/1`)).body.isCurrent).toBe(false);
  expect((await f.http(sourcePath(p), { ...input, text: 'different' }, { key })).body.error.code).toBe('idempotency_conflict');
});

test('two publishing clients CAS once without lost version and publication ACK replay stays immutable', async () => {
  const p = await f.project(); const a = await create(p, 'version one'); const path = `${sourcePath(p)}/${a.source.id}/versions`;
  const key = randomUUID(); const [one, two] = await Promise.all([f.http(path, { expectedVersion: 1, text: 'version two' }, { key }), f.http(path, { expectedVersion: 1, text: 'competing' })]);
  expect([one.status, two.status].sort()).toEqual([201, 409]);
  const winner = one.status === 201 ? one : two; expect(winner.body.version.version).toBe(2);
  expect((await f.http(path, { expectedVersion: 2, text: 'version three' })).status).toBe(201);
  if (one.status === 201) expect((await f.http(path, { expectedVersion: 1, text: 'version two' }, { key })).body).toEqual({ ...one.body, replayed: true });
  const sameKey = randomUUID(); const input = { expectedVersion: 3, text: 'version four' };
  const twins = await Promise.all([f.http(path, input, { key: sameKey }), f.http(path, input, { key: sameKey })]);
  expect(twins.map(r => r.status)).toEqual([201, 201]); expect(twins.map(r => r.body.replayed).sort()).toEqual([false, true]);
  expect(twins[0]!.body.version).toEqual(twins[1]!.body.version);
});

test('chunk insert failure rolls back version/head/receipt and retry succeeds after fault removal', async () => {
  const p = await f.project(); const a = await create(p, 'stable'); const key = randomUUID(); const path = `${sourcePath(p)}/${a.source.id}/versions`; const input = { expectedVersion: 1, text: 'rollback_marker' };
  await f.pool.query(`CREATE FUNCTION flow.k01_fail_chunk() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.content='rollback_marker' THEN RAISE EXCEPTION 'fixture chunk failure'; END IF; RETURN NEW; END; $$;
    CREATE TRIGGER k01_fail_chunk BEFORE INSERT ON flow.knowledge_chunks FOR EACH ROW EXECUTE FUNCTION flow.k01_fail_chunk()`);
  try {
    expect((await f.http(path, input, { key })).status).toBe(500);
    expect((await f.http(`${sourcePath(p)}/${a.source.id}`)).body.source.currentVersion).toBe(1);
    expect((await f.http(`${sourcePath(p)}/${a.source.id}/versions/2`)).status).toBe(404);
    expect((await f.pool.query('SELECT 1 FROM flow.commands WHERE key=$1', [key])).rowCount).toBe(0);
  } finally { await f.pool.query('DROP TRIGGER k01_fail_chunk ON flow.knowledge_chunks; DROP FUNCTION flow.k01_fail_chunk()'); }
  const retry = await f.http(path, input, { key }); expect(retry.status).toBe(201); expect(retry.body.replayed).toBe(false);
  await expect(f.pool.query('UPDATE flow.knowledge_versions SET content=content WHERE source_id=$1', [a.source.id])).rejects.toMatchObject({ code: '23514' });
  await expect(f.pool.query('DELETE FROM flow.knowledge_versions WHERE source_id=$1', [a.source.id])).rejects.toMatchObject({ code: '23514' });
});

test('owner-only actual center preHandler protects every route and project scope precedes lookup', async () => {
  const p = await f.project(); const other = await f.project(); const a = await create(p, 'scoped'); const c = citationFor(a, 0, 6);
  const runner = await f.http('/api/runners', { name: 'K01 role fixture', harnesses: ['claude'], capacity: 1 }); expect(runner.status).toBe(200);
  const paths: [string, unknown?][] = [[sourcePath(p)], [sourcePath(p), { expectedVersion: 0, title: 'x', text: 'x' }], [`${sourcePath(p)}/${a.source.id}`], [`${sourcePath(p)}/${a.source.id}/versions`, { expectedVersion: 1, text: 'x' }], [`${sourcePath(p)}/${a.source.id}/versions/1`], [`/api/projects/${p}/knowledge/search?q=scoped`], [`/api/projects/${p}/knowledge/resolve`, { citation: c }]];
  for (const [path, body] of paths) expect((await f.http(path, body, { token: runner.body.token })).status).toBe(403);
  expect((await f.http(sourcePath(p), undefined, { token: 'not-a-token' })).status).toBe(401);
  expect((await f.http(`${sourcePath(other)}/${a.source.id}`)).status).toBe(404);
  expect((await f.http(`/api/projects/${other}/knowledge/resolve`, { citation: c })).status).toBe(404);
  expect((await f.http(`/api/projects/${other}/knowledge/resolve`, { citation: { ...c, projectId: other } })).status).toBe(404);
  expect((await search(other, 'scoped')).body.hits).toEqual([]);
});

test('citations reject wrong digest, missing version, and split UTF8 boundaries including empty ranges', async () => {
  const p = await f.project(); const a = await create(p, 'A😀中\r\n'); const c = citationFor(a, 0, 10); const path = `/api/projects/${p}/knowledge/resolve`;
  expect((await f.http(path, { citation: c })).body.text).toBe('A😀中\r\n');
  expect((await f.http(path, { citation: { ...c, contentDigest: '0'.repeat(64) } })).body.error.code).toBe('knowledge_digest_mismatch');
  expect((await f.http(path, { citation: { ...c, version: 2 } })).status).toBe(404);
  for (const [start, end] of [[2, 5], [1, 3], [2, 2], [0, 11]]) expect((await f.http(path, { citation: { ...c, locator: { kind: 'utf8-bytes', start, end } } })).body.error.code).toBe('knowledge_invalid_locator');
  expect((await f.http(path, { citation: { ...c, locator: { kind: 'utf8-bytes', start: 1, end: 5 } } })).body.text).toBe('😀');
  const empty = await create(p, ''); expect((await f.http(path, { citation: citationFor(empty, 0, 0) })).body.text).toBe('');
});

test.each(['bad\0text', '\ud800', '\udc00', 'a'.repeat(262145), '中'.repeat(87382)])('invalid raw text is rejected without creating a source (%#)', async text => {
  const p = await f.project(); expect((await f.http(sourcePath(p), { expectedVersion: 0, title: 'invalid', text })).status).toBe(400);
  expect((await f.http(sourcePath(p))).body.sources).toEqual([]);
});

test('raw normalization is preserved and query limits count actual UTF8 bytes', async () => {
  const p = await f.project(); const a = await create(p, 'e\u0301\r\né');
  expect((await f.http(`/api/projects/${p}/knowledge/resolve`, { citation: citationFor(a, 0, 7) })).body.text).toBe('e\u0301\r\né');
  for (const q of [' ', 'a'.repeat(257), '中'.repeat(86)]) expect((await search(p, q)).status).toBe(400);
  expect((await f.http(sourcePath(p), { expectedVersion: 0, title: 'no key', text: 'x' }, { key: '' })).status).toBe(400);
});

const lexicalCases = [
  ['中文两字', '系统提供知识检索能力', '知识'],
  ['中文连续句', '系统提供知识检索能力', '提供知识检索'],
  ['camelCase', 'createKnowledgeSource handles input', 'Knowledge'],
  ['path', '/src/knowledge/source_store.ts', 'source_store'],
  ['underscore', 'internal_name_v2', 'internal_name'],
  ['version', 'release v1.2.3 ready', '1.2.3'],
  ['literal-meta', 'literal exact%value_\\file end', '%value_\\'],
  ['query-syntax', 'raw & | ! ( ) : * tokens', '& | ! ( ) : *'],
  ['emoji', 'before😀after', '😀'],
  ['256-byte-cross-chunk', 'z'.repeat(3991) + '😀'.repeat(64) + 'tail', '😀'.repeat(64)],
  ['fts-multiple-words', 'alpha gap beta', 'alpha beta'],
  ['fts-case-fold', 'ready', 'READY'],
] as const;
test.each(lexicalCases)('lexical coverage %s', async (label, text, q) => {
  const p = await f.project(); const a = await create(p, text); const response = await search(p, q);
  expect(response.status).toBe(200); expect(response.body.hits).toHaveLength(1);
  const hit = response.body.hits[0]; expect(hit.source.id).toBe(a.source.id);
  if (label.startsWith('fts-')) expect(hit.matchKind).toBe('fts'); else { expect(hit.matchKind).toBe('literal'); expect(hit.excerpt.text).toContain(q); }
  const original = Buffer.from(text).subarray(hit.excerpt.locator.start, hit.excerpt.locator.end).toString('utf8'); expect(hit.excerpt.text).toBe(original);
  const fts = await f.pool.query(`SELECT count(DISTINCT s.id) AS count FROM flow.knowledge_sources s JOIN flow.knowledge_chunks c ON c.source_id=s.id AND c.version=s.current_version WHERE s.project_id=$1 AND c.search_vector @@ plainto_tsquery('simple',$2)`, [p, q]);
  lexicalEvidence.push({ label, queryUtf8Bytes: Buffer.byteLength(q), ftsOnlySourceCount: Number(fts.rows[0].count), combinedSourceCount: response.body.hits.length, matchKind: hit.matchKind, excerptUtf8Bytes: Buffer.byteLength(hit.excerpt.text), httpUtf8Bytes: response.httpUtf8Bytes, elapsedMs: response.elapsedMs });
});

test('metadata pagination is stable, overlap deduplicates, and current/project filters exclude old and foreign text', async () => {
  const p = await f.project(); const other = await f.project();
  const a = await create(p, 'needle '.repeat(2000), 'same name'); const b = await create(p, 'oldonly', 'same name'); await create(other, 'foreignonly', 'same name');
  await f.http(`${sourcePath(p)}/${b.source.id}/versions`, { expectedVersion: 1, text: 'newonly' });
  expect((await search(p, 'needle')).body.hits).toHaveLength(1);
  expect((await search(p, 'oldonly')).body.hits).toEqual([]); expect((await search(p, 'foreignonly')).body.hits).toEqual([]);
  expect((await search(p, 'newonly')).body.hits[0].source.id).toBe(b.source.id);
  const first = await f.http(sourcePath(p) + '?limit=1'); const second = await f.http(sourcePath(p) + '?limit=1&after=' + first.body.nextCursor);
  expect([first.body.sources[0].id, second.body.sources[0].id]).toEqual([a.source.id, b.source.id].sort()); expect(second.body.nextCursor).toBeNull();
  for (const source of [first.body.sources[0], second.body.sources[0]]) expect(Object.keys(source).sort()).toEqual(['createdAt', 'currentVersion', 'id', 'projectId', 'title', 'updatedAt']);
});

test('search JSON budget handles worst control escaping and hasMore reports budget truncation', async () => {
  const p = await f.project(); const text = '\u0001'.repeat(4096);
  for (let i = 0; i < 21; i++) await create(p, text, 'control ' + i);
  const response = await search(p, '\u0001'); expect(response.status).toBe(200);
  expect(response.httpUtf8Bytes).toBeLessThanOrEqual(49152); expect(response.body.hits.length).toBeGreaterThan(0); expect(response.body.hits.length).toBeLessThan(20); expect(response.body.hasMore).toBe(true);
  expect(response.body).not.toHaveProperty('total');
  for (const hit of response.body.hits) { expect(Buffer.byteLength(hit.excerpt.text)).toBe(512); expect(hit.citation.locator.end).toBe(4096); }
  const limited = await search(p, '\u0001', 1); expect(limited.body.hits).toHaveLength(1); expect(limited.body.hasMore).toBe(true);
  lexicalEvidence.push({ label: 'control-json-budget', hits: response.body.hits.length, httpUtf8Bytes: response.httpUtf8Bytes, hasMore: response.body.hasMore, elapsedMs: response.elapsedMs });
});

test('concurrent source count and retained-version caps reject overflow without deleting old citations', async () => {
  const p = await f.project();
  for (let i = 0; i < 127; i++) await create(p, '', 'capacity ' + i);
  const results = await Promise.all([f.http(sourcePath(p), { expectedVersion: 0, title: 'racer A', text: '' }), f.http(sourcePath(p), { expectedVersion: 0, title: 'racer B', text: '' })]);
  expect(results.map(r => r.status).sort()).toEqual([201, 409]);
  const a = results.find(r => r.status === 201)!.body; const path = `${sourcePath(p)}/${a.source.id}/versions`;
  for (let v = 1; v < 15; v++) expect((await f.http(path, { expectedVersion: v, text: 'version ' + (v + 1) })).status).toBe(201);
  const final = await Promise.all([f.http(path, { expectedVersion: 15, text: 'last A' }), f.http(path, { expectedVersion: 15, text: 'last B' })]);
  expect(final.map(r => r.status).sort()).toEqual([201, 409]);
  expect((await f.http(path, { expectedVersion: 16, text: 'overflow' })).body.error.code).toBe('knowledge_capacity');
  expect((await f.http(`/api/projects/${p}/knowledge/resolve`, { citation: citationFor(a, 0, 0) })).body).toMatchObject({ text: '', isCurrent: false, currentVersion: 16 });
});

test('project retained-byte cap is serialized across different sources', async () => {
  const p = await f.project(); const client = await f.pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`INSERT INTO flow.knowledge_sources(id,project_id,title,current_version) SELECT gen_random_uuid(),$1,'capacity seeded source',CASE WHEN n=16 THEN 15 ELSE 16 END FROM generate_series(1,16) n`, [p]);
    await client.query(`INSERT INTO flow.knowledge_versions(source_id,version,content,content_digest) SELECT s.id,v,repeat(chr(10),262144),encode(sha256(convert_to(repeat(chr(10),262144),'UTF8')),'hex') FROM flow.knowledge_sources s CROSS JOIN LATERAL generate_series(1,s.current_version) v WHERE s.project_id=$1`, [p]);
    await client.query(`INSERT INTO flow.knowledge_chunks(source_id,version,ordinal,start_byte,end_byte,content)
      SELECT v.source_id,v.version,n,n*3840,least(n*3840+4096,v.byte_length),substring(v.content FROM n*3840+1 FOR least(4096,v.byte_length-n*3840))
      FROM flow.knowledge_versions v JOIN flow.knowledge_sources s ON s.id=v.source_id CROSS JOIN generate_series(0,68) n WHERE s.project_id=$1`, [p]);
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  const text = '\n'.repeat(262144);
  const response = await Promise.all([f.http(sourcePath(p), { expectedVersion: 0, title: 'last A', text }), f.http(sourcePath(p), { expectedVersion: 0, title: 'last B', text })]);
  expect(response.map(r => r.status).sort()).toEqual([201, 409]);
  const loser = response.find(r => r.status === 409)!; expect(loser.body.error.code).toBe('knowledge_capacity');
  const bytes = await f.pool.query('SELECT sum(v.byte_length) AS bytes FROM flow.knowledge_versions v JOIN flow.knowledge_sources s ON s.id=v.source_id WHERE s.project_id=$1', [p]);
  expect(Number(bytes.rows[0].bytes)).toBe(67108864);
  lexicalEvidence.push({ label: 'concurrent-retained-byte-cap', retainedBytes: Number(bytes.rows[0].bytes), statuses: response.map(r => r.status), fixture: '255 real immutable versions plus 17595 derived chunks seeded in one transaction, then two HTTP writers' });
}, 30000);

test('Unicode chunks keep 256-byte overlap, complete boundaries and strictly advancing coverage at max body', async () => {
  const p = await f.project(); const text = '中😀a'.repeat(32768); // exactly 256KiB, independently counted 3+4+1 bytes.
  const a = await create(p, text); expect(a.version.byteLength).toBe(262144);
  const rows = (await f.pool.query('SELECT ordinal,start_byte,end_byte,content FROM flow.knowledge_chunks WHERE source_id=$1 AND version=1 ORDER BY ordinal', [a.source.id])).rows;
  expect(rows.length).toBeLessThanOrEqual(69); expect(rows[0].start_byte).toBe(0); expect(rows.at(-1).end_byte).toBe(262144);
  const original = Buffer.from(text);
  for (const [i, row] of rows.entries()) {
    expect(row.end_byte-row.start_byte).toBeLessThanOrEqual(4096);
    expect(new TextDecoder('utf-8', { fatal: true }).decode(original.subarray(row.start_byte,row.end_byte))).toBe(row.content);
    if (i) { expect(row.start_byte).toBeGreaterThan(rows[i-1].start_byte); expect(rows[i-1].end_byte-row.start_byte).toBeGreaterThanOrEqual(256); }
  }
  const c = citationFor(a, 0, 7); const wrongCase = { ...c, contentDigest: c.contentDigest.toUpperCase() };
  expect((await f.http(`/api/projects/${p}/knowledge/resolve`, { citation: wrongCase })).status).toBe(400);
});

test('stable per-source top-k prefers literal and keeps FTS preview limitations explicit', async () => {
  const p = await f.project(); const a = await create(p, 'alpha beta'); const b = await create(p, 'alpha beta');
  await create(p, 'alpha gap beta');
  const first = await search(p, 'alpha beta'); const second = await search(p, 'alpha beta');
  expect(first.body).toEqual(second.body); expect(first.body.hits.slice(0, 2).map((hit: { source: { id: string } }) => hit.source.id)).toEqual([a.source.id,b.source.id].sort());
  expect(first.body.hits.map((hit: { matchKind: string }) => hit.matchKind)).toEqual(['literal','literal','fts']); expect(first.body.hasMore).toBe(false);
  const far = await create(p, 'alpha ' + '.'.repeat(4500) + ' beta');
  expect((await search(p, 'alpha beta')).body.hits.some((hit: { source: { id: string } }) => hit.source.id === far.source.id)).toBe(false);
  const late = await create(p, '.'.repeat(1500) + ' alpha gap beta');
  const lateHit = (await search(p, 'alpha beta')).body.hits.find((hit: { source: { id: string } }) => hit.source.id === late.source.id);
  expect(lateHit.matchKind).toBe('fts'); expect(lateHit.excerpt.text).not.toContain('alpha');
  expect((await f.http(`/api/projects/${p}/knowledge/resolve`, { citation: lateHit.citation })).body.text).toContain('alpha gap beta');
});
