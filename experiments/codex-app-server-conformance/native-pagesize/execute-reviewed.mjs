import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { fingerprint } from '../node-rootliteral/execute-reviewed.mjs';
import { retainPrivateText } from '../node-failure-text/private-text.mjs';
import { runPagesize, bounds } from './host.mjs';
const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const evidence = path.join(repository, 'docs/evidence/wpf-mature-02/native-pagesize');
const fail = () => { throw Error('Fixed pagesize input unavailable'); };

export async function executeReviewed({ io = fs, run = runPagesize, check = fingerprint } = {}) {
  let reservation = null, result = null, initialReceiptBytes = 0, runEntered = false;
  try {
    const input = JSON.parse(io.readFileSync(path.join(evidence, 'driver-input.json'), 'utf8'));
    if (input.window !== 'go-native-pagesize-once' || input.maxTargets !== 2 || input.maxCompileCalls !== 1
      || input.totalMs !== bounds.totalMs || input.maxBytes !== bounds.totalBytes || io.realpathSync(process.execPath) !== input.node.path) fail();
    const local = name => {
      if (!/^[A-Za-z0-9_./-]+$/.test(name) || name.startsWith('/') || name.split('/').some(part => !part || part === '.' || part === '..')) fail();
      return path.join(repository, name);
    };
    for (const name of input.entryAbsentOutputs) {
      try { io.lstatSync(local(name)); fail(); } catch (error) { if (error?.code !== 'ENOENT') throw error; }
    }
    for (const item of input.files) check(local(item.path), item);
    for (const item of input.external) check(item.path, item);
    check(input.node.path, input.node);
    let prepared = 0; const seen = new Set();
    for (const item of input.prepared) {
      if (seen.has(item.path)) fail(); seen.add(item.path); check(local(item.path), item); prepared += item.bytes;
    }
    if (prepared !== input.preparedBytes || prepared > bounds.preparedBytes || performance.now() >= bounds.latestCompileMs) fail();
    const bytes = Buffer.from(`${JSON.stringify({ consumed: true, window: input.window, maxCompileCalls: 1, maxTargets: 2, totalMs: 30000 })}\n`);
    reservation = retainPrivateText(path.join(evidence, 'entry-reservation.json'), bytes, true,
      { reserveDisk(n) { if (n > 1024) fail(); }, disk(n) { initialReceiptBytes += n; } }, io);
    if (!reservation.complete) fail();
    runEntered = true;
    result = await run({ sourceDirectory: path.join(repository, 'experiments/codex-app-server-conformance/native-pagesize'),
      evidenceDirectory: evidence, toolchain: input.toolchain, preparedBytes: prepared, initialReceiptBytes });
  } catch { /* The safe reservation identity survives failures before any process can start. */ }
  return { reservation, result, ...(result ? {} : { compileCalls: runEntered ? null : 0, helperCalls: runEntered ? null : 0, retainedRootsComplete: !runEntered, state: 'NOT_RUN_OR_HOST_UNKNOWN' }) };
}
export function prepareDelivery(receipt, elapsedMs) {
  const line = `${JSON.stringify({ ...receipt, finalElapsedMs: elapsedMs, elapsedBasis: 'after-result-persistence-before-cli' })}\n`;
  const bytes = Buffer.byteLength(line), result = receipt.result;
  const passes = !!result && receipt.reservation?.complete && result.measurementComplete && result.processCleanupComplete
    && result.rootCleanupComplete && result.outputAccountingComplete && result.resultPersisted && result.withinBudget
    && elapsedMs <= bounds.totalMs && result.output.receiptBytes + bytes <= bounds.receiptBytes
    && result.knownBytes + bytes + bounds.outerBytes + bounds.archiveBytes <= bounds.totalBytes;
  return { line, bytes, passes };
}
export async function runCli() {
  if (process.argv.length !== 3 || process.argv[2] !== '--reviewed-native-pagesize-window') {
    process.stdout.write('{"state":"NOT_RUN"}\n'); process.exitCode = 2; return;
  }
  const receipt = await executeReviewed();
  const delivery = prepareDelivery(receipt, performance.now());
  const timer = setTimeout(() => process.exit(1), 500);
  process.stdout.once('error', () => process.exit(1));
  process.stdout.write(delivery.line, error => {
    clearTimeout(timer); let durable = false; try { fs.fsyncSync(1); durable = true; } catch { /* Delivery unknown. */ }
    process.exit(!error && durable && delivery.passes && performance.now() <= bounds.totalMs ? 0 : 1);
  });
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await runCli();
