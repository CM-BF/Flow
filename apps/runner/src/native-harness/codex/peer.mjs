// Deterministic Node JSONL peer for Flow tests; never starts Codex or reads account/config files.
import { createInterface } from 'node:readline';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const mode = process.argv[2] ?? 'success';
const threadId = randomUUID(), turnId = randomUUID();
let initialized = false, requestedModel, requestedTier, pendingTurnRequest;
const final = { type: 'agentMessage', id: 'peer-final', text: 'Native peer result 中文🙂', phase: 'final_answer', memoryCitation: null, delivery: null, questions: null };
const send = value => process.stdout.write(`${JSON.stringify(value)}\n`);
const result = (id, value) => send({ id, result: value });
const notification = (method, params) => send({ method, params });
const item = value => notification('item/completed', { threadId, turnId, completedAtMs: Date.now(), item: value });
function turn(status = 'completed', items = [final]) {
  return { id: turnId, items, itemsView: 'full', status, error: status === 'failed' ? { message: 'Synthetic failure', codexErrorInfo: null, additionalDetails: null } : null,
    startedAt: 1, completedAt: status === 'inProgress' ? null : 2, durationMs: status === 'inProgress' ? null : 1000 };
}
async function finish() {
  if (mode.startsWith('stream:')) {
    const count = Number(mode.slice(7)); final.text = '中文🙂'.repeat(512);
    notification('thread/status/changed', { threadId, status: { type: 'active', activeFlags: [] } });
    notification('item/reasoning/summaryTextDelta', { threadId, turnId, itemId: 'reasoning', summaryIndex: 0, delta: '公开摘要🙂' });
    item({ type: 'reasoning', id: 'reasoning', summary: ['公开摘要🙂'], content: [] });
    const characters = Array.from(final.text), width = characters.length / count;
    for (let index = 0; index < count; index++) {
      notification('item/agentMessage/delta', { threadId, turnId, itemId: final.id, delta: characters.slice(index * width, (index + 1) * width).join('') });
      await new Promise(resolve => setTimeout(resolve, 1));
    }
  }
  if (mode === 'stream-burst') {
    const frames = Array.from({ length: 512 }, () => JSON.stringify({ method: 'item/agentMessage/delta', params: { threadId, turnId, itemId: final.id, delta: 'x' } }));
    process.stdout.write(frames.join('\n') + '\n');
  }
  if (mode === 'eof') { process.exit(0); return; }
  if (mode === 'hang' || mode === 'interrupt-ack-only') return;
  if (mode === 'failed' || mode === 'interrupted') { notification('turn/completed', { threadId, turn: turn(mode, []) }); return; }
  if (mode === 'wrong-thread') { notification('item/completed', { threadId: 'other', turnId, completedAtMs: 1, item: final }); return; }
  if (mode === 'wrong-turn') { notification('item/completed', { threadId, turnId: 'other', completedAtMs: 1, item: final }); return; }
  if (mode === 'unknown-phase') final.phase = null;
  if (mode === 'async') final.delivery = 'async';
  if (mode === 'oversize') final.text = 'x'.repeat(1048577);
  if (mode === 'wire-escape') final.text = '\n'.repeat(700000);
  if (mode.startsWith('tool:')) {
    notification('item/started', { threadId, turnId, startedAtMs: 1, item: { type: mode.slice(5), id: 'tool-item' } });
  }
  item(final);
  if (mode === 'duplicate') item(final);
  if (mode === 'changed-item') item({ ...final, text: 'Changed completed content' });
  const items = [final];
  if (mode === 'multiple-final') { const second = { ...final, id: 'peer-second' }; item(second); items.push(second); }
  if (mode.startsWith('terminal-tool:')) items.push({ type: mode.slice(14), id: 'terminal-tool' });
  notification('turn/completed', { threadId, turn: turn('completed', items) });
  if (mode === 'post-terminal') item({ ...final, id: 'late' });
}

for await (const line of createInterface({ input: process.stdin, crlfDelay: Infinity })) {
  try {
    const message = JSON.parse(line);
    if (message.method === 'initialize') {
      assert.equal(initialized, false);
      result(message.id, { userAgent: 'synthetic-r05c/1', platformFamily: 'unix', platformOs: 'test', codexHome: '/synthetic-private' });
    } else if (message.method === 'initialized') {
      assert.equal(initialized, false); initialized = true;
    } else if (message.method === 'thread/start') {
      assert.equal(initialized, true);
      if (mode.startsWith('stream')) notification('remoteControl/status/changed', { status: 'disabled', serverName: 'private-server', installationId: 'private-install', environmentId: null });
      assert.equal(message.params.approvalPolicy, 'never');
      assert.equal(message.params.sandbox, 'read-only');
      requestedModel = message.params.model; requestedTier = message.params.serviceTier;
      const thread = { id: threadId, sessionId: threadId, forkedFromId: null, parentThreadId: null, preview: '', ephemeral: true,
        section: null, sectionEnteredAt: null, projectId: null, historyMode: 'legacy', modelProvider: 'synthetic', model: requestedModel,
        reasoningEffort: null, createdAt: 1, updatedAt: 1, recencyAt: null, status: { type: 'idle' }, path: null, cwd: process.cwd(),
        cliVersion: '0.154.0', originator: null, source: 'appServer', threadSource: null, agentNickname: null, agentRole: null, gitInfo: null, name: null, turns: [] };
      const reply = { thread, model: requestedModel, modelProvider: 'synthetic', serviceTier: requestedTier, cwd: process.cwd(),
        instructionSources: [], approvalPolicy: 'never', approvalsReviewer: 'user', sandbox: { type: 'readOnly', networkAccess: false }, reasoningEffort: null };
      if (mode === 'wrong-sandbox') reply.sandbox.networkAccess = true;
      notification('thread/started', { thread }); // Exercise a notification before the request response.
      result(message.id, reply);
    } else if (message.method === 'turn/start') {
      assert.equal(message.params.threadId, threadId);
      assert.equal(message.params.model, requestedModel);
      assert.equal(message.params.approvalPolicy, 'never');
      assert.deepEqual(message.params.sandboxPolicy, { type: 'readOnly', networkAccess: false });
      assert.equal(message.params.input[0].type, 'text');
      assert.deepEqual(message.params.input[0].text_elements, []);
      notification('turn/started', { threadId, turn: turn('inProgress', []) });
      if (mode === 'lost-start-response') { item(final); process.exit(0); }
      if (mode === 'deny-before-start-response') {
        pendingTurnRequest = message.id;
        send({ id: 'server-request', method: 'item/commandExecution/requestApproval', params: { threadId, turnId } });
        continue;
      }
      result(message.id, { turn: turn('inProgress', []) });
      if (mode.startsWith('deny:')) {
        send({ id: 'server-request', method: mode.slice(5), params: { threadId, turnId } });
      } else await finish();
    } else if (message.id === 'server-request') {
      // Even a malicious peer that emits a final after denial must never cause Flow success.
      assert.ok(message.error || message.result?.decision === 'decline' || message.result?.decision === 'abort'
        || message.result?.success === false || message.result?.action === 'decline' || JSON.stringify(message.result?.permissions) === '{}');
      if (pendingTurnRequest !== undefined) result(pendingTurnRequest, { turn: turn('inProgress', []) });
      await finish();
    } else if (message.method === 'turn/interrupt') {
      assert.equal(message.params.threadId, threadId); assert.equal(message.params.turnId, turnId);
      result(message.id, {});
      if (mode !== 'interrupt-ack-only') notification('turn/completed', { threadId, turn: turn('interrupted', []) });
    } else {
      send({ id: message.id, error: { code: -32601, message: 'Unexpected synthetic request' } });
    }
  } catch {
    // Fixed diagnostic only, never echo a frame or request body.
    process.stderr.write('Synthetic peer assertion failed.\n'); process.exit(3);
  }
}
