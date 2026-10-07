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
  expect(() => verificationInput({ ...invocation, configuration: { value: 'x'.repeat(16384) } }, request)).toThrow('VERIFICATION_INPUT_TOO_LARGE');
});
test('VAR admission requires source project CAS and rejects caller body/project authority', () => {
  const source = { taskId: 'source', attemptId: 'attempt', artifactId: 'artifact', version: 'd'.repeat(64) };
  const body = { source, title: 'Check JSON', expectedRevision: 2, expectedSourceProjectRevision: 1, rule: request.rule };
  expect(pluginVerificationAdmissionSchema.parse(body)).toEqual(body);
  for (const input of [{ ...body, projectId: 'forged' }, { ...body, source: { ...source, content: '{}' } }, { ...body, expectedSourceProjectRevision: undefined }]) {
    expect(pluginVerificationAdmissionSchema.safeParse(input).success).toBe(false);
  }
});
