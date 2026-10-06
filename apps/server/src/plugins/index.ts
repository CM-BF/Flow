import { readFile } from 'node:fs/promises';
import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { idSchema } from '@flow/contracts';
import { MAX_PLUGIN_PAGE_SIZE, MAX_PLUGIN_REQUEST_BYTES, pluginCommandSchema, pluginRegistrationSchema, pluginScopeSchema } from '../../../../packages/contracts/src/plugins.js';
import { HttpError, transaction } from '../database.js';
import { integerQuery } from '../queries.js';
import { changePlugin, registerPlugin } from './commands.js';
import { readSnapshot } from './storage.js';
import { boundedResponse, listOperations, listPlugins, listVersions, readOperation } from './queries.js';

interface PageQuery { after?: string; limit?: string }
function pagination(query: PageQuery) {
  if (query.after !== undefined && !idSchema.safeParse(query.after).success) throw new HttpError(400, 'invalid_cursor', 'Invalid plugin cursor.');
  return { after: query.after, limit: integerQuery(query.limit, 20, MAX_PLUGIN_PAGE_SIZE, 1) };
}

export async function migratePlugins(pool: Pool): Promise<void> {
  await transaction(pool, async client => {
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended('flow-migrations',0))");
    if ((await client.query('SELECT 1 FROM flow.migrations WHERE version=8')).rowCount) return;
    await client.query(await readFile(new URL('../../../../packages/storage/migrations/008-plugins.sql', import.meta.url), 'utf8'));
    await client.query('INSERT INTO flow.migrations(version) VALUES(8)');
  });
}
export function registerPluginRoutes(app: FastifyInstance, pool: Pool): void {
  app.post('/api/plugins', { bodyLimit: MAX_PLUGIN_REQUEST_BYTES }, async (request, reply) => {
    const parsed = pluginRegistrationSchema.safeParse(request.body);
    if (!parsed.success) throw new HttpError(400, 'invalid_plugin', 'Invalid plugin registration.');
    return reply.code(201).send(boundedResponse(await registerPlugin(pool, parsed.data, String(request.headers['idempotency-key'] ?? ''))));
  });
  app.post<{ Params: { id: string } }>('/api/plugins/:id/commands', { bodyLimit: MAX_PLUGIN_REQUEST_BYTES }, request => {
    const parsed = pluginCommandSchema.safeParse(request.body);
    if (!parsed.success) throw new HttpError(400, 'invalid_plugin_command', 'Invalid plugin command.');
    return changePlugin(pool, request.params.id, parsed.data, String(request.headers['idempotency-key'] ?? '')).then(boundedResponse);
  });
  app.get<{ Querystring: PageQuery & { workspaceId?: string; projectId?: string } }>('/api/plugins', request => {
    const scope = pluginScopeSchema.safeParse({ workspaceId: request.query.workspaceId ?? 'personal', projectId: request.query.projectId ?? null });
    if (!scope.success) throw new HttpError(400, 'invalid_query', 'Invalid plugin scope.');
    const { limit, after } = pagination(request.query);
    return transaction(pool, client => listPlugins(client, scope.data, limit, after), true);
  });
  app.get<{ Params: { id: string }; Querystring: { revision?: string } }>('/api/plugins/:id', request =>
    transaction(pool, client => readSnapshot(client, request.params.id, request.query.revision === undefined ? undefined : integerQuery(request.query.revision, 1, 2_147_483_647, 1)), true).then(boundedResponse));
  app.get<{ Params: { id: string }; Querystring: PageQuery }>('/api/plugins/:id/versions', request => {
    const { limit, after } = pagination(request.query);
    return transaction(pool, client => listVersions(client, request.params.id, limit, after), true);
  });
  app.get<{ Params: { id: string }; Querystring: PageQuery }>('/api/plugins/:id/operations', request => {
    const { limit, after } = pagination(request.query);
    return transaction(pool, client => listOperations(client, request.params.id, limit, after), true);
  });
  app.get<{ Params: { id: string; operationId: string } }>('/api/plugins/:id/operations/:operationId', request =>
    transaction(pool, client => readOperation(client, request.params.id, request.params.operationId), true).then(boundedResponse));
}
