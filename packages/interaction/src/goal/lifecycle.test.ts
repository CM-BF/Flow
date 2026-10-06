import { expect, it } from 'vitest';
import { FlowApiError } from '@flow/client';
import { createGoalSession, type GoalIntent, type GoalIntentStore, type GoalSessionPort } from './index.js';
import type { GoalDeliveryRead, GoalDeliveryQuery } from '../../../contracts/src/goal-delivery.js';
const goalId = 'goal-a', nodeId = 'node-a';
const plan = { view: 'plan' as const, goalId, projectId: 'project-a', projectRevision: 1, planRef: 'a'.repeat(64), goalRef: { goalId }, totalNodes: 1, nodes: [{ id: nodeId, title: 'A', version: 1, parentId: null, dependsOn: [], inputRef: { goalId, nodeId, version: 1 } }], nextCursor: null };
const input = { goal: 'Exact input', constraints: '', acceptance: 'Text', verification: { kind: 'nonempty' as const } };
const command = { kind: 'goal' as const, input: { kind: 'define-input' as const, nodeId, expectedInputVersion: 1, input, reason: 'Explicit change' } };
const reply = { goalId, nodeId, inputVersion: 2, changed: true, replayed: false, explanation: { version: 2, kind: 'define-input' as const, text: 'Fixed input', createdAt: '2026-10-06T00:00:00Z', source: { projectRevision: 1, nodeId, inputVersion: 2 } } };
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; }
function memory(): GoalIntentStore { let saved: unknown = null; return { async load() { return structuredClone(saved); }, async save(_, value) { saved = structuredClone(value); } }; }
function port(overrides: Partial<GoalSessionPort> = {}): GoalSessionPort {
  return { async goalDelivery() { return structuredClone(plan); }, async commandGoal() { return structuredClone(reply); }, async changeProject() { throw Error('Unexpected project mutation'); }, async decide() { throw Error('Unexpected decision'); }, async cancel() { throw Error('Unexpected cancel'); }, async detail() { throw Error('Unexpected detail'); }, ...overrides };
}
const control = (client: GoalSessionPort, intents = memory()) => createGoalSession({ client, intents, goalId, connectionId: 'bounded-test' });
const body = (version: number) => ({ view: 'explanation' as const, reference: { goalId, version }, explanation: { ...reply.explanation, version }, historical: true as const });
it('bounds real reads to two active and four queued; disconnect prevents queued dispatch and late body commits', async () => {
  const deferredReads: { query: GoalDeliveryQuery; done: ReturnType<typeof deferred<GoalDeliveryRead>> }[] = [];
  const c = control(port({ async goalDelivery(_, query) { if (query.view === 'plan') return plan; const done = deferred<GoalDeliveryRead>(); deferredReads.push({ query, done }); return done.promise; } }));
  await c.initialize();
  const reads = Array.from({ length: 6 }, (_, i) => c.read({ kind: 'explanation', version: i + 1 }));
  const settled = Promise.allSettled(reads); expect(deferredReads).toHaveLength(2);
  await expect(c.read({ kind: 'explanation', version: 7 })).rejects.toThrow(/budget/);
  c.disconnect(); let disposed = false; const disposal = c.dispose().then(() => { disposed = true; });
  await Promise.resolve(); await Promise.resolve(); expect(disposed).toBe(false);
  deferredReads[0]!.done.resolve(body(1)); deferredReads[1]!.done.resolve(body(2));
  const results = await settled; await disposal;
  expect(results.filter(r => r.status === 'rejected')).toHaveLength(4); expect(deferredReads).toHaveLength(2);
  expect(c.snapshot().body).toBeNull(); expect(c.snapshot().connected).toBe(false);
});
it('does not send after disconnect interrupts persistence and recovers only through a new explicit call', async () => {
  let saved: GoalIntent | null = null, sends = 0;
  const gate = deferred<void>(); const intents: GoalIntentStore = { async load() { return saved; }, async save(_, value) { saved = value; await gate.promise; } };
  const c = control(port({ async commandGoal() { sends++; return reply; } }), intents); await c.initialize();
  const pending = c.command(command); c.disconnect(); const closing = c.dispose(); gate.resolve();
  expect((await pending).state).toBe('unknown'); await closing; expect(sends).toBe(0); expect(saved).not.toBeNull();
});
it('retains ambiguous receipts through auth/CAS rejection and retries the identical intent only on explicit recovery', async () => {
  const store = memory(), received: string[] = []; let mode = 0;
  const c = control(port({ async commandGoal(_, input, key) { received.push(JSON.stringify({ input, key })); if (mode === 0) throw Error('Unknown network result'); if (mode === 1) throw new FlowApiError(409, 'version_conflict', 'Now stale'); return { ...reply, replayed: true }; } }), store);
  await c.initialize(); expect((await c.command(command)).state).toBe('unknown'); mode = 1;
  expect((await c.recover()).state).toBe('unknown'); expect(c.snapshot().intent).not.toBeNull();
  mode = 2; expect((await c.recover()).state).toBe('acknowledged'); expect(new Set(received).size).toBe(1); expect(received).toHaveLength(3); await c.dispose();
});
it('keeps an acknowledged remote command recoverable when clearing local storage fails and isolates listener errors', async () => {
  let saved: GoalIntent | null = null, clearFails = true, sends = 0;
  const store: GoalIntentStore = { async load() { return saved; }, async save(_, next) { if (next === null && clearFails) throw Error('Disk unavailable'); saved = structuredClone(next); } };
  const c = control(port({ async commandGoal() { sends++; return { ...reply, replayed: sends > 1 }; } }), store);
  c.subscribe(() => { throw Error('Renderer failure'); }); await c.initialize();
  expect((await c.command(command)).state).toBe('unknown'); expect(saved).not.toBeNull();
  clearFails = false; expect((await c.recover()).state).toBe('acknowledged'); expect(saved).toBeNull(); expect(sends).toBe(2); await c.dispose();
});
it('rejects the wrong stored namespace and oversized intent before any mutation', async () => {
  let sends = 0;
  const client = port({ async commandGoal() { sends++; return reply; } });
  const store = memory(); const first = control(client, store); await first.initialize();
  // A valid command can still be too large after encoding; 199 dependency identities are bounded individually.
  const binding = { nodeId: 'x'.repeat(128), executionId: 'y'.repeat(128), taskId: 't'.repeat(128), artifactId: 'a'.repeat(128), artifactVersion: 'a'.repeat(64), detailId: 'd'.repeat(128) };
  expect(() => first.command({ kind: 'goal', input: { kind: 'execute', nodeId, expectedInputVersion: 1, previousExecutionId: null, reason: 'Bounded intent', fixture: { scenario: 'success' }, dependencies: Array.from({ length: 199 }, () => binding) } })).toThrow(/64 KiB/);
  await first.dispose();
  await store.save('', { version: 1, connectionId: 'another-connection', goalId, projectId: 'project-a', key: 'fixed', command });
  const wrong = control(client, store); await expect(wrong.initialize()).rejects.toThrow(/namespace/); expect(sends).toBe(0); await wrong.dispose();
});
it('rejects malformed or cross-goal reads without replacing the previously expanded immutable body', async () => {
  let invalid = false;
  const c = control(port({ async goalDelivery(_, query) { if (query.view === 'plan') return plan; return invalid ? { ...body(1), reference: { goalId: 'other-goal', version: 1 } } : body(1); } }));
  await c.initialize(); await c.read({ kind: 'explanation', version: 1 }); const original = c.snapshot().body; invalid = true;
  await expect(c.read({ kind: 'explanation', version: 1 })).rejects.toThrow(/identity/); expect(c.snapshot().body).toEqual(original); await c.dispose();
});
it('does not let an earlier observation repopulate state after a related plan change', async () => {
  let revision = 1;
  const held = deferred<GoalDeliveryRead>();
  const c = control(port({ async goalDelivery(_, query) {
    if (query.view === 'plan') return { ...plan, planRef: (revision === 1 ? 'a' : 'b').repeat(64), nodes: plan.nodes.map(n => ({ ...n, inputRef: { goalId, nodeId, version: revision } })) };
    return held.promise;
  } }));
  await c.initialize(); const observation = c.observe([nodeId]); revision = 2;
  const page = await c.plan(); page.nodes[0]!.title = 'Caller mutation';
  held.resolve({ view: 'state', goalId, projectId: plan.projectId, observedAt: '2026-10-06T00:00:00Z', nodes: [{ nodeId, inputRef: { goalId, nodeId, version: 1 }, knowledgeCurrent: true, dependenciesReady: true, execution: null, accepted: null, deliveryCurrent: false, reason: 'not-accepted' }] });
  await observation;
  expect(c.snapshot().state).toBeNull(); expect(c.snapshot().plan!.nodes[0]!.title).toBe('A'); await c.dispose();
});
