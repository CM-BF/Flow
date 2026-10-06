import { afterEach, expect, it } from 'vitest';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { directoryBytes, reserveRun } from './evidence.js';

const roots: string[] = [];
async function root() { const path = await mkdtemp(join(tmpdir(), 'flow-s01-budget-')); roots.push(path); return path; }
afterEach(async () => { for (const path of roots.splice(0)) await rm(path, { recursive: true }); });
const input = { label: 'new-run', scenario: 'declared-four', windowId: 'synthetic-window', databaseName: 'synthetic-owned-db', tasks: 12, attempts: 12, requireGate: false };
async function prior(root: string, label: string, values: Record<string, unknown>) {
  const path = join(root, label); await mkdir(path); await writeFile(join(path, 'result.json'), JSON.stringify(values));
}
function failed(tasks: number, attempts: number, observations: unknown[] = []) {
  return { scenario: { id: 'prior' }, reservation: { scenario: 'prior', tasks, attempts }, submittedTaskIds: [], observations, elapsedMs: 100, failure: 'preserved failure' };
}

it('preserves the audited historical totals and gate requirement without rewriting raw evidence', async () => {
  const path = await root();
  for (const label of ['smoke-first', 'smoke-repair', 'w1-protocol-gate', 'w1-four-processes']) {
    const source = await readFile(resolve('docs/evidence/s01', label, 'result.json'));
    const dir = join(path, label); await mkdir(dir); await writeFile(join(dir, 'result.json'), source);
  }
  const run = await reserveRun(path, { ...input, requireGate: true });
  expect(run.reservation).toMatchObject({ usedTasks: 32, usedAttempts: 26, usedMs: 13135.276166 });
  expect(JSON.parse(await readFile(join(run.output, 'run-start.json'), 'utf8')).scenario).toBe('declared-four');
  expect(await directoryBytes(path)).toBeGreaterThan(0);
  await expect(reserveRun(await root(), { ...input, requireGate: true })).rejects.toThrow('successful protocol gate');
});

it('counts claim without emit and deduplicates all observations of one attempt', async () => {
  const path = await root();
  await prior(path, 'failed', failed(2, 2, [{ kind: 'claim-grant', attemptId: 'one' }, { kind: 'claim-grant', attemptId: 'two' }, { kind: 'report-start', attemptId: 'two' }, { kind: 'report-start', attemptId: 'two' }]));
  const { reservation } = await reserveRun(path, input);
  expect(reservation).toMatchObject({ usedAttempts: 2, usedTasks: 2 });
  expect(reservation.priorRuns[0]).toMatchObject({ observedAttempts: 2, budgetChargedAttempts: 2, countBasis: 'conservative-reservation' });
});

it('charges unknown claim ACK and failed gate by reservation even without emitted events', async () => {
  const path = await root();
  await prior(path, 'unknown-ack', failed(1, 1));
  await prior(path, 'failed-gate', { ...failed(8, 8), scenario: { id: 'protocol-gate' }, reservation: { scenario: 'protocol-gate', tasks: 8, attempts: 8 } });
  const { reservation } = await reserveRun(path, input);
  expect(reservation).toMatchObject({ usedTasks: 9, usedAttempts: 9 });
  expect(reservation.priorRuns.every(run => run.observedAttempts === 0)).toBe(true);
});

it('does not treat successful but incomplete count evidence as zero consumption', async () => {
  const path = await root(); await prior(path, 'incomplete-counts', { ...failed(3, 3), failure: null });
  expect((await reserveRun(path, input)).reservation).toMatchObject({ usedTasks: 3, usedAttempts: 3 });
});

it('refuses missing or invalid reservations and incomplete earlier runs', async () => {
  for (const reservation of [undefined, { tasks: 0, attempts: 0 }, { tasks: -1, attempts: 1 }, { tasks: 1, attempts: 1.5 }]) {
    const path = await root(); await prior(path, 'unknown', { ...failed(1, 1), reservation });
    await expect(reserveRun(path, input)).rejects.toThrow('prior reservation');
  }
  const path = await root(); const dir = join(path, 'unfinished'); await mkdir(dir);
  await writeFile(join(dir, 'run-start.json'), JSON.stringify({ scenario: 'protocol-gate', tasks: 8, attempts: 8 }));
  await expect(reserveRun(path, input)).rejects.toThrow('no completion record');
});

it('refuses reruns and separate task, attempt, and elapsed budget overflow', async () => {
  const repeated = await root(); await prior(repeated, 'prior', { ...failed(12, 12), scenario: { id: input.scenario } });
  await expect(reserveRun(repeated, input)).rejects.toThrow('automatic reruns');
  for (const [tasks, attempts] of [[60, 1], [1, 60]]) {
    const path = await root(); await prior(path, 'prior', failed(tasks!, attempts!));
    await expect(reserveRun(path, input)).rejects.toThrow('task or attempt budget');
  }
  const slow = await root(); await prior(slow, 'prior', { ...failed(1, 1), elapsedMs: 151000 });
  await expect(reserveRun(slow, input)).rejects.toThrow('total elapsed budget');
});
