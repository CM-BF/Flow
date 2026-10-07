import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { PACKAGE_FETCH_LIMITS, packageFetchRequestSchema, packageFetchCommandSchema, type PackageFetchAudit } from '../../../../packages/contracts/src/plugin-package-fetches.js';
import { HttpError, transaction } from '../database.js';
import { integerQuery } from '../queries.js';
import { commandFetch, admitFetch } from './commands.js';
import { currentAttempt, fetchSummary, loadFetch, readFetch, type FetchRecord } from './store.js';
import type { PackageFetchHost } from './host.js';

function bounded<T>(value: T): T {
  if (Buffer.byteLength(JSON.stringify(value)) > 65_536) throw new HttpError(413, 'package_fetch_response_limit', 'Package fetch response exceeds its byte limit.');
  return value;
}
function page(query: { after?: string; limit?: string }, numeric = false) {
  const limit = integerQuery(query.limit, 20, PACKAGE_FETCH_LIMITS.pageSize, 1);
  if (query.after !== undefined && !(numeric ? /^\d{1,15}$/.test(query.after) : /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(query.after))) throw new HttpError(400, 'invalid_cursor', 'Invalid package fetch cursor.');
  return { limit, after: query.after };
}
export function registerPackageFetchRoutes(app: FastifyInstance, pool: Pool, host: PackageFetchHost): void {
  app.post<{ Params: { id: string; versionId: string } }>('/api/plugins/:id/versions/:versionId/fetch', { bodyLimit: PACKAGE_FETCH_LIMITS.bodyBytes }, async (request, reply) => {
    const parsed = packageFetchRequestSchema.safeParse(request.body);
    if (!parsed.success) throw new HttpError(400, 'invalid_package_fetch', 'Invalid package fetch request.');
    return reply.code(202).send(await admitFetch(pool, host, request.params.id, request.params.versionId, parsed.data, String(request.headers['idempotency-key'] ?? '')));
  });
  app.get<{ Params: { id: string } }>('/api/package-fetches/:id', request => transaction(pool, client => readFetch(client, request.params.id), true).then(bounded));
  app.post<{ Params: { id: string } }>('/api/package-fetches/:id/commands', { bodyLimit: PACKAGE_FETCH_LIMITS.bodyBytes }, async (request, reply) => {
    const parsed = packageFetchCommandSchema.safeParse(request.body);
    if (!parsed.success) throw new HttpError(400, 'invalid_package_fetch_command', 'Invalid package fetch command.');
    return reply.code(202).send(await commandFetch(pool, host, request.params.id, parsed.data, String(request.headers['idempotency-key'] ?? '')));
  });
  app.get<{ Params: { id: string }; Querystring: { after?: string; limit?: string } }>('/api/plugins/:id/package-fetches', async request => {
    const { limit, after } = page(request.query);
    return transaction(pool, async client => {
      if (!(await client.query('SELECT 1 FROM flow.plugin_installations WHERE id=$1', [request.params.id])).rowCount) throw new HttpError(404, 'plugin_not_found', 'Plugin registration not found.');
      const rows = (await client.query<FetchRecord>('SELECT * FROM flow.plugin_package_fetches WHERE installation_id=$1 AND ($2::text IS NULL OR id>$2) ORDER BY id LIMIT $3', [request.params.id, after ?? null, limit + 1])).rows;
      const selected = rows.slice(0, limit);
      const operations = await Promise.all(selected.map(async row => fetchSummary(row, await currentAttempt(client, row))));
      return bounded({ operations, nextCursor: rows.length > limit ? selected.at(-1)!.id : null });
    }, true);
  });
  app.get<{ Params: { id: string }; Querystring: { after?: string; limit?: string } }>('/api/package-fetches/:id/history', async request => {
    const { limit, after } = page(request.query, true);
    return transaction(pool, async client => {
      await loadFetch(client, request.params.id);
      const rows = (await client.query<{ cursor: string; operation_id: string; attempt_id: string; kind: PackageFetchAudit['kind']; actor: PackageFetchAudit['actor']; reason: string | null; error: string | null; created_at: Date }>('SELECT * FROM flow.plugin_package_fetch_audit WHERE operation_id=$1 AND cursor>$2 ORDER BY cursor LIMIT $3', [request.params.id, after ?? '0', limit + 1])).rows;
      const events: PackageFetchAudit[] = rows.slice(0, limit).map(row => ({ cursor: Number(row.cursor), operationId: row.operation_id, attemptId: row.attempt_id, kind: row.kind, actor: row.actor, reason: row.reason, error: row.error, createdAt: row.created_at.toISOString() }));
      return bounded({ events, nextCursor: rows.length > limit ? String(events.at(-1)!.cursor) : null });
    }, true);
  });
}
