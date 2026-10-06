import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { runOwnedCommand } from './command.mjs';
import { decodeReport, compilerInventory } from './report.mjs';

const LIMIT = 2 * 1024 * 1024;
const RECEIPT_RESERVE = 16384;
const fail = () => { throw new Error('Owned fd diagnostic unavailable'); };
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const identity = stat => ({ dev: stat.dev, ino: stat.ino, directory: stat.isDirectory(), regular: stat.isFile() });
const same = (stat, expected) => expected && !stat.isSymbolicLink() && stat.dev === expected.dev && stat.ino === expected.ino
  && stat.isDirectory() === expected.directory && stat.isFile() === expected.regular;
function boundedRead(file, maximum, io) {
  const before = io.lstatSync(file);
  if (!before.isFile() || before.isSymbolicLink() || before.size > maximum) fail();
  const fd = io.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  try {
    if (!same(io.fstatSync(fd), identity(before))) fail();
    const bytes = Buffer.alloc(before.size + 1); const length = io.readSync(fd, bytes, 0, bytes.length, 0);
    if (length !== before.size) fail();
    return bytes.subarray(0, length);
  } finally { io.closeSync(fd); }
}
function durable(file, data, budget, io) {
  const bytes = Buffer.from(`${JSON.stringify(data, null, 2)}\n`);
  budget.receipt(bytes.length);
  const fd = io.openSync(file, 'wx', 0o600);
  try { io.writeFileSync(fd, bytes); io.fsyncSync(fd); } finally { io.closeSync(fd); }
}
function makeBudget() {
  let captured = 0; let receipts = 0; let artifacts = 0; const measured = new Map();
  return {
    consume(length) { if (captured + artifacts + length + RECEIPT_RESERVE > LIMIT) fail(); captured += length; },
    receipt(length) { if (receipts + length > RECEIPT_RESERVE) fail(); receipts += length; },
    artifact(file, length) { const old = measured.get(file) ?? 0; if (length > old) { artifacts += length - old; measured.set(file, length); } return captured + artifacts + RECEIPT_RESERVE <= LIMIT; },
    snapshot() { return { captured, receipts, artifacts, measuredBytes: captured + receipts + artifacts, withinMeasuredBudget: captured + receipts + artifacts <= LIMIT, limit: LIMIT }; },
  };
}
function inventory(root, budget, io, readBytes = true) {
  const result = []; let entries = 0;
  function visit(directory, depth) {
    if (depth > 4) fail();
    for (const name of io.readdirSync(directory)) {
      if (++entries > 64 || !/^[A-Za-z0-9_.-]{1,96}$/.test(name)) fail();
      const file = path.join(directory, name); const stat = io.lstatSync(file);
      if (stat.isSymbolicLink()) fail();
      if (stat.isDirectory()) visit(file, depth + 1);
      else {
        if (!stat.isFile()) fail(); const fits = budget.artifact(file, stat.size);
        if (readBytes && !fits) fail();
        const bytes = readBytes ? boundedRead(file, LIMIT, io) : null;
        result.push({ path: file, bytes: stat.size, sha256: bytes ? hash(bytes) : null, identity: identity(stat) });
      }
    }
  }
  visit(root, 0); return result;
}
const closed = result => result.closeObserved && result.groupGone;
const healthy = result => closed(result) && result.reason === 'completed' && result.code === 0 && result.signal === null
  && (result.streams === null || Object.values(result.streams).every(stream => !stream.incomplete && !stream.truncated && !stream.observerFailed));

/** Import is inert. Caller verifies fixed source/toolchain inputs before invoking this once. */
export async function runFdCanaryBatch({ sourceDirectory, evidenceDirectory, toolchain }, dependencies = {}) {
  const io = dependencies.io ?? fs; const now = dependencies.now ?? (() => performance.now());
  const command = dependencies.command ?? runOwnedCommand;
  const start = dependencies.start ?? now(); const startedAt = dependencies.startedAt ?? new Date().toISOString(); const budget = makeBudget();
  const roots = []; const descriptors = []; const result = { startedAt, compileReservations: 0, compileCalls: 0, targetReservations: 0, targetStartsObserved: 0, stages: [],
    targets: ['NOT_RUN', 'NOT_RUN', 'NOT_RUN'], compilerOutputAccounting: 'unknown', cleanupComplete: false, retainedRoots: [] };
  let reserved = false; let allClosed = true; let descriptorsClosed = true; let creatingRoot = false;
  const elapsed = () => now() - start;
  function makeRoot(prefix) {
    creatingRoot = true;
    const createdPath = io.mkdtempSync(prefix);
    const record = { createdPath, directory: createdPath, identity: null, prepared: false, finalInventoryConfirmed: false }; roots.push(record); creatingRoot = false;
    record.directory = io.realpathSync(createdPath); const stat = io.lstatSync(record.directory);
    if (!stat.isDirectory() || stat.isSymbolicLink()) fail(); record.identity = identity(stat);
    io.chmodSync(record.directory, 0o700); record.prepared = true; return record.directory;
  }
  function openOwned(file) {
    const fd = io.openSync(file, fs.constants.O_RDWR | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW, 0o600);
    const item = { fd, closed: false }; descriptors.push(item); return fd;
  }
  async function execute(kind, options) {
    if (elapsed() >= 45000 || result.compileReservations > 1 || result.targetReservations > 3) fail();
    if (kind === 'compile') { if (result.compileReservations !== 0) fail(); result.compileReservations++; }
    else { if (result.compileCalls !== 1 || result.targetReservations >= 3) fail(); result.targetReservations++; }
    if (kind !== 'compile') result.targets[result.targetReservations - 1] = { state: 'reservation-unconfirmed', report: null };
    durable(path.join(evidenceDirectory, `slot-${kind}.json`), { kind, elapsedMs: elapsed(), consumed: true }, budget, io);
    if (kind !== 'compile') result.targets[result.targetReservations - 1] = { state: 'attempted', execution: 'unknown', report: null };
    allClosed = false;
    if (kind === 'compile') result.compileCalls++;
    const returned = await command(options, budget);
    if (kind !== 'compile' && returned.safe.pid !== null) result.targetStartsObserved++;
    const stage = { kind, ...returned.safe, stdoutBytes: returned.stdout.length, stdoutSha256: hash(returned.stdout),
      stderrBytes: returned.stderr.length, stderrSha256: hash(returned.stderr) };
    result.stages.push(stage); allClosed = closed(stage);
    if (kind !== 'compile') result.targets[result.targetReservations - 1] = { state: allClosed ? 'closed' : 'close-unknown', reason: stage.reason, report: null };
    if (!healthy(stage)) fail();
    return returned;
  }
  try {
    durable(path.join(evidenceDirectory, 'batch-reservation.json'), { startedAt, compileCalls: 1, maxTargets: 3, totalMs: 60000,
      maxBytes: LIMIT, meaning: 'Consumed once; failure or unknown forbids retry or a new clock' }, budget, io); reserved = true;
    const allowed = makeRoot('/private/tmp/flow-wpf02-fd-'); const denied = makeRoot('/private/tmp/flow-wpf02-fd-deny-');
    const control = path.join(allowed, 'control'); const state = path.join(allowed, 'state');
    for (const directory of [control, state, path.join(state, 'home'), path.join(state, 'tmp')]) io.mkdirSync(directory, { mode: 0o700 });
    for (const name of ['fd-canary.c', 'candidate.sb']) io.writeFileSync(path.join(control, name), boundedRead(path.join(sourceDirectory, name), 65536, io), { flag: 'wx', mode: 0o400 });
    const binary = path.join(control, 'fd-canary');
    const environment = { PATH: '/usr/bin:/bin', HOME: path.join(state, 'home'), TMPDIR: path.join(state, 'tmp'), LANG: 'C', LC_ALL: 'C', TZ: 'UTC' };
    inventory(allowed, budget, io);
    const compile = await execute('compile', { executable: toolchain.clang, cwd: control, environment, stdio: 'pipe', timeoutMs: 20000,
      args: ['-v', '-fno-integrated-cc1', '-save-temps=obj', '-std=c11', '-D_DARWIN_C_SOURCE', '-O0', '-Wall', '-Wextra', '-Werror', '-fno-modules',
        '-isysroot', toolchain.sdk, '-arch', 'arm64', '-mmacosx-version-min=15.0', path.join(control, 'fd-canary.c'), '-o', binary] });
    const artifacts = inventory(allowed, budget, io);
    const executable = artifacts.find(item => item.path === binary); if (!executable || executable.bytes > 262144 || executable.bytes === 0) fail();
    result.compilerCommands = compilerInventory(compile.stderr, control, artifacts, toolchain.clang, toolchain.linker);
    result.compilerOutputAccounting = 'visible-owned-files-and-verbose-outputs';
    result.binary = { bytes: executable.bytes, sha256: executable.sha256 };
    for (let number = 1; number <= 3; number++) {
      const nonce = randomBytes(16).toString('hex'); const reportPath = path.join(state, `report-${number}.jsonl`);
      let stdio = 'pipe';
      if (number === 3) stdio = [0, 1, 2].map(fd => openOwned(path.join(state, `stdio-${fd}.file`)));
      const args = number === 1 ? [reportPath, nonce] : ['-D', `ALLOW_ROOT=${allowed}`, '-D', `DENY_ROOT=${denied}`,
        '-D', `CANARY_EXECUTABLE=${binary}`, '-f', path.join(control, 'candidate.sb'), binary, reportPath, nonce];
      const returned = await execute(`target-${number}`, { executable: number === 1 ? binary : toolchain.sandbox,
        args, cwd: state, environment, stdio, timeoutMs: 5000 });
      const report = decodeReport(boundedRead(reportPath, 4096, io), nonce, returned.safe.pid);
      result.targets[number - 1] = { state: 'reported', report };
      inventory(allowed, budget, io);
      if (number === 1 && !report.slice(1, 4).every(item => item.fstat.ok && item.fstat.kind === 'socket' && item.fcntl.ok)) fail();
    }
    result.measurementComplete = true;
  } catch { result.measurementComplete = false; result.failure = 'stage-preparation-execution-or-report-unavailable'; }
  finally {
    for (const item of descriptors) {
      try { io.closeSync(item.fd); item.closed = true; } catch { descriptorsClosed = false; }
    }
    result.descriptorsClosed = descriptorsClosed;
    for (const root of roots) {
      let removed = false;
      if (allClosed && descriptorsClosed && root.prepared) try {
        if (!same(io.lstatSync(root.directory), root.identity)) fail();
        // All expected writers are confirmed closed; inspect only this exact own root before recursive removal.
        inventory(root.directory, budget, io, false); root.finalInventoryConfirmed = true; io.rmSync(root.directory, { recursive: true }); removed = true;
      } catch { /* Retain exact originally created path when any identity/output/close is unknown. */ }
      if (!removed) result.retainedRoots.push(root.createdPath);
    }
    result.rootCreationUnknown = creatingRoot;
    result.cleanupComplete = allClosed && descriptorsClosed && !creatingRoot && result.retainedRoots.length === 0;
  }
  result.outputAccountingComplete = allClosed && !creatingRoot && roots.every(root => root.finalInventoryConfirmed) && (result.compileCalls === 0 || result.compilerOutputAccounting === 'visible-owned-files-and-verbose-outputs');
  result.elapsedMs = elapsed(); result.elapsedBasis = 'before-result-persistence'; result.output = budget.snapshot();
  result.withinBudget = result.elapsedMs <= 60000 && result.output.withinMeasuredBudget && result.outputAccountingComplete;
  if (reserved) {
    try { durable(path.join(evidenceDirectory, 'batch-result.json'), result, budget, io); result.resultPersisted = true; }
    catch { result.resultPersisted = false; }
  } else result.resultPersisted = false;
  result.finalElapsedMs = elapsed(); result.output = budget.snapshot();
  result.withinBudget = result.finalElapsedMs <= 60000 && result.output.withinMeasuredBudget && result.outputAccountingComplete;
  return result;
}
