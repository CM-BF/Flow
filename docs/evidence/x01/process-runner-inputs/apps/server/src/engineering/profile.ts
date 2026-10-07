import { assertNativeEngineeringProfile } from './native-profile.js';
import type { Pool, PoolClient } from 'pg';
import type { TaskSubmission } from '@flow/contracts';
import { engineeringProfileConfigurationSchema, engineeringProfileConfigurationJson, engineeringProfileSchema, type EngineeringProfileConfiguration, type EngineeringProfile, type EngineeringProfilePublished, type EngineeringProfilePage } from '../../../../packages/contracts/src/engineering-profile.js';
import { engineeringIntentSchema } from '../../../../packages/contracts/src/engineering.js';
import { publishConfiguration, requirePublishedProfile, type PublishedProfileRow } from '../execution-profiles/publication.js';
import { HttpError, sha256, transaction } from '../database.js';

function profileView(row: PublishedProfileRow): EngineeringProfile {
  const configuration = engineeringProfileConfigurationSchema.safeParse(row.configuration);
  if (!configuration.success || sha256(engineeringProfileConfigurationJson(configuration.data)) !== row.config_digest) throw new HttpError(409, 'engineering_profile_unavailable', 'The stored engineering profile is not recognized.');
  return engineeringProfileSchema.parse({ reference: { id: row.id, runnerId: row.runner_id, configDigest: row.config_digest }, configuration: configuration.data,
    source: 'trusted-fixture-setup', availability: 'not-probed', createdAt: row.created_at.toISOString() });
}
export async function publishEngineeringProfile(pool: Pool, runnerId: string, input: EngineeringProfileConfiguration): Promise<EngineeringProfilePublished> {
  const { row, replayed } = await publishConfiguration(pool, runnerId, engineeringProfileConfigurationSchema.parse(input));
  return { profile: profileView(row), replayed };
}
export async function listEngineeringProfiles(pool: Pool, after: string | undefined, limit: number): Promise<EngineeringProfilePage> {
  return transaction(pool, async client => {
    const rows = (await client.query<PublishedProfileRow>(`SELECT p.* FROM flow.execution_profiles p JOIN flow.runners r ON r.id=p.runner_id
      WHERE NOT r.revoked AND p.configuration->>'protocol'='flow.engineering-profile.v1'
      AND p.configuration->>'harness'='fixture' AND p.configuration->>'purpose'='engineering-fixture'
      AND ($1::text IS NULL OR p.id>$1) ORDER BY p.id LIMIT $2`, [after ?? null, limit + 1])).rows;
    const entries = rows.map(profileView), profiles = entries.slice(0, limit);
    return { protocol: 'flow.engineering-profile-catalog.v1', profiles, nextCursor: entries.length > limit ? profiles.at(-1)!.reference.id : null };
  }, true);
}
/** Called inside ordinary task acceptance and again before claim. A target ID alone is not engineering admission. */
export async function assertEngineeringProfile(client: PoolClient, task: TaskSubmission): Promise<void> {
  if (task.engineering?.protocol === 'flow.engineering.v2') { await assertNativeEngineeringProfile(client, task); return; }
  const intent = engineeringIntentSchema.parse(task.engineering);
  if (task.harness !== 'fixture' || !intent.profile || task.executionProfile || task.resumeSessionId || task.fixture || task.protocol || task.verification) throw new HttpError(409, 'engineering_profile_required', 'Engineering tasks require their explicit purpose profile.');
  const profile = profileView(await requirePublishedProfile(client, intent.profile));
  if (profile.reference.runnerId !== intent.targetRunnerId || profile.configuration.project.id !== intent.projectId || profile.configuration.project.baseCommit !== intent.baseCommit
    || JSON.stringify(profile.configuration.checker) !== JSON.stringify(intent.checker)) throw new HttpError(409, 'engineering_profile_mismatch', 'The task project, checker and target do not match the configured engineering purpose.');
}
