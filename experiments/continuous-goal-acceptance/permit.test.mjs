import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PHASE_LIMITS, validatePermit, reservePhase, consumeSlot, openReservedPhase } from './permit.mjs';

const now = Date.parse('2026-10-06T18:20:00Z');
const identity = { root: '/isolated/o16-fixture', digest: 'a'.repeat(64) };
const confirmation = { goalId: 'goal', proposalId: 'proposal', proposalDigest: 'b'.repeat(64), confirmationDigest: 'c'.repeat(64), progressionId: 'progression' };
const assignment = { taskId: 'task-a', attemptId: 'attempt-a', runnerId: 'runner', ownerVersion: 1 };
function permit(phase = 'plan') { return { kind: 'flow.o16.phase-permit.v1', authorizedBy: 'Goal Owner', approvalId: `fixture-${phase}`, phase,
  sourceDigest: identity.digest, worktree: identity.root, model: 'sonnet', limits: { ...PHASE_LIMITS[phase] },
  approvedAt: new Date(now - 1000).toISOString(), expiresAt: new Date(now + 60_000).toISOString(), authorizationReference: 'SYNTHETIC TEST ONLY: no model authorization',
  ...(phase === 'children' ? { confirmation: { ...confirmation } } : {}) }; }
async function directory(t) { const path = await mkdtemp(join(tmpdir(), 'flow-o16-permit-test-')); t.after(() => rm(path, { recursive: true })); return path; }

test('permits are finite, phase-specific and bound to source plus actual confirmation', () => {
  assert.equal(validatePermit(permit(), { identity, phase: 'plan', now }).phase, 'plan');
  assert.equal(validatePermit(permit('children'), { identity, phase: 'children', confirmation, now }).phase, 'children');
  for (const mutation of [p => p.limits.queries++, p => p.phase = 'children', p => p.model = 'other', p => p.worktree += '-other', p => p.extra = true, p => p.expiresAt = new Date(now).toISOString(), p => p.authorizedBy = 'worker']) {
    const input = permit(); mutation(input); assert.throws(() => validatePermit(input, { identity, phase: 'plan', now }), /permit/i);
  }
  assert.throws(() => validatePermit(permit('children'), { identity, phase: 'children', confirmation: { ...confirmation, proposalDigest: 'd'.repeat(64) }, now }), /permit/i);
  assert.throws(() => validatePermit(permit('children'), { identity, phase: 'children', now }), /permit/i);
});

test('reservation consumes approval before any query and a moved output cannot replay it', async t => {
  const root = await directory(t), input = validatePermit(permit(), { identity, phase: 'plan', now });
  const reserved = await reservePhase(root, input);
  assert.equal(JSON.parse(await readFile(reserved.path, 'utf8')).outcome, 'unknown');
  assert.equal((await stat(reserved.path)).mode & 0o777, 0o600);
  await assert.rejects(reservePhase(root, input), /EEXIST/);
  const binding = await consumeSlot(reserved, 'planner', assignment, { now });
  assert.deepEqual(binding.assignment, assignment);
  await assert.rejects(consumeSlot(reserved, 'planner', { ...assignment, attemptId: 'new-attempt' }, { now }), /EEXIST/);
  await assert.rejects(consumeSlot(reserved, 'child-1', assignment, { now }), /slot/i);
});

test('children slots require distinct actual tasks and a restart never consumes a slot twice', async t => {
  const root = await directory(t), input = validatePermit(permit('children'), { identity, phase: 'children', confirmation, now });
  const reserved = await reservePhase(root, input);
  await consumeSlot(reserved, 'child-1', assignment, { now });
  await assert.rejects(consumeSlot(reserved, 'child-2', { ...assignment, attemptId: 'retry-attempt' }, { now }), /EEXIST/);
  // The duplicate task check did not reserve child-2; a genuinely different confirmed task can consume it.
  const second = { ...assignment, taskId: 'task-b', attemptId: 'attempt-b' };
  await consumeSlot(reserved, 'child-2', second, { now });
  await assert.rejects(consumeSlot(reserved, 'child-2', { ...second, taskId: 'task-c' }, { now }), /EEXIST/);
});

test('partial or modified phase records fail closed before slot reservation', async t => {
  const root = await directory(t), input = validatePermit(permit(), { identity, phase: 'plan', now });
  const reserved = await reservePhase(root, input);
  await assert.rejects(consumeSlot({ ...reserved, permit: { ...input, approvalId: 'changed' } }, 'planner', assignment, { now }), /reservation/i);
  await assert.rejects(consumeSlot(reserved, 'planner', { ...assignment, ownerVersion: 0 }, { now }), /identity/i);
});


test('worker reopen preserves consumption and each entry checks fresh permit expiry', async t => {
  const root = await directory(t), raw = permit();
  await reservePhase(root, validatePermit(raw, { identity, phase: 'plan', now }));
  const reopened = await openReservedPhase(root, validatePermit(raw, { identity, phase: 'plan', now }));
  await assert.rejects(consumeSlot(reopened, 'planner', assignment, { now: now + 60_000 }), /expired/);
  await consumeSlot(reopened, 'planner', assignment, { now });
  const restarted = await openReservedPhase(root, validatePermit(raw, { identity, phase: 'plan', now }));
  await assert.rejects(consumeSlot(restarted, 'planner', assignment, { now }), /EEXIST/);
});
