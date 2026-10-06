import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { Pool } from 'pg';
import { PgBoss } from 'pg-boss';
import { createServer } from '../index.js';
import { registerGoalNativeExecutionRoutes } from './index.js';

export async function startNativeGoalFixture(label: string) {
  assert.match(label, /^[a-z-]+$/);
  const databaseName = `flow_o09_${process.pid}_${randomUUID().slice(0, 8)}`;
  const adminUrl = process.env.FLOW_O09_TEST_ADMIN ?? 'postgresql://flow:flow-local-only@127.0.0.1:55432/postgres';
  const databaseUrl = new URL(adminUrl); databaseUrl.pathname = '/' + databaseName;
  const admin = new Pool({ connectionString: adminUrl, max: 1, statement_timeout: 5000 });
  const ownerToken = randomUUID();
  let created = false; let pool: Pool; let boss: PgBoss; let app: Awaited<ReturnType<typeof createServer>> | undefined; let base = '';
  let leaseMs = 30_000;
  async function start() {
    app = await createServer({ databaseUrl: databaseUrl.href, ownerToken, leaseMs, automaticQueueScan: false });
    if (!app.hasRoute({ method: 'POST', url: '/api/goals/:id/native-executions' })) registerGoalNativeExecutionRoutes(app, pool, boss);
    base = await app.listen({ host: '127.0.0.1', port: 0 });
  }
  async function fetchResponse(path: string, body?: unknown, options: { key?: string; token?: string } = {}) {
    return fetch(base + path, { method: body === undefined ? 'GET' : 'POST', headers: {
      authorization: 'Bearer ' + (options.token ?? ownerToken), 'content-type': 'application/json', 'idempotency-key': options.key ?? randomUUID(),
    }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(10_000) });
  }
  async function http(path: string, body?: unknown, options: { key?: string; token?: string } = {}) {
    const response = await fetchResponse(path, body, options);
    return { status: response.status, body: await response.json() };
  }
  async function close() {
    try {
      try { await app?.close(); } finally { try { await boss?.stop(); } finally { await pool?.end(); } }
      if (created) { await admin.query('DROP DATABASE "' + databaseName + '"'); created = false; }
      const remaining = (await admin.query('SELECT datname FROM pg_database WHERE datname=$1', [databaseName])).rows;
      await writeFile(`docs/evidence/o09/${label}-cleanup.json`, JSON.stringify({ observedAt: new Date().toISOString(), databaseName, remaining }, null, 2));
    } finally { await admin.end(); }
  }
  try {
    await admin.query('CREATE DATABASE "' + databaseName + '"'); created = true;
    pool = new Pool({ connectionString: databaseUrl.href, max: 4, statement_timeout: 5000 });
    boss = new PgBoss({ connectionString: databaseUrl.href, max: 1 }); await boss.start();
    await start();
    return { http, close, get baseUrl() { return base; }, ownerToken,
      restart: async (nextLeaseMs = leaseMs) => { await app!.close(); leaseMs = nextLeaseMs; await start(); },
      discardReply: async (path: string, body: unknown, key: string) => {
        const response = await fetchResponse(path, body, { key }); await response.body?.cancel(); return response.status;
      },
      goal: async (input?: unknown) => {
        const project = (await http('/api/projects', { title: 'O09 isolated text goal' })).body.snapshot.project;
        const node = (await http(`/api/projects/${project.id}/commands`, { expectedRevision: project.revision, reason: 'Owner adds node', change: { kind: 'add-node', title: 'Draft text' } })).body;
        const goal = (await http('/api/goals', { projectId: project.id, originalGoal: 'Produce a short release note', constraints: 'Text only; no engineering writes', acceptance: 'Owner reviews the text' })).body.goal;
        const definition = await http(`/api/goals/${goal.id}/commands`, { kind: 'define-input', nodeId: node.changedNodeId, expectedInputVersion: 0, input: input ?? { goal: 'Draft a kite release note', constraints: 'No file edits', acceptance: 'Factual and brief', verification: { kind: 'nonempty' } }, reason: 'Owner fixes actual input' });
        assert.equal(definition.status, 200);
        return { goalId: goal.id as string, nodeId: node.changedNodeId as string, projectId: project.id as string };
      },
    };
  } catch (error) { await close(); throw error; }
}
