import { chunks } from './source/apps/server/src/knowledge/text.js';
export type Golden = { label: string; text: string; query: string; kind: 'literal' | 'fts' };
export const goldenCases: Golden[] = [
  ['中文两字', '系统提供知识检索能力', '知识'],
  ['中文连续句', '系统提供知识检索能力', '提供知识检索'],
  ['camelCase', 'createKnowledgeSource handles input', 'Knowledge'],
  ['path', '/src/knowledge/source_store.ts', 'source_store'],
  ['underscore', 'internal_name_v2', 'internal_name'],
  ['version', 'release v1.2.3 ready', '1.2.3'],
  ['literal-meta', 'literal exact%value_\\file end', '%value_\\'],
  ['query-syntax', 'raw & | ! ( ) : * tokens', '& | ! ( ) : *'],
  ['emoji', 'before😀after', '😀'],
  ['256-byte-cross-chunk', 'z'.repeat(3991) + '😀'.repeat(64) + 'tail', '😀'.repeat(64)],
  ['fts-multiple-words', 'alpha gap beta', 'alpha beta'],
  ['fts-case-fold', 'ready', 'READY'],
].map(([label, text, query]) => ({ label: label!, text: text!, query: query!, kind: label!.startsWith('fts-') ? 'fts' : 'literal' }));
export interface SourceSeed { id: string; title: string; versions: string[] }
export function sourceId(number: number): string { return `00000000-0000-4000-8000-${number.toString(16).padStart(12, '0')}`; }
function padded(text: string): string { const left = 16384 - Buffer.byteLength(text); return text + 'pad '.repeat(Math.ceil(left / 4)).slice(0, left); }
export function scaleSources(size: 16 | 128, offset: number): SourceSeed[] {
  return Array.from({ length: size }, (_, i) => ({ id: sourceId(offset + i), title: `fixed ${i}`,
    versions: [padded('oldonly '), padded('ready alpha gap beta ' + (i === 0 ? '知识 literal exact%value_\\file ' : ''))] }));
}
export function counts(sources: SourceSeed[]) {
  let currentChunks = 0, historyChunks = 0, rawBytes = 0, versions = 0;
  for (const source of sources) source.versions.forEach((text, index) => {
    versions++; rawBytes += Buffer.byteLength(text);
    if (index === source.versions.length - 1) currentChunks += chunks(text).length;
    else historyChunks += chunks(text).length;
  });
  return { sources: sources.length, versions, currentChunks, historyChunks, rawBytes };
}
export interface DatabaseIdentity { oid: string; owner: string; marker: string }
export function acceptableIdentity(ack: boolean, expected: DatabaseIdentity | undefined, actual: DatabaseIdentity | undefined): boolean {
  return ack && !!expected && !!actual && /^[1-9][0-9]*$/.test(expected.oid) && expected.oid === actual.oid && expected.owner === actual.owner && expected.marker === actual.marker;
}
export function remainingMs(until: number, now: number, cap: number): number {
  const left = Math.floor(until - now);
  if (left <= 0) throw new Error('DEADLINE');
  return Math.min(left, cap);
}
