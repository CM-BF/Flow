import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { readFile } from 'node:fs/promises';
import { idSchema } from '@flow/contracts';
import { HttpError, transaction } from '../database.js';
import { integerQuery } from '../queries.js';
import { nativeActivities, nativeActivity } from './store.js';
export async function migrateNativeActivities(pool: Pool): Promise<void> {
  await transaction(pool,async client=>{
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended('flow-migrations',0))");
    if ((await client.query('SELECT 1 FROM flow.migrations WHERE version=20')).rowCount) return;
    await client.query(await readFile(new URL('../../../../packages/storage/migrations/020-native-activity.sql',import.meta.url),'utf8'));
    await client.query('INSERT INTO flow.migrations(version) VALUES(20)');
  });
}
export function registerNativeActivityRoutes(app: FastifyInstance, pool: Pool): void {
  app.get<{Params:{id:string};Querystring:{after?:string;limit?:string}}>('/api/tasks/:id/native-activities',request=>{
    const {after,limit}=request.query;
    if (after!==undefined&&!idSchema.safeParse(after).success) throw new HttpError(400,'activity_cursor','Invalid native activity cursor.');
    return nativeActivities(pool,request.params.id,integerQuery(limit,20,100,1),after);
  });
  app.get<{Params:{id:string}}>('/api/native-activities/:id',request=>nativeActivity(pool,request.params.id));
}
