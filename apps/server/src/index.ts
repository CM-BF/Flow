import { migrateConversations, registerConversationRoutes } from './conversations/index.js';
import { migrateAssistantMessages, registerAssistantRoutes } from './assistant/index.js';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { timingSafeEqual } from 'node:crypto';
import { Pool } from 'pg';
import { MAX_BATCH_BYTES, taskSubmissionSchema, registerRunnerSchema, ownershipSchema, eventBatchSchema, decisionSchema } from '@flow/contracts';
import { HttpError, migrate, sha256 } from './database.js';
import { list, snapshot, submit } from './tasks.js';
import { startScheduler } from './scheduler.js';
import { claim, expireLeases, heartbeat, registerRunner, revoke } from './runners.js';
import { reportEvents } from './events.js';
import { cancel, decide } from './commands.js';
import { detail, eventPage, integerQuery } from './queries.js';
import { registerStreams } from './streams.js';
import { migrateWorkspace, registerWorkspaceRoutes } from './m2-workspace.js';
import { registerTaskIndexRoutes } from './task-index.js';
import { registerReconciliation } from './reconciliation-http.js';
import { migrateProjects, registerProjectRoutes } from './projects/index.js';
import { migrateProtocolDispatch, registerProtocolDispatch } from './protocol-dispatch/index.js';

import { migrateGoals, registerGoalRoutes } from './goals/index.js';

declare module 'fastify' { interface FastifyRequest { runnerId: string | null } }

export interface ServerOptions { databaseUrl: string; ownerToken: string; leaseMs?: number; allowedOrigin?: string }
export async function createServer(options: ServerOptions) {
  if (!options.ownerToken) throw new Error('ownerToken is required.');
  const app = Fastify({ bodyLimit: MAX_BATCH_BYTES, logger: false });
  app.decorateRequest('runnerId', null);
  const leaseMs = options.leaseMs ?? 10_000;
  if (!Number.isSafeInteger(leaseMs) || leaseMs < 50 || leaseMs > 300_000) throw new Error('Invalid leaseMs.');
  if (options.allowedOrigin) await app.register(cors, { origin: options.allowedOrigin, methods: ['GET', 'POST', 'OPTIONS'] });
  const pool = new Pool({ connectionString: options.databaseUrl, max: 8, connectionTimeoutMillis: 5000, statement_timeout: 10_000 });
  pool.on('error', error => app.log.error(error));
  try { await migrate(pool); await migrateWorkspace(pool); await migrateProjects(pool); await migrateProtocolDispatch(pool); await migrateGoals(pool); } catch (error) { await pool.end(); throw error; }
  const boss = await startScheduler(options.databaseUrl, pool).catch(async error => { await pool.end(); throw error; });
  let pendingSweep: Promise<void> | undefined;
  const sweep = setInterval(() => {
    if (pendingSweep) return;
    pendingSweep = expireLeases(pool).then(async () => {
      await pool.query("UPDATE flow.tasks SET dispatch_ready=true WHERE id IN (SELECT id FROM flow.tasks WHERE status='queued' AND NOT dispatch_ready ORDER BY created_at LIMIT 100)");
    }).catch(error => app.log.error(error)).finally(() => { pendingSweep = undefined; });
  }, Math.min(1000, leaseMs));
  sweep.unref();
  app.addHook('onClose', async () => {
    clearInterval(sweep);
    await pendingSweep;
    try { await boss.stop({ graceful: true, timeout: 5000 }); } finally { await pool.end(); }
  });
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof HttpError) return reply.code(error.status).send({ error: { code: error.code, message: error.message } });
    const candidate = error as { statusCode?: number };
    const status = candidate.statusCode === 413 ? 413 : candidate.statusCode === 400 ? 400 : 500;
    return reply.code(status).send({ error: { code: status === 413 ? 'body_too_large' : status === 400 ? 'invalid_request' : 'internal_error', message: status === 500 ? 'The center could not complete this request.' : 'Invalid request.' } });
  });
  app.addHook('preHandler', async request => {
    if (request.routeOptions.url === '/api/health' || request.method === 'OPTIONS') return;
    const token = request.headers.authorization?.replace(/^Bearer /, '');
    if (!token || !request.headers.authorization?.startsWith('Bearer ')) throw new HttpError(401, 'unauthorized', 'Authentication required.');
    const owner = timingSafeEqual(Buffer.from(sha256(token)), Buffer.from(sha256(options.ownerToken)));
    const runnerRoute = request.routeOptions.url?.startsWith('/api/runner/');
    if (owner && !runnerRoute) return;
    if (owner) throw new HttpError(403, 'wrong_role', 'A runner credential is required.');
    const runner = (await pool.query<{ id: string }>('SELECT id FROM flow.runners WHERE token_hash=$1 AND NOT revoked', [sha256(token)])).rows[0];
    if (!runner) throw new HttpError(401, 'unauthorized', 'Authentication required.');
    if (!runnerRoute) throw new HttpError(403, 'wrong_role', 'An owner credential is required.');
    request.runnerId = runner.id;
  });
  app.get('/api/health', async () => ({ ok: true }));
  registerWorkspaceRoutes(app, pool);
  registerTaskIndexRoutes(app, pool);
  registerReconciliation(app, pool, boss);
  registerProtocolDispatch(app, pool);
  registerProjectRoutes(app, pool);
  registerGoalRoutes(app, pool, boss);
  registerConversationRoutes(app, pool, boss);
  registerAssistantRoutes(app, pool);
  registerStreams(app, pool);
  app.post('/api/runners', async request => {
    const input = registerRunnerSchema.safeParse(request.body);
    if (!input.success) throw new HttpError(400, 'invalid_runner', 'Invalid runner registration.');
    return registerRunner(pool, input.data);
  });
  app.post('/api/runner/claim', request => { requireEmptyBody(request.body); return claim(pool, request.runnerId!, leaseMs); });
  app.post<{ Params: { id: string } }>('/api/runners/:id/revoke', request => { requireEmptyBody(request.body); return revoke(pool, request.params.id); });
  app.post('/api/runner/heartbeat', request => {
    const input = ownershipSchema.safeParse(request.body);
    if (!input.success) throw new HttpError(400, 'invalid_ownership', 'Invalid attempt ownership.');
    return heartbeat(pool, request.runnerId!, input.data, leaseMs);
  });
  app.post('/api/runner/events', request => {
    const input = eventBatchSchema.safeParse(request.body);
    if (!input.success) throw new HttpError(400, 'invalid_events', 'Invalid event batch.');
    return reportEvents(pool, request.runnerId!, input.data);
  });
  app.post('/api/tasks', async (request, reply) => {
    const parsed = taskSubmissionSchema.safeParse(request.body);
    if (!parsed.success) throw new HttpError(400, 'invalid_submission', 'Invalid task submission.');
    const result = await submit(pool, boss, parsed.data, String(request.headers['idempotency-key'] ?? ''));
    return reply.code(202).send(result);
  });
  app.get<{ Params: { id: string } }>('/api/tasks/:id', request => snapshot(pool, request.params.id));
  app.get<{ Params: { id: string }; Querystring: { after?: string; limit?: string } }>('/api/tasks/:id/events', request => eventPage(pool, request.params.id, integerQuery(request.query.after, 0, Number.MAX_SAFE_INTEGER), integerQuery(request.query.limit, 100, 100, 1)));
  app.get<{ Params: { id: string } }>('/api/details/:id', request => detail(pool, request.params.id));
  app.post<{ Params: { id: string } }>('/api/tasks/:id/decision', request => {
    const input = decisionSchema.safeParse(request.body);
    if (!input.success) throw new HttpError(400, 'invalid_decision', 'Invalid decision answer.');
    return decide(pool, boss, request.params.id, input.data, String(request.headers['idempotency-key'] ?? ''));
  });
  app.post<{ Params: { id: string } }>('/api/tasks/:id/cancel', request => { requireEmptyBody(request.body); return cancel(pool, boss, request.params.id, String(request.headers['idempotency-key'] ?? '')); });
  app.get<{ Querystring: { limit?: string; before?: string } }>('/api/tasks', request => {
    const limit = integerQuery(request.query.limit, 40, 100, 1);
    return list(pool, limit, request.query.before);
  });
  return app;
}

function requireEmptyBody(body: unknown): void {
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length) throw new HttpError(400, 'invalid_request', 'This command expects an empty object.');
}
