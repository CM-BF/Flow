import type { PoolClient } from 'pg';
import type { PackageArtifact } from '../../../../packages/contracts/src/package-artifacts.js';
import type { PackageFetchOperation, PackageFetchAudit, PackageFetchStatus, PackageFetchSummary } from '../../../../packages/contracts/src/plugin-package-fetches.js';
import { HttpError } from '../database.js';

export interface FetchRecord {
  id: string; installation_id: string; version_id: string; admitted_revision: number;
  package_name: string; package_version: string; expected_sha256: string; integrity: string;
  store_id: string; registry_ref: string; registry_url: string; current_attempt_id: string;
  created_at: Date; updated_at: Date;
}
export interface AttemptRecord {
  id: string; operation_id: string; ordinal: number; artifact_id: string; status: PackageFetchStatus;
  worker_id: string | null; error: string | null; artifact: PackageArtifact | null; created_at: Date; updated_at: Date;
}
export async function loadFetch(client: PoolClient, id: string, lock = false): Promise<FetchRecord> {
  const row = (await client.query<FetchRecord>(`SELECT * FROM flow.plugin_package_fetches WHERE id=$1${lock ? ' FOR UPDATE' : ''}`, [id])).rows[0];
  if (!row) throw new HttpError(404, 'package_fetch_not_found', 'Package fetch operation not found.');
  return row;
}
export async function currentAttempt(client: PoolClient, operation: FetchRecord, lock = false): Promise<AttemptRecord> {
  const row = (await client.query<AttemptRecord>(`SELECT * FROM flow.plugin_package_fetch_attempts WHERE id=$1 AND operation_id=$2${lock ? ' FOR UPDATE' : ''}`, [operation.current_attempt_id, operation.id])).rows[0];
  if (!row) throw new HttpError(409, 'package_fetch_state_invalid', 'Package fetch state is unavailable.');
  return row;
}
export function fetchSummary(operation: FetchRecord, attempt: AttemptRecord): PackageFetchSummary {
  return { id: operation.id, installationId: operation.installation_id, versionId: operation.version_id,
    admittedRevision: operation.admitted_revision, packageName: operation.package_name, packageVersion: operation.package_version,
    expectedSha256: operation.expected_sha256, integrity: operation.integrity, storeId: operation.store_id,
    registryRef: operation.registry_ref, status: attempt.status, currentAttemptId: attempt.id,
    createdAt: operation.created_at.toISOString(), updatedAt: operation.updated_at.toISOString() };
}
export async function readFetch(client: PoolClient, id: string): Promise<PackageFetchOperation> {
  const operation = await loadFetch(client, id);
  const attempts = (await client.query<AttemptRecord>('SELECT * FROM flow.plugin_package_fetch_attempts WHERE operation_id=$1 ORDER BY ordinal LIMIT 3', [id])).rows;
  const current = attempts.find(attempt => attempt.id === operation.current_attempt_id);
  if (!current) throw new HttpError(409, 'package_fetch_state_invalid', 'Package fetch state is unavailable.');
  return { ...fetchSummary(operation, current), artifact: current.artifact, attempts: attempts.map(attempt => ({
    id: attempt.id, ordinal: attempt.ordinal, artifactId: attempt.artifact_id, status: attempt.status,
    error: attempt.error, createdAt: attempt.created_at.toISOString(), updatedAt: attempt.updated_at.toISOString(),
  })) };
}
export async function audit(client: PoolClient, operationId: string, attemptId: string,
  kind: PackageFetchAudit['kind'], actor: PackageFetchAudit['actor'], reason: string | null = null, error: string | null = null): Promise<void> {
  await client.query('INSERT INTO flow.plugin_package_fetch_audit(operation_id,attempt_id,kind,actor,reason,error) VALUES($1,$2,$3,$4,$5,$6)',
    [operationId, attemptId, kind, JSON.stringify(actor), reason, error]);
}
export async function workerTransaction<T>(client: PoolClient, run: () => Promise<T>): Promise<T> {
  await client.query('BEGIN');
  try { const result = await run(); await client.query('COMMIT'); return result; }
  catch (error) { await client.query('ROLLBACK').catch(() => undefined); throw error; }
}
