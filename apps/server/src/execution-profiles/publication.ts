import { nativeEngineeringProfileConfigurationJson, nativeEngineeringProfileConfigurationSchema, type NativeEngineeringProfileConfiguration } from '../../../../packages/contracts/src/engineering-native.js';
import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { nativeExecutionProfileConfigurationJson, nativeExecutionProfileConfigurationSchema, type NativeExecutionProfileConfiguration, type ExecutionProfileReference } from '../../../../packages/contracts/src/execution-profiles.js';
import { engineeringProfileConfigurationJson, engineeringProfileConfigurationSchema, type EngineeringProfileConfiguration } from '../../../../packages/contracts/src/engineering-profile.js';
import { HttpError, sha256, transaction } from '../database.js';

type RecognizedConfiguration = NativeExecutionProfileConfiguration | EngineeringProfileConfiguration | NativeEngineeringProfileConfiguration;
export interface PublishedProfileRow<Configuration = RecognizedConfiguration> { id: string; runner_id: string; config_digest: string; configuration: Configuration; created_at: Date }
function recognizedConfiguration(value: unknown): RecognizedConfiguration {
  const nativeEngineering = nativeEngineeringProfileConfigurationSchema.safeParse(value);
  if (nativeEngineering.success) return nativeEngineering.data;
  const engineering = engineeringProfileConfigurationSchema.safeParse(value);
  if (engineering.success) return engineering.data;
  const native = nativeExecutionProfileConfigurationSchema.safeParse(value);
  if (native.success) return native.data;
  throw new HttpError(409, 'execution_profile_unavailable', 'The stored execution profile is not recognized.');
}
function configurationJson(value: RecognizedConfiguration): string {
  if ('protocol' in value && value.protocol === 'flow.engineering-profile.v2') return nativeEngineeringProfileConfigurationJson(value);
  return value.harness === 'fixture' ? engineeringProfileConfigurationJson(value) : nativeExecutionProfileConfigurationJson(value);
}
/** One fixed table, one runner identity and one immutable configuration. Callers provide a recognized domain codec, not a table/registry name. */
export async function publishConfiguration<Configuration extends RecognizedConfiguration>(pool: Pool, runnerId: string, configuration: Configuration): Promise<{ row: PublishedProfileRow<Configuration>; replayed: boolean }> {
  const configDigest = sha256(configurationJson(configuration));
  return transaction(pool, async client => {
    const runner = (await client.query<{ harnesses: string[]; revoked: boolean }>('SELECT harnesses,revoked FROM flow.runners WHERE id=$1 FOR UPDATE', [runnerId])).rows[0];
    if (!runner || runner.revoked) throw new HttpError(401, 'runner_revoked', 'Runner credential is unavailable.');
    if (!runner.harnesses.includes(configuration.harness)) throw new HttpError(409, 'profile_harness_mismatch', 'This runner is not registered for the profile harness.');
    const existing = (await client.query<PublishedProfileRow<Configuration>>('SELECT * FROM flow.execution_profiles WHERE runner_id=$1', [runnerId])).rows[0];
    if (existing) {
      if (existing.config_digest !== configDigest) throw new HttpError(409, 'profile_immutable', 'Changing execution configuration requires a new runner identity.');
      if (configurationJson(recognizedConfiguration(existing.configuration)) !== configurationJson(configuration)) throw new HttpError(409, 'execution_profile_unavailable', 'The stored execution profile does not match its digest.');
      return { row: existing, replayed: true };
    }
    const row = (await client.query<PublishedProfileRow<Configuration>>('INSERT INTO flow.execution_profiles(id,runner_id,config_digest,configuration) VALUES($1,$2,$3,$4) RETURNING *', [randomUUID(), runnerId, configDigest, configuration])).rows[0]!;
    return { row, replayed: false };
  });
}
export async function requirePublishedProfile(client: PoolClient, reference: ExecutionProfileReference): Promise<PublishedProfileRow> {
  const row = (await client.query<PublishedProfileRow & { revoked: boolean }>('SELECT p.*,r.revoked FROM flow.execution_profiles p JOIN flow.runners r ON r.id=p.runner_id WHERE p.id=$1', [reference.id])).rows[0];
  if (!row || row.revoked || row.runner_id !== reference.runnerId || row.config_digest !== reference.configDigest) throw new HttpError(409, 'execution_profile_unavailable', 'Refresh the configured profile selection before submitting work.');
  const configuration = recognizedConfiguration(row.configuration);
  if (sha256(configurationJson(configuration)) !== row.config_digest) throw new HttpError(409, 'execution_profile_unavailable', 'The stored execution profile is not recognized.');
  return { ...row, configuration };
}
