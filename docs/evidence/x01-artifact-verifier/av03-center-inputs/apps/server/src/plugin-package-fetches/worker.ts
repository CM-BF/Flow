import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import type { PackageArtifact } from '../../../../packages/contracts/src/package-artifacts.js';
import { fetchPackageArtifact, readPackageArtifact } from '../package-artifacts/index.js';
import { prepareHost, registryFor, type PackageFetchHost } from './host.js';
import { audit, currentAttempt, loadFetch, workerTransaction, type AttemptRecord, type FetchRecord } from './store.js';

export interface PackageFetchWorker { wake(): void; stop(): Promise<void> }
interface Job { operation: FetchRecord; attempt: AttemptRecord; recovery: boolean }

async function nextJob(client: PoolClient, host: PackageFetchHost, workerId: string): Promise<Job | null> {
  return workerTransaction(client, async () => {
    const record = (await client.query<FetchRecord>(`SELECT f.* FROM flow.plugin_package_fetches f
      JOIN flow.plugin_package_fetch_attempts a ON a.id=f.current_attempt_id
      WHERE f.store_id=$1 AND a.status IN ('queued','running','recovering')
      ORDER BY f.created_at,f.id LIMIT 1 FOR UPDATE OF f`, [host.storeId])).rows[0];
    if (!record) return null;
    const attempt = await currentAttempt(client, record, true);
    const recovery = attempt.status !== 'queued';
    await client.query("UPDATE flow.plugin_package_fetch_attempts SET status=$2,worker_id=$3,error=NULL,updated_at=clock_timestamp() WHERE id=$1",
      [attempt.id, recovery ? 'recovering' : 'running', workerId]);
    await client.query('UPDATE flow.plugin_package_fetches SET updated_at=clock_timestamp() WHERE id=$1', [record.id]);
    if (!recovery) await audit(client, record.id, attempt.id, 'running', { kind: 'center', storeId: host.storeId, workerId });
    return { operation: record, attempt, recovery };
  });
}
function matches(artifact: PackageArtifact, job: Job): boolean {
  const expected = job.operation;
  return artifact.artifactId === job.attempt.artifact_id && artifact.name === expected.package_name
    && artifact.version === expected.package_version && artifact.integrity === expected.integrity
    && artifact.sha256 === expected.expected_sha256 && artifact.source.registry === expected.registry_url;
}
async function finish(client: PoolClient, host: PackageFetchHost, workerId: string, job: Job,
  status: 'succeeded' | 'failed' | 'interrupted', artifact: PackageArtifact | null, error: string | null): Promise<void> {
  await workerTransaction(client, async () => {
    const operation = await loadFetch(client, job.operation.id, true);
    const attempt = await currentAttempt(client, operation, true);
    if (attempt.id !== job.attempt.id || attempt.worker_id !== workerId || !['running', 'recovering'].includes(attempt.status)) return;
    await client.query('UPDATE flow.plugin_package_fetch_attempts SET status=$2,artifact=$3,error=$4,updated_at=clock_timestamp() WHERE id=$1',
      [attempt.id, status, artifact ? JSON.stringify(artifact) : null, error]);
    await client.query('UPDATE flow.plugin_package_fetches SET updated_at=clock_timestamp() WHERE id=$1', [operation.id]);
    await audit(client, operation.id, attempt.id, status, { kind: 'center', storeId: host.storeId, workerId }, null, error);
  });
}
function errorCode(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error && typeof error.code === 'string') {
    const known = ['NOT_FOUND', 'INTEGRITY_MISMATCH', 'TOO_LARGE', 'TIMEOUT', 'CANCELLED', 'SOURCE_REJECTED', 'FETCH_FAILED', 'STORAGE_FAILED', 'INVALID_REQUEST', 'INVALID_CONFIGURATION'];
    if (known.includes(error.code)) return error.code;
  }
  return 'FETCH_FAILED';
}
async function execute(client: PoolClient, host: PackageFetchHost, workerId: string, job: Job, signal: AbortSignal): Promise<void> {
  let artifact: PackageArtifact | null = null;
  let failure: string | null = null;
  let registry;
  try {
    registry = registryFor(host, job.operation.registry_ref);
    if (registry.url !== job.operation.registry_url) throw new Error('changed');
  } catch {
    await finish(client, host, workerId, job, 'interrupted', null, 'REGISTRY_CHANGED');
    return;
  }
  try {
    artifact = job.recovery
      ? await readPackageArtifact(host.root, job.attempt.artifact_id)
      : await fetchPackageArtifact({ root: host.root, artifactId: job.attempt.artifact_id,
        registry: registry.url, allowInsecureLoopback: registry.allowInsecureLoopback },
      { name: job.operation.package_name, version: job.operation.package_version, integrity: job.operation.integrity }, signal);
  } catch (error) {
    failure = errorCode(error);
    // Publication may have committed before cleanup/ACK failed. The durable ID
    // makes this a precise bounded read, never a directory scan or second GET.
    try { artifact = await readPackageArtifact(host.root, job.attempt.artifact_id); } catch { /* retain original failure */ }
  }
  if (artifact && matches(artifact, job)) await finish(client, host, workerId, job, 'succeeded', artifact, null);
  else if (artifact) await finish(client, host, workerId, job, 'failed', null, 'DECLARATION_MISMATCH');
  else {
    const interrupted = job.recovery || signal.aborted || failure === 'STORAGE_FAILED';
    await finish(client, host, workerId, job, interrupted ? 'interrupted' : 'failed', null, failure ?? 'FETCH_FAILED');
  }
}

export async function startPackageFetchWorker(pool: Pool, host: PackageFetchHost): Promise<PackageFetchWorker> {
  await prepareHost(host);
  const client = await pool.connect();
  const lock = `flow-package-fetch:${host.storeId}`;
  const workerId = randomUUID();
  const stop = new AbortController();
  let failed = false;
  let active: Promise<void> | null = null;
  let stopping: Promise<void> | null = null;
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    client.removeListener('error', connectionFailed);
    client.release(failed);
  };
  const connectionFailed = () => { failed = true; stop.abort(); };
  client.on('error', connectionFailed);
  try {
    const locked = (await client.query<{ locked: boolean }>('SELECT pg_try_advisory_lock(hashtextextended($1,0)) AS locked', [lock])).rows[0]?.locked;
    if (!locked) throw new Error('A package fetch worker already owns this center store.');
  } catch (error) { client.removeListener('error', connectionFailed); client.release(failed); throw error; }
  const scan = async () => {
    // Every worker DB operation uses the same session that holds the advisory
    // lock. A lost connection cannot silently finish via another pool session.
    while (!stop.signal.aborted) {
      const job = await nextJob(client, host, workerId);
      if (!job) return;
      await execute(client, host, workerId, job, stop.signal);
    }
  };
  const wake = () => {
    if (active || stop.signal.aborted) return;
    active = scan().catch(() => {
      failed = true; stop.abort(); clearInterval(timer); release();
      console.error('Package fetch worker stopped; pending operations require local recovery.');
    }).finally(() => { active = null; });
  };
  const timer = setInterval(wake, 200);
  timer.unref();
  wake();
  return { wake, stop: () => stopping ??= (async () => {
    clearInterval(timer); stop.abort();
    try { await active; if (!released && !failed) await client.query('SELECT pg_advisory_unlock(hashtextextended($1,0))', [lock]); }
    finally { release(); }
  })() };
}
