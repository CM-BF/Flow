import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { assistantMessageId, assistantSourcePolicy, codexSourceMessageId, validAssistantIdentity } from './native-harness-policy.js';
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
it('recognizes only fixed harness/source combinations', () => {
  expect(assistantSourcePolicy('codex', 'codex.app-server.agent-message')?.adapterVersion).toBe('codex-app-server-0.154.0-v1');
  expect(assistantSourcePolicy('claude', 'codex.app-server.agent-message')).toBeNull();
  expect(assistantSourcePolicy('codex', 'claude.sdk.result')).toBeNull();
  expect(assistantSourcePolicy('future', 'future.final')).toBeNull();
});
it('preserves Claude identity while separating Codex and retaining turn/item distinctions', () => {
  const nativeSourceIdentity = { turnId: 'turn', itemId: 'item' };
  const sourceMessageId = codexSourceMessageId(nativeSourceIdentity);
  expect(sourceMessageId).toBe(hash(['turn', 'item']));
  expect(assistantMessageId('claude.sdk.result', 'session', sourceMessageId)).toBe(hash(['session', sourceMessageId]));
  const event = { source: 'codex.app-server.agent-message' as const, nativeSessionId: 'session', sourceMessageId, nativeSourceIdentity,
    messageId: assistantMessageId('codex.app-server.agent-message', 'session', sourceMessageId) };
  expect(event.messageId).toBe(hash([event.source, 'session', sourceMessageId]));
  expect(validAssistantIdentity(event)).toBe(true);
  expect(validAssistantIdentity({ ...event, nativeSourceIdentity: { turnId: 'other-turn', itemId: 'item' } })).toBe(false);
  expect(validAssistantIdentity({ ...event, messageId: hash(['session', sourceMessageId]) })).toBe(false);
  expect(validAssistantIdentity({ ...event, nativeSourceIdentity: { turnId: '界'.repeat(43), itemId: 'item' } })).toBe(false);
});
