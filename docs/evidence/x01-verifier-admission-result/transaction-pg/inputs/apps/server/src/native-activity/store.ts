import type { Pool, PoolClient } from 'pg';
import type { Reference } from '@flow/contracts';
import { nativeActivityDataSchema, type NativeActivity, type NativeActivityData, type NativeActivityPage, type NativeActivityReference } from '../../../../packages/contracts/src/native-activity.js';
import { canonical, HttpError, sha256, transaction } from '../database.js';
import { saveDetail } from '../evidence.js';
import { loadTask, type TaskRecord } from '../tasks.js';
import type { AttemptRecord } from '../runners.js';
export type NativeActivityEvent = NativeActivityData & { id: string; sequence: number };
interface ActivityRow {
  id: string; ordinal: string; task_id: string; attempt_id: string; event_id: string; sequence: number;
  header: Omit<NativeActivityData,'type'|'body'>; payload_digest: string; detail_id: string; detail_digest: string;
  created_at: Date; task_status: string; completed_at: Date | null; latest_phase: NativeActivityData['phase'];
}
const readColumns = `a.*,t.status AS task_status,p.completed_at,
  COALESCE((SELECT n.phase FROM flow.native_activities n WHERE n.attempt_id=a.attempt_id AND n.tool_use_id=a.tool_use_id
    AND n.parent_tool_use_id IS NOT DISTINCT FROM a.parent_tool_use_id
    ORDER BY (n.phase IN ('succeeded','failed')) DESC,n.ordinal DESC LIMIT 1),a.phase) AS latest_phase`;
const readFrom = 'flow.native_activities a JOIN flow.tasks t ON t.id=a.task_id JOIN flow.attempts p ON p.id=a.attempt_id';
const fail = (code: string, message: string): never => { throw new HttpError(409,code,message); };
/** Existing reportEvents owns runner/task/attempt locks and the transaction. */
export async function saveNativeActivity(client: PoolClient, task: TaskRecord, attempt: AttemptRecord, event: NativeActivityEvent): Promise<Reference | null> {
  const { id: eventId, sequence, ...candidate } = event;
  const parsed = nativeActivityDataSchema.safeParse(candidate);
  if (!parsed.success) throw new HttpError(400,'invalid_native_activity','Invalid native activity.');
  const data = parsed.data;
  if (task.submission.harness !== 'claude' || attempt.native_session_id !== data.nativeSessionId) fail('activity_session','Activity must match the recorded Claude session.');
  if (!(await client.query('SELECT 1 FROM flow.sessions WHERE id=$1 AND harness=$2 AND runner_id=$3 AND active_task_id=$4',[data.nativeSessionId,'claude',attempt.runner_id,task.id])).rowCount) fail('activity_session','Session is not assigned to this runner and task.');
  if (data.activityId !== sha256(JSON.stringify([data.nativeSessionId,data.sourceMessageId,data.blockIndex,data.kind]))) fail('activity_identity','Activity ID does not match its source.');
  if (data.body && !data.body.truncated && sha256(data.body.content) !== data.body.sha256) fail('activity_digest','Activity body digest does not match.');
  const payloadDigest = sha256(canonical(data));
  const prior = (await client.query<{attempt_id:string;payload_digest:string}>(`SELECT attempt_id,payload_digest FROM flow.native_activities
    WHERE id=$1 OR (native_session_id=$2 AND header->>'sourceMessageId'=$3 AND (header->>'blockIndex')::integer=$4)`,
    [data.activityId,data.nativeSessionId,data.sourceMessageId,data.blockIndex])).rows[0];
  if (prior) {
    if (prior.attempt_id !== attempt.id || prior.payload_digest !== payloadDigest) fail('activity_conflict','Native source was reused by another attempt or with changed content.');
    return null; // SDK re-emission with a fresh transport envelope is still one observation.
  }
  await validateToolLink(client,attempt.id,data);
  const { type: _type, body, ...header } = data;
  const title = data.kind === 'tool' ? `Tool: ${data.toolName ?? data.toolUseId}` : data.kind === 'thinking' ? 'Native thinking' : data.kind === 'assistant-text' ? 'Assistant activity' : 'Unsupported native activity';
  const content = JSON.stringify(body);
  const detail = await saveDetail(client,task.id,attempt.id,{title:title.slice(0,180),kind:'detail',content,mediaType:'application/json'});
  await client.query(`INSERT INTO flow.native_activities(id,task_id,attempt_id,event_id,sequence,native_session_id,tool_use_id,parent_tool_use_id,phase,header,payload_digest,detail_id,detail_digest)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,[data.activityId,task.id,attempt.id,eventId,sequence,data.nativeSessionId,data.toolUseId,data.parentToolUseId,data.phase,header,payloadDigest,detail.id,sha256(content)]);
  return {...detail,activity:{kind:'native-activity',activityId:data.activityId}};
}
async function validateToolLink(client: PoolClient, attemptId: string, data: NativeActivityData): Promise<void> {
  if (data.parentToolUseId) {
    const parent = await client.query("SELECT 1 FROM flow.native_activities WHERE attempt_id=$1 AND tool_use_id=$2 AND phase='input-ready'",[attemptId,data.parentToolUseId]);
    if (!parent.rowCount) fail('activity_parent','Parent tool was not observed in this attempt.');
  }
  if (data.kind !== 'tool') return;
  const latest = (await client.query<{phase:string}>(`SELECT phase FROM flow.native_activities WHERE attempt_id=$1 AND tool_use_id=$2
    ORDER BY (phase IN ('succeeded','failed')) DESC,ordinal DESC LIMIT 1`,[attemptId,data.toolUseId])).rows[0];
  if (data.phase === 'input-ready') {
    if (latest) fail('activity_tool_conflict','A tool call cannot be introduced twice.');
    return;
  }
  const input = (await client.query<{parent_tool_use_id:string|null;header:ActivityRow['header']}>("SELECT parent_tool_use_id,header FROM flow.native_activities WHERE attempt_id=$1 AND tool_use_id=$2 AND phase='input-ready' LIMIT 1",[attemptId,data.toolUseId])).rows[0];
  if (!input || input.parent_tool_use_id !== data.parentToolUseId || (data.toolName !== null && data.toolName !== input.header.toolName)) fail('activity_tool_link','Tool result/progress does not match an input in this attempt and parent.');
  if (data.phase !== 'running' && latest && ['succeeded','failed'].includes(latest.phase)) fail('activity_tool_terminal','A terminal tool observation cannot be changed.');
}
function reference(row: ActivityRow): NativeActivityReference {
  const unresolved = row.header.kind === 'tool' && !['succeeded','failed'].includes(row.latest_phase);
  const ended = row.completed_at !== null || ['succeeded','failed','cancelled','uncertain'].includes(row.task_status);
  return {...row.header,id:row.id,taskId:row.task_id,attemptId:row.attempt_id,eventId:row.event_id,sequence:row.sequence,createdAt:row.created_at.toISOString(),
    detail:{id:row.detail_id,title:'Native activity'},status:unresolved && ended?'unknown':row.latest_phase};
}
export async function nativeActivities(pool: Pool, taskId: string, limit: number, after?: string): Promise<NativeActivityPage> {
  return transaction(pool,async client=>{
    await loadTask(client,taskId);
    let ordinal='0';
    if (after) {
      const cursor=(await client.query<{ordinal:string}>('SELECT ordinal FROM flow.native_activities WHERE id=$1 AND task_id=$2',[after,taskId])).rows[0];
      if (!cursor) throw new HttpError(400,'activity_cursor','Cursor does not belong to this task.');
      ordinal=cursor.ordinal;
    }
    const rows=(await client.query<ActivityRow>(`SELECT ${readColumns} FROM ${readFrom} WHERE a.task_id=$1 AND a.ordinal>$2 ORDER BY a.ordinal LIMIT $3`,[taskId,ordinal,limit+1])).rows;
    return {activities:rows.slice(0,limit).map(reference),nextCursor:rows.length>limit?rows[limit-1]!.id:null};
  },true);
}
export async function nativeActivity(pool: Pool, id: string): Promise<NativeActivity> {
  return transaction(pool,async client=>{
    const row=(await client.query<ActivityRow>(`SELECT ${readColumns} FROM ${readFrom} WHERE a.id=$1`,[id])).rows[0];
    if (!row) throw new HttpError(404,'activity_not_found','Native activity not found.');
    const detail=(await client.query<{content:string}>('SELECT content FROM flow.details WHERE id=$1 AND task_id=$2 AND attempt_id=$3',[row.detail_id,row.task_id,row.attempt_id])).rows[0];
    if (!detail || sha256(detail.content)!==row.detail_digest) return fail('activity_content','Stored native content no longer matches its digest.');
    return {...reference(row),body:JSON.parse(detail.content)};
  },true);
}
