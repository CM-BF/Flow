import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { runOwnedCommand } from './command.mjs';
import { decodeReport, compilerInventory, compilerFailureCode } from './report.mjs';

const LIMIT = 2 * 1024 * 1024;
const RECEIPT_RESERVE = 32768;
const ARCHIVE_RESERVE = 131072;
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
function durable(file, data, budget, io, onCloseUnknown = () => {}) {
  const bytes = Buffer.from(`${JSON.stringify(data, null, 2)}\n`);
  budget.receipt(bytes.length);
  const fd = io.openSync(file, 'wx', 0o600);
  try { io.writeFileSync(fd, bytes); io.fsyncSync(fd); }
  finally { try { io.closeSync(fd); } catch { onCloseUnknown(); fail(); } }
}
function makeBudget(preparedEvidenceBytes, archiveReserveBytes) {
  if (!Number.isSafeInteger(preparedEvidenceBytes) || preparedEvidenceBytes < 0 || archiveReserveBytes !== ARCHIVE_RESERVE
    || preparedEvidenceBytes + archiveReserveBytes + RECEIPT_RESERVE > LIMIT) fail();
  let captured = 0; let receipts = 0; let artifacts = 0; const measured = new Map();
  const reservedTotal = () => preparedEvidenceBytes + captured + artifacts + RECEIPT_RESERVE + archiveReserveBytes;
  return {
    consume(length) { if (reservedTotal() + length > LIMIT) fail(); captured += length; },
    receipt(length) { if (receipts + length > RECEIPT_RESERVE) fail(); receipts += length; },
    artifact(file, length) { const old = measured.get(file) ?? 0; if (length > old) { artifacts += length - old; measured.set(file, length); } return reservedTotal() <= LIMIT; },
    snapshot() { return { preparedEvidenceBytes, archiveReserveBytes, receiptReserveBytes: RECEIPT_RESERVE, captured, receipts, artifacts,
      measuredBytes: preparedEvidenceBytes + captured + receipts + artifacts, reservedUpperBound: reservedTotal(),
      withinMeasuredBudget: reservedTotal() <= LIMIT, limit: LIMIT }; },
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
export async function runFdCanaryBatch({ sourceDirectory, evidenceDirectory, toolchain, preparedEvidenceBytes = 0, archiveReserveBytes = ARCHIVE_RESERVE }, dependencies = {}) {
  const io = dependencies.io ?? fs; const now = dependencies.now ?? (() => performance.now());
  const command = dependencies.command ?? runOwnedCommand;
  const start = dependencies.start ?? now(); const startedAt = dependencies.startedAt ?? new Date().toISOString(); const budget = makeBudget(preparedEvidenceBytes, archiveReserveBytes);
  const roots = []; const descriptors = []; const result = { startedAt, compileReservations: 0, compileCalls: 0, targetReservations: 0, targetStartsObserved: 0, stages: [],
    targets: ['NOT_RUN', 'NOT_RUN'], targetCases: ['control-socket', 'profile-regular'], compilerInventoryPersisted: false, compilerOutputAccounting: 'unknown', cleanupComplete: false, retainedRoots: [] };
  let reserved = false; let allClosed = true; let descriptorsClosed = true; let creatingRoot = false; let stage = 'reservation';
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
    const item = { fd, closed: false }; descriptors.push(item);
    const opened = io.fstatSync(fd), named = io.lstatSync(file);
    if (fd < 3 || !opened.isFile() || (opened.mode & 0o777) !== 0o600 || !same(named, identity(opened))) fail();
    item.identity = identity(opened); return fd;
  }
  function persistCompilerStream(name, bytes) {
    if (!Buffer.isBuffer(bytes) || bytes.length > 65536) fail();
    const file = path.join(evidenceDirectory, `compiler.${name}`);
    const record = { stream: name, file: `compiler.${name}`, capturedBytes: bytes.length, capturedSha256: hash(bytes), created: false, persisted: false, closed: false };
    result.compilerOutputFiles ??= []; result.compilerOutputFiles.push(record);
    // Count the disk copy separately from captured bytes before creating or writing it.
    if (!budget.artifact(file, bytes.length)) fail();
    const fd = io.openSync(file, fs.constants.O_RDWR | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW, 0o600);
    record.created = true;
    try {
      const stat = io.fstatSync(fd);
      if (!stat.isFile() || (stat.mode & 0o777) !== 0o600) fail();
      const openedIdentity = identity(stat);
      io.writeFileSync(fd, bytes); io.fsyncSync(fd); record.persisted = true;
      const named = io.lstatSync(file);
      if (!same(named, openedIdentity) || (named.mode & 0o777) !== 0o600) fail();
      const saved = Buffer.alloc(bytes.length + 1); const length = io.readSync(fd, saved, 0, saved.length, 0);
      const verifiedSha256 = hash(saved.subarray(0, length));
      if (length !== bytes.length || verifiedSha256 !== record.capturedSha256) fail();
      Object.assign(record, { verifiedBytes: length, verifiedSha256, mode: '0600', dev: named.dev, ino: named.ino });
    }
    finally {
      try { io.closeSync(fd); record.closed = true; }
      catch { descriptorsClosed = false; fail(); }
    }
  }
  async function execute(kind, options) {
    if (elapsed() >= 45000 || result.compileReservations > 1 || result.targetReservations > 2) fail();
    if (kind === 'compile') { if (result.compileReservations !== 0) fail(); result.compileReservations++; }
    else { if (result.compileCalls !== 1 || result.targetReservations >= 2) fail(); result.targetReservations++; }
    if (kind !== 'compile') result.targets[result.targetReservations - 1] = { state: 'reservation-unconfirmed', report: null };
    durable(path.join(evidenceDirectory, `slot-${kind}.json`), { kind, elapsedMs: elapsed(), consumed: true }, budget, io);
    if (kind !== 'compile') result.targets[result.targetReservations - 1] = { state: 'attempted', execution: 'unknown', report: null };
    allClosed = false;
    if (kind === 'compile') result.compileCalls++;
    const returned = await command(options, budget);
    if (kind !== 'compile' && returned.safe.pid !== null) result.targetStartsObserved++;
    const completedStage = { kind, ...returned.safe, stdoutBytes: returned.stdout.length, stdoutSha256: hash(returned.stdout),
      stderrBytes: returned.stderr.length, stderrSha256: hash(returned.stderr) };
    result.stages.push(completedStage); allClosed = closed(completedStage);
    if (kind !== 'compile') result.targets[result.targetReservations - 1] = { state: allClosed ? 'closed' : 'close-unknown', reason: completedStage.reason, report: null };
    if (kind === 'compile') {
      stage = 'compiler-output-persistence';
      persistCompilerStream('stderr', returned.stderr); persistCompilerStream('stdout', returned.stdout);
      stage = 'compiler-inventory-persistence';
      durable(path.join(evidenceDirectory, 'compiler-inventory.json'), { startedAt, scope: 'owned compiler streams; no raw text', files: result.compilerOutputFiles }, budget, io, () => { descriptorsClosed = false; });
      result.compilerInventoryPersisted = true;
    }
    stage = kind === 'compile' ? 'compiler-health' : `${kind}-health`;
    if (!healthy(completedStage)) fail();
    return returned;
  }
  try {
    durable(path.join(evidenceDirectory, 'batch-reservation.json'), { startedAt, compileCalls: 1, maxTargets: 2, totalMs: 60000,
      maxBytes: LIMIT, preparedEvidenceBytes, archiveReserveBytes, receiptReserveBytes: RECEIPT_RESERVE, meaning: 'Consumed once; failure or unknown forbids retry or a new clock' }, budget, io); reserved = true;
    stage = 'root-preparation';
    const allowed = makeRoot('/private/tmp/flow-wpf02-fd-'); const denied = makeRoot('/private/tmp/flow-wpf02-fd-deny-');
    const control = path.join(allowed, 'control'); const state = path.join(allowed, 'state');
    for (const directory of [control, state, path.join(state, 'home'), path.join(state, 'tmp')]) io.mkdirSync(directory, { mode: 0o700 });
    stage = 'source-copy';
    for (const name of ['fd-canary.c', 'candidate.sb']) io.writeFileSync(path.join(control, name), boundedRead(path.join(sourceDirectory, name), 65536, io), { flag: 'wx', mode: 0o400 });
    const binary = path.join(control, 'fd-canary');
    const environment = { PATH: '/usr/bin:/bin', HOME: path.join(state, 'home'), TMPDIR: path.join(state, 'tmp'), LANG: 'C', LC_ALL: 'C', TZ: 'UTC' };
    stage = 'initial-inventory'; inventory(allowed, budget, io);
    stage = 'compile-execution';
    const compile = await execute('compile', { executable: toolchain.clang, cwd: control, environment, stdio: 'pipe', timeoutMs: 20000,
      args: ['-v', '-fno-integrated-cc1', '-save-temps=obj', '-std=c11', '-D_DARWIN_C_SOURCE', '-O0', '-Wall', '-Wextra', '-Werror', '-fno-modules',
        '-isysroot', toolchain.sdk, '-arch', 'arm64', '-mmacosx-version-min=15.0', path.join(control, 'fd-canary.c'), '-o', binary] });
    stage = 'compiled-inventory'; const artifacts = inventory(allowed, budget, io);
    stage = 'binary-validation'; const executable = artifacts.find(item => item.path === binary); if (!executable || executable.bytes > 262144 || executable.bytes === 0) fail();
    stage = 'compiler-command-inventory'; result.compilerCommands = compilerInventory(compile.stderr, control, artifacts, toolchain.clang, toolchain.linker);
    result.compilerOutputAccounting = 'visible-owned-files-and-verbose-outputs';
    result.binary = { bytes: executable.bytes, sha256: executable.sha256 };
    for (let number = 1; number <= 2; number++) {
      stage = `target-${number}-preparation`;
      const nonce = randomBytes(16).toString('hex'); const reportPath = path.join(state, `report-${number}.jsonl`);
      let stdio = 'pipe';
      if (number === 2) {
        stdio = [0, 1, 2].map(fd => openOwned(path.join(state, `stdio-${fd}.file`)));
        if (new Set(stdio).size !== 3) fail();
        result.parentRegularStdio = descriptors.map((item, fd) => ({ fd, kind: 'regular', dev: item.identity.dev, ino: item.identity.ino, mode: '0600', evidence: 'parent-fstat-and-owned-path-identity' }));
      }
      const args = number === 1 ? [reportPath, nonce] : ['-D', `ALLOW_ROOT=${allowed}`, '-D', `DENY_ROOT=${denied}`,
        '-D', `CANARY_EXECUTABLE=${binary}`, '-f', path.join(control, 'candidate.sb'), binary, reportPath, nonce];
      stage = `target-${number}-execution`;
      const returned = await execute(`target-${number}`, { executable: number === 1 ? binary : toolchain.sandbox,
        args, cwd: state, environment, stdio, timeoutMs: 5000 });
      stage = `target-${number}-report`; const report = decodeReport(boundedRead(reportPath, 4096, io), nonce, returned.safe.pid);
      result.targets[number - 1] = { state: 'reported', report };
      stage = `target-${number}-inventory`; inventory(allowed, budget, io);
      stage = `target-${number}-control-check`;
      if (number === 1 && !report.slice(1, 4).every(item => item.fstat.ok && item.fstat.kind === 'socket' && item.fcntl.ok)) fail();
    }
    result.measurementComplete = true;
  } catch (error) { result.measurementComplete = false; result.failure = 'stage-preparation-execution-or-report-unavailable';
    result.failureStage = stage; result.failureCheck = compilerFailureCode(error); }
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
