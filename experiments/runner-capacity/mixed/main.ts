import { runMixed } from './driver.js';
import { selectRunIdentity } from './run-identity.js';
const started = performance.now();
const [windowId, reviewedTarget, runIdentity] = process.argv.slice(2);
if (!windowId || !reviewedTarget) throw new Error('Explicit authorized window ID and reviewed target are required.');
const contract = selectRunIdentity(runIdentity).contract;
const result = await runMixed(windowId, reviewedTarget, runIdentity);
const receipt = JSON.stringify({ ...result, elapsedBeforeCliWriteMs: performance.now() - started }) + '\n';
if (Buffer.byteLength(receipt) > contract.finalCliBytes) throw new Error('final_cli_budget_exceeded');
const deliveryDeadline = setTimeout(() => { process.exitCode = 1; process.stdout.destroy(); }, Math.max(1, started + contract.totalMs - performance.now()));
process.stdout.once('error', () => { process.exitCode = 1; });
process.stdout.write(receipt, error => {
  clearTimeout(deliveryDeadline);
  if (error || performance.now() - started > contract.totalMs || !result.success) process.exitCode = 1;
});
