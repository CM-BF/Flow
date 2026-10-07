// One reader port; observation, privacy, database projection and durable output remain original.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { snapshot, durable, target } from '/Users/citrine/Projects/AgentHarness/Flow-worktrees/personal-history-compatibility/docs/evidence/svc05-history-compatibility/center-recovery-af51/facts.mjs';
import { findWebCompatibility } from '/Users/citrine/Projects/AgentHarness/Flow/tools/personal-preview/web-release.mjs';

const base = dirname(fileURLToPath(import.meta.url));
export function outputPath(args, plan) {
  assert.equal(args.length, 2); assert.equal(args[0], '--snapshot');
  assert.ok(['facts-before.json', 'facts-paused.json', 'facts-final.json'].some(name => args[1] === join(plan.runDirectory, name)), 'FIXED_OUTPUT_REQUIRED');
  return args[1];
}

// Legacy pointer/report evidence stays af51 + null context after the backend update.
// The separate configuredTuple gate checks actual 6c + policy/C3 readiness.
export function legacyCompatibility(input) {
  assert.equal(input.backendHead, target); assert.equal(input.expectedContext ?? null, null);
  return findWebCompatibility({ ...input, expectedContext: null });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const plan = JSON.parse(await readFile(join(base, 'maintenance-continuation.json'), 'utf8'));
  if (process.argv[2] === '--check-invocation' && process.argv.length === 3) {
    for (const name of ['facts-before.json', 'facts-paused.json', 'facts-final.json']) outputPath(['--snapshot', join(plan.runDirectory, name)], plan);
    assert.throws(() => outputPath([], plan)); assert.throws(() => outputPath(['--snapshot', '/tmp/unbound.json'], plan));
    assert.equal(typeof snapshot, 'function'); assert.equal(typeof findWebCompatibility, 'function');
    console.log(JSON.stringify({ outcome: 'fixed-facts-port-and-arguments-available', personalIO: 0, PG: 0 }));
  } else {
    const output = outputPath(process.argv.slice(2), plan);
    let report;
    try { report = { outcome: 'observed', facts: await snapshot({ findCompatibility: legacyCompatibility }) }; }
    catch (error) { report = { outcome: 'unknown', code: /^[A-Z0-9_]+$/.test(error.code ?? error.message) ? error.code ?? error.message : 'OBSERVATION_UNKNOWN' }; process.exitCode = 1; }
    await durable(output, report); console.log(JSON.stringify({ outcome: report.outcome, code: report.code, output }));
  }
}
