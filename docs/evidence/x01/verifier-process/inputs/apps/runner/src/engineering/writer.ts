/** Owned workspace facts only. Runtime assignment identity is deliberately not invented here. */
export interface EngineeringWriteInput {
  readonly directory: string;
  readonly leaseId: string;
  readonly baseCommit: string;
  readonly prompt: string;
  readonly signal: AbortSignal;
  assertOwnership(): Promise<void>;
}

/** A trusted writer must observe its own work stopped; completion or cancellation alone is not evidence. */
export type EngineeringWriteResult =
  | { leaseId: string; settlement: 'stopped'; outcome: 'completed' | 'failed' }
  | { leaseId: string; settlement: 'unknown' };
export interface EngineeringWriter { execute(input: EngineeringWriteInput): Promise<EngineeringWriteResult> }

/** Every exception and malformed receipt stays unknown, including an adapter's unrelated error classes.
 * Copies only known fields so later mutation or raw diagnostics cannot affect the host's decision. */
export async function executeEngineeringWriter(execute: EngineeringWriter['execute'], input: EngineeringWriteInput): Promise<EngineeringWriteResult> {
  try {
    const result = await execute(Object.freeze(input));
    if (result?.leaseId === input.leaseId && result.settlement === 'stopped' && (result.outcome === 'completed' || result.outcome === 'failed')) {
      return { leaseId: input.leaseId, settlement: 'stopped', outcome: result.outcome };
    }
  } catch { /* A settled Promise or exception is not a stopped writer. */ }
  return { leaseId: input.leaseId, settlement: 'unknown' };
}
