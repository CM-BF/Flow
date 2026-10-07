import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { recoveryBuildInput, loadRecoveryBuild, main } from './recovery-build-entry.mjs';

test('fixed recovery input replaces exact source assertions and retains inherited dependency/resource bounds', async () => {
  const { inputBytes, delta } = await loadRecoveryBuild();
  const value = JSON.parse(inputBytes);
  assert.equal(value.target, 'f37a3612068c7215994750574a7451ede841bcce');
  assert.equal(value.sourceTree, 'de843e0fda82600b4d7600c76614c9794c17e3af');
  assert.equal(value.sourceArchive.files, 999);
  assert.equal(new Set(value.fixedSourceInputs.map(row => row.path)).size, value.fixedSourceInputs.length);
  for (const change of delta.sourceChanges) assert.deepEqual(value.fixedSourceInputs.find(row => row.path === change.path), change);
  const prior = JSON.parse(await readFile(delta.prior.path));
  const originalBytes = await readFile(prior.inherited.path), original = JSON.parse(originalBytes);
  for (const key of ['sql', 'snapshotKeys', 'importers', 'hostTools', 'lockSha256', 'nodeVersion', 'builderModule', 'offlineStore', 'pnpmCli']) {
    assert.deepEqual(value[key], original[key]);
  }
  assert.deepEqual(value.resources, original.resources);
  const bad = { ...delta, sourceChanges: delta.sourceChanges.slice(1) };
  assert.throws(() => recoveryBuildInput(originalBytes, prior, Buffer.from(JSON.stringify(bad))));
  assert.throws(() => recoveryBuildInput(Buffer.from('{}'), prior, Buffer.from(JSON.stringify(delta))));
});

test('recovery entry rejects wrong action before build or reservation', async () => {
  await assert.rejects(main(['--execute-fixed-build']));
  await assert.rejects(main([]));
});
