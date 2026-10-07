import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { assertResourceSample } from './host-entry.mjs';
import { mayDrop, readWorkDisposition } from './host-cleanup.mjs';

test('complete directory samples retain transient vanished entries without weakening real limits', () => {
  const sample = { directory: { state: 'complete', entries: 2, logical_bytes: 0, vanished_entries: 1 }, databaseBytes: null, freeBytes: 1024 ** 3 };
  assert.doesNotThrow(() => assertResourceSample(sample));
  assert.equal(sample.directory.vanished_entries, 1);
  for (const change of [{ state: 'unknown' }, { entries: 4097 }, { logical_bytes: 32 * 1024 ** 2 + 1 }]) {
    assert.throws(() => assertResourceSample({ ...sample, directory: { ...sample.directory, ...change } }));
  }
});

test('missing work disposition remains unknown and refuses DROP despite otherwise complete cleanup', async () => {
  const scratch = process.env.FLOW_SVC09A_PREPARE_SCRATCH;
  assert.match(scratch ?? '', /^\/private\/tmp\/flow-svc09a-review-/);
  const failures = [], outer = await readWorkDisposition(join(scratch, 'never-created-work-outer.json'), failures);
  assert.deepEqual(outer, { owned_state: 'unknown' });
  assert.equal(failures.length, 1); assert.equal(failures[0].phase, 'work-outer-read'); assert.equal(failures[0].code, 'ENOENT');
  assert.equal(mayDrop({ outer, work: { workComplete: true, primary: null, cleanupFailures: [] },
    closure: { loopsSettled: true, errors: [null, null] }, allStopped: true, databaseCreated: true }), false);
});
