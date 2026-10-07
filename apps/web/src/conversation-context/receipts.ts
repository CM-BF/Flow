import { assertConversationContextMatches } from "@flow/client";
import { attachmentSelectionSchema, claudeTurnSettingsSchema, type ClaudeTurnSettings, type AttachmentReference } from "@flow/contracts";
import { freezeContextSelection, type FrozenCitation } from "./selection";

export function freezeMessageSettings(value: unknown): Readonly<ClaudeTurnSettings> {
  const parsed = claudeTurnSettingsSchema.parse(value);
  Object.freeze(parsed.profile); Object.freeze(parsed.requested.effort); Object.freeze(parsed.requested);
  return Object.freeze(parsed);
}

type MaterialInput = {
  messageSettings?: Readonly<ClaudeTurnSettings>;
  knowledge?: readonly FrozenCitation[];
  attachments?: readonly Readonly<AttachmentReference>[];
};

/** Detach both material lists at local receipt publication. Body byte budgets need
 * authorized descriptors (checked by the input) and remain center-authoritative. */
export function freezeMaterialRequest<T extends object>(request: T & MaterialInput, projectId?: string): Readonly<T> {
  const project = projectId ?? request.knowledge?.[0]?.projectId ?? request.attachments?.[0]?.projectId ?? "";
  const knowledge = request.knowledge === undefined ? undefined : freezeContextSelection(request.knowledge, project);
  const attachments = request.attachments === undefined ? undefined : attachmentSelectionSchema.parse(request.attachments);
  if (attachments?.some(ref => ref.projectId !== project)) throw Error("Attachments must belong to the conversation project.");
  if ((knowledge?.length ?? 0) + (attachments?.length ?? 0) > 4) throw Error("Knowledge and attachments together allow at most four references.");
  if (attachments) { attachments.forEach(Object.freeze); Object.freeze(attachments); }
  const detachedKnowledge = knowledge === undefined ? undefined : Object.freeze([...knowledge]);
  return Object.freeze({ ...request,
    ...(request.messageSettings === undefined ? {} : { messageSettings: freezeMessageSettings(request.messageSettings) }),
    ...(detachedKnowledge === undefined ? {} : { knowledge: detachedKnowledge }),
    ...(attachments === undefined ? {} : { attachments }),
  });
}

/** Existing knowledge consumers share the same material boundary. */
export const freezeKnowledgeRequest = freezeMaterialRequest;

/** The public decoder is the sole v1/v2 acknowledgement authority. */
export function assertContextReceiptMatches(
  knowledge: readonly FrozenCitation[] | undefined,
  context: unknown,
  attachments?: Parameters<typeof assertConversationContextMatches>[2],
): void {
  try { assertConversationContextMatches(knowledge, context, attachments); }
  catch (cause) { throw Error("The context receipt does not match the frozen materials. Retry its original request.", { cause }); }
}
