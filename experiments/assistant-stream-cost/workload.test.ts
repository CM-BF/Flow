import { expect, it } from 'vitest';
import { buildScenario, type PatchCount } from './workload.js';

it('keeps one exact 32 KiB Unicode body across the three authorized patch counts', () => {
  const expected = 'A中🙂e\u0301\\_%\r\n'.repeat(2048);
  for (const count of [4, 16, 64] as const) {
    const workload = buildScenario(count);
    expect(workload.text).toBe(expected);
    expect(workload.inputUtf8Bytes).toBe(32768);
    expect(workload.contentDigest).toBe('616f40d77b8c6f536a68fb3f4842915f9c5cfd8a5a68e4a512d6c4281ce93653');
    expect(workload.patches).toHaveLength(count);
    expect(workload.patches.map(patch => patch.text).join('')).toBe(expected);
  }
});

it('preserves byte offsets, complete Unicode and independently fixed prefix digests', () => {
  const firstDigests = {
    4: 'ea748c8970d5d3c665a556e933cdfd0261848c60d261a71b83baabb806f03c76',
    16: '0ae9d89bd6c29b097abd53574203159e98b1697a794e2b25415737c21951f944',
    64: 'b9c7c850f735bbb3c9fb1a379a33e11e8b3fbca17a6fb57daf2352b7304dc5b3',
  };
  for (const count of [4, 16, 64] as const) {
    const workload = buildScenario(count);
    expect(workload.patches[0]!.prefixDigest).toBe(firstDigests[count]);
    let offset = 0;
    for (const [index, patch] of workload.patches.entries()) {
      expect(patch.text.isWellFormed()).toBe(true);
      expect(patch.fromBytes).toBe(offset);
      expect(patch.revision).toBe(index + 1);
      expect(Buffer.byteLength(patch.text)).toBeLessThanOrEqual(8192);
      expect(patch.phase).toBe(index === count - 1 ? 'block-complete' : 'streaming');
      offset += Buffer.byteLength(patch.text);
    }
    expect(offset).toBe(32768);
    expect(workload.patches.at(-1)!.prefixDigest).toBe(workload.contentDigest);
  }
  expect(buildScenario(4).patches.map(p => p.fromBytes)).toEqual([0, 8192, 16384, 24576]);
  expect(buildScenario(4).patches[1]!.prefixDigest).toBe('a401df7c3806368f806d5b7a8bc03795abc521f0ce7e5a1b7beadf7a1e9a4d70');
  expect(buildScenario(4).patches[2]!.prefixDigest).toBe('1c21b6b91258774112a0d408eda2e4905a8b2faf07c318220eabb6797ba36e6c');
});

it('labels byte predictions as source expectations and refuses unapproved matrix sizes', () => {
  expect([4, 16, 64].map(n => buildScenario(n as PatchCount).sourcePrediction)).toEqual([
    { kind: 'source-count-expectation-not-measurement', priorPrefixReadUtf8Bytes: 49152, fullPrefixHashUtf8Bytes: 81920 },
    { kind: 'source-count-expectation-not-measurement', priorPrefixReadUtf8Bytes: 245760, fullPrefixHashUtf8Bytes: 278528 },
    { kind: 'source-count-expectation-not-measurement', priorPrefixReadUtf8Bytes: 1032192, fullPrefixHashUtf8Bytes: 1064960 },
  ]);
  expect(() => buildScenario(8 as PatchCount)).toThrow('Only 4, 16 or 64');
});
