import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import type { PgBoss } from 'pg-boss';
import { z } from 'zod';
import { pluginVerificationAdmissionSchema } from '../../../../packages/contracts/src/plugin-verification-admission.js';
import { pluginGrantRequestSchema, PLUGIN_RUNTIME_LIMITS } from '../../../../packages/contracts/src/plugin-runtime.js';
import { HttpError } from '../database.js';
import type { TrustedPluginVerifierPolicy } from '../plugin-verification-configuration.js';
import { admitPluginVerification } from './verification-admission.js';
import { authorizePluginPhase } from './commands.js';
import type { TrustedPluginHostPolicy } from './store.js';

/** Assembly must mount this together with reportEvents' verifier policy/gate after migration 036.
 * Inherits the factory's owner/runner authentication hooks; no unauthenticated standalone server. */
export function registerPluginVerificationRoutes(app: FastifyInstance, pool: Pool, boss: PgBoss,
  policy: { hosts: TrustedPluginHostPolicy; algorithms: TrustedPluginVerifierPolicy }): void {
  if (typeof policy?.hosts !== 'function' || typeof policy?.algorithms !== 'function') throw new Error('Explicit verifier policy is required.');
  app.post<{ Params: { id: string } }>('/api/plugins/:id/verification-tasks', { bodyLimit: 16384 }, async (request, reply) => {
    const id = z.uuid().parse(request.params.id);
    const input = pluginVerificationAdmissionSchema.parse(request.body);
    const key = request.headers['idempotency-key'];
    if (typeof key !== 'string') throw new HttpError(400, 'idempotency_key_required', 'A stable idempotency key is required.');
    const result = await admitPluginVerification(pool, boss, id, input, key, policy.hosts, policy.algorithms);
    if (Buffer.byteLength(JSON.stringify(result)) > PLUGIN_RUNTIME_LIMITS.responseBytes) throw new HttpError(413, 'plugin_runtime_response_limit', 'Response exceeds its bound.');
    return reply.header('cache-control', 'no-store').code(result.replayed ? 200 : 201).send(result);
  });
  app.post('/api/runner/plugin-verifier/authorize', { bodyLimit: PLUGIN_RUNTIME_LIMITS.bodyBytes }, async (request, reply) => {
    if (!request.runnerId) throw new HttpError(401, 'runner_required', 'Runner authentication is required.');
    const key = request.headers['idempotency-key'];
    if (typeof key !== 'string') throw new HttpError(400, 'idempotency_key_required', 'A stable idempotency key is required.');
    const result = await authorizePluginPhase(pool, request.runnerId, pluginGrantRequestSchema.parse(request.body), key, 'verifier', policy.algorithms);
    return reply.header('cache-control', 'no-store').send(result);
  });
}
