import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { fingerprint } from '../node-rootliteral/execute-reviewed.mjs';
import { registerR06Loader } from '../node-rootliteral/loader.mjs';
import { runNativeCatalogProbe, bounds } from './probe.mjs';
import { inspectSystemConfiguration } from '../native-system-config/system-config-gate.mjs';

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const nativePath = '/opt/homebrew/lib/node_modules/@openai/codex/node_modules/@openai/codex-darwin-arm64/vendor/aarch64-apple-darwin/bin/codex';
const fail = () => { throw Error('Fixed native catalog input unavailable'); };
const absent = file => {
  try { fs.lstatSync(file); return false; } catch (error) { if (error?.code === 'ENOENT') return true; throw error; }
};

// A failed reservation consumes this entry attempt, but never claims a target was started.
export function reserveEntry(file, text, io = fs) {
  const bytes = Buffer.from(text);
  const artifact = { file, owned: false, identity: null, bytes: 0, closed: true, flushed: false, identityConfirmed: false, complete: false };
  let fd;
  try {
    fd = io.openSync(file, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY | fs.constants.O_NOFOLLOW, 0o600);
    artifact.owned = true; artifact.closed = false;
    const stat = io.fstatSync(fd); artifact.identity = { dev: stat.dev, ino: stat.ino };
    if (fd < 3 || !stat.isFile() || (stat.mode & 0o777) !== 0o600) throw Error('Reservation identity');
    while (artifact.bytes < bytes.length) {
      const n = io.writeSync(fd, bytes, artifact.bytes, bytes.length - artifact.bytes);
      if (!Number.isSafeInteger(n) || n < 1 || n > bytes.length - artifact.bytes) throw Error('Reservation write');
      artifact.bytes += n;
    }
    io.fsyncSync(fd); artifact.flushed = true;
  } catch { /* Keep all known ownership and partial-write facts; never return an OS error string. */ }
  finally { if (fd !== undefined) try { io.closeSync(fd); artifact.closed = true; } catch { /* No second close. */ } }
  if (artifact.owned && artifact.identity && artifact.closed) {
    try {
      const stat = io.lstatSync(file);
      artifact.identityConfirmed = stat.isFile() && !stat.isSymbolicLink() && stat.dev === artifact.identity.dev
        && stat.ino === artifact.identity.ino && stat.size === artifact.bytes && (stat.mode & 0o777) === 0o600;
    } catch { /* Preserve known fd identity even when its current path is unknown. */ }
  }
  artifact.complete = artifact.identityConfirmed && artifact.closed && artifact.flushed && artifact.bytes === bytes.length;
  return artifact;
}
export function entryFailure(artifact, preparedBytes, factoryCalled = false) {
  return { status: 'FAILED_OR_UNKNOWN', failure: 'ENTRY_RESERVATION_OR_LOAD_UNKNOWN', targetCalls: factoryCalled ? null : 0,
    targetStarted: factoryCalled ? 'unknown' : 'not-started', modelListCalls: factoryCalled ? null : 0,
    entryReservation: artifact, roots: [], retainedRoots: [], retainedRootsComplete: !factoryCalled,
    retainedDiagnosticArtifact: null, processCleanupComplete: !factoryCalled, rootCleanupComplete: !factoryCalled,
    resultPersisted: false, outputAccountingComplete: false, withinBudget: false,
    output: { preparedBytes, receiptBytes: artifact.bytes, stdoutWireBytes: null } };
}

export function configurationBlocked(gate, preparedBytes, artifact = { owned: false, bytes: 0, closed: true }) {
  return { ...entryFailure(artifact, preparedBytes), failure: 'SYSTEM_CONFIGURATION_STATE_NOT_ABSENT',
    systemConfigurationGate: gate };
}

export function prepareDelivery(result, elapsedMs) {
  const line = `${JSON.stringify({ ...result, finalElapsedMs: elapsedMs, finalElapsedBasis: 'after-result-persistence-before-cli' })}\n`;
  const bytes = Buffer.byteLength(line);
  const known = Object.entries(result.output).reduce((n, [key, value]) => key === 'stdoutWireBytes' ? n : n + value, 0);
  return { line, bytes, passes: bytes <= 32768 && result.output.receiptBytes + bytes <= 32768
    && known + bytes + bounds.archiveBytes + 8192 <= bounds.totalBytes && elapsedMs <= bounds.totalMs
    && result.status === 'CATALOG_OBSERVED' && result.resultPersisted && result.withinBudget };
}

// Only the two reviewed windows can bind this entry; target and authority stay fixed here.
export function createReviewedEntry(namespace, observeNotification) {
  if (namespace !== 'native-catalog-observation' && namespace !== 'native-remote-status') fail();
  const evidence = path.join(repository, 'docs/evidence/wpf-mature-02', namespace);
  const windowName = `go-${namespace}-once`;
  const policy = `experiments/codex-app-server-conformance/${namespace}/candidate.sb`;
  const flag = `--reviewed-${namespace}-window`;
  async function executeReviewed() {
    const input = JSON.parse(fs.readFileSync(path.join(evidence, 'driver-input.json'), 'utf8'));
    if (input.window !== windowName || input.maxTargets !== 1 || input.totalMs !== bounds.totalMs
      || input.maxBytes !== bounds.totalBytes || input.ownBytes !== bounds.ownBytes || input.native.path !== nativePath
      || input.native.sha256 !== '4f85982624b3898c8991cb80c0981b2aa71070e3537046c9a95950318a95afcc'
      || fs.realpathSync(process.execPath) !== input.node.path || input.policy !== policy) fail();
    const relative = name => {
      if (typeof name !== 'string' || !/^[A-Za-z0-9_.\/-]+$/.test(name) || name.startsWith('/')
        || name.split('/').some(part => !part || part === '..' || part === '.')) fail();
      return path.join(repository, name);
    };
    for (const item of input.files) fingerprint(relative(item.path), item);
    for (const item of input.external) fingerprint(item.path, item);
    fingerprint(input.node.path, input.node); fingerprint(input.native.path, input.native);
    let prepared = 0; const seen = new Set();
    for (const item of input.prepared) {
      if (seen.has(item.path)) fail(); seen.add(item.path);
      fingerprint(relative(item.path), item); prepared += item.bytes;
    }
    if (prepared !== input.preparedBytes || prepared > bounds.preparedBytes || performance.now() >= bounds.latestSpawnMs) fail();
    // The outer wrapper has its own separately reserved files; these entry/target files must all be absent.
    const outputs = ['entry-reservation.json', 'target-reservation.json', 'result.json', 'catalog.json', 'private-stderr.raw'];
    if (outputs.some(name => !absent(path.join(evidence, name)))) fail();
    const beforeReservation = inspectSystemConfiguration();
    if (!beforeReservation.passed) return configurationBlocked(beforeReservation, prepared);
    const reservation = `${JSON.stringify({ window: windowName, maxTargets: 1, totalMs: bounds.totalMs,
      consumed: true, startedAt: new Date(performance.timeOrigin).toISOString() })}\n`;
    const artifact = reserveEntry(path.join(evidence, outputs[0]), reservation);
    if (!artifact.complete) return entryFailure(artifact, prepared);
    let factoryCalled = false;
    try {
      registerR06Loader();
      const { createCodexTransport } = await import('../../../apps/runner/src/codex/index.ts');
      const beforeOwnedPreparation = inspectSystemConfiguration();
      if (!beforeOwnedPreparation.passed) return configurationBlocked(beforeOwnedPreparation, prepared, artifact);
      const result = await runNativeCatalogProbe({ factory: options => { factoryCalled = true; return createCodexTransport(options); },
        native: nativePath, evidenceDirectory: evidence, policyBytes: fs.readFileSync(path.join(repository, policy)),
        preparedBytes: prepared, initialReceiptBytes: artifact.bytes }, { observeNotification });
      return { ...result, entryReservation: artifact, systemConfigurationGate: beforeOwnedPreparation };
    } catch { return entryFailure(artifact, prepared, factoryCalled); }
  }

  async function runCli() {
    if (process.argv.length !== 3 || process.argv[2] !== flag) {
      process.stdout.write('{"state":"NOT_RUN"}\n'); process.exitCode = 2; return;
    }
    let result;
    try { result = await executeReviewed(); } catch { result = null; }
    const delivery = result ? prepareDelivery(result, performance.now())
      : { line: '{"state":"FAILED_OR_UNKNOWN","reason":"fixed-input-or-host-failure","targetSettlement":"unknown"}\n', passes: false };
    // Exiting this host never asserts that an unconfirmed target or a descendant has stopped.
    const deadline = setTimeout(() => process.exit(1), 500);
    process.stdout.once('error', () => process.exit(1));
    process.stdout.write(delivery.line, error => {
      clearTimeout(deadline); let durable = false;
      try { fs.fsyncSync(1); durable = true; } catch { /* Unknown delivery fails the window. */ }
      process.exit(!error && durable && delivery.passes && performance.now() <= bounds.totalMs ? 0 : 1);
    });
  }
  return Object.freeze({ executeReviewed, runCli });
}

export const { executeReviewed, runCli } = createReviewedEntry('native-catalog-observation');

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await runCli();
