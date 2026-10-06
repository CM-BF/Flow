import { isDeepStrictEqual } from 'node:util';
import { z } from 'zod';
import { ENGINEERING_MAX_FILES, engineeringFileSchema, engineeringSnapshotJson } from '../../../../packages/contracts/src/engineering.js';
import { checkCalculatorSnapshot, type CalculatorCheckReport } from './calculator-checker.js';
import { CALCULATOR_SOURCE_MAX_BYTES } from './calculator-source.js';
import { digest } from './resources.js';

export const CALCULATOR_RECEIPT_MAX_BYTES = 524_288;
const id = z.string().min(1).max(128), hash = z.string().regex(/^[a-f0-9]{64}$/), commit = z.string().regex(/^[a-f0-9]{40}$/);
export const calculatorExecutionIdentitySchema = z.strictObject({ taskId: id, attemptId: id, ownerVersion: z.number().int().positive().max(Number.MAX_SAFE_INTEGER), runnerId: id });
const receiptSchema = z.strictObject({
  protocol: z.literal('flow.calculator-workspace-check.v1'), writerSettlement: z.literal('not-attested'), identity: calculatorExecutionIdentitySchema,
  workspace: z.strictObject({ leaseId: z.uuid(), baseCommit: commit, headCommit: commit, files: z.array(engineeringFileSchema).max(ENGINEERING_MAX_FILES), beforeDigest: hash, afterDigest: hash }),
  source: z.string().max(CALCULATOR_SOURCE_MAX_BYTES).nullable(),
  diff: z.strictObject({ content: z.string().max(262_144).refine(value => Buffer.byteLength(value) <= 262_144), digest: hash }),
  report: z.unknown(),
});
export type CalculatorReceipt = Readonly<Omit<z.infer<typeof receiptSchema>, 'report'> & { report: CalculatorCheckReport }>;
export type CalculatorReceiptInput = Omit<CalculatorReceipt, 'protocol' | 'writerSettlement' | 'report'>;

/** Constructs check evidence only; no caller can supply a stopped claim or a passing report. */
export function createCalculatorReceipt(input: CalculatorReceiptInput): CalculatorReceipt {
  return normalize({ ...input, protocol: 'flow.calculator-workspace-check.v1', writerSettlement: 'not-attested', report: reportFor(input) });
}
export function calculatorReceiptJson(value: unknown): string { return JSON.stringify(normalize(value)); }
export function parseCalculatorReceipt(text: unknown): CalculatorReceipt {
  if (typeof text !== 'string' || text.length > CALCULATOR_RECEIPT_MAX_BYTES || Buffer.byteLength(text) > CALCULATOR_RECEIPT_MAX_BYTES) throw new Error('Calculator receipt exceeds its text boundary.');
  return normalize(JSON.parse(text));
}

function reportFor(value: CalculatorReceiptInput): CalculatorCheckReport {
  const { leaseId, baseCommit, headCommit, beforeDigest: snapshotDigest } = value.workspace;
  const expected = { leaseId, baseCommit, headCommit, snapshotDigest };
  return checkCalculatorSnapshot(expected, { protocol: 'flow.calculator-snapshot.v1', ...expected, files: value.workspace.files,
    contents: value.source === null ? [] : [{ path: 'calculator.mjs', content: value.source }] });
}
function normalize(value: unknown): CalculatorReceipt {
  const parsed = receiptSchema.parse(value), workspace = parsed.workspace;
  if (workspace.baseCommit !== workspace.headCommit || workspace.beforeDigest !== workspace.afterDigest
    || workspace.beforeDigest !== digest(engineeringSnapshotJson(workspace)) || parsed.diff.digest !== digest(parsed.diff.content)) throw new Error('Calculator receipt content binding differs.');
  const report = reportFor(parsed);
  if (!isDeepStrictEqual(parsed.report, report)) throw new Error('Calculator receipt checker result differs.');
  const receipt = { ...parsed, report };
  if (Buffer.byteLength(JSON.stringify(receipt)) > CALCULATOR_RECEIPT_MAX_BYTES) throw new Error('Calculator receipt exceeds its byte boundary.');
  return freeze(receipt);
}
function freeze<T>(value: T): Readonly<T> {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) { for (const child of Object.values(value)) freeze(child); Object.freeze(value); }
  return value;
}
