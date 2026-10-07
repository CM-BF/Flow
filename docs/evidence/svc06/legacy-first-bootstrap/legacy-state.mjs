import assert from 'node:assert/strict';

// This fixture never adopts an artifact by writing state. Only maintenance.json may acquire it.
export function assertLegacyCleanupState(state, operation, artifact) {
  assert.equal(Object.hasOwn(state, 'backendArtifact'), false, 'LEGACY_STATE_WAS_PRESEEDED');
  if (operation !== null) {
    assert.deepEqual(operation.backendArtifact, artifact, 'UNEXPECTED_MAINTENANCE_ARTIFACT');
    assert.equal(operation.target, artifact.sourceHead);
    assert.match(operation.operationId, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    assert.equal(operation.phase, 'drain-requested');
  }
}
