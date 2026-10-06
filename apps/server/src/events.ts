import type { Pool, PoolClient } from 'pg';
import type { EventAcknowledgement, EventBatch, RunnerEvent } from '@flow/contracts';
import { canonical, HttpError, sha256, transaction } from './database.js';
import { ownedAttempt, type AttemptRecord } from './runners.js';
import type { TaskRecord } from './tasks.js';
import { saveArtifact, saveDetail, verifyArtifact } from './evidence.js';
import { recordUsage } from './usage.js';
import { recordSession } from './sessions.js';
import { appendTimeline } from './timeline.js';
import { saveAssistantFinal } from './assistant/store.js';

async function applyEvent(client: PoolClient, task: TaskRecord, attempt: AttemptRecord, event: RunnerEvent): Promise<void> {
  if (event.type === 'message') await appendTimeline(client, task, { kind: 'text', text: event.text });
  else if (event.type === 'assistant-final') {
    const reference = await saveAssistantFinal(client, task, attempt, event);
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
  else if (event.type === 'detail' || event.type === 'artifact' || event.type === 'verification') {
    const reference = event.type === 'artifact' ? await saveArtifact(client, task, attempt.id, event)
      : event.type === 'verification' ? await verifyArtifact(client, task, attempt.id, event)
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
export async function reportEvents(pool: Pool, runnerId: string, batch: EventBatch): Promise<EventAcknowledgement> {
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
      await applyEvent(client, task, attempt, event);
      await client.query('INSERT INTO flow.runner_events(attempt_id,sequence,event_id,digest) VALUES($1,$2,$3,$4)', [attempt.id, event.sequence, event.id, digest]);
      attempt.last_sequence = event.sequence;
      accepted += 1;
    }
    if (accepted) {
      await client.query('UPDATE flow.attempts SET last_sequence=$2,last_event_at=clock_timestamp() WHERE id=$1', [attempt.id, attempt.last_sequence]);
      await client.query('UPDATE flow.tasks SET status=$2,cursor=$3,pending_decision=$4,updated_at=clock_timestamp() WHERE id=$1', [task.id, task.status, task.cursor, task.pending_decision]);
      await client.query('UPDATE flow.tasks SET verification_status=$2,latest_artifact_id=$3,latest_artifact_version=$4 WHERE id=$1', [task.id, task.verification_status, task.latest_artifact_id, task.latest_artifact_version]);
      await client.query('UPDATE flow.tasks SET usage=$2 WHERE id=$1', [task.id, task.usage]);
    }
    return { accepted, lastSequence: attempt.last_sequence };
  });
}
