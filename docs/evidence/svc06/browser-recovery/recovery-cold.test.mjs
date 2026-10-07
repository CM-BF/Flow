import test from 'node:test';
import assert from 'node:assert/strict';
import { PURPOSE, LEGACY_CONFIGURATION, validateColdInput, assertColdReady, coldLaunchAccounted } from './recovery-cold-consumer.mjs';
import { coldArguments, main } from './recovery-cold-entry.mjs';

const sourceHead = 'f37a3612068c7215994750574a7451ede841bcce';
const artifact = { policy: 'flow.backend-artifact.v1', artifactId: 'a'.repeat(64), manifestDigest: 'a'.repeat(64), sourceHead };
const fixed = { sourceHead, artifact, repository: '/fixed/source' };
const input = { ...fixed, format: 1, purpose: PURPOSE, providerCalls: 0, directory: '/private/tmp/flow-svc09a-host-cold_owned-1' };
const record = { pid: 42, group: 42, nonce: '12345678-1234-1234-1234-123456789012', command: 'owned' };
const processes = { center: { ...record, pid: 41, group: 41 }, runner: record, web: { ...record, pid: 43, group: 43 } };
const state = () => ({ backendArtifact: artifact, processes, startEvidenceErrors: [], startCleanup: [] });

test('cold input binds exact new source/artifact and excludes settings choices', () => {
  assert.equal(validateColdInput(input, fixed), input.directory + '/backend-artifacts/' + artifact.artifactId + '/root');
  assert.throws(() => validateColdInput({ ...input, choices: [] }, fixed));
  assert.throws(() => validateColdInput({ ...input, sourceHead: 'b'.repeat(40) }, fixed));
  assert.throws(() => validateColdInput({ ...input, artifact: { ...artifact, artifactId: 'b'.repeat(64) } }, fixed));
  assert.deepEqual(LEGACY_CONFIGURATION, { model: 'claude-sonnet-5-5', materialFiles: [], allowRead: false,
    requireReadApproval: false, maxTurns: 2, maxBudgetUsd: .2, timeoutMs: 60000 });
});

test('cold positive uses current actual record and separates initialization from claim', async () => {
  const observed = [], current = state();
  await assertColdReady({ input, preview: { readPreviewJson: async () => current }, config: { runner: { runnerId: 'runner' } },
    state: current, checkpoint: async (phase, fact) => observed.push({ phase, fact }) }, async args => {
    assert.deepEqual(args, { directory: input.directory, recordKey: 'runner', record, runnerId: 'runner' }); return true;
  });
  assert.equal(observed.length, 1); assert.equal(observed[0].fact.initialized, true);
  assert.equal(observed[0].fact.actualClaim, 'NO_ASSIGNMENT_OBSERVED');
});

test('cold old profile or missing positive cannot pass and changed identity is rejected first', async () => {
  const current = state(), args = { input, preview: { readPreviewJson: async () => current }, config: { runner: { runnerId: 'runner' } },
    state: current, checkpoint: async () => assert.fail('no positive checkpoint') };
  await assert.rejects(assertColdReady(args, async () => false), /COLD_CURRENT_INITIALIZATION_REQUIRED/);
  await assert.rejects(assertColdReady({ ...args, preview: { readPreviewJson: async () => ({ ...current,
    processes: { ...processes, runner: { ...record, pid: 44 } } }) } }, async () => assert.fail('stale identity must reject before observer')),
  /COLD_LAUNCH_IDENTITY_CHANGED/);
});

test('cold cleanup accounts actual mutable launch state without requiring nonexistent readiness field', () => {
  const current = state();
  const fact = { purpose: PURPOSE, origin: 'controller-call-state', processes, readiness: null, startCleanup: [], evidenceErrors: [] };
  const records = [{ phase: 'default-start-observation', fact }];
  assert.equal(coldLaunchAccounted(records, current), true);
  assert.equal(coldLaunchAccounted([], current), false);
  assert.equal(coldLaunchAccounted([...records, ...records], current), false);
  assert.equal(coldLaunchAccounted(records, { ...current, startEvidenceErrors: undefined }), false);
  assert.equal(coldLaunchAccounted([{ phase: 'default-start-observation', fact: { ...fact, evidenceErrors: null } }], current), false);
  assert.equal(coldLaunchAccounted(records, { ...current, processes: { ...processes, runner: { ...record, nonce: 'other' } } }), false);
});

test('cold actual entry imports without a future artifact input and rejects wrong arguments before I/O', async () => {
  assert.equal(coldArguments(['--work-once', input.directory + '/input.json']), '--work-once');
  assert.equal(coldArguments(['--cleanup-once', input.directory + '/input.json']), '--cleanup-once');
  assert.throws(() => coldArguments(['--work-once', '/Users/citrine/.flow-personal/input.json']));
  await assert.rejects(main([]));
  await assert.rejects(main(['--old-host-once', input.directory + '/input.json']));
});
