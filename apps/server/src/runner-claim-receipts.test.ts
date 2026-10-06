import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import { ClaimCenterFixture } from '../../../docs/evidence/s01p07/pg-fixture.js';
import { RUNNER_CLAIM_PROTOCOL, type RunnerClaimResponse } from '@flow/contracts';
import { runRunner } from '../../runner/src/runtime.js';
import { textDigest } from '../../runner/src/verifier.js';

const center = new ClaimCenterFixture();
beforeAll(() => center.start(), 120000);
afterAll(() => center.close(), 80000);
beforeEach(async () => { await center.pool.query("UPDATE flow.tasks SET dispatch_ready=false WHERE status='queued'"); });
function assigned(value: RunnerClaimResponse) { if (value.state !== 'assigned') throw new Error(`Expected assigned, received ${value.state}.`); return value; }
async function attempts(taskId: string) { return (await center.pool.query('SELECT id,owner_version,lease_expires_at FROM flow.attempts WHERE task_id=$1', [taskId])).rows; }
async function receipts(runnerId: string) { return (await center.pool.query('SELECT key,response FROM flow.commands WHERE operation=$1', [`${RUNNER_CLAIM_PROTOCOL}:${runnerId}`])).rows; }

it('binds self identity to bearer authority and persists no receipt for twelve empty observations or legacy empty claims', async () => {
  const runner = await center.runner(), input = center.opportunity(runner.runnerId);
  expect(await runner.client.runnerIdentity()).toEqual({ protocol: RUNNER_CLAIM_PROTOCOL, runnerId: runner.runnerId });
  await expect(center.owner.runnerIdentity()).rejects.toMatchObject({ status: 403, code: 'wrong_role' });
  await expect(runner.client.claimOpportunity({ ...input, runnerId: 'another-runner' })).rejects.toMatchObject({ status: 403 });
  for (let index = 0; index < 12; index++) expect(await runner.client.claimOpportunity(input)).toEqual({ ...input, state: 'empty' });
  expect(await runner.client.claimOpportunityStatus(input)).toEqual({ ...input, state: 'missing' });
  expect(await runner.client.claim()).toEqual({ assignment: null, remainingLeaseMs: 0 });
  expect(await receipts(runner.runnerId)).toEqual([]);
});

it('serializes concurrent requests for one key into one attempt and one resume-session occupation', async () => {
  const runner = await center.runner(), input = center.opportunity(runner.runnerId), sessionId = randomUUID();
  await center.pool.query('INSERT INTO flow.sessions(id,harness,runner_id) VALUES($1,$2,$3)', [sessionId, 'fixture', runner.runnerId]);
  const taskId = await center.submit({ resumeSessionId: sessionId });
  const replies = await Promise.all(Array.from({ length: 6 }, () => runner.client.claimOpportunity(input)));
  const first = assigned(replies[0]!);
  expect(replies.map(value => assigned(value).identity)).toEqual(Array(6).fill(first.identity));
  expect(first.identity.taskId).toBe(taskId); expect(await attempts(taskId)).toHaveLength(1);
  expect((await center.pool.query('SELECT active_task_id FROM flow.sessions WHERE id=$1', [sessionId])).rows).toEqual([{ active_task_id: taskId }]);
  expect(await receipts(runner.runnerId)).toEqual([{ key: input.requestId, response: first.identity }]);
  expect((await runner.client.claimOpportunity(center.opportunity(runner.runnerId))).state).toBe('empty');
  expect((await runner.client.claimOpportunityStatus(input)).state).toBe('assigned');
});

it('separates the same request UUID by authenticated runner and cannot read a different runner receipt', async () => {
  const first = await center.runner(), second = await center.runner(), key = randomUUID();
  const a = center.opportunity(first.runnerId, key), b = center.opportunity(second.runnerId, key);
  const taskA = await center.submit(), receiptA = assigned(await first.client.claimOpportunity(a));
  await expect(second.client.claimOpportunityStatus(a)).rejects.toMatchObject({ status: 403 });
  expect((await second.client.claimOpportunityStatus(b)).state).toBe('missing');
  const taskB = await center.submit(), receiptB = assigned(await second.client.claimOpportunity(b));
  expect(receiptA.identity.taskId).toBe(taskA); expect(receiptB.identity.taskId).toBe(taskB);
  expect(receiptA.identity.attemptId).not.toBe(receiptB.identity.attemptId);
  expect(await receipts(first.runnerId)).toHaveLength(1); expect(await receipts(second.runnerId)).toHaveLength(1);
});

it('rolls allocation, session occupation and compact receipt back together after a post-insert failure', async () => {
  const runner = await center.runner(), input = center.opportunity(runner.runnerId), sessionId = randomUUID();
  await center.pool.query('INSERT INTO flow.sessions(id,harness,runner_id) VALUES($1,$2,$3)', [sessionId, 'fixture', runner.runnerId]);
  const taskId = await center.submit({ resumeSessionId: sessionId });
  // Test-only private DB injection after the receipt INSERT; no product hook or schema change.
  await center.pool.query(`CREATE FUNCTION flow.s01p07_fail_receipt() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
    IF NEW.operation LIKE 'flow.runner-claim.v2:%' THEN RAISE EXCEPTION 'synthetic receipt rollback' USING ERRCODE='23514'; END IF; RETURN NEW; END $$;
    CREATE TRIGGER s01p07_fail_receipt AFTER INSERT ON flow.commands FOR EACH ROW EXECUTE FUNCTION flow.s01p07_fail_receipt()`);
  try {
    await expect(runner.client.claimOpportunity(input)).rejects.toMatchObject({ status: 500 });
    expect(await receipts(runner.runnerId)).toEqual([]); expect(await attempts(taskId)).toEqual([]);
    expect((await center.pool.query('SELECT status,owner_version,current_attempt_id FROM flow.tasks WHERE id=$1', [taskId])).rows).toEqual([{ status: 'queued', owner_version: 0, current_attempt_id: null }]);
    expect((await center.pool.query('SELECT active_task_id FROM flow.sessions WHERE id=$1', [sessionId])).rows).toEqual([{ active_task_id: null }]);
  } finally { await center.pool.query('DROP TRIGGER s01p07_fail_receipt ON flow.commands; DROP FUNCTION flow.s01p07_fail_receipt()'); }
  expect(assigned(await runner.client.claimOpportunity(input)).identity.taskId).toBe(taskId); expect(await attempts(taskId)).toHaveLength(1);
});

it('looks up committed allocation before maintenance/capacity, preserves current lease without renewal, and rejects revoke', async () => {
  const runner = await center.runner(), input = center.opportunity(runner.runnerId);
  const taskId = await center.submit(), allocated = assigned(await runner.client.claimOpportunity(input));
  const before = (await attempts(taskId))[0].lease_expires_at;
  const state = await center.owner.runnerMaintenance(runner.runnerId);
  await center.owner.drainRunner(runner.runnerId, { version: state.version, operationId: randomUUID(), reason: 'bounded test' }, randomUUID());
  expect(assigned(await runner.client.claimOpportunity(input)).identity).toEqual(allocated.identity);
  expect((await runner.client.claimOpportunity(center.opportunity(runner.runnerId))).state).toBe('empty');
  expect(assigned(await runner.client.claimOpportunityStatus(input)).remainingLeaseMs).toBeLessThanOrEqual(allocated.remainingLeaseMs);
  expect((await attempts(taskId))[0].lease_expires_at).toEqual(before);
  expect((await runner.client.heartbeat({ attemptId: allocated.identity.attemptId, ownerVersion: allocated.identity.ownerVersion })).action).toBe('continue');
  await center.owner.revokeRunner(runner.runnerId);
  await expect(runner.client.runnerIdentity()).rejects.toMatchObject({ status: 401 });
  await expect(runner.client.claimOpportunityStatus(input)).rejects.toMatchObject({ status: 401 });
});

it('returns only historical identity after expiry, completed cancellation or a stale owner, never a new attempt', async () => {
  const runner = await center.runner(3);
  const taskId = await center.submit(), input = center.opportunity(runner.runnerId), allocation = assigned(await runner.client.claimOpportunity(input));
  await center.pool.query("UPDATE flow.attempts SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE id=$1", [allocation.identity.attemptId]);
  expect(await runner.client.claimOpportunity(input)).toEqual({ ...input, state: 'unavailable', identity: allocation.identity, reason: 'not-executable' });
  expect(await attempts(taskId)).toHaveLength(1);
  const next = await center.submit(), cancelKey = center.opportunity(runner.runnerId), cancelled = assigned(await runner.client.claimOpportunity(cancelKey));
  await center.owner.cancel(next, randomUUID());
  expect((await runner.client.heartbeat({ attemptId: cancelled.identity.attemptId, ownerVersion: cancelled.identity.ownerVersion })).action).toBe('cancel');
  await runner.client.report({ attemptId: cancelled.identity.attemptId, ownerVersion: cancelled.identity.ownerVersion,
    events: [{ id: randomUUID(), sequence: 1, type: 'completed', outcome: 'cancelled' }] });
  expect((await runner.client.claimOpportunityStatus(cancelKey)).state).toBe('unavailable');
  const staleTask = await center.submit(), staleKey = center.opportunity(runner.runnerId); assigned(await runner.client.claimOpportunity(staleKey));
  await center.pool.query('UPDATE flow.tasks SET owner_version=owner_version+1 WHERE id=$1', [staleTask]);
  expect((await runner.client.claimOpportunityStatus(staleKey)).state).toBe('unavailable'); expect(await attempts(staleTask)).toHaveLength(1);
});

it('keeps the first nonempty receipt through a real server restart and reuses the original v1 allocation filters', async () => {
  const owner = await center.runner(), stranger = await center.runner(), sessionId = randomUUID();
  await center.pool.query('INSERT INTO flow.sessions(id,harness,runner_id) VALUES($1,$2,$3)', [sessionId, 'fixture', owner.runnerId]);
  const taskId = await center.submit({ resumeSessionId: sessionId });
  expect((await stranger.client.claimOpportunity(center.opportunity(stranger.runnerId))).state).toBe('empty');
  expect((await stranger.client.claim()).assignment).toBeNull();
  const input = center.opportunity(owner.runnerId), original = assigned(await owner.client.claimOpportunity(input));
  await center.restart(); const resumed = center.client(owner.token);
  expect(assigned(await resumed.claimOpportunityStatus(input)).identity).toEqual(original.identity);
  expect(assigned(await resumed.claimOpportunity(input)).identity).toEqual(original.identity);
  expect(await attempts(taskId)).toHaveLength(1); expect(await receipts(owner.runnerId)).toHaveLength(1);
});

it('uses a fresh integer lease from a fractional PG remainder and fences before the public runtime executes once', async () => {
  const runner = await center.runner(), input = center.opportunity(runner.runnerId), taskId = await center.submit();
  const allocation = assigned(await runner.client.claimOpportunity(input));
  await center.pool.query("UPDATE flow.attempts SET lease_expires_at=clock_timestamp()+interval '9.999567 seconds' WHERE id=$1", [allocation.identity.attemptId]);
  const fresh = assigned(await runner.client.claimOpportunityStatus(input));
  expect(Number.isSafeInteger(fresh.remainingLeaseMs)).toBe(true); expect(fresh.remainingLeaseMs).toBeLessThanOrEqual(9999); expect(fresh.remainingLeaseMs).toBeGreaterThan(0);
  const state = join(center.directory, textDigest(center.baseUrl)); await mkdir(state, { recursive: true });
  const journalPath = join(state, 'admission.json'); await writeFile(journalPath, JSON.stringify({ version: 2, runnerId: runner.runnerId, opportunityId: input.requestId, assignments: [] }));
  let enter!: () => void; const entered = new Promise<void>(resolve => { enter = resolve; }); const stop = new AbortController();
  let observed: unknown; let starts = 0;
  const running = runRunner({ baseUrl: center.baseUrl, token: runner.token, workingDirectory: center.directory, signal: stop.signal,
    adapters: [{ name: 'fixture', version: '1', async run(context) { starts++; observed = { journal: JSON.parse(await readFile(journalPath, 'utf8')),
      heartbeat: (await center.pool.query('SELECT last_heartbeat_at FROM flow.attempts WHERE id=$1', [allocation.identity.attemptId])).rows[0].last_heartbeat_at,
      taskId: context.task.id }; enter(); await new Promise<void>(resolve => { if (context.signal.aborted) resolve(); else context.signal.addEventListener('abort', () => resolve(), { once: true }); }); } }] });
  let timeout: NodeJS.Timeout | undefined;
  try { await Promise.race([entered, running.then(() => { throw new Error('Runtime ended before adapter.'); }), new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('Runtime entry deadline')), 5000); })]); }
  finally { clearTimeout(timeout); stop.abort(); await running; }
  expect(starts).toBe(1); expect(observed).toMatchObject({ taskId, journal: { assignments: [allocation.identity] }, heartbeat: expect.any(Date) });
  expect(await attempts(taskId)).toHaveLength(1);
});
