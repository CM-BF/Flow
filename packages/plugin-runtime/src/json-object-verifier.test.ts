import { expect, test } from 'vitest';
import { verifyJsonObject } from './json-object-verifier.js';
const rule = { schemaVersion: 1, algorithmId: 'flow.json-object.required-keys', algorithmVersion: 1, requiredKeys: ['id'] } as const;
test('AV02 JSON object rule distinguishes parsing, object shape and own required keys', () => {
  expect(verifyJsonObject('{"id":null,"extra":true}', { ...rule, requiredKeys: ['id'] })).toMatchObject({ result: 'passed' });
  expect(verifyJsonObject('{bad', { ...rule, requiredKeys: [] })).toMatchObject({ reason: 'invalid-json' });
  for (const content of ['null', '[]', '1', '"object"']) expect(verifyJsonObject(content, { ...rule, requiredKeys: [] })).toMatchObject({ reason: 'not-object' });
  expect(verifyJsonObject('{}', { ...rule, requiredKeys: ['toString'] })).toMatchObject({ missingKeys: ['toString'] });
  expect(verifyJsonObject('{"__proto__":1}', { ...rule, requiredKeys: ['__proto__'] })).toMatchObject({ result: 'passed' });
});
test('AV02 rule v2 requires a new field and never reuses the old passed verdict', () => {
  expect(verifyJsonObject('{"id":1}', { ...rule, requiredKeys: ['id'] })).toMatchObject({ result: 'passed' });
  expect(verifyJsonObject('{"id":1}', { ...rule, requiredKeys: ['id', 'email'] })).toEqual({ result: 'failed', reason: 'missing-required-keys', missingKeys: ['email'] });
});
