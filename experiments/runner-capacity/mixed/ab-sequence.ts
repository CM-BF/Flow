import { ComparisonBudget, type Side, type SideReceipt } from './ab-budget.js';

export type SideOutcome = { side: Side; state: 'PASS' | 'FAIL' | 'UNKNOWN' | 'NOT_RUN'; receipt?: SideReceipt; error?: string };
export async function compareSides(budget: ComparisonBudget, run: (side: Side) => Promise<SideReceipt>): Promise<SideOutcome[]> {
  return runSides(budget, run, ['A', 'B']);
}
export async function runSingleSide(budget: ComparisonBudget, run: (side: Side) => Promise<SideReceipt>): Promise<SideOutcome[]> {
  return runSides(budget, run, ['A']);
}
async function runSides(budget: ComparisonBudget, run: (side: Side) => Promise<SideReceipt>, sides: readonly Side[]): Promise<SideOutcome[]> {
  const results: SideOutcome[] = []; let previous: SideReceipt | undefined;
  for (const side of sides) {
    let started = false;
    try {
      budget.begin(side, previous); started = true;
      const receipt = await run(side); previous = receipt; budget.finish(receipt);
      results.push({ side, state: receipt.success && receipt.resourcesClosed ? 'PASS' : 'FAIL', receipt });
      if (!receipt.success || !receipt.resourcesClosed) break;
    } catch (error) {
      results.push({ side, state: started ? 'UNKNOWN' : 'NOT_RUN', error: error instanceof Error && /^comparison_[a-z_]+$/.test(error.message) ? error.message : 'comparison_side_unknown' });
      break;
    }
  }
  if (sides.includes('B') && !results.some(result => result.side === 'B')) results.push({ side: 'B', state: 'NOT_RUN' });
  return results;
}
