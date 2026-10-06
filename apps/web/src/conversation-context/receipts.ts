import { assertConversationContextMatches } from "@flow/client";
import { freezeContextSelection, type FrozenCitation } from "./selection";

type KnowledgeInput = { knowledge?: readonly FrozenCitation[] };

/** Parse the request first. This then detaches references without changing its wire shape. */
export function freezeKnowledgeRequest<T extends object>(request: T & KnowledgeInput, projectId?: string): Readonly<T> {
  if (request.knowledge === undefined) return Object.freeze({ ...request });
  // A first citation establishes internal consistency, not the conversation's authorization.
  const refs = freezeContextSelection(request.knowledge, projectId ?? request.knowledge[0]?.projectId ?? "");
  const knowledge = [...refs];
  Object.freeze(knowledge);
  return Object.freeze({ ...request, knowledge });
}

/** Preserve the Web diagnostic; shared client owns every receipt validation rule. */
export function assertContextReceiptMatches(knowledge: readonly FrozenCitation[] | undefined, context: unknown): void {
  try { assertConversationContextMatches(knowledge, context); }
  catch (cause) { throw new Error("The context receipt does not match the frozen knowledge. Retry its original request.", { cause }); }
}
