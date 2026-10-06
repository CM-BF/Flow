import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { SDKControlGetContextUsageResponse, SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import { eventBatchSchema, type ClaimedTask, type HarnessContext, type RunnerEvent, type RunnerEventData } from '@flow/contracts';
import { afterEach, expect, it, vi } from 'vitest';
import { createClaudeAdapter, type ClaudeQuery } from './claude.js';
import { NativeExecutionError } from './native-harness/settlement.js';
import { runRunner, type RunnerNotice, type RunnerOptions } from './runtime.js';
import { textDigest } from './verifier.js';

const cleanups: (() => Promise<unknown>)[] = [];
afterEach(async () => { vi.useRealTimers(); for (const cleanup of cleanups.splice(0).reverse()) await cleanup(); });
const profile = { id: 'profile-1', runnerId: 'runner-1', configDigest: 'a'.repeat(64) };
const summary = (): SDKControlGetContextUsageResponse => ({
  totalTokens: 120, rawMaxTokens: 1000, maxTokens: 900, percentage: 12, model: 'resolved-model',
  categories: [{ kind: 'used', tokens: 120, name: 'PRIVATE', color: 'PRIVATE' }],
  gridRows: [], memoryFiles: [], mcpTools: [], agents: [], isAutoCompactEnabled: true, apiUsage: null,
});
const init = { type: 'system', subtype: 'init', session_id: 'native-1', model: 'resolved-model', permissionMode: 'dontAsk', tools: [], plugins: [], skills: [], mcp_servers: [] } as unknown as SDKMessage;
const result = (text = 'answer'): SDKMessage => ({ type: 'result', subtype: 'success', is_error: false, uuid: 'result-1', session_id: 'native-1', result: text, num_turns: 1, duration_ms: 1, total_cost_usd: 0, modelUsage: {}, permission_denials: [] }) as unknown as SDKMessage;

async function setup() {
  const directory = await mkdtemp(join(tmpdir(), 'flow-context-producer-'));
  cleanups.push(() => rm(directory, { recursive: true, force: true }));
  const events: RunnerEventData[] = [], abort = new AbortController();
  const context: HarnessContext = {
    task: { title: 'Context observation', prompt: 'Answer', harness: 'claude', executionProfile: profile },
    executionIdentity: Object.freeze({ taskId: 'task-1', attemptId: 'attempt-1', runnerId: 'runner-1', ownerVersion: 1 }),
    workingDirectory: directory, signal: abort.signal,
    async assertOwnership() { abort.signal.throwIfAborted(); },
    async waitForDecision() { return 'approve'; },
    async emit(event) { events.push(event); },
  };
  return { context, events, abort };
}

it('publishes one bounded history observation after normal EOF on the same successful Query', async () => {
  const test = await setup(); let ended = false, closed = false;
  const getContextUsage = vi.fn(async function (this: { close(): void }, options: unknown) {
    expect(this.close).toBe(close); expect(options).toEqual({ detail: 'summary' });
    expect(closed).toBe(false); expect(ended).toBe(false);
    expect(test.events.some(event => event.type === 'session')).toBe(true);
    return summary();
  });
  const close = () => { closed = true; };
  const query: ClaudeQuery = () => Object.assign((async function* () {
    yield init; yield result();
    expect(test.events.some(event => event.type === 'context-observation')).toBe(false);
    ended = true;
  })(), { close, getContextUsage });
  await createClaudeAdapter({ materialFiles: [], model: 'requested-alias', query }).run(test.context);
  expect(getContextUsage).toHaveBeenCalledTimes(1);
  const observations = test.events.filter(event => event.type === 'context-observation');
  expect(observations).toHaveLength(1);
  expect(observations[0]).toMatchObject({ observation: { nativeSessionId: 'native-1', resolvedModel: 'resolved-model', used: 120, compactionWindow: 1000, categories: [{ kind: 'used', tokens: 120 }] } });
  expect(JSON.stringify(observations)).not.toMatch(/PRIVATE|evidenceRef|requested-alias/);
  expect(test.events.findIndex(event => event.type === 'context-observation')).toBeLessThan(test.events.findIndex(event => event.type === 'artifact'));
  expect(ended && closed).toBe(true);
});

function fakeQuery(messages: SDKMessage[], getContextUsage = vi.fn(async () => summary()), close = vi.fn()) {
  const query: ClaudeQuery = () => Object.assign((async function* () { yield* messages; })(), { close, getContextUsage });
  return { query, getContextUsage, close };
}

it('samples duplicate identical results only once', async () => {
  const test = await setup(), fake = fakeQuery([init, result(), result()]);
  await createClaudeAdapter({ materialFiles: [], query: fake.query }).run(test.context);
  expect(fake.getContextUsage).toHaveBeenCalledTimes(1);
  expect(test.events.filter(event => event.type === 'context-observation')).toHaveLength(1);
});

it.each(['conflict', 'stream-error'] as const)('discards the candidate after a later %s', async failure => {
  const test = await setup(), getContextUsage = vi.fn(async () => summary()), close = vi.fn();
  const query: ClaudeQuery = () => Object.assign((async function* () {
    yield init; yield result();
    if (failure === 'conflict') yield result('different answer');
    else throw new Error('Stream failed');
  })(), { getContextUsage, close });
  await expect(createClaudeAdapter({ materialFiles: [], query }).run(test.context)).rejects.toThrow();
  expect(getContextUsage).toHaveBeenCalledTimes(1); expect(close).toHaveBeenCalledTimes(1);
  expect(test.events.some(event => ['context-observation', 'artifact', 'assistant-final'].includes(event.type))).toBe(false);
});

it('permanently discards the candidate if a later initialization changes the resolved model', async () => {
  const test = await setup(), fake = fakeQuery([init, result(), { ...init, model: 'changed-model' } as SDKMessage, init]);
  await createClaudeAdapter({ materialFiles: [], query: fake.query }).run(test.context);
  expect(fake.getContextUsage).toHaveBeenCalledTimes(1);
  expect(test.events.some(event => event.type === 'context-observation')).toBe(false);
  expect(test.events.some(event => event.type === 'artifact')).toBe(true);
});

it.each(['result-session', 'resume-session'] as const)('rejects %s before sampling', async mismatch => {
  const test = await setup();
  if (mismatch === 'resume-session') test.context.task.resumeSessionId = 'other-session';
  const fake = fakeQuery([init, { ...result(), session_id: 'other-session' } as SDKMessage]);
  await expect(createClaudeAdapter({ materialFiles: [], query: fake.query }).run(test.context)).rejects.toThrow(/session|resume/);
  expect(fake.getContextUsage).not.toHaveBeenCalled();
});

it.each(['profile', 'identity', 'mutable-identity', 'wrong-runner'] as const)('skips sampling without an eligible %s', async missing => {
  const test = await setup(), fake = fakeQuery([init, result()]);
  let context = test.context;
  if (missing === 'profile') delete context.task.executionProfile;
  if (missing === 'identity') context = { ...context, executionIdentity: undefined };
  if (missing === 'mutable-identity') context = { ...context, executionIdentity: { ...context.executionIdentity! } };
  if (missing === 'wrong-runner') context.task.executionProfile = { ...profile, runnerId: 'other-runner' };
  await createClaudeAdapter({ materialFiles: [], query: fake.query }).run(context);
  expect(fake.getContextUsage).not.toHaveBeenCalled();
  expect(test.events.some(event => event.type === 'artifact')).toBe(true);
});

it('binds the session before reading but keeps a missing initialization model unknown', async () => {
  const test = await setup(), fake = fakeQuery([result()]);
  fake.getContextUsage.mockImplementation(async () => {
    expect(test.events.some(event => event.type === 'session' && event.nativeSessionId === 'native-1')).toBe(true);
    return summary();
  });
  await createClaudeAdapter({ materialFiles: [], model: 'requested-alias', query: fake.query }).run(test.context);
  expect(test.events.find(event => event.type === 'context-observation')).toMatchObject({ observation: {
    nativeSessionId: 'native-1', resolvedModel: null, used: null, compactionWindow: null, categories: [],
  } });
});

it.each(['rejected', 'overflow'] as const)('keeps a successful answer when measurement is %s', async failure => {
  const test = await setup(), fake = fakeQuery([init, result()]);
  fake.getContextUsage.mockImplementation(async () => {
    if (failure === 'rejected') throw new Error('PRIVATE SDK response');
    const raw = summary(); raw.categories.push({ kind: 'free', tokens: Number.MAX_SAFE_INTEGER, name: 'PRIVATE', color: '' }); return raw;
  });
  await createClaudeAdapter({ materialFiles: [], query: fake.query }).run(test.context);
  expect(test.events.some(event => event.type === 'context-observation')).toBe(false);
  expect(test.events.some(event => event.type === 'artifact')).toBe(true);
  expect(JSON.stringify(test.events)).not.toContain('PRIVATE');
});

it.each(['ownership', 'emit'] as const)('propagates %s failure without publishing the answer', async failure => {
  const test = await setup(), originalEmit = test.context.emit, error = new Error('Ownership or ACK failed');
  const fake = fakeQuery([init, result()]);
  if (failure === 'ownership') fake.getContextUsage.mockImplementation(async () => {
    test.context.assertOwnership = async () => { throw error; }; return summary();
  });
  else test.context.emit = async event => { if (event.type === 'context-observation') throw error; await originalEmit(event); };
  await expect(createClaudeAdapter({ materialFiles: [], query: fake.query }).run(test.context)).rejects.toBe(error);
  expect(test.events.some(event => event.type === 'artifact')).toBe(false);
  expect(fake.close).toHaveBeenCalledTimes(1);
});

it('preserves unknown settlement after aborting a dispatched read even if Query.close throws', async () => {
  const test = await setup(); const close = vi.fn(() => { throw new Error('PRIVATE close error'); });
  const getContextUsage = vi.fn(() => { test.abort.abort(); return new Promise<SDKControlGetContextUsageResponse>(() => {}); });
  const fake = fakeQuery([init, result()], getContextUsage, close);
  const error = await createClaudeAdapter({ materialFiles: [], query: fake.query }).run(test.context).catch(error => error);
  expect(error).toBeInstanceOf(NativeExecutionError); expect(error.settlement).toBe('unknown');
  expect(error.message).not.toContain('PRIVATE'); expect(close).toHaveBeenCalledTimes(1);
  expect(test.events.some(event => event.type === 'context-observation' || event.type === 'artifact')).toBe(false);
});

it('does not convert a definite read rejection plus close failure into unknown', async () => {
  const test = await setup(), closeError = new Error('Close failed');
  const fake = fakeQuery([init, result()], vi.fn(async () => { throw new Error('SDK rejected'); }), vi.fn(() => { throw closeError; }));
  await expect(createClaudeAdapter({ materialFiles: [], query: fake.query }).run(test.context)).rejects.toBe(closeError);
  expect(test.events.some(event => event.type === 'context-observation')).toBe(false);
});

it('does not sample a child result', async () => {
  const test = await setup(), fake = fakeQuery([init, { ...result(), parent_tool_use_id: 'child-tool' } as SDKMessage]);
  await createClaudeAdapter({ materialFiles: [], query: fake.query }).run(test.context);
  expect(fake.getContextUsage).not.toHaveBeenCalled();
});

it('keeps cumulative billing usage separate from summary consumption', async () => {
  const test = await setup();
  const fake = fakeQuery([init, { ...result(), modelUsage: { 'resolved-model': {
    inputTokens: 987654, outputTokens: 123, cacheReadInputTokens: 0, cacheCreationInputTokens: 0, costUSD: 0.5,
  } } } as unknown as SDKMessage]);
  await createClaudeAdapter({ materialFiles: [], query: fake.query }).run(test.context);
  expect(test.events.find(event => event.type === 'usage')).toMatchObject({ inputTokens: 987654, scope: 'session', cumulative: true });
  expect(test.events.find(event => event.type === 'context-observation')).toMatchObject({ observation: { used: 120 } });
});

it('leaves the steering conditional-final path unsampled', async () => {
  const test = await setup(), getContextUsage = vi.fn(async () => summary());
  const finalize = vi.fn(async () => ({ state: 'committed' as const, proposalId: 'proposal-1', lastSequence: 3, replayed: false }));
  test.context.steering = { async mailbox() { return { revision: 0, sealed: false, commands: [], delivery: null }; }, finalize };
  const query: ClaudeQuery = ({ prompt }) => Object.assign((async function* () {
    if (typeof prompt === 'string') throw new Error('Expected steering input');
    await prompt[Symbol.asyncIterator]().next(); yield init;
    yield { ...result(), queued_turn_count: 0 } as SDKMessage;
  })(), { getContextUsage, close() {} });
  await createClaudeAdapter({ materialFiles: [], query }).run(test.context);
  expect(finalize).toHaveBeenCalledTimes(1); expect(getContextUsage).not.toHaveBeenCalled();
});

it.each(['goal', 'graph'] as const)('leaves host-bound %s tool execution unsampled', async mode => {
  const test = await setup(), fake = fakeQuery([init, result()]);
  const unexpected = async (): Promise<never> => { throw new Error('No tool call expected'); };
  if (mode === 'goal') test.context.goalTools = { goalId: 'goal-1', allowedNodeIds: [], allowedCommands: [],
    port: { readGoal: unexpected, readGoalInput: unexpected, commandGoal: unexpected } };
  else test.context.goalGraphTools = { goalId: 'goal-1', runId: 'run-1',
    scope: { baseRevision: 1, allowedExistingNodes: [], maxProposals: 1, maxApplications: 0, maxNewNodes: 1, maxNewEdges: 0 },
    port: { readGraph: unexpected, readProposal: unexpected, commandGraph: unexpected } };
  await createClaudeAdapter({ materialFiles: [], goalTools: mode === 'goal', goalGraphTools: mode === 'graph', allowRead: false, query: fake.query }).run(test.context);
  expect(fake.getContextUsage).not.toHaveBeenCalled();
  expect(test.events.some(event => event.type === 'artifact')).toBe(true);
});

it('does not issue a control when session acknowledgement fails', async () => {
  const test = await setup(), fake = fakeQuery([result()]), error = new Error('Session ACK failed');
  test.context.emit = async event => { if (event.type === 'session') throw error; test.events.push(event); };
  await expect(createClaudeAdapter({ materialFiles: [], query: fake.query }).run(test.context)).rejects.toBe(error);
  expect(fake.getContextUsage).not.toHaveBeenCalled(); expect(fake.close).toHaveBeenCalledTimes(1);
});

it('does not dispatch when cancellation arrives before the summary request', async () => {
  const test = await setup(), fake = fakeQuery([result()]), error = new Error('Cancelled before read');
  test.context.emit = async event => { test.events.push(event); if (event.type === 'session') test.abort.abort(error); };
  await expect(createClaudeAdapter({ materialFiles: [], query: fake.query }).run(test.context)).rejects.toBe(error);
  expect(fake.getContextUsage).not.toHaveBeenCalled(); expect(fake.close).toHaveBeenCalledTimes(1);
});

async function loopback(query: ClaudeQuery) {
  const workingDirectory = await mkdtemp(join(tmpdir(), 'flow-context-runner-'));
  cleanups.push(() => rm(workingDirectory, { recursive: true, force: true }));
  const events: RunnerEvent[] = [], errors: unknown[] = [], notices: RunnerNotice[] = [];
  let claims = 0;
  const assignment: ClaimedTask = {
    attempt: { id: 'attempt-1', runnerId: 'runner-1', ownerVersion: 1, leaseExpiresAt: new Date(Date.now() + 10000).toISOString() },
    task: { id: 'task-1', title: 'Summary fixture', prompt: 'Answer', harness: 'claude', executionProfile: profile },
  };
  const server = createServer(async (request, response) => {
    try {
      const chunks: Buffer[] = []; for await (const chunk of request) chunks.push(chunk as Buffer);
      const body = JSON.parse(Buffer.concat(chunks).toString() || '{}');
      response.setHeader('Content-Type', 'application/json');
      expect(request.headers.authorization).toBe('Bearer synthetic-context-token');
      if (request.url === '/api/runner/claim') {
        response.end(JSON.stringify({ assignment: claims++ === 0 ? assignment : null, remainingLeaseMs: 10000 })); return;
      }
      expect(body).toMatchObject({ attemptId: 'attempt-1', ownerVersion: 1 });
      if (request.url === '/api/runner/heartbeat') {
        response.end(JSON.stringify({ action: 'continue', remainingLeaseMs: 10000, leaseExpiresAt: new Date(Date.now() + 10000).toISOString(), decision: null })); return;
      }
      if (request.url === '/api/runner/events') {
        const batch = eventBatchSchema.parse(body); let accepted = 0;
        for (const event of batch.events) {
          const prior = events.find(saved => saved.id === event.id || saved.sequence === event.sequence);
          if (prior) expect(event).toEqual(prior);
          else { expect(event.sequence).toBe(events.length + 1); events.push(event); accepted++; }
        }
        response.end(JSON.stringify({ accepted, lastSequence: events.length })); return;
      }
      throw new Error('Unexpected test route');
    } catch (error) { errors.push(error); response.writeHead(500).end('{}'); }
  });
  cleanups.push(async () => { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('Missing test port');
  const options: Omit<RunnerOptions, 'signal'> = {
    baseUrl: `http://127.0.0.1:${address.port}`, token: 'synthetic-context-token', workingDirectory,
    pollIntervalMs: 10, heartbeatIntervalMs: 25, requestTimeoutMs: 500,
    adapters: [createClaudeAdapter({ materialFiles: [], query })], onNotice: notice => notices.push(notice),
  };
  return {
    events, errors, notices, get claims() { return claims; },
    async journal() { return JSON.parse(await readFile(join(workingDirectory, textDigest(options.baseUrl), 'admission.json'), 'utf8')); },
    start() {
      const controller = new AbortController(), running = runRunner({ ...options, signal: controller.signal });
      void running.catch(() => undefined);
      const stop = async () => { controller.abort(); await running; };
      cleanups.push(stop); return { stop };
    },
  };
}

it('sends the real public observation through runtime schema, ordered ACKs and completed admission', async () => {
  const fake = fakeQuery([init, result()]), api = await loopback(fake.query);
  fake.getContextUsage.mockImplementation(async () => {
    expect(api.events.some(event => event.type === 'session')).toBe(true); return summary();
  });
  const running = api.start();
  await vi.waitFor(() => expect(api.events.some(event => event.type === 'completed')).toBe(true), { timeout: 3000, interval: 10 });
  await running.stop();
  expect(api.errors).toEqual([]); expect(fake.close).toHaveBeenCalledTimes(1);
  expect(api.events.map(event => event.sequence)).toEqual(api.events.map((_event, index) => index + 1));
  expect(api.events.filter(event => event.type === 'context-observation')).toHaveLength(1);
  expect(api.events.at(-1)).toMatchObject({ type: 'completed', outcome: 'succeeded' });
  expect((await api.journal()).assignments).toEqual([]);
});

it('retains an unsettled summary in the real journal and blocks restart despite a throwing close', async () => {
  const fake = fakeQuery([init, result()], vi.fn(() => new Promise<SDKControlGetContextUsageResponse>(() => {})),
    vi.fn(() => { throw new Error('PRIVATE close error'); }));
  const api = await loopback(fake.query), first = api.start();
  await vi.waitFor(() => expect(api.notices.some(notice => notice.type === 'admission-blocked')).toBe(true), { timeout: 3000, interval: 10 });
  await first.stop();
  expect(api.events.map(event => event.type)).toEqual(['session']);
  expect((await api.journal()).assignments).toEqual([{ taskId: 'task-1', attemptId: 'attempt-1', runnerId: 'runner-1', ownerVersion: 1 }]);
  expect(api.claims).toBe(1); const previousNotices = api.notices.length;
  const restarted = api.start();
  await vi.waitFor(() => expect(api.notices.slice(previousNotices).some(notice => notice.type === 'admission-blocked')).toBe(true), { timeout: 3000, interval: 10 });
  await restarted.stop();
  expect(api.claims).toBe(1); expect(fake.getContextUsage).toHaveBeenCalledTimes(1); expect(fake.close).toHaveBeenCalledTimes(1);
  expect(api.events.some(event => event.type === 'completed')).toBe(false); expect(api.errors).toEqual([]);
});
