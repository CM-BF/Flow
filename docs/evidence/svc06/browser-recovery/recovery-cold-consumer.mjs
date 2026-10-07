// The existing fixture owns setup, work deadlines and independent cleanup.
// This policy selects the new artifact's actual public controller, never a shadow root.
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { defaultSequence, cleanupDefault } from '/Users/citrine/Projects/AgentHarness/Flow-worktrees/personal-message-settings/docs/evidence/svc09/message-settings-activation/host-integration/default-host.mjs';
import { validateHostInput } from '/Users/citrine/Projects/AgentHarness/Flow-worktrees/personal-message-settings/docs/evidence/svc09/message-settings-activation/host-integration/host-consumer.mjs';
import { setupFixture } from '/Users/citrine/Projects/AgentHarness/Flow-worktrees/personal-message-settings/docs/evidence/svc09/message-settings-activation/host-integration/host-fixture.mjs';

export const PURPOSE = 'SVC06B_FIXED_ARTIFACT_COLD_THREE_ROLE';
// Exact existing 04da preview policy, not a settings-slot policy or a provider invocation.
export const LEGACY_CONFIGURATION = Object.freeze({ model: 'claude-sonnet-5-5', materialFiles: Object.freeze([]),
  allowRead: false, requireReadApproval: false, maxTurns: 2, maxBudgetUsd: 0.20, timeoutMs: 60_000 });
const roles = ['center', 'runner', 'web'];
const sameKeys = (value, keys) => value && Object.keys(value).sort().join() === keys.join();

export function validateColdInput(input, fixed) {
  assert.equal(input.purpose, PURPOSE, 'COLD_PURPOSE_REQUIRED');
  assert.equal(input.providerCalls, 0);
  assert.equal(input.choices, undefined, 'COLD_SETTINGS_NOT_ALLOWED');
  assert.match(fixed.sourceHead, /^[a-f0-9]{40}$/);
  assert.match(fixed.artifact.artifactId, /^[a-f0-9]{64}$/);
  assert.equal(fixed.artifact.sourceHead, fixed.sourceHead);
  assert.equal(input.sourceHead, fixed.sourceHead, 'COLD_FIXED_SOURCE_REQUIRED');
  assert.deepEqual(input.artifact, fixed.artifact, 'COLD_FIXED_ARTIFACT_REQUIRED');
  assert.equal(input.repository, fixed.repository, 'COLD_FIXED_REPOSITORY_REQUIRED');
  return validateHostInput(input, { requiresSettings: false });
}

export async function assertColdReady({ input, preview, config, state, checkpoint }, readInitialization) {
  assert.equal(typeof readInitialization, 'function');
  assert.ok(sameKeys(state.processes, roles), 'COLD_THREE_ACTUAL_RECORDS_REQUIRED');
  const live = await preview.readPreviewJson(join(input.directory, 'state.json'));
  assert.deepEqual(live.processes, state.processes, 'COLD_LAUNCH_IDENTITY_CHANGED');
  assert.deepEqual(live.backendArtifact, input.artifact);
  assert.equal(await readInitialization({ directory: input.directory, recordKey: 'runner',
    record: state.processes.runner, runnerId: config.runner.runnerId }), true, 'COLD_CURRENT_INITIALIZATION_REQUIRED');
  await checkpoint('cold-current-initialization', { purpose: PURPOSE, sourceHead: input.sourceHead,
    artifactId: input.artifact.artifactId, recordKey: 'runner', runnerId: config.runner.runnerId,
    wrapperPid: state.processes.runner.pid, nonce: state.processes.runner.nonce, initialized: true,
    meaning: 'This child passed local guards; center accepting and actual claim are separate',
    actualClaim: 'NO_ASSIGNMENT_OBSERVED' });
}

export function coldLaunchAccounted(records, state) {
  const observations = records.filter(value => value.phase === 'default-start-observation');
  if (observations.length !== 1) return false;
  const value = observations[0].fact;
  // 04da has no startReadiness. Its explicit error/cleanup arrays and actual mutable
  // onSpawn state are required instead; missing fields never mean an empty success.
  if (value?.purpose !== PURPOSE || value.origin !== 'controller-call-state'
    || !Array.isArray(value.evidenceErrors) || value.evidenceErrors.length !== 0
    || !Array.isArray(value.startCleanup) || !Array.isArray(state?.startEvidenceErrors)
    || state.startEvidenceErrors.length !== 0 || !value.processes || !state.processes) return false;
  const keys = Object.keys(value.processes);
  if (keys.length > 3 || keys.some(key => !roles.includes(key))
    || Object.keys(state.processes).some(key => !roles.includes(key))) return false;
  return keys.every(key => {
    const recorded = value.processes[key], current = state.processes[key];
    return recorded && current && Number.isSafeInteger(recorded.pid) && recorded.pid > 1
      && recorded.pid === recorded.group && recorded.pid === current.pid
      && recorded.nonce === current.nonce && recorded.command === current.command;
  }) && Object.keys(state.processes).every(key => keys.includes(key));
}

export function coldPorts(fixed) {
  const validateInput = input => validateColdInput(input, fixed);
  return {
    purpose: PURPOSE, validateInput,
    setup: args => setupFixture(args, { nativeConfiguration: LEGACY_CONFIGURATION }),
    async consumer({ input, pool, checkpoint }) {
      const root = validateInput(input);
      const preview = await import(pathToFileURL(join(root, 'tools/personal-preview/preview.mjs')).href);
      const diagnostics = await import(pathToFileURL(join(root, 'tools/personal-preview/startup-diagnostics.mjs')).href);
      await checkpoint('cold-artifact-controller', { purpose: PURPOSE, sourceHead: fixed.sourceHead,
        artifactId: fixed.artifact.artifactId, root, controller: 'actual-artifact-public-preview', shadow: false });
      return defaultSequence({ input, preview, controller: preview, pool, checkpoint,
        policy: { purpose: PURPOSE, validateInput,
          assertReady: context => assertColdReady(context, diagnostics.readRunnerInitialization) } });
    },
    cleanup: input => cleanupDefault(input, { purpose: PURPOSE, validateInput, launchAccounted: coldLaunchAccounted }),
  };
}
