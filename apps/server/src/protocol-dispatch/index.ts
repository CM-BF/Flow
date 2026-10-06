import { readFile } from 'node:fs/promises';
import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { protocolPrepareSchema, protocolCommandSchema, protocolBindSchema, protocolUncertainSchema } from '@flow/contracts';
import { HttpError, transaction } from '../database.js';
import { prepare, begin, bind, uncertain, recover, protocolState } from './store.js';

export async function migrateProtocolDispatch(pool: Pool): Promise<void> {
  await transaction(pool, async client => {
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended('flow-migrations',0))");
    if ((await client.query('SELECT 1 FROM flow.migrations WHERE version=5')).rowCount) return;
    await client.query(await readFile(new URL('../../../../packages/storage/migrations/005-protocol-dispatch.sql', import.meta.url), 'utf8'));
  });
}
function parse<T>(schema: { safeParse(input: unknown): { success: true; data: T } | { success: false } }, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) throw new HttpError(400, 'invalid_protocol_request', 'Invalid protocol request.');
  return result.data;
}
export function registerProtocolDispatch(app: FastifyInstance, pool: Pool): void {
  app.get<{ Params: { id: string } }>('/api/tasks/:id/protocol', request => protocolState(pool, request.params.id));
  app.post('/api/runner/protocol/prepare', request => prepare(pool, request.runnerId!, parse(protocolPrepareSchema, request.body)));
  app.post('/api/runner/protocol/begin', request => begin(pool, request.runnerId!, parse(protocolCommandSchema, request.body)));
  app.post('/api/runner/protocol/bind', request => bind(pool, request.runnerId!, parse(protocolBindSchema, request.body)));
  app.post('/api/runner/protocol/cancel-start', request => begin(pool, request.runnerId!, parse(protocolCommandSchema, request.body), true));
  app.post('/api/runner/protocol/uncertain', request => uncertain(pool, request.runnerId!, parse(protocolUncertainSchema, request.body)));
  app.post('/api/runner/protocol/recover', request => {
    if (!request.body || typeof request.body !== 'object' || Array.isArray(request.body) || Object.keys(request.body).length) throw new HttpError(400, 'invalid_protocol_request', 'Recovery expects an empty object.');
    return recover(pool, request.runnerId!);
  });
}
