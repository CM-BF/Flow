import { describe, expect, it } from 'vitest';
import { parseRunnerConcurrency } from './concurrency-configuration.js';

describe('runner concurrency configuration', () => {
  it.each(['native', 'a2a'] as const)('defaults omitted %s configuration to one', mode => {
    expect(parseRunnerConcurrency(undefined, mode)).toBe(1);
  });
  it.each(Array.from({ length: 16 }, (_, index) => index + 1))('accepts native integer %i', limit => {
    expect(parseRunnerConcurrency(String(limit), 'native')).toBe(limit);
  });
  it.each(['', '0', '-1', '+1', '01', '1.0', '1.5', '1e0', '1E1', ' 1', '1 ', '1\n', '\t1', '17', '999999999999999999999', 'NaN', 'Infinity', '0x10', '１', '1_0'])('rejects noncanonical or out-of-range input %j in both modes', raw => {
    for (const mode of ['native', 'a2a'] as const) expect(() => parseRunnerConcurrency(raw, mode)).toThrow('canonical decimal integer');
  });
  it('accepts explicit one for A2A', () => {
    expect(parseRunnerConcurrency('1', 'a2a')).toBe(1);
  });
  it.each(['2', '4', '16'])('rejects otherwise valid A2A concurrency %s', raw => {
    expect(() => parseRunnerConcurrency(raw, 'a2a')).toThrow('A2A runner supports');
  });
});
