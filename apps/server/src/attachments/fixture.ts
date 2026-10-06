import assert from 'node:assert/strict';
import { fork, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { Pool } from 'pg';
import { PgBoss } from 'pg-boss';
import { createServer } from '../index.js';
import { sha256 } from '../database.js';
import { migrateAttachments, registerAttachmentRoutes } from './index.js';

/** Real HTTP + isolated PG; this fixture never uses a provider or an existing project DB. */
export async function startAttachmentFixture(label: string, installed = true, processServer = false) {
  assert.match(label, /^[a-z-]+$/);
  const startedAt = new Date().toISOString();
  const evidenceDirectory = process.env.FLOW_ATTACH_EVIDENCE_DIR ?? resolve('docs/evidence/wpf-attach01');
  await mkdir(evidenceDirectory, { recursive: true });
  async function writeEvidence(name: string, value: unknown) {
    assert.match(name, /^[a-z-]+\.json$/);
    await writeFile(resolve(evidenceDirectory, name), JSON.stringify(value, null, 2));
  }
  const databaseName = 'flow_attach_' + process.pid + '_' + randomUUID().slice(0, 8);
  const adminUrl = process.env.FLOW_ATTACH_TEST_ADMIN ?? 'postgresql://flow:flow-local-only@127.0.0.1:55432/postgres';
  const databaseUrl = new URL(adminUrl); databaseUrl.pathname = '/' + databaseName;
  const admin = new Pool({ connectionString: adminUrl, max: 1, connectionTimeoutMillis: 3000, statement_timeout: 5000 });
  const ownerToken = randomUUID();
  let created = false; let boss: PgBoss | undefined; let pool: Pool | undefined; let app: Awaited<ReturnType<typeof createServer>> | undefined; let base = ''; let child: ChildProcess | undefined;
  async function startServer() {
    if (processServer) {
      child = fork(fileURLToPath(import.meta.url), ['--attachment-server-child'], { execArgv: ['--import', 'tsx'], stdio: ['ignore', 'ignore', 'inherit', 'ipc'] });
      const started = new Promise<string>((accept, reject) => {
        child!.once('message', message => typeof message === 'string' && message.startsWith('http://127.0.0.1:') ? accept(message) : reject(Error('Isolated server startup failed.')));
        child!.once('exit', () => reject(Error('Isolated server exited before readiness.')));
        child!.once('error', reject);
      });
      child.send({ databaseUrl: databaseUrl.href, ownerToken, installed });
      const timer = setTimeout(() => child?.kill('SIGKILL'), 10_000);
      try { base = await started; } finally { clearTimeout(timer); }
      return;
    }
    app = await createServer({ databaseUrl: databaseUrl.href, ownerToken, automaticQueueScan: false });
    if (installed) await migrateAttachments(pool!);
    registerAttachmentRoutes(app, pool!);
    base = await app.listen({ host: '127.0.0.1', port: 0 });
  }
  async function http(path: string, body?: unknown, options: { key?: string; token?: string } = {}) {
    const response = await fetch(base + path, { method: body === undefined ? 'GET' : 'POST', headers: { authorization: 'Bearer ' + (options.token ?? ownerToken), 'content-type': 'application/json', 'idempotency-key': options.key ?? randomUUID() }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(20_000) });
    const text = await response.text();
    return { status: response.status, body: JSON.parse(text), httpUtf8Bytes: Buffer.byteLength(text) };
  }
  async function stopServer(signal: NodeJS.Signals = 'SIGTERM') {
    if (child && child.exitCode === null && child.signalCode === null) {
      const exited = new Promise<void>(accept => child!.once('exit', () => accept()));
      const timer = setTimeout(() => child?.kill('SIGKILL'), 5000);
      try { child.kill(signal); await exited; } finally { clearTimeout(timer); }
    } else await app?.close();
  }
  async function close() {
    const errors: string[] = [];
    async function settle(name: string, operation: () => Promise<unknown>) {
      try { await operation(); } catch (error) { errors.push(name + ': ' + (error instanceof Error ? error.message : String(error))); }
    }
    let remaining: unknown = null; let connections: number | null = null;
    try {
      await settle('app close', () => stopServer());
      await settle('scheduler stop', async () => boss?.stop({ graceful: true, timeout: 5000 }));
      await settle('fixture pool end', async () => pool?.end());
      await settle('own database cleanup', async () => {
        if (created) {
          const deadline = performance.now() + 5000;
          do {
            connections = Number((await admin.query('SELECT count(*) FROM pg_stat_activity WHERE datname=$1', [databaseName])).rows[0].count);
            if (!connections) break;
            await delay(25);
          } while (performance.now() < deadline);
          if (connections) throw Error('Own database still connected; not dropping or terminating other sessions.');
          await admin.query('DROP DATABASE "' + databaseName + '"'); created = false;
        }
      });
      await settle('cleanup observation', async () => { remaining = (await admin.query('SELECT datname FROM pg_database WHERE datname=$1', [databaseName])).rows; });
      await writeEvidence(label + '-cleanup.json', { startedAt, endedAt: new Date().toISOString(), databaseName, remaining, connections, errors });
    } finally { await admin.end(); }
    if (errors.length) throw Error('Attachment fixture cleanup failed: ' + errors.join('; '));
  }
  try {
    if ((await admin.query('SELECT 1 FROM pg_database WHERE datname=$1', [databaseName])).rowCount) throw Error('Refusing existing database.');
    await writeEvidence(label + '-resource.json', { startedAt, databaseName });
    await admin.query('CREATE DATABASE "' + databaseName + '"'); created = true;
    pool = new Pool({ connectionString: databaseUrl.href, max: 6, connectionTimeoutMillis: 3000, statement_timeout: 10_000 });
    await startServer();
    boss = new PgBoss({ connectionString: databaseUrl.href, max: 1, connectionTimeoutMillis: 3000 });
    boss.on('error', error => process.stderr.write('Attachment fixture scheduler: ' + error.message + '\n'));
    await boss.start();
    const readyPool = pool;
    return { pool: readyPool, boss, http, close, writeEvidence, get baseUrl() { return base; },
      install: async () => { installed = true; await migrateAttachments(readyPool); },
      restart: async () => { await stopServer(); await startServer(); },
      crashRestart: async () => { assert.ok(processServer, 'Only the fixture-owned child process can be killed.'); await stopServer('SIGKILL'); await startServer(); },
      project: async () => {
        const response = await http('/api/projects', { workspaceId: 'personal', title: 'Attachment isolated project' }); assert.equal(response.status, 201); return response.body.snapshot.project.id as string;
      },
      upload: async (projectId: string, text = 'exact material', name = 'note.txt', key = randomUUID()) => {
        const capability = await http(`/api/projects/${projectId}/attachments/capabilities`); assert.equal(capability.status, 200);
        const input = { recoveryScopeId: capability.body.recoveryScopeId, name, mediaType: 'text/plain', text, byteLength: Buffer.byteLength(text), contentDigest: sha256(text) };
        const response = await http(`/api/projects/${projectId}/attachments`, input, { key }); assert.equal(response.status, 201, JSON.stringify(response.body));
        return { input, key, accepted: response.body };
      },
      rawPost: async (path: string, bytes: Uint8Array) => {
        const response = await fetch(base + path, { method: 'POST', headers: { authorization: 'Bearer ' + ownerToken, 'content-type': 'application/json', 'idempotency-key': randomUUID() }, body: Buffer.from(bytes), signal: AbortSignal.timeout(20_000) });
        return { status: response.status, body: await response.json() };
      },
      discardReply: async (path: string, body: unknown, key: string) => {
        const response = await fetch(base + path, { method: 'POST', headers: { authorization: 'Bearer ' + ownerToken, 'content-type': 'application/json', 'idempotency-key': key }, body: JSON.stringify(body), signal: AbortSignal.timeout(20_000) });
        await response.body?.cancel(); return response.status;
      },
      /** Test-only administrative time setup; no production update or cleanup API. */
      expire: async (resourceId: string) => {
        await readyPool.query('ALTER TABLE flow.attachment_resources DISABLE TRIGGER attachment_resource_immutable');
        try { await readyPool.query("UPDATE flow.attachment_resources SET created_at=clock_timestamp()-interval '48 hours',expires_at=clock_timestamp() WHERE id=$1", [resourceId]); }
        finally { await readyPool.query('ALTER TABLE flow.attachment_resources ENABLE TRIGGER attachment_resource_immutable'); }
      },
      waitProjectLock: async (count = 1) => {
        const deadline = performance.now() + 4000;
        while (performance.now() < deadline) {
          const result = await readyPool.query("SELECT xact_start FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE 'SELECT%flow.projects%FOR UPDATE'");
          if (result.rowCount !== null && result.rowCount >= count) return result.rows[0].xact_start as Date;
          await delay(5);
        }
        throw Error('Expected admission to wait on the explicit project-lock barrier.');
      },
    };
  } catch (error) {
    try { await close(); } catch (cleanupError) { throw new AggregateError([error, cleanupError], 'Attachment setup and cleanup failed.'); }
    throw error;
  }
}


// Separate center process only for the crash/restart case; no production entry point or shared mount.
if (process.argv.includes('--attachment-server-child')) {
  process.once('message', async (config: { databaseUrl: string; ownerToken: string; installed: boolean }) => {
    const pool = new Pool({ connectionString: config.databaseUrl, max: 3 });
    const app = await createServer({ databaseUrl: config.databaseUrl, ownerToken: config.ownerToken, automaticQueueScan: false });
    if (config.installed) await migrateAttachments(pool);
    registerAttachmentRoutes(app, pool);
    process.once('SIGTERM', () => { void app.close().then(() => pool.end()).then(() => process.exit(0), () => process.exit(1)); });
    process.send!(await app.listen({ host: '127.0.0.1', port: 0 }));
  });
}
