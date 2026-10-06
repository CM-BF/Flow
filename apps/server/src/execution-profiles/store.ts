import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import type { ExecutionProfile, ExecutionProfileConfiguration, ExecutionProfilePage, ExecutionProfilePublished, ExecutionProfileReference } from '../../../../packages/contracts/src/execution-profiles.js';
import { executionProfileConfigurationJson } from '../../../../packages/contracts/src/execution-profiles.js';
import type { TaskSubmission } from '@flow/contracts';
import { HttpError, sha256, transaction } from '../database.js';

interface ProfileRow { id: string; runner_id: string; config_digest: string; configuration: ExecutionProfileConfiguration; created_at: Date }
function profileView(row: ProfileRow): ExecutionProfile {
  return { reference: { id: row.id, runnerId: row.runner_id, configDigest: row.config_digest }, configuration: row.configuration,
    source: 'runner-configured', availability: 'not-probed',
    model: { value: row.configuration.model, resolvedModel: null, displayName: row.configuration.model, description: 'Configured runner request; provider availability has not been probed.', providerCapabilities: 'unknown' },
    controls: { model: 'select-configured-profile', thinking: 'fixed-disabled', effort: 'unsupported', access: 'configured-policy', queue: false, steer: false }, createdAt: row.created_at.toISOString() };
}
export async function publishProfile(pool: Pool, runnerId: string, configuration: ExecutionProfileConfiguration): Promise<ExecutionProfilePublished> {
  return transaction(pool, async client => {
    const runner = (await client.query<{ harnesses: string[]; revoked: boolean }>('SELECT harnesses,revoked FROM flow.runners WHERE id=$1 FOR UPDATE', [runnerId])).rows[0];
    if (!runner || runner.revoked) throw new HttpError(401, 'runner_revoked', 'Runner credential is unavailable.');
    if (!runner.harnesses.includes(configuration.harness)) throw new HttpError(409, 'profile_harness_mismatch', 'This runner is not registered for the profile harness.');
    const configDigest = sha256(executionProfileConfigurationJson(configuration));
    const existing = (await client.query<ProfileRow>('SELECT * FROM flow.execution_profiles WHERE runner_id=$1', [runnerId])).rows[0];
    if (existing) {
      if (existing.config_digest !== configDigest) throw new HttpError(409, 'profile_immutable', 'Changing execution configuration requires a new runner identity.');
      return { profile: profileView(existing), replayed: true };
    }
    const row = (await client.query<ProfileRow>('INSERT INTO flow.execution_profiles(id,runner_id,config_digest,configuration) VALUES($1,$2,$3,$4) RETURNING *', [randomUUID(), runnerId, configDigest, configuration])).rows[0]!;
    return { profile: profileView(row), replayed: false };
  });
}
export async function listProfiles(pool: Pool, after: string | undefined, limit: number): Promise<ExecutionProfilePage> {
  return transaction(pool, async client => {
    const rows = (await client.query<ProfileRow>('SELECT p.* FROM flow.execution_profiles p JOIN flow.runners r ON r.id=p.runner_id WHERE NOT r.revoked AND ($1::text IS NULL OR p.id>$1) ORDER BY p.id LIMIT $2', [after ?? null, limit + 1])).rows;
    const profiles = rows.slice(0, limit).map(profileView);
    return { profiles, nextCursor: rows.length > limit ? profiles.at(-1)!.reference.id : null };
  }, true);
}

export async function requireExecutionProfile(client: PoolClient, reference: ExecutionProfileReference): Promise<ExecutionProfile> {
  const row = (await client.query<ProfileRow & { revoked: boolean }>('SELECT p.*,r.revoked FROM flow.execution_profiles p JOIN flow.runners r ON r.id=p.runner_id WHERE p.id=$1', [reference.id])).rows[0];
  if (!row || row.revoked || row.runner_id !== reference.runnerId || row.config_digest !== reference.configDigest) {
    throw new HttpError(409, 'execution_profile_unavailable', 'Refresh the configured profile selection before submitting work.');
  }
  return profileView(row);
}
export async function assertTaskExecutionProfile(client: PoolClient, task: TaskSubmission): Promise<void> {
  if (!task.executionProfile) return;
  const profile = await requireExecutionProfile(client, task.executionProfile);
  if (task.harness !== profile.configuration.harness) throw new HttpError(409, 'profile_harness_mismatch', 'The selected profile does not support this task harness.');
  if (task.resumeSessionId) {
    const session = (await client.query<{ runner_id: string }>('SELECT runner_id FROM flow.sessions WHERE id=$1 AND harness=$2', [task.resumeSessionId, task.harness])).rows[0];
    if (!session || session.runner_id !== profile.reference.runnerId) throw new HttpError(409, 'profile_session_mismatch', 'A resumed session must use its original configured runner.');
  }
}
