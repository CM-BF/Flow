import { checkTaskMessageSettings } from '../conversations/message-settings.js';
import type { PoolClient } from 'pg';
import { contextObservationEventSchema, contextObservationPayloadSchema, type ContextObservationEvent, type ContextObservationPayload } from '../../../../packages/contracts/src/context-observation-event.js';
import { CONTEXT_DETAIL_TITLE, CONTEXT_HISTORY_PROTOCOL, contextHistoryMaterialsSchema, contextHistoryResponseSchema, contextHistorySampleSchema, type ContextHistoryMaterials, type ContextHistorySample } from '../../../../packages/contracts/src/context-observation-history.js';
import { contextObservationSchema, type ContextIdentity, type ContextMeasurement } from '../../../../packages/contracts/src/context-transparency.js';
import { canonical, HttpError, sha256 } from '../database.js';
import { saveDetail } from '../evidence.js';
import { sessionEvidence } from '../conversations/replies.js';
import { requireExecutionProfile } from '../execution-profiles/store.js';
import { contextReference } from '../conversation-context/store.js';
import { goalExecutionReferences } from '../goal-context/store.js';
import type { TaskRecord } from '../tasks.js';
import type { AttemptRecord } from '../runners.js';

interface HistoryRow {
  task_id: string; attempt_id: string; observation_id: string; event_sequence: number;
  wire_canonical: string; wire_digest: string; sample: unknown; detail_id: string; observed_at: Date; received_at: Date;
  detail_task_id: string | null; detail_attempt_id: string | null; detail_title: string | null; detail_kind: string | null;
  detail_content: string | null; detail_media_type: string | null;
  attempt_owner_version: number; attempt_runner_id: string; attempt_native_session_id: string | null;
}
const rows = `SELECT c.*,d.task_id AS detail_task_id,d.attempt_id AS detail_attempt_id,d.title AS detail_title,
  d.kind AS detail_kind,d.content AS detail_content,d.media_type AS detail_media_type,
  a.owner_version AS attempt_owner_version,a.runner_id AS attempt_runner_id,a.native_session_id AS attempt_native_session_id
  FROM flow.context_observations c JOIN flow.attempts a ON a.id=c.attempt_id AND a.task_id=c.task_id
  LEFT JOIN flow.details d ON d.id=c.detail_id`;
const invalid = () => new HttpError(409, 'context_observation_invalid', 'The context observation is not bound to this execution.');
const unknown = (): ContextMeasurement => ({ kind: 'unknown', value: null, reason: 'not-observed' });

/** Caller owns the reportEvents transaction and its runner/task/attempt locks, live lease and event fence. */
export async function record(client: PoolClient, task: TaskRecord, attempt: AttemptRecord, input: ContextObservationEvent): Promise<ContextHistorySample> {
  const parsed = contextObservationEventSchema.safeParse(input);
  if (!parsed.success) throw new HttpError(400, 'invalid_context_observation', 'Invalid context observation metadata.');
  const event = parsed.data;
  const identity = await bindIdentity(client, task, attempt, event.observation);
  const wire = canonical(event.observation);
  const existing = (await client.query<HistoryRow>(`${rows} WHERE c.attempt_id=$1 AND c.observation_id=$2`, [attempt.id, event.observation.observationId])).rows[0];
  if (existing) {
    if (existing.wire_canonical !== wire || existing.wire_digest !== sha256(wire)) throw new HttpError(409, 'context_observation_conflict', 'This observation ID was used for different metadata.');
    return historySample(existing, task.id, attempt.id);
  }
  const material = await frozenMaterials(client, task.id);
  const detailRef = await saveDetail(client, task.id, attempt.id, { title: CONTEXT_DETAIL_TITLE, kind: 'detail', content: wire, mediaType: 'application/json' });
  const reading = (value: number | null): ContextMeasurement => value === null ? unknown() : {
    kind: 'estimate', value, source: { name: event.observation.source.name, version: event.observation.source.version },
    measurementMethod: 'sdk-summary-estimate', tokenBasis: event.observation.source.tokenBasis, coverage: 'full', evidenceRef: detailRef,
  };
  const observation = contextObservationSchema.parse({
    id: event.observation.observationId, identity: { ...identity, executionInputDigest: material.executionInputDigest, materialRevisionDigest: material.materialRevisionDigest },
    observedAt: event.observation.observedAt, modelCapacity: unknown(), used: reading(event.observation.used), compactionWindow: reading(event.observation.compactionWindow),
    categories: event.observation.categories.map(item => ({ id: `sdk-${item.kind}`, ...item })), compression: { state: 'not-observed' },
  });
  const saved = (await client.query<{ received_at: Date }>(`INSERT INTO flow.context_observations
    (task_id,attempt_id,observation_id,event_sequence,wire_canonical,wire_digest,sample,detail_id,observed_at)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING received_at`,
  [task.id, attempt.id, observation.id, event.sequence, wire, sha256(wire), JSON.stringify({ observation, materials: material.materials }), detailRef.id, observation.observedAt])).rows[0]!;
  return contextHistorySampleSchema.parse({ eventSequence: event.sequence, receivedAt: saved.received_at.toISOString(), detailRef, observation, materials: material.materials });
}

async function bindIdentity(client: PoolClient, task: TaskRecord, attempt: AttemptRecord, payload: ContextObservationPayload): Promise<ContextIdentity> {
  if (task.current_attempt_id !== attempt.id || attempt.task_id !== task.id || attempt.owner_version !== task.owner_version || task.submission.harness !== 'claude' || !task.submission.executionProfile || !attempt.native_session_id || payload.nativeSessionId !== attempt.native_session_id) throw invalid();
  const session = await sessionEvidence(client, task);
  if (!session || session.adapterVersion !== payload.source.adapterVersion || session.activeTaskId !== task.id || session.identity.sourceTaskId !== task.id || session.identity.sourceAttemptId !== attempt.id || session.identity.runnerId !== attempt.runner_id || session.identity.nativeSessionId !== attempt.native_session_id) throw invalid();
  const profile = await requireExecutionProfile(client, task.submission.executionProfile);
  if (profile.configuration.harness !== 'claude' || profile.configuration.adapterVersion !== payload.source.adapterVersion || profile.reference.runnerId !== attempt.runner_id) throw invalid();
  const settings = checkTaskMessageSettings(task.submission, profile);
  if (!settings.ok) throw invalid();
  return { subject: { kind: 'attempt', taskId: task.id, attemptId: attempt.id, ownerVersion: attempt.owner_version, nativeSessionId: attempt.native_session_id },
    harness: 'claude', requestedModel: settings.snapshot?.requested.model ?? profile.configuration.model, resolvedModel: payload.resolvedModel, profile: profile.reference,
    executionInputDigest: null, materialRevisionDigest: null, historyEpoch: null };
}

async function frozenMaterials(client: PoolClient, taskId: string): Promise<{ executionInputDigest: string | null; materialRevisionDigest: string | null; materials: ContextHistoryMaterials }> {
  const binding = (await client.query<{ conversation_input_id: string | null; goal_input_id: string | null }>('SELECT conversation_input_id,goal_input_id FROM flow.tasks WHERE id=$1', [taskId])).rows[0];
  if (!binding || binding.conversation_input_id && binding.goal_input_id) throw invalid();
  const context = await contextReference(client, binding.conversation_input_id);
  if (context) {
    // This history DTO describes knowledge citations only; a v2 subset is not a complete inventory.
    if (context.templateVersion === 2) return { executionInputDigest: context.executionInputDigest,
      materialRevisionDigest: null, materials: { state: 'unknown', reason: 'metadata-unavailable' } };
    const materials = contextHistoryMaterialsSchema.parse({ state: 'known', sources: context.sources.map(({ citation, byteLength }) => ({ citation, byteLength, tokens: null })) });
    return { executionInputDigest: context.executionInputDigest, materialRevisionDigest: sha256(canonical({ version: 1, citations: context.sources.map(source => source.citation) })), materials };
  }
  const goal = binding.goal_input_id ? (await goalExecutionReferences(client, [taskId])).get(taskId) : undefined;
  return { executionInputDigest: goal?.executionInputDigest ?? null, materialRevisionDigest: null, materials: { state: 'unknown', reason: 'metadata-unavailable' } };
}

function historySample(row: HistoryRow, taskId: string, attemptId: string): ContextHistorySample {
  if (row.task_id !== taskId || row.attempt_id !== attemptId || row.detail_task_id !== taskId || row.detail_attempt_id !== attemptId || row.detail_title !== CONTEXT_DETAIL_TITLE || row.detail_kind !== 'detail' || row.detail_media_type !== 'application/json' || row.detail_content !== row.wire_canonical || sha256(row.wire_canonical) !== row.wire_digest) throw invalid();
  const stored = row.sample as { observation?: unknown; materials?: unknown } | null;
  const parsed = contextHistorySampleSchema.safeParse({ eventSequence: row.event_sequence, receivedAt: row.received_at.toISOString(), detailRef: { id: row.detail_id, title: row.detail_title }, observation: stored?.observation, materials: stored?.materials });
  if (!parsed.success || parsed.data.observation.id !== row.observation_id || Date.parse(parsed.data.observation.observedAt) !== row.observed_at.getTime()) throw invalid();
  const subject = parsed.data.observation.identity.subject;
  if (subject.kind !== 'attempt' || subject.taskId !== taskId || subject.attemptId !== attemptId || subject.ownerVersion !== row.attempt_owner_version || subject.nativeSessionId !== row.attempt_native_session_id || parsed.data.observation.identity.profile?.runnerId !== row.attempt_runner_id) throw invalid();
  let wire: unknown;
  try { wire = JSON.parse(row.wire_canonical); } catch { throw invalid(); }
  const payload = contextObservationPayloadSchema.safeParse(wire);
  if (!payload.success || canonical(payload.data) !== row.wire_canonical) throw invalid();
  const observation = parsed.data.observation;
  if (payload.data.observationId !== observation.id || payload.data.observedAt !== observation.observedAt || payload.data.nativeSessionId !== subject.nativeSessionId || payload.data.resolvedModel !== observation.identity.resolvedModel || payload.data.used !== observation.used.value || payload.data.compactionWindow !== observation.compactionWindow.value || canonical(payload.data.categories.map(item => ({ id: `sdk-${item.kind}`, ...item }))) !== canonical(observation.categories)) throw invalid();
  return parsed.data;
}

/** Historical reading only. The center selects the current attempt; no latest-sequence equality or remaining calculation. */
export async function readLatestHistory(client: PoolClient, task: TaskRecord) {
  const row = task.current_attempt_id ? (await client.query<HistoryRow>(`${rows}
    WHERE c.task_id=$1 AND c.attempt_id=$2 ORDER BY c.event_sequence DESC LIMIT 1`, [task.id, task.current_attempt_id])).rows[0] : undefined;
  return contextHistoryResponseSchema.parse({ protocol: CONTEXT_HISTORY_PROTOCOL, taskId: task.id, attemptId: task.current_attempt_id,
    latest: row ? historySample(row, task.id, task.current_attempt_id!) : null,
    current: { kind: 'unknown', value: null, reason: 'history-only' }, remaining: { kind: 'unknown', value: null, reason: 'history-only' } });
}
