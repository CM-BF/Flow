import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { Pool, type PoolClient } from 'pg';
import { afterAll, afterEach, beforeAll, expect, test } from 'vitest';
import type { Ownership, RunnerEvent, TaskSubmission } from '@flow/contracts';
import { transaction } from './database.js';
import { reportEvents } from './events.js';
import { createServer } from './index.js';
import { claim, heartbeat, lockRunner, ownedAttempt, registerRunner, revoke } from './runners.js';
import { commandRunnerMaintenance, readRunnerMaintenance } from './runner-maintenance/store.js';
import { recover } from './protocol-dispatch/store.js';
import { authorized } from './goal-tool-runs/authorize.js';
import { createProject, changeProject } from './projects/commands.js';
import { createGoal } from './goals/commands.js';

const databaseName = `flow_s01p04_${randomUUID().replaceAll('-', '')}`;
const leaseMs = 60_000;
const probeDeadlineMs = 2000;
let admin: Pool | undefined;
let creationRequested = false;
let bootstrap: Awaited<ReturnType<typeof createServer>> | undefined;
let observer: Pool;
let first: Pool;
let second: Pool;
let third: Pool;
const pools: Pool[] = [];
const queuedTaskIds: string[] = [];

beforeAll(async () => {
  const configured = process.env.FLOW_S01P04_ADMIN_URL;
  if (!configured) throw new Error('FLOW_S01P04_ADMIN_URL must identify the approved local PG16 endpoint.');
  const url = new URL(configured);
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || url.hostname !== '127.0.0.1' || url.port !== '55432') {
    throw new Error('The dedicated fixture requires the approved loopback PG endpoint.');
  }
  url.pathname = '/postgres';
  admin = new Pool({ connectionString: url.href, max: 1, connectionTimeoutMillis: 1500, statement_timeout: 2000, query_timeout: 3000 });
  const version = (await admin.query<{ server_version_num: string }>('SHOW server_version_num')).rows[0]!.server_version_num;
  expect(Math.floor(Number(version) / 10_000)).toBe(16);
  expect((await admin.query('SELECT 1 FROM pg_database WHERE datname=$1', [databaseName])).rowCount).toBe(0);
  creationRequested = true;
  await admin.query(`CREATE DATABASE ${databaseName}`);
  url.pathname = `/${databaseName}`;
  // Reuse production migrations, then close its scheduler/pool before any lock experiment.
  bootstrap = await createServer({ databaseUrl: url.href, ownerToken: 's01p04-synthetic-owner', automaticQueueScan: false });
  await bootstrap.close();
  bootstrap = undefined;
  for (let index = 0; index < 4; index += 1) {
    pools.push(new Pool({ connectionString: url.href, max: 1, application_name: `${databaseName}_${index}`,
      connectionTimeoutMillis: 1500, statement_timeout: 4000, query_timeout: 5000, idle_in_transaction_session_timeout: 6000 }));
  }
  [observer, first, second, third] = pools as [Pool, Pool, Pool, Pool];
}, 20_000);

afterEach(async () => {
  // Only this fixture's unclaimed tasks: they must not be admitted by another test's runner.
  if (observer && queuedTaskIds.length) await observer.query("UPDATE flow.tasks SET status='cancelled' WHERE id=ANY($1::text[]) AND status='queued'", [queuedTaskIds.splice(0)]);
});

afterAll(async () => {
  let databaseAbsent = !creationRequested;
  let connectionsClosed = false;
  try {
    await bootstrap?.close();
    bootstrap = undefined;
    const closed = await Promise.allSettled(pools.map(pool => pool.end()));
    connectionsClosed = closed.every(result => result.status === 'fulfilled');
    if (!connectionsClosed) throw new Error(`Owned connection closure is unknown; retained database ${databaseName}`);
    if (creationRequested && admin) {
      const exists = (await admin.query('SELECT 1 FROM pg_database WHERE datname=$1', [databaseName])).rowCount !== 0;
      if (exists) {
        const connections = (await admin.query<{ count: number }>('SELECT count(*)::int AS count FROM pg_stat_activity WHERE datname=$1', [databaseName])).rows[0]!.count;
        if (connections !== 0) throw new Error(`Owned database still has connections; retained database ${databaseName}`);
        await admin.query(`DROP DATABASE ${databaseName}`);
      }
      databaseAbsent = (await admin.query('SELECT 1 FROM pg_database WHERE datname=$1', [databaseName])).rowCount === 0;
      if (!databaseAbsent) throw new Error(`Database absence unconfirmed; retained database ${databaseName}`);
    }
  } catch {
    throw new Error(`Fixture cleanup is unknown; inspect owned database ${databaseName}`);
  } finally {
    try { await admin?.end(); }
    finally { console.info(JSON.stringify({ kind: 's01p04-cleanup', databaseName, connectionsClosed, databaseAbsent })); }
  }
}, 15_000);

type Assigned = { runnerId: string; taskId: string; ownership: Ownership };
async function queueTask(harness: 'fixture' | 'a2a' = 'fixture') {
  const id = randomUUID();
  const submission: TaskSubmission = { title: 'Private fence fixture', prompt: 'No model or external effects', harness,
    ...(harness === 'fixture' ? { fixture: { scenario: 'success' as const } } : { protocol: { endpointRef: 'synthetic-peer' } }) };
  await observer.query('INSERT INTO flow.tasks(id,submission,dispatch_ready) VALUES($1,$2,true)', [id, submission]);
  queuedTaskIds.push(id);
  return id;
}
async function runner(capacity = 2, harnesses: ('fixture' | 'a2a')[] = ['fixture']) {
  return (await registerRunner(observer, { name: 'S01P04 private runner', harnesses, capacity })).runnerId;
}
async function assign(runnerId: string, harness: 'fixture' | 'a2a' = 'fixture'): Promise<Assigned> {
  const taskId = await queueTask(harness);
  const response = await claim(observer, runnerId, leaseMs);
  expect(response.assignment?.task.id).toBe(taskId);
  const attempt = response.assignment!.attempt;
  return { runnerId, taskId, ownership: { attemptId: attempt.id, ownerVersion: attempt.ownerVersion } };
}
async function pid(pool: Pool): Promise<number> {
  return (await pool.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')).rows[0]!.pid;
}
async function blockers(waiter: number) {
  return (await observer.query<{ blockers: number[]; wait_event_type: string | null }>(
    'SELECT pg_blocking_pids(pid) AS blockers,wait_event_type FROM pg_stat_activity WHERE pid=$1 AND datname=current_database()', [waiter])).rows[0];
}
async function expectBlocked(waiter: number, holder: number) {
  const deadline = performance.now() + probeDeadlineMs;
  while (performance.now() < deadline) {
    const state = await blockers(waiter);
    if (state?.wait_event_type === 'Lock' && state.blockers.includes(holder)) return;
    await delay(10);
  }
  throw new Error('No positive PG lock/blocker evidence within the bounded probe.');
}
async function expectIndependent<T>(pending: Promise<T>, waiter: number, holder: number): Promise<T> {
  let finished = false;
  const observed = pending.finally(() => { finished = true; });
  // The caller owns and settles the original promise in finally, including a failed red check.
  void observed.catch(() => undefined);
  const deadline = performance.now() + probeDeadlineMs;
  while (!finished && performance.now() < deadline) {
    const state = await blockers(waiter);
    if (state?.wait_event_type === 'Lock' && state.blockers.includes(holder)) {
      throw new Error('Different attempt is serialized behind the held runner credential fence.');
    }
    if (!finished) await delay(10);
  }
  if (!finished) throw new Error('Independent operation did not settle within the bounded probe.');
  return observed;
}
async function holdLock(lock: (client: PoolClient) => Promise<unknown>) {
  const client = await first.connect();
  try {
    await client.query('BEGIN');
    await lock(client);
    return { client, pid: (await client.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')).rows[0]!.pid };
  } catch (error) {
    try { await client.query('ROLLBACK'); } finally { client.release(); }
    throw error;
  }
}
function holdAttempt(assignment: Assigned) {
  return holdLock(client => ownedAttempt(client, assignment.runnerId, assignment.ownership));
}
function observe<T>(promise: Promise<T>): Promise<T> {
  // Bounded blocker probes may run before the final assertion attaches a rejection handler.
  void promise.catch(() => undefined);
  return promise;
}
async function releaseHeld(client: PoolClient) {
  try { await client.query('ROLLBACK'); } finally { client.release(); }
}
function message(sequence: number): RunnerEvent { return { id: randomUUID(), sequence, type: 'message', text: `fixture ${sequence}` }; }
function complete(sequence = 1): RunnerEvent { return { id: randomUUID(), sequence, type: 'completed', outcome: 'succeeded' }; }
function report(pool: Pool, assignment: Assigned, event: RunnerEvent) {
  return reportEvents(pool, assignment.runnerId, { ...assignment.ownership, events: [event] });
}

// Actual production calls on two independent connections; success must precede release of the first transaction.
test('different attempts share the runner fence for ownership, heartbeat and event commit', async () => {
  const runnerId = await runner();
  const left = await assign(runnerId); const right = await assign(runnerId);
  const waiter = await pid(second); const held = await holdAttempt(left);
  const pending: Promise<unknown>[] = [];
  try {
    const ownership = transaction(second, client => ownedAttempt(client, runnerId, right.ownership)); pending.push(ownership);
    expect((await expectIndependent(ownership, waiter, held.pid)).attempt.id).toBe(right.ownership.attemptId);
    const beat = heartbeat(second, runnerId, right.ownership, leaseMs); pending.push(beat);
    expect((await expectIndependent(beat, waiter, held.pid)).action).toBe('continue');
    const event = report(second, right, message(1)); pending.push(event);
    expect(await expectIndependent(event, waiter, held.pid)).toEqual({ accepted: 1, lastSequence: 1 });
    expect((await observer.query('SELECT sequence FROM flow.runner_events WHERE attempt_id=$1', [right.ownership.attemptId])).rows).toEqual([{ sequence: 1 }]);
  } finally { try { await releaseHeld(held.client); } finally { await Promise.allSettled(pending); } }
});

test('the same attempt remains serialized and preserves ordered event acknowledgements', async () => {
  const assignment = await assign(await runner());
  const waiter = await pid(second); const held = await holdAttempt(assignment);
  const firstEvent = message(1); const pending = observe(report(second, assignment, firstEvent));
  try { await expectBlocked(waiter, held.pid); }
  finally { try { await releaseHeld(held.client); } finally { await Promise.allSettled([pending]); } }
  expect(await pending).toEqual({ accepted: 1, lastSequence: 1 });
  expect(await report(third, assignment, message(2))).toEqual({ accepted: 1, lastSequence: 2 });
  expect(await report(second, assignment, firstEvent)).toEqual({ accepted: 0, lastSequence: 2 });
  expect((await observer.query('SELECT sequence FROM flow.runner_events WHERE attempt_id=$1 ORDER BY sequence', [assignment.ownership.attemptId])).rows).toEqual([{ sequence: 1 }, { sequence: 2 }]);
});

test('revoke waits for an in-flight fence and all later credential reads recheck revocation', async () => {
  const assignment = await assign(await runner());
  const waiter = await pid(second); const held = await holdAttempt(assignment);
  const pending = observe(revoke(second, assignment.runnerId));
  try { await expectBlocked(waiter, held.pid); }
  finally { try { await releaseHeld(held.client); } finally { await Promise.allSettled([pending]); } }
  expect(await pending).toEqual({ revoked: true });
  await expect(transaction(second, client => ownedAttempt(client, assignment.runnerId, assignment.ownership))).rejects.toMatchObject({ status: 401, code: 'runner_revoked' });
  await expect(heartbeat(second, assignment.runnerId, assignment.ownership, leaseMs)).rejects.toMatchObject({ status: 401, code: 'runner_revoked' });
  await expect(report(second, assignment, message(1))).rejects.toMatchObject({ status: 401, code: 'runner_revoked' });
});

test('a reader queued behind a writer rechecks the committed revoked row', async () => {
  const assignment = await assign(await runner()); const waiter = await pid(second);
  const held = await holdLock(client => lockRunner(client, assignment.runnerId));
  let pending: Promise<unknown> | undefined;
  try {
    await held.client.query('UPDATE flow.runners SET revoked=true WHERE id=$1', [assignment.runnerId]);
    pending = observe(transaction(second, client => ownedAttempt(client, assignment.runnerId, assignment.ownership)));
    await expectBlocked(waiter, held.pid);
    await held.client.query('COMMIT');
  } finally { try { await releaseHeld(held.client); } finally { if (pending) await Promise.allSettled([pending]); } }
  await expect(pending).rejects.toMatchObject({ status: 401, code: 'runner_revoked' });
});

test('drain blocks only new admission, allows existing work, and hold waits for zero active attempts', async () => {
  const runnerId = await runner(); const assignment = await assign(runnerId);
  const operationId = randomUUID();
  const command = { version: 0, operationId, reason: 'Private controlled drain' };
  const waiter = await pid(second); const held = await holdAttempt(assignment);
  const pending = observe(commandRunnerMaintenance(second, runnerId, 'drain', command, randomUUID(), 'owner-http'));
  try { await expectBlocked(waiter, held.pid); }
  finally { try { await releaseHeld(held.client); } finally { await Promise.allSettled([pending]); } }
  expect((await pending).state.state).toBe('draining');
  await queueTask();
  expect((await claim(second, runnerId, leaseMs)).assignment).toBeNull();
  expect((await heartbeat(second, runnerId, assignment.ownership, leaseMs)).action).toBe('continue');
  expect(await report(second, assignment, message(1))).toEqual({ accepted: 1, lastSequence: 1 });
  const hold = { ...command, version: 1 };
  await expect(commandRunnerMaintenance(second, runnerId, 'hold', hold, randomUUID(), 'trusted-host')).rejects.toMatchObject({ code: 'maintenance_busy' });
  await report(second, assignment, complete(2));
  expect((await readRunnerMaintenance(second, runnerId)).activeAttempts).toBe(0);
  expect((await commandRunnerMaintenance(second, runnerId, 'hold', hold, randomUUID(), 'trusted-host')).state.state).toBe('maintenance');
});

test('exclusive claim keeps capacity one and unresolved attempts continue occupying the slot', async () => {
  const runnerId = await runner(1); await queueTask(); await queueTask();
  const waiter = await pid(second); const held = await holdLock(client => lockRunner(client, runnerId));
  const pending = [observe(claim(second, runnerId, leaseMs)), observe(claim(third, runnerId, leaseMs))];
  try { await expectBlocked(waiter, held.pid); }
  finally { try { await releaseHeld(held.client); } finally { await Promise.allSettled(pending); } }
  const results = await Promise.all(pending);
  const assignments = results.flatMap(result => result.assignment ? [result.assignment] : []);
  expect(assignments).toHaveLength(1);
  const accepted = assignments[0]!;
  expect((await observer.query<{ count: number }>('SELECT count(*)::int AS count FROM flow.attempts WHERE runner_id=$1 AND completed_at IS NULL', [runnerId])).rows[0]!.count).toBe(1);
  await observer.query("UPDATE flow.tasks SET status='uncertain' WHERE id=$1", [accepted.task.id]);
  expect((await claim(second, runnerId, leaseMs)).assignment).toBeNull();
});

test('protocol recovery retains the outer exclusive fence before nested ownedAttempt', async () => {
  const runnerId = await runner(2, ['fixture', 'a2a']);
  const unrelated = await assign(runnerId); const protocol = await assign(runnerId, 'a2a');
  const waiter = await pid(second); const held = await holdAttempt(unrelated);
  const pending = observe(recover(second, runnerId));
  try { await expectBlocked(waiter, held.pid); }
  finally { try { await releaseHeld(held.client); } finally { await Promise.allSettled([pending]); } }
  const result = await pending;
  expect(result.assignments).toHaveLength(1);
  expect(result.assignments[0]!.assignment.attempt.id).toBe(protocol.ownership.attemptId);
  expect(result.assignments[0]!.remainingLeaseMs).toBeGreaterThan(0);
});

test('goal authority retains runner then project and nested task-attempt fences', async () => {
  const runnerId = await runner(); const unrelated = await assign(runnerId); const planner = await assign(runnerId);
  const project = await createProject(observer, { workspaceId: 'personal', title: 'Fence scope' }, randomUUID());
  const projectId = project.snapshot.project.id;
  const added = await changeProject(observer, projectId, { expectedRevision: 1, reason: 'Controlled node', change: { kind: 'add-node', title: 'Node', taskId: null, parent: null } }, randomUUID());
  const goal = await createGoal(observer, { projectId, originalGoal: 'Check lock order', constraints: 'No model', acceptance: 'Fenced authority' }, randomUUID());
  const grantId = randomUUID();
  // Only authority setup is seeded; authorization and all acquired locks use the production module.
  await observer.query("INSERT INTO flow.goal_tool_runs(id,goal_id,task_id,version,scope,mode) VALUES($1,$2,$3,1,$4,'fixture')", [grantId, goal.goal.id, planner.taskId,
    { readScope: 'whole-goal', allowedNodeIds: [added.changedNodeId], allowedCommands: ['define-input'], maxCommands: 1 }]);
  const waiter = await pid(second); const held = await holdAttempt(unrelated);
  const pending = observe(authorized(second, runnerId, planner.ownership, { id: grantId, version: 1 }, async (_client, grant, state) => ({ id: grant.id, projectId: state.project.project.id })));
  try { await expectBlocked(waiter, held.pid); }
  finally { try { await releaseHeld(held.client); } finally { await Promise.allSettled([pending]); } }
  expect(await pending).toEqual({ id: grantId, projectId });
  await expect(authorized(second, runnerId, { ...planner.ownership, ownerVersion: 2 }, { id: grantId, version: 1 }, async () => true)).rejects.toMatchObject({ code: 'stale_owner' });
});

test('missing runner, foreign attempt, stale owner and expired lease keep their existing fences', async () => {
  const assignment = await assign(await runner()); const other = await runner();
  await expect(transaction(second, client => ownedAttempt(client, randomUUID(), assignment.ownership))).rejects.toMatchObject({ status: 401, code: 'runner_revoked' });
  await expect(transaction(second, client => ownedAttempt(client, other, assignment.ownership))).rejects.toMatchObject({ status: 403, code: 'attempt_forbidden' });
  await expect(heartbeat(second, assignment.runnerId, { ...assignment.ownership, ownerVersion: 2 }, leaseMs)).rejects.toMatchObject({ status: 409, code: 'stale_owner' });
  await observer.query("UPDATE flow.attempts SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE id=$1", [assignment.ownership.attemptId]);
  expect((await heartbeat(second, assignment.runnerId, assignment.ownership, leaseMs)).action).toBe('stop');
  await expect(report(second, assignment, message(1))).rejects.toMatchObject({ status: 409, code: 'stale_owner' });
  expect((await observer.query('SELECT completed_at FROM flow.attempts WHERE id=$1', [assignment.ownership.attemptId])).rows[0]!.completed_at).toBeNull();
});
