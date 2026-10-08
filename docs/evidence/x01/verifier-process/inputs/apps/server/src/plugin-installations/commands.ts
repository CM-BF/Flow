import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import type { Pool, PoolClient } from 'pg';
import { prepareInstalledPackage, readInstalledPackage, PackageStoreError, type InstalledPackageReceipt, type TrustedPackageStore } from '@flow/plugin-runtime';
import { packageArtifactSchema, type PackageArtifact } from '../../../../packages/contracts/src/package-artifacts.js';
import type { PluginVersionDeclaration } from '../../../../packages/contracts/src/plugins.js';
import type { PluginInstallAccepted, PluginInstallCommand, PluginInstallError, PluginInstallRequest } from '../../../../packages/contracts/src/plugin-installations.js';
import { canonical, HttpError, sha256 } from '../database.js';
import { command } from '../tasks.js';
import { loadInstallation } from '../plugins/storage.js';
import { readPackageArtifact } from '../package-artifacts/index.js';
import { installAudit, loadInstall, type InstallRecord } from './store.js';

/** Host configuration, never HTTP input. The caller owns shutdown and awaits route completion. */
export interface PluginInstallHost {
  artifactStore: { root: string; storeId: string };
  materialStore: TrustedPackageStore;
  signal?: AbortSignal;
  /** Trusted evidence that this exact previous execution has stopped all owned I/O. Missing means unknown. */
  executionSettled?: (executionId: string) => Promise<boolean>;
}
function assertHost(row: InstallRecord, host: PluginInstallHost): void {
  if (row.store_id !== host.materialStore.storeId || row.artifact_store_id !== host.artifactStore.storeId) throw new HttpError(409, 'plugin_install_store_mismatch', 'This operation belongs to another center store.');
  if (!host.materialStore.allowedDigests.includes(row.artifact.sha256)) throw new HttpError(409, 'plugin_install_untrusted', 'This exact package is not permitted on this host.');
}
export async function admitInstall(pool: Pool, host: PluginInstallHost, registrationId: string, versionId: string, input: PluginInstallRequest, key: string): Promise<PluginInstallAccepted> {
  const result = await command(pool, `plugin.material-install:${registrationId}:${versionId}`, key, input, async client => {
    const registration = await loadInstallation(client, registrationId, true);
    if (registration.revision !== input.expectedRevision) throw new HttpError(409, 'plugin_revision_conflict', 'Plugin registration changed.');
    const version = (await client.query<{ declaration: PluginVersionDeclaration }>('SELECT declaration FROM flow.plugin_versions WHERE installation_id=$1 AND id=$2', [registrationId, versionId])).rows[0]?.declaration;
    const fetch = (await client.query<{ store_id: string; package_name: string; package_version: string; expected_sha256: string; integrity: string; registry_url: string }>(
      'SELECT store_id,package_name,package_version,expected_sha256,integrity,registry_url FROM flow.plugin_package_fetches WHERE id=$1 AND installation_id=$2 AND version_id=$3 FOR SHARE', [input.fetchOperationId, registrationId, versionId])).rows[0];
    const attempt = (await client.query<{ artifact_id: string; artifact: PackageArtifact }>("SELECT artifact_id,artifact FROM flow.plugin_package_fetch_attempts WHERE operation_id=$1 AND id=$2 AND status='succeeded' FOR SHARE", [input.fetchOperationId, input.fetchAttemptId])).rows[0];
    if (!version || !fetch || !attempt) throw new HttpError(409, 'plugin_install_source_mismatch', 'An exact successful fetch of this registered version is required.');
    const artifact = packageArtifactSchema.parse(attempt.artifact);
    if (artifact.artifactId !== attempt.artifact_id || artifact.name !== version.packageName || artifact.version !== version.packageVersion
      || artifact.sha256 !== version.declaredSha256 || artifact.name !== fetch.package_name || artifact.version !== fetch.package_version
      || artifact.sha256 !== fetch.expected_sha256 || artifact.integrity !== fetch.integrity || artifact.source.registry !== fetch.registry_url)
      throw new HttpError(409, 'plugin_install_source_mismatch', 'The artifact does not match its immutable source.');
    if (fetch.store_id !== host.artifactStore.storeId || !host.materialStore.allowedDigests.includes(artifact.sha256)) throw new HttpError(409, 'plugin_install_untrusted', 'This artifact store or package is not permitted on this host.');
    const operationId = randomUUID();
    const frozen = { registrationId, versionId, revision: input.expectedRevision, fetchOperationId: input.fetchOperationId,
      fetchAttemptId: input.fetchAttemptId, artifact, artifactStoreId: fetch.store_id, storeId: host.materialStore.storeId };
    await client.query(`INSERT INTO flow.plugin_material_installs(id,registration_id,version_id,admitted_revision,fetch_operation_id,fetch_attempt_id,
      artifact_id,artifact_store_id,store_id,artifact,input_digest,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'accepted')`,
    [operationId, registrationId, versionId, input.expectedRevision, input.fetchOperationId, input.fetchAttemptId, artifact.artifactId, fetch.store_id, host.materialStore.storeId, JSON.stringify(artifact), sha256(canonical(frozen))]);
    await installAudit(client, operationId, 'admitted', { kind: 'owner' }, input.reason);
    return { operationId };
  });
  return { ...result.value, replayed: result.replayed };
}
export async function commandInstall(pool: Pool, host: PluginInstallHost, id: string, input: PluginInstallCommand, key: string): Promise<PluginInstallAccepted> {
  const result = await command(pool, `plugin.material-install.command:${id}`, key, input, async client => {
    const row = await loadInstall(client, id, true); assertHost(row, host);
    if (input.action === 'start' ? row.status !== 'accepted' : !['preparing', 'unknown'].includes(row.status)) throw new HttpError(409, 'plugin_install_state_conflict', 'The operation cannot perform this action.');
    await installAudit(client, id, input.action, { kind: 'owner' }, input.reason);
    return { operationId: id };
  });
  return { ...result.value, replayed: result.replayed };
}
async function onSession<T>(client: PoolClient, run: () => Promise<T>): Promise<T> {
  await client.query('BEGIN');
  try { const value = await run(); await client.query('COMMIT'); return value; }
  catch (error) { await client.query('ROLLBACK').catch(() => undefined); throw error; }
}
async function beginInstall(client: PoolClient, host: PluginInstallHost, id: string): Promise<InstallRecord | null> {
  return onSession(client, async () => {
    const row = await loadInstall(client, id, true); assertHost(row, host);
    if (row.status !== 'accepted' || host.signal?.aborted) return null;
    if ((await client.query("SELECT 1 FROM flow.plugin_material_installs WHERE store_id=$1 AND status IN ('preparing','unknown') LIMIT 1", [row.store_id])).rowCount) return null;
    row.execution_id = randomUUID(); row.status = 'preparing';
    await client.query("UPDATE flow.plugin_material_installs SET status='preparing',execution_id=$2,updated_at=clock_timestamp() WHERE id=$1", [id, row.execution_id]);
    await installAudit(client, id, 'preparing', { kind: 'center', executionId: row.execution_id });
    return row;
  });
}
function finiteFailure(error: unknown): { status: 'failed' | 'unknown'; error: PluginInstallError } {
  if (error instanceof PackageStoreError && error.code !== 'UNKNOWN') return { status: 'failed', error: error.code === 'CANCELLED' ? 'cancelled' : 'material_rejected' };
  return { status: 'unknown', error: 'outcome_unknown' };
}
async function finishInstall(client: PoolClient, row: InstallRecord, receipt: InstalledPackageReceipt | null, failure: { status: 'failed' | 'unknown'; error: PluginInstallError } | null): Promise<void> {
  await onSession(client, async () => {
    const current = await loadInstall(client, row.id, true);
    if (current.execution_id !== row.execution_id || !['preparing', 'unknown'].includes(current.status)) throw new HttpError(409, 'plugin_install_state_conflict', 'Material installation identity changed.');
    const status = receipt ? 'installed' : failure!.status;
    await client.query('UPDATE flow.plugin_material_installs SET status=$2,receipt=$3,error=$4,updated_at=clock_timestamp() WHERE id=$1', [row.id, status, receipt ? JSON.stringify(receipt) : null, failure?.error ?? null]);
    await installAudit(client, row.id, status, { kind: 'center', executionId: row.execution_id! }, null, failure?.error ?? null);
  });
}
async function prepare(row: InstallRecord, host: PluginInstallHost, signal: AbortSignal): Promise<InstalledPackageReceipt> {
  signal.throwIfAborted();
  const artifact = await readPackageArtifact(host.artifactStore.root, row.artifact_id);
  if (canonical(artifact) !== canonical(row.artifact)) throw new PackageStoreError('INTEGRITY_MISMATCH');
  signal.throwIfAborted();
  return (await prepareInstalledPackage({ artifact, store: host.materialStore, signal,
    tarballPath: join(host.artifactStore.root, 'artifacts', row.artifact_id, 'package.tgz') })).receipt;
}

/** One foreground operation. Replay callers must not enter. A lost session is never replaced to finish a write. */
export async function runInstall(pool: Pool, host: PluginInstallHost, id: string, action: 'start' | 'reconcile'): Promise<void> {
  const client = await pool.connect(); const lost = new AbortController(); let broken = false; let locked = false;
  const lock = `flow-plugin-material:${host.materialStore.storeId}`;
  const failed = () => { broken = true; lost.abort(); };
  const signal = AbortSignal.any([lost.signal, ...(host.signal ? [host.signal] : [])]);
  client.on('error', failed);
  try {
    if (signal.aborted) return;
    locked = (await client.query<{ locked: boolean }>('SELECT pg_try_advisory_lock(hashtextextended($1,0)) AS locked', [lock])).rows[0]?.locked === true;
    if (!locked) return;
    const row = action === 'start' ? await beginInstall(client, host, id) : await loadInstall(client, id);
    if (!row) return;
    assertHost(row, host);
    if (action === 'reconcile' && !['preparing', 'unknown'].includes(row.status)) return;
    // beginInstall returns only after the durable preparing COMMIT ACK. No operation FS work precedes it.
    let receipt: InstalledPackageReceipt | null = null; let failure: ReturnType<typeof finiteFailure> | null = null;
    try {
      receipt = action === 'start' ? await prepare(row, host, signal) : (await readInstalledPackage({ artifact: row.artifact, store: host.materialStore, signal })).receipt;
      if (action === 'reconcile' && !(await host.executionSettled?.(row.execution_id!))) { receipt = null; failure = { status: 'unknown', error: 'lifecycle_unknown' }; }
    } catch (error) {
      failure = action === 'reconcile' ? { status: 'unknown', error: 'outcome_unknown' } : finiteFailure(error);
    }
    if (broken) throw new HttpError(503, 'plugin_install_unknown', 'The center session was lost; the durable operation requires observation.');
    await finishInstall(client, row, receipt, failure);
  } catch (error) {
    broken = true; lost.abort();
    if (error instanceof HttpError) throw error;
    throw new HttpError(503, 'plugin_install_unknown', 'Material installation outcome is not confirmed.');
  } finally {
    // All awaited own I/O has settled. UNKNOWN material results remain a durable store gate.
    if (locked && !broken) { try { await client.query('SELECT pg_advisory_unlock(hashtextextended($1,0))', [lock]); } catch { broken = true; } }
    client.removeListener('error', failed); client.release(broken);
  }
}
