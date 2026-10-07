import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, realpath, rm, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fixedArtifactOptions, runFixedArtifact } from '../update-diagnostics-candidate/build-once/entry.mjs';
import { loadFixedBuildInput, main } from './build-entry.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const shared = join(here, '../update-diagnostics-candidate/build-once/entry.mjs');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

test('default CLI paths and explicit new namespace retain the same three-option boundary', () => {
  assert.deepEqual(fixedArtifactOptions(), {
    evidenceDirectory: dirname(shared), temporaryPrefix: '/private/tmp/flow-svc06-diagnostics-artifact-',
    runtimeProof: join(dirname(shared), 'runtime-proof.mjs'),
  });
  const options = { evidenceDirectory: here, temporaryPrefix: '/private/tmp/flow-svc06b-artifact-', runtimeProof: '/private/tmp/flow-proof.mjs' };
  assert.deepEqual(fixedArtifactOptions(options), options);
  assert.throws(() => fixedArtifactOptions({ ...options, resourceBudget: 0 }));
  assert.throws(() => fixedArtifactOptions({ evidenceDirectory: '../escape' }));
});

test('both entry imports perform no filesystem operations or process launch', async () => {
  const code = `
    import fs from 'node:fs/promises';
    import child from 'node:child_process';
    import { syncBuiltinESMExports } from 'node:module';
    for (const name of ['readFile','mkdir','mkdtemp','open','readdir','lstat','realpath','statfs']) fs[name] = () => { throw Error('UNEXPECTED_FS_'+name); };
    child.execFile = () => { throw Error('UNEXPECTED_SPAWN'); };
    syncBuiltinESMExports();
    await import(${JSON.stringify(new URL('../update-diagnostics-candidate/build-once/entry.mjs', import.meta.url).href)});
    await import(${JSON.stringify(new URL('./build-entry.mjs', import.meta.url).href)});
    console.log('IMPORT_NO_IO');
  `;
  const output = await promisify(execFile)(process.execPath, ['--input-type=module', '-e', code], { timeout: 3000, maxBuffer: 2048 });
  assert.equal(output.stdout.trim(), 'IMPORT_NO_IO');
  assert.equal(output.stderr, '');
});

test('new namespace reserves exact input bytes; duplicate refuses without overwriting first failure', async () => {
  const scratch = await realpath(await mkdtemp(join(process.env.TMPDIR, 'reservation-')));
  const input = Buffer.from('{ "target": "fixture", "ready": "REFUSE_BEFORE_BUILD", "resources": {"rawBytes":2097152,"liveReserveBytes":0,"additionalBudgetBytes":0} }\n');
  try {
    const first = await runFixedArtifact(input, { evidenceDirectory: scratch });
    process.exitCode = 0;
    assert.equal(first.directory, null);
    assert.equal(first.phase, 'failed-or-unknown');
    const reservation = JSON.parse(await readFile(join(scratch, 'actual-first/reservation.json')));
    assert.equal(reservation.inputSha256, hash(input));
    const before = await readFile(join(scratch, 'actual-first/result.json'));
    const second = await runFixedArtifact(input, { evidenceDirectory: scratch });
    process.exitCode = 0;
    assert.equal(second.reservation, null);
    assert.equal(second.failures[0].code, 'EEXIST');
    assert.deepEqual(await readFile(join(scratch, 'actual-first/result.json')), before);
    assert.deepEqual((await readdir(join(scratch, 'actual-first'))).sort(), ['reservation.json', 'result.json']);
  } finally {
    process.exitCode = 0;
    await rm(scratch, { recursive: true });
  }
});

test('actual fixed input and exact argv load without install, reservation, or build', async () => {
  await assert.rejects(main([]));
  const { inputBytes, delta } = await loadFixedBuildInput();
  const input = JSON.parse(inputBytes);
  assert.equal(input.target, '04da80692e79e2b7c3f6341c7fa76515a3f719a3');
  assert.equal(input.fixedSourceInputs.length, 75);
  assert.equal(input.snapshots, 271);
  assert.equal(input.sql.length, 33);
  assert.equal(input.resources.additionalBudgetBytes, 2317352960);
  assert.equal(input.resources.minimumFreeBytes, 3927965696);
  assert.equal(input.inputProvenance.inheritedSha256, delta.inherited.sha256);
  assert.equal(delta.options.evidenceDirectory, here);
  await assert.rejects(readFile(join(here, 'actual-first/reservation.json')), { code: 'ENOENT' });
});
