import { z } from 'zod';
import { claudeTurnSettingsSchema, type ClaudeTurnSettings } from './claude-turn-settings.js';
import { attachmentSelectionSchema } from './attachments.js';
import { idSchema } from './tasks.js';
import { conversationContextSelectionSchema, type ConversationContextReference } from './conversation-context.js';
import { executionProfileReferenceSchema } from './execution-profiles.js';
import type { Detail, TaskSummary } from './tasks.js';
import type { CodexAssistantSettings, CodexSourceIdentity, AssistantSettings, ClaudeMessageSettingsFinal } from './assistant.js';

/** Requested controls are validated against the selected adapter before admission. */
export const conversationSettingsSchema = z.strictObject({
  model: z.string().trim().min(1).max(180).default('runner-default'),
  thinking: z.enum(['disabled', 'enabled', 'adaptive', 'unknown']).default('disabled'),
  tools: z.enum(['configured-readonly', 'none']).default('configured-readonly'),
});
export type ConversationSettings = z.infer<typeof conversationSettingsSchema>;
export const conversationCreationSchema = z.strictObject({
  title: z.string().trim().min(1).max(180),
  harness: z.enum(['claude', 'codex']).default('claude'),
  executionProfile: executionProfileReferenceSchema.optional(),
  projectId: idSchema.optional(),
  requested: conversationSettingsSchema.default({ model: 'runner-default', thinking: 'disabled', tools: 'configured-readonly' }),
}).superRefine((value, context) => {
  if (value.harness === 'codex' ? !value.executionProfile || value.requested.thinking !== 'unknown' || value.requested.tools !== 'none' : value.requested.thinking === 'unknown') {
    context.addIssue({ code: 'custom', message: 'Codex conversations require a pinned profile, unknown thinking and requested tools none.' });
  }
});
export type ConversationCreation = z.infer<typeof conversationCreationSchema>;
export const conversationTurnSchema = z.strictObject({
  expectedRevision: z.number().int().min(0).max(2_147_483_646),
  text: z.string().min(1).max(16_000).refine(value => value.trim().length > 0),
  mode: z.enum(['follow-up', 'queue', 'steer']).default('follow-up'),
  knowledge: conversationContextSelectionSchema.optional(),
  attachments: attachmentSelectionSchema.optional(),
  messageSettings: claudeTurnSettingsSchema.optional(),
});
export type ConversationTurnAdmission = z.infer<typeof conversationTurnSchema>;
export const conversationTurnQuerySchema = z.strictObject({
  after: z.coerce.number().int().min(0).max(2_147_483_647).default(0),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export const conversationListQuerySchema = z.strictObject({
  after: z.string().min(1).max(128).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export interface ConversationCapabilities {
  /** Configured policy only; old literal capability flags remain unchanged. */
  messageSettings?: { protocol: ClaudeTurnSettings['protocol']; profile: ClaudeTurnSettings['profile']; choices: 'execution-profile' };
  knowledgeContext?: boolean;
  /** Missing/false forbids attachment admission. Read the project limits before uploading. */
  attachmentContext?: boolean;
  followUp: true;
  /** Capability varies by center version; older centers may not expose durable queues. */
  queue: boolean;
  steer: false;
  /** Missing/false means unsupported. GET advertises patch-v1 readability only after explicit
   * client negotiation; creation ACK stays false. This does not promise provider deltas. */
  liveAssistantText?: boolean;
  perTurnModel: false;
  perTurnThinking: false;
  perTurnTools: false;
}
export interface ConversationSummary extends ConversationCreation {
  id: string;
  /** Admission CAS only. Execution updates require task.updatedAt/reply-source refresh. */
  revision: number;
  createdAt: string;
  updatedAt: string;
}
/** Native identity is execution state, never the conversation's primary ID. */
export interface ConversationSession {
  nativeSessionId: string;
  runnerId: string;
  sourceTaskId: string;
  sourceAttemptId: string;
}
export interface ConversationEffectiveSettings {
  model: string | null;
  thinking: 'disabled' | 'unknown';
  tools: 'configured-readonly' | 'unknown' | string[] | null;
  permissionMode?: string | null;
  /** Adapter request is evidence, separate from the user's conversation.requested controls. */
  runnerRequested?: AssistantSettings['requested'];
  /** Preserves native requested/observed/actual separation; no Claude controls are fabricated. */
  codex?: CodexAssistantSettings;
  messageSettings?: ClaudeMessageSettingsFinal;
  source: { kind: 'recorded-adapter-session'; adapterVersion: string; taskId: string; attemptId: string; detailId: string } |
    { kind: 'assistant-final'; messageId: string; taskId: string; attemptId: string; detailId: string } | null;
}
export interface ConversationDetailReference {
  kind: Detail['kind'];
  id: string;
  title: string;
  taskId: string;
  attemptId: string;
}
export interface ConversationArtifactReplySource {
  kind: 'adapter-final-artifact';
  adapterVersion: 'claude-sdk-0.3.290-v1';
  taskId: string;
  attemptId: string;
  artifactId: string;
  artifactVersion: string;
  detailId: string;
}
interface ConversationTypedReplyIdentity {
  kind: 'assistant-final';
  messageId: string;
  taskId: string;
  attemptId: string;
  nativeSessionId: string;
  eventId: string;
  sourceMessageId: string;
  contentDigest: string;
  detailId: string;
}
export type ConversationTypedReplySource = ConversationTypedReplyIdentity & (
  { source: 'claude.sdk.result'; nativeSourceIdentity?: never } |
  { source: 'codex.app-server.agent-message'; nativeSourceIdentity: CodexSourceIdentity });
export type ConversationReplySource = ConversationArtifactReplySource | ConversationTypedReplySource;
export type ConversationAssistantReply = {
  state: 'available';
  role: 'assistant';
  messageId: string;
  text: string;
  truncated: boolean;
  contentRef: ConversationDetailReference;
  source: ConversationReplySource;
} | {
  state: 'pending' | 'unavailable';
  reason: 'execution-pending' | 'execution-not-succeeded' | 'unknown-adapter' | 'missing-session' | 'missing-result' | 'ambiguous-result' | 'invalid-result';
};
export interface ConversationTurn {
  messageSettings?: ClaudeTurnSettings;
  context?: ConversationContextReference;
  id: string;
  conversationId: string;
  number: number;
  createdAt: string;
  user: { role: 'user'; text: string };
  task: TaskSummary;
  assistant: ConversationAssistantReply;
  effective: ConversationEffectiveSettings;
  telemetry: { kind: 'execution'; taskId: string; title: string };
}
export interface ConversationSnapshot {
  conversation: ConversationSummary;
  capabilities: ConversationCapabilities;
  nativeSession: ConversationSession | null;
  lastTurn: ConversationTurn | null;
}
export interface ConversationTurnPage {
  conversation: ConversationSummary;
  turns: ConversationTurn[];
  nextCursor: number | null;
}
export interface ConversationList { conversations: ConversationSummary[]; nextCursor: string | null }
export interface ConversationCreated { conversation: ConversationSummary; capabilities: ConversationCapabilities; replayed: boolean }
export interface ConversationTurnAccepted { conversation: ConversationSummary; turn: ConversationTurn; replayed: boolean }
