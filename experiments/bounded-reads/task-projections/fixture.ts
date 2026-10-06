import { randomUUID } from 'node:crypto';
import { Pool, type PoolClient, type QueryResult } from 'pg';
import { createServer } from '../../../apps/server/src/index.js';

export const limits = { tasks: 32, promptBytes: 1_048_576, decodedAndOutputBytes: 32 * 1_048_576, workMs: 45_000, totalMs: 60_000 } as const;
export interface ReadSample { name: string; queryCalls: number; selectCalls: number; taskRows: number; taskRowJsonBytes: number; taskFields: string[] }
const jsonBytes = (value: unknown) => Buffer.byteLength(JSON.stringify(value));
async function bounded<T>(operation: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try { return await Promise.race([operation, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Owned resource deadline exceeded.')), ms); })]); }
  finally { clearTimeout(timer); }
}

/** Private fixture: only owns its random database, HTTP server and connection pools. */
export class TaskReadFixture {
  readonly database = `flow_b01_projection_${randomUUID().replaceAll('-', '')}`;
  readonly samples: ReadSample[] = [];
  readonly ownerToken = 'b01-projection-synthetic-owner';
  pool!: Pool;
  app: Awaited<ReturnType<typeof createServer>> | undefined;
  base = '';
  private admin: Pool | undefined;
  private requested = false;
  private startedAt = 0;
  private tasks = 0;
  private observedBytes = 0;
  private current: ReadSample | undefined;
  private version: string | undefined;

  async start(): Promise<void> {
    this.startedAt = performance.now();
    const configured = process.env.FLOW_B01_PROJECTIONS_ADMIN_URL;
    if (!configured) throw new Error('Approved loopback PG endpoint is required.');
    const url = new URL(configured);
    if (!['postgres:', 'postgresql:'].includes(url.protocol) || url.hostname !== '127.0.0.1' || url.port !== '55432') throw new Error('Unexpected PG endpoint.');
    url.pathname = '/postgres';
    this.admin = new Pool({ connectionString: url.href, max: 1, connectionTimeoutMillis: 1500, statement_timeout: 2000, query_timeout: 3000 });
    this.version = (await this.admin.query('SHOW server_version_num')).rows[0].server_version_num;
    if (Math.floor(Number(this.version) / 10_000) !== 16) throw new Error('PG16 is required.');
    if ((await this.admin.query('SELECT 1 FROM pg_database WHERE datname=$1', [this.database])).rowCount) throw new Error('Random database already exists.');
    this.requested = true;
    await this.admin.query(`CREATE DATABASE ${this.database}`);
    url.pathname = `/${this.database}`;
    this.app = await createServer({ databaseUrl: url.href, ownerToken: this.ownerToken, automaticQueueScan: false });
    this.base = await this.app.listen({ host: '127.0.0.1', port: 0 });
    this.pool = new Pool({ connectionString: url.href, max: 3, connectionTimeoutMillis: 1500, statement_timeout: 3000, query_timeout: 4000, idle_in_transaction_session_timeout: 5000 });
    this.pool.on('connect', client => this.observe(client));
    this.checkWork();
  }
  checkWork(): void {
    if (performance.now() - this.startedAt > limits.workMs || this.observedBytes > limits.decodedAndOutputBytes) throw new Error('Fixture work budget exhausted.');
  }
  accountTask(prompt: string): void {
    this.checkWork();
    if (++this.tasks > limits.tasks || Buffer.byteLength(prompt) > limits.promptBytes) throw new Error('Fixture task/prompt budget exceeded.');
  }
  async http(path: string, body?: unknown, token = this.ownerToken): Promise<{ status: number; data: any }> {
    this.checkWork();
    const response = await fetch(`${this.base}${path}`, { method: body === undefined ? 'GET' : 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', 'idempotency-key': randomUUID() }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(4000) });
    const text = await response.text(); this.observedBytes += Buffer.byteLength(text); this.checkWork();
    return { status: response.status, data: JSON.parse(text) };
  }
  async sample<T>(name: string, operation: () => Promise<T>): Promise<{ value: T; measurement: ReadSample }> {
    this.checkWork();
    if (this.current || this.samples.length >= 48) throw new Error('Only bounded sequential samples are supported.');
    const measurement: ReadSample = { name, queryCalls: 0, selectCalls: 0, taskRows: 0, taskRowJsonBytes: 0, taskFields: [] };
    this.current = measurement;
    try { return { value: await operation(), measurement }; }
    finally { this.current = undefined; this.samples.push(measurement); this.checkWork(); }
  }
  private observe(client: PoolClient): void {
    const original = client.query;
    client.query = new Proxy(original, { apply: (query, receiver, args: unknown[]) => {
      const sample = this.current;
      const first = args[0]; const sql = typeof first === 'string' ? first : (first as { text?: string })?.text ?? '';
      if (sample) { sample.queryCalls++; if (/^SELECT\b/i.test(sql.trim())) sample.selectCalls++; }
      const result = Reflect.apply(query, receiver, args);
      if (!sample || !result || typeof result.then !== 'function') return result;
      return result.then((answer: QueryResult) => {
        if (/\bFROM\s+flow\.tasks\b/i.test(sql)) {
          const bytes = jsonBytes(answer.rows); sample.taskRowJsonBytes += bytes; sample.taskRows += answer.rows.length; this.observedBytes += bytes;
          sample.taskFields = [...new Set([...sample.taskFields, ...answer.fields.map(field => field.name)])].sort();
        }
        return answer;
      });
    } });
  }
  async close(): Promise<void> {
    let connectionsClosed = false, databaseAbsent = !this.requested;
    try {
      this.app?.server.closeAllConnections();
      await bounded(Promise.all([this.app?.close(), this.pool?.end()]), 6000);
      connectionsClosed = true;
      if (this.requested && this.admin) {
        const present = (await this.admin.query('SELECT 1 FROM pg_database WHERE datname=$1', [this.database])).rowCount;
        const count = (await this.admin.query('SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname=$1', [this.database])).rows[0].n;
        if (count !== 0) throw new Error('Owned connections remain.');
        if (present) await this.admin.query(`DROP DATABASE ${this.database}`);
        databaseAbsent = !(await this.admin.query('SELECT 1 FROM pg_database WHERE datname=$1', [this.database])).rowCount;
        if (!databaseAbsent) throw new Error('Database removal is unconfirmed.');
      }
    } catch { throw new Error(`Fixture cleanup unknown; retained database ${this.database}`); }
    finally {
      try { await bounded(this.admin?.end() ?? Promise.resolve(), 2000); }
      finally {
        const report = { kind: 'b01-task-projection-fixture', database: this.database, postgresVersion: this.version, tasks: this.tasks, elapsedMs: performance.now() - this.startedAt, decodedAndHttpBytes: this.observedBytes, connectionsClosed, databaseAbsent, samples: this.samples };
        const reportBytes = jsonBytes(report);
        console.info(JSON.stringify({ ...report, reportBytes }));
        if (report.elapsedMs > limits.totalMs || this.observedBytes + reportBytes > limits.decodedAndOutputBytes) throw new Error('Fixture total budget exceeded.');
      }
    }
  }
}
