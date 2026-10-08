import { createHash } from 'node:crypto';
import { lstat, readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { METER_BRIDGE, METER_RUNTIME } from './meter-bridge.mjs';

const OUTPUT_BYTES = 8192, TOTAL_MS = 200;
const STAGES = new Set(['stage-evidence', 'operator-evidence', 'runtime']);
const ISSUES = new Set(['TIME_LIMIT', 'UNSUPPORTED_PLATFORM', 'ROOT_PATH_CHANGED', 'ROOT_IDENTITY_CHANGED',
  'ROOT_IO', 'DIRECTORY_BINDING_UNKNOWN', 'DIRECTORY_IDENTITY_CHANGED', 'DEPTH_LIMIT', 'DIRECTORY_OPEN_UNKNOWN',
  'ENTRY_LIMIT', 'DIRECTORY_IO', 'DIRECTORY_CLOSE_UNKNOWN', 'ENTRY_IO', 'ENTRY_IDENTITY_CHANGED',
  'DEVICE_BOUNDARY', 'EXCLUSION_NOT_DIRECTORY', 'FILE_ACCOUNTING_UNKNOWN', 'SPECIAL_FILE', 'SYMLINK']);
function failure(code, stage) {
  return Object.assign(new Error('Bounded resource observation unavailable.'), { code, measurementStage: stage });
}
async function verifyPython() {
  const before = await lstat(METER_RUNTIME.python);
  if (!before.isFile() || before.isSymbolicLink() || before.size !== METER_RUNTIME.pythonBytes) throw failure('O16_METER_SOURCE');
  const bytes = await readFile(METER_RUNTIME.python), after = await lstat(METER_RUNTIME.python);
  if (before.dev !== after.dev || before.ino !== after.ino || before.mtimeMs !== after.mtimeMs ||
      createHash('sha256').update(bytes).digest('hex') !== METER_RUNTIME.pythonSha256) throw failure('O16_METER_SOURCE');
}
function validateRoots(roots) {
  if (!Array.isArray(roots) || roots.length < 1 || roots.length > 3 || new Set(roots.map(x => x.stage)).size !== roots.length)
    throw failure('O16_METER_INPUT');
  for (const item of roots) {
    if (!STAGES.has(item.stage) || typeof item.path !== 'string' || !item.path.startsWith('/') || item.path.includes('\0'))
      throw failure('O16_METER_INPUT');
    if (item.stage === 'runtime' && (!item.identity || !Number.isSafeInteger(item.identity.dev) || !Number.isSafeInteger(item.identity.ino)))
      throw failure('O16_METER_INPUT');
  }
}
function parseResult(raw, roots) {
  const output = JSON.parse(raw);
  if (output.failure || !Array.isArray(output.results)) throw failure('O16_METER_HELPER_FAILURE');
  for (let i = 0; i < output.results.length; i++) {
    const result = output.results[i];
    if (result.stage !== roots[i]?.stage) throw failure('O16_METER_PROTOCOL');
    if (result.state === 'unknown') {
      if (!ISSUES.has(result.code)) throw failure('O16_METER_PROTOCOL');
      throw failure(`O16_METER_${result.code}`, result.stage);
    }
    if (!(result.state === 'complete' || (result.state === 'absent' && result.stage === 'stage-evidence')) ||
      !['bytes', 'entries', 'vanished'].every(key => Number.isSafeInteger(result[key]) && result[key] >= 0)) throw failure('O16_METER_PROTOCOL');
  }
  if (output.results.length !== roots.length) throw failure('O16_METER_PROTOCOL');
  return output.results;
}

/** One batch, one inherited-group helper. In-process seams support fault tests only. */
export function createOwnedMeter({ spawnChild = spawn, verify = verifyPython, totalMs = TOTAL_MS } = {}) {
  if (!(totalMs > 1 && totalMs <= TOTAL_MS)) throw failure('O16_METER_INPUT');
  let active = false, poisonedFailure;
  return async function measure(roots) {
    validateRoots(roots);
    const input = JSON.stringify({ roots });
    if (Buffer.byteLength(input) > 16384) throw failure('O16_METER_INPUT');
    if (poisonedFailure) throw poisonedFailure;
    if (active) throw failure('O16_METER_BUSY_OR_UNCLOSED');
    active = true;
    const started = performance.now();
    return new Promise((resolve, reject) => {
      let child, closed = false, settled = false, firstFailure, output = '', bytes = 0;
      const finish = (error, value) => {
        if (settled) return;
        settled = true; clearTimeout(stopTimer); clearTimeout(deadline);
        if (!child || closed) active = false;
        if (error) poisonedFailure ??= error;
        error ? reject(error) : resolve(value);
      };
      const stop = code => {
        firstFailure ??= failure(code);
        if (child && !closed) { try { child.kill('SIGKILL'); } catch { firstFailure ??= failure('O16_METER_CLOSE_UNKNOWN'); } }
      };
      // The final quarter is reserved for close/EOF, within the same total deadline.
      const stopTimer = setTimeout(() => stop('O16_METER_DEADLINE'), totalMs * .75);
      const deadline = setTimeout(() => {
        stop('O16_METER_DEADLINE');
        finish(firstFailure);
      }, totalMs);
      Promise.resolve().then(verify).then(() => {
        if (settled || firstFailure) return finish(firstFailure ?? failure('O16_METER_DEADLINE'));
        child = spawnChild(METER_RUNTIME.python, ['-I', '-B', '-c', `${METER_BRIDGE}\nmain()`], {
          cwd: '/', env: { PATH: '/usr/bin:/bin', LANG: 'C.UTF-8' }, detached: false, stdio: ['pipe', 'pipe', 'pipe'],
        });
        child.on('error', () => stop('O16_METER_SPAWN'));
        child.stdin.on('error', () => stop('O16_METER_INPUT_IO'));
        child.stdout.on('data', chunk => {
          bytes += chunk.length;
          if (bytes > OUTPUT_BYTES) stop('O16_METER_OUTPUT');
          else output += chunk.toString('utf8');
        });
        child.stderr.on('data', chunk => { bytes += chunk.length; stop(bytes > OUTPUT_BYTES ? 'O16_METER_OUTPUT' : 'O16_METER_STDERR'); });
        child.on('close', (code, signal) => {
          closed = true;
          if (settled) return; // unknown close cannot retroactively turn a rejected sample into success
          if (firstFailure) return finish(firstFailure);
          if (code !== 0 || signal) return finish(failure('O16_METER_EXIT'));
          if (performance.now() - started >= totalMs) return finish(failure('O16_METER_DEADLINE'));
          try { finish(null, { roots: parseResult(output, roots), elapsedMs: performance.now() - started, helperClosed: true }); }
          catch (error) { finish(error.code ? error : failure('O16_METER_PROTOCOL')); }
        });
        child.stdin.end(input);
      }).catch(error => finish(error.code === 'O16_METER_SOURCE' ? error : failure('O16_METER_SOURCE')));
    });
  };
}
export const measureOwnedRoots = createOwnedMeter();
