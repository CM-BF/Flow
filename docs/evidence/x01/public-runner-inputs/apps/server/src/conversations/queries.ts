import type { Pool } from 'pg';
import type { Detail } from '../../../../packages/contracts/src/tasks.js';
import type { ConversationList, ConversationSnapshot, ConversationTurnPage } from '../../../../packages/contracts/src/conversations.js';
import { HttpError, transaction } from '../database.js';
import { loadTask } from '../tasks.js';
import { sessionEvidence } from './replies.js';
import { conversationCapabilities, conversationView, lastTurn, loadConversation, turnView, turnViews, type ConversationRow, type TurnRow } from './state.js';

export async function conversationSnapshot(pool: Pool, id: string): Promise<ConversationSnapshot> {
  return transaction(pool, async client => {
    const conversation = conversationView(await loadConversation(client, id));
    const turn = await lastTurn(client, id);
    const latestExecuted = (await client.query<{ task_id: string }>(`SELECT t.task_id FROM flow.conversation_turns t JOIN flow.tasks task ON task.id=t.task_id
      JOIN flow.attempts a ON a.id=task.current_attempt_id WHERE t.conversation_id=$1 AND a.native_session_id IS NOT NULL ORDER BY t.number DESC LIMIT 1`, [id])).rows[0];
    const nativeSession = latestExecuted ? (await sessionEvidence(client, await loadTask(client, latestExecuted.task_id)))?.identity ?? null : null;
    return { conversation, capabilities: await conversationCapabilities(client, conversation.projectId, conversation.executionProfile), nativeSession, lastTurn: turn ? await turnView(client, turn, conversation.harness) : null };
  }, true);
}
export async function conversationList(pool: Pool, after: string | undefined, limit: number, native = false): Promise<ConversationList> {
  return transaction(pool, async client => {
    const rows = (await client.query<ConversationRow>(`SELECT * FROM flow.conversations WHERE ($3::boolean OR harness='claude') AND ($1::text IS NULL OR id>$1) ORDER BY id LIMIT $2`, [after ?? null, limit + 1, native])).rows;
    const conversations = rows.slice(0, limit).map(conversationView);
    return { conversations, nextCursor: rows.length > limit ? conversations.at(-1)!.id : null };
  }, true);
}
export async function turnPage(pool: Pool, id: string, after: number, limit: number): Promise<ConversationTurnPage> {
  return transaction(pool, async client => {
    const conversation = conversationView(await loadConversation(client, id));
    const rows = (await client.query<TurnRow>('SELECT * FROM flow.conversation_turns WHERE conversation_id=$1 AND number>$2 ORDER BY number LIMIT $3', [id, after, limit + 1])).rows;
    const turns = await turnViews(client, rows.slice(0, limit), conversation.harness);
    return { conversation, turns, nextCursor: rows.length > limit ? turns.at(-1)!.number : null };
  }, true);
}
export async function turnDetail(pool: Pool, conversationId: string, turnId: string, detailId: string): Promise<Detail> {
  return transaction(pool, async client => {
    const row = (await client.query<{ id: string; title: string; kind: Detail['kind']; content: string; media_type: string; artifact_version: string | null }>(`SELECT d.id,d.title,d.kind,d.content,d.media_type,d.artifact_version
      FROM flow.conversation_turns t JOIN flow.details d ON d.task_id=t.task_id
      WHERE t.conversation_id=$1 AND t.id=$2 AND d.id=$3`, [conversationId, turnId, detailId])).rows[0];
    if (!row) throw new HttpError(404, 'conversation_detail_not_found', 'This detail does not belong to the selected turn.');
    return { id: row.id, title: row.title, kind: row.kind, content: row.content, mediaType: row.media_type, ...(row.artifact_version ? { artifactVersion: row.artifact_version } : {}) };
  }, true);
}
