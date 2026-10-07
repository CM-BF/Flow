import type { Pool, PoolClient } from 'pg';
import type { TaskSubmission } from '@flow/contracts';
import { nativeEngineeringProfileConfigurationSchema, nativeEngineeringProfileConfigurationJson, nativeEngineeringProfileSchema,
  nativeEngineeringIntentSchema, type NativeEngineeringProfileConfiguration, type NativeEngineeringProfile,
  type NativeEngineeringProfilePage, type NativeEngineeringProfilePublished } from '../../../../packages/contracts/src/engineering-native.js';
import { publishConfiguration, requirePublishedProfile, type PublishedProfileRow } from '../execution-profiles/publication.js';
import { HttpError, sha256, transaction } from '../database.js';

function profileView(row: PublishedProfileRow): NativeEngineeringProfile {
  const parsed = nativeEngineeringProfileConfigurationSchema.safeParse(row.configuration);
  if (!parsed.success || sha256(nativeEngineeringProfileConfigurationJson(parsed.data)) !== row.config_digest) throw new HttpError(409, 'native_engineering_profile_unavailable', 'The stored native engineering declaration is not recognized.');
  return nativeEngineeringProfileSchema.parse({ reference: { id: row.id, runnerId: row.runner_id, configDigest: row.config_digest }, configuration: parsed.data,
    source: 'runner-declared-native-setup', availability: 'host-qualification-required', createdAt: row.created_at.toISOString() });
}
export async function publishNativeEngineeringProfile(pool: Pool, runnerId: string, configuration: NativeEngineeringProfileConfiguration): Promise<NativeEngineeringProfilePublished> {
  const { row, replayed } = await publishConfiguration(pool, runnerId, nativeEngineeringProfileConfigurationSchema.parse(configuration));
  return { profile: profileView(row), replayed };
}
export async function listNativeEngineeringProfiles(pool: Pool, after: string | undefined, limit: number): Promise<NativeEngineeringProfilePage> {
  return transaction(pool, async client => {
    const rows = (await client.query<PublishedProfileRow>(`SELECT p.* FROM flow.execution_profiles p JOIN flow.runners r ON r.id=p.runner_id
      WHERE NOT r.revoked AND p.configuration->>'protocol'='flow.engineering-profile.v2'
      AND p.configuration->>'harness'='codex' AND p.configuration->>'purpose'='engineering-native'
      AND ($1::text IS NULL OR p.id>$1) ORDER BY p.id LIMIT $2`, [after ?? null, limit + 1])).rows;
    const entries = rows.map(profileView), profiles = entries.slice(0, limit);
    return { protocol: 'flow.native-engineering-profile-catalog.v1', profiles, nextCursor: entries.length > limit ? profiles.at(-1)!.reference.id : null };
  }, true);
}
/** Purpose routing is distinct from the trusted host's unimplemented OS/model qualification. */
export async function assertNativeEngineeringProfile(client: PoolClient, task: TaskSubmission): Promise<NativeEngineeringProfile> {
  const intent = nativeEngineeringIntentSchema.parse(task.engineering);
  if (task.harness !== 'codex' || task.executionProfile || task.resumeSessionId || task.fixture || task.protocol || task.verification) throw new HttpError(409, 'native_engineering_purpose_mismatch', 'Native engineering requires its dedicated purpose pin.');
  const profile = profileView(await requirePublishedProfile(client, intent.profile));
  if (profile.reference.runnerId !== intent.targetRunnerId || profile.configuration.project.id !== intent.projectId || profile.configuration.project.baseCommit !== intent.baseCommit
    || JSON.stringify(profile.configuration.checker) !== JSON.stringify(intent.checker)) throw new HttpError(409, 'native_engineering_profile_mismatch', 'The project, checker, pin and target do not match the native engineering declaration.');
  return profile;
}
