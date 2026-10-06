import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { goalJournal, readRecord, writeRecord } from './records.mjs';
test('intake and session namespaces retain exact key and body across reopening and explicit clear', async () => {
  const root = await mkdtemp(join(tmpdir(), 'flow-o16-record-unit-'));
  try {
    const first = goalJournal(root), intent = { key: 'same-key', input: { prompt: 'same-body' }, goalId: null };
    assert.equal(await first.load('entry'), null); await first.save('entry', intent);
    assert.deepEqual(await goalJournal(root).load('entry'), intent); assert.equal(await first.load('session'), null);
    const path = join(root, (await readdir(root))[0]); assert.equal((await stat(path)).mode & 0o777, 0o600);
    await first.save('entry', null); assert.equal(await goalJournal(root).load('entry'), null);
  } finally { await rm(root, { recursive: true }); }
});
test('exclusive checkpoints cannot be overwritten and malformed or overbound records stay unknown', async () => {
  const root = await mkdtemp(join(tmpdir(), 'flow-o16-record-unit-'));
  try {
    const file = join(root, 'checkpoint.json'); await writeRecord(file, { phase: 'reserved' }, { exclusive: true });
    await assert.rejects(writeRecord(file, { phase: 'reset' }, { exclusive: true }), { code: 'EEXIST' });
    await assert.rejects(writeRecord(file, { payload: 'x'.repeat(100) }, { limit: 20 }));
    assert.deepEqual(await readRecord(file), { phase: 'reserved' });
    await writeFile(file, '{'); await assert.rejects(readRecord(file));
    assert.equal((await readdir(root)).length, 1);
  } finally { await rm(root, { recursive: true }); }
});
