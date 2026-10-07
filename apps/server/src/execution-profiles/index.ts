import { CLAUDE_TURN_SETTINGS_PROTOCOL } from '../../../../packages/contracts/src/claude-turn-settings.js';
import { readFile } from 'node:fs/promises';
import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { nativeExecutionProfilePublicationSchema, executionProfileReferenceSchema, EXECUTION_PROFILE_HEADER, EXECUTION_PROFILE_STEERING_VERSION, NATIVE_EXECUTION_PROFILE_VERSION, NATIVE_EXECUTION_PROFILE_V2 } from '../../../../packages/contracts/src/execution-profiles.js';
import { HttpError, transaction } from '../database.js';
import { integerQuery } from '../queries.js';
import { listProfiles, listNativeProfiles, listClaudeMessageSettingsProfiles, publishProfile } from './store.js';

export async function migrateExecutionProfiles(pool: Pool): Promise<void> {
  await transaction(pool, async client => {
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended('flow-migrations',0))");
    if ((await client.query('SELECT 1 FROM flow.migrations WHERE version=10')).rowCount) return;
    await client.query(await readFile(new URL('../../../../packages/storage/migrations/010-execution-profiles.sql', import.meta.url), 'utf8'));
    await client.query('INSERT INTO flow.migrations(version) VALUES(10)');
  });
}
export function registerExecutionProfileRoutes(app: FastifyInstance, pool: Pool): void {
  app.post('/api/runner/execution-profile', request => {
    const parsed = nativeExecutionProfilePublicationSchema.safeParse(request.body);
    if (!parsed.success) throw new HttpError(400, 'invalid_execution_profile', 'Invalid execution profile configuration.');
    return publishProfile(pool, request.runnerId!, parsed.data.configuration);
  });
  app.get<{ Querystring: { after?: string; limit?: string } }>('/api/execution-profiles', (request, reply) => {
    reply.header('Cache-Control', 'no-store');
    const { after, limit } = request.query;
    if (after !== undefined && !executionProfileReferenceSchema.shape.id.safeParse(after).success) throw new HttpError(400, 'profile_cursor', 'Invalid execution profile cursor.');
    const header = EXECUTION_PROFILE_HEADER.toLowerCase();
    const occurrences = request.raw.rawHeaders.filter((_, index) => index % 2 === 0 && request.raw.rawHeaders[index]!.toLowerCase() === header).length;
    if (occurrences === 1 && request.headers[header] === CLAUDE_TURN_SETTINGS_PROTOCOL) {
      return listClaudeMessageSettingsProfiles(pool, after, integerQuery(limit, 20, 100, 1));
    }
    if (occurrences === 1 && request.headers[header] === NATIVE_EXECUTION_PROFILE_V2) return listNativeProfiles(pool, after, integerQuery(limit, 20, 100, 1), 'native-v2');
    if (occurrences === 1 && request.headers[header] === NATIVE_EXECUTION_PROFILE_VERSION) {
      return listNativeProfiles(pool, after, integerQuery(limit, 20, 100, 1));
    }
    const includeSteering = occurrences === 1 && request.headers[header] === EXECUTION_PROFILE_STEERING_VERSION;
    return listProfiles(pool, after, integerQuery(limit, 20, 100, 1), includeSteering);
  });
}
