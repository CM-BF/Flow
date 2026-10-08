import assert from 'node:assert/strict';
import { lstat, statfs } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stageSpec, stageRecords } from './stage-policy.mjs';
import { readRecord } from './records.mjs';
import { measureOwnedRoots } from './owned-meter.mjs';
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
const STAGES = new Set(['live-reserve', 'stage-evidence', 'operator-evidence', 'combined-evidence',
  'runtime-identity', 'runtime', 'resources-record', 'supervision-sample', 'final-measurement']);
const CONSTRAINTS = new Set(['freeBytes', 'rawBytes', 'runtimeBytes', 'entries', 'depth', 'noSymlinks',
  'directoryIdentity', 'sourceDigest', 'resourceFacts', 'observationDeadline']);
/** Never persist an I/O message/path: stage and constraint are controlled vocabulary. */
export function measurementFailure(error, fallbackStage = 'supervision-sample') {
  return { state: 'unknown', stage: STAGES.has(error?.measurementStage) ? error.measurementStage
    : STAGES.has(fallbackStage) ? fallbackStage : 'supervision-sample',
  code: typeof error?.code === 'string' && /^[A-Z0-9_]{1,80}$/.test(error.code) ? error.code : null,
  constraint: CONSTRAINTS.has(error?.constraint) ? error.constraint : null };
}
function requireMeasurement(condition, stage, constraint, code = 'O16_RESOURCE_LIMIT') {
  if (!condition) throw Object.assign(new Error('O16 resource measurement rejected.'), { code, measurementStage: stage, constraint });
}
async function atStage(stage, operation) {
  try { return await operation(); }
  catch (error) { throw Object.assign(new Error('O16 resource observation failed.'), {
    code: error?.code, measurementStage: STAGES.has(error?.measurementStage) ? error.measurementStage : stage,
    constraint: error?.constraint }); }
}
export async function measureRun(run, directory, io = { statfs, measureRoots: measureOwnedRoots }) {
  const started = performance.now();
  const paths = runPaths(run), space = await atStage('live-reserve', () => io.statfs(new URL('../../', import.meta.url)));
  const freeBytes = space.bavail * space.bsize; requireMeasurement(freeBytes >= BOUNDS.reserveBytes, 'live-reserve', 'freeBytes');
  requireMeasurement(performance.now() - started < 50, 'live-reserve', 'observationDeadline');
  const roots = [{ stage: 'stage-evidence', path: paths.evidence }, { stage: 'operator-evidence', path: paths.operatorRoot }];
  if (directory) roots.push({ stage: 'runtime', path: directory.path, identity: { dev: directory.dev, ino: directory.ino } });
  const observed = await atStage('supervision-sample', () => io.measureRoots(roots));
  const [evidence, operator, measuredRuntime] = observed.roots;
  const rawBytes = evidence.bytes + operator.bytes; requireMeasurement(rawBytes <= BOUNDS.rawBytes, 'combined-evidence', 'rawBytes');
  // null is an explicit durable removal fact; omitted identity is not an empty directory.
  let runtime = { bytes: directory === null ? 0 : null, entries: directory === null ? 0 : null, vanished: 0 };
  if (directory) {
    runtime = measuredRuntime;
    requireMeasurement(runtime.bytes <= BOUNDS.runtimeBytes, 'runtime', 'runtimeBytes');
  }
  return { freeBytes, rawBytes, runtimeBytes: runtime.bytes, runtimeEntries: runtime.entries,
    vanishedEntries: evidence.vanished + operator.vanished + runtime.vanished, measurementElapsedMs: observed.elapsedMs,
    runtimeState: directory === null ? 'removed' : directory ? 'measured' : 'unknown' };
}
/** Final accounting requires the durable resource identity, even if stage.finish failed. */
export async function measureFinalRun(run, sourceDigest, { read = readRecord, measure = measureRun, phase = 'rehearse' } = {}) {
  try {
    const resources = await atStage('resources-record', () => read(join(runPaths(run, phase).evidence, stageRecords(phase).resources)));
    requireMeasurement(resources?.kind === 'flow.o16.private-resources.v1', 'resources-record', 'resourceFacts', 'O16_RESOURCE_FACTS');
    requireMeasurement(resources.sourceDigest === sourceDigest, 'resources-record', 'sourceDigest', 'O16_RESOURCE_FACTS');
    requireMeasurement(resources.directoryRemoved === true || resources.directory, 'resources-record', 'directoryIdentity', 'O16_RESOURCE_FACTS');
    const metrics = await measure(run, resources.directoryRemoved === true ? null : resources.directory);
    return { metrics, failure: null };
  } catch (error) { return { metrics: null, failure: measurementFailure(error, 'final-measurement') }; }
}
export async function assertCleanupBudget(run, directory, { stat = lstat, measure = measureRun } = {}) {
  const paths = runPaths(run, process.env.FLOW_O16_OPERATOR_PHASE ?? 'rehearse');
  assert(process.env.FLOW_O16_STOPPED !== '1', 'Operator requested stop; retain resources.');
  await stat(join(paths.operator, 'reservation.json')); // No unsupervised destruction from direct driver invocation.
  const stopped = await stat(paths.stop).then(() => true, error => { if (error.code === 'ENOENT') return false; throw error; });
  assert(!stopped, 'Operator stopped this run; retain private resources.');
  return measure(run, directory);
}
