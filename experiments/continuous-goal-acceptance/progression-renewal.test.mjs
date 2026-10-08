import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, lstat, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FlowClient } from '../../packages/client/src/index.ts';
import { canonical, sha256 } from '../../apps/server/src/database.ts';
import { digest, readRecord, writeRecord } from './records.mjs';
import { MATERIAL } from './config.mjs';
import { expectedChildren } from './proposal.mjs';
import { pauseReceipt, validatePause, recordDigest, stagePassed, stageRecords } from './stage-policy.mjs';
import { validateProgressionRenewal, readProgressionRenewal, reserveProgressionRenewal, progressionRenewalState,
  observeExpiredProgression, replaceExpiredProgression, RENEWAL_HEADROOM_MS } from './progression-renewal.mjs';
import { nativeEnvironmentPolicy } from './native-environment.mjs';
import { replaceSavedAuthorization } from './driver.mjs';
import { validatePermit, reservePhase, consumeSlot, assertNativePermit } from './permit.mjs';
import { environmentFixture, permitInput } from './native-environment-fixture.mjs';
import { operationArguments } from './operator.mjs';
import { measureFinalRun } from './operator-bounds.mjs';
import { bindChildAssignment } from './assignment.mjs';
import { sourceIdentity } from './identity.mjs';
import { verifySourceDelta } from './continuation.mjs';

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'o16-progression-renewal-')), identity = await lstat(root);
  t.after(async () => { const s = await lstat(root); assert(s.dev === identity.dev && s.ino === identity.ino); await rm(root, { recursive: true }); });
  const runs = join(root, 'runs'), run = 'same-approved-run', directory = join(runs, run), runtime = join(root, 'renew-private'), original = join(root, 'original-private');
  for (const p of [directory, runtime, original]) await mkdir(p, { recursive: true, mode: 0o700 });
  const stat = await lstat(runtime), originStat = await lstat(original);
  const plan = await readRecord(new URL('../../docs/evidence/o16/runs/native-plan-normal-home-20261008-once/plan.json', import.meta.url), 262144);
  const actual = await readRecord(new URL('../../docs/evidence/o16/runs/native-children-continuation-20261008-once/confirmation.json', import.meta.url), 262144);
  const oldGrant = await readRecord(new URL('../../docs/evidence/o16/native-children-continuation-20261008-once/grant.json', import.meta.url));
  const before = { path: 'experiments/continuous-goal-acceptance/permit.mjs', bytes: 1, sha256: 'a'.repeat(64) }, after = { ...before, bytes: 2, sha256: 'b'.repeat(64) };
  const dependencies = [], oldDigest = digest(JSON.stringify({ files: [before], dependencies }));
  const source = { root, files: [after], dependencies }; source.digest = digest(JSON.stringify({ files: source.files, dependencies }));
  const confirmation = structuredClone(actual.actualConfirmation), body = structuredClone(oldGrant.confirmation);
  body.expiresAt = new Date(Date.now() - 60000).toISOString();
  const authorization = { protocol: 'flow.goal-progression.v1', projectRevision: confirmation.graph.toRevision,
    nodes: body.nodes.map(n => ({ nodeId: confirmation.graph.nodeIds[n.key], nodeVersion: 1,
      inputVersion: 1, previousExecutionId: null, executionProfile: n.executionProfile, externalDependencies: [] })),
    maxAdmissions: 2, intermediatePolicy: body.intermediatePolicy, expiresAt: body.expiresAt, reason: body.reason };
  confirmation.authorizationDigest = sha256(canonical(authorization));
  const state = { mode: 'native', stage: 'confirmed', sourceDigest: oldDigest, goalId: confirmation.goalId, projectId: confirmation.projectId,
    proposal: plan.proposal, admitted: { runId: plan.proposal.source.runId, taskId: plan.proposal.source.taskId },
    citation: plan.proposal.input.inputProposal.nodes[0].input.knowledge[0], materialFile: join(original, 'material.txt'),
    origin: { run: 'original-plan', directory: { path: original, dev: originStat.dev, ino: originStat.ino } },
    confirmationIntent: { key: 'original-key', body }, confirmation,
    confirmationBinding: { goalId: confirmation.goalId, proposalId: confirmation.proposalId, proposalDigest: confirmation.proposalDigest,
      confirmationDigest: confirmation.confirmationDigest, progressionId: confirmation.progressionId },
    runners: Object.fromEntries(['plan', 'children'].map(phase => [phase, { token: 'synthetic-token', profile: {
      reference: body.nodes[0].executionProfile, configuration: { access: 'configured-readonly', fixture: phase } } }])) };
  state.expected = expectedChildren(confirmation, body, state);
  const resources = { kind: 'flow.o16.private-resources.v1', phase: 'paused-owned-resources', sourceDigest: oldDigest,
    database: 'flow_o16_' + 'a'.repeat(32), marker: '11111111-1111-4111-8111-111111111111',
    directory: { path: runtime, dev: stat.dev, ino: stat.ino }, origin: state.origin,
    retention: 'keep-origin-database-and-both-directories', marked: true, serverClosed: true, adminClosed: true, workersStopped: true,
    workerProcesses: [], errors: [], connectionObservations: [{ rows: [] }] };
  const report = { stage: 'confirm', mode: 'native', outcome: 'confirmed-awaiting-separate-children-permit', nativeQueryCalls: 0,
    admissions: 0, actualConfirmation: confirmation, confirmationBinding: state.confirmationBinding, resources };
  const pause = pauseReceipt({ run, phase: 'renew', state, report, resources, sourceDigest: oldDigest, now: Date.now() - 1200000 });
  const packet = { state, report, resources, pause };
  const grant = { kind: 'flow.o16.progression-renewal.v1', authorizedBy: 'Goal Owner', approvalId: 'synthetic-renewal-only',
    authorizationReference: 'Synthetic approved replacement; never an actual GO or resource window.', approvedAt: new Date(Date.now() - 1000).toISOString(),
    expiresAt: new Date(Date.now() + 600000).toISOString(), authorizationExpiresAt: new Date(Date.now() + 2700000).toISOString(),
    run, sourceDigest: source.digest, environmentDigest: nativeEnvironmentPolicy.digest, nativeQueries: 0, remainingQueries: 2,
    reason: 'Synthetic two-node unchanged authorization only.', retention: resources.retention,
    origin: { run, pauseDigest: recordDigest(pause), sourceDigest: oldDigest, stateDigest: pause.stateDigest, reportDigest: pause.reportDigest,
      resourcesDigest: pause.resourcesDigest, database: resources.database, marker: resources.marker, directory: resources.directory, confirmation: state.confirmationBinding },
    sourceDelta: [{ path: before.path, before, after }] };
  for (const [name, value] of Object.entries({ 'pause.json': pause, 'pause-renew.json': pause, 'resources.json': resources, 'confirmation.json': report })) await writeRecord(join(directory, name), value);
  await writeRecord(join(runtime, 'journey.json'), state); await writeFile(state.materialFile, MATERIAL, { mode: 0o400, flag: 'wx' });
  const options = { runs, run, source, environmentDigest: nativeEnvironmentPolicy.digest };
  const value = await readProgressionRenewal(grant, options);
  const old = { id: confirmation.progressionId, goalId: state.goalId, projectId: state.projectId, authorization, authorizationDigest: confirmation.authorizationDigest,
    state: 'expired', admissions: 0, revokedAt: null, nodes: authorization.nodes.map(n => ({ nodeId: n.nodeId, inputVersion: n.inputVersion, executionId: null, task: null, artifact: null })) };
  return { root, runs, run, directory, runtime, original, reservations: join(root, 'reservations'), packet, source, grant, options, value, old };
}
function clientFixture(t, f, mutate = () => {}, failure) {
  const events = [], records = new Map(); let current = structuredClone(f.old), created;
  t.mock.method(globalThis, 'fetch', async (url, options = {}) => {
    const u = new URL(url), method = options.method ?? 'GET', body = options.body ? JSON.parse(options.body) : null;
    events.push({ method, path: u.pathname, body, key: new Headers(options.headers).get('idempotency-key') });
    let data;
    if (method === 'POST' && u.pathname.endsWith('/revoke')) { if (failure === 'revoke') throw new Error('lost-revoke-ack');
      current.state = 'revoked'; current.revokedAt = new Date().toISOString(); data = { progression: current, replayed: false }; }
    else if (method === 'POST' && u.pathname.endsWith('/progressions')) { if (failure === 'create') throw new Error('lost-create-ack');
      created = { ...current, id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', authorization: body, authorizationDigest: sha256(canonical(body)), state: 'active', revokedAt: null };
      data = { progression: created, replayed: false }; }
    else if (u.pathname.includes('/progressions/')) data = u.pathname.endsWith(f.old.id) ? current : created;
    else if (u.pathname.endsWith('/delivery') && u.searchParams.get('view') === 'plan') data = { goalId: f.packet.state.goalId, projectId: f.packet.state.projectId,
      projectRevision: f.old.authorization.projectRevision, totalNodes: 2, nextCursor: null, nodes: f.old.authorization.nodes.map(n => ({ id: n.nodeId, version: n.nodeVersion,
        inputRef: { goalId: f.packet.state.goalId, nodeId: n.nodeId, version: n.inputVersion } })) };
    else if (u.pathname.endsWith('/delivery')) data = { goalId: f.packet.state.goalId, projectId: f.packet.state.projectId,
      nodes: f.old.nodes.map(n => ({ nodeId: n.nodeId, execution: null, accepted: null, knowledgeCurrent: true })) };
    else if (u.pathname.includes('/inputs/')) { const n = f.packet.state.confirmation.inputs.find(n => u.pathname.endsWith(n.nodeId));
      data = { nodeId: n.nodeId, version: n.inputVersion, input: f.packet.state.proposal.input.inputProposal.nodes.find(x => x.key === n.key).input }; }
    else if (u.pathname.endsWith('/executions')) data = { executions: [], nextCursor: null };
    else if (u.pathname.includes('/goal-graph-proposals/')) data = f.packet.state.proposal;
    else if (u.pathname.endsWith('/execution-profiles')) data = { profiles: [f.packet.state.runners.children.profile], nextCursor: null };
    else throw new Error('Unexpected public endpoint ' + u.pathname);
    data = structuredClone(data); mutate(u, method, data);
    return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
  });
  return { client: new FlowClient({ baseUrl: 'http://synthetic.invalid', token: 'synthetic-owner' }), events, records,
    async persist(name, value) { assert(!records.has(name)); records.set(name, structuredClone(value)); } };
}
test('progression-renewal: same run keeps old expired pause and separates admission from execution deadline', async t => {
  const f = await fixture(t);
  assert.throws(() => validatePause(f.packet.pause, { ...f.packet, run: f.run, phase: 'children', sourceDigest: f.packet.pause.sourceDigest }), /expired/);
  for (const mutate of [g => g.run = 'another-run', g => g.nativeQueries = 1, g => g.remainingQueries = 3,
    g => g.authorizationExpiresAt = g.expiresAt, g => g.expiresAt = g.approvedAt, g => g.origin.confirmation.progressionId = 'wrong',
    g => g.sourceDelta[0].after.bytes++, g => g.environmentDigest = '0'.repeat(64)]) {
    const grant = structuredClone(f.grant); mutate(grant); assert.throws(() => validateProgressionRenewal(grant, f.packet, f.options));
  }
  const state = progressionRenewalState(f.value, f.source);
  assert.deepEqual(state.confirmationBinding, f.packet.state.confirmationBinding); assert.equal(state.materialFile, f.packet.state.materialFile);
  assert.equal(state.origin.directory.path, f.original); assert.equal(state.stage, 'reauthorizing-unknown');
});
test('progression-renewal: actual packet reader rejects private changes and symlink without consuming the source', async t => {
  const f = await fixture(t); await writeRecord(join(f.runtime, 'journey.json'), { ...f.packet.state, stage: 'children-started-unknown' });
  await assert.rejects(readProgressionRenewal(f.grant, f.options)); await writeRecord(join(f.runtime, 'journey.json'), f.packet.state);
  await rm(f.packet.state.materialFile); await symlink(join(f.directory, 'confirmation.json'), f.packet.state.materialFile);
  await assert.rejects(readProgressionRenewal(f.grant, f.options)); await assert.rejects(lstat(join(f.directory, 'pause-consumed-renew.json')), { code: 'ENOENT' });
});
test('progression-renewal: shared wx blocks old children and a second grant while every original remains byte equal', async t => {
  const f = await fixture(t), paths = ['pause.json', 'pause-renew.json', 'resources.json', 'confirmation.json'].map(n => join(f.directory, n));
  paths.push(join(f.runtime, 'journey.json')); const before = await Promise.all(paths.map(p => readFile(p)));
  await reserveProgressionRenewal(f.reservations, f.value, f.source, f.runs);
  await assert.rejects(writeRecord(join(f.directory, 'pause-consumed-renew.json'), { legacy: true }, { exclusive: true }), { code: 'EEXIST' });
  const other = validateProgressionRenewal({ ...f.grant, approvalId: 'another-approved-stage' }, f.packet, f.options);
  await assert.rejects(reserveProgressionRenewal(f.reservations, other, f.source, f.runs), { code: 'EEXIST' });
  for (let i = 0; i < paths.length; i++) assert.deepEqual(await readFile(paths[i]), before[i]);
});
test('progression-renewal: real public client observes then revokes and creates exact unchanged nodes with separate durable ACKs', async t => {
  const f = await fixture(t), c = clientFixture(t, f), result = await replaceExpiredProgression(c.client, f.value, c.persist);
  assert.deepEqual([...c.records.keys()], ['revoke-intent', 'revoke-ack', 'create-intent', 'create-ack']);
  const writes = c.events.filter(e => e.method === 'POST'); assert.equal(writes.length, 2);
  assert(writes[0].path.endsWith('/revoke') && writes[1].path.endsWith('/progressions') && writes[0].key !== writes[1].key);
  const expected = { ...f.old.authorization, expiresAt: f.grant.authorizationExpiresAt, reason: f.grant.reason };
  assert.deepEqual(writes[1].body, expected); assert.equal(result.executionAuthorizationBinding.oldProgressionId, f.packet.state.confirmationBinding.progressionId);
  assert.notEqual(result.executionAuthorizationBinding.progressionId, result.executionAuthorizationBinding.oldProgressionId);
  assert.deepEqual(f.packet.state.confirmationBinding, f.grant.origin.confirmation);
});
test('progression-renewal: nonzero admission or changed input material profile blocks all mutation', async t => {
  const f = await fixture(t);
  for (const mutate of [(u,m,d) => { if (u.pathname.includes('/progressions/')) d.admissions = 1; },
    (u,m,d) => { if (u.pathname.includes('/inputs/')) d.input.acceptance = 'changed'; },
    (u,m,d) => { if (u.searchParams.get('view') === 'state') d.nodes[0].knowledgeCurrent = false; },
    (u,m,d) => { if (u.pathname.endsWith('/execution-profiles')) d.profiles[0].configuration.access = 'unknown'; }]) {
    const c = clientFixture(t, f, mutate); await assert.rejects(observeExpiredProgression(c.client, f.value));
    assert.equal(c.events.filter(e => e.method === 'POST').length, 0);
  }
});
test('progression-renewal: lost create ACK preserves revoke and intent with no retry or rollback', async t => {
  const f = await fixture(t), c = clientFixture(t, f, undefined, 'create');
  await assert.rejects(replaceExpiredProgression(c.client, f.value, c.persist), /lost-create-ack/);
  assert.deepEqual([...c.records.keys()], ['revoke-intent', 'revoke-ack', 'create-intent']);
  assert.equal(c.events.filter(e => e.method === 'POST').length, 2);
});
test('progression-renewal: first intent write failure leaves zero public mutations', async t => {
  const f = await fixture(t), c = clientFixture(t, f), original = new Error('synthetic durable failure');
  await assert.rejects(replaceExpiredProgression(c.client, f.value, async () => { throw original; }), e => e === original);
  assert.equal(c.events.filter(e => e.method === 'POST').length, 0);
});
test('progression-renewal: actual driver preserves same private and old state while closing before fresh execution pause', async t => {
  const f = await fixture(t), c = clientFixture(t, f), events = [], oldState = await readFile(join(f.runtime, 'journey.json'));
  const result = await replaceSavedAuthorization({ ...f.options, grant: f.grant, reservations: f.reservations,
    async createCenter(directory, source, options) {
      assert.equal(options.stage, 'reauthorize'); assert.equal(options.replacement.packet.resources.directory.path, f.runtime);
      assert.equal((await readRecord(join(directory, 'pause-consumed-renew.json'))).replacementGrantDigest, recordDigest(f.grant));
      const stateFile = join(f.runtime, stageRecords('reauthorize').state); await writeRecord(stateFile, progressionRenewalState(options.replacement, source), { exclusive: true });
      const resources = { ...f.packet.resources, sourceDigest: source.digest, replacementOrigin: f.grant.origin };
      return { root: f.runtime, stateFile, client: c.client, async start(scan) { assert.equal(scan, false); events.push('start'); },
        async finish(opts) { assert.equal(opts.destroy, false); events.push('closed'); return resources; },
        async pause(phase, report) { events.push('pause'); const state = await readRecord(stateFile);
          await writeRecord(join(directory, stageRecords(phase).pause), pauseReceipt({ run: f.run, phase, sourceDigest: source.digest, state, report, resources })); } };
    } });
  assert.deepEqual(events, ['start', 'closed', 'pause']); assert.equal(result.nativeQueryCalls, 0);
  assert.deepEqual(await readFile(join(f.runtime, 'journey.json')), oldState);
  assert.equal(stagePassed('reauthorize', result, await readRecord(join(f.directory, 'execution-pause.json'))), true);
  assert.deepEqual((await readRecord(join(f.runtime, 'journey-execution.json'))).confirmationBinding, f.packet.state.confirmationBinding);
});
test('progression-renewal: v3 permit and actual assignment consume only the new progression and two bounded slots', async t => {
  const f = await fixture(t), c = clientFixture(t, f), result = await replaceExpiredProgression(c.client, f.value, c.persist);
  const e = await environmentFixture({ authenticationHome: 'normal-account' }); t.after(e.dispose);
  const confirmation = f.packet.state.confirmationBinding, executionAuthorization = result.executionAuthorizationBinding;
  const raw = { ...permitInput(e, 'children', confirmation), kind: 'flow.o16.phase-permit.v3', executionAuthorization };
  const options = { identity: e.source, phase: 'children', confirmation, executionAuthorization, environmentDigest: e.policy.digest };
  const permit = validatePermit(raw, options); assertNativePermit(permit, e.policy.digest);
  for (const change of [p => p.executionAuthorization.progressionId = confirmation.progressionId,
    p => p.confirmation.progressionId = executionAuthorization.progressionId, p => p.executionAuthorization.authorizationDigest = '0'.repeat(64)]) {
    const changed = structuredClone(raw); change(changed); assert.throws(() => validatePermit(changed, options));
  }
  const reservation = await reservePhase(join(e.root, 'reservations'), permit);
  const expected = { ...f.packet.state.expected, progressionId: executionAuthorization.progressionId, authorizationDigest: executionAuthorization.authorizationDigest };
  for (let i=0; i<2; i++) {
    const node = expected.nodes[i], actual = { taskId: `task-${i}`, attemptId: `attempt-${i}`, runnerId: node.executionProfile.runnerId, ownerVersion: 1 };
    const current = { progression: { ...result.progression, nodes: result.progression.nodes.map(n => n.nodeId === node.nodeId
      ? { ...n, executionId: `execution-${i}`, task: { id: actual.taskId, status: 'running' } } : n) }, delivery: { goalId: expected.goalId, projectId: expected.projectId,
      nodes: [{ nodeId: node.nodeId, knowledgeCurrent: true, inputRef: { goalId: expected.goalId, nodeId: node.nodeId, version: node.inputVersion },
        execution: { id: `execution-${i}`, inputCurrent: true, inputRef: { goalId: expected.goalId, nodeId: node.nodeId, version: node.inputVersion }, task: { id: actual.taskId, status: 'running', attemptId: actual.attemptId, ownerVersion: 1 } } }] } };
    const binding = bindChildAssignment(expected, current, actual, node.executionProfile); await consumeSlot(reservation, binding.slot, actual);
    assert.throws(() => bindChildAssignment(f.packet.state.expected, current, actual, node.executionProfile));
  }
  await assert.rejects(consumeSlot(reservation, 'child-3', { taskId: 'third', attemptId: 'third', runnerId: 'runner', ownerVersion: 1 }));
});
test('progression-renewal: actual stage paths and meter select preserved execution records and refuse short pause coverage', async t => {
  const f = await fixture(t);
  for (const phase of ['reauthorize', 'continued-children', 'continued-decide']) {
    assert.equal(operationArguments([`--${phase}`, f.run, '/synthetic-input']).phase, phase);
    let selected; const result = await measureFinalRun(f.run, f.source.digest, { phase,
      async read(p) { selected = p; return { ...f.packet.resources, sourceDigest: f.source.digest }; }, async measure() { return { rawBytes: 1 }; } });
    assert(selected.endsWith('/execution-resources.json')); assert.equal(result.metrics.rawBytes, 1);
  }
  assert.equal(stageRecords('children').resources, 'resources.json');
  const state = { ...f.packet.state, sourceDigest: f.source.digest, stage: 'reauthorized', executionAuthorizationBinding: { expiresAt: new Date(Date.now() + RENEWAL_HEADROOM_MS - 10000).toISOString() } };
  assert.throws(() => pauseReceipt({ run: f.run, phase: 'reauthorize', sourceDigest: f.source.digest, state,
    report: { outcome: 'reauthorized-awaiting-separate-children-permit' }, resources: { ...f.packet.resources, sourceDigest: f.source.digest } }), /expire/);
});
test('progression-renewal-source: actual complete source inverse preserves original confirmed source and dependencies', async () => {
  const source = await sourceIdentity(), proof = await readRecord(new URL('../../docs/evidence/o16/progression-renewal/source-delta.json', import.meta.url));
  verifySourceDelta(source, proof.oldSourceDigest, proof.delta);
});
