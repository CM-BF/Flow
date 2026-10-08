import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { readFile } from 'node:fs/promises';
import { idSchema } from '../../../../packages/contracts/src/tasks.js';
import { knowledgeSearchSchema, knowledgeSourceIdSchema, knowledgeVersionNumberSchema, knowledgeCreateSchema, knowledgePublishSchema, knowledgeListSchema, knowledgeResolveSchema } from '../../../../packages/contracts/src/knowledge.js';
import { searchSources } from './search.js';
import { createSource, publishVersion, listSources, readVersion, resolveCitation } from './storage.js';
import { HttpError, transaction } from '../database.js';

/** Run after migration 4; shares the center migration lock. */
export async function migrateKnowledge(pool: Pool): Promise<void> {
  await transaction(pool, async client => {
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended('flow-migrations',0))");
    if ((await client.query('SELECT 1 FROM flow.migrations WHERE version=15')).rowCount) return;
    await client.query(await readFile(new URL('../../../../packages/storage/migrations/015-knowledge-sources.sql', import.meta.url), 'utf8'));
    await client.query('INSERT INTO flow.migrations(version) VALUES(15)');
  });
}
function parse<T>(schema: { safeParse(value: unknown): { success: true; data: T } | { success: false } }, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new HttpError(400, 'invalid_knowledge_request', 'Invalid knowledge request.');
  return result.data;
}
type ProjectParams = { projectId: string };
type SourceParams = ProjectParams & { sourceId: string };
/** Before ready/listen, inside the center owner-authenticated scope. Runner credentials receive 403. */
export function registerKnowledgeRoutes(app: FastifyInstance, pool: Pool): void {
  app.post<{ Params: ProjectParams }>('/api/projects/:projectId/knowledge/sources', async (request, reply) => reply.code(201).send(await createSource(pool, parse(idSchema, request.params.projectId), parse(knowledgeCreateSchema, request.body), String(request.headers['idempotency-key'] ?? ''))));
  app.get<{ Params: ProjectParams }>('/api/projects/:projectId/knowledge/sources', request => {
    const query = parse(knowledgeListSchema, request.query);
    return listSources(pool, parse(idSchema, request.params.projectId), query.limit, query.after);
  });
  app.get<{ Params: SourceParams }>('/api/projects/:projectId/knowledge/sources/:sourceId', request => readVersion(pool, parse(idSchema, request.params.projectId), parse(knowledgeSourceIdSchema, request.params.sourceId)));
  app.post<{ Params: SourceParams }>('/api/projects/:projectId/knowledge/sources/:sourceId/versions', async (request, reply) => reply.code(201).send(await publishVersion(pool, parse(idSchema, request.params.projectId), parse(knowledgeSourceIdSchema, request.params.sourceId), parse(knowledgePublishSchema, request.body), String(request.headers['idempotency-key'] ?? ''))));
  app.get<{ Params: SourceParams & { version: string } }>('/api/projects/:projectId/knowledge/sources/:sourceId/versions/:version', request => readVersion(pool, parse(idSchema, request.params.projectId), parse(knowledgeSourceIdSchema, request.params.sourceId), parse(knowledgeVersionNumberSchema, request.params.version)));
  app.get<{ Params: ProjectParams }>('/api/projects/:projectId/knowledge/search', request => {
    const query = parse(knowledgeSearchSchema, request.query);
    return searchSources(pool, parse(idSchema, request.params.projectId), query.q, query.limit);
  });
  app.post<{ Params: ProjectParams }>('/api/projects/:projectId/knowledge/resolve', request => resolveCitation(pool, parse(idSchema, request.params.projectId), parse(knowledgeResolveSchema, request.body).citation));
}
