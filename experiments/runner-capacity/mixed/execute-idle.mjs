import { spawn } from 'node:child_process';
import { lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, statfsSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { IDLE_LIMITS, idleBudget, sampleIdleRoot, verifyIdleInputs } from './idle-claim-budget.ts';

// One specific experiment owner, not a reusable process supervisor. The shell records complete Node start→exit separately.
const started = Date.now(), clock = performance.now();
const now = () => started + Math.ceil(performance.now() - clock);
const worktree = resolve(fileURLToPath(new URL('../../..', import.meta.url)));
const evidence = join(worktree, 'docs/evidence/s01/idle-claim-cost');
const output = join(evidence, 'run');
const vitest = '/Users/citrine/Projects/AgentHarness/Flow/node_modules/vitest/vitest.mjs';
const faults = new Set();
let root, rootIdentity, child, closeObserved = false, groupGone = false, reserved = false, cleanupComplete = false;
let exitCode = null, signal = null, inputBytes = 0, peakOwnBytes = 0, captureBytes = 0, journalWriteBytes = 0;
let inputManifestSha256, internal, observerTimer, termTimer, killTimer;
let finalRootSample = null;
let caseReceiptConfirmed = false;
let archiveAccountingKnown = false, manualArchiveObservedBytes = null;
const chunks = [];
const fault = code => { if (faults.size < 24) faults.add(code); };
const excessCaptureBytes = () => Math.max(0, captureBytes - IDLE_LIMITS.captureBytes);
function manualArchiveBytes() {
  archiveAccountingKnown = false;
  const ledger = JSON.parse(readFileSync(join(evidence, 'archive-ledger-v3.json'), 'utf8'));
  if (!Array.isArray(ledger.paths) || ledger.paths.length > 24) throw Error('ARCHIVE_LEDGER');
  let bytes = 0;
  for (const path of ledger.paths) {
    if (typeof path !== 'string' || path.includes('..') || !(path.startsWith('docs/evidence/s01/idle-claim-cost/')
      || path === 'plans/s01-runner-capacity/status.md' || path === 'plans/s01-runner-capacity/review.md' || path === 'plans/s01-runner-capacity/plan.md')) throw Error('ARCHIVE_PATH');
    try { const stat = lstatSync(join(worktree, path)); if (!stat.isFile()) throw Error('ARCHIVE_TYPE'); bytes += stat.size; }
    catch (error) { if (error?.code !== 'ENOENT') throw error; }
  }
  manualArchiveObservedBytes = bytes;
  if (bytes > IDLE_LIMITS.manualArchiveBytes) throw Error('MANUAL_ARCHIVE_LIMIT');
  archiveAccountingKnown = true;
  return bytes;
}
function groupState() {
  if (!child?.pid) return closeObserved ? 'gone' : 'unknown';
  try { process.kill(-child.pid, 0); return 'live'; }
  catch (error) { return error?.code === 'ESRCH' ? 'gone' : 'unknown'; }
}
function stopGroup(kind) {
  if (!child) return;
  const state = groupState();
  if (state === 'gone') return;
  if (state !== 'live') { fault('GROUP_IDENTITY_UNKNOWN'); return; }
  try { process.kill(-child.pid, kind); } catch (error) { if (error?.code !== 'ESRCH') fault('GROUP_SIGNAL_UNKNOWN'); }
}
function sample() {
  if (!root) return null;
  try {
    const identity = lstatSync(root);
    if (identity.dev !== rootIdentity.dev || identity.ino !== rootIdentity.ino || !identity.isDirectory() || identity.isSymbolicLink()) throw Error('ROOT_CHANGED');
    const snapshot = sampleIdleRoot(root); peakOwnBytes = Math.max(peakOwnBytes, snapshot.chargedBytes);
    // Production randomUUID/empty assignments are tiny; a 4KiB reserve is also checked against actual API input afterwards.
    if (!idleBudget(inputBytes + excessCaptureBytes(), peakOwnBytes, 4096, now(), started).withinTotal) { fault('BYTE_OR_TIME_LIMIT'); stopGroup('SIGTERM'); return null; }
    return { dev: identity.dev, ino: identity.ino, sampledAtMs: now() - started, ...snapshot };
  } catch { fault('OWN_INVENTORY_UNKNOWN'); stopGroup('SIGTERM'); return null; }
}
function pause(ms) { return new Promise(resolvePause => setTimeout(resolvePause, ms)); }
try {
  if (process.env.FLOW_S01_IDLE_WINDOW !== 's01-idle-claim-cost-once' || process.env.FLOW_S01_IDLE_OPEN !== '1'
    || !/^[a-f0-9]{40}$/.test(process.env.FLOW_S01_IDLE_EXECUTION_HEAD ?? '')
    || process.versions.node !== '24.20.0' || realpathSync(process.execPath) !== '/opt/homebrew/Cellar/node@24/24.20.0/bin/node'
    || process.env.NODE_DISABLE_COMPILE_CACHE !== '1' || process.env.NODE_COMPILE_CACHE) throw Error('ENTRY_NOT_OPEN');
  const inputs = verifyIdleInputs(worktree, join(evidence, 'fixed-input-v3.json'), process.env.FLOW_S01_IDLE_INPUT_SHA256);
  inputBytes = inputs.inputBytes; inputManifestSha256 = inputs.manifestSha256;
  if (inputs.manifestSha256 !== process.env.FLOW_S01_IDLE_INPUT_SHA256) throw Error('INPUT_IDENTITY');
  manualArchiveBytes();
  const installed = JSON.parse(readFileSync(join(resolve(realpathSync(vitest), '..'), 'package.json'), 'utf8'));
  if (installed.version !== '4.0.18') throw Error('VITEST_VERSION');
  const space = statfsSync(tmpdir());
  if (space.bavail * space.bsize < 1107296256) throw Error('RESOURCE_NOT_RUN');
  if (!idleBudget(inputBytes, 0, 4096, now(), started).workAllowed) throw Error('PREPARATION_LIMIT');
  mkdirSync(output, { mode: 0o700 }); reserved = true; // No existing result is reused or overwritten.
  writeFileSync(join(output, 'reservation.json'), JSON.stringify({ started, window: 's01-idle-claim-cost-once', inputManifestSha256 }) + '\n', { flag: 'wx', mode: 0o600 });
  root = mkdtempSync(join(tmpdir(), 'flow-s01-idle-')); rootIdentity = lstatSync(root);
  writeFileSync(join(output, 'owned-root.json'), JSON.stringify({ root, dev: rootIdentity.dev, ino: rootIdentity.ino }) + '\n', { flag: 'wx', mode: 0o600 });
  sample();
  if (faults.size) throw Error('PREFLIGHT_FAILED');
  // Reservation and inventory are synchronous: recheck the original work deadline after all of them.
  if (!idleBudget(inputBytes, peakOwnBytes, 4096, now(), started).workAllowed) throw Error('PREPARATION_LIMIT');
  child = spawn(process.execPath, [vitest, 'run', '--configLoader', 'native', '--config', 'experiments/runner-capacity/mixed/idle-claim.vitest.config.mjs'], {
    cwd: worktree, detached: true, stdio: ['ignore', 'pipe', 'pipe'],
    env: { PATH: process.env.PATH, TZ: 'UTC', NO_COLOR: '1', NODE_DISABLE_COMPILE_CACHE: '1', TMPDIR: root,
      FLOW_S01_IDLE_MODE: 'actual', FLOW_S01_IDLE_WINDOW: 's01-idle-claim-cost-once', FLOW_S01_IDLE_ROOT: root,
      FLOW_S01_IDLE_STARTED_MS: String(started), FLOW_S01_IDLE_INPUT_SHA256: inputManifestSha256 },
  });
  const closed = new Promise(resolveClose => {
    child.once('error', () => fault('SPAWN_ERROR'));
    child.once('close', (code, reason) => { exitCode = code; signal = reason; closeObserved = true; resolveClose(); });
  });
  const capture = bytes => {
    captureBytes += bytes.length;
    if (captureBytes > IDLE_LIMITS.captureBytes) { fault('CAPTURE_LIMIT'); stopGroup('SIGTERM'); return; }
    chunks.push(Buffer.from(bytes));
  };
  child.stdout.on('data', capture); child.stderr.on('data', capture);
  child.stdout.on('error', () => fault('STDOUT_UNKNOWN')); child.stderr.on('error', () => fault('STDERR_UNKNOWN'));
  observerTimer = setInterval(sample, 100);
  termTimer = setTimeout(() => { fault('CHILD_EXIT_DEADLINE'); stopGroup('SIGTERM'); }, Math.max(0, started + 13000 - now()));
  killTimer = setTimeout(() => { if (!closeObserved || groupState() !== 'gone') { fault('FORCED_CHILD_CLOSE'); stopGroup('SIGKILL'); } }, Math.max(0, started + 14000 - now()));
  while (!closeObserved && now() < started + 14300) await Promise.race([closed, pause(25)]);
  while (groupState() === 'live' && now() < started + 14300) await pause(10);
  groupGone = groupState() === 'gone';
  if (!closeObserved || !groupGone) fault('CHILD_CLOSE_UNKNOWN');
  if (!child.stdout.readableEnded || !child.stderr.readableEnded) fault('CHILD_STDIO_UNKNOWN');
  if (exitCode !== 0 || signal !== null) fault('CHILD_FAILED');
} catch (error) {
  // Only our finite entry codes are disclosed; no original stderr, token, path or Error.message expansion.
  const code = error instanceof Error && /^(ENTRY_NOT_OPEN|INPUT_IDENTITY|VITEST_VERSION|RESOURCE_NOT_RUN|PREPARATION_LIMIT|PREFLIGHT_FAILED)$/.test(error.message) ? error.message : 'ENTRY_OR_INPUT_FAILED';
  fault(code);
} finally {
  for (const timer of [observerTimer, termTimer, killTimer]) if (timer) clearTimeout(timer);
  if (child && (!closeObserved || !groupGone)) {
    stopGroup('SIGKILL'); fault('RETAINED_PROCESS_UNKNOWN');
    // Parent exit is not child-close proof. Preserve PID/root facts instead of waiting past the fixed limit.
    child.stdout.destroy(); child.stderr.destroy(); child.unref();
  }
  if (root && !child) {
    // No child was ever sent an identity: only this owner could have written the fresh root.
    closeObserved = true; groupGone = true;
  }
  const stdioEnded = !child || child.stdout.readableEnded && child.stderr.readableEnded;
  if (root && closeObserved && groupGone && stdioEnded) finalRootSample = sample();
  if (child && finalRootSample) {
    try {
      const path = join(root, 'receipt.json'), info = lstatSync(path);
      if (!info.isFile() || info.size > IDLE_LIMITS.caseReceiptBytes) throw Error('RECEIPT_SIZE');
      const bytes = readFileSync(path); internal = JSON.parse(bytes.toString('utf8'));
      if (internal.windowId !== 's01-idle-claim-cost-once' || internal.inputs?.manifestSha256 !== inputManifestSha256) throw Error('RECEIPT_IDENTITY');
      journalWriteBytes = internal.observer?.writeInputBytes;
      if (!Number.isSafeInteger(journalWriteBytes) || journalWriteBytes < 0 || journalWriteBytes > 4096) throw Error('JOURNAL_ACCOUNTING');
      if (internal.internalBehaviorPassed !== true || internal.finalJournal !== 'EMPTY') fault('INTERNAL_BEHAVIOR_FAILED');
      writeFileSync(join(output, 'case-receipt.json'), bytes, { flag: 'wx', mode: 0o600 });
      caseReceiptConfirmed = internal.internalBehaviorPassed === true && internal.finalJournal === 'EMPTY';
    } catch { fault('CASE_RECEIPT_UNKNOWN'); }
  }
  if (root && closeObserved && groupGone && stdioEnded && finalRootSample
    && (!child || caseReceiptConfirmed && internal?.finalJournal === 'EMPTY')) {
    try {
      const current = lstatSync(root);
      if (current.dev !== rootIdentity.dev || current.ino !== rootIdentity.ino || !current.isDirectory() || current.isSymbolicLink()) throw Error('ROOT_IDENTITY');
      if (now() >= started + 14700) throw Error('CLEANUP_TIME');
      rmSync(root, { recursive: true, force: false, maxRetries: 0 });
      try { lstatSync(root); throw Error('ROOT_REMAINS'); } catch (error) { if (error?.code !== 'ENOENT') throw error; }
      cleanupComplete = true;
    } catch { fault('CLEANUP_UNKNOWN'); }
  } else if (!root) cleanupComplete = true;
  if (reserved) {
    try { writeFileSync(join(output, 'console.log'), Buffer.concat(chunks), { flag: 'wx', mode: 0o600 }); }
    catch { fault('RAW_PERSISTENCE_UNKNOWN'); }
  }
  const computedBudget = idleBudget(inputBytes + excessCaptureBytes(), peakOwnBytes, Number.isSafeInteger(journalWriteBytes) ? Math.max(journalWriteBytes, 4096) : 4096, now(), started);
  const accountingComplete = inputManifestSha256 !== undefined && archiveAccountingKnown && (!root || finalRootSample !== null)
    && (!child || closeObserved && groupGone && stdioEnded && caseReceiptConfirmed);
  const budget = { ...computedBudget, known: computedBudget.known && accountingComplete, withinTotal: computedBudget.withinTotal && accountingComplete };
  if (!budget.withinTotal) fault('FINAL_BUDGET');
  const result = { phase: 'PRE_FINAL_PERSISTENCE_SNAPSHOT', window: 's01-idle-claim-cost-once', preparationSource: process.env.FLOW_S01_IDLE_EXECUTION_HEAD ?? null,
    automaticResult: faults.size === 0 && cleanupComplete ? 'PASS_PENDING_SHELL_EXIT' : 'FAILED_OR_UNKNOWN',
    overallResult: 'PENDING_EXTERNAL_NODE_EXIT_AND_WALL_RECEIPT', faults: [...faults],
    child: { spawnCalled: child !== undefined, pid: child?.pid ?? null, closeObserved, groupGone, exitCode, signal, stdoutEnded: child?.stdout?.readableEnded ?? null, stderrEnded: child?.stderr?.readableEnded ?? null },
    cleanupComplete, finalRootSample, caseReceiptConfirmed, retainedRoots: root && !cleanupComplete ? [root] : [],
    retainedRootIdentities: root && !cleanupComplete ? [{ path: root, dev: rootIdentity?.dev ?? null, ino: rootIdentity?.ino ?? null }] : [],
    budget: { ...budget, inputBytes, peakOwnBytesSampled: peakOwnBytes, capturedBytes: captureBytes, excessCaptureBytes: excessCaptureBytes(), journalWriteBytes, journalReserve: 4096,
      rawReserveBytes: IDLE_LIMITS.rawReserve, internalElapsedMs: now() - started, ownPeakBetweenSamples: 'UNKNOWN' },
    limits: IDLE_LIMITS, fullNodeExitAndShellWall: null };
  let encoded = JSON.stringify(result) + '\n';
  if (Buffer.byteLength(encoded) > IDLE_LIMITS.outerReceiptBytes) { fault('FINAL_RECEIPT_SIZE'); encoded = '{"automaticResult":"UNKNOWN","reason":"FINAL_RECEIPT_SIZE"}\n'; }
  let resultPersisted = false;
  if (reserved) try { writeFileSync(join(output, 'outer-result.json'), encoded, { flag: 'wx', mode: 0o600 }); resultPersisted = true; } catch { fault('FINAL_PERSISTENCE_UNKNOWN'); }
  try {
    if (reserved && sampleIdleRoot(output).logicalBytes > IDLE_LIMITS.automaticRawBytes - IDLE_LIMITS.captureBytes - IDLE_LIMITS.outerReceiptBytes) throw Error('ARCHIVE_RESERVE_EXCEEDED');
    manualArchiveBytes();
    if (now() >= started + IDLE_LIMITS.totalMs) fault('FINAL_TIME');
  } catch { archiveAccountingKnown = false; fault('ARCHIVE_ACCOUNTING_UNKNOWN'); }
  // CLI includes the outcome of the last automatic file write/count. Shell exit is still a separate fact.
  encoded = JSON.stringify({ ...result, phase: 'FINAL_CLI_BEFORE_DELIVERY', faults: [...faults], resultPersisted,
    budget: { ...result.budget, known: budget.known && archiveAccountingKnown, withinTotal: budget.withinTotal && archiveAccountingKnown,
      archiveAccountingKnown, manualArchiveObservedBytes },
    automaticResult: faults.size === 0 && cleanupComplete ? 'PASS_PENDING_SHELL_EXIT' : 'FAILED_OR_UNKNOWN',
    automaticElapsedMs: now() - started }) + '\n';
  if (Buffer.byteLength(encoded) > IDLE_LIMITS.outerReceiptBytes) { fault('FINAL_CLI_SIZE'); encoded = '{"automaticResult":"UNKNOWN","reason":"FINAL_CLI_SIZE"}\n'; }
  process.exitCode = faults.size === 0 && cleanupComplete ? 0 : 1;
  await new Promise(resolveWrite => {
    const timer = setTimeout(() => { process.exitCode = 1; process.stdout.destroy(); resolveWrite(); }, Math.max(0, started + IDLE_LIMITS.totalMs - now()));
    const finish = () => { clearTimeout(timer); resolveWrite(); };
    process.stdout.on('error', () => { process.exitCode = 1; finish(); }); process.stdout.write(encoded, finish);
  });
  if (now() >= started + IDLE_LIMITS.totalMs) process.exitCode = 1;
}
