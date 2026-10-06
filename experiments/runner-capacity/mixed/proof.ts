import assert from 'node:assert/strict';
import { CONTRACT } from './contract.js';
import type { Observation } from './process.js';
export type Row = Record<string, any>;
export type CaseResult = { id: string; taskIds: string[]; cancelled: string[]; gate: Row[]; windowComplete: boolean; settledByDeadline: boolean; final?: Row[]; events?: Row[]; failure?: string };
export function validGate(result: CaseResult, rows: Row[], claims: Observation[], ready: Observation[], acks: Observation[], heartbeats: Observation[]) {
  if (rows.length !== 16 || claims.length !== 16 || ready.length !== 16) return false;
  return rows.every(row => {
    const claim = claims.find(value => value.taskId === row.task_id);
    return result.taskIds.includes(row.task_id) && row.status === 'running' && row.live && row.completed_at === null
      && row.attempt_id === row.current_attempt_id && row.owner_version === row.task_version
      && claim !== undefined && claim.attemptId === row.attempt_id && claim.ownerVersion === row.owner_version && claim.runnerId === row.runner_id
      && ready.some(value => value.attemptId === row.attempt_id)
      && acks.some(value => value.attemptId === row.attempt_id) && heartbeats.some(value => value.attemptId === row.attempt_id && value.action === 'continue');
  });
}
export function completionAcks(acks: Observation[]) {
  const found = new Map<string, Row>();
  for (const record of acks) for (const event of record.events as Row[]) if (event.type === 'completed') {
    const acknowledgement = record.acknowledgement as Row;
    if (acknowledgement.lastSequence >= event.sequence) found.set(String(record.attemptId), event);
  }
  return found;
}
export function validateWindow(result: CaseResult, observations: Observation[]) {
  const records = observations.filter(value => value.caseId === result.id);
  const start = Number(records.find(value => value.kind === 'window-start')!.beganMs);
  const completions = completionAcks(records.filter(value => value.kind === 'event-ack'));
  for (const claim of records.filter(value => value.kind === 'claim')) {
    const end = records.find(value => value.kind === 'adapter-end' && value.attemptId === claim.attemptId)!;
    const cancelled = result.cancelled.includes(String(claim.taskId));
    assert(Number(end.childMs) >= start + (cancelled ? CONTRACT.cancelMs : CONTRACT.caseMs), 'adapter_ended_before_required_overlap');
    assert(records.some(value => value.kind === 'emit-ack' && value.attemptId === claim.attemptId && Number(value.childMs) >= start), 'missing_window_emit');
    assert(records.some(value => value.kind === 'heartbeat' && value.attemptId === claim.attemptId && Number(value.childMs) >= start), 'missing_window_heartbeat');
    assert.equal(completions.get(String(claim.attemptId))?.outcome, cancelled ? 'cancelled' : 'succeeded');
    if (cancelled) {
      assert(records.some(value => value.kind === 'cancel-accepted' && value.taskId === claim.taskId), 'missing_cancel_acceptance');
      assert(records.some(value => value.kind === 'heartbeat' && value.attemptId === claim.attemptId && value.action === 'cancel'), 'missing_cancel_heartbeat');
    }
  }
}
export function validateFinal(result: CaseResult, acks: Observation[]) {
  assert.equal(result.final?.length, 16); const byAttempt = new Map<string, Row[]>();
  for (const row of result.events!) { const rows = byAttempt.get(row.attempt_id) ?? []; rows.push(row); byAttempt.set(row.attempt_id, rows); }
  for (const row of result.final!) {
    assert.equal(row.status, result.cancelled.includes(row.id) ? 'cancelled' : 'succeeded');
    assert(row.completed_at); assert.equal(row.verification_status, 'passed');
    const rows = byAttempt.get(row.attempt_id)!; assert.equal(rows.length, row.last_sequence);
    rows.forEach((event, index) => {
      assert.equal(event.sequence, index + 1);
      assert(acks.some(record => record.attemptId === row.attempt_id && (record.events as Row[]).some(value => value.id === event.event_id && value.sequence === event.sequence && value.digest === event.digest)), 'event_digest_not_bound_to_ack');
    });
  }
}
