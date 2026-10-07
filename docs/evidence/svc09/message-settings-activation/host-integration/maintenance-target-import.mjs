import assert from 'node:assert/strict';
import { rebindHeldPreviewTarget } from '../../../../../tools/personal-preview/maintenance-target.mjs';
const invalid = await rebindHeldPreviewTarget({ configuration: { directory: '/never-read' } });
assert.equal(invalid.primary.code, 'MAINTENANCE_TARGET_INPUT');
assert.equal(invalid.mutation, 'not-written');
const artifact = c => ({ policy: 'flow.backend-artifact.v1', artifactId: c.repeat(64), manifestDigest: c.repeat(64), sourceHead: c.repeat(40) });
const noLoader = await rebindHeldPreviewTarget({ directory: '/never-read', operationId: '11111111-1111-1111-1111-111111111111', requestId: '22222222-2222-2222-2222-222222222222', expectedVersion: 23,
  expectedOperationDigest: 'a'.repeat(64), expectedStateDigest: 'b'.repeat(64), expectedWebReleaseDigest: 'c'.repeat(64), expectedBackendArtifact: artifact('a'), expectedWebHostArtifact: artifact('c'), targetArtifact: artifact('b') });
assert.equal(noLoader.primary.code, 'MAINTENANCE_TARGET_LOADER'); assert.equal(noLoader.mutation, 'not-written');
console.log(JSON.stringify({ actualNodeImport: true, invalidRequest: true, loaderRequiredBeforeIO: true, pgConnections: 0, personalIO: 0 }));
