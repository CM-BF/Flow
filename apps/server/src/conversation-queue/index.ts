import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import type { PgBoss } from 'pg-boss';
import { readFile } from 'node:fs/promises';
import { conversationQueueEnqueueSchema, conversationQueueCancelSchema, conversationQueueQuerySchema, conversationQueuePauseSchema, conversationQueueResumeSchema } from '../../../../packages/contracts/src/conversation-queue.js';
import { idSchema } from '../../../../packages/contracts/src/tasks.js';
import { HttpError, transaction } from '../database.js';
import { enqueue, cancel } from './commands.js';
import { pause, resume } from './controls.js';
import { list, readItem } from './queries.js';
export { promoteReady, scanConversationQueue } from './promotion.js';

/** Call after migrations 7 and 10, before route registration or queue scanning. */
export async function migrateConversationQueue(pool: Pool): Promise<void> {
  await transaction(pool, async client => {
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended('flow-migrations',0))");
    if ((await client.query('SELECT version FROM flow.migrations WHERE version=11')).rowCount) return;
    await client.query(await readFile(new URL('../../../../packages/storage/migrations/011-conversation-queue.sql', import.meta.url), 'utf8'));
    await client.query('INSERT INTO flow.migrations(version) VALUES(11)');
  });
}
function parse<T>(schema: { safeParse(input: unknown): { success: true; data: T } | { success: false } }, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) throw new HttpError(400, 'invalid_conversation_queue_request', 'Invalid conversation queue request.');
  return result.data;
}
/** The enclosing center supplies owner authentication and its HttpError handler. */
export function registerConversationQueueRoutes(app: FastifyInstance, pool: Pool, boss: PgBoss): void {
  app.post<{ Params: { id: string } }>('/api/conversations/:id/queue/pause', request => pause(pool, parse(idSchema, request.params.id), parse(conversationQueuePauseSchema, request.body), String(request.headers['idempotency-key'] ?? '')));
  app.post<{ Params: { id: string } }>('/api/conversations/:id/queue/resume', async (request, reply) => reply.code(202).send(await resume(pool, boss, parse(idSchema, request.params.id), parse(conversationQueueResumeSchema, request.body), String(request.headers['idempotency-key'] ?? ''))));
  app.post<{ Params: { id: string } }>('/api/conversations/:id/queue', async (request, reply) => reply.code(202).send(await enqueue(pool, parse(idSchema, request.params.id), parse(conversationQueueEnqueueSchema, request.body), String(request.headers['idempotency-key'] ?? ''))));
  app.get<{ Params: { id: string } }>('/api/conversations/:id/queue', request => {
    const query = parse(conversationQueueQuerySchema, request.query);
    return list(pool, parse(idSchema, request.params.id), query.after, query.limit);
  });
  app.get<{ Params: { id: string; itemId: string } }>('/api/conversations/:id/queue/:itemId', request => readItem(pool, parse(idSchema, request.params.id), parse(idSchema, request.params.itemId)));
  app.post<{ Params: { id: string; itemId: string } }>('/api/conversations/:id/queue/:itemId/cancel', request => cancel(pool, parse(idSchema, request.params.id), parse(idSchema, request.params.itemId), parse(conversationQueueCancelSchema, request.body), String(request.headers['idempotency-key'] ?? '')));
}
