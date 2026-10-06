import { runMixed } from './driver.js';
const [windowId, reviewedTarget] = process.argv.slice(2);
if (!windowId || !reviewedTarget) throw new Error('Explicit authorized window ID and reviewed target are required.');
const result = await runMixed(windowId, reviewedTarget);
process.stdout.write(JSON.stringify(result) + '\n');
if (!result.success) process.exitCode = 1;
