import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { fingerprint } from '../node-rootliteral/execute-reviewed.mjs';
import { runCause } from './host.mjs';
const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const evidence = path.join(repository, 'docs/evidence/wpf-mature-02/node-loader-cause');
const fail = () => { throw Error('Fixed cause window unavailable'); };
export async function executeReviewed() {
  const reservation = `${JSON.stringify({ consumed: true, window: 'go-node-loader-cause-once', maxTargets: 1, totalMs: 30000 })}\n`;
  const fd = fs.openSync(path.join(evidence, 'entry-reservation.json'), 'wx', 0o600);
  try { fs.writeFileSync(fd, reservation); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  const input = JSON.parse(fs.readFileSync(path.join(evidence, 'driver-input.json'), 'utf8'));
  if (input.window !== 'go-node-loader-cause-once' || input.maxTargets !== 1 || input.totalMs !== 30000 || input.maxBytes !== 262144
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
  if (prepared !== input.preparedBytes || prepared > 77824 || performance.now() >= 20000) fail();
  const roles = JSON.parse(fs.readFileSync(path.join(evidence, 'dependency-roles.json'), 'utf8'));
  return runCause({ evidenceDirectory: evidence, repository, preparedBytes: prepared, roles, initialReceiptBytes: Buffer.byteLength(reservation) });
}
export function prepareDelivery(result, elapsed) {
  const line = `${JSON.stringify({ ...result, finalElapsedMs: elapsed, finalElapsedBasis: 'after-result-persistence-before-cli' })}\n`;
  const bytes = Buffer.byteLength(line);
  return { line, passes: result.observationComplete && result.cleanupComplete && result.outputAccountingComplete && result.withinBudget
    && result.resultPersisted && elapsed <= 30000 && result.output.receipts + bytes <= 16384
    && result.output.reservedBytes <= 262144 };
}
export async function runCli() {
  if (process.argv.length !== 3 || process.argv[2] !== '--reviewed-node-loader-cause-window') {
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
