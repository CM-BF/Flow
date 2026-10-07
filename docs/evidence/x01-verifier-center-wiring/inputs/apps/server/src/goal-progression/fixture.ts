import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, statfs, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Pool } from 'pg';
import { PgBoss } from 'pg-boss';
import { FlowClient } from '../../../../packages/client/src/index.js';
import type { GoalProgressionAuthorization, GoalProgressionSnapshot } from '../../../../packages/contracts/src/goal-progression.js';
import { createClaudeAdapter, type ClaudeQuery } from '../../../runner/src/claude.js';
import { describeExecutionProfile, guardExecutionProfile } from '../../../runner/src/execution-profiles.js';
import { runRunner } from '../../../runner/src/runtime.js';
import { createServer } from '../index.js';
import { migrateGoalProgressions, registerGoalProgressionRoutes, scanGoalProgressions } from './index.js';

export async function progressionFixture() {
  const space = await statfs('.');
  assert(space.bavail * space.bsize >= 1024 ** 3 + 96 * 1024 ** 2, 'O14 PG reserve gate: no DB created');
  const name = `flow_o14_${randomUUID().replaceAll('-', '')}`, marker = randomUUID();
  const adminUrl = 'postgresql://flow:flow-local-only@127.0.0.1:55432/postgres', url = new URL(adminUrl); url.pathname = '/' + name;
  const admin = new Pool({ connectionString: adminUrl, max: 1, statement_timeout: 5000 });
  const pool = new Pool({ connectionString: url.href, max: 3, statement_timeout: 5000 }), token = randomUUID();
  const boss = new PgBoss({ connectionString: url.href, max: 1 });
  let app: Awaited<ReturnType<typeof createServer>> | undefined, created = false, baseUrl = '', directory = '', drop = '';
  const runtimes: { stop: AbortController; promise: Promise<void> }[] = [];
  const facts: Record<string, unknown> = { database: name, marker, providerCalls: 0, reserveBeforeBytes: space.bavail * space.bsize, plannedMaxNewBytes: 96 * 1024 ** 2 };
  async function start() {
    app = await createServer({ databaseUrl: url.href, ownerToken: token, automaticQueueScan: false, leaseMs: 30_000 });
    await migrateGoalProgressions(pool); registerGoalProgressionRoutes(app, pool);
    app.addHook('onError', async (_request, _reply, error) => {
      ((facts.errors ??= []) as unknown[]).push({ name: error.name, code: error.code, message: error.message });
    });
    app.addHook('onSend', async (request, reply) => { if (drop && request.url === drop && reply.statusCode < 300) { drop = ''; reply.raw.destroy(); } });
    baseUrl = await app.listen({ host: '127.0.0.1', port: 0 });
  }
  async function http(path: string, body?: unknown, key: string = randomUUID(), credential: string = token) {
    const response = await fetch(baseUrl + path, { method: body === undefined ? 'GET' : 'POST', headers: { authorization: `Bearer ${credential}`, 'content-type': 'application/json', 'idempotency-key': key }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(5000) });
    return { status: response.status, body: await response.json() };
  }
  async function close() {
    try {
      for (const runtime of runtimes) runtime.stop.abort(); await Promise.all(runtimes.map(runtime => runtime.promise));
      await app?.close(); await boss.stop(); await pool.end();
      if (created) {
        facts.databaseBytesBeforeDrop = (await admin.query('SELECT pg_database_size($1) AS bytes', [name])).rows[0].bytes;
        const atCleanup = await statfs('.'); facts.freeBeforeDropBytes = atCleanup.bavail * atCleanup.bsize;
        assert.equal((await admin.query("SELECT shobj_description(oid,'pg_database') AS marker FROM pg_database WHERE datname=$1", [name])).rows[0].marker, marker);
        facts.connections = (await admin.query('SELECT pid FROM pg_stat_activity WHERE datname=$1', [name])).rows; assert.deepEqual(facts.connections, []);
        await admin.query(`DROP DATABASE "${name}"`);
      }
      facts.remaining = (await admin.query('SELECT datname FROM pg_database WHERE datname=$1', [name])).rows; assert.deepEqual(facts.remaining, []);
      if (directory) await rm(directory, { recursive: true, force: true });
      facts.runtimeCount = runtimes.length; facts.runtimeStopped = true; facts.directoryRemoved = true;
    } finally { await admin.end(); await writeFile(`docs/evidence/o14/${name}-facts.json`, JSON.stringify(facts, null, 2) + '\n'); }
  }
  try {
    assert.deepEqual((await admin.query('SELECT datname FROM pg_database WHERE datname=$1', [name])).rows, []);
    await admin.query(`CREATE DATABASE "${name}"`); created = true; await admin.query(`COMMENT ON DATABASE "${name}" IS '${marker}'`);
    directory = await mkdtemp(join(tmpdir(), 'flow-o14-')); await boss.start(); await start();
  } catch (error) { await close(); throw error; }
  const owner = () => new FlowClient({ baseUrl, token });
  return { pool, http, owner, close, facts,
    restart: async () => { await app!.close(); await start(); },
    loseReply(path: string) { drop = path; },
    sweep: () => scanGoalProgressions(pool, boss),
    read: async (goalId: string, id: string) => (await http(`/api/goals/${goalId}/progressions/${id}`)).body as GoalProgressionSnapshot,
    async harness(query: ClaudeQuery) {
      const runner = await owner().registerRunner({ name: 'O14 injected readonly Claude', harnesses: ['claude'], capacity: 1 });
      const material = join(directory, `${runner.runnerId}.txt`); await writeFile(material, 'Fixed synthetic source; no provider.', { mode: 0o600 });
      const options = { materialFiles: [material], allowRead: true, requireReadApproval: false, model: 'synthetic-no-provider', timeoutMs: 5000, maxTurns: 4, maxBudgetUsd: 0.1, query };
      const adapter = createClaudeAdapter(options), configuration = describeExecutionProfile(options, adapter);
      const pin = (await new FlowClient({ baseUrl, token: runner.token }).publishExecutionProfile({ configuration })).profile.reference;
      return { runner, pin, async start() {
        const stop = new AbortController(); const promise = runRunner({ baseUrl, token: runner.token, workingDirectory: join(directory, runner.runnerId), adapters: [guardExecutionProfile(adapter, pin, configuration)], signal: stop.signal, pollIntervalMs: 20, heartbeatIntervalMs: 50 });
        runtimes.push({ stop, promise }); return { async close() { stop.abort(); await promise; } };
      } };
    },
    async goal(pin: GoalProgressionAuthorization['nodes'][number]['executionProfile'], options: { count?: number; verification?: 'nonempty' | 'failure'; dependency?: boolean } = {}) {
      let snapshot = (await owner().createProject({ title: 'O14 finite goal', workspaceId: 'personal' }, randomUUID())).snapshot;
      const ids: string[] = [];
      for (let index = 0; index < (options.count ?? 2); index++) {
        const added = await owner().changeProject(snapshot.project.id, { expectedRevision: snapshot.project.revision, reason: 'Explicit graph fixture, not model planning', change: { kind: 'add-node', title: `TITLE IS NOT INPUT ${index}`, taskId: null, parent: null } }, randomUUID());
        ids.push(added.changedNodeId!); snapshot = added.snapshot;
      }
      if (ids.length > 1 && options.dependency !== false) {
        const added = await owner().changeProject(snapshot.project.id, { expectedRevision: snapshot.project.revision, reason: 'Exact dependency', change: { kind: 'set-dependencies', nodeId: ids[1]!, expectedNodeVersion: snapshot.graph.nodes[1]!.version, dependencies: [{ nodeId: ids[0]!, expectedVersion: snapshot.graph.nodes[0]!.version }] } }, randomUUID()); snapshot = added.snapshot;
      }
      const goal = (await owner().createGoal({ projectId: snapshot.project.id, originalGoal: 'Natural-language original requirement, synthetically preplanned here.', constraints: 'Readonly text', acceptance: 'Independent owner decides acceptance.' }, randomUUID())).goal;
      for (const [index, nodeId] of ids.entries()) await owner().commandGoal(goal.id, { kind: 'define-input', nodeId, expectedInputVersion: 0, reason: 'Explicit frozen actual input', input: { goal: `Actual input ${index}; bounded continuation.`, constraints: 'No edits', acceptance: 'Owner review required', verification: options.verification === 'failure' ? { kind: 'contains', expected: 'NEVER_PRODUCED' } : { kind: 'nonempty' } } }, randomUUID());
      const authorization: GoalProgressionAuthorization = { protocol: 'flow.goal-progression.v1', projectRevision: snapshot.project.revision,
        nodes: snapshot.graph.nodes.map(node => ({ nodeId: node.id, nodeVersion: node.version, inputVersion: 1, previousExecutionId: null, executionProfile: pin, externalDependencies: [] })),
        maxAdmissions: ids.length, intermediatePolicy: 'verified-artifact-within-this-authorization', expiresAt: new Date(Date.now() + 600_000).toISOString(), reason: 'Explicit finite progression permission.' };
      return { goalId: goal.id, projectId: snapshot.project.id, ids, authorization, snapshot };
    },
  };
}
