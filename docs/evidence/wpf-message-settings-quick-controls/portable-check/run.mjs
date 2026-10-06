/** Dedicated checks only. The admitted outer CI owner owns containment, resource limits and cleanup. */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const base = dirname(fileURLToPath(import.meta.url)), root = resolve(base, '../../../..');
const [sourceCommit, runId, output, scratch, workMsText] = process.argv.slice(2);
const workMs = Number(workMsText), started = Date.now();
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const json = (path, cap = 262144) => {
  const stat = lstatSync(path); assert(stat.isFile() && !stat.isSymbolicLink() && stat.size <= cap, `Invalid bounded input: ${path}`);
  return JSON.parse(readFileSync(path, 'utf8'));
};
const git = (...args) => {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8', timeout: 2000, maxBuffer: 262144, killSignal: 'SIGKILL' });
  assert(!result.error && !result.signal && result.status === 0, 'Source identity unavailable'); return result.stdout.trim();
};
function outsideCheckout(path) {
  assert(isAbsolute(path) && resolve(path) === path && realpathSync(dirname(path)) === dirname(path));
  const rel = relative(root, path); assert(rel === '..' || rel.startsWith('..' + sep), 'Output must be outside the checkout');
  assert(!existsSync(path), 'Output/scratch must be new, caller-owned paths');
}
assert.equal(process.argv.length, 7, 'Arguments: source-SHA run-id absolute-output absolute-scratch work-ms');
assert(/^[a-f0-9]{40}$/.test(sourceCommit) && /^[a-zA-Z0-9_-]{1,64}$/.test(runId));
assert(Number.isSafeInteger(workMs) && workMs > 0 && workMs <= 120000, 'Caller must supply an admitted work deadline <=120s');
outsideCheckout(output); outsideCheckout(scratch);
assert(output !== scratch && !output.startsWith(scratch + sep) && !scratch.startsWith(output + sep));
mkdirSync(output, { mode: 0o700 }); mkdirSync(scratch, { mode: 0o700 });
const result = { contract: 'msgquick-portable-v1', runId, sourceCommit, startedAt: new Date(started).toISOString(),
  workMs, state: 'FAILED_OR_UNKNOWN', steps: [], errors: [], files: {}, cleanup: 'PENDING_INDEPENDENT_OUTER_RECEIPT' };
const retain = (name, bytes) => { writeFileSync(join(output, name), bytes); result.files[name] = hash(bytes); };
try {
  const manifest = json(join(base, 'prepared-manifest.json'));
  for (const [name, digest] of Object.entries(manifest.files)) assert.equal(hash(readFileSync(join(base, name))), digest, name);
  const pins = json(join(base, 'source-pins.json'));
  assert.equal(process.version, pins.nodeVersion); assert.equal(git('rev-parse', 'HEAD'), sourceCommit);
  assert.equal(git('status', '--porcelain'), '', 'Source checkout must start clean');
  for (const [name, digest] of Object.entries(pins.readOnlyFiles)) assert.equal(hash(readFileSync(join(root, name))), digest, name);
  for (const [name, version] of Object.entries(pins.installedVersions)) assert.equal(json(join(root, name)).version, version, name);
  assert.equal(json(join(root, 'package.json')).packageManager, pins.packageManager);
  const expectedBytes = readFileSync(join(base, 'expected-tests.json'));
  assert.equal(hash(expectedBytes), pins.expectedNamesSha256);
  const expected = JSON.parse(expectedBytes); assert.equal(expected.count, 26); assert.equal(new Set(expected.names).size, 26);
  result.implementation = pins.implementation; result.sourceHashes = pins.sourceHashes;
  retain('input-manifest.json', JSON.stringify({ sourceCommit, runId, prepared: manifest, sourcePins: pins }, null, 2) + '\n');
  const steps = [
    ['strict-noEmit', [join(root, 'node_modules/typescript/lib/tsc.js'), '--noEmit', '-p', join(base, 'tsconfig.json')]],
    ['direct', [join(root, 'node_modules/vitest/vitest.mjs'), 'run', '--config', join(base, 'vitest.config.mjs'), '--configLoader', 'native',
      '--no-cache', '--reporter=json', '--outputFile', join(scratch, 'vitest-results.json')]],
  ];
  for (const [name, args] of steps) {
    const remaining = workMs - (Date.now() - started); assert(remaining > 0, 'Work deadline reached');
    const step = spawnSync(process.execPath, args, { cwd: root, timeout: remaining, maxBuffer: 262144, killSignal: 'SIGKILL',
      env: { ...process.env, FLOW_MSGQUICK_SCRATCH: scratch, TMPDIR: scratch, TMP: scratch, TEMP: scratch,
        NODE_DISABLE_COMPILE_CACHE: '1', TSX_DISABLE_CACHE: '1' } });
    const log = Buffer.concat([step.stdout ?? Buffer.alloc(0), step.stderr ?? Buffer.alloc(0)]);
    retain(`${name}.log`, log.subarray(0, 524288));
    result.steps.push({ name, exitCode: step.status, signal: step.signal, error: step.error?.code ?? null, outputTruncated: log.length > 524288 });
    assert(!step.error && !step.signal && step.status === 0 && log.length <= 524288, `${name} failed/unknown`);
  }
  const directPath = join(scratch, 'vitest-results.json');
  const directStat = lstatSync(directPath); assert(directStat.isFile() && !directStat.isSymbolicLink() && directStat.size <= 262144);
  const directBytes = readFileSync(directPath); retain('vitest-results.json', directBytes); const direct = JSON.parse(directBytes);
  assert.equal(direct.success, true); assert.equal(direct.numTotalTests, 26); assert.equal(direct.numPassedTests, 26);
  assert.equal(direct.numFailedTests, 0); assert.equal(direct.numPendingTests, 0); assert.equal(direct.numTodoTests ?? 0, 0);
  assert.equal(direct.testResults.length, 1);
  const file = direct.testResults[0]; assert.equal(resolve(file.name), join(root, 'apps/web/test/message-settings.test.ts'));
  assert.equal(file.status, 'passed'); assert.equal(file.assertionResults.length, 26);
  assert(file.assertionResults.every(test => test.status === 'passed'));
  assert.deepEqual(file.assertionResults.map(test => test.title).sort(), [...expected.names].sort());
  for (const [name, digest] of Object.entries(pins.readOnlyFiles)) assert.equal(hash(readFileSync(join(root, name))), digest, name);
  assert.equal(git('rev-parse', 'HEAD'), sourceCommit); assert.equal(git('status', '--porcelain'), '');
  assert(Date.now() - started <= workMs, 'Final check exceeded work deadline');
  result.state = 'CHECKS_PASSED_PENDING_CLEANUP';
} catch (error) { result.errors.push(String(error.stack ?? error).slice(0, 8192)); }
result.elapsedMs = Date.now() - started;
if (result.elapsedMs > workMs) { result.state = 'FAILED_OR_UNKNOWN'; result.errors.push('Work deadline exceeded'); }
const resultBytes = JSON.stringify(result, null, 2) + '\n';
writeFileSync(join(output, 'result.json'), resultBytes);
console.log(JSON.stringify({ contract: result.contract, runId, sourceCommit, state: result.state, resultSha256: hash(resultBytes) }));
process.exitCode = result.state === 'CHECKS_PASSED_PENDING_CLEANUP' ? 0 : 1;
// This is not a cleanup receipt or actual outer exit observation. Abrupt interruption can leave partial output.
