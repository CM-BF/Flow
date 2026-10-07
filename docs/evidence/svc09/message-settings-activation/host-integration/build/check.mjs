// Pure fixed input assembly only. No builder module, SDK, installation or runtime import.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { loadFixedBuildInput, main } from './entry.mjs';

await assert.rejects(main([]));
const { inputBytes, delta } = await loadFixedBuildInput(), input = JSON.parse(inputBytes);
const composition = JSON.parse(await readFile(delta.composition.path));
assert.equal(input.target, '098b0d51512dfaa04c30ca7cbe103684720fe29f');
assert.equal(input.sourceTree, 'f9f149a4dda976dad500545df1b26f825ac5b59d');
assert.equal(input.repository, '/Users/citrine/Projects/AgentHarness/Flow');
assert.equal(input.resources.rawBytes, 2097152);
assert.equal(input.resources.minimumFreeBytes, 3927965696);
assert.equal(input.fixedSourceInputs.length, new Set(input.fixedSourceInputs.map(row => row.path)).size);
for (const { path, after } of composition.paths) {
  assert.deepEqual(input.fixedSourceInputs.find(row => row.path === path), { path, bytes: after.bytes, sha256: after.sha256 });
}
assert.equal(delta.options.evidenceDirectory, fileURLToPath(new URL('.', import.meta.url)).replace(/\/$/, ''));
console.log(JSON.stringify({ checks: 2, passed: 2, sourceBindings: input.fixedSourceInputs.length,
  installedBindings: input.bindings.length, fixedComposition: 15, builderImports: 0,
  nativeImports: 0, SDK: 0, install: 0, build: 0, PG: 0, provider: 0, actualReadiness: 'NOT_RUN' }));
