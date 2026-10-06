// Inert entry. All target processes stay behind the reviewed explicit flag.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { registerR06Loader } from './loader.mjs';
const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const evidence = path.join(repository, 'docs/evidence/wpf-mature-02/node-rootliteral');
const fail = () => { throw Error('Fixed Node window unavailable'); };
const json = value => `${JSON.stringify(value)}\n`;
function durable(file, bytes) {
  const fd = fs.openSync(file, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY | fs.constants.O_NOFOLLOW, 0o600);
  try { fs.writeFileSync(fd, bytes); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
}
export function fingerprint(file, expected) {
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size !== expected.bytes) fail();
  const fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  try {
    const opened = fs.fstatSync(fd); if (opened.ino !== stat.ino || opened.dev !== stat.dev) fail();
    const hash = createHash('sha256'); const buffer = Buffer.alloc(65536); let offset = 0;
    while (offset < stat.size) {
      const count = fs.readSync(fd, buffer, 0, Math.min(buffer.length, stat.size - offset), offset);
      if (count <= 0) fail(); hash.update(buffer.subarray(0, count)); offset += count;
    }
    if (hash.digest('hex') !== expected.sha256 || fs.fstatSync(fd).size !== stat.size) fail();
  } finally { fs.closeSync(fd); }
}
export async function executeReviewed() {
  const start = 0; // performance.now includes Node startup/import, unlike a clock begun after imports.
  const startedAt = new Date(performance.timeOrigin).toISOString();
  const reservation = json({ startedAt, consumed: true, window: 'go-node-rootliteral-once', maxTargets: 3, maxCompile: 0 });
  durable(path.join(evidence, 'entry-reservation.json'), reservation);
  const input = JSON.parse(fs.readFileSync(path.join(evidence, 'driver-input.json'), 'utf8'));
  if (input.candidate !== 'node-rootliteral' || input.totalMs !== 60000 || input.maxTargets !== 3 || input.maxCompileCalls !== 0
    || input.maxBytes !== 2097152 || input.receiptReserveBytes !== 32768 || input.archiveReserveBytes !== 131072
    || fs.realpathSync(process.execPath) !== input.node.path) fail();
  const checkRelative = item => {
    if (!/^[A-Za-z0-9_.\/-]+$/.test(item.path) || item.path.startsWith('/') || item.path.split('/').some(x => !x || x === '..' || x === '.')) fail();
    fingerprint(path.join(repository, item.path), item);
  };
  for (const item of input.files) checkRelative(item);
  for (const item of input.externalInputs) fingerprint(item.path, item);
  fingerprint(input.node.path, input.node);
  let prepared = 0; const seen = new Set();
  for (const item of input.preparedEvidence) {
    if (seen.has(item.path)) fail(); seen.add(item.path); checkRelative(item); prepared += item.bytes;
  }
  if (prepared !== input.preparedEvidenceBytes || performance.now() >= 45000) fail();
  registerR06Loader();
  const { runNodeRootliteralBatch } = await import('./host.mjs');
  return runNodeRootliteralBatch({ evidenceDirectory: evidence,
    peerBytes: fs.readFileSync(path.join(repository, 'apps/runner/src/codex/fixtures/peer.mjs')),
    preparedEvidenceBytes: prepared }, { start, startedAt, initialReceiptBytes: Buffer.byteLength(reservation) });
}
export function prepareDelivery(result, elapsedMs) {
  const payload = { ...result, finalElapsedMs: elapsedMs, finalElapsedBasis: 'after-result-persistence-before-cli-write' };
  const line = json(payload), bytes = Buffer.byteLength(line);
  const passes = result.measurementComplete && result.cleanupComplete && result.outputAccountingComplete && result.inventoryPersisted
    && result.resultPersisted && result.withinBudget && elapsedMs <= 60000
    && result.output.measuredBytes + bytes + 131072 + 1024 <= 2097152 && result.output.receipts + bytes + 1024 <= 32768;
  return { line, bytes, passes };
}
export async function runCli() {
  if (process.argv.length !== 3 || process.argv[2] !== '--reviewed-node-rootliteral-window') {
    process.stdout.write(json({ state: 'NOT_RUN', reason: 'explicit-reviewed-window-required' })); process.exitCode = 2; return;
  }
  let result;
  try { result = await executeReviewed(); }
  catch { result = null; }
  const delivery = result ? prepareDelivery(result, performance.now())
    : { line: json({ state: 'FAILED_OR_UNKNOWN', reason: 'fixed-input-or-host-failure', targetSettlement: 'unknown' }), passes: false };
  // Bounded observation exit, not proof that an unknown target has stopped. Fixed raw never enters this envelope.
  const deadline = setTimeout(() => process.exit(1), 500);
  process.stdout.once('error', () => process.exit(1));
  process.stdout.write(delivery.line, error => {
    clearTimeout(deadline);
    let persisted = false;
    try { fs.fsyncSync(1); persisted = true; } catch { /* CLI delivery not durable; explicit failure. */ }
    process.exit(!error && persisted && delivery.passes && performance.now() <= 60000 ? 0 : 1);
  });
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await runCli();
