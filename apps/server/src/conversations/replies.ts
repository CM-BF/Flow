import type { PoolClient } from 'pg';
import { runnerEventSchema } from '../../../../packages/contracts/src/runner.js';
import type { ConversationAssistantReply, ConversationEffectiveSettings, ConversationSession } from '../../../../packages/contracts/src/conversations.js';
import { sha256 } from '../database.js';
import type { TaskRecord } from '../tasks.js';

const adapterVersion = 'claude-sdk-0.3.290-v1' as const;
const unknownSettings: ConversationEffectiveSettings = { model: null, thinking: 'unknown', tools: 'unknown', source: null };
interface SessionRecord { attempt_id: string; native_session_id: string; runner_id: string; active_task_id: string | null }
interface SessionEvidence { identity: ConversationSession; activeTaskId: string | null; effective: ConversationEffectiveSettings; knownAdapter: boolean }

/** Identity comes from the fenced attempt/session tables; settings require exact adapter provenance. */
export async function sessionEvidence(client: PoolClient, task: TaskRecord): Promise<SessionEvidence | null> {
  if (task.submission.harness !== 'claude' || !task.current_attempt_id) return null;
  const record = (await client.query<SessionRecord>(`SELECT a.id AS attempt_id,a.native_session_id,a.runner_id,s.active_task_id
    FROM flow.attempts a JOIN flow.sessions s ON s.id=a.native_session_id AND s.harness='claude' AND s.runner_id=a.runner_id
    WHERE a.id=$1 AND a.task_id=$2 AND a.owner_version=$3`, [task.current_attempt_id, task.id, task.owner_version])).rows[0];
  if (!record) return null;
  const details = (await client.query<{ id: string; content: string }>("SELECT id,content FROM flow.details WHERE task_id=$1 AND attempt_id=$2 AND kind='session' LIMIT 2", [task.id, record.attempt_id])).rows;
  let effective = unknownSettings;
  let knownAdapter = false;
  if (details.length === 1) {
    let raw: unknown;
    try { raw = JSON.parse(details[0]!.content); } catch { raw = null; }
    const parsed = runnerEventSchema.safeParse(raw);
    if (parsed.success && parsed.data.type === 'session' && parsed.data.nativeSessionId === record.native_session_id && parsed.data.adapterVersion === adapterVersion) {
      knownAdapter = true;
      const models = (parsed.data.resources ?? []).filter(value => value.startsWith('model:')).map(value => value.slice(6));
      effective = { model: models.length === 1 && models[0]!.length > 0 && models[0]!.length <= 180 ? models[0]! : null,
        thinking: 'disabled', tools: 'configured-readonly', source: { kind: 'recorded-adapter-session', adapterVersion, taskId: task.id, attemptId: record.attempt_id, detailId: details[0]!.id } };
    }
  }
  return { identity: { nativeSessionId: record.native_session_id, runnerId: record.runner_id, sourceTaskId: task.id, sourceAttemptId: record.attempt_id }, activeTaskId: record.active_task_id, effective, knownAdapter };
}
interface ArtifactRecord { artifact_id: string; version: string; detail_id: string; attempt_id: string; title: string; kind: string; content: string; media_type: string; artifact_version: string | null }
async function finalReply(client: PoolClient, task: TaskRecord, session: SessionEvidence | null): Promise<ConversationAssistantReply> {
  if (['queued', 'running', 'waiting', 'cancel_requested'].includes(task.status)) return { state: 'pending', reason: 'execution-pending' };
  if (task.status !== 'succeeded') return { state: 'unavailable', reason: 'execution-not-succeeded' };
  if (!session) return { state: 'unavailable', reason: 'missing-session' };
  if (!session.knownAdapter) return { state: 'unavailable', reason: 'unknown-adapter' };
  const artifacts = (await client.query<ArtifactRecord>(`SELECT a.artifact_id,a.version,a.detail_id,d.attempt_id,d.title,d.kind,d.content,d.media_type,d.artifact_version
    FROM flow.artifacts a JOIN flow.details d ON d.id=a.detail_id AND d.task_id=a.task_id
    WHERE a.task_id=$1 AND a.attempt_id=$2 LIMIT 2`, [task.id, task.current_attempt_id])).rows;
  if (!artifacts.length) return { state: 'unavailable', reason: 'missing-result' };
  if (artifacts.length !== 1) return { state: 'unavailable', reason: 'ambiguous-result' };
  const artifact = artifacts[0]!;
  if (artifact.attempt_id !== task.current_attempt_id || artifact.kind !== 'artifact' || artifact.media_type !== 'text/plain' ||
    artifact.artifact_id !== task.latest_artifact_id || artifact.version !== task.latest_artifact_version || artifact.artifact_version !== artifact.version ||
    sha256(artifact.content) !== artifact.version || task.verification_status !== 'passed') return { state: 'unavailable', reason: 'invalid-result' };
  const preview = artifact.content.slice(0, 4000).replace(/[\uD800-\uDBFF]$/, '');
  return { state: 'available', role: 'assistant', messageId: `artifact:${artifact.detail_id}`, text: preview, truncated: artifact.content.length > 4000,
    contentRef: { kind: 'artifact', id: artifact.detail_id, title: artifact.title, taskId: task.id, attemptId: artifact.attempt_id },
    source: { kind: 'adapter-final-artifact', adapterVersion, taskId: task.id, attemptId: artifact.attempt_id, artifactId: artifact.artifact_id, artifactVersion: artifact.version, detailId: artifact.detail_id } };
}
export async function assistantProjection(client: PoolClient, task: TaskRecord) {
  const session = await sessionEvidence(client, task);
  return { assistant: await finalReply(client, task, session), effective: session?.effective ?? unknownSettings };
}
