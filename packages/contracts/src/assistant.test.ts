import { expect, it } from 'vitest';
import { assistantFinalDataSchema } from './assistant.js';
import { runnerEventSchema } from './runner.js';

const codex = () => ({ type: 'assistant-final', source: 'codex.app-server.agent-message', messageId: 'a'.repeat(64), nativeSessionId: 'thread', sourceMessageId: 'b'.repeat(64),
  nativeSourceIdentity: { turnId: 'turn', itemId: 'item' }, content: '最终正文 🌱', settings: {
    requested: { model: 'gpt-5.4', reasoningEffort: null, serviceTier: null, serviceTierForTurn: 'default', access: 'none' },
    observedThreadConfiguration: null, actualExecution: { model: null, reasoningEffort: null, serviceTier: null, tools: null, evidence: 'unknown' },
  } });
it('accepts only recognized strict final branches in the runner envelope', () => {
  expect(runnerEventSchema.parse({ ...codex(), id: 'event', sequence: 2 })).toMatchObject(codex());
  expect(assistantFinalDataSchema.safeParse({ ...codex(), source: 'future.provider' }).success).toBe(false);
  expect(assistantFinalDataSchema.safeParse({ ...codex(), source: 'claude.sdk.result' }).success).toBe(false);
  expect(assistantFinalDataSchema.safeParse({ ...codex(), nativeSourceIdentity: { turnId: 'turn', itemId: 'item', invented: true } }).success).toBe(false);
});
it('bounds raw identity and UTF-8 content without truncating either', () => {
  expect(assistantFinalDataSchema.safeParse({ ...codex(), nativeSourceIdentity: { turnId: '界'.repeat(43), itemId: 'item' } }).success).toBe(false);
  expect(assistantFinalDataSchema.safeParse({ ...codex(), content: '界'.repeat(349526) }).success).toBe(false);
  expect(assistantFinalDataSchema.parse({ ...codex(), content: '界'.repeat(349525) }).content.length).toBe(349525);
});
it('keeps observed configuration separate and cannot claim actual execution facts', () => {
  const value = codex();
  expect(assistantFinalDataSchema.safeParse({ ...value, settings: { ...value.settings, actualExecution: { ...value.settings.actualExecution, model: 'gpt-5.4' } } }).success).toBe(false);
  expect(assistantFinalDataSchema.safeParse({ ...value, settings: { ...value.settings, requested: { ...value.settings.requested, permissionMode: 'dontAsk' } } }).success).toBe(false);
});
