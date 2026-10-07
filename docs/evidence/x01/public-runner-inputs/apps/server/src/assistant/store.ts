import { assertClaudeTurnSettingsMatch } from '../../../../packages/contracts/src/claude-turn-settings.js';
import { checkTaskMessageSettings } from '../conversations/message-settings.js';
import type { Pool, PoolClient } from 'pg';
import type { RunnerEvent } from '@flow/contracts';
import type { AssistantMessage, AssistantMessagePage, AssistantMessageReference } from '../../../../packages/contracts/src/assistant.js';
import { claudeAssistantSettingsSchema, codexAssistantSettingsSchema, codexSourceIdentitySchema } from '../../../../packages/contracts/src/assistant.js';
import { runnerEventSchema } from '../../../../packages/contracts/src/runner.js';
import { assistantSourcePolicy, validAssistantIdentity } from '../native-harness-policy.js';
import { requireExecutionProfile } from '../execution-profiles/store.js';
import { HttpError, sha256, transaction } from '../database.js';
import { saveDetail } from '../evidence.js';
import { loadTask, type TaskRecord } from '../tasks.js';
import type { AttemptRecord } from '../runners.js';

type FinalEvent = Extract<RunnerEvent, { type: 'assistant-final' }>;
interface MessageRow {
  id: string; ordinal: string; task_id: string; attempt_id: string; event_id: string; sequence: number;
  native_session_id: string; source: AssistantMessageReference['source']; native_source_identity: unknown; source_message_id: string; content_digest: string;
  detail_id: string; settings: unknown; created_at: Date;
}
const columns = 'id,ordinal,task_id,attempt_id,event_id,sequence,native_session_id,source,source_message_id,content_digest,detail_id,created_at,native_source_identity';
export async function saveAssistantFinal(client: PoolClient, task: TaskRecord, attempt: AttemptRecord, event: FinalEvent) {
  const policy = assistantSourcePolicy(task.submission.harness, event.source);
  if (!policy || attempt.native_session_id !== event.nativeSessionId) throw new HttpError(409, 'assistant_session_mismatch', 'Assistant final must match the recorded native session and harness of this attempt.');
  const session = await client.query('SELECT 1 FROM flow.sessions WHERE id=$1 AND harness=$2 AND runner_id=$3 AND active_task_id=$4', [event.nativeSessionId, policy.harness, attempt.runner_id, task.id]);
  if (!session.rowCount) throw new HttpError(409, 'assistant_session_mismatch', 'Assistant session is not assigned to this task and runner.');
  if (!validAssistantIdentity(event)) throw new HttpError(409, 'assistant_identity', 'Assistant message ID does not match its native source.');
  await requireRecognizedSessionSource(client, task.id, attempt.id, event.nativeSessionId, policy.adapterVersion);
  if (event.source === 'claude.sdk.result') {
    const requested = task.submission.messageSettings;
    if (requested) {
      if (!task.submission.executionProfile || !('messageSettings' in event.settings)) throw new HttpError(409, 'assistant_configuration_mismatch', 'Assistant final did not confirm the frozen message settings.');
      const profile = await requireExecutionProfile(client, task.submission.executionProfile);
      if (profile.reference.runnerId !== attempt.runner_id || !checkTaskMessageSettings(task.submission, profile).ok) throw new HttpError(409, 'assistant_configuration_mismatch', 'Assistant final does not match its configured runner.');
      try { assertClaudeTurnSettingsMatch(requested, event.settings.messageSettings.snapshot); }
      catch { throw new HttpError(409, 'assistant_configuration_mismatch', 'Assistant final did not confirm the frozen message settings.'); }
    } else if ('messageSettings' in event.settings) throw new HttpError(409, 'assistant_configuration_mismatch', 'A legacy task cannot report message settings.');
  }
  if (event.source === 'codex.app-server.agent-message') {
    await requireCodexFinalConfiguration(client, task, attempt, event, policy.adapterVersion);
  }
  const existing = await client.query('SELECT 1 FROM flow.assistant_messages WHERE id=$1 OR attempt_id=$2', [event.messageId, attempt.id]);
  if (existing.rowCount) throw new HttpError(409, 'assistant_conflict', 'An assistant final cannot be replaced or reused by another event or attempt.');
  const reference = await saveDetail(client, task.id, attempt.id, { title: 'Assistant reply', kind: 'detail', content: event.content, mediaType: 'text/plain' });
  await client.query(`INSERT INTO flow.assistant_messages(id,task_id,attempt_id,event_id,sequence,native_session_id,source,source_message_id,content_digest,detail_id,settings,native_source_identity)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`, [event.messageId, task.id, attempt.id, event.id, event.sequence, event.nativeSessionId, event.source, event.sourceMessageId, sha256(event.content), reference.id, event.settings, event.source === 'codex.app-server.agent-message' ? event.nativeSourceIdentity : null]);
  return reference;
}
async function requireCodexFinalConfiguration(client: PoolClient, task: TaskRecord, attempt: AttemptRecord,
  event: Extract<FinalEvent, { source: 'codex.app-server.agent-message' }>, adapterVersion: string): Promise<void> {
  if (!task.submission.executionProfile) throw new HttpError(409, 'execution_profile_required', 'Codex final requires a pinned profile.');
  const profile = await requireExecutionProfile(client, task.submission.executionProfile);
  const configuration = profile.configuration;
  if (configuration.harness !== 'codex' || profile.reference.runnerId !== attempt.runner_id || configuration.adapterVersion !== adapterVersion) {
    throw new HttpError(409, 'profile_harness_mismatch', 'Codex final does not match this configured runner.');
  }
  const requested = event.settings.requested;
  if (requested.model !== configuration.model || requested.reasoningEffort !== configuration.reasoningEffort || requested.serviceTier !== configuration.serviceTier
    || requested.serviceTierForTurn !== configuration.serviceTierForTurn || requested.access !== configuration.access
    || Buffer.byteLength(event.content, 'utf8') > configuration.hostLimits.maxOutputBytes) {
    throw new HttpError(409, 'assistant_configuration_mismatch', 'Codex final does not match its requested profile and host output bound.');
  }
}
async function requireRecognizedSessionSource(client: PoolClient, taskId: string, attemptId: string, nativeSessionId: string, adapterVersion: string): Promise<void> {
  const evidence = await client.query<{ content: string }>("SELECT content FROM flow.details WHERE task_id=$1 AND attempt_id=$2 AND kind='session' LIMIT 2", [taskId, attemptId]);
  let raw: unknown;
  try { raw = evidence.rows.length === 1 ? JSON.parse(evidence.rows[0]!.content) : null; } catch { raw = null; }
  const parsed = runnerEventSchema.safeParse(raw);
  if (!parsed.success || parsed.data.type !== 'session' || parsed.data.adapterVersion !== adapterVersion || parsed.data.nativeSessionId !== nativeSessionId) {
    throw new HttpError(409, 'assistant_source_mismatch', 'Assistant final requires one matching recognized session event.');
  }
}

function reference(row: MessageRow): AssistantMessageReference {
  if (!validAssistantIdentity({ source: row.source, messageId: row.id, nativeSessionId: row.native_session_id,
    sourceMessageId: row.source_message_id, nativeSourceIdentity: row.native_source_identity })) {
    throw new HttpError(409, 'assistant_identity', 'The stored assistant identity no longer matches its source.');
  }
  const common = { id: row.id, taskId: row.task_id, attemptId: row.attempt_id, eventId: row.event_id, sequence: row.sequence,
    nativeSessionId: row.native_session_id, sourceMessageId: row.source_message_id, contentDigest: row.content_digest,
    detail: { id: row.detail_id, title: 'Assistant reply' }, createdAt: row.created_at.toISOString() };
  return row.source === 'claude.sdk.result' ? { ...common, source: row.source }
    : { ...common, source: row.source, nativeSourceIdentity: codexSourceIdentitySchema.parse(row.native_source_identity) };
}
function settingsReference(row: MessageRow) {
  const result = reference(row);
  if (result.source === 'claude.sdk.result') {
    const parsed = claudeAssistantSettingsSchema.safeParse(row.settings);
    if (parsed.success) return { ...result, settings: parsed.data };
  } else {
    const parsed = codexAssistantSettingsSchema.safeParse(row.settings);
    if (parsed.success) return { ...result, settings: parsed.data };
  }
  throw new HttpError(409, 'assistant_source_mismatch', 'The stored assistant settings do not match their source.');
}
async function withContent(client: PoolClient, row: MessageRow): Promise<AssistantMessage> {
  const detail = (await client.query<{ content: string }>('SELECT content FROM flow.details WHERE id=$1 AND task_id=$2 AND attempt_id=$3', [row.detail_id, row.task_id, row.attempt_id])).rows[0];
  if (!detail || sha256(detail.content) !== row.content_digest) throw new HttpError(409, 'assistant_content_mismatch', 'The stored assistant content no longer matches its source digest.');
  return { ...settingsReference(row), content: detail.content };
}
/** Caller supplies its persisted task+attempt binding; task success/verification remain separate facts. */
export async function readAssistantFinal(client: PoolClient, taskId: string, attemptId: string): Promise<AssistantMessage | null> {
  const row = (await client.query<MessageRow>(`SELECT ${columns},settings FROM flow.assistant_messages WHERE task_id=$1 AND attempt_id=$2`, [taskId, attemptId])).rows[0];
  return row ? withContent(client, row) : null;
}
export type AssistantFinalPreview = (Omit<Extract<AssistantMessage, { source: 'claude.sdk.result' }>, 'content'>
  | Omit<Extract<AssistantMessage, { source: 'codex.app-server.agent-message' }>, 'content'>) & { text: string; truncated: boolean };
export interface AssistantFinalBinding { taskId: string; attemptId: string }
export type AssistantFinalPreviewResult = { preview: AssistantFinalPreview | null; error?: never } | { error: HttpError; preview?: never };
interface PreviewRow extends MessageRow { binding_index: string | number; prefix: string | null; has_more: boolean | null; digest: string | null }
function finalPreview(row: PreviewRow): AssistantFinalPreview {
  if (row.prefix === null || row.digest !== row.content_digest) throw new HttpError(409, 'assistant_content_mismatch', 'The stored assistant content no longer matches its source digest.');
  // PostgreSQL counts Unicode characters; preserve the UTF-16 boundary after transfer.
  const text = row.prefix.slice(0, 4000).replace(/[\uD800-\uDBFF]$/, '');
  return { ...settingsReference(row), text, truncated: Boolean(row.has_more) || text.length < row.prefix.length };
}
/** Same-client read, at most 50 paired bindings; results retain input order and isolate known validation errors.
 * PostgreSQL still reads/hashes the entire UTF-8 body; only its prefix crosses the connection. */
export async function readAssistantFinalPreviews(client: PoolClient, bindings: readonly AssistantFinalBinding[]): Promise<AssistantFinalPreviewResult[]> {
  if (bindings.length > 50) throw new HttpError(400, 'assistant_preview_batch_limit', 'At most 50 assistant previews can be read together.');
  if (!bindings.length) return [];
  const rows = (await client.query<PreviewRow>(`SELECT request.binding_index,${columns.split(',').map(column => `m.${column}`).join(',')},m.settings,
    left(d.content,4000) AS prefix, char_length(d.content)>4000 AS has_more,
    encode(sha256(convert_to(d.content,'UTF8')),'hex') AS digest
    FROM unnest($1::text[],$2::text[]) WITH ORDINALITY AS request(task_id,attempt_id,binding_index)
    JOIN flow.assistant_messages m ON m.task_id=request.task_id AND m.attempt_id=request.attempt_id
    LEFT JOIN flow.details d ON d.id=m.detail_id AND d.task_id=m.task_id AND d.attempt_id=m.attempt_id`,
  [bindings.map(binding => binding.taskId), bindings.map(binding => binding.attemptId)])).rows;
  const byIndex = new Map(rows.map(row => [Number(row.binding_index) - 1, row]));
  return bindings.map((_, index) => {
    const row = byIndex.get(index);
    if (!row) return { preview: null };
    try { return { preview: finalPreview(row) }; }
    catch (error) {
      if (error instanceof HttpError && ['assistant_content_mismatch', 'assistant_identity', 'assistant_source_mismatch'].includes(error.code)) return { error };
      throw error;
    }
  });
}
/** Preserve the single-item throwing interface through the same validation/projection path. */
export async function readAssistantFinalPreview(client: PoolClient, taskId: string, attemptId: string): Promise<AssistantFinalPreview | null> {
  const result = (await readAssistantFinalPreviews(client, [{ taskId, attemptId }]))[0]!;
  if (result.error) throw result.error;
  return result.preview;
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
