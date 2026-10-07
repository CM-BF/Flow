import { randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, mkdir, open, realpath } from 'node:fs/promises';
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
      if (!/^[a-f0-9]{32}$/.test(this.window) || !/^[a-f0-9]{40}$/.test(this.sourceHead) || !root || !isAbsolute(root) || await realpath(root) !== root
        || !(await lstat(root)).isDirectory()) throw new Error('X01 PG requires an owned root and window');
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
    try { await this.pool.end(); cleanup.poolClosed = true; } catch (error) { this.recordError('pool-close', error); }
    try {
      if (this.createRequested) {
        const current = await this.readIdentity();
        cleanup.identityConfirmed = this.creationReceiptSaved && !!current && !!this.identity
          && current.oid === this.identity.oid && current.owner === this.identity.owner && current.marker === this.identity.marker;
        if (cleanup.identityConfirmed) {
          cleanup.connections = Number((await this.admin.query<{ count: string }>(
            'SELECT count(*) FROM pg_stat_activity WHERE datname=$1', [this.database])).rows[0]!.count);
          if (cleanup.ownersClosed && cleanup.poolClosed && cleanup.connections === 0) {
            cleanup.dropRequested = true;
            await this.admin.query(`DROP DATABASE ${this.database}`);
            cleanup.dropAcknowledged = true;
            cleanup.databaseAbsent = (await this.readIdentity()) === undefined;
          }
        }
      }
    } catch (error) { this.recordError('database-cleanup', error); }
    finally { try { await this.admin.end(); cleanup.adminClosed = true; } catch (error) { this.recordError('admin-close', error); } }
    const cleanupConfirmed = cleanup.ownersClosed && cleanup.poolClosed && cleanup.adminClosed
      && (!cleanup.createRequested || (cleanup.identityConfirmed && cleanup.connections === 0 && cleanup.dropAcknowledged && cleanup.databaseAbsent === true));
    const result = { facts, cleanup, errors: this.errors, errorCount: this.errorCount, cleanupConfirmed,
      retainedDatabase: this.createRequested && !(cleanup.dropAcknowledged && cleanup.databaseAbsent) ? this.database : null,
      finishedAt: new Date().toISOString() };
    // The external owner retains this directory until the process, receipt and database facts agree.
    if (this.directoryIdentity) await this.save('result.json', result);
    return result;
  }
}
