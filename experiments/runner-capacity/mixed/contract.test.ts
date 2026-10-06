import { expect, test } from 'vitest';
import { Budget, CONTRACT } from './contract.js';
test('reserves exactly32 tasks with no retry allocation and both topologies have16 slots', () => {
  const budget = new Budget(0, () => 0); for (let i = 0; i < 32; i++) budget.submit();
  expect(() => budget.submit()).toThrow('mixed_task_budget_exhausted'); expect(budget.tasks).toBe(32);
  expect(CONTRACT.cases.map(value => value.runners * value.slots)).toEqual([16, 16]);
});
test('45s stops work while60s remains the cleanup deadline', () => {
  let now = 44_999; const budget = new Budget(0, () => now); budget.work(); now = 45_000;
  expect(() => budget.work()).toThrow('mixed_work_budget_exhausted'); expect(budget.remainingTotalMs).toBe(15_000);
  now = 60_001; expect(budget.remainingTotalMs).toBe(0);
});
test('shared byte categories stop at48MiB and reserve16MiB for bounded cleanup evidence', () => {
  const budget = new Budget(0, () => 0); budget.charge('transport', CONTRACT.softBytes - 1); budget.work(); budget.charge('evidence', 1);
  expect(() => budget.work()).toThrow('mixed_work_budget_exhausted'); budget.charge('cleanup', CONTRACT.totalBytes - CONTRACT.softBytes);
  expect(budget.usedBytes).toBe(CONTRACT.totalBytes); expect(() => budget.charge('excess', 1)).toThrow('mixed_total_byte_budget_exhausted');
  expect(() => budget.charge('invalid', -1)).toThrow('invalid_byte_measurement');
});
