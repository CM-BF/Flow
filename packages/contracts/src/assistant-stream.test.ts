import { expect, it } from 'vitest';
import { assistantStreamDataSchema, assistantStreamIdentity, assistantStreamProtocol } from './assistant-stream.js';
const old = { type: 'assistant-stream', source: 'claude.sdk.stream', nativeSessionId: 'session', nativeMessageId: 'message', streamId: 'a'.repeat(64),
  sourceMessageId: 'frame', parentToolUseId: null, blockIndex: 0, revision: 1, fromBytes: 0, text: '中文🙂', prefixDigest: 'b'.repeat(64), phase: 'streaming', reason: null, truncated: false };
it('keeps legacy bytes/identity and requires exact Codex provenance', () => {
  expect(assistantStreamDataSchema.parse(old)).toEqual(old);
  expect(assistantStreamIdentity(assistantStreamDataSchema.parse(old))).toBe(JSON.stringify(['session', 'message', 0]));
  const codex = { ...old, source: 'codex.app-server.stream', nativeTurnId: 'turn', channel: 'text' };
  expect(assistantStreamDataSchema.parse(codex)).toEqual(codex);
  for (const value of [{ ...old, nativeTurnId: 'turn' }, { ...codex, nativeTurnId: undefined }, { ...codex, channel: undefined },
    { ...codex, blockIndex: 1 }, { ...codex, source: 'unknown' }, { ...codex, text: '\ud800' }]) expect(assistantStreamDataSchema.safeParse(value).success).toBe(false);
});
it('negotiates only one exact known version', () => {
  for (const version of ['patch-v1','patch-v2']) expect(assistantStreamProtocol(['X-Flow-Assistant-Stream',version])).toBe(version);
  for (const values of [[], ['x-flow-assistant-stream','patch-v3'], ['x-flow-assistant-stream','patch-v2, patch-v2'], ['x-flow-assistant-stream','patch-v2','X-Flow-Assistant-Stream','patch-v2']]) expect(assistantStreamProtocol(values)).toBeNull();
});
