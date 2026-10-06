import { readFile } from 'node:fs/promises';
import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { steeringCommandSchema, steeringReceiptSchema, steeringPageSchema, steeringStateQuerySchema, steeringMailboxSchema, steeringProposalLookupSchema, steeringAdmissionQuerySchema } from '../../../../packages/contracts/src/active-steering.js';
import { steeringFinalizationSchema } from '../../../../packages/contracts/src/runner.js';
import { finalizeSteering, steeringMailbox, steeringProposalStatus } from './finalization.js';
import { HttpError, transaction } from '../database.js';
import { acceptSteering, recordReceipt } from './commands.js';
import { steeringAudit, steeringState, steeringText } from './queries.js';
import { steeringAdmission } from './admission.js';
export { sealForFinal } from './commands.js';
export async function migrateActiveSteering(pool: Pool): Promise<void> {
  await transaction(pool, async client => {
    await client.query("SET LOCAL lock_timeout='1s'; SET LOCAL statement_timeout='3s'");
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended('flow-migrations',0))");
    if ((await client.query('SELECT 1 FROM flow.migrations WHERE version=24')).rowCount) return;
    await client.query(await readFile(new URL('../../../../packages/storage/migrations/024-active-steering.sql', import.meta.url), 'utf8'));
    await client.query('INSERT INTO flow.migrations(version) VALUES(24)');
  });
}
function parse<T>(schema: { safeParse(value: unknown): { success: true; data: T } | { success: false } }, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new HttpError(400, 'steering_input', 'Invalid steering input.');
  return result.data;
}
export function registerActiveSteeringRoutes(app: FastifyInstance, pool: Pool, options: { acceptCommands?: boolean } = {}): void {
  app.get<{ Params: { id: string } }>('/api/tasks/:id/steering/admission', (request, reply) => {
    reply.header('Cache-Control', 'no-store');
    const query = parse(steeringAdmissionQuerySchema, request.query);
    return steeringAdmission(pool, request.params.id, options.acceptCommands === true, query.attemptId);
  });
  app.post<{ Params: { id: string } }>('/api/tasks/:id/steering', async (request, reply) => {
    if (!options.acceptCommands) throw new HttpError(409, 'steering_unsupported', 'Active steering intake is not enabled.');
    const key = request.headers['idempotency-key'];
    const result = await acceptSteering(pool, request.params.id, parse(steeringCommandSchema, request.body), typeof key === 'string' ? key : '');
    return reply.code(202).send(result);
  });
  app.post('/api/runner/steering/mailbox', request => steeringMailbox(pool, request.runnerId!, parse(steeringMailboxSchema, request.body)));
  app.post('/api/runner/steering/finalize', request => finalizeSteering(pool, request.runnerId!, parse(steeringFinalizationSchema, request.body)));
  app.post('/api/runner/steering/proposals/status', request => steeringProposalStatus(pool, request.runnerId!, parse(steeringProposalLookupSchema, request.body)));
  app.post('/api/runner/steering/receipts', request => recordReceipt(pool, request.runnerId!, parse(steeringReceiptSchema, request.body)));
  app.get<{ Params: { id: string } }>('/api/tasks/:id/steering', (request, reply) => {
    reply.header('Cache-Control', 'no-store');
    const query = parse(steeringStateQuerySchema, request.query);
    return steeringState(pool, request.params.id, query.after, query.limit, query.attemptId);
  });
  app.get<{ Params: { id: string } }>('/api/tasks/:id/steering/audit', (request, reply) => {
    reply.header('Cache-Control', 'no-store');
    const query = parse(steeringPageSchema, request.query);
    return steeringAudit(pool, request.params.id, query.after, query.limit);
  });
  app.get<{ Params: { id: string; commandId: string } }>('/api/tasks/:id/steering/:commandId/text', (request, reply) => {
    reply.header('Cache-Control', 'no-store');
    return steeringText(pool, request.params.id, request.params.commandId);
  });
}
