import { CODEX_ASSISTANT_SOURCE } from './assistant.js';
import { CODEX_ADAPTER_VERSION } from './execution-profiles.js';

export const CONVERSATION_HEADER = 'X-Flow-Conversation';
export const NATIVE_CONVERSATION_VERSION = 'native-v1';
/** Finite conversation codecs. These describe receipt identity, not execution authority. */
export const conversationHarnesses = {
  claude: { source: 'claude.sdk.result', adapters: ['claude-sdk-0.3.290-v1', 'claude-sdk-0.3.290-v2'] },
  codex: { source: CODEX_ASSISTANT_SOURCE, adapters: [CODEX_ADAPTER_VERSION] },
} as const;
export type ConversationHarness = keyof typeof conversationHarnesses;
export function conversationHarness(value: string) {
  return value === 'claude' || value === 'codex' ? conversationHarnesses[value] : null;
}
/** Duplicate or unknown headers stay on the legacy contract. */
export function acceptsNativeConversations(rawHeaders: readonly string[]): boolean {
  const values: string[] = [];
  for (let i = 0; i < rawHeaders.length; i += 2) if (rawHeaders[i]?.toLowerCase() === CONVERSATION_HEADER.toLowerCase()) values.push(rawHeaders[i + 1] ?? '');
  return values.length === 1 && values[0] === NATIVE_CONVERSATION_VERSION;
}
