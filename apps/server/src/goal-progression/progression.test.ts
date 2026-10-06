import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { goalProgressionAuthorizationSchema } from '../../../../packages/contracts/src/goal-progression.js';
import type { ClaimedTask } from '../../../../packages/contracts/src/runner.js';
import type { ClaudeQuery } from '../../../runner/src/claude.js';
import { finalResult } from '../../../runner/src/goal-graph-tools/test-peer.js';
import { progressionFixture } from './fixture.js';

let f: Awaited<ReturnType<typeof progressionFixture>>;
beforeAll(async () => { f = await progressionFixture(); });
afterAll(async () => { await f?.close(); });
const query: ClaudeQuery = () => Object.assign((async function* () { yield { ...finalResult(randomUUID()), result: 'Fixed verified synthetic text.' }; })(), { close() {} });
const post = (goalId: string, input: unknown, key = randomUUID()) => f.http(`/api/goals/${goalId}/progressions`, input, key);
async function setup(options: Parameters<typeof f.goal>[1] = {}) { const harness = await f.harness(query); return { ...await f.goal(harness.pin, options), harness }; }
async function granted(options: Parameters<typeof f.goal>[1] = {}) {
  const s = await setup(options), response = await post(s.goalId, s.authorization); expect(response.status, JSON.stringify(response.body)).toBe(201);
  return { ...s, id: response.body.progression.id as string };
}
async function taskStatus(goalId: string, id: string, index: number, status: string) {
  await expect.poll(async () => (await f.read(goalId, id)).nodes[index]?.task?.status, { timeout: 10000, interval: 25 }).toBe(status);
  return f.read(goalId, id);
}
async function claim(s: Awaited<ReturnType<typeof granted>>) {
  let assignment: ClaimedTask | null = null;
  await expect.poll(async () => { assignment = (await f.http('/api/runner/claim', {}, randomUUID(), s.harness.runner.token)).body.assignment; return assignment?.task.id; }).toBe((await f.read(s.goalId, s.id)).nodes[0]!.task!.id);
  return assignment! as ClaimedTask;
}

it('bounds finite authorization, rejects duplicate nodes, excess budget, unknown policy and malformed expiry', async () => {
  const s = await setup();
  expect(goalProgressionAuthorizationSchema.safeParse(s.authorization).success).toBe(true);
  for (const change of [{ nodes: [...s.authorization.nodes, s.authorization.nodes[0]] }, { maxAdmissions: 3 }, { intermediatePolicy: 'qualified' }, { expiresAt: 'tomorrow' }, { extra: true }, { nodes: Array(21).fill(s.authorization.nodes[0]) }]) expect(goalProgressionAuthorizationSchema.safeParse({ ...s.authorization, ...change }).success).toBe(false);
  expect((await post(s.goalId, { ...s.authorization, expiresAt: new Date(Date.now() - 1).toISOString() })).status).toBe(409);
  expect((await post(s.goalId, { ...s.authorization, expiresAt: new Date(Date.now() + 90_000_000).toISOString() })).status).toBe(409);
});

it('continues two fixed inputs through injected SDK, restart and lost authorization ACK without semantic acceptance', async () => {
  const prompts: string[] = []; let calls = 0;
  const harness = await f.harness(({ prompt }) => Object.assign((async function* () { calls++; prompts.push(String(prompt)); yield { ...finalResult(randomUUID()), result: `Synthetic output ${calls}` }; })(), { close() {} }));
  const s = await f.goal(harness.pin); const path = `/api/goals/${s.goalId}/progressions`, key = randomUUID();
  f.loseReply(path); await expect(post(s.goalId, s.authorization, key)).rejects.toThrow();
  await f.restart(); const recovered = await post(s.goalId, s.authorization, key); expect(recovered.body.replayed).toBe(true);
  const id = recovered.body.progression.id;
  expect((await post(s.goalId, { ...s.authorization, reason: 'changed' }, key)).status).toBe(409);
  expect((await post(s.goalId, s.authorization)).body.error.code).toBe('progression_active');
  const concurrent = await Promise.all([f.sweep(), f.sweep(), f.sweep()]); expect(concurrent.flatMap(result => result.errors)).toEqual([]);
  expect((await f.read(s.goalId, id)).admissions).toBe(1);
  const first = await harness.start(); await taskStatus(s.goalId, id, 0, 'succeeded'); await first.close();
  await f.restart(); expect((await f.sweep()).admitted).toBe(1);
  const second = await harness.start(); const done = await taskStatus(s.goalId, id, 1, 'succeeded'); await second.close(); await f.sweep();
  expect(calls).toBe(2); expect(prompts[0]).toContain('Actual input 0'); expect(prompts[1]).toContain('Actual input 1'); expect(prompts[1]).toContain('Synthetic output 1');
  expect(prompts.join('\n')).not.toContain('TITLE IS NOT INPUT');
  expect((await f.read(s.goalId, id))).toMatchObject({ admissions: 2, state: 'finished', acceptance: 'separate-owner-decision' });
  const full = await f.owner().readGoal(s.goalId); const light = (await f.http(`/api/goals/${s.goalId}/delivery?view=state&${s.ids.map(id => `nodeIds=${encodeURIComponent(id)}`).join("&")}`)).body;
  expect(full.nodes.map(node => node.accepted)).toEqual([null, null]); expect(full.nodes[1]!.execution!.inputCurrent).toBe(true);
  expect(full.nodes[1]!.dependenciesReady).toBe(false); expect(light.nodes[1].execution.inputCurrent).toBe(true); expect(light.nodes[1].reason).toBe('not-accepted');
  const rejected = await f.http(`/api/goals/${s.goalId}/native-executions`, { nodeId: s.ids[1], expectedInputVersion: 1, dependencies: [done.nodes[0]!.artifact], previousExecutionId: done.nodes[1]!.executionId, reason: 'Legacy does not inherit grant', executionProfile: harness.pin });
  expect(rejected.body.error.code).toBe('dependency_version');
  const accepted = await f.owner().commandGoal(s.goalId, { kind: 'accept-delivery', nodeId: s.ids[1]!, executionId: done.nodes[1]!.executionId!, expectedCurrentExecutionId: null, reason: 'Independent actor explicitly accepts exact output.' }, randomUUID());
  expect(accepted.delivery).toEqual(done.nodes[1]!.artifact);
  expect((await f.owner().readGoal(s.goalId)).nodes[0]!.accepted).toBeNull();
  expect((await f.owner().readGoal(s.goalId)).nodes[1]!.deliveryCurrent).toBe(true);
  await f.owner().commandGoal(s.goalId, { kind: 'define-input', nodeId: s.ids[0]!, expectedInputVersion: 1, reason: 'Producer input changes after completion.', input: { goal: 'Changed producer', constraints: '', acceptance: 'Recheck', verification: { kind: 'nonempty' } } }, randomUUID());
  expect((await f.owner().readGoal(s.goalId)).nodes[1]).toMatchObject({ deliveryCurrent: false, execution: { inputCurrent: false } });
  expect((await f.http(`/api/details/${done.nodes[1]!.artifact!.detailId}`)).body.content).toBe('Synthetic output 2');
  f.facts.journey = { calls, nodes: done.nodes, lostAckSameKey: true, concurrentSweepAdmissions: concurrent.map(result => result.admitted), originalClientDisconnected: true, independentAcceptance: accepted.delivery };
});

it('halts failed verification without admitting its dependent and preserves the artifact', async () => {
  const s = await granted({ verification: 'failure' }); await f.sweep(); const runner = await s.harness.start();
  await taskStatus(s.goalId, s.id, 0, 'succeeded'); await runner.close(); await f.sweep();
  const view = await f.read(s.goalId, s.id); expect(view).toMatchObject({ state: 'blocked', cause: { code: 'verification-failed' }, admissions: 1 });
  expect(view.nodes[0]!.task?.verificationStatus).toBe('failed'); expect(view.nodes[1]!.executionId).toBeNull();
  const delivery = (await f.http(`/api/goals/${s.goalId}/delivery?view=state&nodeIds=${s.ids[0]}`)).body;
  const artifact = delivery.nodes[0].execution.artifact; expect(artifact).not.toBeNull();
  expect((await f.http(`/api/details/${artifact.detailId}`)).body).toMatchObject({ kind: 'artifact', content: 'Fixed verified synthetic text.' });
});

it('keeps unknown attempts and their links through restart without admitting a new execution', async () => {
  const s = await granted(); await f.sweep(); const assigned = await claim(s);
  await f.pool.query("UPDATE flow.attempts SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE id=$1", [assigned.attempt.id]);
  await taskStatus(s.goalId, s.id, 0, 'uncertain'); await f.sweep(); await f.restart(); await f.sweep();
  expect(await f.read(s.goalId, s.id)).toMatchObject({ state: 'blocked', cause: { code: 'execution-uncertain' }, admissions: 1 });
  expect((await f.http('/api/runner/claim', {}, randomUUID(), s.harness.runner.token)).body.assignment).toBeNull();
});

it('stops for a genuine decision and revocation never cancels that running task', async () => {
  const s = await granted(); await f.sweep(); const assignment = await claim(s), decisionId = randomUUID();
  const response = await f.http('/api/runner/events', { attemptId: assignment.attempt.id, ownerVersion: assignment.attempt.ownerVersion, events: [
    { id: randomUUID(), sequence: 1, type: 'session', nativeSessionId: randomUUID(), adapterVersion: '1' }, { id: randomUUID(), sequence: 2, type: 'decision', decisionId, prompt: 'Actual owner decision required.' },
  ] }, randomUUID(), s.harness.runner.token); expect(response.status, JSON.stringify(response.body)).toBe(200);
  await f.sweep(); expect(await f.read(s.goalId, s.id)).toMatchObject({ state: 'active', cause: { code: 'decision-required' }, admissions: 1 });
  expect((await f.read(s.goalId, s.id)).nodes[0]!.task!.decisionId).toBe(decisionId);
  const path = `/api/goals/${s.goalId}/progressions/${s.id}/revoke`, key = randomUUID(), body = { reason: 'Stop only new admissions.' };
  f.loseReply(path); await expect(f.http(path, body, key)).rejects.toThrow(); await f.restart(); expect((await f.http(path, body, key)).body.replayed).toBe(true);
  expect(await f.read(s.goalId, s.id)).toMatchObject({ state: 'revoked', admissions: 1 });
  expect((await f.http(`/api/tasks/${assignment.task.id}`)).body.status).toBe('waiting');
});

it('checks readonly profile revocation before any task is admitted', async () => {
  const s = await granted(); expect((await f.http(`/api/runners/${s.harness.runner.runnerId}/revoke`, {})).status).toBe(200);
  await f.sweep(); const view = await f.read(s.goalId, s.id); expect(view.state).toBe('blocked'); expect(view.admissions).toBe(0); expect(view.cause?.code).toMatch(/profile|runner/);
});

it('freezes graph and actual input versions and requires explicit replacement permission', async () => {
  for (const kind of ['input', 'graph'] as const) {
    const s = await granted();
    if (kind === 'input') await f.owner().commandGoal(s.goalId, { kind: 'define-input', nodeId: s.ids[0]!, expectedInputVersion: 1, reason: 'Changed actual input', input: { goal: 'Changed', constraints: '', acceptance: 'Different', verification: { kind: 'nonempty' } } }, randomUUID());
    else await f.owner().changeProject(s.projectId, { expectedRevision: s.snapshot.project.revision, reason: 'Changed graph', change: { kind: 'update-node', nodeId: s.ids[0]!, expectedNodeVersion: s.snapshot.graph.nodes[0]!.version, title: 'Changed title' } }, randomUUID());
    await f.sweep(); expect(await f.read(s.goalId, s.id)).toMatchObject({ state: 'blocked', cause: { code: kind === 'input' ? 'input-changed' : 'graph-changed' }, admissions: 0 });
  }
});

it('exhausts finite admission budget without silently extending the authorized work', async () => {
  const s = await setup(); s.authorization.maxAdmissions = 1; const accepted = await post(s.goalId, s.authorization); const id = accepted.body.progression.id;
  await f.sweep(); const runner = await s.harness.start(); await taskStatus(s.goalId, id, 0, 'succeeded'); await runner.close(); await f.sweep();
  expect(await f.read(s.goalId, id)).toMatchObject({ state: 'blocked', cause: { code: 'admission-budget-exhausted' }, admissions: 1 });
});

it('rolls back task/wake/link atomically and reuses the authorization after a transaction failure', async () => {
  const s = await granted({ count: 1 });
  await f.pool.query(`CREATE FUNCTION flow.o14_reject_link() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'O14 injected rollback'; END $$;
    CREATE TRIGGER o14_reject_link BEFORE INSERT ON flow.goal_progression_executions FOR EACH ROW EXECUTE FUNCTION flow.o14_reject_link()`);
  try { expect((await f.sweep()).errors).toHaveLength(1); expect((await f.read(s.goalId, s.id)).admissions).toBe(0);
    expect((await f.pool.query('SELECT id FROM flow.goal_executions WHERE goal_id=$1', [s.goalId])).rows).toEqual([]);
  } finally { await f.pool.query('DROP TRIGGER o14_reject_link ON flow.goal_progression_executions; DROP FUNCTION flow.o14_reject_link()'); }
  expect((await f.sweep()).admitted).toBe(1); expect((await f.read(s.goalId, s.id)).admissions).toBe(1);
});

it('preserves immutable authority and exact goal identity, while snapshots stay body-free', async () => {
  const s = await granted({ count: 1 }); const other = await setup({ count: 1 });
  expect((await f.http(`/api/goals/${other.goalId}/progressions/${s.id}`)).status).toBe(404);
  expect((await f.http(`/api/goals/${s.goalId}/progressions/${s.id}`, undefined, randomUUID(), s.harness.runner.token)).status).toBe(403);
  await expect(f.pool.query('UPDATE flow.goal_progressions SET manifest=$2 WHERE id=$1', [s.id, JSON.stringify({ ...s.authorization, maxAdmissions: 20 })])).rejects.toMatchObject({ code: '23514' });
  await expect(f.pool.query('DELETE FROM flow.goal_progressions WHERE id=$1', [s.id])).rejects.toMatchObject({ code: '23514' });
  const body = JSON.stringify(await f.read(s.goalId, s.id)); expect(body).not.toContain('Actual input'); expect(body).not.toContain('Synthetic output'); expect(Buffer.byteLength(body)).toBeLessThan(4000);
});

it('preserves execution failure and never retries an authorized node automatically', async () => {
  let calls = 0;
  const harness = await f.harness(() => Object.assign((async function* () { calls++; throw new Error('Bounded injected query failure'); yield finalResult(); })(), { close() {} }));
  const s = await f.goal(harness.pin), response = await post(s.goalId, s.authorization), id = response.body.progression.id;
  await f.sweep(); const runner = await harness.start(); await taskStatus(s.goalId, id, 0, 'failed'); await runner.close();
  await f.sweep(); await f.restart(); await f.sweep();
  expect(await f.read(s.goalId, id)).toMatchObject({ state: 'blocked', cause: { code: 'execution-failed' }, admissions: 1 }); expect(calls).toBe(1);
});

it('expires a finite authorization without creating a task or reviving it on restart', async () => {
  const s = await setup({ count: 1 }); s.authorization.expiresAt = new Date(Date.now() + 300).toISOString();
  const response = await post(s.goalId, s.authorization); expect(response.status).toBe(201); const id = response.body.progression.id;
  await new Promise(resolve => setTimeout(resolve, 350)); await f.sweep(); await f.restart();
  expect(await f.read(s.goalId, id)).toMatchObject({ state: 'expired', cause: { code: 'expired' }, admissions: 0 });
});

it('requires real accepted external dependencies and rejects a fabricated qualified binding', async () => {
  const s = await setup(); const selected = s.authorization.nodes[1]!;
  const input = { ...s.authorization, nodes: [selected], maxAdmissions: 1 };
  expect((await post(s.goalId, input)).body.error.code).toBe('dependency_version');
  const fake = { nodeId: s.ids[0], executionId: randomUUID(), taskId: randomUUID(), artifactId: randomUUID(), artifactVersion: 'a'.repeat(64), detailId: randomUUID() };
  expect((await post(s.goalId, { ...input, nodes: [{ ...selected, externalDependencies: [fake] }] })).body.error.code).toBe('dependency_version');
});
