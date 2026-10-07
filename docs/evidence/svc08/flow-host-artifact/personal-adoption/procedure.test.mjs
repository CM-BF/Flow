import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, lstat } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { requireFresh, protection, requestFrom, migrateOnce } from './procedure.mjs';
const input = JSON.parse(await readFile(new URL('./inputs.json', import.meta.url)));
function facts() {
  return { rootIdentity: { dev: 1, ino: 2 }, identity: { runnerId: 'one' }, runtimeSource: { head: input.requestTemplate.expectedBackendHead, dirty: false }, protectedState: 'stable',
    files: Object.fromEntries(['config.json','claude.json','maintenance.json','web-release.json'].map(name => [name, { sha256: 'fixed' }])),
    processes: Object.fromEntries(['center','runner','web'].map(role => [role, { identity: 'running', pid: 1, recordSha256: role }])),
    listeners: { center: true, web: true }, release: structuredClone(input.historicalOnly.release),
    retained: input.historicalOnly.release.artifacts.map(artifact => ({ artifact, compatibilityId: input.historicalOnly.release.compatibilityIds[artifact.artifactId] })),
    database: { markerMatched: true, runnerIdentityMatched: true, runner: [{ maintenance_version: 18, maintenance_state: 'accepting', maintenance_operation_id: null }],
      tasks: [{ status: 'running' }], unfinished: [{ id: 'actual-user-work' }], uncertain: [{ id: 'untouched' }], tables: [{ name: 'tasks', count: 1, raw_digest: 'one', protected_digest: 'one' }] } };
}
function ports(failAt = null) {
  const calls = []; const hit = name => async () => { calls.push(name); if (name === failAt) throw Object.assign(Error(), { code: 'INJECTED' }); };
  return { calls, value: { intent: hit('intent'), inspectStore: async () => false, clone: hit('clone'), verify: hit('verify'), syncStage: hit('sync'),
    checkpoint: hit('checkpoint'), publishExclusive: hit('rename'), syncParents: hit('parents'), result: async result => { calls.push(result.outcome); } } };
}
test('fresh Web-only gate accepts nonzero user work and uncertain tasks without mutating facts', () => {
  const value = facts(), before = structuredClone(value); requireFresh(value, {}, input); assert.deepEqual(value, before);
});
test('non-Web identity or maintenance drift fails the existing preservation gates', () => {
  const value = facts(); value.database.runner[0].maintenance_version = 19; assert.throws(() => requireFresh(value, {}, input));
  const changed = facts(); changed.processes.runner.pid = 7; assert.equal(protection(facts(), changed).protected, false);
});
test('business changes remain explicitly unknown and never authorize rollback or reset', () => {
  const before = facts(), after = facts(); after.database.tables[0].protected_digest = 'user-message';
  const result = protection(before, after); assert.equal(result.protected, true); assert.equal(result.businessObservation, 'UNKNOWN_CONCURRENT_CHANGE');
  assert.deepEqual(result.changedTables, ['tasks']); assert.equal(result.businessWritesByOperator, 0);
});
test('request freezes exact fresh CAS and fixed artifact without mutating the template', () => {
  const original = structuredClone(input.requestTemplate), value = requestFrom(facts(), '11111111-1111-1111-1111-111111111111', input);
  assert.equal(Object.keys(value).length, 9); assert.equal(value.expectedWebRecordSha256, 'web'); assert.equal(value.expectedPointerSha256, 'fixed');
  assert.deepEqual(input.requestTemplate, original); assert.deepEqual(value.webHostArtifact, input.artifact);
});
test('durable intent then verification/fsync/checkpoint precede exclusive publish', async () => {
  const p = ports(); await migrateOnce(p.value);
  assert.deepEqual(p.calls, ['intent','clone','verify','sync','checkpoint','rename','parents','verify','migrated']);
});
test('checkpoint failure prevents rename and leaves explicit unknown', async () => {
  const p = ports('checkpoint'); await assert.rejects(migrateOnce(p.value)); assert.ok(!p.calls.includes('rename')); assert.equal(p.calls.at(-1), 'unknown');
});
test('rename ACK failure is preserved once with no replay, delete or second rename', async () => {
  const p = ports('rename'); await assert.rejects(migrateOnce(p.value)); assert.equal(p.calls.filter(v => v === 'rename').length, 1); assert.equal(p.calls.at(-1), 'unknown');
});
test('preexisting target is fully verified and never cloned or published again', async () => {
  const p = ports(); p.value.inspectStore = async () => true; await migrateOnce(p.value); assert.deepEqual(p.calls, ['intent','verify','already-present-exact']);
});
test('existing Darwin exclusive rename rejects overwrite and preserves both tiny directories', async () => {
  const root = await mkdtemp(join(tmpdir(), 'svc08-adoption-tiny-')); const identity = await lstat(root);
  try {
    const from = join(root, 'from'), to = join(root, 'to'); await mkdir(from); await mkdir(to);
    await writeFile(join(from, 'source'), 'original'); await writeFile(join(to, 'target'), 'keep');
    const { renameExclusive } = await import(pathToFileURL(input.renameModule).href);
    await assert.rejects(renameExclusive(from, to));
    assert.equal(await readFile(join(from, 'source'), 'utf8'), 'original'); assert.equal(await readFile(join(to, 'target'), 'utf8'), 'keep');
    const fresh = join(root, 'fresh'); await renameExclusive(from, fresh); assert.equal(await readFile(join(fresh, 'source'), 'utf8'), 'original');
  } finally { const current = await lstat(root); assert.equal(current.dev, identity.dev); assert.equal(current.ino, identity.ino); await rm(root, { recursive: true }); }
});
