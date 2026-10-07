import { expect, it } from 'vitest';
import { OrdinaryTurnEvidence } from './evidence.js';

const delta = (text = 'small') => ({ method: 'item/agentMessage/delta', params: { threadId: 'thread', turnId: 'turn', itemId: 'final', delta: text } });
function boundEvidence() {
  const evidence = new OrdinaryTurnEvidence();
  evidence.bindThread('thread'); evidence.bindTurn({ id: 'turn', items: [] });
  return evidence;
}

it('bounds frames arriving before request identities are known without silently dropping them', () => {
  const evidence = new OrdinaryTurnEvidence();
  for (let index = 0; index < 64; index++) evidence.accept(delta());
  expect(() => evidence.accept(delta())).toThrow('Unbound native evidence limit exceeded.');
  const bytes = new OrdinaryTurnEvidence();
  expect(() => bytes.accept(delta('x'.repeat(2 * 1024 * 1024)))).toThrow('Unbound native evidence limit exceeded.');
});

it('bounds retained stream frames and total decoded bytes without a lifetime frame ceiling', () => {
  const frames = boundEvidence();
  for (let index = 0; index < 512; index++) { frames.accept(delta()); expect(frames.takeStreamDeltas()).toHaveLength(1); }
  for (let index = 0; index < 64; index++) frames.accept(delta());
  expect(() => frames.accept(delta())).toThrow('Native stream queue limit exceeded.');
  const bytes = boundEvidence();
  for (let index = 0; index < 4; index++) { bytes.accept(delta('x'.repeat(1024 * 1024 - 256))); bytes.takeStreamDeltas(); }
  expect(() => bytes.accept(delta('x'.repeat(1024)))).toThrow('Native observation limit exceeded.');
});

it('checks buffered identities when binding the response and rejects unsafe turn-start items', () => {
  const evidence = new OrdinaryTurnEvidence();
  evidence.accept({ method: 'item/completed', params: { threadId: 'foreign', turnId: 'turn', item: { type: 'agentMessage' } } });
  evidence.bindThread('thread');
  expect(() => evidence.bindTurn({ id: 'turn', items: [] })).toThrow('Native thread mismatch.');
  const tools = new OrdinaryTurnEvidence(); tools.bindThread('thread');
  expect(() => tools.bindTurn({ id: 'turn', items: [{ type: 'commandExecution' }] })).toThrow('Unsupported item');
});

it('fails closed for unknown notification methods and foreign-turn deltas', () => {
  const evidence = boundEvidence();
  expect(() => evidence.accept({ method: 'future/event', params: { threadId: 'thread', turnId: 'turn' } })).toThrow('Unsupported native notification.');
  expect(() => evidence.accept({ ...delta(), params: { ...delta().params, turnId: 'other' } })).toThrow('Unsupported native notification.');
});

it('strictly validates global status without exposing private identities or bypassing byte accounting', () => {
  const evidence = new OrdinaryTurnEvidence();
  const params = { status: 'disabled', serverName: 'private-name', installationId: 'private-installation', environmentId: null };
  evidence.accept({ method: 'remoteControl/status/changed', params });
  expect(evidence.takeStreamDeltas()).toEqual([]); expect(evidence.observation.state).toBe('pending');
  for (const bad of [{ ...params, status: 'future' }, { ...params, extra: true }, { ...params, environmentId: 1 }]) {
    expect(() => evidence.accept({ method: 'remoteControl/status/changed', params: bad })).toThrow();
  }
  expect(() => evidence.accept({ method: 'remoteControl/status/changed', params: { ...params, serverName: 'x'.repeat(4 * 1024 * 1024) } })).toThrow('Native observation limit');
});
it('validates thread status and token identity while keeping them out of final and stream', () => {
  const evidence = boundEvidence();
  evidence.accept({ method: 'thread/status/changed', params: { threadId: 'thread', status: { type: 'active', activeFlags: [] } } });
  expect(() => evidence.accept({ method: 'thread/status/changed', params: { threadId: 'foreign', status: { type: 'idle' } } })).toThrow();
  expect(() => evidence.accept({ method: 'thread/status/changed', params: { threadId: 'thread', status: { type: 'systemError' } } })).toThrow();
  const counts = { totalTokens: 1, inputTokens: 1, cachedInputTokens: 0, cacheWriteInputTokens: 0, outputTokens: 0, reasoningOutputTokens: 0 };
  const params = { threadId: 'thread', turnId: 'turn', tokenUsage: { total: counts, last: counts, modelContextWindow: null } };
  evidence.accept({ method: 'thread/tokenUsage/updated', params });
  expect(() => evidence.accept({ method: 'thread/tokenUsage/updated', params: { ...params, turnId: 'other' } })).toThrow();
  expect(evidence.takeStreamDeltas()).toEqual([]);
});
it('preserves only observed public text and reasoning deltas and rejects malformed or post-terminal streams', () => {
  const evidence = boundEvidence();
  evidence.accept(delta('中文🙂'));
  evidence.accept({ method: 'item/reasoning/summaryTextDelta', params: { threadId: 'thread', turnId: 'turn', itemId: 'reasoning', summaryIndex: 0, delta: '公开摘要' } });
  evidence.accept({ method: 'item/reasoning/textDelta', params: { threadId: 'thread', turnId: 'turn', itemId: 'reasoning', contentIndex: 1, delta: 'published reasoning' } });
  expect(evidence.takeStreamDeltas().map(item => [item.kind, item.delta])).toEqual([['text', '中文🙂'], ['reasoning-summary', '公开摘要'], ['reasoning-text', 'published reasoning']]);
  expect(() => evidence.accept({ ...delta(), params: { ...delta().params, tool: true } })).toThrow();
  evidence.observation = { state: 'failed', final: null };
  expect(() => evidence.accept(delta())).toThrow('after terminal');
});
