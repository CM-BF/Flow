import type { ExecutionProfileReference } from '../../../../packages/contracts/src/execution-profiles.js';
import type { PoolClient } from 'pg';
import type { ConversationCapabilities, ConversationSettings, ConversationSummary, ConversationTurn } from '../../../../packages/contracts/src/conversations.js';
import { HttpError } from '../database.js';
import { assistantProjection } from './replies.js';
import { loadTask, summary } from '../tasks.js';

export const capabilities: ConversationCapabilities = { followUp: true, queue: false, steer: false, liveAssistantText: false, perTurnModel: false, perTurnThinking: false, perTurnTools: false };
export interface ConversationRow { id: string; title: string; harness: 'claude'; requested: ConversationSettings; execution_profile?: ExecutionProfileReference | null; revision: number; created_at: Date; updated_at: Date }
export interface TurnRow { id: string; conversation_id: string; number: number; task_id: string; user_text: string; created_at: Date }
export function conversationView(row: ConversationRow): ConversationSummary {
  return { id: row.id, title: row.title, harness: row.harness, requested: row.requested, ...(row.execution_profile ? { executionProfile: row.execution_profile } : {}), revision: row.revision, createdAt: row.created_at.toISOString(), updatedAt: row.updated_at.toISOString() };
}
export async function loadConversation(client: PoolClient, id: string, lock = false): Promise<ConversationRow> {
  const row = (await client.query<ConversationRow>(`SELECT * FROM flow.conversations WHERE id=$1${lock ? ' FOR UPDATE' : ''}`, [id])).rows[0];
  if (!row) throw new HttpError(404, 'conversation_not_found', 'Conversation not found.');
  return row;
}
export async function lastTurn(client: PoolClient, id: string): Promise<TurnRow | undefined> {
  return (await client.query<TurnRow>('SELECT * FROM flow.conversation_turns WHERE conversation_id=$1 ORDER BY number DESC LIMIT 1', [id])).rows[0];
}
export async function turnView(client: PoolClient, row: TurnRow): Promise<ConversationTurn> {
  const task = await loadTask(client, row.task_id);
  return { id: row.id, conversationId: row.conversation_id, number: row.number, createdAt: row.created_at.toISOString(),
    user: { role: 'user', text: row.user_text }, task: summary(task), ...await assistantProjection(client, task), telemetry: { kind: 'execution', taskId: task.id, title: 'Execution details' } };
}
