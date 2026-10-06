import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import type { ExecutionProfile, ExecutionProfileConfiguration, ExecutionProfilePage, NativeExecutionProfile, NativeExecutionProfileConfiguration, NativeExecutionProfilePublished, ExecutionProfileReference } from '../../../../packages/contracts/src/execution-profiles.js';
import { executionProfileConfigurationJson, executionProfileConfigurationSchema, nativeExecutionProfileConfigurationJson, nativeExecutionProfileConfigurationSchema } from '../../../../packages/contracts/src/execution-profiles.js';
import type { TaskSubmission } from '@flow/contracts';
import { nativeExecutionProfileCatalogEntrySchema, NATIVE_EXECUTION_PROFILE_CATALOG_PROTOCOL, type NativeExecutionProfileCatalogEntry, type NativeExecutionProfileCatalogPage } from '../../../../packages/contracts/src/execution-profiles.js';
import { HttpError, sha256, transaction } from '../database.js';

interface ProfileRow { id: string; runner_id: string; config_digest: string; configuration: NativeExecutionProfileConfiguration; created_at: Date }
function profileView(row: ProfileRow): NativeExecutionProfile {
  const common = { reference: { id: row.id, runnerId: row.runner_id, configDigest: row.config_digest },
    source: 'runner-configured' as const, availability: 'not-probed' as const,
    model: { value: row.configuration.model, resolvedModel: null, displayName: row.configuration.model, description: 'Configured runner request; provider availability has not been probed.', providerCapabilities: 'unknown' as const },
    createdAt: row.created_at.toISOString() };
  return row.configuration.harness === 'claude' ? { ...common, configuration: row.configuration,
    controls: { model: 'select-configured-profile', thinking: 'fixed-disabled', effort: 'unsupported', access: 'configured-policy', queue: false, steer: false } }
    : { ...common, configuration: row.configuration,
      controls: { model: 'select-configured-profile', thinking: 'unsupported', effort: 'configured-request', serviceTier: 'configured-request', access: 'requested-none', queue: false, steer: false } };
}
function legacyProfileView(row: ProfileRow): ExecutionProfile {
  const profile = profileView(row);
  if (profile.configuration.harness !== 'claude' || profile.controls.thinking !== 'fixed-disabled') throw new HttpError(409, 'profile_harness_mismatch', 'Legacy profile readers require Claude.');
  return { ...profile, configuration: profile.configuration, controls: profile.controls };
}
export async function publishProfile(pool: Pool, runnerId: string, configuration: NativeExecutionProfileConfiguration): Promise<NativeExecutionProfilePublished> {
  configuration = nativeExecutionProfileConfigurationSchema.parse(configuration);
  return transaction(pool, async client => {
    const runner = (await client.query<{ harnesses: string[]; revoked: boolean }>('SELECT harnesses,revoked FROM flow.runners WHERE id=$1 FOR UPDATE', [runnerId])).rows[0];
    if (!runner || runner.revoked) throw new HttpError(401, 'runner_revoked', 'Runner credential is unavailable.');
    if (!runner.harnesses.includes(configuration.harness)) throw new HttpError(409, 'profile_harness_mismatch', 'This runner is not registered for the profile harness.');
    const configDigest = sha256(nativeExecutionProfileConfigurationJson(configuration));
    const existing = (await client.query<ProfileRow>('SELECT * FROM flow.execution_profiles WHERE runner_id=$1', [runnerId])).rows[0];
    if (existing) {
      if (existing.config_digest !== configDigest) throw new HttpError(409, 'profile_immutable', 'Changing execution configuration requires a new runner identity.');
      return { profile: profileView(existing), replayed: true };
    }
    const row = (await client.query<ProfileRow>('INSERT INTO flow.execution_profiles(id,runner_id,config_digest,configuration) VALUES($1,$2,$3,$4) RETURNING *', [randomUUID(), runnerId, configDigest, configuration])).rows[0]!;
    return { profile: profileView(row), replayed: false };
  });
}
export async function listProfiles(pool: Pool, after: string | undefined, limit: number, includeSteering = false): Promise<ExecutionProfilePage> {
  return transaction(pool, async client => {
    const rows = (await client.query<ProfileRow>(`SELECT p.* FROM flow.execution_profiles p JOIN flow.runners r ON r.id=p.runner_id WHERE NOT r.revoked AND p.configuration->>'harness'='claude' AND ($3::boolean OR NOT (p.configuration ? 'activeSteering')) AND ($1::text IS NULL OR p.id>$1) ORDER BY p.id LIMIT $2`, [after ?? null, limit + 1, includeSteering])).rows;
    const profiles = rows.slice(0, limit).map(legacyProfileView);
    return { profiles, nextCursor: rows.length > limit ? profiles.at(-1)!.reference.id : null };
  }, true);
}

/** Native readers opt into known codecs before pagination. Corrupt recognized rows fail the whole page. */
export async function listNativeProfiles(pool: Pool, after: string | undefined, limit: number): Promise<NativeExecutionProfileCatalogPage> {
  return transaction(pool, async client => {
    const rows = (await client.query<ProfileRow>(`SELECT p.* FROM flow.execution_profiles p JOIN flow.runners r ON r.id=p.runner_id
      WHERE NOT r.revoked AND (
        (p.configuration->>'harness'='claude' AND p.configuration->>'adapterVersion'='claude-sdk-0.3.290-v2') OR
        (p.configuration->>'harness'='codex' AND p.configuration->>'adapterVersion'='codex-app-server-0.154.0-v1'))
      AND ($1::text IS NULL OR p.id>$1) ORDER BY p.id LIMIT $2`, [after ?? null, limit + 1])).rows;
    // Validate the sentinel too: it must not hide a corrupt next-page boundary.
    const entries = rows.map(nativeCatalogEntry);
    const profiles = entries.slice(0, limit);
    return { protocol: NATIVE_EXECUTION_PROFILE_CATALOG_PROTOCOL, profiles,
      nextCursor: entries.length > limit ? profiles.at(-1)!.profile.reference.id : null };
  }, true);
}
function nativeCatalogEntry(row: ProfileRow): NativeExecutionProfileCatalogEntry {
  const parsed = nativeExecutionProfileConfigurationSchema.safeParse(row.configuration);
  if (!parsed.success || sha256(nativeExecutionProfileConfigurationJson(parsed.data)) !== row.config_digest) {
    throw new HttpError(409, 'execution_profile_unavailable', 'The stored execution profile is not recognized.');
  }
  const configuration = parsed.data;
  const reason = configuration.harness === 'codex' ? 'codex-conversation-unimplemented'
    : configuration.access === 'goal-tools' || configuration.access === 'goal-graph-tools' ? 'profile-purpose-not-supported' : null;
  const entry = nativeExecutionProfileCatalogEntrySchema.safeParse({
    profile: profileView({ ...row, configuration }),
    conversation: reason ? { state: 'unsupported', reason } : { state: 'existing-claude-contract', capabilitySource: 'conversation-response' },
  });
  if (!entry.success) throw new HttpError(409, 'execution_profile_unavailable', 'The stored execution profile is not recognized.');
  return entry.data;
}

export type ExecutionPurpose = 'ordinary' | 'goal-tools' | 'goal-graph-tools';
export async function requireExecutionProfile(client: PoolClient, reference: ExecutionProfileReference, purpose: ExecutionPurpose = 'ordinary'): Promise<NativeExecutionProfile> {
  const row = (await client.query<ProfileRow & { revoked: boolean }>('SELECT p.*,r.revoked FROM flow.execution_profiles p JOIN flow.runners r ON r.id=p.runner_id WHERE p.id=$1', [reference.id])).rows[0];
  if (!row || row.revoked || row.runner_id !== reference.runnerId || row.config_digest !== reference.configDigest) {
    throw new HttpError(409, 'execution_profile_unavailable', 'Refresh the configured profile selection before submitting work.');
  }
  const configuration = nativeExecutionProfileConfigurationSchema.safeParse(row.configuration);
  if (!configuration.success || sha256(nativeExecutionProfileConfigurationJson(configuration.data)) !== row.config_digest) {
    throw new HttpError(409, 'execution_profile_unavailable', 'The stored execution profile is not recognized.');
  }
  row.configuration = configuration.data;
  const access = row.configuration.access;
  const requiredPurpose = access === 'goal-tools' || access === 'goal-graph-tools' ? access : 'ordinary';
  if (purpose !== requiredPurpose) throw new HttpError(409, purpose === 'goal-tools' ? 'native_goal_tools_unavailable' : purpose === 'goal-graph-tools' ? 'native_graph_tools_unavailable' : 'goal_profile_requires_grant', 'This execution profile is not authorized for this task purpose.');
  return profileView(row);
}
export async function assertTaskExecutionProfile(client: PoolClient, task: TaskSubmission, purpose: ExecutionPurpose = 'ordinary'): Promise<void> {
  if (!task.executionProfile) {
    if (task.harness === 'codex') throw new HttpError(409, 'execution_profile_required', 'Codex tasks require a pinned execution profile.');
    if (purpose !== 'ordinary') throw new HttpError(409, 'goal_profile_required', 'Native goal tools require an explicit execution profile.');
    return;
  }
  const profile = await requireExecutionProfile(client, task.executionProfile, purpose);
  if (task.harness !== profile.configuration.harness) throw new HttpError(409, 'profile_harness_mismatch', 'The selected profile does not support this task harness.');
  if (task.harness === 'codex' && task.resumeSessionId) throw new HttpError(409, 'native_resume_unsupported', 'This native harness does not support session resume.');
  if (task.resumeSessionId) {
    const session = (await client.query<{ runner_id: string }>('SELECT runner_id FROM flow.sessions WHERE id=$1 AND harness=$2', [task.resumeSessionId, task.harness])).rows[0];
    if (!session || session.runner_id !== profile.reference.runnerId) throw new HttpError(409, 'profile_session_mismatch', 'A resumed session must use its original configured runner.');
  }
}

/** Called under the existing runner/task/attempt locks, before command idempotency. */
export async function assertSteeringExecutionProfile(client: PoolClient, task: TaskSubmission, runnerId: string): Promise<void> {
  if (!task.executionProfile) throw new HttpError(409, 'steering_profile_unsupported', 'Active steering requires an explicitly pinned execution profile.');
  const profile = await requireExecutionProfile(client, task.executionProfile);
  const parsed = executionProfileConfigurationSchema.safeParse(profile.configuration);
  if (!parsed.success || !parsed.data.activeSteering || task.harness !== 'claude' || profile.reference.runnerId !== runnerId
    || sha256(executionProfileConfigurationJson(parsed.data)) !== profile.reference.configDigest) {
    throw new HttpError(409, 'steering_profile_unsupported', 'This active attempt has no recognized steering configuration.');
  }
}
