import type { PoolClient } from 'pg';
import type { RunnerEvent } from '@flow/contracts';
import { pluginArtifactSourceSchema, type PluginArtifactSource } from '../../../../packages/contracts/src/plugin-artifact.js';
import { HttpError } from '../database.js';
import { saveArtifact, saveDetail } from '../evidence.js';
import type { AttemptRecord } from '../runners.js';
import type { TaskRecord } from '../tasks.js';
import { appendTimeline } from '../timeline.js';
import { readBinding } from './store.js';

type ArtifactEvent = Extract<RunnerEvent, { type: 'artifact' }>;
async function validateSource(client: PoolClient, task: TaskRecord, attempt: AttemptRecord, input: unknown): Promise<PluginArtifactSource> {
  const parsed = pluginArtifactSourceSchema.safeParse(input);
  if (!parsed.success) throw new HttpError(400, 'plugin_artifact_source', 'Invalid plugin artifact source.');
  const source = parsed.data;
  const binding = await readBinding(client, task.id);
  if (source.taskId !== task.id || source.attemptId !== attempt.id || source.ownerVersion !== attempt.owner_version
    || binding.targetRunnerId !== attempt.runner_id || source.bindingId !== binding.bindingId || source.invocationId !== binding.invocationId
    || source.installationId !== binding.materialId || source.treeDigest !== binding.treeDigest || source.hostApiMajor !== binding.hostApiMajor
    || source.artifactId !== binding.artifact.artifactId || source.artifactSha256 !== binding.artifact.sha256) {
    throw new HttpError(409, 'plugin_artifact_identity', 'Plugin artifact source does not match the frozen task and reporting attempt.');
  }
  // Historical phase receipts bind this output; they do not grant a new load or invoke.
  const phases = (await client.query<{ phase: string }>(`SELECT phase FROM flow.plugin_tool_authorizations
    WHERE binding_id=$1 AND invocation_id=$2 AND task_id=$3 AND attempt_id=$4 AND owner_version=$5 AND runner_id=$6`,
  [source.bindingId, source.invocationId, task.id, attempt.id, attempt.owner_version, attempt.runner_id])).rows;
  if (phases.length !== 2 || !phases.some(row => row.phase === 'load') || !phases.some(row => row.phase === 'invoke')) {
    throw new HttpError(409, 'plugin_artifact_authorization', 'Both phases must belong to this exact attempt.');
  }
  return source;
}

/** Called inside reportEvents' owned-attempt transaction. Legacy artifacts retain their existing path. */
export async function recordPluginArtifact(client: PoolClient, task: TaskRecord, attempt: AttemptRecord, event: ArtifactEvent): Promise<void> {
  const source = event.pluginSource === undefined ? null : await validateSource(client, task, attempt, event.pluginSource);
  const artifact = await saveArtifact(client, task, attempt.id, event);
  await appendTimeline(client, task, { kind: 'reference', reference: artifact });
  if (!source) return;
  const reference = await saveDetail(client, task.id, attempt.id, {
    kind: 'detail', title: 'Plugin artifact source association', mediaType: 'application/json', artifactVersion: event.version,
    content: JSON.stringify({ artifactId: event.artifactId, artifactVersion: event.version, pluginSource: source }),
  });
  await appendTimeline(client, task, { kind: 'reference', reference });
}
