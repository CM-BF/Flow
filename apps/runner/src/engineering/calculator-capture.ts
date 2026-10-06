import { join } from 'node:path';
import type { HarnessContext } from '@flow/contracts';
import type { EngineeringWorkspace } from './workspace.js';
import { CALCULATOR_SOURCE_MAX_BYTES } from './calculator-source.js';
import { calculatorExecutionIdentitySchema, createCalculatorReceipt, type CalculatorReceipt } from './calculator-receipt.js';
import { digest, readTextFile } from './resources.js';

export type CalculatorCaptureContext = Pick<HarnessContext, 'executionIdentity' | 'signal' | 'assertOwnership'>;
export type CalculatorCaptureResult =
  | { state: 'recorded'; receipt: CalculatorReceipt }
  | { state: 'unknown'; reason: 'identity-unavailable' | 'content-changed' | 'capture-unavailable' };

/** Observes an already-owned workspace. Its lifecycle owner must separately establish writer stop.
 * This module never releases the lease, controls a writer, or emits a completion/verification event. */
export async function captureCalculatorWorkspace(workspace: EngineeringWorkspace, context: CalculatorCaptureContext): Promise<CalculatorCaptureResult> {
  const identity = calculatorExecutionIdentitySchema.safeParse(context.executionIdentity);
  if (!identity.success) return { state: 'unknown', reason: 'identity-unavailable' };
  const leaseId = workspace.leaseId;
  const ownership = async () => { context.signal.throwIfAborted(); await context.assertOwnership(); context.signal.throwIfAborted(); };
  try {
    await ownership();
    const before = await workspace.snapshot();
    await ownership();
    const file = before.files[0]; let source: string | null = null;
    if (before.files.length === 1 && file?.path === 'calculator.mjs' && file.worktree && file.worktree.bytes <= CALCULATOR_SOURCE_MAX_BYTES) {
      const read = await readTextFile(join(workspace.directory, 'calculator.mjs'), CALCULATOR_SOURCE_MAX_BYTES);
      if (read.mode !== file.worktree.mode || Buffer.byteLength(read.content) !== file.worktree.bytes || digest(read.content) !== file.worktree.digest) return { state: 'unknown', reason: 'content-changed' };
      source = read.content;
    }
    await ownership();
    const receiptInput = { identity: identity.data,
      workspace: { leaseId, baseCommit: before.baseCommit, headCommit: before.headCommit, files: before.files, beforeDigest: before.digest, afterDigest: before.digest },
      source, diff: { content: before.diff, digest: digest(before.diff) } };
    const checked = createCalculatorReceipt(receiptInput);
    await ownership();
    const after = await workspace.snapshot();
    await ownership();
    if (workspace.leaseId !== leaseId || before.digest !== after.digest || before.diff !== after.diff) return { state: 'unknown', reason: 'content-changed' };
    return { state: 'recorded', receipt: checked };
  } catch { return { state: 'unknown', reason: 'capture-unavailable' }; }
}
