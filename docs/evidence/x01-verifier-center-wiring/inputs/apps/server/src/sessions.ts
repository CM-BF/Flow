import type { PoolClient } from 'pg';
import type { RunnerEvent } from '@flow/contracts';
import { HttpError } from './database.js';
import type { AttemptRecord } from './runners.js';
import type { TaskRecord } from './tasks.js';

export async function recordSession(client: PoolClient, task: TaskRecord, attempt: AttemptRecord, event: Extract<RunnerEvent, { type: 'session' }>): Promise<void> {
  if (task.submission.resumeSessionId && task.submission.resumeSessionId !== event.nativeSessionId) throw new HttpError(409, 'session_mismatch', 'The runner did not resume the requested session.');
  if (attempt.native_session_id && attempt.native_session_id !== event.nativeSessionId) throw new HttpError(409, 'session_mismatch', 'An attempt cannot change native session.');
  await client.query('INSERT INTO flow.sessions(id,harness,runner_id,active_task_id) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING', [event.nativeSessionId, task.submission.harness, attempt.runner_id, task.id]);
  const session = (await client.query<{ runner_id: string; active_task_id: string | null }>('SELECT runner_id,active_task_id FROM flow.sessions WHERE id=$1 AND harness=$2 FOR UPDATE', [event.nativeSessionId, task.submission.harness])).rows[0]!;
  if (session.runner_id !== attempt.runner_id || session.active_task_id !== task.id) throw new HttpError(409, 'session_owned', 'This native session is not assigned to this task and runner.');
  await client.query('UPDATE flow.attempts SET native_session_id=$2 WHERE id=$1', [attempt.id, event.nativeSessionId]);
  attempt.native_session_id = event.nativeSessionId;
}
