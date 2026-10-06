import type { PoolClient } from 'pg';
import { MAX_STEERING_COMMANDS_PER_ATTEMPT } from '../../../../packages/contracts/src/active-steering.js';

interface CommandAdmissionState {
  revision: number; sealed: boolean; finalExists: boolean;
  pending: 'accepted' | 'received' | 'unknown' | null;
}
export type CommandAdmissionBlock = 'final-exists' | 'limit-reached' | 'sealed' | 'stale-revision' | 'pending' | 'unknown-pending';

/** Reads committed state only. The mutation caller already holds the runner/task/attempt locks. */
export async function readCommandAdmission(client: PoolClient, attemptId: string): Promise<CommandAdmissionState> {
  return (await client.query<CommandAdmissionState>(`SELECT
    COALESCE((SELECT revision FROM flow.steering_attempts WHERE attempt_id=$1),0) AS revision,
    EXISTS(SELECT 1 FROM flow.steering_attempts WHERE attempt_id=$1 AND seal IS NOT NULL) AS sealed,
    EXISTS(SELECT 1 FROM flow.assistant_messages WHERE attempt_id=$1) AS "finalExists",
    (SELECT status FROM flow.steering_commands WHERE attempt_id=$1 AND status IN ('accepted','received','unknown') LIMIT 1) AS pending`, [attemptId])).rows[0]!;
}
/** The same new-command policy serves read snapshots and the locked POST callback, never replay. */
export function commandAdmissionBlock(state: CommandAdmissionState, expectedRevision?: number): CommandAdmissionBlock | null {
  if (state.finalExists) return 'final-exists';
  if (state.revision >= MAX_STEERING_COMMANDS_PER_ATTEMPT) return 'limit-reached';
  if (state.sealed) return 'sealed';
  if (expectedRevision !== undefined && state.revision !== expectedRevision) return 'stale-revision';
  if (state.pending === 'unknown') return 'unknown-pending';
  return state.pending ? 'pending' : null;
}
