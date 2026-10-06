import type { Pool } from 'pg';
import { KNOWLEDGE_LIMITS as limits, type KnowledgeSearchHit, type KnowledgeSearchResult } from '../../../../packages/contracts/src/knowledge.js';
import { transaction } from '../database.js';
import { loadProject } from '../projects/storage.js';
import { sourceView, type SourceRow } from './storage.js';
import { boundaryBefore } from './text.js';

interface MatchRow extends SourceRow { ordinal: number; start_byte: number; end_byte: number; content: string; content_digest: string; literal: boolean; rank: number }
function searchHit(row: MatchRow, query: string): KnowledgeSearchHit {
  const bytes = Buffer.from(row.content); const queryBytes = Buffer.from(query);
  const index = row.literal ? bytes.indexOf(queryBytes) : 0;
  const start = boundaryBefore(bytes, Math.max(0, index - Math.floor((limits.excerptBytes - queryBytes.length) / 2)));
  const end = boundaryBefore(bytes, Math.min(bytes.length, start + limits.excerptBytes));
  return {
    source: sourceView(row),
    citation: { projectId: row.project_id, sourceId: row.id, version: row.current_version, contentDigest: row.content_digest, locator: { kind: 'utf8-bytes', start: row.start_byte, end: row.end_byte } },
    excerpt: { text: bytes.subarray(start, end).toString('utf8'), locator: { kind: 'utf8-bytes', start: row.start_byte + start, end: row.start_byte + end } },
    matchKind: row.literal ? 'literal' : 'fts', rank: row.rank,
  };
}
export async function searchSources(pool: Pool, projectId: string, query: string, limit: number): Promise<KnowledgeSearchResult> {
  return transaction(pool, async client => {
    await loadProject(client, projectId);
    // Materialize only this project's current chunks before matching and source-level top-k.
    const rows = (await client.query<MatchRow>(`WITH current_chunks AS MATERIALIZED (
      SELECT s.id,s.project_id,s.title,s.current_version,s.created_at,s.updated_at,
        v.content_digest,c.ordinal,c.start_byte,c.end_byte,c.content,c.search_vector
      FROM flow.knowledge_sources s JOIN flow.knowledge_versions v ON v.source_id=s.id AND v.version=s.current_version
      JOIN flow.knowledge_chunks c ON c.source_id=s.id AND c.version=s.current_version WHERE s.project_id=$1
    ), matched AS (
      SELECT *,strpos(content,$2)>0 AS literal,ts_rank(search_vector,plainto_tsquery('simple',$2)) AS rank
      FROM current_chunks WHERE strpos(content,$2)>0 OR search_vector @@ plainto_tsquery('simple',$2)
    ), best AS (
      SELECT *,row_number() OVER(PARTITION BY id ORDER BY literal DESC,rank DESC,ordinal) AS position FROM matched
    ) SELECT id,project_id,title,current_version,created_at,updated_at,content_digest,ordinal,start_byte,end_byte,content,literal,rank
      FROM best WHERE position=1 ORDER BY literal DESC,rank DESC,id,ordinal LIMIT $3`, [projectId, query, limit + 1])).rows;
    const result: KnowledgeSearchResult = { hits: [], hasMore: rows.length > limit };
    for (const row of rows.slice(0, limit)) {
      const hit = searchHit(row, query);
      // false is one JSON byte longer than true, so it gives the conservative serialized envelope.
      if (Buffer.byteLength(JSON.stringify({ hits: [...result.hits, hit], hasMore: false })) > limits.searchResponseBytes) { result.hasMore = true; break; }
      result.hits.push(hit);
    }
    return result;
  }, true);
}
