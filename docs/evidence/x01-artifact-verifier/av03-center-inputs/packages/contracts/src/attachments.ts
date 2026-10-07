import { z } from 'zod';
import { idSchema } from './tasks.js';

/** text-v1 bounds are resource policy, not a model's context or file capability. */
export const ATTACHMENT_LIMITS = {
  fileBytes: 8192, references: 4, nameBytes: 512, pageSize: 20, queryBytes: 256,
  unboundTtlSeconds: 86_400, resourcesPerProject: 128, retainedBytesPerProject: 1_048_576,
  contentResponseBytes: 65_536, uploadKeyLength: 200,
} as const;
const encoder = new TextEncoder();
const digestSchema = z.string().regex(/^[a-f0-9]{64}$/);
const validUnicode = (text: string) => !/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(text) && !text.includes('\0');
const bytes = (text: string) => encoder.encode(text).length;

export const attachmentTextSchema = z.string().min(1).max(ATTACHMENT_LIMITS.fileBytes)
  .refine(validUnicode, 'Text must contain valid Unicode without NUL.')
  .refine(text => text.length <= ATTACHMENT_LIMITS.fileBytes && bytes(text) <= ATTACHMENT_LIMITS.fileBytes, 'Text exceeds 8192 UTF-8 bytes.');

/** Fatal decoding preserves BOM and line endings; never substitutes malformed bytes. */
export function decodeAttachmentText(input: Uint8Array): string {
  if (!input.byteLength || input.byteLength > ATTACHMENT_LIMITS.fileBytes) throw Error('Attachment byte length is outside text-v1 limits.');
  const text = attachmentTextSchema.parse(new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(input));
  const encoded = encoder.encode(text);
  if (encoded.length !== input.length || encoded.some((value, index) => value !== input[index])) throw Error('Attachment UTF-8 round trip changed the original bytes.');
  return text;
}

export const attachmentNameSchema = z.string().min(1).max(255)
  .refine(name => name.length <= 255 && validUnicode(name) && name.trim().length > 0 && !/[\p{Cc}/\\]/u.test(name) && bytes(name) <= ATTACHMENT_LIMITS.nameBytes, 'Use a display name, not a path.')
  .refine(name => name.toLowerCase().endsWith('.txt'), 'text-v1 accepts .txt files only.');
export const attachmentReferenceSchema = z.strictObject({
  kind: z.literal('upload'), projectId: idSchema, resourceId: z.uuid(), version: z.literal(1), contentDigest: digestSchema,
});
export type AttachmentReference = z.infer<typeof attachmentReferenceSchema>;
export function attachmentReferenceKey(ref: AttachmentReference): string {
  return JSON.stringify([ref.kind, ref.projectId, ref.resourceId, ref.version, ref.contentDigest]);
}
export const attachmentSelectionSchema = z.array(attachmentReferenceSchema).max(ATTACHMENT_LIMITS.references)
  .refine(refs => new Set(refs.map(attachmentReferenceKey)).size === refs.length, 'Duplicate exact attachments are not allowed.');

/** Immutable display facts frozen with a context; no local path or source body. */
export const attachmentDescriptorSchema = z.strictObject({
  reference: attachmentReferenceSchema, name: attachmentNameSchema, mediaType: z.literal('text/plain'),
  byteLength: z.number().int().min(1).max(ATTACHMENT_LIMITS.fileBytes),
});
export type AttachmentDescriptor = z.infer<typeof attachmentDescriptorSchema>;
export const attachmentMetadataSchema = attachmentDescriptorSchema.extend({
  createdAt: z.iso.datetime(), expiresAt: z.iso.datetime(), state: z.enum(['ready', 'expired']), retained: z.boolean(),
}).refine(value => Date.parse(value.expiresAt) > Date.parse(value.createdAt), 'Expiry must follow creation.');
export type AttachmentMetadata = z.infer<typeof attachmentMetadataSchema>;

export const attachmentUploadSchema = z.strictObject({
  recoveryScopeId: z.uuid(), name: attachmentNameSchema, mediaType: z.literal('text/plain'), text: attachmentTextSchema,
  byteLength: z.number().int().min(1).max(ATTACHMENT_LIMITS.fileBytes), contentDigest: digestSchema,
}).refine(value => bytes(value.text) === value.byteLength, 'byteLength must describe the exact UTF-8 text.');
export type AttachmentUpload = z.infer<typeof attachmentUploadSchema>;

/** Format checks are synchronous; callers must also verify this cryptographic equality. */
export async function assertAttachmentTextDigest(text: string, expectedDigest: string): Promise<void> {
  const valid = attachmentTextSchema.parse(text); const expected = digestSchema.parse(expectedDigest);
  const result = await globalThis.crypto.subtle.digest('SHA-256', encoder.encode(valid));
  const actual = Array.from(new Uint8Array(result), value => value.toString(16).padStart(2, '0')).join('');
  if (actual !== expected) throw Error('attachment_digest_mismatch');
}

export const attachmentUploadKeySchema = z.string().min(1).max(ATTACHMENT_LIMITS.uploadKeyLength)
  .regex(/^[\x21-\x7e]+$/, 'An upload key must use visible ASCII without whitespace.');
/** The saved first receipt stays ready even if a later GET says expired. */
export const attachmentReceiptSchema = z.strictObject({
  uploadKey: attachmentUploadKeySchema, recoveryScopeId: z.uuid(), requestDigest: digestSchema,
  resource: attachmentMetadataSchema.refine(value => value.state === 'ready' && !value.retained, 'A first publication receipt describes an unbound ready resource.'),
});
export type AttachmentReceipt = z.infer<typeof attachmentReceiptSchema>;
export const attachmentAcceptedSchema = attachmentReceiptSchema.extend({ replayed: z.boolean() });
export type AttachmentAccepted = z.infer<typeof attachmentAcceptedSchema>;
export const attachmentReceiptQuerySchema = z.strictObject({ scope: z.uuid(), key: attachmentUploadKeySchema });
/** A 404 has no such object: it is not proof of rejection, absence, or safe new-key retry. */
export const attachmentReceiptLookupSchema = z.strictObject({
  receipt: attachmentReceiptSchema,
  current: z.discriminatedUnion('state', [
    z.strictObject({ state: z.literal('ready'), retained: z.boolean() }),
    z.strictObject({ state: z.literal('expired'), retained: z.boolean() }),
    z.strictObject({ state: z.literal('unavailable'), retained: z.null() }),
  ]),
});
export type AttachmentReceiptLookup = z.infer<typeof attachmentReceiptLookupSchema>;

export const attachmentListQuerySchema = z.strictObject({
  after: z.uuid().optional(), limit: z.coerce.number().int().min(1).max(ATTACHMENT_LIMITS.pageSize).default(20),
  q: z.string().min(1).max(ATTACHMENT_LIMITS.queryBytes).refine(value => validUnicode(value) && bytes(value) <= ATTACHMENT_LIMITS.queryBytes).optional(),
});
export const attachmentListSchema = z.strictObject({ resources: z.array(attachmentMetadataSchema).max(ATTACHMENT_LIMITS.pageSize), nextCursor: z.uuid().nullable() });
export type AttachmentList = z.infer<typeof attachmentListSchema>;
export const attachmentContentQuerySchema = z.strictObject({ digest: digestSchema });
export const attachmentContentSchema = attachmentDescriptorSchema.extend({ text: attachmentTextSchema })
  .refine(value => bytes(value.text) === value.byteLength, 'Content byte length does not match.')
  .refine(value => bytes(JSON.stringify(value)) <= ATTACHMENT_LIMITS.contentResponseBytes, 'Encoded content exceeds the response budget.');
export type AttachmentContent = z.infer<typeof attachmentContentSchema>;

/** Database namespace only. A matching scope never grants owner or project authorization. */
export const attachmentCapabilitiesSchema = z.strictObject({
  protocol: z.literal('text-v1'), recoveryScopeId: z.uuid(), projectId: idSchema, requiresProject: z.literal(true),
  mediaTypes: z.tuple([z.literal('text/plain')]), extensions: z.tuple([z.literal('.txt')]),
  maxFileBytes: z.literal(ATTACHMENT_LIMITS.fileBytes), maxCombinedReferences: z.literal(4), maxCombinedBytes: z.literal(8192),
  order: z.literal('knowledge-then-attachments'), unboundTtlSeconds: z.literal(ATTACHMENT_LIMITS.unboundTtlSeconds),
  resourcesPerProject: z.literal(ATTACHMENT_LIMITS.resourcesPerProject), retainedBytesPerProject: z.literal(ATTACHMENT_LIMITS.retainedBytesPerProject),
});
export type AttachmentCapabilities = z.infer<typeof attachmentCapabilitiesSchema>;

/** Error codes do not classify an earlier unknown command as definitely rejected. */
export const ATTACHMENT_ERRORS = {
  invalid_attachment_request: 400, invalid_attachment_text: 400, attachment_digest_mismatch: 400,
  attachment_too_large: 413, attachment_type_unsupported: 415,
  attachment_not_found: 404, attachment_upload_receipt_not_found: 404,
  attachment_scope_mismatch: 409, attachment_reference_mismatch: 409, attachment_budget: 409,
  attachment_expired: 410,
} as const;
