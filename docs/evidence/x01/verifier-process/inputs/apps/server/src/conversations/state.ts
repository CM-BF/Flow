import { CLAUDE_TURN_SETTINGS_PROTOCOL } from '../../../../packages/contracts/src/claude-turn-settings.js';
import { requireExecutionProfile } from '../execution-profiles/store.js';
import type { ExecutionProfileReference } from '../../../../packages/contracts/src/execution-profiles.js';
import type { PoolClient } from 'pg';
import type { ConversationCapabilities, ConversationSettings, ConversationSummary } from '../../../../packages/contracts/src/conversations.js';
import { attachmentsReady } from '../attachments/storage.js';
import { HttpError } from '../database.js';
export { turnView, turnViews } from './turn-read.js';

export const capabilities: ConversationCapabilities = { attachmentContext: false, knowledgeContext: true, followUp: true, queue: true, steer: false, liveAssistantText: false, perTurnModel: false, perTurnThinking: false, perTurnTools: false };
/** Creation receipts stay stable; current readiness is read from a project-bound GET. */
export async function conversationCapabilities(client: PoolClient, projectId?: string | null, reference?: ExecutionProfileReference): Promise<ConversationCapabilities> {
  const result = { ...capabilities, attachmentContext: Boolean(projectId) && await attachmentsReady(client) };
  if (!reference) return result;
  try {
    const profile = await requireExecutionProfile(client, reference);
    return profile.configuration.harness === 'claude' && profile.configuration.turnSettings
      ? { ...result, messageSettings: { protocol: CLAUDE_TURN_SETTINGS_PROTOCOL, profile: profile.reference, choices: 'execution-profile' } } : result;
  } catch (error) {
    if (error instanceof HttpError && ['execution_profile_unavailable', 'execution_profile_mismatch', 'goal_profile_requires_grant'].includes(error.code)) return result;
    throw error;
  }
}
export interface ConversationRow { project_id?: string | null; id: string; title: string; harness: 'claude' | 'codex'; requested: ConversationSettings; execution_profile?: ExecutionProfileReference | null; revision: number; queue_revision: number; queue_paused: boolean; created_at: Date; updated_at: Date }
export interface TurnRow { conversation_input_id?: string | null; id: string; conversation_id: string; number: number; task_id: string; user_text: string; created_at: Date }
export function conversationView(row: ConversationRow): ConversationSummary {
  return { ...(row.project_id ? { projectId: row.project_id } : {}), id: row.id, title: row.title, harness: row.harness, requested: row.requested, ...(row.execution_profile ? { executionProfile: row.execution_profile } : {}), revision: row.revision, createdAt: row.created_at.toISOString(), updatedAt: row.updated_at.toISOString() };
}
export async function loadConversation(client: PoolClient, id: string, lock = false): Promise<ConversationRow> {
  const row = (await client.query<ConversationRow>(`SELECT * FROM flow.conversations WHERE id=$1${lock ? ' FOR UPDATE' : ''}`, [id])).rows[0];
  if (!row) throw new HttpError(404, 'conversation_not_found', 'Conversation not found.');
  return row;
}
export async function lastTurn(client: PoolClient, id: string): Promise<TurnRow | undefined> {
  return (await client.query<TurnRow>('SELECT * FROM flow.conversation_turns WHERE conversation_id=$1 ORDER BY number DESC LIMIT 1', [id])).rows[0];
}
