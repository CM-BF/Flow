import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { createClaudeAdapter, type ClaudeQuery } from '../../../runner/src/claude.js';
import { describeExecutionProfile, guardExecutionProfile, publishExecutionProfile } from '../../../runner/src/execution-profiles.js';
import { runRunner } from '../../../runner/src/runtime.js';
import { startNativeGoalFixture } from './fixture.js';

type SDKMessage = ReturnType<ClaudeQuery> extends AsyncIterable<infer T> ? T : never;
let f: Awaited<ReturnType<typeof startNativeGoalFixture>>;
beforeAll(async () => { f = await startNativeGoalFixture('runtime'); });
afterAll(async () => { await f?.close(); });

async function nativeHarness(query: ClaudeQuery) {
  const directory = await mkdtemp(join(tmpdir(), 'flow-o09-native-'));
  const material = join(directory, 'authorized.txt'); await writeFile(material, 'Local read-only release facts 古😀', { mode: 0o600 });
  const runner = (await f.http('/api/runners', { name: 'O09 injected native reader', harnesses: ['claude'], capacity: 1 })).body;
  const options = { materialFiles: [material], allowRead: true, requireReadApproval: false, model: 'synthetic-requested', maxTurns: 2, maxBudgetUsd: 0.1, timeoutMs: 5000, query };
  const adapter = createClaudeAdapter(options); const configuration = describeExecutionProfile(options, adapter);
  const pin = await publishExecutionProfile({ baseUrl: f.baseUrl, token: runner.token, configuration });
  expect(configuration.access).toBe('configured-readonly');
  return { directory, material, pin, start() {
    const stop = new AbortController();
    const running = runRunner({ baseUrl: f.baseUrl, token: runner.token, workingDirectory: directory, adapters: [guardExecutionProfile(adapter, pin, configuration)], signal: stop.signal });
    return { stop: async () => { stop.abort(); await running; } };
  }, close: () => rm(directory, { recursive: true, force: true }) };
}
async function admit(goal: { goalId: string; nodeId: string }, executionProfile: unknown, version = 1) {
  const result = await f.http(`/api/goals/${goal.goalId}/native-executions`, { nodeId: goal.nodeId, expectedInputVersion: version, dependencies: [], previousExecutionId: null, reason: 'Owner selects registered readonly profile', executionProfile });
  expect(result.status).toBe(201); return result.body;
}
async function waitTask(taskId: string, status: string) {
  await expect.poll(async () => (await f.http(`/api/tasks/${taskId}`)).body.status, { timeout: 7000, interval: 30 }).toBe(status);
  return (await f.http(`/api/tasks/${taskId}`)).body;
}

it('runs selected readonly settings through the existing adapter, preserves exact final/artifact, and requires a separate owner acceptance', async () => {
  const text = '纸鸢发布说明：已整理测试版。🪁'; const session = randomUUID(); let calls = 0; let closed = 0;
  const query: ClaudeQuery = ({ prompt, options }) => Object.assign((async function* () {
    calls++;
    expect(prompt).toContain('Draft a kite release note'); expect(options!.model).toBe('synthetic-requested');
    expect(options!.tools).toEqual(['Read']); expect(options!.allowedTools).toEqual(['Read']);
    expect(options!.disallowedTools).toEqual(expect.arrayContaining(['Bash', 'Write', 'Edit', 'Agent', 'Task', 'Skill']));
    expect(options!.permissionMode).toBe('dontAsk'); expect(options!.mcpServers).toEqual({});
    expect(options!.env).not.toHaveProperty('FLOW_TOKEN'); expect(options!.env).not.toHaveProperty('FLOW_RUNNER_TOKEN');
    const snapshot = String(prompt).split('\n').find(line => line.startsWith('Authorized material: '))!.slice('Authorized material: '.length);
    expect(await readFile(snapshot, 'utf8')).toBe('Local read-only release facts 古😀');
    const hook = options!.hooks!.PreToolUse![0]!.hooks[0]!;
    const base = { hook_event_name: 'PreToolUse' as const, session_id: session, transcript_path: 'synthetic', cwd: options!.cwd!, tool_use_id: randomUUID() };
    const read = await hook({ ...base, tool_name: 'Read', tool_input: { file_path: snapshot } }, undefined, { signal: options!.abortController!.signal });
    expect(read).toMatchObject({ hookSpecificOutput: { permissionDecision: 'allow' } });
    for (const tool_name of ['Write', 'Bash']) {
      const denied = await hook({ ...base, tool_name, tool_input: { file_path: snapshot, command: 'never executed' } }, undefined, { signal: options!.abortController!.signal });
      expect(denied).toMatchObject({ hookSpecificOutput: { permissionDecision: 'deny' } });
    }
    yield { type: 'system', subtype: 'init', session_id: session, model: 'synthetic-effective', tools: ['Read'], skills: [], plugins: [], mcp_servers: [], claude_code_version: 'synthetic-no-provider', permissionMode: 'dontAsk', uuid: randomUUID() } as unknown as SDKMessage;
    yield { type: 'result', subtype: 'success', is_error: false, uuid: randomUUID(), session_id: session, result: text, modelUsage: {}, permission_denials: [] } as unknown as SDKMessage;
  })(), { close() { closed++; } });
  const harness = await nativeHarness(query); const goal = await f.goal(); const accepted = await admit(goal, harness.pin); const runtime = harness.start();
  try {
    const task = await waitTask(accepted.task.id, 'succeeded'); expect(task.verificationStatus).toBe('passed'); expect(calls).toBe(1);
    const messages = (await f.http(`/api/tasks/${task.id}/assistant-messages`)).body.messages; expect(messages).toHaveLength(1);
    const final = (await f.http(`/api/assistant-messages/${messages[0].id}`)).body;
    expect(final).toMatchObject({ taskId: task.id, attemptId: task.attempt.id, nativeSessionId: session, source: 'claude.sdk.result', content: text, settings: { requested: { model: 'synthetic-requested' }, effective: { model: 'synthetic-effective', thinking: 'unknown' } } });
    const before = (await f.http(`/api/goals/${goal.goalId}`)).body.nodes[0]; expect(before.accepted).toBeNull(); expect(before.deliveryCurrent).toBe(false);
    const delivery = await f.http(`/api/goals/${goal.goalId}/commands`, { kind: 'accept-delivery', nodeId: goal.nodeId, executionId: accepted.executionId, expectedCurrentExecutionId: null, reason: 'Owner explicitly accepts the synthetic known text; no automatic semantic assertion' });
    expect(delivery.status).toBe(200);
    expect((await f.http(`/api/details/${delivery.body.delivery.detailId}`)).body.content).toBe(text);
    expect((await f.http(`/api/goals/${goal.goalId}`)).body.nodes[0].deliveryCurrent).toBe(true);
  } finally { await runtime.stop(); expect(closed).toBe(1); await harness.close(); }
});

it('delivers frozen K03 knowledge to the native adapter while later source versions invalidate delivery without rewriting old evidence', async () => {
  const goal = await f.goal(); const text = 'Frozen selected knowledge 古😀'; let calls = 0;
  const source = (await f.http(`/api/projects/${goal.projectId}/knowledge/sources`, { expectedVersion: 0, title: 'Selected release fact', text })).body;
  const ref = { projectId: goal.projectId, sourceId: source.source.id, version: 1, contentDigest: source.version.contentDigest, locator: { kind: 'utf8-bytes', start: 0, end: Buffer.byteLength(text) } };
  expect((await f.http(`/api/goals/${goal.goalId}/commands`, { kind: 'define-input', nodeId: goal.nodeId, expectedInputVersion: 1, reason: 'Owner selects exact knowledge', input: { goal: 'Draft frozen release note', constraints: 'No writes', acceptance: 'Owner checks facts', verification: { kind: 'nonempty' }, knowledge: [ref] } })).status).toBe(200);
  const query: ClaudeQuery = ({ prompt }) => Object.assign((async function* () {
    calls++; expect(prompt).toContain(text); expect(prompt).not.toContain('New source version');
    yield { type: 'result', subtype: 'success', is_error: false, uuid: randomUUID(), session_id: randomUUID(), result: 'Draft from frozen v1', modelUsage: {}, permission_denials: [] } as unknown as SDKMessage;
  })(), { close() {} });
  const harness = await nativeHarness(query); const accepted = await admit(goal, harness.pin, 2);
  const publicTask = (await f.http(`/api/tasks/${accepted.task.id}`)).body; expect(publicTask.prompt).not.toContain(text);
  expect((await f.http(`/api/projects/${goal.projectId}/knowledge/sources/${ref.sourceId}/versions`, { expectedVersion: 1, text: 'New source version' })).status).toBe(201);
  const runtime = harness.start();
  try {
    expect((await waitTask(accepted.task.id, 'succeeded')).verificationStatus).toBe('passed'); expect(calls).toBe(1);
    const history = (await f.http(`/api/goals/${goal.goalId}/executions?nodeId=${goal.nodeId}`)).body.executions;
    expect(history).toHaveLength(1); expect(history[0]).toMatchObject({ inputVersion: 2, inputCurrent: false, context: { referenceCount: 1, templateVersion: 1 } });
    expect((await f.http(`/api/goals/${goal.goalId}/commands`, { kind: 'accept-delivery', nodeId: goal.nodeId, executionId: accepted.executionId, expectedCurrentExecutionId: null, reason: 'Must reject obsolete source' })).body.error.code).toBe('execution_obsolete');
    expect((await f.http(`/api/goals/${goal.goalId}`)).body.nodes[0].accepted).toBeNull();
    const messages = (await f.http(`/api/tasks/${accepted.task.id}/assistant-messages`)).body.messages;
    expect((await f.http(`/api/assistant-messages/${messages[0].id}`)).body.content).toBe('Draft from frozen v1');
  } finally { await runtime.stop(); await harness.close(); }
});

it('does not produce or accept a final artifact when the injected SDK reports an unsuccessful result', async () => {
  let calls = 0;
  const query: ClaudeQuery = () => Object.assign((async function* () {
    calls++;
    yield { type: 'result', subtype: 'success', is_error: true, uuid: randomUUID(), session_id: randomUUID(), result: 'Not a valid final', modelUsage: {}, permission_denials: [] } as unknown as SDKMessage;
  })(), { close() {} });
  const harness = await nativeHarness(query); const goal = await f.goal(); const accepted = await admit(goal, harness.pin); const runtime = harness.start();
  try {
    const task = await waitTask(accepted.task.id, 'failed'); expect(calls).toBe(1); expect(task.verificationStatus).toBe('pending');
    expect((await f.http(`/api/tasks/${task.id}/assistant-messages`)).body.messages).toEqual([]);
    expect(task.hasMore).toBe(false);
    const details = await Promise.all(task.entries.filter((entry: any) => entry.kind === 'reference').map((entry: any) => f.http(`/api/details/${entry.reference.id}`)));
    expect(details.some(detail => detail.body.kind === 'artifact')).toBe(false);
    expect((await f.http(`/api/goals/${goal.goalId}/commands`, { kind: 'accept-delivery', nodeId: goal.nodeId, executionId: accepted.executionId, expectedCurrentExecutionId: null, reason: 'Must not accept unsuccessful SDK text' })).body.error.code).toBe('delivery_unverified');
  } finally { await runtime.stop(); await harness.close(); }
});
