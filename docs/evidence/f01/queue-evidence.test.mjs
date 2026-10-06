import { test } from 'node:test';
import assert from 'node:assert/strict';
import { redactText, evidenceJson } from './queue-evidence.mjs';
test('password fill failure and escaped structured evidence never retain known credentials', () => {
  const secrets = ['synthetic-owner-token', 'synthetic-runner-token', 'postgres://user:p@localhost/example', 'synthetic-quote"token'];
  const diagnostic = `TimeoutError: locator.fill timed out\nCall log:\n - fill("${secrets[0]}")\n${secrets.slice(1).join('\n')}`;
  const value = { error: diagnostic, nested: { message: secrets[1] }, safe: 'Dedicated browser closed' };
  const output = evidenceJson(value, secrets);
  for (const secret of secrets) { assert.ok(!output.includes(secret)); assert.ok(!output.includes(JSON.stringify(secret).slice(1, -1))); }
  assert.equal(JSON.parse(output).safe, value.safe);
  assert.ok(redactText(diagnostic, secrets).includes('TimeoutError'));
  assert.ok(redactText(diagnostic, secrets).includes('[REDACTED]'));
});
