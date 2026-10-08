import assert from 'node:assert/strict';
import { digest } from './records.mjs';
import { assertNativePermit } from './permit.mjs';

export const REVIEW_MS = 15 * 60_000;
const STAGES = Object.freeze({
  plan: { file: 'plan.json', outcome: 'actual-proposal-awaiting-owner', state: 'planned', next: 'confirm' },
  confirm: { file: 'confirmation.json', outcome: 'confirmed-awaiting-separate-children-permit', state: 'confirmed', next: 'children' },
  renew: { file: 'confirmation.json', outcome: 'confirmed-awaiting-separate-children-permit', state: 'confirmed', next: 'children' },
  reauthorize: { file: 'execution-authorization.json', outcome: 'reauthorized-awaiting-separate-children-permit', state: 'reauthorized', next: 'continued-children', executionRecords: true },
  'continued-children': { file: 'continued-children.json', outcome: 'artifacts-awaiting-independent-review', state: 'awaiting-independent-review', next: 'continued-decide', executionRecords: true, nativePhase: 'children' },
  'continued-decide': { file: 'continued-decision.json', executionRecords: true },
  children: { file: 'children.json', outcome: 'artifacts-awaiting-independent-review', state: 'awaiting-independent-review', next: 'decide' },
  decide: { file: 'decision.json' }, rehearse: { file: 'decision.json' },
});
export function stageSpec(phase) { assert(Object.hasOwn(STAGES, phase)); return STAGES[phase]; }
const LEGACY_RECORDS = Object.freeze({ resources: 'resources.json', state: 'journey.json', pause: 'pause.json' });
const EXECUTION_RECORDS = Object.freeze({ resources: 'execution-resources.json', state: 'journey-execution.json', pause: 'execution-pause.json' });
export function stageRecords(phase) { return stageSpec(phase).executionRecords ? EXECUTION_RECORDS : LEGACY_RECORDS; }
export const recordDigest = value => digest(JSON.stringify(value));

/** No login boolean: a new trusted handoff must match the fixed source and environment recipe. */
export function assertNativeReady(mode, permit, environmentDigest) {
  assert(['native', 'rehearsal'].includes(mode));
  if (mode === 'native') assertNativePermit(permit, environmentDigest);
}

function closure(resources) {
  assert(resources.phase === 'paused-owned-resources' && resources.serverClosed === true && resources.adminClosed === true
    && resources.workersStopped === true && resources.marked === true && resources.databaseDropped !== true
    && resources.directoryRemoved !== true && Array.isArray(resources.errors) && resources.errors.length === 0);
  assert(Array.isArray(resources.connectionObservations) && resources.connectionObservations.at(-1)?.rows?.length === 0);
  assert((resources.workerProcesses ?? []).every(row => row.state === 'stopped'));
}
function publicBinding(state) {
  assert(state.proposal?.id && /^[a-f0-9]{64}$/.test(state.proposal.proposalDigest));
  const profiles = Object.fromEntries(['plan', 'children'].map(phase => {
    const reference = state.runners?.[phase]?.profile?.reference; assert(reference && reference.runnerId);
    return [phase, structuredClone(reference)];
  }));
  return { goalId: state.goalId, proposalId: state.proposal.id, proposalDigest: state.proposal.proposalDigest,
    profiles, confirmation: state.confirmationBinding ?? null,
    ...(state.executionAuthorizationBinding ? { executionAuthorization: state.executionAuthorizationBinding } : {}) };
}

/** Immutable review material: closure precedes the receipt; expiry refuses continuation, never deletes. */
export function pauseReceipt({ run, phase, sourceDigest, state, report, resources, now = Date.now() }) {
  const spec = stageSpec(phase); assert(spec.next && Number.isFinite(now)); closure(resources);
  assert.equal(state.stage, spec.state); assert.equal(report.outcome, spec.outcome);
  assert(!report.primaryFailure && !report.failure && !report.cleanupFailure && !report.pauseFailure);
  assert.equal(resources.sourceDigest, sourceDigest); assert.equal(state.sourceDigest, sourceDigest);
  if (phase === 'reauthorize') assert(Date.parse(state.executionAuthorizationBinding?.expiresAt) >= now + REVIEW_MS + 150000,
    'New authorization cannot expire within its fresh review and full child stage.');
  return { kind: 'flow.o16.pause.v1', run, phase, next: spec.next, sourceDigest,
    closedAt: new Date(now).toISOString(), reviewUntil: new Date(now + REVIEW_MS).toISOString(),
    binding: publicBinding(state), stateDigest: recordDigest(state), reportDigest: recordDigest(report),
    resourcesDigest: recordDigest(resources), database: resources.database, marker: resources.marker,
    directory: structuredClone(resources.directory), closure: 'recorded-processes-server-pools-and-connections-closed',
    allEscapedDescendants: 'not-proven', expiredAction: 'refuse-and-retain' };
}
export function validatePause(receipt, { run, phase, sourceDigest, state, report, resources, now = Date.now() }) {
  assert(receipt?.kind === 'flow.o16.pause.v1' && receipt.run === run && receipt.next === phase && receipt.sourceDigest === sourceDigest);
  const closed = Date.parse(receipt.closedAt), until = Date.parse(receipt.reviewUntil);
  assert(Number.isFinite(now) && closed <= now && now < until && until - closed === REVIEW_MS, 'Review expired or clock unconfirmed; retain resources.');
  const expected = pauseReceipt({ run, phase: receipt.phase, sourceDigest, state, report, resources, now: closed });
  assert.deepEqual(receipt, expected, 'Paused proposal/profile/source or resource closure changed.');
  return receipt;
}

export function failureFact(error) {
  return { state: 'unconfirmed', name: typeof error?.name === 'string' ? error.name.slice(0, 80) : 'Error',
    code: typeof error?.code === 'string' && /^[A-Z0-9_]{1,80}$/.test(error.code) ? error.code : null };
}
/** The first error survives all later shutdown/checkpoint failures. No irreversible cleanup before durability. */
export async function settleStage(report, { primaryError, persist, dispose = async () => {}, finish, pause, destroy = false }) {
  let first = primaryError, durable = false;
  if (primaryError) report.primaryFailure = failureFact(primaryError);
  const recordFailure = (field, error) => {
    const fact = failureFact(error);
    if (report[field]) { report.secondaryFailures ??= []; report.secondaryFailures.push({ phase: field, ...fact }); }
    else report[field] = fact;
    first ??= error;
  };
  try { await persist(report); durable = true; } catch (error) { recordFailure('evidenceFailure', error); }
  try { await dispose(); } catch (error) { recordFailure('cleanupFailure', error); }
  try { report.resources = await finish({ destroy: destroy && durable && !first, workersStopped: report.workerStopped ?? true }); }
  catch (error) { recordFailure('cleanupFailure', error); }
  try { await persist(report); } catch (error) { recordFailure('evidenceFailure', error); }
  if (!first && pause) {
    try { await pause(report); } catch (error) {
      recordFailure('pauseFailure', error);
      try { await persist(report); } catch (saved) { recordFailure('evidenceFailure', saved); }
    }
  }
  if (first) throw first;
  return report;
}

export function stagePassed(phase, report, receipt) {
  const spec = stageSpec(phase);
  if (spec.next) return report?.outcome === spec.outcome && receipt?.phase === phase && receipt?.next === spec.next
    && receipt.reportDigest === recordDigest(report) && receipt.resourcesDigest === recordDigest(report.resources)
    && Date.now() < Date.parse(receipt.reviewUntil);
  if (['decide', 'continued-decide'].includes(phase) && report?.retention === 'keep-origin-database-and-both-directories'
    && report.resources?.origin && report.resources.retention === report.retention) {
    try { closure(report.resources); } catch { return false; }
    return ['independently-accepted', 'independently-rejected'].includes(report.outcome);
  }
  return ['independently-accepted', ...(phase === 'decide' ? ['independently-rejected'] : [])].includes(report?.outcome)
    && report.resources?.databaseDropped === true && report.resources?.directoryRemoved === true && report.resources?.errors?.length === 0;
}
