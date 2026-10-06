import { createHash, randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Options, SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import type { HarnessContext, RunnerEventData } from '@flow/contracts';
import { afterEach, expect, it } from 'vitest';
import { CLAUDE_TURN_SETTINGS_PROTOCOL, type ClaudeTurnSettings } from '../../../packages/contracts/src/claude-turn-settings.js';
import { executionProfileConfigurationJson, type ExecutionProfileConfiguration } from '../../../packages/contracts/src/execution-profiles.js';
import { createClaudeAdapter, type ClaudeQuery } from './claude.js';
import { guardExecutionProfile } from './execution-profiles.js';

const first: ClaudeTurnSettings['requested'] = { model: 'synthetic-alias-a', thinking: 'adaptive', effort: { kind: 'level', value: 'high' }, speed: 'fast' };
const second: ClaudeTurnSettings['requested'] = { model: 'synthetic-alias-b', thinking: 'disabled', effort: { kind: 'level', value: 'low' }, speed: 'standard' };
const omitted: ClaudeTurnSettings['requested'] = { ...second, effort: { kind: 'not-requested' } };
const configuration: ExecutionProfileConfiguration = { harness: 'claude', adapterVersion: 'claude-sdk-0.3.290-v2', model: 'legacy-alias', thinking: 'disabled',
  permissionMode: 'dontAsk', access: 'none', requireReadApproval: false, materialScopeDigest: 'a'.repeat(64),
  limits: { maxTurns: 1, maxBudgetUsd: 0.1, timeoutMs: 1000 }, turnSettings: { protocol: CLAUDE_TURN_SETTINGS_PROTOCOL, choices: [first, second, omitted] } };
const reference = { id: randomUUID(), runnerId: randomUUID(), configDigest: createHash('sha256').update(executionProfileConfigurationJson(configuration)).digest('hex') };
const snapshot = (requested: ClaudeTurnSettings['requested']): ClaudeTurnSettings => ({ protocol: CLAUDE_TURN_SETTINGS_PROTOCOL, profile: reference, requested });
const roots: string[] = [];
afterEach(async () => { for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true }); });
async function context(requested = first, resume = false) {
  const workingDirectory = await mkdtemp(join(tmpdir(), 'flow-message-settings-'));
  roots.push(workingDirectory);
  const events: RunnerEventData[] = [];
  const abort = new AbortController();
  const value: HarnessContext = { workingDirectory, signal: abort.signal,
    task: { title: 'Injected settings', prompt: 'Return the synthetic answer.', harness: 'claude', executionProfile: reference,
      messageSettings: snapshot(requested), ...(resume ? { resumeSessionId: 'synthetic-session' } : {}) },
    async assertOwnership() { abort.signal.throwIfAborted(); }, async waitForDecision() { return 'reject'; }, async emit(event) { events.push(event); } };
  return { value, events, abort };
}
function init(fields: Record<string, unknown> = {}): SDKMessage {
  return { type: 'system', subtype: 'init', uuid: randomUUID(), session_id: 'synthetic-session', model: 'synthetic-resolved',
    permissionMode: 'dontAsk', claude_code_version: 'injected', tools: [], plugins: [], skills: [], mcp_servers: [], ...fields } as unknown as SDKMessage;
}
function result(): SDKMessage {
  return { type: 'result', subtype: 'success', is_error: false, uuid: randomUUID(), session_id: 'synthetic-session', result: 'synthetic answer',
    num_turns: 1, duration_ms: 1, total_cost_usd: 0, modelUsage: {}, permission_denials: [] } as unknown as SDKMessage;
}
function adapter(query: ClaudeQuery) {
  return guardExecutionProfile(createClaudeAdapter({ materialFiles: [], model: configuration.model, turnSettings: configuration.turnSettings,
    ...configuration.limits, query }), reference, configuration);
}

it('passes each frozen request into the existing query and explicitly turns fast off on the resumed message', async () => {
  const requests: Options[] = [];
  let closed = 0;
  const query: ClaudeQuery = ({ options }) => Object.assign((async function* () {
    requests.push(options!);
    yield init({ effort: options!.effort, fast_mode_state: requests.length === 1 ? 'cooldown' : 'off' });
    yield result();
  })(), { close() { closed++; } });
  const a = await context(first); const b = await context(second, true);
  await adapter(query).run(a.value); await adapter(query).run(b.value);
  expect(requests).toHaveLength(2); expect(closed).toBe(2);
  for (const [index, requested] of [first, second].entries()) {
    const options = requests[index]!;
    expect(options).toMatchObject({ model: requested.model, thinking: { type: requested.thinking }, effort: requested.effort.kind === 'level' ? requested.effort.value : undefined,
      settings: { fastMode: requested.speed === 'fast', fastModePerSessionOptIn: true, autoMemoryEnabled: false, disableSkillShellExecution: true },
      tools: [], disallowedTools: ['*'], permissionMode: 'dontAsk', settingSources: [], plugins: [], skills: [], persistSession: true });
    expect(options.resume).toBe(index === 0 ? undefined : 'synthetic-session');
  }
  for (const [test, requested] of [[a, first], [b, second]] as const) {
    const final = test.events.find(event => event.type === 'assistant-final');
    expect(final).toMatchObject({ settings: { messageSettings: { snapshot: snapshot(requested), observed: { model: 'synthetic-resolved' } }, effective: { model: 'synthetic-resolved', thinking: 'unknown' } } });
    expect(final && 'settings' in final ? final.settings : {}).not.toHaveProperty('requested');
    expect(test.events.some(event => event.type === 'completed')).toBe(false);
  }
});

it('allows an explicit fresh omission but rejects its resume before starting the query', async () => {
  let calls = 0;
  const query: ClaudeQuery = ({ options }) => Object.assign((async function* () {
    calls++; expect(options).not.toHaveProperty('effort'); yield result();
  })(), { close() {} });
  const fresh = await context(omitted); await adapter(query).run(fresh.value);
  expect(fresh.events.find(event => event.type === 'assistant-final')).toMatchObject({ settings: { effective: { model: null }, messageSettings: { observed: null } } });
  const resumed = await context(omitted, true);
  await expect(adapter(query).run(resumed.value)).rejects.toThrow();
  expect(calls).toBe(1); expect(resumed.events).toEqual([]);
});

it('rejects missing snapshots, mismatched identity and unconfigured cross-products without executing SDK code', async () => {
  let calls = 0;
  const query: ClaudeQuery = () => { calls++; return Object.assign((async function* () { yield result(); })(), { close() {} }); };
  const missing = await context(); delete missing.value.task.messageSettings;
  const mismatch = await context(); mismatch.value.task.executionProfile = { ...reference, runnerId: randomUUID() };
  const mixed = await context({ ...first, speed: 'standard' });
  const unpinned = await context(); delete unpinned.value.task.executionProfile;
  for (const test of [missing, mismatch, mixed, unpinned]) await expect(adapter(query).run(test.value)).rejects.toThrow();
  expect(calls).toBe(0);
});

it('uses only the latest init facts and preserves explicit null instead of carrying prior reported effort', async () => {
  const test = await context();
  const query: ClaudeQuery = () => Object.assign((async function* () {
    yield init({ effort: 'high', fast_mode_state: 'on' });
    yield init({ model: 'later-resolved', effort: null, fast_mode_state: 'cooldown', fast_mode_disabled_reason: 'sdk_opt_in_required' });
    yield init({ model: 'last-resolved', effort: null }); yield result();
  })(), { close() {} });
  await adapter(query).run(test.value);
  expect(test.events.find(event => event.type === 'assistant-final')).toMatchObject({ settings: { messageSettings: { observed: { source: 'claude.sdk.system.init', model: 'last-resolved', effort: null } } } });
  const final = test.events.find(event => event.type === 'assistant-final');
  if (!final || final.source !== 'claude.sdk.result' || !('messageSettings' in final.settings)) throw new Error('Missing new final');
  expect(final.settings.messageSettings.observed).not.toHaveProperty('fastModeState');
  expect(final.settings.messageSettings.observed).not.toHaveProperty('fastModeDisabledReason');
});

it('closes the query and emits no final when init controls or resumed session identity are invalid', async () => {
  for (const fields of [{ effort: 'unsupported-level' }, { session_id: 'other-session' }]) {
    const test = await context(first, true); let closed = false;
    const query: ClaudeQuery = () => Object.assign((async function* () { yield init(fields); yield result(); })(), { close() { closed = true; } });
    await expect(adapter(query).run(test.value)).rejects.toThrow();
    expect(closed).toBe(true); expect(test.events.some(event => event.type === 'assistant-final' || event.type === 'artifact')).toBe(false);
  }
});
