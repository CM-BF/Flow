import type { GoalInput } from '../../../../packages/contracts/src/goals.js';

/** Domain normalization does not rewrite the original idempotency request. */
export function normalizeGoalInput(input: GoalInput): GoalInput {
  if (input.knowledge?.length) return input;
  const { knowledge: _empty, ...plain } = input;
  return plain;
}
