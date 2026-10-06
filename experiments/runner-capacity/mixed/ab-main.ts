import { runComparison } from './ab-driver.js';
import { COMPARISON } from './ab-budget.js';
const started = performance.now();
const [windowId, target] = process.argv.slice(2);
if (!windowId || !target) throw new Error('Explicit window and clean reviewed execution HEAD required.');
let success = false;
const result = await runComparison(windowId, target, started).then(value => { success = value.success; return value; }, () => ({ success: false, error: 'comparison_preflight_failed' }));
const receipt = JSON.stringify({ ...result, elapsedBeforeCliWriteMs: performance.now() - started }) + '\n';
if (Buffer.byteLength(receipt) > 32768) throw new Error('comparison_cli_reserve_exceeded');
const timer = setTimeout(() => { process.exitCode = 1; process.stdout.destroy(); }, Math.max(1, started + COMPARISON.totalMs - performance.now()));
process.stdout.once('error', () => { process.exitCode = 1; });
process.stdout.write(receipt, error => {
  clearTimeout(timer);
  if (error || !success || performance.now() - started >= COMPARISON.totalMs) process.exitCode = 1;
});
