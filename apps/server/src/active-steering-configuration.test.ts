import { expect, it } from 'vitest';
import { parseActiveSteeringConfiguration } from './active-steering-configuration.js';

it('enables trusted intake only for the exact opt-in value', () => {
  expect(parseActiveSteeringConfiguration()).toBe(false);
  expect(parseActiveSteeringConfiguration('0')).toBe(false);
  expect(parseActiveSteeringConfiguration('1')).toBe(true);
});
it('rejects malformed configuration without echoing its content', () => {
  for (const value of ['', 'true', 'false', ' 1', '1 ', '01', '1,1', 'synthetic-secret-marker']) {
    expect(() => parseActiveSteeringConfiguration(value)).toThrow('FLOW_ACTIVE_STEERING must be absent, 0 or 1.');
    try { parseActiveSteeringConfiguration(value); } catch (error) { expect(String(error)).not.toContain('synthetic-secret-marker'); }
  }
});
