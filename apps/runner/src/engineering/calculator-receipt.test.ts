import { randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import { engineeringReceiptSchema, engineeringSnapshotJson } from '../../../../packages/contracts/src/engineering.js';
import { CALCULATOR_RECEIPT_MAX_BYTES, calculatorReceiptJson, createCalculatorReceipt, parseCalculatorReceipt, type CalculatorReceiptInput } from './calculator-receipt.js';
import { digest } from './resources.js';

const source = 'export const add=(a,b)=>a+b;\nexport const subtract=(a,b)=>a-b;\n';
function input(content = source): CalculatorReceiptInput {
  const workspace = { leaseId: randomUUID(), baseCommit: 'a'.repeat(40), headCommit: 'a'.repeat(40), files: [
    { path: 'calculator.mjs', base: { oid: 'b'.repeat(40), mode: '100644' as const }, index: { oid: 'b'.repeat(40), mode: '100644' as const }, worktree: { mode: '100644' as const, digest: digest(content), bytes: Buffer.byteLength(content) } },
  ], beforeDigest: '', afterDigest: '' };
  workspace.beforeDigest = workspace.afterDigest = digest(engineeringSnapshotJson(workspace));
  return { identity: { taskId: 'host-task', attemptId: 'host-attempt', runnerId: 'host-runner', ownerVersion: 3 }, workspace, source: content, diff: { content: 'synthetic diff', digest: digest('synthetic diff') } };
}

it('round trips frozen versioned evidence without being an old execution receipt', () => {
  const value = input(), receipt = createCalculatorReceipt(value), json = calculatorReceiptJson(receipt), parsed = parseCalculatorReceipt(json);
  expect(parsed).toEqual(receipt); expect(calculatorReceiptJson(parsed)).toBe(json);
  expect(parsed).toMatchObject({ protocol: 'flow.calculator-workspace-check.v1', writerSettlement: 'not-attested', identity: value.identity, report: { result: 'passed' } });
  expect(Object.isFrozen(parsed)).toBe(true); expect(Object.isFrozen(parsed.workspace.files[0]!.worktree)).toBe(true); expect(Object.isFrozen(parsed.identity)).toBe(true);
  value.workspace.files[0]!.worktree!.digest = 'c'.repeat(64);
  expect(parsed.workspace.files[0]!.worktree!.digest).toBe(digest(source));
  expect(engineeringReceiptSchema.safeParse(JSON.parse(json)).success).toBe(false);
});

it('recomputes host fixed checks instead of trusting a serialized passed result', () => {
  const receipt = createCalculatorReceipt(input(source.replace('a+b', 'a-b')));
  expect(receipt.report.result).toBe('failed');
  const forged = JSON.parse(calculatorReceiptJson(receipt)); forged.report.result = 'passed'; forged.report.checks.forEach((check: { passed: boolean }) => { check.passed = true; });
  expect(() => parseCalculatorReceipt(JSON.stringify(forged))).toThrow('checker result differs');
});

it.each(['stopped', 'unknown'])('does not accept caller writer settlement %s', settlement => {
  const value = JSON.parse(calculatorReceiptJson(createCalculatorReceipt(input()))); value.writerSettlement = settlement;
  expect(() => parseCalculatorReceipt(JSON.stringify(value))).toThrow();
});

it.each(['beforeDigest', 'afterDigest', 'baseCommit', 'headCommit'] as const)('rejects conflicting workspace %s', key => {
  const value = JSON.parse(calculatorReceiptJson(createCalculatorReceipt(input()))); value.workspace[key] = 'f'.repeat(key.includes('Digest') ? 64 : 40);
  expect(() => parseCalculatorReceipt(JSON.stringify(value))).toThrow('binding differs');
});

it('rejects changed diff, absent identity, extra fields and oversized serialized inputs', () => {
  const json = calculatorReceiptJson(createCalculatorReceipt(input()));
  const diff = JSON.parse(json); diff.diff.content += 'changed'; expect(() => parseCalculatorReceipt(JSON.stringify(diff))).toThrow('binding differs');
  const identity = JSON.parse(json); delete identity.identity.attemptId; expect(() => parseCalculatorReceipt(JSON.stringify(identity))).toThrow();
  expect(() => parseCalculatorReceipt(JSON.stringify({ ...JSON.parse(json), completed: true }))).toThrow();
  expect(() => parseCalculatorReceipt(' '.repeat(CALCULATOR_RECEIPT_MAX_BYTES + 1))).toThrow('text boundary');
  expect(() => parseCalculatorReceipt(null)).toThrow('text boundary');
});
