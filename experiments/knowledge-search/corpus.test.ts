import { expect, test } from 'vitest';
import { goldenCases, scaleSources, counts, acceptableIdentity, remainingMs } from './corpus.js';
test('retains the twelve lexical oracles and literal punctuation without normalization', () => {
  expect(process.versions.node.split('.')[0]).toBe('24');
  expect(goldenCases).toHaveLength(12);
  expect(goldenCases[0]).toEqual({ label: '中文两字', text: '系统提供知识检索能力', query: '知识', kind: 'literal' });
  expect(goldenCases[6]!.query).toBe('%value_\\');
  expect(Buffer.byteLength(goldenCases[9]!.query)).toBe(256);
  expect(goldenCases.filter(row => row.kind === 'fts').map(row => row.label)).toEqual(['fts-multiple-words', 'fts-case-fold']);
});
test('separates 128 current and historical versions with exact bodies and five chunks each', () => {
  const sources = scaleSources(128, 2000);
  expect(counts(sources)).toEqual({ sources: 128, versions: 256, currentChunks: 640, historyChunks: 640, rawBytes: 4194304 });
  expect(counts(scaleSources(16, 1000))).toEqual({ sources: 16, versions: 32, currentChunks: 80, historyChunks: 80, rawBytes: 524288 });
  expect(sources[0]!.versions[1]).toContain('知识');
  expect(sources[1]!.versions[1]).not.toContain('知识');
  expect(sources.every(s => Buffer.byteLength(s.versions[0]!) === 16384 && Buffer.byteLength(s.versions[1]!) === 16384)).toBe(true);
});
test('only matching acknowledged marked DB identity permits normal cleanup', () => {
  expect(acceptableIdentity(true, { oid: '42', owner: 'flow', marker: 'owned' }, { oid: '42', owner: 'flow', marker: 'owned' })).toBe(true);
  expect(acceptableIdentity(false, { oid: '42', owner: 'flow', marker: 'owned' }, { oid: '42', owner: 'flow', marker: 'owned' })).toBe(false);
  expect(acceptableIdentity(true, { oid: '42', owner: 'flow', marker: 'owned' }, { oid: '43', owner: 'flow', marker: 'owned' })).toBe(false);
  expect(acceptableIdentity(true, { oid: '42', owner: 'flow', marker: 'owned' }, { oid: '42', owner: 'other', marker: 'owned' })).toBe(false);
  expect(acceptableIdentity(true, undefined, { oid: '42', owner: 'flow', marker: 'owned' })).toBe(false);
});
test('absolute deadlines share remaining work and never renew a spent budget', () => {
  expect(remainingMs(1000, 300, 500)).toBe(500);
  expect(remainingMs(1000, 800, 500)).toBe(200);
  expect(() => remainingMs(1000, 1000, 500)).toThrow('DEADLINE');
});
