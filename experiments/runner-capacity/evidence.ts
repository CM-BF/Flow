import assert from 'node:assert/strict';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

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

export async function reserveRun(root: string, input: { label: string; scenario: string; windowId: string; databaseName: string; tasks: number; attempts: number; requireGate?: boolean }) {
  let usedTasks = 0; let usedAttempts = 0; let usedMs = 0; let gatePassed = false;
  const priorRuns: { label: string; tasks: number; attempts: number; elapsedMs: number; failed: boolean }[] = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const started = await optionalJson(join(root, entry.name, 'run-start.json'));
    const result = await optionalJson(join(root, entry.name, 'result.json'));
    if (!started && !result) continue;
    assert(result, 'An earlier run has no completion record; inspect its owned resources before new work.');
    const scenario = result.scenario?.id ?? started?.scenario;
    assert(scenario !== input.scenario, 'This scenario already started; automatic reruns are not authorized.');
    const observations = result.observations ?? [];
    const tasks = result.submittedTaskIds?.length ?? new Set(observations.filter((o: { kind: string }) => o.kind === 'adapter-start').map((o: { taskId: string }) => o.taskId)).size;
    const attempts = result.facts?.attempts ?? new Set(observations.filter((o: { kind: string }) => o.kind === 'report-start').map((o: { attemptId: string }) => o.attemptId)).size;
    assert(Number.isSafeInteger(tasks) && Number.isSafeInteger(attempts) && Number.isFinite(result.elapsedMs) && result.elapsedMs >= 0, 'Invalid prior budget evidence.');
    usedTasks += tasks; usedAttempts += attempts; usedMs += result.elapsedMs;
    priorRuns.push({ label: entry.name, tasks, attempts, elapsedMs: result.elapsedMs, failed: result.failure !== null });
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
