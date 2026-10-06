import { mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Options, SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import type { HarnessContext, RunnerEventData } from '@flow/contracts';
import { afterEach, expect, it } from 'vitest';
import { createClaudeAdapter, type ClaudeQuery } from './claude.js';

const directories: string[] = [];
afterEach(async () => { for (const directory of directories.splice(0)) await rm(directory, { recursive: true, force: true }); });
async function setup() {
  const directory = await mkdtemp(join(tmpdir(), 'flow-claude-test-'));
  directories.push(directory);
  const material = join(directory, 'authorized.txt');
  await writeFile(material, 'RANDOM_VALUE=violet-317\n');
  const events: RunnerEventData[] = [];
  const abort = new AbortController();
  const context: HarnessContext = {
    task: { title: 'Read material', prompt: 'Return the value from the authorized material.', harness: 'claude', verification: { kind: 'contains', expected: 'violet-317' } },
    workingDirectory: directory, signal: abort.signal,
    async assertOwnership() { abort.signal.throwIfAborted(); },
    async waitForDecision() { return 'approve'; },
    async emit(event) { events.push(event); },
  };
  return { context, material, events, abort };
}
function result(overrides: Record<string, unknown> = {}): SDKMessage {
  return { type: 'result', subtype: 'success', is_error: false, uuid: 'result-1', session_id: 'native-1', result: 'violet-317', num_turns: 2, duration_ms: 20, total_cost_usd: 0.001,
    modelUsage: { 'test-model': { inputTokens: 2, outputTokens: 4, cacheReadInputTokens: 3, cacheCreationInputTokens: 5, costUSD: 0.001 } }, permission_denials: [], ...overrides,
  } as unknown as SDKMessage;
}
function sdk(run: (options: Options, prompt: string) => AsyncGenerator<SDKMessage>): ClaudeQuery {
  return ({ options, prompt }) => Object.assign(run(options!, prompt as string), { close() {} });
}

it('runs the public adapter with only a private material snapshot and verifies its saved result', async () => {
  const test = await setup();
  let snapshot = '';
  let closed = false;
  const query: ClaudeQuery = ({ options, prompt }) => Object.assign((async function* () {
    expect(prompt).not.toContain('violet-317');
    expect(options!.tools).toEqual(['Read']);
    expect(options!.permissionMode).toBe('dontAsk');
    expect(options!.verbatimPrompts).toBe(true);
    expect(options!.settings).toMatchObject({ autoMemoryEnabled: false, syncClaudeAiPlugins: false, syncClaudeAiSkills: false });
    expect(options!.maxTurns).toBeLessThanOrEqual(4);
    expect(options!.maxBudgetUsd).toBeLessThanOrEqual(1);
    snapshot = /Authorized material: (.+)/.exec(prompt as string)![1]!;
    expect(snapshot).not.toBe(test.material);
    const hook = options!.hooks!.PreToolUse![0]!.hooks[0]!;
    const decision = await hook({ hook_event_name: 'PreToolUse', tool_name: 'Read', tool_input: { file_path: snapshot }, tool_use_id: 'read-1', session_id: 'native-1', transcript_path: '', cwd: test.context.workingDirectory }, 'read-1', { signal: test.abort.signal });
    expect(decision).toMatchObject({ hookSpecificOutput: { permissionDecision: 'allow' } });
    expect(await readFile(snapshot, 'utf8')).toBe('RANDOM_VALUE=violet-317\n');
    yield result();
  })(), { close() { closed = true; } });
  await createClaudeAdapter({ materialFiles: [test.material], query }).run(test.context);
  expect(closed).toBe(true);
  expect(test.events).toContainEqual(expect.objectContaining({ type: 'session', nativeSessionId: 'native-1' }));
  expect(test.events).toContainEqual(expect.objectContaining({ type: 'artifact', content: 'violet-317' }));
  expect(test.events).toContainEqual(expect.objectContaining({ type: 'verification', result: 'passed', verifierId: 'flow.text', verifierVersion: '1' }));
  expect(test.events).toContainEqual(expect.objectContaining({ type: 'usage', source: 'claude.modelUsage', scope: 'session', scopeId: 'native-1', model: 'test-model', baseline: { kind: 'new-session' }, costKind: 'sdk_estimate', inputTokens: 2, outputTokens: 4, cacheReadTokens: 3, cacheWriteTokens: 5, costUsd: 0.001 }));
  expect(test.events.some(event => event.type === 'completed' || event.type === 'decision')).toBe(false);
});


it.each(['outside', 'shell', 'missing', 'no-tools'] as const)('denies %s access even when permission callbacks would autoallow', async kind => {
  const test = await setup();
  const query = sdk(async function* (options) {
    const hook = options.hooks!.PreToolUse![0]!.hooks[0]!;
    const answer = await hook({ hook_event_name: 'PreToolUse', tool_name: kind === 'shell' ? 'Bash' : 'Read', tool_input: { file_path: kind === 'missing' ? '/missing/material.txt' : test.material }, tool_use_id: 'read-1', session_id: 'native-1', transcript_path: '', cwd: test.context.workingDirectory }, 'read-1', { signal: test.abort.signal });
    expect(answer).toMatchObject({ hookSpecificOutput: { permissionDecision: 'deny' } });
    if (kind === 'no-tools') { expect(options.tools).toEqual([]); expect(options.disallowedTools).toEqual(['*']); }
    yield result({ result: 'UNKNOWN' });
  });
  await createClaudeAdapter({ materialFiles: [test.material], allowRead: kind !== 'no-tools', query }).run(test.context);
  expect(test.events).toContainEqual(expect.objectContaining({ type: 'detail', title: 'Claude permission denied' }));
  expect(test.events.filter(event => event.type === 'detail').every(event => !event.content.includes(test.material))).toBe(true);
});

it('checks ownership on every tool and aborts the SDK when the lease is lost', async () => {
  const test = await setup();
  let owned = true;
  let decision: unknown;
  let aborted = false;
  test.context.assertOwnership = async () => { if (!owned) throw new Error('Lost lease'); };
  const query = sdk(async function* (options, prompt) {
    const snapshot = /Authorized material: (.+)/.exec(prompt)![1]!;
    const hook = options.hooks!.PreToolUse![0]!.hooks[0]!;
    owned = false;
    const answer = await hook({ hook_event_name: 'PreToolUse', tool_name: 'Read', tool_input: { file_path: snapshot }, tool_use_id: 'read-1', session_id: 'native-1', transcript_path: '', cwd: test.context.workingDirectory }, 'read-1', { signal: test.abort.signal });
    decision = answer;
    aborted = options.abortController!.signal.aborted;
    yield result();
  });
  await expect(createClaudeAdapter({ materialFiles: [test.material], query }).run(test.context)).rejects.toThrow();
  expect(decision).toMatchObject({ hookSpecificOutput: { permissionDecision: 'deny' } });
  expect(aborted).toBe(true);
  expect(test.events.some(event => event.type === 'artifact' || event.type === 'assistant-final' || event.type === 'completed')).toBe(false);
});

it.each(['cancel', 'timeout'] as const)('aborts and closes an active SDK query on %s without emitting completion', async reason => {
  const test = await setup();
  let closed = false;
  const query: ClaudeQuery = ({ options }) => Object.assign((async function* () {
    await new Promise<void>(resolve => {
      options!.abortController!.signal.addEventListener('abort', () => resolve(), { once: true });
      if (reason === 'cancel') test.abort.abort();
    });
    yield result();
  })(), { close() { closed = true; } });
  await expect(createClaudeAdapter({ materialFiles: [], query, timeoutMs: 20 }).run(test.context)).rejects.toThrow();
  expect(closed).toBe(true);
  expect(test.events).toEqual([]);
});

it('does not start the SDK when the attempt is already cancelled', async () => {
  const test = await setup();
  test.abort.abort();
  let called = false;
  const query = sdk(async function* () { called = true; yield result(); });
  await expect(createClaudeAdapter({ materialFiles: [], query }).run(test.context)).rejects.toThrow();
  expect(called).toBe(false);
});

it('keeps resumed model usage cumulative with unknown baseline and stable sample IDs', async () => {
  const test = await setup();
  test.context.task.resumeSessionId = 'native-1';
  const query = sdk(async function* (options) { expect(options.resume).toBe('native-1'); yield result(); yield result(); });
  await createClaudeAdapter({ materialFiles: [], query }).run(test.context);
  const usage = test.events.filter(event => event.type === 'usage');
  expect(usage).toHaveLength(1);
  expect(usage[0]).toMatchObject({ baseline: { kind: 'unknown' }, cumulative: true, inputTokens: 2, costUsd: 0.001 });
  const again = await setup();
  await createClaudeAdapter({ materialFiles: [], query }).run({ ...again.context, task: test.context.task });
  expect(again.events.find(event => event.type === 'usage')).toEqual(usage[0]);
});

it('uses durable runtime decisions then rechecks ownership before allowing Read', async () => {
  const test = await setup();
  let decision = false;
  let checksAfterDecision = 0;
  test.context.waitForDecision = async () => { decision = true; return 'approve'; };
  test.context.assertOwnership = async () => { if (decision) checksAfterDecision += 1; };
  const query = sdk(async function* (options, prompt) {
    const snapshot = /Authorized material: (.+)/.exec(prompt)![1]!;
    const answer = await options.hooks!.PreToolUse![0]!.hooks[0]!({ hook_event_name: 'PreToolUse', tool_name: 'Read', tool_input: { file_path: snapshot }, tool_use_id: 'read-1', session_id: 'native-1', transcript_path: '', cwd: test.context.workingDirectory }, 'read-1', { signal: test.abort.signal });
    expect(answer).toMatchObject({ hookSpecificOutput: { permissionDecision: 'allow' } });
    expect(checksAfterDecision).toBe(1);
    yield result();
  });
  await createClaudeAdapter({ materialFiles: [test.material], requireReadApproval: true, query }).run(test.context);
  expect(decision).toBe(true);
  expect(test.events.some(event => event.type === 'decision' || event.type === 'completed')).toBe(false);
});

it('does not turn a success-shaped API error into a successful artifact or zero usage', async () => {
  const test = await setup();
  await expect(createClaudeAdapter({ materialFiles: [], query: sdk(async function* () { yield result({ is_error: true, modelUsage: {} }); }) }).run(test.context)).rejects.toThrow('did not complete');
  expect(test.events).toContainEqual(expect.objectContaining({ type: 'usage', inputTokens: null, costUsd: null, costKind: 'unknown' }));
  expect(test.events.some(event => event.type === 'artifact' || event.type === 'assistant-final')).toBe(false);
});

it('preserves measured model usage when execution reaches a turn limit', async () => {
  const test = await setup();
  await expect(createClaudeAdapter({ materialFiles: [], query: sdk(async function* () { yield result({ subtype: 'error_max_turns', is_error: true }); }) }).run(test.context)).rejects.toThrow();
  expect(test.events).toContainEqual(expect.objectContaining({ type: 'usage', inputTokens: 2, outputTokens: 4, costUsd: 0.001 }));
});

it('fails closed when durable decision delivery fails and stops the SDK query', async () => {
  const test = await setup();
  test.context.waitForDecision = async () => { throw new Error('Decision transport failed'); };
  let decision: unknown;
  let aborted = false;
  const query = sdk(async function* (options, prompt) {
    const snapshot = /Authorized material: (.+)/.exec(prompt)![1]!;
    const answer = await options.hooks!.PreToolUse![0]!.hooks[0]!({ hook_event_name: 'PreToolUse', tool_name: 'Read', tool_input: { file_path: snapshot }, tool_use_id: 'read-1', session_id: 'native-1', transcript_path: '', cwd: test.context.workingDirectory }, 'read-1', { signal: test.abort.signal });
    decision = answer;
    aborted = options.abortController!.signal.aborted;
    yield result();
  });
  await expect(createClaudeAdapter({ materialFiles: [test.material], query, requireReadApproval: true }).run(test.context)).rejects.toThrow();
  expect(decision).toMatchObject({ hookSpecificOutput: { permissionDecision: 'deny' } });
  expect(aborted).toBe(true);
  expect(test.events.some(event => event.type === 'artifact' || event.type === 'assistant-final')).toBe(false);
});

it('stops waiting for a human decision when the query deadline expires', async () => {
  const test = await setup();
  let decision: unknown;
  test.context.waitForDecision = () => new Promise(() => {});
  const query = sdk(async function* (options, prompt) {
    const snapshot = /Authorized material: (.+)/.exec(prompt)![1]!;
    decision = await options.hooks!.PreToolUse![0]!.hooks[0]!({ hook_event_name: 'PreToolUse', tool_name: 'Read', tool_input: { file_path: snapshot }, tool_use_id: 'read-1', session_id: 'native-1', transcript_path: '', cwd: test.context.workingDirectory }, 'read-1', { signal: test.abort.signal });
    yield result();
  });
  await expect(createClaudeAdapter({ materialFiles: [test.material], query, requireReadApproval: true, timeoutMs: 20 }).run(test.context)).rejects.toThrow();
  expect(decision).toMatchObject({ hookSpecificOutput: { permissionDecision: 'deny' } });
}, 1000);


it('denies a material snapshot that has been replaced with a symlink outside the allowlist', async () => {
  const test = await setup();
  let decision: unknown;
  const query = sdk(async function* (options, prompt) {
    const snapshot = /Authorized material: (.+)/.exec(prompt)![1]!;
    await rm(snapshot);
    await symlink(test.material, snapshot);
    decision = await options.hooks!.PreToolUse![0]!.hooks[0]!({ hook_event_name: 'PreToolUse', tool_name: 'Read', tool_input: { file_path: snapshot }, tool_use_id: 'read-1', session_id: 'native-1', transcript_path: '', cwd: test.context.workingDirectory }, 'read-1', { signal: test.abort.signal });
    yield result({ result: 'UNKNOWN' });
  });
  await createClaudeAdapter({ materialFiles: [test.material], query }).run(test.context);
  expect(decision).toMatchObject({ hookSpecificOutput: { permissionDecision: 'deny' } });
});

it('records SDK permission refusals without publishing their raw tool inputs', async () => {
  const test = await setup();
  await createClaudeAdapter({ materialFiles: [], query: sdk(async function* () {
    yield result({ permission_denials: [{ tool_name: 'Read', tool_use_id: 'denied-1', tool_input: { file_path: '/private/should-not-be-reported' } }] });
  }) }).run(test.context);
  expect(test.events).toContainEqual(expect.objectContaining({ type: 'detail', title: 'Claude SDK permission denials' }));
  expect(JSON.stringify(test.events)).not.toContain('/private/should-not-be-reported');
});

it('preserves token counts but does not present an unknown SDK price basis as known cost', async () => {
  const test = await setup();
  await createClaudeAdapter({ materialFiles: [], query: sdk(async function* () {
    yield result({ modelUsage: { 'unpriced-model': { inputTokens: 2, outputTokens: 3, costUSD: 0.123, costBasis: 'unknown' } } });
  }) }).run(test.context);
  expect(test.events).toContainEqual(expect.objectContaining({ type: 'usage', model: 'unpriced-model', inputTokens: 2, outputTokens: 3, costKind: 'unknown', costUsd: null }));
});

it('rejects an unexpected resumed session before publishing any native session reference', async () => {
  const test = await setup();
  test.context.task.resumeSessionId = 'native-expected';
  await expect(createClaudeAdapter({ materialFiles: [], query: sdk(async function* () {
    yield { type: 'system', subtype: 'init', session_id: 'native-wrong', tools: [], skills: [], plugins: [], mcp_servers: [] } as unknown as SDKMessage;
    yield result({ session_id: 'native-wrong' });
  }) }).run(test.context)).rejects.toThrow('resume');
  expect(test.events.some(event => event.type === 'session' || event.type === 'artifact' || event.type === 'assistant-final')).toBe(false);
});

it('emits exactly the successful final result as typed assistant text after consuming trailing system frames', async () => {
  const test = await setup(); let ended = false;
  const query = sdk(async function* () {
    yield { type: 'system', subtype: 'init', session_id: 'native-1', model: 'effective-model', permissionMode: 'dontAsk', tools: [], plugins: [], skills: [], mcp_servers: [], claude_code_version: 'test-runtime' } as unknown as SDKMessage;
    yield { type: 'stream_event', event: { type: 'content_block_delta', delta: { type: 'text_delta', text: 'repeated draft' } }, session_id: 'native-1', parent_tool_use_id: null } as unknown as SDKMessage;
    for (const content of [[{ type: 'text', text: 'repeated draft' }], [{ type: 'tool_use', id: 'tool-1', name: 'Read', input: { secret: 'tool secret' } }], [{ type: 'thinking', thinking: 'private thinking' }]]) {
      yield { type: 'assistant', message: { id: 'same-message', content }, parent_tool_use_id: null, session_id: 'native-1' } as unknown as SDKMessage;
    }
    yield { type: 'assistant', message: { id: 'child', content: [{ type: 'text', text: 'child output' }] }, parent_tool_use_id: 'child-tool', session_id: 'native-1' } as unknown as SDKMessage;
    yield result({ result: '最终正文 🌱\n仅此一次' });
    yield result({ result: '最终正文 🌱\n仅此一次' });
    yield { type: 'system', subtype: 'status', status: null, session_id: 'native-1' } as unknown as SDKMessage;
    ended = true;
  });
  await createClaudeAdapter({ materialFiles: [], model: 'requested-model', query }).run(test.context);
  expect(ended).toBe(true);
  const finals = test.events.filter(event => event.type === 'assistant-final');
  expect(finals).toHaveLength(1);
  expect(finals[0]).toMatchObject({ content: '最终正文 🌱\n仅此一次', nativeSessionId: 'native-1', source: 'claude.sdk.result', sourceMessageId: 'result-1', settings: {
    requested: { model: 'requested-model', permissionMode: 'dontAsk', thinking: 'disabled' },
    effective: { model: 'effective-model', permissionMode: 'dontAsk', tools: [], thinking: 'unknown' },
  } });
  expect(JSON.stringify(test.events)).not.toMatch(/repeated draft|tool secret|private thinking|child output/);
  expect(test.events.findIndex(event => event.type === 'assistant-final')).toBeGreaterThan(test.events.findIndex(event => event.type === 'verification'));
});
