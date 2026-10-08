import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { readFile } from 'node:fs/promises';
import { idSchema } from '@flow/contracts';
import { HttpError, transaction } from '../database.js';
import { integerQuery } from '../queries.js';
import { assistantMessage, assistantMessages } from './store.js';
export { readAssistantFinal, readAssistantFinalPreview, readAssistantFinalPreviews, type AssistantFinalPreview, type AssistantFinalBinding, type AssistantFinalPreviewResult } from './store.js';

export async function migrateAssistantMessages(pool: Pool): Promise<void> {
  await transaction(pool, async client => {
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended('flow-migrations',0))");
    if ((await client.query('SELECT 1 FROM flow.migrations WHERE version=9')).rowCount) return;
    await client.query(await readFile(new URL('../../../../packages/storage/migrations/009-assistant-messages.sql', import.meta.url), 'utf8'));
    await client.query('INSERT INTO flow.migrations(version) VALUES(9)');
  });
}
export function registerAssistantRoutes(app: FastifyInstance, pool: Pool): void {
  app.get<{ Params: { id: string }; Querystring: { after?: string; limit?: string } }>('/api/tasks/:id/assistant-messages', request => {
    const { after, limit } = request.query;
    if (after !== undefined && !idSchema.safeParse(after).success) throw new HttpError(400, 'assistant_cursor', 'Invalid assistant message cursor.');
    return assistantMessages(pool, request.params.id, integerQuery(limit, 20, 100, 1), after);
  });
  app.get<{ Params: { id: string } }>('/api/assistant-messages/:id', request => assistantMessage(pool, request.params.id));
}
