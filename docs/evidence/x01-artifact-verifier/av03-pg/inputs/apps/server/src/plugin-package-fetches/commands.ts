import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import type { PluginVersionDeclaration } from '../../../../packages/contracts/src/plugins.js';
import { PACKAGE_FETCH_LIMITS, type PackageFetchAccepted, type PackageFetchCommand, type PackageFetchRequest } from '../../../../packages/contracts/src/plugin-package-fetches.js';
import { HttpError } from '../database.js';
import { command } from '../tasks.js';
import { parseRequest } from '../package-artifacts/input.js';
import { registryFor, type PackageFetchHost } from './host.js';
import { audit, currentAttempt, loadFetch } from './store.js';

export async function admitFetch(pool: Pool, host: PackageFetchHost, installationId: string, versionId: string,
  input: PackageFetchRequest, key: string): Promise<PackageFetchAccepted> {
  const registry = registryFor(host, input.registryRef);
  const result = await command(pool, `plugin.package-fetch:${installationId}:${versionId}`, key, input, async client => {
    const installation = (await client.query<{ revision: number }>('SELECT revision FROM flow.plugin_installations WHERE id=$1 FOR SHARE', [installationId])).rows[0];
    if (!installation) throw new HttpError(404, 'plugin_not_found', 'Plugin registration not found.');
    if (installation.revision !== input.expectedRevision) throw new HttpError(409, 'plugin_revision_conflict', 'Plugin registration changed.');
    const version = (await client.query<{ declaration: PluginVersionDeclaration }>('SELECT declaration FROM flow.plugin_versions WHERE installation_id=$1 AND id=$2', [installationId, versionId])).rows[0]?.declaration;
    if (!version) throw new HttpError(404, 'plugin_version_not_found', 'Plugin version not found in this registration.');
    try { parseRequest({ name: version.packageName, version: version.packageVersion, integrity: input.integrity }); }
    catch { throw new HttpError(400, 'invalid_package_fetch', 'Invalid exact package integrity request.'); }
    const operationId = randomUUID(); const attemptId = randomUUID();
    await client.query(`INSERT INTO flow.plugin_package_fetches(id,installation_id,version_id,admitted_revision,package_name,package_version,
      expected_sha256,integrity,store_id,registry_ref,registry_url,current_attempt_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    [operationId, installationId, versionId, input.expectedRevision, version.packageName, version.packageVersion,
      version.declaredSha256, input.integrity, host.storeId, input.registryRef, registry.url, attemptId]);
    await client.query("INSERT INTO flow.plugin_package_fetch_attempts(id,operation_id,ordinal,artifact_id,status) VALUES($1,$2,1,$3,'queued')", [attemptId, operationId, randomUUID()]);
    await audit(client, operationId, attemptId, 'admitted', { kind: 'owner' });
    return { operationId, attemptId };
  });
  return { ...result.value, replayed: result.replayed };
}

export async function commandFetch(pool: Pool, host: PackageFetchHost, id: string, input: PackageFetchCommand,
  key: string): Promise<PackageFetchAccepted> {
  const result = await command(pool, `plugin.package-fetch.command:${id}`, key, input, async client => {
    const operation = await loadFetch(client, id, true);
    if (operation.store_id !== host.storeId) throw new HttpError(409, 'package_store_mismatch', 'This operation belongs to another center store.');
    if (registryFor(host, operation.registry_ref).url !== operation.registry_url) throw new HttpError(409, 'registry_changed', 'The accepted registry configuration changed.');
    const current = await currentAttempt(client, operation, true);
    if (!['interrupted', 'failed'].includes(current.status)) throw new HttpError(409, 'package_fetch_state_conflict', 'Only failed or interrupted attempts can be retried or reconciled.');
    let attemptId = current.id;
    if (input.action === 'retry') {
      if (current.ordinal >= PACKAGE_FETCH_LIMITS.attempts) throw new HttpError(409, 'package_fetch_limit', 'Package fetch attempt limit reached.');
      attemptId = randomUUID();
      await client.query("INSERT INTO flow.plugin_package_fetch_attempts(id,operation_id,ordinal,artifact_id,status) VALUES($1,$2,$3,$4,'queued')", [attemptId, id, current.ordinal + 1, randomUUID()]);
      await client.query('UPDATE flow.plugin_package_fetches SET current_attempt_id=$2,updated_at=clock_timestamp() WHERE id=$1', [id, attemptId]);
    } else {
      await client.query("UPDATE flow.plugin_package_fetch_attempts SET status='recovering',worker_id=NULL,error=NULL,updated_at=clock_timestamp() WHERE id=$1", [attemptId]);
      await client.query('UPDATE flow.plugin_package_fetches SET updated_at=clock_timestamp() WHERE id=$1', [id]);
    }
    await audit(client, id, attemptId, input.action, { kind: 'owner' }, input.reason);
    return { operationId: id, attemptId };
  });
  // A stable receipt may be replayed on another center for observation, but it
  // cannot enqueue new work there; all mutation admission remains host-bound.
  return { ...result.value, replayed: result.replayed };
}
