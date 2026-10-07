import { randomUUID } from 'node:crypto';
import { open } from 'node:fs/promises';
import { dirname } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { Pool } from 'pg';
import type { FastifyInstance } from 'fastify';
import { localAdminUrl, type StorageBudget } from './budget.js';
import { acceptableIdentity, remainingMs, type DatabaseIdentity } from './corpus.js';

export async function durableJson(path: string, value: unknown, maxBytes = 2 * 1024 * 1024, budget?: StorageBudget) {
  const bytes = Buffer.from(JSON.stringify(value, null, 2) + '\n');
  if (bytes.length > maxBytes) throw new Error('RECEIPT_LIMIT');
  budget?.write(bytes.length);
  const file = await open(path, 'wx', 0o600);
  try { await file.writeFile(bytes); await file.sync(); } finally { await file.close(); }
  const directory = await open(dirname(path), 'r');
  try { await directory.sync(); } finally { await directory.close(); }
}
export function errorFact(error: unknown) {
  const e = error as { name?: string; code?: string };
  return { type: e?.name ?? 'UnknownError', code: e?.code ?? (error instanceof Error && /^[A-Z_]+$/.test(error.message) ? error.message : 'EXPERIMENT_FAILED') };
}
/** Tracks the one owned listen promise independently of factory startup. No sockets are created here. */
export class ListenLifecycle {
  readonly controller = new AbortController();
  attempted = false;
  settled = true;
  pending?: Promise<string>;
  start(action: (signal: AbortSignal) => Promise<string>): Promise<string> {
    if (this.attempted) throw new Error('LISTEN_ALREADY_ATTEMPTED');
    this.attempted = true; this.settled = false;
    this.pending = Promise.resolve().then(() => action(this.controller.signal)).then(
      value => { this.settled = true; return value; }, error => { this.settled = true; throw error; });
    return this.pending;
  }
  cancel() { this.controller.abort(); }
}
/** One import followed by one factory. A timed-out import can never trigger a late factory. */
export class StartupLifecycle<T> {
  loading?: Promise<() => Promise<T>>;
  pending?: Promise<T>;
  loadSettled = true;
  settled = true;
  attempted = false;
  closing = false;
  value?: T;
  async start(load: () => Promise<() => Promise<T>>, wait: <V>(pending: Promise<V>) => Promise<V>, guard: () => void) {
    if (this.loading || this.closing) throw new Error('STARTUP_ALREADY_ATTEMPTED');
    guard(); this.loadSettled = false;
    this.loading = Promise.resolve().then(load).then(value => { this.loadSettled = true; return value; }, error => { this.loadSettled = true; throw error; });
    const create = await wait(this.loading);
    if (this.closing) throw new Error('STARTUP_CLOSING');
    guard(); this.attempted = true; this.settled = false;
    this.pending = Promise.resolve().then(() => {
      if (this.closing) throw new Error('STARTUP_CLOSING');
      guard(); return create();
    }).then(value => { this.value = value; this.settled = true; return value; }, error => { this.settled = true; throw error; });
    return wait(this.pending);
  }
  async settle(wait: <V>(pending: Promise<V>) => Promise<V>) {
    this.closing = true; const errors: unknown[] = [];
    if (this.loading && !this.loadSettled) try { await wait(this.loading); } catch (error) { errors.push(error); }
    if (this.pending && !this.settled) try { await wait(this.pending); } catch (error) { errors.push(error); }
    return errors;
  }
}
export class OwnedDatabase {
  readonly database = 'flow_k01_query_' + randomUUID().replaceAll('-', '');
  readonly marker = randomUUID();
  readonly listener = new ListenLifecycle();
  readonly admin: Pool;
  auxiliary?: Pool;
  readonly startupOwner = new StartupLifecycle<FastifyInstance>();
  get app() { return this.startupOwner.value; }
  identity?: DatabaseIdentity;
  creationAcknowledged = false;
  creationReceiptSaved = false;
  creationAttempted = false;
  healthy = true;
  readonly facts: Record<string, unknown> = { configuredConnections: { admin: 1, auxiliary: 6, business: 8, pgBoss: 3, total: 18 }, observedPeak: 'unknown' };
  constructor(readonly adminUrl: string, readonly prefix: string, readonly start: number, readonly budget?: StorageBudget, readonly checkpoint: (phase: string, data?: unknown) => Promise<void> = async () => {}) {
    localAdminUrl(adminUrl);
    this.admin = new Pool({ connectionString: adminUrl, max: 1, connectionTimeoutMillis: 1000, statement_timeout: 1500, lock_timeout: 500, query_timeout: 1800, application_name: 'k01-query-admin' });
    this.admin.on('error', error => { this.healthy = false; this.facts.adminError = errorFact(error); });
  }
  get workUntil() { return this.start + 70_000; }
  get cleanupUntil() { return this.start + 110_000; }
  requireWork() { this.budget?.work(); if (!this.healthy) throw new Error('POOL_UNKNOWN'); const left = remainingMs(this.workUntil, Date.now(), 70_000); if (left < 2000) throw new Error('WORK_QUERY_RESERVE'); return Math.min(left, 1500); }
  async bounded<T>(action: () => Promise<T>, until: number): Promise<T> {
    const timeout = remainingMs(until, Date.now(), 110_000);
    let timer: ReturnType<typeof setTimeout> | undefined;
    try { return await Promise.race([action(), new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('DEADLINE_UNKNOWN')), timeout); })]); }
    finally { clearTimeout(timer); }
  }
  async open() {
    await this.checkpoint('database-open');
    this.requireWork();
    const version = Number((await this.admin.query("SELECT current_setting('server_version_num') AS version")).rows[0].version);
    if (version < 160000 || version >= 170000) throw new Error('POSTGRES_VERSION');
    this.requireWork();
    if ((await this.admin.query('SELECT 1 FROM pg_database WHERE datname=$1', [this.database])).rowCount) throw new Error('DATABASE_EXISTS');
    this.requireWork();
    const owner = (await this.admin.query<{ owner: string }>('SELECT current_user AS owner')).rows[0]!.owner;
    await durableJson(this.prefix + '.database-reservation.json', { database: this.database, marker: this.marker, owner, createdAt: new Date().toISOString() }, 8192, this.budget);
    this.requireWork(); this.creationAttempted = true;
    // Lost CREATE acknowledgement remains unknown: no name-only cleanup is ever authorized.
    await this.admin.query('CREATE DATABASE "' + this.database + '"'); this.creationAcknowledged = true;
    await durableJson(this.prefix + '.create-ack.json', { database: this.database, creationAcknowledged: true }, 8192, this.budget);
    this.requireWork();
    await this.admin.query('COMMENT ON DATABASE "' + this.database + '" IS \'' + this.marker + '\'');
    this.requireWork();
    this.identity = (await this.admin.query<DatabaseIdentity>('SELECT oid::text AS oid,pg_get_userbyid(datdba) AS owner,shobj_description(oid,\'pg_database\') AS marker FROM pg_database WHERE datname=$1', [this.database])).rows[0];
    if (!acceptableIdentity(true, this.identity, { oid: this.identity?.oid ?? '', owner, marker: this.marker })) throw new Error('DATABASE_IDENTITY');
    await durableJson(this.prefix + '.database-identity.json', { database: this.database, identity: this.identity }, 8192, this.budget);
    this.creationReceiptSaved = true;
    await this.checkpoint('database-identity-saved', { database: this.database, identity: this.identity });
    const url = new URL(this.adminUrl); url.pathname = '/' + this.database;
    // Startup needs its migration budget, rather than applying the measurement statement limit to DDL.
    url.searchParams.set('application_name', 'k01-query-center-and-boss');
    this.auxiliary = new Pool({ connectionString: url.href, max: 6, connectionTimeoutMillis: 1000, statement_timeout: 1500, lock_timeout: 500, query_timeout: 1800, application_name: 'k01-query-auxiliary' });
    this.auxiliary.on('error', error => { this.healthy = false; this.facts.auxiliaryError = errorFact(error); });
    await this.checkpoint('module-loading');
    await this.startupOwner.start(async () => {
      const { createServer } = await import('./source/apps/server/src/index.js');
      return async () => {
        await this.checkpoint('factory-starting');
        this.requireWork(); // A late diagnostic write must not start the factory after the work deadline.
        return createServer({ databaseUrl: url.href, ownerToken: this.marker, automaticQueueScan: false, leaseMs: 300000 });
      };
    }, pending => this.bounded(() => pending, this.workUntil), () => { this.requireWork(); });
    await this.checkpoint('factory-ready');
    this.requireWork();
    const address = await this.bounded(() => this.listener.start(signal => this.app!.listen({ host: '127.0.0.1', port: 0, signal })), this.workUntil);
    await this.checkpoint('listener-ready'); return address;
  }
  async close() {
    const errors: unknown[] = [];
    this.listener.cancel();
    errors.push(...(await this.startupOwner.settle(pending => this.bounded(() => pending, this.cleanupUntil))).map(errorFact));
    let appClosed = !this.startupOwner.attempted, auxiliaryClosed = !this.auxiliary, absent = !this.creationAttempted;
    if (this.listener.pending && !this.listener.settled) {
      try { await this.bounded(() => this.listener.pending!, this.cleanupUntil); } catch (error) { errors.push(errorFact(error)); }
    }
    try {
      if (!this.listener.settled) throw new Error('LISTEN_SETTLEMENT_UNKNOWN');
      if (this.app) { await this.bounded(() => this.app!.close(), this.cleanupUntil);
        if (this.app.server.listening) throw new Error('LISTENER_STILL_OPEN');
        appClosed = true; }
    } catch (error) { errors.push(errorFact(error)); }
    try { if (this.auxiliary) { await this.bounded(() => this.auxiliary!.end(), this.cleanupUntil); auxiliaryClosed = true; } }
    catch (error) { errors.push(errorFact(error)); }
    try {
      if (this.creationAttempted) {
        if (!this.startupOwner.loadSettled || !this.startupOwner.settled || !this.listener.settled || !appClosed || !auxiliaryClosed || !this.healthy || !this.creationAcknowledged || !this.creationReceiptSaved || !this.identity) throw new Error('DATABASE_KEEP_UNKNOWN');
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
    return { database: this.database, identity: this.identity ?? null, creationAcknowledged: this.creationAcknowledged, creationReceiptSaved: this.creationReceiptSaved, moduleLoadSettled: this.startupOwner.loadSettled, startupAttempted: this.startupOwner.attempted, startupSettled: this.startupOwner.settled,
      listenAttempted: this.listener.attempted, listenSettled: this.listener.settled, serverListening: this.app?.server.listening ?? null,
      appClosed, auxiliaryClosed, adminClosed, absent, errors, retainedDatabase: absent ? null : this.database };
  }
}
