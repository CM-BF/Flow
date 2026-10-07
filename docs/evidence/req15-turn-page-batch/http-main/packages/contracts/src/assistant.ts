import { z } from 'zod';
import { claudeTurnSettingsSchema } from './claude-turn-settings.js';
import { idSchema, MAX_DETAIL_BYTES, type Reference } from './tasks.js';

const model = z.string().min(1).max(180);
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const content = z.string().max(MAX_DETAIL_BYTES).refine(value => new TextEncoder().encode(value).byteLength <= MAX_DETAIL_BYTES, 'Assistant content exceeds byte limit');
export const CODEX_ASSISTANT_SOURCE = 'codex.app-server.agent-message';
export const assistantSettingsSchema = z.strictObject({
  requested: z.strictObject({ model, permissionMode: z.literal('dontAsk'), thinking: z.literal('disabled') }),
  // Only init-reported values are effective facts. The SDK does not attest effective thinking.
  effective: z.strictObject({ model: model.nullable(), permissionMode: z.string().min(1).max(180).nullable(), tools: z.array(z.string().min(1).max(200)).max(100).nullable(), thinking: z.literal('unknown') }),
});
/** Latest matching init from this query, not proof of the controls used throughout the turn. */
export const claudeMessageSettingsFinalSchema = z.strictObject({
  snapshot: claudeTurnSettingsSchema,
  observed: z.strictObject({
    source: z.literal('claude.sdk.system.init'), model,
    effort: z.enum(['low', 'medium', 'high', 'xhigh', 'max']).nullable().optional(),
    fastModeState: z.enum(['off', 'cooldown', 'on']).optional(),
    fastModeDisabledReason: z.enum(['free', 'preference', 'extra_usage_disabled', 'network_error', 'unknown',
      'not_first_party', 'disabled_by_env', 'model_not_allowed', 'sdk_opt_in_required', 'pending']).optional(),
  }).nullable(),
}).refine(value => new TextEncoder().encode(JSON.stringify(value)).byteLength <= 2048, 'Message settings observations exceed the canonical JSON byte limit');
export type ClaudeMessageSettingsFinal = z.infer<typeof claudeMessageSettingsFinalSchema>;
// Keep the legacy codec/type intact. New finals never fabricate its disabled-only requested field.
export const claudeAssistantSettingsSchema = z.union([assistantSettingsSchema, z.strictObject({
  effective: assistantSettingsSchema.shape.effective, messageSettings: claudeMessageSettingsFinalSchema,
}).superRefine((settings, context) => {
  if (settings.effective.model !== (settings.messageSettings.observed?.model ?? null)) {
    context.addIssue({ code: 'custom', path: ['effective', 'model'], message: 'Claude effective model must match the reported initialization, or be null when no initialization was observed.' });
  }
})]);
export type ClaudeAssistantSettings = z.infer<typeof claudeAssistantSettingsSchema>;
const nativeId = idSchema.refine(value => new TextEncoder().encode(value).byteLength <= 128, 'Native identity exceeds byte limit');
export const codexSourceIdentitySchema = z.strictObject({ turnId: nativeId, itemId: nativeId });
export type CodexSourceIdentity = z.infer<typeof codexSourceIdentitySchema>;
export const codexAssistantSettingsSchema = z.strictObject({
  requested: z.strictObject({ model, reasoningEffort: model.nullable(), serviceTier: model.nullable(), serviceTierForTurn: model.nullable(), access: z.literal('none') }),
  // Observed configuration is not evidence of the model, tools, effort or tier actually used for a turn.
  observedThreadConfiguration: z.strictObject({ model, modelProvider: model, reasoningEffort: model.nullable(), serviceTier: model.nullable(),
    approvalPolicy: z.literal('never'), sandbox: z.strictObject({ type: z.literal('readOnly'), networkAccess: z.literal(false) }) }).nullable(),
  actualExecution: z.strictObject({ model: z.null(), reasoningEffort: z.null(), serviceTier: z.null(), tools: z.null(), evidence: z.literal('unknown') }),
});
export type CodexAssistantSettings = z.infer<typeof codexAssistantSettingsSchema>;
export type AssistantSettings = z.infer<typeof assistantSettingsSchema>;
export type NativeAssistantSettings = ClaudeAssistantSettings | CodexAssistantSettings;
export const claudeAssistantFinalDataSchema = z.strictObject({
  type: z.literal('assistant-final'), messageId: digest, nativeSessionId: idSchema,
  source: z.literal('claude.sdk.result'), sourceMessageId: idSchema, content, settings: claudeAssistantSettingsSchema,
});
export const codexAssistantFinalDataSchema = z.strictObject({
  type: z.literal('assistant-final'), messageId: digest, nativeSessionId: nativeId,
  source: z.literal(CODEX_ASSISTANT_SOURCE), sourceMessageId: digest, nativeSourceIdentity: codexSourceIdentitySchema,
  content, settings: codexAssistantSettingsSchema,
});
export const assistantFinalDataSchema = z.discriminatedUnion('source', [claudeAssistantFinalDataSchema, codexAssistantFinalDataSchema]);
export type AssistantFinalData = z.infer<typeof assistantFinalDataSchema>;
/** Body is fetched separately. Identity comes from the authenticated attempt, never a runner-supplied conversation. */
interface MessageReference {
  id: string; taskId: string; attemptId: string; eventId: string; sequence: number;
  nativeSessionId: string; sourceMessageId: string; contentDigest: string; detail: Reference; createdAt: string;
}
export type ClaudeAssistantMessageReference = MessageReference & { source: 'claude.sdk.result' };
export type CodexAssistantMessageReference = MessageReference & { source: typeof CODEX_ASSISTANT_SOURCE; nativeSourceIdentity: CodexSourceIdentity };
export type AssistantMessageReference = ClaudeAssistantMessageReference | CodexAssistantMessageReference;
export type AssistantMessage = (ClaudeAssistantMessageReference & { content: string; settings: ClaudeAssistantSettings })
  | (CodexAssistantMessageReference & { content: string; settings: CodexAssistantSettings });
export interface AssistantMessagePage { messages: AssistantMessageReference[]; nextCursor: string | null }
