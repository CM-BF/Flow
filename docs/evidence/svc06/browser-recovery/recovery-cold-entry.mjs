import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { coldPorts } from './recovery-cold-consumer.mjs';
import { main as work } from '/Users/citrine/Projects/AgentHarness/Flow-worktrees/personal-message-settings/docs/evidence/svc09/message-settings-activation/host-integration/host-entry.mjs';
import { privateJson, failure } from '/Users/citrine/Projects/AgentHarness/Flow-worktrees/personal-message-settings/docs/evidence/svc09/message-settings-activation/host-integration/host-records.mjs';
import { hostInputPath } from '/Users/citrine/Projects/AgentHarness/Flow-worktrees/personal-message-settings/docs/evidence/svc09/message-settings-activation/host-integration/host-paths.mjs';

export function coldArguments(argv) {
  assert.equal(argv.length, 2);
  assert.ok(['--work-once', '--cleanup-once'].includes(argv[0]), 'EXACT_COLD_MODE_REQUIRED');
  hostInputPath(argv[1]);
  return argv[0];
}

export async function main(argv, { fixedInput = new URL('./recovery-cold-inputs.json', import.meta.url),
  expectedSource = 'f37a3612068c7215994750574a7451ede841bcce' } = {}) {
  const mode = coldArguments(argv);
  // Published only after the real new artifact exists; the preparation pins its exact bytes.
  const fixed = JSON.parse(await readFile(fixedInput, 'utf8'));
  assert.equal(fixed.sourceHead, expectedSource);
  const ports = coldPorts(fixed);
  if (mode === '--work-once') return work(argv, ports);
  const result = await ports.cleanup(await privateJson(argv[1]));
  process.stdout.write(JSON.stringify(result) + '\n');
  return result.resourcesClosed ? 0 : 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.exitCode = await main(process.argv.slice(2)); }
  catch (error) { process.stderr.write(JSON.stringify(failure(error, 'cold-entry-or-persistence')) + '\n'); process.exitCode = 1; }
}
