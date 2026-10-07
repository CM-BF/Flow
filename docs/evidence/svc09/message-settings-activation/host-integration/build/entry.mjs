// One fixed source assembly; build and lifecycle implementations stay in SVC06 / OPS14.
import assert from 'node:assert/strict';
import { readFile, lstat, realpath } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const target = '098b0d51512dfaa04c30ca7cbe103684720fe29f';

async function pinned(binding) {
  assert.equal(await realpath(binding.path), binding.realpath);
  const info = await lstat(binding.realpath);
  assert.ok(info.isFile() && !info.isSymbolicLink());
  assert.equal(info.size, binding.bytes);
  const bytes = await readFile(binding.realpath);
  assert.equal(hash(bytes), binding.sha256);
  return bytes;
}

export async function loadFixedBuildInput() {
  const bytes = await readFile(join(here, 'inputs.json')), delta = JSON.parse(bytes);
  assert.equal(delta.kind, 'SVC09A_FIXED_BUILD_INPUT_DELTA');
  assert.equal(delta.target, target);
  assert.equal(delta.repository, '/Users/citrine/Projects/AgentHarness/Flow');
  assert.equal(delta.options.evidenceDirectory, here);
  assert.equal(delta.options.temporaryPrefix, '/private/tmp/flow-svc09a-artifact-');
  const originalBytes = await pinned(delta.inherited), original = JSON.parse(originalBytes);
  assert.equal(original.target, '6c0fdcda8858aac33489c48c1948e902dd6a3d7e');
  assert.equal(original.repository, delta.repository);
  const composition = JSON.parse(await pinned(delta.composition));
  const lateLogout = JSON.parse(await pinned(delta.lateLogoutInput));
  assert.equal(composition.paths.length, 15);
  assert.equal(lateLogout.target, composition.base);
  const sources = new Map(original.fixedSourceInputs.map(row => [row.path, row]));
  for (const row of lateLogout.fixedSourceAdditions) sources.set(row.path, row);
  for (const { path, after } of composition.paths) sources.set(path, { path, bytes: after.bytes, sha256: after.sha256 });
  const extra = [delta.sharedEntry, delta.runtimeProof, delta.supervisor];
  for (const binding of [...original.bindings, ...extra]) await pinned(binding);
  const input = {
    ...original, target, sourceTree: delta.sourceTree, sourceArchive: delta.sourceArchive,
    fixedSourceInputs: [...sources.values()], bindings: [...original.bindings, ...extra],
    inputProvenance: { inheritedSha256: hash(originalBytes), deltaSha256: hash(bytes), compositionSha256: delta.composition.sha256 },
    preparationNotes: 'SVC09A: fixed098b =04da plus15 reviewed paths. Original builder in a new empty store. No host, PG, native process, provider or personal activation.',
  };
  return { inputBytes: Buffer.from(JSON.stringify(input)), delta };
}

export async function main(argv) {
  assert.deepEqual(argv, ['--execute-fixed-build']);
  const { inputBytes, delta } = await loadFixedBuildInput();
  const { runFixedArtifact } = await import(pathToFileURL(delta.sharedEntry.path).href);
  return runFixedArtifact(inputBytes, delta.options);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main(process.argv.slice(2));
