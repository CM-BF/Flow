import { constants } from 'node:fs';
import { lstat, mkdir, open, readFile, rename, unlink } from 'node:fs/promises';
import { join, isAbsolute } from 'node:path';
import { randomUUID } from 'node:crypto';
import { intentSchema, type Intent, type IntentStore } from '@flow/interaction';
const maximum = 192 * 1024;

/** One private intent slot per explicit connection; exclusive owner for the process lifetime. */
export async function openIntentStore(directory: string, connectionId: string): Promise<IntentStore & { close(): Promise<void> }> {
  if (!isAbsolute(directory) || !/^[a-f0-9]{64}$/.test(connectionId)) throw new Error('Invalid private intent location');
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const parent = await lstat(directory);
  if (!parent.isDirectory() || parent.isSymbolicLink() || (parent.mode & 0o077) !== 0 || process.getuid && parent.uid !== process.getuid()) throw new Error('Intent directory must be private and owned');
  const path = join(directory, `${connectionId}.json`); const lockPath = `${path}.lock`;
  const lock = await open(lockPath, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW, 0o600);
  const lockIdentity = await lock.stat(); let closed = false;
  try { await lock.writeFile(JSON.stringify({ pid: process.pid })); await lock.sync(); } catch (error) { await lock.close(); await unlink(lockPath); throw error; }
  async function inspect() {
    if (closed) throw new Error('Intent store closed');
    try {
      const info = await lstat(path);
      if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1 || (info.mode & 0o077) !== 0 || info.size > maximum || process.getuid && info.uid !== process.getuid()) throw new Error('Invalid private intent file');
      return true;
    } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false; throw error; }
  }
  async function syncDirectory() {
    const descriptor = await open(directory, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
    try { await descriptor.sync(); } finally { await descriptor.close(); }
  }
  return {
    async load() {
      if (!await inspect()) return null;
      const intent = intentSchema.parse(JSON.parse(await readFile(path, 'utf8')));
      if (intent.connectionId !== connectionId) throw new Error('Intent connection mismatch');
      return intent;
    },
    async save(value: Intent) {
      const intent = intentSchema.parse(value); if (intent.connectionId !== connectionId) throw new Error('Intent connection mismatch');
      const data = JSON.stringify(intent); if (Buffer.byteLength(data) > maximum) throw new Error('Intent too large');
      await inspect();
      const temporary = `${path}.${randomUUID()}.tmp`;
      const file = await open(temporary, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW, 0o600);
      try { await file.writeFile(data); await file.sync(); await file.close(); await rename(temporary, path); await syncDirectory(); }
      catch (error) { await file.close().catch(() => {}); await unlink(temporary).catch(() => {}); throw error; }
    },
    async clear() { if (await inspect()) { await unlink(path); await syncDirectory(); } },
    async close() {
      if (closed) return; closed = true; await lock.close();
      const current = await lstat(lockPath);
      if (current.ino !== lockIdentity.ino || current.dev !== lockIdentity.dev) throw new Error('Intent lock ownership changed');
      await unlink(lockPath);
    },
  };
}
