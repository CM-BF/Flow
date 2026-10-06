import { expect, test } from 'vitest';
import { idleBudget, IDLE_LIMITS } from './idle-claim-budget.js';

test('includes fixed mirror inputs, cumulative attempted journal writes and the full raw reserve', () => {
  const result = idleBudget(284628, 4096, 1000, 5500, 1000);
  expect(result).toEqual({ known: true, chargedBytes: 284628 + 4096 + 1000 + 262144, workAllowed: true, withinTotal: true });
});
test('work stops at its original deadline, while cleanup uses only the remaining total interval', () => {
  expect(idleBudget(0, 0, 0, 11000, 1000)).toMatchObject({ workAllowed: false, withinTotal: true });
  expect(idleBudget(0, 0, 0, 16000, 1000)).toMatchObject({ workAllowed: false, withinTotal: false });
  expect(idleBudget(0, 0, 0, 999, 1000)).toMatchObject({ known: false, workAllowed: false, withinTotal: false });
});
test('unknown or exceeded byte accounting never permits work, and deleting own files cannot erase journal charges', () => {
  expect(idleBudget(0, NaN, 0, 0, 0).withinTotal).toBe(false);
  expect(idleBudget(0, 0, IDLE_LIMITS.bytes, 0, 0)).toMatchObject({ workAllowed: false, withinTotal: false });
  expect(idleBudget(0, 0, IDLE_LIMITS.bytes - IDLE_LIMITS.rawReserve, 0, 0)).toMatchObject({ workAllowed: false, withinTotal: true });
});
