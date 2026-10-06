import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { lstat, mkdtemp, open, rm, statfs, writeFile, type FileHandle } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { Pool } from 'pg';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { GOAL_INPUT_PROPOSAL_PROTOCOL, type GoalGraphProposalInput, type GoalPlanConfirmation } from '@flow/contracts';
import { createServer } from '../../../apps/server/src/index.js';
import { createClaudeAdapter, type ClaudeQuery } from '../../../apps/runner/src/claude.js';
import { describeExecutionProfile, guardExecutionProfile } from '../../../apps/runner/src/execution-profiles.js';
import { runRunner } from '../../../apps/runner/src/runtime.js';
import { FlowClient } from './index.js';

const database = `flow_f01_confirmation_${randomUUID().replaceAll('-', '')}`, marker = randomUUID(), ownerToken = randomUUID();
const adminUrl = 'postgresql://flow:flow-local-only@127.0.0.1:55432/postgres';
const databaseUrl = adminUrl.replace(/postgres$/, database);
const bounds = { max: 1, connectionTimeoutMillis: 2000, statement_timeout: 5000, query_timeout: 6000 };
const admin = new Pool({ connectionString: adminUrl, ...bounds }), pool = new Pool({ connectionString: databaseUrl, ...bounds });
const evidencePath = `docs/evidence/f01/goal-plan-confirmation-production-${marker}.json`;
const facts: Record<string, unknown> = { database, marker, providerCalls: 0, startedAt: new Date().toISOString() };
let evidence: FileHandle | undefined, admitted = false, created = false, marked = false;
let directory = '', identity: { dev: number; ino: number } | undefined;
let app: Awaited<ReturnType<typeof createServer>> | undefined, client: FlowClient, origin = '';
let runtime: Promise<void> | undefined;
const stop = new AbortController(), signal = () => AbortSignal.timeout(5000);

async function checkpoint(phase: string) {
  assert(evidence);
  const bytes = Buffer.from(JSON.stringify({ ...facts, phase }, null, 2) + '\n');
  assert(bytes.length <= 32768);
  assert.equal((await evidence.write(bytes, 0, bytes.length, 0)).bytesWritten, bytes.length);
  await evidence.truncate(bytes.length); await evidence.sync();
}
async function assertOwnedDirectory() {
  assert(identity);
  const current = await lstat(directory);
  assert(current.isDirectory() && current.dev === identity.dev && current.ino === identity.ino);
}
async function start(automaticQueueScan = true) {
  // Actual production ordering and routes only: no manual migration, registration or sweep.
  app = await createServer({ databaseUrl, ownerToken, leaseMs: 30_000, automaticQueueScan });
  origin = await app.listen({ host: '127.0.0.1', port: 0 });
  client = new FlowClient({ baseUrl: origin, token: ownerToken });
}
async function observeClosedConnections() {
  const started = performance.now(), deadline = started + 3000, observations: unknown[] = [];
  facts.connectionObservations = observations;
  for (;;) {
    const remaining = deadline - performance.now(); assert(remaining > 0);
    try {
      const query = { text: 'SELECT pid,state FROM pg_stat_activity WHERE datname=$1 ORDER BY pid LIMIT 33', values: [database],
        query_timeout: Math.min(500, Math.ceil(remaining)) };
      const result = await admin.query(query); facts.connections = result.rows;
      observations.push({ elapsedMs: Math.floor(performance.now() - started), connections: result.rows });
      assert(result.rows.length <= 32 && performance.now() <= deadline);
      if (result.rows.length === 0) return;
    } catch {
      observations.push({ elapsedMs: Math.floor(performance.now() - started), error: 'connection-observation-unconfirmed' });
      throw new Error('Owned database connection closure is unconfirmed.');
    }
    await delay(Math.min(100, Math.max(0, deadline - performance.now())));
  }
}
beforeAll(async () => {
  const space = await statfs(process.cwd()); facts.freeBeforeBytes = space.bavail * space.bsize;
  assert(space.bavail * space.bsize >= 1024 ** 3 + 64 * 1024 ** 2, 'Insufficient reserve; no database created.');
  evidence = await open(evidencePath, 'wx', 0o600); admitted = true;
  await checkpoint('database-marker-reserved');
  const parent = await open(dirname(evidencePath), 'r');
  try { await parent.sync(); } finally { await parent.close(); }
  facts.evidenceDirectorySynced = true; await checkpoint('reservation-durable');
  console.info(JSON.stringify({ confirmationProductionEvidence: evidencePath, database }));
  assert.deepEqual((await admin.query('SELECT datname FROM pg_database WHERE datname=$1', [database])).rows, []);
  facts.creationRequested = true; await checkpoint('before-create');
  await admin.query(`CREATE DATABASE "${database}"`); created = true; facts.created = true; await checkpoint('created-awaiting-marker');
  await admin.query(`COMMENT ON DATABASE "${database}" IS '${marker}'`); marked = true; facts.marked = true; await checkpoint('marked');
  directory = await mkdtemp(join(tmpdir(), 'flow-f01-confirmation-'));
  const current = await lstat(directory); identity = { dev: current.dev, ino: current.ino };
  facts.directory = { path: directory, ...identity }; await checkpoint('owned-directory-created');
  await start(false);
}, 30_000);
afterAll(async () => {
  if (!admitted) { await pool.end(); await admin.end(); return; }
  const errors: string[] = [];
  let runtimeStopped = false, appClosed = false, poolClosed = false;
  try {
    try { stop.abort(); await runtime; runtimeStopped = true; } catch { errors.push('runtime-close'); }
    try { await app?.close(); app = undefined; appClosed = true; } catch { errors.push('app-close'); }
    try { await pool.end(); poolClosed = true; } catch { errors.push('pool-close'); }
    Object.assign(facts, { runtimeStopped, appClosed, poolClosed });
    if (created && marked && runtimeStopped && appClosed && poolClosed) {
      try {
        if (directory) await assertOwnedDirectory();
        const row = (await admin.query("SELECT shobj_description(oid,'pg_database') AS marker,pg_database_size(oid)::text AS bytes FROM pg_database WHERE datname=$1", [database])).rows[0];
        assert.equal(row?.marker, marker); facts.databaseBytes = Number(row.bytes);
        await observeClosedConnections(); await checkpoint('before-normal-drop');
        await admin.query(`DROP DATABASE "${database}"`); facts.databaseDropped = true;
      } catch { errors.push('database-cleanup-unconfirmed'); }
    } else if (facts.creationRequested) errors.push('ownership-or-close-unconfirmed');
    try {
      facts.remaining = (await admin.query('SELECT datname FROM pg_database WHERE datname=$1', [database])).rows;
      assert.deepEqual(facts.remaining, []);
    } catch { errors.push('database-absence-unconfirmed'); }
    if (!errors.length && directory) {
      try {
        await assertOwnedDirectory(); await checkpoint('before-owned-directory-remove');
        await rm(directory, { recursive: true });
        const exists = await lstat(directory).then(() => true, error => { if (error.code === 'ENOENT') return false; throw error; });
        assert(!exists); facts.directoryRemoved = true;
      } catch { errors.push('directory-cleanup-unconfirmed'); }
    }
  } finally {
    try { await admin.end(); facts.adminClosed = true; } catch { errors.push('admin-close'); }
    Object.assign(facts, { errors, endedAt: new Date().toISOString() });
    try { await checkpoint(errors.length ? 'unknown-retain-resources' : 'cleaned'); } finally { await evidence?.close(); }
  }
  expect(errors).toEqual([]); expect(facts.remaining).toEqual([]);
}, 30_000);

it('uses public confirmation and production scanning across restart without a client dispatch loop', { timeout: 30_000 }, async () => {
  expect((await pool.query('SELECT version FROM flow.migrations WHERE version IN (30,31,32) ORDER BY version')).rows).toEqual([{ version: 30 }, { version: 31 }, { version: 32 }]);
  const project = (await client.createProject({ title: 'Production complete inputs', workspaceId: 'personal' }, randomUUID())).snapshot.project;
  const goal = (await client.createGoal({ projectId: project.id, originalGoal: 'Two bounded text outputs', constraints: 'Synthetic no-provider consumer', acceptance: 'Separate owner decision' }, randomUUID())).goal;
  const runner = await client.registerRunner({ name: 'Production confirmation injected query', harnesses: ['claude'], capacity: 1 });
  const material = join(directory, 'source.txt'); await writeFile(material, 'Fixed synthetic material.', { mode: 0o600 });
  const prompts: string[] = []; let closedQueries = 0;
  type Message = ReturnType<ClaudeQuery> extends AsyncIterable<infer T> ? T : never;
  const query: ClaudeQuery = ({ prompt }) => Object.assign((async function* () {
    prompts.push(String(prompt));
    yield { type: 'result', subtype: 'success', is_error: false, uuid: randomUUID(), session_id: randomUUID(), result: `Production child output ${prompts.length}`, modelUsage: {}, permission_denials: [] } as unknown as Message;
  })(), { close() { closedQueries++; } });
  const options = { materialFiles: [material], allowRead: true, requireReadApproval: false, model: 'synthetic-no-provider', timeoutMs: 5000, maxTurns: 2, maxBudgetUsd: 0.1, query };
  const adapter = createClaudeAdapter(options), configuration = describeExecutionProfile(options, adapter);
  const runnerClient = new FlowClient({ baseUrl: origin, token: runner.token });
  const pin = (await runnerClient.publishExecutionProfile({ configuration }, signal())).profile.reference;
  const proposalInput: GoalGraphProposalInput = { expectedProjectRevision: project.revision, reason: 'Owner-readable complete inputs', additions: [
    { key: 'A', title: 'TITLE_A_NOT_EXECUTION_INPUT', dependencies: [] },
    { key: 'B', title: 'TITLE_B_NOT_EXECUTION_INPUT', dependencies: [{ kind: 'proposed', key: 'A' }] },
  ], inputProposal: { protocol: GOAL_INPUT_PROPOSAL_PROTOCOL, nodes: ['A', 'B'].map(key => ({ key, input: {
    goal: `Actual complete input ${key}`, constraints: 'Readonly', acceptance: 'Independent owner checks meaning', verification: { kind: 'nonempty' },
  } })) } };
  const proposal = (await client.createGoalGraphProposal(goal.id, proposalInput, randomUUID(), signal())).proposal;
  const body: GoalPlanConfirmation = { protocol: 'flow.goal-plan-confirmation.v1', proposalDigest: proposal.proposalDigest,
    expectedProjectRevision: project.revision, nodes: ['A', 'B'].map(key => ({ key, executionProfile: pin, externalDependencies: [] })), maxAdmissions: 2,
    intermediatePolicy: 'verified-artifact-within-this-authorization', expiresAt: new Date(Date.now() + 60_000).toISOString(), reason: 'Explicit two-node owner permission' };
  await expect(new FlowClient({ baseUrl: origin, token: 'invalid' }).confirmGoalPlan(proposal.id, body, randomUUID(), signal())).rejects.toMatchObject({ status: 401 });
  await expect(runnerClient.confirmGoalPlan(proposal.id, body, randomUUID(), signal())).rejects.toMatchObject({ status: 403 });
  const key = randomUUID(), accepted = await client.confirmGoalPlan(proposal.id, body, key, signal());
  expect(accepted.replayed).toBe(false); expect(accepted.progression.admissions).toBe(0);
  await app!.close(); app = undefined; await start();
  // Recovered ACK is already received before this restart; this is not the module's lost-ACK scenario.
  const resumed = new FlowClient({ baseUrl: origin, token: ownerToken });
  const recovered = await resumed.confirmGoalPlan(proposal.id, body, key, signal());
  expect(recovered.replayed).toBe(true); expect(recovered.confirmation).toEqual(accepted.confirmation);
  const progressionId = accepted.confirmation.progressionId;
  expect((await resumed.goalProgression(goal.id, progressionId, signal())).admissions).toBe(1);
  facts.runtimeStarts = 1;
  runtime = runRunner({ baseUrl: origin, token: runner.token, workingDirectory: directory, signal: stop.signal,
    adapters: [guardExecutionProfile(adapter, pin, configuration)], pollIntervalMs: 20, heartbeatIntervalMs: 50 });
  // All reads observe durable background work; no client method submits another child or calls a scan.
  await expect.poll(async () => (await resumed.goalProgression(goal.id, progressionId, signal())).state, { interval: 25, timeout: 12_000 }).toBe('finished');
  stop.abort(); await runtime;
  expect(prompts).toHaveLength(2); expect(closedQueries).toBe(2);
  expect(prompts[0]).toContain('Actual complete input A'); expect(prompts[1]).toContain('Actual complete input B');
  expect(prompts[1]).toContain('Production child output 1'); expect(prompts.join()).not.toContain('TITLE_');
  const completed = await resumed.goalProgression(goal.id, progressionId, signal());
  expect(completed.admissions).toBe(2); expect(completed.acceptance).toBe('separate-owner-decision');
  expect((await resumed.readGoal(goal.id, signal())).nodes.map(node => ({ accepted: node.accepted, current: node.deliveryCurrent }))).toEqual([{ accepted: null, current: false }, { accepted: null, current: false }]);
  await app!.close(); app = undefined; await start();
  expect((await client.confirmGoalPlan(proposal.id, body, key, signal())).confirmation).toEqual(accepted.confirmation);
  expect((await client.goalProgression(goal.id, progressionId, signal())).admissions).toBe(2);
  expect((await pool.query('SELECT count(*)::int AS n FROM flow.goal_plan_confirmations')).rows[0].n).toBe(1);
  expect((await pool.query('SELECT count(*)::int AS n FROM flow.goal_progression_executions')).rows[0].n).toBe(2);
  facts.journey = { goalId: goal.id, proposalId: proposal.id, progressionId, confirmation: accepted.confirmation, defaultReadyAdmission: true,
    automaticSecondAdmission: true, recoveredAcknowledgedKey: true, injectedQueries: prompts.length, closedQueries, admissions: 2, accepted: false, modelCalls: 0 };
});
