// Dynamic entry includes module loading in the common 300-second origin.
const started = performance.now();
const [windowId, target, floor] = process.argv.slice(2);
if (!windowId || !target || !floor) throw new Error('Explicit future OPEN, execution HEAD and complete fresh resource sum required.');
const { runComparison } = await import('./ab-driver.js');
const result = await runComparison(windowId, target, started, { kind: 'queue-buffered-single', minimumFreeBytes: Number(floor) });
const text = JSON.stringify({ ...result, beforeCliMs: performance.now() - started }) + '\n';
if (Buffer.byteLength(text) > 32768) throw new Error('comparison_cli_reserve_exceeded');
const timer = setTimeout(() => { process.exitCode = 1; process.stdout.destroy(); }, Math.max(1, started + 300000 - performance.now()));
process.stdout.once('error', () => { process.exitCode = 1; });
process.stdout.write(text, error => { clearTimeout(timer); if (error || !result.success || performance.now() - started >= 300000) process.exitCode = 1; });

export {};
