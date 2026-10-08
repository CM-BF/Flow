import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixedCompositionPins, runHostConsumer } from '../host-integration/host-consumer.mjs';
const sourceHead = 'a'.repeat(40);
const pin = { path: 'tools/personal-preview/preview.mjs', bytes: 123, sha256: 'b'.repeat(64) };
test('dual slot fixed source port admits copied exact pins and rejects mismatch, duplicate and escape', () => {
  const input = { target: sourceHead, paths: [pin] }, result = fixedCompositionPins(input, sourceHead);
  assert.deepEqual(result, [pin]); assert.notEqual(result[0], pin);
  for (const bad of [
    { ...input, target: 'c'.repeat(40) }, { ...input, paths: [pin, pin] },
    { ...input, paths: [{ ...pin, path: 'tools/../config.json' }] },
    { ...input, paths: [{ ...pin, path: '/tmp/other' }] },
    { ...input, paths: [{ ...pin, sha256: 'unknown' }] },
  ]) assert.throws(() => fixedCompositionPins(bad, sourceHead));
});
test('dual slot actual work consumer rejects wrong fixed source before private path access', async () => {
  const input = { format: 1, directory: '/private/tmp/flow-svc09a-host-NOT_CREATED', sourceHead,
    artifact: { artifactId: 'd'.repeat(64), manifestDigest: 'd'.repeat(64), sourceHead }, repository: '/tmp/fixed-repository', choices: [{}, {}] };
  await assert.rejects(runHostConsumer({ input, checkpoint: () => { throw Error('NO_CHECKPOINT'); },
    pool: { query() { throw Error('NO_PG'); } } }, { composition: { target: 'c'.repeat(40), paths: [pin] } }), /HOST_COMPOSITION_TARGET_MISMATCH/);
});
