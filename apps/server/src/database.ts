import { Pool, type PoolClient } from 'pg';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

export class HttpError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) { super(message); }
}
export function sha256(value: string): string { return createHash('sha256').update(value).digest('hex'); }
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`;
  return JSON.stringify(value);
}
export async function transaction<T>(pool: Pool, run: (client: PoolClient) => Promise<T>, readOnly = false): Promise<T> {
  let connectionError: Error | undefined;
  const disconnected = (error: Error) => { connectionError ??= error; };
  const client = await new Promise<PoolClient>((resolve, reject) => {
    pool.connect((error, borrowed) => {
      if (error) { reject(error); return; }
      if (!borrowed) { reject(new Error('Pool returned no transaction client.')); return; }
      // The pool has removed its idle listener; cover checkout before resolving.
      borrowed.on('error', disconnected);
      resolve(borrowed);
    });
  });
  const assertConnected = () => { if (connectionError) throw connectionError; };
  let commitAttempted = false;
  let discard = false;
  let failed = false;
  try {
    assertConnected();
    await client.query(readOnly ? 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY' : 'BEGIN');
    assertConnected();
    const result = await run(client);
    assertConnected();
    commitAttempted = true;
    await client.query('COMMIT');
    // A received COMMIT ACK stays successful even if the connection then fails.
    return result;
  } catch (error) {
    failed = true;
    const originalError = connectionError ?? error;
    discard = commitAttempted || connectionError !== undefined;
    if (!connectionError) {
      try { await client.query('ROLLBACK'); }
      catch { discard = true; }
    }
    // ROLLBACK cannot disprove an unknown COMMIT or replace the first failure.
    throw originalError;
  } finally {
    try { client.release(discard || connectionError !== undefined); }
    catch (error) { if (!failed) throw error; }
    finally {
      // release may synchronously hand the client to another borrower.
      client.removeListener('error', disconnected);
    }
  }
}
export async function migrate(pool: Pool): Promise<void> {
  await transaction(pool, async client => {
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended('flow-migrations',0))");
    await client.query('CREATE SCHEMA IF NOT EXISTS flow; CREATE TABLE IF NOT EXISTS flow.migrations (version integer PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT clock_timestamp())');
    if (!(await client.query('SELECT version FROM flow.migrations WHERE version=1')).rowCount) {
    await client.query(`
      CREATE SCHEMA IF NOT EXISTS flow;
      CREATE TABLE IF NOT EXISTS flow.tasks (
        id text PRIMARY KEY, submission jsonb NOT NULL,
        status text NOT NULL DEFAULT 'queued', verification_status text NOT NULL DEFAULT 'pending',
        created_at timestamptz(3) NOT NULL DEFAULT clock_timestamp(), updated_at timestamptz(3) NOT NULL DEFAULT clock_timestamp(),
        cursor integer NOT NULL DEFAULT 0, owner_version integer NOT NULL DEFAULT 0,
        dispatch_ready boolean NOT NULL DEFAULT false, current_attempt_id text,
        pending_decision jsonb, latest_artifact_id text, latest_artifact_version text,
        usage jsonb NOT NULL DEFAULT '{"inputTokens":null,"outputTokens":null,"costUsd":null,"costKind":"unknown","incomplete":true}'
      );
      CREATE INDEX IF NOT EXISTS tasks_list ON flow.tasks(created_at DESC,id DESC);
      CREATE INDEX IF NOT EXISTS tasks_dispatch ON flow.tasks(created_at,id) WHERE status='queued';
      CREATE TABLE IF NOT EXISTS flow.commands (
        operation text NOT NULL, key text NOT NULL, digest text NOT NULL, response jsonb NOT NULL,
        PRIMARY KEY(operation,key)
      );
      CREATE TABLE IF NOT EXISTS flow.timeline (
        task_id text NOT NULL REFERENCES flow.tasks(id), cursor integer NOT NULL, entry jsonb NOT NULL,
        PRIMARY KEY(task_id,cursor)
      );
      CREATE TABLE IF NOT EXISTS flow.runners (
        id text PRIMARY KEY, name text NOT NULL, token_hash text UNIQUE NOT NULL,
        harnesses text[] NOT NULL, capacity integer NOT NULL, revoked boolean NOT NULL DEFAULT false
      );
      CREATE TABLE IF NOT EXISTS flow.attempts (
        id text PRIMARY KEY, task_id text NOT NULL REFERENCES flow.tasks(id), runner_id text NOT NULL REFERENCES flow.runners(id),
        owner_version integer NOT NULL, lease_expires_at timestamptz NOT NULL, last_sequence integer NOT NULL DEFAULT 0,
        native_session_id text, completed_at timestamptz, UNIQUE(task_id,owner_version)
      );
      CREATE UNIQUE INDEX IF NOT EXISTS attempt_one_effective ON flow.attempts(task_id) WHERE completed_at IS NULL;
      CREATE INDEX IF NOT EXISTS attempt_runner_busy ON flow.attempts(runner_id) WHERE completed_at IS NULL;
      CREATE INDEX IF NOT EXISTS attempt_expiry ON flow.attempts(lease_expires_at) WHERE completed_at IS NULL;
      CREATE TABLE IF NOT EXISTS flow.runner_events (
        attempt_id text NOT NULL REFERENCES flow.attempts(id), sequence integer NOT NULL, event_id text NOT NULL, digest text NOT NULL,
        PRIMARY KEY(attempt_id,sequence), UNIQUE(attempt_id,event_id)
      );
      CREATE TABLE IF NOT EXISTS flow.decisions (
        task_id text NOT NULL REFERENCES flow.tasks(id), id text NOT NULL, prompt text NOT NULL,
        answer text, created_at timestamptz NOT NULL DEFAULT clock_timestamp(), answered_at timestamptz,
        PRIMARY KEY(task_id,id)
      );
      CREATE TABLE IF NOT EXISTS flow.details (
        id text PRIMARY KEY, task_id text NOT NULL REFERENCES flow.tasks(id), attempt_id text NOT NULL REFERENCES flow.attempts(id),
        title text NOT NULL, kind text NOT NULL, content text NOT NULL, media_type text NOT NULL, artifact_version text
      );
      CREATE TABLE IF NOT EXISTS flow.artifacts (
        task_id text NOT NULL REFERENCES flow.tasks(id), artifact_id text NOT NULL, version text NOT NULL,
        attempt_id text NOT NULL REFERENCES flow.attempts(id), detail_id text NOT NULL REFERENCES flow.details(id),
        PRIMARY KEY(task_id,artifact_id,version)
      );
      CREATE TABLE IF NOT EXISTS flow.usage_samples (
        ordinal bigserial UNIQUE, task_id text NOT NULL REFERENCES flow.tasks(id), stream text NOT NULL, sample_id text NOT NULL,
        digest text NOT NULL, sample jsonb NOT NULL, authoritative boolean NOT NULL,
        input_tokens bigint, output_tokens bigint, cost_usd double precision, cost_kind text NOT NULL,
        PRIMARY KEY(stream,sample_id)
      );
      CREATE INDEX IF NOT EXISTS usage_task ON flow.usage_samples(task_id) WHERE authoritative;
      CREATE INDEX IF NOT EXISTS usage_baseline ON flow.usage_samples(stream,ordinal DESC) WHERE authoritative;
      CREATE TABLE IF NOT EXISTS flow.sessions (
        id text NOT NULL, harness text NOT NULL, runner_id text NOT NULL REFERENCES flow.runners(id),
        active_task_id text REFERENCES flow.tasks(id), PRIMARY KEY(id,harness)
      );
      INSERT INTO flow.migrations(version) VALUES(1);
    `);
    }
    if (!(await client.query('SELECT version FROM flow.migrations WHERE version=2')).rowCount) {
      await client.query(await readFile(new URL('../../../packages/storage/migrations/002-reconciliation.sql', import.meta.url), 'utf8'));
    }
  });
}
