import { expect, test } from 'vitest';
import { ComparisonBudget, type Side, type SideReceipt } from './ab-budget.js';
import { compareSides } from './ab-sequence.js';
const clean = (): SideReceipt => ({ success: true, resourcesClosed: true, finalElapsedMs: 1, finalMeasuredBytes: 0, tasksSentOrUnknown: 0 });
test('the same sequential interface runs A then B exactly once', async () => {
  const calls: Side[] = []; const result = await compareSides(new ComparisonBudget(0, () => 0), async side => { calls.push(side); return clean(); });
  expect(calls).toEqual(['A','B']); expect(result.map(r => r.state)).toEqual(['PASS','PASS']);
});
test.each(['failure', 'retained', 'lost-return'] as const)('A %s leaves B not run without inferring empty work', async mode => {
  const calls: Side[]=[]; const result=await compareSides(new ComparisonBudget(0,()=>0),async side=>{
    calls.push(side); if(mode==='lost-return') throw new Error('synthetic');
    return {...clean(), success: mode!=='failure', resourcesClosed: mode!=='retained'};
  });
  expect(calls).toEqual(['A']); expect(result[1]).toEqual({side:'B',state:'NOT_RUN'});
  expect(result[0]?.state).toBe(mode==='lost-return'?'UNKNOWN':'FAIL');
});
test('side completion cannot claim PASS with a missing live byte charge', async () => {
  const result=await compareSides(new ComparisonBudget(0,()=>0),async()=>({...clean(), finalMeasuredBytes:1}));
  expect(result.map(r=>r.state)).toEqual(['UNKNOWN','NOT_RUN']);
});
