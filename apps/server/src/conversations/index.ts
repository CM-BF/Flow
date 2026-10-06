import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import type { PgBoss } from 'pg-boss';
import { readFile } from 'node:fs/promises';
import { conversationCreationSchema, conversationTurnSchema, conversationListQuerySchema, conversationTurnQuerySchema } from '../../../../packages/contracts/src/conversations.js';
import { idSchema } from '../../../../packages/contracts/src/tasks.js';
import { HttpError, transaction } from '../database.js';
import { admitTurn, createConversation } from './commands.js';
import { conversationList, conversationSnapshot, turnDetail, turnPage } from './queries.js';

export async function migrateConversations(pool: Pool): Promise<void> {
  await transaction(pool, async client => {
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended('flow-migrations',0))");
    if ((await client.query('SELECT version FROM flow.migrations WHERE version=7')).rowCount) return;
    await client.query(await readFile(new URL('../../../../packages/storage/migrations/007-conversations.sql', import.meta.url), 'utf8'));
    await client.query('INSERT INTO flow.migrations(version) VALUES(7)');
  });
}
function parse<T>(schema: { safeParse(value: unknown): { success: true; data: T } | { success: false } }, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new HttpError(400, 'invalid_conversation_request', 'Invalid conversation request.');
  return result.data;
}
export function registerConversationRoutes(app: FastifyInstance, pool: Pool, boss: PgBoss): void {
  app.post('/api/conversations', async (request, reply) => reply.code(201).send(await createConversation(pool, parse(conversationCreationSchema, request.body), String(request.headers['idempotency-key'] ?? ''))));
  app.post<{ Params: { id: string } }>('/api/conversations/:id/turns', async (request, reply) => reply.code(202).send(await admitTurn(pool, boss, parse(idSchema, request.params.id), parse(conversationTurnSchema, request.body), String(request.headers['idempotency-key'] ?? ''))));
  app.get('/api/conversations', request => {
    const query = parse(conversationListQuerySchema, request.query);
    return conversationList(pool, query.after, query.limit);
  });
  app.get<{ Params: { id: string } }>('/api/conversations/:id', request => conversationSnapshot(pool, parse(idSchema, request.params.id)));
  app.get<{ Params: { id: string } }>('/api/conversations/:id/turns', request => {
    const query = parse(conversationTurnQuerySchema, request.query);
    return turnPage(pool, parse(idSchema, request.params.id), query.after, query.limit);
  });
  app.get<{ Params: { id: string; turnId: string; detailId: string } }>('/api/conversations/:id/turns/:turnId/details/:detailId', request =>
    turnDetail(pool, parse(idSchema, request.params.id), parse(idSchema, request.params.turnId), parse(idSchema, request.params.detailId)));
}
