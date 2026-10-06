import { finalResult, graphPeer } from './test-peer.js';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { HarnessContext, RunnerEventData } from '@flow/contracts';
import { afterEach, expect, it, vi } from 'vitest';
import { createClaudeAdapter, type ClaudeQuery } from '../claude.js';
import { loadRunnerConfiguration } from '../configuration.js';
import { describeExecutionProfile, guardExecutionProfile } from '../execution-profiles.js';
import { textDigest } from '../verifier.js';
import { executionProfileConfigurationJson } from '../../../../packages/contracts/src/execution-profiles.js';

const directories: string[] = [];
afterEach(async () => { vi.unstubAllEnvs(); for (const directory of directories.splice(0)) await rm(directory, { recursive: true, force: true }); });
async function context() {
  const directory = await mkdtemp(join(tmpdir(), 'flow-o07-sdk-')); directories.push(directory); const events: RunnerEventData[] = [];
  const value: HarnessContext = { task: { title: 'Graph planner', prompt: 'Record a plan only', harness: 'claude' }, workingDirectory: directory, signal: new AbortController().signal,
    async assertOwnership() {}, async waitForDecision() { return 'reject'; }, async emit(event) { events.push(event); },
    goalGraphTools: { goalId: 'goal', runId: 'run', scope: { baseRevision: 1, allowedExistingNodes: [], maxProposals: 1, maxApplications: 1, maxNewNodes: 3, maxNewEdges: 2 }, port: {
      async readGraph() { return { goalId: 'goal', projectId: 'project', baseRevision: 1, currentRevision: 1, stale: false, nodes: [], nextCursor: null }; }, async readProposal() { throw new Error('unused'); }, async commandGraph() { throw new Error('unused'); },
    } },
  };
  return { value, events, directory };
}
it('mounts the actual graph SDK server in the existing query loop and preserves typed final with isolated credentials', async () => {
  const ctx = await context(); vi.stubEnv('FLOW_RUNNER_TOKEN', 'host-only-runner'); vi.stubEnv('FLOW_TOKEN', 'host-only-owner');
  let closed = false; let invoked = 0;
  const query: ClaudeQuery = ({ options }) => Object.assign((async function* () {
    invoked++; expect(options!.tools).toEqual([]); expect(options!.allowedTools).toEqual(['mcp__flow-graph__graph_read', 'mcp__flow-graph__graph_command']);
    expect(options!.disallowedTools).not.toContain('*'); expect(options!.env).not.toHaveProperty('FLOW_TOKEN'); expect(options!.env).not.toHaveProperty('FLOW_RUNNER_TOKEN');
    expect(options!.plugins).toEqual([]); expect(options!.strictMcpConfig).toBe(true);
    const peer = await graphPeer(options!);
    try {
      const tools = await peer.listTools(); expect(tools.tools.map(tool => tool.name)).toEqual(['graph_read', 'graph_command']);
      const response = await peer.callTool({ name: 'graph_read', arguments: { request: { view: 'graph' } } });
      expect(response.isError).not.toBe(true); expect(JSON.parse((response.content as any)[0].text)).toMatchObject({ baseRevision: 1, nodes: [] });
    } finally { await peer.close(); }
    yield finalResult();
  })(), { close() { closed = true; } });
  await createClaudeAdapter({ materialFiles: [], allowRead: false, goalGraphTools: true, query }).run(ctx.value);
  expect(invoked).toBe(1); expect(closed).toBe(true);
  expect(ctx.events).toContainEqual(expect.objectContaining({ type: 'assistant-final', content: '计划已记录🙂，未执行子任务。' }));
  expect(ctx.events).toContainEqual(expect.objectContaining({ type: 'verification', result: 'passed' }));
});
it('loads only explicit separate graph configuration and refuses capability/profile mismatch before query', async () => {
  const ctx = await context(); const file = join(ctx.directory, 'manifest.json'); let calls = 0;
  const options = { materialFiles: [], allowRead: false, goalGraphTools: true, model: 'synthetic-no-query', maxTurns: 1, maxBudgetUsd: 0.01, timeoutMs: 1000 };
  await writeFile(file, JSON.stringify(options)); const loaded = await loadRunnerConfiguration(file); expect(loaded.profile!.access).toBe('goal-graph-tools');
  const query: ClaudeQuery = () => { calls++; throw new Error('Must not query'); };
  const adapter = createClaudeAdapter({ ...options, query }); const configuration = describeExecutionProfile(options, adapter);
  const reference = { id: '4da8e243-3ff7-4bd9-a93b-14de535d3788', runnerId: '28b02eab-27cb-4074-a098-1b11459ec80c', configDigest: textDigest(executionProfileConfigurationJson(configuration)) };
  const guarded = guardExecutionProfile(adapter, reference, configuration);
  await expect(guarded.run(ctx.value)).rejects.toThrow('purpose');
  ctx.value.task.executionProfile = reference; delete ctx.value.goalGraphTools;
  await expect(guarded.run(ctx.value)).rejects.toThrow('purpose');
  for (const invalid of [{ ...options, goalTools: true }, { ...options, allowRead: true }, { ...options, goalGraphTools: 'yes' }]) {
    await writeFile(file, JSON.stringify(invalid)); await expect(loadRunnerConfiguration(file)).rejects.toThrow();
  }
  expect(calls).toBe(0);
});
it('does not publish a final or artifact when query is cancelled before its late result', async () => {
  const ctx = await context(); const stop = new AbortController(); ctx.value.signal = stop.signal; let closed = false;
  const query: ClaudeQuery = () => Object.assign((async function* () { stop.abort(new Error('Cancelled')); yield finalResult(); })(), { close() { closed = true; } });
  await expect(createClaudeAdapter({ materialFiles: [], allowRead: false, goalGraphTools: true, query }).run(ctx.value)).rejects.toThrow();
  expect(closed).toBe(true); expect(ctx.events.some(event => event.type === 'assistant-final' || event.type === 'artifact')).toBe(false);
});
