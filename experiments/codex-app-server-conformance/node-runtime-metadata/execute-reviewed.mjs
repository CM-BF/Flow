// Inert until the exact reviewed flag. No target or listener is created during import.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { fingerprint } from '../node-rootliteral/execute-reviewed.mjs';
import { registerR06Loader } from '../node-rootliteral/loader.mjs';
const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const evidence = path.join(repository, 'docs/evidence/wpf-mature-02/node-runtime-metadata');
const fail = () => { throw Error('Fixed runtime metadata window unavailable'); };

export function verifyPathClosure(closure, io = fs) {
  if (closure.seedCount !== 61 || closure.literalCount !== 177 || closure.nodes.length !== 144) fail();
  for (const node of closure.nodes) {
    let stat;
    try { stat = io.lstatSync(node.path); }
    catch (error) { if (node.kind === 'absent' && error?.code === 'ENOENT') continue; fail(); }
    const kind = stat.isSymbolicLink() ? 'symlink' : stat.isDirectory() ? 'directory' : stat.isFile() ? 'regular' : 'other';
    if (kind !== node.kind || kind === 'symlink' && io.readlinkSync(node.path) !== node.target
      || kind === 'regular' && stat.size !== node.bytes) fail();
  }
  for (const chain of closure.chains) if (chain.status === 'resolved' && io.realpathSync(chain.seed) !== chain.realpath) fail();
}
export async function executeReviewed() {
  const reservation = `${JSON.stringify({ consumed: true, window: 'go-node-runtime-metadata-once', maxTargets: 2, totalMs: 60000 })}\n`;
  const fd = fs.openSync(path.join(evidence, 'entry-reservation.json'), fs.constants.O_WRONLY | fs.constants.O_EXCL | fs.constants.O_CREAT | fs.constants.O_NOFOLLOW, 0o600);
  try { fs.writeFileSync(fd, reservation); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  const input = JSON.parse(fs.readFileSync(path.join(evidence, 'driver-input.json'), 'utf8'));
  if (input.window !== 'go-node-runtime-metadata-once' || input.maxTargets !== 2 || input.totalMs !== 60000 || input.maxBytes !== 2097152
    || input.preparedLimit !== 524288 || input.receiptReserve !== 32768 || input.archiveReserve !== 131072 || input.outerReserve !== 8192
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
  if (prepared !== input.preparedBytes || prepared > 524288 || performance.now() >= 20000) fail();
  verifyPathClosure(JSON.parse(fs.readFileSync(path.join(evidence, 'path-closure.json'), 'utf8')));
  const roles = JSON.parse(fs.readFileSync(path.join(evidence, 'dependency-roles.json'), 'utf8'));
  registerR06Loader();
  const { runRuntimeMetadataBatch } = await import('./host.mjs');
  return runRuntimeMetadataBatch({ repository, evidenceDirectory: evidence, preparedBytes: prepared, roles,
    peerBytes: fs.readFileSync(path.join(repository, 'apps/runner/src/codex/fixtures/peer.mjs')),
    initialReceiptBytes: Buffer.byteLength(reservation) });
}
export function prepareDelivery(result, elapsed) {
  const line = `${JSON.stringify({ ...result, finalElapsedMs: elapsed, finalElapsedBasis: 'after-result-persistence-before-cli' })}\n`;
  const bytes = Buffer.byteLength(line);
  return { line, bytes, passes: result.measurementComplete && result.cleanupComplete && result.outputAccountingComplete
    && result.inventoryPersisted && result.resultPersisted && result.withinBudget && elapsed <= 60000
    && result.output.receipts + bytes <= 32768 && result.output.knownBytes + bytes + 131072 + 8192 <= 2097152 };
}
export async function runCli() {
  if (process.argv.length !== 3 || process.argv[2] !== '--reviewed-node-runtime-metadata-window') {
    process.stdout.write('{"state":"NOT_RUN"}\n'); process.exitCode = 2; return;
  }
  let result; try { result = await executeReviewed(); } catch { result = null; }
  const delivery = result ? prepareDelivery(result, performance.now())
    : { line: '{"state":"FAILED_OR_UNKNOWN","reason":"fixed-input-or-host-failure","targetSettlement":"unknown"}\n', passes: false };
  const timer = setTimeout(() => process.exit(1), 500);
  process.stdout.once('error', () => process.exit(1));
  process.stdout.write(delivery.line, error => {
    clearTimeout(timer); let durable = false; try { fs.fsyncSync(1); durable = true; } catch { /* Unknown delivery fails. */ }
    process.exit(!error && durable && delivery.passes && performance.now() <= 60000 ? 0 : 1);
  });
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await runCli();
