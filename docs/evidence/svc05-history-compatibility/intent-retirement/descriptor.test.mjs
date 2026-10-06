import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { compareLegacyRelease } from './release-seam.mjs';
import * as preservation from '../release-operation/preservation.mjs';
const read = async relative => JSON.parse(await readFile(new URL(relative, import.meta.url)));

test('saved personal preflight accepts equal retained tuple despite key order; all raw remains unchanged', async () => {
  const before = await read('./run-retirement-release-20261006T211659Z/01-before.json');
  const proposal = await read('../release-operation/proposal.json'), request = await read('./frozen-input-template.json');
  const bytes = JSON.stringify(before); const result = compareLegacyRelease(before, before, 'preflight', proposal, request);
  assert.equal(result.checks.retained, true); assert.equal(result.passed, true, JSON.stringify(result.checks));
  assert.equal(result.ordinaryNativeChecks.nativeIdle, false); assert.equal(JSON.stringify(before), bytes);
});
test('artifact tuple comparison ignores insertion order but rejects missing, unknown and changed fields', () => {
  const a = { artifactId: 'artifact', manifestDigest: 'digest', sourceHead: 'source' };
  const b = { sourceHead: 'source', artifactId: 'artifact', manifestDigest: 'digest' };
  assert.equal(preservation.sameArtifact(a, b), true);
  for (const changed of [{ ...b, sourceHead: 'other' }, { ...b, artifactId: 'other' }, { ...b, manifestDigest: 'other' },
    { ...b, extra: true }, { artifactId: 'artifact', manifestDigest: 'digest' }, { ...b, sourceHead: null }, null, []]) {
    assert.equal(preservation.sameArtifact(a, changed), false);
  }
});
test('published retained tuple list keeps array order and membership strict', () => {
  const a = { artifactId: 'a', manifestDigest: 'a', sourceHead: 'one' }, b = { artifactId: 'b', manifestDigest: 'b', sourceHead: 'two' };
  const reordered = { sourceHead: 'one', manifestDigest: 'a', artifactId: 'a' };
  assert.equal(preservation.sameArtifacts([a, b], [reordered, b]), true);
  assert.equal(preservation.sameArtifacts([a, b], [b, reordered]), false);
  assert.equal(preservation.sameArtifacts([a, b], [a]), false);
  assert.equal(preservation.sameArtifacts([a, b], [a, b, a]), false);
  assert.equal(preservation.sameArtifacts([a, b], [a, { ...b, unknown: 1 }]), false);
});
