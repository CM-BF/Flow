import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import type { Pool, PoolClient, QueryResult } from 'pg';
import { chunks } from './source/apps/server/src/knowledge/text.js';
import { searchSources } from './source/apps/server/src/knowledge/search.js';
import { counts, goldenCases, scaleSources, sourceId, type SourceSeed } from './corpus.js';
import { OwnedDatabase } from './owned-database.js';
import { timedQuery } from './diagnostic.js';
const digest = (text: string) => createHash('sha256').update(text).digest('hex');
export async function measure(database: OwnedDatabase, baseUrl: string, evidence: Record<string, unknown>) {
  const pool = database.auxiliary!;
  const executeQuery = (owner: Pool | PoolClient, text: string, values: unknown[] = []) => { database.requireWork(); return owner.query(text, values); };
  let httpCount = 0, httpBytes = 0, totalChunks = 0, totalRawBytes = 0;
  Object.assign(evidence, { seed: 'direct SQL with fixed production chunks/constraints; public write path NOT_TESTED', observations: [], http: [], seedCounts: [], backgroundSql: 'not instrumented; center/pg-boss share URL and remain enabled' });
  const observations = evidence.observations as unknown[], httpEvidence = evidence.http as unknown[], seedCounts = evidence.seedCounts as unknown[];
  async function http(path: string, body?: unknown, max = 49152) {
    database.requireWork(); if (++httpCount > 256) throw new Error('HTTP_BUDGET');
    const start = performance.now();
    const response = await fetch(baseUrl + path, { method: body === undefined ? 'GET' : 'POST', headers: { authorization: 'Bearer ' + database.marker, 'content-type': 'application/json', 'idempotency-key': randomUUID() },
      body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(Math.min(database.requireWork(), 1500)) });
    const reader = response.body!.getReader(); const buffers: Uint8Array[] = []; let size = 0;
    try { while (true) { const next = await reader.read(); if (next.done) break; size += next.value.byteLength; httpBytes += next.value.byteLength; if (size > max || httpBytes > 4 * 1024 * 1024) throw new Error('HTTP_BYTES'); buffers.push(next.value); } }
    finally { await reader.cancel(); reader.releaseLock(); }
    const text = Buffer.concat(buffers).toString('utf8');
    httpEvidence.push({ path, status: response.status, elapsedMs: performance.now() - start, bytes: size, digest: digest(text) });
    assert.equal(response.status, body === undefined || path.endsWith('/resolve') ? 200 : 201);
    return JSON.parse(text);
  }
  const project = async () => (await http('/api/projects', { workspaceId: 'personal', title: 'fixed query diagnostic' }, 65536)).snapshot.project.id as string;
  const search = (id: string, query: string, limit = 20) => http(`/api/projects/${id}/knowledge/search?q=${encodeURIComponent(query)}&limit=${limit}`);
  async function seed(projectId: string, sources: SourceSeed[]) {
    database.requireWork();
    const client = await pool.connect();
    try {
      await executeQuery(client, 'BEGIN');
      await executeQuery(client, `INSERT INTO flow.knowledge_sources(id,project_id,title,current_version)
        SELECT r.id,$1,r.title,r.current_version FROM jsonb_to_recordset($2) AS r(id uuid,title text,current_version integer)`, [projectId, JSON.stringify(sources.map(s => ({ id: s.id, title: s.title, current_version: s.versions.length })))]);
      for (const source of sources) for (const [index, text] of source.versions.entries()) {
        database.requireWork(); const version = index + 1;
        await executeQuery(client, 'INSERT INTO flow.knowledge_versions(source_id,version,content,content_digest) VALUES($1,$2,$3,$4)', [source.id, version, text, digest(text)]);
        await executeQuery(client, `INSERT INTO flow.knowledge_chunks(source_id,version,ordinal,start_byte,end_byte,content)
          SELECT $1,$2,c.ordinal,c.start,c.end,c.text FROM jsonb_to_recordset($3) AS c(ordinal integer,start integer,"end" integer,text text)`, [source.id, version, JSON.stringify(chunks(text))]);
      }
      await executeQuery(client, 'COMMIT');
    } catch (error) { try { await client.query('ROLLBACK'); } catch { /* Original seed failure remains primary. */ } throw error; } finally { client.release(); }
    const expected = counts(sources);
    const actual = (await executeQuery(pool, `SELECT count(DISTINCT s.id)::int AS sources,count(DISTINCT (v.source_id,v.version))::int AS versions,
      sum(CASE WHEN c.version=s.current_version THEN 1 ELSE 0 END)::int AS "currentChunks",sum(CASE WHEN c.version<>s.current_version THEN 1 ELSE 0 END)::int AS "historyChunks"
      FROM flow.knowledge_sources s JOIN flow.knowledge_versions v ON v.source_id=s.id JOIN flow.knowledge_chunks c ON c.source_id=v.source_id AND c.version=v.version WHERE s.project_id=$1`, [projectId])).rows[0];
    actual.rawBytes = Number((await executeQuery(pool, 'SELECT sum(v.byte_length) AS n FROM flow.knowledge_versions v JOIN flow.knowledge_sources s ON s.id=v.source_id WHERE s.project_id=$1', [projectId])).rows[0].n);
    assert.deepEqual(actual, expected); totalChunks += expected.currentChunks + expected.historyChunks; totalRawBytes += expected.rawBytes;
    assert.ok(totalChunks <= 1856 && totalRawBytes <= 5.5 * 1024 * 1024, 'seed aggregate budget'); seedCounts.push({ projectId, ...actual });
  }
  evidence.postgres = (await executeQuery(pool, "SELECT current_setting('server_version') AS version,current_setting('work_mem') AS work_mem,current_setting('enable_seqscan') AS enable_seqscan,current_setting('enable_bitmapscan') AS enable_bitmapscan")).rows;
  evidence.indexes = (await executeQuery(pool, "SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='flow' AND tablename IN ('knowledge_sources','knowledge_versions','knowledge_chunks') ORDER BY tablename,indexname")).rows;
  // Original twelve independent lexical vectors; returned locators are checked against known original bytes.
  for (const [i, sample] of goldenCases.entries()) {
    evidence.activeStep = 'gold:' + sample.label;
    const p = await project(), id = sourceId(i + 1); await seed(p, [{ id, title: sample.label, versions: [sample.text] }]);
    const found = await search(p, sample.query); assert.equal(found.hits.length, 1);
    const hit = found.hits[0]; assert.equal(hit.source.id, id); assert.equal(hit.matchKind, sample.kind);
    if (sample.kind === 'literal') assert.ok(hit.excerpt.text.includes(sample.query));
    assert.equal(hit.citation.contentDigest, digest(sample.text));
    assert.equal(Buffer.from(sample.text).subarray(hit.excerpt.locator.start, hit.excerpt.locator.end).toString('utf8'), hit.excerpt.text);
    const resolved = await http(`/api/projects/${p}/knowledge/resolve`, { citation: hit.citation });
    assert.equal(resolved.text, Buffer.from(sample.text).subarray(hit.citation.locator.start, hit.citation.locator.end).toString('utf8'));
    const fts = Number((await executeQuery(pool, `SELECT count(DISTINCT source_id) AS n FROM flow.knowledge_chunks WHERE source_id=$1 AND search_vector @@ plainto_tsquery('simple',$2)`, [id, sample.query])).rows[0].n);
    const completed = { kind: 'gold', label: sample.label, ftsOnlySourceCount: fts, combinedSourceCount: found.hits.length };
    observations.push(completed); await database.checkpoint('gold-completed', completed);
  }
  evidence.activeStep = 'semantic-boundaries';
  const p = await project(), foreign = await project();
  const semantics: SourceSeed[] = [{ id: sourceId(100), title: 'overlap', versions: ['needle '.repeat(2000)] },
    { id: sourceId(101), title: 'old', versions: ['oldonly', 'newonly'] },
    { id: sourceId(102), title: 'a', versions: ['alpha beta'] }, { id: sourceId(103), title: 'b', versions: ['alpha beta'] },
    { id: sourceId(104), title: 'fts', versions: ['alpha gap beta'] }];
  await seed(p, semantics); await seed(foreign, [{ id: sourceId(105), title: 'foreign', versions: ['foreignonly'] }]);
  assert.equal((await search(p, 'needle')).hits.length, 1);
  assert.deepEqual((await search(p, 'oldonly')).hits, []); assert.deepEqual((await search(p, 'foreignonly')).hits, []);
  const old = await http(`/api/projects/${p}/knowledge/resolve`, { citation: { projectId: p, sourceId: sourceId(101), version: 1, contentDigest: digest('oldonly'), locator: { kind: 'utf8-bytes', start: 0, end: 7 } } });
  assert.equal(old.text, 'oldonly'); assert.equal(old.currentVersion, 2); assert.equal(old.isCurrent, false);
  const ordered = await search(p, 'alpha beta'); assert.deepEqual(ordered.hits.map((hit: { source: { id: string } }) => hit.source.id), [102, 103, 104].map(sourceId));
  assert.deepEqual(ordered, await search(p, 'alpha beta')); assert.equal((await search(p, 'alpha beta', 1)).hasMore, true);
  const controls = await project(); await seed(controls, Array.from({ length: 21 }, (_, i) => ({ id: sourceId(200 + i), title: 'control ' + i, versions: ['\u0001'.repeat(4096)] })));
  const bounded = await search(controls, '\u0001'); assert.ok(bounded.hits.length > 0 && bounded.hits.length < 20); assert.equal(bounded.hasMore, true); assert.ok(!('total' in bounded));
  const semanticResult = { kind: 'semantics', assertions: 'project/current/old citation/one-source winner/stable order/hasMore/JSON budget' };
  observations.push(semanticResult); await database.checkpoint('semantics-completed', semanticResult);

  async function observedSearch(projectId: string, query: string) {
    const records: { text: string; values: unknown[]; clientEndToEndMs: number; clientSqlRoundTripMs?: number; observerBeforeQueryMs?: number; rows: number; decodedJsonBytes: number; error?: string }[] = [];
    const observingPool = new Proxy(pool, { get(target, property) {
      if (property === 'connect') return async () => {
        const client = await target.connect();
        return new Proxy(client, { get(c, key) {
          if (key === 'query') return async (text: string, values: unknown[] = []) => {
            const at = performance.now();
            try { const { value: result, ...timing } = await timedQuery(() => { database.requireWork(); }, () => c.query(text, values) as Promise<QueryResult>); records.push({ text, values, ...timing, rows: result.rowCount ?? 0, decodedJsonBytes: Buffer.byteLength(JSON.stringify(result.rows)) }); return result; }
            catch (error) { records.push({ text, values, clientEndToEndMs: performance.now() - at, rows: 0, decodedJsonBytes: 0, error: 'QUERY_FAILED' }); throw error; }
          };
          const value = Reflect.get(c, key); return typeof value === 'function' ? value.bind(c) : value;
        } }) as PoolClient;
      };
      const value = Reflect.get(target, property); return typeof value === 'function' ? value.bind(target) : value;
    } }) as Pool;
    evidence.lastProductionQueryRecords = records;
    const value = await searchSources(observingPool, projectId, query, 20);
    const sql = records.find(row => row.text.startsWith('WITH current_chunks AS MATERIALIZED'));
    assert.ok(sql, 'Production query capture missing');
    return { value, records, sql };
  }
  for (const size of [16, 128] as const) {
    evidence.activeStep = 'seed:' + size;
    const projectId = await project(), other = await project();
    await seed(projectId, scaleSources(size, size === 16 ? 1000 : 2000));
    await seed(other, scaleSources(16, size === 16 ? 4000 : 5000).map(s => ({ ...s, versions: [s.versions[1]!.replace('ready', 'other')] })));
    for (const table of ['knowledge_sources', 'knowledge_versions', 'knowledge_chunks']) await executeQuery(pool, 'ANALYZE flow.' + table);
    for (const query of ['知识', 'READY', '%value_\\', 'alpha beta', 'NO_SUCH_TOKEN_72931']) {
      evidence.activeStep = 'query:' + size + ':' + query;
      database.requireWork();
      const measured = await observedSearch(projectId, query);
      const publicResult = await search(projectId, query); assert.deepEqual(publicResult, measured.value);
      const explain = (await executeQuery(pool, 'EXPLAIN (ANALYZE, BUFFERS, VERBOSE, FORMAT JSON, TIMING OFF) ' + measured.sql.text, measured.sql.values)).rows;
      assert.ok(Buffer.byteLength(JSON.stringify(explain)) <= 65536, 'EXPLAIN cap');
      const samples = [];
      for (let i = 0; i < 3; i++) {
        database.requireWork(); const client = await pool.connect();
        try {
          await executeQuery(client, 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
          const { value: result, ...timing } = await timedQuery(() => { database.requireWork(); }, () => client.query(measured.sql.text, measured.sql.values));
          samples.push({ ...timing, rows: result.rows.length, decodedJsonBytes: Buffer.byteLength(JSON.stringify(result.rows)), decodedTextUtf8Bytes: result.rows.reduce((sum, row) => sum + Buffer.byteLength(row.content), 0) });
          await executeQuery(client, 'COMMIT');
        } catch (error) { try { await client.query('ROLLBACK'); } catch { /* Original query failure remains primary. */ } throw error; } finally { client.release(); }
      }
      const completed = { kind: 'scale', size, query, queryBytes: Buffer.byteLength(query), records: measured.records, explain, samples, timingMeaning: 'clientSqlRoundTrip excludes guard scans; clientEndToEnd includes guard; row sizing/checkpoint excluded; server execution only from EXPLAIN ANALYZE TIMING OFF', cacheState: 'unknown; no cache flush', sqlDigest: digest(measured.sql.text) };
      observations.push(completed); await database.checkpoint('scale-completed', completed);
    }
  }
  evidence.httpCount = httpCount; evidence.httpBytes = httpBytes; evidence.seedTotals = { totalChunks, totalRawBytes };
  evidence.databaseLogicalBytes = Number((await executeQuery(pool, 'SELECT pg_database_size(current_database()) AS n')).rows[0].n);
  assert.ok(Number(evidence.databaseLogicalBytes) <= 128 * 1024 * 1024);
  evidence.activeStep = 'complete'; await database.checkpoint('measurement-completed', { httpCount, httpBytes, seedTotals: evidence.seedTotals, databaseLogicalBytes: evidence.databaseLogicalBytes });
  return evidence;
}
