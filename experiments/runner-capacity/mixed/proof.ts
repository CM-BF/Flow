import assert from 'node:assert/strict';
import { CONTRACT, type RunContract } from './contract.js';
import type { Observation } from './process.js';
export type Row = Record<string, any>;
export type CaseResult = { id: string; taskIds: string[]; cancelled: string[]; gate: Row[]; windowComplete: boolean; settledByDeadline: boolean; final?: Row[]; events?: Row[]; sessions?: Row[]; totals?: Row; activity?: Row; measureSentMs?: number; sampledOwnership?: Row; failure?: string };
export function validGate(result: CaseResult, rows: Row[], claims: Observation[], ready: Observation[], acks: Observation[], heartbeats: Observation[], contract: RunContract = CONTRACT) {
  const scenario = contract.cases.find(value => value.id === result.id) ?? contract.cases[0]!;
  const expected = scenario.runners * scenario.slots;
  if (result.taskIds.length !== expected || new Set(result.taskIds).size !== expected || rows.length !== expected
    || claims.length !== expected || ready.length !== expected || new Set(rows.map(row => row.task_id)).size !== expected
    || new Set(claims.map(row => row.attemptId)).size !== expected || new Set(ready.map(row => row.attemptId)).size !== expected) return false;
  if (contract.persistentSessions && (new Set(rows.map(row => row.native_session_id)).size !== expected || rows.some(row =>
    typeof row.native_session_id !== 'string' || !row.native_session_id || row.session_id !== row.native_session_id
    || row.session_runner_id !== row.runner_id || row.session_task_id !== row.task_id || row.session_harness !== 'fixture'
    || !acks.some(ack => ack.attemptId === row.attempt_id && (ack.events as Row[]).some(event =>
      event.type === 'session' && event.nativeSessionId === row.native_session_id))))) return false;
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
export function validateWindow(result: CaseResult, observations: Observation[], contract: RunContract = CONTRACT) {
  const records = observations.filter(value => value.caseId === result.id);
  const start = Number(records.find(value => value.kind === 'window-start')!.beganMs);
  const completions = completionAcks(records.filter(value => value.kind === 'event-ack'));
  for (const claim of records.filter(value => value.kind === 'claim')) {
    const end = records.find(value => value.kind === 'adapter-end' && value.attemptId === claim.attemptId)!;
    const cancelled = result.cancelled.includes(String(claim.taskId));
    assert(Number(end.childMs) >= start + (cancelled ? contract.cancelMs : contract.caseMs), 'adapter_ended_before_required_overlap');
    assert(records.some(value => value.kind === 'emit-ack' && value.attemptId === claim.attemptId && Number(value.childMs) >= start), 'missing_window_emit');
    assert(records.some(value => value.kind === 'heartbeat' && value.attemptId === claim.attemptId && Number(value.childMs) >= start), 'missing_window_heartbeat');
    assert.equal(completions.get(String(claim.attemptId))?.outcome, cancelled ? 'cancelled' : 'succeeded');
    if (cancelled) {
      assert(records.some(value => value.kind === 'cancel-accepted' && value.taskId === claim.taskId), 'missing_cancel_acceptance');
      assert(records.some(value => value.kind === 'heartbeat' && value.attemptId === claim.attemptId && value.action === 'cancel'), 'missing_cancel_heartbeat');
    }
  }
  if (contract.persistentSessions) {
    const spans = records.filter(row => row.kind === 'claim').map(claim => {
      const emitted = records.filter(row => row.kind === 'emit-ack' && row.attemptId === claim.attemptId
        && Number(row.startedChildMs) >= start && Number(row.childMs) <= start + contract.caseMs);
      assert(emitted.length >= 2, 'missing_sustained_window_emissions');
      const first = Math.min(...emitted.map(row => Number(row.childMs)));
      const last = Math.max(...emitted.map(row => Number(row.childMs)));
      assert(last - first >= 4000, 'insufficient_window_ack_span');
      for (const emit of emitted) assert(records.some(row => row.kind === 'event-ack' && row.attemptId === claim.attemptId
        && row.emissionOrdinal === emit.emissionOrdinal && Number(row.childMs) >= Number(emit.startedChildMs)
        && Number(row.childMs) <= Number(emit.childMs) && (row.events as Row[]).some(event => event.type === 'message')), 'emit_not_bound_to_event_ack');
      assert(records.some(row => row.kind === 'heartbeat' && row.attemptId === claim.attemptId && row.action === 'continue'
        && Number(row.childMs) >= start && Number(row.childMs) <= start + contract.caseMs), 'missing_in_window_heartbeat');
      return { attemptId: claim.attemptId, firstAckMs: first, lastAckMs: last, count: emitted.length };
    });
    const intervals = records.filter(row => row.kind === 'claim').map(claim => {
      const entered = records.find(row => row.kind === 'adapter-enter' && row.attemptId === claim.attemptId);
      const ended = records.find(row => row.kind === 'adapter-end' && row.attemptId === claim.attemptId);
      const barrier = records.find(row => row.kind === 'barrier-released' && row.attemptId === claim.attemptId);
      assert(entered && ended && barrier, 'missing_adapter_interval');
      return { attemptId: claim.attemptId, enteredMs: Number(entered.childMs), endedMs: Number(ended.childMs),
        waitingAtMs: Number(barrier.waitingAtMs), releasedAtMs: Number(barrier.releasedAtMs) };
    });
    let active = 0, peak = 0;
    for (const point of intervals.flatMap(row => [{ at: row.enteredMs, delta: 1 }, { at: row.endedMs, delta: -1 }])
      .sort((a, b) => a.at - b.at || a.delta - b.delta)) { active += point.delta; peak = Math.max(peak, active); }
    assert.equal(peak, result.taskIds.length, 'actual_peak_below_target');
    result.activity = { clock: 'single owned runner child monotonic milliseconds', logicalAdapterPeak: peak, intervals,
      allAdapterOverlapMs: Math.max(0, Math.min(...intervals.map(row => row.endedMs)) - Math.max(...intervals.map(row => row.enteredMs))),
      windowStartMs: start,
      windowEndMs: start + contract.caseMs, spans, commonAckSpanMs: Math.max(0, Math.min(...spans.map(x => x.lastAckMs)) - Math.max(...spans.map(x => x.firstAckMs))),
      meaning: 'Intersection of first-to-last ACK envelopes; not uninterrupted CPU work or provider execution.' };
  }
}
export function validateFinal(result: CaseResult, acks: Observation[]) {
  assert.equal(result.final?.length, result.taskIds.length); const byAttempt = new Map<string, Row[]>();
  for (const row of result.events!) { const rows = byAttempt.get(row.attempt_id) ?? []; rows.push(row); byAttempt.set(row.attempt_id, rows); }
  for (const row of result.final!) {
    assert.equal(row.status, result.cancelled.includes(row.id) ? 'cancelled' : 'succeeded');
    assert(row.completed_at); assert.equal(row.verification_status, 'passed');
    const rows = byAttempt.get(row.attempt_id)!; assert.equal(rows.length, row.last_sequence);
    rows.forEach((event, index) => {
      assert.equal(event.sequence, index + 1);
      assert(acks.some(record => record.attemptId === row.attempt_id && record.ownerVersion === row.owner_version
        && Number(record.acknowledgement && (record.acknowledgement as Row).lastSequence) >= event.sequence && (record.events as Row[]).some(value => value.id === event.event_id && value.sequence === event.sequence && value.digest === event.digest)), 'event_digest_not_bound_to_ack');
    });
  }
}

export function validatePersistentSessions(result: CaseResult, acks: Observation[], contract: RunContract) {
  if (!contract.persistentSessions) return;
  assert.equal(Number(result.totals?.tasks), contract.tasks, 'unexpected_total_tasks');
  assert.equal(Number(result.totals?.attempts), contract.tasks, 'unexpected_total_attempts');
  assert.equal(Number(result.totals?.sessions), contract.tasks, 'unexpected_total_sessions');
  assert.equal(result.sessions?.length, contract.tasks);
  assert.equal(new Set(result.sessions!.map(row => row.id)).size, contract.tasks);
  for (const row of result.final!) {
    const session = result.sessions!.find(value => value.id === row.native_session_id);
    assert(session && session.harness === 'fixture' && session.runner_id === row.runner_id && session.active_task_id === null, 'final_session_identity_mismatch');
    assert(acks.some(ack => ack.attemptId === row.attempt_id && ack.ownerVersion === row.owner_version
      && (ack.events as Row[]).some(event => event.type === 'session' && event.nativeSessionId === session.id)), 'final_session_ack_missing');
  }
  assert.equal(new Set(result.events!.map(row => row.event_id)).size, result.events!.length, 'duplicate_persisted_event_id');
  let accepted = 0;
  for (const ack of acks) {
    const response = ack.acknowledgement as Row;
    assert(Number.isSafeInteger(response.accepted) && response.accepted >= 0 && response.accepted <= (ack.events as Row[]).length, 'invalid_accepted_count');
    accepted += response.accepted;
  }
  assert.equal(accepted, result.events!.length, 'accepted_count_not_bound_to_persistence');
}

export function validateWindowSamples(result: CaseResult, observations: Observation[], contract: RunContract) {
  if (!contract.persistentSessions) return;
  const records = observations.filter(row => row.caseId === result.id);
  const start = records.find(row => row.kind === 'window-start');
  assert(start && Number.isFinite(result.measureSentMs), 'missing_window_clock_bounds');
  const lower = start.receivedMs;
  const upper = Math.min(result.measureSentMs! + contract.caseMs,
    ...records.filter(row => row.kind === 'adapter-end').map(row => row.receivedMs));
  const samples = records.filter(row => row.kind === 'attempt-snapshot');
  const eligible = samples.filter(row => Number(row.queryStartedMs) >= lower && Number(row.queryEndedMs) <= upper
    && Number(row.queryEndedMs) >= Number(row.queryStartedMs));
  const byKind = (kind: string) => records.filter(row => row.kind === kind);
  for (const sample of eligible) {
    const rows = sample.rows as Row[];
    assert(validGate(result, rows, byKind('claim'), byKind('adapter-ready'), byKind('event-ack'), byKind('heartbeat'), contract), 'window_sample_not_live_and_fenced');
    assert(rows.every(row => result.gate.some(gate => gate.task_id === row.task_id && gate.attempt_id === row.attempt_id
      && gate.owner_version === row.owner_version && gate.runner_id === row.runner_id && gate.native_session_id === row.native_session_id)), 'window_sample_identity_drift');
  }
  assert(eligible.length >= 2, 'insufficient_window_samples');
  const span = Math.max(...eligible.map(row => Number(row.queryEndedMs))) - Math.min(...eligible.map(row => Number(row.queryStartedMs)));
  assert(span >= 4000, 'insufficient_window_sample_span');
  result.sampledOwnership = { clock: 'parent monotonic query start/end', measureSentMs: result.measureSentMs, startReceivedMs: lower,
    conservativeEndMs: upper, validatedSamples: eligible.length, sampledSpanMs: span,
    excludedBoundarySamples: samples.filter(row => !eligible.includes(row)).map(row => ({ queryStartedMs: row.queryStartedMs, queryEndedMs: row.queryEndedMs })),
    meaning: 'Each completed query lies inside IPC-bounded window; live/fenced at sampled database instants, not continuous lock/lease proof.' };
}
