import { randomUUID } from 'node:crypto';
import type { SDKMessage, SDKResultMessage } from '@anthropic-ai/claude-agent-sdk';
import { expect, it } from 'vitest';
import { NativeResults, consumedUuids } from './state.js';
import { SteeringInput } from './input.js';
const result = (uuid: string, values: string[], extra = {}) => ({ type: 'result', subtype: 'success', is_error: false, uuid, session_id: 'native', result: uuid, user_message_uuids: values, queued_turn_count: 0, modelUsage: {}, ...extra } as unknown as SDKResultMessage);
it('keeps result coverage distinct from consumption and deduplicates without rewinding the result frontier', () => {
  const first = randomUUID(), second = randomUUID(), results = new NativeResults();
  results.observe(result('one', [first])); results.observe(result('two', [second]));
  expect(results.observe(result('one', [first]))).toBeNull(); expect(results.latest?.sourceMessageId).toBe('two');
  expect([...results.covered]).toEqual([first, second]);
  expect(() => results.observe(result('two', [], { result: 'changed' }))).toThrow('changed content');
});
it('does not invent pending=0, ignores child/tool UUID echoes and accepts the root singleton fallback', () => {
  const uuid = randomUUID(), results = new NativeResults(); results.observe(result('missing', [], { queued_turn_count: undefined }));
  expect(results.latest?.queuedTurnCount).toBeNull();
  expect(results.observe(result('child', [uuid], { parent_tool_use_id: 'child-tool' }))).toBeNull();
  expect(results.latest?.sourceMessageId).toBe('missing');
  for (const frame of [{ type: 'assistant', parent_tool_use_id: 'child' }, { type: 'user', parent_tool_use_id: null }]) expect(consumedUuids({ ...frame, user_message_uuid: uuid } as SDKMessage)).toEqual([]);
  expect(consumedUuids({ type: 'assistant', parent_tool_use_id: null, user_message_uuid: uuid } as unknown as SDKMessage)).toEqual([uuid]);
});
it('keeps one input source open between turns, closes explicitly, and never inserts the same UUID twice', async () => {
  const controller = new AbortController(), uuid = randomUUID();
  const first = { type: 'user' as const, uuid, parent_tool_use_id: null, session_id: '', message: { role: 'user' as const, content: 'initial' } };
  const input = new SteeringInput(controller.signal, first), iterator = input[Symbol.asyncIterator]();
  expect((await iterator.next()).value?.uuid).toBe(uuid); expect(input.pending).toBe(0);
  expect(() => input.push(first)).toThrow('already delivered');
  const pending = iterator.next(); input.push({ ...first, uuid: randomUUID(), message: { role: 'user', content: 'steer' } });
  expect((await pending).value?.message.content).toBe('steer'); input.close(); expect((await iterator.next()).done).toBe(true);
});
it('abort wakes a blocked input reader without yielding pending content', async () => {
  const controller = new AbortController(); const input = new SteeringInput(controller.signal, { type: 'user', uuid: randomUUID(), parent_tool_use_id: null, session_id: '', message: { role: 'user', content: 'initial' } });
  const iterator = input[Symbol.asyncIterator](); await iterator.next(); const waiting = iterator.next(); controller.abort(new Error('cancel'));
  await expect(waiting).rejects.toThrow('cancel');
});
