import { expect, test } from 'vitest';
import { Budget } from './contract.js';
import { COMPARISON, ComparisonBudget, sideContract, type SideReceipt } from './ab-budget.js';
const MiB = 1024 * 1024;
const receipt = (overrides: Partial<SideReceipt> = {}): SideReceipt => ({ success: true, resourcesClosed: true,
  finalMeasuredBytes: 0, finalElapsedMs: 10000, tasksSentOrUnknown: 0, ...overrides });
test('fixed sides share the128 workload and reserve30seconds for cleanup', () => {
  const a = sideContract('A'), b = sideContract('B'); expect({ ...a, base: '' }).toEqual({ ...b, base: '' });
  expect(a).toMatchObject({ totalMs: 135000, workMs: 105000, totalBytes: 240*MiB, eventsPerSecond: 2, tasks: 128 });
  expect(a.cleanup.result).toBe(134500); expect(a.cases).toEqual([{ id: 'eight-by-sixteen', runners: 8, slots: 16 }]);
});
test('real-time shared charges reserve common inputs before allowing another240MiB side', () => {
  let now = 0; const budget = new ComparisonBudget(0, () => now);
  budget.chargeCommon('input', 28*MiB); budget.begin('A'); budget.chargeSide('streams', 240*MiB);
  budget.finish(receipt({ finalMeasuredBytes: 240*MiB })); now = 135000;
  budget.begin('B', receipt()); budget.chargeSide('streams', 240*MiB); expect(budget.usedBytes).toBe(512*MiB);
  expect(() => budget.chargeSide('one-more-byte', 1)).toThrow('comparison_total_bytes_exhausted');
});
test('failed or unknown A never opens B even if no tasks are visible', () => {
  for (const prior of [receipt({ success: false }), receipt({ resourcesClosed: false })]) {
    const budget = new ComparisonBudget(0, () => 0); budget.begin('A'); budget.finish(prior);
    expect(() => budget.begin('B', prior)).toThrow('comparison_previous_unknown');
  }
});
test('B admission requires150seconds remaining and cannot reset or retry a consumed side', () => {
  let now = 0; const budget = new ComparisonBudget(0, () => now); budget.begin('A'); budget.finish(receipt());
  now = 150001; expect(() => budget.begin('B', receipt())).toThrow('comparison_start_reserve');
  expect(() => budget.begin('A')).toThrow('comparison_side_replay');
});
test('submission and measurement hooks cannot hide task orbyte usage from the shared ledger', () => {
  const budget = new ComparisonBudget(0, () => 0); budget.begin('A');
  const inner = new Budget(0, () => 0, sideContract('A'), {
    charge: (kind, bytes) => budget.chargeSide(kind, bytes), work: () => budget.work(), submit: () => budget.submit() });
  for (let i=0;i<128;i++) inner.submit(); expect(budget.tasks).toBe(128);
  expect(() => inner.submit()).toThrow('mixed_task_budget_exhausted'); inner.charge('stream', 17);
  expect(budget.usedBytes).toBe(COMPARISON.finalReserveBytes+17);
  expect(() => budget.finish(receipt({ finalMeasuredBytes: 16, tasksSentOrUnknown: 128 }))).toThrow('comparison_side_accounting_unknown');
});
test('common input overflow, softstop and side elapsed limits do not silently clamp', () => {
  const budget = new ComparisonBudget(0, () => 0); expect(() => budget.chargeCommon('overflow', 32*MiB)).toThrow('comparison_common_bytes_exhausted');
  let now = 0; const timed = new ComparisonBudget(0, () => now); timed.begin('A'); now=135001;
  expect(() => timed.finish(receipt())).toThrow('comparison_side_accounting_unknown');
});

test('resource unknown stops new admission while measured cleanup bytes remain accountable', () => {
  const budget = new ComparisonBudget(0, () => 0); budget.begin('A'); budget.submit(); budget.stop();
  expect(() => budget.submit()).toThrow('comparison_resource_unknown');
  budget.chargeSide('cleanup', 41); expect(budget.tasks).toBe(1);
  expect(budget.usedBytes).toBe(COMPARISON.finalReserveBytes+41);
  expect(() => budget.chargeSide('invalid', -1)).toThrow('comparison_invalid_bytes');
  expect(budget.usedBytes).toBe(COMPARISON.finalReserveBytes+41);
});

test('all preparation work consumes the original15seconds without opening a fresh timer', () => {
 let now=14999; const budget=new ComparisonBudget(0,()=>now); budget.work(); now=15000;
 expect(()=>budget.work()).toThrow('comparison_preparation_exhausted');
 expect(()=>budget.begin('A')).toThrow('comparison_preparation_exhausted');
});
test('side deadline is fixed before asynchronous preflight and includes delayed launch', () => {
 let now=12000; const budget=new ComparisonBudget(0,()=>now); budget.begin('A');
 expect(budget.sideStartedMs).toBe(12000); expect(budget.sideDeadlineMs).toBe(147000);
 now=13000; expect(budget.sideDeadlineMs).toBe(147000);
 now=147001; expect(()=>budget.finish(receipt())).toThrow('comparison_side_accounting_unknown');
});
