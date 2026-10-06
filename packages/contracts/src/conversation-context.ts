import { z } from 'zod';
import { knowledgeCitationSchema, type KnowledgeCitation } from './knowledge.js';

export const CONVERSATION_CONTEXT_LIMITS = { references: 4, rawBytes: 8192, executionCodeUnits: 16000, executionBytes: 49152, detailResponseBytes: 65536 } as const;
export const conversationContextSelectionSchema = z.array(knowledgeCitationSchema).max(CONVERSATION_CONTEXT_LIMITS.references).refine(refs => {
  const keys = refs.map(ref => JSON.stringify([ref.projectId,ref.sourceId,ref.version,ref.contentDigest,ref.locator.start,ref.locator.end]));
  return new Set(keys).size === keys.length;
}, 'Duplicate exact citations are not allowed.');
export interface ConversationContextSource {
  citation: KnowledgeCitation;
  byteLength: number;
  currentVersionAtFreeze: number;
  isCurrentAtFreeze: boolean;
}
/** Public metadata only. Digests cover distinct authorities; neither contains frozen source text. */
export interface ConversationContextReference {
  id: string;
  contextDigest: string;
  executionInputId: string;
  executionInputDigest: string;
  templateVersion: 1;
  sources: ConversationContextSource[];
}
/** Runner-only metadata accompanies the private assignment.task.prompt execution input. */
export type ConversationContextExecutionReference = Pick<ConversationContextReference, 'id' | 'contextDigest' | 'executionInputId' | 'executionInputDigest'>;
export interface ConversationContextDetail {
  id: string;
  conversationId: string;
  projectId: string;
  contextDigest: string;
  createdAt: string;
  sources: (ConversationContextSource & { text: string; currentVersion: number; isCurrent: boolean })[];
}
