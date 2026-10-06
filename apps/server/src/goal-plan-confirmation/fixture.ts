import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, statfs, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Pool } from 'pg';
import { PgBoss } from 'pg-boss';
import { FlowClient } from '../../../../packages/client/src/index.js';
import { createClaudeAdapter, type ClaudeQuery } from '../../../runner/src/claude.js';
import { describeExecutionProfile, guardExecutionProfile } from '../../../runner/src/execution-profiles.js';
import { runRunner } from '../../../runner/src/runtime.js';
import { createServer } from '../index.js';
import { migrateGoalProgressions, registerGoalProgressionRoutes, scanGoalProgressions } from '../goal-progression/index.js';
import { migrateGoalPlanConfirmations, registerGoalPlanConfirmationRoutes } from './index.js';

/** Own marked database and evidence; no provider transport, shared DB, install or new scheduling loop. */
export async function confirmationFixture() {
  const allowance = Number(process.env.FLOW_O15_PG_ALLOWANCE_BYTES);
  assert(Number.isSafeInteger(allowance) && allowance >= 32 * 1024 ** 2, 'Lead/Web PG window and measured allowance required before DB creation.');
  const space = await statfs('.');
  assert(space.bavail * space.bsize >= 1024 ** 3 + allowance, 'O15 reserve gate: no DB created.');
  const name = `flow_o15_${randomUUID().replaceAll('-', '')}`, marker = randomUUID(), token = randomUUID();
  const adminUrl = 'postgresql://flow:flow-local-only@127.0.0.1:55432/postgres', database = new URL(adminUrl); database.pathname = '/' + name;
  const admin = new Pool({ connectionString: adminUrl, max: 1, statement_timeout: 5000 });
  const pool = new Pool({ connectionString: database.href, max: 3, statement_timeout: 5000 });
  const boss = new PgBoss({ connectionString: database.href, max: 1 });
  let app: Awaited<ReturnType<typeof createServer>> | undefined, created = false, directory = '', baseUrl = '', drop = '';
  const runtimes: { stop: AbortController; promise: Promise<void> }[] = [];
  const facts: Record<string, unknown> = { database: name, marker, allowanceBytes: allowance, reserveBeforeBytes: space.bavail * space.bsize,
    providerCalls: 0, lifecycle: 'module routes and explicit sweep; not production automatic integration' };
  async function start() {
    app = await createServer({ databaseUrl: database.href, ownerToken: token, automaticQueueScan: false, leaseMs: 30_000 });
    await migrateGoalProgressions(pool);
    if (!app.hasRoute({ method: 'POST', url: '/api/goals/:id/progressions' })) registerGoalProgressionRoutes(app, pool);
    await migrateGoalPlanConfirmations(pool);
    if (!app.hasRoute({ method: 'POST', url: '/api/goal-graph-proposals/:id/confirm-inputs' })) registerGoalPlanConfirmationRoutes(app, pool, boss);
    app.addHook('onError', async (_request, _reply, error) => { ((facts.errors ??= []) as unknown[]).push({ name: error.name, code: error.code, message: error.message }); });
    app.addHook('onSend', async (request, reply) => { if (drop && request.url === drop && reply.statusCode < 300) { drop = ''; reply.raw.destroy(); } });
    baseUrl = await app.listen({ host: '127.0.0.1', port: 0 });
  }
  async function http(path: string, body?: unknown, key: string = randomUUID(), credential: string = token) {
    const response = await fetch(baseUrl + path, { method: body === undefined ? 'GET' : 'POST', headers: { authorization: `Bearer ${credential}`, 'content-type': 'application/json', 'idempotency-key': key }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(5000) });
    const text = await response.text(); return { status: response.status, body: JSON.parse(text), bytes: Buffer.byteLength(text) };
  }
  async function close() {
    try {
      for (const runtime of runtimes) runtime.stop.abort(); await Promise.all(runtimes.map(runtime => runtime.promise));
      await app?.close(); await boss.stop(); await pool.end();
      if (created) {
        facts.databaseBytesBeforeDrop = (await admin.query('SELECT pg_database_size($1) AS bytes', [name])).rows[0].bytes;
        const available = await statfs('.'); facts.freeBeforeDropBytes = available.bavail * available.bsize;
        assert.equal((await admin.query("SELECT shobj_description(oid,'pg_database') AS marker FROM pg_database WHERE datname=$1", [name])).rows[0].marker, marker);
        facts.connections = (await admin.query('SELECT pid FROM pg_stat_activity WHERE datname=$1', [name])).rows; assert.deepEqual(facts.connections, []);
        await admin.query(`DROP DATABASE "${name}"`);
      }
      facts.remaining = (await admin.query('SELECT datname FROM pg_database WHERE datname=$1', [name])).rows; assert.deepEqual(facts.remaining, []);
      if (directory) await rm(directory, { recursive: true, force: true });
      facts.runtimeCount = runtimes.length; facts.runtimeStopped = true; facts.directoryRemoved = true;
    } finally { await admin.end(); await writeFile(`docs/evidence/o15/${name}-facts.json`, JSON.stringify(facts, null, 2) + '\n'); }
  }
  try {
    assert.deepEqual((await admin.query('SELECT datname FROM pg_database WHERE datname=$1', [name])).rows, []);
    await admin.query(`CREATE DATABASE "${name}"`); created = true; await admin.query(`COMMENT ON DATABASE "${name}" IS '${marker}'`);
    directory = await mkdtemp(join(tmpdir(), 'flow-o15-')); await boss.start(); await start();
  } catch (error) { await close(); throw error; }
  const owner = () => new FlowClient({ baseUrl, token });
  return { pool, http, owner, close, facts, sweep: () => scanGoalProgressions(pool, boss),
    restart: async () => { await app!.close(); await start(); }, loseReply(path: string) { drop = path; },
    async goal() {
      const project = (await owner().createProject({ title: 'O15 explicit complete plan', workspaceId: 'personal' }, randomUUID())).snapshot.project;
      const goal = (await owner().createGoal({ projectId: project.id, originalGoal: 'Produce a bounded draft and review from fixed material.', constraints: 'Readonly synthetic test', acceptance: 'Independent owner decides meaning.' }, randomUUID())).goal;
      return { projectId: project.id, goalId: goal.id };
    },
    async harness(query: ClaudeQuery, graphTools = false) {
      const runner = await owner().registerRunner({ name: 'O15 injected SDK', harnesses: ['claude'], capacity: 1 });
      const material = join(directory, `${runner.runnerId}.txt`); await writeFile(material, 'Synthetic local material.', { mode: 0o600 });
      const options = { materialFiles: graphTools ? [] : [material], allowRead: !graphTools, requireReadApproval: false, goalGraphTools: graphTools,
        model: 'synthetic-no-provider', timeoutMs: 8000, maxTurns: 4, maxBudgetUsd: 0.1, query };
      const adapter = createClaudeAdapter(options), configuration = describeExecutionProfile(options, adapter);
      const pin = (await new FlowClient({ baseUrl, token: runner.token }).publishExecutionProfile({ configuration })).profile.reference;
      return { runner, pin, async start() {
        const stop = new AbortController(); const promise = runRunner({ baseUrl, token: runner.token, workingDirectory: join(directory, runner.runnerId), adapters: [guardExecutionProfile(adapter, pin, configuration)], signal: stop.signal, pollIntervalMs: 20, heartbeatIntervalMs: 50 });
        runtimes.push({ stop, promise }); return { async close() { stop.abort(); await promise; } };
      } };
    },
  };
}
