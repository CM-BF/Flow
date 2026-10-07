import { createHash } from 'node:crypto';
import { CODEX_ASSISTANT_SOURCE, codexSourceIdentitySchema, type AssistantFinalData, type CodexSourceIdentity } from '../../../packages/contracts/src/assistant.js';
import { CODEX_ADAPTER_VERSION } from '../../../packages/contracts/src/execution-profiles.js';

const sources = [
  { harness: 'claude', source: 'claude.sdk.result', adapterVersion: 'claude-sdk-0.3.290-v2' },
  { harness: 'codex', source: CODEX_ASSISTANT_SOURCE, adapterVersion: CODEX_ADAPTER_VERSION },
] as const;
export type AssistantSource = typeof sources[number]['source'];
/** Only fixed source/harness combinations have identity authority. No caller registration. */
export function assistantSourcePolicy(harness: string, source: string) {
  return sources.find(policy => policy.harness === harness && policy.source === source) ?? null;
}
function digest(parts: readonly string[]) { return createHash('sha256').update(JSON.stringify(parts)).digest('hex'); }
export function codexSourceMessageId(identity: CodexSourceIdentity): string {
  return digest([identity.turnId, identity.itemId]);
}
export function assistantMessageId(source: AssistantSource, nativeSessionId: string, sourceMessageId: string): string {
  return digest(source === 'claude.sdk.result' ? [nativeSessionId, sourceMessageId] : [source, nativeSessionId, sourceMessageId]);
}
/** Used for both newly admitted events and persisted references; raw identities are never truncated. */
export function validAssistantIdentity(value: Pick<AssistantFinalData, 'source' | 'messageId' | 'nativeSessionId' | 'sourceMessageId'> & { nativeSourceIdentity?: unknown }): boolean {
  if (value.source === CODEX_ASSISTANT_SOURCE) {
    const identity = codexSourceIdentitySchema.safeParse(value.nativeSourceIdentity);
    if (!identity.success || value.sourceMessageId !== codexSourceMessageId(identity.data)) return false;
  } else if (value.source !== 'claude.sdk.result' || value.nativeSourceIdentity != null) return false;
  return value.messageId === assistantMessageId(value.source, value.nativeSessionId, value.sourceMessageId);
}
