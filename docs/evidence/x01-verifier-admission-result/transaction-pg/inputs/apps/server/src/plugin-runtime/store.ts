import { assertTrustedVerifier, type TrustedPluginVerifierPolicy } from '../plugin-verification-configuration.js';
import { readFile } from 'node:fs/promises';
import type { Pool, PoolClient } from 'pg';
import { PLUGIN_RUNTIME_PROTOCOL, pluginToolBindingSchema, pluginRuntimeViewSchema, type PluginHostIdentity, type PluginHostPublication, type PluginRuntimeView, type PluginToolBinding } from '../../../../packages/contracts/src/plugin-runtime.js';
import { HttpError, transaction } from '../database.js';
import { lockRunner } from '../runners.js';
import { readSnapshot } from '../plugins/storage.js';
import { loadInstall } from '../plugin-installations/store.js';
import type { PluginSnapshot } from '../../../../packages/contracts/src/plugins.js';

export interface RuntimeRevision {
  registration_id: string; revision: number; version_id: string; desired_enabled: boolean;
  material_install_operation_id: string | null; target_runner_id: string | null; store_id: string | null; host_api_major: 1 | null;
}
interface BindingRecord {
  id: string; invocation_id: string; task_id: string; registration_id: string; registration_revision: number; version_id: string;
  scope: PluginToolBinding['scope']; material_install_operation_id: string; target_runner_id: string; store_id: string;
  material_id: string; tree_digest: string; host_api_major: 1; artifact: PluginToolBinding['artifact'];
  configuration: PluginToolBinding['configuration']; input_digest: string; created_at: Date;
}

/** Production integration and dedicated tests consume the sole assigned SQL, never a fixture copy. */
export async function migratePluginRuntime(pool: Pool): Promise<void> {
  await transaction(pool, async client => {
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended('flow-migrations',0))");
    if ((await client.query('SELECT 1 FROM flow.migrations WHERE version=34')).rowCount) return;
    await client.query(await readFile(new URL('../../../../packages/storage/migrations/034-plugin-runtime.sql', import.meta.url), 'utf8'));
    await client.query('INSERT INTO flow.migrations(version) VALUES(34)');
  });
}

/** Operator-owned synchronous policy; a runner credential alone cannot authorize its material store. */
export type TrustedPluginHostPolicy = (identity: Readonly<PluginHostIdentity>) => boolean;

export function assertTrustedPluginHost(policy: TrustedPluginHostPolicy | undefined, identity: PluginHostIdentity): void {
  if (policy?.(Object.freeze({ ...identity })) !== true) throw new HttpError(403, 'plugin_host_not_trusted', 'The operator has not authorized this exact plugin host.');
}

export async function installedMaterial(client: PoolClient, snapshot: PluginSnapshot, operationId: string, storeId?: string, kind: 'tool' | 'verifier' | 'either' = 'tool') {
  const row = await loadInstall(client, operationId);
  const receipt = row.receipt;
  if (row.registration_id !== snapshot.installation.id || row.version_id !== snapshot.version.id || (storeId !== undefined && row.store_id !== storeId)
    || row.status !== 'installed' || !receipt || receipt.schemaVersion !== 1 || receipt.storeId !== row.store_id
    || !/^[a-f0-9]{64}$/.test(receipt.installationId) || !/^[a-f0-9]{64}$/.test(receipt.treeDigest)
    || !['tool', 'verifier'].includes(receipt.manifest?.kind) || (kind !== 'either' && receipt.manifest.kind !== kind) || receipt.manifest.hostApiMajor !== 1 || !receipt.artifact
    || receipt.artifact.artifactId !== row.artifact_id || receipt.artifact.sha256 !== snapshot.version.declaredSha256
    || receipt.artifact.name !== snapshot.version.packageName || receipt.artifact.version !== snapshot.version.packageVersion
    || receipt.artifact.bytes !== row.artifact.bytes || receipt.artifact.integrity !== row.artifact.integrity
    || receipt.artifact.sha256 !== row.artifact.sha256 || receipt.artifact.artifactId !== row.artifact.artifactId
    || receipt.artifact.name !== row.artifact.name || receipt.artifact.version !== row.artifact.version) {
    throw new HttpError(409, 'plugin_material_mismatch', 'The selected version requires its exact installed execution material.');
  }
  return receipt;
}

/** Authenticated runner identity is supplied by the host route; this is not current claim eligibility. */
export async function publishPluginHost(pool: Pool, runnerId: string, input: PluginHostPublication, policy?: TrustedPluginHostPolicy): Promise<void> {
  const identity = Object.freeze({ ...input, runnerId });
  await transaction(pool, async client => {
    await lockRunner(client, runnerId);
    assertTrustedPluginHost(policy, identity);
    await client.query('INSERT INTO flow.plugin_runtime_hosts(runner_id,store_id,host_api_major) VALUES($1,$2,$3) ON CONFLICT DO NOTHING', [runnerId, identity.storeId, identity.hostApiMajor]);
    if (!(await client.query('SELECT 1 FROM flow.plugin_runtime_hosts WHERE runner_id=$1 AND store_id=$2 AND host_api_major=$3', [runnerId, identity.storeId, identity.hostApiMajor])).rowCount) {
      throw new HttpError(409, 'plugin_host_conflict', 'A runner cannot change its published material store.');
    }
  });
}
export async function latestRuntimeRevision(client: PoolClient, registrationId: string): Promise<RuntimeRevision | null> {
  return (await client.query<RuntimeRevision>('SELECT * FROM flow.plugin_runtime_revisions WHERE registration_id=$1 ORDER BY revision DESC LIMIT 1', [registrationId])).rows[0] ?? null;
}
export async function assertPluginHost(client: PoolClient, runnerId: string, storeId: string): Promise<void> {
  const runner = await lockRunner(client, runnerId);
  if (runner.maintenance_state && runner.maintenance_state !== 'accepting') throw new HttpError(409, 'plugin_host_unavailable', 'The runner is not accepting new tool tasks.');
  if (!runner.harnesses.includes('fixture')) throw new HttpError(409, 'plugin_host_unavailable', 'The runner does not accept plugin tool tasks.');
  if (!(await client.query('SELECT 1 FROM flow.plugin_runtime_hosts WHERE runner_id=$1 AND store_id=$2 AND host_api_major=1', [runnerId, storeId])).rowCount) {
    throw new HttpError(409, 'plugin_host_unavailable', 'The exact tool host and material store are not registered.');
  }
}
export async function readRuntime(client: PoolClient, registrationId: string, policy?: TrustedPluginHostPolicy, algorithms?: TrustedPluginVerifierPolicy): Promise<PluginRuntimeView> {
  const current = await readSnapshot(client, registrationId);
  const runtime = await latestRuntimeRevision(client, registrationId);
  const enabled = runtime?.desired_enabled === true;
  let reason: PluginRuntimeView['reason'] = 'not-enabled';
  if (enabled) {
    if (runtime.revision !== current.revision) reason = 'revision-changed';
    else if (current.configurationStatus !== 'ready') reason = 'configuration-incomplete';
    else {
      const material = await installedMaterial(client, current, runtime.material_install_operation_id!, runtime.store_id!, 'either');
      if (!current.grants.includes(material.manifest.kind)) reason = 'grant-missing';
      else {
      const host = await client.query(`SELECT 1 FROM flow.plugin_runtime_hosts h JOIN flow.runners r ON r.id=h.runner_id
        WHERE h.runner_id=$1 AND h.store_id=$2 AND h.host_api_major=1 AND NOT r.revoked AND r.maintenance_state='accepting' AND 'fixture'=ANY(r.harnesses)`, [runtime.target_runner_id, runtime.store_id]);
      const trusted = runtime.target_runner_id && runtime.store_id && policy?.(Object.freeze({ protocol: PLUGIN_RUNTIME_PROTOCOL, runnerId: runtime.target_runner_id, storeId: runtime.store_id, hostApiMajor: 1 })) === true;
      let algorithmTrusted = true;
      if (material.manifest.kind === 'verifier') {
        try { assertTrustedVerifier(algorithms, { artifactSha256: material.artifact.sha256, treeDigest: material.treeDigest, hostApiMajor: 1, algorithmId: 'flow.json-object.required-keys', algorithmVersion: 1 }); } catch { algorithmTrusted = false; }
      }
      reason = host.rowCount && trusted && algorithmTrusted ? 'ready' : 'host-unavailable';
      }
    }
  }
  return pluginRuntimeViewSchema.parse({ protocol: PLUGIN_RUNTIME_PROTOCOL, registrationId, currentRevision: current.revision,
    enabledRevision: enabled ? runtime.revision : null, desiredEnabled: enabled, bindingAllowed: reason === 'ready', reason,
    targetRunnerId: enabled ? runtime.target_runner_id : null, storeId: enabled ? runtime.store_id : null,
    materialInstallOperationId: enabled ? runtime.material_install_operation_id : null, loaded: 'unknown', callable: 'unknown' });
}
export async function recordBinding(client: PoolClient, binding: Omit<PluginToolBinding, 'createdAt'>): Promise<PluginToolBinding> {
  await client.query(`INSERT INTO flow.plugin_tool_bindings(id,invocation_id,task_id,registration_id,registration_revision,version_id,scope,
    material_install_operation_id,target_runner_id,store_id,material_id,tree_digest,host_api_major,artifact,configuration,input_digest)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`, [binding.bindingId, binding.invocationId, binding.taskId,
    binding.registrationId, binding.registrationRevision, binding.versionId, JSON.stringify(binding.scope), binding.materialInstallOperationId,
    binding.targetRunnerId, binding.storeId, binding.materialId, binding.treeDigest, binding.hostApiMajor, JSON.stringify(binding.artifact),
    JSON.stringify(binding.configuration), binding.inputDigest]);
  return readBinding(client, binding.taskId);
}
export async function readBinding(client: PoolClient, taskId: string): Promise<PluginToolBinding> {
  const row = (await client.query<BindingRecord>('SELECT * FROM flow.plugin_tool_bindings WHERE task_id=$1', [taskId])).rows[0];
  if (!row) throw new HttpError(404, 'plugin_binding_not_found', 'This task has no frozen tool binding.');
  return pluginToolBindingSchema.parse({ protocol: PLUGIN_RUNTIME_PROTOCOL, bindingId: row.id, invocationId: row.invocation_id, taskId: row.task_id,
    registrationId: row.registration_id, registrationRevision: row.registration_revision, versionId: row.version_id, scope: row.scope,
    materialInstallOperationId: row.material_install_operation_id, targetRunnerId: row.target_runner_id, storeId: row.store_id,
    materialId: row.material_id, treeDigest: row.tree_digest, hostApiMajor: row.host_api_major, artifact: row.artifact,
    configuration: row.configuration, inputDigest: row.input_digest, createdAt: row.created_at.toISOString() });
}
