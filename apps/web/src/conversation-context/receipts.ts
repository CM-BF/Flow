import { idSchema, knowledgeCitationSchema, KNOWLEDGE_LIMITS } from "@flow/contracts";
import { citationBytes, citationKey, freezeContextSelection, type FrozenCitation } from "./selection";

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

const digest = (value: unknown) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const record = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const mismatch = () => Error("The context receipt does not match the frozen knowledge. Retry its original request.");

/** Additional guard after the caller validates conversation/turn or queue identity and text. */
export function assertContextReceiptMatches(knowledge: readonly FrozenCitation[] | undefined, context: unknown): void {
  const expected = freezeKnowledgeRequest({ knowledge }).knowledge ?? [];
  if (context === undefined && expected.length === 0) return;
  if (!record(context) || !idSchema.safeParse(context.id).success || !idSchema.safeParse(context.executionInputId).success
    || !digest(context.contextDigest) || !digest(context.executionInputDigest) || context.templateVersion !== 1
    || !Array.isArray(context.sources) || context.sources.length !== expected.length) throw mismatch();
  for (let index = 0; index < expected.length; index++) {
    const source: unknown = context.sources[index];
    if (!record(source)) throw mismatch();
    const parsed = knowledgeCitationSchema.safeParse(source.citation);
    if (!parsed.success || citationKey(parsed.data) !== citationKey(expected[index]!)) throw mismatch();
    const current = source.currentVersionAtFreeze;
    if (source.byteLength !== citationBytes(parsed.data) || typeof current !== "number" || !Number.isInteger(current)
      || current < parsed.data.version || current > KNOWLEDGE_LIMITS.versionsPerSource
      || source.isCurrentAtFreeze !== (current === parsed.data.version)) throw mismatch();
  }
}
