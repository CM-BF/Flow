import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSession, compressSession, retrieveOriginals, encodeSession, decodeSession, forkSession } from './host.mjs';

test('fixed summaries preserve exact Unicode originals by ref across serialization', () => {
  const initial = createSession('test-a');
  const compressed = compressSession(initial);
  assert.equal(compressed.state.blocks.length, 1);
  assert.ok(compressed.visibleBytes < initial.rawBytes);
  const restored = decodeSession(encodeSession(compressed), { sessionId: initial.sessionId, revision: 1 });
  assert.equal(retrieveOriginals(restored).verified, 4);
  assert.equal(restored.contentStore.byHash[restored.expected[0].hash], initial.messages[1].text);
});
test('host rejects unknown schema, old kernel version, stale revision and wrong session', () => {
  const session = compressSession(createSession('version-test'));
  for (const [field, value] of [['schemaVersion', 2], ['kernelVersion', '0.0.100'], ['revision', 0], ['sessionId', 'another-session']]) {
    assert.throws(() => decodeSession(JSON.stringify({ ...session, [field]: value }), { sessionId: 'version-test', revision: 1 }), /HOST_ENVELOPE_REJECTED/);
  }
});
test('host fork preserves lineage and separates child state/store from parent and sibling sessions', () => {
  const parent = compressSession(createSession('parent'));
  const before = encodeSession(parent);
  const child = forkSession(parent, 'child');
  child.state.blocks[0].summary = 'child-only summary';
  child.contentStore.byHash[child.expected[0].hash] = 'child-only corrupt bytes';
  assert.equal(encodeSession(parent), before);
  assert.equal(child.parentSessionId, parent.sessionId);
  assert.equal(retrieveOriginals(parent).verified, 4);
  assert.throws(() => retrieveOriginals(child));
  const other = compressSession(createSession('other'));
  assert.notEqual(other.expected[0].hash, parent.expected[0].hash);
});
