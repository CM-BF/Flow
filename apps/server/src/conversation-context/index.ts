import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { readFile } from 'node:fs/promises';
import { HttpError, transaction } from '../database.js';

/** Call after migrations 7,11,15 and before registering routes or enabling queue processing. */
export async function migrateConversationContext(pool: Pool): Promise<void> {
  await transaction(pool, async client => {
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended('flow-migrations',0))");
    if ((await client.query('SELECT 1 FROM flow.migrations WHERE version=18')).rowCount) return;
    await client.query(await readFile(new URL('../../../../packages/storage/migrations/018-conversation-context.sql', import.meta.url), 'utf8'));
    await client.query('INSERT INTO flow.migrations(version) VALUES(18)');
  });
}
/** Uses the center's owner-only auth. The conversation and context IDs must both match. */
export function registerConversationContextRoutes(app: FastifyInstance, _pool: Pool): void {
  app.get('/api/conversations/:conversationId/contexts/:contextId', () => { throw new HttpError(501, 'conversation_context_not_implemented', 'Context detail implementation is pending.'); });
}
