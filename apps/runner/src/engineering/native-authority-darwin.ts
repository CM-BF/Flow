import { isAbsolute, dirname, resolve } from 'node:path';

/** A policy candidate, not model qualification or a NativeWriteAuthority grant.
 * The trusted host must bind real paths/inodes and launch with only stdio FDs. */
export function createDarwinWriteProfile(paths: { root: string; executable: string; writableFile: string }): string {
  const { root, executable, writableFile } = paths;
  for (const path of [root, executable, writableFile]) {
    if (!isAbsolute(path) || resolve(path) !== path || Buffer.byteLength(path) > 4096 || /[\x00-\x1f\x7f]/.test(path)) {
      throw Error('Darwin authority path is invalid.');
    }
  }
  if (dirname(writableFile) !== root || writableFile === executable || root === '/') throw Error('Darwin write target is invalid.');
  const literal = (path: string) => `(literal ${JSON.stringify(path)})`;
  const ancestors = new Set<string>();
  for (let path = root; ; path = dirname(path)) { ancestors.add(path); if (path === '/') break; }
  return `(version 1)
(deny default)
(deny process-fork)
(deny network*)
(deny mach-lookup)
(allow process-exec ${literal(executable)})
(allow file-read* file-map-executable ${literal(executable)})
(allow file-read* (subpath ${JSON.stringify(root)}))
(allow file-read-metadata ${[...ancestors].map(literal).join(' ')})
(allow file-read* file-map-executable
  (subpath "/usr/lib") (subpath "/System/Library")
  (subpath "/System/Volumes/Preboot/Cryptexes/OS/System/Library/dyld"))
(allow file-read* file-test-existence (literal "/"))
(allow system-mac-syscall (require-all (mac-policy-name "Sandbox") (mac-syscall-number 67)))
(allow file-write-data ${literal(writableFile)})
`;
}
