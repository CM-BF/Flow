import { constants } from 'node:fs';
import { open, mkdir, lstat, realpath } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, isAbsolute, join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';

export const NATIVE_MODEL = 'claude-sonnet-5-5';
export const PHASE_LIMITS = Object.freeze({
  plan: Object.freeze({ queries: 1, maxTurns: 4, maxBudgetUsd: 0.20, timeoutMs: 90_000 }),
  children: Object.freeze({ queries: 2, maxTurns: 3, maxBudgetUsd: 0.10, timeoutMs: 60_000 }),
});
const SLOTS = Object.freeze({ plan: ['planner'], children: ['child-1', 'child-2'] });
const validated = new WeakSet();
const digest = value => createHash('sha256').update(value).digest('hex');
const hex = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const label = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
function exactKeys(value, keys) { return value && typeof value === 'object' && !Array.isArray(value)
  && isDeepStrictEqual(Object.keys(value).sort(), [...keys].sort()); }
function check(condition, message) { if (!condition) throw new Error(message); }
function immutable(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(immutable); Object.freeze(value); }
  return value;
}

/** Validates a trusted operator's handoff; a JSON field is not proof of human consent. */
export function validatePermit(input, { identity, phase, confirmation, executionAuthorization, environmentDigest, now = Date.now() }) {
  const fields = ['kind', 'authorizedBy', 'approvalId', 'phase', 'sourceDigest', 'worktree', 'model', 'limits', 'approvedAt', 'expiresAt', 'authorizationReference'];
  if (phase === 'children') fields.push('confirmation');
  if (environmentDigest !== undefined) fields.push('environmentDigest');
  if (executionAuthorization !== undefined) fields.push('executionAuthorization');
  check(exactKeys(input, fields) && Object.hasOwn(PHASE_LIMITS, phase), 'Invalid phase permit.');
  const approved = Date.parse(input.approvedAt), expires = Date.parse(input.expiresAt);
  check(input.kind === (executionAuthorization !== undefined ? 'flow.o16.phase-permit.v3' : environmentDigest === undefined ? 'flow.o16.phase-permit.v1' : 'flow.o16.phase-permit.v2')
    && (environmentDigest === undefined || hex(environmentDigest) && input.environmentDigest === environmentDigest) && input.authorizedBy === 'Goal Owner'
    && typeof input.approvalId === 'string' && /^[A-Za-z0-9-]{8,100}$/.test(input.approvalId)
    && input.phase === phase && hex(identity.digest) && input.sourceDigest === identity.digest
    && typeof identity.root === 'string' && identity.root.length <= 4096 && isAbsolute(identity.root) && input.worktree === identity.root
    && input.model === (environmentDigest === undefined ? 'sonnet' : NATIVE_MODEL) && isDeepStrictEqual(input.limits, PHASE_LIMITS[phase])
    && typeof input.authorizationReference === 'string' && input.authorizationReference.trim().length >= 10 && input.authorizationReference.length <= 1000
    && typeof input.approvedAt === 'string' && typeof input.expiresAt === 'string'
    && Number.isFinite(approved) && Number.isFinite(expires) && Number.isFinite(now)
    && approved <= now && expires > now && expires - approved <= 86_400_000, 'Missing or mismatched fresh phase permit.');
  if (phase === 'children') {
    check(exactKeys(confirmation, ['goalId', 'proposalId', 'proposalDigest', 'confirmationDigest', 'progressionId'])
      && ['goalId', 'proposalId', 'progressionId'].every(key => label(confirmation[key]))
      && hex(confirmation.proposalDigest) && hex(confirmation.confirmationDigest)
      && isDeepStrictEqual(input.confirmation, confirmation), 'Children permit does not bind the actual confirmation.');
  }
  if (executionAuthorization !== undefined) {
    check(phase === 'children' && hex(environmentDigest)
      && exactKeys(executionAuthorization, ['goalId', 'proposalId', 'proposalDigest', 'confirmationDigest', 'oldProgressionId', 'progressionId', 'authorizationDigest', 'expiresAt'])
      && ['goalId', 'proposalId', 'proposalDigest', 'confirmationDigest'].every(key => executionAuthorization[key] === confirmation[key])
      && executionAuthorization.oldProgressionId === confirmation.progressionId && label(executionAuthorization.progressionId)
      && executionAuthorization.progressionId !== executionAuthorization.oldProgressionId && hex(executionAuthorization.authorizationDigest)
      && Date.parse(executionAuthorization.expiresAt) >= expires && isDeepStrictEqual(input.executionAuthorization, executionAuthorization),
    'Replacement permit must bind both the unchanged confirmation and actual new authorization.');
  }
  check(Buffer.byteLength(JSON.stringify(input)) <= 8192, 'Phase permit exceeds its byte bound.');
  const result = immutable(structuredClone(input)); validated.add(result); return result;
}

export async function readPermitFile(path) {
  const handle = await open(path, constants.O_RDONLY | constants.O_NONBLOCK | constants.O_NOFOLLOW);
  try {
    const info = await handle.stat(); check(info.isFile() && info.size <= 8192, 'Bounded regular permit or reservation file required.');
    const bytes = Buffer.alloc(8193); let length = 0;
    while (length < bytes.length) {
      const read = await handle.read(bytes, length, bytes.length - length, null);
      if (read.bytesRead === 0) break; length += read.bytesRead;
    }
    check(length <= 8192, 'Permit or reservation grew beyond its byte bound.');
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(0, length)));
  } finally { await handle.close(); }
}
async function syncDirectory(path) {
  const handle = await open(path, constants.O_RDONLY);
  try { await handle.sync(); } finally { await handle.close(); }
}
async function writeExclusive(path, value) {
  const handle = await open(path, 'wx', 0o600);
  try { await handle.writeFile(JSON.stringify(value) + '\n'); await handle.sync(); }
  finally { await handle.close(); }
  // Failure here leaves a consumed/unknown record; callers must not erase it and retry.
  await syncDirectory(dirname(path));
}

/** root is a trusted fixed journal namespace, never the caller-selected output directory. */
export async function reservePhase(root, permit) {
  check(validated.has(permit), 'A validated phase permit is required.');
  await mkdir(root, { recursive: true, mode: 0o700 });
  check((await lstat(root)).isDirectory(), 'Reservation root must be a real directory.');
  const directory = await realpath(root); await syncDirectory(dirname(directory));
  const path = join(directory, `o16-${permit.approvalId}-${permit.phase}.json`);
  await writeExclusive(path, { permit, reservedAt: new Date().toISOString(), outcome: 'unknown' });
  return Object.freeze({ directory, path, permit });
}

/** A worker may reopen a reserved phase; only consumeSlot can authorize a still-unconsumed entry. */
export async function openReservedPhase(root, permit) {
  check(validated.has(permit), 'A validated phase permit is required.');
  check((await lstat(root)).isDirectory(), 'Reservation root must be a real directory.');
  const directory = await realpath(root), path = join(directory, `o16-${permit.approvalId}-${permit.phase}.json`);
  const recorded = await readPermitFile(path);
  check(isDeepStrictEqual(recorded.permit, permit), 'Phase reservation binding changed.');
  return Object.freeze({ directory, path, permit });
}

/** The host has already matched this actual assignment to the admitted planner or progression node. */
export async function consumeSlot(reservation, slot, assignment, { now = Date.now() } = {}) {
  const { permit, directory, path } = reservation;
  check(validated.has(permit), 'Unknown phase reservation.');
  check(Number.isFinite(now) && Date.parse(permit.approvedAt) <= now && Date.parse(permit.expiresAt) > now, 'Phase permit expired before query entry.');
  const recorded = await readPermitFile(path);
  check(isDeepStrictEqual(recorded.permit, permit) && path === join(directory, `o16-${permit.approvalId}-${permit.phase}.json`), 'Phase reservation binding changed.');
  check(SLOTS[permit.phase].includes(slot), 'Slot is outside this phase.');
  check(exactKeys(assignment, ['taskId', 'attemptId', 'runnerId', 'ownerVersion'])
    && ['taskId', 'attemptId', 'runnerId'].every(key => label(assignment[key]))
    && Number.isSafeInteger(assignment.ownerVersion) && assignment.ownerVersion >= 1, 'Actual execution identity is required.');
  const prefix = `o16-${permit.approvalId}-${permit.phase}`;
  const binding = { phase: permit.phase, slot, assignment: structuredClone(assignment), sourceDigest: permit.sourceDigest,
    approvalId: permit.approvalId, consumedAt: new Date().toISOString(), outcome: 'unknown' };
  // A new attempt of the same task cannot use another slot. Partial writes stay consumed.
  await writeExclusive(join(directory, `${prefix}-task-${digest(assignment.taskId)}.json`), binding);
  await writeExclusive(join(directory, `${prefix}-${slot}.json`), binding);
  return immutable(binding);
}

/** Only an already validated fresh v2 handoff can open the native environment seam. */
export function assertNativePermit(permit, environmentDigest) {
  check(validated.has(permit) && ['flow.o16.phase-permit.v2', 'flow.o16.phase-permit.v3'].includes(permit.kind) && hex(environmentDigest)
    && (permit.phase === 'plan' || permit.phase === 'children' && permit.confirmation)
    && permit.environmentDigest === environmentDigest && Date.parse(permit.expiresAt) > Date.now(),
    'A fresh source/environment-bound native permit is required; JSON login claims are not authorization.');
}
