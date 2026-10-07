import type { Pool, PoolClient } from 'pg';
import type { AssistantStreamBlock, AssistantStreamPage, AssistantStreamPatch, AssistantStreamPatchPage, AssistantStreamReference, AssistantStreamData, AssistantStreamSettlement, AssistantStreamProtocol, AssistantStreamSelection, AssistantStreamSelectedPatchPage } from '../../../../packages/contracts/src/assistant-stream.js';
import { canonical, HttpError, sha256, transaction } from '../database.js';
import type { TaskStatus } from '../../../../packages/contracts/src/tasks.js';
import { readPrefix, type BlockRow } from './store.js';
const sources = (protocol:AssistantStreamProtocol) => protocol !== 'patch-v1' ? ['claude.sdk.stream','codex.app-server.stream'] : ['claude.sdk.stream'];
interface TaskHead {current_attempt_id:string|null;status:TaskStatus;updated_at:Date}
interface State {status:string;updated_at:Date;final_id:string|null;completed_at:Date|null}
async function state(client:PoolClient,taskId:string,attemptId:string):Promise<State> {
  const row=(await client.query<State>(`SELECT t.status,t.updated_at,a.completed_at,m.id AS final_id FROM flow.tasks t
    JOIN flow.attempts a ON a.task_id=t.id LEFT JOIN flow.assistant_messages m ON m.task_id=t.id AND m.attempt_id=a.id WHERE t.id=$1 AND a.id=$2`,[taskId,attemptId])).rows[0];
  if(!row) throw new HttpError(404,'stream_attempt','Attempt does not belong to this task.');
  return row;
}
function reference(row:BlockRow,current:State):AssistantStreamReference {
  const ended=current.completed_at!==null||['succeeded','failed','cancelled','uncertain'].includes(current.status);
  const status=current.final_id?'final-available':ended?'interrupted':row.header.phase;
  return {...row.header,id:row.id,taskId:row.task_id,attemptId:row.attempt_id,firstSequence:row.first_sequence,lastSequence:row.last_sequence,
    bytes:row.bytes,createdAt:row.created_at.toISOString(),updatedAt:row.updated_at.toISOString(),status};
}
/** Projection seam for a caller with a durable task binding. No body is fetched. */
export async function readAssistantStream(client:PoolClient,taskId:string,limit:number,after?:string,protocol:AssistantStreamProtocol='patch-v1'):Promise<AssistantStreamPage> {
  const task=(await client.query<TaskHead>('SELECT current_attempt_id,status,updated_at FROM flow.tasks WHERE id=$1',[taskId])).rows[0];
  if(!task) throw new HttpError(404,'not_found','Task not found.');
  const base={taskId,attemptId:task.current_attempt_id,taskStatus:task.status,taskUpdatedAt:task.updated_at.toISOString(),...(protocol==='patch-select-v1'?{protocol:'patch-select-v1' as const}:{})};
  if(!task.current_attempt_id) return {...base,blocks:[],nextCursor:null,finalMessageId:null,settlement:null};
  const current=await state(client,taskId,task.current_attempt_id);
  let cursor=0;
  if(after) {
    const row=(await client.query<{first_sequence:number}>("SELECT first_sequence FROM flow.assistant_stream_blocks WHERE id=$1 AND task_id=$2 AND attempt_id=$3 AND header->>'source'=ANY($4::text[])",[after,taskId,task.current_attempt_id,sources(protocol)])).rows[0];
    if(!row) throw new HttpError(400,'stream_cursor','Cursor does not belong to the current attempt.');
    cursor=row.first_sequence;
  }
  const rows=(await client.query<BlockRow>("SELECT * FROM flow.assistant_stream_blocks WHERE task_id=$1 AND attempt_id=$2 AND first_sequence>$3 AND header->>'source'=ANY($5::text[]) ORDER BY first_sequence LIMIT $4",[taskId,task.current_attempt_id,cursor,limit+1,sources(protocol)])).rows;
  const settlement=(await client.query<{data:AssistantStreamSettlement}>("SELECT data FROM flow.assistant_stream_settlements WHERE task_id=$1 AND attempt_id=$2 AND ($3::boolean OR NOT EXISTS(SELECT 1 FROM flow.assistant_stream_blocks WHERE attempt_id=$2 AND header->>'source'<>'claude.sdk.stream'))",[taskId,task.current_attempt_id,protocol!=='patch-v1'])).rows[0]?.data??null;
  return {...base,settlement,blocks:rows.slice(0,limit).map(row=>reference(row,current)),nextCursor:rows.length>limit?rows[limit-1]!.id:null,finalMessageId:current.final_id};
}
export const assistantStreams=(pool:Pool,taskId:string,limit:number,after?:string,protocol:AssistantStreamProtocol='patch-v1')=>transaction(pool,client=>readAssistantStream(client,taskId,limit,after,protocol),true);
export async function assistantStreamBlock(pool:Pool,taskId:string,id:string,protocol:AssistantStreamProtocol='patch-v1'):Promise<AssistantStreamBlock> {
  return transaction(pool,async client=>{
    const row=(await client.query<BlockRow>("SELECT * FROM flow.assistant_stream_blocks WHERE id=$1 AND task_id=$2 AND header->>'source'=ANY($3::text[])",[id,taskId,sources(protocol)])).rows[0];
    if(!row) throw new HttpError(404,'stream_not_found','Text block does not belong to this task.');
    const content=await readPrefix(client,id);
    if(sha256(content)!==row.header.prefixDigest||Buffer.byteLength(content)!==row.bytes) throw new HttpError(409,'stream_content','Stored text no longer matches its prefix digest.');
    return {...reference(row,await state(client,taskId,row.attempt_id)),content};
  },true);
}
export async function assistantStreamPatches(pool:Pool,taskId:string,attemptId:string,after:number,limit:number,protocol:AssistantStreamProtocol='patch-v1',selection:AssistantStreamSelection={kind:'text'}):Promise<AssistantStreamPatchPage | AssistantStreamSelectedPatchPage> {
  return transaction(pool,async client=>{
    await state(client,taskId,attemptId);
    const selected=protocol==='patch-select-v1';
    const filter=selected ? (selection.kind==='text' ? " AND (data->>'source'='claude.sdk.stream' OR data->>'channel'='text')" : " AND data->>'streamId'=$6") : '';
    const args:unknown[]=[taskId,attemptId,after,limit+1,sources(protocol)];
    if(selected && selection.kind==='block') args.push(selection.streamId);
    const rows=(await client.query<{data:AssistantStreamData;sequence:number;event_id:string;created_at:Date;payload_digest:string}>(`SELECT data,sequence,event_id,created_at,payload_digest FROM flow.assistant_stream_patches
      WHERE task_id=$1 AND attempt_id=$2 AND sequence>$3 AND data->>'source'=ANY($5::text[])${filter} ORDER BY sequence LIMIT $4`,args)).rows;
    if(rows.some(row=>sha256(canonical(row.data))!==row.payload_digest)) throw new HttpError(409,'stream_content','Stored patch no longer matches its digest.');
    const patches:AssistantStreamPatch[]=rows.slice(0,limit).map(row=>({...row.data,taskId,attemptId,eventId:row.event_id,sequence:row.sequence,createdAt:row.created_at.toISOString()}));
    return {taskId,attemptId,patches,nextCursor:patches.at(-1)?.sequence??after,hasMore:rows.length>limit,...(selected?{protocol:'patch-select-v1' as const,selection:{...selection}}:{})};
  },true);
}
