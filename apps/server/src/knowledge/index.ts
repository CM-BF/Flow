import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { readFile } from 'node:fs/promises';
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
/** Before ready/listen, inside the center owner-authenticated scope. Runner credentials receive 403. */
export function registerKnowledgeRoutes(app: FastifyInstance, _pool: Pool): void {
  const pending = () => { throw new HttpError(501, 'knowledge_not_implemented', 'Knowledge implementation is pending.'); };
  app.post('/api/projects/:projectId/knowledge/sources', pending);
  app.get('/api/projects/:projectId/knowledge/sources', pending);
  app.get('/api/projects/:projectId/knowledge/sources/:sourceId', pending);
  app.post('/api/projects/:projectId/knowledge/sources/:sourceId/versions', pending);
  app.get('/api/projects/:projectId/knowledge/sources/:sourceId/versions/:version', pending);
  app.get('/api/projects/:projectId/knowledge/search', pending);
  app.post('/api/projects/:projectId/knowledge/resolve', pending);
}
