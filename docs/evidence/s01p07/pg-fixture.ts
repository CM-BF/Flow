import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FlowClient } from '@flow/client';
import { RUNNER_CLAIM_PROTOCOL, type RunnerClaimRequest, type TaskSubmission } from '@flow/contracts';
import { createServer } from '../../../apps/server/src/index.js';

/** One dedicated database and listener. No existing service, database or credential is recorded or modified. */
export class ClaimCenterFixture {
  readonly databaseName = `flow_s01p07_${randomUUID().replaceAll('-', '')}`;
  readonly errors: string[] = [];
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
    databaseAbsent: false, rootAbsent: false, startupSettled: false };

  start(): Promise<void> {
    this.startup = this.initialize().finally(() => { this.startupSettled = true; });
    return this.startup;
  }
  private async initialize() {
    if (process.env.FLOW_S01P07_PG_OPEN !== '1' || !process.env.FLOW_S01P07_ADMIN_URL) throw new Error('Dedicated PG window is not open.');
    const url = new URL(process.env.FLOW_S01P07_ADMIN_URL);
    if (!['localhost', '127.0.0.1'].includes(url.hostname) || url.port !== '55432') throw new Error('Unexpected approved local endpoint.');
    url.pathname = '/postgres';
    this.admin = new Pool({ connectionString: url.href, max: 1, connectionTimeoutMillis: 2000, query_timeout: 3000, statement_timeout: 3000 });
    this.admin.on('error', () => this.errors.push('ADMIN_POOL_ERROR'));
    if ((await this.admin.query('SELECT 1 FROM pg_database WHERE datname=$1', [this.databaseName])).rowCount) throw new Error('Refusing an existing database.');
    this.creationRequested = true;
    await this.admin.query(`CREATE DATABASE ${this.databaseName}`);
    url.pathname = `/${this.databaseName}`; this.databaseUrl = url.href;
    this.pool = new Pool({ connectionString: this.databaseUrl, max: 3, connectionTimeoutMillis: 2000, query_timeout: 3000, statement_timeout: 3000 });
    this.pool.on('error', () => this.errors.push('OWN_POOL_ERROR'));
    this.directory = await mkdtemp(join(tmpdir(), 'flow-s01p07-pg-'));
    await this.openServer();
  }
  private async openServer() {
    this.app = await createServer({ databaseUrl: this.databaseUrl, ownerToken: this.ownerToken, leaseMs: 30000, automaticQueueScan: false });
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
  async close() {
    const deadline = performance.now() + 70000;
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
    this.cleanup.poolClosed = !this.pool || await settle('POOL_CLOSE', () => this.pool.end());
    let exists: boolean | undefined;
    if (this.creationRequested) await settle('DATABASE_EXISTS', async () => { exists = Boolean((await this.admin.query('SELECT 1 FROM pg_database WHERE datname=$1', [this.databaseName])).rowCount); });
    if (exists && this.cleanup.appClosed && this.cleanup.poolClosed) {
      await settle('CONNECTIONS', async () => { this.cleanup.connections = (await this.admin.query<{ count: number }>('SELECT count(*)::int AS count FROM pg_stat_activity WHERE datname=$1', [this.databaseName])).rows[0]!.count; });
      if (this.cleanup.connections === 0 && await settle('DROP', () => this.admin.query(`DROP DATABASE ${this.databaseName}`))) {
        await settle('ABSENT', async () => { this.cleanup.databaseAbsent = !(await this.admin.query('SELECT 1 FROM pg_database WHERE datname=$1', [this.databaseName])).rowCount; });
      }
    } else if (exists === false) this.cleanup.databaseAbsent = true;
    this.cleanup.adminClosed = !this.admin || await settle('ADMIN_CLOSE', () => this.admin.end());
    if (this.cleanup.appClosed && this.cleanup.poolClosed && this.directory) this.cleanup.rootAbsent = await settle('ROOT_REMOVE', () => rm(this.directory, { recursive: true }));
    const receipt = { databaseName: this.databaseName, creationRequested: this.creationRequested, tasks: this.tasks, http: this.http,
      elapsedMs: performance.now() - this.started, cleanup: this.cleanup, errors: this.errors, providerCalls: 0,
      retained: { database: this.creationRequested && !this.cleanup.databaseAbsent ? this.databaseName : null, root: this.directory && !this.cleanup.rootAbsent ? this.directory : null } };
    const target = process.env.FLOW_S01P07_PG_RECEIPT;
    if (target) await writeFile(target, JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
    console.log(JSON.stringify(receipt));
    if (this.errors.length || !this.cleanup.appClosed || !this.cleanup.poolClosed || !this.cleanup.adminClosed
      || this.creationRequested && !this.cleanup.databaseAbsent || this.directory && !this.cleanup.rootAbsent) throw new Error('Private fixture cleanup is incomplete; retain exact identities.');
  }
}
