import { describe, expect, it } from 'vitest';
import { conversationCreationSchema } from './conversations.js';
import { acceptsNativeConversations, conversationHarness } from './conversation-harness.js';
const pin = { id: '00000000-0000-4000-8000-000000000001', runnerId: '00000000-0000-4000-8000-000000000002', configDigest: 'a'.repeat(64) };
const input = { title: 'Native', harness: 'codex', executionProfile: pin, requested: { model: 'runner-default', thinking: 'unknown', tools: 'none' } };
describe('native conversation codec', () => {
  it('preserves legacy defaults byte shape', () => expect(conversationCreationSchema.parse({ title: 'Old' })).toEqual({ title: 'Old', harness: 'claude', requested: { model: 'runner-default', thinking: 'disabled', tools: 'configured-readonly' } }));
  it('accepts pinned native intent with unknown thinking', () => expect(conversationCreationSchema.parse(input)).toEqual(input));
  it.each([{ ...input, executionProfile: undefined }, { ...input, requested: { ...input.requested, thinking: 'disabled' } }, { ...input, harness: 'other' }])('rejects missing pin or invented controls %#', value => expect(conversationCreationSchema.safeParse(value).success).toBe(false));
  it('does not expand legacy Claude thinking to unknown', () => expect(conversationCreationSchema.safeParse({ ...input, harness: 'claude' }).success).toBe(false));
  it('requires exactly one recognized protocol value', () => { expect(acceptsNativeConversations(['X-Flow-Conversation', 'native-v1'])).toBe(true); for (const headers of [[], ['X-Flow-Conversation','native-v2'], ['X-Flow-Conversation','native-v1','x-flow-conversation','native-v1']]) expect(acceptsNativeConversations(headers)).toBe(false); });
  it('retains finite source and adapter binding', () => { expect(conversationHarness('codex')?.source).toBe('codex.app-server.agent-message'); expect(conversationHarness('unknown')).toBeNull(); });
});
