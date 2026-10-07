import test from 'node:test';
import assert from 'node:assert/strict';
import { DIRECTORY, ROOT, RUNNER, OPERATION, OLD_BACKEND, OLD_WEB, WEB_IDS, FILES, ROLES } from './policy.mjs';
import { freshArguments, projectHeldFacts, collectHeldFacts } from './fresh-facts.mjs';
function fixture() {
  const values = Object.fromEntries(FILES.map(name => [name, {}]));
  values['config.json'] = { directory: DIRECTORY, repository: ROOT, runner: { runnerId: RUNNER }, centerPort: 61227, webPort: 61228, ownerToken: 'SYNTHETIC_SECRET', databaseUrl: 'SYNTHETIC_SECRET' };
  values['state.json'] = { backendArtifact: OLD_BACKEND, webHost: { artifact: OLD_WEB }, source: { head: OLD_WEB.sourceHead, dirty: false },
    processes: Object.fromEntries(ROLES.map((role, i) => [role, { pid: i + 100, group: i + 100, nonce: role, command: 'SYNTHETIC_SECRET' }])) };
  values['maintenance.json'] = { operationId: OPERATION, phase: 'starting', backendArtifact: OLD_BACKEND, target: OLD_BACKEND.sourceHead };
  values['web-release.json'] = { version: 3, current: WEB_IDS[2], artifacts: WEB_IDS.map(artifactId => ({ artifactId })) };
  return { installationIdentity: { dev: '1', ino: '2' }, pins: Object.fromEntries(FILES.map(name => [name, { bytes: 100, sha256: 'a'.repeat(64), dev: '1', ino: '2' }])), values };
}
const load = async () => ({ process: { inspectOwnedProcess: async () => 'stopped' }, config: {}, Pool: class {} });
test('exact readonly invocation rejects missing, traversal and alternate directory before I/O', () => {
  assert.equal(freshArguments(['--observe-held-once', '/private/tmp/flow-svc06-held-facts-toy/facts.json']), '/private/tmp/flow-svc06-held-facts-toy/facts.json');
  for (const args of [[], ['--run-once', '/private/tmp/flow-svc06-held-facts-toy/facts.json'], ['--observe-held-once', '/private/tmp/flow-svc06-held-facts-toy/../facts.json']]) assert.throws(() => freshArguments(args));
});
test('pure collector reuses policy, stopped identities and existing runner port; outputs no secret/body', async () => {
  const calls = []; const result = await collectHeldFacts({ read: async () => fixture(), load,
    confirmRunner: async (Pool, config, expected) => { calls.push(expected); }, now: () => 0 });
  assert.equal(result.outcome, 'OBSERVED_HELD23_NOT_EXECUTION_AUTHORIZATION'); assert.equal(result.ready, false);
  assert.equal(result.databasePoolClosed, true); assert.equal(calls.length, 1); assert.equal(calls[0].maintenance_version, 23);
  assert.equal(JSON.stringify(result).includes('SYNTHETIC_SECRET'), false); assert.equal(Object.keys(result.privateFiles).length, 6);
});
test('changed operation, unknown old process or changing file pin never supplies an executable observation', async () => {
  const wrong = fixture(); wrong.values['maintenance.json'].operationId = 'other'; assert.throws(() => projectHeldFacts(wrong));
  const unknown = await collectHeldFacts({ read: async () => fixture(), load: async () => ({ process: { inspectOwnedProcess: async () => 'unknown' } }), now: () => 0 });
  assert.equal(unknown.outcome, 'UNKNOWN_KEEP'); assert.equal(unknown.databasePoolClosed, null);
  let reads = 0; const changed = await collectHeldFacts({ read: async () => { const f = fixture(); if (reads++) f.pins['state.json'].sha256 = 'b'.repeat(64); return f; }, load, confirmRunner: async () => {}, now: () => 0 });
  assert.equal(changed.outcome, 'UNKNOWN_KEEP'); assert.equal(changed.primary.phase, 'files-after'); assert.equal(changed.databasePoolClosed, true);
});
test('database first error and end unknown remain separate with no message or cause serialization', async () => {
  const result = await collectHeldFacts({ read: async () => fixture(), load, now: () => 0,
    confirmRunner: async () => { throw Object.assign(Error('SYNTHETIC_SECRET'), { code: '42P01', recordError: { message: 'SYNTHETIC_SECRET' } }); } });
  assert.equal(result.primary.code, '42P01'); assert.equal(result.primary.phase, 'runner-readonly');
  assert.equal(result.databasePoolClosed, null); assert.deepEqual(result.cleanup, [{ phase: 'pool-end', state: 'UNKNOWN' }]);
  assert.equal(JSON.stringify(result).includes('SYNTHETIC_SECRET'), false);
});
