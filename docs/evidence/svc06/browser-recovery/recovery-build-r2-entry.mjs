import assert from 'node:assert/strict';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadRecoveryBuild } from './recovery-build-entry.mjs';

const here = dirname(fileURLToPath(import.meta.url));
export const fixedOptions = Object.freeze({ inputPath: join(here, 'recovery-build-r2-inputs.json'),
  evidenceDirectory: join(here, 'recovery-build-r2-once'),
  temporaryPrefix: '/private/tmp/flow-svc06b-recovery-r2-artifact-' });

export async function main(argv) {
  assert.deepEqual(argv, ['--execute-fixed-recovery-r2-build']);
  const { inputBytes, delta } = await loadRecoveryBuild(fixedOptions);
  const { runFixedArtifact } = await import(pathToFileURL(delta.sharedEntry.path).href);
  await runFixedArtifact(inputBytes, delta.options);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main(process.argv.slice(2));
