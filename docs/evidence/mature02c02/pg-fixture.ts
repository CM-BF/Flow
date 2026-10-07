import { randomUUID } from 'node:crypto';
import { lstatSync, mkdtempSync, rmSync } from 'node:fs';
import { open } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Pool } from 'pg';
import { FlowClient } from '../../../packages/client/src/index.js';
import { createServer } from '../../../apps/server/src/index.js';

/** Dedicated public-API fixture; explicit outer window, no model transport or existing service. */
export class ContinuityCenterFixture {
  readonly database = `flow_c02_${randomUUID().replaceAll('-', '')}`;
  private readonly marker = randomUUID();
  private readonly ownerToken = randomUUID();
  private admin: Pool | undefined;
  private app: Awaited<ReturnType<typeof createServer>> | undefined;
  private startup: Promise<void> | undefined;
  private closing: Promise<void> | undefined;
  private startupSettled = true;
  private creationRequested = false;
  private creationAcknowledged = false;
  private identity: { oid: string; marker: string } | undefined;
  private receiptPath = '';
  private workUntil = 0;
  private cleanupUntil = 0;
  private primaryFailure = false;
  private http = 0;
  private roots: { path: string; dev?: number; ino?: number }[] = [];
  readonly runners: { stop: AbortController; done: Promise<void> }[] = [];
  readonly releases: (() => void)[] = [];
  readonly facts: Record<string, unknown> = { database: this.database, window: process.env.FLOW_C02_WINDOW,
    sourceHead: process.env.FLOW_C02_EXECUTION_HEAD, nativeProcesses: 0, providerCalls: 0,
    configuredConnectionLimit: 14, primaryPhases: [], cleanupErrors: [], httpLimit: 256 };
  pool!: Pool;
  owner!: FlowClient;
  baseUrl = '';

  async preserve<T>(phase: string, action: () => Promise<T>): Promise<T> {
    try { return await action(); }
    catch (error) { this.primaryFailure = true; (this.facts.primaryPhases as string[]).push(phase); throw error; }
  }
  private async persist(suffix: string, value: unknown) {
    const bytes = Buffer.from(JSON.stringify(value, null, 2) + '\n');
    if (bytes.length > 8192) throw new Error('Fixture receipt limit exceeded.');
    const file = await open(this.receiptPath + suffix, 'wx', 0o600);
    let failed = false;
    try { await file.writeFile(bytes); await file.sync(); }
    catch (error) { failed = true; throw error; }
    finally { try { await file.close(); } catch (error) { if (!failed) throw error; (this.facts.cleanupErrors as string[]).push('receipt-close'); } }
  }
  private async readIdentity() {
    return (await this.admin!.query<{ oid: string; marker: string | null }>(
      "SELECT oid::text,shobj_description(oid,'pg_database') AS marker FROM pg_database WHERE datname=$1", [this.database])).rows[0];
  }
  start(): Promise<void> {
    if (this.startup) return this.startup;
    this.startupSettled = false;
    this.startup = this.initialize().finally(() => { this.startupSettled = true; });
    return this.startup;
  }
  private async initialize() {
    if (process.env.FLOW_C02_PG_WINDOW !== 'reviewed' || !process.env.FLOW_C02_PG_ADMIN_URL) throw new Error('Dedicated PG window is not open.');
    const url = new URL(process.env.FLOW_C02_PG_ADMIN_URL);
    if (!['postgres:', 'postgresql:'].includes(url.protocol) || !['localhost', '127.0.0.1'].includes(url.hostname) || url.port !== '55432') throw new Error('Unexpected approved local endpoint.');
    this.receiptPath = process.env.FLOW_C02_PG_RECEIPT ?? '';
    this.workUntil = Number(process.env.FLOW_C02_PG_WORK_UNTIL); this.cleanupUntil = Number(process.env.FLOW_C02_PG_CLEANUP_UNTIL);
    if (!this.receiptPath || !Number.isSafeInteger(this.workUntil) || !Number.isSafeInteger(this.cleanupUntil)
      || this.workUntil <= Date.now() || this.cleanupUntil < this.workUntil || this.cleanupUntil - Date.now() > 180000) throw new Error('Explicit evidence path and outer deadlines are required.');
    await this.persist('.reservation.json', { database: this.database, marker: this.marker, pid: process.pid, at: new Date().toISOString() });
    url.pathname = '/postgres';
    this.admin = new Pool({ connectionString: url.href, max: 1, connectionTimeoutMillis: 1500, statement_timeout: 3000, query_timeout: 4000 });
    this.admin.on('error', () => { this.facts.adminError = true; });
    if (await this.readIdentity()) throw new Error('Refusing an existing database.');
    await this.persist('.create-request.json', { database: this.database, marker: this.marker, at: new Date().toISOString() });
    this.creationRequested = true; await this.admin.query(`CREATE DATABASE ${this.database}`); this.creationAcknowledged = true;
    await this.admin.query(`COMMENT ON DATABASE ${this.database} IS '${this.marker}'`);
    const identity = await this.readIdentity();
    if (!identity || identity.marker !== this.marker) throw new Error('Owned database identity is unconfirmed.');
    this.identity = { oid: identity.oid, marker: identity.marker };
    await this.persist('.database.json', { database: this.database, identity: this.identity, creationAcknowledged: true });
    url.pathname = `/${this.database}`;
    this.pool = new Pool({ connectionString: url.href, max: 2, connectionTimeoutMillis: 1500, statement_timeout: 3000, query_timeout: 4000 });
    this.pool.on('error', () => { this.facts.poolError = true; });
    this.app = await createServer({ databaseUrl: url.href, ownerToken: this.ownerToken, leaseMs: 10000, automaticQueueScan: false });
    this.app.addHook('onRequest', async () => { if (++this.http > 256 || Date.now() >= this.workUntil) throw new Error('Owned HTTP budget exhausted.'); });
    this.baseUrl = await this.app.listen({ host: '127.0.0.1', port: 0 }); this.owner = new FlowClient({ baseUrl: this.baseUrl, token: this.ownerToken });
    this.facts.port = new URL(this.baseUrl).port;
    this.facts.migrations = (await this.pool.query('SELECT version FROM flow.migrations ORDER BY version')).rows.map(row => row.version);
  }
  ownRoot() {
    const path = mkdtempSync(join(tmpdir(), 'flow-c02-public-')); const root: { path: string; dev?: number; ino?: number } = { path };
    this.roots.push(root); const stat = lstatSync(path); root.dev = stat.dev; root.ino = stat.ino; return path;
  }
  conversationClient() {
    return new FlowClient({ baseUrl: this.baseUrl, token: this.ownerToken, conversationProtocol: 'native-v1', assistantStreamProtocol: 'patch-v2' });
  }
  readClient(assistantStreamProtocol: 'patch-v1' | 'patch-v2') {
    return new FlowClient({ baseUrl: this.baseUrl, token: this.ownerToken, assistantStreamProtocol });
  }
  async json(path: string, init: RequestInit = {}) {
    const response = await fetch(this.baseUrl + path, { ...init, headers: { Authorization: `Bearer ${this.ownerToken}`, ...init.headers }, signal: AbortSignal.timeout(3000) });
    return { status: response.status, value: await response.json() };
  }
  async close() {
    const errors = this.facts.cleanupErrors as string[];
    const settle = async (name: string, action: () => Promise<unknown>): Promise<boolean> => {
      const remaining = Math.min(8000, this.cleanupUntil - Date.now());
      if (remaining <= 0) { errors.push(`${name}-not-started`); return false; }
      let timer: NodeJS.Timeout | undefined;
      try { await Promise.race([action(), new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Cleanup deadline')), remaining); })]); return true; }
      catch { errors.push(`${name}-unknown`); return false; }
      finally { clearTimeout(timer); }
    };
    for (const release of this.releases) release();
    for (const runner of this.runners) runner.stop.abort();
    let runnersClosed = true;
    for (const runner of this.runners) if (!await settle('runner', () => runner.done)) runnersClosed = false;
    if (this.startup && !this.startupSettled) await settle('startup', () => this.startup!.catch(() => undefined));
    const startupSettled = this.startupSettled;
    const appClosed = startupSettled && (!this.app || await settle('app', () => this.closing ??= (async () => {
      this.app!.server.closeAllConnections(); await this.app!.close(); if (this.app!.server.listening) throw new Error('Listener remains open.');
    })()));
    const poolClosed = startupSettled && (!this.pool || await settle('pool', () => this.pool.end()));
    let databaseAbsent = !this.creationRequested, databaseIdentityConfirmed = false, connections: number | null = null;
    if (this.creationRequested && !this.creationAcknowledged) errors.push('create-ack-unknown');
    if (startupSettled && this.admin && this.creationAcknowledged) await settle('database-identity', async () => {
      const current = await this.readIdentity();
      if (!current) { databaseAbsent = true; return; }
      databaseIdentityConfirmed = this.creationAcknowledged && this.identity !== undefined && current.oid === this.identity.oid && current.marker === this.identity.marker;
      if (!databaseIdentityConfirmed) errors.push('database-ownership-unknown');
    });
    if (databaseIdentityConfirmed && appClosed && poolClosed && runnersClosed) {
      await settle('database-size', async () => { this.facts.databaseLogicalBytes = Number((await this.admin!.query<{ bytes: string }>('SELECT pg_database_size($1)::text AS bytes', [this.database])).rows[0]!.bytes); });
      await settle('connections', async () => { connections = (await this.admin!.query<{ n: number }>('SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname=$1', [this.database])).rows[0]!.n; });
      if (connections === 0 && await settle('drop', async () => {
        const current = await this.readIdentity();
        if (!current || current.oid !== this.identity!.oid || current.marker !== this.identity!.marker) throw new Error('Owned database identity changed.');
        await this.admin!.query(`DROP DATABASE ${this.database}`);
      })) await settle('absent', async () => { databaseAbsent = !(await this.readIdentity()); });
    }
    const adminClosed = startupSettled && (!this.admin || await settle('admin', () => this.admin!.end()));
    this.facts.roots = this.roots.map(root => {
      if (!runnersClosed || !appClosed || !poolClosed || Date.now() >= this.cleanupUntil) return { ...root, state: 'KEEP' };
      try {
        const stat = lstatSync(root.path);
        if (!stat.isDirectory() || stat.isSymbolicLink() || stat.dev !== root.dev || stat.ino !== root.ino) return { ...root, state: 'KEEP' };
        rmSync(root.path, { recursive: true });
        try { lstatSync(root.path); return { ...root, state: 'UNKNOWN' }; }
        catch (error) { if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') return { ...root, state: 'removed' }; throw error; }
      } catch { errors.push('root-cleanup'); return { ...root, state: 'UNKNOWN' }; }
    });
    Object.assign(this.facts, { httpRequests: this.http, creationRequested: this.creationRequested, creationAcknowledged: this.creationAcknowledged,
      databaseIdentity: this.identity ?? null, cleanup: { startupSettled, runnersClosed, appClosed, poolClosed, adminClosed, databaseIdentityConfirmed, connections, databaseAbsent },
      retainedDatabase: this.creationRequested && !databaseAbsent ? this.database : null, finishedAt: new Date().toISOString() });
    if (this.facts.adminError) errors.push('unexpected-admin-pool-error');
    if (this.facts.poolError) errors.push('unexpected-fixture-pool-error');
    const complete = startupSettled && runnersClosed && appClosed && poolClosed && adminClosed && databaseAbsent && !errors.length
      && (this.facts.roots as { state: string }[]).every(root => root.state === 'removed');
    this.facts.cleanupComplete = complete;
    try { if (this.receiptPath) await this.persist('', this.facts); } catch { errors.push('final-receipt'); }
    console.log(JSON.stringify(this.facts));
    if ((!complete || errors.length) && !this.primaryFailure) throw new Error('Owned fixture cleanup is incomplete; preserve exact identities.');
  }
}
