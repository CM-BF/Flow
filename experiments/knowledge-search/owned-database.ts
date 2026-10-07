import { randomUUID } from 'node:crypto';
import { open } from 'node:fs/promises';
import { dirname } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { Pool } from 'pg';
import type { FastifyInstance } from 'fastify';
import { acceptableIdentity, remainingMs, type DatabaseIdentity } from './corpus.js';

export async function durableJson(path: string, value: unknown, maxBytes = 2 * 1024 * 1024) {
  const bytes = Buffer.from(JSON.stringify(value, null, 2) + '\n');
  if (bytes.length > maxBytes) throw new Error('RECEIPT_LIMIT');
  const file = await open(path, 'wx', 0o600);
  try { await file.writeFile(bytes); await file.sync(); } finally { await file.close(); }
  const directory = await open(dirname(path), 'r');
  try { await directory.sync(); } finally { await directory.close(); }
}
export function errorFact(error: unknown) {
  const e = error as { name?: string; code?: string };
  return { type: e?.name ?? 'UnknownError', code: e?.code ?? (error instanceof Error && /^[A-Z_]+$/.test(error.message) ? error.message : 'EXPERIMENT_FAILED') };
}
export class OwnedDatabase {
  readonly database = 'flow_k01_query_' + randomUUID().replaceAll('-', '');
  readonly marker = randomUUID();
  readonly admin: Pool;
  auxiliary?: Pool;
  app?: FastifyInstance;
  identity?: DatabaseIdentity;
  creationAcknowledged = false;
  creationReceiptSaved = false;
  startup?: Promise<FastifyInstance>;
  creationAttempted = false;
  startupSettled = true;
  startupAttempted = false;
  healthy = true;
  readonly facts: Record<string, unknown> = { configuredConnections: { admin: 1, auxiliary: 6, business: 8, pgBoss: 3, total: 18 }, observedPeak: 'unknown' };
  constructor(readonly adminUrl: string, readonly prefix: string, readonly start: number) {
    const endpoint = new URL(adminUrl);
    if (!['postgres:', 'postgresql:'].includes(endpoint.protocol) || !['127.0.0.1', 'localhost', '[::1]'].includes(endpoint.hostname) || endpoint.pathname !== '/postgres') throw new Error('LOCAL_ADMIN_REQUIRED');
    this.admin = new Pool({ connectionString: adminUrl, max: 1, connectionTimeoutMillis: 1000, statement_timeout: 1500, lock_timeout: 500, query_timeout: 1800, application_name: 'k01-query-admin' });
    this.admin.on('error', error => { this.healthy = false; this.facts.adminError = errorFact(error); });
  }
  get workUntil() { return this.start + 70_000; }
  get cleanupUntil() { return this.start + 110_000; }
  requireWork() { if (!this.healthy) throw new Error('POOL_UNKNOWN'); const left = remainingMs(this.workUntil, Date.now(), 70_000); if (left < 2000) throw new Error('WORK_QUERY_RESERVE'); return Math.min(left, 1500); }
  async bounded<T>(action: () => Promise<T>, until: number): Promise<T> {
    const timeout = remainingMs(until, Date.now(), 110_000);
    let timer: ReturnType<typeof setTimeout> | undefined;
    try { return await Promise.race([action(), new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('DEADLINE_UNKNOWN')), timeout); })]); }
    finally { clearTimeout(timer); }
  }
  async open() {
    this.requireWork();
    const version = Number((await this.admin.query("SELECT current_setting('server_version_num') AS version")).rows[0].version);
    if (version < 160000 || version >= 170000) throw new Error('POSTGRES_VERSION');
    this.requireWork();
    if ((await this.admin.query('SELECT 1 FROM pg_database WHERE datname=$1', [this.database])).rowCount) throw new Error('DATABASE_EXISTS');
    this.requireWork();
    const owner = (await this.admin.query<{ owner: string }>('SELECT current_user AS owner')).rows[0]!.owner;
    await durableJson(this.prefix + '.database-reservation.json', { database: this.database, marker: this.marker, owner, createdAt: new Date().toISOString() }, 8192);
    this.requireWork(); this.creationAttempted = true;
    // Lost CREATE acknowledgement remains unknown: no name-only cleanup is ever authorized.
    await this.admin.query('CREATE DATABASE "' + this.database + '"'); this.creationAcknowledged = true;
    await durableJson(this.prefix + '.create-ack.json', { database: this.database, creationAcknowledged: true }, 8192);
    this.requireWork();
    await this.admin.query('COMMENT ON DATABASE "' + this.database + '" IS \'' + this.marker + '\'');
    this.requireWork();
    this.identity = (await this.admin.query<DatabaseIdentity>('SELECT oid::text AS oid,pg_get_userbyid(datdba) AS owner,shobj_description(oid,\'pg_database\') AS marker FROM pg_database WHERE datname=$1', [this.database])).rows[0];
    if (!acceptableIdentity(true, this.identity, { oid: this.identity?.oid ?? '', owner, marker: this.marker })) throw new Error('DATABASE_IDENTITY');
    await durableJson(this.prefix + '.database-identity.json', { database: this.database, identity: this.identity }, 8192);
    this.creationReceiptSaved = true;
    const url = new URL(this.adminUrl); url.pathname = '/' + this.database;
    // Startup needs its migration budget, rather than applying the measurement statement limit to DDL.
    url.searchParams.set('application_name', 'k01-query-center-and-boss');
    this.auxiliary = new Pool({ connectionString: url.href, max: 6, connectionTimeoutMillis: 1000, statement_timeout: 1500, lock_timeout: 500, query_timeout: 1800, application_name: 'k01-query-auxiliary' });
    this.auxiliary.on('error', error => { this.healthy = false; this.facts.auxiliaryError = errorFact(error); });
    const { createServer } = await import('./source/apps/server/src/index.js');
    this.requireWork(); this.startupAttempted = true; this.startupSettled = false;
    const startup = this.startup = createServer({ databaseUrl: url.href, ownerToken: this.marker, automaticQueueScan: false, leaseMs: 300000 }).then(app => { this.app = app; this.startupSettled = true; return app; }, error => { this.startupSettled = true; throw error; });
    await this.bounded(() => startup, this.workUntil);
    return this.bounded(() => this.app!.listen({ host: '127.0.0.1', port: 0 }), this.workUntil);
  }
  async close() {
    const errors: unknown[] = [];
    let appClosed = !this.startupAttempted, auxiliaryClosed = !this.auxiliary, absent = !this.creationAttempted;
    if (this.startup && !this.startupSettled) {
      try { await this.bounded(() => this.startup!, this.cleanupUntil); } catch (error) { errors.push(errorFact(error)); }
    }
    try {
      if (this.app) { await this.bounded(() => this.app!.close(), this.cleanupUntil); appClosed = true; }
    } catch (error) { errors.push(errorFact(error)); }
    try { if (this.auxiliary) { await this.bounded(() => this.auxiliary!.end(), this.cleanupUntil); auxiliaryClosed = true; } }
    catch (error) { errors.push(errorFact(error)); }
    try {
      if (this.creationAttempted) {
        if (!this.startupSettled || !appClosed || !auxiliaryClosed || !this.healthy || !this.creationAcknowledged || !this.creationReceiptSaved || !this.identity) throw new Error('DATABASE_KEEP_UNKNOWN');
        remainingMs(this.cleanupUntil, Date.now(), 1500);
        const actual = (await this.admin.query<DatabaseIdentity>('SELECT oid::text AS oid,pg_get_userbyid(datdba) AS owner,shobj_description(oid,\'pg_database\') AS marker FROM pg_database WHERE datname=$1', [this.database])).rows[0];
        if (!acceptableIdentity(this.creationAcknowledged, this.identity, actual)) throw new Error('DATABASE_KEEP_IDENTITY');
        let connections = -1;
        const connectionObservations = [];
        for (let i = 0; connections !== 0 && i < 20; i++) {
          remainingMs(this.cleanupUntil - 2000, Date.now(), 1500);
          connections = Number((await this.admin.query('SELECT count(*) AS n FROM pg_stat_activity WHERE datname=$1', [this.database])).rows[0].n);
          connectionObservations.push({ at: new Date().toISOString(), connections });
          if (connections) await delay(100);
        }
        this.facts.connectionObservations = connectionObservations;
        if (connections !== 0) throw new Error('DATABASE_KEEP_CONNECTIONS');
        const beforeDrop = (await this.admin.query<DatabaseIdentity>('SELECT oid::text AS oid,pg_get_userbyid(datdba) AS owner,shobj_description(oid,\'pg_database\') AS marker FROM pg_database WHERE datname=$1', [this.database])).rows[0];
        if (!acceptableIdentity(true, this.identity, beforeDrop)) throw new Error('DATABASE_KEEP_IDENTITY');
        remainingMs(this.cleanupUntil - 1800, Date.now(), 1500);
        this.facts.connectionsBeforeDrop = connections;
        await this.admin.query('DROP DATABASE "' + this.database + '"');
        absent = (await this.admin.query('SELECT 1 FROM pg_database WHERE datname=$1', [this.database])).rowCount === 0;
      }
    } catch (error) { errors.push(errorFact(error)); }
    let adminClosed = false;
    try { await this.bounded(() => this.admin.end(), this.cleanupUntil); adminClosed = true; } catch (error) { errors.push(errorFact(error)); }
    return { database: this.database, identity: this.identity ?? null, creationAcknowledged: this.creationAcknowledged, creationReceiptSaved: this.creationReceiptSaved, startupAttempted: this.startupAttempted, startupSettled: this.startupSettled,
      appClosed, auxiliaryClosed, adminClosed, absent, errors, retainedDatabase: absent ? null : this.database };
  }
}
