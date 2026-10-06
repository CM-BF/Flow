import assert from 'node:assert/strict';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

async function optionalJson(path: string) {
  try { return JSON.parse(await readFile(path, 'utf8')); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error; }
}

export async function directoryBytes(directory: string): Promise<number> {
  let bytes = 0;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    assert(!entry.isSymbolicLink(), 'Evidence size accounting refuses symlinks.');
    const path = join(directory, entry.name);
    bytes += entry.isDirectory() ? await directoryBytes(path) : (await stat(path)).size;
  }
  return bytes;
}

type Reservation = { tasks: number; attempts: number; scenario: string };
type RunEvidence = {
  scenario?: { id: string }; reservation?: Reservation; submittedTaskIds?: string[];
  observations?: { kind: string; taskId?: string; attemptId?: string }[];
  facts?: { tasks: number; attempts: number; assignments?: { taskId: string; attempt: { id: string } }[] };
  rawFacts?: { tasks?: number; attempts?: { id: string }[] } | null;
  elapsedMs: number; failure: string | null;
};
const auditedSmokeHashes = new Set([
  'b364ee15b5767bb066d59147ce9cf7064a288ea854dda703b5a62f395f69c8a4',
  'ad186c42e7bcb2eb07a147a52df7ff3f59847569c1496730637ad81ece6f7cbc',
]);
const validCount = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0;
function identityCount(values: (string | undefined)[]) {
  assert(values.every(value => typeof value === 'string' && value.length > 0), 'Invalid prior identity evidence.');
  return new Set(values).size;
}
function priorBudget(result: RunEvidence, started: Reservation | null, sha256: string) {
  const observations = result.observations ?? [];
  const observedTasks = identityCount(result.submittedTaskIds ?? observations.filter(o => o.kind === 'adapter-start').map(o => o.taskId));
  const observedAttempts = identityCount([
    ...observations.filter(o => ['claim-grant', 'report-start'].includes(o.kind)).map(o => o.attemptId),
    ...(result.rawFacts?.attempts ?? []).map(attempt => attempt.id),
    ...(result.facts?.assignments ?? []).map(assignment => assignment.attempt.id),
  ]);
  if (auditedSmokeHashes.has(sha256)) {
    assert(observedTasks === 4 && observedAttempts === 4, 'Audited smoke count changed.');
    return { budgetChargedTasks: 4, budgetChargedAttempts: 4, observedTasks, observedAttempts, countBasis: 'audited-historical-smoke' };
  }
  const reservation = started ?? result.reservation;
  assert(reservation && validCount(reservation.tasks) && reservation.tasks > 0 && validCount(reservation.attempts) && reservation.attempts > 0, 'Missing or invalid prior reservation; inspect unknown consumption.');
  if (started && result.reservation) {
    assert(started.tasks === result.reservation.tasks && started.attempts === result.reservation.attempts && started.scenario === result.reservation.scenario, 'Conflicting prior reservation.');
  }
  const reportedAttempts = result.facts?.attempts ?? result.rawFacts?.attempts?.length;
  const reportedTasks = result.facts?.tasks ?? result.rawFacts?.tasks;
  assert(reportedAttempts === undefined || validCount(reportedAttempts), 'Invalid prior attempt count.');
  assert(reportedTasks === undefined || validCount(reportedTasks), 'Invalid prior task count.');
  const complete = result.failure === null && reportedAttempts === observedAttempts && reportedTasks === observedTasks && observedTasks === reservation.tasks;
  return {
    budgetChargedTasks: complete ? observedTasks : Math.max(observedTasks, reservation.tasks, reportedTasks ?? 0),
    budgetChargedAttempts: complete ? observedAttempts : Math.max(observedAttempts, reservation.attempts, reportedAttempts ?? 0),
    observedTasks, observedAttempts, countBasis: complete ? 'verified-result' : 'conservative-reservation',
  };
}

export async function reserveRun(root: string, input: { label: string; scenario: string; windowId: string; databaseName: string; tasks: number; attempts: number; requireGate?: boolean }) {
  assert(validCount(input.tasks) && input.tasks > 0 && validCount(input.attempts) && input.attempts > 0, 'Invalid new reservation.');
  let usedTasks = 0; let usedAttempts = 0; let usedMs = 0; let gatePassed = false;
  const priorRuns: ({ label: string; elapsedMs: number; failed: boolean } & ReturnType<typeof priorBudget>)[] = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const started = await optionalJson(join(root, entry.name, 'run-start.json'));
    const result = await optionalJson(join(root, entry.name, 'result.json'));
    if (!started && !result) continue;
    assert(result, 'An earlier run has no completion record; inspect its owned resources before new work.');
    const scenario = result.scenario?.id ?? started?.scenario;
    assert(scenario !== input.scenario, 'This scenario already started; automatic reruns are not authorized.');
    const digest = createHash('sha256').update(await readFile(join(root, entry.name, 'result.json'))).digest('hex');
    const budget = priorBudget(result, started, digest);
    assert(Number.isFinite(result.elapsedMs) && result.elapsedMs >= 0, 'Invalid prior elapsed budget evidence.');
    usedTasks += budget.budgetChargedTasks; usedAttempts += budget.budgetChargedAttempts; usedMs += result.elapsedMs;
    priorRuns.push({ label: entry.name, ...budget, elapsedMs: result.elapsedMs, failed: result.failure !== null });
    if (scenario === 'protocol-gate' && result.failure === null && result.facts?.tasks === 8 && result.facts?.attempts === 2) gatePassed = true;
  }
  assert(!input.requireGate || gatePassed, 'A successful protocol gate is required before formal work.');
  assert(usedTasks + input.tasks <= 64 && usedAttempts + input.attempts <= 64, 'S01 task or attempt budget exhausted.');
  assert(usedMs + 30_000 <= 180_000, 'S01 total elapsed budget cannot reserve this window and cleanup.');
  assert(await directoryBytes(root) < 64 * 1024 * 1024, 'Existing S01 evidence exceeds the storage budget.');
  const output = join(root, input.label); await mkdir(output);
  const reservation = { ...input, startedAt: new Date().toISOString(), maxWindowMs: 30_000, usedTasks, usedAttempts, usedMs, priorRuns };
  await writeFile(join(output, 'run-start.json'), JSON.stringify(reservation, null, 2), { flag: 'wx' });
  return { output, reservation };
}
