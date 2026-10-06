import { expect, test } from 'vitest';
import { validGate, type CaseResult } from './proof.js';
import type { Observation } from './process.js';
function evidence() {
  const ids = Array.from({ length: 16 }, (_, index) => 'task-' + index);
  const result: CaseResult = { id: 'case', taskIds: ids, cancelled: [], gate: [], windowComplete: false, settledByDeadline: false };
  const rows = ids.map((task_id, index) => ({ task_id, status: 'running', live: true, completed_at: null,
    attempt_id: 'attempt-' + index, current_attempt_id: 'attempt-' + index, owner_version: 1, task_version: 1, runner_id: 'runner' }));
  const claims: Observation[] = rows.map(row => ({ kind: 'claim', pid: 1, receivedMs: 0, taskId: row.task_id, attemptId: row.attempt_id, ownerVersion: 1, runnerId: 'runner' }));
  const heartbeat = claims.map(value => ({ ...value, kind: 'heartbeat', action: 'continue' }));
  return { result, rows, claims, heartbeat };
}
test('sixteen observations alone do not prove actual attempts; DB ownership and live leases are required', () => {
  const { result, rows, claims, heartbeat } = evidence();
  expect(validGate(result, [], claims, claims, claims, heartbeat)).toBe(false);
  expect(validGate(result, rows, claims, claims, claims, heartbeat)).toBe(true);
  rows[0]!.live = false; expect(validGate(result, rows, claims, claims, claims, heartbeat)).toBe(false);
  rows[0]!.live = true; rows[0]!.task_version = 2; expect(validGate(result, rows, claims, claims, claims, heartbeat)).toBe(false);
});
test('missing heartbeat, event ACK, adapter admission or claim identity prevents the16 gate', () => {
  const { result, rows, claims, heartbeat } = evidence();
  expect(validGate(result, rows, claims, claims.slice(1), claims, heartbeat)).toBe(false);
  expect(validGate(result, rows, claims, claims, claims.slice(1), heartbeat)).toBe(false);
  expect(validGate(result, rows, claims, claims, claims, heartbeat.slice(1))).toBe(false);
  claims[0]!.runnerId = 'other'; expect(validGate(result, rows, claims, claims, claims, heartbeat)).toBe(false);
});
