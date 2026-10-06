import { afterEach, expect, it } from 'vitest';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { directoryBytes, reserveRun } from './evidence.js';

const roots: string[] = [];
async function root() { const path = await mkdtemp(join(tmpdir(), 'flow-s01-budget-')); roots.push(path); return path; }
afterEach(async () => { for (const path of roots.splice(0)) await rm(path, { recursive: true }); });
const input = { label: 'new-run', scenario: 'four-processes', windowId: 'synthetic-window', databaseName: 'synthetic-owned-db', tasks: 16, attempts: 16, requireGate: true };
async function prior(root: string, label: string, values: Record<string, unknown>) {
  const path = join(root, label); await mkdir(path); await writeFile(join(path, 'result.json'), JSON.stringify(values));
}

it('counts preserved historical runs and requires a successful gate before reserving formal work', async () => {
  const path = await root();
  await prior(path, 'old-smoke', { elapsedMs: 1000, failure: 'preserved error', observations: Array.from({ length: 4 }, (_, i) => ({ kind: 'adapter-start', taskId: String(i) })) });
  await expect(reserveRun(path, input)).rejects.toThrow('successful protocol gate');
  await prior(path, 'gate', { scenario: { id: 'protocol-gate' }, submittedTaskIds: Array.from({ length: 8 }, (_, i) => String(i)), facts: { tasks: 8, attempts: 2 }, elapsedMs: 2000, failure: null });
  const run = await reserveRun(path, input);
  expect(run.reservation).toMatchObject({ usedTasks: 12, usedAttempts: 2, usedMs: 3000 });
  expect(JSON.parse(await readFile(join(run.output, 'run-start.json'), 'utf8')).scenario).toBe('four-processes');
  expect(await directoryBytes(path)).toBeGreaterThan(0);
});

it('refuses an incomplete earlier reservation without silently reclaiming its budget', async () => {
  const path = await root(); const unfinished = join(path, 'unfinished'); await mkdir(unfinished);
  await writeFile(join(unfinished, 'run-start.json'), JSON.stringify({ scenario: 'protocol-gate' }));
  await expect(reserveRun(path, { ...input, requireGate: false })).rejects.toThrow('no completion record');
});

it('refuses scenario reruns and cumulative task or elapsed budget overflow', async () => {
  const repeated = await root();
  await prior(repeated, 'previous', { scenario: { id: 'four-processes' }, submittedTaskIds: [], elapsedMs: 100, failure: 'failed' });
  await expect(reserveRun(repeated, { ...input, requireGate: false })).rejects.toThrow('automatic reruns');
  const many = await root();
  await prior(many, 'previous', { submittedTaskIds: Array(60).fill('synthetic'), elapsedMs: 100, failure: null });
  await expect(reserveRun(many, { ...input, requireGate: false })).rejects.toThrow('task or attempt budget');
  const slow = await root();
  await prior(slow, 'previous', { submittedTaskIds: [], elapsedMs: 151000, failure: null });
  await expect(reserveRun(slow, { ...input, requireGate: false })).rejects.toThrow('total elapsed budget');
});
