// Private mutable material and manifest-pinned read-only runtime have different ownership contracts.
import assert from 'node:assert/strict';
import { constants } from 'node:fs';
import { open, realpath } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
async function readRegular(path, limit, validate, bigint = false) {
  assert.ok(Number.isSafeInteger(limit) && limit >= 0 && limit <= 32 * 1024 ** 2);
  const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const before = await file.stat({ bigint }); assert.ok(before.isFile() && before.size <= (bigint ? BigInt(limit) : limit)); validate(before);
    const buffer = Buffer.alloc(limit + 1); let length = 0;
    while (length < buffer.length) { const row = await file.read(buffer, length, buffer.length - length, null); if (!row.bytesRead) break; length += row.bytesRead; }
    const after = await file.stat({ bigint }); assert.ok(length <= limit);
    for (const key of ['dev','ino','uid','nlink','size', bigint ? 'mtimeNs' : 'mtimeMs']) assert.equal(after[key], before[key], 'FILE_CHANGED_DURING_READ');
    return { bytes: buffer.subarray(0, length), info: before };
  } finally { await file.close(); }
}
export function privateBytes(path, limit = 65536) {
  return readRegular(path, limit, info => {
    assert.equal(info.uid, process.getuid(), 'PRIVATE_OWNER'); assert.equal(info.nlink, 1, 'PRIVATE_HARDLINK');
  });
}
export async function runtimeBytes(binding, path = binding.path) {
  for (const key of ['uid','nlink','bytes']) assert.ok(Number.isSafeInteger(binding[key]) && binding[key] >= 0, 'RUNTIME_IDENTITY_PIN_REQUIRED');
  for (const key of ['dev','ino']) assert.match(binding[key], /^(0|[1-9][0-9]*)$/, 'EXACT_DECIMAL_IDENTITY_REQUIRED');
  assert.ok(binding.nlink >= 1 && typeof binding.realpath === 'string' && binding.realpath.startsWith('/'));
  assert.match(binding.sha256, /^[a-f0-9]{64}$/);
  const result = await readRegular(path, binding.bytes, info => {
    for (const key of ['uid','nlink','dev','ino']) assert.equal(info[key], BigInt(binding[key]), `RUNTIME_${key.toUpperCase()}`);
    assert.equal(info.size, BigInt(binding.bytes));
  }, true);
  assert.equal(await realpath(path), binding.realpath);
  assert.equal(result.bytes.length, binding.bytes); assert.equal(digest(result.bytes), binding.sha256);
  return result;
}
