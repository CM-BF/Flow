import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { fingerprint } from '../node-rootliteral/execute-reviewed.mjs';
import { verifyPathClosure } from '../node-runtime-metadata/execute-reviewed.mjs';
import { runCause } from '../node-loader-cause/host.mjs';
const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const evidence = path.join(repository, 'docs/evidence/wpf-mature-02/node-failure-text');
const fail = () => { throw Error('Fixed failure text window unavailable'); };
export async function executeReviewed() {
  const reservation = `${JSON.stringify({ consumed: true, window: 'go-node-failure-text-once', maxTargets: 1, totalMs: 30000 })}\n`;
  const fd = fs.openSync(path.join(evidence, 'entry-reservation.json'), 'wx', 0o600);
  try { fs.writeFileSync(fd, reservation); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  const input = JSON.parse(fs.readFileSync(path.join(evidence, 'driver-input.json'), 'utf8'));
  if (input.window !== 'go-node-failure-text-once' || input.maxTargets !== 1 || input.totalMs !== 30000 || input.maxBytes !== 1048576
    || fs.realpathSync(process.execPath) !== input.node.path) fail();
  const check = item => {
    if (!/^[A-Za-z0-9_.\/-]+$/.test(item.path) || item.path.startsWith('/') || item.path.split('/').some(x => !x || x === '..' || x === '.')) fail();
    fingerprint(path.join(repository, item.path), item);
  };
  for (const item of input.files) check(item);
  for (const item of input.external) fingerprint(item.path, item);
  fingerprint(input.node.path, input.node);
  let prepared = 0; const seen = new Set();
  for (const item of input.prepared) { if (seen.has(item.path)) fail(); seen.add(item.path); check(item); prepared += item.bytes; }
  if (prepared !== input.preparedBytes || prepared > 262144 || performance.now() >= 20000) fail();
  verifyPathClosure(JSON.parse(fs.readFileSync(path.join(repository, 'docs/evidence/wpf-mature-02/node-runtime-metadata/path-closure.json'), 'utf8')));
  const roles = []; // Full private text is retained; no new public classification vocabulary.
  return runCause({ evidenceDirectory: evidence, repository, preparedBytes: prepared, roles, initialReceiptBytes: Buffer.byteLength(reservation), recipe: 'failure-text' });
}
export function prepareDelivery(result, elapsed) {
  const line = `${JSON.stringify({ ...result, finalElapsedMs: elapsed, finalElapsedBasis: 'after-result-persistence-before-cli' })}\n`;
  const bytes = Buffer.byteLength(line);
  return { line, passes: Boolean(result.observationComplete && result.cleanupComplete && result.outputAccountingComplete && result.withinBudget
    && result.resultPersisted && elapsed <= 30000 && result.output.receipts + bytes <= 16384
    && result.output.reservedBytes <= 1048576 && result.retainedDiagnosticArtifact?.complete === true) };
}
export async function runCli() {
  if (process.argv.length !== 3 || process.argv[2] !== '--reviewed-node-failure-text-window') {
    process.stdout.write('{"state":"NOT_RUN"}\n'); process.exitCode = 2; return;
  }
  let result; try { result = await executeReviewed(); } catch { result = null; }
  const delivery = result ? prepareDelivery(result, performance.now()) : { line: '{"state":"FAILED_OR_UNKNOWN","reason":"fixed-input-or-host-failure"}\n', passes: false };
  const timer = setTimeout(() => process.exit(1), 500);
  process.stdout.once('error', () => process.exit(1));
  process.stdout.write(delivery.line, error => {
    clearTimeout(timer); let durable = false; try { fs.fsyncSync(1); durable = true; } catch { /* Unknown delivery is failure. */ }
    process.exit(!error && durable && delivery.passes && performance.now() <= 30000 ? 0 : 1);
  });
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await runCli();
