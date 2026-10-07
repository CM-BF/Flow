import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, realpath, readFile, writeFile, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadRecoveryBuild } from './recovery-build-entry.mjs';
import { main, fixedOptions } from './recovery-build-r2-entry.mjs';

test('original recovery load defaults retain the exact old input and namespace', async () => {
  const { inputBytes, delta } = await loadRecoveryBuild();
  assert.equal(JSON.parse(inputBytes).target, 'f37a3612068c7215994750574a7451ede841bcce');
  assert.ok(delta.options.evidenceDirectory.endsWith('/recovery-build-once'));
});
test('trusted successor options require exact input namespace and keep original verifier bindings', async t => {
  const directory = await realpath(await mkdtemp(join(tmpdir(), 'recovery-r2-input-')));
  t.after(() => rm(directory, { recursive: true }));
  const delta = JSON.parse(await readFile(new URL('./recovery-build-inputs.json', import.meta.url)));
  const inputPath = join(directory, 'input.json'), evidenceDirectory = join(directory, 'new-once');
  const temporaryPrefix = '/private/tmp/flow-svc06b-recovery-r2-artifact-';
  delta.options = { ...delta.options, evidenceDirectory, temporaryPrefix };
  await writeFile(inputPath, JSON.stringify(delta), { mode: 0o600, flag: 'wx' });
  const { inputBytes } = await loadRecoveryBuild({ inputPath, evidenceDirectory, temporaryPrefix });
  const built = JSON.parse(inputBytes);
  assert.equal(built.fixedSourceInputs.length, 77);
  assert.ok(built.bindings.some(pin => pin.sha256 === delta.sharedEntry.sha256));
  await assert.rejects(loadRecoveryBuild({ inputPath }), { code: 'ERR_ASSERTION' });
  await assert.rejects(access(evidenceDirectory), { code: 'ENOENT' });
});
test('successor real entry rejects wrong argv without creating its new namespace', async () => {
  await assert.rejects(access(fixedOptions.evidenceDirectory), { code: 'ENOENT' });
  await assert.rejects(main(['--execute-fixed-recovery-build']), { code: 'ERR_ASSERTION' });
  await assert.rejects(access(fixedOptions.evidenceDirectory), { code: 'ENOENT' });
});
