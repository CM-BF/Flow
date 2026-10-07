import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { readFile } from 'node:fs/promises';
import { idSchema } from '@flow/contracts';
import { HttpError, transaction } from '../database.js';
import { assistantStreamProtocol } from '../../../../packages/contracts/src/assistant-stream.js';
import { integerQuery } from '../queries.js';
import { assistantStreams, assistantStreamBlock, assistantStreamPatches } from './queries.js';
export { readAssistantStream } from './queries.js';
export async function migrateAssistantStreams(pool:Pool):Promise<void> {
  await transaction(pool,async client=>{
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended('flow-migrations',0))");
    if((await client.query('SELECT 1 FROM flow.migrations WHERE version=22')).rowCount) return;
    await client.query(await readFile(new URL('../../../../packages/storage/migrations/022-assistant-stream.sql',import.meta.url),'utf8'));
    await client.query('INSERT INTO flow.migrations(version) VALUES(22)');
  });
}
export function registerAssistantStreamRoutes(app:FastifyInstance,pool:Pool):void {
  app.get<{Params:{id:string};Querystring:{after?:string;limit?:string}}>('/api/tasks/:id/assistant-stream',request=>{
    if(request.query.after!==undefined&&!idSchema.safeParse(request.query.after).success) throw new HttpError(400,'stream_cursor','Invalid block cursor.');
    return assistantStreams(pool,request.params.id,integerQuery(request.query.limit,20,100,1),request.query.after,assistantStreamProtocol(request.raw.rawHeaders)??'patch-v1');
  });
  app.get<{Params:{id:string};Querystring:{attemptId?:string;after?:string;limit?:string}}>('/api/tasks/:id/assistant-stream/patches',request=>{
    if(!idSchema.safeParse(request.query.attemptId).success) throw new HttpError(400,'stream_attempt','A bound attempt ID is required.');
    return assistantStreamPatches(pool,request.params.id,request.query.attemptId!,integerQuery(request.query.after,0,2147483647,0),integerQuery(request.query.limit,8,8,1),assistantStreamProtocol(request.raw.rawHeaders)??'patch-v1');
  });
  app.get<{Params:{id:string;blockId:string}}>('/api/tasks/:id/assistant-stream/:blockId',request=>assistantStreamBlock(pool,request.params.id,request.params.blockId,assistantStreamProtocol(request.raw.rawHeaders)??'patch-v1'));
}
