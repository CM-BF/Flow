import { randomUUID } from 'node:crypto';
import { open } from 'node:fs/promises';
import { lstatSync, readdirSync, statfsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute } from 'node:path';
import { Pool } from 'pg';
import { FlowClient } from '../../../../packages/client/src/index.js';
import { createServer } from '../../../../apps/server/src/index.js';

/** A single owned PG fixture. No provider, shared service or cleanup permission is supplied by a task. */
export class NativeHostCenter {
  readonly database = `flow_eng01i_${randomUUID().replaceAll('-', '')}`;
  private readonly marker = randomUUID();
  private readonly ownerToken = randomUUID();
  private admin?: Pool;
  private app?: Awaited<ReturnType<typeof createServer>>;
  private creationRequested = false;
  private startup?: Promise<void>;
  private startupSettled = true;
  private identity?: { oid: string; marker: string };
  private checkpointIndex = 0;
  private recordedBytes = 0;
  readonly samples: unknown[] = [];
  readonly errors: string[] = [];
  pool?: Pool;
  owner!: FlowClient;
  baseUrl = '';
  private receipt = '';
  private until = 0;

  async checkpoint(stage: string, detail: unknown = {}) {
    const resource = this.resources();
    const data = Buffer.from(JSON.stringify({ resource, stage, at: new Date().toISOString(), database: this.database, marker: this.marker,
      identity: this.identity ?? null, creationRequested: this.creationRequested, samples: this.samples, errors: this.errors, detail }) + '\n');
    if (data.length > 32768 || this.recordedBytes + data.length > 524288) throw Error('Fixture checkpoint exceeds limit.');
    this.recordedBytes += data.length;
    const file = await open(`${this.receipt}.${this.checkpointIndex++}.json`, 'wx', 0o600);
    try { await file.writeFile(data); await file.sync(); } finally { await file.close(); }
    const parent = await open(dirname(this.receipt), 'r'); try { await parent.sync(); } finally { await parent.close(); }
  }
  private resources() {
    let bytes = 0, entries = 0;
    const visit = (path: string) => { for (const name of readdirSync(path)) {
      const item = `${path}/${name}`, info = lstatSync(item); if (++entries > 8192) throw Error('Runtime entry bound exceeded.');
      if (info.isDirectory()) visit(item); else if (info.isFile()) bytes += info.size; else throw Error('Unknown runtime entry.');
    } }; visit(tmpdir());
    const disk = statfsSync(tmpdir()), freeBytes = disk.bavail * disk.bsize;
    if (bytes > 8388608 || freeBytes < 1073741824) throw Error('Runtime/free-space observation exceeded its bound; preserve resources.');
    return { runtimeBytes: bytes, entries, freeBytes, kind: 'checkpoint-observation-not-hard-quota' };
  }
  private async databaseIdentity() {
    return (await this.admin!.query<{ oid: string; marker: string | null }>(
      "SELECT oid::text,shobj_description(oid,'pg_database') AS marker FROM pg_database WHERE datname=$1", [this.database])).rows[0];
  }
  start() {
    if (!this.startup) { this.startupSettled = false; this.startup = this.initialize().finally(() => { this.startupSettled = true; }); }
    return this.startup;
  }
  private async initialize() {
    if (process.env.FLOW_ENG01I_PG !== 'reviewed') throw Error('Dedicated PG window is not open.');
    const url = new URL(process.env.FLOW_ENG01I_PG_ADMIN_URL ?? '');
    if (!['postgres:', 'postgresql:'].includes(url.protocol) || !['localhost', '127.0.0.1'].includes(url.hostname) || url.port !== '55432') throw Error('Unexpected local endpoint.');
    this.receipt = process.env.FLOW_ENG01I_PG_FACTS ?? ''; this.until = Number(process.env.FLOW_ENG01I_CLEANUP_UNTIL);
    if (!isAbsolute(this.receipt) || !Number.isSafeInteger(this.until) || this.until <= Date.now()) throw Error('Missing bounded fixture reservation.');
    await this.checkpoint('reserved');
    this.admin = new Pool({ connectionString: url.href, max: 1, connectionTimeoutMillis: 1500, statement_timeout: 3000, query_timeout: 3500 });
    this.admin.on('error', () => this.errors.push('admin-connection-error'));
    if (await this.databaseIdentity()) throw Error('Refusing an existing database.');
    await this.checkpoint('create-requested'); this.creationRequested = true;
    await this.admin.query(`CREATE DATABASE ${this.database}`);
    await this.admin.query(`COMMENT ON DATABASE ${this.database} IS '${this.marker}'`);
    const identity = await this.databaseIdentity();
    if (!identity || identity.marker !== this.marker) throw Error('Owned database marker is unconfirmed.');
    this.identity = { oid: identity.oid, marker: this.marker }; await this.checkpoint('created');
    url.pathname = `/${this.database}`;
    this.pool = new Pool({ connectionString: url.href, max: 1, connectionTimeoutMillis: 1500, statement_timeout: 3000, query_timeout: 3500 });
    this.pool.on('error', () => this.errors.push('fixture-connection-error'));
    this.app = await createServer({ databaseUrl: url.href, ownerToken: this.ownerToken, leaseMs: 300000, automaticQueueScan: false });
    this.baseUrl = await this.app.listen({ host: '127.0.0.1', port: 0 });
    this.owner = new FlowClient({ baseUrl: this.baseUrl, token: this.ownerToken });
    await this.checkpoint('ready', { baseUrl: this.baseUrl, providerCalls: 0 });
  }
  runner(token: string) { return new FlowClient({ baseUrl: this.baseUrl, token }); }
  async close() {
    if (!this.receipt) return;
    if (!this.startupSettled) { await this.checkpoint('startup-unknown-KEEP'); throw Error('Startup remains unknown; retain all resources.'); }
    let appClosed = !this.app, poolClosed = !this.pool, databaseAbsent = !this.creationRequested, connections: unknown[] | null = null;
    const attempt = async (label: string, action: () => Promise<void>) => {
      if (Date.now() >= this.until) { this.errors.push(`${label}-deadline`); return; }
      try { await action(); } catch { this.errors.push(`${label}-unknown`); }
    };
    // Evidence is durable before any irreversible cleanup, including closing the last DB handle.
    await this.checkpoint('cleanup-started');
    await attempt('app-close', async () => { this.app?.server.closeAllConnections(); await this.app?.close(); appClosed = true; });
    await attempt('pool-close', async () => { await this.pool?.end(); poolClosed = true; });
    if (this.identity && appClosed && poolClosed && !this.errors.length) await attempt('database', async () => {
      const current = await this.databaseIdentity();
      if (!current || current.oid !== this.identity!.oid || current.marker !== this.marker) throw Error('Database identity differs.');
      const size = Number((await this.admin!.query('SELECT pg_database_size($1)::text AS bytes', [this.database])).rows[0].bytes);
      const until = Math.min(this.until, Date.now() + 3000);
      do {
        const remaining = until - Date.now(); if (remaining <= 0) throw Error('Connection observation deadline reached.');
        const rows = (await this.admin!.query({ text: 'SELECT pid,state FROM pg_stat_activity WHERE datname=$1 ORDER BY pid LIMIT 33', values: [this.database], query_timeout: remaining })).rows;
        connections = rows;
        if (Date.now() >= until || rows.length > 32) throw Error('Bounded connection observation is unknown.');
        if (!rows.length) break;
        await new Promise(resolve => setTimeout(resolve, 30));
      } while (Date.now() < until);
      if (connections?.length !== 0) throw Error('Owned connections remain.');
      await this.checkpoint('before-drop', { appClosed, poolClosed, connections, databaseBytes: size });
      const again = await this.databaseIdentity();
      if (!again || again.oid !== this.identity!.oid || again.marker !== this.marker || Date.now() >= this.until) throw Error('Database identity/deadline changed.');
      await this.admin!.query(`DROP DATABASE ${this.database}`);
      databaseAbsent = !(await this.databaseIdentity());
    });
    await attempt('admin-close', async () => { await this.admin?.end(); });
    await this.checkpoint('closed', { appClosed, poolClosed, databaseAbsent, connections, retainedDatabase: databaseAbsent ? null : this.database });
    if (!appClosed || !poolClosed || !databaseAbsent || this.errors.length) throw Error('Fixture cleanup is unknown; preserve exact reservation.');
  }
}
