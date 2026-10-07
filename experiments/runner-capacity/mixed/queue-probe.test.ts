import { createHash } from 'node:crypto';
import type { ConversationAssistantReply } from '../../../packages/contracts/src/conversations.js';
import { expect, test } from 'vitest';
import { ComparisonBudget } from './ab-budget.js';
import { QUEUE_PROBE, queueContract } from './queue-probe.js';
import { selectRunIdentity } from './run-identity.js';
import { chatReadPath, validateChatRead, type ChatProbe } from './queue-chat.js';
import { resolvedQueueJournal } from './queue-journal.js';

test('queue policy pins one production baseline and charges 129 per side without changing old A/B', () => {
  const a = selectRunIdentity('queue-probe-O1-v1'), b = selectRunIdentity('queue-probe-O2-v1');
  expect(a.base).toBe(b.base); expect(a.contract.tasks).toBe(129); expect(b.contract.cancelCount).toBe(4);
  expect(queueContract('A').caseMs).toBe(6000); expect(queueContract('A').queueProbe?.emitTailMs).toBeLessThan(queueContract('A').queueProbe!.activityTailMs);
  expect(selectRunIdentity('event-state-A-v1').contract.tasks).toBe(128);
  const budget = new ComparisonBudget(0, () => 1, QUEUE_PROBE); budget.begin('A');
  for (let n = 0; n < 129; n++) budget.submit();
  expect(() => budget.submit()).toThrow('comparison_tasks_exhausted');
  budget.finish({ success: true, resourcesClosed: true, tasksSentOrUnknown: 129, finalElapsedMs: 0, finalMeasuredBytes: 0 });
  budget.begin('B', { success: true, resourcesClosed: true, tasksSentOrUnknown: 129, finalElapsedMs: 0, finalMeasuredBytes: 0 });
  for (let n = 0; n < 129; n++) budget.submit(); expect(budget.tasks).toBe(258);
  expect(() => budget.submit()).toThrow();
});

function completedChatReply() {
  const content = 'c'.repeat(1024), version = createHash('sha256').update(content).digest('hex');
  const chat: ChatProbe = { conversationId: 'chat', turnId: 'turn', taskId: 'task', attemptId: 'attempt', runnerId: 'runner', ownerVersion: 1, content, version, sessionId: 'session', detailId: 'detail' };
  // Full DTO returned by fixed 4fdd conversations/replies.ts legacyReply, including reference identity.
  const assistant = { state: 'available', role: 'assistant', messageId: 'artifact:detail', text: content, truncated: false,
    contentRef: { kind: 'artifact', id: 'detail', title: 'Synthetic chat reply', taskId: 'task', attemptId: 'attempt' },
    source: { kind: 'adapter-final-artifact', adapterVersion: 'claude-sdk-0.3.290-v1', taskId: 'task', attemptId: 'attempt', artifactId: 'result', artifactVersion: version, detailId: 'detail' },
  } satisfies ConversationAssistantReply;
  return { chat, turn: { id: 'turn', conversationId: 'chat', task: { id: 'task' }, assistant } };
}

test('real conversation lightweight shapes must contain the completed same-task assistant body', () => {
  const { chat, turn } = completedChatReply(), conversation = { id: chat.conversationId };
  expect(chatReadPath(chat, 0)).toBe('/api/conversations/chat');
  expect(chatReadPath(chat, 1)).toBe('/api/conversations/chat/turns?after=0&limit=20');
  expect(validateChatRead(chat, { conversation, lastTurn: turn }, false)).toBe(chat.detailId);
  expect(validateChatRead({ ...chat, detailId: undefined }, { conversation, turns: [turn] }, true)).toBe(chat.detailId);
  expect(() => validateChatRead(chat, { conversation, turns: [{ ...turn, assistant: { ...turn.assistant, text: 'telemetry' } }] }, true)).toThrow();
  expect(() => validateChatRead({ ...chat, version: 'invalid' }, { conversation, turns: [turn] }, true)).toThrow('queue_chat_read_digest');
  expect(() => validateChatRead(chat, { conversation, turns: [turn, turn] }, true)).toThrow();
});

test('legacy chat source rejects wrong discriminant adapter task attempt artifact version and detail', () => {
  const { chat, turn } = completedChatReply();
  for (const change of [{ kind: 'assistant-final' }, { adapterVersion: 'other' }, { taskId: 'other' }, { attemptId: 'other' },
    { artifactId: 'other' }, { artifactVersion: 'other' }, { detailId: 'other' }]) {
    const source = { ...turn.assistant.source, ...change };
    expect(() => validateChatRead(chat, { conversation: { id: chat.conversationId }, turns: [{ ...turn, assistant: { ...turn.assistant, source } }] }, true)).toThrow();
  }
  const source = { taskId: 'task', attemptId: 'attempt', artifactVersion: chat.version };
  expect(() => validateChatRead(chat, { conversation: { id: chat.conversationId }, lastTurn: { ...turn, assistant: { ...turn.assistant, source } } }, false)).toThrow();
});

test('legacy chat source binds detail reference message and conversation on every read', () => {
  const { chat, turn } = completedChatReply();
  const check = (assistant: unknown) => validateChatRead(chat, { conversation: { id: chat.conversationId }, lastTurn: { ...turn, assistant } }, false);
  for (const change of [{ kind: 'detail' }, { id: 'other' }, { taskId: 'other' }, { attemptId: 'other' }, { title: 'other' }]) {
    expect(() => check({ ...turn.assistant, contentRef: { ...turn.assistant.contentRef, ...change } })).toThrow();
  }
  expect(() => check({ ...turn.assistant, messageId: 'artifact:other' })).toThrow();
  expect(() => validateChatRead(chat, { conversation: { id: 'other' }, lastTurn: turn }, false)).toThrow();
  expect(() => validateChatRead(chat, { conversation: { id: chat.conversationId }, turns: [{ ...turn, conversationId: 'other' }] }, true)).toThrow();
});

test('clean bound v2 opportunity is distinguishable from legacy unknown, foreign and retained assignment', () => {
  const ids = new Set(['runner']); const value = { version: 2, runnerId: 'runner', opportunityId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', assignments: [] };
  expect(resolvedQueueJournal(value, ids)).toBe(true);
  for (const bad of [{ ...value, runnerId: 'other' }, { ...value, assignments: [{}] }, { ...value, inFlight: null }, { version: 1, inFlight: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', assignments: [] }]) expect(resolvedQueueJournal(bad, ids)).toBe(false);
});

test('cancellation proof keeps driver and runner clocks separate and rejects post-signal effects', async () => {
  const { validateQueueCancellation } = await import('./queue-proof.js');
  const ids = ['a', 'b', 'c', 'd'];
  const result = { id: 'case', taskIds: ids, cancelled: ids, gate: [], windowComplete: true, settledByDeadline: true };
  const rows: import('./process.js').Observation[] = [];
  const row = (kind: string, values: Record<string, unknown>) => ({ kind, pid: 1, receivedMs: 1, caseId: 'case', ...values });
  rows.push(row('window-start', { beganMs: 100, epoch: 'epoch', boundary: { inFlight: 2 } }), row('window-end', { boundary: { inFlight: 1 } }));
  for (const taskId of ids) {
    const identity = { taskId, attemptId: taskId + '-attempt', runnerId: 'r', ownerVersion: 1 };
    rows.push(row('claim', identity), row('cancel-send', { ...identity, receivedMs: 50000 }), row('cancel-accepted', { ...identity, receivedMs: 50010 }),
      row('heartbeat', { ...identity, action: 'cancel', childMs: 6200 }), row('control-abort', { ...identity, childMs: 6201, observedChildMs: 6201 }),
      row('adapter-end', { ...identity, childMs: 6204, interrupted: true }), row('emit-start', { ...identity, startedChildMs: 6199 }));
  }
  rows.push(row('final-state-observed', { receivedMs: 50100, rows: ids.map(id => ({ id, status: 'cancelled', attempt_id: id + '-attempt', owner_version: 1 })) }));
  const proof = validateQueueCancellation(result, rows);
  expect(proof.rows[0]).toMatchObject({ driverSendToAckMs: 10, runnerSignalToAdapterEndMs: 3, driverSendToFinalObservationMs: 100, ackToSignalMs: null });
  rows.push(row('emit-start', { attemptId: 'a-attempt', startedChildMs: 6202 }));
  expect(() => validateQueueCancellation(result, rows)).toThrow('queue_effect_after_control_abort');
});

test('queue boundary counts pending calls without replacing promises, errors or transaction meaning', async () => {
  const { observePg } = await import('./observe-pg.js');
  let acquired!: (value: typeof client) => void; let queryDone!: () => void;
  const failed = new Error('original');
  const pendingQuery = new Promise<void>(resolve => { queryDone = resolve; });
  const client = { query(sql: string) { return sql === 'BEGIN' ? pendingQuery : Promise.reject(failed); } };
  const pendingConnect = new Promise<typeof client>(resolve => { acquired = resolve; });
  const prototype = { connect() { return pendingConnect; } };
  const observer = observePg(prototype, () => {}, () => 1, () => {}, true);
  try {
    expect(prototype.connect()).toBe(pendingConnect);
    expect(observer.boundary()).toMatchObject({ acquisitionsStarted: 1, acquisitionsSettled: 0, acquisitionsInFlight: 1 });
    acquired(client); await pendingConnect;
    expect(client.query('BEGIN')).toBe(pendingQuery);
    expect(observer.boundary()).toMatchObject({ acquisitionsInFlight: 0, queriesInFlight: 1, openTransactions: 1 });
    queryDone(); await pendingQuery;
    await expect(client.query('ROLLBACK')).rejects.toBe(failed);
    expect(observer.boundary()).toMatchObject({ known: true, acquisitionsSettled: 1, queriesStarted: 2, queriesSettled: 2, queriesInFlight: 0, openTransactions: 0 });
  } finally { observer.restore(); }
});
