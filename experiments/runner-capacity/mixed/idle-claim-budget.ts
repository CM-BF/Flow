import { createHash } from 'node:crypto';
import { lstatSync, opendirSync, readFileSync } from 'node:fs';
import { isAbsolute, join, resolve, sep } from 'node:path';

export const IDLE_LIMITS = Object.freeze({ totalMs: 15000, workMs: 10000, bytes: 2 * 1024 * 1024,
  rawReserve: 256 * 1024, automaticRawBytes: 128 * 1024, manualArchiveBytes: 128 * 1024,
  captureBytes: 16384, caseReceiptBytes: 65536, outerReceiptBytes: 8192,
  maxClaims: 12, maxSamples: 256, maxNodes: 1024 });

/** Reserve raw/CLI space and count cumulative journal API input separately from sampled own files. */
export function idleBudget(inputBytes: number, ownBytes: number, journalWriteBytes: number, now: number, started: number) {
  const values = [inputBytes, ownBytes, journalWriteBytes, now, started];
  const known = values.every(value => Number.isSafeInteger(value) && value >= 0) && now >= started;
  const chargedBytes = inputBytes + ownBytes + journalWriteBytes + IDLE_LIMITS.rawReserve;
  return { known, chargedBytes, workAllowed: known && now < started + IDLE_LIMITS.workMs && chargedBytes < IDLE_LIMITS.bytes,
    withinTotal: known && now < started + IDLE_LIMITS.totalMs && chargedBytes <= IDLE_LIMITS.bytes };
}

/** Bounded, no symlink traversal. These are samples of this experiment's own root, not a hard quota. */
export function sampleIdleRoot(root: string) {
  let nodes = 0, logicalBytes = 0, allocatedBytes = 0;
  const walk = (path: string, depth: number) => {
    if (++nodes > IDLE_LIMITS.maxNodes || depth > 12) throw Error('OWN_INVENTORY_LIMIT');
    const stat = lstatSync(path);
    if (stat.isSymbolicLink() || !stat.isDirectory() && !stat.isFile()) throw Error('OWN_INVENTORY_TYPE');
    allocatedBytes += stat.blocks * 512;
    if (stat.isFile()) { logicalBytes += stat.size; return; }
    const dir = opendirSync(path, { bufferSize: 1 });
    try { for (let entry = dir.readSync(); entry; entry = dir.readSync()) walk(join(path, entry.name), depth + 1); }
    finally { dir.closeSync(); }
  };
  walk(root, 0);
  return { nodes, logicalBytes, allocatedBytes, chargedBytes: Math.max(logicalBytes, allocatedBytes) };
}

/** The reviewed file list includes the Lead-provided mirror and preparation sources/configs. */
export function verifyIdleInputs(worktree: string, manifestPath: string, expectedSha256: string | undefined) {
  const stat = lstatSync(manifestPath);
  if (!stat.isFile() || stat.size > 65536) throw Error('INPUT_MANIFEST_SIZE');
  const bytes = readFileSync(manifestPath);
  const manifestSha256 = createHash('sha256').update(bytes).digest('hex');
  if (manifestSha256 !== expectedSha256) throw Error('UNREVIEWED_INPUT_MANIFEST');
  const data = JSON.parse(bytes.toString('utf8')) as { fixedRef?: unknown; files?: unknown };
  if (data.fixedRef !== '8d84d529a0756116bd0fc8bad969d61a6c26248e' || !Array.isArray(data.files) || data.files.length > 96 || data.files.length < 61) throw Error('INPUT_MANIFEST_SHAPE');
  const seen = new Set<string>(); let inputBytes = bytes.length;
  for (const entry of data.files as { path?: unknown; bytes?: unknown; sha256?: unknown }[]) {
    if (typeof entry.path !== 'string' || isAbsolute(entry.path) || entry.path.split('/').some(part => !part || part === '.' || part === '..')
      || !(entry.path.startsWith('docs/evidence/s01/idle-claim-cost/') || entry.path.startsWith('experiments/runner-capacity/mixed/idle-claim') || entry.path === 'experiments/runner-capacity/mixed/execute-idle.mjs' || entry.path === 'tsconfig.json')
      || seen.has(entry.path) || !Number.isSafeInteger(entry.bytes) || (entry.bytes as number) < 0 || (entry.bytes as number) > 1024 * 1024
      || typeof entry.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(entry.sha256)) throw Error('INPUT_ROW');
    seen.add(entry.path);
    const path = resolve(worktree, entry.path);
    if (!path.startsWith(resolve(worktree) + sep)) throw Error('INPUT_PATH');
    const info = lstatSync(path);
    if (!info.isFile() || info.size !== entry.bytes) throw Error('INPUT_FILE');
    const value = readFileSync(path);
    if (createHash('sha256').update(value).digest('hex') !== entry.sha256) throw Error('INPUT_HASH');
    inputBytes += value.length;
    if (inputBytes + IDLE_LIMITS.rawReserve >= IDLE_LIMITS.bytes) throw Error('INPUT_BUDGET');
  }
  return { inputBytes, files: seen.size, manifestSha256 };
}
