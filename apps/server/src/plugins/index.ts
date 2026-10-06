import { readFile } from 'node:fs/promises';
import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { MAX_PLUGIN_REQUEST_BYTES, pluginRegistrationSchema } from '../../../../packages/contracts/src/plugins.js';
import { HttpError, transaction } from '../database.js';
import { integerQuery } from '../queries.js';
import { registerPlugin } from './commands.js';
import { readSnapshot } from './storage.js';

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
    return reply.code(201).send(await registerPlugin(pool, parsed.data, String(request.headers['idempotency-key'] ?? '')));
  });
  app.get<{ Params: { id: string }; Querystring: { revision?: string } }>('/api/plugins/:id', request =>
    transaction(pool, client => readSnapshot(client, request.params.id, request.query.revision === undefined ? undefined : integerQuery(request.query.revision, 1, 2_147_483_647, 1)), true));
}
