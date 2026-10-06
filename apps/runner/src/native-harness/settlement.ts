/** Evidence about external execution, not its successful outcome. */
export type NativeExecutionSettlement = 'settled' | 'unknown';

/** Trusted adapters use this only after releasing their local resources.
 * `settled` requires no dispatch or a confirmed native terminal result.
 * A timeout, interrupt ACK or local child exit cannot establish remote settlement.
 * No provider error text, input or credentials cross this host boundary. */
export class NativeExecutionError extends Error {
  constructor(readonly settlement: NativeExecutionSettlement) {
    super(settlement === 'unknown'
      ? 'Native execution settlement is unknown.'
      : 'Native execution failed after settlement.');
    this.name = 'NativeExecutionError';
  }
}
