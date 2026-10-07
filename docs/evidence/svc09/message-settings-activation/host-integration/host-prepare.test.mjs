import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, readdir, lstat, chmod, unlink, rmdir } from 'node:fs/promises';
import { join } from 'node:path';
import { validateArguments } from './host-entry.mjs';
import { mayDrop, ownedRecords } from './host-cleanup.mjs';
import { localAdmin, poolOptions, exclusive } from './host-fixture.mjs';
import { recorder, privateJson, failure } from './host-records.mjs';

test('work entry and local admin reject wrong routes before IO', () => {
  assert.throws(() => validateArguments(['--work-once', '/Users/citrine/private/input.json']));
  assert.throws(() => validateArguments(['--cleanup-once', '/private/tmp/flow-svc09a-host-fixture/input.json']));
  assert.equal(validateArguments(['--work-once', '/private/tmp/flow-svc09a-host-fixture/input.json']), '/private/tmp/flow-svc09a-host-fixture/input.json');
  assert.throws(() => localAdmin('postgres://127.0.0.1/notpostgres'));
  assert.throws(() => localAdmin('postgres://remote.invalid/postgres'));
  const options = poolOptions(localAdmin('postgres://127.0.0.1/postgres').href);
  assert.equal(options.max, 1); assert.equal(options.query_timeout, 1500); assert.equal(options.statement_timeout, 1250);
});

const clear = () => ({ outer: { owned_state: 'absent', eof: { stdout: true, stderr: true }, exit_code: 0, first_failure: null },
  work: { workComplete: true, primary: null, cleanupFailures: [] }, closure: { loopsSettled: true, errors: [null, null] }, allStopped: true, databaseCreated: true });
test('DROP requires actual work owner and every service generation to finish', () => {
  assert.equal(mayDrop(clear()), true);
  for (const key of ['allStopped', 'databaseCreated']) assert.equal(mayDrop({ ...clear(), [key]: false }), false);
  for (const change of [{ owned_state: 'unknown' }, { eof: { stdout: true, stderr: false } }, { exit_code: 1 }, { first_failure: { code: 'X' } }]) {
    const value = clear(); Object.assign(value.outer, change); assert.equal(mayDrop(value), false);
  }
});
test('primary failure, uncertain close or unfinished async loop cannot authorize DROP', () => {
  for (const change of [{ workComplete: false }, { primary: { code: 'FIRST_FAILURE' } }, { cleanupFailures: [{}] }]) {
    const value = clear(); Object.assign(value.work, change); assert.equal(mayDrop(value), false);
  }
  for (const closure of [null, { loopsSettled: false, errors: [null, null] }, { loopsSettled: true, errors: [null, {}] }]) assert.equal(mayDrop({ ...clear(), closure }), false);
});

const directory = '/private/tmp/flow-svc09a-host-fixture';
const processRecord = id => ({ pid: id, group: id, nonce: `nonce-${id}`, startedAt: 'fixed synthetic identity',
  command: `node /fixed/cli internal-service ${directory} runner --flow-preview=nonce-${id}` });
test('generation collection keeps eight real records and does not reinterpret stop-summary strings', () => {
  const first = { center: processRecord(101), runner: processRecord(102), web: processRecord(103) };
  const active = { ...first, 'runner-settings': processRecord(104) };
  const second = { center: processRecord(201), runner: processRecord(202), web: processRecord(203), 'runner-settings': processRecord(204) };
  const rows = [{ phase: 'default-legacy', fact: { processes: first } }, { phase: 'settings-published', fact: { processes: active } },
    { phase: 'both-refreshed-held', fact: { processes: second } }, { phase: 'all-host-slots-stopped', fact: { processes: { center: 'stopped' } } }];
  assert.equal(ownedRecords(rows, { processes: second }, directory).length, 8);
  assert.throws(() => ownedRecords(rows, { processes: { foreign: processRecord(301) } }, directory));
  assert.throws(() => ownedRecords(rows, { processes: { runner: { ...second.runner, command: 'node /other/installation' } } }, directory));
  const pending = { ...processRecord(301), command: null, startedAt: null };
  assert.deepEqual(ownedRecords([], { processes: { runner: pending } }, directory), [{ role: 'runner', record: pending }]);
});

test('checkpoint records are private and reject secret fields; reader refuses a changed access mode', async () => {
  const scratch = process.env.FLOW_SVC09A_PREPARE_SCRATCH;
  assert.match(scratch ?? '', /^\/private\/tmp\/flow-svc09a-host-preparation-/);
  const records = join(scratch, 'records'); await mkdir(records, { mode: 0o700 }); const identity = await lstat(records);
  try {
    const checkpoint = recorder({ records }, 'work');
    await assert.rejects(checkpoint('forbidden', { ownerToken: 'synthetic-secret-not-persisted' }));
    assert.deepEqual(await readdir(records), []);
    await checkpoint('fixture', { safe: true });
    const [name] = await readdir(records), path = join(records, name);
    assert.equal((await lstat(path)).mode & 0o777, 0o600);
    assert.equal((await privateJson(path)).fact.safe, true);
    await chmod(path, 0o644); await assert.rejects(privateJson(path)); await chmod(path, 0o600);
    assert.ok(!(await readFile(path, 'utf8')).includes('synthetic-secret'));
    await assert.rejects(exclusive(path, { replacement: true }), { code: 'EEXIST' });
  } finally {
    const current = await lstat(records); assert.equal(current.dev, identity.dev); assert.equal(current.ino, identity.ino);
    for (const name of await readdir(records)) { const p = join(records, name); const s = await lstat(p); assert.ok(s.isFile() && !s.isSymbolicLink()); await unlink(p); }
    await rmdir(records);
  }
});

test('error projection preserves structural cause without serializing exception or credentials', () => {
  assert.deepEqual(failure(Object.assign(new Error('postgres://secret'), { code: 'PRIMARY_FAILURE' }), 'work'),
    { phase: 'work', name: 'Error', code: 'PRIMARY_FAILURE' });
  assert.deepEqual(failure({ name: 'private text', code: 'token=secret', message: 'secret' }, 'cleanup'),
    { phase: 'cleanup', name: 'UnknownError', code: null });
});
