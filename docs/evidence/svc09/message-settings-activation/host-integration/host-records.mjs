// Evidence for one disposable installation. Never serializes its credentials or an exception message.
import assert from 'node:assert/strict';
import { lstat, readFile, readdir, realpath } from 'node:fs/promises';
import { join } from 'node:path';
import { exclusive } from './host-fixture.mjs';

export function failure(error, phase) {
  const name = ['Error', 'TypeError', 'RangeError', 'AssertionError', 'AbortError', 'TimeoutError'].includes(error?.name) ? error.name : 'UnknownError';
  if (error?.code === 'MIXED_TASK_QUERY_FAILED') {
    const sqlState = error.cause?.code;
    return { phase: 'mixed-final-task-query', sourcePhase: phase, name, code: error.code,
      sqlState: typeof sqlState === 'string' && sqlState.length === 5 && /^[0-9A-Z]{5}$/.test(sqlState) ? sqlState : null };
  }
  return { phase, name, code: /^[A-Z][A-Z0-9_]{0,63}$/.test(error?.code ?? '') ? error.code : null };
}

export async function privateJson(path, limit = 65536) {
  const before = await lstat(path, { bigint: true });
  assert.ok(before.isFile() && !before.isSymbolicLink() && before.uid === BigInt(process.getuid()) && before.nlink === 1n
    && (before.mode & 0o777n) === 0o600n && before.size <= BigInt(limit), 'OWNED_PRIVATE_RECORD_REQUIRED');
  const data = await readFile(path), after = await lstat(path, { bigint: true });
  assert.equal(after.dev, before.dev); assert.equal(after.ino, before.ino); assert.equal(after.mtimeNs, before.mtimeNs);
  assert.equal(data.length, Number(before.size)); return JSON.parse(data.toString('utf8'));
}

export async function rootIdentity(input) {
  const info = await lstat(input.directory, { bigint: true });
  assert.ok(info.isDirectory() && !info.isSymbolicLink() && info.uid === BigInt(process.getuid()) && (info.mode & 0o777n) === 0o700n);
  assert.equal(await realpath(input.directory), input.directory);
  assert.deepEqual({ dev: String(info.dev), ino: String(info.ino) }, input.directoryIdentity);
}

function noSecrets(value) {
  if (Array.isArray(value)) { for (const entry of value) noSecrets(entry); return; }
  if (!value || typeof value !== 'object') return;
  for (const [key, entry] of Object.entries(value)) {
    assert.ok(!/^(?:token|ownerToken|adminUrl|databaseUrl|password|authorization|env)$/i.test(key), 'SECRET_FIELD_REFUSED');
    noSecrets(entry);
  }
}

export function recorder(input, prefix) {
  assert.ok(['work', 'cleanup'].includes(prefix)); let sequence = 0;
  return async (phase, fact, resources = null) => {
    assert.match(phase, /^[a-z][a-z0-9-]{0,63}$/); assert.ok(++sequence <= 64, 'CHECKPOINT_COUNT_LIMIT');
    noSecrets(fact);
    const value = { at: new Date().toISOString(), phase, fact, resources };
    const names = await readdir(input.records); assert.ok(names.length < 160, 'EVIDENCE_ENTRY_LIMIT');
    let bytes = Buffer.byteLength(JSON.stringify(value) + '\n');
    for (const name of names) bytes += (await lstat(join(input.records, name))).size;
    assert.ok(bytes <= 1024 * 1024, 'EVIDENCE_BYTE_LIMIT');
    await exclusive(join(input.records, `${prefix}-${String(sequence).padStart(2, '0')}-${phase}.json`), value);
    return value;
  };
}

export async function savedWork(input) {
  const names = (await readdir(input.records)).filter(name => /^work-\d{2}-[a-z0-9-]+\.json$/.test(name)).sort();
  assert.ok(names.length <= 64);
  const records = [];
  for (const name of names) records.push(await privateJson(join(input.records, name)));
  return records;
}
