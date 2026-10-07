import { expect, test } from 'vitest';
import { ComparisonBudget, type Side, type SideReceipt } from './ab-budget.js';
import { runSingleSide } from './ab-sequence.js';
import { BUFFERED_QUEUE, BUFFERED_IDENTITY, QUEUE_PROBE, queueArm, queueContract, selectQueueRecipe } from './queue-probe.js';
import { selectRunIdentity } from './run-identity.js';
import { validateWindow, validateFinal, type CaseResult } from './proof.js';
import type { Observation } from './process.js';

const receipt = (): SideReceipt => ({ success: true, resourcesClosed: true, finalElapsedMs: 1, finalMeasuredBytes: 0, tasksSentOrUnknown: 0 });
test('explicit single selection uses only buffered and rejects unknown or a second arm', () => {
  expect(selectQueueRecipe('queue-buffered-single')).toEqual({ limits: BUFFERED_QUEUE, single: true });
  expect(queueArm('queue-buffered-single', 'A')).toEqual({ identity: BUFFERED_IDENTITY, mode: 'buffered' });
  for (const kind of [undefined, null, 'buffered', 'queue-delivery-v2', {}]) expect(() => selectQueueRecipe(kind)).toThrow('queue_recipe_unknown');
  expect(() => queueArm('queue-buffered-single', 'B')).toThrow('queue_single_second_arm_forbidden');
  expect(queueArm('queue-delivery', 'A')).toEqual({ identity: 'queue-probe-O1-v1', mode: 'per-query' });
  expect(queueArm('queue-delivery', 'B')).toEqual({ identity: 'queue-probe-O2-v1', mode: 'buffered' });
  expect(selectQueueRecipe('queue-delivery').limits).toBe(QUEUE_PROBE);
});
test('new identity preserves production burst window and full cancellation contract in its own output', () => {
  const selected = selectRunIdentity(BUFFERED_IDENTITY);
  expect(selected.contract).toEqual(queueContract('A'));
  expect(selected.base).toBe('4fdd856293a502209d7509ea37da901bbfd89f72');
  expect(selected.contract.caseMs).toBe(6000); expect(selected.contract.cancelCount).toBe(4);
  expect(selected.contract.cases).toEqual([{ id: 'eight-by-sixteen', runners: 8, slots: 16 }]);
  expect(selected.output).toBe(BUFFERED_QUEUE.output + '/buffered');
  expect(selected.requiredSources).toEqual(selectRunIdentity('queue-probe-O1-v1').requiredSources);
  expect(BUFFERED_QUEUE.maximumTasks).toBe(129);
  expect(() => selectRunIdentity('queue-probe-buffered-v2')).toThrow();
});
test('single orchestration consumes one real budget side and cannot submit a 130th task', async () => {
  const calls: Side[] = [], budget = new ComparisonBudget(0, () => 1, BUFFERED_QUEUE);
  const outcomes = await runSingleSide(budget, async side => {
    calls.push(side); for (let n = 0; n < 129; n++) budget.submit();
    expect(() => budget.submit()).toThrow('comparison_tasks_exhausted');
    return { ...receipt(), tasksSentOrUnknown: 129 };
  });
  expect(calls).toEqual(['A']); expect(outcomes.map(value => value.state)).toEqual(['PASS']);
});
test.each(['failed-proof', 'retained', 'lost-return', 'accounting'] as const)('single %s cannot become PASS or launch another arm', async kind => {
  const calls: Side[] = [];
  const outcomes = await runSingleSide(new ComparisonBudget(0, () => 1, BUFFERED_QUEUE), async side => {
    calls.push(side); if (kind === 'lost-return') throw new Error('unknown');
    return { ...receipt(), success: kind !== 'failed-proof', resourcesClosed: kind !== 'retained', finalMeasuredBytes: kind === 'accounting' ? 1 : 0 };
  });
  expect(calls).toEqual(['A']); expect(outcomes).toHaveLength(1);
  expect(outcomes[0]?.state).toBe(kind === 'lost-return' || kind === 'accounting' ? 'UNKNOWN' : 'FAIL');
});
test('the selected contract still rejects a short ACK envelope and missing final persistence', () => {
  const result: CaseResult = { id: 'eight-by-sixteen', taskIds: ['task'], cancelled: [], gate: [], windowComplete: true, settledByDeadline: true, final: [] };
  const row = (kind: string, fields: Record<string, unknown>): Observation => ({ kind, pid: 1, childMs: 0, receivedMs: 0, caseId: result.id, attemptId: 'attempt', taskId: 'task', ...fields });
  const observations = [row('window-start', { beganMs: 100 }), row('claim', {}), row('adapter-end', { childMs: 6200 }),
    row('heartbeat', { childMs: 500, action: 'continue' }), row('emit-ack', { childMs: 500, startedChildMs: 400 }),
    row('emit-ack', { childMs: 4400, startedChildMs: 4300 }), row('event-ack', { acknowledgement: { lastSequence: 1 }, events: [{ type: 'completed', outcome: 'succeeded', sequence: 1 }] })];
  expect(() => validateWindow(result, observations, selectRunIdentity(BUFFERED_IDENTITY).contract)).toThrow('insufficient_window_ack_span');
  expect(() => validateFinal(result, [])).toThrow();
});
