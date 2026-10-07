import { verifierRunnerClaimRequestSchema } from '../../../packages/contracts/src/verifier-runner-claim.js';
import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { runnerClaimRequestSchema } from '../../../packages/contracts/src/runner-claim.js';
import { pluginRunnerClaimRequestSchema } from '../../../packages/contracts/src/plugin-runner-claim.js';
import { HttpError } from './database.js';
import { claimOpportunity, claimOpportunityStatus, runnerIdentity } from './runners.js';

/** Both wire versions use the existing authenticated runner routes and transaction owner. */
export function registerRunnerClaimRoutes(app: FastifyInstance, pool: Pool, leaseMs: number): void {
  app.get('/api/runner/identity', request => runnerIdentity(pool, request.runnerId!));
  for (const operation of ['claim', 'status'] as const) {
    const path = '/api/runner/claim-opportunity' + (operation === 'status' ? '/status' : '');
    app.post(path, request => {
      const input = runnerClaimRequestSchema.or(pluginRunnerClaimRequestSchema).or(verifierRunnerClaimRequestSchema).safeParse(request.body);
      if (!input.success) throw new HttpError(400, 'invalid_claim_opportunity', 'Invalid claim opportunity.');
      return operation === 'claim' ? claimOpportunity(pool, request.runnerId!, input.data, leaseMs)
        : claimOpportunityStatus(pool, request.runnerId!, input.data);
    });
  }
}
