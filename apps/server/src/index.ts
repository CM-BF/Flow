import { migratePluginVerification } from './plugin-runtime/verification.js';
import { migrateGoalPlanConfirmations, registerGoalPlanConfirmationRoutes } from './goal-plan-confirmation/index.js';
import { migrateGoalProgressions, registerGoalProgressionRoutes, scanGoalProgressions } from './goal-progression/index.js';
import { registerUsageReadoutRoutes } from './usage-readout/index.js';
import { migratePluginRuntime, type TrustedPluginHostPolicy } from './plugin-runtime/store.js';
import { registerPluginRuntimeRoutes } from './plugin-runtime/routes.js';
import { registerRunnerClaimRoutes } from './runner-claim-routes.js';
import { migratePluginInstallations } from './plugin-installations/migration.js';
import { registerPluginInstallationRoutes } from './plugin-installations/routes.js';
import type { PluginInstallHost } from './plugin-installations/commands.js';
import { createBrowserSessionAuthentication, migrateBrowserSessions, registerBrowserSessionRoutes, type BrowserSessionAuthentication, type BrowserSessionOptions } from './browser-session/index.js';
import { migrateContextObservationHistory } from './context-transparency/migration.js';
import { registerContextHistoryRoutes } from './context-transparency/routes.js';
import { registerGoalNativeExecutionRoutes } from './goal-native-executions/index.js';
import { registerGoalDeliveryRoutes } from './goal-delivery/index.js';
import { migrateNativeHarnessSources } from './native-harness-migration.js';
import { migrateActiveSteering, registerActiveSteeringRoutes } from './active-steering/index.js';
import { migrateAssistantStreams, registerAssistantStreamRoutes } from './assistant-stream/index.js';
import { migratePackageFetches, registerPackageFetchRoutes, startPackageFetchWorker, type PackageFetchHost, type PackageFetchWorker } from './plugin-package-fetches/index.js';
import { migrateNativeActivities, registerNativeActivityRoutes } from './native-activity/index.js';
import { migrateNativeActivityBodies, registerNativeActivityBodyRoutes, registerNativeActivityBodySupport } from './native-activity-body/index.js';
import { migrateGoalContext, registerGoalContextRoutes } from './goal-context/index.js';
import { migrateGoalGraphRuns, registerGoalGraphRunRoutes } from './goal-graph-runs/index.js';
import { migrateKnowledge, registerKnowledgeRoutes } from './knowledge/index.js';
import { migrateRunnerMaintenance, registerRunnerMaintenanceRoutes } from './runner-maintenance/index.js';
import { migrateGoalGraphProposals, registerGoalGraphProposalRoutes } from './goal-graph-proposals/index.js';
import { migrateExecutionProfiles, registerExecutionProfileRoutes } from './execution-profiles/index.js';
import { migrateConversationQueue, registerConversationQueueRoutes, scanConversationQueue } from './conversation-queue/index.js';
import { migrateConversationContext, registerConversationContextRoutes } from './conversation-context/index.js';
import { migrateAttachments, registerAttachmentRoutes } from './attachments/index.js';
import { migrateGoalToolRuns, registerGoalToolRunRoutes } from './goal-tool-runs/index.js';
import { registerShutdown } from './shutdown/index.js';
import { migratePlugins, registerPluginRoutes } from './plugins/index.js';
import { migrateConversations, registerConversationRoutes } from './conversations/index.js';
import { migrateClaudeMessageSettings } from './conversations/message-settings-migration.js';
import { migrateAssistantMessages, registerAssistantRoutes } from './assistant/index.js';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { Pool } from 'pg';
import { MAX_BATCH_BYTES, taskSubmissionSchema, registerRunnerSchema, ownershipSchema, eventBatchSchema, decisionSchema } from '@flow/contracts';
import { HttpError, migrate } from './database.js';
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
import { registerEngineeringRoutes } from './engineering/index.js';
import { migrateProtocolDispatch, registerProtocolDispatch } from './protocol-dispatch/index.js';

import { migrateGoals, registerGoalRoutes } from './goals/index.js';

declare module 'fastify' { interface FastifyRequest { runnerId: string | null } }

export interface ServerOptions {
  databaseUrl: string; ownerToken: string; leaseMs?: number; allowedOrigin?: string; shutdownGraceMs?: number;
  automaticQueueScan?: boolean; packageFetchHost?: PackageFetchHost;
  /** Explicit host policy for static material installation; absent keeps these routes disabled. */
  pluginInstallHost?: PluginInstallHost;
  /** Explicit operator trust. Absence leaves plugin admission and phase routes unmounted. */
  pluginRuntimeHostPolicy?: TrustedPluginHostPolicy;
  /** Explicit browser trust policy; absent keeps credentialed browser sessions disabled. */
  browserSession?: BrowserSessionOptions;
  /** Trusted host opt-in for controlled integrations; the production CLI leaves intake disabled. */
  activeSteering?: boolean;
}
export async function createServer(options: ServerOptions) {
  if (!options.ownerToken) throw new Error('ownerToken is required.');
  const app = Fastify({ bodyLimit: MAX_BATCH_BYTES, logger: false });
  registerShutdown(app, options.shutdownGraceMs);
  app.decorateRequest('runnerId', null);
  const leaseMs = options.leaseMs ?? 10_000;
  if (!Number.isSafeInteger(leaseMs) || leaseMs < 50 || leaseMs > 300_000) throw new Error('Invalid leaseMs.');
  const pool = new Pool({ connectionString: options.databaseUrl, max: 8, connectionTimeoutMillis: 5000, statement_timeout: 10_000 });
  pool.on('error', error => app.log.error(error));
  let packageWorker: PackageFetchWorker | undefined;
  let authentication: BrowserSessionAuthentication;
  try {
    await migrate(pool);
    await migrateWorkspace(pool);
    await migrateProjects(pool);
    await migrateProtocolDispatch(pool);
    await migrateGoals(pool);
    await migrateConversations(pool);
    await migratePlugins(pool);
    await migrateAssistantMessages(pool);
    await migrateExecutionProfiles(pool);
    await migrateConversationQueue(pool);
    await migrateGoalToolRuns(pool);
    await migrateGoalGraphProposals(pool);
    await migrateKnowledge(pool);
    await migrateRunnerMaintenance(pool);
    await migrateConversationContext(pool);
    await migrateGoalGraphRuns(pool);
    await migrateNativeActivities(pool);
    await migrateGoalContext(pool);
    await migrateAssistantStreams(pool);
    await migratePackageFetches(pool);
    await migrateActiveSteering(pool);
    await migrateNativeHarnessSources(pool);
    await migrateAttachments(pool);
    await migrateContextObservationHistory(pool);
    await migrateBrowserSessions(pool);
    await migratePluginInstallations(pool);
    await migratePluginRuntime(pool);
    await migratePluginVerification(pool);
    await migrateGoalProgressions(pool);
    await migrateGoalPlanConfirmations(pool);
    await migrateClaudeMessageSettings(pool);
    await migrateNativeActivityBodies(pool);
    authentication = await createBrowserSessionAuthentication(pool, options);
    const corsOptions = authentication.corsOptions ?? (options.allowedOrigin ? { origin: options.allowedOrigin, methods: ['GET', 'POST', 'OPTIONS'] } : undefined);
    if (corsOptions) await app.register(cors, corsOptions);
    if (options.packageFetchHost) packageWorker = await startPackageFetchWorker(pool, options.packageFetchHost);
  } catch (error) { await pool.end(); throw error; }
  const boss = await startScheduler(options.databaseUrl, pool).catch(async error => {
    try { await packageWorker?.stop(); } finally { await pool.end(); }
    throw error;
  });
  let pendingSweep: Promise<void> | undefined;
  const sweep = setInterval(() => {
    if (pendingSweep) return;
    pendingSweep = expireLeases(pool).then(async () => {
      await pool.query("UPDATE flow.tasks SET dispatch_ready=true WHERE id IN (SELECT id FROM flow.tasks WHERE status='queued' AND NOT dispatch_ready ORDER BY created_at LIMIT 100)");
    }).catch(error => app.log.error(error)).finally(() => { pendingSweep = undefined; });
  }, Math.min(1000, leaseMs));
  sweep.unref();
  let pendingWorkScan: Promise<void> | undefined;
  let closing = false;
  const scanWork = () => {
    if (closing) return Promise.resolve();
    return pendingWorkScan ??= (async () => {
      // Each module owns its durable admission rules; this lifecycle only schedules bounded sweeps.
      for (const scan of [scanConversationQueue, scanGoalProgressions]) {
        if (closing) break;
        try { for (const error of (await scan(pool, boss)).errors) app.log.error(error); }
        catch (error) { app.log.error(error); }
      }
    })().finally(() => { pendingWorkScan = undefined; });
  };
  // Module tests may drive promotion explicitly; the production entry always uses automatic scanning.
  const queueSweep = options.automaticQueueScan === false ? undefined : setInterval(() => { void scanWork(); }, 1000);
  queueSweep?.unref();
  if (options.automaticQueueScan !== false) app.addHook('onReady', scanWork);
  app.addHook('preClose', async () => {
    closing = true; clearInterval(queueSweep);
    await Promise.all([pendingWorkScan, packageWorker?.stop()]);
  });
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
  app.addHook('preHandler', authentication.authenticate);
  registerBrowserSessionRoutes(app, authentication);
  app.get('/api/health', async () => ({ ok: true }));
  registerWorkspaceRoutes(app, pool);
  registerTaskIndexRoutes(app, pool);
  registerUsageReadoutRoutes(app, pool);
  registerReconciliation(app, pool, boss);
  registerProtocolDispatch(app, pool);
  registerProjectRoutes(app, pool);
  registerGoalRoutes(app, pool, boss);
  registerGoalDeliveryRoutes(app, pool);
  registerGoalNativeExecutionRoutes(app, pool, boss);
  registerGoalProgressionRoutes(app, pool);
  registerGoalPlanConfirmationRoutes(app, pool, boss);
  registerActiveSteeringRoutes(app, pool, { acceptCommands: options.activeSteering === true });
  registerAssistantStreamRoutes(app, pool);
  registerConversationRoutes(app, pool, boss, { assistantStreamReadable: true });
  registerPluginRoutes(app, pool);
  if (options.packageFetchHost) registerPackageFetchRoutes(app, pool, options.packageFetchHost);
  if (options.pluginInstallHost) registerPluginInstallationRoutes(app, pool, options.pluginInstallHost);
  if (options.pluginRuntimeHostPolicy) registerPluginRuntimeRoutes(app, pool, boss, options.pluginRuntimeHostPolicy);
  registerAssistantRoutes(app, pool);
  registerNativeActivityRoutes(app, pool);
  registerNativeActivityBodyRoutes(app, pool);
  registerNativeActivityBodySupport(app);
  registerGoalContextRoutes(app, pool);
  registerExecutionProfileRoutes(app, pool);
  registerEngineeringRoutes(app, pool);
  registerConversationQueueRoutes(app, pool, boss);
  registerConversationContextRoutes(app, pool);
  registerAttachmentRoutes(app, pool);
  registerContextHistoryRoutes(app, pool);
  registerGoalToolRunRoutes(app, pool, boss);
  registerGoalGraphProposalRoutes(app, pool);
  registerKnowledgeRoutes(app, pool);
  registerRunnerMaintenanceRoutes(app, pool);
  registerGoalGraphRunRoutes(app, pool, boss);
  registerStreams(app, pool, authentication.authorizeStream);
  app.post('/api/runners', async request => {
    const input = registerRunnerSchema.safeParse(request.body);
    if (!input.success) throw new HttpError(400, 'invalid_runner', 'Invalid runner registration.');
    return registerRunner(pool, input.data);
  });
  app.post('/api/runner/claim', request => { requireEmptyBody(request.body); return claim(pool, request.runnerId!, leaseMs); });
  registerRunnerClaimRoutes(app, pool, leaseMs);
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
