import { acceptsNativeConversations } from '../../../../packages/contracts/src/conversation-harness.js';
import { negotiatedAssistantStream, type ConversationReadOptions } from '../assistant-stream-compatibility/index.js';
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
    for (const [version, file] of [[7, '007-conversations.sql'], [35, '035-codex-conversations.sql']] as const) {
      if ((await client.query('SELECT version FROM flow.migrations WHERE version=$1', [version])).rowCount) continue;
      await client.query(await readFile(new URL(`../../../../packages/storage/migrations/${file}`, import.meta.url), 'utf8'));
      await client.query('INSERT INTO flow.migrations(version) VALUES($1)', [version]);
    }
  });
}
function parse<T>(schema: { safeParse(value: unknown): { success: true; data: T } | { success: false } }, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new HttpError(400, 'invalid_conversation_request', 'Invalid conversation request.');
  return result.data;
}
export function registerConversationRoutes(app: FastifyInstance, pool: Pool, boss: PgBoss, options: ConversationReadOptions = {}): void {
  // One gate covers direct reads, turns, queue and context routes, including replayed ACKs.
  app.addHook('preHandler', async (request, reply) => {
    if (request.url.split('?')[0]?.startsWith('/api/conversations')) reply.header('Cache-Control', 'no-store');
    if (acceptsNativeConversations(request.raw.rawHeaders)) return;
    const path = request.url.split('?')[0]!;
    if (path === '/api/conversations' && request.method === 'POST' && (request.body as { harness?: unknown } | null)?.harness === 'codex') {
      throw new HttpError(409, 'conversation_protocol_required', 'Codex conversations require the native conversation codec.');
    }
    const match = /^\/api\/conversations\/([^/]+)(?:\/|$)/.exec(path);
    if (match) {
      const id = parse(idSchema, decodeURIComponent(match[1]!));
      const result = await pool.query<{ harness: string }>('SELECT harness FROM flow.conversations WHERE id=$1', [id]);
      if (result.rows[0]?.harness === 'codex') throw new HttpError(409, 'conversation_protocol_required', 'Codex conversations require the native conversation codec.');
    }
  });
  app.post('/api/conversations', async (request, reply) => reply.code(201).send(await createConversation(pool, parse(conversationCreationSchema, request.body), String(request.headers['idempotency-key'] ?? ''))));
  app.post<{ Params: { id: string } }>('/api/conversations/:id/turns', async (request, reply) => reply.code(202).send(await admitTurn(pool, boss, parse(idSchema, request.params.id), parse(conversationTurnSchema, request.body), String(request.headers['idempotency-key'] ?? ''))));
  app.get('/api/conversations', request => {
    const query = parse(conversationListQuerySchema, request.query);
    return conversationList(pool, query.after, query.limit, acceptsNativeConversations(request.raw.rawHeaders));
  });
  app.get<{ Params: { id: string } }>('/api/conversations/:id', async (request, reply) => {
    reply.header('Cache-Control', 'no-store');
    const snapshot = await conversationSnapshot(pool, parse(idSchema, request.params.id));
    const liveAssistantText = await negotiatedAssistantStream(app, pool, request.raw.rawHeaders, options);
    return { ...snapshot, capabilities: { ...snapshot.capabilities, liveAssistantText } };
  });
  app.get<{ Params: { id: string } }>('/api/conversations/:id/turns', request => {
    const query = parse(conversationTurnQuerySchema, request.query);
    return turnPage(pool, parse(idSchema, request.params.id), query.after, query.limit);
  });
  app.get<{ Params: { id: string; turnId: string; detailId: string } }>('/api/conversations/:id/turns/:turnId/details/:detailId', request =>
    turnDetail(pool, parse(idSchema, request.params.id), parse(idSchema, request.params.turnId), parse(idSchema, request.params.detailId)));
}
