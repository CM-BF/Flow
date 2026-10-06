import { conversationContextSelectionSchema, knowledgeCitationSchema, type KnowledgeCitation } from "@flow/contracts";

export type Immutable<T> = T extends readonly (infer Item)[] ? readonly Immutable<Item>[] : T extends object ? { readonly [Key in keyof T]: Immutable<T[Key]> } : T;
export type FrozenCitation = Immutable<KnowledgeCitation>;
export const CONTEXT_BUDGET = Object.freeze({ references: 4, selectedBytes: 8192, hits: 20, queryBytes: 256, bodyBytes: 4096, cacheEntries: 8, bodyRequests: 2, requestTimeoutMs: 15000 });
export const utf8Length = (value: string) => new TextEncoder().encode(value).length;
export const citationKey = (ref: FrozenCitation) => JSON.stringify([ref.projectId, ref.sourceId, ref.version, ref.contentDigest, ref.locator.kind, ref.locator.start, ref.locator.end]);
export const citationBytes = (ref: FrozenCitation) => ref.locator.end - ref.locator.start;

export function freezeCitation(value: unknown, projectId: string): FrozenCitation {
  const ref = knowledgeCitationSchema.parse(value);
  if (ref.projectId !== projectId) throw Error("This reference belongs to a different project.");
  return Object.freeze({ ...ref, locator: Object.freeze(ref.locator) });
}

/** A detached request value; editing the next selection cannot change a pending receipt. */
export function freezeContextSelection(refs: readonly FrozenCitation[], projectId: string): readonly FrozenCitation[] {
  const parsed = conversationContextSelectionSchema.parse(refs);
  const frozen = parsed.map(ref => freezeCitation(ref, projectId));
  if (frozen.reduce((sum, ref) => sum + citationBytes(ref), 0) > CONTEXT_BUDGET.selectedBytes)
    throw Error("Select at most 8192 bytes of knowledge.");
  return Object.freeze(frozen);
}
