import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import type { KnowledgeCitation } from '../../../../packages/contracts/src/knowledge.js';
import { attachmentContentSchema, attachmentSelectionSchema, type AttachmentReference } from '../../../../packages/contracts/src/attachments.js';
import { CONVERSATION_CONTEXT_LIMITS as limits, conversationContextSelectionSchema, conversationContextReferenceSchema, type ConversationContextReference, type ConversationContextSource, type ConversationContextExecutionReference, type ConversationContextDetail } from '../../../../packages/contracts/src/conversation-context.js';
import { canonical, HttpError, sha256, transaction } from '../database.js';
import { resolveCitationsInTransaction } from '../knowledge/storage.js';
import { freezeAttachments, bindAttachments, type FrozenAttachment } from '../attachments/storage.js';

type FrozenSource = ConversationContextSource & { text: string };
interface ContextRow { context_id: string; conversation_id: string; project_id: string; context_digest: string; sources: FrozenSource[]; attachments: FrozenAttachment[]; raw_bytes: number; created_at: Date }
interface InputRow extends ContextRow { input_id: string; user_text: string; template_version: number; execution_prompt: string; execution_input_digest: string }
const invalid = () => new HttpError(409, 'conversation_context_invalid', 'The frozen conversation input is missing or invalid.');
const contextDigest = (sources: FrozenSource[], attachments: FrozenAttachment[] = []) => sha256(canonical(attachments.length
  ? { templateVersion: 2, order: 'knowledge-then-attachments', sources, attachments }
  : sources.map(({ citation, text }) => ({ citation, text }))));
const inputDigest = (userText: string, executionPrompt: string, templateVersion = 1) => sha256(canonical({ userText, templateVersion, executionPrompt }));
function compile(userText: string, sources: FrozenSource[], attachments: FrozenAttachment[] = []): string {
  const executionPrompt = attachments.length
    ? `User message:\n${userText}\n\nSelected source excerpts (reference material):\n${canonical(sources)}\n\nSelected attachments (reference material):\n${canonical(attachments)}`
    : `User message:\n${userText}\n\nSelected source excerpts (reference material):\n${canonical(sources)}`;
  if (executionPrompt.length > limits.executionCodeUnits || Buffer.byteLength(executionPrompt) > limits.executionBytes) throw new HttpError(400, 'conversation_context_budget', 'The complete execution input exceeds the conversation prompt budget.');
  return executionPrompt;
}
function validateContext(row: ContextRow): void {
  if (!Array.isArray(row.sources) || !Array.isArray(row.attachments) || !row.sources.length && !row.attachments.length
    || row.sources.length + row.attachments.length > limits.references
    || !conversationContextSelectionSchema.safeParse(row.sources.map(source => source?.citation)).success
    || !attachmentSelectionSchema.safeParse(row.attachments.map(item => item?.reference)).success) throw invalid();
  let bytes = 0;
  for (const source of row.sources) {
    if (typeof source.text !== 'string' || source.citation.projectId !== row.project_id || source.byteLength !== Buffer.byteLength(source.text) || source.byteLength !== source.citation.locator.end-source.citation.locator.start || !Number.isInteger(source.currentVersionAtFreeze) || source.currentVersionAtFreeze < 1 || source.currentVersionAtFreeze > 16 || source.isCurrentAtFreeze !== (source.citation.version === source.currentVersionAtFreeze)) throw invalid();
    bytes += source.byteLength;
  }
  for (const item of row.attachments) {
    if (!attachmentContentSchema.safeParse(item).success || item.reference.projectId !== row.project_id || sha256(item.text) !== item.reference.contentDigest) throw invalid();
    bytes += item.byteLength;
  }
  if (bytes !== row.raw_bytes || bytes > limits.rawBytes || contextDigest(row.sources, row.attachments) !== row.context_digest) throw invalid();
}
async function insertInput(client: PoolClient, contextId: string, userText: string, sources: FrozenSource[], attachments: FrozenAttachment[] = []): Promise<string> {
  const id = randomUUID(); const prompt = compile(userText, sources, attachments); const version = attachments.length ? 2 : 1;
  await client.query('INSERT INTO flow.conversation_execution_inputs(id,context_id,user_text,template_version,execution_prompt,execution_input_digest) VALUES($1,$2,$3,$4,$5,$6)', [id, contextId, userText, version, prompt, inputDigest(userText, prompt, version)]);
  return id;
}
export async function freezeContext(client: PoolClient, conversationId: string, projectId: string | null | undefined, userText: string, citations: KnowledgeCitation[] = [], references: AttachmentReference[] = []): Promise<string | null> {
  if (!citations.length && !references.length) return null;
  if (!projectId) throw new HttpError(409, 'conversation_project_required', 'Selected reference material requires a conversation with a fixed project.');
  if (!conversationContextSelectionSchema.safeParse(citations).success) throw new HttpError(400, 'invalid_conversation_context', 'Select at most four different exact citations.');
  if (!attachmentSelectionSchema.safeParse(references).success || citations.length + references.length > limits.references) throw new HttpError(400, 'invalid_conversation_context', 'Select at most four different exact knowledge and attachment references.');
  const attachments = references.length ? await freezeAttachments(client, projectId, references) : [];
  const sources: FrozenSource[] = (await resolveCitationsInTransaction(client, projectId, citations)).map(({ citation, text, isCurrent, currentVersion }) => ({ citation, text, byteLength: Buffer.byteLength(text), currentVersionAtFreeze: currentVersion, isCurrentAtFreeze: isCurrent }));
  const rawBytes = sources.reduce((sum, source) => sum + source.byteLength, 0) + attachments.reduce((sum, item) => sum + item.byteLength, 0);
  if (rawBytes > limits.rawBytes) throw new HttpError(400, 'conversation_context_budget', 'Selected source text exceeds 8192 UTF-8 bytes.');
  compile(userText, sources, attachments); // Reject before persisting any context; caller still owns atomic rollback.
  const id = randomUUID();
  if (attachments.length) {
    await client.query('INSERT INTO flow.conversation_contexts(id,conversation_id,project_id,context_digest,sources,raw_bytes,attachments) VALUES($1,$2,$3,$4,$5,$6,$7)', [id, conversationId, projectId, contextDigest(sources, attachments), JSON.stringify(sources), rawBytes, JSON.stringify(attachments)]);
    await bindAttachments(client, id, attachments);
  } else await client.query('INSERT INTO flow.conversation_contexts(id,conversation_id,project_id,context_digest,sources,raw_bytes) VALUES($1,$2,$3,$4,$5,$6)', [id, conversationId, projectId, contextDigest(sources), JSON.stringify(sources), rawBytes]);
  return insertInput(client, id, userText, sources, attachments);
}
/** Public metadata uses an allowlist; frozen text and execution_prompt never leave this projection. */
export async function contextReferences(client: PoolClient, inputIds: string[]): Promise<Map<string, ConversationContextReference>> {
  const ids = [...new Set(inputIds)];
  if (ids.length > 50) throw new HttpError(400, 'conversation_context_batch_limit', 'At most 50 context references can be read together.');
  if (!ids.length) return new Map();
  const rows = (await client.query<{ input_id: string; id: string; context_digest: string; execution_input_digest: string; template_version: number; sources: ConversationContextSource[]; attachments: Omit<FrozenAttachment, 'text'>[] }>(`SELECT i.id AS input_id,c.id,c.context_digest,i.execution_input_digest,i.template_version,
    coalesce((SELECT jsonb_agg(jsonb_build_object('citation',item->'citation','byteLength',item->'byteLength','currentVersionAtFreeze',item->'currentVersionAtFreeze','isCurrentAtFreeze',item->'isCurrentAtFreeze') ORDER BY ordinal) FROM jsonb_array_elements(c.sources) WITH ORDINALITY AS s(item,ordinal)),'[]'::jsonb) AS sources,
    coalesce((SELECT jsonb_agg(jsonb_build_object('reference',item->'reference','name',item->'name','mediaType',item->'mediaType','byteLength',item->'byteLength') ORDER BY ordinal) FROM jsonb_array_elements(coalesce(to_jsonb(c)->'attachments','[]'::jsonb)) WITH ORDINALITY AS a(item,ordinal)),'[]'::jsonb) AS attachments
    FROM flow.conversation_execution_inputs i JOIN flow.conversation_contexts c ON c.id=i.context_id WHERE i.id=ANY($1::text[])`, [ids])).rows;
  if (rows.length !== ids.length) throw invalid();
  return new Map(rows.map(row => {
    const value = conversationContextReferenceSchema.safeParse({ id: row.id, contextDigest: row.context_digest, executionInputId: row.input_id, executionInputDigest: row.execution_input_digest, templateVersion: row.template_version, sources: row.sources,
      ...(row.template_version === 2 ? { order: 'knowledge-then-attachments', attachments: row.attachments } : {}) });
    if (!value.success || row.template_version === 1 && row.attachments.length) throw invalid();
    return [row.input_id, value.data];
  }));
}
export async function contextReference(client: PoolClient, inputId: string | null | undefined): Promise<ConversationContextReference | undefined> {
  return inputId ? (await contextReferences(client, [inputId])).get(inputId) : undefined;
}
async function readInput(client: PoolClient, inputId: string, rawPrompt: string): Promise<InputRow> {
  const row = (await client.query<InputRow>(`SELECT i.id AS input_id,i.user_text,i.template_version,i.execution_prompt,i.execution_input_digest,
    c.id AS context_id,c.conversation_id,c.project_id,c.context_digest,c.sources,coalesce(to_jsonb(c)->'attachments','[]'::jsonb) AS attachments,c.raw_bytes,c.created_at
    FROM flow.conversation_execution_inputs i JOIN flow.conversation_contexts c ON c.id=i.context_id WHERE i.id=$1`, [inputId])).rows[0];
  if (!row || row.user_text !== rawPrompt || row.template_version !== (row.attachments.length ? 2 : 1)) throw invalid();
  validateContext(row);
  if (compile(row.user_text, row.sources, row.attachments) !== row.execution_prompt || inputDigest(row.user_text, row.execution_prompt, row.template_version) !== row.execution_input_digest) throw invalid();
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
  const inputId = await insertInput(client, input.context_id, recoveryPrompt, input.sources, input.attachments);
  await bindExecutionInput(client, newTaskId, inputId, input.conversation_id);
}
export async function contextDetail(pool: Pool, conversationId: string, contextId: string): Promise<ConversationContextDetail> {
  return transaction(pool, async client => {
    const row = (await client.query<ContextRow>("SELECT id AS context_id,conversation_id,project_id,context_digest,sources,coalesce(to_jsonb(c)->'attachments','[]'::jsonb) AS attachments,raw_bytes,created_at FROM flow.conversation_contexts c WHERE id=$1 AND conversation_id=$2", [contextId, conversationId])).rows[0];
    if (!row) throw new HttpError(404, 'conversation_context_not_found', 'This context does not belong to the selected conversation.');
    validateContext(row);
    const heads = (await client.query<{ id: string; current_version: number }>('SELECT id,current_version FROM flow.knowledge_sources WHERE project_id=$1 AND id=ANY($2::uuid[])', [row.project_id, row.sources.map(source => source.citation.sourceId)])).rows;
    const result: ConversationContextDetail = { id: row.context_id, conversationId, projectId: row.project_id, contextDigest: row.context_digest, createdAt: row.created_at.toISOString(), ...(row.attachments.length ? { templateVersion: 2, order: 'knowledge-then-attachments', attachments: row.attachments } as const : {}), sources: row.sources.map(source => {
      const currentVersion = heads.find(head => head.id === source.citation.sourceId)?.current_version;
      if (!currentVersion) throw invalid();
      return { ...source, currentVersion, isCurrent: currentVersion === source.citation.version };
    }) };
    if (Buffer.byteLength(JSON.stringify(result)) > limits.detailResponseBytes) throw new HttpError(413, 'conversation_context_detail_budget', 'Context detail exceeds its encoded response budget.');
    return result;
  }, true);
}
