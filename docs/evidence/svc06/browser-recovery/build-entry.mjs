import assert from 'node:assert/strict';
import { readFile, lstat, realpath } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const digest = bytes => createHash('sha256').update(bytes).digest('hex');

async function pinnedBytes(binding) {
  assert.equal(await realpath(binding.path), binding.realpath);
  const info = await lstat(binding.realpath);
  assert.ok(info.isFile() && !info.isSymbolicLink());
  assert.equal(info.size, binding.bytes);
  const bytes = await readFile(binding.realpath);
  assert.equal(digest(bytes), binding.sha256);
  return bytes;
}

// Fixed inherited JSON stays intact. Only the reviewed source tuple is replaced.
export async function loadFixedBuildInput() {
  const deltaBytes = await readFile(join(here, 'build-inputs.json'));
  const delta = JSON.parse(deltaBytes);
  assert.equal(delta.kind, 'SVC06B_FIXED_INPUT_DELTA');
  assert.equal(delta.target, '04da80692e79e2b7c3f6341c7fa76515a3f719a3');
  const originalBytes = await pinnedBytes(delta.inherited);
  const original = JSON.parse(originalBytes);
  assert.equal(original.target, '6c0fdcda8858aac33489c48c1948e902dd6a3d7e');
  await pinnedBytes(delta.sharedEntry);
  await pinnedBytes(delta.runtimeProof);
  await pinnedBytes(delta.supervisor);
  const input = {
    ...original, target: delta.target, sourceTree: delta.sourceTree,
    sourceArchive: delta.sourceArchive,
    fixedSourceInputs: [...original.fixedSourceInputs, ...delta.fixedSourceAdditions],
    inputProvenance: { inheritedSha256: digest(originalBytes), deltaSha256: digest(deltaBytes) },
    bindings: [...original.bindings, delta.sharedEntry, delta.runtimeProof, delta.supervisor],
    preparationNotes: 'SVC06B: fixed 6c plus three reviewed late-Logout leaves; separate artifact, no moving-main or personal operation.',
  };
  return { inputBytes: Buffer.from(JSON.stringify(input)), delta };
}

export async function main(argv) {
  assert.deepEqual(argv, ['--execute-fixed-build']);
  const { inputBytes, delta } = await loadFixedBuildInput();
  const { runFixedArtifact } = await import(pathToFileURL(delta.sharedEntry.path).href);
  await runFixedArtifact(inputBytes, delta.options);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main(process.argv.slice(2));
}
