import { nativeConversationCapability, nativeExecutionProfileCatalogV2EntrySchema, NATIVE_EXECUTION_PROFILE_CATALOG_V2, type NativeExecutionProfileCatalogV2Page } from '../../../../packages/contracts/src/execution-profiles.js';
import { checkTaskMessageSettings } from '../conversations/message-settings.js';
import { CLAUDE_TURN_SETTINGS_PROTOCOL } from '../../../../packages/contracts/src/claude-turn-settings.js';
import { claudeMessageSettingsCatalogEntrySchema, type ClaudeMessageSettingsCatalogPage } from '../../../../packages/contracts/src/execution-profiles.js';
import type { Pool, PoolClient } from 'pg';
import type { ExecutionProfile, ExecutionProfileConfiguration, ExecutionProfilePage, NativeExecutionProfile, NativeExecutionProfileConfiguration, NativeExecutionProfilePublished, ExecutionProfileReference } from '../../../../packages/contracts/src/execution-profiles.js';
import { executionProfileConfigurationJson, executionProfileConfigurationSchema, nativeExecutionProfileConfigurationJson, nativeExecutionProfileConfigurationSchema } from '../../../../packages/contracts/src/execution-profiles.js';
import type { TaskSubmission } from '@flow/contracts';
import { nativeExecutionProfileCatalogEntrySchema, NATIVE_EXECUTION_PROFILE_CATALOG_PROTOCOL, type NativeExecutionProfileCatalogEntry, type NativeExecutionProfileCatalogPage } from '../../../../packages/contracts/src/execution-profiles.js';
import { HttpError, sha256, transaction } from '../database.js';
import { publishConfiguration, requirePublishedProfile } from './publication.js';
import { assertEngineeringProfile } from '../engineering/profile.js';

interface ProfileRow { id: string; runner_id: string; config_digest: string; configuration: NativeExecutionProfileConfiguration; created_at: Date }
function profileView(row: ProfileRow): NativeExecutionProfile {
  const common = { reference: { id: row.id, runnerId: row.runner_id, configDigest: row.config_digest },
    source: 'runner-configured' as const, availability: 'not-probed' as const,
    model: { value: row.configuration.model, resolvedModel: null, displayName: row.configuration.model, description: 'Configured runner request; provider availability has not been probed.', providerCapabilities: 'unknown' as const },
    createdAt: row.created_at.toISOString() };
  if (row.configuration.harness === 'claude' && row.configuration.turnSettings) return { ...common, configuration: row.configuration,
    controls: { access: 'configured-policy', queue: false, steer: false,
      messageSettings: { protocol: CLAUDE_TURN_SETTINGS_PROTOCOL, choices: 'configuration.turnSettings.choices' } } };
  return row.configuration.harness === 'claude' ? { ...common, configuration: row.configuration,
    controls: { model: 'select-configured-profile', thinking: 'fixed-disabled', effort: 'unsupported', access: 'configured-policy', queue: false, steer: false } }
    : { ...common, configuration: row.configuration,
      controls: { model: 'select-configured-profile', thinking: 'unsupported', effort: 'configured-request', serviceTier: 'configured-request', access: 'requested-none', queue: false, steer: false } };
}
function legacyProfileView(row: ProfileRow): ExecutionProfile {
  const profile = profileView(row);
  if (profile.configuration.harness !== 'claude' || !('thinking' in profile.controls) || profile.controls.thinking !== 'fixed-disabled') throw new HttpError(409, 'profile_harness_mismatch', 'Legacy profile readers require Claude.');
  return { ...profile, configuration: profile.configuration, controls: profile.controls };
}
export async function publishProfile(pool: Pool, runnerId: string, configuration: NativeExecutionProfileConfiguration): Promise<NativeExecutionProfilePublished> {
  configuration = nativeExecutionProfileConfigurationSchema.parse(configuration);
  const { row, replayed } = await publishConfiguration(pool, runnerId, configuration);
  return { profile: profileView(row), replayed };
}
export async function listProfiles(pool: Pool, after: string | undefined, limit: number, includeSteering = false): Promise<ExecutionProfilePage> {
  return transaction(pool, async client => {
    const rows = (await client.query<ProfileRow>(`SELECT p.* FROM flow.execution_profiles p JOIN flow.runners r ON r.id=p.runner_id WHERE NOT r.revoked AND p.configuration->>'harness'='claude' AND NOT (p.configuration ? 'turnSettings') AND ($3::boolean OR NOT (p.configuration ? 'activeSteering')) AND ($1::text IS NULL OR p.id>$1) ORDER BY p.id LIMIT $2`, [after ?? null, limit + 1, includeSteering])).rows;
    const profiles = rows.slice(0, limit).map(legacyProfileView);
    return { profiles, nextCursor: rows.length > limit ? profiles.at(-1)!.reference.id : null };
  }, true);
}

/** Native readers opt into known codecs before pagination. Corrupt recognized rows fail the whole page. */
export function listNativeProfiles(pool: Pool, after: string | undefined, limit: number, version: 'native-v2'): Promise<NativeExecutionProfileCatalogV2Page>;
export function listNativeProfiles(pool: Pool, after: string | undefined, limit: number, version?: 'native-v1'): Promise<NativeExecutionProfileCatalogPage>;
export async function listNativeProfiles(pool: Pool, after: string | undefined, limit: number, version: 'native-v1' | 'native-v2' = 'native-v1'): Promise<NativeExecutionProfileCatalogPage | NativeExecutionProfileCatalogV2Page> {
  return transaction(pool, async client => {
    const rows = (await client.query<ProfileRow>(`SELECT p.* FROM flow.execution_profiles p JOIN flow.runners r ON r.id=p.runner_id
      WHERE NOT r.revoked AND NOT (p.configuration ? 'turnSettings') AND (
        (p.configuration->>'harness'='claude' AND p.configuration->>'adapterVersion'='claude-sdk-0.3.290-v2') OR
        (p.configuration->>'harness'='codex' AND p.configuration->>'adapterVersion'='codex-app-server-0.154.0-v1'
          AND ($3::boolean OR NOT (p.configuration ? 'sessionPersistence'))))
      AND ($1::text IS NULL OR p.id>$1) ORDER BY p.id LIMIT $2`, [after ?? null, limit + 1, version === 'native-v2'])).rows;
    if (version === 'native-v2') {
      const entries = rows.map(row => {
        const parsed = nativeExecutionProfileConfigurationSchema.safeParse(row.configuration);
        if (!parsed.success || sha256(nativeExecutionProfileConfigurationJson(parsed.data)) !== row.config_digest) throw new HttpError(409, 'execution_profile_unavailable', 'Unrecognized profile.');
        const config = parsed.data;
        const conversation = nativeConversationCapability(config);
        const entry = nativeExecutionProfileCatalogV2EntrySchema.safeParse({ profile: profileView({ ...row, configuration: config }), conversation });
        if (!entry.success) throw new HttpError(409, 'execution_profile_unavailable', 'Unrecognized profile.');
        return entry.data;
      });
      const profiles = entries.slice(0, limit);
      return { protocol: NATIVE_EXECUTION_PROFILE_CATALOG_V2, profiles, nextCursor: entries.length > limit ? profiles.at(-1)!.profile.reference.id : null };
    }
    // Validate the sentinel too: it must not hide a corrupt next-page boundary.
    const entries = rows.map(nativeCatalogEntry);
    const profiles = entries.slice(0, limit);
    return { protocol: NATIVE_EXECUTION_PROFILE_CATALOG_PROTOCOL, profiles,
      nextCursor: entries.length > limit ? profiles.at(-1)!.profile.reference.id : null };
  }, true);
}
/** Exact opt-in catalog. Filter recognized profiles before LIMIT and validate the sentinel. */
export async function listClaudeMessageSettingsProfiles(pool: Pool, after: string | undefined, limit: number): Promise<ClaudeMessageSettingsCatalogPage> {
  return transaction(pool, async client => {
    const rows = (await client.query<ProfileRow>(`SELECT p.* FROM flow.execution_profiles p JOIN flow.runners r ON r.id=p.runner_id
      WHERE NOT r.revoked AND p.configuration->>'harness'='claude' AND p.configuration->>'adapterVersion'='claude-sdk-0.3.290-v2'
      AND p.configuration ? 'turnSettings' AND ($1::text IS NULL OR p.id>$1) ORDER BY p.id LIMIT $2`, [after ?? null, limit + 1])).rows;
    const entries = rows.map(row => {
      const parsed = nativeExecutionProfileConfigurationSchema.safeParse(row.configuration);
      if (!parsed.success || sha256(nativeExecutionProfileConfigurationJson(parsed.data)) !== row.config_digest) throw new HttpError(409, 'execution_profile_unavailable', 'The stored execution profile is not recognized.');
      const entry = claudeMessageSettingsCatalogEntrySchema.safeParse({ profile: profileView({ ...row, configuration: parsed.data }),
        conversation: { state: 'existing-claude-contract', capabilitySource: 'conversation-response' } });
      if (!entry.success) throw new HttpError(409, 'execution_profile_unavailable', 'The stored execution profile is not recognized.');
      return entry.data;
    });
    const profiles = entries.slice(0, limit);
    return { protocol: CLAUDE_TURN_SETTINGS_PROTOCOL, profiles, nextCursor: entries.length > limit ? profiles.at(-1)!.profile.reference.id : null };
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
  const stored = await requirePublishedProfile(client, reference);
  const configuration = nativeExecutionProfileConfigurationSchema.safeParse(stored.configuration);
  if (!configuration.success || sha256(nativeExecutionProfileConfigurationJson(configuration.data)) !== stored.config_digest) {
    throw new HttpError(409, 'execution_profile_unavailable', 'The stored execution profile is not recognized.');
  }
  const row = { ...stored, configuration: configuration.data };
  const access = row.configuration.access;
  const requiredPurpose = access === 'goal-tools' || access === 'goal-graph-tools' ? access : 'ordinary';
  if (purpose !== requiredPurpose) throw new HttpError(409, purpose === 'goal-tools' ? 'native_goal_tools_unavailable' : purpose === 'goal-graph-tools' ? 'native_graph_tools_unavailable' : 'goal_profile_requires_grant', 'This execution profile is not authorized for this task purpose.');
  return profileView(row);
}
export async function assertTaskExecutionProfile(client: PoolClient, task: TaskSubmission, purpose: ExecutionPurpose = 'ordinary'): Promise<void> {
  if (task.engineering) {
    if (task.messageSettings) throw new HttpError(409, 'message_settings_unsupported', 'Message settings require an ordinary Claude task.');
    if (purpose !== 'ordinary') throw new HttpError(409, 'engineering_purpose_mismatch', 'Planner grants cannot authorize engineering execution.');
    await assertEngineeringProfile(client, task); return;
  }
  if (!task.executionProfile) {
    if (task.messageSettings) throw new HttpError(409, 'message_settings_profile_mismatch', 'Message settings require their exact pinned execution profile.');
    if (task.harness === 'codex') throw new HttpError(409, 'execution_profile_required', 'Codex tasks require a pinned execution profile.');
    if (purpose !== 'ordinary') throw new HttpError(409, 'goal_profile_required', 'Native goal tools require an explicit execution profile.');
    return;
  }
  const profile = await requireExecutionProfile(client, task.executionProfile, purpose);
  const settings = checkTaskMessageSettings(task, profile);
  if (!settings.ok) throw new HttpError(409, settings.code, 'The frozen message settings cannot be admitted for this execution profile and session.');
  if (task.harness !== profile.configuration.harness) throw new HttpError(409, 'profile_harness_mismatch', 'The selected profile does not support this task harness.');
  if (profile.configuration.harness === 'codex' && task.resumeSessionId && profile.configuration.sessionPersistence !== 'host-owned') {
    throw new HttpError(409, 'native_resume_unsupported', 'This native harness does not support session resume.');
  }
  if (task.resumeSessionId) {
    const session = (await client.query<{ runner_id: string }>('SELECT runner_id FROM flow.sessions WHERE id=$1 AND harness=$2', [task.resumeSessionId, task.harness])).rows[0];
    if (!session || session.runner_id !== profile.reference.runnerId) throw new HttpError(409, 'profile_session_mismatch', 'A resumed session must use its original configured runner.');
  }
}

/** Legacy queues retain intent even when a pin is unavailable; known opt-in pins need a snapshot. */
export async function assertQueuedMessageSettings(client: PoolClient, task: TaskSubmission): Promise<void> {
  if (task.messageSettings) { await assertTaskExecutionProfile(client, task); return; }
  const reference = task.executionProfile;
  if (!reference) return;
  const row = (await client.query<ProfileRow>('SELECT * FROM flow.execution_profiles WHERE id=$1 AND runner_id=$2 AND config_digest=$3',
    [reference.id, reference.runnerId, reference.configDigest])).rows[0];
  if (!row) return;
  const parsed = nativeExecutionProfileConfigurationSchema.safeParse(row.configuration);
  if (parsed.success && sha256(nativeExecutionProfileConfigurationJson(parsed.data)) === row.config_digest
    && parsed.data.harness === 'claude' && parsed.data.turnSettings) {
    throw new HttpError(409, 'message_settings_required', 'This configured profile requires a complete message settings snapshot.');
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
