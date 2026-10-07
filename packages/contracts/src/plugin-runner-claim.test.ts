import { randomUUID } from 'node:crypto';
import { expect, test } from 'vitest';
import { RUNNER_CLAIM_PROTOCOL, runnerClaimRequestSchema, runnerClaimResponseSchema } from './runner-claim.js';
import { PLUGIN_RUNTIME_PROTOCOL, type PluginToolBinding } from './plugin-runtime.js';
import { PLUGIN_RUNNER_CLAIM_PROTOCOL, pluginRunnerClaimRequestSchema, pluginRunnerClaimResponseSchema,
  decodePluginRunnerClaimResponse, type PluginRunnerClaimRequest } from './plugin-runner-claim.js';

function claim() {
  const runnerId = randomUUID(), taskId = randomUUID(), attemptId = randomUUID();
  const request: PluginRunnerClaimRequest = { protocol: PLUGIN_RUNNER_CLAIM_PROTOCOL, runnerId, requestId: randomUUID(),
    pluginToolExecution: { bindingProtocol: PLUGIN_RUNTIME_PROTOCOL, storeId: 'owned-store', hostApiMajor: 1 } };
  const binding: PluginToolBinding = { protocol: PLUGIN_RUNTIME_PROTOCOL, bindingId: randomUUID(), invocationId: randomUUID(), taskId,
    registrationId: randomUUID(), registrationRevision: 3, versionId: randomUUID(), scope: { workspaceId: 'personal', projectId: null },
    materialInstallOperationId: randomUUID(), targetRunnerId: runnerId, storeId: 'owned-store', materialId: 'a'.repeat(64),
    treeDigest: 'b'.repeat(64), hostApiMajor: 1, artifact: { artifactId: randomUUID(), name: 'owned-tool', version: '1.0.0',
      integrity: 'sha512-' + 'A'.repeat(86) + '==', bytes: 100, sha256: 'c'.repeat(64) }, configuration: {},
    inputDigest: 'd'.repeat(64), createdAt: '2026-10-07T00:00:00.000Z' };
  const identity = { taskId, attemptId, runnerId, ownerVersion: 1 };
  const response = { ...request, state: 'assigned' as const, identity, remainingLeaseMs: 1000,
    assignment: { attempt: { id: attemptId, runnerId, ownerVersion: 1, leaseExpiresAt: '2026-10-07T00:00:30.000Z' },
      task: { id: taskId, harness: 'fixture' as const, title: 'Tool', prompt: 'hello' }, pluginToolBinding: binding } };
  return { request, response };
}

test('v3 is explicit and v2 strict readers keep their exact request and response shape', () => {
  const { request } = claim(); const legacy = { protocol: RUNNER_CLAIM_PROTOCOL, runnerId: request.runnerId, requestId: request.requestId };
  expect(runnerClaimRequestSchema.parse(legacy)).toEqual(legacy);
  expect(runnerClaimResponseSchema.parse({ ...legacy, state: 'empty' })).toEqual({ ...legacy, state: 'empty' });
  expect(runnerClaimRequestSchema.safeParse(request).success).toBe(false);
  expect(runnerClaimResponseSchema.safeParse({ ...request, state: 'empty' }).success).toBe(false);
  expect(pluginRunnerClaimRequestSchema.safeParse(legacy).success).toBe(false);
  expect(pluginRunnerClaimRequestSchema.safeParse({ ...request, pluginToolExecution: { ...request.pluginToolExecution, root: '/tmp' } }).success).toBe(false);
});
test('a plugin assignment binds task, attempt, owner, runner and exact current host tuple', () => {
  const { request, response } = claim();
  expect(decodePluginRunnerClaimResponse(response, request, 'claim')).toEqual(response);
  const badBindings = [ { taskId: randomUUID() }, { targetRunnerId: randomUUID() }, { storeId: 'another-store' }, { hostApiMajor: 2 } ];
  for (const change of badBindings) expect(pluginRunnerClaimResponseSchema.safeParse({ ...response,
    assignment: { ...response.assignment, pluginToolBinding: { ...response.assignment.pluginToolBinding, ...change } } }).success).toBe(false);
  for (const change of [{ attemptId: randomUUID() }, { ownerVersion: 2 }, { runnerId: randomUUID() }]) {
    expect(pluginRunnerClaimResponseSchema.safeParse({ ...response, identity: { ...response.identity, ...change } }).success).toBe(false);
  }
});
test('bound tools cannot carry another executor or private-input authority', () => {
  const { response } = claim();
  for (const change of [{ harness: 'codex' }, { fixture: { scenario: 'success' } }, { resumeSessionId: 'session' }]) {
    expect(pluginRunnerClaimResponseSchema.safeParse({ ...response,
      assignment: { ...response.assignment, task: { ...response.assignment.task, ...change } } }).success).toBe(false);
  }
  expect(pluginRunnerClaimResponseSchema.safeParse({ ...response, assignment: { ...response.assignment,
    conversationContext: { id: 'context', contextDigest: 'a'.repeat(64), executionInputId: 'input', executionInputDigest: 'b'.repeat(64) } } }).success).toBe(false);
});
test('opted-in requests still accept ordinary tasks while legacy readers reject a binding', () => {
  const { request, response } = claim(); const { pluginToolBinding: _, ...ordinary } = response.assignment;
  expect(decodePluginRunnerClaimResponse({ ...response, assignment: ordinary }, request, 'status').state).toBe('assigned');
  const { pluginToolExecution: __, ...oldResponse } = response;
  expect(runnerClaimResponseSchema.safeParse({ ...oldResponse, protocol: RUNNER_CLAIM_PROTOCOL }).success).toBe(false);
});
test('mismatched ACK and wrong-operation states remain errors rather than definite emptiness', () => {
  const { request } = claim();
  for (const state of ['empty', 'missing', 'unavailable'] as const) {
    const identity = { runnerId: request.runnerId, taskId: randomUUID(), attemptId: randomUUID(), ownerVersion: 1 };
    const value = { ...request, state, ...(state === 'unavailable' ? { identity, reason: 'not-executable' } : {}) };
    expect(() => decodePluginRunnerClaimResponse(value, { ...request, requestId: randomUUID() }, 'claim')).toThrow();
  }
  expect(decodePluginRunnerClaimResponse({ ...request, state: 'missing' }, request, 'status').state).toBe('missing');
  expect(decodePluginRunnerClaimResponse({ ...request, state: 'empty' }, request, 'claim').state).toBe('empty');
  expect(() => decodePluginRunnerClaimResponse({ ...request, state: 'missing' }, request, 'claim')).toThrow();
  expect(() => decodePluginRunnerClaimResponse({ ...request, state: 'empty' }, request, 'status')).toThrow();
  expect(() => decodePluginRunnerClaimResponse({ ...request, state: 'empty' },
    { ...request, pluginToolExecution: { ...request.pluginToolExecution, storeId: 'changed' } }, 'claim')).toThrow();
});
