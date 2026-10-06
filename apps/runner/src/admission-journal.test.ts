import { mkdtemp, readFile, rm, writeFile, mkdir, stat } from 'node:fs/promises';
import { execFileSync, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { AdmissionJournal, AdmissionStorageError } from './admission-journal.js';

const directories: string[] = [];
afterEach(async () => { for (const directory of directories.splice(0)) await rm(directory, { recursive: true, force: true }); });
async function directory() { const path = await mkdtemp(join(tmpdir(), 'flow-admission-')); directories.push(path); return path; }
const assignment = { attemptId: 'attempt-1', taskId: 'task-1', runnerId: 'runner-1', ownerVersion: 1 };

it('persists one runner-bound opportunity and reuses it across empty polls and restart without replacement', async () => {
  const path = await directory(); const journal = await AdmissionJournal.open(path);
  expect(await journal.bindRunner('runner-1')).toBe(true);
  const request = journal.opportunity!;
  const before = await stat(join(path, 'admission.json'), { bigint: true });
  for (let i = 0; i < 12; i++) { expect(await journal.bindRunner('runner-1')).toBe(true); expect(journal.opportunity).toEqual(request); }
  const after = await stat(join(path, 'admission.json'), { bigint: true });
  expect({ ino: after.ino, mtime: after.mtimeNs }).toEqual({ ino: before.ino, mtime: before.mtimeNs });
  expect((await AdmissionJournal.open(path)).opportunity).toEqual(request);
  expect(journal.unresolved(new Set())).toBe(false);
});

it('durably accepts only the exact opportunity then retains the assignment across restart', async () => {
  const path = await directory(); const journal = await AdmissionJournal.open(path);
  await journal.bindRunner('runner-1'); const request = journal.opportunity!;
  await expect(journal.acceptOpportunity({ ...request, requestId: 'f4ad6f60-bc9e-4688-a078-52b6d9beaa27' }, assignment)).rejects.toBeInstanceOf(AdmissionStorageError);
  expect(journal.opportunity).toEqual(request);
  await journal.acceptOpportunity(request, assignment);
  expect(journal.opportunity!.requestId).not.toBe(request.requestId);
  await expect(journal.acceptOpportunity(request, assignment)).rejects.toBeInstanceOf(AdmissionStorageError);
  const restarted = await AdmissionJournal.open(path);
  expect(restarted.unresolved(new Set())).toBe(true);
  expect(restarted.unresolved(new Set(['attempt-1']))).toBe(false);
  await restarted.complete({ attemptId: 'attempt-1', ownerVersion: 2 });
  expect(restarted.unresolved(new Set())).toBe(true);
  await restarted.complete(assignment);
  expect(restarted.unresolved(new Set())).toBe(false);
});

it('cannot reinterpret a legacy in-flight request or assignment as a recoverable v2 opportunity', async () => {
  const path = await directory(); const journal = await AdmissionJournal.open(path); await journal.begin();
  const before = await readFile(join(path, 'admission.json'), 'utf8');
  expect(await journal.bindRunner('runner-1')).toBe(false);
  expect(journal.opportunity).toBeNull(); expect(await readFile(join(path, 'admission.json'), 'utf8')).toBe(before);
  await journal.accept(assignment);
  expect(await journal.bindRunner('runner-1')).toBe(false);
  expect(journal.opportunity).toBeNull(); expect(journal.unresolved(new Set())).toBe(true);
});

it('rejects credential identity changes and keeps the old opportunity when its durable handoff fails', async () => {
  const path = await directory(); const journal = await AdmissionJournal.open(path); await journal.bindRunner('runner-1');
  const request = journal.opportunity!;
  await expect(journal.bindRunner('runner-2')).rejects.toBeInstanceOf(AdmissionStorageError);
  await mkdir(join(path, 'admission.json.tmp'));
  await expect(journal.acceptOpportunity(request, assignment)).rejects.toBeInstanceOf(AdmissionStorageError);
  expect((await AdmissionJournal.open(path)).opportunity).toEqual(request);
});

it('persists an unknown claim across restart without credentials or task text', async () => {
  const path = await directory();
  const journal = await AdmissionJournal.open(path);
  expect(journal.unresolved(new Set())).toBe(false);
  await journal.begin();
  const restarted = await AdmissionJournal.open(path);
  expect(restarted.unresolved(new Set())).toBe(true);
  await expect(restarted.begin()).rejects.toThrow('Unresolved claim');
  const raw = JSON.parse(await readFile(join(path, 'admission.json'), 'utf8'));
  expect(Object.keys(raw).sort()).toEqual(['assignments', 'inFlight', 'version']);
  expect(raw.assignments).toEqual([]);
});

it('atomically hands the claim to a durable assignment before execution, cleared only by matching completion ACK', async () => {
  const path = await directory(); const journal = await AdmissionJournal.open(path);
  await journal.begin(); await journal.accept(assignment);
  const restarted = await AdmissionJournal.open(path);
  expect(restarted.unresolved(new Set())).toBe(true);
  expect(restarted.unresolved(new Set(['attempt-1']))).toBe(false);
  await restarted.complete({ attemptId: 'attempt-1', ownerVersion: 2 });
  expect(restarted.unresolved(new Set())).toBe(true);
  await restarted.complete({ attemptId: 'attempt-1', ownerVersion: 1 });
  expect((await AdmissionJournal.open(path)).unresolved(new Set())).toBe(false);
});

it('serializes concurrent completion and the next claim handoff without losing either record', async () => {
  const path = await directory(); const journal = await AdmissionJournal.open(path);
  await journal.begin(); await journal.accept(assignment); await journal.begin();
  await Promise.all([journal.accept({ ...assignment, attemptId: 'attempt-2' }), journal.complete(assignment)]);
  const recovered = await AdmissionJournal.open(path);
  expect(recovered.unresolved(new Set(['attempt-2']))).toBe(false);
  expect(recovered.unresolved(new Set(['attempt-1']))).toBe(true);
});

it('clears only a definite empty response and bounds retained assignments to sixteen', async () => {
  const path = await directory(); const journal = await AdmissionJournal.open(path);
  await journal.begin(); await journal.accept(null);
  expect(journal.unresolved(new Set())).toBe(false);
  for (let i = 0; i < 16; i++) { await journal.begin(); await journal.accept({ ...assignment, attemptId: `attempt-${i}` }); }
  await expect(journal.begin()).rejects.toThrow('Sixteen');
  expect((await AdmissionJournal.open(path)).unresolved(new Set(Array.from({ length: 16 }, (_, i) => `attempt-${i}`)))).toBe(false);
});

it('fails closed on corrupt or oversized existing journals', async () => {
  const path = await directory();
  await writeFile(join(path, 'admission.json'), '{');
  await expect(AdmissionJournal.open(path)).rejects.toBeInstanceOf(AdmissionStorageError);
  await writeFile(join(path, 'admission.json'), 'x'.repeat(65537));
  await expect(AdmissionJournal.open(path)).rejects.toBeInstanceOf(AdmissionStorageError);
});

it('retains the original storage error and the persisted guard when a handoff cannot be written', async () => {
  const path = await directory(); const journal = await AdmissionJournal.open(path);
  await journal.begin(); await mkdir(join(path, 'admission.json.tmp'));
  let failure: unknown;
  try { await journal.accept(assignment); } catch (error) { failure = error; }
  expect(failure).toBeInstanceOf(AdmissionStorageError);
  expect((failure as Error).cause).toBeInstanceOf(Error);
  expect((await AdmissionJournal.open(path)).unresolved(new Set())).toBe(true);
});


it.each(['admission.json', 'admission.json.tmp'])('rejects a real FIFO at %s within a bounded child lifetime', async filename => {
  const path = await directory(); execFileSync('mkfifo', [join(path, filename)]);
  const modulePath = fileURLToPath(new URL('./admission-journal.ts', import.meta.url));
  const runtime = process.env.FLOW_RUNNER_TEST_TSX_LOADER ?? createRequire(import.meta.url).resolve('tsx');
  const tsconfig = process.env.FLOW_RUNNER_TEST_TSCONFIG;
  const script = `import { AdmissionJournal, AdmissionStorageError } from ${JSON.stringify(modulePath)};
    try { const journal = await AdmissionJournal.open(${JSON.stringify(path)}); ${filename.endsWith('.tmp') ? 'await journal.begin();' : ''} process.exitCode = 3; }
    catch(error) { if (!(error instanceof AdmissionStorageError)) throw error; process.stdout.write('bounded-storage-rejection'); }`;
  const child = spawnSync(process.execPath, ['--import', runtime, '--input-type=module', '-e', script], {
    env: { ...process.env, ...(tsconfig ? { TSX_TSCONFIG_PATH: tsconfig } : {}) },
    encoding: 'utf8', timeout: 2000,
  });
  expect({ exit: child.status, signal: child.signal, error: child.error?.message, stderr: child.stderr }).toEqual({ exit: 0, signal: null, error: undefined, stderr: '' });
  expect(child.stdout).toBe('bounded-storage-rejection');
});
