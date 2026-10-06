import { z } from 'zod';
import { KNOWLEDGE_LIMITS, knowledgeCitationSchema, knowledgeLocatorSchema, type KnowledgeCitation } from './knowledge.js';
import { idSchema } from './tasks.js';
import { attachmentDescriptorSchema, attachmentReferenceSchema, attachmentReferenceKey, attachmentSelectionSchema, type AttachmentDescriptor, type AttachmentReference } from './attachments.js';

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
export interface ConversationContextV1Reference {
  id: string;
  contextDigest: string;
  executionInputId: string;
  executionInputDigest: string;
  templateVersion: 1;
  sources: ConversationContextSource[];
}
export interface ConversationContextV2Reference {
  id: string;
  contextDigest: string;
  executionInputId: string;
  executionInputDigest: string;
  templateVersion: 2;
  order: 'knowledge-then-attachments';
  sources: ConversationContextSource[];
  attachments: AttachmentDescriptor[];
}
export type ConversationContextReference = ConversationContextV1Reference | ConversationContextV2Reference;
/** Runner-only metadata accompanies the private assignment.task.prompt execution input. */
export type ConversationContextExecutionReference = Pick<ConversationContextReference, 'id' | 'contextDigest' | 'executionInputId' | 'executionInputDigest'>;
export interface ConversationContextV1Detail {
  id: string;
  conversationId: string;
  projectId: string;
  contextDigest: string;
  createdAt: string;
  sources: (ConversationContextSource & { text: string; currentVersion: number; isCurrent: boolean })[];
}
/** Old v1 details still omit templateVersion; only v2 adds this discriminant and attachments. */
export interface ConversationContextV2Detail extends ConversationContextV1Detail {
  templateVersion: 2;
  order: 'knowledge-then-attachments';
  attachments: (AttachmentDescriptor & { text: string })[];
}
export type ConversationContextDetail = ConversationContextV1Detail | ConversationContextV2Detail;

const digestSchema = z.string().regex(/^[a-f0-9]{64}$/);
const sourceSchema = z.strictObject({
  citation: knowledgeCitationSchema, byteLength: z.number().int().min(0).max(CONVERSATION_CONTEXT_LIMITS.rawBytes),
  currentVersionAtFreeze: z.number().int().min(1).max(KNOWLEDGE_LIMITS.versionsPerSource), isCurrentAtFreeze: z.boolean(),
}).refine(source => source.byteLength === source.citation.locator.end - source.citation.locator.start
  && source.currentVersionAtFreeze >= source.citation.version
  && source.isCurrentAtFreeze === (source.currentVersionAtFreeze === source.citation.version), 'Knowledge source metadata is inconsistent.');
const referenceBase = {
  id: idSchema, contextDigest: digestSchema, executionInputId: idSchema, executionInputDigest: digestSchema,
};
/** V1 validation is additive: no fields are changed or required on old wire objects. */
const conversationContextV1ReferenceSchema = z.strictObject({
  ...referenceBase, templateVersion: z.literal(1), sources: z.array(sourceSchema).max(CONVERSATION_CONTEXT_LIMITS.references),
});
const conversationContextV2ReferenceSchema = z.strictObject({
  ...referenceBase, templateVersion: z.literal(2), order: z.literal('knowledge-then-attachments'),
  sources: z.array(sourceSchema).max(CONVERSATION_CONTEXT_LIMITS.references),
  attachments: z.array(attachmentDescriptorSchema).min(1).max(CONVERSATION_CONTEXT_LIMITS.references),
});
function validateContextReferences(value: ConversationContextReference, ctx: z.RefinementCtx): void {
    const attachments = value.templateVersion === 2 ? value.attachments : [];
    const refs = attachments.map(item => item.reference);
    const knowledge = value.sources.map(source => source.citation);
    const projectIds = [...knowledge.map(item => item.projectId), ...refs.map(item => item.projectId)];
    if (!conversationContextSelectionSchema.safeParse(knowledge).success || !attachmentSelectionSchema.safeParse(refs).success
      || (projectIds.length > 0 && new Set(projectIds).size !== 1)) ctx.addIssue({ code: 'custom', message: 'Context references must be distinct and share one project.' });
    if (knowledge.length + refs.length > CONVERSATION_CONTEXT_LIMITS.references
      || value.sources.reduce((sum, source) => sum + source.byteLength, 0) + attachments.reduce((sum, item) => sum + item.byteLength, 0) > CONVERSATION_CONTEXT_LIMITS.rawBytes) {
      ctx.addIssue({ code: 'custom', message: 'Combined context exceeds its reference or raw-byte budget.' });
    }
}
/** Producer schema: catches accidental body/extra-field publication. */
export const conversationContextReferenceSchema = z.discriminatedUnion('templateVersion', [conversationContextV1ReferenceSchema, conversationContextV2ReferenceSchema])
  .superRefine(validateContextReferences);

// Consumer projection reuses the field validators, including locator/source refinements.
// Ignore additive response fields at every level; never retain them in client state.
const responseSourceSchema = sourceSchema.safeExtend({
  citation: knowledgeCitationSchema.extend({ locator: knowledgeLocatorSchema.strip() }).strip(),
}).strip();
const responseAttachmentSchema = attachmentDescriptorSchema.extend({ reference: attachmentReferenceSchema.strip() }).strip();
export const conversationContextResponseSchema = z.discriminatedUnion('templateVersion', [
  conversationContextV1ReferenceSchema.extend({ sources: z.array(responseSourceSchema).max(CONVERSATION_CONTEXT_LIMITS.references) }).strip(),
  conversationContextV2ReferenceSchema.extend({
    sources: z.array(responseSourceSchema).max(CONVERSATION_CONTEXT_LIMITS.references),
    attachments: z.array(responseAttachmentSchema).min(1).max(CONVERSATION_CONTEXT_LIMITS.references),
  }).strip(),
]).superRefine(validateContextReferences);

/** Empty/absent attachments take the unchanged v1 branch; no references means no context. */
export function conversationContextTemplate(knowledge: readonly KnowledgeCitation[] = [], attachments: readonly AttachmentReference[] = []): 1 | 2 | null {
  conversationContextSelectionSchema.parse(knowledge); attachmentSelectionSchema.parse(attachments);
  if (knowledge.length + attachments.length > CONVERSATION_CONTEXT_LIMITS.references) throw Error('conversation_context_budget');
  const projects = new Set([...knowledge.map(ref => ref.projectId), ...attachments.map(ref => ref.projectId)]);
  if (projects.size > 1) throw Error('attachment_reference_mismatch');
  return attachments.length ? 2 : knowledge.length ? 1 : null;
}

const citationKey = (citation: KnowledgeCitation) => JSON.stringify([citation.projectId, citation.sourceId, citation.version, citation.contentDigest, citation.locator.start, citation.locator.end]);

/** Pure v2 guard shared by consumers after validating the outer task/turn/queue receipt.
 * Ordered references come from the frozen request. Optional descriptors are extra
 * expectations from verified upload receipts, never inferred from a bare reference.
 * A mismatch leaves command admission unknown; this function grants no authorization. */
export function parseAttachmentContextReceipt(expected: {
  projectId: string; knowledge?: readonly KnowledgeCitation[]; attachments: readonly AttachmentReference[];
  descriptors?: readonly AttachmentDescriptor[];
}, wire: unknown): ConversationContextV2Reference {
  const projectId = idSchema.parse(expected.projectId);
  const knowledge = conversationContextSelectionSchema.parse(expected.knowledge ?? []);
  const attachments = attachmentSelectionSchema.parse(expected.attachments);
  const descriptors = expected.descriptors?.map(({ reference, name, mediaType, byteLength }) => attachmentDescriptorSchema.parse({ reference, name, mediaType, byteLength }));
  if (conversationContextTemplate(knowledge, attachments) !== 2) throw Error('Attachment receipt requires nonempty frozen attachments.');
  if (descriptors && descriptors.length !== attachments.length) throw Error('attachment_reference_mismatch');
  const actual = conversationContextResponseSchema.parse(wire);
  if (actual.templateVersion !== 2 || actual.sources.length !== knowledge.length || actual.attachments.length !== attachments.length) throw Error('attachment_reference_mismatch');
  for (const [index, citation] of knowledge.entries()) {
    if (citation.projectId !== projectId || citationKey(actual.sources[index]!.citation) !== citationKey(citation)) throw Error('attachment_reference_mismatch');
  }
  for (const [index, reference] of attachments.entries()) {
    const received = actual.attachments[index]!;
    if (reference.projectId !== projectId || attachmentReferenceKey(received.reference) !== attachmentReferenceKey(reference)) throw Error('attachment_reference_mismatch');
    const descriptor = descriptors?.[index];
    if (descriptor && (attachmentReferenceKey(descriptor.reference) !== attachmentReferenceKey(reference)
      || received.byteLength !== descriptor.byteLength || received.name !== descriptor.name || received.mediaType !== descriptor.mediaType)) throw Error('attachment_reference_mismatch');
  }
  return actual;
}
