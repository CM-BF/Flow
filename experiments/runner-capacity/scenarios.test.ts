import { expect, it } from 'vitest';
import { resolveScenario } from './scenarios.js';

it('locks the selected scenarios to their approved dimensions and declared capacities', () => {
  expect(resolveScenario('four-processes', 'window')).toMatchObject({ tasks: 16, runners: 4, capacityPerRunner: 1, conversations: 128 });
  const control = resolveScenario('declared-four', 'window');
  expect(control).toMatchObject({ tasks: 12, runners: 1, capacityPerRunner: 4, conversations: 128 });
  expect(Object.isFrozen(control)).toBe(true);
});

it('refuses smoke, deferred controls, unknown scenarios and missing windows', () => {
  for (const id of ['smoke', 'one-process', '__proto__', 'unknown']) expect(() => resolveScenario(id, 'window')).toThrow('Unapproved scenario');
  for (const window of [undefined, '', ' ']) expect(() => resolveScenario('declared-four', window)).toThrow('coordinated window');
});
