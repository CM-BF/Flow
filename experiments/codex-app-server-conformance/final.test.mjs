import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createOrdinaryFinalProjection } from './final.mjs';

const identity = { threadId: 'fixture-thread', turnId: 'fixture-turn' };
const message = (extra = {}) => ({ type: 'agentMessage', id: 'fixture-item', text: '确定性 final\n正文', phase: 'final_answer', memoryCitation: null, delivery: null, questions: null, ...extra });
const itemEvent = (item = message()) => ({ method: 'item/completed', params: { ...identity, item, completedAtMs: 1000 } });
const terminal = (extra = {}) => ({ method: 'turn/completed', params: { threadId: identity.threadId,
  turn: { id: identity.turnId, items: [], itemsView: 'notLoaded', status: 'completed', error: null,
    startedAt: null, completedAt: null, durationMs: null, ...extra } } });
function project(items, completion = terminal()) {
  const projection = createOrdinaryFinalProjection(identity);
  for (const item of items) assert.equal(projection.accept(itemEvent(item)).state, 'pending');
  return projection.accept(completion);
}

test('ordinary final requires completed item plus matching successful terminal; hashes retain all native identities', () => {
  const expected = { ...identity };
  const projection = createOrdinaryFinalProjection(expected);
  expected.threadId = 'mutated-input';
  assert.deepEqual(projection.accept(itemEvent()), { state: 'pending', final: null });
  const result = projection.accept(terminal());
  assert.equal(result.state, 'completed');
  assert.equal(result.final.text, message().text);
  const hash = x => createHash('sha256').update(JSON.stringify(x)).digest('hex');
  assert.equal(result.final.sourceMessageId, hash([identity.turnId, message().id]));
  assert.equal(result.final.messageId, hash(['codex.app-server.agent-message', identity.threadId, result.final.sourceMessageId]));
  assert.equal(result.actualExecution, 'unknown');
  assert.deepEqual(projection.accept(terminal()), result);
});

test('full terminal item is cross-checked; last commentary never replaces explicit final', () => {
  const commentary = message({ id: 'commentary', text: 'Still commentary', phase: 'commentary' });
  const result = project([message(), commentary], terminal({ itemsView: 'full', items: [message(), commentary] }));
  assert.equal(result.final.nativeItemId, message().id);
  assert.throws(() => project([message()], terminal({ itemsView: 'full', items: [message({ text: 'altered' })] })), /differs/);
});

for (const [name, items, expected] of [
  ['unknown phase', [message({ phase: null })], 'phase-unknown'],
  ['ambiguous finals', [message(), message({ id: 'second-final' })], 'ambiguous-finals'],
  ['only commentary', [message({ phase: 'commentary' })], 'missing-completed-final-item'],
  ['no completed item', [], 'missing-completed-final-item'],
  ['async delivery', [message({ delivery: 'async' })], 'nonordinary-message'],
  ['interactive question', [message({ questions: [{ title: 'Synthetic question', options: ['One', 'Two'] }] })], 'nonordinary-message'],
]) {
  test(`${name} cannot yield ordinary final`, () => {
    const result = project(items);
    assert.equal(result.final, null);
    assert.equal(result.reason, expected);
  });
}

test('full item view cannot hide unknown phase, async or an additional final absent from live items', () => {
  for (const item of [message({ id: 'other', phase: null }), message({ id: 'other', delivery: 'async' }), message({ id: 'other' })]) {
    const result = project([message()], terminal({ itemsView: 'full', items: [message(), item] }));
    assert.equal(result.final, null);
  }
});

test('failed and interrupted turn remain distinct even with a completed final item', () => {
  for (const status of ['failed', 'interrupted']) {
    const result = project([message()], terminal({ status, error: status === 'failed' ? { message: 'synthetic failure' } : null }));
    assert.deepEqual(result, { state: status, final: null });
  }
});

test('foreign identity or non-success evidence permanently invalidates this projection', () => {
  for (const event of [
    { ...itemEvent(), params: { ...itemEvent().params, threadId: 'foreign' } },
    { ...itemEvent(), params: { ...itemEvent().params, turnId: 'foreign' } },
    terminal({ id: 'foreign' }), terminal({ status: 'inProgress' }), terminal({ error: { message: 'failure' } }),
    { method: 'item/agentMessage/delta', params: identity },
    { method: 'turn/interrupt', params: {} }, { method: 'error', params: { ...identity, willRetry: true } },
  ]) {
    const projection = createOrdinaryFinalProjection(identity);
    assert.throws(() => projection.accept(event));
    assert.throws(() => projection.accept(itemEvent()), /invalidated/);
  }
});

test('duplicate item must be identical, terminal must not change, late items fail closed', () => {
  const projection = createOrdinaryFinalProjection(identity);
  projection.accept(itemEvent());
  projection.accept(itemEvent());
  assert.throws(() => projection.accept(itemEvent(message({ text: 'changed' }))), /changed/);
  const late = createOrdinaryFinalProjection(identity);
  late.accept(terminal());
  assert.throws(() => late.accept(itemEvent()), /after terminal/);
  const altered = createOrdinaryFinalProjection(identity);
  altered.accept(terminal());
  assert.throws(() => altered.accept(terminal({ status: 'interrupted' })), /Terminal changed/);
});

test('native IDs and final UTF8 content have independent Flow bounds', () => {
  assert.throws(() => createOrdinaryFinalProjection({ ...identity, threadId: '汉'.repeat(50) }), /boundary/);
  assert.throws(() => project([message({ text: '汉'.repeat(350000) })]), /content exceeds/);
  assert.throws(() => project([message({ phase: 'future-phase' })]), /Unknown message phase/);
});

test('decoded evidence storage is bounded by item count and accumulated bytes', () => {
  const byCount = createOrdinaryFinalProjection(identity);
  for (let index = 0; index < 64; index++) byCount.accept(itemEvent({ type: 'reasoning', id: `item-${index}`, summary: [], content: [] }));
  assert.throws(() => byCount.accept(itemEvent({ type: 'reasoning', id: 'item-65', summary: [], content: [] })), /item limit/);
  const byBytes = createOrdinaryFinalProjection(identity);
  for (let index = 0; index < 2; index++) byBytes.accept(itemEvent(message({ id: `big-${index}`, text: 'x'.repeat(800000) })));
  assert.throws(() => byBytes.accept(itemEvent(message({ id: 'big-3', text: 'x'.repeat(800000) }))), /byte limit/);
});

test('content bytes are not wire bytes; escaping may exceed R06 frame before Flow content limit', () => {
  const text = '\n'.repeat(600000);
  assert.ok(Buffer.byteLength(text) < 1048576);
  assert.ok(Buffer.byteLength(JSON.stringify(itemEvent(message({ text })))) > 1048576);
});
