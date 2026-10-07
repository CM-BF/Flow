import { expect, test } from 'vitest';
import { verificationInput, type VerificationInvocation } from './verification-input.js';
import { pluginVerificationAdmissionSchema } from '../../contracts/src/plugin-verification-admission.js';
const invocation: VerificationInvocation = { bindingId: 'binding', invocationId: 'invoke', taskId: 'task', attemptId: 'attempt', ownerVersion: 1,
  material: { installationId: 'a'.repeat(64), storeId: 'store', treeDigest: 'b'.repeat(64), artifact: { artifactId: 'package', name: 'verifier', version: '1.0.0', bytes: 12, sha256: 'c'.repeat(64), integrity: 'sha512-example' } }, configuration: { z: '2', a: '1' } };
const request = { source: { taskId: 'source', attemptId: 'source-attempt', artifactId: 'artifact', version: 'd'.repeat(64), content: '{"a":1}' },
  rule: { schemaVersion: 1 as const, algorithmId: 'flow.json-object.required-keys' as const, algorithmVersion: 1 as const, requiredKeys: ['a'] } };
test('VAR shared identity is detached, configuration-order stable and binds the full source/attempt/material/rule', () => {
  const first = verificationInput(invocation, request);
  expect(verificationInput({ ...invocation, configuration: { a: '1', z: '2' } }, request)).toEqual(first);
  for (const changed of [{ ...invocation, attemptId: 'next' }, { ...invocation, ownerVersion: 2 }, { ...invocation, material: { ...invocation.material, treeDigest: 'e'.repeat(64) } }]) {
    expect(verificationInput(changed, request).inputDigest).not.toBe(first.inputDigest);
  }
  expect(verificationInput(invocation, { ...request, rule: { ...request.rule, requiredKeys: ['b'] } }).inputDigest).not.toBe(first.inputDigest);
  expect(verificationInput(invocation, { ...request, source: { ...request.source, content: '{"a":2}' } }).inputDigest).not.toBe(first.inputDigest);
  request.rule.requiredKeys.push('later'); expect(JSON.parse(first.serialized).rule.requiredKeys).toEqual(['a']); request.rule.requiredKeys.pop();
});
test('VAR complete serialized envelope is bounded without truncation', () => {
  expect(() => verificationInput(invocation, { ...request, source: { ...request.source, content: '\u0001'.repeat(8192) } })).toThrow('VERIFICATION_INPUT_TOO_LARGE');
});
test('VAR admission requires source project CAS and rejects caller body/project authority', () => {
  const source = { taskId: 'source', attemptId: 'attempt', artifactId: 'artifact', version: 'd'.repeat(64) };
  const body = { source, title: 'Check JSON', expectedRevision: 2, expectedSourceProjectRevision: 1, rule: request.rule };
  expect(pluginVerificationAdmissionSchema.parse(body)).toEqual(body);
  for (const input of [{ ...body, projectId: 'forged' }, { ...body, source: { ...source, content: '{}' } }, { ...body, expectedSourceProjectRevision: undefined }]) {
    expect(pluginVerificationAdmissionSchema.safeParse(input).success).toBe(false);
  }
});

test('VAR trusted verifier invoker uses shared bytes and never falls back after host failure', async () => {
  const { executePluginVerifier } = await import('../../../apps/runner/src/plugins/execution.js');
  const { verifyJsonObject } = await import('./json-object-verifier.js');
  const { createHash } = await import('node:crypto');
  const verification = { ...request, source: { ...request.source, version: createHash('sha256').update(request.source.content).digest('hex') } };
  const base = { store: { root: '/unused', storeId: 'store', allowedDigests: [invocation.material.artifact.sha256] }, binding: invocation,
    verification, signal: new AbortController().signal, assertOwnership: () => {}, authorize: async () => {},
    trustedAlgorithms: [{ artifactSha256: invocation.material.artifact.sha256, treeDigest: invocation.material.treeDigest, hostApiMajor: 1 as const, algorithmId: verification.rule.algorithmId, algorithmVersion: 1 as const }] };
  let calls = 0;
  const result = await executePluginVerifier({ ...base, invokeVerifier: async input => {
    calls++; expect(input.input).toBe(verificationInput(invocation, verification).serialized);
    return { kind: 'text', content: JSON.stringify({ schemaVersion: 1, algorithmId: verification.rule.algorithmId, algorithmVersion: 1,
      inputDigest: verificationInput(invocation, verification).inputDigest, verdict: verifyJsonObject(verification.source.content, verification.rule) }), provenance: {} as never };
  } });
  expect(result.output.verdict.result).toBe('passed'); expect(calls).toBe(1);
  await expect(executePluginVerifier({ ...base, invokeVerifier: async () => { throw new Error('process closed with failure'); } })).rejects.toThrow('process closed with failure');
});
