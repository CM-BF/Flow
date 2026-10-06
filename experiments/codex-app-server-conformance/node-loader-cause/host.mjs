// One fixed loader observation; reuse the existing owned command lifecycle, no protocol loop.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { runOwnedCommand } from '../fd-canary/command.mjs';
import { observeLoader } from './observe.mjs';
const fail = () => { throw Error('Loader observation unavailable'); };
const hash = data => createHash('sha256').update(data).digest('hex');
export function makeCauseBudget(prepared) {
  if (!Number.isSafeInteger(prepared) || prepared < 0 || prepared > 77824) fail();
  const value = { prepared, observed: 0, copied: 0, disk: 0, receipts: 0 };
  const total = () => prepared + value.observed + value.disk + 16384 + 110592 + 4096;
  const add = (name, n) => {
    if (!Number.isSafeInteger(n) || n < 0 || !Object.hasOwn(value, name)) fail();
    value[name] += n; // Count even the first overflow before failing.
    if (total() > 262144 || value.receipts > 16384 || value.disk > 24576) fail();
  };
  return { observe: n => add('observed', n), consume: n => add('copied', n), disk: n => add('disk', n), receipt: n => add('receipts', n),
    reserveDisk(n) { if (value.disk + n > 24576 || total() + n > 262144) fail(); },
    snapshot: () => ({ ...value, reservedBytes: total(), limit: 262144, withinBudget: total() <= 262144 && value.receipts <= 16384 && value.disk <= 24576 }) };
}

export async function runCause({ evidenceDirectory, repository, preparedBytes, roles, initialReceiptBytes = 0 }, dependencies = {}) {
  const io = dependencies.io ?? fs, command = dependencies.command ?? runOwnedCommand;
  const now = dependencies.now ?? (() => performance.now()); const budget = makeCauseBudget(preparedBytes);
  budget.receipt(initialReceiptBytes);
  const roots = [], files = [], descriptors = [], directories = [];
  let allClosed = true, descriptorsClosed = true, inventoryComplete = true, stage = 'reservation';
  const result = { targetCalls: 0, target: 'NOT_RUN', observedAt: new Date().toISOString(),
    hostDifference: 'owned-detached-group; no initialize input; dual-stream observer', streams: [], cleanupComplete: false, outputAccountingComplete: false };
  function persist(file, bytes, privateFile = false) {
    if (privateFile) budget.reserveDisk(bytes.length); else budget.receipt(bytes.length);
    const fd = io.openSync(file, fs.constants.O_RDWR | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW, 0o600);
    const record = { file, identity: null, bytes: 0, hash: null, closed: false, removed: false }; if (privateFile) files.push(record);
    const descriptor = { fd, closed: false }; descriptors.push(descriptor);
    try {
      const stat = io.fstatSync(fd); record.identity = { dev: stat.dev, ino: stat.ino, regular: stat.isFile(), symlink: false };
      if (fd < 3 || !stat.isFile() || (stat.mode & 0o777) !== 0o600) fail();
      let offset = 0;
      // Count successful partial disk writes even if a later write or fsync fails.
      while (offset < bytes.length) { const n = io.writeSync(fd, bytes, offset, bytes.length - offset); if (n <= 0) fail(); offset += n; record.bytes += n; if (privateFile) budget.disk(n); }
      io.fsyncSync(fd); record.hash = hash(bytes);
      const after = io.lstatSync(file); if (after.isSymbolicLink() || after.ino !== stat.ino || after.dev !== stat.dev || after.size !== bytes.length) fail();
    } finally {
      try { io.closeSync(fd); descriptor.closed = true; record.closed = true; } catch { descriptorsClosed = false; }
    }
    if (!record.closed) fail(); return record;
  }
  const receipt = (name, value) => persist(path.join(evidenceDirectory, name), Buffer.from(`${JSON.stringify(value)}\n`));
  function root(prefix) {
    const directory = io.mkdtempSync(prefix), record = { directory, identity: null, prepared: false }; roots.push(record);
    const stat = io.lstatSync(directory); if (!stat.isDirectory() || stat.isSymbolicLink()) fail();
    record.identity = { ino: stat.ino, dev: stat.dev }; io.chmodSync(directory, 0o700); record.prepared = true; return directory;
  }
  receipt('batch-reservation.json', { consumed: true, window: 'go-node-loader-cause-once', maxTargets: 1, totalMs: 30000 });
  try {
    stage = 'prepare'; if (now() >= 20000) fail();
    const allowed = root('/private/tmp/flow-wpf02-cause-allow-'), denied = root('/private/tmp/flow-wpf02-cause-deny-');
    const control = path.join(allowed, 'control'), state = path.join(allowed, 'state');
    for (const directory of [control, state, ...['home', 'codex', 'tmp'].map(x => path.join(state, x))]) {
      io.mkdirSync(directory, { mode: 0o700 }); const row = { directory, identity: null }; directories.push(row);
      const stat = io.lstatSync(directory); row.identity = { ino: stat.ino, dev: stat.dev };
    }
    for (const [from, name] of [['node-rootliteral/candidate.sb', 'default-deny.sb'], ['diagnostics/immediate-exit.mjs', 'immediate-exit.mjs']]) {
      const bytes = io.readFileSync(path.join(repository, 'experiments/codex-app-server-conformance', from));
      persist(path.join(control, name), bytes, true); io.chmodSync(path.join(control, name), 0o400);
    }
    const executable = '/opt/homebrew/Cellar/node@24/24.20.0/bin/node';
    const options = { executable: '/usr/bin/sandbox-exec', args: ['-D', `ALLOW_ROOT=${allowed}`, '-D', `DENY_ROOT=${denied}`,
      '-f', path.join(control, 'default-deny.sb'), executable, '--jitless', '--no-addons', path.join(control, 'immediate-exit.mjs')],
      cwd: state, environment: { PATH: '/usr/bin:/bin', HOME: path.join(state, 'home'), CODEX_HOME: path.join(state, 'codex'), TMPDIR: path.join(state, 'tmp'), LANG: 'C', LC_ALL: 'C', TZ: 'UTC' },
      stdio: 'pipe', captureMaxBytes: 8192, timeoutMs: Math.min(8000, 20000 - now()) };
    if (options.timeoutMs <= 0) fail();
    receipt('target-reservation.json', { consumed: true, commandSha256: hash(Buffer.from(JSON.stringify(options))), elapsedMs: now() });
    stage = 'target'; result.targetCalls = 1; result.target = 'ATTEMPTED'; allClosed = false;
    const returned = await command(options, budget); result.close = returned.safe;
    allClosed = returned.safe.closeObserved === true && returned.safe.groupGone === true;
    result.target = allClosed ? 'CLOSED' : 'UNKNOWN';
    stage = 'capture';
    for (const name of ['stdout', 'stderr']) {
      const bytes = returned[name]; if (!Buffer.isBuffer(bytes) || bytes.length > 8192) fail();
      const saved = persist(path.join(allowed, `${name}.raw`), bytes, true), stream = returned.safe.streams?.[name];
      const complete = allClosed && !returned.safe.observationFailed && stream?.streamEnded && stream.childCloseObserved
        && !stream.incomplete && !stream.truncated && !stream.observerFailed && stream.observedBytes === bytes.length && stream.writtenBytes === bytes.length;
      result.streams.push({ name, bytes: saved.bytes, sha256: saved.hash, complete: Boolean(complete), mode: '0600', identity: saved.identity });
      if (name === 'stderr') result.observation = observeLoader(bytes, roles, complete);
    }
    const observed = Object.values(returned.safe.streams ?? {}).reduce((n, s) => n + s.observedBytes, 0);
    result.outputAccountingComplete = result.streams.length === 2 && result.streams.every(x => x.complete) && observed === budget.snapshot().observed;
    result.observationComplete = result.outputAccountingComplete && returned.safe.reason === 'completed' && result.observation.errorClass !== 'UNKNOWN';
  } catch { result.failedStage = stage; } finally {
    stage = 'cleanup'; result.retainedRoots = roots.map(x => x.directory);
    // Exact owned tree inventory precedes deletion; unknown child or any unexpected entry retains roots.
    try {
      if (!allClosed || !descriptorsClosed || descriptors.some(x => !x.closed)) fail();
      const knownFiles = new Set(files.map(x => x.file)); let entries = 0;
      function verify(directory, depth) {
        if (depth > 3) fail();
        for (const name of io.readdirSync(directory)) {
          if (++entries > 32) fail(); const file = path.join(directory, name), stat = io.lstatSync(file);
          if (stat.isSymbolicLink()) fail();
          if (stat.isDirectory()) { const owned = directories.find(x => x.directory === file);
            if (!owned?.identity || owned.identity.ino !== stat.ino || owned.identity.dev !== stat.dev) fail(); verify(file, depth + 1); }
          else { const owned = files.find(x => x.file === file); if (!knownFiles.has(file) || !owned?.closed || !owned.identity || stat.ino !== owned.identity.ino || stat.dev !== owned.identity.dev || stat.size !== owned.bytes) fail(); }
        }
      }
      for (const record of roots) {
        const stat = io.lstatSync(record.directory);
        if (!record.prepared || !record.identity || stat.isSymbolicLink() || stat.ino !== record.identity.ino || stat.dev !== record.identity.dev) fail();
        verify(record.directory, 0);
      }
      for (const record of roots) io.rmSync(record.directory, { recursive: true });
      for (const file of files) file.removed = true;
      result.retainedRoots = []; result.cleanupComplete = true;
    } catch { inventoryComplete = false; }
    result.outputAccountingComplete &&= inventoryComplete;
    result.inventoryComplete = inventoryComplete; result.descriptorsClosed = descriptorsClosed;
    result.privateFiles = files.map(({ file, identity, bytes, hash, closed, removed }) => ({ file, identity, bytes, sha256: hash, closed, removed }));
    result.elapsedMs = now(); result.elapsedBasis = 'before-result-persistence'; result.output = budget.snapshot();
    result.withinBudget = result.outputAccountingComplete && result.output.withinBudget && now() <= 30000;
    receipt('batch-result.json', result); result.resultPersisted = true;
    result.output = budget.snapshot(); result.finalElapsedMs = now(); result.withinBudget &&= now() <= 30000;
  }
  return result;
}
