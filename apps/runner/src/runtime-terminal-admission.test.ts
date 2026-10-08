import { mkdtemp, mkdir, readFile, lstat, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, test, vi } from 'vitest';
import { FlowClient } from '@flow/client';
import type { ClaimedTask, EventBatch } from '@flow/contracts';
import { AdmissionJournal, AdmissionStorageError } from './admission-journal.js';
import { runRunner, type RunnerOptions } from './runtime.js';
import { textDigest } from './verifier.js';

const disk = vi.hoisted(() => ({ beforeUnlink: async (_path: string) => {}, failUnlink: false }));
vi.mock('node:fs/promises', async original => {
  const fs = await original<typeof import('node:fs/promises')>();
  return { ...fs, unlink: async (path: Parameters<typeof fs.unlink>[0]) => {
    if (String(path).endsWith('/pending-events.json')) {
      await disk.beforeUnlink(String(path));
      if (disk.failUnlink) { disk.failUnlink = false; throw new Error('Injected unlink failure'); }
    }
    return fs.unlink(path);
  } };
});
const roots: { path: string; dev: number; ino: number }[] = [];
afterEach(async () => {
  vi.restoreAllMocks(); disk.beforeUnlink = async () => {}; disk.failUnlink = false;
  for (const root of roots.splice(0)) {
    const current = await lstat(root.path);
    expect([current.dev, current.ino, current.isDirectory(), current.isSymbolicLink()]).toEqual([root.dev, root.ino, true, false]);
    await rm(root.path, { recursive: true });
  }
});
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'svc09b-terminal-')), info = await lstat(root);
  roots.push({ path: root, dev: info.dev, ino: info.ino });
  const baseUrl = 'http://unused.invalid', directory = join(root, textDigest(baseUrl)); await mkdir(directory);
  const identity = { runnerId: 'svc09b-runner', taskId: 'svc09b-task', attemptId: 'svc09b-attempt', ownerVersion: 2 };
  const assignment: ClaimedTask = { task: { id: identity.taskId, title: 'Synthetic', prompt: 'No provider', harness: 'fixture' },
    attempt: { id: identity.attemptId, runnerId: identity.runnerId, ownerVersion: 2, leaseExpiresAt: '2099-01-01T00:00:00.000Z' } };
  const stop = new AbortController(), reports: EventBatch[] = [], order: string[] = []; let calls = 0;
  vi.spyOn(FlowClient.prototype, 'runnerIdentity').mockResolvedValue({ protocol: 'flow.runner-claim.v2', runnerId: identity.runnerId });
  vi.spyOn(FlowClient.prototype, 'claimOpportunityStatus').mockImplementation(async input => ({ ...input, state: 'missing' }));
  const claim = vi.spyOn(FlowClient.prototype, 'claimOpportunity').mockImplementation(async input => ({ ...input, state: 'assigned', identity, assignment, remainingLeaseMs: 10000 }));
  vi.spyOn(FlowClient.prototype, 'heartbeat').mockResolvedValue({ action: 'continue', remainingLeaseMs: 10000, leaseExpiresAt: '2099-01-01T00:00:00.000Z', decision: null });
  const report = vi.spyOn(FlowClient.prototype, 'report').mockImplementation(async batch => {
    reports.push(batch); order.push('ack'); stop.abort();
    return { accepted: batch.events.length, lastSequence: batch.events.at(-1)!.sequence };
  });
  const options: RunnerOptions = { baseUrl, token: 'synthetic-only', workingDirectory: root, signal: stop.signal,
    adapters: [{ name: 'fixture', version: '1', async run() { calls++; } }], pollIntervalMs: 1 };
  const pending = join(directory, textDigest(identity.attemptId), 'pending-events.json');
  const journal = async () => JSON.parse(await readFile(join(directory, 'admission.json'), 'utf8'));
  async function restart() {
    const next = new AbortController(); options.signal = next.signal;
    const replayed: EventBatch[] = [];
    report.mockImplementation(async batch => { replayed.push(batch); next.abort(); return { accepted: 0, lastSequence: batch.events.at(-1)!.sequence }; });
    await runRunner(options); return replayed;
  }
  return { options, directory, pending, journal, identity, reports, report, order, claim, restart, calls: () => calls };
}

test('terminal admission: validated ACK clears durable journal before pending unlink', async () => {
  const f = await fixture(), complete = AdmissionJournal.prototype.complete;
  vi.spyOn(AdmissionJournal.prototype, 'complete').mockImplementation(async function (this: AdmissionJournal, ownership) {
    expect(JSON.parse(await readFile(f.pending, 'utf8'))).toEqual(f.reports[0]);
    expect((await f.journal()).assignments).toEqual([f.identity]);
    await complete.call(this, ownership); f.order.push('journal');
  });
  disk.beforeUnlink = async () => { expect((await f.journal()).assignments).toEqual([]); f.order.push('unlink'); };
  await runRunner(f.options);
  expect(f.order).toEqual(['ack', 'journal', 'unlink']); expect(f.calls()).toBe(1); expect(f.claim).toHaveBeenCalledTimes(1);
  await expect(lstat(f.pending)).rejects.toHaveProperty('code', 'ENOENT');
});

test('terminal admission: failed journal persistence retains batch and restart never repeats adapter', async () => {
  const f = await fixture();
  const complete = vi.spyOn(AdmissionJournal.prototype, 'complete').mockRejectedValueOnce(new AdmissionStorageError(new Error('Injected journal failure')));
  await expect(runRunner(f.options)).rejects.toBeInstanceOf(AdmissionStorageError);
  const saved = await readFile(f.pending, 'utf8'); expect((await f.journal()).assignments).toEqual([f.identity]);
  complete.mockRestore(); expect(await f.restart()).toEqual([JSON.parse(saved)]);
  expect(f.calls()).toBe(1); expect(f.claim).toHaveBeenCalledTimes(1); expect((await f.journal()).assignments).toEqual([]);
  await expect(lstat(f.pending)).rejects.toHaveProperty('code', 'ENOENT');
});

test('terminal admission: unlink failure keeps exact batch after journal clear and replays idempotently', async () => {
  const f = await fixture(); disk.failUnlink = true;
  await runRunner(f.options); const saved = await readFile(f.pending, 'utf8');
  expect((await f.journal()).assignments).toEqual([]); expect(await f.restart()).toEqual([JSON.parse(saved)]);
  expect(f.calls()).toBe(1); expect(f.claim).toHaveBeenCalledTimes(1); expect((await f.journal()).assignments).toEqual([]);
  await expect(lstat(f.pending)).rejects.toHaveProperty('code', 'ENOENT');
});

test('terminal admission: invalid ACK retains original assignment and pending event', async () => {
  const f = await fixture(), original = f.report.getMockImplementation()!;
  f.report.mockImplementation(async (...args) => ({ ...await original(...args), accepted: -1 }));
  const complete = vi.spyOn(AdmissionJournal.prototype, 'complete'); await runRunner(f.options);
  expect(complete).not.toHaveBeenCalled(); expect((await f.journal()).assignments).toEqual([f.identity]);
  expect(JSON.parse(await readFile(f.pending, 'utf8'))).toEqual(f.reports[0]); expect(f.calls()).toBe(1);
});
