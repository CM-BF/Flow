import { nativeEngineeringProfilePublicationSchema } from '../../../../packages/contracts/src/engineering-native.js';
import { publishNativeEngineeringProfile, listNativeEngineeringProfiles } from './native-profile.js';
import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { executionProfileReferenceSchema } from '../../../../packages/contracts/src/execution-profiles.js';
import { engineeringProfilePublicationSchema } from '../../../../packages/contracts/src/engineering-profile.js';
import { HttpError } from '../database.js';
import { integerQuery } from '../queries.js';
import { listEngineeringProfiles, publishEngineeringProfile } from './profile.js';

export function registerEngineeringRoutes(app: FastifyInstance, pool: Pool): void {
  app.post('/api/runner/native-engineering-profile', request => {
    const parsed = nativeEngineeringProfilePublicationSchema.safeParse(request.body);
    if (!parsed.success) throw new HttpError(400, 'invalid_native_engineering_profile', 'Invalid native engineering declaration.');
    return publishNativeEngineeringProfile(pool, request.runnerId!, parsed.data.configuration);
  });
  app.get<{ Querystring: { after?: string; limit?: string } }>('/api/native-engineering-profiles', (request, reply) => {
    reply.header('Cache-Control', 'no-store');
    const { after, limit } = request.query;
    if (after !== undefined && !executionProfileReferenceSchema.shape.id.safeParse(after).success) throw new HttpError(400, 'profile_cursor', 'Invalid profile cursor.');
    return listNativeEngineeringProfiles(pool, after, integerQuery(limit, 20, 100, 1));
  });
  app.post('/api/runner/engineering-profile', request => {
    const parsed = engineeringProfilePublicationSchema.safeParse(request.body);
    if (!parsed.success) throw new HttpError(400, 'invalid_engineering_profile', 'Invalid engineering profile configuration.');
    return publishEngineeringProfile(pool, request.runnerId!, parsed.data.configuration);
  });
  app.get<{ Querystring: { after?: string; limit?: string } }>('/api/engineering-profiles', (request, reply) => {
    reply.header('Cache-Control', 'no-store');
    const { after, limit } = request.query;
    if (after !== undefined && !executionProfileReferenceSchema.shape.id.safeParse(after).success) throw new HttpError(400, 'profile_cursor', 'Invalid profile cursor.');
    return listEngineeringProfiles(pool, after, integerQuery(limit, 20, 100, 1));
  });
}
