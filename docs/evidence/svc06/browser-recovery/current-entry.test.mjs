import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { invocationInput } from './current-import.mjs';
import { artifactForPhase, invocation, phases, validatePlan, preserveHistory } from './current-maintenance.mjs';

const template = JSON.parse(await readFile(new URL('./current-update-template.json', import.meta.url)));
const node = '/opt/homebrew/Cellar/node@24/24.20.0/bin/node';

function fixturePlan() {
  const plan = structuredClone(template), input = plan.migration;
  plan.ready = input.ready = true; plan.runDirectory = '/private/tmp/flow-svc06b-synthetic-maintenance';
  input.runDirectory = '/private/tmp/flow-svc06b-synthetic-migration';
  input.installationIdentity = { dev: '1', ino: '2' }; input.sourceDirectoryIdentity = { dev: '1', ino: '3' };
  for (const name of Object.keys(input.privateFiles)) input.privateFiles[name] = { bytes: 2, sha256: 'a'.repeat(64), ...(input.privateFiles[name] ?? {}), dev: '1', ino: '4' };
  input.expectedRunner.id = plan.runnerId = 'cfdbf4d4-a6e4-4151-b67d-4f2e59d3dc0a';
  input.expectedRunner.maintenance_version = plan.initialVersion = 21;
  for (const role of Object.keys(input.processDigests)) input.processDigests[role] = 'b'.repeat(64);
  plan.reportIds = ['a', 'b', 'c'].map(c => c.repeat(64));
  plan.policyPin = { file: { sha256: input.privateFiles['browser-session.json'].sha256 } };
  plan.runnerDirectoryIdentity = { dev: '1', ino: '5' };
  return plan;
}

test('current entry refuses the incomplete template and does not reuse an existing run identity', () => {
  assert.throws(() => validatePlan(template), /FRESH_INSTANCE_AND_REPORTS_REQUIRED/);
  const plan = fixturePlan(); validatePlan(plan);
  assert.equal(invocationInput(plan.migration, { dev: '1', ino: '6' }).runIdentity.ino, '6');
  assert.equal(plan.migration.runIdentity, null);
  assert.throws(() => invocationInput({ ...plan.migration, runIdentity: { dev: '1', ino: '6' } }, { dev: '1', ino: '6' }), /RUN_MUST_BE_CREATED_EXCLUSIVELY/);
  for (const change of [p => { p.reportIds.pop(); }, p => { p.context.publicOrigin = 'http://localhost'; },
    p => { p.migration.expectedBackendArtifact = p.migration.artifact; }]) {
    const bad = fixturePlan(); change(bad); assert.throws(() => validatePlan(bad));
  }
});

test('current entry uses selected7d1 before the new operation and cd27 for refresh and every subsequent observer', () => {
  const plan = fixturePlan(), path = '/private/tmp/fixed-instance.json', digest = 'd'.repeat(64);
  assert.equal(phases.length, 12);
  for (const phase of phases) {
    const expected = phases.indexOf(phase) >= phases.indexOf('refresh') ? plan.migration.artifact : plan.migration.expectedBackendArtifact;
    assert.deepEqual(artifactForPhase(plan, phase), expected);
    const command = invocation(plan, phase, node, path, digest);
    assert.ok(command.cwd.endsWith('/' + expected.artifactId + '/root'));
    assert.equal(command.argv[2], command.cwd + '/node_modules/tsx/dist/loader.mjs');
    assert.deepEqual(command.argv.slice(-4), ['--phase', phase, path, digest]);
    assert.equal(command.ownership, 'childPidOnly');
  }
});

test('current entry preserves old columns and rows with zero migrations and only the two maintenance audit rows', () => {
  const before = { identity: {}, omittedColumns: {}, tables: [
    { name: 'tasks', columns: ['id', 'status'], count: 1, digest: 'stable' },
    { name: 'migrations', columns: ['version'], count: 35, digest: 'same-sql' },
    { name: 'runner_maintenance_audit', columns: ['id'], count: 1, digest: 'old', row_hashes: ['old'] }] };
  const after = structuredClone(before); Object.assign(after.tables[2], { count: 3, digest: 'new', row_hashes: ['old', 'drain', 'hold'] });
  preserveHistory(before, after, 2);
  for (const mutate of [v => { v.tables[0].digest = 'same-count-different-task'; }, v => { v.tables[1].count++; },
    v => { v.tables[2].row_hashes[0] = 'replaced'; }, v => { v.tables[0].columns = ['id']; }]) {
    const bad = structuredClone(after); mutate(bad); assert.throws(() => preserveHistory(before, bad, 2));
  }
});
