import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runtimeCachePlan } from './cache-plan.mjs';
const sri = byte => `sha512-${Buffer.alloc(64, byte).toString('base64')}`;
const indexPath = byte => `files/${byte.toString(16).padStart(2, '0')}/${byte.toString(16).padStart(2, '0').repeat(63)}-index.json`;
function fixture() {
  const packages = [{ key: 'one@1.0.0', integrity: sri(1), cacheIndex: indexPath(1) }, { key: '@scope/two@2.0.0', integrity: sri(2), cacheIndex: indexPath(2) }];
  const indexes = Object.fromEntries(packages.map((pkg, i) => [pkg.cacheIndex, JSON.stringify({ name: i ? '@scope/two' : 'one', version: i ? '2.0.0' : '1.0.0', files: {
    'package.json': { integrity: sri(3), mode: 0o644, size: 42 },
    'bin/native': { integrity: sri(4), mode: 0o755, size: 123 },
  } })]));
  return { plan: { policy: 'flow.backend-runtime-closure.v1', packages }, indexes };
}
test('selects only required index/content identities with executable paths and shared-content deduplication', () => {
  const { plan, indexes } = fixture();
  indexes['irrelevant-index'] = 'unread';
  const result = runtimeCachePlan(plan, indexes);
  assert.equal(result.files.length, 4);
  assert.equal(result.files.filter(file => file.kind === 'index').length, 2);
  assert.deepEqual(result.files.filter(file => file.kind === 'content').map(file => file.path), [`files/03/${'03'.repeat(63)}`, `files/04/${'04'.repeat(63)}-exec`]);
  assert.equal(result.logicalBytes, Buffer.byteLength(indexes[indexPath(1)]) + Buffer.byteLength(indexes[indexPath(2)]) + 165);
  assert.equal(result.contentPresenceVerified, false);
});
test('missing or inconsistent selected cache data rejects before any copy or installation', () => {
  const { plan, indexes } = fixture();
  const missing = { ...indexes }; delete missing[indexPath(1)];
  assert.throws(() => runtimeCachePlan(plan, missing), { code: 'BACKEND_CACHE_INDEX_MISSING' });
  const foreign = JSON.parse(indexes[indexPath(1)]); foreign.name = 'other';
  assert.throws(() => runtimeCachePlan(plan, { ...indexes, [indexPath(1)]: JSON.stringify(foreign) }), { code: 'BACKEND_CACHE_INDEX_IDENTITY' });
  const conflict = JSON.parse(indexes[indexPath(2)]); conflict.files['package.json'].size = 999;
  assert.throws(() => runtimeCachePlan(plan, { ...indexes, [indexPath(2)]: JSON.stringify(conflict) }), { code: 'BACKEND_CACHE_CONTENT_CONFLICT' });
  const unsafe = JSON.parse(indexes[indexPath(1)]); unsafe.files['../outside'] = unsafe.files['package.json'];
  assert.throws(() => runtimeCachePlan(plan, { ...indexes, [indexPath(1)]: JSON.stringify(unsafe) }), { code: 'BACKEND_CACHE_INDEX_INVALID' });
  assert.throws(() => runtimeCachePlan(plan, { ...indexes, [indexPath(1)]: '{' }), { code: 'BACKEND_CACHE_INDEX_INVALID' });
});
