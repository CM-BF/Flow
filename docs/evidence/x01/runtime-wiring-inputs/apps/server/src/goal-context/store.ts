import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import type { GoalInput } from '../../../../packages/contracts/src/goals.js';
import { GOAL_CONTEXT_LIMITS as limits, goalKnowledgeSelectionSchema, type GoalContextReference, type GoalExecutionContextReference, type GoalContextSource, type GoalContextDetail } from '../../../../packages/contracts/src/goal-context.js';
import { canonical, HttpError, sha256, transaction } from '../database.js';
import { resolveCitationsInTransaction } from '../knowledge/storage.js';

interface ContextRow { context_id: string; goal_id: string; node_id: string; input_version: number; project_id: string; context_digest: string; sources: GoalContextSource[]; raw_bytes: number; created_at: Date; input: GoalInput }
interface ExecutionInputRow extends ContextRow { input_id: string; public_prompt: string; template_version: number; execution_prompt: string; execution_input_digest: string }
const invalid = () => new HttpError(409, 'goal_context_invalid', 'The frozen goal input is missing or invalid.');
const contextDigest = (sources: GoalContextSource[]) => sha256(canonical(sources.map(({ citation, text }) => ({ citation, text }))));
const inputDigest = (publicPrompt: string, executionPrompt: string) => sha256(canonical({ publicPrompt, templateVersion: 1, executionPrompt }));
function reference(row: ContextRow): GoalContextReference {
  return { id: row.context_id, contextDigest: row.context_digest, referenceCount: row.sources.length, rawBytes: row.raw_bytes };
}
function compile(publicPrompt: string, sources: GoalContextSource[]): string {
  const prompt = `Goal execution input:\n${publicPrompt}\n\nSelected source excerpts (reference material):\n${canonical(sources)}`;
  if (prompt.length > limits.executionCodeUnits || Buffer.byteLength(prompt) > limits.executionBytes) throw new HttpError(409, 'goal_context_budget', 'The complete goal execution input exceeds the prompt budget; nothing was truncated.');
  return prompt;
}
function validateContext(row: ContextRow): void {
  if (!Array.isArray(row.sources) || !row.sources.length || !goalKnowledgeSelectionSchema.safeParse(row.sources.map(source => source?.citation)).success) throw invalid();
  if (canonical(row.sources.map(source => source.citation)) !== canonical(row.input.knowledge ?? [])) throw invalid();
  let bytes = 0;
  for (const source of row.sources) {
    if (typeof source.text !== 'string' || Buffer.from(source.text).toString('utf8') !== source.text || source.text.includes('\0') || source.citation.projectId !== row.project_id || source.byteLength !== Buffer.byteLength(source.text) || source.byteLength !== source.citation.locator.end-source.citation.locator.start || !Number.isInteger(source.currentVersionAtFreeze) || source.currentVersionAtFreeze < 1 || source.currentVersionAtFreeze > 16 || source.isCurrentAtFreeze !== (source.citation.version === source.currentVersionAtFreeze)) throw invalid();
    bytes += source.byteLength;
  }
  if (bytes !== row.raw_bytes || bytes > limits.rawBytes || contextDigest(row.sources) !== row.context_digest) throw invalid();
}
const contextColumns = 'c.id AS context_id,c.goal_id,c.node_id,c.input_version,c.project_id,c.context_digest,c.sources,c.raw_bytes,c.created_at,g.input';
const contextJoins = 'JOIN flow.goal_inputs g ON (g.goal_id,g.node_id,g.version)=(c.goal_id,c.node_id,c.input_version) JOIN flow.goals o ON o.id=c.goal_id AND o.project_id=c.project_id';
async function readContext(client: PoolClient, goalId: string, nodeId: string, version: number): Promise<ContextRow> {
  const row = (await client.query<ContextRow>(`SELECT ${contextColumns} FROM flow.goal_contexts c ${contextJoins} WHERE c.goal_id=$1 AND c.node_id=$2 AND c.input_version=$3`, [goalId, nodeId, version])).rows[0];
  if (!row) throw invalid();
  validateContext(row); return row;
}
/** Caller holds the project lock and inserts the immutable goal_inputs row in this transaction. */
export async function freezeGoalContext(client: PoolClient, projectId: string, goalId: string, nodeId: string, inputVersion: number, input: GoalInput): Promise<GoalContextReference | undefined> {
  const citations = input.knowledge ?? [];
  if (!citations.length) return undefined;
  if (!goalKnowledgeSelectionSchema.safeParse(citations).success) throw new HttpError(400, 'invalid_goal_context', 'Select at most four different exact citations.');
  const sources = (await resolveCitationsInTransaction(client, projectId, citations)).map(({ citation, text, isCurrent, currentVersion }) => ({ citation, text, byteLength: Buffer.byteLength(text), currentVersionAtFreeze: currentVersion, isCurrentAtFreeze: isCurrent }));
  const bytes = sources.reduce((sum, source) => sum + source.byteLength, 0);
  if (bytes > limits.rawBytes) throw new HttpError(400, 'goal_context_budget', 'Selected source text exceeds 8192 UTF-8 bytes.');
  const id = randomUUID(); const digest = contextDigest(sources);
  await client.query('INSERT INTO flow.goal_contexts(id,goal_id,node_id,input_version,project_id,context_digest,sources,raw_bytes) VALUES($1,$2,$3,$4,$5,$6,$7,$8)', [id, goalId, nodeId, inputVersion, projectId, digest, JSON.stringify(sources), bytes]);
  return { id, contextDigest: digest, referenceCount: sources.length, rawBytes: bytes };
}
async function insertInput(client: PoolClient, context: ContextRow, publicPrompt: string): Promise<string> {
  const prompt = compile(publicPrompt, context.sources); const id = randomUUID();
  await client.query('INSERT INTO flow.goal_execution_inputs(id,context_id,public_prompt,template_version,execution_prompt,execution_input_digest) VALUES($1,$2,$3,1,$4,$5)', [id, context.context_id, publicPrompt, prompt, inputDigest(publicPrompt, prompt)]);
  return id;
}
async function bindTask(client: PoolClient, taskId: string, inputId: string, publicPrompt: string): Promise<void> {
  const task = (await client.query<{ prompt: string; goal_input_id: string | null; conversation_input_id: string | null }>("SELECT submission->>'prompt' AS prompt,goal_input_id,conversation_input_id FROM flow.tasks WHERE id=$1", [taskId])).rows[0];
  if (!task || task.prompt !== publicPrompt || task.goal_input_id || task.conversation_input_id) throw invalid();
  await client.query('UPDATE flow.tasks SET goal_input_id=$2 WHERE id=$1', [taskId, inputId]);
}
/** Public prompt already includes the exact dependency artifacts; compile adds only this frozen selection. */
export async function bindGoalExecutionInput(client: PoolClient, taskId: string, goalId: string, nodeId: string, inputVersion: number, publicPrompt: string): Promise<void> {
  const row = await readContext(client, goalId, nodeId, inputVersion);
  const id = await insertInput(client, row, publicPrompt); await bindTask(client, taskId, id, publicPrompt);
}
async function readExecutionInput(client: PoolClient, inputId: string, rawPrompt: string): Promise<ExecutionInputRow> {
  const row = (await client.query<ExecutionInputRow>(`SELECT i.id AS input_id,i.public_prompt,i.template_version,i.execution_prompt,i.execution_input_digest,${contextColumns}
    FROM flow.goal_execution_inputs i JOIN flow.goal_contexts c ON c.id=i.context_id ${contextJoins} WHERE i.id=$1`, [inputId])).rows[0];
  if (!row || row.public_prompt !== rawPrompt || row.template_version !== 1) throw invalid();
  validateContext(row);
  if (compile(row.public_prompt, row.sources) !== row.execution_prompt || inputDigest(row.public_prompt, row.execution_prompt) !== row.execution_input_digest) throw invalid();
  return row;
}
/** Authorized runner→task transaction only; no project/conversation lock acquisition or source re-resolution. */
export async function goalExecutionInputForTask(client: PoolClient, taskId: string, rawPrompt: string): Promise<{ prompt: string; context: GoalExecutionContextReference } | null> {
  const task = (await client.query<{ goal_input_id: string | null; conversation_input_id: string | null }>('SELECT goal_input_id,conversation_input_id FROM flow.tasks WHERE id=$1', [taskId])).rows[0];
  if (!task || (task.goal_input_id && task.conversation_input_id)) throw invalid();
  if (!task.goal_input_id) return null;
  const row = await readExecutionInput(client, task.goal_input_id, rawPrompt);
  return { prompt: row.execution_prompt, context: { ...reference(row), executionInputId: row.input_id, executionInputDigest: row.execution_input_digest, templateVersion: 1 } };
}
/** Recovery is a new task input, never a new goal execution/delivery or native-session resume. */
export async function copyGoalRecoveryInput(client: PoolClient, sourceTaskId: string, newTaskId: string, originalPrompt: string, recoveryPrompt: string): Promise<void> {
  const source = await goalExecutionInputForTask(client, sourceTaskId, originalPrompt);
  if (!source) return;
  const row = await readExecutionInput(client, source.context.executionInputId, originalPrompt);
  const id = await insertInput(client, row, recoveryPrompt); await bindTask(client, newTaskId, id, recoveryPrompt);
}
export async function goalContextDetail(pool: Pool, goalId: string, nodeId: string, version: number): Promise<GoalContextDetail> {
  return transaction(pool, async client => {
    const exists = (await client.query('SELECT 1 FROM flow.goal_contexts WHERE goal_id=$1 AND node_id=$2 AND input_version=$3', [goalId, nodeId, version])).rowCount;
    if (!exists) throw new HttpError(404, 'goal_context_not_found', 'No frozen context belongs to this goal input.');
    const row = await readContext(client, goalId, nodeId, version);
    const heads = (await client.query<{ id: string; current_version: number }>('SELECT id,current_version FROM flow.knowledge_sources WHERE project_id=$1 AND id=ANY($2::uuid[])', [row.project_id, row.sources.map(source => source.citation.sourceId)])).rows;
    const result: GoalContextDetail = { ...reference(row), goalId, nodeId, inputVersion: version, projectId: row.project_id, createdAt: row.created_at.toISOString(), sources: row.sources.map(source => {
      const currentVersion = heads.find(head => head.id === source.citation.sourceId)?.current_version;
      if (!currentVersion) throw invalid();
      return { ...source, currentVersion, isCurrent: currentVersion === source.citation.version };
    }) };
    if (Buffer.byteLength(JSON.stringify(result)) > limits.detailResponseBytes) throw new HttpError(413, 'goal_context_detail_budget', 'Context detail exceeds its encoded response budget.');
    return result;
  }, true);
}
/** Metadata-only batch for existing goal execution projections. Call only for inputs with references. */
export async function goalExecutionReferences(client: PoolClient, taskIds: string[]): Promise<Map<string, GoalExecutionContextReference>> {
  const ids = [...new Set(taskIds)];
  if (!ids.length) return new Map();
  if (ids.length > 400) throw invalid();
  const rows = (await client.query<{ task_id: string; id: string; context_digest: string; reference_count: number; raw_bytes: number; input_id: string; execution_input_digest: string; template_version: 1 }>(`SELECT t.id AS task_id,c.id,c.context_digest,jsonb_array_length(c.sources) AS reference_count,c.raw_bytes,i.id AS input_id,i.execution_input_digest,i.template_version
    FROM flow.tasks t JOIN flow.goal_execution_inputs i ON i.id=t.goal_input_id JOIN flow.goal_contexts c ON c.id=i.context_id WHERE t.id=ANY($1::text[])`, [ids])).rows;
  if (rows.length !== ids.length) throw invalid();
  return new Map(rows.map(row => [row.task_id, { id: row.id, contextDigest: row.context_digest, referenceCount: row.reference_count, rawBytes: row.raw_bytes, executionInputId: row.input_id, executionInputDigest: row.execution_input_digest, templateVersion: row.template_version }]));
}
