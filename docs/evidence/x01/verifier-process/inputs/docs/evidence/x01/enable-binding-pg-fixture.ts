import { randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, mkdir, open, readFile, realpath } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import { Pool } from 'pg';

type DatabaseIdentity = { oid: string; owner: string; marker: string | null };
type DirectoryIdentity = { dev: bigint; ino: bigint };
type OwnersClosed = { startup: boolean; server: boolean; boss?: boolean };

/** Test-only ownership for the two X01 PG suites; never deletes an unconfirmed database. */
export class PluginDatabaseFixture {
  readonly database = `flow_x01_${randomUUID().replaceAll('-', '')}`;
  readonly databaseUrl = `postgresql://flow:flow-local-only@127.0.0.1:55432/${this.database}`;
  readonly pool: Pool;
  private readonly admin = new Pool({ connectionString: 'postgresql://flow:flow-local-only@127.0.0.1:55432/postgres',
    max: 1, connectionTimeoutMillis: 1500, statement_timeout: 3000, query_timeout: 3500 });
  private window = '';
  private sourceHead = '';
  private directory: string | undefined;
  private directoryIdentity: DirectoryIdentity | undefined;
  private identity: DatabaseIdentity | undefined;
  private createRequested = false;
  private createAcknowledged = false;
  private creationReceiptSaved = false;
  private finished = false;
  private errorCount = 0;
  private workUntil = 0;
  private cleanupUntil = 0;
  private httpRequests = 0;
  private responseBytes = 0;
  private requestLimit = 0;
  private startup: Promise<void> | undefined;
  private startupSettled = true;
  private readonly listeners: { origin: string; closed: boolean }[] = [];

  checkWork() {
    if (!this.workUntil || Date.now() >= this.workUntil) throw new Error('X01 common work deadline reached');
  }

  private async within<T>(promise: Promise<T>, deadline: number): Promise<T> {
    let timer: NodeJS.Timeout | undefined;
    try {
      return await Promise.race([promise, new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('X01 common resource deadline reached')), Math.max(1, deadline - Date.now()));
      })]);
    } finally { clearTimeout(timer); }
  }

  async start(action: () => Promise<void>) {
    this.checkWork();
    if (!this.startupSettled) throw new Error('X01 prior startup is unsettled');
    this.startupSettled = false;
    this.startup = action().finally(() => { this.startupSettled = true; });
    await this.within(this.startup, this.workUntil);
  }

  async settleStartup() {
    if (!this.startupSettled && this.startup) {
      try { await this.within(this.startup, this.cleanupUntil); } catch (error) { this.recordError('startup-settlement', error); }
    }
    return this.startupSettled;
  }

  listener(origin: string) { this.checkWork(); this.listeners.push({ origin, closed: false }); }
  listenerClosed(origin: string) {
    const listener = this.listeners.findLast(item => item.origin === origin && !item.closed);
    if (!listener) throw new Error('X01 listener identity unknown');
    listener.closed = true;
  }

  async close(operation: string, action: () => Promise<unknown>) {
    try {
      if (Date.now() >= this.cleanupUntil) throw new Error('X01 cleanup deadline reached');
      await this.within(action(), this.cleanupUntil); return true;
    } catch (error) { this.recordError(operation, error); return false; }
  }

  async request(url: string, options: RequestInit) {
    this.checkWork();
    if (this.httpRequests >= this.requestLimit) throw new Error('X01 HTTP count limit reached');
    this.httpRequests++;
    const response = await fetch(url, { ...options, signal: AbortSignal.timeout(Math.max(1, Math.min(8000, this.workUntil - Date.now()))) });
    const reader = response.body?.getReader();
    if (!reader) throw new Error('X01 HTTP response missing');
    const chunks: Uint8Array[] = []; let bytes = 0;
    try {
      while (true) {
        this.checkWork();
        const chunk = await reader.read(); if (chunk.done) break;
        bytes += chunk.value.byteLength; this.responseBytes += chunk.value.byteLength;
        if (bytes > 131072 || this.responseBytes > 4194304) {
          await reader.cancel(); throw new Error('X01 HTTP response byte limit reached');
        }
        chunks.push(chunk.value);
      }
    } finally { reader.releaseLock(); }
    const raw = Buffer.concat(chunks).toString('utf8');
    return { status: response.status, body: JSON.parse(raw), bytes: Buffer.byteLength(raw), raw, headers: response.headers };
  }

  private async assertPriorSuiteClosed(root: string) {
    const prior = join(root, this.suite === 'runtime' ? 'registry' : 'runtime');
    try { await lstat(prior); } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
      throw error;
    }
    const receipt = JSON.parse(await readFile(join(prior, 'result.json'), 'utf8')) as {
      window: string; sourceHead: string; cleanupConfirmed: boolean; retainedDatabase: string | null;
    };
    if (receipt.window !== this.window || receipt.sourceHead !== this.sourceHead || receipt.cleanupConfirmed !== true
      || receipt.retainedDatabase !== null) throw new Error('X01 prior suite resources unresolved');
  }

  private readonly errors: { operation: string; name: string; code: string | null }[] = [];

  constructor(private readonly suite: 'runtime' | 'registry', max: number) {
    this.pool = new Pool({ connectionString: this.databaseUrl, max, application_name: 'flow-x01-binding',
      connectionTimeoutMillis: 1500, statement_timeout: 4000, query_timeout: 4500 });
    this.pool.on('error', error => this.recordError('pool-idle', error));
    this.admin.on('error', error => this.recordError('admin-idle', error));
  }

  private recordError(operation: string, error: unknown) {
    this.errorCount++;
    const value = error instanceof Error ? error : undefined;
    const code = value && 'code' in value ? value.code : null;
    if (this.errors.length < 16) this.errors.push({ operation, name: (value?.name ?? 'UnknownError').slice(0, 128),
      code: typeof code === 'string' ? code.slice(0, 128) : null });
  }

  private async assertDirectory() {
    if (!this.directory || !this.directoryIdentity) throw new Error('X01 fixture directory identity unknown');
    const current = await lstat(this.directory, { bigint: true });
    if (!current.isDirectory() || current.dev !== this.directoryIdentity.dev || current.ino !== this.directoryIdentity.ino
      || await realpath(this.directory) !== this.directory) throw new Error('X01 fixture directory changed');
  }

  private async save(name: string, value: Record<string, unknown>) {
    await this.assertDirectory();
    const bytes = Buffer.from(JSON.stringify({ window: this.window, sourceHead: this.sourceHead, suite: this.suite, database: this.database,
      ...value }, null, 2) + '\n');
    if (bytes.length > 16384) throw new Error('X01 fixture receipt exceeds 16 KiB');
    const handle = await open(join(this.directory!, name), constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
    let failure: unknown;
    try { await handle.writeFile(bytes); await handle.sync(); } catch (error) { failure = error; }
    try { await handle.close(); } catch (error) { failure ??= error; }
    if (failure) throw failure;
    await this.assertDirectory();
    const directory = await open(this.directory!, constants.O_RDONLY | constants.O_NOFOLLOW);
    let syncFailure: unknown;
    try {
      const opened = await directory.stat({ bigint: true });
      if (!opened.isDirectory() || opened.dev !== this.directoryIdentity!.dev || opened.ino !== this.directoryIdentity!.ino)
        throw new Error('X01 fixture directory handle changed');
      await directory.sync();
    } catch (error) { syncFailure = error; }
    try { await directory.close(); } catch (error) { syncFailure ??= error; }
    if (syncFailure) throw syncFailure;
  }

  private async readIdentity(): Promise<DatabaseIdentity | undefined> {
    return (await this.admin.query<DatabaseIdentity>(`SELECT oid::text AS oid, pg_get_userbyid(datdba) AS owner,
      shobj_description(oid, 'pg_database') AS marker FROM pg_database WHERE datname=$1`, [this.database])).rows[0];
  }

  async create() {
    try {
      this.window = process.env.FLOW_X01_PG_WINDOW ?? '';
      this.sourceHead = process.env.FLOW_X01_PG_HEAD ?? '';
      const root = process.env.FLOW_X01_PG_ROOT;
      const input = JSON.parse(await readFile(new URL('./enable-binding-pg-input.json', import.meta.url), 'utf8')) as {
        protocol: string; totalSeconds: number; suites: Record<'runtime' | 'registry', { httpRequests: number }>;
      };
      this.workUntil = Number(process.env.FLOW_X01_PG_WORK_UNTIL);
      this.cleanupUntil = Number(process.env.FLOW_X01_PG_CLEANUP_UNTIL);
      if (input.protocol !== 'flow.x01.stage-c.v1' || input.totalSeconds !== 180
        || !Number.isSafeInteger(this.workUntil) || !Number.isSafeInteger(this.cleanupUntil)
        || this.workUntil <= Date.now() || this.cleanupUntil <= this.workUntil || this.cleanupUntil - Date.now() > 180000)
        throw new Error('X01 fixed common deadlines required');
      this.requestLimit = input.suites[this.suite].httpRequests;
      if (this.requestLimit !== (this.suite === 'runtime' ? 256 : 160)) throw new Error('X01 fixed HTTP partition required');
      if (!/^[a-f0-9]{32}$/.test(this.window) || !/^[a-f0-9]{40}$/.test(this.sourceHead) || !root || !isAbsolute(root) || await realpath(root) !== root
        || !(await lstat(root)).isDirectory()) throw new Error('X01 PG requires an owned root and window');
      await this.assertPriorSuiteClosed(root);
      this.checkWork();
      const directory = join(root, this.suite);
      await mkdir(directory, { mode: 0o700 });
      this.directory = directory;
      const stat = await lstat(directory, { bigint: true });
      this.directoryIdentity = { dev: stat.dev, ino: stat.ino };
      await this.save('reservation.json', { pid: process.pid, directory, dev: stat.dev.toString(), ino: stat.ino.toString(),
        reservedAt: new Date().toISOString(), providerCalls: 0, nativeCalls: 0 });
      if (await this.readIdentity()) throw new Error('X01 random database already exists');
      const owner = (await this.admin.query<{ owner: string }>('SELECT current_user AS owner')).rows[0]!.owner;
      const marker = `x01:${this.window}:${this.suite}:${randomUUID()}`;
      await this.save('create-request.json', { owner, marker, requestedAt: new Date().toISOString() });
      this.createRequested = true;
      this.checkWork();
      await this.admin.query(`CREATE DATABASE ${this.database}`);
      this.createAcknowledged = true;
      const created = await this.readIdentity();
      if (!created || created.owner !== owner) throw new Error('X01 created database identity unknown');
      // Only generated alphanumeric/colon/hyphen marker characters enter this literal.
      await this.admin.query(`COMMENT ON DATABASE ${this.database} IS '${marker}'`);
      const confirmed = await this.readIdentity();
      if (!confirmed || confirmed.oid !== created.oid || confirmed.owner !== owner || confirmed.marker !== marker)
        throw new Error('X01 created database marker unknown');
      this.identity = confirmed;
      await this.save('created.json', { identity: confirmed, acknowledgedAt: new Date().toISOString() });
      this.creationReceiptSaved = true;
    } catch (error) { this.recordError('create', error); throw error; }
  }

  async finish(owners: OwnersClosed, facts: readonly unknown[] = []) {
    if (this.finished) throw new Error('X01 fixture cleanup already attempted');
    this.finished = true;
    const cleanup = { owners, ownersClosed: Object.values(owners).every(value => value === true), poolClosed: false, adminClosed: false,
      createRequested: this.createRequested, createAcknowledged: this.createAcknowledged, creationReceiptSaved: this.creationReceiptSaved,
      identity: this.identity ?? null, identityConfirmed: false, connections: null as number | null,
      dropRequested: false, dropAcknowledged: false, databaseAbsent: null as boolean | null };
    cleanup.poolClosed = await this.close('pool-close', () => this.pool.end());
    try {
      if (this.createRequested && Date.now() < this.cleanupUntil) {
        const current = await this.within(this.readIdentity(), this.cleanupUntil);
        cleanup.identityConfirmed = this.creationReceiptSaved && !!current && !!this.identity
          && current.oid === this.identity.oid && current.owner === this.identity.owner && current.marker === this.identity.marker;
        if (cleanup.identityConfirmed) {
          cleanup.connections = Number((await this.within(this.admin.query<{ count: string }>(
            'SELECT count(*) FROM pg_stat_activity WHERE datname=$1', [this.database]), this.cleanupUntil)).rows[0]!.count);
          if (cleanup.ownersClosed && cleanup.poolClosed && cleanup.connections === 0) {
            if (Date.now() >= this.cleanupUntil) throw new Error('X01 cleanup deadline reached');
            cleanup.dropRequested = true;
            await this.within(this.admin.query(`DROP DATABASE ${this.database}`), this.cleanupUntil);
            cleanup.dropAcknowledged = true;
            cleanup.databaseAbsent = (await this.within(this.readIdentity(), this.cleanupUntil)) === undefined;
          }
        }
      }
    } catch (error) { this.recordError('database-cleanup', error); }
    finally { cleanup.adminClosed = await this.close('admin-close', () => this.admin.end()); }
    const cleanupConfirmed = cleanup.ownersClosed && cleanup.poolClosed && cleanup.adminClosed
      && this.listeners.every(listener => listener.closed)
      && (!cleanup.createRequested || (cleanup.identityConfirmed && cleanup.connections === 0 && cleanup.dropAcknowledged && cleanup.databaseAbsent === true));
    const result = { facts, cleanup, listeners: this.listeners, httpRequests: this.httpRequests, responseBytes: this.responseBytes,
      workUntil: this.workUntil, cleanupUntil: this.cleanupUntil, errors: this.errors, errorCount: this.errorCount, cleanupConfirmed,
      retainedDatabase: this.createRequested && !(cleanup.dropAcknowledged && cleanup.databaseAbsent) ? this.database : null,
      finishedAt: new Date().toISOString() };
    // The external owner retains this directory until the process, receipt and database facts agree.
    if (this.directoryIdentity) await this.save('result.json', result);
    return result;
  }
}
