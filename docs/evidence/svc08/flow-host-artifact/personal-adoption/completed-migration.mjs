import assert from 'node:assert/strict';
import { lstat, realpath } from 'node:fs/promises';
import { join } from 'node:path';
import { privateBytes } from './file-readers.mjs';
import { sha } from './procedure.mjs';

const names = ['reservation.json', 'migration-result.json', 'migration-checkpoint.json', 'migration-before.json', 'migrate-outer.json'];

export async function readCompletedMigration(input, artifact) {
  assert.deepEqual(input.files.map(row => row.name).sort(), [...names].sort());
  const root = await lstat(input.directory);
  assert.ok(root.isDirectory() && !root.isSymbolicLink() && root.uid === process.getuid() && (root.mode & 0o777) === 0o700);
  assert.equal(root.dev, input.identity.dev); assert.equal(root.ino, input.identity.ino);
  assert.equal(await realpath(input.directory), input.directory);
  const records = {};
  for (const row of input.files) {
    assert.ok(Number.isSafeInteger(row.bytes) && row.bytes >= 0 && row.bytes <= 64 * 1024);
    const { bytes, info } = await privateBytes(join(input.directory, row.name), row.bytes);
    assert.equal(info.mode & 0o777, 0o600);
    assert.equal(info.dev, row.dev); assert.equal(info.ino, row.ino);
    assert.equal(bytes.length, row.bytes); assert.equal(sha(bytes), row.sha256);
    records[row.name] = JSON.parse(bytes);
  }
  const after = await lstat(input.directory);
  assert.equal(after.dev, root.dev); assert.equal(after.ino, root.ino);
  assert.ok(after.isDirectory() && !after.isSymbolicLink() && after.uid === root.uid && after.mode === root.mode);
  const reservation = records['reservation.json'], result = records['migration-result.json'];
  const checkpoint = records['migration-checkpoint.json'], outer = records['migrate-outer.json'];
  assert.deepEqual(reservation.identity, input.identity);
  assert.equal(reservation.inputSha256, input.inputSha256);
  assert.equal(result.outcome, 'migrated'); assert.deepEqual(result.artifact, artifact);
  assert.equal(checkpoint.phase, 'verified-and-synced-before-exclusive-rename');
  assert.equal(outer.exit_code, 0); assert.equal(outer.first_failure, null); assert.equal(outer.owned_state, 'absent');
  assert.deepEqual(outer.eof, { stdout: true, stderr: true });
  assert.deepEqual(JSON.parse(outer.stdout), { phase: 'migrate', outcome: 'complete' });
  return { reservation, result, checkpoint, before: records['migration-before.json'] };
}
