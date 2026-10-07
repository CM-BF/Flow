import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WEB_RETENTION_POLICY, assertRetainedArtifacts, assertRetainedAssetBytes, committedReportIds } from './web-retention-policy.mjs';
test('SVC09 count4 preserves existing byte and report limits with strict inclusive boundaries', () => {
  assert.deepEqual(WEB_RETENTION_POLICY, { artifacts: 4, assetBytes: 201326592, reports: 32, reportFileBytes: 4096, releaseBytes: 16384 });
  assertRetainedArtifacts(3); assertRetainedArtifacts(4); assertRetainedAssetBytes(0); assertRetainedAssetBytes(201326592);
  for (const n of [0, 5, 1.5, Infinity]) assert.throws(() => assertRetainedArtifacts(n), { code: 'WEB_RETENTION_BUDGET_EXCEEDED' });
  for (const n of [-1, 201326593, NaN]) assert.throws(() => assertRetainedAssetBytes(n), { code: 'WEB_RETENTION_BUDGET_EXCEEDED' });
  const ids = Array.from({ length: 32 }, (_, n) => n.toString(16).padStart(64, '0'));
  assert.equal(committedReportIds([...ids, '.stage-kept']).length, 32);
  assert.throws(() => committedReportIds(ids, true), { code: 'WEB_COMPATIBILITY_BUDGET_EXCEEDED' });
  assert.throws(() => committedReportIds([...ids, 'f'.repeat(64)]), { code: 'WEB_COMPATIBILITY_BUDGET_EXCEEDED' });
});
