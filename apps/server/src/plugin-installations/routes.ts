import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { Pool } from 'pg';
import { z } from 'zod';
import { PLUGIN_INSTALL_LIMITS, pluginInstallRequestSchema, pluginInstallCommandSchema, type PluginInstallAudit } from '../../../../packages/contracts/src/plugin-installations.js';
import { HttpError, transaction } from '../database.js';
import { integerQuery } from '../queries.js';
import { admitInstall, commandInstall, runInstall, type PluginInstallHost } from './commands.js';
import { installView, loadInstall, readInstall, type InstallRecord } from './store.js';

function id(value: string): string {
  if (!z.uuid().safeParse(value).success) throw new HttpError(400, 'invalid_plugin_install_id', 'Invalid installation identity.');
  return value;
}
function bounded<T>(value: T): T {
  if (Buffer.byteLength(JSON.stringify(value)) > PLUGIN_INSTALL_LIMITS.responseBytes) throw new HttpError(413, 'plugin_install_response_limit', 'Material installation response exceeds its limit.');
  return value;
}
function page(query: { after?: string; limit?: string }, numeric = false) {
  const limit = integerQuery(query.limit, 20, PLUGIN_INSTALL_LIMITS.pageSize, 1);
  if (query.after !== undefined && (numeric ? !/^\d{1,15}$/.test(query.after) : !z.uuid().safeParse(query.after).success)) throw new HttpError(400, 'invalid_cursor', 'Invalid material installation cursor.');
  return { limit, after: query.after ?? null };
}
async function withinRequest<T>(request: FastifyRequest, reply: FastifyReply, host: PluginInstallHost, run: (local: PluginInstallHost) => Promise<T>): Promise<T> {
  const cancelled = new AbortController();
  const abort = () => cancelled.abort();
  const closed = () => { if (!reply.raw.writableFinished) abort(); };
  request.raw.once('aborted', abort); reply.raw.once('close', closed);
  if (request.raw.aborted) abort();
  try { return await run({ ...host, signal: AbortSignal.any([cancelled.signal, ...(host.signal ? [host.signal] : [])]) }); }
  finally { request.raw.removeListener('aborted', abort); reply.raw.removeListener('close', closed); }
}
/** Mount under the existing center owner-auth hook. Host roots/lifecycle evidence are never request fields. */
export function registerPluginInstallationRoutes(app: FastifyInstance, pool: Pool, host: PluginInstallHost): void {
  const closing = new AbortController();
  const localHost = { ...host, signal: AbortSignal.any([closing.signal, ...(host.signal ? [host.signal] : [])]) };
  app.addHook('preClose', async () => { closing.abort(); });
  app.post<{ Params: { id: string; versionId: string } }>('/api/plugins/:id/versions/:versionId/install', { bodyLimit: PLUGIN_INSTALL_LIMITS.bodyBytes }, async (request, reply) => {
    const input = pluginInstallRequestSchema.safeParse(request.body);
    if (!input.success) throw new HttpError(400, 'invalid_plugin_install', 'Invalid material installation request.');
    const accepted = await withinRequest(request, reply, localHost, async local => {
      const value = await admitInstall(pool, local, id(request.params.id), id(request.params.versionId), input.data, String(request.headers['idempotency-key'] ?? ''));
      if (!value.replayed) await runInstall(pool, local, value.operationId, 'start');
      return value;
    });
    return reply.header('cache-control', 'no-store').code(202).send(accepted);
  });
  app.post<{ Params: { id: string } }>('/api/plugin-installs/:id/commands', { bodyLimit: PLUGIN_INSTALL_LIMITS.bodyBytes }, async (request, reply) => {
    const input = pluginInstallCommandSchema.safeParse(request.body);
    if (!input.success) throw new HttpError(400, 'invalid_plugin_install_command', 'Invalid material installation command.');
    const accepted = await withinRequest(request, reply, localHost, async local => {
      const value = await commandInstall(pool, local, id(request.params.id), input.data, String(request.headers['idempotency-key'] ?? ''));
      if (!value.replayed) await runInstall(pool, local, value.operationId, input.data.action);
      return value;
    });
    return reply.header('cache-control', 'no-store').code(202).send(accepted);
  });
  app.get<{ Params: { id: string } }>('/api/plugin-installs/:id', async (request, reply) => {
    reply.header('cache-control', 'no-store');
    return bounded(await transaction(pool, client => readInstall(client, id(request.params.id)), true));
  });
  app.get<{ Params: { id: string }; Querystring: { after?: string; limit?: string } }>('/api/plugins/:id/material-installs', async (request, reply) => {
    const registrationId = id(request.params.id); const { limit, after } = page(request.query);
    reply.header('cache-control', 'no-store');
    return transaction(pool, async client => {
      if (!(await client.query('SELECT 1 FROM flow.plugin_installations WHERE id=$1', [registrationId])).rowCount) throw new HttpError(404, 'plugin_not_found', 'Plugin registration not found.');
      const rows = (await client.query<InstallRecord>('SELECT * FROM flow.plugin_material_installs WHERE registration_id=$1 AND ($2::text IS NULL OR id>$2) ORDER BY id LIMIT $3', [registrationId, after, limit + 1])).rows;
      const selected = rows.slice(0, limit);
      return bounded({ operations: selected.map(installView), nextCursor: rows.length > limit ? selected.at(-1)!.id : null });
    }, true);
  });
  app.get<{ Params: { id: string }; Querystring: { after?: string; limit?: string } }>('/api/plugin-installs/:id/history', async (request, reply) => {
    const operationId = id(request.params.id); const { limit, after } = page(request.query, true);
    reply.header('cache-control', 'no-store');
    return transaction(pool, async client => {
      await loadInstall(client, operationId);
      const rows = (await client.query<{ cursor: string; operation_id: string; kind: PluginInstallAudit['kind']; actor: PluginInstallAudit['actor']; reason: string | null; error: PluginInstallAudit['error']; created_at: Date }>('SELECT * FROM flow.plugin_material_install_audit WHERE operation_id=$1 AND cursor>$2 ORDER BY cursor LIMIT $3', [operationId, after ?? '0', limit + 1])).rows;
      const events: PluginInstallAudit[] = rows.slice(0, limit).map(row => ({ cursor: Number(row.cursor), operationId: row.operation_id, kind: row.kind, actor: row.actor, reason: row.reason, error: row.error, createdAt: row.created_at.toISOString() }));
      return bounded({ events, nextCursor: rows.length > limit ? String(events.at(-1)!.cursor) : null });
    }, true);
  });
}
