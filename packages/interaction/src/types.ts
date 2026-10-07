import { z } from 'zod';
import type { FlowClient } from '@flow/client';
import { conversationCreationSchema, conversationTurnSchema, type ConversationQueuePage } from '@flow/contracts';
import { queuePauseIntentSchema, queueResumeIntentSchema } from './queue-control/index.js';
import { taskCancelIntentSchema } from './task-control/index.js';
import type { TurnObservationView } from './observation/index.js';
import type { MessageSettingsView, MessageSettingsEvidence } from './message-settings/index.js';
import type { Command } from './commands.js';
const identity = { version: z.literal(1), connectionId: z.string().min(1).max(160), key: z.uuid() };
export const intentSchema = z.discriminatedUnion('kind', [
  z.strictObject({ ...identity, kind: z.literal('create'), input: conversationCreationSchema }),
  z.strictObject({ ...identity, kind: z.literal('send'), conversationId: z.uuid(), input: conversationTurnSchema.extend({ mode: z.literal('follow-up') }) }),
  queuePauseIntentSchema,
  queueResumeIntentSchema,
  taskCancelIntentSchema,
]);
export type Intent = z.infer<typeof intentSchema>;
export interface IntentStore { load(): Promise<Intent | null>; save(intent: Intent): Promise<void>; clear(): Promise<void> }
export type InteractionClient = Pick<FlowClient, 'conversations' | 'conversation' | 'conversationTurns' | 'executionProfiles' | 'createConversation' | 'submitConversationTurn'>;
export interface TurnView {
  id: string; number: number; taskId: string; status: string; userText: string;
  assistant: { state: string; text: string | null; truncated: boolean; messageId: string | null };
  effectiveModel: string | null;
  messageSettings?: MessageSettingsEvidence;
}
export interface InteractionSnapshot {
  view: 'conversation' | 'conversations' | 'profiles' | 'help' | 'queue' | 'settings';
  connected: boolean; busy: boolean; closed: boolean; draft: string; notice: string;
  observation: TurnObservationView | null;
  settings: MessageSettingsView;
  queue: ConversationQueuePage | null;
  selected: { id: string; title: string; revision: number; requestedModel: string } | null;
  turns: TurnView[];
  conversations: { id: string; title: string }[]; conversationCursor: string | null;
  profiles: { id: string; model: string; access: string; availability: 'not-probed' }[]; profileCursor: string | null;
  pending: { kind: Intent['kind']; status: 'sending' | 'unknown' } | null;
}
export interface CommandResult { ok: boolean; code: string; message: string }
export interface InteractionController {
  initialize(): Promise<void>;
  execute(command: Command): Promise<CommandResult>;
  input(text: string): Promise<CommandResult>;
  setDraft(text: string): boolean;
  snapshot(): InteractionSnapshot;
  subscribe(listener: () => void): () => void;
  disconnect(): void;
  dispose(): Promise<void>;
}
