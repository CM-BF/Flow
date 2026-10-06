import { randomUUID, createHash } from 'node:crypto';
import { mkdtemp, readFile, writeFile, rename, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import type { FlowClient } from '../../../../packages/client/src/index.js';
import { createGoalSession, type GoalSessionPort, type GoalIntentStore, type GoalIntent } from '../../../../packages/interaction/src/goal/index.js';
import { publicGoalFixture, goalInput, save } from './test-support.js';
const f = publicGoalFixture('session');
function memory(): GoalIntentStore { let value: unknown = null; return { async load() { return structuredClone(value); }, async save(_, next) { value = structuredClone(next); } }; }
function port(client: FlowClient, overrides: Partial<GoalSessionPort> = {}): GoalSessionPort {
  return { goalDelivery: client.goalDelivery.bind(client), commandGoal: client.commandGoal.bind(client), changeProject: client.changeProject.bind(client), decide: client.decide.bind(client), cancel: client.cancel.bind(client), detail: client.detail.bind(client), ...overrides };
}
function session(goalId: string, client = port(f.client()), intents = memory()) { return createGoalSession({ client, goalId, connectionId: 'private-loopback', intents }); }
const define = (nodeId: string, expectedInputVersion = 1) => ({ kind: 'goal' as const, input: { kind: 'define-input' as const, nodeId, expectedInputVersion, input: goalInput('PRIVATE_MATERIAL replacement'), reason: 'Owner versioned change' } });
it('shares one goal across two clients, keeps material reads explicit and rejects stale input/project writes without retry', async () => {
  const s = await f.setup(), one = session(s.goalId), two = session(s.goalId); const [a, b] = s.nodes;
  try {
    await Promise.all([one.initialize(), two.initialize()]);
    const body = await one.read({ kind: 'input', nodeId: a, version: 1 });
    const start = f.requests.length;
    await one.observe([a, b]); await one.observe([a, b]);
    const refresh = f.requests.slice(start); expect(refresh).toHaveLength(2); expect(refresh.every(r => !r.materials)).toBe(true);
    expect(one.snapshot().body).toEqual(body);
    expect((await one.command(define(a))).state).toBe('acknowledged');
    const beforeConflict = f.requests.filter(r => r.method === 'POST').length;
    const conflict = await two.command(define(a)); expect(conflict.state).toBe('rejected');
    expect(f.requests.filter(r => r.method === 'POST').length - beforeConflict).toBe(1);
    expect(two.snapshot().intent).toBeNull(); expect(two.snapshot().plan!.nodes.find(n => n.id === a)!.inputRef!.version).toBe(2);
    expect(one.snapshot().body).toEqual(body);
    const historical = await two.read({ kind: 'input', nodeId: a, version: 1 }); expect(historical).toMatchObject({ stale: true, currentVersion: 2 });
    const revision = one.snapshot().plan!.projectRevision;
    expect((await one.command({ kind: 'project', input: { expectedRevision: revision, reason: 'Explicit graph change', change: { kind: 'add-node', title: 'C', parent: null, taskId: null } } })).state).toBe('acknowledged');
    const graphConflict = await two.command({ kind: 'project', input: { expectedRevision: revision, reason: 'Conflicting stale graph', change: { kind: 'add-node', title: 'D', parent: null, taskId: null } } });
    expect(graphConflict.state).toBe('rejected'); expect(two.snapshot().plan!.totalNodes).toBe(3);
    await save('two-client', { refresh, explicitMaterialReads: 1, staleInput: conflict.state, staleProject: graphConflict.state, replacementCommands: 0, oldBodyRetained: true });
  } finally { await Promise.all([one.dispose(), two.dispose()]); }
});
it('recovers a committed lost ACK with the original frozen key/body after controller and center restart', async () => {
  const s = await f.setup(), dir = await mkdtemp(join(tmpdir(), 'flow-o12-store-'));
  const file = join(dir, 'intent.json');
  const store: GoalIntentStore = { async load() { try { return JSON.parse(await readFile(file, 'utf8')); } catch (e) { if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null; throw e; } }, async save(_, value) { await writeFile(file + '.tmp', JSON.stringify(value)); await rename(file + '.tmp', file); } };
  const requests: { key: string; body: string }[] = []; const c = f.client();
  const one = session(s.goalId, port(c, { async commandGoal(id, input, key, signal) { requests.push({ key, body: JSON.stringify(input) }); await c.commandGoal(id, input, key, signal); throw Error('Committed response was lost'); } }), store);
  let two: ReturnType<typeof session> | undefined;
  try {
    await one.initialize(); const command = define(s.nodes[0]);
    const pending = one.command(command); command.input.input.goal = 'Mutated caller data must not change the durable request';
    expect((await pending).state).toBe('unknown');
    const stored = await store.load(''); expect((stored as GoalIntent).command).toEqual(define(s.nodes[0]));
    expect(() => one.command(define(s.nodes[1]))).toThrow(/existing command/);
    await one.dispose(); await f.restart(); const resumed = f.client();
    two = session(s.goalId, port(resumed, { async commandGoal(id, input, key, signal) { requests.push({ key, body: JSON.stringify(input) }); return resumed.commandGoal(id, input, key, signal); } }), store);
    await two.initialize(); expect(requests).toHaveLength(1); expect(two.snapshot().commandState).toBe('unknown');
    const result = await two.recover(); expect(result).toMatchObject({ state: 'acknowledged', receipt: { replayed: true, inputVersion: 2 } });
    expect(requests[1]).toEqual(requests[0]); expect(await store.load('')).toBeNull();
    const history = await two.history(); expect(history.throughVersion).toBe(4);
    await save('lost-ack', { sameKeyAndBody: requests[0]!.key === requests[1]!.key && requests[0]!.body === requests[1]!.body, requestCount: requests.length, replayed: true, inputVersion: 2, explanationCount: history.throughVersion, restart: ['controller', 'center'], automaticResend: false });
  } finally { await one.dispose(); await two?.dispose(); await rm(dir, { recursive: true, force: true }); }
});
it('keeps failed local persistence and malformed committed receipts unresolved without issuing a replacement', async () => {
  const s = await f.setup(), client = f.client(); let stored: GoalIntent | null = null, failSave = true, sends = 0;
  const store: GoalIntentStore = { async load() { return stored; }, async save(_, value) { stored = structuredClone(value); if (failSave) throw Error('Storage ACK missing'); } };
  const control = session(s.goalId, port(client, { async commandGoal(...args) { sends++; return client.commandGoal(...args); } }), store);
  try {
    await control.initialize(); expect((await control.command(define(s.nodes[0]))).state).toBe('unknown'); expect(sends).toBe(0);
    expect(control.snapshot().intent).not.toBeNull(); expect(() => control.command(define(s.nodes[1]))).toThrow();
    failSave = false; expect((await control.recover()).state).toBe('acknowledged'); expect(sends).toBe(1);
  } finally { await control.dispose(); }
  const corruptStore = memory(); const bad = session(s.goalId, port(client, { async commandGoal(...args) { const receipt = await client.commandGoal(...args); return { ...receipt, nodeId: s.nodes[0] }; } }), corruptStore);
  try { await bad.initialize(); expect((await bad.command(define(s.nodes[1]))).state).toBe('unknown'); expect(bad.snapshot().intent).not.toBeNull(); } finally { await bad.dispose(); }
  const recovered = session(s.goalId, port(client), corruptStore);
  try { await recovered.initialize(); expect((await recovered.recover()).state).toBe('acknowledged'); } finally { await recovered.dispose(); }
});
async function peer(taskId: string) {
  const registration = (await f.http('/api/runners', { name: 'O12 public deterministic peer', harnesses: ['fixture'], capacity: 1 })).body;
  let assignment: any;
  for (let i = 0; i < 30 && !assignment; i++) { assignment = (await f.http('/api/runner/claim', {}, registration.token)).body.assignment; if (!assignment) await new Promise(r => setTimeout(r, 30)); }
  expect(assignment?.task.id).toBe(taskId); let sequence = 0;
  return { async emit(...events: unknown[]) { const response = await f.http('/api/runner/events', { attemptId: assignment.attempt.id, ownerVersion: assignment.attempt.ownerVersion, events: events.map(e => ({ ...(e as object), id: randomUUID(), sequence: ++sequence })) }, registration.token); expect(response.status).toBe(200); } };
}
it('observes decision and fixed artifact separately, while disconnect leaves the execution running and cancel only requests stopping', async () => {
  const s = await f.setup(), client = f.client(), control = session(s.goalId); const a = s.nodes[0];
  const run = { kind: 'goal' as const, input: { kind: 'execute' as const, nodeId: a, expectedInputVersion: 1, dependencies: [], previousExecutionId: null, reason: 'Explicit fixture only', fixture: { scenario: 'success' as const } } };
  await control.initialize(); const accepted = await control.command(run); expect(accepted.state).toBe('acknowledged');
  const taskId = (accepted as any).receipt.task.id as string; const worker = await peer(taskId), decisionId = randomUUID();
  await worker.emit({ type: 'decision', decisionId, prompt: 'PRIVATE_MATERIAL decision body' });
  const waiting = await control.observe([a]); expect(JSON.stringify(waiting)).not.toContain('PRIVATE_MATERIAL');
  expect(await control.read({ kind: 'decision', nodeId: a, taskId, decisionId })).toMatchObject({ pending: true, prompt: 'PRIVATE_MATERIAL decision body' });
  expect((await control.command({ kind: 'decision', nodeId: a, taskId, input: { decisionId, answer: 'approve' } })).state).toBe('acknowledged');
  control.disconnect(); await control.dispose(); expect((await client.show(taskId)).status).toBe('running');
  const resumed = session(s.goalId); await resumed.initialize(); await resumed.observe([a]);
  expect((await resumed.command({ kind: 'cancel', nodeId: a, taskId })).state).toBe('acknowledged');
  expect((await resumed.observe([a])).nodes[0]!.execution!.task.status).toBe('cancel_requested');
  await worker.emit({ type: 'completed', outcome: 'cancelled' }); await resumed.dispose();
  const finished = session(s.goalId); await finished.initialize();
  const next = await finished.command({ ...run, input: { ...run.input, previousExecutionId: (accepted as any).receipt.executionId } }); expect(next.state).toBe('acknowledged');
  const nextId = (next as any).receipt.task.id; const nextPeer = await peer(nextId); const content = 'PRIVATE_MATERIAL verified output';
  const artifactId = randomUUID(), version = createHash('sha256').update(content).digest('hex');
  const inputDigest = createHash('sha256').update(JSON.stringify({ artifactVersion: version, rule: { kind: 'nonempty' } })).digest('hex');
  await nextPeer.emit({ type: 'artifact', artifactId, version, title: 'Exact output', mediaType: 'text/plain', content }, { type: 'verification', artifactId, artifactVersion: version, verifierId: 'flow.text', verifierVersion: '1', inputDigest, result: 'passed', evidence: 'deterministic public peer' }, { type: 'completed', outcome: 'succeeded' });
  const state = await finished.observe([a]); expect(state.nodes[0]).toMatchObject({ accepted: null, deliveryCurrent: false });
  expect(await finished.read({ kind: 'artifact', binding: state.nodes[0]!.execution!.artifact! })).toMatchObject({ content });
  await save('decision-cancel-artifact', { disconnectStatus: 'running', cancelAckStatus: 'cancel_requested', terminalFromPeer: 'cancelled', exactArtifactDigest: version, mechanicalPassed: true, semanticAcceptance: null, peer: 'HTTP fixture event producer, no native query' });
  await finished.dispose();
});
