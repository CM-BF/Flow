import { guardVerificationEvent } from './plugin-runtime/verification-result.js';
import type { TrustedPluginVerifierPolicy } from './plugin-verification-configuration.js';
import { saveNativeActivityBody, assertNativeActivityBodiesFinalizable } from './native-activity-body/store.js';
import type { Pool, PoolClient } from 'pg';
import type { EventAcknowledgement, EventBatch, RunnerEvent } from '@flow/contracts';
import { recordReceiptInTransaction } from './active-steering/commands.js';
import { assertControlledFinal, closePendingSteering, recordSteeringResult } from './active-steering/results.js';
import { canonical, HttpError, sha256, transaction } from './database.js';
import { ownedAttempt, type AttemptRecord } from './runners.js';
import type { TaskRecord } from './tasks.js';
import { saveDetail, verifyArtifact } from './evidence.js';
import { recordPluginArtifact } from './plugin-runtime/artifact.js';
import { assertEngineeringCompletion } from './engineering/verification.js';
import { record as recordContextObservation } from './context-transparency/store.js';
import { recordUsage } from './usage.js';
import { recordSession } from './sessions.js';
import { appendTimeline } from './timeline.js';
import { saveAssistantFinal } from './assistant/store.js';
import { saveAssistantStreamMarker, settleAssistantStream } from './assistant-stream/settlement.js';
import { saveAssistantStream } from './assistant-stream/store.js';
import { saveNativeActivity, type NativeActivityEvent } from './native-activity/store.js';

export async function applyEvent(client: PoolClient, task: TaskRecord, attempt: AttemptRecord, event: RunnerEvent | NativeActivityEvent, verifierPolicy?: TrustedPluginVerifierPolicy): Promise<void> {
  if (event.type !== 'native-activity' && await guardVerificationEvent(client, task, attempt, event, verifierPolicy)) return;
  if (event.type === 'steering-result') await recordSteeringResult(client, task, attempt, event.result);
  else if (event.type === 'steering-receipt') {
    if (event.receipt.attemptId !== attempt.id || event.receipt.ownerVersion !== attempt.owner_version) throw new HttpError(409, 'steering_identity', 'Receipt does not belong to the reporting attempt.');
    await recordReceiptInTransaction(client, attempt.runner_id, event.receipt);
  }
  else if (event.type === 'context-observation') await recordContextObservation(client, task, attempt, event);
  else if (event.type === 'message') await appendTimeline(client, task, { kind: 'text', text: event.text });
  else if (event.type === 'assistant-stream-marker') await saveAssistantStreamMarker(client, task, attempt, event);
  else if (event.type === 'assistant-stream') {
    const reference = await saveAssistantStream(client, task, attempt, event);
    if (reference) await appendTimeline(client, task, { kind: 'reference', reference });
  }
  else if (event.type === 'native-activity-body') await saveNativeActivityBody(client, task, attempt, event);
  else if (event.type === 'native-activity') {
    const reference = await saveNativeActivity(client, task, attempt, event);
    if (reference) await appendTimeline(client, task, { kind: 'reference', reference });
  }
  else if (event.type === 'assistant-final') {
    await assertNativeActivityBodiesFinalizable(client, attempt.id);
    await assertControlledFinal(client, attempt, event);
    const reference = await saveAssistantFinal(client, task, attempt, event);
    await settleAssistantStream(client, task, attempt, event.messageId);
    await appendTimeline(client, task, { kind: 'reference', reference });
  }
  else if (event.type === 'session') {
    await recordSession(client, task, attempt, event);
    const reference = await saveDetail(client, task.id, attempt.id, { title: 'Native session', kind: 'session', content: JSON.stringify(event), mediaType: 'application/json' });
    await appendTimeline(client, task, { kind: 'reference', reference });
  }
  else if (event.type === 'usage') {
    await recordUsage(client, task, attempt, event);
    const reference = await saveDetail(client, task.id, attempt.id, { title: `Usage: ${event.source}`, kind: 'usage', content: JSON.stringify(event), mediaType: 'application/json' });
    await appendTimeline(client, task, { kind: 'reference', reference });
  }
  else if (event.type === 'artifact') await recordPluginArtifact(client, task, attempt, event);
  else if (event.type === 'detail' || event.type === 'verification') {
    const reference = event.type === 'verification' ? await verifyArtifact(client, task, attempt.id, event)
      : await saveDetail(client, task.id, attempt.id, { title: event.title, kind: 'detail', content: event.content, mediaType: event.mediaType });
    await appendTimeline(client, task, { kind: 'reference', reference });
  }
  else if (event.type === 'decision') {
    if (task.status !== 'running' || task.pending_decision) throw new HttpError(409, 'decision_conflict', 'The task cannot request another decision now.');
    const exists = await client.query('SELECT 1 FROM flow.decisions WHERE task_id=$1 AND id=$2', [task.id, event.decisionId]);
    if (exists.rowCount) throw new HttpError(409, 'decision_conflict', 'A decision ID cannot be reused.');
    await client.query('INSERT INTO flow.decisions(task_id,id,prompt) VALUES($1,$2,$3)', [task.id, event.decisionId, event.prompt]);
    task.pending_decision = { id: event.decisionId, prompt: event.prompt };
    task.status = 'waiting';
  }
  else if (event.type === 'completed') {
    if (event.outcome === 'succeeded') await assertNativeActivityBodiesFinalizable(client, attempt.id);
    if (task.submission.engineering && event.outcome === 'succeeded') await assertEngineeringCompletion(client, task, attempt);
    await closePendingSteering(client, task, attempt);
    if (event.error) {
      const reference = await saveDetail(client, task.id, attempt.id, { title: 'Execution error', kind: 'detail', content: event.error, mediaType: 'text/plain' });
      await appendTimeline(client, task, { kind: 'reference', reference });
    }
    task.status = event.outcome;
    task.pending_decision = null;
    await client.query('UPDATE flow.attempts SET completed_at=clock_timestamp() WHERE id=$1', [attempt.id]);
    await client.query('UPDATE flow.sessions SET active_task_id=NULL WHERE active_task_id=$1', [task.id]);
  } else throw new HttpError(400, 'unsupported_event', 'This event is not supported yet.');
}
export async function reportEvents(pool: Pool, runnerId: string, batch: EventBatch, verifierPolicy?: TrustedPluginVerifierPolicy): Promise<EventAcknowledgement> {
  return transaction(pool, async client => {
    const { attempt, task } = await ownedAttempt(client, runnerId, batch);
    const live = (await client.query<{ live: boolean }>('SELECT $1::timestamptz>clock_timestamp() AS live', [attempt.lease_expires_at])).rows[0]!.live;
    let accepted = 0;
    let priorSequence: number | undefined;
    for (const event of batch.events) {
      if (priorSequence !== undefined && event.sequence !== priorSequence + 1) throw new HttpError(409, 'event_order', 'Batch sequences must be contiguous and ordered.');
      priorSequence = event.sequence;
      if (event.sequence > attempt.last_sequence + 1) throw new HttpError(409, 'event_gap', 'An earlier event is missing.');
      const digest = sha256(canonical(event));
      const saved = await client.query<{ sequence: number; event_id: string; digest: string }>('SELECT sequence,event_id,digest FROM flow.runner_events WHERE attempt_id=$1 AND (sequence=$2 OR event_id=$3)', [attempt.id, event.sequence, event.id]);
      if (saved.rows.length) {
        const match = saved.rows[0]!;
        if (saved.rows.length !== 1 || match.sequence !== event.sequence || match.event_id !== event.id || match.digest !== digest) throw new HttpError(409, 'event_conflict', 'An event identifier was reused with different content.');
        continue;
      }
      if (!live || attempt.completed_at || ['succeeded', 'failed', 'cancelled', 'uncertain'].includes(task.status)) throw new HttpError(409, 'stale_owner', 'This attempt no longer accepts new events.');
      if (event.sequence !== attempt.last_sequence + 1) throw new HttpError(409, 'event_gap', 'An earlier event is missing.');
      await applyEvent(client, task, attempt, event, verifierPolicy);
      await client.query('INSERT INTO flow.runner_events(attempt_id,sequence,event_id,digest) VALUES($1,$2,$3,$4)', [attempt.id, event.sequence, event.id, digest]);
      attempt.last_sequence = event.sequence;
      accepted += 1;
    }
    if (accepted) {
      await persistEventState(client, task, attempt);
    }
    return { accepted, lastSequence: attempt.last_sequence };
  });
}

export async function persistEventState(client: PoolClient, task: TaskRecord, attempt: AttemptRecord): Promise<void> {
  await client.query('UPDATE flow.attempts SET last_sequence=$2,last_event_at=clock_timestamp() WHERE id=$1', [attempt.id, attempt.last_sequence]);
  await client.query(`UPDATE flow.tasks SET status=$2,cursor=$3,pending_decision=$4,updated_at=clock_timestamp(),
    verification_status=$5,latest_artifact_id=$6,latest_artifact_version=$7,usage=$8 WHERE id=$1`,
  [task.id, task.status, task.cursor, task.pending_decision, task.verification_status, task.latest_artifact_id, task.latest_artifact_version, task.usage]);
}
