import { expect, test } from 'vitest';
import { goalInputSchema } from '../../../../packages/contracts/src/goals.js';
import { normalizeGoalInput } from './input.js';

test('empty knowledge is a semantic no-op without altering old request shape or adding undefined keys', () => {
  const raw = { goal: 'Build exact output', constraints: '', acceptance: 'Verified', verification: { kind: 'nonempty' as const } };
  const plain = goalInputSchema.parse(raw); const explicitEmpty = goalInputSchema.parse({ ...raw, knowledge: [] });
  expect(plain).toEqual(raw); expect(Object.hasOwn(plain, 'knowledge')).toBe(false);
  expect(Object.hasOwn(explicitEmpty, 'knowledge')).toBe(true);
  const normalized = normalizeGoalInput(explicitEmpty);
  expect(normalized).toEqual(raw); expect(Object.hasOwn(normalized, 'knowledge')).toBe(false);
  expect(explicitEmpty.knowledge).toEqual([]); // The original request remains available for immutable receipt identity.
  expect(normalizeGoalInput(plain)).toEqual(raw);
});
