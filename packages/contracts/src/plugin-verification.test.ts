import { expect, test } from 'vitest';
import { jsonObjectRuleSchema, pluginVerificationOutputSchema, pluginVerificationRequestSchema } from './plugin-verification.js';
const rule = { schemaVersion: 1, algorithmId: 'flow.json-object.required-keys', algorithmVersion: 1, requiredKeys: ['id'] } as const;
test('AV02 strict bounded rule detaches, canonicalizes keys and rejects unsupported algorithms', () => {
  const keys = ['z', 'a']; const parsed = jsonObjectRuleSchema.parse({ ...rule, requiredKeys: keys }); keys.push('later');
  expect(parsed.requiredKeys).toEqual(['a', 'z']);
  for (const value of [{ ...rule, requiredKeys: ['id', 'id'] }, { ...rule, requiredKeys: Array(33).fill('x') },
    { ...rule, requiredKeys: ['\ud800'] }, { ...rule, requiredKeys: ['😀'.repeat(17)] }, { ...rule, algorithmVersion: 2 }, { ...rule, script: 'no' }]) {
    expect(() => jsonObjectRuleSchema.parse(value)).toThrow();
  }
});
test('AV02 source and result codecs reject excess bytes, undeclared fields and forged verdict shapes', () => {
  const source = { taskId: 'task', attemptId: 'attempt', artifactId: 'artifact', version: 'a'.repeat(64), content: '{}' };
  expect(pluginVerificationRequestSchema.parse({ source, rule }).source.content).toBe('{}');
  expect(() => pluginVerificationRequestSchema.parse({ source: { ...source, content: 'a'.repeat(8193) }, rule })).toThrow();
  const output = { schemaVersion: 1, algorithmId: rule.algorithmId, algorithmVersion: 1, inputDigest: 'a'.repeat(64), verdict: { result: 'passed', reason: 'passed', missingKeys: [] } };
  expect(pluginVerificationOutputSchema.parse(output)).toEqual(output);
  expect(() => pluginVerificationOutputSchema.parse({ ...output, verdict: { ...output.verdict, reason: 'invalid-json' } })).toThrow();
});
