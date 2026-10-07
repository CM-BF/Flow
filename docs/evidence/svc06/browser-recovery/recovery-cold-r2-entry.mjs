import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { main as run } from './recovery-cold-entry.mjs';
import { failure } from '/Users/citrine/Projects/AgentHarness/Flow-worktrees/personal-message-settings/docs/evidence/svc09/message-settings-activation/host-integration/host-records.mjs';

export const fixedOptions = Object.freeze({ fixedInput: new URL('./recovery-cold-r2-inputs.json', import.meta.url),
  expectedSource: '880060a317cd99f3f29b41333f6dd7d7f5ab1488' });
export const main = argv => run(argv, fixedOptions);
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.exitCode = await main(process.argv.slice(2)); }
  catch (error) { process.stderr.write(JSON.stringify(failure(error, 'cold-entry-or-persistence')) + '\n'); process.exitCode = 1; }
}
