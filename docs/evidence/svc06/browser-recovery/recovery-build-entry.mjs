// Input composition only. The original builder and OPS14 retain lifecycle ownership.
import assert from 'node:assert/strict';
import { readFile, lstat, realpath } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const BASE = '04da80692e79e2b7c3f6341c7fa76515a3f719a3';

export function recoveryBuildInput(originalBytes, prior, deltaBytes) {
  const original = JSON.parse(originalBytes), delta = JSON.parse(deltaBytes);
  assert.equal(prior.kind, 'SVC06B_FIXED_INPUT_DELTA');
  assert.equal(prior.target, BASE);
  assert.equal(original.target, '6c0fdcda8858aac33489c48c1948e902dd6a3d7e');
  assert.equal(sha(originalBytes), prior.inherited.sha256);
  assert.equal(delta.kind, 'SVC06B_FIXED_RECOVERY_BUILD');
  assert.equal(delta.base, BASE);
  assert.match(delta.target, /^[a-f0-9]{40}$/); assert.notEqual(delta.target, BASE);
  assert.match(delta.sourceTree, /^[a-f0-9]{40}$/);
  assert.equal(delta.sourceChanges.length, 7);
  assert.deepEqual(delta.sourceChanges.map(value => value.path).sort(), [
    'apps/runner/src/main.ts', 'apps/runner/src/runtime.ts',
    'tools/personal-preview/backend-release/host.mjs', 'tools/personal-preview/maintenance-host.mjs',
    'tools/personal-preview/maintenance-target.mjs', 'tools/personal-preview/preview.mjs',
    'tools/personal-preview/startup-diagnostics.mjs',
  ]);
  assert.ok(Number.isSafeInteger(delta.minimumFreeBytes) && delta.minimumFreeBytes >= 3927965696);
  const sources = new Map([...original.fixedSourceInputs, ...prior.fixedSourceAdditions].map(value => [value.path, value]));
  for (const source of delta.sourceChanges) {
    assert.ok(source.path.startsWith('tools/personal-preview/') || ['apps/runner/src/runtime.ts', 'apps/runner/src/main.ts'].includes(source.path));
    assert.ok(Number.isSafeInteger(source.bytes) && source.bytes > 0); assert.match(source.sha256, /^[a-f0-9]{64}$/);
    sources.set(source.path, source);
  }
  return {
    ...original, target: delta.target, sourceTree: delta.sourceTree, sourceArchive: delta.sourceArchive,
    fixedSourceInputs: [...sources.values()],
    resources: { ...original.resources, minimumFreeBytes: delta.minimumFreeBytes },
    inputProvenance: { inheritedSha256: sha(originalBytes), priorDeltaSha256: delta.prior.sha256,
      recoveryDeltaSha256: sha(deltaBytes), compositionSha256: delta.composition.sha256 },
    bindings: [...original.bindings, delta.prior, delta.composition, delta.sharedEntry, delta.runtimeProof, delta.supervisor],
    preparationNotes: 'Fixed04da plus seven reviewed recovery runtime leaves only; original dependencies/SQL/limits; no personal operation.',
  };
}

async function readPin(binding) {
  assert.equal(await realpath(binding.path), binding.realpath);
  const stat = await lstat(binding.path); assert.ok(stat.isFile() && !stat.isSymbolicLink());
  assert.equal(stat.size, binding.bytes);
  const bytes = await readFile(binding.path); assert.equal(sha(bytes), binding.sha256);
  return bytes;
}

export async function loadRecoveryBuild({ inputPath = join(here, 'recovery-build-inputs.json'),
  evidenceDirectory = join(here, 'recovery-build-once'),
  temporaryPrefix = '/private/tmp/flow-svc06b-recovery-artifact-' } = {}) {
  const bytes = await readFile(inputPath);
  const delta = JSON.parse(bytes), prior = JSON.parse(await readPin(delta.prior));
  const original = await readPin(prior.inherited);
  for (const binding of [delta.composition, delta.sharedEntry, delta.runtimeProof, delta.supervisor]) await readPin(binding);
  assert.equal(delta.options.evidenceDirectory, evidenceDirectory);
  assert.equal(delta.options.temporaryPrefix, temporaryPrefix);
  assert.equal(delta.options.runtimeProof, delta.runtimeProof.path);
  return { inputBytes: Buffer.from(JSON.stringify(recoveryBuildInput(original, prior, bytes))), delta };
}

export async function main(argv) {
  assert.deepEqual(argv, ['--execute-fixed-recovery-build']);
  const { inputBytes, delta } = await loadRecoveryBuild();
  const { runFixedArtifact } = await import(pathToFileURL(delta.sharedEntry.path).href);
  await runFixedArtifact(inputBytes, delta.options);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main(process.argv.slice(2));
