import type { PoolClient } from 'pg';
import type { Reference } from '@flow/contracts';
import { ASSISTANT_ATTEMPT_BYTES, assistantStreamDataSchema, assistantStreamIdentity, type AssistantStreamData } from '../../../../packages/contracts/src/assistant-stream.js';
import { canonical, HttpError, sha256 } from '../database.js';
import type { TaskRecord } from '../tasks.js';
import type { AttemptRecord } from '../runners.js';
export type StreamEvent = AssistantStreamData & {id:string;sequence:number};
export interface BlockRow {
  id:string;task_id:string;attempt_id:string;first_sequence:number;last_sequence:number;revision:number;bytes:number;
  header:Omit<AssistantStreamData,'type'|'text'|'fromBytes'>;created_at:Date;updated_at:Date;
}
const fail=(code:string,message:string):never=>{throw new HttpError(409,code,message);};
/** Existing report transaction holds runner/task/attempt locks, including across concurrent patches. */
export async function saveAssistantStream(client:PoolClient,task:TaskRecord,attempt:AttemptRecord,event:StreamEvent):Promise<Reference|null> {
  const {id:eventId,sequence,...input}=event;
  const parsed=assistantStreamDataSchema.safeParse(input);
  if(!parsed.success) throw new HttpError(400,'invalid_assistant_stream','Invalid assistant text patch.');
  const data=parsed.data;
  const harness = data.source === 'claude.sdk.stream' ? 'claude' : 'codex';
  if(task.submission.harness!==harness||attempt.native_session_id!==data.nativeSessionId) fail('stream_session','Text must match this native attempt session and source.');
  const assigned=await client.query('SELECT 1 FROM flow.sessions WHERE id=$1 AND runner_id=$2 AND active_task_id=$3 AND harness=$4',[data.nativeSessionId,attempt.runner_id,task.id,harness]);
  if(!assigned.rowCount) fail('stream_session','Native session is not assigned to this runner and task.');
  if(data.streamId!==sha256(assistantStreamIdentity(data))) fail('stream_identity','Text block identity does not match its native source.');
  const payloadDigest=sha256(canonical(data));
  const prior=(await client.query<{attempt_id:string;payload_digest:string}>('SELECT attempt_id,payload_digest FROM flow.assistant_stream_patches WHERE stream_id=$1 AND revision=$2',[data.streamId,data.revision])).rows[0];
  if(prior) {
    if(prior.attempt_id!==attempt.id||prior.payload_digest!==payloadDigest) fail('stream_conflict','A sealed text patch cannot change or move to another attempt.');
    return null;
  }
  if((await client.query('SELECT 1 FROM flow.assistant_messages WHERE attempt_id=$1',[attempt.id])).rowCount) fail('stream_final','Text patches cannot follow the canonical final.');
  const row=(await client.query<BlockRow>('SELECT * FROM flow.assistant_stream_blocks WHERE id=$1',[data.streamId])).rows[0];
  if(row && (row.task_id!==task.id||row.attempt_id!==attempt.id)) fail('stream_conflict','A native block cannot move to another attempt.');
  if(data.revision!==(row?.revision??0)+1||data.fromBytes!==(row?.bytes??0)) fail('stream_gap','Text revision and UTF-8 offset must extend the durable prefix.');
  if(row?.header.phase!=='streaming' && row && (data.text!==''||data.phase==='streaming'||data.phase==='block-complete')) fail('stream_closed','Closed blocks accept only explicit incomplete/superseded observations.');
  if(row?.header.phase==='superseded' && data.phase!=='superseded') fail('stream_superseded','A replaced block cannot become current again.');
  const totals=(await client.query<{bytes:string;blocks:string}>('SELECT COALESCE(sum(bytes),0) AS bytes,count(*) AS blocks FROM flow.assistant_stream_blocks WHERE attempt_id=$1',[attempt.id])).rows[0]!;
  const patchCount=(await client.query<{count:string}>('SELECT count(*) AS count FROM flow.assistant_stream_patches WHERE attempt_id=$1',[attempt.id])).rows[0]!;
  const added=Buffer.byteLength(data.text);
  if(Number(totals.bytes)+added>ASSISTANT_ATTEMPT_BYTES||(!row&&Number(totals.blocks)>=256)||Number(patchCount.count)>=4096) fail('stream_limit','Assistant stream attempt limit exceeded.');
  // Keep the full ordered-prefix check inside this transaction without returning its body.
  const checked=(await client.query<{digest:string}>(`SELECT encode(sha256(convert_to(
    COALESCE(string_agg(data->>'text','' ORDER BY revision),'') || $2::text,'UTF8')),'hex') AS digest
    FROM flow.assistant_stream_patches WHERE stream_id=$1`,[data.streamId,data.text])).rows[0]!;
  if(checked.digest!==data.prefixDigest) fail('stream_digest','Text prefix digest does not match.');
  const {type:_type,text:_text,fromBytes:_from,...header}=data;
  if(row) await client.query('UPDATE flow.assistant_stream_blocks SET last_sequence=$2,revision=$3,bytes=$4,header=$5,updated_at=clock_timestamp() WHERE id=$1',[data.streamId,sequence,data.revision,data.fromBytes+added,header]);
  else await client.query('INSERT INTO flow.assistant_stream_blocks(id,task_id,attempt_id,first_sequence,last_sequence,revision,bytes,header) VALUES($1,$2,$3,$4,$4,$5,$6,$7)',[data.streamId,task.id,attempt.id,sequence,data.revision,added,header]);
  await client.query('INSERT INTO flow.assistant_stream_patches(stream_id,revision,task_id,attempt_id,event_id,sequence,data,payload_digest) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[data.streamId,data.revision,task.id,attempt.id,eventId,sequence,data,payloadDigest]);
  return {id:data.streamId,title:'Assistant text',stream:{kind:'assistant-stream',streamId:data.streamId,revision:data.revision}};
}
export async function readPrefix(client:PoolClient,id:string):Promise<string> {
  return (await client.query<{content:string}>("SELECT COALESCE(string_agg(data->>'text','' ORDER BY revision),'') AS content FROM flow.assistant_stream_patches WHERE stream_id=$1",[id])).rows[0]!.content;
}
