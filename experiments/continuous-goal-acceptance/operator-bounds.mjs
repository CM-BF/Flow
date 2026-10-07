import assert from 'node:assert/strict';
import { lstat, readdir, statfs } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stageSpec } from './stage-policy.mjs';
export const BOUNDS = Object.freeze({ workMs: 120000, cleanupMs: 30000, rawBytes: 2 * 1024 ** 2, runtimeBytes: 8 * 1024 ** 2,
  reserveBytes: 1024 ** 3, startBytes: 1024 ** 3 + 128 * 1024 ** 2 });
export function runPaths(run, phase = 'rehearse') {
  stageSpec(phase);
  assert(/^[a-z0-9][a-z0-9-]{3,63}$/.test(run));
  const root = fileURLToPath(new URL('../../docs/evidence/o16/', import.meta.url));
  const operatorRoot = join(root, 'operators', run);
  const operator = phase === 'rehearse' ? operatorRoot : join(operatorRoot, phase);
  return { evidence: join(root, 'runs', run), operatorRoot, operator, stop: join(operator, 'STOP.json') };
}
async function size(path, maxEntries, maxDepth, limit, missing = false) {
  let bytes = 0, entries = 0;
  async function visit(current, depth) {
    assert(depth <= maxDepth && ++entries <= maxEntries); const info = await lstat(current);
    assert(!info.isSymbolicLink(), 'Unknown resource link must be retained.');
    if (info.isDirectory()) for (const entry of await readdir(current)) await visit(join(current, entry), depth + 1);
    else if (info.isFile()) { bytes += info.size; assert(bytes <= limit, 'Resource byte ceiling crossed.'); }
  }
  try { await visit(path, 0); } catch (error) { if (!(missing && entries === 1 && error.code === 'ENOENT')) throw error; }
  return { bytes, entries };
}
export async function measureRun(run, directory) {
  const paths = runPaths(run), space = await statfs(new URL('../../', import.meta.url));
  const freeBytes = space.bavail * space.bsize; assert(freeBytes >= BOUNDS.reserveBytes, 'Live reserve crossed.');
  const [evidence, operator] = await Promise.all([size(paths.evidence, 512, 8, BOUNDS.rawBytes, true), size(paths.operatorRoot, 256, 5, BOUNDS.rawBytes)]);
  const rawBytes = evidence.bytes + operator.bytes; assert(rawBytes <= BOUNDS.rawBytes, 'Combined stdout/stderr/stage evidence ceiling crossed.');
  let runtime = { bytes: 0, entries: 0 };
  if (directory) {
    const info = await lstat(directory.path);
    assert(info.isDirectory() && !info.isSymbolicLink() && info.dev === directory.dev && info.ino === directory.ino);
    runtime = await size(directory.path, 2048, 12, BOUNDS.runtimeBytes);
  }
  return { freeBytes, rawBytes, runtimeBytes: runtime.bytes, runtimeEntries: runtime.entries };
}
export async function assertCleanupBudget(run, directory) {
  const paths = runPaths(run, process.env.FLOW_O16_OPERATOR_PHASE ?? 'rehearse');
  assert(process.env.FLOW_O16_STOPPED !== '1', 'Operator requested stop; retain resources.');
  await lstat(join(paths.operator, 'reservation.json')); // No unsupervised destruction from direct driver invocation.
  const stopped = await lstat(paths.stop).then(() => true, error => { if (error.code === 'ENOENT') return false; throw error; });
  assert(!stopped, 'Operator stopped this run; retain private resources.');
  return measureRun(run, directory);
}
