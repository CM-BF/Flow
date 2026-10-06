import type { Pool, PoolClient } from 'pg';
import type { RunnerEvent } from '@flow/contracts';
import type { AssistantMessage, AssistantMessagePage, AssistantMessageReference, AssistantSettings } from '../../../../packages/contracts/src/assistant.js';
import { HttpError, sha256, transaction } from '../database.js';
import { saveDetail } from '../evidence.js';
import { loadTask, type TaskRecord } from '../tasks.js';
import type { AttemptRecord } from '../runners.js';

type FinalEvent = Extract<RunnerEvent, { type: 'assistant-final' }>;
interface MessageRow {
  id: string; ordinal: string; task_id: string; attempt_id: string; event_id: string; sequence: number;
  native_session_id: string; source: 'claude.sdk.result'; source_message_id: string; content_digest: string;
  detail_id: string; settings: AssistantSettings; created_at: Date;
}
const columns = 'id,ordinal,task_id,attempt_id,event_id,sequence,native_session_id,source,source_message_id,content_digest,detail_id,created_at';
export async function saveAssistantFinal(client: PoolClient, task: TaskRecord, attempt: AttemptRecord, event: FinalEvent) {
  if (task.submission.harness !== 'claude' || attempt.native_session_id !== event.nativeSessionId) throw new HttpError(409, 'assistant_session_mismatch', 'Assistant final must match the recorded native session of this Claude attempt.');
  const session = await client.query('SELECT 1 FROM flow.sessions WHERE id=$1 AND harness=$2 AND runner_id=$3 AND active_task_id=$4', [event.nativeSessionId, 'claude', attempt.runner_id, task.id]);
  if (!session.rowCount) throw new HttpError(409, 'assistant_session_mismatch', 'Assistant session is not assigned to this task and runner.');
  if (event.messageId !== sha256(JSON.stringify([event.nativeSessionId, event.sourceMessageId]))) throw new HttpError(409, 'assistant_identity', 'Assistant message ID does not match its native source.');
  const existing = await client.query('SELECT 1 FROM flow.assistant_messages WHERE id=$1 OR attempt_id=$2', [event.messageId, attempt.id]);
  if (existing.rowCount) throw new HttpError(409, 'assistant_conflict', 'An assistant final cannot be replaced or reused by another event or attempt.');
  const reference = await saveDetail(client, task.id, attempt.id, { title: 'Assistant reply', kind: 'detail', content: event.content, mediaType: 'text/plain' });
  await client.query(`INSERT INTO flow.assistant_messages(id,task_id,attempt_id,event_id,sequence,native_session_id,source,source_message_id,content_digest,detail_id,settings)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`, [event.messageId, task.id, attempt.id, event.id, event.sequence, event.nativeSessionId, event.source, event.sourceMessageId, sha256(event.content), reference.id, event.settings]);
  return reference;
}
function reference(row: MessageRow): AssistantMessageReference {
  return { id: row.id, taskId: row.task_id, attemptId: row.attempt_id, eventId: row.event_id, sequence: row.sequence,
    nativeSessionId: row.native_session_id, source: row.source, sourceMessageId: row.source_message_id, contentDigest: row.content_digest,
    detail: { id: row.detail_id, title: 'Assistant reply' }, createdAt: row.created_at.toISOString() };
}
async function withContent(client: PoolClient, row: MessageRow): Promise<AssistantMessage> {
  const detail = (await client.query<{ content: string }>('SELECT content FROM flow.details WHERE id=$1 AND task_id=$2 AND attempt_id=$3', [row.detail_id, row.task_id, row.attempt_id])).rows[0];
  if (!detail || sha256(detail.content) !== row.content_digest) throw new HttpError(409, 'assistant_content_mismatch', 'The stored assistant content no longer matches its source digest.');
  return { ...reference(row), content: detail.content, settings: row.settings };
}
/** Caller supplies its persisted task+attempt binding; task success/verification remain separate facts. */
export async function readAssistantFinal(client: PoolClient, taskId: string, attemptId: string): Promise<AssistantMessage | null> {
  const row = (await client.query<MessageRow>(`SELECT ${columns},settings FROM flow.assistant_messages WHERE task_id=$1 AND attempt_id=$2`, [taskId, attemptId])).rows[0];
  return row ? withContent(client, row) : null;
}
export interface AssistantFinalPreview extends AssistantMessageReference {
  text: string;
  truncated: boolean;
  settings: AssistantSettings;
}
/** Validate the entire stored UTF-8 body at read time, transferring only its bounded prefix. */
export async function readAssistantFinalPreview(client: PoolClient, taskId: string, attemptId: string): Promise<AssistantFinalPreview | null> {
  const row = (await client.query<MessageRow>(`SELECT ${columns},settings FROM flow.assistant_messages WHERE task_id=$1 AND attempt_id=$2`, [taskId, attemptId])).rows[0];
  if (!row) return null;
  const detail = (await client.query<{ prefix: string; has_more: boolean; digest: string }>(`SELECT left(content,4000) AS prefix, char_length(content)>4000 AS has_more,
    encode(sha256(convert_to(content,'UTF8')),'hex') AS digest
    FROM flow.details WHERE id=$1 AND task_id=$2 AND attempt_id=$3`, [row.detail_id, row.task_id, row.attempt_id])).rows[0];
  if (!detail || detail.digest !== row.content_digest) throw new HttpError(409, 'assistant_content_mismatch', 'The stored assistant content no longer matches its source digest.');
  // PostgreSQL counts Unicode characters; keep the existing UTF-16 preview boundary after transfer.
  const text = detail.prefix.slice(0, 4000).replace(/[\uD800-\uDBFF]$/, '');
  return { ...reference(row), text, truncated: detail.has_more || text.length < detail.prefix.length, settings: row.settings };
}
export async function assistantMessage(pool: Pool, messageId: string): Promise<AssistantMessage> {
  return transaction(pool, async client => {
    const row = (await client.query<MessageRow>(`SELECT ${columns},settings FROM flow.assistant_messages WHERE id=$1`, [messageId])).rows[0];
    if (!row) throw new HttpError(404, 'assistant_not_found', 'Assistant message not found.');
    return withContent(client, row);
  }, true);
}
export async function assistantMessages(pool: Pool, taskId: string, limit: number, after?: string): Promise<AssistantMessagePage> {
  return transaction(pool, async client => {
    await loadTask(client, taskId);
    let ordinal = '0';
    if (after) {
      const cursor = (await client.query<{ ordinal: string }>('SELECT ordinal FROM flow.assistant_messages WHERE id=$1 AND task_id=$2', [after, taskId])).rows[0];
      if (!cursor) throw new HttpError(400, 'assistant_cursor', 'The cursor does not belong to this task.');
      ordinal = cursor.ordinal;
    }
    const rows = (await client.query<MessageRow>(`SELECT ${columns} FROM flow.assistant_messages WHERE task_id=$1 AND ordinal>$2 ORDER BY ordinal LIMIT $3`, [taskId, ordinal, limit + 1])).rows;
    const page = rows.slice(0, limit);
    return { messages: page.map(reference), nextCursor: rows.length > limit ? page.at(-1)!.id : null };
  }, true);
}
