import { test } from 'node:test';
import assert from 'node:assert/strict';
import { settleDecision } from './resources.mjs';
test('the actual acceptance and current/history become durable before irreversible cleanup', async () => {
  const report = { outcome: 'independently-accepted', current: { accepted: 'artifact-digest' }, history: ['accept-delivery'] };
  const saved = [], order = [];
  const persist = async value => { saved.push(structuredClone(value)); order.push('durable'); };
  const center = { async finish(options) {
    order.push('cleanup'); assert.deepEqual(saved[0], report); assert.equal(options.destroy, true); return { databaseDropped: true };
  } };
  await settleDecision(center, report, persist, true);
  assert.deepEqual(order, ['durable', 'cleanup', 'durable']); assert.equal(saved[1].resources.databaseDropped, true);
});
test('a failed decision checkpoint still closes the center while preserving its database and directory', async () => {
  const report = { outcome: 'independently-accepted', current: { accepted: 'artifact-digest' }, history: ['accept-delivery'] };
  let calls = 0, closed = false;
  const center = { async finish(options) { closed = true; assert.equal(options.destroy, false); assert.equal(options.workersStopped, true); return { retained: true }; } };
  await assert.rejects(settleDecision(center, report, async () => { if (++calls === 1) throw new Error('Injected durable write failure.'); }, true), /Injected durable/);
  assert(closed); assert.equal(report.resources.retained, true); assert.equal(calls, 2);
});
