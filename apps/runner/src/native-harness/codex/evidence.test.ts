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

it('bounds total notifications and decoded bytes even when deltas are discarded', () => {
  const frames = boundEvidence();
  for (let index = 0; index < 256; index++) frames.accept(delta());
  expect(() => frames.accept(delta())).toThrow('Native observation limit exceeded.');
  const bytes = boundEvidence();
  for (let index = 0; index < 4; index++) bytes.accept(delta('x'.repeat(1024 * 1024 - 256)));
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
