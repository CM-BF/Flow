import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { canonical } from '../../../../../../apps/server/src/database.ts';
import { sha, fingerprint, DIRECTORY, ROOT, RUNNER, OPERATION, OLD_BACKEND, OLD_WEB, WEB_IDS, FILES, ROLES,
  assertHeldSnapshot, targetRequest } from './policy.mjs';
import { projectHeldFacts } from './fresh-facts.mjs';

function syntheticBundle() {
  const processes = Object.fromEntries(ROLES.map((role, index) => [role, { pid: 100 + index, group: 100 + index, nonce: role }]));
  const state = { backendArtifact: OLD_BACKEND, source: { head: OLD_WEB.sourceHead, dirty: false },
    webHost: { artifact: OLD_WEB }, processes, declaration: { Z: 1, a: 2, 'a-': 3, aA: 4, '10': 5, '2': 6 } };
  return { installationIdentity: { dev: '1', ino: '1' }, pins: Object.fromEntries(FILES.map(key => [key, { bytes: 1, sha256: 'a'.repeat(64), dev: '1', ino: '1' }])), values: {
    'config.json': { directory: DIRECTORY, repository: ROOT, runner: { runnerId: RUNNER }, centerPort: 61227, webPort: 61228 },
    'state.json': state,
    'maintenance.json': { operationId: OPERATION, phase: 'starting', backendArtifact: OLD_BACKEND, target: OLD_BACKEND.sourceHead },
    'web-release.json': { version: 3, current: WEB_IDS[2], artifacts: WEB_IDS.map(artifactId => ({ artifactId })) }
  } };
}
const snapshot = bundle => ({ state: bundle.values['state.json'], operation: bundle.values['maintenance.json'], release: bundle.values['web-release.json'] });
const planFor = facts => ({ ...facts, migration: { processDigests: facts.processDigests }, requestId: '11111111-1111-4111-8111-111111111111' });

test('fingerprint uses the fixed real producer serializer for mixed keys and nested arrays', async () => {
  const source = await readFile(new URL('../../../../../../apps/server/src/database.ts', import.meta.url));
  assert.equal(sha(source), '277ab00876c0b904168b4d3f1b2dc2b3221761bb27cb0a8b5e2618e7aa0f5653');
  const value = { Z: 1, a: [{ '10': 2, '2': 3, aA: 4, 'a-': 5 }] };
  const actual = canonical(value);
  // Integer keys must retain the producer's lexical sequence, not JSON object re-enumeration.
  assert.ok(actual.indexOf('"10"') < actual.indexOf('"2"'));
  assert.equal(fingerprint(value), sha(actual));
});

test('real fact projector and target request carry all three producer digests', () => {
  const bundle = syntheticBundle(), facts = projectHeldFacts(bundle), value = snapshot(bundle), plan = planFor(facts);
  assertHeldSnapshot(plan, value);
  const request = targetRequest(plan);
  assert.equal(request.expectedOperationDigest, sha(canonical(value.operation)));
  assert.equal(request.expectedStateDigest, sha(canonical(value.state)));
  assert.equal(request.expectedWebReleaseDigest, sha(canonical(value.release)));
});

test('old caller state encoding and actual state changes are still rejected', () => {
  const bundle = syntheticBundle(), value = snapshot(bundle), plan = planFor(projectHeldFacts(bundle));
  const oldEncoding = JSON.stringify(value.state, (_, v) => v && !Array.isArray(v) && typeof v === 'object'
    ? Object.fromEntries(Object.keys(v).sort().map(key => [key, v[key]])) : v);
  assert.notEqual(sha(oldEncoding), plan.stateDigest);
  assert.throws(() => assertHeldSnapshot({ ...plan, stateDigest: sha(oldEncoding) }, value));
  const changed = structuredClone(value); changed.state.declaration.a++;
  assert.throws(() => assertHeldSnapshot(plan, changed));
  const wrongOperation = structuredClone(value); wrongOperation.operation.phase = 'resumed';
  assert.throws(() => assertHeldSnapshot(plan, wrongOperation));
});

test('continuation verifies four exact existing reports and never calls import', async () => {
  const { verifyExistingRecovery } = await import('./caller.mjs');
  const plan = JSON.parse(await readFile(new URL('./input.actual.json', import.meta.url)));
  const calls = [];
  const mod = { backend: { async verifyBackendArtifact(value) { calls.push(['artifact', value]); } },
    web: { async verifyWebCompatibility(value) { calls.push(['report', value]); } },
    preview: { importPreviewCompatibility() { throw Error('IMPORT_MUST_NOT_RUN'); } } };
  await verifyExistingRecovery(plan, mod);
  assert.equal(calls.length, 5);
  assert.deepEqual(calls.slice(1).map(([, value]) => value.compatibilityId), plan.reports.map(value => value.compatibilityId));
  mod.web.verifyWebCompatibility = async () => { throw Object.assign(Error('missing'), { code: 'WEB_COMPATIBILITY_INVALID' }); };
  await assert.rejects(verifyExistingRecovery(plan, mod), { code: 'WEB_COMPATIBILITY_INVALID' });
});
