// Fixed SVC08 procedure; these ports are only the existing modules and local fault-test doubles.
import assert from 'node:assert/strict';
import { isDeepStrictEqual as same } from 'node:util';
import { createHash } from 'node:crypto';
export const sha = value => createHash('sha256').update(value).digest('hex');
export const safeError = error => ({ name: error?.name ?? 'Unknown', code: /^[A-Z0-9_]{1,80}$/.test(error?.code ?? '') ? error.code : 'UNCONFIRMED' });
export function protectedState(state) {
  const value = structuredClone(state);
  delete value.webHost; delete value.pendingWebHost; delete value.processes.web;
  return sha(JSON.stringify(value));
}
export function requireFresh(facts, state, input) {
  assert.equal(facts.runtimeSource.head, input.requestTemplate.expectedBackendHead); assert.equal(facts.runtimeSource.dirty, false);
  assert.equal(state.backendArtifact ?? null, null);
  assert.equal(state.pendingWebHost ?? null, null);
  assert.equal(facts.database.markerMatched, true);
  assert.equal(facts.database.runnerIdentityMatched, true);
  assert.equal(facts.database.runner.length, 1);
  const runner = facts.database.runner[0];
  assert.equal(runner.maintenance_version, 18); assert.equal(runner.maintenance_state, 'accepting');
  assert.equal(runner.maintenance_operation_id, null);
  for (const role of ['center', 'runner', 'web']) assert.equal(facts.processes[role].identity, 'running');
  assert.equal(facts.listeners.center, true); assert.equal(facts.listeners.web, true);
  assert.equal(facts.release.version, 3);
  assert.equal(facts.release.current, input.historicalOnly.release.current);
  assert.ok(same(facts.release.artifacts, input.historicalOnly.release.artifacts));
  assert.ok(same(facts.release.compatibilityIds, input.historicalOnly.release.compatibilityIds));
  assert.equal(facts.retained.length, 3);
  for (const row of facts.retained) assert.equal(row.compatibilityId, facts.release.compatibilityIds[row.artifact.artifactId]);
  // No zero-task, zero-attempt, drain, maintenance mutation, or business-lock requirement.
}
export function protection(before, after) {
  const checks = {
    root: same(before.rootIdentity, after.rootIdentity), identity: same(before.identity, after.identity),
    source: same(before.runtimeSource, after.runtimeSource), state: before.protectedState === after.protectedState,
    release: same(before.release, after.release), retained: same(before.retained, after.retained),
    center: same(before.processes.center, after.processes.center), runner: same(before.processes.runner, after.processes.runner),
    privateFiles: ['config.json', 'claude.json', 'maintenance.json', 'web-release.json'].every(name => same(before.files[name], after.files[name])),
    maintenance: same(before.database.runner, after.database.runner), marker: after.database.markerMatched && after.database.runnerIdentityMatched,
  };
  const prior = new Map(before.database.tables.map(row => [row.name, row]));
  const changedTables = after.database.tables.filter(row => prior.get(row.name)?.count !== row.count || prior.get(row.name)?.protected_digest !== row.protected_digest).map(row => row.name);
  for (const name of prior.keys()) if (!after.database.tables.some(row => row.name === name)) changedTables.push(name);
  return { checks, protected: Object.values(checks).every(Boolean), businessObservation: changedTables.length ? 'UNKNOWN_CONCURRENT_CHANGE' : 'UNCHANGED', changedTables,
    businessWritesByOperator: 0, actionOnChange: 'keep original observations; no rollback, DML, drain or automatic retry' };
}
export function requestFrom(facts, operationId, input) {
  assert.match(operationId, /^[a-f0-9-]{36}$/);
  return { ...input.requestTemplate, operationId, expectedWebRecordSha256: facts.processes.web.recordSha256,
    expectedPointerSha256: facts.files['web-release.json'].sha256 };
}
export async function migrateOnce(ports) {
  await ports.intent();
  try {
    const existing = await ports.inspectStore();
    if (existing) { await ports.verify('destination'); await ports.result({ outcome: 'already-present-exact' }); return; }
    await ports.clone();
    await ports.verify('stage');
    await ports.syncStage();
    await ports.checkpoint();
    await ports.publishExclusive();
    await ports.syncParents();
    await ports.verify('destination');
    await ports.result({ outcome: 'migrated' });
  } catch (error) {
    // Never retry a rename or erase its stage; a missing result does not mean rename failed.
    try { await ports.result({ outcome: 'unknown', primary: safeError(error), retained: true }); }
    catch (recordError) { error.recordError = safeError(recordError); }
    throw error;
  }
}
