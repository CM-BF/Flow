import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import { lstat, mkdtemp, open, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FlowClient } from '../../../packages/client/src/index.js';
import { RUNNER_CLAIM_PROTOCOL, type RunnerClaimRequest, type TaskSubmission } from '../../../packages/contracts/src/index.js';
import { createServer } from '../../../apps/server/src/index.js';

/** One dedicated database and listener. No existing service, database or credential is recorded or modified. */
export class ClaimCenterFixture {
  constructor(private readonly leaseMs = 30000) {}
  readonly databaseName = `flow_s01p07_${randomUUID().replaceAll('-', '')}`;
  readonly errors: string[] = [];
  readonly primaryErrors: Array<{ phase: string; code: string }> = [];
  readonly caseResults: Array<{ name: string; state: string }> = [];
  private readonly databaseMarker = `flow-s01p07:${randomUUID()}`;
  private databaseIdentity: { oid: string; marker: string } | undefined;
  private rootIdentity: { dev: number; ino: number } | undefined;
  private creationConfirmed = false;
  private receiptPath = '';
  pool!: Pool;
  owner!: FlowClient;
  baseUrl = '';
  directory = '';
  tasks = 0;
  http = 0;
  private admin!: Pool;
  private app: Awaited<ReturnType<typeof createServer>> | undefined;
  private startup: Promise<void> | undefined;
  private startupSettled = false;
  private creationRequested = false;
  private databaseUrl = '';
  private started = performance.now();
  private workDeadline = this.started + 120_000;
  private ownerToken = randomUUID();
  readonly cleanup = { appClosed: false, poolClosed: false, adminClosed: false, connections: null as number | null,
    databaseAbsent: false, databaseIdentityConfirmed: false, rootAbsent: false, startupSettled: false };

  /** Preserve the original operation error while recording a distinct cleanup failure. */
  async withCleanup<T>(phase: string, action: () => Promise<T>, cleanup: () => Promise<unknown>): Promise<T> {
    let value!: T; let primary: unknown; let failed = false;
    try { value = await action(); }
    catch (error) { primary = error; failed = true; this.primaryErrors.push({ phase, code: errorCode(error) }); }
    try { await cleanup(); }
    catch (error) { this.errors.push(`${phase}_CLEANUP_${errorCode(error)}`); if (!failed) throw error; }
    if (failed) throw primary;
    return value;
  }
  private async persist(suffix: string, value: unknown) {
    const file = await open(`${this.receiptPath}${suffix}`, 'wx', 0o600);
    await this.withCleanup('EVIDENCE', async () => { await file.writeFile(JSON.stringify(value, null, 2) + '\n'); await file.sync(); }, () => file.close());
  }
  private async readDatabaseIdentity() {
    return (await this.admin.query<{ oid: string; marker: string | null }>(
      "SELECT oid::text AS oid,shobj_description(oid,'pg_database') AS marker FROM pg_database WHERE datname=$1", [this.databaseName])).rows[0];
  }

  start(): Promise<void> {
    this.startup = this.initialize().finally(() => { this.startupSettled = true; });
    return this.startup;
  }
  private async initialize() {
    if (process.env.FLOW_S01P07_PG_OPEN !== '1' || !process.env.FLOW_S01P07_ADMIN_URL) throw new Error('Dedicated PG window is not open.');
    const url = new URL(process.env.FLOW_S01P07_ADMIN_URL);
    if (!['localhost', '127.0.0.1'].includes(url.hostname) || url.port !== '55432') throw new Error('Unexpected approved local endpoint.');
    this.receiptPath = process.env.FLOW_S01P07_PG_RECEIPT ?? '';
    if (!this.receiptPath) throw new Error('Private receipt path is required before creating resources.');
    const workUntil = Number(process.env.FLOW_S01P07_PG_WORK_UNTIL);
    const cleanupUntil = Number(process.env.FLOW_S01P07_PG_CLEANUP_UNTIL);
    if (!Number.isSafeInteger(workUntil) || !Number.isSafeInteger(cleanupUntil)
      || workUntil <= Date.now() || cleanupUntil < workUntil || cleanupUntil - Date.now() > 190000) throw new Error('Explicit outer deadlines are required.');
    this.workDeadline = Math.min(this.workDeadline, performance.now() + workUntil - Date.now());
    await this.persist('.reservation.json', { databaseName: this.databaseName, databaseMarker: this.databaseMarker,
      creationRequested: false, pid: process.pid, at: new Date().toISOString() });
    this.directory = await mkdtemp(join(tmpdir(), 'flow-s01p07-pg-'));
    const root = await lstat(this.directory); this.rootIdentity = { dev: root.dev, ino: root.ino };
    await this.persist('.root.json', { directory: this.directory, identity: this.rootIdentity, at: new Date().toISOString() });
    url.pathname = '/postgres';
    this.admin = new Pool({ connectionString: url.href, max: 1, connectionTimeoutMillis: 2000, query_timeout: 3000, statement_timeout: 3000 });
    this.admin.on('error', () => this.errors.push('ADMIN_POOL_ERROR'));
    if ((await this.admin.query('SELECT 1 FROM pg_database WHERE datname=$1', [this.databaseName])).rowCount) throw new Error('Refusing an existing database.');
    await this.persist('.create-request.json', { databaseName: this.databaseName, databaseMarker: this.databaseMarker, creationRequested: true, at: new Date().toISOString() });
    this.creationRequested = true;
    await this.admin.query(`CREATE DATABASE ${this.databaseName}`);
    this.creationConfirmed = true;
    await this.admin.query(`COMMENT ON DATABASE ${this.databaseName} IS '${this.databaseMarker}'`);
    const identity = await this.readDatabaseIdentity();
    if (!identity || identity.marker !== this.databaseMarker) throw new Error('Owned database identity is not confirmed.');
    this.databaseIdentity = { oid: identity.oid, marker: identity.marker };
    await this.persist('.database.json', { databaseName: this.databaseName, creationConfirmed: true, identity: this.databaseIdentity, at: new Date().toISOString() });
    url.pathname = `/${this.databaseName}`; this.databaseUrl = url.href;
    this.pool = new Pool({ connectionString: this.databaseUrl, max: 3, connectionTimeoutMillis: 2000, query_timeout: 3000, statement_timeout: 3000 });
    this.pool.on('error', () => this.errors.push('OWN_POOL_ERROR'));
    await this.openServer();
  }
  private async openServer() {
    this.app = await createServer({ databaseUrl: this.databaseUrl, ownerToken: this.ownerToken, leaseMs: this.leaseMs, automaticQueueScan: false });
    this.app.addHook('onRequest', async () => { if (++this.http > 160 || performance.now() > this.workDeadline) throw new Error('Private HTTP budget exhausted.'); });
    this.baseUrl = await this.app.listen({ host: '127.0.0.1', port: 0 });
    this.owner = new FlowClient({ baseUrl: this.baseUrl, token: this.ownerToken });
  }
  restart(): Promise<void> {
    this.startupSettled = false;
    this.startup = (async () => {
      if (!this.app) throw new Error('No owned server to restart.');
      await this.app.close(); this.app = undefined;
      await this.openServer();
    })().finally(() => { this.startupSettled = true; });
    return this.startup;
  }
  client(token: string) { return new FlowClient({ baseUrl: this.baseUrl, token }); }
  async runner(capacity = 1) {
    const registered = await this.owner.registerRunner({ name: 'S01P07 synthetic fixture', harnesses: ['fixture'], capacity });
    return { ...registered, client: this.client(registered.token) };
  }
  opportunity(runnerId: string, requestId = randomUUID()): RunnerClaimRequest { return { protocol: RUNNER_CLAIM_PROTOCOL, runnerId, requestId }; }
  async submit(extra: Partial<TaskSubmission> = {}) {
    if (++this.tasks > 16 || performance.now() > this.workDeadline) throw new Error('Private task budget exhausted.');
    const accepted = await this.owner.submit({ title: 'Claim recovery fixture', prompt: 'No model or provider', harness: 'fixture', ...extra }, randomUUID());
    await this.pool.query('UPDATE flow.tasks SET dispatch_ready=true WHERE id=$1', [accepted.task.id]);
    return accepted.task.id;
  }
  async isolateNextCase() {
    // Terminal cancellation cannot be reversed by the production dispatch sweep.
    for (const row of (await this.pool.query<{ id: string }>("SELECT id FROM flow.tasks WHERE status='queued'")).rows) {
      await this.owner.cancel(row.id, randomUUID());
    }
  }
  async close() {
    const outerRemaining = Number(process.env.FLOW_S01P07_PG_CLEANUP_UNTIL) - Date.now();
    const deadline = performance.now() + Math.max(0, Math.min(70000, Number.isFinite(outerRemaining) ? outerRemaining : 0));
    const settle = async (name: string, operation: () => Promise<unknown>): Promise<boolean> => {
      const remaining = Math.min(8000, deadline - performance.now());
      if (remaining <= 0) { this.errors.push(`${name}_NOT_STARTED`); return false; }
      let timer: NodeJS.Timeout | undefined;
      try { await Promise.race([operation(), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('unknown')), remaining); })]); return true; }
      catch { this.errors.push(`${name}_UNKNOWN`); return false; }
      finally { clearTimeout(timer); }
    };
    if (this.startup && !this.startupSettled) await settle('STARTUP', async () => { await this.startup!.catch(() => undefined); });
    this.cleanup.startupSettled = this.startupSettled;
    this.cleanup.appClosed = this.startupSettled && (!this.app || await settle('APP_CLOSE', () => this.app!.close()));
    this.cleanup.poolClosed = this.startupSettled && (!this.pool || await settle('POOL_CLOSE', () => this.pool.end()));
    if (!this.creationRequested) this.cleanup.databaseAbsent = true;
    else if (this.admin) await settle('DATABASE_IDENTITY', async () => {
      const current = await this.readDatabaseIdentity();
      if (!current) { this.cleanup.databaseAbsent = true; return; }
      this.cleanup.databaseIdentityConfirmed = this.creationConfirmed && this.databaseIdentity !== undefined
        && current.oid === this.databaseIdentity.oid && current.marker === this.databaseIdentity.marker;
      if (!this.cleanup.databaseIdentityConfirmed) this.errors.push('DATABASE_OWNERSHIP_UNKNOWN');
    });
    if (this.cleanup.databaseIdentityConfirmed && this.cleanup.appClosed && this.cleanup.poolClosed) {
      await settle('CONNECTIONS', async () => { this.cleanup.connections = (await this.admin.query<{ count: number }>('SELECT count(*)::int AS count FROM pg_stat_activity WHERE datname=$1', [this.databaseName])).rows[0]!.count; });
      if (this.cleanup.connections === 0 && await settle('DROP', async () => {
        const current = await this.readDatabaseIdentity();
        if (!current || current.oid !== this.databaseIdentity!.oid || current.marker !== this.databaseIdentity!.marker) throw new Error('Database identity changed.');
        await this.admin.query(`DROP DATABASE ${this.databaseName}`);
      })) {
        await settle('ABSENT', async () => { this.cleanup.databaseAbsent = !(await this.readDatabaseIdentity()); });
      }
    }
    this.cleanup.adminClosed = !this.admin || await settle('ADMIN_CLOSE', () => this.admin.end());
    if (!this.directory) this.cleanup.rootAbsent = true;
    else if (this.cleanup.appClosed && this.cleanup.poolClosed && this.rootIdentity) await settle('ROOT_REMOVE', async () => {
      const current = await lstat(this.directory);
      if (!current.isDirectory() || current.isSymbolicLink() || current.dev !== this.rootIdentity!.dev || current.ino !== this.rootIdentity!.ino) throw new Error('Root identity changed.');
      await rm(this.directory, { recursive: true });
      try { await lstat(this.directory); } catch (error) { if (errorCode(error) === 'ENOENT') this.cleanup.rootAbsent = true; else throw error; }
      if (!this.cleanup.rootAbsent) throw new Error('Root absence not confirmed.');
    });
    const receipt = { window: process.env.FLOW_S01P07_PG_WINDOW, sourceHead: process.env.FLOW_S01P07_EXECUTION_HEAD,
      databaseName: this.databaseName, creationRequested: this.creationRequested, creationConfirmed: this.creationConfirmed,
      databaseIdentity: this.databaseIdentity ?? null, directory: this.directory, rootIdentity: this.rootIdentity ?? null, tasks: this.tasks, http: this.http,
      elapsedMs: performance.now() - this.started, cleanup: this.cleanup, errors: this.errors, primaryErrors: this.primaryErrors, caseResults: this.caseResults, providerCalls: 0,
      retained: { database: this.creationRequested && !this.cleanup.databaseAbsent ? this.databaseName : null, root: this.directory && !this.cleanup.rootAbsent ? this.directory : null } };
    try { if (this.receiptPath) await this.persist('', receipt); else this.errors.push('RECEIPT_PATH_MISSING'); }
    catch (error) { this.errors.push(`FINAL_RECEIPT_${errorCode(error)}`); }
    // Safe facts remain in the owned stdout even when the separate evidence write fails.
    console.log(JSON.stringify(receipt));
    if (this.errors.length || !this.cleanup.appClosed || !this.cleanup.poolClosed || !this.cleanup.adminClosed
      || this.creationRequested && !this.cleanup.databaseAbsent || this.directory && !this.cleanup.rootAbsent) throw new Error('Private fixture cleanup is incomplete; retain exact identities.');
  }
}

function errorCode(error: unknown): string {
  const code = error !== null && typeof error === 'object' && 'code' in error ? error.code : undefined;
  return typeof code === 'string' && /^[A-Z0-9_]{1,32}$/.test(code) ? code : 'UNKNOWN';
}
