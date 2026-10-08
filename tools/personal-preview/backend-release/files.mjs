import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { lstat, readdir, readlink, realpath, open, rename, rm, mkdir } from 'node:fs/promises';
import { join, relative, isAbsolute } from 'node:path';
export const LIMITS = Object.freeze({ bytes: 1024 ** 3, entries: 100_000, artifacts: 5, retainedBytes: 2 * 1024 ** 3, seedBytes: 6 * 1024 ** 3, seedEntries: 200_000 });
export function fail(code) { const error = new Error(code); error.code = code; throw error; }
export const digest = value => createHash('sha256').update(value).digest('hex');
export function inside(root, path) { const value = relative(root, path); return value === '' || !isAbsolute(value) && value !== '..' && !value.startsWith('../'); }
export async function hashFile(path) { const hash = createHash('sha256'); for await (const chunk of createReadStream(path)) hash.update(chunk); return hash.digest('hex'); }
export async function privateDirectory(path) {
  if (!isAbsolute(path ?? '')) fail('BACKEND_PRIVATE_DIRECTORY_REQUIRED');
  const info = await lstat(path);
  if (!info.isDirectory() || info.isSymbolicLink() || info.uid !== process.getuid() || (info.mode & 0o777) !== 0o700) fail('BACKEND_PRIVATE_DIRECTORY_REQUIRED');
  return realpath(path);
}
export async function inventory(root, { bytes = LIMITS.bytes, entries = LIMITS.entries, hashes = true, links = true, hardlinks = false } = {}) {
  const result = []; let totalBytes = 0;
  async function walk(directory) {
    for (const name of (await readdir(directory)).sort()) {
      const path = join(directory, name), info = await lstat(path), key = relative(root, path);
      if (result.length >= entries || /[\x00-\x1f]/.test(key)) fail('BACKEND_ENTRY_BUDGET');
      if (info.isDirectory()) { result.push({ path: key, kind: 'directory' }); await walk(path); }
      else if (info.isSymbolicLink()) {
        const target = await readlink(path);
        if (!links || isAbsolute(target) || !inside(root, await realpath(path))) fail('BACKEND_EXTERNAL_LINK');
        result.push({ path: key, kind: 'symlink', target });
      } else if (info.isFile()) {
        if (!hardlinks && info.nlink !== 1) fail('BACKEND_SHARED_FILE');
        totalBytes += info.size; if (totalBytes > bytes) fail('BACKEND_BYTE_BUDGET');
        result.push({ path: key, kind: 'file', bytes: info.size, executable: Boolean(info.mode & 0o111), ...(hashes ? { sha256: await hashFile(path) } : {}) });
      } else fail('BACKEND_SPECIAL_FILE');
    }
  }
  await walk(root); return { entries: result, bytes: totalBytes };
}
export async function saveJson(path, value) {
  const temporary = `${path}.tmp`;
  const file = await open(temporary, 'wx', 0o600);
  try { await file.writeFile(`${JSON.stringify(value)}\n`); await file.sync(); } finally { await file.close(); }
  await rename(temporary, path);
}
export async function ensureStore(directory) {
  await privateDirectory(directory);
  const root = join(directory, 'backend-artifacts'); await mkdir(root, { mode: 0o700, recursive: true });
  await privateDirectory(root); return root;
}
export async function withStoreLock(root, callback) {
  const path = join(root, 'prepare.lock'); let file;
  try { file = await open(path, 'wx', 0o600); } catch (error) { if (error.code === 'EEXIST') fail('BACKEND_PREPARATION_BUSY'); throw error; }
  try { await file.writeFile(JSON.stringify({ pid: process.pid })); return await callback(); }
  finally { await file.close(); await rm(path); }
}
