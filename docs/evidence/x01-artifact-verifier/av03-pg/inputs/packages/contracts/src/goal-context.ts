import { z } from 'zod';
import { knowledgeCitationSchema, type KnowledgeCitation } from './knowledge.js';

export const GOAL_CONTEXT_LIMITS = { references: 4, rawBytes: 8192, executionCodeUnits: 16000, executionBytes: 49152, detailResponseBytes: 65536 } as const;
export const goalKnowledgeSelectionSchema = z.array(knowledgeCitationSchema).max(GOAL_CONTEXT_LIMITS.references).refine(refs => {
  const keys = refs.map(ref => JSON.stringify([ref.projectId, ref.sourceId, ref.version, ref.contentDigest, ref.locator.start, ref.locator.end]));
  return new Set(keys).size === keys.length;
}, 'Duplicate exact knowledge citations are not allowed.');
/** Small public reference. Exact citations remain in explicit input/history; frozen text is detail-only. */
export interface GoalContextReference { id: string; contextDigest: string; referenceCount: number; rawBytes: number }
export interface GoalExecutionContextReference extends GoalContextReference {
  executionInputId: string; executionInputDigest: string; templateVersion: 1;
}
export interface GoalContextSource {
  citation: KnowledgeCitation; text: string; byteLength: number;
  currentVersionAtFreeze: number; isCurrentAtFreeze: boolean;
}
export interface GoalContextDetail extends GoalContextReference {
  goalId: string; nodeId: string; inputVersion: number; projectId: string; createdAt: string;
  sources: (GoalContextSource & { currentVersion: number; isCurrent: boolean })[];
}
