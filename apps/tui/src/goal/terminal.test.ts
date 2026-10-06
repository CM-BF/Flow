import { expect, it } from 'vitest';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { parseGoalLine } from './commands.js';
import { openGoalIntentStore } from './store.js';
import { openIntentStore } from '../intent-store.js';

it('keeps ordinary and multiline text as a draft and requires explicit versioned command syntax', () => {
  expect(parseGoalLine('中文🙂\nnot a command')).toEqual({ type: 'draft', text: '中文🙂\nnot a command' });
  expect(parseGoalLine('/input node 2')).toEqual({ type: 'input', nodeId: 'node', version: 2 });
  expect(() => parseGoalLine('/input node 0')).toThrow();
  expect(() => parseGoalLine('/cancel node extra')).toThrow();
  expect(() => parseGoalLine('/run anything')).toThrow();
  expect(parseGoalLine('/command {"kind":"cancel","nodeId":"n","taskId":"t"}')).toEqual({ type: 'command', command: { kind: 'cancel', nodeId: 'n', taskId: 't' } });
});
it('shares private atomic IO without changing the old filename and isolates goal namespaces', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'flow-tui01d-journal-')), connectionId = 'c'.repeat(64), goalId = randomUUID();
  const namespace = JSON.stringify(['flow.goal-session.v1', connectionId, goalId]);
  const value = { version: 1 as const, connectionId, goalId, projectId: randomUUID(), key: randomUUID(), command: { kind: 'cancel' as const, nodeId: randomUUID(), taskId: randomUUID() } };
  const conversation = await openIntentStore(dir, connectionId); let goal = await openGoalIntentStore(dir, connectionId, goalId);
  try {
    const old = { version: 1 as const, connectionId, key: randomUUID(), kind: 'create' as const, input: { title: 'Old unchanged', harness: 'claude' as const, requested: { model: 'runner-default', thinking: 'disabled' as const, tools: 'configured-readonly' as const } } };
    await conversation.save(old); expect(JSON.parse(await readFile(join(dir, connectionId + '.json'), 'utf8'))).toEqual(old);
    await goal.save(namespace, value); await expect(openGoalIntentStore(dir, connectionId, goalId)).rejects.toThrow();
    await goal.close(); goal = await openGoalIntentStore(dir, connectionId, goalId); expect(await goal.load(namespace)).toEqual(value);
    await expect(goal.load('wrong namespace')).rejects.toThrow(); await goal.save(namespace, null); expect(await goal.load(namespace)).toBeNull();
    expect(await conversation.load()).toEqual(old); expect((await readdir(dir)).filter(f => f.endsWith('.tmp'))).toEqual([]);
  } finally { await goal.close(); await conversation.close(); await rm(dir, { recursive: true, force: true }); }
});

it('releases the owned private journal when initialization cannot reach the center', async () => {
  const { runTerminal } = await import('../main.js');
  const dir = await mkdtemp(join(tmpdir(), 'flow-tui01d-invalid-'));
  try {
    await expect(runTerminal(['--goal', '-'.repeat(36), '--headless'], { FLOW_URL: 'http://127.0.0.1:1', FLOW_TOKEN: 'synthetic-owner', FLOW_TUI_STATE_DIR: dir })).rejects.toThrow();
    expect((await readdir(dir)).filter(name => name.endsWith('.lock'))).toEqual([]);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
