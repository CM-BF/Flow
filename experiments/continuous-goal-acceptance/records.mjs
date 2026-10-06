import assert from 'node:assert/strict';
import { constants } from 'node:fs';
import { open, rename } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';
export const digest = value => createHash('sha256').update(value).digest('hex');
export async function syncDirectory(path) { const h = await open(path, 'r'); try { await h.sync(); } finally { await h.close(); } }
export async function readRecord(path, limit = 65_536) {
  const h = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const info = await h.stat(); assert(info.isFile() && info.size <= limit);
    const bytes = Buffer.alloc(limit + 1); let n = 0;
    while (n < bytes.length) { const read = await h.read(bytes, n, bytes.length - n, null); if (!read.bytesRead) break; n += read.bytesRead; }
    assert(n <= limit); return JSON.parse(new TextDecoder('utf8', { fatal: true }).decode(bytes.subarray(0, n)));
  } finally { await h.close(); }
}
/** Only host-owned fixed paths; a failed atomic replacement stays unknown and is never silently cleared. */
export async function writeRecord(path, value, { exclusive = false, limit = 262_144 } = {}) {
  const bytes = Buffer.from(JSON.stringify(value, null, 2) + '\n'); assert(bytes.length <= limit);
  const temporary = exclusive ? path : `${path}.${randomUUID()}.tmp`;
  const h = await open(temporary, 'wx', 0o600);
  try { await h.writeFile(bytes); await h.sync(); } finally { await h.close(); }
  if (!exclusive) await rename(temporary, path);
  await syncDirectory(dirname(path));
}
export function goalJournal(directory) {
  return {
    async load(namespace) {
      try { const record = await readRecord(join(directory, digest(namespace) + '.json')); assert.equal(record.namespace, namespace); return record.value; }
      catch (error) { if (error.code === 'ENOENT') return null; throw error; }
    },
    save(namespace, value) { return writeRecord(join(directory, digest(namespace) + '.json'), { namespace, value }); },
  };
}
