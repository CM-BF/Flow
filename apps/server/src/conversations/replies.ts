import { conversationHarness } from '../../../../packages/contracts/src/conversation-harness.js';
import type { PoolClient } from 'pg';
import { runnerEventSchema } from '../../../../packages/contracts/src/runner.js';
import type { ConversationAssistantReply, ConversationEffectiveSettings, ConversationSession, ConversationTurn } from '../../../../packages/contracts/src/conversations.js';
import { HttpError, sha256 } from '../database.js';
import { readAssistantFinalPreviews, type AssistantFinalPreview } from '../assistant/index.js';
import type { TaskRecord } from '../tasks.js';

const legacyAdapterVersion = 'claude-sdk-0.3.290-v1' as const;
const unknownSettings: ConversationEffectiveSettings = { model: null, thinking: 'unknown', tools: 'unknown', source: null };
interface SessionRecord { harness: string; task_id: string; details: { id: string; content: string }[]; attempt_id: string; native_session_id: string; runner_id: string; active_task_id: string | null }
interface SessionEvidence { identity: ConversationSession; activeTaskId: string | null; effective: ConversationEffectiveSettings; knownAdapter: boolean; adapterVersion: string | null }

/** Identity comes from fenced current attempts/sessions; each task retains its own LIMIT 2 ambiguity check. */
export async function sessionEvidences(client: PoolClient, tasks: readonly TaskRecord[]): Promise<Map<string, SessionEvidence>> {
  if (tasks.length > 50) throw new HttpError(400, 'conversation_turn_batch_limit', 'At most 50 turn projections can be read together.');
  const eligible = tasks.filter(task => conversationHarness(task.submission.harness) && task.current_attempt_id);
  if (!eligible.length) return new Map();
  const records = (await client.query<SessionRecord>(`SELECT request.harness,a.task_id,a.id AS attempt_id,a.native_session_id,a.runner_id,s.active_task_id,
    coalesce((SELECT jsonb_agg(detail) FROM (SELECT id,content FROM flow.details
      WHERE task_id=a.task_id AND attempt_id=a.id AND kind='session' LIMIT 2) detail),'[]'::jsonb) AS details
    FROM flow.attempts a JOIN flow.sessions s ON s.id=a.native_session_id AND s.runner_id=a.runner_id
    JOIN unnest($1::text[],$2::text[],$3::integer[],$4::text[]) AS request(task_id,attempt_id,owner_version,harness)
      ON a.task_id=request.task_id AND a.id=request.attempt_id AND a.owner_version=request.owner_version AND s.harness=request.harness`,
  [eligible.map(task => task.id), eligible.map(task => task.current_attempt_id), eligible.map(task => task.owner_version), eligible.map(task => task.submission.harness)])).rows;
  return new Map(records.map(record => [record.task_id, projectSession(record)]));
}
export async function sessionEvidence(client: PoolClient, task: TaskRecord): Promise<SessionEvidence | null> {
  return (await sessionEvidences(client, [task])).get(task.id) ?? null;
}
function projectSession(record: SessionRecord): SessionEvidence {
  const details = record.details;
  let effective = unknownSettings;
  let knownAdapter = false;
  let adapterVersion: string | null = null;
  if (details.length === 1) {
    let raw: unknown;
    try { raw = JSON.parse(details[0]!.content); } catch { raw = null; }
    const parsed = runnerEventSchema.safeParse(raw);
    if (parsed.success && parsed.data.type === 'session' && parsed.data.nativeSessionId === record.native_session_id) {
      adapterVersion = parsed.data.adapterVersion;
      knownAdapter = (conversationHarness(record.harness)?.adapters as readonly string[] | undefined)?.includes(adapterVersion) ?? false;
      const models = (parsed.data.resources ?? []).filter(value => value.startsWith('model:')).map(value => value.slice(6));
      if (knownAdapter && record.harness === 'claude' && adapterVersion === legacyAdapterVersion) effective = { model: models.length === 1 && models[0]!.length > 0 && models[0]!.length <= 180 ? models[0]! : null,
        thinking: 'disabled', tools: 'configured-readonly', source: { kind: 'recorded-adapter-session', adapterVersion, taskId: record.task_id, attemptId: record.attempt_id, detailId: details[0]!.id } };
    }
  }
  return { identity: { nativeSessionId: record.native_session_id, runnerId: record.runner_id, sourceTaskId: record.task_id, sourceAttemptId: record.attempt_id }, activeTaskId: record.active_task_id, effective, knownAdapter, adapterVersion };
}
interface ArtifactRecord { task_id: string; artifact_id: string; version: string; detail_id: string; attempt_id: string; title: string; kind: string; content: string; media_type: string; artifact_version: string | null }
async function legacyReplies(client: PoolClient, tasks: readonly TaskRecord[]): Promise<Map<string, ConversationAssistantReply>> {
  if (!tasks.length) return new Map();
  const artifacts = (await client.query<ArtifactRecord>(`SELECT artifact.*
    FROM unnest($1::text[],$2::text[]) AS request(task_id,attempt_id)
    CROSS JOIN LATERAL (SELECT a.task_id,a.artifact_id,a.version,a.detail_id,d.attempt_id,d.title,d.kind,d.content,d.media_type,d.artifact_version
      FROM flow.artifacts a JOIN flow.details d ON d.id=a.detail_id AND d.task_id=a.task_id
      WHERE a.task_id=request.task_id AND a.attempt_id=request.attempt_id LIMIT 2) artifact`,
  [tasks.map(task => task.id), tasks.map(task => task.current_attempt_id)])).rows;
  const byTask = new Map<string, ArtifactRecord[]>();
  for (const artifact of artifacts) {
    const group = byTask.get(artifact.task_id) ?? [];
    group.push(artifact); byTask.set(artifact.task_id, group);
  }
  return new Map(tasks.map(task => [task.id, legacyReply(task, byTask.get(task.id) ?? [])]));
}
function legacyReply(task: TaskRecord, artifacts: ArtifactRecord[]): ConversationAssistantReply {
  if (!artifacts.length) return { state: 'unavailable', reason: 'missing-result' };
  if (artifacts.length !== 1) return { state: 'unavailable', reason: 'ambiguous-result' };
  const artifact = artifacts[0]!;
  if (artifact.attempt_id !== task.current_attempt_id || artifact.kind !== 'artifact' || artifact.media_type !== 'text/plain' ||
    artifact.artifact_id !== task.latest_artifact_id || artifact.version !== task.latest_artifact_version || artifact.artifact_version !== artifact.version ||
    sha256(artifact.content) !== artifact.version || task.verification_status !== 'passed') return { state: 'unavailable', reason: 'invalid-result' };
  return { state: 'available', role: 'assistant', messageId: `artifact:${artifact.detail_id}`, ...bodyPreview(artifact.content),
    contentRef: { kind: 'artifact', id: artifact.detail_id, title: artifact.title, taskId: task.id, attemptId: artifact.attempt_id },
    source: { kind: 'adapter-final-artifact', adapterVersion: legacyAdapterVersion, taskId: task.id, attemptId: artifact.attempt_id, artifactId: artifact.artifact_id, artifactVersion: artifact.version, detailId: artifact.detail_id } };
}
type TypedFinal = AssistantFinalPreview | 'invalid' | null;
async function boundTypedFinals(client: PoolClient, tasks: readonly TaskRecord[], sessions: Map<string, SessionEvidence>): Promise<Map<string, TypedFinal>> {
  const eligible = tasks.filter(task => sessions.get(task.id)?.knownAdapter);
  const previews = await readAssistantFinalPreviews(client, eligible.map(task => ({ taskId: task.id, attemptId: sessions.get(task.id)!.identity.sourceAttemptId })));
  return new Map(eligible.map((task, index): [string, TypedFinal] => {
    const result = previews[index]!, session = sessions.get(task.id)!;
    if (result.error) return [task.id, 'invalid'];
    const message = result.preview;
    if (message && (message.taskId !== task.id || message.attemptId !== task.current_attempt_id || message.nativeSessionId !== session.identity.nativeSessionId || message.source !== conversationHarness(task.submission.harness)?.source)) return [task.id, 'invalid'];
    return [task.id, message];
  }));
}
function bodyPreview(content: string) {
  const text = content.slice(0, 4000).replace(/[\uD800-\uDBFF]$/, '');
  return { text, truncated: text.length < content.length };
}
function typedReply(message: AssistantFinalPreview): ConversationAssistantReply {
  const identity = { kind: 'assistant-final' as const, messageId: message.id, taskId: message.taskId, attemptId: message.attemptId,
    nativeSessionId: message.nativeSessionId, eventId: message.eventId, sourceMessageId: message.sourceMessageId, contentDigest: message.contentDigest, detailId: message.detail.id };
  const source = message.source === 'codex.app-server.agent-message'
    ? { ...identity, source: message.source, nativeSourceIdentity: message.nativeSourceIdentity }
    : { ...identity, source: message.source };
  return { state: 'available', role: 'assistant', messageId: message.id, text: message.text, truncated: message.truncated,
    contentRef: { kind: 'detail', id: message.detail.id, title: message.detail.title, taskId: message.taskId, attemptId: message.attemptId }, source };
}
function finalReply(task: TaskRecord, session: SessionEvidence | undefined, typed: TypedFinal, legacy: ConversationAssistantReply | undefined): ConversationAssistantReply {
  if (['queued', 'running', 'waiting', 'cancel_requested'].includes(task.status)) return { state: 'pending', reason: 'execution-pending' };
  if (task.status !== 'succeeded') return { state: 'unavailable', reason: 'execution-not-succeeded' };
  if (!session) return { state: 'unavailable', reason: 'missing-session' };
  if (!session.knownAdapter) return { state: 'unavailable', reason: 'unknown-adapter' };
  if (typed === 'invalid') return { state: 'unavailable', reason: 'invalid-result' };
  if (typed) return task.verification_status === 'passed' ? typedReply(typed) : { state: 'unavailable', reason: 'invalid-result' };
  if (session.adapterVersion !== legacyAdapterVersion) return { state: 'unavailable', reason: 'missing-result' };
  return legacy!;
}
export type AssistantProjection = Pick<ConversationTurn, 'assistant' | 'effective'>;
/** Bounded same-client projection; DB errors propagate, a corrupt final affects only its own task. */
export async function assistantProjections(client: PoolClient, tasks: readonly TaskRecord[]): Promise<AssistantProjection[]> {
  if (tasks.length > 50) throw new HttpError(400, 'conversation_turn_batch_limit', 'At most 50 turn projections can be read together.');
  const uniqueTasks = [...new Map(tasks.map(task => [task.id, task])).values()];
  const sessions = await sessionEvidences(client, uniqueTasks);
  const typedFinals = await boundTypedFinals(client, uniqueTasks, sessions);
  const legacy = await legacyReplies(client, uniqueTasks.filter(task => task.status === 'succeeded' &&
    sessions.get(task.id)?.adapterVersion === legacyAdapterVersion && typedFinals.get(task.id) === null));
  return tasks.map(task => {
    const session = sessions.get(task.id), typed = typedFinals.get(task.id) ?? null;
    const source = typed && typed !== 'invalid' ? { kind: 'assistant-final' as const, messageId: typed.id, taskId: task.id, attemptId: typed.attemptId, detailId: typed.detail.id } : null;
    const effective: ConversationEffectiveSettings = typed && typed !== 'invalid'
      ? typed.source === 'codex.app-server.agent-message' ? { ...unknownSettings, codex: typed.settings, source }
        : { ...typed.settings.effective, ...('messageSettings' in typed.settings ? { messageSettings: typed.settings.messageSettings } : { runnerRequested: typed.settings.requested }), source }
      : session?.effective ?? unknownSettings;
    return { assistant: finalReply(task, session, typed, legacy.get(task.id)), effective };
  });
}
export async function assistantProjection(client: PoolClient, task: TaskRecord) {
  return (await assistantProjections(client, [task]))[0]!;
}
