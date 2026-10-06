import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { Pool } from 'pg';
import { PgBoss } from 'pg-boss';
import { createServer } from '../index.js';
import { migrateConversationContext, registerConversationContextRoutes } from '../conversation-context/index.js';
import { migrateGoalContext, registerGoalContextRoutes } from './index.js';

export async function startGoalContextFixture(label: string, leaseMs = 30_000) {
  assert.match(label, /^[a-z-]+$/);
  const startedAt = new Date().toISOString();
  const databaseName = 'flow_k03_' + process.pid + '_' + randomUUID().slice(0, 8);
  const adminUrl = process.env.FLOW_K03_TEST_ADMIN ?? 'postgresql://flow:flow-local-only@127.0.0.1:55432/postgres';
  const databaseUrl = new URL(adminUrl); databaseUrl.pathname = '/' + databaseName;
  const admin = new Pool({ connectionString: adminUrl, max: 1, connectionTimeoutMillis: 3000, statement_timeout: 5000 });
  const ownerToken = randomUUID();
  let created = false; let boss: PgBoss | undefined; let pool: Pool | undefined; let app: Awaited<ReturnType<typeof createServer>> | undefined; let base = '';
  async function startServer() {
    app = await createServer({ databaseUrl: databaseUrl.href, ownerToken, automaticQueueScan: false, leaseMs });
    await migrateConversationContext(pool!);
    if (!app.hasRoute({ method: 'GET', url: '/api/conversations/:conversationId/contexts/:contextId' })) registerConversationContextRoutes(app, pool!);
    await migrateGoalContext(pool!);
    if (!app.hasRoute({ method: 'GET', url: '/api/goals/:goalId/nodes/:nodeId/inputs/:version/context' })) registerGoalContextRoutes(app, pool!);
    base = await app.listen({ host: '127.0.0.1', port: 0 });
  }
  async function http(path: string, body?: unknown, options: { key?: string; token?: string } = {}) {
    const started = performance.now();
    const response = await fetch(base + path, { method: body === undefined ? 'GET' : 'POST', headers: { authorization: 'Bearer ' + (options.token ?? ownerToken), 'content-type': 'application/json', 'idempotency-key': options.key ?? randomUUID() }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(20_000) });
    const text = await response.text();
    return { status: response.status, body: JSON.parse(text), httpUtf8Bytes: Buffer.byteLength(text), elapsedMs: performance.now() - started };
  }
  async function close() {
    try {
      try { await app?.close(); } finally { try { await boss?.stop({ graceful: true, timeout: 5000 }); } finally { await pool?.end(); } }
      if (created) {
        const deadline = performance.now() + 5000;
        while (Number((await admin.query('SELECT count(*) FROM pg_stat_activity WHERE datname=$1', [databaseName])).rows[0].count)) {
          if (performance.now() > deadline) throw new Error('Own database still connected.');
          await delay(25);
        }
        await admin.query('DROP DATABASE "' + databaseName + '"'); created = false;
      }
      const remaining = (await admin.query('SELECT datname FROM pg_database WHERE datname=$1', [databaseName])).rows;
      await writeFile('docs/evidence/k03/' + label + '-cleanup.json', JSON.stringify({ startedAt, endedAt: new Date().toISOString(), databaseName, remaining }, null, 2));
    } finally { await admin.end(); }
  }
  try {
    if ((await admin.query('SELECT 1 FROM pg_database WHERE datname=$1', [databaseName])).rowCount) throw new Error('Refusing existing database.');
    await writeFile('docs/evidence/k03/' + label + '-resource.json', JSON.stringify({ startedAt, databaseName }));
    await admin.query('CREATE DATABASE "' + databaseName + '"'); created = true;
    pool = new Pool({ connectionString: databaseUrl.href, max: 6, connectionTimeoutMillis: 3000, statement_timeout: 10_000 });
    await startServer();
    boss = new PgBoss({ connectionString: databaseUrl.href, max: 1, connectionTimeoutMillis: 3000 });
    boss.on('error', error => process.stderr.write('K03 fixture scheduler: ' + error.message + '\n'));
    await boss.start();
    return { pool, boss, http, close, get baseUrl() { return base; }, initialStream: async (taskId: string) => {
      const response = await fetch(base + `/api/tasks/${taskId}/stream`, { headers: { authorization: 'Bearer ' + ownerToken }, signal: AbortSignal.timeout(5000) });
      const reader = response.body!.getReader(); let text = '';
      try { while (!text.includes('\n\n')) { const next = await reader.read(); if (next.done) break; text += new TextDecoder().decode(next.value); } return { status: response.status, text }; }
      finally { await reader.cancel(); }
    }, discardReply: async (path: string, body: unknown, key: string) => {
      const response = await fetch(base + path, { method: 'POST', headers: { authorization: 'Bearer ' + ownerToken, 'content-type': 'application/json', 'idempotency-key': key }, body: JSON.stringify(body), signal: AbortSignal.timeout(20_000) });
      await response.body?.cancel(); // The committed response body is deliberately not decoded or retained.
      return response.status;
    }, restart: async () => { await app!.close(); await startServer(); }, project: async () => {
      const response = await http('/api/projects', { workspaceId: 'personal', title: 'K03 isolated project' }); assert.equal(response.status, 201); return response.body.snapshot.project.id as string;
    } };
  } catch (error) { await close(); throw error; }
}
