import { z } from 'zod';
import { idSchema, MAX_DETAIL_BYTES, type Reference } from './tasks.js';

const model = z.string().min(1).max(180);
export const assistantSettingsSchema = z.strictObject({
  requested: z.strictObject({ model, permissionMode: z.literal('dontAsk'), thinking: z.literal('disabled') }),
  // Only init-reported values are effective facts. The SDK does not attest effective thinking.
  effective: z.strictObject({ model: model.nullable(), permissionMode: z.string().min(1).max(180).nullable(), tools: z.array(z.string().min(1).max(200)).max(100).nullable(), thinking: z.literal('unknown') }),
});
export const assistantFinalDataSchema = z.strictObject({
  type: z.literal('assistant-final'),
  messageId: z.string().regex(/^[a-f0-9]{64}$/),
  nativeSessionId: idSchema,
  source: z.literal('claude.sdk.result'),
  sourceMessageId: idSchema,
  content: z.string().max(MAX_DETAIL_BYTES).refine(value => new TextEncoder().encode(value).byteLength <= MAX_DETAIL_BYTES, 'Assistant content exceeds byte limit'),
  settings: assistantSettingsSchema,
});
export type AssistantFinalData = z.infer<typeof assistantFinalDataSchema>;
export type AssistantSettings = z.infer<typeof assistantSettingsSchema>;
/** Body is fetched separately. Identity comes from the authenticated attempt, never a runner-supplied conversation. */
export interface AssistantMessageReference {
  id: string;
  taskId: string;
  attemptId: string;
  eventId: string;
  sequence: number;
  nativeSessionId: string;
  source: 'claude.sdk.result';
  sourceMessageId: string;
  contentDigest: string;
  detail: Reference;
  settings: AssistantSettings;
  createdAt: string;
}
export interface AssistantMessage extends AssistantMessageReference { content: string }
export interface AssistantMessagePage { messages: AssistantMessageReference[]; nextCursor: string | null }
