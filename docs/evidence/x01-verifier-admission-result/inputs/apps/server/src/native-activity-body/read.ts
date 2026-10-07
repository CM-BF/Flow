import type { Pool, PoolClient } from 'pg';
import { NATIVE_ACTIVITY_BODY_LIMITS as limits, NATIVE_ACTIVITY_BODY_PROTOCOL as protocol,
  type NativeActivityBodyDescriptor, type NativeActivityBodyPage } from '../../../../packages/contracts/src/native-activity-body.js';
import { HttpError, transaction } from '../database.js';
import { assertStoredChunk, type BodyRow, type ChunkRow } from './store.js';

type DescriptorRow = Partial<BodyRow> & { id:string; task_id:string; attempt_id:string; ended:boolean };
async function descriptor(client: PoolClient, taskId: string, activityId: string): Promise<NativeActivityBodyDescriptor> {
  const row = (await client.query<DescriptorRow>(`SELECT a.id,a.task_id,a.attempt_id,b.activity_id,b.bytes,b.sha256,b.media_type,b.received_bytes,b.received_chunks,b.complete,
    (p.completed_at IS NOT NULL OR p.lease_expires_at<=clock_timestamp() OR t.status IN ('succeeded','failed','cancelled','uncertain')) AS ended
    FROM flow.native_activities a JOIN flow.tasks t ON t.id=a.task_id JOIN flow.attempts p ON p.id=a.attempt_id
    LEFT JOIN flow.native_activity_bodies b ON b.activity_id=a.id WHERE a.id=$1 AND a.task_id=$2`,[activityId,taskId])).rows[0];
  if (!row) throw new HttpError(404,'activity_not_found','Native activity not found for this task.');
  const stored = row.activity_id !== null && row.activity_id !== undefined;
  return {taskId:row.task_id,attemptId:row.attempt_id,activityId:row.id,
    protocol:stored?protocol:null,representation:stored?'sdk-public-material-utf8-v1':null,
    state:stored ? row.complete?'complete':row.ended?'interrupted':'receiving' : 'legacy',
    mediaType:stored?row.media_type!:null,bytes:stored?row.bytes!:null,sha256:stored?row.sha256!:null,
    receivedBytes:stored?row.received_bytes!:0,receivedChunks:stored?row.received_chunks!:0,
    chunkCount:stored?Math.ceil(row.bytes!/limits.chunkBytes):null};
}
export function nativeActivityBodyDescriptor(pool: Pool, taskId: string, activityId: string): Promise<NativeActivityBodyDescriptor> {
  return transaction(pool,client=>descriptor(client,taskId,activityId),true);
}
export function nativeActivityBodyPage(pool: Pool, taskId: string, activityId: string, afterIndex: number, limit: number): Promise<NativeActivityBodyPage> {
  if (!Number.isSafeInteger(afterIndex) || afterIndex < 0 || afterIndex > 128 || !Number.isInteger(limit) || limit < 1 || limit > limits.pageChunks) throw new HttpError(400,'activity_body_cursor','Invalid material page.');
  return transaction(pool,async client=>{
    const info = await descriptor(client,taskId,activityId);
    if (afterIndex > info.receivedChunks) throw new HttpError(409,'activity_body_cursor','Cursor is beyond this material.');
    const rows = (await client.query<ChunkRow>(`SELECT chunk_index,byte_offset,bytes,sha256,content FROM flow.native_activity_body_chunks
      WHERE activity_id=$1 AND chunk_index>=$2 ORDER BY chunk_index LIMIT $3`,[activityId,afterIndex,limit])).rows;
    rows.forEach((row,index)=>assertStoredChunk(row,afterIndex+index,info.bytes ?? 0));
    if (rows.length !== Math.min(limit,info.receivedChunks-afterIndex)) throw new HttpError(409,'activity_body_content','Saved material page is incomplete.');
    const nextIndex = rows.length ? rows.at(-1)!.chunk_index+1 : afterIndex;
    return {descriptor:info,chunks:rows.map(row=>({index:row.chunk_index,offset:row.byte_offset,bytes:row.bytes,sha256:row.sha256,base64:row.content.toString('base64')})),
      nextIndex,hasMore:nextIndex < info.receivedChunks};
  },true);
}
