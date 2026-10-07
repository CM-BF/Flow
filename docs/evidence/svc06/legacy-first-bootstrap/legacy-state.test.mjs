import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertLegacyCleanupState } from './legacy-state.mjs';
const artifact = { artifactId: 'a'.repeat(64), sourceHead: 'b'.repeat(40) };
const operation = { backendArtifact: artifact, target: artifact.sourceHead, operationId: '12345678-1234-4234-8234-123456789abc', phase: 'drain-requested' };

test('legacy cleanup permits no operation and the one exact public bootstrap operation', () => {
  assertLegacyCleanupState({ processes: {} }, null, artifact);
  assertLegacyCleanupState({ processes: {} }, operation, artifact);
});
test('legacy cleanup rejects preseeded state including null', () => {
  for (const backendArtifact of [null, artifact]) assert.throws(() => assertLegacyCleanupState({ backendArtifact }, operation, artifact));
});
test('legacy cleanup rejects another artifact, target, phase, or malformed operation identity', () => {
  for (const changed of [{ backendArtifact: { ...artifact, artifactId: 'c'.repeat(64) } }, { target: 'd'.repeat(40) }, { phase: 'ready-paused' }, { operationId: 'unknown' }]) {
    assert.throws(() => assertLegacyCleanupState({}, { ...operation, ...changed }, artifact));
  }
});
