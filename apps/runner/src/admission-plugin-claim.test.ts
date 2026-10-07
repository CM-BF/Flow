import { mkdtemp, lstat, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, expect, test } from 'vitest';
import { PLUGIN_RUNTIME_PROTOCOL } from '../../../packages/contracts/src/plugin-runtime.js';
import { AdmissionJournal, AdmissionStorageError } from './admission-journal.js';

const host = { bindingProtocol: PLUGIN_RUNTIME_PROTOCOL, storeId: 'owned-store', hostApiMajor: 1 as const };
const runnerId = randomUUID();
const assignment = { taskId: randomUUID(), attemptId: randomUUID(), runnerId, ownerVersion: 1 };
const roots: { path: string; dev: number | null; ino: number | null; removed: boolean }[] = [];
afterEach(async () => {
  for (const root of roots.filter(item => !item.removed)) {
    const s = await lstat(root.path);
    if (!s.isDirectory() || s.isSymbolicLink() || s.dev !== root.dev || s.ino !== root.ino) throw new Error('Fixture identity changed; keep root.');
    await rm(root.path, { recursive: true }); root.removed = true;
  }
});
afterAll(async () => {
  const absent = [];
  for (const root of roots) {
    try { await lstat(root.path); absent.push(false); }
    catch (error) { if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error; absent.push(true); }
  }
  if (process.env.FLOW_X01_PLUGIN_CLAIM_FACTS) await writeFile(process.env.FLOW_X01_PLUGIN_CLAIM_FACTS,
    JSON.stringify({ roots, absent }) + '\n', { flag: 'wx', mode: 0o600 });
  expect(absent.every(Boolean)).toBe(true);
});
async function fixture() {
  const path = await mkdtemp(join(tmpdir(), 'flow-plugin-admission-'));
  const root = { path, dev: null as number | null, ino: null as number | null, removed: false }; roots.push(root);
  const s = await lstat(path); root.dev = s.dev; root.ino = s.ino;
  return { path, journal: await AdmissionJournal.open(path), raw: () => readFile(join(path, 'admission.json'), 'utf8') };
}
test('persists the complete v3 request and reuses it without empty-poll writes across restart', async () => {
  const { path, journal, raw } = await fixture(); const qualification = { ...host };
  const binding = journal.bindRunner(runnerId, qualification); qualification.storeId = 'mutated-after-bind'; await binding;
  const request = journal.pluginOpportunity!; const first = await lstat(join(path, 'admission.json'), { bigint: true });
  for (let n = 0; n < 12; n++) await journal.bindRunner(runnerId, host);
  const last = await lstat(join(path, 'admission.json'), { bigint: true });
  expect([last.ino, last.mtimeNs]).toEqual([first.ino, first.mtimeNs]);
  expect(JSON.parse(await raw())).toEqual({ version: 3, request, assignments: [] });
  const restarted = await AdmissionJournal.open(path); await restarted.bindRunner(runnerId, host);
  expect(restarted.pluginOpportunity).toEqual(request); expect(restarted.unresolved(new Set())).toBe(false);
  request.pluginToolExecution.storeId = 'mutated'; expect(restarted.pluginOpportunity!.pluginToolExecution.storeId).toBe('owned-store');
});
test('downgrade, changed runner or changed current host preserve the unknown original key', async () => {
  const { path, journal, raw } = await fixture(); await journal.bindRunner(runnerId, host); const before = await raw();
  const restarted = await AdmissionJournal.open(path);
  await expect(restarted.bindRunner(runnerId)).rejects.toBeInstanceOf(AdmissionStorageError);
  await expect(restarted.bindRunner(randomUUID(), host)).rejects.toBeInstanceOf(AdmissionStorageError);
  await expect(restarted.bindRunner(runnerId, { ...host, storeId: 'changed' })).rejects.toBeInstanceOf(AdmissionStorageError);
  expect(() => restarted.opportunity).toThrow(AdmissionStorageError); expect(await raw()).toBe(before);
});
test('v2 and uncertain v1 cannot silently become v3 opportunities', async () => {
  const { journal, raw } = await fixture(); await journal.bindRunner(runnerId); const request = journal.opportunity!; const before = await raw();
  await expect(journal.bindRunner(runnerId, host)).rejects.toBeInstanceOf(AdmissionStorageError);
  expect(() => journal.pluginOpportunity).toThrow(AdmissionStorageError); expect(journal.opportunity).toEqual(request); expect(await raw()).toBe(before);
  const second = await fixture(); await second.journal.begin(); const uncertain = await second.raw();
  expect(await second.journal.bindRunner(runnerId, host)).toBe(false); expect(second.journal.pluginOpportunity).toBeNull(); expect(await second.raw()).toBe(uncertain);
});
test('atomic acceptance retains the assignment and same qualification under the next key', async () => {
  const { path, journal } = await fixture(); await journal.bindRunner(runnerId, host); const request = journal.pluginOpportunity!;
  await expect(journal.acceptOpportunity({ ...request, pluginToolExecution: { ...host, storeId: 'wrong' } }, assignment)).rejects.toBeInstanceOf(AdmissionStorageError);
  const accepted = journal.acceptOpportunity(request, assignment); request.pluginToolExecution.storeId = 'mutated-after-call'; await accepted;
  const restarted = await AdmissionJournal.open(path); await restarted.bindRunner(runnerId, host);
  expect(restarted.pluginOpportunity!.requestId).not.toBe(request.requestId); expect(restarted.pluginOpportunity!.pluginToolExecution).toEqual(host);
  expect(restarted.unresolved(new Set())).toBe(true); expect(restarted.unresolved(new Set([assignment.attemptId]))).toBe(false);
  await restarted.complete({ ...assignment, ownerVersion: 2 }); expect(restarted.unresolved(new Set())).toBe(true);
  await restarted.complete(assignment); expect(restarted.unresolved(new Set())).toBe(false);
});
test('failed durable acceptance leaves the original request on disk and never reports it accepted', async () => {
  const { path, journal, raw } = await fixture(); await journal.bindRunner(runnerId, host); const before = await raw();
  await mkdir(join(path, 'admission.json.tmp'));
  await expect(journal.acceptOpportunity(journal.pluginOpportunity!, assignment)).rejects.toBeInstanceOf(AdmissionStorageError);
  expect(await raw()).toBe(before); expect((await AdmissionJournal.open(path)).pluginOpportunity).toEqual(journal.pluginOpportunity);
});
test('v2 callers still accept and complete a durable assignment with their original API', async () => {
  const { path, journal } = await fixture(); await journal.bindRunner(runnerId); const request = journal.opportunity!;
  await journal.acceptOpportunity(request, assignment); const restarted = await AdmissionJournal.open(path);
  expect(restarted.opportunity!.requestId).not.toBe(request.requestId); expect(restarted.unresolved(new Set())).toBe(true);
  await restarted.complete(assignment); expect(restarted.unresolved(new Set())).toBe(false);
});
