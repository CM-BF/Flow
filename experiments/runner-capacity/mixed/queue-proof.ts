import assert from 'node:assert/strict';
import type { CaseResult, Row } from './proof.js';
import type { Observation } from './process.js';
/** Clock domains stay separate. ACK never stands in for runner control cancellation. */
export function validateQueueCancellation(result: CaseResult, observations: Observation[]) {
  const rows = observations.filter(row => row.caseId === result.id);
  const unique = (kind: string, taskId: string) => {
    const found = rows.filter(row => row.kind === kind && row.taskId === taskId);
    assert.equal(found.length, 1, 'queue_missing_or_duplicate_' + kind); return found[0]!;
  };
  assert.equal(result.cancelled.length, 4);
  const finalObservation = rows.find(row => row.kind === 'final-state-observed');
  assert(finalObservation, 'queue_missing_final_observation');
  const window = rows.find(row => row.kind === 'window-start'); assert(window);
  for (const end of rows.filter(row => row.kind === 'adapter-end')) assert(Number(end.childMs) <= Number(window.beganMs) + 11000, 'queue_activity_tail_exceeded');
  const resultRows = result.cancelled.map(taskId => {
    const claim = unique('claim', taskId); const sent = unique('cancel-send', taskId); const ack = unique('cancel-accepted', taskId);
    const abort = unique('control-abort', taskId); const end = unique('adapter-end', taskId);
    assert(abort.attemptId === claim.attemptId && abort.ownerVersion === claim.ownerVersion && abort.runnerId === claim.runnerId, 'queue_cancel_identity');
    const cancelHeartbeat = rows.find(row => row.kind === 'heartbeat' && row.attemptId === claim.attemptId && row.action === 'cancel');
    assert(cancelHeartbeat && Number(abort.childMs) >= Number(cancelHeartbeat.childMs), 'queue_cancel_signal_missing');
    assert(Number(end.childMs) >= Number(abort.childMs) && end.interrupted === true, 'queue_adapter_abort_not_closed');
    const emissions = rows.filter(row => row.kind === 'emit-start' && row.attemptId === claim.attemptId);
    assert(!emissions.some(row => Number(row.startedChildMs) >= Number(abort.observedChildMs)), 'queue_effect_after_control_abort');
    const final = (finalObservation.rows as Row[]).find(row => row.id === taskId);
    assert(final?.status === 'cancelled' && final.attempt_id === claim.attemptId && final.owner_version === claim.ownerVersion, 'queue_cancel_final_identity');
    // No subtraction across driver/runner clocks. All propagation emissions remain in raw observations.
    return { taskId, attemptId: claim.attemptId, ownerVersion: claim.ownerVersion,
      driverSendToAckMs: ack.receivedMs - sent.receivedMs,
      runnerSignalToAdapterEndMs: Number(end.childMs) - Number(abort.observedChildMs),
      driverSendToFinalObservationMs: finalObservation.receivedMs - sent.receivedMs,
      runnerEmitStartsBeforeSignal: emissions.filter(row => Number(row.startedChildMs) < Number(abort.observedChildMs)).length,
      ackToSignalMs: null, ackToSignalEmissionCount: null, unknownReason: 'uncalibrated driver and runner clocks' };
  });
  const boundaryStart = window.boundary as Row | undefined;
  const boundaryEnd = rows.find(row => row.kind === 'window-end')?.boundary as Row | undefined;
  assert(boundaryStart && boundaryEnd && [boundaryStart, boundaryEnd].every(value => Number.isSafeInteger(value.inFlight) && value.inFlight >= 0), 'queue_runner_boundary_unknown');
  const started = rows.filter(row => row.kind === 'runner-request-send');
  const settled = rows.filter(row => row.kind === 'runner-http' || row.kind === 'runner-http-error');
  assert.equal(new Set(started.map(row => row.requestOrdinal)).size, started.length);
  assert(settled.every(row => started.some(sent => sent.requestOrdinal === row.requestOrdinal)), 'queue_unissued_http_result');
  assert.equal(new Set(settled.map(row => row.requestOrdinal)).size, settled.length);
  const settledIds = new Set(settled.map(row => row.requestOrdinal));
  const missingOrInFlight = started.filter(row => !settledIds.has(row.requestOrdinal)).length;
  assert.equal(missingOrInFlight, 0, 'queue_http_settlement_unknown');
  return { rows: resultRows, boundaryStart, boundaryEnd, denominator: { issued: started.length, settled: settled.length,
    errors: settled.filter(row => row.kind === 'runner-http-error').length, missingOrInFlight },
    cancelFinalObservationBasis: 'single final verification read; upper-bound observation time, not exact commit time',
    sourceEpoch: window.epoch, extraActivityMs: 5000 };
}
