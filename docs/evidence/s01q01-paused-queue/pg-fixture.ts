import { randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, mkdir, open, realpath } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { Pool } from 'pg';
import { PgBoss } from 'pg-boss';

type Identity = { oid: string; owner: string; marker: string | null };
/** Test-only adaptation of fixed X01 marked ownership; never owns an existing DB. */
export class QueueDatabaseFixture {
  readonly name = `flow_s01q01_${randomUUID().replaceAll('-', '')}`;
  readonly marker = `s01q01:${randomUUID()}`;
  readonly url: URL;
  readonly admin: Pool;
  readonly pool: Pool;
  readonly boss: PgBoss;
  private readonly root: string;
  private readonly directory: { dev: number; ino: number };
  private readonly workUntil: number;
  private readonly cleanupUntil: number;
  private pending = new Set<Promise<unknown>>();
  private closing = false;
  private receipt = 0;
  private httpCount = 0;
  private firstFailure: { phase: string; name: string; code?: string } | undefined;
  private created = false;
  private requested = false;
  private identity?: Identity;
  private durableIdentity = false;
  private readonly servers = new Map<FastifyInstance, { controller: AbortController; listening?: Promise<string>; settled: boolean; closed: boolean }>();
  private extraPools = new Set<Pool>();
  private constructor(root: string, directory: { dev: number; ino: number }, adminUrl: string, start: number) {
    this.root = root; this.directory = directory; this.workUntil = start + 70_000; this.cleanupUntil = start + 110_000;
    this.url = new URL(adminUrl); this.url.pathname = `/${this.name}`;
    this.admin = new Pool({ connectionString: adminUrl, max: 1, connectionTimeoutMillis: 1000, statement_timeout: 1500, query_timeout: 1800 });
    this.pool = this.makePool(10);
    this.boss = new PgBoss({ connectionString: this.url.href, max: 2 });
    this.admin.on('error', error => this.failure('admin-idle', error));
    this.boss.on('error', error => this.failure('boss-background', error));
  }
  static async prepare() {
    if (process.env.FLOW_S01Q01_PG_OPEN !== 'reviewed') throw new Error('S01Q01_PG_NOT_OPEN');
    const root = process.env.FLOW_S01Q01_RECORD_ROOT ?? '', start = Number(process.env.FLOW_S01Q01_START_MS);
    const adminInput = process.env.FLOW_S01Q01_TEST_ADMIN ?? 'postgresql://flow:flow-local-only@127.0.0.1:55432/postgres';
    let url: URL; try { url = new URL(adminInput); } catch { throw new Error('LOCAL_ADMIN_REQUIRED'); }
    if (!['postgres:', 'postgresql:'].includes(url.protocol) || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)
      || url.pathname !== '/postgres' || url.search || adminInput.includes('#')) throw new Error('LOCAL_ADMIN_REQUIRED');
    if (!/^[a-f0-9]{40}$/.test(process.env.FLOW_S01Q01_PG_HEAD ?? '') || !/^[a-f0-9]{32}$/.test(process.env.FLOW_S01Q01_PG_WINDOW ?? '')
      || !isAbsolute(root) || await realpath(root) !== root || !(await lstat(root)).isDirectory() || !Number.isSafeInteger(start) || start > Date.now() || Date.now() - start > 10_000) throw new Error('OWNED_WINDOW_REQUIRED');
    const path = join(root, 'queue'); await mkdir(path, { mode: 0o700 });
    const stat = await lstat(path); const fixture = new QueueDatabaseFixture(path, { dev: stat.dev, ino: stat.ino }, url.href, start);
    await fixture.save('reserved', { database: fixture.name, directory: fixture.directory, start }); return fixture;
  }
  checkWork() { if (this.closing || Date.now() >= this.workUntil) throw new Error('S01Q01_WORK_DEADLINE'); }
  private failure(phase: string, error: unknown) {
    this.firstFailure ??= { phase, name: error instanceof Error ? error.name : 'UnknownError',
      code: typeof (error as { code?: unknown })?.code === 'string' ? (error as { code: string }).code : undefined };
  }
  private async within<T>(operation: Promise<T>, deadline: number): Promise<T> {
    let timer: NodeJS.Timeout | undefined;
    try { return await Promise.race([operation, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('S01Q01_DEADLINE')), Math.max(1, deadline - Date.now())); })]); }
    finally { clearTimeout(timer); }
  }
  async work<T>(phase: string, action: () => Promise<T>): Promise<T> {
    this.checkWork(); await this.save(phase, {}); this.checkWork();
    const pending = Promise.resolve().then(() => { this.checkWork(); return action(); });
    this.pending.add(pending); pending.then(() => this.pending.delete(pending), () => this.pending.delete(pending));
    try { return await this.within(pending, this.workUntil); } catch (error) { this.failure(phase, error); throw error; }
  }
  private makePool(max: number) {
    const pool = new Pool({ connectionString: this.url.href, max, connectionTimeoutMillis: 1000, statement_timeout: 1500, query_timeout: 1800 });
    pool.on('error', error => this.failure('aux-idle', error)); return pool;
  }
  additionalPool() { this.checkWork(); const pool = this.makePool(2); this.extraPools.add(pool); return pool; }
  async fetch(url: string, options: RequestInit = {}) {
    this.checkWork(); if (++this.httpCount > 256) throw new Error('HTTP_COUNT_LIMIT');
    const deadline = AbortSignal.timeout(Math.max(1, Math.min(8000, this.workUntil - Date.now())));
    return fetch(url, { ...options, signal: options.signal ? AbortSignal.any([options.signal, deadline]) : deadline });
  }
  private async save(phase: string, facts: unknown) {
    const stat = await lstat(this.root);
    if (!stat.isDirectory() || stat.isSymbolicLink() || stat.dev !== this.directory.dev || stat.ino !== this.directory.ino || await realpath(this.root) !== this.root) throw new Error('RECORD_IDENTITY');
    const bytes = Buffer.from(JSON.stringify({ at: new Date().toISOString(), phase, facts }) + '\n');
    if (++this.receipt > 64 || bytes.length > 16 * 1024) throw new Error('RECEIPT_LIMIT');
    const file = await open(join(this.root, `${this.receipt.toString().padStart(2, '0')}-${phase}.json`), constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW, 0o600);
    try { await file.writeFile(bytes); await file.sync(); } finally { await file.close(); }
    const directory = await open(this.root, constants.O_RDONLY | constants.O_NOFOLLOW);
    try { await directory.sync(); } finally { await directory.close(); }
  }
  private async readIdentity() { return (await this.admin.query<Identity>(`SELECT oid::text,pg_get_userbyid(datdba) AS owner,shobj_description(oid,'pg_database') AS marker FROM pg_database WHERE datname=$1`, [this.name])).rows[0]; }
  private matches(value?: Identity) { return !!value && !!this.identity && value.oid === this.identity.oid && value.owner === this.identity.owner && value.marker === this.identity.marker; }
  async create() {
    await this.work('create', async () => {
      if (await this.readIdentity()) throw new Error('DATABASE_EXISTS');
      const owner = (await this.admin.query('SELECT current_user AS owner')).rows[0].owner as string;
      await this.save('create-requested', { database: this.name, owner, marker: this.marker }); this.requested = true;
      this.checkWork(); await this.admin.query(`CREATE DATABASE ${this.name}`); this.created = true;
      const first = await this.readIdentity(); if (!first || first.owner !== owner) throw new Error('CREATE_IDENTITY_UNKNOWN');
      this.checkWork(); await this.admin.query(`COMMENT ON DATABASE ${this.name} IS '${this.marker}'`);
      const marked = await this.readIdentity(); if (!marked || marked.oid !== first.oid || marked.owner !== owner || marked.marker !== this.marker) throw new Error('MARKER_UNKNOWN');
      this.checkWork(); this.identity = marked; await this.save('created', { database: this.name, identity: marked }); this.durableIdentity = true;
    });
    await this.work('fixture-boss-start', () => this.boss.start());
  }
  async startServer(factory: () => Promise<FastifyInstance>) {
    return this.work('factory-start', async () => {
      const server = await factory(); this.servers.set(server, { controller: new AbortController(), settled: true, closed: false }); return server;
    });
  }
  async listen(server: FastifyInstance) {
    const state = this.servers.get(server); if (!state) throw new Error('SERVER_IDENTITY');
    return this.work('listen', async () => {
      state.settled = false; state.listening = server.listen({ host: '127.0.0.1', port: 0, signal: state.controller.signal });
      try { return await state.listening; } finally { state.settled = true; }
    });
  }
  async closeServer(server: FastifyInstance) {
    const state = this.servers.get(server); if (!state) throw new Error('SERVER_IDENTITY');
    if (state.closed) return;
    state.controller.abort(); if (state.listening && !state.settled) await this.within(state.listening.catch(() => undefined), this.cleanupUntil);
    if (!state.settled) throw new Error('LISTEN_UNKNOWN');
    await this.within(server.close(), this.cleanupUntil); if (server.server.listening) throw new Error('LISTENER_REMAINS'); state.closed = true;
  }
  async finish() {
    this.closing = true; const errors: string[] = []; let absent = false, auxClosed = false, bossClosed = false, adminClosed = false, connections: number | null = null;
    const close = async (label: string, action: () => Promise<unknown>) => { try { if (Date.now() >= this.cleanupUntil) throw new Error('CLEANUP_DEADLINE'); await this.within(action(), this.cleanupUntil); return true; } catch (error) { this.failure(label, error); errors.push(label); return false; } };
    for (const state of this.servers.values()) state.controller.abort();
    await close('pending-settlement', () => Promise.allSettled([...this.pending]));
    for (const server of this.servers.keys()) await close('server-close', () => this.closeServer(server));
    bossClosed = await close('boss-close', () => this.boss.stop({ graceful: true, timeout: 5000 }));
    for (const pool of this.extraPools) await close('extra-pool-close', () => pool.end());
    auxClosed = await close('aux-close', () => this.pool.end());
    try {
      const ownersClosed = this.pending.size === 0 && [...this.servers.values()].every(s => s.closed && s.settled) && bossClosed && auxClosed && errors.length === 0;
      if (this.created && this.durableIdentity && ownersClosed) {
        for (let i = 0; i < 20 && Date.now() + 5000 < this.cleanupUntil; i++) {
          if (!this.matches(await this.within(this.readIdentity(), this.cleanupUntil))) throw new Error('DATABASE_IDENTITY_CHANGED');
          connections = Number((await this.within(this.admin.query('SELECT count(*) FROM pg_stat_activity WHERE datname=$1', [this.name]), this.cleanupUntil)).rows[0].count);
          if (!connections) break; await new Promise(resolve => setTimeout(resolve, 100));
        }
        if (connections === 0 && Date.now() + 3000 < this.cleanupUntil && this.matches(await this.within(this.readIdentity(), this.cleanupUntil))) {
          await this.within(this.admin.query(`DROP DATABASE ${this.name}`), this.cleanupUntil); absent = !(await this.within(this.readIdentity(), this.cleanupUntil));
        }
      }
    } catch (error) { this.failure('database-cleanup', error); errors.push('database-cleanup'); }
    finally { adminClosed = await close('admin-close', () => this.admin.end()); }
    const cleanupConfirmed = !this.pending.size && adminClosed && auxClosed && bossClosed && !errors.length && (!this.requested || absent);
    await this.save('cleanup', { database: this.name, identity: this.identity, requested: this.requested, created: this.created, durableIdentity: this.durableIdentity,
      connections, absent, cleanupConfirmed, errors, firstFailure: this.firstFailure, state: cleanupConfirmed ? 'CLOSED' : 'KEEP' });
    if (!cleanupConfirmed) throw new Error('S01Q01_CLEANUP_UNKNOWN_KEEP');
  }
}
