import { isAbsolute, dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';

export const STOCK_CODEX = '/opt/homebrew/lib/node_modules/@openai/codex/node_modules/@openai/codex-darwin-arm64/vendor/aarch64-apple-darwin/bin/codex';
export const STOCK_CODEX_SHA256 = '4f85982624b3898c8991cb80c0981b2aa71070e3537046c9a95950318a95afcc';
export const STOCK_STARTUP_RECIPE_SHA256 = 'ba856d7949bd2d305789995058e4b11edc4df16eb1504d67c3b160a2821b77cf';

/** Fixed Mika e7ff recipe, with its private runtime kept separate from the workspace.
 * This is a derived compatibility candidate, not a claim that its narrower writes have run. */
export function createStockHelperProfile(input: { startupRecipe: string; directory: string; runtimeDirectory: string }): string {
  return createStockReadOnlyProfile(input)
    + `(allow file-write-data (literal ${JSON.stringify(input.directory + '/calculator.mjs')}))\n`;
}

/** Same fixed startup resources as the helper, with no workspace write grant.
 * Runtime state is separate; this declaration still requires actual OS launch validation. */
export function createStockReadOnlyProfile(input: { startupRecipe: string; directory: string; runtimeDirectory: string }): string {
  const { startupRecipe, directory, runtimeDirectory } = input;
  if (Buffer.byteLength(startupRecipe) !== 17393 || createHash('sha256').update(startupRecipe).digest('hex') !== STOCK_STARTUP_RECIPE_SHA256) {
    throw Error('Stock helper startup recipe differs.');
  }
  for (const path of [directory, runtimeDirectory]) {
    if (!path.startsWith('/private/tmp/') || resolve(path) !== path || Buffer.byteLength(path) > 4096 || /[\x00-\x1f\x7f]/.test(path)) {
      throw Error('Stock helper private path is invalid.');
    }
  }
  if (directory === runtimeDirectory || directory.startsWith(runtimeDirectory + '/') || runtimeDirectory.startsWith(directory + '/')) {
    throw Error('Stock helper runtime overlaps workspace.');
  }
  const oldExec = `(allow process-exec
  (literal "/opt/homebrew/Cellar/node@24/24.20.0/bin/node")
  (literal "${STOCK_CODEX}")
)`;
  // The digest fixes the entire source; this replaces one reviewed block, not arbitrary SBPL parsing.
  if (startupRecipe.split(oldExec).length !== 2) throw Error('Stock helper executable block differs.');
  const profile = startupRecipe.replace(oldExec, `(allow process-exec (literal "${STOCK_CODEX}"))`)
    .replaceAll('(param "ALLOW_ROOT")', JSON.stringify(runtimeDirectory))
    .replaceAll('(param "DENY_ROOT")', JSON.stringify(runtimeDirectory + '/denied'));
  const ancestors = new Set<string>();
  for (const start of [directory, runtimeDirectory]) {
    for (let path = start; ; path = dirname(path)) { ancestors.add(path); if (path === '/') break; }
  }
  return `${profile}\n;; Engineering workspace is not the writable private runtime state tree.\n`
    + `(allow file-read-metadata ${[...ancestors].map(path => `(literal ${JSON.stringify(path)})`).join(' ')})\n`
    + `(allow file-read* (subpath ${JSON.stringify(directory)}))\n`;
}

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
