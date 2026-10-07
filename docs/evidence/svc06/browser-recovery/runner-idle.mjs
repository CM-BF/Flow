/** Exact fixed-04da admission shape; no claim, repair, replay, or inferred empty-poll success. */
import assert from 'node:assert/strict';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function admissionValidator(runnerId) {
  assert.match(runnerId, uuid);
  return bytes => {
    const value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    return value !== null && typeof value === 'object' && !Array.isArray(value)
      && Object.keys(value).sort().join(',') === 'assignments,opportunityId,runnerId,version'
      && value.version === 2 && value.runnerId === runnerId
      && typeof value.opportunityId === 'string' && uuid.test(value.opportunityId)
      && Array.isArray(value.assignments) && value.assignments.length === 0;
  };
}

export function assertNoPendingRunnerFiles(observation) {
  assert.equal(observation.admission?.idle, true, 'ADMISSION_NOT_IDLE');
  assert.ok(Array.isArray(observation.files));
  // Complete inventory remains authoritative. Unknown/unresolved delivery material is never ignored.
  // A retained body spool needs a separate acknowledged-content proof; this caller conservatively stops.
  for (const file of observation.files) {
    const parts = file.path.split('/'), name = parts.at(-1);
    assert.ok(!parts.includes('activity-bodies'), 'BODY_SPOOL_REQUIRES_SEPARATE_PROOF');
    assert.ok(!/^(pending-events|uncertain-events|pending-final-proposal|confirmed-final-proposal)\.json(?:\.tmp)?$/.test(name),
      'UNRESOLVED_RUNNER_DELIVERY');
  }
  return { completeInventory: true, admissionIdle: true, unresolvedDeliveryFiles: 0, actualClaimRecovery: 'UNKNOWN' };
}
