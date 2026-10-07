import { decodeConversationCreated, decodeConversationTurnAccepted } from '@flow/client';
import type { ConversationSummary } from '@flow/contracts';
import type { Intent } from './types.js';
/** Also protects injected ports: all transports use the same stateless receipt rules. */
export function acknowledgedConversation(intent: Extract<Intent, { kind: 'create' | 'send' }>, value: unknown): ConversationSummary {
  return (intent.kind === 'create' ? decodeConversationCreated(value, intent.input)
    : decodeConversationTurnAccepted(value, intent.conversationId, intent.input)).conversation;
}
