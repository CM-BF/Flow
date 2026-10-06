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
import { migrate, sha256 } from '../database.js';
import { migrateAttachments, registerAttachmentRoutes } from './index.js';
import { migrateWorkspace } from '../m2-workspace.js';
import { migrateProjects } from '../projects/index.js';
import { migrateProtocolDispatch } from '../protocol-dispatch/index.js';
import { migrateGoals } from '../goals/index.js';
import { migrateConversations } from '../conversations/index.js';
import { migratePlugins } from '../plugins/index.js';
import { migrateAssistantMessages } from '../assistant/index.js';
import { migrateExecutionProfiles } from '../execution-profiles/index.js';
import { migrateConversationQueue } from '../conversation-queue/index.js';
import { migrateGoalToolRuns } from '../goal-tool-runs/index.js';
import { migrateGoalGraphProposals } from '../goal-graph-proposals/index.js';
import { migrateKnowledge } from '../knowledge/index.js';
import { migrateRunnerMaintenance } from '../runner-maintenance/index.js';
import { migrateConversationContext } from '../conversation-context/index.js';
import { migrateGoalGraphRuns } from '../goal-graph-runs/index.js';
import { migrateNativeActivities } from '../native-activity/index.js';
import { migrateGoalContext } from '../goal-context/index.js';
import { migrateAssistantStreams } from '../assistant-stream/index.js';
import { migratePackageFetches } from '../plugin-package-fetches/index.js';
import { migrateActiveSteering } from '../active-steering/index.js';
import { migrateNativeHarnessSources } from '../native-harness-migration.js';

/** Explicit historical schema, built forward without calling the current server factory. */
async function migrateBeforeAttachments(pool: Pool) {
  for (const migration of [migrate, migrateWorkspace, migrateProjects, migrateProtocolDispatch, migrateGoals,
    migrateConversations, migratePlugins, migrateAssistantMessages, migrateExecutionProfiles, migrateConversationQueue,
    migrateGoalToolRuns, migrateGoalGraphProposals, migrateKnowledge, migrateRunnerMaintenance, migrateConversationContext,
    migrateGoalGraphRuns, migrateNativeActivities, migrateGoalContext, migrateAssistantStreams, migratePackageFetches,
    migrateActiveSteering, migrateNativeHarnessSources]) await migration(pool);
  assert.deepEqual((await pool.query('SELECT version FROM flow.migrations ORDER BY version')).rows.map(row => row.version), Array.from({ length: 25 }, (_, index) => index + 1));
  assert.equal((await pool.query("SELECT to_regclass('flow.attachment_resources') AS resource")).rows[0].resource, null);
}

const attachmentRoutes = [
  { method: 'GET', url: '/api/projects/:projectId/attachments/capabilities' },
  { method: 'POST', url: '/api/projects/:projectId/attachments' },
  { method: 'GET', url: '/api/projects/:projectId/attachments' },
  { method: 'GET', url: '/api/projects/:projectId/attachments/upload-receipt' },
  { method: 'GET', url: '/api/projects/:projectId/attachments/:resourceId' },
  { method: 'GET', url: '/api/projects/:projectId/attachments/:resourceId/versions/:version/content' },
] as const;
/** Compatibility for the historical unmounted factory; never masks a partial production mount. */
async function completeFixtureMount(app: Awaited<ReturnType<typeof createServer>>, pool: Pool) {
  await app.after(); // Attachment routes are registered inside an asynchronous Fastify plugin.
  const factoryRoutes = attachmentRoutes.map(route => ({ ...route, present: app.hasRoute(route) }));
  const count = factoryRoutes.filter(route => route.present).length;
  const factoryMigration = Boolean((await pool.query('SELECT 1 FROM flow.migrations WHERE version=26')).rowCount);
  assert.ok(count === 0 || count === attachmentRoutes.length, 'Partial attachment route mount; refusing fixture repair.');
  if (count) assert.ok(factoryMigration, 'Mounted attachment routes require migration 026.');
  else { await migrateAttachments(pool); registerAttachmentRoutes(app, pool); await app.after(); }
  assert.ok(attachmentRoutes.every(route => app.hasRoute(route)), 'Attachment fixture routes are incomplete.');
  return { observedAt: new Date().toISOString(), factoryMigration, factoryRoutes,
    fallbackMigration: !factoryMigration, fallbackRoutes: count === 0 };
}
type FactoryObservation = Awaited<ReturnType<typeof completeFixtureMount>>;

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
  const factoryObservations: FactoryObservation[] = [];
  async function recordFactory(observation: FactoryObservation) {
    factoryObservations.push(observation);
    await writeEvidence(label + '-factory.json', { startedAt, factoryObservations });
  }
  async function startServer() {
    if (processServer) {
      child = fork(fileURLToPath(import.meta.url), ['--attachment-server-child'], { execArgv: ['--import', 'tsx'], stdio: ['ignore', 'ignore', 'inherit', 'ipc'] });
      const started = new Promise<{ url: string; factory: FactoryObservation }>((accept, reject) => {
        child!.once('message', message => {
          const ready = message as { url?: string; factory?: FactoryObservation };
          if (ready.url?.startsWith('http://127.0.0.1:') && ready.factory) accept({ url: ready.url, factory: ready.factory });
          else reject(Error('Isolated server startup failed.'));
        });
        child!.once('exit', () => reject(Error('Isolated server exited before readiness.')));
        child!.once('error', reject);
      });
      child.send({ databaseUrl: databaseUrl.href, ownerToken });
      const timer = setTimeout(() => child?.kill('SIGKILL'), 10_000);
      try { const ready = await started; base = ready.url; await recordFactory(ready.factory); } finally { clearTimeout(timer); }
      return;
    }
    app = await createServer({ databaseUrl: databaseUrl.href, ownerToken, automaticQueueScan: false });
    await recordFactory(await completeFixtureMount(app, pool!));
    base = await app.listen({ host: '127.0.0.1', port: 0 });
  }
  async function http(path: string, body?: unknown, options: { key?: string; token?: string } = {}) {
    assert.ok(base, 'Pre-026 fixture is PG/domain only; install before using HTTP.');
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
    if (installed) await startServer();
    else { assert.ok(!processServer, 'Pre-026 setup runs only in the isolated fixture process.'); await migrateBeforeAttachments(pool); }
    boss = new PgBoss({ connectionString: databaseUrl.href, max: 1, connectionTimeoutMillis: 3000 });
    boss.on('error', error => process.stderr.write('Attachment fixture scheduler: ' + error.message + '\n'));
    await boss.start();
    await boss.createQueue('flow-wake', { retryLimit: 5, retryDelay: 1, retryBackoff: true, expireInSeconds: 30 });
    const readyPool = pool;
    return { pool: readyPool, boss, http, close, writeEvidence, get baseUrl() { return base; },
      install: async () => { if (installed) await migrateAttachments(readyPool); else { await startServer(); installed = true; } },
      restart: async () => { assert.ok(installed); await stopServer(); await startServer(); },
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
  process.once('message', async (config: { databaseUrl: string; ownerToken: string }) => {
    const pool = new Pool({ connectionString: config.databaseUrl, max: 3 });
    const app = await createServer({ databaseUrl: config.databaseUrl, ownerToken: config.ownerToken, automaticQueueScan: false });
    const factory = await completeFixtureMount(app, pool);
    process.once('SIGTERM', () => { void app.close().then(() => pool.end()).then(() => process.exit(0), () => process.exit(1)); });
    process.send!({ url: await app.listen({ host: '127.0.0.1', port: 0 }), factory });
  });
}
