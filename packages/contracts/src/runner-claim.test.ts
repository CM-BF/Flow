import { expect, it } from 'vitest';
import { RUNNER_CLAIM_PROTOCOL, runnerClaimRequestSchema, runnerClaimResponseSchema, decodeRunnerClaimResponse, runnerIdentitySchema } from './runner-claim.js';

const request = { protocol: RUNNER_CLAIM_PROTOCOL, runnerId: 'runner-1', requestId: '72524832-de17-4e77-8b77-aa320a42c8e1' };
const identity = { runnerId: 'runner-1', taskId: 'task-1', attemptId: 'attempt-1', ownerVersion: 1 };
const assigned = () => ({ ...request, state: 'assigned' as const, identity, remainingLeaseMs: 9000,
  assignment: { attempt: { id: identity.attemptId, runnerId: identity.runnerId, ownerVersion: 1, leaseExpiresAt: '2026-10-06T20:00:00.000Z' },
    task: { id: identity.taskId, title: 'Fixture', prompt: 'Private execution input', harness: 'fixture' as const } } });

it('requires an explicit version, stable request UUID and authenticated nonsecret runner identity', () => {
  expect(runnerClaimRequestSchema.parse(request)).toEqual(request);
  for (const changed of [{ ...request, protocol: undefined }, { ...request, requestId: '' }, { ...request, token: 'not-allowed' }, { ...request, runnerId: '' }]) {
    expect(runnerClaimRequestSchema.safeParse(changed).success).toBe(false);
  }
  expect(runnerIdentitySchema.parse({ protocol: RUNNER_CLAIM_PROTOCOL, runnerId: 'runner-1' })).toEqual({ protocol: RUNNER_CLAIM_PROTOCOL, runnerId: 'runner-1' });
  expect(runnerIdentitySchema.safeParse({ runnerId: 'runner-1' }).success).toBe(false);
});

it('distinguishes empty allocation observations from missing receipt observations', () => {
  expect(decodeRunnerClaimResponse({ ...request, state: 'empty' }, request, 'claim').state).toBe('empty');
  expect(decodeRunnerClaimResponse({ ...request, state: 'missing' }, request, 'status').state).toBe('missing');
  expect(() => decodeRunnerClaimResponse({ ...request, state: 'missing' }, request, 'claim')).toThrow();
  expect(() => decodeRunnerClaimResponse({ ...request, state: 'empty' }, request, 'status')).toThrow();
  expect(runnerClaimResponseSchema.safeParse({ assignment: null, remainingLeaseMs: 0 }).success).toBe(false);
});

it('binds both the response and actual assignment to the exact requested opportunity and runner', () => {
  expect(decodeRunnerClaimResponse(assigned(), request, 'claim')).toEqual(assigned());
  for (const changed of [{ ...assigned(), requestId: 'f4ad6f60-bc9e-4688-a078-52b6d9beaa27' },
    { ...assigned(), runnerId: 'runner-2' }, { ...assigned(), identity: { ...identity, ownerVersion: 2 } },
    { ...assigned(), assignment: { ...assigned().assignment, task: { ...assigned().assignment.task, id: 'task-other' } } }]) {
    expect(() => decodeRunnerClaimResponse(changed, request, 'claim')).toThrow();
  }
});

it('never turns historical unavailable receipts or absent lease grants into execution authority', () => {
  const unavailable = { ...request, state: 'unavailable', identity, reason: 'not-executable' };
  expect(decodeRunnerClaimResponse(unavailable, request, 'status')).toEqual(unavailable);
  expect(runnerClaimResponseSchema.safeParse({ ...unavailable, assignment: assigned().assignment }).success).toBe(false);
  for (const remainingLeaseMs of [0, -1, 9000.5, 300001, Infinity, NaN, undefined]) expect(runnerClaimResponseSchema.safeParse({ ...assigned(), remainingLeaseMs }).success).toBe(false);
});

it('retains the complete bounded private assignment while rejecting malformed envelopes', () => {
  const full = assigned();
  full.assignment.task.prompt = '界'.repeat(16000);
  expect(decodeRunnerClaimResponse(full, request, 'status')).toEqual(full);
  expect(runnerClaimResponseSchema.safeParse({ ...assigned(), assignment: { ...assigned().assignment, extra: true } }).success).toBe(false);
  expect(runnerClaimResponseSchema.safeParse({ ...assigned(), assignment: { ...assigned().assignment, attempt: { ...assigned().assignment.attempt, leaseExpiresAt: 'invalid' } } }).success).toBe(false);
});
