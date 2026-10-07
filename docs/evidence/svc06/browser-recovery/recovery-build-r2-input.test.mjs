import { test } from 'node:test';
import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import { fixedOptions } from './recovery-build-r2-entry.mjs';
import { loadRecoveryBuild } from './recovery-build-entry.mjs';

test('actual fixed R2 input loads the corrected source through original build bindings without launch', async () => {
  const { inputBytes, delta } = await loadRecoveryBuild(fixedOptions);
  const input = JSON.parse(inputBytes);
  assert.equal(input.target, '880060a317cd99f3f29b41333f6dd7d7f5ab1488');
  assert.equal(input.sourceTree, '27cf190b00b3244026952ab85b0d922368676715');
  assert.equal(input.fixedSourceInputs.length, 77);
  assert.equal(input.fixedSourceInputs.find(row => row.path === 'tools/personal-preview/preview.mjs').sha256,
    'ab59c6be5be67b00eda33bb0c8e1769feac98e1c32dc80a4a96de9de0baee2b2');
  assert.equal(delta.options.evidenceDirectory, fixedOptions.evidenceDirectory);
  assert.equal(delta.options.temporaryPrefix, fixedOptions.temporaryPrefix);
  await assert.rejects(access(fixedOptions.evidenceDirectory), { code: 'ENOENT' });
});
