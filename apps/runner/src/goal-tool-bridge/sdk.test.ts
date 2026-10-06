import { finalResult, mcpPeer } from './test-peer.js';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { HarnessContext, RunnerEventData } from '@flow/contracts';
import { afterEach, expect, it } from 'vitest';
import { createClaudeAdapter, type ClaudeQuery } from '../claude.js';

const directories: string[] = [];
afterEach(async () => { for (const directory of directories.splice(0)) await rm(directory, { recursive: true, force: true }); });
it('mounts the actual SDK MCP server in the production adapter query options and preserves typed final', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'flow-o04-sdk-')); directories.push(directory);
  const events: RunnerEventData[] = [];
  const context: HarnessContext = { task: { title: 'Planner', prompt: 'Define only permitted inputs', harness: 'claude' }, workingDirectory: directory, signal: new AbortController().signal,
    async assertOwnership() {}, async waitForDecision() { return 'reject'; }, async emit(event) { events.push(event); },
    goalTools: { goalId: 'goal', allowedNodeIds: ['A'], allowedCommands: ['define-input'], port: {
      async readGoal() { return { goal: { id: 'goal', projectId: 'project', originalGoal: 'Hidden until requested', constraints: '', acceptance: '', createdAt: '2026-10-06T00:00:00Z' }, nodes: [], projectRevision: 1, explanations: [] }; },
      async readGoalInput() { throw new Error('unused'); }, async commandGoal() { throw new Error('unused'); },
    } },
  };
  let closed = false;
  const query: ClaudeQuery = ({ options }) => Object.assign((async function* () {
    expect(options!.tools).toEqual([]);
    expect(options!.allowedTools).toEqual(['mcp__flow-goal__goal_read', 'mcp__flow-goal__goal_command']);
    expect(options!.disallowedTools).not.toContain('*');
    const peer = await mcpPeer(options!);
    try {
      expect((await peer.listTools()).tools.map(tool => tool.name)).toEqual(['goal_read', 'goal_command']);
      const read = await peer.callTool({ name: 'goal_read', arguments: { request: { view: 'overview' } } });
      expect(read.isError).not.toBe(true); expect(JSON.stringify(read)).not.toContain('Hidden until requested');
    } finally { await peer.close(); }
    yield finalResult();
  })(), { close() { closed = true; } });
  await createClaudeAdapter({ materialFiles: [], allowRead: false, goalTools: true, query }).run(context);
  expect(closed).toBe(true);
  expect(events).toContainEqual(expect.objectContaining({ type: 'assistant-final', content: '中文目标已记录🙂，子任务仍待执行。' }));
  expect(events).toContainEqual(expect.objectContaining({ type: 'verification', result: 'passed' }));
});

it.each([
  ['sdk', 'flow-goal', 'mcp__flow-goal__goal_read', true],
  ['sdk', 'flow-goal', 'mcp__flow-goal__goal_command', true],
  ['plugin', 'flow-goal', 'mcp__flow-goal__goal_command', false],
  ['dynamic', 'flow-goal', 'mcp__flow-goal__goal_command', false],
  ['sdk', 'other', 'mcp__flow-goal__goal_read', false],
  [undefined, undefined, 'mcp__flow-goal__goal_read', false],
  ['sdk', 'flow-goal', 'mcp__flow-goal__delete_everything', false],
  [undefined, undefined, 'Read', false],
] as const)('gates actual query hook provenance %s/%s/%s', async (source, name, tool, allowed) => {
  const directory = await mkdtemp(join(tmpdir(), 'flow-o04-policy-')); directories.push(directory);
  const context: HarnessContext = { task: { title: 'Policy', prompt: 'Goal policy', harness: 'claude' }, workingDirectory: directory, signal: new AbortController().signal,
    async assertOwnership() {}, async waitForDecision() { return 'reject'; }, async emit() {},
    goalTools: { goalId: 'fixed', allowedNodeIds: ['A'], allowedCommands: ['define-input'], port: { async readGoal() { throw new Error('unused'); }, async readGoalInput() { throw new Error('unused'); }, async commandGoal() { throw new Error('unused'); } } },
  };
  const query: ClaudeQuery = ({ options }) => Object.assign((async function* () {
    const hook = options!.hooks!.PreToolUse![0]!.hooks[0]!;
    const response = await hook({ hook_event_name: 'PreToolUse', tool_name: tool, tool_input: {}, tool_use_id: 'test', session_id: 'session', cwd: directory, transcript_path: '', ...(source ? { mcp_server: { source, name: name! } } : {}) }, 'test', { signal: context.signal });
    expect(response).toMatchObject({ hookSpecificOutput: { permissionDecision: allowed ? 'allow' : 'deny' } });
    yield finalResult();
  })(), { close() {} });
  await createClaudeAdapter({ materialFiles: [], allowRead: false, goalTools: true, query }).run(context);
});
it('does not invoke query without a goal capability or with a conflicting material policy', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'flow-o04-missing-')); directories.push(directory); let calls = 0;
  const query: ClaudeQuery = () => { calls++; throw new Error('Query must not start'); };
  const context: HarnessContext = { task: { title: 'No grant', prompt: 'No grant', harness: 'claude' }, workingDirectory: directory, signal: new AbortController().signal, async assertOwnership() {}, async waitForDecision() { return 'reject'; }, async emit() {} };
  await expect(createClaudeAdapter({ materialFiles: [], allowRead: false, goalTools: true, query }).run(context)).rejects.toThrow('capability');
  expect(() => createClaudeAdapter({ materialFiles: [], allowRead: true, goalTools: true, query })).toThrow('material');
  expect(calls).toBe(0);
});
