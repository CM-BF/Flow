import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { selectRunIdentity, verifyRunSources } from './run-identity.js';

describe('separately authorized mixed-run identity', () => {
  it('keeps the original default reservation and production base', () => {
    expect(selectRunIdentity()).toMatchObject({ id: 'legacy-v1', base: '4391bbf9f1785212d098ef6aa1c01a0320a003d3',
      output: 'docs/evidence/s01/mixed-run', preparation: 'docs/evidence/s01/mixed-preparation' });
    expect(selectRunIdentity('legacy-v1')).toEqual(selectRunIdentity());
  });
  it('selects only the fixed post-drain base and independent output', () => {
    expect(selectRunIdentity('after-drain-v1')).toMatchObject({ id: 'after-drain-v1', base: '0cee7556befa1988e60bae94b510240122c34b88',
      output: 'docs/evidence/s01/mixed-after-drain-run', preparation: 'docs/evidence/s01/mixed-after-drain-preparation' });
    expect(selectRunIdentity('after-drain-v1').requiredSources.map(source => source.path)).toEqual([
      'apps/runner/src/runtime.ts', 'apps/runner/src/runtime-shutdown.test.ts',
    ]);
  });
  it.each(['', '../mixed-run', 'constructor', 'after-drain-v2'])('rejects an unreviewed identity %j', identity => {
    expect(() => selectRunIdentity(identity)).toThrow('Unreviewed mixed-run identity.');
  });
  it('accepts the two exact already-reviewed P03 source inputs without starting a runtime', async () => {
    await expect(verifyRunSources(selectRunIdentity('after-drain-v1'), path => readFile(path))).resolves.toBeUndefined();
  });
  it('rejects modified production bytes even when their length is unchanged', async () => {
    await expect(verifyRunSources(selectRunIdentity('after-drain-v1'), async path => {
      const bytes = await readFile(path); bytes[0] = bytes[0]! ^ 1; return bytes;
    })).rejects.toThrow('Required source differs from approved implementation: apps/runner/src/runtime.ts');
  });
  it('rejects a missing required shutdown source', async () => {
    const missing = new Error('owned input unavailable');
    await expect(verifyRunSources(selectRunIdentity('after-drain-v1'), async path => {
      if (path.endsWith('runtime-shutdown.test.ts')) throw missing;
      return readFile(path);
    })).rejects.toBe(missing);
  });
  it('does not add the later source requirement to the original identity', async () => {
    let reads = 0;
    await verifyRunSources(selectRunIdentity(), async () => { reads++; throw new Error('Legacy should not read later source.'); });
    expect(reads).toBe(0);
  });
});
