import assert from 'node:assert/strict';
import { constants } from 'node:fs';
import { lstat, mkdir, open, realpath } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { canonical, sha256 } from '../../apps/server/src/database.ts';
import { goalProgressionAuthorizationSchema } from '../../packages/contracts/src/goal-progression.ts';
import { verifySourceDelta } from './continuation.mjs';
import { digest, readRecord, writeRecord } from './records.mjs';
import { pauseReceipt, recordDigest, REVIEW_MS } from './stage-policy.mjs';
import { expectedChildren } from './proposal.mjs';

const validated = new WeakSet();
const keys = (value, names) => assert.deepEqual(Object.keys(value).sort(), [...names].sort());
const frozen = value => { if (value && typeof value === 'object') { Object.values(value).forEach(frozen); Object.freeze(value); } return value; };
export const EXECUTION_MS = 150_000;
export const RENEWAL_HEADROOM_MS = REVIEW_MS + EXECUTION_MS;
const signal = () => AbortSignal.timeout(5000);

/** A new stage of the same run: never changes the old confirmation, source, pause or private state. */
export function validateProgressionRenewal(grant, packet, { source, run, environmentDigest, now = Date.now() }) {
  keys(grant, ['kind', 'authorizedBy', 'approvalId', 'authorizationReference', 'approvedAt', 'expiresAt', 'authorizationExpiresAt',
    'run', 'sourceDigest', 'environmentDigest', 'origin', 'sourceDelta', 'nativeQueries', 'remainingQueries', 'reason', 'retention']);
  assert(grant.kind === 'flow.o16.progression-renewal.v1' && grant.authorizedBy === 'Goal Owner'
    && /^[A-Za-z0-9-]{8,100}$/.test(grant.approvalId) && typeof grant.authorizationReference === 'string'
    && grant.authorizationReference.trim().length >= 10 && grant.authorizationReference.length <= 1000);
  const approved = Date.parse(grant.approvedAt), until = Date.parse(grant.expiresAt), executionUntil = Date.parse(grant.authorizationExpiresAt);
  assert(Number.isFinite(now) && approved <= now && now < until && until - approved <= 3600000
    && executionUntil >= until + RENEWAL_HEADROOM_MS && executionUntil - now <= 86400000,
  'Stage admission and center authorization need independent bounded deadlines.');
  assert(/^[a-z0-9][a-z0-9-]{3,63}$/.test(run) && grant.run === run && packet.pause.run === run
    && grant.sourceDigest === source.digest && grant.environmentDigest === environmentDigest
    && grant.nativeQueries === 0 && grant.remainingQueries === 2 && grant.retention === 'keep-origin-database-and-both-directories');
  assert(typeof grant.reason === 'string' && grant.reason.trim().length >= 10 && grant.reason.length <= 1000);
  const { pause, state, report, resources } = packet;
  assert(pause.phase === 'renew' && pause.next === 'children' && state.mode === 'native' && state.stage === 'confirmed'
    && state.origin && !state.executionAuthorizationBinding && Date.parse(state.confirmationIntent.body.expiresAt) <= now);
  assert.deepEqual(pause, pauseReceipt({ run, phase: 'renew', sourceDigest: pause.sourceDigest, state, report, resources,
    now: Date.parse(pause.closedAt) }));
  assert.deepEqual(report.actualConfirmation, state.confirmation);
  assert.deepEqual(report.confirmationBinding, state.confirmationBinding);
  assert.deepEqual(state.expected, expectedChildren(state.confirmation, state.confirmationIntent.body, state));
  assert(report.nativeQueryCalls === 0 && report.admissions === 0 && resources.origin && resources.retention === grant.retention);
  assert.deepEqual(grant.origin, { run, pauseDigest: recordDigest(pause), sourceDigest: pause.sourceDigest,
    stateDigest: pause.stateDigest, reportDigest: pause.reportDigest, resourcesDigest: pause.resourcesDigest,
    database: resources.database, marker: resources.marker, directory: resources.directory, confirmation: state.confirmationBinding });
  verifySourceDelta(source, pause.sourceDigest, grant.sourceDelta);
  const value = frozen(structuredClone({ grant, packet })); validated.add(value); return value;
}
export function assertProgressionRenewal(value, source) {
  assert(validated.has(value) && value.grant.sourceDigest === source.digest && Date.now() < Date.parse(value.grant.expiresAt),
    'Unknown or expired replacement admission.');
}
async function absent(path) { await assert.rejects(lstat(path), { code: 'ENOENT' }); }
export async function readProgressionRenewal(grant, { runs, ...options }) {
  assert(/^[a-z0-9][a-z0-9-]{3,63}$/.test(grant?.run));
  const directory = join(runs, grant.run); assert.equal(await realpath(directory), directory);
  await absent(join(directory, 'pause-consumed-renew.json'));
  await absent(join(directory, 'execution-authorization.json'));
  const resources = await readRecord(join(directory, 'resources.json')), root = resources.directory, info = await lstat(root.path);
  assert(info.isDirectory() && !info.isSymbolicLink() && await realpath(root.path) === root.path
    && info.dev === root.dev && info.ino === root.ino && info.uid === process.getuid() && (info.mode & 0o777) === 0o700);
  const packet = { resources, pause: await readRecord(join(directory, 'pause.json')),
    report: await readRecord(join(directory, 'confirmation.json'), 262144), state: await readRecord(join(root.path, 'journey.json')) };
  assert.equal(packet.state.materialFile, join(resources.origin.directory.path, 'material.txt'));
  const material = await open(packet.state.materialFile, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try { const meta = await material.stat(); assert(meta.isFile() && meta.size <= 4096 && (meta.mode & 0o222) === 0);
    const bytes = Buffer.alloc(4097), read = await material.read(bytes, 0, bytes.length, 0);
    assert(read.bytesRead === meta.size && digest(bytes.subarray(0, read.bytesRead)) === packet.state.citation.contentDigest); }
  finally { await material.close(); }
  return validateProgressionRenewal(grant, packet, options);
}
/** Same legacy gate prevents old children and all alternative grants/runs from consuming this origin. */
export async function reserveProgressionRenewal(root, value, source, runs) {
  assertProgressionRenewal(value, source); await mkdir(root, { recursive: true, mode: 0o700 });
  assert.equal(await realpath(root), resolve(root)); const directory = join(runs, value.grant.run);
  assert.equal(await realpath(directory), directory);
  await writeRecord(join(directory, 'pause-consumed-renew.json'), { receipt: value.packet.pause, continuedAt: new Date().toISOString(),
    replacementGrantDigest: recordDigest(value.grant) }, { exclusive: true });
  await writeRecord(join(root, `progression-renewal-${value.packet.state.confirmationBinding.confirmationDigest}.json`),
    { kind: 'flow.o16.progression-renewal-reservation.v1', grant: value.grant, at: new Date().toISOString(), outcome: 'unknown' }, { exclusive: true });
  await writeRecord(join(directory, 'execution-origin.json'), { grant: value.grant, archived: value.grant.origin,
    privateState: 'journey.json', publicRecords: ['confirmation.json', 'pause-renew.json', 'pause.json', 'resources.json'],
    retention: value.grant.retention }, { exclusive: true });
}
export function progressionRenewalState(value, source) {
  assertProgressionRenewal(value, source);
  return { ...structuredClone(value.packet.state), sourceDigest: source.digest, stage: 'reauthorizing-unknown' };
}
function assertEmpty(progression, state, expectedState) {
  assert(progression.id === state.expected.progressionId && progression.goalId === state.goalId && progression.projectId === state.projectId
    && progression.authorizationDigest === state.expected.authorizationDigest && progression.state === expectedState && progression.admissions === 0);
  assert(progression.nodes.length === 2 && new Set(progression.nodes.map(n => n.nodeId)).size === 2
    && progression.nodes.every(n => state.expected.nodes.some(e => e.nodeId === n.nodeId && e.inputVersion === n.inputVersion)
      && n.executionId === null && n.task === null && n.artifact === null));
  const body = goalProgressionAuthorizationSchema.parse(progression.authorization);
  assert.equal(sha256(canonical(body)), progression.authorizationDigest);
  assert(body.projectRevision === state.confirmation.graph.toRevision && body.maxAdmissions === 2 && body.nodes.length === 2
    && body.expiresAt === state.confirmationIntent.body.expiresAt && Date.parse(body.expiresAt) <= Date.now());
  assert(body.nodes.every(n => n.previousExecutionId === null && n.externalDependencies.length === 0));
  for (const n of body.nodes) { const fixed = state.expected.nodes.find(e => e.nodeId === n.nodeId); assert(fixed);
    assert.equal(n.inputVersion, fixed.inputVersion); assert.deepEqual(n.executionProfile, fixed.executionProfile); }
  return body;
}
/** Public reads before the first mutation. The endpoint itself is not a zero-admission CAS. */
export async function observeExpiredProgression(client, value) {
  assert(validated.has(value)); const state = value.packet.state;
  const old = await client.goalProgression(state.goalId, state.expected.progressionId, signal());
  const body = assertEmpty(old, state, 'expired');
  const plan = await client.goalDelivery(state.goalId, { view: 'plan', limit: 3 }, signal());
  assert(plan.goalId === state.goalId && plan.projectId === state.projectId && plan.projectRevision === body.projectRevision
    && plan.totalNodes === 2 && plan.nodes.length === 2 && plan.nextCursor === null);
  for (const n of body.nodes) { const actual = plan.nodes.find(x => x.id === n.nodeId);
    assert(actual?.version === n.nodeVersion); assert.deepEqual(actual.inputRef, { goalId: state.goalId, nodeId: n.nodeId, version: n.inputVersion }); }
  const current = await client.goalDelivery(state.goalId, { view: 'state', nodeIds: body.nodes.map(n => n.nodeId) }, signal());
  assert(current.goalId === state.goalId && current.projectId === state.projectId && current.nodes.length === 2);
  for (const n of body.nodes) {
    const actual = current.nodes.find(x => x.nodeId === n.nodeId); assert(actual?.execution === null && actual.accepted === null && actual.knowledgeCurrent === true);
    const defined = await client.readGoalInput(state.goalId, n.nodeId, n.inputVersion, signal());
    const key = state.confirmation.inputs.find(x => x.nodeId === n.nodeId).key;
    assert(defined.nodeId === n.nodeId && defined.version === n.inputVersion);
    assert.deepEqual(defined.input, state.proposal.input.inputProposal.nodes.find(x => x.key === key).input);
    const executions = await client.goalExecutions(state.goalId, { nodeId: n.nodeId, limit: 1 }, signal());
    assert.deepEqual(executions, { executions: [], nextCursor: null });
  }
  const proposal = await client.goalGraphProposal(state.proposal.id, signal());
  assert.equal(proposal.proposalDigest, state.proposal.proposalDigest); assert.deepEqual(proposal.input, state.proposal.input);
  const profiles = await client.executionProfiles({ limit: 3 }, signal());
  assert(profiles.nextCursor === null); const profile = profiles.profiles.find(p => p.reference.id === state.runners.children.profile.reference.id);
  assert(profile); assert.deepEqual(profile.reference, state.runners.children.profile.reference); assert.deepEqual(profile.configuration, state.runners.children.profile.configuration);
  return old;
}
/** Each write has its own durable intent and ACK; an exception never triggers a second network attempt. */
export async function replaceExpiredProgression(client, value, persist) {
  assert(validated.has(value)); const { state } = value.packet;
  const old = await observeExpiredProgression(client, value);
  assert(Date.now() < Date.parse(value.grant.expiresAt));
  const revoke = { key: randomUUID(), goalId: state.goalId, progressionId: old.id, body: { reason: value.grant.reason } };
  await persist('revoke-intent', revoke);
  const revoked = await client.revokeGoalProgression(revoke.goalId, revoke.progressionId, revoke.body, revoke.key, signal());
  assertEmpty(revoked.progression, state, 'revoked'); assert(revoked.progression.revokedAt);
  await persist('revoke-ack', revoked);
  const body = goalProgressionAuthorizationSchema.parse({ ...old.authorization, expiresAt: value.grant.authorizationExpiresAt, reason: value.grant.reason });
  assert(Date.parse(body.expiresAt) - Date.now() >= RENEWAL_HEADROOM_MS && Date.now() < Date.parse(value.grant.expiresAt));
  const create = { key: randomUUID(), goalId: state.goalId, body }; await persist('create-intent', create);
  const accepted = await client.authorizeGoalProgression(state.goalId, body, create.key, signal());
  const expectedDigest = sha256(canonical(body));
  function assertCreated(p) {
    assert(p.id !== old.id && p.goalId === state.goalId && p.projectId === state.projectId && p.state === 'active'
      && p.admissions === 0 && p.revokedAt === null && p.authorizationDigest === expectedDigest);
    assert.deepEqual(p.authorization, body); assert(p.nodes.length === 2 && new Set(p.nodes.map(n => n.nodeId)).size === 2
      && p.nodes.every(n => body.nodes.some(x => x.nodeId === n.nodeId && x.inputVersion === n.inputVersion)
        && n.executionId === null && n.task === null && n.artifact === null));
  }
  assertCreated(accepted.progression); await persist('create-ack', accepted);
  const observed = await client.goalProgression(state.goalId, accepted.progression.id, signal()); assertCreated(observed);
  assert(Date.parse(body.expiresAt) - Date.now() >= RENEWAL_HEADROOM_MS);
  return { oldProgression: revoked.progression, progression: observed, executionAuthorizationBinding: {
    goalId: state.goalId, proposalId: state.proposal.id, proposalDigest: state.proposal.proposalDigest,
    confirmationDigest: state.confirmationBinding.confirmationDigest, oldProgressionId: old.id,
    progressionId: observed.id, authorizationDigest: observed.authorizationDigest, expiresAt: body.expiresAt } };
}
