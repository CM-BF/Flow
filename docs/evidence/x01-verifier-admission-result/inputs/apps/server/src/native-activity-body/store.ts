import { createHash } from 'node:crypto';
import type { PoolClient } from 'pg';
import { NATIVE_ACTIVITY_BODY_LIMITS as limits, type NativeActivityBodyEvent } from '../../../../packages/contracts/src/native-activity-body.js';
import { nativeActivityBodySchema } from '../../../../packages/contracts/src/native-activity.js';
import { HttpError, sha256 } from '../database.js';
import type { TaskRecord } from '../tasks.js';
import type { AttemptRecord } from '../runners.js';

export interface BodyRow {
  activity_id: string; task_id: string; attempt_id: string; native_session_id: string;
  bytes: number; sha256: string; media_type: 'application/json'|'text/plain';
  received_bytes: number; received_chunks: number; complete: boolean;
}
export interface ChunkRow { chunk_index:number; byte_offset:number; bytes:number; sha256:string; content:Buffer }
const fail = (message: string): never => { throw new HttpError(409,'activity_body_conflict',message); };
const digest = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
export function decodeBodyChunk(event: Extract<NativeActivityBodyEvent,{action:'chunk'}>): Buffer {
  const bytes = Buffer.from(event.base64,'base64');
  if (bytes.length !== event.bytes || bytes.length > limits.chunkBytes || bytes.length < 1
      || bytes.toString('base64') !== event.base64 || digest(bytes) !== event.sha256) fail('Chunk encoding, size or digest differs.');
  return bytes;
}
export function assertMaterialCapacity(current: {bodies:number;bytes:number;pending:number}, incomingBytes: number): void {
  if (![current.bodies,current.bytes,current.pending,incomingBytes].every(value=>Number.isSafeInteger(value)&&value>=0)
      || incomingBytes > limits.bodyBytes || current.bodies >= limits.bodies
      || current.bytes + incomingBytes > limits.attemptBytes || current.pending > 0) fail('Material limit or single-material backpressure exceeded.');
}
export function assertStoredChunk(chunk: ChunkRow, index: number, totalBytes: number): void {
  if (chunk.chunk_index !== index || chunk.byte_offset !== index * limits.chunkBytes
      || chunk.bytes !== Math.min(limits.chunkBytes,totalBytes-chunk.byte_offset)
      || chunk.bytes < 1 || chunk.content.length !== chunk.bytes || digest(chunk.content) !== chunk.sha256) fail('Saved material chunks are inconsistent.');
}
/** Caller owns the existing runner/task/attempt locks and event transaction. */
export async function saveNativeActivityBody(client: PoolClient, task: TaskRecord, attempt: AttemptRecord, event: NativeActivityBodyEvent): Promise<void> {
  if (attempt.native_session_id !== event.nativeSessionId) fail('Material session differs from the reporting attempt.');
  const prior = (await client.query<BodyRow>('SELECT * FROM flow.native_activity_bodies WHERE activity_id=$1',[event.activityId])).rows[0];
  if (prior && (prior.task_id !== task.id || prior.attempt_id !== attempt.id || prior.native_session_id !== event.nativeSessionId)) fail('Material belongs to another attempt.');
  if (event.action === 'open') {
    if (prior) {
      if (prior.bytes !== event.bytes || prior.sha256 !== event.sha256 || prior.media_type !== event.mediaType) fail('Material identity cannot change.');
      return;
    }
    const observation = (await client.query<{header:{kind:string;phase:string};content:string;detail_digest:string}>(`SELECT a.header,d.content,a.detail_digest FROM flow.native_activities a
      JOIN flow.details d ON d.id=a.detail_id AND d.task_id=a.task_id AND d.attempt_id=a.attempt_id
      WHERE a.id=$1 AND a.task_id=$2 AND a.attempt_id=$3 AND a.native_session_id=$4`,[event.activityId,task.id,attempt.id,event.nativeSessionId])).rows[0];
    if (!observation) return fail('Material requires its original immutable tool observation.');
    if (observation.header.kind !== 'tool' || !['input-ready','running','succeeded','failed'].includes(observation.header.phase)
        || sha256(observation.content) !== observation.detail_digest) fail('Material requires its original immutable tool observation.');
    const prefix = nativeActivityBodySchema.parse(JSON.parse(observation.content));
    if (prefix.originalBytes !== event.bytes || prefix.sha256 !== event.sha256 || prefix.mediaType !== event.mediaType) fail('Material differs from its original prefix identity.');
    const totals = (await client.query<{bodies:string;bytes:string;pending:string}>(`SELECT count(*) AS bodies,coalesce(sum(bytes),0) AS bytes,
      count(*) FILTER(WHERE NOT complete) AS pending FROM flow.native_activity_bodies WHERE attempt_id=$1`,[attempt.id])).rows[0]!;
    assertMaterialCapacity({bodies:Number(totals.bodies),bytes:Number(totals.bytes),pending:Number(totals.pending)},event.bytes);
    await client.query(`INSERT INTO flow.native_activity_bodies(activity_id,task_id,attempt_id,native_session_id,bytes,sha256,media_type)
      VALUES($1,$2,$3,$4,$5,$6,$7)`,[event.activityId,task.id,attempt.id,event.nativeSessionId,event.bytes,event.sha256,event.mediaType]);
    return;
  }
  if (!prior) return fail('Material has not been declared.');
  if (event.action === 'chunk') {
    const content = decodeBodyChunk(event);
    const existing = (await client.query<ChunkRow>('SELECT * FROM flow.native_activity_body_chunks WHERE activity_id=$1 AND chunk_index=$2',[event.activityId,event.index])).rows[0];
    if (existing) {
      if (existing.byte_offset !== event.offset || existing.bytes !== event.bytes || existing.sha256 !== event.sha256 || !existing.content.equals(content)) fail('A received chunk cannot change.');
      return;
    }
    if (prior.complete || event.index !== prior.received_chunks || event.offset !== prior.received_bytes
        || event.bytes !== Math.min(limits.chunkBytes, prior.bytes - prior.received_bytes)) fail('Chunk is late, missing, out of order or has the wrong length.');
    await client.query(`INSERT INTO flow.native_activity_body_chunks(activity_id,chunk_index,byte_offset,bytes,sha256,content)
      VALUES($1,$2,$3,$4,$5,$6)`,[event.activityId,event.index,event.offset,event.bytes,event.sha256,content]);
    await client.query('UPDATE flow.native_activity_bodies SET received_bytes=received_bytes+$2,received_chunks=received_chunks+1 WHERE activity_id=$1',[event.activityId,event.bytes]);
    return;
  }
  if (event.bytes !== prior.bytes || event.sha256 !== prior.sha256) fail('Seal identity differs.');
  if (prior.complete) return;
  if (prior.received_bytes !== prior.bytes || prior.received_chunks !== Math.ceil(prior.bytes / limits.chunkBytes)) fail('Cannot seal an incomplete material.');
  // Exactly one bounded full hash at sealing; never rescan a growing prefix per chunk.
  const chunks = (await client.query<ChunkRow>('SELECT * FROM flow.native_activity_body_chunks WHERE activity_id=$1 ORDER BY chunk_index LIMIT 128',[event.activityId])).rows;
  const full = createHash('sha256');
  let offset = 0;
  for (const [index, chunk] of chunks.entries()) {
    assertStoredChunk(chunk,index,prior.bytes);
    full.update(chunk.content); offset += chunk.bytes;
  }
  if (offset !== prior.bytes || full.digest('hex') !== prior.sha256) fail('Complete material digest differs.');
  const saved = (await client.query<{content:string}>(`SELECT d.content FROM flow.native_activities a JOIN flow.details d ON d.id=a.detail_id WHERE a.id=$1`,[event.activityId])).rows[0]!;
  const prefix = nativeActivityBodySchema.parse(JSON.parse(saved.content));
  if (!(chunks[0]?.content ?? Buffer.alloc(0)).subarray(0,Buffer.byteLength(prefix.content)).equals(Buffer.from(prefix.content))) fail('Complete material does not preserve its original prefix.');
  await client.query('UPDATE flow.native_activity_bodies SET complete=true WHERE activity_id=$1',[event.activityId]);
}

export async function assertNativeActivityBodiesFinalizable(client: PoolClient, attemptId: string): Promise<void> {
  // Older factory/migration consumers have no body protocol enabled. An absent
  // table is legacy; query errors are never interpreted as absence.
  if (!(await client.query<{present:boolean}>("SELECT to_regclass('flow.native_activity_bodies') IS NOT NULL AS present")).rows[0]!.present) return;
  if ((await client.query('SELECT 1 FROM flow.native_activity_bodies WHERE attempt_id=$1 AND NOT complete LIMIT 1',[attemptId])).rowCount) {
    throw new HttpError(409,'activity_body_incomplete','Final delivery must wait for all declared native materials.');
  }
}
