import { pluginRemovalQuerySchema } from '../../../../packages/contracts/src/plugin-removal.js';
import { readPluginRemovalReferences } from './removal-references.js';
import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import type { PgBoss } from 'pg-boss';
import { z } from 'zod';
import { PLUGIN_RUNTIME_LIMITS, pluginGrantRequestSchema, pluginHostPublicationSchema, pluginRuntimeCommandSchema, pluginToolTaskRequestSchema } from '../../../../packages/contracts/src/plugin-runtime.js';
import { HttpError, transaction } from '../database.js';
import { authorizePluginPhase, admitPluginToolTask, changePluginRuntime } from './commands.js';
import { pluginHostCandidatesQuerySchema } from '../../../../packages/contracts/src/plugin-runtime-hosts.js';
import { readPluginHostCandidates } from './host-candidates.js';
import { publishPluginHost, readBinding, readRuntime, type TrustedPluginHostPolicy } from './store.js';
import type { TrustedPluginVerifierPolicy } from '../plugin-verification-configuration.js';

function id(value: string): string {
  if (!z.uuid().safeParse(value).success) throw new HttpError(400, 'invalid_plugin_runtime_id', 'Invalid plugin runtime identity.');
  return value;
}
function bounded<T>(value: T): T {
  if (Buffer.byteLength(JSON.stringify(value)) > PLUGIN_RUNTIME_LIMITS.responseBytes) throw new HttpError(413, 'plugin_runtime_response_limit', 'Plugin runtime response exceeds its limit.');
  return value;
}
/**
 * Local registration only: no default factory mount. The integrator must first provide
 * current claim capability negotiation, legacy claim exclusion and retained recovery.
 * Reuses createServer's owner auth and /api/runner/ credential hook; never accepts runnerId in a body.
 * Missing operator policy denies host publication; this port does not accept public filesystem paths.
 */
export function registerPluginRuntimeRoutes(app: FastifyInstance, pool: Pool, boss: PgBoss, trustedHostPolicy?: TrustedPluginHostPolicy, verifierPolicy?: TrustedPluginVerifierPolicy): void {
  app.post('/api/runner/plugin-host', { bodyLimit: PLUGIN_RUNTIME_LIMITS.bodyBytes }, async (request, reply) => {
    const input = pluginHostPublicationSchema.safeParse(request.body);
    if (!input.success) throw new HttpError(400, 'invalid_plugin_host', 'Invalid plugin host publication.');
    if (!request.runnerId) throw new HttpError(401, 'runner_required', 'Runner authentication is required.');
    await publishPluginHost(pool, request.runnerId, input.data, trustedHostPolicy);
    return reply.header('cache-control', 'no-store').send({ published: true });
  });
  app.post('/api/runner/plugin-tool/authorize', { bodyLimit: PLUGIN_RUNTIME_LIMITS.bodyBytes }, async (request, reply) => {
    const input = pluginGrantRequestSchema.safeParse(request.body);
    if (!input.success) throw new HttpError(400, 'invalid_plugin_grant', 'Invalid plugin phase authorization.');
    if (!request.runnerId) throw new HttpError(401, 'runner_required', 'Runner authentication is required.');
    const receipt = await authorizePluginPhase(pool, request.runnerId, input.data, String(request.headers['idempotency-key'] ?? ''));
    return reply.header('cache-control', 'no-store').send(bounded(receipt));
  });
  app.post<{ Params: { id: string } }>('/api/plugins/:id/runtime/commands', { bodyLimit: PLUGIN_RUNTIME_LIMITS.bodyBytes }, async (request, reply) => {
    const input = pluginRuntimeCommandSchema.safeParse(request.body);
    if (!input.success) throw new HttpError(400, 'invalid_plugin_runtime_command', 'Invalid plugin runtime command.');
    return reply.header('cache-control', 'no-store').send(bounded(await changePluginRuntime(pool, id(request.params.id), input.data, String(request.headers['idempotency-key'] ?? ''), trustedHostPolicy, verifierPolicy)));
  });
  app.post<{ Params: { id: string } }>('/api/plugins/:id/tool-tasks', { bodyLimit: PLUGIN_RUNTIME_LIMITS.bodyBytes }, async (request, reply) => {
    const input = pluginToolTaskRequestSchema.safeParse(request.body);
    if (!input.success) throw new HttpError(400, 'invalid_plugin_tool_task', 'Invalid plugin tool task.');
    const accepted = await admitPluginToolTask(pool, boss, id(request.params.id), input.data, String(request.headers['idempotency-key'] ?? ''), trustedHostPolicy);
    return reply.header('cache-control', 'no-store').code(201).send(bounded(accepted));
  });
  app.get<{ Params: { id: string } }>('/api/plugins/:id/runtime/hosts', async (request, reply) => {
    const input = pluginHostCandidatesQuerySchema.safeParse(request.query);
    if (!input.success) throw new HttpError(400, 'invalid_plugin_host_query', 'Select an installed material and a valid candidate cursor.');
    return reply.header('cache-control', 'no-store').send(bounded(await transaction(pool, client => readPluginHostCandidates(client, id(request.params.id), input.data, trustedHostPolicy), true)));
  });
  app.get<{ Params: { id: string }; Querystring: Record<string, unknown> }>('/api/plugins/:id/removal-references', async (request, reply) => {
    const input = pluginRemovalQuerySchema.safeParse(request.query);
    if (!input.success) throw new HttpError(400, 'invalid_plugin_removal_query', 'Invalid removal reference query.');
    return reply.header('cache-control', 'no-store').send(await transaction(pool,
      client => readPluginRemovalReferences(client, id(request.params.id), input.data), true));
  });
  app.get<{ Params: { id: string } }>('/api/plugins/:id/runtime', async (request, reply) => {
    return reply.header('cache-control', 'no-store').send(bounded(await transaction(pool, client => readRuntime(client, id(request.params.id), trustedHostPolicy, verifierPolicy), true)));
  });
  app.get<{ Params: { id: string } }>('/api/tasks/:id/plugin-binding', async (request, reply) => {
    return reply.header('cache-control', 'no-store').send(bounded(await transaction(pool, client => readBinding(client, id(request.params.id)), true)));
  });
}
