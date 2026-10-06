import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { knowledgeCitationSchema, KNOWLEDGE_LIMITS as limits, type KnowledgeCreation, type KnowledgePublication, type KnowledgeSource, type KnowledgeVersion, type KnowledgeAccepted, type KnowledgeSourceList, type KnowledgeVersionSnapshot, type KnowledgeCitation, type KnowledgeResolved } from '../../../../packages/contracts/src/knowledge.js';
import { HttpError, sha256, transaction } from '../database.js';
import { loadProject } from '../projects/storage.js';
import { commandInTransaction } from '../tasks.js';
import { chunks } from './text.js';

export interface SourceRow { id: string; project_id: string; title: string; current_version: number; created_at: Date; updated_at: Date }
interface VersionRow { source_id: string; version: number; content_digest: string; byte_length: number; created_at: Date }
export function sourceView(row: SourceRow): KnowledgeSource {
  return { id: row.id, projectId: row.project_id, title: row.title, currentVersion: row.current_version, createdAt: row.created_at.toISOString(), updatedAt: row.updated_at.toISOString() };
}
function versionView(projectId: string, row: VersionRow): KnowledgeVersion {
  return { projectId, sourceId: row.source_id, version: row.version, contentDigest: row.content_digest, byteLength: row.byte_length, createdAt: row.created_at.toISOString() };
}
async function loadSource(client: PoolClient, projectId: string, sourceId: string, lock = false): Promise<SourceRow> {
  const row = (await client.query<SourceRow>(`SELECT id,project_id,title,current_version,created_at,updated_at FROM flow.knowledge_sources WHERE project_id=$1 AND id=$2${lock ? ' FOR UPDATE' : ''}`, [projectId, sourceId])).rows[0];
  if (!row) throw new HttpError(404, 'knowledge_source_not_found', 'Source not found in this project.');
  return row;
}
async function checkCapacity(client: PoolClient, projectId: string, bytes: number, creating: boolean): Promise<void> {
  // All writers hold the project row lock before this bounded aggregate and before source locks.
  const row = (await client.query<{ sources: string; bytes: string }>(`SELECT (SELECT count(*) FROM flow.knowledge_sources WHERE project_id=$1) AS sources,
    coalesce(sum(v.byte_length),0) AS bytes FROM flow.knowledge_sources s JOIN flow.knowledge_versions v ON v.source_id=s.id WHERE s.project_id=$1`, [projectId])).rows[0]!;
  if ((creating && Number(row.sources) >= limits.sourcesPerProject) || Number(row.bytes) + bytes > limits.retainedBytesPerProject) {
    throw new HttpError(409, 'knowledge_capacity', 'The project source or retained text capacity is reached.');
  }
}
async function insertVersion(client: PoolClient, sourceId: string, version: number, text: string): Promise<VersionRow> {
  const row = (await client.query<VersionRow>('INSERT INTO flow.knowledge_versions(source_id,version,content,content_digest) VALUES($1,$2,$3,$4) RETURNING source_id,version,content_digest,byte_length,created_at', [sourceId, version, text, sha256(text)])).rows[0]!;
  const values = chunks(text);
  await client.query(`INSERT INTO flow.knowledge_chunks(source_id,version,ordinal,start_byte,end_byte,content)
    SELECT $1,$2,c.ordinal,c.start,c.end,c.text FROM jsonb_to_recordset($3) AS c(ordinal integer,start integer,"end" integer,text text)`, [sourceId, version, JSON.stringify(values)]);
  return row;
}
export async function createSource(pool: Pool, projectId: string, input: KnowledgeCreation, key: string): Promise<KnowledgeAccepted> {
  return transaction(pool, async client => {
    await loadProject(client, projectId, true);
    const result = await commandInTransaction(client, `knowledge.create:${projectId}`, key, { projectId, ...input }, async () => {
      await checkCapacity(client, projectId, Buffer.byteLength(input.text), true);
      const id = randomUUID();
      await client.query('INSERT INTO flow.knowledge_sources(id,project_id,title,current_version) VALUES($1,$2,$3,1)', [id, projectId, input.title]);
      const version = await insertVersion(client, id, 1, input.text);
      return { source: sourceView(await loadSource(client, projectId, id)), version: versionView(projectId, version) };
    });
    return { ...result.value, replayed: result.replayed };
  });
}
export async function publishVersion(pool: Pool, projectId: string, sourceId: string, input: KnowledgePublication, key: string): Promise<KnowledgeAccepted> {
  return transaction(pool, async client => {
    await loadProject(client, projectId, true);
    const source = await loadSource(client, projectId, sourceId, true);
    const result = await commandInTransaction(client, `knowledge.publish:${projectId}:${sourceId}`, key, { projectId, sourceId, ...input }, async () => {
      if (source.current_version !== input.expectedVersion) throw new HttpError(409, 'knowledge_version_conflict', 'Read the current source version before publishing.');
      if (source.current_version >= limits.versionsPerSource) throw new HttpError(409, 'knowledge_capacity', 'The retained version capacity is reached; old references are preserved.');
      await checkCapacity(client, projectId, Buffer.byteLength(input.text), false);
      const version = await insertVersion(client, sourceId, source.current_version + 1, input.text);
      await client.query('UPDATE flow.knowledge_sources SET current_version=$2,updated_at=clock_timestamp() WHERE id=$1', [sourceId, version.version]);
      return { source: sourceView(await loadSource(client, projectId, sourceId)), version: versionView(projectId, version) };
    });
    return { ...result.value, replayed: result.replayed };
  });
}
export async function listSources(pool: Pool, projectId: string, limit: number, after?: string): Promise<KnowledgeSourceList> {
  return transaction(pool, async client => {
    await loadProject(client, projectId);
    const rows = (await client.query<SourceRow>('SELECT id,project_id,title,current_version,created_at,updated_at FROM flow.knowledge_sources WHERE project_id=$1 AND ($2::uuid IS NULL OR id>$2) ORDER BY id LIMIT $3', [projectId, after ?? null, limit + 1])).rows;
    return { sources: rows.slice(0, limit).map(sourceView), nextCursor: rows.length > limit ? rows[limit - 1]!.id : null };
  }, true);
}
export async function readVersion(pool: Pool, projectId: string, sourceId: string, version?: number): Promise<KnowledgeVersionSnapshot> {
  return transaction(pool, async client => {
    await loadProject(client, projectId);
    const source = await loadSource(client, projectId, sourceId);
    const row = (await client.query<VersionRow>('SELECT source_id,version,content_digest,byte_length,created_at FROM flow.knowledge_versions WHERE source_id=$1 AND version=$2', [sourceId, version ?? source.current_version])).rows[0];
    if (!row) throw new HttpError(404, 'knowledge_version_not_found', 'Source version not found.');
    return { source: sourceView(source), version: versionView(projectId, row), isCurrent: source.current_version === row.version };
  }, true);
}
/** Caller owns its transaction. One bounded SELECT observes all requested versions and heads together. */
export async function resolveCitationsInTransaction(client: PoolClient, projectId: string, citations: KnowledgeCitation[]): Promise<KnowledgeResolved[]> {
  if (citations.length > 4 || citations.some(citation => !knowledgeCitationSchema.safeParse(citation).success)) throw new HttpError(400, 'invalid_knowledge_request', 'At most four valid citations are required.');
  if (citations.some(citation => citation.projectId !== projectId)) throw new HttpError(404, 'knowledge_source_not_found', 'Citation belongs to another project.');
  await loadProject(client, projectId);
  const refs = citations.map((citation, ordinal) => ({ ordinal, source_id: citation.sourceId, version: citation.version, start: citation.locator.start, end: citation.locator.end }));
  const rows = (await client.query<{ ordinal: number; source_id: string | null; version: number | null; current_version: number; content_digest: string; byte_length: number; bytes: Buffer; start_byte: number | null; end_byte: number | null }>(`SELECT r.ordinal,s.id AS source_id,v.version,s.current_version,v.content_digest,v.byte_length,
    substring(convert_to(v.content,'UTF8') FROM r.start+1 FOR r.end-r.start) AS bytes,
    CASE WHEN r.start<v.byte_length THEN get_byte(convert_to(v.content,'UTF8'),r.start) END AS start_byte,
    CASE WHEN r.end<v.byte_length THEN get_byte(convert_to(v.content,'UTF8'),r.end) END AS end_byte
    FROM jsonb_to_recordset($2) AS r(ordinal integer,source_id uuid,version integer,start integer,"end" integer)
    LEFT JOIN flow.knowledge_sources s ON s.id=r.source_id AND s.project_id=$1
    LEFT JOIN flow.knowledge_versions v ON v.source_id=s.id AND v.version=r.version ORDER BY r.ordinal`, [projectId, JSON.stringify(refs)])).rows;
  return rows.map(row => {
    const citation = citations[row.ordinal]!;
    if (!row.source_id) throw new HttpError(404, 'knowledge_source_not_found', 'Source not found in this project.');
    if (row.version === null) throw new HttpError(404, 'knowledge_version_not_found', 'Source version not found.');
    if (row.content_digest !== citation.contentDigest) throw new HttpError(409, 'knowledge_digest_mismatch', 'The citation digest does not match this immutable version.');
    if (citation.locator.end > row.byte_length || [row.start_byte, row.end_byte].some(byte => byte !== null && (byte & 0xc0) === 0x80)) throw new HttpError(400, 'knowledge_invalid_locator', 'The byte range must be within the original text on UTF-8 boundaries.');
    return { citation, text: new TextDecoder('utf-8', { fatal: true }).decode(row.bytes), isCurrent: row.current_version === citation.version, currentVersion: row.current_version };
  });
}
export async function resolveCitation(pool: Pool, projectId: string, citation: KnowledgeCitation): Promise<KnowledgeResolved> {
  return transaction(pool, async client => (await resolveCitationsInTransaction(client, projectId, [citation]))[0]!, true);
}
