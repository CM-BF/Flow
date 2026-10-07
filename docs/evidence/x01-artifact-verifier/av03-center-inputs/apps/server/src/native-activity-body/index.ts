import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { readFile } from 'node:fs/promises';
import { HttpError, transaction } from '../database.js';
import { integerQuery } from '../queries.js';
import { nativeActivityBodyDescriptor, nativeActivityBodyPage } from './read.js';
import { NATIVE_ACTIVITY_BODY_LIMITS, NATIVE_ACTIVITY_BODY_PROTOCOL, nativeActivityBodySupportSchema } from '../../../../packages/contracts/src/native-activity-body.js';
export async function migrateNativeActivityBodies(pool: Pool): Promise<void> {
  await transaction(pool,async client=>{
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended('flow-migrations',0))");
    if ((await client.query('SELECT 1 FROM flow.migrations WHERE version=33')).rowCount) return;
    await client.query(await readFile(new URL('../../../../packages/storage/migrations/033-native-activity-bodies.sql',import.meta.url),'utf8'));
    await client.query('INSERT INTO flow.migrations(version) VALUES(33)');
  });
}
/** Mount under the existing center owner/browser authentication hook only. */
export function registerNativeActivityBodyRoutes(app: FastifyInstance, pool: Pool): void {
  type Params = {taskId:string;activityId:string};
  const valid = (params: Params) => { if (!/^[a-f0-9]{64}$/.test(params.activityId)) throw new HttpError(400,'activity_identity','Invalid activity identity.'); };
  app.get<{Params:Params}>('/api/tasks/:taskId/native-activities/:activityId/body',(request,reply)=>{
    valid(request.params); reply.header('cache-control','no-store');
    return nativeActivityBodyDescriptor(pool,request.params.taskId,request.params.activityId);
  });
  app.get<{Params:Params;Querystring:{afterIndex?:string;limit?:string}}>('/api/tasks/:taskId/native-activities/:activityId/body/chunks',(request,reply)=>{
    valid(request.params); reply.header('cache-control','no-store');
    return nativeActivityBodyPage(pool,request.params.taskId,request.params.activityId,integerQuery(request.query.afterIndex,0,128),integerQuery(request.query.limit,4,4,1));
  });
}

/** Production factory calls this only after migration 033 and body routes are mounted. */
export function registerNativeActivityBodySupport(app: FastifyInstance): void {
  app.get('/api/runner/native-activity-body-support', (request, reply) => {
    if (!request.runnerId) throw new HttpError(403, 'wrong_role', 'A runner identity is required.');
    reply.header('cache-control', 'no-store');
    return nativeActivityBodySupportSchema.parse({
      protocol: NATIVE_ACTIVITY_BODY_PROTOCOL, representation: 'sdk-public-material-utf8-v1',
      runnerId: request.runnerId, limits: NATIVE_ACTIVITY_BODY_LIMITS,
    });
  });
}
