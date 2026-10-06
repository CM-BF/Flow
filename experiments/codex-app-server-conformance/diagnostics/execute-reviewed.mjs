// Do not invoke until this exact source/input is independently approved for the one batch.
import { runDiagnosticBatch } from './run-diagnostics.mjs';
try {
  if (process.argv.length !== 3 || process.argv[2] !== '--reviewed-diagnostic-batch') throw Error('Explicit reviewed execution required');
  const result = await runDiagnosticBatch();
  process.stdout.write(`${JSON.stringify(result)}\n`); // Fixed metadata only; never private stderr bytes.
  if (!result.withinBudget || !result.cleanupComplete || result.stopReason !== 'diagnostic-evidence-ready-third-not-run') process.exitCode = 1;
} catch {
  process.stderr.write('Diagnostic batch could not start or persist safely. No automatic retry.\n');
  process.exitCode = 1;
}
