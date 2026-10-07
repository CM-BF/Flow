import { expect, test } from 'vitest';
import { createHash } from 'node:crypto';
import type { Json } from '../codex/types.js';
import { OrdinaryTurnEvidence } from '../native-harness/codex/evidence.js';
import { createNativeFileRecipe } from './native-policy.js';
import { createNativeToolRecipe } from './native-tool-policy.js';
import { createTrustedToolWriter, type CalculatorToolFile } from './native-tool-writer.js';

const toolArgs = { expectedSha256: createHash('sha256').update('old').digest('hex'), contentsBase64: 'bmV3' };
const signal = () => new AbortController().signal;
function setup(owner: () => Promise<void> = async () => {}) {
  let text = 'old', writes = 0, closes = 0;
  const target: CalculatorToolFile = { identity: { path: '/fixture/calculator.mjs', device: '1', inode: '2' },
    async read() { return Buffer.from(text); }, async replace(value) { writes++; text = Buffer.from(value).toString(); }, async close() { closes++; } };
  const writer = createTrustedToolWriter({ target, assertOwnership: owner, signal: signal(), binding: {
    identity: { taskId: 'task', attemptId: 'attempt', runnerId: 'runner', ownerVersion: 1 },
    leaseId: '5b647dc2-9b9d-4c5c-9fd3-79a6d1b0a0f8', baseCommit: 'a'.repeat(40), generation: 1 } });
  const recipe = createNativeToolRecipe({ model: 'gpt-6-astra', cwd: '/fixture', prompt: 'Use the bounded host tool.', writer });
  recipe.evidence.bindThread('thread'); recipe.evidence.bindTurn({ id: 'turn', items: [] });
  return { recipe, writer, get writes() { return writes; }, get closes() { return closes; } };
}
const started = { type: 'dynamicToolCall', id: 'call', tool: 'flow_calculator_update', arguments: toolArgs, status: 'inProgress' };
const params = { threadId: 'thread', turnId: 'turn', callId: 'call', tool: 'flow_calculator_update', arguments: toolArgs };
function notify(s: ReturnType<typeof setup>, item: Json, completed = false) {
  s.recipe.evidence.accept({ method: completed ? 'item/completed' : 'item/started', params: { threadId: 'thread', turnId: 'turn', item, ...(completed ? { completedAtMs: 1 } : {}) } });
}

test('readonly dynamic recipe accepts only its own successful host receipt and matching terminal item', async () => {
  const s = setup();
  expect(s.recipe.startThread).toMatchObject({ sandbox: 'read-only', approvalPolicy: 'never', dynamicTools: [{ type: 'function', name: 'flow_calculator_update' }] });
  expect(s.recipe.startTurn('thread')).toMatchObject({ sandboxPolicy: { type: 'readOnly', networkAccess: false } });
  expect(s.recipe.readThread({ thread: { id: 'thread' }, model: 'gpt-6-astra', approvalPolicy: 'never', sandbox: { type: 'readOnly', networkAccess: false } })).toEqual({ threadId: 'thread' });
  notify(s, started);
  const answer = await s.recipe.respond('item/tool/call', params, signal()); expect(answer.allowed).toBe(true);
  if (!('result' in answer.reply) || typeof answer.reply.result !== 'object' || !answer.reply.result || Array.isArray(answer.reply.result)) throw Error('Missing tool response.');
  const terminal = { ...started, status: 'completed', success: true, contentItems: answer.reply.result.contentItems! };
  notify(s, terminal, true);
  const final = { type: 'agentMessage', id: 'final', phase: 'final_answer', delivery: null, questions: null, text: 'Updated the calculator.' };
  notify(s, final, true);
  s.recipe.evidence.accept({ method: 'turn/completed', params: { threadId: 'thread', turn: { id: 'turn', status: 'completed', error: null, itemsView: 'full', items: [terminal, final] } } });
  expect(s.recipe.evidence.observation.state).toBe('completed');
  s.recipe.checkCompletion(); expect(s.writes).toBe(1);
  expect(await s.writer.close(signal())).toEqual({ hostWrite: 'settled', nativeWriteAccess: 'unknown' });
});

test('same native call recovers a lost ACK without a second write', async () => {
  const s = setup(); notify(s, started);
  const first = await s.recipe.respond('item/tool/call', params, signal());
  expect(await s.recipe.respond('item/tool/call', params, signal())).toEqual(first); expect(s.writes).toBe(1); await s.writer.close(signal());
});

test('wrong thread, turn, tool or body is denied without using the write port', async () => {
  for (const delta of [{ threadId: 'other' }, { turnId: 'other' }, { tool: 'exec' }, { arguments: { ...toolArgs, path: '../escape' } }]) {
    const s = setup(); notify(s, started);
    expect((await s.recipe.respond('item/tool/call', { ...params, ...delta }, signal())).allowed).toBe(false);
    expect(s.writes).toBe(0); expect(() => s.recipe.checkCompletion()).toThrow(); await s.writer.close(signal());
  }
});

test('unstarted tool calls and native file/exec approvals cannot acquire host permission', async () => {
  for (const method of ['item/tool/call', 'item/fileChange/requestApproval', 'item/commandExecution/requestApproval', 'other']) {
    const s = setup(); expect((await s.recipe.respond(method, params, signal())).allowed).toBe(false); expect(s.writes).toBe(0); await s.writer.close(signal());
  }
});

test('claimed completion with different content or a second tool item is rejected', async () => {
  const s = setup(); notify(s, started); await s.recipe.respond('item/tool/call', params, signal());
  expect(() => notify(s, { ...started, status: 'completed', success: true, contentItems: [] }, true)).toThrow();
  expect(() => notify(s, { ...started, id: 'second' })).toThrow(); await s.writer.close(signal());
});

test('async response cancellation seals admission while ownership is still pending', async () => {
  let resolve!: () => void; const wait = new Promise<void>(done => { resolve = done; });
  const s = setup(() => wait); notify(s, started); const abort = new AbortController();
  const response = s.recipe.respond('item/tool/call', params, abort.signal); abort.abort(); resolve();
  expect((await response).allowed).toBe(false); expect(s.writes).toBe(0); await s.writer.close(signal());
});

test('old ordinary and file-change recipes remain incapable of accepting dynamic tool writes', () => {
  const ordinary = new OrdinaryTurnEvidence(); ordinary.bindThread('thread'); ordinary.bindTurn({ id: 'turn', items: [] });
  expect(() => ordinary.accept({ method: 'item/started', params: { threadId: 'thread', turnId: 'turn', item: started } })).toThrow();
  const file = createNativeFileRecipe('gpt-6-astra', '/fixture', 'original');
  expect(file.respond('item/tool/call', params).allowed).toBe(false);
});
