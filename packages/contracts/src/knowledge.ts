import { z } from 'zod';
import { idSchema } from './tasks.js';

export const KNOWLEDGE_LIMITS = {
  textBytes: 262_144, sourcesPerProject: 128, versionsPerSource: 16,
  retainedBytesPerProject: 67_108_864, chunkBytes: 4096, overlapBytes: 256,
  queryBytes: 256, excerptBytes: 512, searchHits: 20, searchResponseBytes: 49_152,
} as const;
const utf8Bytes = (value: string) => new TextEncoder().encode(value).length;
// Reject lone surrogates instead of silently replacing them during UTF-8 encoding.
const validText = (value: string) => !/[\u0000\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(value) && !value.includes('\0');
const textSchema = z.string().max(KNOWLEDGE_LIMITS.textBytes).refine(validText).refine(value => utf8Bytes(value) <= KNOWLEDGE_LIMITS.textBytes);
const titleSchema = z.string().min(1).max(180).refine(value => validText(value) && !/[\u0000-\u001F\u007F]/u.test(value) && value.trim().length > 0 && utf8Bytes(value) <= 512);
export const knowledgeSourceIdSchema = z.uuid();
export const knowledgeVersionNumberSchema = z.coerce.number().int().min(1).max(KNOWLEDGE_LIMITS.versionsPerSource);
export const knowledgeCreateSchema = z.strictObject({ expectedVersion: z.literal(0), title: titleSchema, text: textSchema });
export const knowledgePublishSchema = z.strictObject({ expectedVersion: z.number().int().min(1).max(KNOWLEDGE_LIMITS.versionsPerSource), text: textSchema });
export const knowledgeListSchema = z.strictObject({ after: z.uuid().optional(), limit: z.coerce.number().int().min(1).max(50).default(20) });
export const knowledgeSearchSchema = z.strictObject({ q: z.string().min(1).max(KNOWLEDGE_LIMITS.queryBytes).refine(value => validText(value) && value.trim().length > 0 && utf8Bytes(value) <= KNOWLEDGE_LIMITS.queryBytes), limit: z.coerce.number().int().min(1).max(KNOWLEDGE_LIMITS.searchHits).default(20) });
export const knowledgeLocatorSchema = z.strictObject({ kind: z.literal('utf8-bytes'), start: z.number().int().min(0).max(KNOWLEDGE_LIMITS.textBytes), end: z.number().int().min(0).max(KNOWLEDGE_LIMITS.textBytes) }).refine(value => value.end >= value.start && value.end - value.start <= KNOWLEDGE_LIMITS.chunkBytes);
export const knowledgeCitationSchema = z.strictObject({ projectId: idSchema, sourceId: z.uuid(), version: z.number().int().min(1).max(KNOWLEDGE_LIMITS.versionsPerSource), contentDigest: z.string().regex(/^[a-f0-9]{64}$/), locator: knowledgeLocatorSchema });
export const knowledgeResolveSchema = z.strictObject({ citation: knowledgeCitationSchema });
export type KnowledgeCreation = z.infer<typeof knowledgeCreateSchema>;
export type KnowledgePublication = z.infer<typeof knowledgePublishSchema>;
export type KnowledgeLocator = z.infer<typeof knowledgeLocatorSchema>;
/** Immutable raw UTF-8 authority; [start,end), both endpoints on codepoint boundaries. */
export type KnowledgeCitation = z.infer<typeof knowledgeCitationSchema>;
export interface KnowledgeSource { projectId: string; id: string; title: string; currentVersion: number; createdAt: string; updatedAt: string }
export interface KnowledgeVersion { projectId: string; sourceId: string; version: number; contentDigest: string; byteLength: number; createdAt: string }
/** Receipt is immutable on replay; GET reads current source/version facts. */
export interface KnowledgeAccepted { source: KnowledgeSource; version: KnowledgeVersion; replayed: boolean }
/** Metadata only. Stable ID cursor is not a change feed. */
export interface KnowledgeSourceList { sources: KnowledgeSource[]; nextCursor: string | null }
export interface KnowledgeVersionSnapshot { source: KnowledgeSource; version: KnowledgeVersion; isCurrent: boolean }
export interface KnowledgeResolved { citation: KnowledgeCitation; text: string; isCurrent: boolean; currentVersion: number }
export interface KnowledgeSearchHit {
  source: KnowledgeSource;
  citation: KnowledgeCitation;
  /** Same project/source/version/digest as citation, but this exact locator covers excerpt.text only. */
  excerpt: { text: string; locator: KnowledgeLocator };
  matchKind: 'literal' | 'fts';
  /** Lexical ranking value, not semantic probability. FTS preview may omit matched terms. */
  rank: number;
}
/** Current versions, one best chunk per source. No inferred total. Raw excerpts <=512B; serialized JSON <=48KiB. */
export interface KnowledgeSearchResult { hits: KnowledgeSearchHit[]; hasMore: boolean }
