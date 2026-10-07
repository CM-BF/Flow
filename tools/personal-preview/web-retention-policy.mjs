/** Fixed host policy, never caller-controlled admission options. */
export const WEB_RETENTION_POLICY = Object.freeze({ artifacts: 4, assetBytes: 192 * 1024 * 1024,
  reports: 32, reportFileBytes: 4096, releaseBytes: 16_384 });
function fail(code) { const error = new Error(code); error.code = code; throw error; }
export function assertRetainedArtifacts(count) {
  if (!Number.isSafeInteger(count) || count < 1 || count > WEB_RETENTION_POLICY.artifacts) fail('WEB_RETENTION_BUDGET_EXCEEDED');
}
export function assertRetainedAssetBytes(bytes) {
  if (!Number.isSafeInteger(bytes) || bytes < 0 || bytes > WEB_RETENTION_POLICY.assetBytes) fail('WEB_RETENTION_BUDGET_EXCEEDED');
}
export function committedReportIds(names, reserveNew = false) {
  const ids = names.filter(name => /^[a-f0-9]{64}$/.test(name)).sort();
  if (ids.length + (reserveNew ? 1 : 0) > WEB_RETENTION_POLICY.reports) fail('WEB_COMPATIBILITY_BUDGET_EXCEEDED');
  return ids;
}

export function assertArtifactStorageSlots(count, reserveNew = false) {
  if (!Number.isSafeInteger(count) || count < 0 || count + (reserveNew ? 1 : 0) > WEB_RETENTION_POLICY.artifacts) fail('WEB_ARTIFACT_STORAGE_BUDGET_EXCEEDED');
}
