// Explicit once-only CLI. No work on import; no generic shell command interface.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { runFdCanaryBatch } from './host.mjs';
const sourceDirectory = path.dirname(fileURLToPath(import.meta.url));
const repository = path.resolve(sourceDirectory, '../../..');
const evidenceDirectory = path.join(repository, 'docs/evidence/wpf-mature-02/fd-canary-v3');
function fingerprint(file, expected) {
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size !== expected.bytes) throw new Error();
  const fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  try {
    const opened = fs.fstatSync(fd); if (opened.dev !== stat.dev || opened.ino !== stat.ino) throw new Error();
    const hash = createHash('sha256'); const buffer = Buffer.alloc(65536); let offset = 0;
    while (offset < stat.size) {
      const count = fs.readSync(fd, buffer, 0, Math.min(buffer.length, stat.size - offset), offset);
      if (count <= 0) throw new Error(); hash.update(buffer.subarray(0, count)); offset += count;
    }
    if (hash.digest('hex') !== expected.sha256 || fs.fstatSync(fd).size !== stat.size) throw new Error();
  } finally { fs.closeSync(fd); }
}
export async function executeReviewed(start = performance.now(), startedAt = new Date().toISOString()) {
  const input = JSON.parse(fs.readFileSync(path.join(evidenceDirectory, 'driver-input.json'), 'utf8'));
  if (input.candidateVersion !== 3 || input.totalMs !== 60000 || input.maxTargets !== 2 || input.maxCompileCalls !== 1 || input.maxBytes !== 2097152) throw new Error();
  if (fs.realpathSync(process.execPath) !== input.node.path) throw new Error();
  for (const item of input.files) {
    if (item.path.startsWith('/') || item.path.split('/').includes('..')) throw new Error();
    fingerprint(path.join(repository, item.path), item);
  }
  for (const item of input.externalInputs) fingerprint(item.path, item);
  fingerprint(input.node.path, input.node);
  let preparedEvidenceBytes = 0;
  const preparedPaths = new Set();
  for (const item of input.preparedEvidence) {
    if (item.path.startsWith('/') || item.path.split('/').includes('..') || preparedPaths.has(item.path)) throw new Error();
    fingerprint(path.join(repository, item.path), item); preparedPaths.add(item.path); preparedEvidenceBytes += item.bytes;
  }
  if (preparedEvidenceBytes !== input.preparedEvidenceBytes || input.archiveReserveBytes !== 131072) throw new Error();
  return runFdCanaryBatch({ sourceDirectory, evidenceDirectory, toolchain: input.toolchain, preparedEvidenceBytes, archiveReserveBytes: input.archiveReserveBytes }, { start, startedAt });
}
/** Pure final-output gate; serialized bytes are included before writing the only CLI envelope. */
export function prepareDelivery(result, elapsedMs) {
  const { withinBudget, ...rest } = result;
  const payload = JSON.stringify({ ...rest, withinBudgetBeforeCliDelivery: withinBudget, finalElapsedMs: elapsedMs,
    finalElapsedBasis: 'after-result-persistence-before-cli-write',
    output: { ...result.output, accountingBasis: 'before-cli-envelope; exact encoded envelope is included in the exit gate' } });
  const line = `{"cliPayloadBytes":${Buffer.byteLength(payload)},"result":${payload}}\n`;
  const bytes = Buffer.byteLength(line);
  const passes = result.measurementComplete && result.cleanupComplete && result.outputAccountingComplete && result.resultPersisted && result.compilerInventoryPersisted && withinBudget
    && elapsedMs <= 60000 && result.output.measuredBytes + bytes + result.output.archiveReserveBytes <= 2097152
    && result.output.receipts + bytes <= result.output.receiptReserveBytes;
  return { line, bytes, passes };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.stdout.once('error', () => { process.exitCode = 1; });
  if (process.argv.length !== 3 || process.argv[2] !== '--reviewed-fd-window-v3') {
    process.stdout.write('{"state":"NOT_RUN","reason":"explicit-reviewed-window-argument-required"}\n'); process.exitCode = 2;
  } else try {
    const start = performance.now(); const startedAt = new Date().toISOString();
    const result = await executeReviewed(start, startedAt);
    const delivery = prepareDelivery(result, performance.now() - start);
    process.stdout.write(delivery.line, error => { process.exitCode = !error && delivery.passes && performance.now() - start <= 60000 ? 0 : 1; });
  } catch {
    process.stdout.write('{"state":"NOT_RUN_OR_UNCONFIRMED","reason":"fixed-input-or-host-failure"}\n'); process.exitCode = 1;
  }
}
