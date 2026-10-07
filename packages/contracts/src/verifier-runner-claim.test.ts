import { expect, test } from 'vitest';
import { randomUUID } from 'node:crypto';
import { VERIFIER_BINDING_PROTOCOL, VERIFIER_RUNNER_CLAIM_PROTOCOL, verifierRunnerClaimRequestSchema, sameVerifierClaimRequest } from './verifier-runner-claim.js';
const qualification = { bindingProtocol: VERIFIER_BINDING_PROTOCOL, storeId: 'owned', hostApiMajor: 1 as const,
  algorithms: [{ id: 'flow.json-object.required-keys' as const, version: 1 as const }] };
const request = () => ({ protocol: VERIFIER_RUNNER_CLAIM_PROTOCOL, runnerId: randomUUID(), requestId: randomUUID(), pluginVerifierExecution: structuredClone(qualification) });
test('AV03 v4 codec is detached, bounded and never implicitly enables tool capability', () => {
  const input = request(); const parsed = verifierRunnerClaimRequestSchema.parse(input); input.pluginVerifierExecution.algorithms[0]!.version = 2 as 1;
  expect(parsed.pluginVerifierExecution).toEqual(qualification); expect(Object.hasOwn(parsed, 'pluginToolExecution')).toBe(false);
  for (const altered of [{ ...qualification, algorithms: [] }, { ...qualification, algorithms: Array(9).fill(qualification.algorithms[0]) },
    { ...qualification, algorithms: [qualification.algorithms[0], qualification.algorithms[0]] },
    { ...qualification, algorithms: [{ id: 'arbitrary', version: 1 }] }, { ...qualification, hostApiMajor: 2 }]) {
    expect(() => verifierRunnerClaimRequestSchema.parse({ ...request(), pluginVerifierExecution: altered })).toThrow();
  }
  expect(() => verifierRunnerClaimRequestSchema.parse({ ...request(), fallback: 'v3' })).toThrow();
});
test('AV03 replay identity includes key, runner, protocol and every explicit qualification', () => {
  const input = request(); expect(sameVerifierClaimRequest(input, structuredClone(input))).toBe(true);
  expect(sameVerifierClaimRequest(input, { ...input, requestId: randomUUID() })).toBe(false);
  expect(sameVerifierClaimRequest(input, { ...input, runnerId: randomUUID() })).toBe(false);
  expect(sameVerifierClaimRequest(input, { ...input, pluginVerifierExecution: { ...qualification, storeId: 'other' } })).toBe(false);
  expect(sameVerifierClaimRequest(input, { ...input, pluginToolExecution: { bindingProtocol: 'flow.plugin-runtime.v1', storeId: 'owned', hostApiMajor: 1 } })).toBe(false);
  expect(() => verifierRunnerClaimRequestSchema.parse({ ...input, protocol: 'flow.runner-claim.v3' })).toThrow();
});
