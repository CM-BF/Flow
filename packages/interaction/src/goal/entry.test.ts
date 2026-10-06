import { expect, it } from 'vitest';
import { FlowApiError } from '@flow/client';
import { createGoalEntry, type GoalEntryStore } from './entry.js';
import type { GoalCreation, CreatedGoal } from '../../../contracts/src/goals.js';
const input: GoalCreation = { projectId: 'project', originalGoal: '请写一段发布说明', constraints: 'Only readonly text', acceptance: 'An owner reviews the exact result' };
const receipt: CreatedGoal = { goal: { ...input, id: 'goal', createdAt: '2026-10-06T00:00:00Z' }, replayed: false };
function memory(): GoalEntryStore { let data: unknown = null; return { async load() { return structuredClone(data); }, async save(_, value) { data = structuredClone(value); } }; }
function entry(store = memory(), createGoal = async () => receipt) {
  return createGoalEntry({ connectionId: 'center', entryId: 'entry', store, client: { createGoal }, makeKey: () => 'stable' });
}
it('persists exact natural-language input before creating and restores the accepted goal without a second request', async () => {
  const store = memory(); let calls = 0;
  const first = entry(store, async () => { calls++; expect(await store.load('')).toMatchObject({ input, key: 'stable', goalId: null }); return receipt; });
  await first.initialize(); expect((await first.submit(input)).state).toBe('bound'); expect(first.snapshot().goalId).toBe('goal'); await first.dispose();
  const next = entry(store, async () => { calls++; return receipt; }); await next.initialize(); expect(next.snapshot().goalId).toBe('goal'); expect(calls).toBe(1);
  expect(() => next.submit(input)).toThrow(/bound/); await next.dispose();
});
it('lost ACK and recovered CAS rejection preserve original body/key through restart and explicit recovery only', async () => {
  const store = memory(); const sent: string[] = []; let mode = 0;
  const client = { async createGoal(body: GoalCreation, key: string) { sent.push(JSON.stringify({ body, key })); if (mode === 0) throw Error('Lost ACK'); if (mode === 1) throw new FlowApiError(409, 'goal_exists', 'Existing goal'); return { ...receipt, replayed: true }; } };
  const create = () => createGoalEntry({ connectionId: 'center', entryId: 'entry', store, client, makeKey: () => 'stable' });
  const first = create(); await first.initialize(); expect((await first.submit(input)).state).toBe('unknown'); expect(() => first.submit({ ...input, originalGoal: 'Changed' })).toThrow(/unresolved/); await first.dispose();
  const next = create(); await next.initialize(); expect(sent).toHaveLength(1); mode = 1; expect((await next.recover()).state).toBe('unknown');
  mode = 2; expect((await next.recover()).state).toBe('bound'); expect(sent).toHaveLength(3); expect(new Set(sent).size).toBe(1); await next.dispose();
});
it('refuses mismatched accepted input and retains unknown when the accepted binding cannot be persisted', async () => {
  let saved: unknown = null, failBound = false, wrong = true, calls = 0;
  const store: GoalEntryStore = { async load() { return saved; }, async save(_, value) { if (value?.goalId && failBound) throw Error('Disk failed'); saved = structuredClone(value); } };
  const c = entry(store, async () => { calls++; return wrong ? { ...receipt, goal: { ...receipt.goal, originalGoal: 'Other goal' } } : receipt; });
  await c.initialize(); expect((await c.submit(input)).state).toBe('unknown'); expect(c.snapshot().goalId).toBeNull();
  wrong = false; failBound = true; expect((await c.recover()).state).toBe('unknown'); expect(c.snapshot().goalId).toBeNull();
  failBound = false; expect((await c.recover()).state).toBe('bound'); expect(calls).toBe(3); await c.dispose();
});
it('does not dispatch before durable storage or after disconnect while storage is pending', async () => {
  let release!: () => void; const gate = new Promise<void>(r => { release = r; }); let calls = 0, saved: unknown = null;
  const store: GoalEntryStore = { async load() { return saved; }, async save(_, value) { saved = value; await gate; } };
  const c = entry(store, async () => { calls++; return receipt; }); await c.initialize(); const pending = c.submit(input); c.disconnect(); release();
  expect((await pending).state).toBe('unknown'); await c.dispose(); expect(calls).toBe(0); expect(saved).not.toBeNull();
});
it('validates stored namespace and bounded input before any request', async () => {
  let calls = 0; const store = memory(); await store.save('', { version: 1, connectionId: 'other', entryId: 'entry', key: 'stable', input, goalId: null });
  const c = entry(store, async () => { calls++; return receipt; }); await expect(c.initialize()).rejects.toThrow(/namespace/); await c.dispose(); expect(calls).toBe(0);
  const fresh = entry(); await fresh.initialize(); expect(() => fresh.submit({ ...input, originalGoal: 'x'.repeat(4001) })).toThrow(); await fresh.dispose();
});
it('clears only definite first-send rejection and never interprets abort as goal cancellation', async () => {
  const c = entry(memory(), async () => { throw new FlowApiError(409, 'goal_exists', 'Exists'); }); await c.initialize(); expect((await c.submit(input)).state).toBe('rejected'); expect(c.snapshot().intent).toBeNull(); await c.dispose();
  let aborted = false;
  const d = createGoalEntry({ connectionId: 'center', entryId: 'e', store: memory(), client: { async createGoal(_, __, signal) { return new Promise<CreatedGoal>((_, reject) => signal!.addEventListener('abort', () => { aborted = true; reject(Error('aborted')); }, { once: true })); } } });
  await d.initialize(); const pending = d.submit(input); await Promise.resolve(); await Promise.resolve(); d.disconnect(); expect((await pending).state).toBe('unknown'); await d.dispose(); expect(aborted).toBe(true);
});

import { createGoalSession, type GoalSessionPort, type GoalIntent, type GoalIntentStore, type GoalPlanningInput } from './index.js';
const profile = { id: '00000000-0000-4000-8000-000000000001', runnerId: '00000000-0000-4000-8000-000000000002', configDigest: 'a'.repeat(64) };
const planning: GoalPlanningInput = { prompt: 'Plan bounded text work', execution: { harness: 'claude', executionProfile: profile }, scope: { baseRevision: 1, allowedExistingNodes: [], maxProposals: 1, maxApplications: 1, maxNewNodes: 3, maxNewEdges: 2 } };
const task = { id: 'task', title: 'Planning', harness: 'claude' as const, status: 'queued' as const, verificationStatus: 'pending' as const, createdAt: '2026-10-06T00:00:00Z', updatedAt: '2026-10-06T00:00:00Z' };
const plan = { view: 'plan' as const, goalId: 'goal', projectId: 'project', projectRevision: 1, planRef: 'a'.repeat(64), goalRef: { goalId: 'goal' }, totalNodes: 1, nodes: [{ id: 'node', title: 'A', version: 1, parentId: null, dependsOn: [], inputRef: { goalId: 'goal', nodeId: 'node', version: 1 } }], nextCursor: null };
const graphReceipt = { run: { id: 'run', version: 1 as const, goalId: 'goal', projectId: 'project', taskId: task.id, mode: 'claude' as const, goalDigest: 'b'.repeat(64), scope: planning.scope, usedCommands: 0, usedProposals: 0, usedApplications: 0, createdAt: task.createdAt, revokedAt: null, revocationReason: null }, task, replayed: false };
const execution = { nodeId: 'node', expectedInputVersion: 1, dependencies: [], previousExecutionId: null, reason: 'Explicit input', executionProfile: profile };
const nativeReceipt = { goalId: 'goal', nodeId: 'node', inputVersion: 1, executionId: 'execution', task, executionProfile: profile, changed: true, replayed: false,
  explanation: { version: 2, kind: 'execute' as const, text: 'Authorized', createdAt: task.createdAt, source: { projectRevision: 1, nodeId: 'node', executionId: 'execution', inputVersion: 1 } } };
function controller(extra: Partial<GoalSessionPort> = {}) {
  let saved: GoalIntent | null = null;
  const intents: GoalIntentStore = { async load() { return saved; }, async save(_, value) { saved = structuredClone(value); } };
  const client: GoalSessionPort = { async goalDelivery(_, query) { if (query.view === 'plan') return plan; if (query.view === 'state') return { view: 'state', goalId: 'goal', projectId: 'project', observedAt: task.createdAt, nodes: [{ nodeId: 'node', inputRef: { goalId: 'goal', nodeId: 'node', version: 1 }, knowledgeCurrent: true, dependenciesReady: true, execution: null, accepted: null, deliveryCurrent: false, reason: 'not-accepted' }] }; throw Error('Unexpected body read'); }, async commandGoal() { throw Error('Unexpected mutation'); }, async changeProject() { throw Error('Unexpected mutation'); }, async decide() { throw Error('Unexpected decision'); }, async cancel() { throw Error('Unexpected cancellation'); }, async detail() { throw Error('Unexpected body'); }, ...extra };
  return createGoalSession({ client, intents, goalId: 'goal', connectionId: 'center', makeKey: () => 'stable-action' });
}
it('new commands preserve old clients and require explicitly observed input instead of graph titles', async () => {
  const c = controller(); await c.initialize();
  expect(() => c.command({ kind: 'graph-plan', input: planning })).toThrow(/not available/); expect(c.snapshot().intent).toBeNull();
  const native = controller({ async executeGoalNative() { return nativeReceipt; } }); await native.initialize();
  expect(() => native.command({ kind: 'native-execute', input: execution })).toThrow(/actual input/);
  expect(() => native.command({ kind: 'graph-plan', input: { ...planning, execution: { harness: 'fixture' } } as any })).toThrow();
  await c.dispose(); await native.dispose();
});
it('new planning command keeps malformed receipt unknown and replays only the original input/key', async () => {
  let bad = true; const sent: string[] = [];
  const c = controller({ async admitGoalGraphRun(goalId, body, key) { sent.push(JSON.stringify({ goalId, body, key })); return bad ? { ...graphReceipt, run: { ...graphReceipt.run, taskId: 'different-task' } } : graphReceipt; } });
  await c.initialize(); expect((await c.command({ kind: 'graph-plan', input: planning })).state).toBe('unknown');
  expect(() => c.command({ kind: 'graph-plan', input: planning })).toThrow(/existing command/); bad = false;
  expect((await c.recover()).state).toBe('acknowledged'); expect(new Set(sent).size).toBe(1); expect(sent).toHaveLength(2); await c.dispose();
});
it('new native command binds goal, input, execution and exact profile receipt before clearing intent', async () => {
  let wrong = true, count = 0;
  const c = controller({ async executeGoalNative() { count++; return wrong ? { ...nativeReceipt, executionProfile: { ...profile, configDigest: 'b'.repeat(64) } } : nativeReceipt; } });
  await c.initialize(); await c.observe(['node']); expect((await c.command({ kind: 'native-execute', input: execution })).state).toBe('unknown');
  wrong = false; expect((await c.recover()).state).toBe('acknowledged'); expect(count).toBe(2); await c.dispose();
});
it('new planning read is bounded and validates goal, task mode and advancing cursors without fetching bodies', async () => {
  const run = { id: 'run', version: 1 as const, goalId: 'goal', projectId: 'project', goalDigest: 'b'.repeat(64), baseRevision: 1, mode: 'claude' as const, task, createdAt: task.createdAt, revokedAt: null };
  let page = { goalId: 'goal', projectId: 'project', runs: [run], nextCursor: null as string | null };
  const c = controller({ async goalGraphRuns() { return page; } }); await c.initialize(); await c.planning({ limit: 1 }); const prior = c.snapshot().planning;
  page = { ...page, goalId: 'other' }; await expect(c.planning()).rejects.toThrow(/identity/); expect(c.snapshot().planning).toEqual(prior);
  page = { ...page, goalId: 'goal', runs: [run, run] }; await expect(c.planning({ limit: 1 })).rejects.toThrow();
  page = { ...page, runs: [run], nextCursor: 'unchanged' }; await expect(c.planning({ after: 'unchanged' })).rejects.toThrow(/advance/); await c.dispose();
});
it('new planning intent applies the existing 64 KiB UTF-8 limit before dispatch', async () => {
  let calls = 0; const c = controller({ async admitGoalGraphRun() { calls++; return graphReceipt; } }); await c.initialize();
  const allowedExistingNodes = Array.from({ length: 200 }, (_, n) => ({ nodeId: String(n) + '漢'.repeat(120), expectedVersion: 1 }));
  expect(() => c.command({ kind: 'graph-plan', input: { ...planning, scope: { ...planning.scope, allowedExistingNodes } } })).toThrow(/64 KiB/); expect(calls).toBe(0); await c.dispose();
});
