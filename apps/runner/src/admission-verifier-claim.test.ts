import { mkdtemp, lstat, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, expect, test } from 'vitest';
import { AdmissionJournal, AdmissionStorageError } from './admission-journal.js';
import { VERIFIER_BINDING_PROTOCOL } from '../../../packages/contracts/src/verifier-runner-claim.js';
const verifier = { bindingProtocol: VERIFIER_BINDING_PROTOCOL, storeId: 'verifier-store', hostApiMajor: 1 as const,
  algorithms: [{ id: 'flow.json-object.required-keys' as const, version: 1 as const }] };
const tool = { bindingProtocol: 'flow.plugin-runtime.v1' as const, storeId: 'tool-store', hostApiMajor: 1 as const };
const runnerId = randomUUID();
const assigned = () => ({ taskId: randomUUID(), attemptId: randomUUID(), runnerId, ownerVersion: 1 });
const roots: { path: string; dev: number; ino: number; removed: boolean }[] = [];
afterEach(async () => {
  for (const root of roots.filter(value => !value.removed)) {
    const current = await lstat(root.path);
    if (current.dev !== root.dev || current.ino !== root.ino || current.isSymbolicLink()) throw new Error('Fixture identity changed; keep root.');
    await rm(root.path, { recursive: true }); root.removed = true;
  }
});
afterAll(async () => {
  for (const root of roots) await expect(lstat(root.path)).rejects.toMatchObject({ code: 'ENOENT' });
  if (process.env.FLOW_AV03_FIXTURES) await writeFile(process.env.FLOW_AV03_FIXTURES, JSON.stringify({ roots }) + '\n', { flag: 'wx' });
});
async function fixture() {
  const path = await mkdtemp(join(tmpdir(), 'flow-verifier-journal-')); const stat = await lstat(path); roots.push({ path, dev: stat.dev, ino: stat.ino, removed: false });
  return { path, journal: await AdmissionJournal.open(path), raw: () => readFile(join(path, 'admission.json'), 'utf8') };
}
test('AV03 clean v1 selects v4 once with detached capability and no empty-poll writes', async () => {
  const f = await fixture(); const capability = structuredClone(verifier); const binding = f.journal.bindVerifierRunner(runnerId, capability);
  capability.storeId = 'mutated'; capability.algorithms.length = 0; expect(await binding).toBe(true);
  const request = f.journal.verifierOpportunity!; expect(request.pluginVerifierExecution).toEqual(verifier); expect(request.pluginToolExecution).toBeUndefined();
  const first = await lstat(join(f.path, 'admission.json'), { bigint: true });
  for (let i = 0; i < 3; i++) await f.journal.bindVerifierRunner(runnerId, verifier);
  const last = await lstat(join(f.path, 'admission.json'), { bigint: true }); expect([last.ino, last.mtimeNs]).toEqual([first.ino, first.mtimeNs]);
  const reopened = await AdmissionJournal.open(f.path); expect(reopened.verifierOpportunity).toEqual(request);
  request.pluginVerifierExecution.algorithms.length = 0; expect(reopened.verifierOpportunity!.pluginVerifierExecution.algorithms).toHaveLength(1);
  expect(() => reopened.opportunity).toThrow(AdmissionStorageError); expect(() => reopened.pluginOpportunity).toThrow(AdmissionStorageError);
  await expect(reopened.bindRunner(runnerId)).rejects.toBeInstanceOf(AdmissionStorageError);
  await expect(reopened.bindRunner(runnerId, tool)).rejects.toBeInstanceOf(AdmissionStorageError);
});
test('AV03 existing v2 v3 and uncertain or retained v1 never upgrade or lose identity', async () => {
  for (const kind of ['v2', 'v3', 'unknown', 'assignment']) {
    const f = await fixture();
    if (kind === 'v2') await f.journal.bindRunner(runnerId);
    else if (kind === 'v3') await f.journal.bindRunner(runnerId, tool);
    else { await f.journal.begin(); if (kind === 'assignment') await f.journal.accept(assigned()); }
    const before = await f.raw();
    if (kind === 'v2' || kind === 'v3') { await expect(f.journal.bindVerifierRunner(runnerId, verifier)).rejects.toBeInstanceOf(AdmissionStorageError); expect(() => f.journal.verifierOpportunity).toThrow(AdmissionStorageError); }
    else { expect(await f.journal.bindVerifierRunner(runnerId, verifier)).toBe(false); expect(f.journal.verifierOpportunity).toBeNull(); }
    expect(await f.raw()).toBe(before);
  }
});
test('AV03 acceptance persists assignment and next key together before reopening, with queued inputs detached', async () => {
  const f = await fixture(); await f.journal.bindVerifierRunner(runnerId, verifier, tool); const request = f.journal.verifierOpportunity!; const assignment = assigned(); const original = { ...assignment };
  const pending = f.journal.acceptOpportunity(request, assignment); request.pluginVerifierExecution.storeId = 'mutated'; request.pluginToolExecution!.storeId = 'mutated'; assignment.ownerVersion = 9; await pending;
  const reopened = await AdmissionJournal.open(f.path); const next = reopened.verifierOpportunity!;
  expect(next.requestId).not.toBe(request.requestId); expect(next.pluginVerifierExecution).toEqual(verifier); expect(next.pluginToolExecution).toEqual(tool);
  expect(reopened.unresolved(new Set())).toBe(true); expect(reopened.unresolved(new Set([original.attemptId]))).toBe(false);
  await reopened.complete({ ...original, ownerVersion: 9 }); expect(reopened.unresolved(new Set())).toBe(true);
  await reopened.complete(original); expect(reopened.unresolved(new Set())).toBe(false);
  await expect(reopened.acceptOpportunity({ ...next, requestId: request.requestId }, original)).rejects.toBeInstanceOf(AdmissionStorageError);
});
test('AV03 changed capability and wrong acknowledgement preserve the original unknown key', async () => {
  const f = await fixture(); await f.journal.bindVerifierRunner(runnerId, verifier, tool); const before = await f.raw(); const request = f.journal.verifierOpportunity!;
  await expect(f.journal.bindVerifierRunner(runnerId, verifier)).rejects.toBeInstanceOf(AdmissionStorageError);
  await expect(f.journal.bindVerifierRunner(randomUUID(), verifier, tool)).rejects.toBeInstanceOf(AdmissionStorageError);
  await expect(f.journal.bindVerifierRunner(runnerId, { ...verifier, storeId: 'wrong' }, tool)).rejects.toBeInstanceOf(AdmissionStorageError);
  await expect(f.journal.acceptOpportunity({ ...request, pluginToolExecution: { ...tool, storeId: 'wrong' } }, assigned())).rejects.toBeInstanceOf(AdmissionStorageError);
  await expect(f.journal.acceptOpportunity(request, { ...assigned(), runnerId: randomUUID() })).rejects.toBeInstanceOf(AdmissionStorageError);
  expect(await f.raw()).toBe(before); expect((await AdmissionJournal.open(f.path)).verifierOpportunity).toEqual(request);
});
test('AV03 rejected persistence retains the same request and does not accept an assignment', async () => {
  const f = await fixture(); await f.journal.bindVerifierRunner(runnerId, verifier); const before = await f.raw(); const request = f.journal.verifierOpportunity!;
  await mkdir(join(f.path, 'admission.json.tmp'));
  await expect(f.journal.acceptOpportunity(request, assigned())).rejects.toBeInstanceOf(AdmissionStorageError);
  expect(await f.raw()).toBe(before); const reopened = await AdmissionJournal.open(f.path); expect(reopened.verifierOpportunity).toEqual(request); expect(reopened.unresolved(new Set())).toBe(false);
});
test('AV03 corrupt v4 qualification fails closed and legacy writes cannot reinterpret v4', async () => {
  const f = await fixture(); await f.journal.bindVerifierRunner(runnerId, verifier); const before = await f.raw();
  await expect(f.journal.begin()).rejects.toThrow(); await expect(f.journal.accept(null)).rejects.toThrow(); expect(await f.raw()).toBe(before);
  const broken = JSON.parse(before); broken.request.pluginVerifierExecution.algorithms = []; await writeFile(join(f.path, 'admission.json'), JSON.stringify(broken));
  await expect(AdmissionJournal.open(f.path)).rejects.toBeInstanceOf(AdmissionStorageError);
});
