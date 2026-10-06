import { expect, test } from 'vitest';
import { preparedGit, type InputAccounting } from './ab-input.js';
const accounting = (): InputAccounting & { bytes: number } => ({ remainingMs: 285100, bytes: 0, work() {}, chargeCommon(_kind, bytes) { this.bytes += bytes; } });
test('at14.9seconds synchronous Git gets at most100ms from the absolute preparation deadline', () => {
 const budget=accounting(); let timeout=0;
 const bytes=preparedGit(15000,budget,limit=>{timeout=limit;return Buffer.from('ok');},()=>14900);
 expect(timeout).toBe(100);expect(bytes.toString()).toBe('ok');expect(budget.bytes).toBe(2);
});
test('an exhausted preparation clock executes zero Git commands even when outer time remains', () => {
 let calls=0;
 expect(()=>preparedGit(15000,accounting(),()=>{calls++;return Buffer.alloc(0);},()=>15000)).toThrow('comparison_preparation_exhausted');
 expect(calls).toBe(0);
});
test('a late synchronous return is charged then rejected, never made successful by a blocked timer', () => {
 let now=14900; const budget=accounting();
 expect(()=>preparedGit(15000,budget,()=>{now=15001;return Buffer.from('late');},()=>now)).toThrow('comparison_preparation_exhausted');
 expect(budget.bytes).toBe(4);
});
