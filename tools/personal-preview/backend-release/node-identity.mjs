import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { realpath, lstat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fail, hashFile } from './files.mjs';
const execute = promisify(execFile);
const system = path => path.startsWith('/usr/lib/') || path.startsWith('/System/Library/');
/** The OS remains a host prerequisite. Pin Node and each reachable non-system Mach-O image. */
export async function nodeIdentity() {
  if (process.platform !== 'darwin' || process.arch !== 'arm64' || !process.version.startsWith('v24.')) fail('BACKEND_HOST_UNSUPPORTED');
  const executable = await realpath(process.execPath), images = new Map();
  async function visit(input, inheritedRpaths = []) {
    const path = await realpath(input); if (images.has(path)) return;
    if (images.size >= 100) fail('BACKEND_NATIVE_IMAGE_BUDGET');
    const info = await lstat(path); if (!info.isFile()) fail('BACKEND_NATIVE_IMAGE_INVALID');
    images.set(path, { path, bytes: info.size, sha256: await hashFile(path) });
    const load = (await execute('/usr/bin/otool', ['-l', path], { timeout: 5000, maxBuffer: 1024 * 1024 })).stdout;
    const expand = value => value.replace('@loader_path', dirname(path)).replace('@executable_path', dirname(executable));
    const rpaths = [...load.matchAll(/cmd LC_RPATH\s+cmdsize \d+\s+path (.+?) \(offset/g)].map(match => expand(match[1])).concat(inheritedRpaths);
    const libraries = (await execute('/usr/bin/otool', ['-L', path], { timeout: 5000, maxBuffer: 1024 * 1024 })).stdout.split('\n').slice(1).map(line => line.trim().split(' (')[0]).filter(Boolean);
    for (const library of libraries) {
      if (system(library)) continue;
      let target = expand(library);
      if (target.startsWith('@rpath/')) {
        target = null;
        for (const base of rpaths) { try { target = await realpath(join(base, library.slice(7))); break; } catch (error) { if (error.code !== 'ENOENT') throw error; } }
      }
      if (!target || target.startsWith('@')) fail('BACKEND_NATIVE_IMAGE_UNRESOLVED');
      await visit(target, rpaths);
    }
  }
  await visit(executable);
  return { executable, version: process.version, abi: process.versions.modules, platform: process.platform, arch: process.arch, images: [...images.values()].sort((a, b) => a.path.localeCompare(b.path)) };
}
