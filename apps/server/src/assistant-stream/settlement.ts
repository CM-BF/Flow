import type { PoolClient } from 'pg';
import type { AssistantStreamMarker, AssistantStreamSettlement } from '../../../../packages/contracts/src/assistant-stream.js';
import type { TaskRecord } from '../tasks.js';
import type { AttemptRecord } from '../runners.js';
import { canonical, HttpError, sha256 } from '../database.js';
import type { BlockRow } from './store.js';
export async function saveAssistantStreamMarker(client:PoolClient,task:TaskRecord,attempt:AttemptRecord,event:AssistantStreamMarker & {id:string;sequence:number}):Promise<void> {
  const {id:_id,sequence,...data}=event;
  const identity=sha256(JSON.stringify([data.nativeSessionId,data.sourceMessageId,data.kind,data.toolUseId,data.reason]));
  if(task.submission.harness!=='claude'||attempt.native_session_id!==data.nativeSessionId||data.markerId!==identity) throw new HttpError(409,'stream_marker_identity','Marker must belong to this recorded native session.');
  if((data.kind==='tool-boundary') !== (data.toolUseId!==null) || (data.kind==='unavailable') !== (data.reason!==null)) throw new HttpError(400,'stream_marker_shape','Invalid stream marker.');
  if((await client.query('SELECT 1 FROM flow.assistant_messages WHERE attempt_id=$1',[attempt.id])).rowCount) throw new HttpError(409,'stream_final','Stream markers cannot follow the canonical final.');
  const digest=sha256(canonical(data));
  const prior=(await client.query<{attempt_id:string;payload_digest:string}>('SELECT attempt_id,payload_digest FROM flow.assistant_stream_markers WHERE id=$1',[data.markerId])).rows[0];
  if(prior) {
    if(prior.attempt_id!==attempt.id||prior.payload_digest!==digest) throw new HttpError(409,'stream_marker_conflict','A stream marker cannot change or move attempts.');
    return;
  }
  if(Number((await client.query<{count:string}>('SELECT count(*) AS count FROM flow.assistant_stream_markers WHERE attempt_id=$1',[attempt.id])).rows[0]!.count)>=512) throw new HttpError(409,'stream_limit','Too many stream markers.');
  await client.query('INSERT INTO flow.assistant_stream_markers(id,task_id,attempt_id,sequence,data,payload_digest) VALUES($1,$2,$3,$4,$5,$6)',[data.markerId,task.id,attempt.id,sequence,data,digest]);
}
/** Presentation policy, not provider message identity. Called in the final's existing report transaction. */
export async function settleAssistantStream(client:PoolClient,task:TaskRecord,attempt:AttemptRecord,finalMessageId:string):Promise<void> {
  const blocks=(await client.query<BlockRow>('SELECT * FROM flow.assistant_stream_blocks WHERE task_id=$1 AND attempt_id=$2 ORDER BY first_sequence',[task.id,attempt.id])).rows;
  const markers=(await client.query<{sequence:number;data:AssistantStreamMarker}>('SELECT sequence,data FROM flow.assistant_stream_markers WHERE task_id=$1 AND attempt_id=$2 ORDER BY sequence',[task.id,attempt.id])).rows;
  let unavailable:AssistantStreamSettlement['unavailableReason']=blocks.length?null:'no-draft';
  if(blocks.some(block=>block.header.phase!=='block-complete'&&block.header.phase!=='superseded')||markers.some(marker=>marker.data.kind==='unavailable')) unavailable='incomplete-stream';
  const tools=markers.filter(marker=>marker.data.kind==='tool-boundary');
  for(const marker of tools) {
    const proof=await client.query("SELECT 1 FROM flow.native_activities WHERE task_id=$1 AND attempt_id=$2 AND native_session_id=$3 AND tool_use_id=$4 AND parent_tool_use_id IS NULL AND phase='input-ready'",[task.id,attempt.id,marker.data.nativeSessionId,marker.data.toolUseId]);
    if(!proof.rowCount) unavailable='missing-tool-evidence';
  }
  // A root tool observation without an ordered marker cannot safely classify preceding buffered text.
  const observed=(await client.query<{tool_use_id:string}>("SELECT tool_use_id FROM flow.native_activities WHERE task_id=$1 AND attempt_id=$2 AND parent_tool_use_id IS NULL AND phase='input-ready'",[task.id,attempt.id])).rows;
  if(observed.some(tool=>!tools.some(marker=>marker.data.toolUseId===tool.tool_use_id))) unavailable='missing-tool-evidence';
  const boundary=tools.at(-1)?.sequence??0;
  if(boundary && (await client.query(`SELECT 1 FROM flow.assistant_stream_blocks b JOIN flow.assistant_stream_patches p ON p.stream_id=b.id
    WHERE b.attempt_id=$1 AND b.first_sequence<$2 AND p.sequence>$2 AND octet_length(p.data->>'text')>0 LIMIT 1`,[attempt.id,boundary])).rowCount) unavailable='crossed-tool-boundary';
  const nativeFinal = task.submission.harness === 'codex'
    ? (await client.query<{native_source_identity:{turnId:string;itemId:string}}>('SELECT native_source_identity FROM flow.assistant_messages WHERE id=$1 AND task_id=$2 AND attempt_id=$3', [finalMessageId,task.id,attempt.id])).rows[0]?.native_source_identity
    : undefined;
  if(task.submission.harness === 'codex' && !nativeFinal) unavailable='incomplete-stream';
  const retain=blocks.filter(block=>unavailable || block.first_sequence<boundary || block.header.phase==='superseded' || (block.header.source==='codex.app-server.stream' && (block.header.channel!=='text' || block.header.nativeTurnId!==nativeFinal?.turnId || block.header.nativeMessageId!==nativeFinal?.itemId))).map(block=>block.id);
  const keep=new Set(retain);
  const data:AssistantStreamSettlement={policy:'flow.assistant-draft',policyVersion:'1',correlation:unavailable?'unavailable':'presentation-policy',unavailableReason:unavailable,
    taskId:task.id,attemptId:attempt.id,nativeSessionId:attempt.native_session_id!,finalMessageId,retainStreamIds:retain,replaceStreamIds:blocks.filter(block=>!keep.has(block.id)).map(block=>block.id)};
  await client.query('INSERT INTO flow.assistant_stream_settlements(attempt_id,task_id,final_id,data) VALUES($1,$2,$3,$4)',[attempt.id,task.id,finalMessageId,data]);
}
