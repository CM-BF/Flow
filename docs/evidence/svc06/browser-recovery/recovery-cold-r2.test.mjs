import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { main as shared } from './recovery-cold-entry.mjs';
import { main, fixedOptions } from './recovery-cold-r2-entry.mjs';
test('real successor entry imports and rejects argv before any work or cleanup', async () => {
  for (const entry of [shared, main]) await assert.rejects(entry(['invalid']), { code: 'ERR_ASSERTION' });
  assert.equal(fixedOptions.expectedSource, '880060a317cd99f3f29b41333f6dd7d7f5ab1488');
  const input = JSON.parse(await readFile(fixedOptions.fixedInput));
  assert.equal(input.artifact.artifactId, 'e15dd368379a2be90b3c0c9d083cf27f9c26770e425e60e8cf078a127c9f15dd');
  assert.equal(input.sourceHead, fixedOptions.expectedSource);
  assert.equal(input.limits.mixedTasks, 0); assert.equal(input.providerCalls, 0);
});
test('shared entry refuses an unexpected artifact source before work or private input reading', async () => {
  await assert.rejects(shared(['--work-once', '/private/tmp/flow-svc09a-host-12345678/input.json'],
    { ...fixedOptions, expectedSource: 'f37a3612068c7215994750574a7451ede841bcce' }), { code: 'ERR_ASSERTION' });
});

test('generated input manifest pin matches corrected source root and artifact tuple', async () => {
  const input = JSON.parse(await readFile(fixedOptions.fixedInput));
  const original = JSON.parse(await readFile(new URL('./recovery-cold-inputs.json', import.meta.url)));
  const manifestPath = `${input.sourceDirectory}/backend-artifacts/${input.artifact.artifactId}/manifest.json`;
  assert.equal(input.bindings.length, 6);
  assert.deepEqual(input.bindings.slice(0, 5), original.bindings.slice(0, 5));
  assert.deepEqual(input.bindings[5], { path: manifestPath, realpath: manifestPath,
    bytes: input.manifestBytes, sha256: input.artifact.manifestDigest });
  assert.equal(input.artifact.manifestDigest, input.artifact.artifactId);
  assert.equal(input.artifact.sourceHead, input.sourceHead);
  const { createHash } = await import('node:crypto');
  for (const [file, field] of [['recovery-cold-r2-preparation.json', 'fixedInput'], ['recovery-cold-r2-dispatch.json', 'input']]) {
    const record = JSON.parse(await readFile(new URL(file, import.meta.url)));
    const bytes = await readFile(fixedOptions.fixedInput);
    assert.equal(record[field].bytes, bytes.length);
    assert.equal(record[field].sha256, createHash('sha256').update(bytes).digest('hex'));
  }
  const dispatch = JSON.parse(await readFile(new URL('./recovery-cold-r2-dispatch.json', import.meta.url)));
  const preparation = await readFile(new URL('./recovery-cold-r2-preparation.json', import.meta.url));
  assert.equal(dispatch.preparation.bytes, preparation.length);
  assert.equal(dispatch.preparation.sha256, createHash('sha256').update(preparation).digest('hex'));
});
