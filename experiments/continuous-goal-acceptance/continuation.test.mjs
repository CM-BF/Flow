import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, lstat, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { digest, readRecord, writeRecord } from './records.mjs';
import { pauseReceipt, validatePause, recordDigest, stagePassed, assertNativeReady } from './stage-policy.mjs';
import { verifySourceDelta, readContinuation, validateContinuation, reserveContinuation, verifyContinuationDatabase, continuationState } from './continuation.mjs';
import { confirmationDraft } from './proposal.mjs';
import { MATERIAL, REQUIREMENT, adapterOptions } from './config.mjs';
import { nativeEnvironmentPolicy } from './native-environment.mjs';
import { validatePermit, reservePhase, consumeSlot } from './permit.mjs';
import { environmentFixture, permitInput } from './native-environment-fixture.mjs';
import { continueSavedPlan } from './driver.mjs';
import { operationArguments } from './operator.mjs';
import { sourceIdentity } from './identity.mjs';
import { createObservedQuery } from './query-run.mjs';
import { createClaudeAdapter } from '../../apps/runner/src/claude.ts';

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'o16-continuation-')); t.after(() => rm(root, { recursive: true }));
  const runs = join(root, 'runs'), old = join(runs, 'old-plan'), privateRoot = join(root, 'old-private');
  await mkdir(old, { recursive: true }); await mkdir(privateRoot, { mode: 0o700 });
  const info = await lstat(privateRoot), publicPlan = await readRecord(new URL('../../docs/evidence/o16/runs/native-plan-normal-home-20261008-once/plan.json', import.meta.url), 262144);
  const proposal = publicPlan.proposal, reference = phase => ({ id: phase === 'plan' ? '8a4e7920-7063-4904-a7e8-9c6ccf170e43' : '4c6dd8c8-cdf7-45d9-a616-2d6cffdf829b',
    runnerId: phase === 'plan' ? proposal.source.runnerId : 'c03a73ce-3b5b-4958-bca4-8dc1506b9a1a', configDigest: 'd'.repeat(64) });
  const before = { path: 'experiments/continuous-goal-acceptance/permit.mjs', bytes: 1, sha256: 'a'.repeat(64) };
  const after = { ...before, bytes: 2, sha256: 'b'.repeat(64) };
  const dependencies = [{ name: 'fixed-dependency', version: '1' }], oldDigest = digest(JSON.stringify({ files: [before], dependencies }));
  const source = { root, files: [after], dependencies }; source.digest = digest(JSON.stringify({ files: source.files, dependencies }));
  const resources = { kind: 'flow.o16.private-resources.v1', phase: 'paused-owned-resources', sourceDigest: oldDigest,
    directory: { path: privateRoot, dev: info.dev, ino: info.ino }, database: 'flow_o16_' + 'a'.repeat(32), marker: '11111111-1111-4111-8111-111111111111',
    marked: true, serverClosed: true, adminClosed: true, workersStopped: true, workerProcesses: [], errors: [], connectionObservations: [{ rows: [] }] };
  const state = { mode: 'native', stage: 'planned', sourceDigest: oldDigest, projectId: proposal.projectId, goalId: proposal.goalId, proposal,
    citation: proposal.input.inputProposal.nodes[0].input.knowledge[0], materialFile: join(privateRoot, 'material.txt'),
    admitted: { runId: proposal.source.runId, taskId: proposal.source.taskId },
    runners: Object.fromEntries(['plan', 'children'].map(phase => [phase, { token: 'synthetic-flow-runner', profile: { reference: reference(phase), configuration: { fixture: phase } } }])) };
  const report = { outcome: 'actual-proposal-awaiting-owner', nativeQueryCalls: 1, childQueries: 0, publicCompletion: publicPlan.publicCompletion, resources };
  const pause = pauseReceipt({ run: 'old-plan', phase: 'plan', sourceDigest: oldDigest, state, report, resources, now: Date.now() - 1200000 });
  const packet = { pause, state, report, resources }, run = 'new-confirm';
  const confirmation = confirmationDraft(proposal, state); confirmation.reason = 'Synthetic test authorization only; no actual center or model execution.';
  const grant = { kind: 'flow.o16.expired-plan-continuation.v1', authorizedBy: 'Goal Owner', approvalId: 'synthetic-continuation-only',
    authorizationReference: confirmation.reason, approvedAt: new Date(Date.now() - 1000).toISOString(), expiresAt: new Date(Date.now() + 60000).toISOString(),
    run, sourceDigest: source.digest, environmentDigest: nativeEnvironmentPolicy.digest, nativeQueries: 0,
    retention: 'keep-origin-database-and-both-directories', confirmation, sourceDelta: [{ path: before.path, before, after }],
    origin: { run: pause.run, pauseDigest: recordDigest(pause), stateDigest: pause.stateDigest, reportDigest: pause.reportDigest,
      resourcesDigest: pause.resourcesDigest, sourceDigest: oldDigest, database: resources.database, marker: resources.marker, directory: resources.directory } };
  await writeRecord(join(old, 'pause.json'), pause); await writeRecord(join(old, 'plan.json'), report); await writeRecord(join(old, 'resources.json'), resources);
  await writeRecord(join(privateRoot, 'journey.json'), state); await writeFile(state.materialFile, MATERIAL, { flag: 'wx', mode: 0o400 });
  const options = { runs, source, run, environmentDigest: nativeEnvironmentPolicy.digest };
  const value = await readContinuation(grant, options);
  return { root, runs, old, privateRoot, reservations: join(root, 'reservations'), source, packet, grant, options, value };
}

test('continuation: expired legacy entry stays refused while new authorization binds an unchanged archived packet', async t => {
  const f = await fixture(t);
  assert.throws(() => validatePause(f.packet.pause, { ...f.packet, run: 'old-plan', phase: 'confirm', sourceDigest: f.packet.pause.sourceDigest }), /expired/);
  assert.equal(f.value.grant.nativeQueries, 0);
  for (const mutate of [g => g.nativeQueries = 1, g => g.sourceDigest = 'c'.repeat(64), g => g.origin.stateDigest = 'c'.repeat(64),
    g => g.environmentDigest = 'c'.repeat(64), g => g.run = 'old-plan', g => g.expiresAt = g.approvedAt, g => g.confirmation.maxAdmissions = 3]) {
    const grant = structuredClone(f.grant); mutate(grant); assert.throws(() => validateContinuation(grant, f.packet, f.options));
  }
});
test('continuation: reverse source proof rejects unlisted changes, dependencies, duplicate delta and incomplete source', async t => {
  const f = await fixture(t); verifySourceDelta(f.source, f.packet.pause.sourceDigest, f.grant.sourceDelta);
  for (const change of [s => s.dependencies[0].version = 'other', s => s.files[0].bytes++, s => s.files.push({ path: 'other', bytes: 1, sha256: 'e'.repeat(64) })]) {
    const source = structuredClone(f.source); change(source); assert.throws(() => verifySourceDelta(source, f.packet.pause.sourceDigest, f.grant.sourceDelta));
  }
  assert.throws(() => verifySourceDelta(f.source, f.packet.pause.sourceDigest, [...f.grant.sourceDelta, ...f.grant.sourceDelta]));
});
test('continuation: actual readers reject changed private state or symlink material before reservation', async t => {
  const f = await fixture(t), changed = structuredClone(f.packet.state); changed.stage = 'unknown';
  await writeRecord(join(f.privateRoot, 'journey.json'), changed);
  await assert.rejects(readContinuation(f.grant, f.options));
  await assert.rejects(lstat(join(f.old, 'pause-consumed-plan.json')), { code: 'ENOENT' });
  await writeRecord(join(f.privateRoot, 'journey.json'), f.packet.state);
  await rm(f.packet.state.materialFile); await symlink(join(f.old, 'plan.json'), f.packet.state.materialFile);
  await assert.rejects(readContinuation(f.grant, f.options));
});
test('continuation: shared legacy wx and origin reservation prevent two new runs or an existing consumed source', async t => {
  const f = await fixture(t), originals = await Promise.all(['pause.json', 'plan.json', 'resources.json'].map(n => readFile(join(f.old, n))));
  await reserveContinuation(f.reservations, f.value, f.source, f.runs);
  const grant = { ...f.grant, run: 'another-run', approvalId: 'different-approval' };
  const second = validateContinuation(grant, f.packet, { ...f.options, run: grant.run });
  await assert.rejects(reserveContinuation(f.reservations, second, f.source, f.runs), { code: 'EEXIST' });
  await assert.rejects(writeRecord(join(f.old, 'pause-consumed-plan.json'), { receipt: f.packet.pause }, { exclusive: true }), { code: 'EEXIST' });
  assert.deepEqual(await Promise.all(['pause.json', 'plan.json', 'resources.json'].map(n => readFile(join(f.old, n)))), originals);
  assert.deepEqual(await readRecord(join(f.privateRoot, 'journey.json')), f.packet.state);
});

function database(f, mutate = () => {}) {
  const events = [], state = f.packet.state, p = state.proposal, attempt = f.packet.report.publicCompletion.attempt;
  const db = { async query(sql, args) {
    events.push({ sql, args }); let rows = [];
    if (sql.includes('JOIN flow.projects')) rows = [{ id: state.goalId, project_id: state.projectId, original: REQUIREMENT, revision: p.baseRevision }];
    else if (sql.includes('FROM flow.goal_graph_proposals')) rows = [{ id: p.id, goal_id: p.goalId, project_id: p.projectId, base_revision: p.baseRevision,
      goal_digest: p.goalDigest, proposal_digest: p.proposalDigest, input: p.input, source: JSON.stringify(p.source) }];
    else if (sql.includes('FROM flow.tasks')) rows = [{ id: state.admitted.taskId, status: 'succeeded', verification_status: 'passed', current_attempt_id: attempt.id, owner_version: attempt.ownerVersion, pending_decision: null }];
    else if (sql.includes('FROM flow.attempts')) rows = [{ id: attempt.id, task_id: state.admitted.taskId, runner_id: attempt.runnerId, owner_version: attempt.ownerVersion, completed_at: '2026-10-08T01:45:32.000Z' }];
    else if (sql.includes('FROM flow.execution_profiles')) { const profile = Object.values(state.runners).find(r => r.profile.reference.id === args[0]).profile;
      rows = [{ id: args[0], runner_id: profile.reference.runnerId, config_digest: profile.reference.configDigest, configuration: profile.configuration, revoked: false, capacity: 1, maintenance_state: 'accepting' }]; }
    else if (sql.includes('FROM flow.knowledge_versions')) rows = [{ content_digest: state.citation.contentDigest, byte_length: 114 }];
    mutate(sql, rows); return { rows };
  }, release() { events.push({ sql: 'release' }); } };
  return { pool: { async connect() { return db; } }, events };
}
test('continuation: real SQL consumer proves current goal/proposal/profiles/material, no authority or inflight, then releases', async t => {
  const f = await fixture(t), d = database(f), result = await verifyContinuationDatabase(d.pool, f.value);
  assert.equal(result.profilesMatched, 2); assert.equal(result.incompleteAttempts, 0);
  assert.equal(d.events[0].sql, 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  assert.equal(d.events.at(-2).sql, 'COMMIT'); assert.equal(d.events.at(-1).sql, 'release');
  assert(d.events.some(e => e.sql.includes('flow.goal_plan_confirmations')));
});
test('continuation: real SQL refuses stale revisions, authority, incomplete attempts and revoked profiles with rollback', async t => {
  const f = await fixture(t);
  for (const mutate of [(sql, rows) => { if (sql.includes('JOIN flow.projects')) rows[0].revision++; },
    (sql, rows) => { if (sql.includes('flow.goal_progressions')) rows.push({ present: true }); },
    (sql, rows) => { if (sql.includes('FROM flow.attempts')) rows[0].completed_at = null; },
    (sql, rows) => { if (sql.includes('FROM flow.execution_profiles')) rows[0].revoked = true; }]) {
    const d = database(f, mutate); await assert.rejects(verifyContinuationDatabase(d.pool, f.value));
    assert.equal(d.events.at(-2).sql, 'ROLLBACK'); assert.equal(d.events.at(-1).sql, 'release');
  }
});
test('continuation: real driver composition consumes grant before actual confirm consumer and preserves first write failure', async t => {
  const f = await fixture(t), first = new Error('synthetic new-stage allocation failure'), stateBefore = await readFile(join(f.privateRoot, 'journey.json'));
  let factories = 0;
  await assert.rejects(continueSavedPlan({ source: f.source, run: f.grant.run, grant: f.grant, runs: f.runs, reservations: f.reservations,
    createCenter: async (directory, source, options) => { factories++; assert.equal(options.stage, 'renew'); assert.equal(source, f.source);
      assert.equal((await readRecord(join(f.old, 'pause-consumed-plan.json'))).newRun, f.grant.run); throw first; } }), e => e === first);
  assert.equal(factories, 1); assert.deepEqual(await readFile(join(f.privateRoot, 'journey.json')), stateBefore);
  await assert.rejects(continueSavedPlan({ source: f.source, run: f.grant.run, grant: f.grant, runs: f.runs, reservations: f.reservations,
    createCenter: () => { throw new Error('must not be reached'); } }), { code: 'ERR_ASSERTION' });
});
test('continuation: actual confirmation driver publishes only a new pause with fresh source and retained origin', async t => {
  const f = await fixture(t), events = [], newPrivate = join(f.root, 'new-private');
  const originalState = await readFile(join(f.privateRoot, 'journey.json'));
  const result = await continueSavedPlan({ source: f.source, run: f.grant.run, grant: f.grant, runs: f.runs, reservations: f.reservations,
    async createCenter(directory, source, options) {
      const d = database(f); await verifyContinuationDatabase(d.pool, options.continuation);
      await mkdir(newPrivate, { mode: 0o700 }); const info = await lstat(newPrivate);
      await writeRecord(join(newPrivate, 'journey.json'), continuationState(options.continuation, source), { exclusive: true });
      const resources = { ...f.packet.resources, sourceDigest: source.digest, origin: f.grant.origin, retention: f.grant.retention,
        directory: { path: newPrivate, dev: info.dev, ino: info.ino } };
      return { root: newPrivate, async start(scan) { assert.equal(scan, false); events.push('start'); },
        client: { async goalGraphProposal(id) { assert.equal(id, f.packet.state.proposal.id); return f.packet.state.proposal; },
          async confirmGoalPlan(id, body, key) { events.push('confirm'); assert.deepEqual(body, f.grant.confirmation); assert(key);
            return { replayed: false, progression: { admissions: 0 }, confirmation: { goalId: f.packet.state.goalId, projectId: f.packet.state.projectId,
              proposalDigest: body.proposalDigest, confirmationDigest: 'c'.repeat(64), progressionId: 'progression', authorizationDigest: 'e'.repeat(64),
              inputs: body.nodes.map((n, i) => ({ key: n.key, nodeId: `node-${i}`, inputVersion: 1 })),
              graph: { nodeIds: Object.fromEntries(body.nodes.map((n, i) => [n.key, `node-${i}`])) } } }; } },
        async finish(options) { events.push('finish'); assert.equal(options.destroy, false); return resources; },
        async pause(phase, report) { events.push('pause'); const state = await readRecord(join(newPrivate, 'journey.json'));
          await writeRecord(join(directory, 'pause.json'), pauseReceipt({ run: f.grant.run, phase, state, report, resources, sourceDigest: source.digest })); } };
    } });
  assert.deepEqual(events, ['start', 'confirm', 'finish', 'pause']); assert.equal(result.admissions, 0);
  const pause = await readRecord(join(f.runs, f.grant.run, 'pause.json')); assert.equal(stagePassed('renew', result, pause), true);
  assert.equal(pause.next, 'children'); assert.notEqual(pause.sourceDigest, f.packet.pause.sourceDigest);
  const newState = await readRecord(join(newPrivate, 'journey.json'));
  assert.deepEqual(newState.runners, f.packet.state.runners); assert.equal(newState.materialFile, f.packet.state.materialFile);
  assert.deepEqual(await readFile(join(f.privateRoot, 'journey.json')), originalState);
  assert.deepEqual(await readRecord(join(f.old, 'pause.json')), f.packet.pause);
});
test('continuation: native children require actual confirmation and consume two distinct one-shot slots', async t => {
  const f = await environmentFixture(); t.after(f.dispose);
  const confirmation = { goalId: 'goal', proposalId: 'proposal', proposalDigest: 'b'.repeat(64), confirmationDigest: 'c'.repeat(64), progressionId: 'progression' };
  const raw = permitInput(f, 'children', confirmation), permit = validatePermit(raw, { identity: f.source, phase: 'children', confirmation, environmentDigest: f.policy.digest });
  assertNativeReady('native', permit, f.policy.digest); assert.throws(() => assertNativeReady('native', raw, f.policy.digest));
  const reservation = await reservePhase(f.root, permit);
  for (const n of [1, 2]) await consumeSlot(reservation, `child-${n}`, { taskId: `task-${n}`, attemptId: `attempt-${n}`, runnerId: 'runner', ownerVersion: 1 });
  await assert.rejects(consumeSlot(reservation, 'child-3', { taskId: 'task-3', attemptId: 'attempt-3', runnerId: 'runner', ownerVersion: 1 }));
});
test('continuation: explicit renew argv and adopted acceptance retain origin; ordinary decide still requires cleanup', async t => {
  const f = await fixture(t);
  assert.equal(operationArguments(['--renew', f.grant.run, '/synthetic-grant']).phase, 'renew');
  const report = { outcome: 'independently-accepted', retention: f.grant.retention,
    resources: { ...f.packet.resources, origin: f.grant.origin, retention: f.grant.retention } };
  assert.equal(stagePassed('decide', report), true);
  delete report.retention; assert.equal(stagePassed('decide', report), false);
});
test('continuation-final: real child adapter and decorator preserve read-only caps and consume one failed injected entry', async t => {
  const f = await environmentFixture({ authenticationHome: 'normal-account' }); t.after(f.dispose);
  const material = join(f.root, 'material.txt'); await writeFile(material, MATERIAL, { flag: 'wx', mode: 0o400 });
  const confirmation = { goalId: 'goal', proposalId: 'proposal', proposalDigest: 'b'.repeat(64), confirmationDigest: 'c'.repeat(64), progressionId: 'progression' };
  const raw = permitInput(f, 'children', confirmation), permit = validatePermit(raw, { identity: f.source, phase: 'children', confirmation, environmentDigest: f.policy.digest });
  const reservation = await reservePhase(join(f.root, 'reservations'), permit), report = { nativeQueryCalls: 0 }; let calls = 0;
  const query = createObservedQuery({ mode: 'native', phase: 'children', reservation, report, nativeEnvironment: f.nativeEnvironment,
    getBinding: () => ({ slot: 'child-1', assignment: { taskId: 'task', attemptId: 'attempt', runnerId: 'runner', ownerVersion: 1 } }),
    nativeQuery(actual) { calls++; assert.deepEqual(actual.options.tools, ['Read']); assert.deepEqual(actual.options.allowedTools, ['Read']);
      assert.deepEqual([actual.options.model, actual.options.maxTurns, actual.options.maxBudgetUsd, actual.options.persistSession], ['claude-sonnet-5-5', 3, .1, false]);
      assert.equal(actual.options.env.HOME, '/Users/citrine'); throw new Error('synthetic-stop-before-provider'); } });
  const adapter = createClaudeAdapter({ ...adapterOptions('native', 'children', material), query });
  await assert.rejects(adapter.run({ task: { title: 'Synthetic child', prompt: 'Read fixed material only', harness: 'claude' },
    workingDirectory: f.cwd, signal: new AbortController().signal, async assertOwnership() {}, async emit() {} }), /synthetic-stop-before-provider/);
  assert.equal(calls, 1); assert.equal(report.nativeQueryCalls, 1); assert.equal(report.queries[0].closed, true);
  assert.equal(report.queries[0].reservation.slot, 'child-1'); // Injected callback only; actual SDK count remains zero.
});
test('continuation-final: actual complete identity reverses to the fixed planner source without copying its closure', async t => {
  const source = await sourceIdentity(), proof = await readRecord(new URL('../../docs/evidence/o16/expired-plan-continuation/source-delta.json', import.meta.url));
  verifySourceDelta(source, proof.oldSourceDigest, proof.delta);
  t.diagnostic(JSON.stringify({ sourceDigest: source.digest, files: source.files.length, dependencies: source.dependencies.length,
    oldSourceDigest: proof.oldSourceDigest, deltaFiles: proof.delta.length }));
});
