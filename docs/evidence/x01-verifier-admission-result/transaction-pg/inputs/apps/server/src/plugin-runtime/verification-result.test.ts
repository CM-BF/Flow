import { randomUUID } from 'node:crypto';
import { beforeEach, expect, test, vi } from 'vitest';
import type { PoolClient } from 'pg';
import type { RunnerEvent } from '@flow/contracts';
import type { TaskRecord } from '../tasks.js';
import type { AttemptRecord } from '../runners.js';
import { sha256 } from '../database.js';
import { verificationInput } from '../../../../packages/plugin-runtime/src/verification-input.js';
import { verifyJsonObject } from '../../../../packages/plugin-runtime/src/json-object-verifier.js';
const hooks = vi.hoisted(() => ({ binding: vi.fn(), reference: vi.fn(), source: vi.fn(), save: vi.fn(), timeline: vi.fn() }));
vi.mock('./verification.js', () => ({ verifierBinding: hooks.binding, claimVerificationReference: hooks.reference }));
vi.mock('./artifact.js', () => ({ validatePluginSource: hooks.source }));
vi.mock('../evidence.js', () => ({ saveDetail: hooks.save }));
vi.mock('../timeline.js', () => ({ appendTimeline: hooks.timeline }));
import { guardVerificationEvent } from './verification-result.js';

function fixture(requiredKeys = ['a']) {
  const taskId = randomUUID(), attemptId = randomUUID(), runnerId = randomUUID();
  const binding = { bindingId: randomUUID(), invocationId: randomUUID(), taskId, targetRunnerId: runnerId,
    storeId: 'store', materialId: 'a'.repeat(64), treeDigest: 'b'.repeat(64), hostApiMajor: 1 as const, configuration: {},
    artifact: { artifactId: randomUUID(), name: 'verifier', version: '1.0.0', bytes: 10, sha256: 'c'.repeat(64), integrity: 'sha512-example' } };
  const request = { source: { taskId: randomUUID(), attemptId: randomUUID(), artifactId: 'source-artifact', content: '{"a":1}', version: sha256('{"a":1}') },
    rule: { schemaVersion: 1 as const, algorithmId: 'flow.json-object.required-keys' as const, algorithmVersion: 1 as const, requiredKeys } };
  const input = verificationInput({ ...binding, attemptId, ownerVersion: 1,
    material: { installationId: binding.materialId, storeId: binding.storeId, treeDigest: binding.treeDigest, artifact: binding.artifact } }, request);
  const verdict = verifyJsonObject(request.source.content, request.rule);
  const output = { schemaVersion: 1, algorithmId: request.rule.algorithmId, algorithmVersion: 1, inputDigest: input.inputDigest, verdict };
  const content = JSON.stringify(output), artifactVersion = sha256(content);
  const task = { id: taskId, submission: { title: 'Verify', prompt: JSON.stringify(request), harness: 'fixture' }, verification_status: 'pending',
    latest_artifact_id: 'result', latest_artifact_version: artifactVersion } as TaskRecord;
  const attempt = { id: attemptId, task_id: taskId, runner_id: runnerId, owner_version: 1 } as AttemptRecord;
  const data = { type: 'verification' as const, verifierId: 'flow.plugin-json-object' as const, verifierVersion: '1' as const,
    artifactId: 'result', artifactVersion, inputDigest: input.inputDigest, result: verdict.result, verdict,
    pluginSource: { protocol: 'flow.plugin-artifact.v1' as const, bindingId: binding.bindingId, invocationId: binding.invocationId, taskId, attemptId, ownerVersion: 1,
      installationId: binding.materialId, artifactId: binding.artifact.artifactId, artifactSha256: binding.artifact.sha256, treeDigest: binding.treeDigest, hostApiMajor: 1 as const } };
  let saved: string | undefined;
  hooks.binding.mockResolvedValue(binding); hooks.reference.mockResolvedValue({ ...binding, verification: { source: request.source, rule: request.rule } });
  hooks.save.mockImplementation(async (_client, _task, _attempt, detail: { content: string }) => { saved = detail.content; return { id: 'detail', title: 'Verified' }; });
  const query = vi.fn(async (sql: string) => ({ rows: sql.includes('FROM flow.artifacts') ? [{ content }] : saved ? [{ content: saved }] : [] }));
  return { task, attempt, data, query, client: { query } as unknown as PoolClient, source: request.source };
}
beforeEach(() => vi.clearAllMocks());
test('VAR center accepts only independently matching verdict and exact output, then gates succeeded', async () => {
  const f = fixture(); const original = JSON.stringify(f.source);
  expect(await guardVerificationEvent(f.client, f.task, f.attempt, { ...f.data, id: 'event', sequence: 1 }, () => true)).toBe(true);
  expect(f.task.verification_status).toBe('passed');
  await expect(guardVerificationEvent(f.client, f.task, f.attempt, { id: 'complete', sequence: 2, type: 'completed', outcome: 'succeeded', pluginCompletion: { state: 'settled' } }, () => true)).resolves.toBe(false);
  expect(JSON.stringify(f.source)).toBe(original);
});
test('VAR forged passed cannot override a missing required key', async () => {
  const f = fixture(['missing']);
  const event = { ...f.data, result: 'passed', verdict: { result: 'passed', reason: 'passed', missingKeys: [] }, id: 'event', sequence: 1 } as RunnerEvent;
  await expect(guardVerificationEvent(f.client, f.task, f.attempt, event, () => true)).rejects.toThrow();
  expect(hooks.save).not.toHaveBeenCalled(); expect(f.task.verification_status).toBe('pending');
});
test('VAR real failed verdict is recomputed; settled pre-result failure does not fabricate a verdict', async () => {
  const f = fixture(['missing']);
  await guardVerificationEvent(f.client, f.task, f.attempt, { ...f.data, id: 'event', sequence: 1 }, () => true);
  expect(f.task.verification_status).toBe('failed');
  await guardVerificationEvent(f.client, f.task, f.attempt, { id: 'done', sequence: 2, type: 'completed', outcome: 'failed', pluginCompletion: { state: 'settled' } }, () => true);
  const cancelled = fixture(); hooks.save.mockClear();
  await guardVerificationEvent(cancelled.client, cancelled.task, cancelled.attempt, { id: 'cancel', sequence: 1, type: 'completed', outcome: 'cancelled', pluginCompletion: { state: 'settled' } });
  expect(cancelled.task.verification_status).toBe('pending'); expect(hooks.save).not.toHaveBeenCalled();
});
test('VAR unknown completion, unverified success and legacy verifier on a bound verifier task are rejected', async () => {
  const f = fixture();
  await expect(guardVerificationEvent(f.client, f.task, f.attempt, { id: 'done', sequence: 1, type: 'completed', outcome: 'failed' })).rejects.toThrow('Unknown');
  await expect(guardVerificationEvent(f.client, f.task, f.attempt, { id: 'done', sequence: 1, type: 'completed', outcome: 'succeeded', pluginCompletion: { state: 'settled' } })).rejects.toThrow();
  await expect(guardVerificationEvent(f.client, f.task, f.attempt, { ...f.data, verifierId: 'flow.text', id: 'legacy', sequence: 1 } as unknown as RunnerEvent)).rejects.toThrow();
});
test('VAR current material policy denial and missing phase association cannot save a verdict', async () => {
  const f = fixture();
  await expect(guardVerificationEvent(f.client, f.task, f.attempt, { ...f.data, id: 'denied', sequence: 1 }, () => false)).rejects.toThrow();
  hooks.source.mockRejectedValueOnce(new Error('phase belongs to another attempt'));
  await expect(guardVerificationEvent(f.client, f.task, f.attempt, { ...f.data, id: 'phase', sequence: 1 }, () => true)).rejects.toThrow('another attempt');
  expect(hooks.save).not.toHaveBeenCalled();
});
test('VAR ordinary task verification remains on its existing path', async () => {
  const f = fixture(); hooks.binding.mockResolvedValue(null);
  expect(await guardVerificationEvent(f.client, f.task, f.attempt, { type: 'completed', id: 'legacy', sequence: 1, outcome: 'succeeded' })).toBe(false);
});
