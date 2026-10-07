import { readFile } from 'node:fs/promises';
import type { Pool, PoolClient } from 'pg';
import { pluginVerifierBindingSchema, type PluginVerifierBinding } from '../../../../packages/contracts/src/plugin-verification-binding.js';
import { pluginVerificationRequestSchema, jsonObjectRuleSchema } from '../../../../packages/contracts/src/plugin-verification.js';
import type { PluginToolBinding } from '../../../../packages/contracts/src/plugin-runtime.js';
import type { PluginVerifierExecution } from '../../../../packages/contracts/src/verifier-runner-claim.js';
import { canonical, HttpError, sha256, transaction } from '../database.js';
import type { TaskRecord } from '../tasks.js';

export async function migratePluginVerification(pool: Pool): Promise<void> {
  await transaction(pool, async client => {
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended('flow-migrations',0))");
    if ((await client.query('SELECT 1 FROM flow.migrations WHERE version=36')).rowCount) return;
    await client.query(await readFile(new URL('../../../../packages/storage/migrations/036-plugin-verification-bindings.sql', import.meta.url), 'utf8'));
    await client.query('INSERT INTO flow.migrations(version) VALUES(36)');
  });
}
export async function bindingExecutionKind(client: PoolClient, bindingId: string): Promise<'tool' | 'verifier'> {
  const row = (await client.query<{ kind: string }>('SELECT kind FROM flow.plugin_binding_executions WHERE binding_id=$1', [bindingId])).rows[0];
  if (row?.kind !== 'tool' && row?.kind !== 'verifier') throw unavailable();
  return row.kind;
}
function unavailable(): HttpError { return new HttpError(409, 'plugin_claim_unavailable', 'The immutable verifier source, project or capability is unavailable.'); }

/** Exact source and verification task must have one unambiguous project authority.
 * Missing/null/conflicting conversation and direct bindings never become workspace-wide access. */
export async function assertSourceProject(client: PoolClient, taskId: string, projectId: string, workspaceId: string): Promise<void> {
  const rows = (await client.query<{ project_id: string | null; workspace_id: string | null }>(`
    WITH direct AS (SELECT project_id FROM flow.project_task_bindings WHERE task_id=$1 FOR SHARE)
    SELECT authority.project_id,p.workspace_id FROM (
      SELECT project_id FROM direct
      UNION ALL SELECT c.project_id FROM flow.conversation_turns ct JOIN flow.conversations c ON c.id=ct.conversation_id WHERE ct.task_id=$1
    ) authority LEFT JOIN flow.projects p ON p.id=authority.project_id LIMIT 3`, [taskId])).rows;
  if (!rows.length || rows.length > 2 || rows.some(row => row.project_id !== projectId || row.workspace_id !== workspaceId)) throw unavailable();
}

/** Called inside the existing runner/task/registration lock transaction. No package import or new authorization. */
export async function claimVerificationReference(client: PoolClient, task: TaskRecord, binding: PluginToolBinding,
  qualification: PluginVerifierExecution): Promise<PluginVerifierBinding> {
  const row = (await client.query<{ source_task_id: string; source_attempt_id: string; artifact_id: string; artifact_version: string; project_id: string; rule: unknown }>(
    'SELECT source_task_id,source_attempt_id,artifact_id,artifact_version,project_id,rule FROM flow.plugin_verification_references WHERE binding_id=$1', [binding.bindingId])).rows[0];
  if (!row || row.source_task_id === task.id) throw unavailable();
  const rule = jsonObjectRuleSchema.safeParse(row.rule);
  if (!rule.success || !qualification.algorithms.some(a => a.id === rule.data.algorithmId && a.version === rule.data.algorithmVersion)
    || (binding.scope.projectId !== null && binding.scope.projectId !== row.project_id)) throw unavailable();
  await assertSourceProject(client, row.source_task_id, row.project_id, binding.scope.workspaceId);
  await assertSourceProject(client, task.id, row.project_id, binding.scope.workspaceId);
  const artifact = (await client.query<{ content: string }>(`SELECT d.content FROM flow.artifacts a JOIN flow.details d ON d.id=a.detail_id
    WHERE a.task_id=$1 AND a.attempt_id=$2 AND a.artifact_id=$3 AND a.version=$4
      AND d.task_id=a.task_id AND d.attempt_id=a.attempt_id AND d.artifact_version=a.version
      AND octet_length(d.content)<=8192 LIMIT 1`, [row.source_task_id, row.source_attempt_id, row.artifact_id, row.artifact_version])).rows[0];
  if (!artifact || sha256(artifact.content) !== row.artifact_version) throw unavailable();
  const source = { taskId: row.source_task_id, attemptId: row.source_attempt_id, artifactId: row.artifact_id, version: row.artifact_version };
  const expected = pluginVerificationRequestSchema.safeParse({ source: { ...source, content: artifact.content }, rule: rule.data });
  let input: unknown; try { input = JSON.parse(task.submission.prompt); } catch { throw unavailable(); }
  const submitted = pluginVerificationRequestSchema.safeParse(input);
  if (!expected.success || !submitted.success || canonical(expected.data) !== canonical(submitted.data)
    || binding.inputDigest !== sha256(task.submission.prompt)) throw unavailable();
  return pluginVerifierBindingSchema.parse({ ...binding, executionKind: 'verifier', verification: { projectId: row.project_id, source, rule: rule.data } });
}

/** Positive installed kind is mandatory for every bound task, including error completion. */
export async function verifierBinding(client: PoolClient, taskId: string): Promise<PluginToolBinding | null> {
  const row = (await client.query<{ id: string; kind: string | null }>(`SELECT b.id,e.kind FROM flow.plugin_tool_bindings b
    LEFT JOIN flow.plugin_binding_executions e ON e.binding_id=b.id WHERE b.task_id=$1`, [taskId])).rows[0];
  if (!row) return null;
  if (row.kind !== 'tool' && row.kind !== 'verifier') throw unavailable();
  if (row.kind === 'tool') return null;
  return (await import('./store.js')).readBinding(client, taskId);
}
