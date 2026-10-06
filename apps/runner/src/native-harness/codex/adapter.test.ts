import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { afterEach, expect, it } from 'vitest';
import type { HarnessContext, RunnerEventData } from '@flow/contracts';
import type { CodexExecutionProfileConfiguration } from '../../../../../packages/contracts/src/execution-profiles.js';
import { createCodexTransport } from '../../codex/index.js';
import type { CodexTransport, Json } from '../../codex/types.js';
import { NativeExecutionError } from '../settlement.js';
import { configureCodexHarness, type CodexTransportFactory } from './index.js';

const fixture = fileURLToPath(new URL('./peer.mjs', import.meta.url));
const cleanup: (() => Promise<unknown>)[] = [];
afterEach(async () => { for (const stop of cleanup.splice(0).reverse()) await stop(); });
function profile(overrides: Partial<CodexExecutionProfileConfiguration> = {}): CodexExecutionProfileConfiguration {
  return { harness: 'codex', adapterVersion: 'codex-app-server-0.154.0-v1', model: 'synthetic-model', reasoningEffort: null,
    serviceTier: null, serviceTierForTurn: 'default', access: 'none', approvalPolicy: 'never', sandboxMode: 'read-only',
    hostLimits: { wallTimeMs: 2000, maxOutputBytes: 1048576 }, ...overrides };
}
async function setup(mode = 'success', configuration = profile(), wrap: (port: CodexTransport) => CodexTransport = port => port) {
  const directory = await mkdtemp(join(tmpdir(), 'flow-r05c-adapter-'));
  const children: CodexTransport[] = [], calls: { method: string; params: Json }[] = [], events: RunnerEventData[] = [];
  cleanup.push(async () => { for (const child of children) expect((await child.close()).child).toBe('confirmed-exited'); await rm(directory, { recursive: true, force: true }); });
  const factory: CodexTransportFactory = options => {
    const port = createCodexTransport({ spawn: { executable: process.execPath, args: [fixture, mode], cwd: options.workingDirectory, environment: { LANG: 'C' } },
      initialize: { clientInfo: { name: 'r05c-synthetic', title: null, version: '1' }, capabilities: null }, signal: options.signal,
      limits: { initializeTimeoutMs: 1000, requestTimeoutMs: 500, terminateMs: 100, killMs: 100 } });
    children.push(port);
    return wrap({ ...port, request(method, params, options) { calls.push({ method, params }); return port.request(method, params, options); } });
  };
  const configured = configureCodexHarness({ publicProfile: configuration, createTransport: factory });
  const context: HarnessContext = { task: { title: 'Ordinary native task', prompt: 'Synthetic prompt', harness: 'codex',
    executionProfile: { id: randomUUID(), runnerId: randomUUID(), configDigest: '0'.repeat(64) }, verification: { kind: 'contains', expected: '中文🙂' } },
    workingDirectory: directory, signal: new AbortController().signal,
    async assertOwnership() {}, async emit(event) { events.push(event); }, async waitForDecision() { throw new Error('Decision port must remain unused.'); } };
  return { configured, context, children, calls, events };
}

it('constructs without native I/O and emits one bounded ordinary final with actual settings unknown', async () => {
  const api = await setup('duplicate', profile({ reasoningEffort: 'configured-effort', serviceTier: 'configured-tier' }));
  expect(api.children).toEqual([]); expect(api.configured.descriptor.ports).toEqual({});
  expect(Object.isFrozen(api.configured.descriptor.publicProfile)).toBe(true);
  await api.configured.adapter.run(api.context);
  expect(api.calls.map(call => call.method)).toEqual(['thread/start', 'turn/start']);
  expect(api.calls[1]!.params).toMatchObject({ effort: 'configured-effort', serviceTier: 'configured-tier', serviceTierForTurn: 'default', approvalPolicy: 'never', sandboxPolicy: { type: 'readOnly', networkAccess: false } });
  expect(api.events.map(event => event.type)).toEqual(['session', 'assistant-final', 'artifact', 'verification']);
  expect(api.events[1]).toMatchObject({ source: 'codex.app-server.agent-message', content: 'Native peer result 中文🙂',
    settings: { requested: { model: 'synthetic-model', reasoningEffort: 'configured-effort', serviceTier: 'configured-tier', serviceTierForTurn: 'default', access: 'none' },
      observedThreadConfiguration: { modelProvider: 'synthetic', reasoningEffort: null, approvalPolicy: 'never', sandbox: { type: 'readOnly', networkAccess: false } },
      actualExecution: { model: null, reasoningEffort: null, serviceTier: null, tools: null, evidence: 'unknown' } } });
  expect(api.events.at(-1)).toMatchObject({ type: 'verification', result: 'passed' });
  expect(JSON.stringify(api.events)).not.toContain('synthetic-private');
});

const denied = ['item/commandExecution/requestApproval', 'item/fileChange/requestApproval', 'item/permissions/requestApproval', 'item/tool/call',
  'mcpServer/elicitation/request', 'item/tool/requestUserInput', 'account/chatgptAuthTokens/refresh', 'attestation/generate', 'execCommandApproval', 'applyPatchApproval', 'future/request'];
it.each(denied)('denies %s without accepting the malicious subsequent final', async method => {
  const api = await setup(`deny:${method}`);
  await expect(api.configured.adapter.run(api.context)).rejects.toMatchObject({ name: 'NativeExecutionError', settlement: 'unknown' });
  expect(api.events).toEqual([]);
});

it('denies a server request before the turn/start response without deadlocking the response consumer', async () => {
  const api = await setup('deny-before-start-response');
  await expect(api.configured.adapter.run(api.context)).rejects.toMatchObject({ settlement: 'unknown' });
  expect(api.events).toEqual([]);
});

it.each(['commandExecution', 'fileChange', 'mcpToolCall', 'dynamicToolCall', 'collabAgentToolCall', 'subAgentActivity', 'webSearch', 'imageView', 'imageGeneration', 'functionCallOutput', 'sleep', 'hookPrompt', 'contextCompaction', 'futureItem'])('rejects observed %s, including terminal-only evidence', async type => {
  for (const mode of [`tool:${type}`, `terminal-tool:${type}`]) {
    const api = await setup(mode);
    await expect(api.configured.adapter.run(api.context)).rejects.toMatchObject({ settlement: 'unknown' });
    expect(api.events).toEqual([]);
  }
});

it.each(['wrong-thread', 'wrong-turn', 'unknown-phase', 'async', 'changed-item', 'multiple-final', 'post-terminal', 'wrong-sandbox', 'eof', 'lost-start-response', 'oversize', 'wire-escape'])('keeps %s unknown and hides assertion/native diagnostic payloads', async mode => {
  const api = await setup(mode);
  const error = await api.configured.adapter.run(api.context).catch(error => error);
  expect(error).toBeInstanceOf(NativeExecutionError); expect(error.settlement).toBe('unknown');
  expect(error).not.toHaveProperty('cause'); expect(error).not.toHaveProperty('actual'); expect(error).not.toHaveProperty('expected');
  expect(error.message).toBe('Native execution settlement is unknown.'); expect(api.events).toEqual([]);
});

it.each(['failed', 'interrupted'])('accepts native %s only as a settled failure without a final', async mode => {
  const api = await setup(mode);
  await expect(api.configured.adapter.run(api.context)).rejects.toMatchObject({ settlement: 'settled' }); expect(api.events).toEqual([]);
});

it('enforces host output and wall time independently of native provider budget', async () => {
  const small = await setup('success', profile({ hostLimits: { wallTimeMs: 2000, maxOutputBytes: 8 } }));
  await expect(small.configured.adapter.run(small.context)).rejects.toMatchObject({ settlement: 'settled' }); expect(small.events).toEqual([]);
  const stalled = await setup('hang', profile({ hostLimits: { wallTimeMs: 150, maxOutputBytes: 1024 } }));
  await expect(stalled.configured.adapter.run(stalled.context)).rejects.toMatchObject({ settlement: 'unknown' }); expect(stalled.events).toEqual([]);
});

it('cannot convert a completed turn to success when owned child exit remains unconfirmed', async () => {
  const api = await setup('success', profile(), port => ({ ...port, async close() { return { ...await port.close(), child: 'unconfirmed' }; } }));
  await expect(api.configured.adapter.run(api.context)).rejects.toMatchObject({ settlement: 'unknown' }); expect(api.events).toEqual([]);
});

it('refuses unsupported ports and missing pin before creating a transport', async () => {
  const api = await setup();
  await expect(api.configured.adapter.run({ ...api.context, task: { ...api.context.task, executionProfile: undefined } })).rejects.toMatchObject({ settlement: 'settled' });
  await expect(api.configured.adapter.run({ ...api.context, task: { ...api.context.task, resumeSessionId: 'old' } })).rejects.toMatchObject({ settlement: 'settled' });
  await expect(api.configured.adapter.run({ ...api.context, signal: AbortSignal.abort() })).rejects.toThrow();
  expect(api.children).toEqual([]); expect(api.events).toEqual([]);
});
