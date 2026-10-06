// Exactly one compilation and two sequential instances of the same read-only C observer.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { runOwnedCommand } from '../fd-canary/command.mjs';
import { compilerInventory, compilerFailureCode } from '../fd-canary/report.mjs';

export const bounds = Object.freeze({ totalMs: 30000, latestCompileMs: 6000, latestHelperMs: 22000,
  totalBytes: 2097152, preparedBytes: 262144, archiveBytes: 131072, receiptBytes: 32768, outerBytes: 8192 });
const sha = value => createHash('sha256').update(value).digest('hex');
const json = value => Buffer.from(`${JSON.stringify(value)}\n`);
const identity = stat => ({ dev: stat.dev, ino: stat.ino });
const same = (stat, expected) => expected && !stat.isSymbolicLink() && stat.dev === expected.dev && stat.ino === expected.ino;
const fail = () => { throw Error('Fixed pagesize observation unavailable'); };
const integer = (value, min = 0, max = Number.MAX_SAFE_INTEGER) => assert.ok(Number.isSafeInteger(value) && value >= min && value <= max);
const exact = (value, keys) => assert.deepEqual(Object.keys(value).sort(), [...keys].sort());

export function decodePagesizeReport(bytes, nonce, pid) {
  assert.ok(Buffer.isBuffer(bytes) && bytes.length > 0 && bytes.length < 2048 && bytes.at(-1) === 10);
  assert.match(nonce, /^[0-9a-f]{32}$/); integer(pid, 1, 2147483647);
  const value = JSON.parse(bytes.toString('utf8'));
  exact(value, ['protocol', 'nonce', 'pid', 'sysconf', 'getpagesize', 'sysctl', 'pthread', 'complete']);
  assert.equal(value.protocol, 'flow.pagesize.v1'); assert.equal(value.nonce, nonce); assert.equal(value.pid, pid); assert.equal(value.complete, true);
  for (const name of ['sysconf', 'getpagesize']) {
    exact(value[name], ['value', 'errno']); integer(value[name].value, -1); integer(value[name].errno, 0, 2147483647);
    // A nonzero errno following a positive result is not an API failure contract.
  }
  const direct = value.sysctl; exact(direct, ['result', 'value', 'length', 'expectedLength', 'errno']);
  assert.ok(direct.result === 0 || direct.result === -1); integer(direct.length, 0, 2147483647);
  assert.equal(direct.expectedLength, 4); integer(direct.errno, 0, 2147483647);
  if (direct.result === 0 && direct.length === 4) integer(direct.value, -2147483648, 2147483647);
  else assert.equal(direct.value, null);
  if (direct.result === -1) assert.ok(direct.errno > 0);
  exact(value.pthread, ['stackSize', 'stackSizeErrno', 'stackAddressPresent', 'stackAddressErrno']);
  integer(value.pthread.stackSize); integer(value.pthread.stackSizeErrno, 0, 2147483647);
  integer(value.pthread.stackAddressErrno, 0, 2147483647); assert.equal(typeof value.pthread.stackAddressPresent, 'boolean');
  return value;
}

const closed = safe => safe.closeObserved === true && safe.groupGone === true;
const healthy = safe => closed(safe) && safe.reason === 'completed' && safe.code === 0 && safe.signal === null
  && !safe.observationFailed && (safe.streams === null || Object.values(safe.streams).every(stream =>
    stream.streamEnded && stream.childCloseObserved && !stream.incomplete && !stream.truncated && !stream.observerFailed));

/** Input verification is performed by the inert entry. now() is milliseconds since host startup, not a per-stage clock. */
export async function runPagesize({ sourceDirectory, evidenceDirectory, toolchain, preparedBytes, initialReceiptBytes = 0 },
  { io = fs, now = () => performance.now(), command = runOwnedCommand, rootBase = '/private/tmp' } = {}) {
  const roots = [], descriptors = [], measured = new Map();
  const output = { preparedBytes, observedBytes: 0, diskBytes: 0, receiptBytes: initialReceiptBytes };
  const result = { compileCalls: 0, helperCalls: 0, stages: [], targets: [{ arm: 'a', state: 'NOT_RUN' }, { arm: 'b', state: 'NOT_RUN' }],
    roots, descriptors, compilerCommands: null, compilerOutputAccounting: 'unknown', measurementComplete: false,
    processCleanupComplete: true, rootCleanupComplete: false, retainedRootsComplete: true, retainedRoots: [],
    outputAccountingComplete: false, resultPersisted: false, withinBudget: false,
    unobservedFilesystemWriteDeletePeak: 'unknown', observedScope: 'received compiler streams and closed owned filesystem samples', output };
  let stage = 'reservation', writersClosed = true, inventoryComplete = false, descriptorsClosed = true, diagnosticCopyComplete = true;
  const knownBytes = () => output.preparedBytes + output.observedBytes + output.diskBytes + output.receiptBytes;
  const fits = extra => output.preparedBytes + output.observedBytes + output.diskBytes + extra
    + bounds.receiptBytes + bounds.outerBytes + bounds.archiveBytes <= bounds.totalBytes && output.receiptBytes <= bounds.receiptBytes;
  const recordDisk = (file, size) => {
    if (!Number.isSafeInteger(size) || size < 0) fail();
    const previous = measured.get(file) ?? 0;
    if (size > previous) { output.diskBytes += size - previous; measured.set(file, size); }
    if (!fits(0)) fail();
  };
  function write(file, bytes, category = 'disk') {
    if (!Buffer.isBuffer(bytes)) bytes = json(bytes);
    if (bytes.length > 65536 || !fits(bytes.length) || category === 'receipt' && output.receiptBytes + bytes.length > bounds.receiptBytes) fail();
    const record = { file, owned: false, identity: null, bytes: 0, closed: true, flushed: false, identityConfirmed: false };
    descriptors.push(record); let fd;
    try {
      fd = io.openSync(file, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW, 0o600);
      record.owned = true; record.closed = false;
      const stat = io.fstatSync(fd); record.identity = identity(stat);
      if (fd < 3 || !stat.isFile() || (stat.mode & 0o777) !== 0o600) fail();
      while (record.bytes < bytes.length) {
        const n = io.writeSync(fd, bytes, record.bytes, bytes.length - record.bytes);
        if (!Number.isSafeInteger(n) || n < 1 || n > bytes.length - record.bytes) fail();
        record.bytes += n;
        if (category === 'receipt') { output.receiptBytes += n; if (!fits(0)) fail(); }
        else recordDisk(file, record.bytes);
      }
      io.fsyncSync(fd); record.flushed = true;
    } finally {
      if (fd !== undefined) try { io.closeSync(fd); record.closed = true; } catch { descriptorsClosed = false; }
      record.sha256 = sha(bytes.subarray(0, record.bytes));
    }
    const named = io.lstatSync(file);
    record.identityConfirmed = same(named, record.identity) && named.isFile() && named.size === record.bytes && (named.mode & 0o777) === 0o600;
    if (!record.closed || !record.flushed || !record.identityConfirmed) fail();
    return record;
  }
  function read(file, maximum) {
    const named = io.lstatSync(file);
    if (!named.isFile() || named.isSymbolicLink() || named.size > maximum) fail();
    const fd = io.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
    const record = { file, owned: false, identity: null, closed: false, read: true }; descriptors.push(record);
    try {
      const stat = io.fstatSync(fd); record.identity = identity(stat);
      if (!same(stat, identity(named)) || !stat.isFile() || stat.size !== named.size) fail();
      const bytes = Buffer.alloc(named.size + 1); const n = io.readSync(fd, bytes, 0, bytes.length, 0);
      if (n !== named.size) fail(); return bytes.subarray(0, n);
    } finally {
      try { io.closeSync(fd); record.closed = true; descriptors.splice(descriptors.indexOf(record), 1); }
      catch { descriptorsClosed = false; fail(); }
    }
  }
  function makeRoot(kind) {
    const created = io.mkdtempSync(path.join(rootBase, `flow-pagesize-${kind}-`));
    const root = { path: created, identity: null, removed: false }; roots.push(root);
    const stat = io.lstatSync(created); root.identity = identity(stat);
    if (!stat.isDirectory() || stat.isSymbolicLink() || io.realpathSync(created) !== created) fail();
    io.chmodSync(created, 0o700); return created;
  }
  function inventory() {
    if (!writersClosed) fail();
    const files = []; let entries = 0, logical = 0, allocated = 0;
    const visit = (file, depth) => {
      if (++entries > 128 || depth > 8 || now() >= 28000) fail();
      const before = io.lstatSync(file);
      if (before.isSymbolicLink() || !before.isDirectory() && !before.isFile()) fail();
      logical += before.size; allocated += before.blocks * 512;
      recordDisk(file, before.size);
      if (!Number.isSafeInteger(allocated) || logical > bounds.totalBytes || allocated > bounds.totalBytes) fail();
      if (before.isFile()) { files.push({ path: file, bytes: before.size, sha256: sha(read(file, bounds.totalBytes)), identity: identity(before) }); return; }
      let directory;
      try {
        directory = io.opendirSync(file, { bufferSize: 1, recursive: false });
        if (!same(io.lstatSync(file), identity(before))) fail();
        for (;;) { const entry = directory.readSync(); if (!entry) break; visit(path.join(file, entry.name), depth + 1); }
      } finally { directory?.closeSync(); }
      if (!same(io.lstatSync(file), identity(before))) fail();
    };
    for (const root of roots) {
      const stat = io.lstatSync(root.path); if (!stat.isDirectory() || !same(stat, root.identity)) fail();
      visit(root.path, 0);
    }
    result.lastInventory = { entries, logicalBytes: logical, allocatedBytes: allocated };
    inventoryComplete = true; return files;
  }
  function regular(file) {
    const fd = io.openSync(file, fs.constants.O_RDWR | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW, 0o600);
    const record = { file, fd, owned: true, identity: null, closed: false, stdio: true }; descriptors.push(record);
    const stat = io.fstatSync(fd); record.identity = identity(stat);
    if (fd < 3 || !stat.isFile() || (stat.mode & 0o777) !== 0o600 || !same(io.lstatSync(file), record.identity)) fail();
    return record;
  }
  async function execute(kind, options) {
    if (now() >= (kind === 'compile' ? bounds.latestCompileMs : bounds.latestHelperMs)) fail();
    write(path.join(evidenceDirectory, `slot-${kind}.json`), { consumed: true, kind, elapsedMs: now() }, 'receipt');
    if (kind === 'compile') { if (result.compileCalls !== 0) fail(); result.compileCalls++; }
    else { if (result.helperCalls >= 2) fail(); result.helperCalls++; }
    writersClosed = false; inventoryComplete = false;
    const returned = await command(options, { consume() {}, observe(length) { output.observedBytes += length; if (!fits(0)) fail(); } });
    writersClosed = closed(returned.safe); result.processCleanupComplete = writersClosed;
    result.stages.push({ kind, ...returned.safe, stdoutCapturedBytes: returned.stdout.length, stderrCapturedBytes: returned.stderr.length,
      stdoutSha256: sha(returned.stdout), stderrSha256: sha(returned.stderr) });
    return returned;
  }
  try {
    if (!Number.isSafeInteger(preparedBytes) || preparedBytes < 0 || preparedBytes > bounds.preparedBytes || !fits(0)) fail();
    write(path.join(evidenceDirectory, 'batch-reservation.json'), { consumed: true, compile: 1, helpers: 2, totalMs: bounds.totalMs }, 'receipt');
    stage = 'owned-preparation'; const allow = makeRoot('allow'), deny = makeRoot('deny');
    const control = path.join(allow, 'control'), state = path.join(allow, 'state');
    for (const relative of ['control', 'state', 'state/compile', 'state/compile/home', 'state/compile/tmp',
      'state/a', 'state/a/home', 'state/a/tmp', 'state/b', 'state/b/home', 'state/b/tmp']) io.mkdirSync(path.join(allow, relative), { mode: 0o700 });
    for (const file of ['pagesize.c', 'baseline.sb', 'pagesize.sb']) write(path.join(control, file), read(path.join(sourceDirectory, file), 32768));
    const environment = arm => ({ PATH: '/usr/bin:/bin', HOME: path.join(state, arm, 'home'), TMPDIR: path.join(state, arm, 'tmp'), LANG: 'C', LC_ALL: 'C', TZ: 'UTC' });
    inventory(); const binary = path.join(control, 'pagesize'); stage = 'compile';
    const compiled = await execute('compile', { executable: toolchain.clang, cwd: control, environment: environment('compile'), stdio: 'pipe', timeoutMs: 12000,
      args: ['-v', '-fno-integrated-cc1', '-save-temps=obj', '-std=c11', '-D_DARWIN_C_SOURCE', '-O0', '-Wall', '-Wextra', '-Werror', '-fno-modules',
        '-isysroot', toolchain.sdk, '-arch', 'arm64', '-mmacosx-version-min=15.0', path.join(control, 'pagesize.c'), '-o', binary] });
    stage = 'compiler-stream-persistence'; diagnosticCopyComplete = false;
    write(path.join(evidenceDirectory, 'compiler.stdout'), compiled.stdout); write(path.join(evidenceDirectory, 'compiler.stderr'), compiled.stderr); diagnosticCopyComplete = true;
    if (!writersClosed) fail();
    stage = 'compiler-inventory'; const artifacts = inventory();
    result.compilerCommands = compilerInventory(compiled.stderr, control, artifacts, toolchain.clang, toolchain.linker);
    result.compilerOutputAccounting = 'visible-owned-files-and-verbose-outputs';
    write(path.join(evidenceDirectory, 'compiler-inventory.json'), { commands: result.compilerCommands, artifacts }, 'receipt');
    stage = 'compiler-health'; if (!healthy(compiled.safe)) fail();
    const executable = artifacts.find(item => item.path === binary);
    if (!executable || executable.bytes < 1 || executable.bytes > 262144) fail(); result.binary = executable;
    for (const [index, arm, policy] of [[0, 'a', 'baseline.sb'], [1, 'b', 'pagesize.sb']]) {
      stage = `helper-${arm}`; const nonce = randomBytes(16).toString('hex'), directory = path.join(state, arm), reportFile = path.join(directory, 'report.json');
      const stdio = [0, 1, 2].map(fd => regular(path.join(directory, `stdio-${fd}.file`)));
      if (new Set(stdio.map(item => item.fd)).size !== 3) fail();
      result.targets[index] = { arm, state: 'ATTEMPTED', nonce, parentRegularStdio: stdio.map(item => ({ file: item.file, identity: item.identity })) };
      const observed = await execute(arm, { executable: toolchain.sandbox, args: ['-D', `ALLOW_ROOT=${allow}`, '-D', `DENY_ROOT=${deny}`,
        '-D', `CANARY_EXECUTABLE=${binary}`, '-f', path.join(control, policy), binary, reportFile, nonce],
        cwd: directory, environment: environment(arm), stdio: stdio.map(item => item.fd), timeoutMs: 4000 });
      for (const item of stdio) { try { io.closeSync(item.fd); item.closed = true; } catch { descriptorsClosed = false; } item.closeAttempted = true; }
      if (!writersClosed || !descriptorsClosed) fail();
      inventory(); // No target is alive while its directories or regular stdio are read.
      for (const [name, item] of [['stdout', stdio[1]], ['stderr', stdio[2]]]) {
        if (!same(io.lstatSync(item.file), item.identity)) fail();
        const bytes = read(item.file, 8192); output.observedBytes += bytes.length; if (!fits(0)) fail();
        result.targets[index][`${name}Bytes`] = bytes.length;
        if (name === 'stderr') {
          diagnosticCopyComplete = false; write(path.join(evidenceDirectory, `helper-${arm}.stderr`), bytes); diagnosticCopyComplete = true;
        }
      }
      if (!healthy(observed.safe)) fail();
      result.targets[index].report = decodePagesizeReport(read(reportFile, 2048), nonce, observed.safe.pid);
      result.targets[index].state = 'REPORTED';
    }
    result.measurementComplete = true;
  } catch (error) { result.failureStage = stage; result.failureCheck = compilerFailureCode(error); }
  finally {
    for (const item of descriptors) if (item.stdio && !item.closeAttempted) {
      item.closeAttempted = true; try { io.closeSync(item.fd); item.closed = true; } catch { descriptorsClosed = false; }
    }
    result.processCleanupComplete = writersClosed;
    descriptorsClosed &&= descriptors.every(item => item.closed);
    if (writersClosed && descriptorsClosed && diagnosticCopyComplete) try {
      inventory();
      for (const root of roots) { if (!same(io.lstatSync(root.path), root.identity)) fail(); io.rmSync(root.path, { recursive: true });
        try { io.lstatSync(root.path); fail(); } catch (error) { if (error?.code !== 'ENOENT') throw error; } root.removed = true; }
    } catch { inventoryComplete = false; }
    result.retainedRoots = roots.filter(root => !root.removed).map(root => ({ path: root.path, identity: root.identity }));
    result.rootCleanupComplete = writersClosed && descriptorsClosed && diagnosticCopyComplete && result.retainedRoots.length === 0;
  }
  result.outputAccountingComplete = writersClosed && descriptorsClosed && inventoryComplete
    && (result.compileCalls === 0 || result.compilerOutputAccounting === 'visible-owned-files-and-verbose-outputs');
  result.elapsedBeforePersistenceMs = now();
  try { write(path.join(evidenceDirectory, 'batch-result.json'), result, 'receipt'); result.resultPersisted = true; }
  catch { result.resultPersisted = false; result.outputAccountingComplete = false; }
  result.finalElapsedMs = now(); result.knownBytes = knownBytes();
  result.withinBudget = result.outputAccountingComplete && fits(0) && result.finalElapsedMs <= bounds.totalMs;
  return result;
}
