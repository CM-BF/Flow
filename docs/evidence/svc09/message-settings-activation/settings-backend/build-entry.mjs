// This caller changes only the fixed source map. SVC06 owns the offline builder.
import assert from 'node:assert/strict';
import { readFile, lstat, realpath } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
export const TARGET = 'f9221dbdce367d1794586471991adbe7a5a98c13';
export const ARGUMENT = '--execute-settings-build-once';
const sha = value => createHash('sha256').update(value).digest('hex');
export async function pinned(binding) {
  assert.equal(await realpath(binding.path), binding.realpath);
  const stat = await lstat(binding.path);
  assert.ok(stat.isFile() && !stat.isSymbolicLink());
  const bytes = await readFile(binding.path);
  assert.equal(bytes.length, binding.bytes); assert.equal(sha(bytes), binding.sha256);
  return bytes;
}
export function composeSettingsInput(base, delta) {
  assert.equal(base.target, '880060a317cd99f3f29b41333f6dd7d7f5ab1488');
  assert.equal(delta.kind, 'SVC09A_SETTINGS_BACKEND_FIXED_BUILD');
  assert.equal(delta.base, base.target); assert.equal(delta.target, TARGET);
  assert.deepEqual(delta.sourceChanges.map(row => row.path).sort(), [
    'apps/server/src/runners.ts', 'tools/personal-preview/backend-release/files.mjs',
    'tools/personal-preview/backend-release/index.mjs', 'tools/personal-preview/cli.mjs',
    'tools/personal-preview/environment.mjs', 'tools/personal-preview/maintenance-host.mjs',
    'tools/personal-preview/preview.mjs', 'tools/personal-preview/process.mjs',
    'tools/personal-preview/runner-slots.mjs', 'tools/personal-preview/startup-diagnostics.mjs',
  ]);
  assert.ok(Number.isSafeInteger(delta.minimumFreeBytes) && delta.minimumFreeBytes >= 3927965696);
  const sources = new Map(base.fixedSourceInputs.map(row => [row.path, row]));
  for (const row of delta.sourceChanges) {
    assert.ok(Number.isSafeInteger(row.bytes) && row.bytes > 0); assert.match(row.sha256, /^[a-f0-9]{64}$/);
    sources.set(row.path, row);
  }
  return { ...base, target: TARGET, sourceTree: delta.sourceTree, sourceArchive: delta.sourceArchive,
    fixedSourceInputs: [...sources.values()], resources: { ...base.resources, minimumFreeBytes: delta.minimumFreeBytes },
    bindings: [...base.bindings, delta.baseLoader, delta.baseInput],
    inputProvenance: { ...base.inputProvenance, settingsDeltaSha256: sha(JSON.stringify(delta)) },
    preparationNotes: 'Fixed880060 plus ten reviewed settings/eligibility/retention leaves; empty offline store; no host/PG/personal/provider.',
  };
}
export async function loadSettingsBuild() {
  const delta = JSON.parse(await readFile(join(here, 'build-inputs.json')));
  const baseDelta = JSON.parse(await pinned(delta.baseInput));
  await pinned(delta.baseLoader);
  for (const binding of [delta.sharedEntry, delta.runtimeProof, delta.supervisor]) await pinned(binding);
  const { loadRecoveryBuild } = await import(pathToFileURL(delta.baseLoader.path).href);
  const { inputBytes } = await loadRecoveryBuild({ inputPath: delta.baseInput.path,
    evidenceDirectory: baseDelta.options.evidenceDirectory, temporaryPrefix: baseDelta.options.temporaryPrefix });
  assert.equal(delta.options.evidenceDirectory, join(here, 'build-once'));
  assert.equal(delta.options.temporaryPrefix, '/private/tmp/flow-svc09a-settings-artifact-');
  assert.equal(delta.options.runtimeProof, delta.runtimeProof.path);
  const input = composeSettingsInput(JSON.parse(inputBytes), delta);
  for (const binding of input.bindings) await pinned(binding);
  return { input, delta };
}
export async function main(argv) {
  assert.deepEqual(argv, [ARGUMENT]);
  const { input, delta } = await loadSettingsBuild();
  const { runFixedArtifact } = await import(pathToFileURL(delta.sharedEntry.path).href);
  return runFixedArtifact(Buffer.from(JSON.stringify(input)), delta.options);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main(process.argv.slice(2));
