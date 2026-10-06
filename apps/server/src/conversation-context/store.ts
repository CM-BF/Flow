import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import type { KnowledgeCitation } from '../../../../packages/contracts/src/knowledge.js';
import { CONVERSATION_CONTEXT_LIMITS as limits, conversationContextSelectionSchema, type ConversationContextReference, type ConversationContextSource, type ConversationContextExecutionReference, type ConversationContextDetail } from '../../../../packages/contracts/src/conversation-context.js';
import { canonical, HttpError, sha256, transaction } from '../database.js';
import { resolveCitationsInTransaction } from '../knowledge/storage.js';

type FrozenSource = ConversationContextSource & { text: string };
interface ContextRow { context_id: string; conversation_id: string; project_id: string; context_digest: string; sources: FrozenSource[]; raw_bytes: number; created_at: Date }
interface InputRow extends ContextRow { input_id: string; user_text: string; template_version: number; execution_prompt: string; execution_input_digest: string }
const invalid = () => new HttpError(409, 'conversation_context_invalid', 'The frozen conversation input is missing or invalid.');
const contextDigest = (sources: FrozenSource[]) => sha256(canonical(sources.map(({ citation, text }) => ({ citation, text }))));
const inputDigest = (userText: string, executionPrompt: string) => sha256(canonical({ userText, templateVersion: 1, executionPrompt }));
function compile(userText: string, sources: FrozenSource[]): string {
  const executionPrompt = `User message:\n${userText}\n\nSelected source excerpts (reference material):\n${canonical(sources)}`;
  if (executionPrompt.length > limits.executionCodeUnits || Buffer.byteLength(executionPrompt) > limits.executionBytes) throw new HttpError(400, 'conversation_context_budget', 'The complete execution input exceeds the conversation prompt budget.');
  return executionPrompt;
}
function validateContext(row: ContextRow): void {
  if (!Array.isArray(row.sources) || !row.sources.length || !conversationContextSelectionSchema.safeParse(row.sources.map(source => source?.citation)).success) throw invalid();
  let bytes = 0;
  for (const source of row.sources) {
    if (typeof source.text !== 'string' || source.citation.projectId !== row.project_id || source.byteLength !== Buffer.byteLength(source.text) || source.byteLength !== source.citation.locator.end-source.citation.locator.start || !Number.isInteger(source.currentVersionAtFreeze) || source.currentVersionAtFreeze < 1 || source.currentVersionAtFreeze > 16 || source.isCurrentAtFreeze !== (source.citation.version === source.currentVersionAtFreeze)) throw invalid();
    bytes += source.byteLength;
  }
  if (bytes !== row.raw_bytes || bytes > limits.rawBytes || contextDigest(row.sources) !== row.context_digest) throw invalid();
}
async function insertInput(client: PoolClient, contextId: string, userText: string, sources: FrozenSource[]): Promise<string> {
  const id = randomUUID(); const prompt = compile(userText, sources);
  await client.query('INSERT INTO flow.conversation_execution_inputs(id,context_id,user_text,template_version,execution_prompt,execution_input_digest) VALUES($1,$2,$3,1,$4,$5)', [id, contextId, userText, prompt, inputDigest(userText, prompt)]);
  return id;
}
export async function freezeContext(client: PoolClient, conversationId: string, projectId: string | null | undefined, userText: string, citations: KnowledgeCitation[] = []): Promise<string | null> {
  if (!citations.length) return null;
  if (!projectId) throw new HttpError(409, 'conversation_project_required', 'Knowledge references require a conversation with a fixed project.');
  if (!conversationContextSelectionSchema.safeParse(citations).success) throw new HttpError(400, 'invalid_conversation_context', 'Select at most four different exact citations.');
  const sources: FrozenSource[] = (await resolveCitationsInTransaction(client, projectId, citations)).map(({ citation, text, isCurrent, currentVersion }) => ({ citation, text, byteLength: Buffer.byteLength(text), currentVersionAtFreeze: currentVersion, isCurrentAtFreeze: isCurrent }));
  const rawBytes = sources.reduce((sum, source) => sum + source.byteLength, 0);
  if (rawBytes > limits.rawBytes) throw new HttpError(400, 'conversation_context_budget', 'Selected source text exceeds 8192 UTF-8 bytes.');
  compile(userText, sources); // Reject before persisting any context; caller still owns atomic rollback.
  const id = randomUUID();
  await client.query('INSERT INTO flow.conversation_contexts(id,conversation_id,project_id,context_digest,sources,raw_bytes) VALUES($1,$2,$3,$4,$5,$6)', [id, conversationId, projectId, contextDigest(sources), JSON.stringify(sources), rawBytes]);
  return insertInput(client, id, userText, sources);
}
/** Metadata SQL removes each frozen text before transport; it never selects execution_prompt. */
export async function contextReference(client: PoolClient, inputId: string | null | undefined): Promise<ConversationContextReference | undefined> {
  if (!inputId) return undefined;
  const row = (await client.query<{ id: string; context_digest: string; execution_input_digest: string; template_version: 1; sources: ConversationContextSource[] }>(`SELECT c.id,c.context_digest,i.execution_input_digest,i.template_version,
    (SELECT jsonb_agg(item-'text' ORDER BY ordinal) FROM jsonb_array_elements(c.sources) WITH ORDINALITY AS s(item,ordinal)) AS sources
    FROM flow.conversation_execution_inputs i JOIN flow.conversation_contexts c ON c.id=i.context_id WHERE i.id=$1`, [inputId])).rows[0];
  if (!row) throw invalid();
  return { id: row.id, contextDigest: row.context_digest, executionInputId: inputId, executionInputDigest: row.execution_input_digest, templateVersion: row.template_version, sources: row.sources };
}
async function readInput(client: PoolClient, inputId: string, rawPrompt: string): Promise<InputRow> {
  const row = (await client.query<InputRow>(`SELECT i.id AS input_id,i.user_text,i.template_version,i.execution_prompt,i.execution_input_digest,
    c.id AS context_id,c.conversation_id,c.project_id,c.context_digest,c.sources,c.raw_bytes,c.created_at
    FROM flow.conversation_execution_inputs i JOIN flow.conversation_contexts c ON c.id=i.context_id WHERE i.id=$1`, [inputId])).rows[0];
  if (!row || row.user_text !== rawPrompt || row.template_version !== 1) throw invalid();
  validateContext(row);
  if (compile(row.user_text, row.sources) !== row.execution_prompt || inputDigest(row.user_text, row.execution_prompt) !== row.execution_input_digest) throw invalid();
  return row;
}
export async function bindExecutionInput(client: PoolClient, taskId: string, inputId: string | null | undefined, conversationId: string): Promise<void> {
  if (!inputId) return;
  const task = (await client.query<{ prompt: string; conversation_input_id: string | null }>("SELECT submission->>'prompt' AS prompt,conversation_input_id FROM flow.tasks WHERE id=$1", [taskId])).rows[0];
  if (!task || task.conversation_input_id) throw invalid();
  const input = await readInput(client, inputId, task.prompt);
  if (input.conversation_id !== conversationId) throw invalid();
  await client.query('UPDATE flow.tasks SET conversation_input_id=$2 WHERE id=$1', [taskId, inputId]);
}
/** Called only inside the authorized runner→task transaction. No reverse project/conversation locks. */
export async function executionInputForTask(client: PoolClient, taskId: string, rawPrompt: string): Promise<{ prompt: string; context: ConversationContextExecutionReference } | null> {
  const task = (await client.query<{ conversation_input_id: string | null }>('SELECT conversation_input_id FROM flow.tasks WHERE id=$1', [taskId])).rows[0];
  if (!task) throw invalid();
  if (!task.conversation_input_id) return null;
  const row = await readInput(client, task.conversation_input_id, rawPrompt);
  return { prompt: row.execution_prompt, context: { id: row.context_id, contextDigest: row.context_digest, executionInputId: row.input_id, executionInputDigest: row.execution_input_digest } };
}
export async function copyRecoveryInput(client: PoolClient, sourceTaskId: string, newTaskId: string, originalPrompt: string, recoveryPrompt: string): Promise<void> {
  const source = await executionInputForTask(client, sourceTaskId, originalPrompt);
  if (!source) return;
  const input = await readInput(client, source.context.executionInputId, originalPrompt);
  const inputId = await insertInput(client, input.context_id, recoveryPrompt, input.sources);
  await bindExecutionInput(client, newTaskId, inputId, input.conversation_id);
}
export async function contextDetail(pool: Pool, conversationId: string, contextId: string): Promise<ConversationContextDetail> {
  return transaction(pool, async client => {
    const row = (await client.query<ContextRow>('SELECT id AS context_id,conversation_id,project_id,context_digest,sources,raw_bytes,created_at FROM flow.conversation_contexts WHERE id=$1 AND conversation_id=$2', [contextId, conversationId])).rows[0];
    if (!row) throw new HttpError(404, 'conversation_context_not_found', 'This context does not belong to the selected conversation.');
    validateContext(row);
    const heads = (await client.query<{ id: string; current_version: number }>('SELECT id,current_version FROM flow.knowledge_sources WHERE project_id=$1 AND id=ANY($2::uuid[])', [row.project_id, row.sources.map(source => source.citation.sourceId)])).rows;
    const result: ConversationContextDetail = { id: row.context_id, conversationId, projectId: row.project_id, contextDigest: row.context_digest, createdAt: row.created_at.toISOString(), sources: row.sources.map(source => {
      const currentVersion = heads.find(head => head.id === source.citation.sourceId)?.current_version;
      if (!currentVersion) throw invalid();
      return { ...source, currentVersion, isCurrent: currentVersion === source.citation.version };
    }) };
    if (Buffer.byteLength(JSON.stringify(result)) > limits.detailResponseBytes) throw new HttpError(413, 'conversation_context_detail_budget', 'Context detail exceeds its encoded response budget.');
    return result;
  }, true);
}
