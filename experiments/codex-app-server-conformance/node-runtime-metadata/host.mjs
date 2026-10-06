// Two fixed consumers, one shared clock. Each existing Module retains its own resources.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { runCause, isExpectedControl } from '../node-loader-cause/host.mjs';
import { runNodeRootliteralBatch } from '../node-rootliteral/host.mjs';
import { durableCreate } from '../diagnostics/run-diagnostics.mjs';

const fail = () => { throw Error('Runtime metadata observation unavailable'); };
const amount = value => { if (!Number.isSafeInteger(value) || value < 0) fail(); return value; };
export async function runRuntimeMetadataBatch({ repository, evidenceDirectory, preparedBytes, roles, peerBytes, initialReceiptBytes = 0 }, dependencies = {}) {
  if (amount(preparedBytes) > 524288) fail();
  const now = dependencies.now ?? (() => performance.now());
  const control = dependencies.control ?? runCause, canary = dependencies.canary ?? runNodeRootliteralBatch;
  let ownReceipts = amount(initialReceiptBytes), controlResult, canaryResult, canaryInitialReceipts = 0, unattributedReceiptBytes = 0;
  let cleanupConfirmed = true, ownerPending = null;
  const result = { window: 'go-node-runtime-metadata-once', startedAt: new Date(performance.timeOrigin).toISOString(),
    targets: ['NOT_RUN', 'NOT_RUN'], targetCalls: 0, compileCalls: 0, codexStarts: 0, providerCalls: 0, retainedRoots: [] };
  function output() {
    const c = controlResult?.output, n = canaryResult?.output;
    const counts = { prepared: preparedBytes, controlObserved: amount(c?.observed ?? 0), controlDisk: amount(c?.disk ?? 0),
      canaryStderrObserved: amount(n?.captured ?? 0), canaryDisk: amount(n?.diskCopies ?? 0),
      canaryStdoutSourceUpperBound: n && canaryResult.stdoutBoundsConfirmed !== true ? null : amount(n?.stdoutSourceUpperBound ?? 0),
      receipts: ownReceipts + amount(c?.receipts ?? 0) + amount((n?.receipts ?? canaryInitialReceipts) - canaryInitialReceipts) + unattributedReceiptBytes };
    const knownBytes = Object.values(counts).reduce((a, b) => a + (b ?? 0), 0);
    const unqualifiedStdoutReserveBytes = n && canaryResult.stdoutBoundsConfirmed !== true ? amount(n.stdoutSourceUpperBound) : 0;
    return { ...counts, knownBytes, unqualifiedStdoutReserveBytes, reservedBytes: knownBytes - counts.receipts + unqualifiedStdoutReserveBytes + 32768 + 131072 + 8192,
      receiptReserveBytes: 32768, archiveReserveBytes: 131072, outerReserveBytes: 8192, limit: 2097152 };
  }
  function persist(name, value) {
    ownReceipts += Buffer.byteLength(`${JSON.stringify(value, null, 2)}\n`);
    const count = output(); if (count.receipts > 32768 || count.reservedBytes > 2097152) fail();
    durableCreate(path.join(evidenceDirectory, name), value);
  }
  persist('batch-reservation.json', { consumed: true, window: result.window, maxTargets: 2, totalMs: 60000 });
  try {
    if (now() >= 20000) fail();
    const directory = path.join(evidenceDirectory, 'control'); fs.mkdirSync(directory, { mode: 0o700 });
    ownerPending = 'control'; cleanupConfirmed = false; result.targets[0] = 'UNKNOWN';
    controlResult = await control({ repository, evidenceDirectory: directory, preparedBytes: 0, roles, recipe: 'runtime-metadata-control' },
      { ...dependencies.controlDependencies, now });
    ownerPending = null; cleanupConfirmed = controlResult.cleanupComplete === true;
    result.targetCalls += amount(controlResult.targetCalls);
    result.targets[0] = isExpectedControl(controlResult) ? 'EXPECTED' : controlResult.targetCalls === 0 ? 'NOT_RUN' : controlResult.target === 'CLOSED' ? 'FAILED' : 'UNKNOWN';
    result.control = { state: result.targets[0], close: controlResult.close, streams: controlResult.streams,
      observation: controlResult.observation, cleanupComplete: cleanupConfirmed, outputAccountingComplete: controlResult.outputAccountingComplete };
    result.retainedRoots.push(...(controlResult.retainedRoots ?? []));
    if (result.targets[0] !== 'EXPECTED') { result.stopReason = 'control-failed-or-unknown'; return result; }
    const count = output();
    if (now() >= 45000 || count.reservedBytes + 3 * 65536 + 182 > 2097152) fail();
    const canaryDirectory = path.join(evidenceDirectory, 'canary'); fs.mkdirSync(canaryDirectory, { mode: 0o700 });
    canaryInitialReceipts = count.receipts;
    ownerPending = 'canary'; cleanupConfirmed = false; result.targets[1] = 'UNKNOWN';
    canaryResult = await canary({ evidenceDirectory: canaryDirectory, peerBytes,
      preparedEvidenceBytes: preparedBytes + count.controlObserved + count.controlDisk + 8192,
      recipe: 'runtime-metadata-canary-only', roles }, { ...dependencies.canaryDependencies, now, start: 0,
      startedAt: result.startedAt, initialReceiptBytes: canaryInitialReceipts });
    ownerPending = null; cleanupConfirmed = canaryResult.cleanupComplete === true;
    result.targetCalls += amount(canaryResult.factoryCalls);
    result.targets[1] = canaryResult.targets?.[0] ?? 'UNKNOWN';
    result.canary = { state: result.targets[1], measurementComplete: canaryResult.measurementComplete,
      stdoutBoundQualified: canaryResult.stdoutBoundsConfirmed, stdoutBasis: '182 conservative source upper bound after strict normal completion; not wire capture',
      cleanupComplete: cleanupConfirmed, outputAccountingComplete: canaryResult.outputAccountingComplete,
      close: canaryResult.stages?.[0]?.close, listener: canaryResult.stages?.[0]?.observation?.listener,
      report: canaryResult.stages?.[0]?.observation?.report, observation: canaryResult.stages?.[0]?.runtimeObservation };
    result.retainedRoots.push(...(canaryResult.privateCleanup?.retained ?? []), ...(canaryResult.stages?.[0]?.observation?.retainedRoots ?? []));
  } catch { result.stopReason = 'preparation-observation-or-persistence-unknown'; }
  finally {
    result.ownerPending = ownerPending;
    result.retainedRootsComplete = ownerPending === null && controlResult?.retainedRootsComplete === true
      && (!canaryResult || canaryResult.retainedRootsComplete === true);
    result.cleanupComplete = cleanupConfirmed && ownerPending === null;
    result.measurementComplete = result.targets.every(x => x === 'EXPECTED') && result.targetCalls === 2;
    result.knownTargetCalls = result.targetCalls;
    if (ownerPending) result.targetCalls = null; // A lost Module receipt cannot prove zero actual starts.
    result.outputAccountingComplete = ownerPending === null && controlResult?.outputAccountingComplete === true
      && (!canaryResult || canaryResult.outputAccountingComplete === true);
    try {
      const files = [];
      for (const directory of ['control', 'canary']) {
        const folder = path.join(evidenceDirectory, directory); if (!fs.existsSync(folder)) continue;
        for (const name of fs.readdirSync(folder).sort()) {
          if (!/^[a-z0-9-]+\.json$/.test(name) || files.length >= 16) fail();
          const file = path.join(folder, name), stat = fs.lstatSync(file);
          if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 32768) fail();
          const fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
          try {
            const opened = fs.fstatSync(fd); if (opened.ino !== stat.ino || opened.dev !== stat.dev) fail();
            const bytes = fs.readFileSync(fd); if (bytes.length !== stat.size) fail();
            files.push({ path: `${directory}/${name}`, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
          } finally { fs.closeSync(fd); }
        }
      }
      const expectedReceipts = amount(controlResult?.output?.receipts ?? 0)
        + amount((canaryResult?.output?.receipts ?? canaryInitialReceipts) - canaryInitialReceipts);
      const observedReceipts = files.reduce((sum, file) => sum + file.bytes, 0);
      const matchingReceiptAccounting = observedReceipts === expectedReceipts;
      unattributedReceiptBytes = Math.max(0, observedReceipts - expectedReceipts);
      if (!matchingReceiptAccounting) result.outputAccountingComplete = false;
      persist('runtime-inventory.json', { files, targetCalls: result.targetCalls, matchingReceiptAccounting, unattributedReceiptBytes }); result.inventoryPersisted = true;
    } catch { result.outputAccountingComplete = false; result.inventoryPersisted = false; }
    result.endedAt = new Date().toISOString(); result.elapsedMs = now(); result.elapsedBasis = 'before-result-persistence'; result.output = output();
    result.withinBudget = result.outputAccountingComplete && result.output.receipts <= 32768 && result.output.reservedBytes <= 2097152 && now() <= 60000;
    persist('batch-result.json', result); result.resultPersisted = true;
    result.output = output(); result.finalElapsedMs = now(); result.withinBudget &&= now() <= 60000;
  }
  return result;
}
