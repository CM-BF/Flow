import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createCheckpoint, mutationGuard, recordGrowth, reserveWindow, redactText } from './evidence.mjs';

const creation = { harness: 'claude', requested: { model: 'fixed', thinking: 'disabled', tools: 'none' }, executionProfile: { id: 'fixed', runnerId: 'runner', configDigest: 'digest' } };

test('same visible draft needs three strictly growing nonempty samples before final', () => {
  const samples = new Map(), context = { finalObserved: false, taskStatus: 'running', paneId: 'visible' };
  for (const text of ['甲', '甲乙', '甲乙丙']) recordGrowth(samples, { id: 'same-attempt-block', text }, context);
  assert.equal(samples.get('same-attempt-block').length, 3);
  assert.equal(recordGrowth(samples, { id: 'same-attempt-block', text: '甲乙丙' }, context), null);
  assert.throws(() => recordGrowth(samples, { id: 'same-attempt-block', text: 'changed' }, context));
  assert.throws(() => recordGrowth(samples, { id: 'same-attempt-block', text: 'final' }, { ...context, finalObserved: true }));
});
test('wx reservation refuses a second window and refuses real mode', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'chatui-reserve-'));
  try {
    await reserveWindow(join(dir, 'window.json'), { mode: 'synthetic' });
    await assert.rejects(reserveWindow(join(dir, 'window.json'), { mode: 'synthetic' }), { code: 'EEXIST' });
    await assert.rejects(reserveWindow(join(dir, 'real.json'), { mode: 'live' }));
  } finally { await rm(dir, { recursive: true }); }
});
test('guard consumes before forward and never forwards second create or turn', async () => {
  const evidence = { mutations: [] }, calls = []; let routeHandler;
  await mutationGuard({ origin: 'http://127.0.0.1:1', evidence, checkpoint: async () => { calls.push('durable'); }, expectedPrompt: 'only prompt', expectedCreation: creation })({ route: async (_, handler) => { routeHandler = handler; } });
  const invoke = async (path, text = 'only prompt') => routeHandler({ request: () => ({ url: () => `http://127.0.0.1:1${path}`, method: () => 'POST', postData: () => JSON.stringify(path === '/api/conversations' ? creation : { text }), headers: () => ({ 'idempotency-key': 'one' }) }), continue: async () => { calls.push('forward'); }, abort: async () => { calls.push('abort'); } });
  await invoke('/api/conversations/chat/turns');
  await invoke('/api/conversations'); await invoke('/api/conversations');
  await invoke('/api/conversations/chat/turns'); await invoke('/api/conversations/chat/turns');
  await invoke('/api/conversations/chat/queue');
  assert.deepEqual(calls, ['durable','abort','durable','forward','durable','abort','durable','forward','durable','abort','durable','abort']);
});
test('unknown forwarding failure never restores consumed turn budget', async () => {
  const evidence = { mutations: [] }; let handler, forwarded = 0;
  await mutationGuard({ origin: 'http://127.0.0.1:1', evidence, checkpoint: async () => {}, expectedPrompt: 'prompt', expectedCreation: creation })({ route: async (_, fn) => { handler = fn; } });
  const route = path => ({ request: () => ({ url: () => `http://127.0.0.1:1${path}`, method: () => 'POST', postData: () => JSON.stringify(path === '/api/conversations' ? creation : { text: 'prompt' }), headers: () => ({ 'idempotency-key': 'one' }) }), continue: async () => { forwarded++; throw Error('response unknown'); }, abort: async () => {} });
  await assert.rejects(handler(route('/api/conversations')));
  await handler(route('/api/conversations')); assert.equal(forwarded, 1);
});
test('serialized checkpoints persist redacted snapshots in call order', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'chatui-checkpoint-')), evidence = { value: 'secret\n"token' };
  try {
    const checkpoint = createCheckpoint(join(dir, 'evidence.json'), evidence, ['secret\n"token']);
    const first = checkpoint(); evidence.order = 2; await checkpoint(); await first;
    assert.deepEqual(JSON.parse(await readFile(join(dir, 'evidence.json'), 'utf8')), { value: '[REDACTED]', order: 2 });
    assert.equal(redactText('secret secret-long', ['secret', 'secret-long']), '[REDACTED] [REDACTED]');
  } finally { await rm(dir, { recursive: true }); }
});

test('different requested profile or tool access is rejected before forwarding', async () => {
  const evidence = { mutations: [] }; let handler, forwarded = false;
  await mutationGuard({ origin: 'http://127.0.0.1:1', evidence, checkpoint: async () => {}, expectedPrompt: 'prompt', expectedCreation: creation })({ route: async (_, fn) => { handler = fn; } });
  await handler({ request: () => ({ url: () => 'http://127.0.0.1:1/api/conversations', method: () => 'POST', postData: () => JSON.stringify({ ...creation, requested: { ...creation.requested, tools: 'configured-readonly' } }), headers: () => ({ 'idempotency-key': 'one' }) }), continue: async () => { forwarded = true; }, abort: async () => {} });
  assert.equal(forwarded, false); assert.equal(evidence.mutations[0].blocked, true);
});
